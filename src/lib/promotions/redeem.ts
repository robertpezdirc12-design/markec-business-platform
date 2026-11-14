// ============================================================
// F5.1 — ATOMSKO UNOVČENJE PROMOCIJE (transakcijsko, varovano)
//
// `redeemPromotion` se kliče ZNOTRAJ prisma.$transaction (isti tx kot
// ustvarjanje naročila/rezervacije). Zaščita pred sočasno večkratno
// uporabo (§4 zahteve F5.1):
//   • ROW LOCK: `SELECT … FOR UPDATE` na vrstici Promotion serializira
//     sočasna unovčenja iste promocije — dva vzporedna zahtevka ne
//     smeta oba prešteti pod `maxRedemptions`.
//   • ATOMSKA OMEJITEV NA STRANKO: štejemo redemptions za to
//     stranko/e-pošto ZNOTRAJ ključavnice, preden zapišemo novo.
//   • ZADNJA VAROVALKA: `@@unique([promotionId, orderId])` in
//     `@@unique([promotionId, appointmentId])` naredita dvojno
//     unovčenje iste promocije na isti transakciji nemogoče tudi,
//     če bi se kakšen ček zaobšel.
//
// Vrne baseAmount/discountAmount, da klicatelj zapiše immutabilni
// posnetek na Order/Appointment. Vrže PromotionRedeemError z
// uporabniškim sporočilom pri kršitvi pravil.
// ============================================================

import type { Prisma } from "@prisma/client"
import { round2, isWithinWindow, type PromotionRule } from "./engine"
import { heldPromotionWhere } from "./reservation"

export class PromotionRedeemError extends Error {
  code:
    | "INACTIVE"
    | "OUTSIDE_WINDOW"
    | "LIMIT_REACHED"
    | "PER_CUSTOMER_LIMIT"
    | "NOT_FOUND"
  constructor(
    code: PromotionRedeemError["code"],
    message: string
  ) {
    super(message)
    this.name = "PromotionRedeemError"
    this.code = code
  }
}

interface RedeemInput {
  promotion: PromotionRule
  /** Osnova (pred popustom), na katero se popust nanaša. */
  baseAmount: number
  customerId?: string | null
  /** Normalizirana e-pošta (če ni Customer vrstice). */
  guestEmail?: string | null
  orderId?: string | null
  appointmentId?: string | null
  codeUsed?: string | null
}

/**
 * Atomic redemption. MUST run inside a Prisma interactive transaction;
 * the caller then writes the final Order/Appointment (with the returned
 * discount). Returns the exact figures to store.
 */
export async function redeemPromotion(
  tx: Prisma.TransactionClient,
  input: RedeemInput
): Promise<{ baseAmount: number; discountAmount: number }> {
  const now = new Date()
  const rule = input.promotion

  // 1) Serialize concurrent redemptions of this promotion with a row lock.
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Promotion" WHERE id = ${rule.id} FOR UPDATE
  `
  if (lockedRows.length === 0) {
    throw new PromotionRedeemError("NOT_FOUND", "Promocija ne obstaja.")
  }

  // 2) Re-validate (server authority — nothing from the client trusted).
  if (rule.status !== "ACTIVE") {
    throw new PromotionRedeemError("INACTIVE", "Ta promocija trenutno ni aktivna.")
  }
  if (!isWithinWindow(rule, now)) {
    throw new PromotionRedeemError(
      "OUTSIDE_WINDOW",
      "Ta promocija ni več v veljavi (obdobje veljavnosti se je izteklo)."
    )
  }

  // 3) Total-use limit (safe now that the row is locked).
  // F5.1.2/F5.1.4: šteje "held" = vse REDEEMED + vse RESERVED — rezervacija
  // drži mesto, dokler je Stripe ni potrdil kot prosto (sprostitev zgolj po
  // času ni dovoljena; glej reconcileExpiredReservations).
  const totalUses = await tx.promotionRedemption.count({
    where: heldPromotionWhere(rule.id),
  })
  if (rule.maxRedemptions != null && totalUses >= rule.maxRedemptions) {
    throw new PromotionRedeemError(
      "LIMIT_REACHED",
      "Ta promocija je že dosegla največje dovoljeno število uporab."
    )
  }

  // 4) Per-customer limit.
  if (rule.maxPerCustomer != null) {
    const keyOR: Prisma.PromotionRedemptionWhereInput[] = []
    if (input.customerId) keyOR.push({ customerId: input.customerId })
    if (input.guestEmail) keyOR.push({ guestEmail: input.guestEmail.trim().toLowerCase() })
    if (keyOR.length > 0) {
      // Štejemo vse vrstice te promocije, ki pripadajo strankam (REDEEMED ali
      // poljuben RESERVED) — held rezervacije držijo tudi per-customer mesto.
      const customerUses = await tx.promotionRedemption.count({
        where: {
          promotionId: rule.id,
          OR: [
            { status: "REDEEMED", OR: keyOR },
            { status: "RESERVED", OR: keyOR },
          ],
        },
      })
      if (customerUses >= rule.maxPerCustomer) {
        throw new PromotionRedeemError(
          "PER_CUSTOMER_LIMIT",
          "To promocijo ste že uporabili — omejitev uporabe na stranko je dosežena."
        )
      }
    }
  }

  // 5) Exact discount on the base (never negative, never above base).
  const discountAmount =
    rule.discountType === "FIXED"
      ? round2(Math.min(rule.discountValue, input.baseAmount))
      : round2((input.baseAmount * Math.max(0, Math.min(rule.discountValue, 100))) / 100)
  const baseAmount = round2(input.baseAmount)

  // 6) Record the use. Unique constraints are the last fence against
  //    double redemption on the same transaction.
  await tx.promotionRedemption.create({
    data: {
      organizationId: rule.organizationId,
      promotionId: rule.id,
      orderId: input.orderId ?? null,
      appointmentId: input.appointmentId ?? null,
      customerId: input.customerId ?? null,
      guestEmail: input.guestEmail?.trim().toLowerCase() || null,
      codeUsed: input.codeUsed ?? null,
      discountAmount: discountAmount.toFixed(2),
      baseAmount: baseAmount.toFixed(2),
    },
  })

  return { baseAmount, discountAmount }
}