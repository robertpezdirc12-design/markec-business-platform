import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// ============================================================
// U10 — WCAG 2.2: status/error sporočila v booking toku
// (regresijski varoval)
// WCAG 4.1.3 Status Messages: ko se ob zaključku (submit) ali
// preverjanjem pojavi error/status sporočilo, ga mora screen-reader
// najaviti — ni dovolj zgolj vizualno rdeč tekst. Ta datoteka drži,
// da:
//  - validation errorji imajo role="alert" (implicit aria-live=assertive)
//    in so povezani z inputom preko aria-describedby;
//  - uspeh/neuspeh promocijske kode ima role="status"/"alert" z
//    aria-live, ne tiho zeleno/rdečega teksta.
// Vir: WebAIM "Accessible Forms" (error recovery + aria-describedby),
// W3C WCAG 2.2 §4.1.3.
// ============================================================

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

const step = read("src/components/booking/steps/customer-info-step.tsx")
const form = read("src/components/booking/booking-form.tsx")

describe("U10 customer-info-step: errorji se najavijo screen-readerju", () => {
  it("errorText renderira role=\"alert\" (implicit aria-live assertive)", () => {
    expect(step).toMatch(/<p\n\s+id=\{`\$\{field\}-error`\}\n\s+role="alert"/)
    expect(step).toContain("text-destructive")
  })

  it("polja so povezana z errorjem preko aria-describedby id", () => {
    expect(step).toContain("aria-describedby={describedBy(\"firstName\")}")
    expect(step).toContain("aria-describedby={describedBy(\"lastName\")}")
  })

  it("notes error ima role=\"alert\" + aria-describedby (ni tiho)", () => {
    expect(step).toContain('aria-describedby={errors.notes ? "notes-error" : undefined}')
    expect(step).toContain('id="notes-error" role="alert"')
  })
})

describe("U10 booking-form: promo status se najavi (4.1.3)", () => {
  it("uspeh ima role=\"status\" + polit lok-live", () => {
    expect(form).toContain('role={promotionState.ok ? "status" : "alert"}')
    expect(form).toContain('aria-live={promotionState.ok ? "polite" : "assertive"}')
  })
})