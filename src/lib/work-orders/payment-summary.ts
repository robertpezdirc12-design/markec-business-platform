// ============================================================
// DELOVNO NAROČILO — javna povezava in denar (čiste funkcije)
//
// Ločeno od strežniških akcij, da se testira brez DB in da se ne vleče
// Prisma v odjemalski paket. Tu so samo izračuni, ki jih morata enako
// razumeti UI in strežnik:
//   • preostanek = znesek − Σ plačil,
//   • stanje plačila (NIČ / DEPOZIT / PLAČANO),
//   • pot javne povezave (žeton je skrivnost povezave).
// ============================================================

import { randomBytes } from "node:crypto"

/** Dolžina javnega žetona v bajtih (32 = 64 znakov hex). */
export const PUBLIC_TOKEN_BYTES = 32

/** Nov naključen žeton za javno povezavo naročila. */
export function newPublicToken(): string {
  return randomBytes(PUBLIC_TOKEN_BYTES).toString("hex")
}

/** Ali je vrednost videti kot žeton, ki ga je ustvarila ta aplikacija? */
export function isPublicToken(value: string | null | undefined): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value)
}

/** Javna pot naročila pod najemnikom. */
export function publicOrderPath(slug: string, token: string): string {
  return `/s/${slug}/order/${token}`
}

export type WorkOrderPaymentState = "NONE" | "UNPAID" | "PARTIAL" | "PAID"

export interface PaymentSummaryInput {
  /** Dogovorjeni znesek naročila (null = predračun še ni pripravljen). */
  total: number | null
  /** Načrtovani depozit (null = brez depozita). */
  depositAmount: number | null
  /** Vsote prejetih plačil. */
  payments: number[]
}

export interface PaymentSummary {
  total: number | null
  depositAmount: number | null
  paid: number
  /** Preostanek za plačilo (nikoli negativen). */
  balance: number
  state: WorkOrderPaymentState
}

/** Zaokroži na cent (brez plavajoče napake). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Povzetek denarja na naročilu.
 *
 * Pravila:
 *   • brez zneska → stanje "NONE" (predračun še ni določen),
 *   • 0 plačil → "UNPAID",
 *   • delno plačano → "PARTIAL",
 *   • plačano ≥ znesek → "PAID" (preplačilo je dovoljeno, preostanek 0).
 */
export function summarizePayments(input: PaymentSummaryInput): PaymentSummary {
  const paid = round2(input.payments.reduce((sum, p) => sum + (Number.isFinite(p) ? p : 0), 0))
  const total = input.total === null ? null : round2(input.total)
  const balance = total === null ? 0 : Math.max(0, round2(total - paid))

  let state: WorkOrderPaymentState
  if (total === null) state = "NONE"
  else if (paid <= 0) state = "UNPAID"
  else if (paid + 0.005 < total) state = "PARTIAL"
  else state = "PAID"

  return {
    total,
    depositAmount: input.depositAmount === null ? null : round2(input.depositAmount),
    paid,
    balance,
    state,
  }
}

/**
 * Ali je depozit že pokrit s prejetimi plačili?
 * Uporablja se za prikaz »depozit plačan« brez posebnega polja v bazi.
 */
export function isDepositCovered(depositAmount: number | null, paid: number): boolean {
  if (depositAmount === null || depositAmount <= 0) return false
  return round2(paid) + 0.005 >= round2(depositAmount)
}
