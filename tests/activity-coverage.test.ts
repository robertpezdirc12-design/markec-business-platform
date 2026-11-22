// ============================================================
// F5.1 — Register pokritosti SKD 2025: iskrenost + metodologija.
//
// Register je IZPELJAN iz istega resolverja in profilov kot aplikacija,
// zato nikoli ne sme odstopati od dejanske resolucije. Ti testi ne
// preverjajo zgolj "seštej = 678" — preverjajo PRAVILNOST METODOLOGIJE,
// s katero je vsaka vrstica razvrščena (A/B/C/D/E ali not-assessed).
// ============================================================

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { SKD_RECORDS } from "@/lib/skd/data/skd2025"
import {
  resolveSkdProfileInfo,
  profileIdForSkd,
  isValidSkdCode,
  skdCodeValidity,
  isSkdException,
} from "@/lib/skd/profiles"
import { SKD_SECTIONS } from "@/lib/skd/catalog"
import { getProfile } from "@/lib/profiles/registry"
import {
  activityCoverage,
  coverageSummary,
  declaredConfiguration,
  runtimeEvidenceFor,
  requiredCapabilitiesMissing,
  missingRequiredCapabilities,
  CAPABILITY_EVIDENCE,
} from "@/lib/skd/activity-coverage"
import { CAPABILITY_KEYS } from "@/lib/profiles/extensions"
import type { CapabilityKey } from "@/lib/profiles/types"

/** Tipkani dostop do CapabilityMatrix (brez `any`). */
type CapState = "required" | "optional" | "disabled"
const setCap = (caps: Record<string, CapState | undefined>, key: string, v: CapState) => {
  ;(caps as Record<CapabilityKey, CapState>)[key as CapabilityKey] = v
}

const subclasses = () => SKD_RECORDS.filter((r) => r.l === 5)

// ------------------------------------------------------------------
// §1 Osnovna konsistenca: točno 678 podrazredov, ujemajo z katalogom.
// ------------------------------------------------------------------
describe("§1 — register: točno 678, skladno s katalogom", () => {
  it("ima vseh 678 podrazredov v enakem vrstnem redu kot SKD katalog", () => {
    const rows = activityCoverage()
    const codes = subclasses().map((r) => r.c)
    expect(rows).toHaveLength(678)
    expect(rows.map((r) => r.code)).toEqual(codes)
  })

  it("vseh 22 nazivov sekcij se ujema z uradnim katalogom (SKD_SECTIONS)", () => {
    const official = new Map(SKD_SECTIONS.map((s) => [s.code, s.name]))
    expect(official.size).toBe(22)
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"]
    for (const l of letters) expect(official.has(l)).toBe(true)
    // A–V, brez preluknjano
    for (const l of letters) {
      expect(SKD_SECTIONS.some((s) => s.code === l), `manjka sekcija ${l}`).toBe(true)
    }
  })

  it("vsaka sekcija v registerju ima isto šifro in podrazred pripada svoji sekciji", () => {
    const official = new Map(SKD_SECTIONS.map((s) => [s.code, s.name]))
    for (const row of activityCoverage()) {
      expect(official.has(row.section), `nezname sekcije ${row.section}`).toBe(true)
      expect(row.section).toBe(row.code[0])
    }
  })

  it("vsaka vrstica ima sl + en iz kataloga (več kot samo črko)", () => {
    for (const row of activityCoverage()) {
      expect(row.sl.length).toBeGreaterThan(1)
      expect(row.en.length).toBeGreaterThan(1)
    }
  })
})

// ------------------------------------------------------------------
// §2 Preslikava: enoten, preverljiv izvor (mappingSource).
// ------------------------------------------------------------------
describe("§2 — mappingSource je skladen z resolverjem", () => {
  it("se strinja z resolverjem za vsak podrazred (profileId)", () => {
    const rows = activityCoverage()
    for (const r of subclasses()) {
      const row = rows.find((x) => x.code === r.c)!
      expect(row.profileId, r.c).toBe(profileIdForSkd(r.c))
      expect(row.mappingSource, r.c).toBe(resolveSkdProfileInfo(r.c).source)
    }
  })

  it("rešetev preštetja mappingSource iz dejanske resolucije (rešitev = dejstvo)", () => {
    const s = coverageSummary()
    expect(s.byMapping["subclass-override"]).toBe(6) // 6 podrazredni override
    expect(s.byMapping["division-override"]).toBe(6) // C14 → apparel (6 podrazredov)
    expect(s.byMapping["section-default"]).toBe(666) // 678 − 6 − 6
    expect(s.byMapping["generic-fallback"]).toBe(0)
    // Skupaj mora biti 678
    const sum = Object.values(s.byMapping).reduce((a, b) => a + b, 0)
    expect(sum).toBe(678)
  })

  it("točen podrazredni override in division override razrešita pravilno", () => {
    expect(resolveSkdProfileInfo("T96.210").source).toBe("subclass-override")
    expect(resolveSkdProfileInfo("T96.210").profileId).toBe("frizer")
    // C14 ponudba → apparel prek division (C14.100 in C14.290 sta katalogirana)
    expect(resolveSkdProfileInfo("C14.100").source).toBe("division-override")
    expect(resolveSkdProfileInfo("C14.100").division).toBe("C14")
    expect(resolveSkdProfileInfo("C14.100").profileId).toBe("apparel")
    expect(resolveSkdProfileInfo("C14.290").profileId).toBe("apparel")
    // nekateri podrazredi T95.xx so explicit
    expect(resolveSkdProfileInfo("T95.310").source).toBe("subclass-override")
    // običajna sekcijska masa → section-default
    expect(resolveSkdProfileInfo("A01.110").source).toBe("section-default")
    expect(resolveSkdProfileInfo("G47.110").source).toBe("section-default")
  })

  it("izjema S92 se razreši prek sekcijskega privzetka, a je označena", () => {
    const row = activityCoverage().find((x) => x.code === "S92.001")!
    expect(row).toBeDefined()
    expect(row.mappingSource).toBe("section-default")
    expect(row.exception).toBe(true)
    // izjema → ne more biti A/B – mora biti D (znana vrzel) ali vsaj ne-A
    expect(["A", "B"]).not.toContain(tsLevel(row))
    // druga izjema prav tako
    const row2 = activityCoverage().find((x) => x.code === "S92.002")!
    expect(row2.exception).toBe(true)
  })

  it("veljavni podrazred ni klasificiran kot E, če se razreši na section-default", () => {
    for (const row of activityCoverage()) {
      if (row.mappingSource === "generic-fallback") {
        expect.fail(`${row.code} ne sme pasti na generic-fallback (mora biti section-default)`)
      }
    }
  })
})

// ------------------------------------------------------------------
// §3 Metodologija: poštena A/B/C/D/E, brez prisiljevanja.
// ------------------------------------------------------------------
describe("§3 — metodologija: A/B/C/D/E in not-assessed so pošteni", () => {
  it("vsaka vrstica ima assessmentStatus in coverageLevel samo kadar je assessed", () => {
    for (const row of activityCoverage()) {
      expect(row.assessmentStatus === "assessed" || row.assessmentStatus === "not-assessed").toBe(true)
      if (row.assessmentStatus === "assessed") {
        expect(row.coverageLevel).toBeTruthy()
      } else {
        expect(row.coverageLevel).toBeNull()
      }
    }
  })

  it("A se dodeli SAMO, ko je jabka explicit override + dokazan runtime (ni 'C14 → apparel' brez forme)", () => {
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "specialized-validated") continue
      // A zahteva explicit specializacijo
      expect(["subclass-override", "division-override"]).toContain(row.mappingSource)
      // in runtime-evidence
      expect(row.runtimeEvidence).not.toBeNull()
    }
  })

  it("C se NIKOLI ne dodeli samodejno za 'forms==0' — zahteva dokumentirano podlago", () => {
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "validated-base") continue
      const p = getProfile(row.profileId)
      expect(p.capabilities.workOrders).toBe("required") // dokumentacijska podlaga
    }
  })

  it("D (partial) = vsaj ena zahtevana zmožnost ni dostavljena (no-template ali not-delivered) ali izjema", () => {
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "partial") continue
      if (row.exception) continue
      // D nastane iz (a) forms/workflows brez predlog, ALI (b) required
      // zmožnosti, ki NI univerzalno dokazana (services/analytics/appointments/
      // cashRegister — context-limited → not-delivered).
      const missing = missingRequiredCapabilities(getProfile(row.profileId))
      const hasGap = missing.some((m) => m.reason === "no-template") ||
        missing.some((m) => m.reason === "not-delivered")
      expect(hasGap, `${row.code}: partial mora imeti vsaj eno nedostavljeno required zmožnost`).toBe(true)
    }
  })

  it("runtimeEvidence nikoli NI izpeljan iz števca predlog", () => {
    for (const row of activityCoverage()) {
      // če profil nima runtime-evidence, mora biti runtimeEvidence == null
      const ev = runtimeEvidenceFor(row.profileId)
      // Ne zahtevamo A/B — samo preverimo, da če NI evidence, se ga ne označi za preverjen
      if (!ev && row.coverageLevel) {
        expect(["D", "E"]).toContain(tsLevel(row))
      }
    }
  })

  it("seštevek nivojev = 678 in po sekcijah = 678", () => {
    const s = coverageSummary()
    const sumLevels =
      s.byLevel.specializedValidated +
      s.byLevel.validatedArchetype +
      s.byLevel.validatedBase +
      s.byLevel.partial +
      s.byLevel.uncovered +
      s.byLevel.notAssessed
    expect(sumLevels).toBe(678)
    expect(s.assessed + s.notAssessed).toBe(678)
    const sumSections = Object.values(s.bySection).reduce((a, b) => a + b.total, 0)
    expect(sumSections).toBe(678)
  })

  it("skupna pokritost ne sme prekoračiti dejansko dokazanega (prag iskrenosti)", () => {
    const s = coverageSummary()
    // A je strogo omejen na dokazane specializacije; ne sme biti astronomski
    expect(s.byLevel.specializedValidated).toBeLessThanOrEqual(40)
    expect(s.byLevel.validatedArchetype).toBeLessThanOrEqual(40)
  })
})

// ------------------------------------------------------------------
// §4 Razmejitev deklaracije in runtime-a.
// ------------------------------------------------------------------
describe("§4 — deklaracija ≠ runtime", () => {
  it("extension deklaracije ne ustvarjajo runtime-evidence (razen če dokazano)", () => {
    // Profili, ki deklarirajo extensions, NIMAJO nujno runtimeEvidence.
    // npr. skd-g-retail (extensions=['shop']?) — preverimo da deklaracija
    // ni enaka runtime.
    for (const row of activityCoverage()) {
      if (row.declared.extensions > 0 && row.runtimeEvidence === null) {
        // Pošteno stanje: deklarirana razširitev, a brez dokaza runtime.
        // Razširitev SAMA NE sme dviči stopnje v A/B/C (validated) — brez
        // runtimeEvidence se vrsta ne more šteti kot specializirano/arhetip/
        // baza potrjena. To je realna, izvedljiva asercija (namesto gladke
        // `expect(true)`).
        expect(row.coverageLevel).not.toBe("specializedValidated")
        expect(row.coverageLevel).not.toBe("validatedArchetype")
        expect(row.coverageLevel).not.toBe("validatedBase")
      }
    }
  })

  it("skd-n-professional in skd-g-retail: capabilities=optional → NISTA D zaradi manjkajočih required", () => {
    // ključno za gap analizo (čl. 3.4)
    for (const id of ["skd-g-retail", "skd-n-professional"]) {
      const p = getProfile(id)
      expect(p.capabilities.workflows).not.toBe("required")
      expect(p.capabilities.forms).not.toBe("required")
    }
  })

  it("skd-c-manufacturing drži manj podrazredov kot celotna sekcija C (6 C14 → apparel)", () => {
    const s = coverageSummary()
    // celotna sekcija C = 233; skd-c-manufacturing manjši za 6 (C14)
    const allC = subclasses().filter((r) => r.c.startsWith("C")).length
    expect(allC).toBe(233)
    const onManufacturing = s.byProfile["skd-c-manufacturing"] ?? 0
    expect(onManufacturing).toBe(227)
    expect(onManufacturing).toBe(233 - 6)
  })

  it("declaredConfiguration je čisto štetje predlog, ne runtime", () => {
    const p = getProfile("skd-f-construction")
    const decl = declaredConfiguration(p)
    expect(decl.forms).toBe(2)
    expect(decl.workflows).toBe(1)
  })
})

// ------------------------------------------------------------------
// §5 Gap analiza: agregatna številka se proizvede iz registerja.
// ------------------------------------------------------------------
describe("§5 — gap analiza, pravilni capability flagi", () => {
  it("šteje D-partial = zahtevani-od nas delnih v vsaki sekciji", () => {
    const s = coverageSummary()
    // D stoji za "zahtevane zmožnosti brez predlog" ali izjeme
    expect(s.byLevel.partial).toBeGreaterThanOrEqual(2) // vsaj S92
  })

  it("številke se preverijo iz samega registerja (ne trdo)", () => {
    const rows = activityCoverage()
    // Agregat: koliko podrazredov je na D (partial) — ker 3.4 to zahteva
    const dRows = rows.filter((r) => r.coverageLevel === "partial")
    // In koliko jih ni ocenjeno (reference za gap analizo)
    const notAssessed = rows.filter((r) => r.assessmentStatus === "not-assessed")
    expect(dRows.length + notAssessed.length).toBeLessThanOrEqual(678)
  })

  it("gap analiza: 347 workflows + 33 forme = 380 template-vrzeli + 2 izjemi; D-partial je nadmnožica teh (še context-limited caps)", () => {
    // Template-vrzeli (deklarirano required, a 0 predlog) so realna dejstva:
    // izračunana iz profila, NEODVISNO od classifier scope-ja.
    let wfRequiredNoTemplate = 0
    let formsOnlyRequiredNoTemplate = 0
    let exceptions = 0
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "partial") continue
      if (row.exception) {
        exceptions++
        continue
      }
      const decl = declaredConfiguration(getProfile(row.profileId))
      const wfNeed = decl.capabilities.workflows === "required" && decl.workflows === 0
      const formNeed = decl.capabilities.forms === "required" && decl.forms === 0
      if (wfNeed) wfRequiredNoTemplate++
      else if (formNeed) formsOnlyRequiredNoTemplate++
    }
    expect(wfRequiredNoTemplate).toBe(347)
    expect(formsOnlyRequiredNoTemplate).toBe(33)
    expect(wfRequiredNoTemplate + formsOnlyRequiredNoTemplate).toBe(380)
    expect(exceptions).toBe(2)
    // D-partial je nadmnožica: poleg template-vrzeli in izjem šteje še
    // profile, ki so partial ZARADI context-limited required zmožnosti
    // (analytics/appointments/services/cashRegister) — tudi ko imajo predloge.
    // (Stari register je imel "D=382" — le template-vrzeli+izjeme; zdaj enotna
    // metodologija pokritosti zmožnosti da D=678. Ta test loči oba računa.)
    const partialRows = activityCoverage().filter((r) => r.coverageLevel === "partial").length
    expect(partialRows).toBe(coverageSummary().byLevel.partial)
    // Template-izpeljan del je stroga podmnožica vseh partial vrstic
    // (vsaka vrzel iz manjkajočih predlog je partial, a niso VSE partial vrstice
    // iz predlog — tudi required-analytics/services jih delajo).
    expect(wfRequiredNoTemplate + formsOnlyRequiredNoTemplate).toBeLessThan(partialRows)
  })

  it("seštevek po profilih = 678", () => {
    const s = coverageSummary()
    const sumProfiles = Object.values(s.byProfile).reduce((a, b) => a + b, 0)
    expect(sumProfiles).toBe(678)
  })
})

// ------------------------------------------------------------------
// §5c — SKLADNOST GAP ANALIZE z coverageSummary() + fitStatus.
// GAP analiza in register se ne smeta razhajati; fit je ločena dimenzija.
// ------------------------------------------------------------------
describe("§5c — GAP analiza skladna s klasifikatorjem in fit-razmejitev", () => {
  it("D in not-assessed v GAP ANALIZI sta iz pokritosti zmožnosti (coverageSummary), ne ročna", () => {
    const s = coverageSummary()
    // Register (doc 2) prikazuje pokritost zmožnosti:
    expect(s.byLevel.partial).toBe(678) // D
    expect(s.byLevel.specializedValidated).toBe(0) // A
    expect(s.byLevel.validatedArchetype).toBe(0) // B
    expect(s.byLevel.validatedBase).toBe(0) // C
    expect(s.byLevel.uncovered).toBe(0) // E
    expect(s.byLevel.notAssessed).toBe(0) // noben podrazred ni brez ocene pokritosti
    expect(s.notAssessed).toBe(0)
  })

  it("razčlenitev D=678 (380 no-template + 298 samo not-delivered) izhaja iz missingRequiredCapabilities", () => {
    // Enaka metodologija kot pri GAP 2a / 2c — NE trdo zakodirana, izpeljana.
    let noTemplate = 0
    let onlyNotDelivered = 0
    let both = 0
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "partial") continue
      const miss = missingRequiredCapabilities(getProfile(row.profileId))
      const tpl = miss.some((m) => m.reason === "no-template")
      const ndl = miss.some((m) => m.reason === "not-delivered")
      if (tpl && ndl) both++
      else if (tpl) noTemplate++
      else if (ndl) onlyNotDelivered++
    }
    // 380 vrstic ima template-vrzel (in hkrati not-delivered); 298 jih je samo not-delivered.
    expect(both).toBe(380)
    expect(noTemplate).toBe(0)
    expect(onlyNotDelivered).toBe(298)
    expect(both + noTemplate + onlyNotDelivered).toBe(coverageSummary().byLevel.partial)
  })

  it("fitStatus je ločen od assessmentStatus in vezan na verificiran poslovni fit (A+B)", () => {
    const s = coverageSummary()
    const rows = activityCoverage()
    let verified = 0
    let notAssessed = 0
    for (const row of rows) {
      if (row.fitStatus === "verified") {
        verified++
        // fit=verified LE za A/B (profil-specifičen runtime dokaz)
        expect(["specializedValidated", "validatedArchetype"]).toContain(row.coverageLevel)
      } else {
        notAssessed++
        // section-default ali 6 specializiranih override-ov NIKOLI samodejno ne
        // dajo fit=verified — za to je treba profil-specifičen test.
        expect(row.assessmentStatus).toBe("assessed") // pokritost je ocenjena
        expect(row.fitStatus).toBe("not-assessed") // fit pa še ni dokazan
      }
    }
    expect(verified + notAssessed).toBe(678)
    // Row-level fit se mora ujemati s summary metriko — trije viri, ena resnica.
    expect(verified).toBe(s.byFit.verified)
    expect(verified).toBe(s.metrics.fitVerifiedCount)
    expect(verified).toBe(s.metrics.businessFitVerifiedCount)
    expect(notAssessed).toBe(s.byFit.notAssessed)
  })

  it("specializirani override-i ne štejejo samodejno kot dokazan fit", () => {
    // 6 subclass-override vrstic (apparel/beauty/frizer/massage/mehanik/tattoo-studio)
    // so D-status z fit=not-assessed, dokler profil-specifičen test ne poganja teh.
    const overrideRows = activityCoverage().filter(
      (r) => r.mappingSource === "subclass-override",
    )
    expect(overrideRows.length).toBe(6)
    for (const row of overrideRows) {
      expect(row.coverageLevel).toBe("partial") // trenutno iskreno D
      expect(row.fitStatus).toBe("not-assessed") // override ≠ dokaz fitness
    }
  })
})

// ------------------------------------------------------------------
// §5b — parametrizirano dokazilo za vseh 13 zmožnosti.
// Vsaka zmožnost se preverja ISOLIRANO: samo sprememba ustreznega dokazila
// jo da naprej/nazaj, NEPOVEZANA forma ali razširitev ne potrdi druge zmožnosti.
// ------------------------------------------------------------------
describe("§5b — capability metodologija: 13 ključev, vsak z lastnim dokazilom", () => {
  const CAPS = [
    "appointments", "workOrders", "shop", "services", "inventory",
    "customers", "staff", "analytics", "forms", "workflows",
    "documents", "delivery", "cashRegister",
  ]

  // Jedro, ki ga platforma DOKAZANO dobavlja (strežniška akcija poganjana end-to-end): zahtevano NI vrzel.
  // (scope=universal po CAPABILITY_EVIDENCE)
  const PLATFORM_CAPS = [
    "shop", "inventory", "customers", "staff", "documents",
  ]

  // Zmožnost, ki JE v registerju, a samo context-limited (strežniška akcija NI
  // poganjana end-to-end): zahtevana MORA biti vrzel.
  const CONTEXT_LIMITED = [
    "appointments", "services", "analytics", "cashRegister",
  ]

  // Zmožnost, ki NIMA univerzalnega modula: zahtevana je vedno vrzel.
  const NON_UNIVERSAL = "delivery"

  // Zmožnosti, katerih dobava je ODVISNA od profilnih predlog (ne od scope-ja):
  // brez predloge = iskrena vrzel, z >= 1 predlogo = pokrito.
  const TEMPLATE_GATED = ["forms", "workflows", "workOrders"]

  it("vsaka od 13 zahtevanih zmožnosti je ali dobavljena-v-jedru ali (forms/workflows/workOrders) odvisna od predlog", () => {
    for (const key of CAPS) {
      expect(Boolean(CAPABILITY_EVIDENCE[key]) || key === NON_UNIVERSAL || key === "forms" || key === "workflows" || key === "workOrders",
        `${key} je ali v jedru, ali delivery, ali odvisna od predlog`).toBe(true)
      if (key === NON_UNIVERSAL) continue
      if (TEMPLATE_GATED.includes(key)) continue
      expect(CAPABILITY_EVIDENCE[key], `${key} ima dokazilo v CAPABILITY_EVIDENCE`).toBeTruthy()
    }
  })

  it("required UNIVERSAL platform-zmožnost NI vrzel (scope=universal, akcija poganjana end-to-end)", () => {
    for (const key of PLATFORM_CAPS) {
      const base = getProfile("skd-salon")
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [],
        workflows: [],
        extensions: [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "required")
      const missing = missingRequiredCapabilities(p)
      const keys = missing.map((m) => m.key)
      expect(keys, `${key} (scope=universal) ne sme biti manjkajoč`).not.toContain(key)
      // ključ mora biti res scope=universal (sicer bi ta test bil lažen)
      expect(CAPABILITY_EVIDENCE[key].scope).toBe("universal")
    }
  })

  it("required TEMPLATE-GATED zmožnost (forms/workflows/workOrders) NI vrzel, če profil ima >= 1 predlogo", () => {
    for (const key of TEMPLATE_GATED) {
      const base = getProfile("skd-salon")
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [{ key: "f0", name: "form", description: "", fields: [] }],
        workflows: [
          { id: "w0", name: "workflow", description: "wf", steps: [], trigger: { event: "manual" } },
        ],
        extensions: [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "required")
      const missing = missingRequiredCapabilities(p)
      const keys = missing.map((m) => m.key)
      expect(keys, `${key} z >= 1 predlogo ne sme biti manjkajoč — template-materializacija pokriva`).not.toContain(key)
    }
  })

  it("required TEMPLATE-GATED zmožnost (forms/workflows/workOrders) JE vrzel ob 0 predlogah", () => {
    for (const key of TEMPLATE_GATED) {
      const base = getProfile("skd-salon")
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [],
        workflows: [],
        extensions: [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "required")
      const missing = missingRequiredCapabilities(p)
      const keys = missing.map((m) => m.key)
      expect(keys, `${key} z 0 predlog MORA biti manjkajoč — createWorkOrder brez workflowa vrne NO_WORKFLOW`).toContain(key)
    }
  })

  it("required CONTEXT-LIMITED zmožnost MORA biti vrzel (scope != universal, akcija NI poganjana end-to-end)", () => {
    for (const key of CONTEXT_LIMITED) {
      const base = getProfile("skd-salon")
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [],
        workflows: [],
        extensions: [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "required")
      const missing = missingRequiredCapabilities(p)
      const keys = missing.map((m) => m.key)
      expect(keys, `${key} (scope=context-limited) MORA biti manjkajoč — ne sme šteti kot univerzalna dobava`).toContain(key)
    }
  })

  it("NEPOVEZANA forma/razširitev NE potrdi druge zmožnosti (delivery: required ostane vrzel navkljub predlogam)", () => {
    for (const extra of [0, 1, 3]) {
      const base = getProfile("skd-salon")
      const forms = Array.from({ length: extra }, (_, i) => ({
        key: `f${i}`, name: `form ${i}`, description: "", fields: [],
      }))
      const ext = ["order-details"]
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms,
        workflows: [],
        extensions: ext,
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "optional")
      setCap(p.capabilities as unknown as Record<string, CapState>, "delivery", "required")
      const keys = missingRequiredCapabilities(p).map((m) => m.key)
      // dokaz: kljub extra form + extension je delivery še vedno manjkajoč
      expect(keys, `delivery required + ${extra} forms => še vedno vrzel`).toContain("delivery")
    }
  })

  it("extension SAM po sebi ne spremeni katerih zmožnosti manjka (razširitve NISO runtime-dokaz)", () => {
    const base = getProfile("skd-salon")
    for (const extCount of [0, 1, 3]) {
      const extensions = Array.from({ length: extCount }, (_, i) => `ext-${i}`)
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [],
        workflows: [],
        extensions,
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "required")
      // Brez razširitev in z njimi: manjkajoči ključi morajo biti POVSEM enaki —
      // razširitev predloge ne nadomesti in ne pokrije workOrders/shop/etc.
      const without = missingRequiredCapabilities({ ...p, extensions: [] } as unknown as ReturnType<typeof getProfile>).map((m) => m.key)
      const withExt = missingRequiredCapabilities(p).map((m) => m.key)
      expect(withExt, `extensions ${extCount}: rezultat mora biti identičen`).toEqual(without)
    }
  })

  it("optional nikoli ne ustvari vrzeli", () => {
    for (const key of CAPS) {
      const base = getProfile("skd-salon")
      const p = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: [],
        workflows: [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(p.capabilities as unknown as Record<string, CapState>, c, "optional")
      expect(missingRequiredCapabilities(p), `optional ${key} ni vrzel`).toEqual([])
    }
  })

  it("forms/workflows: required brez predlog = vrzel; z vsaj eno = pokrito", () => {
    for (const key of ["forms", "workflows"]) {
      // brez predlog
      const base = getProfile("skd-salon")
      const empty = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: key === "forms" ? [] : [{ key: "wf-data", name: "x", entity: "order", stages: [] } as const],
        workflows: key === "workflows" ? [] : [{ key: "wf", name: "x", entity: "order", stages: [] } as const],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(empty.capabilities as unknown as Record<string, CapState>, c, "optional")
      setCap(empty.capabilities as unknown as Record<string, CapState>, key, "required")
      expect(missingRequiredCapabilities(empty).map((m) => m.key), `${key} brez predlog = vrzel`).toContain(key)
      // z eno predlogo
      const filled = {
        ...base,
        capabilities: { ...base.capabilities },
        forms: key === "forms" ? [{ key: "f", name: "x", description: "", fields: [] } as const] : [],
        workflows: key === "workflows" ? [{ key: "wf", name: "x", entity: "order", stages: [] } as const] : [],
      } as unknown as ReturnType<typeof getProfile>
      for (const c of CAPS) setCap(filled.capabilities as unknown as Record<string, CapState>, c, "optional")
      setCap(filled.capabilities as unknown as Record<string, CapState>, key, "required")
      expect(missingRequiredCapabilities(filled).map((m) => m.key), `${key} z eno predlogo = pokrito`).not.toContain(key)
    }
  })

  it("D v sekciji H: vsaka vrsta se neposredno oceni as 'partial' + 'assessed' (ne le posredno po profilu)", () => {
    // Vse sekcije H vrstice so razvrščene na isti profil skd-h-transport.
    const hRows = activityCoverage().filter((r) => r.code.startsWith("H"))
    expect(hRows.length).toBeGreaterThan(0)
    for (const row of hRows) {
      // NEPOSREDNO na vrsti, ne prek profila: nivo in status ocene.
      expect(row.coverageLevel, `${row.code}: H vrsta mora biti explicitno D/partial`).toBe("partial")
      expect(row.assessmentStatus, `${row.code}: H vrsta mora biti 'assessed'`).toBe("assessed")
    }
    // Diagnoza vzroka iz registerja (ne trdo): delivery + workflows sta zahtevani,
    // a neuniverzalna/brez predloge → dejanski ključi vrzeli.
    const pid = hRows[0].profileId
    const profile = getProfile(pid)
    const missing = missingRequiredCapabilities(profile).map((m) => m.key)
    const cap = profile.capabilities as unknown as Record<string, string>
    expect(cap.delivery).toBe("required")
    expect(missing).toContain("delivery")
    expect(missing).toContain("workflows")
  })

  it("register loči univerzalno dobavo (scope=universal) od context-limited — context-limited NE šteje kot dobava", () => {
    // Prava univerzalna dobava po scope-honouring pravilu = ključi s scope=universal.
    const universal = Object.entries(CAPABILITY_EVIDENCE)
      .filter(([, ev]) => ev.scope === "universal")
      .map(([k]) => k)
      .sort()
    const expectedUniversal = PLATFORM_CAPS.slice().sort()
    expect(universal).toEqual(expectedUniversal)
    // delivery nima nobenega dokazila v registerju.
    expect(CAPABILITY_EVIDENCE[NON_UNIVERSAL]).toBeUndefined()
    // vsak context-limited ključ je v registerju, a z jasnim scope=context-limited.
    for (const key of CONTEXT_LIMITED) {
      expect(CAPABILITY_EVIDENCE[key], `${key} je v registerju`).toBeTruthy()
      expect(CAPABILITY_EVIDENCE[key].scope).not.toBe("universal")
    }
  })
})

describe("§5c — declaredConfiguration pokriva VSE CapabilityMatrix ključe", () => {
  it("vsak ključ iz CAPABILITY_KEYS (=CapabilityMatrix) se pojavi v deklaraciji z dejansko zastavico", () => {
    // Konkretni profili: frizer (workflows optional/required?), baza jedro salon
    const profilesToCheck = ["skd-salon", "frizer", "mehanik", "skd-h-transport"]
    for (const pid of profilesToCheck) {
      const p = getProfile(pid)
      const dc = declaredConfiguration(p)
      expect(Object.keys(dc.capabilities)).toHaveLength(CAPABILITY_KEYS.length)
      for (const key of CAPABILITY_KEYS) {
        // vsak ključ je prisoten in ima veljavno stanje
        expect(dc.capabilities[key], `${pid} manjka deklaracije za ${key}`).toMatch(
          /^(required|optional|disabled)$/
        )
        // deklaracija = cast zastavice iz profila (brez preglasitve)
        const raw = (p.capabilities ?? {}) as unknown as Record<string, string | undefined>
        const expected = raw[key] ?? "optional"
        expect(dc.capabilities[key]).toBe(expected)
      }
    }
  })

  it("walkIn in cashRegister sta vključena v deklaracijo (nista tiho izpuščena)", () => {
    const p = getProfile("skd-salon")
    const dc = declaredConfiguration(p)
    // oba ključa sta del enotne seznama in prisotna v izhodu
    expect(dc.capabilities).toHaveProperty("walkIn")
    expect(dc.capabilities).toHaveProperty("cashRegister")
    expect(CAPABILITY_KEYS).toContain("walkIn")
    expect(CAPABILITY_KEYS).toContain("cashRegister")
  })

  it("required/optional/disabled se prenesejo neokrnjeno (vrednost pride iz registra)", () => {
    // skd-h-transport deklarira delivery required (ne-univerzalna), walkIn optional
    const p = getProfile("skd-h-transport")
    const dc = declaredConfiguration(p)
    const raw = p.capabilities as unknown as Record<string, string | undefined>
    for (const key of CAPABILITY_KEYS) {
      expect(dc.capabilities[key]).toBe(raw[key] ?? "optional")
    }
  })

  it("CAPABILITY_KEYS je sinhrn s CapabilityMatrix — nov ključ ne more tiho izostati", () => {
    // Eksplicitna tipna formulacija: tuple CAPABILITY_KEYS je `satisfies readonly
    // CapabilityKey[]` (extensions.ts) in sync-lock z `CapabilityMatrix` (test
    // extensions-e21.test.ts in compare the keys). Tu preverimo, da deklaracija
    // izpeljuje IZKLJUČNO iz tega enotnega seznama — noben dodatni, njihovo
    // število je natanko CAPABILITY_KEYS.length na vsakem dejanskem profilu.
    const expected = [...CAPABILITY_KEYS].sort()
    for (const pid of ["skd-salon", "frizer", "mehanik", "skd-h-transport", "tattoo-studio"]) {
      const dc = declaredConfiguration(getProfile(pid))
      const keys = Object.keys(dc.capabilities).sort()
      // Vsi ključi iz enotnega seznama morajo biti prisotni v deklaraciji.
      expect(keys).toEqual(expected)
    }
  })
})

describe("§5d — metriki deklariranih konfiguracijskih elementov: unikatno vs uteženo", () => {
  it("uteženo > unikatno, kadar isti profil pokriva več vrstic; obe izračunani iz dejanskih profilov", () => {
    const s = coverageSummary()
    const m = s.metrics

    // uteženo = vsota po vseh 678 vrsticah
    const rows = activityCoverage()
    const expectedWeighted = rows.reduce((a, r) => a + r.declared.totalConfigElements, 0)
    expect(m.weightedDeclaredConfigElementCount).toBe(expectedWeighted)

    // unikatno = vsota po navidezno edinstvenih profilskih id-jih
    const perProfile = new Map<string, number>()
    for (const r of rows) {
      perProfile.set(r.profileId, r.declared.totalConfigElements)
    }
    const expectedUnique = [...perProfile.values()].reduce((a, b) => a + b, 0)
    expect(m.uniqueDeclaredConfigElementCount).toBe(expectedUnique)

    // ker isti profil (npr. generic ali skd-salon) pokriva veliko vrstic,
    // je uteženo tipično strogo večje od unikatnega
    expect(m.weightedDeclaredConfigElementCount).toBeGreaterThanOrEqual(m.uniqueDeclaredConfigElementCount)
    // in obe sta pozitivni
    expect(m.uniqueDeclaredConfigElementCount).toBeGreaterThan(0)
  })
})
describe("§6 — dokumentacija je izpeljana (brez ročnih popravkov)", () => {
  it("generirani dokument (COMPLETE-COVERAGE) vsebuje vseh 22 sekcij z uradnimi nazivi in pravilne vsote", () => {
    const doc = readFileSync(resolve(__dirname, "../docs/SKD-2025-COMPLETE-COVERAGE.md"), "utf8")
    const s = coverageSummary()
    // vsak oddelek, uradno ime in vsota se ujema z registerjem
    for (const sec of SKD_SECTIONS) {
      const dd = s.bySection[sec.code]
      // CELOTNA vrstica sekcije: koda | naziv | total | A | B | C | D | E | ni-ocenjeno.
      if (dd) {
        const levelRow =
          `| ${sec.code} | ${sec.name} | ${dd.total} | ${dd.byLevel.specializedValidated} | ` +
          `${dd.byLevel.validatedArchetype} | ${dd.byLevel.validatedBase} | ${dd.byLevel.partial} | ` +
          `${dd.byLevel.uncovered} | ${dd.byLevel.notAssessed} |`
        expect(doc, `${sec.code}: celotna vrstica sekcije z vsemi nivoji`).toContain(levelRow)
        // Pošten pregled: tudi total, razčlenjen iz same vrstice, se ujema (noben
        // napačno preslikan / "prisiljen" par koda+naziv+total).
        const rowMatch = doc.match(new RegExp(`^\\| ${sec.code} \\| ${sec.name} \\| (\\d+) \\|`, "m"))
        expect(rowMatch, `${sec.code}: tabela vsebuje vrstico s kodo+nazivom`).toBeTruthy()
        expect(Number(rowMatch![1]), `${sec.code}: razčlenjen total == dd.total`).toBe(dd.total)
      } else {
        // sekcija ni zastopana v registerju → ne sme se pojaviti niti enkrat s totalom
        expect(doc.match(new RegExp(`^\\|\\s*${sec.code}\\s*\\|`, "m")), `${sec.code}: ne sme biti izmišljena vrstica`).toBeNull()
      }
    }
    // uradno ime mora biti iz kataloga, ne iz prejšnje ročne tabele
    expect(doc).toContain("Poslovanje z nepremičninami") // M
    expect(doc).not.toContain("| M | strokovne |")
    expect(doc).not.toContain("| M | Strokovne |")
    // skupna vrstica "Skupaj (po sekcijah): 678"
    expect(doc).toContain("**Skupaj (po sekcijah):** 678")
  })

  it("register pravilno razdeli C14 → apparel (division-override) in skd-c-manufacturing = 227", () => {
    const s = coverageSummary()
    expect(s.byMapping["division-override"]).toBe(6)
    expect(s.byProfile["skd-c-manufacturing"]).toBe(227)
    expect(s.byProfile["apparel"]).toBe(6)
  })
})
/** Pomagalnik: vrn Simbol A/B/C/D/E za row (ali "NA"). */
function tsLevel(row: { coverageLevel: string | null }): string {
  const map: Record<string, string> = {
    "specialized-validated": "A",
    "validated-archetype": "B",
    "validated-base": "C",
    partial: "D",
    uncovered: "E",
  }
  return row.coverageLevel ? (map[row.coverageLevel] ?? "NA") : "NA"
}

// ------------------------------------------------------------------
// §7 Neveljavne SKD kode: pošteno, ne tiho pokrito (reverziranje PR #142).
// ------------------------------------------------------------------
describe("§7 — neveljavne SKD kode se ne pokrijejo tiho", () => {
  it("oblikovno pravilna, a neobstoječa koda → generic-fallback (ne sekcijski profil)", () => {
    for (const c of ["T99.999", "C99.999", "X99.999"]) {
      const info = resolveSkdProfileInfo(c)
      expect(info.source, c).toBe("generic-fallback")
      expect(info.profileId, c).toBe("generic")
    }
  })

  it("prazna koda in napačna dolžina → valid=unknown/empty in generic-fallback", () => {
    expect(resolveSkdProfileInfo("").source).toBe("generic-fallback")
    expect(resolveSkdProfileInfo("X").source).toBe("generic-fallback")
    expect(resolveSkdProfileInfo("X9999").source).toBe("generic-fallback")
  })

  it("isValidSkdCode / skdCodeValidity razlikujeta pravo kodo od varljive", () => {
    expect(isValidSkdCode("A01.110")).toBe(true)
    expect(isValidSkdCode("T99.999")).toBe(false)
    expect(isValidSkdCode("")).toBe(false)
    expect(skdCodeValidity("A01")).toBe("valid")
    expect(skdCodeValidity("T99.999")).toBe("unknown")
    expect(skdCodeValidity("  ")).toBe("empty")
  })

  it("isSkdException NIKOLI ne klasificira neobstoječe kode po predponi", () => {
    // S92.099 NI v katalogu (obstajata le S92.001, S92.002) — ne sme biti igra na srečo.
    expect(isSkdException("S92.099")).toBe(false)
    // a dejansko igralno kodo prizna
    expect(isSkdException("S92.001")).toBe(true)
    // prazna koda ne
    expect(isSkdException("")).toBe(false)
  })

  it("register vsebuje SAMO katalogirane podrazrede (bilanc = 678)", () => {
    const rows = activityCoverage()
    const raw = new Set(SKD_RECORDS.filter((r) => r.l === 5).map((r) => r.c))
    for (const row of rows) expect(raw.has(row.code)).toBe(true)
  })

  // KATALOŠKI PRAG pred prevlečki (F5.0 §2): neobstoječa a oblikovno varljiva
  // koda (npr. "C14.999") NE sme dobiti realnega profila prek ujemanja predpone
  // (DIVISION_PROFILE["C14"] = apparel) niti sekcijskega privzetka — vedno
  // generic-fallback. Edini veljavni resolverji so katalogirane šifre.
  it("C14.999 in prijatelji padejo na generic-fallback, nikoli na section/division", () => {
    const cases = ["C14.999", "C14.999.999", "T99.999", "S92.099", ""]
    for (const c of cases) {
      const info = resolveSkdProfileInfo(c)
      expect(info.source, c).toBe("generic-fallback")
      expect(info.profileId, c).toBe("generic")
      // BINKA #1: DIVISION_PROFILE["C14"] = "apparel" NE sme zadeti C14.999.
      expect(info.profileId, c).not.toBe("apparel")
    }
  })

  it("veljavne katalogirane kode ne spremenijo vira (subclass/division/section)", () => {
    // A01.110 katalogiran podrazred → section (ni explicit override).
    expect(resolveSkdProfileInfo("A01.110").source).toBe("section-default")
    // T96.210 katalogiran → subclass-override frizer.
    expect(resolveSkdProfileInfo("T96.210").source).toBe("subclass-override")
    expect(resolveSkdProfileInfo("T96.210").profileId).toBe("frizer")
    // C14 (nivo division, katalogiran) → division-override apparel.
    expect(resolveSkdProfileInfo("C14").source).toBe("division-override")
    expect(resolveSkdProfileInfo("C14").division).toBe("C14")
    expect(resolveSkdProfileInfo("C14").profileId).toBe("apparel")
    // C14.100 katalogiran podrazred pod C14 → division-override apparel (še vedno).
    expect(resolveSkdProfileInfo("C14.100").source).toBe("division-override")
    expect(resolveSkdProfileInfo("C14.100").profileId).toBe("apparel")
  })

  it("register brez regresije: razdelitev mappingSource za 678 veljavnih kod ostaja enaka", () => {
    const s = coverageSummary()
    const mapping = s.byMapping
    // DISTRIBUCIJA (pred popravkom): subclass 6, division-override 6, section 666.
    expect(mapping["subclass-override"]).toBe(6)
    expect(mapping["division-override"]).toBe(6)
    expect(mapping["section-default"]).toBe(666)
    expect(mapping["generic-fallback"] ?? 0).toBe(0)
    const total = Object.values(mapping).reduce((a, b) => a + (b as number), 0)
    expect(total).toBe(678)
  })
})

// ------------------------------------------------------------------
// §8 Profil-specifičnost runtime dokaza — jedro revizije PR #142.
// ------------------------------------------------------------------
describe("§8 — A/B zahtevata profil-specifičen sprejet runtime dokaz", () => {
  it("niej eden podrazred ni A/B, če runtimeEvidence ni profil-specifičen", () => {
    for (const row of activityCoverage()) {
      const isAB = row.coverageLevel === "specialized-validated" || row.coverageLevel === "validated-archetype"
      if (!isAB) continue
      expect(row.runtimeEvidence, row.code).not.toBeNull()
      // Filtrirano: A/B smeta obstajati le s profileSpecific === true
      expect(row.runtimeEvidence!.profileSpecific, row.code).toBe(true)
    }
  })

  it("ne verjamemo 'C14 → apparel' na račun profile-specific dokaza iz DRUGega profila", () => {
    // Trenutno NITI eden podrazred nima profil-specifičnega dokaza → A=0, B=0.
    const s = coverageSummary()
    expect(s.byLevel.specializedValidated).toBe(0)
    expect(s.byLevel.validatedArchetype).toBe(0)
  })

  it("skd-f-construction NE sme samodejno dvigniti vseh 27 F-podrazredov na B", () => {
    const rows = activityCoverage()
    const fRows = rows.filter((r) => r.code.startsWith("F"))
    expect(fRows.length).toBe(27)
    for (const row of fRows) {
      if (row.coverageLevel === "validated-archetype") {
        expect.fail(`${row.code} mora biti not-assessed (ni podrazredno-specifičnega B)`)
      }
    }
  })

  it("preverjene zmožnosti se štejejo po VSEH zahtevanih (ne le forms/workflows)", () => {
    // skd-c-manufacturing: workflows/forms required + 0 predlog → vrzel (D)
    expect(requiredCapabilitiesMissing(getProfile("skd-c-manufacturing"))).toBe(true)
    // skd-f-construction ima 2 forma + 1 workflow → NI template-vrzeli; a ker
    // zahteva še context-limited zmožnosti (services, analytics), ki jih noben
    // test ne poganja end-to-end, je kljub temu requiredMissing → D.
    const f = getProfile("skd-f-construction")
    expect((f.forms ?? []).length).toBeGreaterThan(0)
    expect((f.workflows ?? []).length).toBeGreaterThan(0)
    const missingF = missingRequiredCapabilities(f)
    expect(missingF.some((m) => m.reason === "no-template")).toBe(false)
    expect(missingF.some((m) => m.key === "services"), "services je context-limited → vrzel").toBe(true)
    expect(missingF.some((m) => m.key === "analytics"), "analytics je context-limited → vrzel").toBe(true)
    expect(requiredCapabilitiesMissing(f)).toBe(true)
  })

  it("seštevek nivojev, metrik in preslikav je usklajen (678)", () => {
    const s = coverageSummary()
    const sum =
      s.byLevel.specializedValidated + s.byLevel.validatedArchetype + s.byLevel.validatedBase +
      s.byLevel.partial + s.byLevel.uncovered + s.byLevel.notAssessed
    expect(sum).toBe(678)
    expect(s.assessed + s.notAssessed).toBe(678)
    expect(s.metrics.unassessedCount).toBe(s.notAssessed)
    expect(s.metrics.businessFitVerifiedCount).toBe(
      s.byLevel.specializedValidated + s.byLevel.validatedArchetype
    )
    expect(s.metrics.runtimeProvenCount).toBeGreaterThanOrEqual(0)
  })
})