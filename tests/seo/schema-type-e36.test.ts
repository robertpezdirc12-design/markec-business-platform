// ============================================================
// P2 #36 (audit-2026-11, reopen) — schema.org @type po vertikali
//
// Regresijska zaščita: prej je bil @type trdovratna konstanta
// (ClothingStore), potem ločena mapa v seo.ts. Zdaj je schemaType
// DELO definicije profila v registru — ta test zaklene preslikavo
// za VSE vertikale, tako da nov/negrpavljen profil ne more tiho
// prodati napačnega tipa.
// ============================================================

import { describe, it, expect } from "vitest"
import { schemaTypeForVertical } from "@/lib/seo"
import { PROFILES, listProfiles } from "@/lib/profiles/registry"

const EXPECTED: Record<string, string> = {
  beauty: "BeautySalon",
  frizer: "HairSalon",
  barber: "HairSalon",
  nails: "NailSalon",
  cosmetica: "BeautySalon",
  massage: "DaySpa",
  epilation: "BeautySalon",
  "tire-service": "AutoRepair",
  // #100-nadaljevanje: avtomehanik — isti schema.org tip kot vulkanizer.
  mehanik: "AutoRepair",
  // Storitveni posel — ClothingStore pomeni malico in je napačen (#36).
  seamstress: "ProfessionalService",
  beekeeping: "Store",
  generic: "LocalBusiness",

  // --- F5.0.2: 22 SKD 2025 sekcijskih profilov (A–V), schemaType iz registra.
  "skd-a-agriculture": "Farm",
  "skd-b-mining": "Industrial",
  "skd-c-manufacturing": "Manufacturing",
  "skd-d-energy": "Utility",
  "skd-e-water-waste": "Utility",
  "skd-f-construction": "ConstructionCompany",
  "skd-g-retail": "Store",
  "skd-h-transport": "TransportationCompany",
  "skd-i-hospitality": "Restaurant",
  "skd-j-media": "MediaOrganization",
  "skd-k-digital": "ComputerStore",
  "skd-l-finance": "FinancialService",
  "skd-m-real-estate": "RealEstateAgent",
  "skd-n-professional": "ProfessionalService",
  "skd-o-other-business": "ProfessionalService",
  "skd-p-public-admin": "GovernmentOffice",
  "skd-q-education": "EducationalOrganization",
  "skd-r-health": "MedicalOrganization",
  "skd-s-culture-sport": "SportsActivityLocation",
  "skd-t-other": "LocalBusiness",
  "skd-u-households": "LocalBusiness",
  "skd-v-international": "GovernmentOffice",
}

describe("schema.org @type per vertical (#36)", () => {
  it("maps every registry profile to its expected schema type", () => {
    for (const profile of listProfiles()) {
      expect(EXPECTED[profile.id], `missing expectation for ${profile.id}`).toBeDefined()
      expect(
        schemaTypeForVertical(profile.id),
        `wrong @type for ${profile.id}`
      ).toBe(EXPECTED[profile.id])
    }
  })

  it("covers every profile in the registry (no unmapped vertical can appear)", () => {
    expect(Object.keys(PROFILES).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it("falls back to neutral LocalBusiness for unknown/null verticals", () => {
    expect(schemaTypeForVertical(null)).toBe("LocalBusiness")
    expect(schemaTypeForVertical(undefined)).toBe("LocalBusiness")
    expect(schemaTypeForVertical("ne-obstojeca-vertikala")).toBe("LocalBusiness")
  })

  it("never returns the retail ClothingStore type (service platform)", () => {
    for (const profile of listProfiles()) {
      expect(schemaTypeForVertical(profile.id)).not.toBe("ClothingStore")
    }
  })
})
