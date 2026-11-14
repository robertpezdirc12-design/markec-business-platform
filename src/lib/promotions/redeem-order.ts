// ============================================================
// F5.1 — UNOVČENJE PROMOCIJE ZA NAROČILO OB PLAČILU (idempotentno)
//
// Zgodovina:
// - F5.1.1: unovčenje se zgodi ŠELE ob potrjenem plačilu (webhook/verify),
//   preklicano/opuščeno Stripe plačilo NE porabi promocije.
// - F5.1.2: online naročilo ob ustvarjanju checkouta REZERVIRA mesto;
//   potrjeno plačilo rezervacijo preklopi v unovčenje (REDEEMED).
// - F5.1.4 (dve pravili hkrati): kupec nikoli ne plača drugačnega zneska,
//   kot je evidentiran (amount integrity) AND promocija z maxUses=1 nikoli
//   ne omogoči dveh uspešnih unovčitev (stroga omejitev). Zato se tu
//   NIKOLI ne izmišlja nova unovčitev za naročilo, ki nima (več) rezervacije
//   — omejitev se ohranja. Amount integrity je zagotovljena že pri samem
//   nastanku naročila (Order.total == zaračunano), zato tu nič ni treba
//   korektirati navzgor.
//
// IDEMPOTENČNOST: @@unique([promotionId, orderId]) + ro-glej status.
// ============================================================

import { Prisma } from "@prisma/client"
import { convertReservationToRedemption } from "./reservation"

interface PaidOrder {
  id: string
  organizationId: string | null
  customerId: string | null
  guestEmail?: string | null
  promotionId: string | null
  promotionDiscount: { toNumber(): number } | number
  promotionSnapshot: Prisma.JsonValue | null
  /** skupni znesek, kot je bil shranjen ob seji (morda že diskontiran) */
  total: { toNumber(): number } | number
}

type RedeemableTx = Prisma.TransactionClient

/** Izid helperja: `granted:true` = popust priznan + redemptions zabeležen. */
export interface RedeemOrderResult {
  granted: boolean
  discountAmount: number
}

/**
 * Zapiše (ali zavrne) unovčenje promocije za plačano naročilo. Idempotentno.
 *
 * Pravila (F5.1.4):
 * - če ima naročilo RESERVED rezervacijo → preklopi v REDEEMED (granted).
 * - če je že REDEEMED → granted (idempotentno, ponovljen webhook).
 * - če rezervacije NI (sproščena ali nikoli ni bila) → NE izmišljamo nove
 *   unovčitve (ohranimo strogo maxUses) in Order.total SE NE korektira
 *   navzgor (amount integrity ostane; total že enak zaračunanemu znesku).
 *   Vračamo granted:false — v normalnem internem toku (Stripe-backed
 *   release) ta veja ni dosegljiva za online naročila.
 */
export async function redeemOrderPromotion(
  tx: RedeemableTx,
  order: PaidOrder,
  _orgId: string
): Promise<RedeemOrderResult> {
  if (!order.promotionId) {
    return { granted: false, discountAmount: 0 }
  }

  const existing = await tx.promotionRedemption.findFirst({
    where: { promotionId: order.promotionId, orderId: order.id },
    select: { id: true, status: true },
  })

  // Že unovčeno (REDEEMED) → granted, idempotentno.
  if (existing?.status === "REDEEMED") {
    return { granted: true, discountAmount: Number(order.promotionDiscount) }
  }

  // Rezervacija obstaja → potrjeno plačilo jo pretvori v unovčenje.
  // (Atomska + row-locked v reservation.ts.) Mesto je bilo rezervirano že
  // ob checkoutu → popustan znesek je legitimno zaračunan.
  if (existing?.status === "RESERVED") {
    await convertReservationToRedemption(tx, order.id)
    return { granted: true, discountAmount: Number(order.promotionDiscount) }
  }

  // Ni rezervacije (ni bila ustvarjena ali je bila Stripe-potrjeno sproščena
  // kot neplačana) → ne izmišljamo nove unovčitve (stroga maxUses). Order
  // (ki je že zaračunan) ostane nespremenjen — amount integrity ni prizadeta.
  return { granted: false, discountAmount: 0 }
}