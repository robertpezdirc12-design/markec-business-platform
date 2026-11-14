// ============================================================
// F5.5.4.2 — ČISTO JEDRO KNJIŽENJA PLAČIL IN DOBROPISOV.
//
// Vse izračunane odprto/plačano/status potekajo TU (strežniško). Enota je
// cent (integer), da so primerjave determinaistične. Statusni prehodi:
//   DRAFT → ISSUED → (0 < paid) PARTIALLY_PAID / (open=0) PAID
//   OVERDUE je IZPELJAN (ISSUED|PARTIALLY_PAID + dueDate < now), ne
//   shranjen, ker je časovno odvisen.
// ============================================================

/** Pretvori številko (EUR) v cele cente. */
export function toCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100)
}

/** Cene iz centov nazaj v EUR. */
export function fromCents(c: number): number {
  return c / 100
}

export type DocStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
  | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED"

export interface PaymentStateInput {
  totalCents: number
  paidCents: number
  creditedCents: number
  dueDate: number | null // epoch ms
  now: number
  statusBefore: string
  terminal: boolean // CANCELLED/ACCEPTED/REJECTED → ne spreminjamo
}

export interface PaymentState {
  paidCents: number
  openCents: number
  creditedCents: number
  /** true ko je odprto ≤ 0 */
  settled: boolean
  /** derived overdue (ISSUED|PARTIALLY_PAID in dueDate < now) */
  overdue: boolean
  status: DocStatus
}

/**
 * Izračuna plačilno stanje in usklajeni status. `totalCents` = znesek računa
 * z DDV; `paidCents` = vsota CLEARED plačil (storna negativna); `creditedCents`
 * = vsota veljavnih dobropisov. Odprt znesek = total − paid − credited.
 * Plačilo NE sme preseči odprtega (overpay → zavrnjeno na nivoju akcije).
 */
export function reconcilePaymentState(input: PaymentStateInput): PaymentState {
  const { totalCents, paidCents, creditedCents, dueDate, now, statusBefore, terminal } = input

  if (terminal) {
    return { paidCents, openCents: Math.max(0, totalCents - paidCents - creditedCents), creditedCents, settled: false, overdue: false, status: statusBefore as DocStatus }
  }

  const openCents = totalCents - paidCents - creditedCents
  const settled = openCents <= 0
  const overdue = !settled && !!dueDate && dueDate < now

  let status: DocStatus
  if (settled) status = "PAID"
  else if (paidCents > 0) status = "PARTIALLY_PAID"
  else status = statusBefore === "DRAFT" ? "DRAFT" : "ISSUED"

  return { paidCents, openCents, creditedCents, settled, overdue, status }
}

/** Koliko še lahko dobropiramo (megla ≤ total − že dobropirano). */
export function creditAllowedCents(totalCents: number, creditedCents: number): number {
  return Math.max(0, totalCents - creditedCents)
}

/** Ali lahko knjižimo plačilo A (ne smemo preseči odprtega). */
export function canBookPayment(openCents: number, amountCents: number): boolean {
  return amountCents > 0 && amountCents <= openCents
}