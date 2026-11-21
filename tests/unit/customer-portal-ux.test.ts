import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Customer portal (my-appointments): async akcije (reschedule,
// pay, cancel) morajo imeti AT-status napoved — ne samo spinner
// na disabled gumbu. Konsistenca z booking/cart vzorcem.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("customer portal — AT-status pri async akcijah", () => {
  it("reschedule dialog napove 'Prestavljam termin…' med async oddajo", () => {
    const r = read("src/components/appointments/reschedule-dialog.tsx")
    // live region STALNO v DOM (ni pogojen!) — AT ga registrira od začetka
    expect(r).toContain('<p role="status" className="sr-only" aria-live="polite">')
    expect(r).toContain('{isPending ? "Prestavljam termin…" : ""}')
    // submit gumb ima spinner + guard
    expect(r).toContain("{isPending && (")
    expect(r).toContain('<SpinnerGapIcon size={16} className="mr-2 animate-spin" />')
    expect(r).toContain("disabled={!selectedDate || !selectedTime || isPending}")
  })

  it("appointment-card akcije so prav guard (no double-action) + imajo spinner", () => {
    const c = read("src/components/appointments/appointment-card.tsx")
    // plačaj / prestavi / prekliči gumbi so disabled med isPending
    expect((c.match(/disabled=\{isPending\}/g) || []).length).toBeGreaterThanOrEqual(3)
    expect(c).toContain('<SpinnerGapIcon\n                      size={18}')
  })
})