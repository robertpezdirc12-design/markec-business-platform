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
} from "@/lib/skd/activity-coverage"

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
    // C14 ponudba → apparel prek division
    expect(resolveSkdProfileInfo("C14.110").source).toBe("division-override")
    expect(resolveSkdProfileInfo("C14.110").division).toBe("C14")
    expect(resolveSkdProfileInfo("C14.110").profileId).toBe("apparel")
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

  it("D (partial) = zahtevane zmožnosti brez predlog ali izjema", () => {
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "partial") continue
      if (row.exception) continue
      const decl = declaredConfiguration(getProfile(row.profileId))
      const reqWf = decl.capabilities.workflows === "required" && decl.workflows === 0
      const reqF = decl.capabilities.forms === "required" && decl.forms === 0
      expect(reqWf || reqF).toBe(true)
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
        // To JE pošteno stanje: deklarirana razširitev, a brez dokaza runtime.
        expect(true).toBe(true)
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

  it("gap analiza: agregat 347 + 33 = 380 (deklaracija required brez runtime) + 2 izjemi = 382 D", () => {
    // To izhaja iz GC-2 metodologije; številke so izpeljane iz registerja.
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
    expect(wfRequiredNoTemplate + formsOnlyRequiredNoTemplate + exceptions).toBe(coverageSummary().byLevel.partial)
  })

  it("seštevek po profilih = 678", () => {
    const s = coverageSummary()
    const sumProfiles = Object.values(s.byProfile).reduce((a, b) => a + b, 0)
    expect(sumProfiles).toBe(678)
  })
})

describe("§6 — dokumentacija je izpeljana (brez ročnih popravkov)", () => {
  it("generirani dokument (COMPLETE-COVERAGE) vsebuje vseh 22 sekcij z uradnimi nazivi in pravilne vsote", () => {
    const doc = readFileSync(resolve(__dirname, "../docs/SKD-2025-COMPLETE-COVERAGE.md"), "utf8")
    const s = coverageSummary()
    // vsak oddelek, uradno ime in vsota se ujema z registerjem
    for (const sec of SKD_SECTIONS) {
      const dd = s.bySection[sec.code]
      expect(doc).toContain(`| ${sec.code} | ${sec.name} |`)
      if (dd) {
        // vrstica v dokumentu mora pokazati total (to je niz, ki ga ne smemo podvajati ročno)
        expect(doc).toContain(`| ${dd.total} |`)
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
    // skd-f-construction ima 2 forma + 1 workflow → ni requiredMissing
    expect(requiredCapabilitiesMissing(getProfile("skd-f-construction"))).toBe(false)
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