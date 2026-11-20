import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Regresijska zaščita za vse dosedanje VIZUALNE / UXI fixe.
// (1) Phon formata hint z raziskave (NN/g) — da ne izgine.
// (2) Iskalni vhodi z vidnim fokusom (WCAG 2.4.7 fiks) — da se
//     `outline-none` brez ring-a ne vrne.
// (3) Fiks iskalnih vhodov — kjer je bilo dodano `focus-visible:ring`.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("regresijska zaščita vizualnih UX fix-ov", () => {
  it("phone format hint ostaja (customer-info + i18n)", () => {
    const src = read("src/components/booking/steps/customer-info-step.tsx")
    // vedno-viden hint, povezan z input prek aria-describedby
    expect(src).toContain('id="phone-hint"')
    expect(src).toContain("phoneHint")
    expect(src).toContain('aria-describedby={errors.phone ? "phone-error" : "phone-hint"}')
    const dict = read("src/lib/i18n/dict/booking.ts")
    expect(dict).toContain("phoneHint:")
  })

  it("vsi iskalni vhodi (outline-none) imajo ring — WCAG 2.4.7 fiks", () => {
    // datoteke, kjer smo dodali focus-visible:ring na outline-none vhode
    for (const p of [
      "src/app/(marketplace)/layout.tsx",
      "src/components/admin/command-palette.tsx",
      "src/components/landing/platform-landing.tsx",
      "src/components/marketplace/hero-section.tsx",
    ] as const) {
      const src = read(p)
      expect(src, `${p} — manjka ring na iskalnem vhodu`).toContain(
        "focus-visible:ring-2 focus-visible:ring-ring"
      )
    }
  })

  it("confirm korak (WCAG 3.3.4) ostaja v summary card", () => {
    const src = read("src/components/booking/booking-summary-card.tsx")
    expect(src).toContain('type="submit"') // gumb "Potrdi in plačaj" še lahko oddá
  })

  it("A/B runtime //xeno: server posreduje varianto, client skriva notes", () => {
    const step = read("src/components/booking/steps/customer-info-step.tsx")
    // varianta prihaja kot prop (server-določena), ne build-time env
    expect(step).toContain("variant?: \"short\" | \"full\"")
    expect(step).toContain('variant = "full"')
    expect(step).toContain("const showNotesField = variant !== \"short\"")
    expect(step).toContain("{showNotesField && (")
    // server page določa varianto prek lib/ab/variant (runtime //xeno)
    const page = read("src/app/(customer)/booking/page.tsx")
    expect(page).toContain('getBookingABVariant(org?.id)')
    expect(page).toContain("abVariant={abVariant}")
    // lib/ab/variant: vedno bere server env + deterministična razdelitev
    const ab = read("src/lib/ab/variant.ts")
    expect(ab).toContain("BOOKING_AB_VARIANT")
    expect(ab).toContain("BookingABVariant")
  })
})