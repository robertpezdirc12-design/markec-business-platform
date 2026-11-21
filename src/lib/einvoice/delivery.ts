// ============================================================
// F5.5.4.6.4 / FAZA 3.2 — DOSTAVNA ZANKA (deliver-based loop).
//
// Ko je e-račun TEHNIČNO sprejet (status SUBMITTED, 2xx) še ni telematsko
// dostavljen. Ta modul preverja stanje dostave (poll) pri ponudniku in:
//   • SUBMITTED → DELIVERED  (tehnično potrjeno dostavljeno prejemniku)
//   • SUBMITTED → REJECTED   (vsebinsko zavrnjeno)
//   • SUBMITTED → FAILED     (tehnična napaka po izteku poskusov)
// in ob tem zapiše neizbrisljiv `EInvoiceDeliveryEvent` + `EInvoiceReceipt`.
//
// Multi-tenant: vsaka operacija se izvede v kontekstu `organizationId`, nikoli
// globalno. `providerMessageId` je nosilec identifikacije pošiljke pri ponudniku;
// `channel` (nastavljen ob oddaji) usmerja statusni provider brez dvoumnosti.
// ============================================================

import { prisma } from "@/lib/prisma"
import { buildProvider } from "@/lib/einvoice/providers"
import { decryptChannelCredentialsOrg } from "@/lib/einvoice/channel-credentials"
import type { ChannelCfg } from "@/lib/einvoice/channel"

/** Število prevzemov pollinga na klic (defenzivni cap — ne zavrti vse naenkrat). */
export const DELIVERY_POLL_BATCH = 50

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

/** Poišče organizacijo, ki ima ta eInvoice preko providerMessageId. */
async function findInvoiceByProviderMessageId(
  providerMessageId: string
): Promise<(PendingInvoice & { channel: string }) | null> {
  const found = await prisma.eInvoice.findFirst({
    where: { providerMessageId },
    select: { id: true, organizationId: true, status: true, providerMessageId: true, channel: true },
  })
  if (!found?.channel || !found.providerMessageId) return null
  return found as PendingInvoice & { channel: string }
}

/**
 * FAZA 3.2 — sprejme povratni webhook ponudnika (DELIVERED / REJECTED) in
 * deterministično prevede e-račun. Najprej preveri podpis (`verifyWebhook`),
 * potem v transakciji preveri, da stanje še ni terminalno. Vrača
 * `{ ok: boolean, changed: boolean, status?: string, error?: string }`.
 *
 * Varnost: `signature` se preverja z providerjevo verifikacijo — Direkt zahteva
 * idempotency ključ v headerju, certifikatni kanali pa podpis. Če se verifikacija
 * ne ujema, je vstop zavrnjen (ok:false, status 400/401), brez učinka na podatke.
 */
export async function recordDeliveryFromWebhook(input: {
  providerMessageId: string
  status: "DELIVERED" | "REJECTED"
  signature: string | null
}): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  const { providerMessageId, status, signature } = input
  if (!providerMessageId) return { ok: false, changed: false, error: "missing providerMessageId" }

  const inv = await findInvoiceByProviderMessageId(providerMessageId)
  if (!inv?.channel) return { ok: false, changed: false, error: "unknown invoice" }

  const provider = buildProvider(inv.channel)
  const cfg = await channelCfgFor(inv.organizationId, inv.channel)
  const valid = provider.verifyWebhook(inv.organizationId, cfg, signature, JSON.stringify(input))
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
 * FAZA 3.2 — preveri vse SUBMITTED e-račune (z znanim providerMessageId in
 * `channel`) pri ponudniku in jih prevede v DELIVERED / REJECTED / FAILED.
 * Idempotentno: termiнana stanja in sočasni webhook preprečijo dvojno prevajanje.
 *
 * Vrača število prevedenih in skupno preverjenih.
 */
export async function pollPendingDeliveries(
  limit: number = DELIVERY_POLL_BATCH
): Promise<{ polled: number; transitioned: number }> {
  const rows = await prisma.eInvoice.findMany({
    where: { status: "SUBMITTED", providerMessageId: { not: null }, channel: { not: null } },
    take: limit,
    select: { id: true, organizationId: true, status: true, providerMessageId: true, channel: true },
  })
  const pending = rows.filter(
    (r): r is PendingInvoice => r.channel !== null && r.providerMessageId !== null
  )

  let polled = 0
  let transitioned = 0

  for (const inv of pending) {
    const providerMessageId = inv.providerMessageId as string
    const channel = inv.channel as string
    const provider = buildProvider(channel)
    const cfg = await channelCfgFor(inv.organizationId, channel)

    let next: "SUBMITTED" | "DELIVERED" | "REJECTED" | "FAILED" = "SUBMITTED"
    try {
      const s = await provider.status(inv.organizationId, cfg, providerMessageId)
      if (s.state === "DELIVERED" || s.state === "REJECTED" || s.state === "FAILED") {
        next = s.state
      } else if (s.state === "SUBMITTED") {
        next = "SUBMITTED" // še čaka — ostane SUBMITTED za naslednji poll
      } else {
        next = "FAILED" // CANCELLED / drugo → tehnična okvara
      }
    } catch {
      next = "FAILED"
    }
    polled += 1

    if (next === "SUBMITTED") continue // brez spremembe, še ni zaključeno

    const ok = await prisma.$transaction(async (tx) => {
      // Idempotentnost: preberemo trenutno stanje v transakciji — če ga je
      // sočasni webhook že zaključil, ne prevajanmo 2×.
      const cur = await tx.eInvoice.findUnique({ where: { id: inv.id }, select: { status: true } })
      if (!cur || cur.status !== "SUBMITTED") return false

      const kind = next === "DELIVERED" ? "DELIVERED" : next === "REJECTED" ? "REJECTED" : "FAILED"
      const receiptKind =
        next === "DELIVERED" ? "DELIVERY_ACK" : next === "REJECTED" ? "REJECTION" : "FAILURE"

      await tx.eInvoice.update({ where: { id: inv.id }, data: { status: next } })
      await tx.eInvoiceDeliveryEvent.create({
        data: { organizationId: inv.organizationId, einvoiceId: inv.id, kind, message: statusMessage(next, channel, providerMessageId), actorUserId: null },
      })
      await tx.eInvoiceReceipt.create({
        data: { organizationId: inv.organizationId, einvoiceId: inv.id, kind: receiptKind, status: next, message: statusMessage(next, channel, providerMessageId) },
      })
      return true
    })
    if (ok) transitioned += 1
  }

  return { polled, transitioned }
}