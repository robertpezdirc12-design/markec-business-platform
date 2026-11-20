import { describe, expect, it } from "vitest"
import { resolveCategoryQuery } from "../src/lib/marketplace/category-query"

describe("resolveCategoryQuery (#case-fix)", () => {
  it("preslika človeško oznako v iskalni termin (lowercase, tako kot so ključi)", () => {
    expect(resolveCategoryQuery("Frizerski saloni")).toBe("frizer")
    expect(resolveCategoryQuery("Kozmetika")).toBe("kozmet")
    expect(resolveCategoryQuery("Brivci")).toBe("briv")
    expect(resolveCategoryQuery("Wellness")).toBe("wellness")
  })

  it("je case-insensitive — 'Frizerski Saloni' z veliko črko ne da 0 podjetij", () => {
    // Regression iz raziskave: URL ?kategorija=Frizerski%20Saloni je pred
    // popravkom vrnil prazno stran ("0 podjetij"), ker lookup ni zadel.
    expect(resolveCategoryQuery("Frizerski Saloni")).toBe("frizer")
    expect(resolveCategoryQuery("FRIZERSKI SALONI")).toBe("frizer")
    expect(resolveCategoryQuery("nohti")).toBe("noht")
  })

  it("vrne očiščen vnos, ko ne gre za znano kategorijo", () => {
    expect(resolveCategoryQuery("  masaža  ")).toBe("masaž")
    expect(resolveCategoryQuery("frizerski saloni")).toBe("frizer")
  })

  it("ne razbije prostega iskanja (neprepoznana beseda se ohrani)", () => {
    expect(resolveCategoryQuery("barvanje las")).toBe("barvanje las")
    expect(resolveCategoryQuery("")).toBe("")
  })
})