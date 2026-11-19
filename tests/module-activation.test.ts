import { describe, it, expect } from "vitest"
import {
  moduleBaseState,
  buildSeedRows,
  planActivation,
} from "../src/lib/modules/activation"
import { getModule } from "../src/lib/modules/catalog"
import type { ModuleDef } from "../src/lib/modules/catalog"

// ============================================================
// VSTOPNI TOK — OPT-IN MODULI (čista logika v activation.ts)
//
// Opt-in model: nova organizacija dobi samo required/hidden jedro
// ACTIVE; optional moduli se seedajo DEACTIVATED; disabled sploh
// brez vrstice. Ko uporabnik klikne modulsko kartico, se pokliče
// planActivation, ki vrne seznam modulov za vklop (z odvisnostmi).
// ============================================================

describe("moduleBaseState — izpeljava iz capability matrike", () => {
  it("optional, ko modul nima capability", () => {
    const noCaps = { ...getModule("walkIn")!, capabilities: [] as never[] } as ModuleDef
    expect(moduleBaseState({}, noCaps)).toBe("optional")
  })
  it("disabled, ko so VSI capability-ji disabled", () => {
    const base = { appointments: "disabled", services: "required" }
    // modul "walkIn" ima capability ["walkIn"], ki v base manjka → disabled
    expect(moduleBaseState(base, getModule("walkIn")!)).toBe("disabled")
  })
  it("required: capability required → required", () => {
    expect(moduleBaseState({ appointments: "required" }, getModule("appointments")!)).toBe("required")
  })
  it("optional: capability optional → optional", () => {
    expect(moduleBaseState({ appointments: "optional" }, getModule("appointments")!)).toBe("optional")
  })
  it("večcapability: en required pomeni required kljub optional drugi", () => {
    // sintetični modul z dvema capability-ema (register nima takega, a pravilo velja)
    const mod = getModule("delivery")!
    const multi = { ...mod, capabilities: ["delivery", "shop"] as import("../src/lib/profiles/types").CapabilityKey[] } as ModuleDef
    const base = { delivery: "required", shop: "optional" }
    expect(moduleBaseState(base, multi)).toBe("required")
    const allDisabled = { delivery: "required", shop: "disabled" }
    // required prevlada: kljub disabled drugi capability
    expect(moduleBaseState(allDisabled, multi)).toBe("required")
  })
  it("večcapability: VSI disabled → disabled", () => {
    const mod = getModule("delivery")!
    const multi = { ...mod, capabilities: ["delivery", "shop"] as import("../src/lib/profiles/types").CapabilityKey[] } as ModuleDef
    const base = { delivery: "disabled", shop: "disabled" }
    expect(moduleBaseState(base, multi)).toBe("disabled")
  })
  it("hidden, kadar ni required a je hidden", () => {
    const base = { reviews: "hidden" }
    expect(moduleBaseState(base, getModule("reviews")!)).toBe("hidden")
  })
  it("optional, kadar capability-ji obstajajo in niso optional/required/hidden/disabled", () => {
    const base = { walkIn: "optional" }
    expect(moduleBaseState(base, getModule("walkIn")!)).toBe("optional")
  })
})

describe("buildSeedRows — seed nove organizacije (opt-in)", () => {
  it("required → ACTIVE, optional → DEACTIVATED, disabled → brez vrstice", () => {
    const base = {
      appointments: "required",
      services: "required",
      shop: "optional",
      workOrders: "disabled",
      walkIn: "optional",
    }
    const rows = buildSeedRows(base)
    const toMap = Object.fromEntries(rows.map((r) => [r.moduleId, r.state]))

    expect(toMap.appointments).toBe("ACTIVE")
    expect(toMap.services).toBe("ACTIVE")
    expect(toMap.shop).toBe("DEACTIVATED")
    expect(toMap.walkIn).toBe("DEACTIVATED")
    // disabled modul ni v vrsticah
    expect(toMap.workOrders).toBeUndefined()
  })
  it("hidden → ACTIVE (jedro, ki naj bo vedno prisotno)", () => {
    const base = { customers: "hidden", walkIn: "optional" }
    const rows = buildSeedRows(base)
    const map = Object.fromEntries(rows.map((r) => [r.moduleId, r.state]))
    expect(map.customers).toBe("ACTIVE")
    expect(map.walkIn).toBe("DEACTIVATED")
  })
})

describe("planActivation — klik na modulsko kartico", () => {
  it("neznan modul → ok:false", () => {
    const r = planActivation("ne-obstaja", {}, {})
    expect(r.ok).toBe(false)
    expect(r.toEnable).toEqual([])
  })
  it("modul, ki ni na voljo za dejavnost (disabled) → ok:false", () => {
    const base = { workOrders: "disabled" }
    const r = planActivation("workOrders", base, {})
    expect(r.ok).toBe(false)
    expect(r.toEnable).toEqual([])
  })
  it("vklop optional modula, dodanega prek kartice", () => {
    const base = { shop: "optional" }
    const r = planActivation("shop", base, {})
    expect(r.ok).toBe(true)
    expect(r.toEnable.map((e) => e.id)).toContain("shop")
  })
  it("odvisen modul samodejno vklopi odvisnost pred sabo", () => {
    // delivery je odvisen od shop; oba optional
    const base = { shop: "optional", delivery: "optional" }
    const r = planActivation("delivery", base, {})
    expect(r.ok).toBe(true)
    const ids = r.toEnable.map((e) => e.id)
    // shop mora biti vklopljen pred delivery
    expect(ids).toContain("shop")
    expect(ids).toContain("delivery")
    expect(ids.indexOf("shop")).toBeLessThan(ids.indexOf("delivery"))
  })
  it("odvisnost, ki je že ACTIVE, se ne doda ponovno v toEnable", () => {
    const base = { delivery: "optional", shop: "optional" }
    const r = planActivation("delivery", base, { shop: "ACTIVE" })
    expect(r.ok).toBe(true)
    const ids = r.toEnable.map((e) => e.id)
    // shop je že aktivna odvisnost → naj ne bo v toEnable
    expect(ids).not.toContain("shop")
    expect(ids).toContain("delivery")
  })
  it("required modul, ki je že ACTIVE z izpolnjenimi odvisnostmi, ostane vklopljen", () => {
    // base zaključen (services required), odvisnost services že ACTIVE
    const base = { appointments: "required", services: "required" }
    const r = planActivation("appointments", base, { appointments: "ACTIVE", services: "ACTIVE" })
    expect(r.ok).toBe(true)
    expect(r.toEnable.map((e) => e.id)).toContain("appointments")
  })
  it("fail-closed: manjkajoča required odvisnost (ni v base) blokira aktivacijo", () => {
    // appointments je odvisen od services; če services ni v base → disabled → blokira
    const r = planActivation("appointments", { appointments: "required" }, { appointments: "ACTIVE" })
    expect(r.ok).toBe(false)
  })
  it("ciljni modul je vedno v toEnable tudi, če je že ACTIVE (upsert)", () => {
    const base = { walkIn: "optional" }
    const r = planActivation("walkIn", base, { walkIn: "ACTIVE" })
    expect(r.ok).toBe(true)
    expect(r.toEnable.map((e) => e.id)).toContain("walkIn")
  })
})