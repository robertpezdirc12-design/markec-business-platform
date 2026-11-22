// ============================================================
// F5.1 — Activity coverage register (678 SKD subclasses).
//
// THIS IS A DERIVED, READ-ONLY VIEW of the mapping authority. It is
// generated from the SAME single source of truth as everything else:
//   - the SKD_2025 catalog (src/lib/skd/data/skd2025.ts)
//   - the profile resolver   (src/lib/skd/profiles.ts)
//   - the profile registry   (src/lib/profiles/registry.ts)
//
// It does NOT invent data: coverage levels are computed from how the
// resolver actually maps a subclass and how much real runtime the
// mapped profile carries (forms / workflows / extensions). See the
// COVERAGE_LEVELS block for the honest definitions.
//
// The register is machine-readable (for tests + E2E) and human-readable
// (generated docs/SKD-2025-COMPLETE-COVERAGE.md is derived from it).
// ============================================================

import { SKD_RECORDS, SKD_CLASSIFICATION, SKD_VERSION } from "@/lib/skd/data/skd2025"
import { resolveSkdProfile, isSkdException } from "@/lib/skd/profiles"
import { getProfile } from "@/lib/profiles/registry"
import type { ActivityProfile } from "@/lib/profiles/types"

// ------------------------------------------------------------
// Honest coverage levels (Faza 1 / §14 of the coverage epic).
//
// "A — specialized and validated" is NEVER assigned automatically: it
// means the current profile has real business specialization for that
// activity. A subclass cannot be "A" just because it maps to a profile.
// ------------------------------------------------------------
export type CoverageLevel =
  | "specialized-validated" // A: explicit mapping to a profile with real runtime, validated
  | "validated-archetype" // B: maps to a profile whose runtime fits the activity (no bespoke specialization yet)
  | "validated-base" // C: section/base profile, documented as sufficient for now
  | "partial" // D: base mapping exists but needed specialization/workflow missing
  | "uncovered" // E: no-fitting resolution (should not normally happen; resolver always falls back)

/** Explicit SUBCLASS_PROFILE + DIVISION_PROFILE keys from src/lib/skd/profiles.ts
 *  (transcribed; the source-of-truth maps are private in renderer, but these
 *  mirrors are locked by tests prop: see activity-coverage.test.ts). */
const EXPLICIT_SUBCLASS = new Set([
  "T96.210", // frizer
  "T96.220", // beauty
  "T96.230", // massage
  "T96.991", // tattoo-studio
  "T95.310", // mehanik
  "T95.320", // mehanik
])
// Note: the real resolver also has C14 -> apparel via DIVISION_PROFILE.
const EXPLICIT_DIVISION = new Set(["C14"])

/** Real runtime depth of a profile — evidence, not declaration. */
export interface ProfileRuntime {
  forms: number
  workflows: number
  extensions: number
  dashboardWidgets: number
}

export function profileRuntime(id: string): ProfileRuntime {
  const p = getProfile(id)
  return {
    forms: (p.forms ?? []).length,
    workflows: (p.workflows ?? []).length,
    extensions: (p.extensions ?? []).length,
    dashboardWidgets: (p.dashboardWidgets ?? []).length,
  }
}

/** Does this subclass ride on an EXPLICIT business specialization (hand-built profile)? */
function isExplicitSpecialized(code: string): boolean {
  const pid = resolveSkdProfile(code).id
  // A profile that has <2 forms and <1 workflow and no extension is not a
  // business specialization no matter how it is named — it is a section shell.
  const rt = profileRuntime(pid)
  const hasRealRuntime = rt.forms >= 1 && (rt.workflows >= 1 || rt.extensions >= 1)
  if (!hasRealRuntime) return false
  // Also require the resolution itself to be expert, not a coincidental section match:
  // (skd-f-construction is a SECTION profile — a reusable base archetype, not a
  //  hand-built per-subclass specialization; the register marks it B, not A.)
  return EXPLICIT_SUBCLASS.has(code) || EXPLICIT_DIVISION.has(code.slice(0, 3))
}

export interface SkdCoverageRow {
  code: string
  sl: string
  en: string
  section: string
  division: string
  profileId: string
  profileName: string
  coverageLevel: CoverageLevel
  runtime: ProfileRuntime | null
  exception: boolean
}

const runtimeCache = new Map<string, ProfileRuntime>()

/** Compute honest coverage for one subclass. */
export function coverageFor(code: string): SkdCoverageRow {
  const rec = SKD_RECORDS.find((r) => r.c === code && r.l === 5)
  const pid = resolveSkdProfile(code).id
  const profile = getProfile(pid)
  let rt = runtimeCache.get(pid)
  if (!rt) {
    rt = profileRuntime(pid)
    runtimeCache.set(pid, rt)
  }

  let level: CoverageLevel
  const explicit = isExplicitSpecialized(code)
  const exception = isSkdException(code)

  if (explicit) level = "specialized-validated"
  else if (exception) level = "partial" // exception recorded => known gap (D)
  else if ((rt.forms ?? 0) === 0 && (rt.workflows ?? 0) === 0) level = "validated-base"
  else level = "validated-archetype"

  return {
    code,
    sl: rec?.sl ?? "",
    en: rec?.en ?? "",
    section: code[0] ?? "",
    division: code.slice(0, 3),
    profileId: pid,
    profileName: profile.label ?? pid,
    coverageLevel: level,
    runtime: rt,
    exception,
  }
}

/** Full register: all 678 subclasses, in SKD order. */
export function activityCoverage(): SkdCoverageRow[] {
  const out: SkdCoverageRow[] = []
  for (const r of SKD_RECORDS) {
    if (r.l === 5) out.push(coverageFor(r.c))
  }
  return out
}

/** Aggregate counts per section and per profile — for tests + the doc generator. */
export function coverageSummary() {
  const rows = activityCoverage()
  const bySection: Record<string, { total: number; byLevel: Record<CoverageLevel, number> }> = {}
  const byProfile: Record<string, number> = {}
  const byLevel: Record<CoverageLevel, number> = {
    "specialized-validated": 0,
    "validated-archetype": 0,
    "validated-base": 0,
    partial: 0,
    uncovered: 0,
  }
  const zeroLevel: Record<CoverageLevel, number> = { ...byLevel }
  for (const row of rows) {
    byLevel[row.coverageLevel]++
    bySection[row.section] ??= { total: 0, byLevel: { ...zeroLevel } }
    bySection[row.section].total++
    bySection[row.section].byLevel[row.coverageLevel]++
    byProfile[row.profileId] = (byProfile[row.profileId] ?? 0) + 1
  }
  return {
    classification: SKD_CLASSIFICATION,
    version: SKD_VERSION,
    total: rows.length,
    byLevel,
    bySection,
    byProfile,
  }
}

export type { ActivityProfile }