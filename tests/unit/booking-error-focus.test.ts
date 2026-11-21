import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// NN/g "error recovery" + WCAG 3.3.1: po neuspelem submitu mora
// fokus obtičati na prvem polju z napako (aria-invalid="true"),
// da uporabniku ni treba iskati kje popraviti.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("booking — fokus na prvo polje z napako ob submitu", () => {
  it("BookingForm uporablja focusFirstFormError iz skupnega liba (DRY)", () => {
    const lib = read("src/lib/form-focus.ts")
    expect(lib).toContain("export function focusFirstFormError()")
    expect(lib).toContain("querySelector<HTMLElement>(")
    expect(lib).toContain('[aria-invalid="true"]')
    expect(lib).toContain("first.focus({ preventScroll: false })")
    expect(lib).toContain("first.scrollIntoView")
    const b = read("src/components/booking/booking-form.tsx")
    expect(b).toContain('import { focusFirstFormError } from "@/lib/form-focus"')
    // lokalna definicija je bila odstranjena iz komponente
    expect(b.split("function focusFirstFormError").length).toBeLessThan(2)
  })

  it("helper se pokliče ob validacijskih napakah (staff + schema)", () => {
    const b = read("src/components/booking/booking-form.tsx")
    // na staffId napaki
    expect(b).toContain(
      'toast.error(t.booking.staffRequiredToast)\n        focusFirstFormError()'
    )
    // na schema safeParse fail
    expect(b).toContain('?? t.booking.checkoutFailed)\n        focusFirstFormError()')
  })

  it("customer-info polja imajo aria-invalid ter errors", () => {
    const s = read("src/components/booking/steps/customer-info-step.tsx")
    for (const f of ["firstName", "lastName", "email", "phone", "notes"]) {
      expect(s, `polje ${f}`).toContain(
        `aria-invalid={!!errors.${f} || undefined}`
      )
    }
  })

  it("date-time-step: zasedeni termini so AT-dostopni (aria-disabled + busySlot) — ne disabled, ki jih bralnik izpusti", () => {
    const d = read("src/components/booking/steps/date-time-step.tsx")
    // zaseden slot NIKOLI ni pravi `disabled` atribut (bralnik ga
    // povsem odstrani) — ampak aria-disabled (leading space check na
    // ` disabled=` razlikuje pravi atribut od `aria-disabled=`).
    expect(d).not.toMatch(/ disabled=\{\!slot\.available\}/)
    expect(d).toContain("aria-disabled={!slot.available}")
    // onClick guard še vedno prepreči izbor zasedenega termina
    expect(d).toContain('onClick={() => slot.available && onSelectTime(slot.time)}')
    // bralnik prebere "Zasedeno: 09:00"
    expect(d).toContain("t.booking.busySlot")
    expect(d).toContain('`${t.booking.busySlot}: ${slot.formattedTime}`')
  })

  it("booking dict ima busySlot prevod (sl/en)", () => {
    const bk = read("src/lib/i18n/dict/booking.ts")
    expect(bk).toContain('busySlot: "Zasedeno",')
    expect(bk).toContain('busySlot: "Unavailable",')
  })

  it("submit-feedback: form ima aria-busy + sr-only role=status med oddajo (AT napove async submit)", () => {
    const f = read("src/components/booking/booking-form.tsx")
    // async sima → aria-busy na form
    expect(f).toContain('<form action={formAction} aria-busy={isPending}')
    const s = read("src/components/booking/booking-summary-card.tsx")
    // live region POSTOJI v DOM od starta (ne pogojen!) → AT ga registrira
    expect(s).toContain('<p role="status" className="sr-only">')
    expect(s).toContain("{submitting ? t.booking.submitting : \"\"}")
    const bk = read("src/lib/i18n/dict/booking.ts")
    expect(bk).toContain('submitting: "Oddajam rezervacijo…",')
    expect(bk).toContain('submitting: "Submitting reservation…",')
  })
})