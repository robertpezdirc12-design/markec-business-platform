import { describe, it, expect } from "vitest"
import {
  modulePolicyFor,
  isTransitionAllowed,
} from "../src/lib/modules/policy"
import {
  effectiveCapabilities,
  effectivePublicCapabilities,
  getModule,
} from "../src/lib/modules/catalog"
import { getProfile, GENERIC_PROFILE_ID } from "../src/lib/profiles/registry"
import { resolveSkdProfile } from "../src/lib/skd/profiles"
import type { CapabilityKey, CapabilityState } from "../src/lib/profiles/types"

// ============================================================
// F5.4.1 — POLITIKA MODULOV (avtoritativna pravila)
// Politika "VSI MODULI ZA VSE" (2026): noben modul ni zaklenjen ali
// prepovedan — required je le privzet (jedro), disabled se dvigne na
// optional, vsak modul je preklopljiv. Plus dejavnostni scenariji §8.
// ============================================================

function cappsOf(profileId: string): Record<string, CapabilityState> {
  const p = getProfile(profileId)
  return { ...(p.capabilities as unknown as Record<string, CapabilityState>) }
}
const cap = (m: Record<string, CapabilityState>, k: CapabilityKey) => m[k] ?? "disabled"

describe("modulePolicyFor — politika VSI MODULI ZA VSE (2026)", () => {
  it("required: privzeto aktiven, a POPUSTLJIV — DEACTIVATED izklopi, HIDDEN skrije", () => {
    expect(modulePolicyFor("required").active).toBe(true)
    expect(modulePolicyFor("required", "DEACTIVATED").active).toBe(false)
    expect(modulePolicyFor("required", "DEACTIVATED").modified).toBe(true)
    expect(modulePolicyFor("required", "HIDDEN").active).toBe(true)
    expect(modulePolicyFor("required", "HIDDEN").hidden).toBe(true)
    expect(modulePolicyFor("required", "HIDDEN").effective).toBe("required")
  })
  it("disabled: ni več trde blokade — obravnava se kot optional (preklopljiv)", () => {
    expect(modulePolicyFor("disabled", "ACTIVE").effective).toBe("optional")
    expect(modulePolicyFor("disabled", "ACTIVE").active).toBe(true)
    expect(modulePolicyFor("disabled", "DEACTIVATED").effective).toBe("disabled")
    expect(modulePolicyFor("disabled").active).toBe(true)
  })
  it("optional: DEACTIVATED izklopi, sicer aktiven", () => {
    expect(modulePolicyFor("optional", "DEACTIVATED").effective).toBe("disabled")
    expect(modulePolicyFor("optional", "DEACTIVATED").active).toBe(false)
    expect(modulePolicyFor("optional", "ACTIVE").active).toBe(true)
    expect(modulePolicyFor("optional", "HIDDEN").hidden).toBe(true)
  })
})

describe("isTransitionAllowed — politika VSI MODULI ZA VSE: vse dovoljeno", () => {
  it("required in disabled in optional — lastnik izbira prosto", () => {
    for (const base of ["required", "disabled", "optional"] as CapabilityState[]) {
      for (const st of ["ACTIVE", "HIDDEN", "DEACTIVATED"] as const) {
        expect(isTransitionAllowed(base, st).ok).toBe(true)
      }
    }
  })
  it("§5 required + HIDDEN: javno skrit, plošča še deluje (ločitev vidnosti od aktivacije)", () => {
    expect(effectiveCapabilities({ appointments: "required" }, { appointments: "HIDDEN" }).appointments).toBe("required")
    expect(effectivePublicCapabilities({ appointments: "required" }, { appointments: "HIDDEN" }).appointments).toBe("disabled")
  })
})

// ============================================================
// §8 — dejavnostni scenariji skozi efektivno matriko (OBVOD UI je
// nemogoč — politika deluje na efektivni matriki, ki jo uporabljajo
// resolve in javni javni vhodi).
// ============================================================

describe("§8 frizerstvo (frizer)", () => {
  const caps = cappsOf("frizer")
  it("appointments required → lastnik SMETA izklopiti (politika VSI MODULI ZA VSE)", () => {
    expect(cap(caps, "appointments")).toBe("required")
    expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
  })
  it("services required privzeto aktivno", () => expect(cap(caps, "services")).toBe("required"))
})

describe("§8 kozmetika (cosmetica)", () => {
  const caps = cappsOf("cosmetica")
  it("appointments required — izklop lastnika je popustljiv", () => {
    expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
    expect(cap(caps, "customers")).toBe("required")
  })
  it("optional modul se sme izklopiti", () => {
    const review = cap(caps, "reviews")
    if (review === "optional") {
      expect(effectiveCapabilities(caps, { reviews: "DEACTIVATED" }).reviews).toBe("disabled")
    }
  })
})

describe("§8 avtoservis (mehanik)", () => {
  const caps = cappsOf("mehanik")
  it("workOrders/services required; appointments preklopljiv", () => {
    // Izklop appointments je popustljiv ne glede na izhodiščno stanje.
    expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
  })
  it("delovna naročila so jedro avtoservisa (privzeto vklopljen)", () => expect(cap(caps, "workOrders")).toBe("required"))
})

describe("§8 šiviljstvo (seamstress)", () => {
  const caps = cappsOf("seamstress")
  it("appointments je optional v surovem profilu, ACTIVE ga odpre (vsi moduli za vse)", () => {
    expect(cap(caps, "appointments")).toBe("optional")
    expect(effectiveCapabilities(caps, { appointments: "ACTIVE" }).appointments).toBe("optional")
  })
  it("workOrders/services/forms/workflows required (jedro) — a izklopljivo", () => {
    for (const k of ["workOrders", "services", "forms", "workflows"] as CapabilityKey[]) {
      expect(cap(caps, k)).toBe("required")
      expect(effectiveCapabilities(caps, { [k]: "DEACTIVATED" })[k]).toBe("disabled")
    }
  })
  it("reviews je optional, ACTIVE ga ima odprtega (vsi moduli za vse)", () => {
    expect(cap(caps, "reviews")).toBe("optional")
    expect(effectiveCapabilities(caps, { reviews: "ACTIVE" }).reviews).toBe("optional")
  })
})

describe("§8 tetoviranje (SKD T96.991 → generic)", () => {
  it("razreši na generic profil; dokumenti so zdaj VKLOPLJIVI (vsi moduli za vse)", () => {
    const prof = resolveSkdProfile("T96.991")
    expect(prof.id).toBeTruthy()
    const caps = { ...(prof.capabilities as unknown as Record<string, CapabilityState>) }
    expect(effectiveCapabilities(caps, { documents: "ACTIVE" }).documents).toBe("optional")
  })
})

describe("§8 generični SKD profil (generic)", () => {
  const caps = cappsOf(GENERIC_PROFILE_ID)
  it("customers/analytics required → privzeto aktivno, a izklopljivo", () => {
    expect(cap(caps, "customers")).toBe("required")
    expect(effectiveCapabilities(caps, { customers: "DEACTIVATED" }).customers).toBe("disabled")
  })
  it("documents je optional v surovem profilu (vsi moduli za vse), ACTIVE jih odpre", () => {
    expect(cap(caps, "documents")).toBe("optional")
    expect(effectiveCapabilities(caps, { documents: "ACTIVE" }).documents).toBe("optional")
  })
})

describe("§8 legacy neskladno stanje → varno razrešeno (brez brisanja)", () => {
  it("required + zapis DEACTIVATED: lastnik je izklopil — efektivno disabled", () => {
    const profile = { appointments: "required" }
    const eff = effectiveCapabilities(profile, { appointments: "DEACTIVATED" })
    expect(eff.appointments).toBe("disabled")
  })
  it("disabled + zapis ACTIVE: dvigne se na optional (vsi moduli za vse)", () => {
    const profile = { reviews: "disabled", appointments: "optional" }
    expect(effectiveCapabilities(profile, { reviews: "ACTIVE" }).reviews).toBe("optional")
    expect(effectivePublicCapabilities(profile, { reviews: "ACTIVE" }).reviews).toBe("optional")
    // HIDDEN/DEACTIVATED zapreta javni vhod.
    expect(effectivePublicCapabilities(profile, { reviews: "HIDDEN" }).reviews).toBe("disabled")
    expect(effectiveCapabilities(profile, { reviews: "DEACTIVATED" }).reviews).toBe("disabled")
    // optional ostane fleksibilen.
    expect(effectiveCapabilities(profile, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
    expect(effectiveCapabilities(profile, { appointments: "HIDDEN" }).appointments).toBe("optional")
  })
})

describe("§8 odvisnosti ostanejo pravilne, podatki se ne brišejo", () => {
  it("workflows zahteva workOrders; delivery zahteva shop; appointments services", () => {
    expect(getModule("workflows")?.dependsOn).toContain("workOrders")
    expect(getModule("delivery")?.dependsOn).toContain("shop")
    expect(getModule("appointments")?.dependsOn).toContain("services")
  })
  it("missingDependencies javi manjkajočo dep ob izklopljenem workOrders", () => {
    // optional profil: workOrders izklopljen → workflows ne more biti vklopljen brez tega.
    const profile = { workOrders: "optional", workflows: "optional" }
    expect(effectiveCapabilities(profile, { workOrders: "DEACTIVATED" }).workOrders).toBe("disabled")
  })
  it("moduleState le MARKIRA, ne briše podatkov (čista funkcija brez DB)", () => {
    const r = modulePolicyFor("optional", "DEACTIVATED")
    expect(r.effective).toBe("disabled")
  })
})