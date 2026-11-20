import { describe, it, expect } from "vitest"
import { templatesFor, availableNavTargets, normalizeNav } from "../src/lib/site-design"
import { suggestedSectionsForVertical } from "../src/lib/site-content"
import { getProfile, isCapabilityEnabled, GENERIC_PROFILE_ID } from "../src/lib/profiles/registry"
import { resolveSkdProfile } from "../src/lib/skd/profiles"

// ============================================================
// F5.3.3 — DEJAVNOSTNA INTEGRACIJA (zahteva §4)
//
// Preverja, da so OBLIKOVNE PREDLOGE, SEKCIJE, PONUDBA (capabilities) in
// NAVIGACIJSKI TARGETI smiselni za reprezentativne dejavnosti — brez
// izdelovanja ločenih urejevalnikov po dejavnosti (skupno jedro).
// Reprezentativni profili: frizerstvo, kozmetika, avtoservis, šiviljstvo,
// tetoviranje (prek SKD mappinga na generic), najmanj en generični SKD.
// ============================================================

// Dejavnost → profile id (vir resnice: lib/profiles/registry.ts)
const REPRESENTATIVE: Record<string, { profile: string; vertical: string; sectionExpectation: string[] }> = {
  "frizerstvo (frizer)": { profile: "frizer", vertical: "frizer", sectionExpectation: ["services", "team"] },
  "kozmetika (cosmetica)": { profile: "cosmetica", vertical: "cosmetica", sectionExpectation: ["services", "shop"] },
  "avtoservis (mehanik)": { profile: "mehanik", vertical: "mehanik", sectionExpectation: ["services", "cta"] },
  "siviljstvo (seamstress)": { profile: "seamstress", vertical: "seamstress", sectionExpectation: ["services", "cta"] },
  "generični SKD (generic)": { profile: GENERIC_PROFILE_ID, vertical: "generic", sectionExpectation: ["hero", "cta"] },
}

describe("F5.3.3 dejavnostna integracija — predloge", () => {
  for (const [label, { profile }] of Object.entries(REPRESENTATIVE)) {
    it(`${label}: skupne oblikovne predloge so na voljo (brez praznega izbora)`, () => {
      const p = getProfile(profile)
      const capabilities = Object.entries(p.capabilities)
        .filter(([, state]) => state !== "disabled")
        .map(([name]) => name)
      const tpls = templatesFor({ vertical: p.catalog?.seedVerticalId ?? null, capabilitiesEnabled: capabilities })
      // Vedno je na voljo vsaj privzeta predloga (skupne, ne per-SKD).
      expect(tpls.length).toBeGreaterThan(0)
      // Vse predloge so SKUPNE — nobena ni vezana na samo eno dejavnost.
      for (const t of tpls) {
        expect(t.verticals == null).toBe(true)
      }
    })
  }
})

describe("F5.3.3 dejavnostna integracija — sekcije", () => {
  for (const [label, { vertical, sectionExpectation }] of Object.entries(REPRESENTATIVE)) {
    it(`${label}: predlagane sekcije so smiselne za dejavnost (vsebujejo ${sectionExpectation.join(",")})`, () => {
      const secs = suggestedSectionsForVertical(vertical)
      const visible = secs.filter((s) => s.visible).map((s) => s.key)
      for (const exp of sectionExpectation) {
        expect(visible).toContain(exp)
      }
    })
  }
})

describe("F5.3.3 dejavnostna integracija — navigacija + capability gate", () => {
  it("šiviljstvo: appointments optional → možen nav target; izklop sledi dejanskemu stanju", () => {
    const p = getProfile("seamstress")
    const appointments = isCapabilityEnabled(p, "appointments")
    // VSI MODULI ZA VSE: šivilja lako vklopi rezervacije (optional)
    expect(appointments).toBe(true)
    const targets = availableNavTargets([])
    // brez capabilities /booking ni ponujen
    expect(targets.find((t) => t.value === "/booking")).toBeUndefined()
  })

  it("frizer: appointments VKLOPLJEN → /booking in #services sta razpoložljiva", () => {
    const p = getProfile("frizer")
    expect(isCapabilityEnabled(p, "appointments")).toBe(true)
    const capabilities = Object.entries(p.capabilities)
      .filter(([, state]) => state !== "disabled")
      .map(([name]) => name)
    const targets = availableNavTargets(capabilities)
    expect(targets.find((t) => t.value === "/booking")).toBeDefined()
    expect(targets.find((t) => t.value === "#services")).toBeDefined()
  })

  it("avtoservis: moduli so smiselni (services vklopljen); /shop se ne ponudi brez capability shop", () => {
    const p = getProfile("mehanik")
    expect(isCapabilityEnabled(p, "services")).toBe(true)
    const capabilities = Object.entries(p.capabilities)
      .filter(([, state]) => state !== "disabled")
      .map(([name]) => name)
    const targets = availableNavTargets(capabilities)
    // /shop je tonav target le, če je shop capability dejansko vklopljen
    const shopEnabled = capabilities.includes("shop")
    expect(targets.some((t) => t.value === "/shop")).toBe(shopEnabled)
  })
})

describe("F5.3.3 SKD -> profil (tetoviranje)", () => {
  it("SKD T96.991 (tetoviranje) se razreši na veljaven profil, brez ločenega urejevalnika", () => {
    const prof = resolveSkdProfile("T96.991")
    expect(prof).toBeTruthy()
    expect(prof.id).toBeTruthy()
    // skupno jedro — predloge so na voljo tudi za ta profil
    const capabilities = Object.entries(prof.capabilities)
      .filter(([, state]) => state !== "disabled")
      .map(([name]) => name)
    const tpls = templatesFor({ vertical: prof.catalog?.seedVerticalId ?? null, capabilitiesEnabled: capabilities })
    expect(tpls.length).toBeGreaterThan(0)
  })
})

describe("F5.3.3 varnost nav (ponovna zaščita na navigaciji)", () => {
  it("javascript:/data: href se ne upodobi in se ne shrani skozi normalizeNav", () => {
    const nav = normalizeNav([
      { label: "Sidro", href: "#services", visible: true, order: 0 },
      { label: "XSS", href: "javascript:alert(document.cookie)", visible: true, order: 1 },
    ])
    expect(nav?.map((n) => n.label)).toEqual(["Sidro"])
  })
})