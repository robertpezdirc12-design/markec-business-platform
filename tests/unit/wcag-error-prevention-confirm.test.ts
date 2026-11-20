import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// ============================================================
// U10 — WCAG 3.3.4 Error Prevention (financial/legal):
// confirm korak pred plačljivo rezervacijo.
// Za element rezervacij s pologom ter (zavezujočim) no-show
// pravilom mora uporabnik pred oddajo preveriti podatke in jih
// eksplicitno potrditi. Employee/brez-pologa ostanejo direktni
// submit (ni finančne transakcije). Confirm je inline znotraj
// <form> (submit-a isti React 19 action) z role="alert" (4.1.3).
// Reregistracija: booking-summary-card + booking i18n.
// ============================================================

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

const card = read("src/components/booking/booking-summary-card.tsx")
const dict = read("src/lib/i18n/dict/booking.ts")

describe("U10/3.3.4 confirm korak (plačljive)", () => {
  it("komponenta je client + ima confirm state", () => {
    expect(card).toMatch(/^"use client"/m)
    expect(card).toContain('useState(false)')
  })

  it("plačljiva enota odpre confirm (type=button), ne submit-a direktno", () => {
    expect(card).toContain('paymentsEnabled && !isEmployee && !depositExempt && resolvedDeposit > 0')
    expect(card).toContain('? "button"\n                : "submit"')
    expect(card).toContain('() => setConfirmOpen(true)')
  })

  it("confirm vsebuje pregled podatkov + 'Potrdi' (type=submit) + 'Prekliči'", () => {
    expect(card).toContain('role="alert"')
    expect(card).toContain('t.booking.reviewTitle')
    expect(card).toContain('t.booking.reviewNoShowNote')
    expect(card).toContain('type="submit" size="lg" disabled={submitting}')
    expect(card).toContain('onClick={() => setConfirmOpen(false)}')
  })

  it("i18n ključi review* so definirani (SL + EN)", () => {
    expect(dict).toContain('reviewConfirm: (amount: string) => `Potrdi in plačaj ${amount}`')
    expect(dict).toContain('reviewConfirm: (amount: string) => `Confirm & pay ${amount}`')
    expect(dict).toContain("reviewNoShowNote")
  })
})