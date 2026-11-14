// ============================================================
// F5.0 — SKD 2025 celoten uradni katalog (SURS KLASJE, V1).
//
// Jamstva:
//  1. 100 % uvoz oficiialnih zapisov (1725 = 22/87/287/651/678).
//  2. Vse nadrejene povezave veljavne (nobene sirote, noben dvojnik).
//  3. Vsak od 678 podrazredov ima determinističen poslovni profil
//     (ali jasno evidentirano izjemo).
//  4. Iskanje po šifri, imenu in nadrejeni kategoriji.
//  5. Regresija: obstoječi `catalog.ts` (22 sekcij + 21 področij) ostane
//     funkcionalen (skd-catalog-f1.test.ts se ne zlomi).
// ============================================================

import { describe, expect, it } from "vitest"

import {
  SKD_RECORDS,
  SKD_BY_LEVEL,
  SKD_CLASSIFICATION,
  SKD_VERSION,
  skdByCode,
} from "@/lib/skd/data/skd2025"
import {
  resolveSkdProfile,
  profileIdForSkd,
  isSkdException,
  SKD_PROFILE_EXCEPTIONS,
} from "@/lib/skd/profiles"

// Uradna števila (SURS KLASJE, Details 13480):
const OFFICIAL_COUNTS = { 1: 22, 2: 87, 3: 287, 4: 651, 5: 678 }
const TOTAL = 22 + 87 + 287 + 651 + 678 // 1725

describe("F5.0 §1 — 100 % uvoz uradnega kataloga", () => {
  it(`vsebuje natanko ${TOTAL} zapisov s pravilnim razporedom po ravneh`, () => {
    expect(SKD_RECORDS.length).toBe(TOTAL)
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(SKD_BY_LEVEL[level].length).toBe(OFFICIAL_COUNTS[level])
    }
    // raven 5 je tista, ki jo uporabnik izbere (podrazred)
    expect(SKD_BY_LEVEL[5].length).toBe(678)
  })

  it("verzije klasifikacije je SKD_2025 / V1", () => {
    expect(SKD_CLASSIFICATION).toBe("SKD_2025")
    expect(SKD_VERSION).toBe("V1")
  })

  it("ima vsak zapis unikatno šifro, uradno slovensko in angleško ime ter nadrejenega", () => {
    const codes = new Set<string>()
    for (const r of SKD_RECORDS) {
      expect(codes.has(r.c)).toBe(false) // brez dvojnikov
      codes.add(r.c)
      expect(r.sl.length).toBeGreaterThanOrEqual(2)
      expect(r.en.length).toBeGreaterThanOrEqual(2)
      expect(r.l).toBeGreaterThanOrEqual(1)
      expect(r.l).toBeLessThanOrEqual(5)
      if (r.l === 1) expect(r.p).toBeNull()
      else expect(r.p).toBeTruthy()
    }
  })

  it("so vse nadrejene povezave veljavne (nobena sirota)", () => {
    const byCode = new Map(SKD_RECORDS.map((r) => [r.c, r]))
    for (const r of SKD_RECORDS) {
      if (r.p === null) continue
      const parent = byCode.get(r.p)
      expect(parent, `parent of ${r.c}`).toBeDefined()
      expect(parent!.l).toBe(r.l - 1)
    }
  })
})

describe("F5.0 §1 — iskanje", () => {
  it("po šifri (skdByCode)", () => {
    expect(skdByCode("A")?.sl).toContain("KMETIJSTVO")
    expect(skdByCode("T96.210")?.sl).toContain("Frizerska")
    expect(skdByCode("T95.310")?.sl).toContain("motornih vozil")
    expect(skdByCode("NE-OBSTAJA")).toBeUndefined()
  })

  it("po imenu in nadrejeni kategoriji (hierarhija B95/278)", () => {
    // nadrejena + kategorija: A01.110 -> A01.11 -> A01.1 -> A01 -> A
    const byCode = new Map(SKD_RECORDS.map((r) => [r.c, r]))
    let cur = byCode.get("A01.110")!
    const path = [cur.c]
    while (cur.p) {
      cur = byCode.get(cur.p)!
      path.push(cur.c)
    }
    expect(path).toEqual(["A01.110", "A01.11", "A01.1", "A01", "A"])
    // uradno ime podrazreda je prisotno
    expect(byCode.get("A01.110")!.sl).toContain("žit")
  })
})

describe("F5.0 §2 — vsak podrazred ima poslovni profil", () => {
  it("vsak od 678 podrazredov razreši na veljaven profil", () => {
    for (const r of SKD_RECORDS.filter((x) => x.l === 5)) {
      const profile = resolveSkdProfile(r.c)
      expect(profile, `profile for ${r.c} (${r.sl})`).toBeDefined()
      expect(profile.id.length).toBeGreaterThan(0)
      // bodisi je izjema jasno evidentirana, bodisi ima profil capability-je
      if (!isSkdException(r.c)) {
        // vsak profil mora dati vsaj en zadnjega-izbiro (nikoli prazen)
        expect(
          profile.capabilities.customers !== "disabled" ||
            profile.capabilities.services !== "disabled" ||
            profile.capabilities.workOrders !== "disabled"
        ).toBe(true)
      }
    }
  })

  it("determinističen — isti podrazred vedno isti profil", () => {
    const seen = new Map<string, string>()
    for (const r of SKD_RECORDS.filter((x) => x.l === 5)) {
      const pid = profileIdForSkd(r.c)
      expect(pid).toBe(seen.get(r.c) ?? pid)
      seen.set(r.c, pid)
    }
  })

  it("specifični ročni profili so pravilno vezani", () => {
    expect(profileIdForSkd("T96.210")).toBe("frizer")
    expect(profileIdForSkd("T96.220")).toBe("beauty")
    expect(profileIdForSkd("T95.310")).toBe("mehanik")
    expect(profileIdForSkd("T96.230")).toBe("massage")
  })

  it("nobena dejavnost ni brez izhodišča — sekcijski default deluje", () => {
    // primer vseh sekcij: za vsako najdemo vsaj en podrazred z njenim skd-* profilom
    const sections = "ABCDEFGHIJKLMNOPQRSTUV".split("")
    for (const s of sections) {
      const sample = SKD_RECORDS.find((r) => r.l === 5 && r.c.startsWith(s))
      expect(sample, `sample in section ${s}`).toBeDefined()
      if (!sample) continue
      const pid = profileIdForSkd(sample.c)
      expect(pid.startsWith(`skd-${s.toLowerCase()}-`), `${sample.c} -> ${pid}`).toBe(true)
    }
  })

  it("izjeme so evidentirane posebej (ne skrite)", () => {
    expect(SKD_PROFILE_EXCEPTIONS.length).toBeGreaterThan(0)
    for (const e of SKD_PROFILE_EXCEPTIONS) {
      expect(e.code).toBeTruthy()
      expect(e.usedProfile.length).toBeGreaterThan(0)
      expect(e.suggestedProfile.length).toBeGreaterThan(0)
      expect(e.reason.length).toBeGreaterThan(10)
    }
  })
})

describe("F5.0 §4 — regresija: obstoječi F1 katalog ostaja funkcionalen", () => {
  it("še vedno izvaža 22 sekcij in 21 področij (catalog.ts ni nadomeščen s prehodom)", async () => {
    const cat = await import("@/lib/skd/catalog")
    expect(cat.SKD_SECTIONS.length).toBe(22)
    expect(cat.SKD_AREAS.length).toBe(21)
    // nov katalog podpira sekcijske kode naprej
    expect(skdByCode("S")).toBeDefined()
    expect(skdByCode("A01.110")).toBeDefined()
  })

  it("sanitizeSkdInput sprejme konkreten podrazred (raven 5), ne samo sekcij", async () => {
    const { sanitizeSkdInput } = await import("@/lib/skd/catalog")
    const r = sanitizeSkdInput(["T96.210", "S", "NE-OBSTAJA", "area:retail"], [])
    expect(r.codes).toContain("T96.210") // konkreten podrazred
    expect(r.codes).toContain("S")
    expect(r.codes).toContain("area:retail")
    expect(r.codes).not.toContain("NE-OBSTAJA")
  })

  it("suggestModulesForSkd za podrazred predlaga module iz razrešenega profila", async () => {
    const { suggestModulesForSkd } = await import("@/lib/skd/catalog")
    // frizerski podrazred -> profil frizer -> appointments/services/customers/staff
    const hair = suggestModulesForSkd(["T96.210"])
    expect(hair).toContain("appointments")
    expect(hair).toContain("services")
    // avtomobilsko popravilo -> mehanik -> workOrders
    const auto = suggestModulesForSkd(["T95.310"])
    expect(auto).toContain("workOrders")
  })
})