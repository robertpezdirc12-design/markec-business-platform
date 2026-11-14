// ============================================================
// BILLING GRACE (točka 7b) — čista logika
// Preveri billingGraceDecision: ok | grace (reminder/final) | suspend-due.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  billingGraceDecision,
  BILLING_GRACE_DURATION_MS,
  type BillingGraceInput,
} from "../../src/lib/billing/grace"

const NOW = new Date("2026-11-01T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000

function sub(overrides: Partial<BillingGraceInput> = {}): BillingGraceInput {
  return {
    status: "PAST_DUE",
    graceStartedAt: NOW,
    lastReminderAt: null,
    suspendNotifiedAt: null,
    ...overrides,
  }
}

describe("billingGraceDecision", () => {
  it("ne-grace status → ok", () => {
    expect(billingGraceDecision(sub({ status: "ACTIVE" }), NOW).phase).toBe("ok")
    expect(billingGraceDecision(sub({ status: "TRIALING" }), NOW).phase).toBe("ok")
    expect(billingGraceDecision(sub({ status: "CANCELED" }), NOW).phase).toBe("ok")
  })

  it("grace brez graceStartedAt → ok", () => {
    expect(billingGraceDecision(sub({ graceStartedAt: null }), NOW).phase).toBe("ok")
  })

  it("vstop v grace → reminderDue takoj (ni bila poslana še nič) in še ne final", () => {
    const d = billingGraceDecision(sub(), NOW)
    expect(d).toMatchObject({ phase: "grace", reminderDue: true, finalWarningDue: false })
  })

  it("po 24 h (še < interval) opomnik ni due", () => {
    const later = new Date(NOW.getTime() + DAY)
    const d = billingGraceDecision(sub({ lastReminderAt: NOW }), later)
    expect(d).toMatchObject({ phase: "grace", reminderDue: false, finalWarningDue: false })
  })

  it("po 48 h opomnik ni več due (pravkar poslan)", () => {
    const later = new Date(NOW.getTime() + 2 * DAY)
    const d = billingGraceDecision(
      sub({ lastReminderAt: new Date(later.getTime() - 60_000) }),
      later
    )
    expect(d.phase).toBe("grace")
    if (d.phase === "grace") {
      expect(d.reminderDue).toBe(false)
    }
  })

  it("blizu konca grace (< 24 h) → finalWarningDue, če še ni bilo poslano", () => {
    const nearEnd = new Date(NOW.getTime() + BILLING_GRACE_DURATION_MS - 12 * 60 * 60 * 1000)
    const d = billingGraceDecision(sub(), nearEnd)
    expect(d).toMatchObject({ phase: "grace", finalWarningDue: true })
  })

  it("final Warning ni due, če je bilo že poslano", () => {
    const nearEnd = new Date(NOW.getTime() + BILLING_GRACE_DURATION_MS - 12 * 60 * 60 * 1000)
    const d = billingGraceDecision(sub({ suspendNotifiedAt: NOW }), nearEnd)
    expect(d.phase).toBe("grace")
    if (d.phase === "grace") {
      expect(d.finalWarningDue).toBe(false)
    }
  })

  it("po izteku grace → suspend-due", () => {
    const over = new Date(NOW.getTime() + BILLING_GRACE_DURATION_MS + 2 * DAY)
    const d = billingGraceDecision(sub(), over)
    expect(d.phase).toBe("suspend-due")
  })

  it("daysLeft se pravilno zaokroži", () => {
    const mid = new Date(NOW.getTime() + 3 * DAY)
    const d = billingGraceDecision(sub(), mid)
    if (d.phase === "grace") {
      expect(d.daysLeft).toBeGreaterThan(0)
      expect(d.daysLeft).toBeLessThanOrEqual(7)
    }
  })
})