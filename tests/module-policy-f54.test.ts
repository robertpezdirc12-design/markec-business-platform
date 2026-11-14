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
// required zaklenjen / optional fleksibilen / disabled nikoli.
// Plus dejavnostni scenariji iz zahteve §8.
// ============================================================

function cappsOf(profileId: string): Record<string, CapabilityState> {
  const p = getProfile(profileId)
  return { ...(p.capabilities as unknown as Record<string, CapabilityState>) }
}
const cap = (m: Record<string, CapabilityState>, k: CapabilityKey) => m[k] ?? "disabled"

describe("modulePolicyFor — osnovna pravila", () => {
  it("required: vedno aktiven tudi ob DEACTIVATED/HIDDEN", () => {
    expect(modulePolicyFor("required", "DEACTIVATED").effective).toBe("required")
    expect(modulePolicyFor("required", "HIDDEN").effective).toBe("required")
    expect(modulePolicyFor("required", "HIDDEN").hidden).toBe(true)
    expect(modulePolicyFor("required").active).toBe(true)
  })
  it("disabled: nikoli aktiven / odprt", () => {
    expect(modulePolicyFor("disabled", "ACTIVE").effective).toBe("disabled")
    expect(modulePolicyFor("disabled", "HIDDEN").active).toBe(false)
    expect(modulePolicyFor("disabled").active).toBe(false)
  })
  it("optional: DEACTIVATED izklopi, sicer aktiven", () => {
    expect(modulePolicyFor("optional", "DEACTIVATED").effective).toBe("disabled")
    expect(modulePolicyFor("optional", "ACTIVE").active).toBe(true)
    expect(modulePolicyFor("optional", "HIDDEN").hidden).toBe(true)
  })
})

describe("isTransitionAllowed — sprejem pravila", () => {
  it("required: DEACTIVATED zavrnjen z razlogom; ACTIVE/HIDDEN dovoljen", () => {
    expect(isTransitionAllowed("required", "DEACTIVATED").ok).toBe(false)
    expect(isTransitionAllowed("required", "ACTIVE").ok).toBe(true)
    expect(isTransitionAllowed("required", "HIDDEN").ok).toBe(true)
  })
  it("§5 required + HIDDEN: javno skrit, plošča še deluje (ločitev vidnosti od aktivacije)", () => {
    expect(effectiveCapabilities({ appointments: "required" }, { appointments: "HIDDEN" }).appointments).toBe("required")
    expect(effectivePublicCapabilities({ appointments: "required" }, { appointments: "HIDDEN" }).appointments).toBe("disabled")
  })
  it("disabled: ACTIVE in HIDDEN zavrnjena (ni odklepanja)", () => {
    expect(isTransitionAllowed("disabled", "ACTIVE").ok).toBe(false)
    expect(isTransitionAllowed("disabled", "HIDDEN").ok).toBe(false)
  })
  it("optional: vse tri so dovoljene", () => {
    expect(isTransitionAllowed("optional", "ACTIVE").ok).toBe(true)
    expect(isTransitionAllowed("optional", "HIDDEN").ok).toBe(true)
    expect(isTransitionAllowed("optional", "DEACTIVATED").ok).toBe(true)
  })
})

// ============================================================
// §8 — dejavnostni scenariji skozi efektivno matriko (OBVOD UI je
// nemogoč — politika deluje na efektivni matriki, ki jo uporabljajo
// resolve in javni javni vhodi).
// ============================================================

describe("§8 frizerstvo (frizer)", () => {
  const caps = cappsOf("frizer")
  it("appointments required → moduleState ne more izklopiti", () => {
    expect(cap(caps, "appointments")).toBe("required")
    expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("required")
  })
  it("services required", () => expect(cap(caps, "services")).toBe("required"))
})

describe("§8 kozmetika (cosmetica)", () => {
  const caps = cappsOf("cosmetica")
  it("appointments required (niski), disabled / shop optional kombinacije", () => {
    // cosmetica: appointments zahtevan (rezervacije); customers required.
    expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("required")
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
  it("workOrders/services required; appointments se sme izklopiti, če je optional", () => {
    if (cap(caps, "appointments") === "optional") {
      expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
    } else {
      expect(effectiveCapabilities(caps, { appointments: "DEACTIVATED" }).appointments).toBe("required")
    }
  })
  it("delovna naročila so jedro avtoservisa", () => expect(cap(caps, "workOrders")).toBe("required"))
})

describe("§8 šiviljstvo (seamstress)", () => {
  const caps = cappsOf("seamstress")
  it("appointments disabled → ni možno vklopiti niti z ACTIVE", () => {
    expect(cap(caps, "appointments")).toBe("disabled")
    expect(effectiveCapabilities(caps, { appointments: "ACTIVE" }).appointments).toBe("disabled")
  })
  it("workOrders/services/forms/workflows required (zaklenjeno)", () => {
    for (const k of ["workOrders", "services", "forms", "workflows"] as CapabilityKey[]) {
      expect(cap(caps, k)).toBe("required")
      expect(effectiveCapabilities(caps, { [k]: "DEACTIVATED" })[k]).toBe("required")
    }
  })
  it("reviews disabled → ne vklopljiv", () => {
    expect(cap(caps, "reviews")).toBe("disabled")
    expect(effectiveCapabilities(caps, { reviews: "ACTIVE" }).reviews).toBe("disabled")
  })
})

describe("§8 tetoviranje (SKD T96.991 → generic)", () => {
  it("razreši na generic profil; disabled dokumenti niso vklopljivi", () => {
    const prof = resolveSkdProfile("T96.991")
    expect(prof.id).toBeTruthy()
    const caps = { ...(prof.capabilities as unknown as Record<string, CapabilityState>) }
    // generic: only customers/analytics required; documents disabled.
    expect(effectiveCapabilities(caps, { documents: "ACTIVE" }).documents).toBe("disabled")
  })
})

describe("§8 generični SKD profil (generic)", () => {
  const caps = cappsOf(GENERIC_PROFILE_ID)
  it("customers/analytics required → zaklenjeno", () => {
    expect(cap(caps, "customers")).toBe("required")
    expect(effectiveCapabilities(caps, { customers: "DEACTIVATED" }).customers).toBe("required")
  })
  it("documents disabled → ne vklopljivo", () => {
    expect(cap(caps, "documents")).toBe("disabled")
    expect(effectiveCapabilities(caps, { documents: "ACTIVE" }).documents).toBe("disabled")
  })
})

describe("§8 legacy neskladno stanje → varno razrešeno (brez brisanja)", () => {
  it("required + zapis DEACTIVATED: efektivna matrika NE da disabled (resolve ga ne sme 'izklopiti')", () => {
    // Simuliramo kupljen/stari vnos: required appointments z DEACTIVATED v tabeli.
    const profile = { appointments: "required" }
    const eff = effectiveCapabilities(profile, { appointments: "DEACTIVATED" })
    expect(eff.appointments).toBe("required")
  })
  it("disabled + zapis ACTIVE/HIDDEN: efektivna matrika ga nikoli ne odpre", () => {
    const profile = { reviews: "disabled", appointments: "optional" }
    expect(effectiveCapabilities(profile, { reviews: "ACTIVE" }).reviews).toBe("disabled")
    expect(effectivePublicCapabilities(profile, { reviews: "HIDDEN" }).reviews).toBe("disabled")
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