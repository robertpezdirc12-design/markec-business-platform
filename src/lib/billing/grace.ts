// ============================================================
// BILLING GRACE (točka 7b) — PURE decision logic
//
// Lifecycle za neplačano naročnino (PlatformSubscription):
//   status PAST_DUE / UNPAID → vstop v GRACE (graceStartedAt).
//   - v GRACE: pošlješ opomnik (lastReminderAt/remindEveryMs),
//     pred koncem grace še končno opozorilo (suspendNotifiedAt).
//   - po graceDuration brez plačila → SUSPEND (org → SUSPENDED),
//     podatki SE NIKOLI ne brišejo.
//   - vrni v ACTIVE/TRIALING → grace počiščena (v webhooku).
//
// Povsem čiste funkcije (brez DB, brez I/O) — enotno testabilno.
// ============================================================

export type BillingGracePhase =
  | { phase: "ok" } // ni v grace
  | { phase: "grace"; reminderDue: boolean; finalWarningDue: boolean; daysLeft: number }
  | { phase: "suspend-due"; daysOverdue: number }

export interface BillingGraceInput {
  status: string
  graceStartedAt: Date | null
  lastReminderAt: Date | null
  suspendNotifiedAt: Date | null
}

/** Trajanje grace in intervali (ms). Po dogovoru: 7 dni grace; opomnik
 *  vsakih 48 h; končno opozorilo ≤24 h pred koncem grace. */
export const BILLING_GRACE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
export const REMINDER_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000
export const FINAL_WARNING_BEFORE_END_MS = 24 * 60 * 60 * 1000

function isGraceStatus(status: string): boolean {
  return status === "PAST_DUE" || status === "UNPAID"
}

/**
 * Odločitev za dato naročnino ob trenutku `now`.
 * `now` je param za deterministično testiranje.
 */
export function billingGraceDecision(
  sub: BillingGraceInput,
  now: Date
): BillingGracePhase {
  if (!isGraceStatus(sub.status) || !sub.graceStartedAt) {
    return { phase: "ok" }
  }

  const graceEnd = sub.graceStartedAt.getTime() + BILLING_GRACE_DURATION_MS
  const nowMs = now.getTime()

  // Prestopili smo grace → suspend (samo če prioriteta to zahteva).
  if (nowMs >= graceEnd) {
    return {
      phase: "suspend-due",
      daysOverdue: Math.floor((nowMs - graceEnd) / (24 * 60 * 60 * 1000)),
    }
  }

  const daysLeft = Math.max(0, Math.ceil((graceEnd - nowMs) / (24 * 60 * 60 * 1000)))

  // Končno opozorilo: < 24 h do konca grace in še ni poslano.
  const finalWarningDue =
    graceEnd - nowMs <= FINAL_WARNING_BEFORE_END_MS && !sub.suspendNotifiedAt

  // Redni opomnik: ob vstopu v grace takoj, nato vsakih REMINDER_INTERVAL_MS.
  const reminderDue =
    !sub.lastReminderAt ||
    nowMs - sub.lastReminderAt.getTime() >= REMINDER_INTERVAL_MS

  return { phase: "grace", reminderDue, finalWarningDue, daysLeft }
}