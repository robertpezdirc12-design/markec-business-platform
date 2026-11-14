// ============================================================
// F5.1.2+F5.1.4 — ZAČASNA REZERVACIJA PROMOCIJSKEGA MESTA ob Stripe checkoutu
//
// Cilj (F5.1.4 — dve pravili hkrati):
//   1. Kupec nikoli ne plača drugačnega zneska, kot je evidentiran na
//      naročilu (amount integrity).
//   2. Promocija z maxUses=1 nikoli ne omogoči dveh uspešnih unovčitev
//      zaradi zamujenega webhooka (stroga omejitev uporabe).
//
// Ključni sklep: mesto se sprosti SAMO na podlagi avtoritativnega stanja
// Stripe Checkout Session (requirement A), NIKOLI samo na podlagi lokalne
// ure. Zato rezervacija, katere plačilo je dejansko poteklo, NIKOLI ni
// sproščena, preden to potrdi Stripe — s tem drugi kupec nikoli ne dobi
// mesta, dokler prvo plačilo ni dokončno neplačano, in obe pravili
// veljata hkrati.
//
//   • RESERVED šteje proti omejitvi (maxRedemptions/maxPerCustomer) →
//     naslednji kupec ne more dobiti popusta, dokler mesto ni Stripe-
//     potrjeno prosto.
//   • uspešno plačilo → convertReservationToRedemption() preklopi v
//     REDEEMED (unovčenje). Idempotentno; @@unique([promotionId, orderId])
//     je zadnja ograja.
//   • Sprostitev po heldUntil → najprej `reconcileExpiredReservations()`
//     preveri Stripe: paid → REDEEMED, expirano+unpaid → sprosti,
//     processing/neznano/nedosegljivo → OHRANI (ne sprosti).
//
// SOČASNOST (requirement B): convert/release tečeta znotraj prisma
// transakcije z ROW LOCK (SELECT … FOR UPDATE) na vrstici rezervacije in
// nato vzporedno primerjaj-in-nastavi na status. Ista rezervacija tako ne
// more biti hkrati sproščena in unovčena.
// ============================================================

import type { Prisma, PrismaClient } from "@prisma/client"

export type RedemptionStatus = "RESERVED" | "REDEEMED"

/**
 * Avtoritativno stanje Stripe Checkout seje za odločitev o sprostitvi.
 * - "paid"          → plačilo je uspelo → rezervacijo pretvori v REDEEMED.
 * - "unpaid"        → seja je potekla in ni plačana → mesto se lahko sprosti.
 * - "processing"    → plačilo v teku → mesto OHRANI.
 * - "unknown"       → stanja ni mogoče zanesljivo ugotoviti → OHRANI.
 */
export type HeldSessionState = "paid" | "unpaid" | "processing" | "unknown"

export type SessionStateResolver = (
  checkoutSessionId: string
) => Promise<HeldSessionState>

/**
 * Normaliziran Stripe Checkout Session izrezek, ki ga vnese
 * `stripeSessionStateResolver`. Ločimo ga od polnega Stripe objekta, da
 * ostane resolver neodvisen od stripe SDK tipov in preprost za testiranje.
 */
export interface StripeSessionStateInput {
  payment_status: string | null | undefined
  status: string | null | undefined
  payment_intent: string | null | { status?: string | null } | undefined
}

/**
 * (F5.1.4 — popravek) Pretvori dejanski Stripe Checkout Session v
 * `HeldSessionState` strogo po requirement A:
 *   • payment_status = "paid"                       → "paid"   (pretvori v REDEEMED)
 *   • status = "expired" IN neplačano               → "unpaid" (sprosti)
 *   • plačilo v teku (PI processing) ali nedosegljivo/neznano → "unknown" (OHRANI)
 *
 * Le seje z status="expired" in payment_status !="paid" se štejejo za
 * dokončno neplačane in se lahko sprostijo. Nič drugega se ne sprosti —
 * posebej ne "open" seje (še plačljive) in ne ob napaki/neznanem stanju.
 * Če nalagalec vrže (Stripe API nedosegljiv), vrnemo "unknown" → mesto se
 * OHRANI (ne sprosti).
 */
export function stripeSessionStateResolver(
  loadSession: (checkoutSessionId: string) => Promise<StripeSessionStateInput>
): SessionStateResolver {
  return async (checkoutSessionId) => {
    let s: StripeSessionStateInput
    try {
      s = await loadSession(checkoutSessionId)
    } catch {
      // Stripe API nedosegljiv → ne smemo sprostiti po lokalni uri.
      return "unknown"
    }
    if (!s) return "unknown"

    if (s.payment_status === "paid") return "paid"

    // Plačilo v teku (npr. asinhroni način) → ohrani.
    if (
      typeof s.payment_intent === "object" &&
      s.payment_intent &&
      s.payment_intent.status === "processing"
    ) {
      return "processing"
    }

    // Dokončno neplačana, pretečena seja → edina dovoljena sprostitev.
    if (s.status === "expired" && s.payment_status !== "paid") return "unpaid"

    // "open"/še plačljiva, "canceled"/"abandoned" bez potrdila, neznano →
    // OHRANI (privzeto varno).
    return "unknown"
  }
}

/** Prisma where, ki šteje "zasedeno od tam": vse RESERVED ali REDEEMED. */
export function heldPromotionWhere(
  promotionId: string
): Prisma.PromotionRedemptionWhereInput {
  return {
    promotionId,
    OR: [{ status: "REDEEMED" }, { status: "RESERVED" }],
  }
}

export interface ReserveSlotArgs {
  organizationId: string
  promotionId: string
  customerId?: string | null
  guestEmail?: string | null
  codeUsed?: string | null
  discountAmount: number
  baseAmount: number
  /** Kdaj rezervacija postane kandidat za Stripe reconciliation. */
  heldUntil: Date
}

export type ReserveSlotResult =
  | { ok: true; id: string }
  | { ok: false; reason: "INACTIVE" | "LIMIT_REACHED" | "PER_CUSTOMER_LIMIT" }

/**
 * Atomično rezervira mesto za eno promocijo. ROW LOCK (SELECT … FOR UPDATE)
 * na vrstici Promotion serializira sočasna rezerviranja, da dva vzporedna
 * checkout-a nikoli ne zakleneta več kot `maxRedemptions` mest. Šteje se
 * vse RESERVED + REDEEMED — mesto se sprosti izključno prek
 * `reconcileExpiredReservations` (Stripe-potrjeno).
 */
export async function reservePromotionSlot(
  tx: Prisma.TransactionClient,
  args: ReserveSlotArgs
): Promise<ReserveSlotResult> {
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Promotion" WHERE id = ${args.promotionId} FOR UPDATE
  `
  if (lockedRows.length === 0) return { ok: false, reason: "INACTIVE" }

  const promo = await tx.promotion.findUnique({
    where: { id: args.promotionId },
    select: { status: true, maxRedemptions: true, maxPerCustomer: true },
  })
  if (!promo || promo.status !== "ACTIVE") return { ok: false, reason: "INACTIVE" }
  if (promo.maxRedemptions != null) {
    const used = await tx.promotionRedemption.count({
      where: heldPromotionWhere(args.promotionId),
    })
    if (used >= promo.maxRedemptions) return { ok: false, reason: "LIMIT_REACHED" }
  }
  if (promo.maxPerCustomer != null) {
    const keys: Prisma.PromotionRedemptionWhereInput[] = []
    if (args.customerId) keys.push({ customerId: args.customerId })
    if (args.guestEmail) {
      keys.push({ guestEmail: args.guestEmail.trim().toLowerCase() })
    }
    if (keys.length > 0) {
      const used = await tx.promotionRedemption.count({
        where: {
          promotionId: args.promotionId,
          OR: keys,
        },
      })
      if (used >= promo.maxPerCustomer) {
        return { ok: false, reason: "PER_CUSTOMER_LIMIT" }
      }
    }
  }

  const row = await tx.promotionRedemption.create({
    data: {
      organizationId: args.organizationId,
      promotionId: args.promotionId,
      customerId: args.customerId ?? null,
      guestEmail: args.guestEmail?.trim().toLowerCase() || null,
      codeUsed: args.codeUsed ?? null,
      status: "RESERVED",
      heldUntil: args.heldUntil,
      discountAmount: args.discountAmount.toFixed(2),
      baseAmount: args.baseAmount.toFixed(2),
    },
    select: { id: true },
  })
  return { ok: true, id: row.id }
}

/**
 * Uspešno plačilo → rezervacija postane unovčenje (REDEEMED). Idempotentno in
 * ATOMSKO: row-lock na vrstici, nato primerjaj-in-nastavi na status RESERVED.
 * Sočasni release (reconcile) na isti vrstici se serializira — samo eden
 * zmaga, drugi ne naredi nič. Vrne število spremenjenih vrstic (0|1).
 */
export async function convertReservationToRedemption(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<number> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "PromotionRedemption"
    WHERE "orderId" = ${orderId} AND status = 'RESERVED'
    FOR UPDATE
  `
  if (rows.length === 0) return 0 // ni RESERVED vrste → nič za pretvoriti
  const r = await tx.promotionRedemption.updateMany({
    where: { id: rows[0].id, status: "RESERVED" },
    data: {
      status: "REDEEMED",
      heldUntil: null,
      checkoutSessionId: null,
    },
  })
  return r.count
}

/**
 * Eksplicitno sprosti rezervacije za določen order/stripe session. ATOMSKO in
 * idempotentno: prebere ID-je RESERVED vrstic, jih row-lock-a (v stabilnem
 * vrstnem redu) in izbriše le tiste, ki so ŠE vedno RESERVED. Sočasni convert
 * na isti vrstici zmaga, release pa ne izbriše že REDEEMED vrste.
 * Vrne število sproščenih.
 */
export async function releaseReservation(
  tx: Prisma.TransactionClient,
  where: { orderId?: string; checkoutSessionId?: string }
): Promise<number> {
  const matches: { id: string }[] = await tx.promotionRedemption.findMany({
    where: {
      status: "RESERVED",
      ...(where.orderId ? { orderId: where.orderId } : {}),
      ...(where.checkoutSessionId ? { checkoutSessionId: where.checkoutSessionId } : {}),
    },
    select: { id: true },
  })
  if (matches.length === 0) return 0
  const ids = matches.map((m) => m.id)
  // Row-lock vse kandidate v pravilnem vrstnem redu (izogib deadlocku).
  for (const id of [...ids].sort()) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "PromotionRedemption" WHERE id = ${id} FOR UPDATE
    `
  }
  const res = await tx.promotionRedemption.deleteMany({
    where: { id: { in: ids }, status: "RESERVED" },
  })
  return res.count
}

export interface ReconcileOptions {
  /** Omeji na eno promocijo (prostovoljno). */
  promotionId?: string
  /** testni hook: "sedaj". */
  now?: Date
}

/**
 * Stripe-potrjena sprostitev/pretvorba ekspiranih rezervacij (requirement A):
 * za vsako RESERVED vrstico s pretečenim heldUntil in nastavljenim
 * checkoutSessionId preveri dejansko stanje Stripe Checkout seje.
 *   • paid           → pretvori v REDEEMED,
 *   • unpaid/expired → sprosti (izbriše),
 *   • processing/unknown/nedosegljivo → OHRANI (ne sprosti).
 * Rezervacije brez checkoutSessionId (ni Stripe povezave) se ohranijo.
 * Vsaka pretvorba/sprostitev je atomska in row-locked (requirement B).
 */
export async function reconcileExpiredReservations(
  prisma: PrismaClient,
  opts: ReconcileOptions,
  resolveSession: SessionStateResolver | null
): Promise<{ converted: number; released: number; kept: number }> {
  const out = { converted: 0, released: 0, kept: 0 }
  const now = opts.now ?? new Date()

  const candidates = await prisma.promotionRedemption.findMany({
    where: {
      status: "RESERVED",
      heldUntil: { lte: now },
      checkoutSessionId: { not: null },
      ...(opts.promotionId ? { promotionId: opts.promotionId } : {}),
    },
    select: { id: true, orderId: true, checkoutSessionId: true },
  })

  for (const cand of candidates) {
    const sessionId = cand.checkoutSessionId
    const state =
      sessionId && resolveSession ? await resolveSession(sessionId) : "unknown"
    if (state === "paid") {
      await prisma.$transaction(async (tx) => {
        if (cand.orderId) {
          const n = await convertReservationToRedemption(tx, cand.orderId!)
          out.converted += n
          if (n === 0) out.kept++
        } else {
          out.kept++
        }
      })
    } else if (state === "unpaid") {
      await prisma.$transaction(async (tx) => {
        const n = await releaseReservation(tx, { orderId: cand.orderId ?? undefined })
        out.released += n
        if (n === 0) out.kept++
      })
    } else {
      // processing / unknown → ohrani.
      out.kept++
    }
  }
  return out
}