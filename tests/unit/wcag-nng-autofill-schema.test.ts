import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// NN/g "Web Form Design": testiraj shemo / browsersko autofill.
// Avtomatiziran regresijski nadzor — poskrbi, da ključni obrazci
// (booking, login, register) obdržijo pravilne `autoComplete`
// vrednosti, zato ostaja browsersko samodejno izpolnjevanje.
// ============================================================

const ROOT = join(__dirname, "..", "..")

const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("NN/g — browser autofill shema (test the schema)", () => {
  it("booking customer-info ima autoComplete za vsa kontaktna polja", () => {
    const src = read("src/components/booking/steps/customer-info-step.tsx")
    for (const [attr, field] of [
      ['autoComplete="given-name"', "firstName"],
      ['autoComplete="family-name"', "lastName"],
      ['autoComplete="email"', "email"],
      ['autoComplete="tel"', "phone"],
    ] as const) {
      expect(src, `${field} manjka ${attr}`).toContain(attr)
    }
  })

  it("booking povrne type/inputMode za pravilno tipkovnico", () => {
    const src = read("src/components/booking/steps/customer-info-step.tsx")
    expect(src).toContain('type="email"')
    expect(src).toContain('inputMode="email"')
    expect(src).toContain('type="tel"')
    expect(src).toContain('inputMode="tel"')
  })

  it("login ima username autofill, register ločene sheme", () => {
    const login = read("src/components/auth/login-form.tsx")
    expect(login).toContain('autoComplete="username"')
    const register = read("src/components/auth/register-form.tsx")
    // full-name + email + new-password: pravilne OWASP/HTML sheme,
    // brez prepisa senzitivnih nadomestkov (autoComplete="off" na username).
    expect(register).toContain('autoComplete="name"')
    expect(register).toContain('autoComplete="email"')
    expect(register).toContain('autoComplete="new-password"')
    expect(register).toContain('autoComplete="off"')
  })

  it("cart guest-checkout ima polno kontaktno shemo (name/email/tel/street-address)", () => {
    const src = read("src/components/shop/cart-content.tsx")
    expect(src).toContain('autoComplete="name"')
    expect(src).toContain('type="email"')
    expect(src).toContain('autoComplete="email"')
    expect(src).toContain('type="tel"')
    expect(src).toContain('autoComplete="tel"')
    expect(src).toContain('autoComplete="street-address"')
  })

  it("javne forme (inquiry + walk-in) imajo pravilno tipkovnico in sheme", () => {
    const inquiry = read("src/components/public/public-inquiry-form.tsx")
    // email in tel imata type + inputMode (mobilna numerična/email tipkovnica)
    expect(inquiry).toContain('type="email"')
    expect(inquiry).toContain('inputMode="email"')
    expect(inquiry).toContain('type="tel"')
    expect(inquiry).toContain('inputMode="tel"')
    const walkIn = read("src/components/public/walk-in-public.tsx")
    expect(walkIn).toContain('autoComplete="name"')
    expect(walkIn).toContain('type="tel"')
    expect(walkIn).toContain('inputMode="tel"')
    expect(walkIn).toContain('autoComplete="tel"')
  })
})