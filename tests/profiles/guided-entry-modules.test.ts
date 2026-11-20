import { describe, it, expect } from "vitest"
import { modulesForVertical } from "../../src/lib/profiles/modules"
import { getProfile, listProfileOptions } from "../../src/lib/profiles/registry"

// ============================================================
// Vodeni vstop (guided entry) — "kaj je zakupil": pod politiko
// "VSI MODULI ZA VSE" (2026) vodič vedno prikaže VSEH 15 modulov
// za vsako dejavnost; moduli, ki so v profilu `required`, so
// označeni kot jedro (privzeto vklopljeni), vsi drugi kot optional
// (preklopljivi). Wizard ne obljubi več "manjšega" nabora glede na
// dejavnost — enak nabor, lastnik sam vklopi/izklopi (§21).
// ============================================================

describe("modulesForVertical", () => {
  it("vsaka dejavnost vidi vseh 15 modulov (vsi moduli za vse)", () => {
    for (const option of listProfileOptions()) {
      const keys = modulesForVertical(option.id).map((m) => m.key)
      expect(keys.length).toBe(15)
    }
  })

  it("beauty: jedro = appointments/services/documents (required); workOrders optional", () => {
    const mods = modulesForVertical("beauty")
    const byKey = Object.fromEntries(mods.map((m) => [m.key, m.state]))
    expect(byKey.appointments).toBe("required")
    expect(byKey.services).toBe("required")
    // računi so zakonsko-obvezni za salon (P2 #101).
    expect(byKey.documents).toBe("required")
    // workOrders ni works but je vodič še vedno prikaže (vsi moduli za vse).
    expect(byKey.workOrders).toBe("optional")
  })

  it("tire-service: jedro = workOrders (required); appointments optional", () => {
    const mods = modulesForVertical("tire-service")
    const byKey = Object.fromEntries(mods.map((m) => [m.key, m.state]))
    expect(byKey.workOrders).toBe("required")
    expect(byKey.appointments).toBe("optional")
    expect(byKey.inventory).toBe("required")
  })

  it("beekeeping: appointments optional; workOrders jedro (žetev/negovanje)", () => {
    const mods = modulesForVertical("beekeeping")
    const byKey = Object.fromEntries(mods.map((m) => [m.key, m.state]))
    expect(byKey.appointments).toBe("optional")
    expect(byKey.workOrders).toBe("required")
    expect(byKey.shop).toBe("required")
    expect(byKey.inventory).toBe("required")
  })

  it("za vsako dejavnost vsak modul nosi ne-prazen state (required ali optional)", () => {
    for (const option of listProfileOptions()) {
      for (const m of modulesForVertical(option.id)) {
        expect(["required", "optional"]).toContain(m.state)
      }
    }
  })

  it("every module carries non-empty SI and EN labels", () => {
    for (const option of listProfileOptions()) {
      for (const m of modulesForVertical(option.id)) {
        expect(m.labelSl.trim().length).toBeGreaterThan(0)
        expect(m.labelEn.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("marks required capabilities as core, optional as switchable", () => {
    const beauty = modulesForVertical("beauty")
    expect(beauty.find((m) => m.key === "appointments")?.state).toBe("required")
    expect(beauty.find((m) => m.key === "inventory")?.state).toBe("optional")
  })
})
