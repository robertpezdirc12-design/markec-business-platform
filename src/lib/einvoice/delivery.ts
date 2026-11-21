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

/** Vrstice, ki jih zankamo berem iz DB. */
type PendingInvoice = {
  id: string
  organizationId: string
  status: string
  providerMessageId: string
  channel: string
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
 * Najde e-račun POVEZAN na (channel, providerMessageId). Zahvaljujoč enoličnemu
 * indeksu `@@unique([channel, providerMessageId])` je povezava na organizacijo
 * nedvoumna: dva različna organizacijska niza ne moreta deliti istega
 * (channel, providerMessageId) para. Vrne kanal, da `verifyWebhook` preveri
 * podpis z istim kanalom, ki je definiral oddajo.
 */
async function findInvoiceByProviderMessageId(
  channel: string,
  providerMessageId: string
): Promise<PendingInvoice | null> {
  const found = await prisma.eInvoice.findFirst({
    where: { channel, providerMessageId },
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
  channel: string
  providerMessageId: string
  status: "DELIVERED" | "REJECTED"
  signature: string | null
  timestamp: string | null
  rawBody: string | Buffer
}): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  const { channel, providerMessageId, status, signature, timestamp, rawBody } = input
  if (!providerMessageId) return { ok: false, changed: false, error: "missing providerMessageId" }
  if (!channel) return { ok: false, changed: false, error: "missing channel" }

  const inv = await findInvoiceByProviderMessageId(channel, providerMessageId)
  if (!inv) return { ok: false, changed: false, error: "unknown invoice" }

  const provider = buildProvider(inv.channel)
  const cfg = await channelCfgFor(inv.organizationId, inv.channel)
  // A5 — preverjamo NAD SUROVIMI bajti telesa; nikoli nad re-serializacijo.
  const valid = provider.verifyWebhook(inv.organizationId, cfg, signature, timestamp, rawBody)
  if (!valid) return { ok: false, changed: false, error: "invalid signature" }

  const ok = await prisma.$transaction(async (tx) => {
    const cur = await tx.eInvoice.findUnique({ where: { id: inv.id }, select: { status: true } })
    if (!cur || cur.status !== "SUBMITTED") return false
    const kind = status === "DELIVERED" ? "DELIVERED" : "REJECTED"
    const receiptKind = status === "DELIVERED" ? "DELIVERY_ACK" : "REJECTION"
    await tx.eInvoice.update({ where: { id: inv.id }, data: { status } })
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
 * A10 — začasna omrežna napaka (throw / ne-terminalno stanje): NIKOLI takojšnji
 * FAILED. Namesto tega povečamo `deliveryAttempts` in nastavimo
 * `lastDeliveryAttemptAt`; šele ko je število zaporednih neuspehov >=
 * `MAX_DELIVERY_ATTEMPTS`, vrstico prevedemo v FAILED. SUBMITTED / ne-terminalno
 * lastnost ne šteje kot poskus (običajen "še čaka", ne napaka).
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

    if (next === "SUBMITTED" && !transientError) continue // ni spremembe, še čaka

    // A10 — upravljanje začasnih napak z omejenim številom poskusov.
    if (transientError && next === "SUBMITTED") {
      const attemptAfter = await prisma.eInvoice.update({
        where: { id: inv.id },
        data: {
          deliveryAttempts: { increment: 1 },
          lastDeliveryAttemptAt: new Date(),
        },
        select: { deliveryAttempts: true },
      }).catch(() => null)
      if (!attemptAfter) continue
      if (attemptAfter.deliveryAttempts < MAX_DELIVERY_ATTEMPTS) {
        // Še ni izčrpanih poskusov → ostane SUBMITTED za naslednji cron-tek.
        continue
      }
      next = "FAILED" // izčrpani poskusi → dokončni tehnični neuspeh
    }

    const ok = await prisma.$transaction(async (tx) => {
      // Idempotentnost: preberemo trenutno stanje v transakciji — če ga je
      // sočasni webhook že zaključil, ne prevajanmo 2×.
      const cur = await tx.eInvoice.findUnique({ where: { id: inv.id }, select: { status: true } })
      if (!cur || cur.status !== "SUBMITTED") return false

      // Po uspešnem prehodu ponastavi števec poskusov (clean slate).
      await tx.eInvoice.update({
        where: { id: inv.id },
        data: { status: next, deliveryAttempts: 0 },
      })
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
  const rows = await prisma.eInvoice.findMany({
    where: {
      status: "SUBMITTED",
      providerMessageId: { not: null },
      channel: { not: null },
      ...(organizationId ? { organizationId } : {}),
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
    select: { id: true, organizationId: true, status: true, providerMessageId: true, channel: true },
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