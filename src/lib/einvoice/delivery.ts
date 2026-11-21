// ============================================================
// F5.5.4.6.4 / FAZA 3.2 — DOSTAVNA ZANKA (deliver-based loop).
//
// Ko je e-račun TEHNIČNO sprejet (status SUBMITTED, 2xx) še ni telematsko
// dostavljen. Ta modul preverja stanje dostave (poll) pri ponudniku in:
//   • SUBMITTED → DELIVERED  (tehnično potrjeno dostavljeno prejemniku)
//   • SUBMITTED → REJECTED   (vsebinsko zavrnjeno)
//   • SUBMITTED → FAILED     (tehnična napaka, ko je ŠT. POSKUSOV IZČRPANA)
// in ob tem zapiše neizbrisljiv `EInvoiceDeliveryEvent` + `EInvoiceReceipt`.
//
// Multi-tenant (varnost):
//   • Polling NI nikoli globalen iz uporabniške akcije. Org uporabnik lahko
//     sproži samo polling svoje organizacije (`pollPendingDeliveriesForOrg`).
//     Sistemko globalno opravilo (`/api/cron/tick`) kliče `pollPendingDeliveries`
//     prek stroge cron-secret avtorizacije — nikoli prek org surface.
//   • Povratni webhook se veže na (channel, providerMessageId) prek enoličnega
//     indeksa `@@unique([channel, providerMessageId])`, zato nikoli ne more
//     dvoumno zadeti organizacije (A6).
//   • Podpis webhooka se preverja NAD DEJANSKIMI bajti prejetega telesa
//     (`rawBody`), ne nad ponovno sestavljenim `JSON.stringify` (A5).
//   • Začasna omrežna napaka NIKOLI ne pomeni takojšnjega FAILED: zankamo
//     števec `deliveryAttempts`, omejimo poskuse in šele po izčrpanih poskusih
//     prevedemo v FAILED (A10).
// ============================================================

import { prisma } from "@/lib/prisma"
import { buildProvider } from "@/lib/einvoice/providers"
import { decryptChannelCredentialsOrg } from "@/lib/einvoice/channel-credentials"
import type { ChannelCfg } from "@/lib/einvoice/channel"

/** Število prevzemov pollinga na klic (defenzivni cap — ne zavrti vse naenkrat). */
export const DELIVERY_POLL_BATCH = 50

/** Največje število zaporednih polingov dostave, preden začasna napaka postane FAILED. */
export const MAX_DELIVERY_ATTEMPTS = 3

/** Osnovna zamuda pred naslednjim poskusom po stalnem SUBMITTED odgovoru (ms). */
export const POLL_BACKOFF_BASE_MS = 60_000
/** Zgornja meja zamude med dvema poskusoma polinga (ms). */
export const POLL_BACKOFF_MAX_MS = 10 * 60_000
/**
 * Trajanje "najema" vrstice med obdelavo (ms). Ko worker izbere vrstico,
 * atomarno postavi `nextPollAt = now + POLL_LOCK_LEASE_MS`; drug sočasen worker,
 * ki poskusi prevzeti isto vrstico, jo v tem oknu NE dobi (count 0 → preskok).
 * Preventi dvojno obdelovanje istega računa, hkrati pa omogoča pošteno rotacijo.
 */
export const POLL_LOCK_LEASE_MS = 5 * 60_000

/** Zamuda med prvo pavzo in naslednjim poskusom po začasni (omrežni) napaki. */
export function pollBackoffMs(attempt: number): number {
  const exp = POLL_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1)
  return Math.min(exp, POLL_BACKOFF_MAX_MS)
}

/** Vrstice, ki jih zankamo berem iz DB. */
type PendingInvoice = {
  id: string
  organizationId: string
  status: string
  providerMessageId: string
  channel: string
  deliveryAttempts: number
  lastDeliveryAttemptAt: Date | null
  lastPolledAt: Date | null
  nextPollAt: Date | null
}

export async function channelCfgFor(orgId: string, channel: string): Promise<ChannelCfg> {
  const cfg = await prisma.eInvoiceChannelConfig.findFirst({ where: { organizationId: orgId, channel } })
  const credentials = await decryptChannelCredentialsOrg(orgId, channel)
  return {
    id: cfg?.id ?? `poll-${channel}`,
    organizationId: orgId,
    channel,
    providerEndpoint: cfg?.providerEndpoint ?? null,
    credentials: credentials ?? {},
    config: (cfg?.config as Record<string, unknown>) ?? {},
  }
}

/**
 * Najde e-račun POVEZAN na kriptografsko potrjeno (organizationId, channel,
 * providerMessageId). TOČKA 2 — organizacija je določena KROGTOGRAFSKO (HMAC
 * skrivnost vezana na org+kanal smo preverili pred tem klicem), zato se tu
 * `organizationId` NE smatra za nekontrollran privilegij; uporablja se kot
 * filter, da webhook ene organizacije nikoli ne najde računa druge. Ker je
 * indeks `@@unique([organizationId, channel, providerMessageId])`, je iskanje
 * vedno nedvoumno in vrača največ eno vrstico.
 * Vrne kanal+organizacijo, da `verifyWebhook` preveri podpis z istim kanalom.
 */
async function findInvoiceByProviderMessageId(
  organizationId: string,
  channel: string,
  providerMessageId: string
): Promise<PendingInvoice | null> {
  const found = await prisma.eInvoice.findFirst({
    where: { organizationId, channel, providerMessageId },
    select: { id: true, organizationId: true, status: true, providerMessageId: true, channel: true },
  })
  if (!found?.channel || !found.providerMessageId) return null
  return found as PendingInvoice
}

/**
 * FAZA 3.2 — sprejme povratni webhook ponudnika (DELIVERED / REJECTED) in
 * deterministično prevede e-račun.
 *
 * Varnost:
 *   • `rawBody` so DEJANSKO prejeti bajti telesa (Buffer), kot prihajajo iz
 *     HTTP veje; podpis se preverja nad njimi, ne nad ponovnim `JSON.stringify` (A5).
 *   • `channel` mora biti del vhoda, da se pošiljka nedvomno veže na
 *     (channel, providerMessageId) in preverja podpis s pravim kanalom (A6).
 *   • `signature` + `timestamp` → `verifyWebhook` (HMAC za Direct, reject za
 *     cert, ker certificirano preverjanje ni implementirano). Brez veljavnega
 *     podpisa → ok:false BREZ učinka na podatke (fail-closed).
 */
export async function recordDeliveryFromWebhook(input: {
  organizationId: string
  channel: string
  providerMessageId: string
  status: "DELIVERED" | "REJECTED"
  signature: string | null
  timestamp: string | null
  rawBody: string | Buffer
}): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  const { organizationId, channel, providerMessageId, status, signature, timestamp, rawBody } = input
  if (!providerMessageId) return { ok: false, changed: false, error: "missing providerMessageId" }
  if (!channel) return { ok: false, changed: false, error: "missing channel" }
  if (!organizationId) return { ok: false, changed: false, error: "missing organizationId" }

  // TOČKA 2 — organizacijo najprej KRIPTOGRAFSKO potrdimo z skrivnostjo
  // org+kanal iz telesa (usmerjevalnik), ne pa iz nezaupanja vrednega `id`.
  // Če kanal/org nima nastavljene skrivnosti ali podpis ne velja → fail-closed,
  // še preden sploh poizvedujemo po računih. S tem v skladu s kriptografsko
  // potrjeno pripadnostjo preprečimo, da bi webhook ene org zadel račun druge.
  const cfg = await channelCfgFor(organizationId, channel)
  const provider = buildProvider(channel)
  const valid = provider.verifyWebhook(organizationId, cfg, signature, timestamp, rawBody)
  if (!valid) return { ok: false, changed: false, error: "invalid signature" }
  if (!cfg.credentials?.webhookSecret) return { ok: false, changed: false, error: "no secret configured" }

  const inv = await findInvoiceByProviderMessageId(organizationId, channel, providerMessageId)
  if (!inv) return { ok: false, changed: false, error: "unknown invoice" }

  // TOČKA 1 — ATOMSKI PREHOD: pogoji DOUBLE-CHECK je vgrajen v sam SQL UPDATE.
  // `updateMany` ne uporablja read-then-write: UPDATE ... SET status=? WHERE
  // id=? AND status='SUBMITTED' se izvede kot ena atomska operacija pod DB
  // izolacijskim nivojem. Če sta se sočasna zahtevka (webhook + polling) oba
  // podala verifikaciji, le EDEN dobi count=1; drugi dobi count=0 in ne ustvari
  // dogodka/potrdila. Terminalni status (DELIVERED/REJECTED) nikoli ni prepisan.
  const ok = await prisma.$transaction(async (tx) => {
    const res = await tx.eInvoice.updateMany({
      where: { id: inv.id, status: "SUBMITTED" },
      data: { status },
    })
    if (res.count !== 1) return false // ni bilo več v SUBMITTED → idempotentno ignoriraj
    const kind = status === "DELIVERED" ? "DELIVERED" : "REJECTED"
    const receiptKind = status === "DELIVERED" ? "DELIVERY_ACK" : "REJECTION"
    await tx.eInvoiceDeliveryEvent.create({
      data: {
        organizationId: inv.organizationId,
        einvoiceId: inv.id,
        kind,
        message: statusMessage(status, inv.channel, providerMessageId),
        actorUserId: null,
      },
    })
    await tx.eInvoiceReceipt.create({
      data: {
        organizationId: inv.organizationId,
        einvoiceId: inv.id,
        kind: receiptKind,
        status,
        message: statusMessage(status, inv.channel, providerMessageId),
      },
    })
    return true
  })

  return { ok: true, changed: ok }
}

function statusMessage(
  status: "DELIVERED" | "REJECTED" | "FAILED",
  channel: string,
  providerMessageId: string
): string {
  const id = `provider: ${providerMessageId ?? "?"}`
  switch (status) {
    case "DELIVERED":
      return `E-račun je telematsko dostavljen prejemniku prek '${channel}' (${id}).`
    case "REJECTED":
      return `E-račun je prejemnik vsebinsko zavrnil prek '${channel}' (${id}).`
    default:
      return `Dostava e-računa je tehnično propadla prek '${channel}' (${id}).`
  }
}

/**
 * Skupna logika polla za en seznam e-računov. `organizationId` (če podan) zoža
 * scenarij na ENO organizacijo — uporabniška akcija nikoli ne sme pollati drugih.
 *
 * TOČKA 4 — POŠTEN POLLING z backoffom:
 *  - Vsaka vrstica je najprej ATOMARNO prevzeta ("proud-claim", `nextPollAt`
 *    postavimo v prihodnost za POLL_LOCK_LEASE_MS), zato jo dva sočasna workerja
 *    ne obdelata dvojno.
 *  - Stalni SUBMITTED odgovor NIKOLI ne poveča `deliveryAttempts` (ni napaka),
 *    ampak `nextPollAt` prestavi v prihodnost po backoffu → vrsta se pošteno
 *    pomika naprej (brez starvation prvih `DELIVERY_POLL_BATCH` vrstic).
 *  - Začasna omrežna napaka poveča `deliveryAttempts` + `lastDeliveryAttemptAt`,
 *    a poskusi so ČASOVNO RAZMAKNJENI z `nextPollAt` backoffom (ne trije klici
 *    v istem cron-teku). Šele ko `deliveryAttempts >= MAX_DELIVERY_ATTEMPTS`, je
 *    FAILED. Začasna napaka NIKOLI ne pomeni "račun ni bil dostavljen".
 *
 * Statusi se spreminjajo SAMO na podlagi preverjenega dokaza ponudnika:
 * provider.status() mora vrniti DELIVERED/REJECTED/FAILED; vse ostalo ostane
 * SUBMITTED. Noben ponudnik ne sme lažno vrniti DELIVERED.
 */
async function pollInvoices(
  pending: PendingInvoice[],
  // A7: `organizationId` zoži scenarij iz uporabniške akcije.
  organizationIdFilter?: string
): Promise<{ polled: number; transitioned: number }> {
  let polled = 0
  let transitioned = 0

  for (const inv of pending) {
    if (organizationIdFilter && inv.organizationId !== organizationIdFilter) {
      // Defenzivno preskoči vrstico druge org, če bi filter kdaj zatajil.
      // (indeks + where `organizationId` preprečita, da bi se sploh pojavila.)
      continue
    }
    const providerMessageId = inv.providerMessageId as string
    const channel = inv.channel as string
    const provider = buildProvider(channel)
    const cfg = await channelCfgFor(inv.organizationId, channel)

    // TOČKA 4.6 — "proud-claim": atomarno zaklenemo vrstico za TIME-LEASE, da
    // dva sočasna workerja ne obdelata istega e-računa hkrati. Če druga workerja
    // pravkar obdeluje (nextPollAt v prihodnosti), je count 0 in to iteracijo
    // preskočimo. Varnostno zavezano: ne podvajamo `provider.status()` klicev.
    const now = new Date()
    const claim = await prisma.eInvoice.updateMany({
      where: { id: inv.id, OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }] },
      data: { lastPolledAt: now, nextPollAt: new Date(now.getTime() + POLL_LOCK_LEASE_MS) },
    })
    if (claim.count !== 1) continue // prevzel ga že drug worker → ne prekorači

    let next: "SUBMITTED" | "DELIVERED" | "REJECTED" | "FAILED" = "SUBMITTED"
    let transientError = false
    try {
      const s = await provider.status(inv.organizationId, cfg, providerMessageId)
      if (s.state === "DELIVERED" || s.state === "REJECTED" || s.state === "FAILED") {
        next = s.state // preverjen dokaz ponudnika
      } else if (s.state === "SUBMITTED") {
        next = "SUBMITTED" // še čaka — a "pending" tudi ni napaka; 0 poskusov
      } else {
        transientError = true // CANCELLED / neznano → začasno, ni dokončnega dokaza
      }
    } catch {
      transientError = true // začasna omrežna napaka / nedosegljivost ponudnika
    }
    polled += 1

    // TOČKA 4.2 — stalni SUBMITTED odgovor PONASTAVI cron v ozadje vrste, da se
    // ne obdelujejo vedno iste prve vrstice (starvation). `deliveryAttempts`
    // se NE poveča, ker to ni napaka — račun še vedno pravilno čaka.
    if (next === "SUBMITTED" && !transientError) {
      await prisma.eInvoice.update({
        where: { id: inv.id },
        data: { nextPollAt: new Date(now.getTime() + pollBackoffMs(inv.deliveryAttempts + 1)) },
      })
      continue
    }

    // A10 + TOČKA 4.3/4.7 — upravljanje začasnih napak z OMRežnim BACKOFFom.
    // Trije poskusi so časovno razmaknjeni, da se ne izčrpajo v treh skoraj
    // zaporednih cron-tecih. Začasna omrežna napaka NIKOLI ne pomeni, da je
    // račun nedostavljen; dokler račun naleti na začasno napako in je `next`
    // še SUBMITTED, ga samo premičemo v prihodnost (backoff) in povečamo
    // števec. Ko števec doseže MAX_DELIVERY_ATTEMPTS, je dokončni neuspeh.
    if (transientError && next === "SUBMITTED") {
      const attemptAfter = await prisma.eInvoice.update({
        where: { id: inv.id },
        data: {
          deliveryAttempts: { increment: 1 },
          lastDeliveryAttemptAt: new Date(),
          nextPollAt: new Date(now.getTime() + pollBackoffMs(/* odloži rast v roku */ 1)),
        },
        select: { deliveryAttempts: true },
      }).catch(() => null)
      if (!attemptAfter) continue
      if (attemptAfter.deliveryAttempts < MAX_DELIVERY_ATTEMPTS) {
        // Še ni izčrpanih poskusov → ostane SUBMITTED; naslednji poskus naj
        // poteka šele po backoff zamudi (zgoraj `nextPollAt`).
        continue
      }
      next = "FAILED" // izčrpani poskusi → dokončni tehnični neuspeh
    }

    const ok = await prisma.$transaction(async (tx) => {
      // TOČKA 1 — ATOMSKI PREHOD: pogoj `status=SUBMITTED` je del samega UPDATE.
      // Če je sočasni webhook/polling že zaključil račun, `count` je 0 → ne
      // ustvarimo dogodka/potrdila in ne prepišemo terminalnega statusa.
      // Po uspešnem prehodu ponastavi števec poskusov (clean slate).
      const up = await tx.eInvoice.updateMany({
        where: { id: inv.id, status: "SUBMITTED" },
        data: { status: next, deliveryAttempts: 0, nextPollAt: null, lastPolledAt: new Date() },
      })
      if (up.count !== 1) return false
      const kind = next === "DELIVERED" ? "DELIVERED" : next === "REJECTED" ? "REJECTED" : "FAILED"
      const terminalState: "DELIVERED" | "REJECTED" | "FAILED" =
        kind === "DELIVERED" ? "DELIVERED" : kind === "REJECTED" ? "REJECTED" : "FAILED"
      const receiptKind =
        next === "DELIVERED" ? "DELIVERY_ACK" : next === "REJECTED" ? "REJECTION" : "FAILURE"
      await tx.eInvoiceDeliveryEvent.create({
        data: { organizationId: inv.organizationId, einvoiceId: inv.id, kind, message: statusMessage(terminalState, channel, providerMessageId), actorUserId: null },
      })
      await tx.eInvoiceReceipt.create({
        data: { organizationId: inv.organizationId, einvoiceId: inv.id, kind: receiptKind, status: terminalState, message: statusMessage(terminalState, channel, providerMessageId) },
      })
      return true
    })
    if (ok) transitioned += 1
  }

  return { polled, transitioned }
}

async function findPending(limit: number, organizationId?: string): Promise<PendingInvoice[]> {
  const now = new Date()
  const rows = await prisma.eInvoice.findMany({
    where: {
      status: "SUBMITTED",
      providerMessageId: { not: null },
      channel: { not: null },
      // TOČKA 4 — izberi samo časovno PRIMERNE za naslednji poskus: še nikoli
      // pollani (nextPollAt je null) ali že zapadli (nextPollAt <= now). Vrstice,
      // ki so jih drugi workerji pravkar zaklenili (nextPollAt v prihodnosti),
      // tokrat preskočimo → poštena rotacija brez saddle dveh workerjev.
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }],
      ...(organizationId ? { organizationId } : {}),
    },
    take: limit,
    // Najprej najbolj zapadle (null → vzemi prvič), nato po starosti vrstice.
    orderBy: [{ nextPollAt: "asc" }, { updatedAt: "asc" }],
    select: {
      id: true,
      organizationId: true,
      status: true,
      providerMessageId: true,
      channel: true,
      deliveryAttempts: true,
      lastDeliveryAttemptAt: true,
      lastPolledAt: true,
      nextPollAt: true,
    },
  })
  return rows.filter(
    (r): r is PendingInvoice => r.channel !== null && r.providerMessageId !== null
  )
}

/**
 * SISTEMSKO globalno opravilo (cron) — polla SUBMITTED e-račune VSEH organizacij.
 * Poklicano IZKLJUČNO iz `/api/cron/tick` (Bearer CRON_SECRET) ali
 * `pollPendingDeliveriesSystem`. NIKOLI iz org uporabniške akcije.
 */
export async function pollPendingDeliveries(
  limit: number = DELIVERY_POLL_BATCH
): Promise<{ polled: number; transitioned: number }> {
  return pollInvoices(await findPending(limit))
}

/**
 * A7 — polla SUBMITTED e-račune SAMO ene organizacije. Org uporabnik (skrbnik /
 * finančnik) to pokliče z lastnim `organizationId`; filter zoži poizvedbo in
 * vrstice drugih organizacij so defenzivno preskočene.
 */
export async function pollPendingDeliveriesForOrg(
  organizationId: string,
  limit: number = DELIVERY_POLL_BATCH
): Promise<{ polled: number; transitioned: number }> {
  return pollInvoices(await findPending(limit, organizationId), organizationId)
}