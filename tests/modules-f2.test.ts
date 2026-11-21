// ============================================================
// #100 8.C (F2) — SAMOSTOJNI MODULI (regresijska varovala)
// Katalog (integriteta, odvisnosti), efektivna matrika (izklop = lastna
// beseda), struktura (akcije z revizijo, resolve vključi moduleStates,
// configurator v2, javna vrata prek capability).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  MODULES,
  MODULE_IDS,
  dependentsOf,
  effectiveCapabilities,
  effectivePublicCapabilities,
  getModule,
  missingDependencies,
} from "../src/lib/modules/catalog"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#100 8.C katalog modulov (integriteta)", () => {
  // WP-1: blagajna je 15. modul (14 capabilityjev + walkIn).
  it("15 modulov (14 capabilityjev + walkIn), unikatni id-ji", () => {
    expect(MODULES.length).toBe(15)
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(15)
    for (const m of MODULES) {
      expect(MODULE_IDS.has(m.id)).toBe(true)
      expect(m.nameSl.length).toBeGreaterThan(2)
      expect(m.nameEn.length).toBeGreaterThan(2)
      expect(m.capabilities.length).toBeGreaterThan(0)
    }
  })

  it("odvisnosti kažejo na obstoječe module, brez ciklov", () => {
    for (const m of MODULES) {
      for (const dep of m.dependsOn) {
        expect(MODULE_IDS.has(dep), `${m.id} → ${dep}`).toBe(true)
      }
    }
    // konkratne odvisnosti v1
    expect(getModule("workflows")?.dependsOn).toContain("workOrders")
    expect(getModule("delivery")?.dependsOn).toContain("shop")
    expect(getModule("appointments")?.dependsOn).toContain("services")
  })

  it("dependentsOf: izklop shop opozori na delivery; izklop services na appointments", () => {
    expect(dependentsOf("shop").map((m) => m.id)).toContain("delivery")
    expect(dependentsOf("services").map((m) => m.id)).toContain("appointments")
    expect(dependentsOf("analytics")).toEqual([])
  })
})

describe("#100 8.C efektivna matrika (izklop = zadnja beseda, politika VSI MODULI ZA VSE)", () => {
  it("DEACTIVATED izklopi tako OPTIONAL kot REQUIRED (required je popustljiv)", () => {
    const profile = { appointments: "required", shop: "required", analytics: "optional" }
    const out = effectiveCapabilities(profile, { appointments: "DEACTIVATED" })
    // VSI MODULI ZA VSE: required se lahko izklopi — lastnik ima zadnjo besedo.
    expect(out.appointments).toBe("disabled")
    expect(out.shop).toBe("required")
    // optional pa se sme izklopiti.
    const out2 = effectiveCapabilities(profile, { analytics: "DEACTIVATED" })
    expect(out2.analytics).toBe("disabled")
    expect(effectiveCapabilities(profile, {}).appointments).toBe("required")
  })

  it("ACTIVE ODPRE profil 'disabled' (ni več trde blokade — vsi moduli za vse)", () => {
    const profile = { reviews: "optional", appointments: "disabled" }
    const out = effectiveCapabilities(profile, { appointments: "ACTIVE" })
    expect(out.appointments).toBe("optional")
    // reviews nima vrstice → po #1318 P2 #5 manjkajoča optional vrstica =
    // DEACTIVATED (usklajeno z getModuleOverview); tu pade na disabled.
    expect(out.reviews).toBe("disabled")
  })

  it("več izklopk hkrati ne moti ostalih modulov", () => {
    const profile = { appointments: "required", shop: "optional", delivery: "optional" }
    const out = effectiveCapabilities(profile, {
      appointments: "DEACTIVATED",
      delivery: "DEACTIVATED",
    })
    expect(out.appointments).toBe("disabled") // required popustljiv
    expect(out.delivery).toBe("disabled")
    // shop nima vrstice (optional) → DEACTIVATED fallback, kot getModuleOverview.
    expect(out.shop).toBe("disabled")
  })
})

describe("#100 8.C odvisnosti pri vklopu/izklopu", () => {
  it("missingDependencies: vklop workflows z izklopljenim workOrders javi manjkajočo", () => {
    const missing = missingDependencies("workflows", { workOrders: "DEACTIVATED" })
    expect(missing.map((m) => m.id)).toEqual(["workOrders"])
    expect(missingDependencies("workflows", {})).toEqual([])
  })
})

describe("#100 F5 HIDDEN (skrito javno, plošča dela)", () => {
  it("HIDDEN v plošči pusti required delujočo; disabled se dvigne na optional", () => {
    const out = effectiveCapabilities({ appointments: "required", reviews: "disabled" }, {
      appointments: "HIDDEN",
      reviews: "HIDDEN",
    })
    // VSI MODULI ZA VSE: required ostaja aktiven (HIDDEN je le javna vidnost),
    // disabled se v plošči dvigne na optional (postane preklopljiv).
    expect(out.appointments).toBe("required")
    expect(out.reviews).toBe("optional")
  })

  it("HIDDEN na JAVNI strani = izklopljen (javni vhodi se zaprejo)", () => {
    const pub = effectivePublicCapabilities({ appointments: "required" }, {
      appointments: "HIDDEN",
    })
    expect(pub.appointments).toBe("disabled")
  })

  it("ACTIVE na javni strani ODPRE disabled (politika VSI MODULI ZA VSE)", () => {
    const pub = effectivePublicCapabilities({ appointments: "disabled" }, {
      appointments: "ACTIVE",
    })
    expect(pub.appointments).toBe("optional")
  })

  it("DEACTIVATED izklopi optional in required na obeh površinah", () => {
    const st = { shop: "DEACTIVATED" as const }
    expect(effectiveCapabilities({ shop: "optional" }, st).shop).toBe("disabled")
    expect(effectivePublicCapabilities({ shop: "optional" }, st).shop).toBe("disabled")
    // required + DEACTIVATED: popustljivo izklopljen (VSI MODULI ZA VSE).
    expect(effectiveCapabilities({ shop: "required" }, st).shop).toBe("disabled")
    expect(effectiveCapabilities({ appointments: "required", shop: "required" }, { appointments: "DEACTIVATED" }).appointments).toBe("disabled")
  })
})

describe("#100 8.C struktura: resolve, akcije, UI, vrata", () => {
  it("resolve: org vključi moduleStates (getOrgBySlug/getOrgById/custom domena/platformski fallback)", () => {
    const tenant = read("src/lib/tenant.ts")
    // #105-nadaljevanje: 4 nalagalci org vrstice vsi vključijo moduleStates —
    // getOrgBySlug, getOrgById, getCustomDomainOrg (custom domene) in
    // platformski root fallback. Brez tega bi modulna vrata (zadnja beseda)
    // pod custom domeno / fallbackom gledala samo overrides.
    expect(tenant.match(/include: \{ moduleStates/g)?.length).toBe(4)
  })

  it("resolveEffectiveProfile: moduleStates so zadnja beseda (celoten tok)", () => {
    const resolve = read("src/lib/profiles/resolve.ts")
    expect(resolve).toContain("effectiveCapabilities(")
    expect(resolve).toContain("effectivePublicCapabilities(")
    expect(resolve).toContain("resolvePublicEffectiveProfile")
    expect(resolve).toContain("statesFromOrg(org)")
  })

  it("akcija: org-scoped permission guard, odvisnosti (opozorilo/vrata), ConfigChangeLog revizija", () => {
    const actions = read("src/app/actions/modules.ts")
    // F5.4.2: modulno upravljanje je org-scoped + permission-based (settings.manage),
    // ne samo ADMIN-vloga — lastnik in STAFF z ustrezno custom vlogo.
    expect(actions).toContain("requireModuleManageOrg")
    expect(actions).toContain('getEffectivePermissions(session.user.id, org.id)')
    expect(actions).toContain('perms.includes("settings.manage")')
    expect(actions).toContain("dependentsOf(moduleId)")
    expect(actions).toContain("missingDependencies(moduleId, states)")
    expect(actions).toContain("recordConfigChange(")
    expect(actions).toContain('module:${moduleId}')
    expect(actions).toContain('r.state === "HIDDEN"')
  })

  it("UI: enoten »Moji moduli« (ModulesOverview) — izklop z opozorilom, brez tihih sprememb", () => {
    const card = read("src/components/dashboard/modules-overview.tsx")
    expect(card).toContain("setModuleState")
    expect(card).toContain("podatki ostanejo")
    const settings = read("src/app/(admin)/dashboard/settings/page.tsx")
    expect(settings).toContain("<ModulesOverview />")
  })

  it("shema: OrganizationModuleState unique par + brez brisanja podatkov ob izklopu", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("model OrganizationModuleState"),
      schema.indexOf("}", schema.indexOf("model OrganizationModuleState"))
    )
    expect(block).toContain("@@unique([organizationId, moduleId])")
    expect(block).toContain('state          String')
  })
})
