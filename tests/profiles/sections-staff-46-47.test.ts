// ============================================================
// P2 #46 + #47 — capability-gated home sections & staff seeding
//
// Čebelarstvo izključi storitve IN osebje. Prej:
//  - /services je bil javen (200), prazen in v sitemapu (#46),
//  - "Storitve" v navigaciji samo na /shop (drug layout brez section map),
//  - onboarding je vedno sejal staff vrstico → javna "Naša ekipa"
//    sekcija, ki je lastnik ne more urejati (#47).
// Zdaj odločanje drži sekcija zastavic (data + capability vrata) in
// onboardingov seed strogo sledi capabilities.staff.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { sectionsForProfile } from "@/lib/home-sections"
import { publishCopyKey } from "@/lib/profiles/setup-checklist"
import {
  PROFILES,
  getProfile,
  isCapabilityEnabled,
} from "@/lib/profiles/registry"
import { dashboardSl, dashboardEn } from "@/lib/i18n/dict/dashboard"

describe("#46 — sectionsForProfile (capability + data gates)", () => {
  it("beekeeping: services, shop section exists but services capability disabled → no services anchor", () => {
    const flags = sectionsForProfile(
      { services: false, shop: true, team: false, reviews: true },
      PROFILES.beekeeping
    )
    expect(flags.services).toBe(false)
    expect(flags.shop).toBe(true)
    expect(flags.team).toBe(false) // staff "disabled"
  })

  it("beauty with featured services/products keeps all anchors", () => {
    const flags = sectionsForProfile(
      { services: true, shop: true, team: true, reviews: true },
      PROFILES.beauty
    )
    expect(flags.services).toBe(true)
    expect(flags.shop).toBe(true)
    expect(flags.team).toBe(true)
  })

  it("optional capability keeps the anchor when profile allows (vsi moduli za vse)", () => {
    // beekeeping ima services zdaj kot optional → modul obstaja, anchor ostane
    // (prikaz je še data-gated: brez vrstic services se ne pokaže niti z optional).
    const flags = sectionsForProfile(
      { services: true, shop: true, team: true, reviews: true },
      PROFILES.beekeeping
    )
    expect(flags.services).toBe(true)
    expect(flags.team).toBe(true)
  })

  it("every profile with staff enabled keeps the team anchor (with staff data)", () => {
    for (const profile of Object.values(PROFILES)) {
      const flags = sectionsForProfile(
        { services: true, shop: true, team: true, reviews: true },
        profile
      )
      expect(flags.team).toBe(isCapabilityEnabled(profile, "staff"))
    }
  })

  it("#62 — team is data-gated: 0 active staff removes the anchor even when the profile allows staff", () => {
    const flags = sectionsForProfile(
      { services: true, shop: true, team: false, reviews: true },
      PROFILES.seamstress
    )
    expect(flags.team).toBe(false)
    expect(flags.services).toBe(true)
    expect(flags.shop).toBe(true)
  })
})

describe("#47 — onboarding staff seed respects capabilities.staff", () => {
  it("staff capability gates seeding — every profile with staff enabled seeds an owner row", () => {
    for (const profile of Object.values(PROFILES)) {
      const seeds = isCapabilityEnabled(profile, "staff")
      // pod politiko VSI MODULI ZA VSE ima vsak profil staff optional ali required → true
      expect(seeds).toBe(true)
      expect(profile.id === "beauty" ? seeds : true).toBe(true)
    }
  })

  it("onboarding action actually consults the capability (source guard)", () => {
    const src = readFileSync(
      __dirname + "/../../src/app/actions/onboarding.ts",
      "utf8"
    )
    expect(src).toContain("isCapabilityEnabled(getProfile(profile.id), \"staff\")")
    // both creation paths (linked user + anonymous) are wrapped in the gate;
    // #100 8.A (M3): dodatno podjetje istega računa brez staff vrstice
    // (Staff.userId je 1:1 — lastnik upravlja dodatno org kot ADMIN)
    expect(src.match(/if \(staffEnabled && !additionalOrg\)/g)?.length).toBe(1)
    expect(src).toContain("...(staffEnabled")
  })
})

describe("#49 — publish step copy follows the CTA mode", () => {
  it("booking + opted in → default reservation wording", () => {
    expect(publishCopyKey("booking", true)).toBe("publish")
  })
  it("booking + declined 24/7 → no-booking wording (existing behaviour)", () => {
    expect(publishCopyKey("booking", false)).toBe("publishNoBooking")
  })
  it("order profile (beekeeping) → order wording, never reservations", () => {
    expect(publishCopyKey("order", true)).toBe("publishOrder")
    expect(publishCopyKey("order", false)).toBe("publishOrder")
  })
  it("inquiry profile (seamstress) → inquiry wording", () => {
    expect(publishCopyKey("inquiry", true)).toBe("publishInquiry")
    expect(publishCopyKey("quote", false)).toBe("publishInquiry")
  })
  it("dict variants exist in BOTH languages and differ from the booking copy", () => {
    for (const dict of [dashboardSl, dashboardEn]) {
      const steps = dict.setupChecklist.steps
      expect(steps.publishOrder.description).toBeTruthy()
      expect(steps.publishInquiry.description).toBeTruthy()
      expect(steps.publishOrder.description).not.toBe(steps.publish.description)
      expect(steps.publishOrder.description).not.toContain("rezervacij")
      // P3 #49 "same family": customers copy has a non-booking variant
      expect(steps.customersOrder.description).not.toContain("terminov")
      expect(steps.customersOrder.hint).not.toContain("rezervacij")
    }
  })
})

describe("#49 — getProfile default CTA modes match the copy expectations", () => {
  it("beekeeping is order, seamstress is inquiry, beauty is booking", () => {
    expect(getProfile("beekeeping").website.ctaMode).toBe("order")
    expect(getProfile("seamstress").website.ctaMode).toBe("inquiry")
    expect(getProfile("beauty").website.ctaMode).toBe("booking")
  })
})
