// ============================================================
// F5.1 — Activity coverage register must be honest to the real resolver.
//
// The register is DERIVED — it must never disagree with the actual
// profile resolution, and it must never overstate coverage.
// ============================================================

import { describe, expect, it } from "vitest"

import { SKD_RECORDS } from "@/lib/skd/data/skd2025"
import { resolveSkdProfile, profileIdForSkd } from "@/lib/skd/profiles"
import {
  activityCoverage,
  coverageSummary,
  coverageFor,
} from "@/lib/skd/activity-coverage"

describe("F5.1 §1 — register covers all 678 subclasses", () => {
  it("ima vseh 678 podrazredov, v enakem vrstnem redu kot katalog", () => {
    const rows = activityCoverage()
    expect(rows).toHaveLength(678)
    const subclassCodes = SKD_RECORDS.filter((r) => r.l === 5).map((r) => r.c)
    expect(rows.map((r) => r.code)).toEqual(subclassCodes)
  })

  it("se strinja z resolverjem za profileId (single source of truth)", () => {
    for (const r of SKD_RECORDS.filter((x) => x.l === 5)) {
      expect(coverageFor(r.c).profileId, r.c).toBe(profileIdForSkd(r.c))
    }
  })

  it("ima vsaka vrstica slovensko in angleško ime iz kataloga", () => {
    for (const row of activityCoverage()) {
      expect(row.sl.length).toBeGreaterThan(1)
      expect(row.en.length).toBeGreaterThan(1)
      expect(row.section).toBe(row.code[0])
    }
  })
})

describe("F5.1 §2 — coverage levels are honest (never overstate)", () => {
  it("vsaka vrstica ima eno od petih definiranih stanj", () => {
    const allowed = ["specialized-validated", "validated-archetype", "validated-base", "partial", "uncovered"]
    for (const row of activityCoverage()) {
      expect(allowed, `${row.code} -> ${row.coverageLevel}`).toContain(row.coverageLevel)
    }
  })

  it("A-level (specialized-validated) se dodeli SAMO z realnim runtime in eksplicitnim mappingom", () => {
    for (const row of activityCoverage()) {
      if (row.coverageLevel !== "specialized-validated") continue
      // mora imeti formo + (workflow ali razširitev) — to je definicija A
      expect(row.runtime!.forms >= 1).toBe(true)
      expect(row.runtime!.workflows >= 1 || row.runtime!.extensions >= 1).toBe(true)
      // in se ne sme strinjati s prazno sekcijsko lupino — npr. skd-c-manufacturing
      expect(["skd-c-manufacturing", "skd-g-retail", "skd-a-agriculture"]).not.toContain(row.profileId)
    }
  })

  it("prijavljeni izjemi (exception) ne more biti A ali B — je partial (poznana vrzel)", () => {
    for (const row of activityCoverage()) {
      if (row.exception) {
        expect(row.coverageLevel === "partial").toBe(true)
      }
    }
  })

  it("klasične ročne vertikale so A (real runtime + explicit mapping)", () => {
    expect(coverageFor("T96.210").profileId).toBe("frizer")
    expect(coverageFor("T96.210").coverageLevel).toBe("specialized-validated")
    expect(coverageFor("T95.310").profileId).toBe("mehanik")
    expect(coverageFor("T95.310").coverageLevel).toBe("specialized-validated")
    // C14 → apparel prek DIVISION override
    expect(profileIdForSkd("C14.110")).toBe("apparel")
    // sekcijska masa → ni A (to je realnost; ne smemo zahtevati A tam, kjer ga ni)
  })
})

describe("F5.1 §3 — summary is self-consistent", () => {
  it("seštevek po nivojih = 678 in po sekcijah = 678", () => {
    const s = coverageSummary()
    const sumLevels = Object.values(s.byLevel).reduce((a, b) => a + b, 0)
    expect(sumLevels).toBe(678)
    const sumSections = Object.values(s.bySection).reduce((a, b) => a + b.total, 0)
    expect(sumSections).toBe(678)
  })

  it("večina dejansko pade na validated-base (danes: 664 section-default, malo runtim-a)", () => {
    const s = coverageSummary()
    // to je meritvena zaščita: če se konfiguracija izboljša, se ta številka legitimno zmanjša;
    // če bi A vrednosti eksplodirale brez sprememb runtime, je register lažen.
    expect(s.byLevel["validated-base"]).toBeGreaterThan(s.byLevel["specialized-validated"])
  })
})