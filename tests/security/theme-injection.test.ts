// ============================================================
// Varnostni pregled 2026-11-15 — regresijski testi za XSS vektorja:
//  1) tipografija teme se vbrizga v <style> (app/layout.tsx) — surove
//     vrednosti iz baze smejo vanj priti LE sanitizirane
//     (sanitizeTypography) in NE smejo biti zavrnjene le s tipi TS.
//  2) validateTheme mora zavrniti ne-numerične tipografske vrednosti.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  sanitizeTypography,
  validateTheme,
  themeToCssVars,
  DEFAULT_TYPOGRAPHY,
  type SiteTheme,
} from "@/lib/site-design"

const XSS_PAYLOAD = "1}</style><script>alert(1)</script><style>{"

describe("theme typography injection (varnostni pregled)", () => {
  it("sanitizeTypography zavrne injicirane nize — vedno številke v obsegu", () => {
    const t = sanitizeTypography({
      headingScale: XSS_PAYLOAD,
      baseFontSize: XSS_PAYLOAD,
      fontHeading: XSS_PAYLOAD,
      fontBody: "constructor",
      fontWeight: XSS_PAYLOAD,
    })
    expect(t.headingScale).toBe(DEFAULT_TYPOGRAPHY.headingScale)
    expect(t.baseFontSize).toBe(DEFAULT_TYPOGRAPHY.baseFontSize)
    expect(t.fontHeading).toBe(DEFAULT_TYPOGRAPHY.fontHeading)
    expect(t.fontBody).toBe(DEFAULT_TYPOGRAPHY.fontBody)
    expect(t.fontWeight).toBe("normal")
    expect(Number.isFinite(t.headingScale)).toBe(true)
    expect(Number.isFinite(t.baseFontSize)).toBe(true)
  })

  it("sanitizeTypography omeji tudi sicer veljavna števila na varne intervale", () => {
    const t = sanitizeTypography({ headingScale: 9999, baseFontSize: -5 })
    expect(t.headingScale).toBeLessThanOrEqual(3)
    expect(t.baseFontSize).toBeGreaterThanOrEqual(12)
  })

  it("validateTheme zavrne ne-numerično tipografijo (errors, ne le warnings)", () => {
    const theme = {
      colors: {},
      typography: {
        headingScale: XSS_PAYLOAD,
        baseFontSize: XSS_PAYLOAD,
        fontHeading: XSS_PAYLOAD,
        fontBody: XSS_PAYLOAD,
        fontWeight: XSS_PAYLOAD,
      },
    } as unknown as SiteTheme
    const res = validateTheme(theme)
    expect(res.errors.length).toBeGreaterThanOrEqual(5)
    for (const e of res.errors) expect(e).toContain("Tipografija:")
  })

  it("themeToCssVars izloči vse vrednosti, ki bi lahko prekinile <style>", () => {
    const vars = themeToCssVars({
      colors: { primary: "#fff}</style><script>x</script>" },
      typography: {
        headingScale: XSS_PAYLOAD,
        baseFontSize: XSS_PAYLOAD,
        fontHeading: XSS_PAYLOAD,
        fontBody: XSS_PAYLOAD,
        fontWeight: XSS_PAYLOAD,
      },
    } as unknown as SiteTheme)
    for (const [k, v] of Object.entries(vars)) {
      expect(k).not.toMatch(/[<>;{}]/)
      expect(v).not.toMatch(/[<>;{}]/)
    }
  })

  it("neveljavna barva ne prispeva CSS vrednosti (parseHexColor lijak)", () => {
    const vars = themeToCssVars({
      colors: { primary: "red; background: url(//evil)" },
      typography: {},
    } as unknown as SiteTheme)
    expect(vars["--f532-primary"]).toBeUndefined()
  })
})
