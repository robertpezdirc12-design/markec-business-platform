/**
 * SKD 2025 — register pokritosti vseh 678 podrazredov (Faza 1).
 *
 * Verodostojni vir, izpeljan IZ ISTE kode kot preostala aplikacija:
 *   - `src/lib/skd/data/skd2025.ts`   → 678 podrazredov (raven 5).
 *   - `src/lib/skd/profiles.ts`       → resolver in deterministični
 *                                       `SkdMappingSource` (brez podvojenih tabel).
 *   - `src/lib/profiles/registry.ts`  → profil: deklarirane zmožnosti + predloge.
 *   - `src/lib/profiles/materialize`  → kaj od deklaracije sploh postane
 *                                       per-tenant DB zapis.
 *
 * POŠTENA METODA (ločita se deklaracija in runtime; nobena vrstica ne dobi
 * oznake "poslovno preverjena" brez dokaza):
 *
 *   1. `declaredConfiguration` — kaj profil ZAPIŠE (forme/procesi/razširitve +
 *      capability zastavice). To je čista konfiguracija, NE dokaz delujoče
 *      poslovne funkcije.
 *   2. `runtimeEvidence` — eksplicitna, kurirana zbirka, ki ima za posamezen
 *      profil reference na dejansko kodo (strežniške akcije) in teste. `null`
 *      pomeni "ni dokaza o delujoči poslovni poti" — NIKOLI ni izpeljan iz števca.
 *   3. `mappingSource` — kako je podrazred razrešen (subclass/division/section/
 *      generic). Izpeljan iz istega resolverja, ne iz podvojenega seznama.
 *   4. `assessmentStatus` — "assessed" ali "not-assessed". Ne »sili« vseh 678
 *      vrstic v A/B/C: tam, kjer strokovne potrditve ni, ostane `not-assessed`.
 *   5. `coverageLevel` — A/B/C/D/E le, kadar je vrstica `assessed`.
 *
 * NIKAKOR se `extensions` ne šteje kot runtime: `materialize.ts` materializira
 * samo `forms` in `workflows` (ne `extensions`), zato je obstoj razširitve le
 * deklaracija. Samo razširitve z lastno strežniško akcijo + testi (npr.
 * vehicle-workshop, bee-apiary, batch-production, seamstress-measurements)
 * imajo dokazan runtime in so zajete v `RuntimeEvidence`.
 */

import type { ActivityProfile } from "@/lib/profiles/types"
import { getProfile } from "@/lib/profiles/registry"
import {
  resolveSkdProfileInfo,
  isSkdException,
  type SkdMappingSource,
} from "@/lib/skd/profiles"
import { SKD_RECORDS } from "@/lib/skd/data/skd2025"

export type CoverageLevel =
  | "specialized-validated" // A
  | "validated-archetype" // B
  | "validated-base" // C
  | "partial" // D
  | "uncovered" // E

export type AssessmentStatus = "assessed" | "not-assessed"

/** Kaj profil DEKLARIRA (čista konfiguracija — ne dokaz delovanja). */
export interface DeclaredConfiguration {
  forms: number
  workflows: number
  /** Število razširitev. VEDNO samo deklaracija (niso materializirane). */
  extensions: number
  /** Capability zastavice iz registra (required/optional/disabled) — VSE zmožnosti. */
  capabilities: Record<string, string>
  totalTemplates: number
}

/**
 * Zmožnosti, ki jih dokazano omogoča univerzalno jedro platforme (strežniške
 * akcije + testi), neodvisno od profila: booking, delovni nalogi, e-šhop,
 * storitve, zaloge, stranke, osebje in forma/workflow-predloge prek skupnega
 * engine-ja. Če profil označi to zmožnost kot `required`, NI nujno vrzeli —
 * jedro jo dokaže. Zmožnosti ZUNAJ tega nabora so dokazane le, kadar ima profil
 * lasten runtime-evidence; sicer platum ostane na D (zahtevano-a-nedokazano).
 */
const UNIVERSALLY_PROVEN_CAPABILITIES = new Set([
  "appointments",
  "workOrders",
  "shop",
  "services",
  "inventory",
  "customers",
  "staff",
  "analytics",
  "forms",
  "workflows",
])

/**
 * Dokaz o delujoči poslovni poti. Vsaka referenca je povezana na realen del
 * kode/testa. `RuntimeEvidence` NIKOLI ni izpeljan iz števca predlog.
 */
export interface RuntimeEvidence {
  /** Katere poslovne storitve so dejansko delujoče (imajo strežniške akcije). */
  serverActions: string[]
  /** Kateri (poglej `src/app/actions`) pokrivajo te storitve. */
  actionFiles: string[]
  /** Test datoteke, ki poslovno pot dejansko preverijo (E2E/integration/unit). */
  testFiles: string[]
  /**
   * Ali so deklarirani form-predlogi materializirani v per-tenant FormDefinition
   * in preko univerzalnega engine-ja (forms.ts). `true` = materializacija + engine.
   */
  materializedForms: boolean
  /**
   * Ali so deklarirani workflow-predlogi materializirani in jih poganja
   * univerzalni engine (forms.ts  → order/appointment states, sosednje stopnje).
   */
  materializedWorkflows: boolean
  /** Kratko besedilo: kje dokaz živi (npr. "tests/integration/tire-service.itest.ts"). */
  note: string
  /**
   * Ali dokaz res poganja PRAV ta profil in njegove deklarirane konfiguracijske
   * obrazce/workflowe skozi dejansko materializacijo profila (onboarding →
   * materializeProfileAssets → akcije). `false` = dokaz je izpelenjên iz
   * DRUGega profila (npr. seamstress dokazuje apparel) ali pa je zgolj
   * knjižnični test gestalnega engine-ja, ki ne uporabi tega profila.
   *
   * Nivoja A in B zahtevata `profileSpecific === true`. Če je `false`, se
   * podrazred UVEDE kot not-assessed (skupno jedro je sicer dokazano, a
   * profil-specific konfiguracija ni). To je jedro revizije PR #142.
   */
  profileSpecific: boolean
}

/**
 * Kuriran nabor profilov z DOKAZANIM runtime-evidence. Vsaka vrstica kaže na
 * realne datoteke. PROFILA brez vnosa tukaj nimata dokazane poslovne poti —
 * tudi če deklarirajo forme/procese/razširitve.
 */
const RUNTIME_BY_PROFILE: Record<string, RuntimeEvidence> = {
  "skd-f-construction": {
    serverActions: ["Form data workflow advancement"],
    actionFiles: ["src/app/actions/forms.ts", "src/app/actions/work-orders.ts"],
    testFiles: ["tests/work-order-inquiry.test.ts", "tests/forms/form-data.test.ts", "tests/work-order-costs.itest.ts"],
    materializedForms: true,
    materializedWorkflows: true,
    note: "gradbeni workflow (10 stopenj) materializiran + preverjen v work-order E2E",
    profileSpecific: false,
  },
  apparel: {
    serverActions: ["Seamstress / body measurements"],
    actionFiles: ["src/app/actions/seamstress.ts"],
    testFiles: ["tests/integration/seamstress.itest.ts", "e2e/d-seamstress.spec.ts"],
    materializedForms: true,
    materializedWorkflows: true,
    note: "šivalni proces z merami — testiran (dokaz je iz profila seamstress, ne apparel)",
    profileSpecific: false,
  },
  seamstress: {
    serverActions: ["Seamstress / body measurements"],
    actionFiles: ["src/app/actions/seamstress.ts"],
    testFiles: ["tests/integration/seamstress.itest.ts", "e2e/d-seamstress.spec.ts"],
    materializedForms: true,
    materializedWorkflows: true,
    note: "specializirana (ni neposredno v SKD preslikavi)",
    profileSpecific: true,
  },
  mehanik: {
    serverActions: ["Vehicle workshop orders"],
    actionFiles: ["src/app/actions/vehicle-workshop.ts"],
    testFiles: ["tests/integration/tire-service.itest.ts", "e2e/b-tire-service.spec.ts", "tests/work-order-*.test.ts"],
    materializedForms: true,
    materializedWorkflows: true,
    note: "vulkanizersko-program: vozilo + delovni nalog + testi (dokaz je iz profila tire-service)",
    profileSpecific: false,
  },
  "tire-service": {
    serverActions: ["Vehicle workshop orders"],
    actionFiles: ["src/app/actions/vehicle-workshop.ts"],
    testFiles: ["tests/integration/tire-service.itest.ts", "e2e/b-tire-service.spec.ts"],
    materializedForms: true,
    materializedWorkflows: true,
    note: "vulkanizersko-program: vozilo + delovni nalog + testi",
    profileSpecific: true,
  },
  beekeeping: {
    serverActions: ["Apiary / colony management"],
    actionFiles: ["src/app/actions/apiculture.ts", "src/app/actions/colony-moves.ts"],
    testFiles: ["tests/integration/beekeeping-final-validation.itest.ts", "e2e/c-beekeeping.spec.ts", "tests/integration/f2-3/colony-move-2c2.itest.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "čebelarstvo: panji + žetev (batch-production) — testirano",
    profileSpecific: true,
  },
  "skd-a-agriculture": {
    serverActions: ["Apiary / colony management (batch-production)"],
    actionFiles: ["src/app/actions/apiculture.ts", "src/app/actions/colony-moves.ts"],
    testFiles: ["tests/integration/beekeeping-final-validation.itest.ts", "e2e/c-beekeeping.spec.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "km. sekcija nese predvsem čebelarski runtime (ni dokaz za druge podrazrede A)",
    profileSpecific: false,
  },
  frizer: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts", "tests/batch-74-87.test.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "booking jedro — dokaz ni profil-specifičen za frizerja",
    profileSpecific: false,
  },
  beauty: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "booking jedro — dokaz ni profil-specifičen za beauty",
    profileSpecific: false,
  },
  massage: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "wellness terminski tok — dokaz ni profil-specifičen za massage",
    profileSpecific: false,
  },
  "tattoo-studio": {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: true,
    materializedWorkflows: false,
    note: "studio terminski tok — dokaz ni profil-specifičen za tattoo-studio",
    profileSpecific: false,
  },
}

/** Odpre ključ dokazov za profil (ali null). */
export function runtimeEvidenceFor(profileId: string): RuntimeEvidence | null {
  return RUNTIME_BY_PROFILE[profileId] ?? null
}

/** Deklarirana konfiguracija profila (čista, iskrena — ni runtime). */
export function declaredConfiguration(profile: ActivityProfile): DeclaredConfiguration {
  const forms = (profile.forms ?? []).length
  const workflows = (profile.workflows ?? []).length
  const extensions = (profile.extensions ?? []).length
  const cap = (profile.capabilities ?? {}) as unknown as Record<string, string | undefined>
  const ALL_CAPS = [
    "appointments", "workOrders", "shop", "services", "inventory",
    "customers", "staff", "analytics", "reviews", "forms", "workflows",
    "documents", "delivery", "cashRegister",
  ] as const
  const capabilities: Record<string, string> = {}
  for (const k of ALL_CAPS) capabilities[k] = cap[k] ?? "optional"
  return {
    forms,
    workflows,
    extensions,
    capabilities,
    totalTemplates: forms + workflows + extensions,
  }
}

/**
 * Ali je profil brez zmožnosti, ki jih ta profil zahteva (`required`).
 *
 * Revija P3 RAZŠIRI preverjanje na zahtevani nabor zmožnosti (review §4):
 *   appointments, workOrders, shop, services, inventory, customers, staff,
 *   analytics, forms, workflows, documents, delivery, cashRegister.
 * Zmožnost, označena kot `required`, MORA biti dokazana:
 *  - zmožnosti iz univerzalnega jedra (booking/shop/work-orders/forms…) so
 *    dokazane neodvisno od profila — `required` NI vrzel;
 *  - preostale (documents, delivery, cashRegister) so dokazane šele, ko ima
 *    profil zanj predlogo ali runtime-evidence; brez nastavka = iskrena vrzel (→ D).
 *
 * `reviews` in `walkIn` NISTA del obravnavanega nabora (po dogovoru review §4);
 * njihova `required` oznaka se poroča, ne poganja pa D.
 */
const ASSESSED_CAPABILITIES: ReadonlyArray<string> = [
  "appointments", "workOrders", "shop", "services", "inventory",
  "customers", "staff", "analytics", "forms", "workflows",
  "documents", "delivery", "cashRegister",
]

export function requiredCapabilitiesMissing(profile: ActivityProfile): boolean {
  const cap = (profile.capabilities ?? {}) as unknown as Record<string, "required" | "optional" | "disabled" | undefined>
  for (const key of ASSESSED_CAPABILITIES) {
    if (cap[key] !== "required") continue
    // forms / workflows: zahtevani, a brez nobene predloge → vrzel.
    if (key === "forms" && (profile.forms ?? []).length === 0) return true
    if (key === "workflows" && (profile.workflows ?? []).length === 0) return true
    // Ostale zahtevane zmožnosti: pokrite, če so del univerzalnega jedra.
    if (UNIVERSALLY_PROVEN_CAPABILITIES.has(key)) continue
    // Neuniverzalna zahtevana zmožnost brez lastne predloge → vrzel.
    const templ =
      (profile.forms ?? []).length +
      (profile.workflows ?? []).length +
      (profile.extensions ?? []).length
    if (templ === 0) return true
  }
  return false
}

/**
 * Dodeljevanje B (validated-archetype) je PODRAZREDNO, ne profilno-avtomatično.
 *
 * Nekoč je bila tu zbirka `SECTION_ARCHETYPE_PROFILES = ["skd-f-construction"]`,
 * ki je samodejno dvignila VSEH 27 podrazredov sekcije F na B. To je bilo
 * nepošteno: obstoj profilnega obrazca/workflowa ni dokaz, da pokriva prav to
 * dejavnost (npr. F42.110 »Gradnja cest« ni pokrita z obrazcem za polaganje
 * keramike).
 *
 * Pravilo zdaj: B dobi SAMO podrazred, ki je IZRECNO naveden na tem seznamu
 * (točna 5-mestna SKD koda), in to le, kadar profil zanj nudi profil-specifičen
 * runtime-dokaz (`runtimeEvidence.profileSpecific === true`).
 *
 * Trenutno je zbirka PRAZNA: NITI eden od 27 podrazredov F še nima
 * podrazredno-specifičnega E2E dokaza skozi realno materializacijo profila.
 * »Kandidat«, ki bi se moral obravnavati, je F43.330 (Oblaganje tal in sten) —
 * edini, katerega poslovno jedro profil res služi (obrazec construction-inquiry
 * = polaganje ploščic/tlakovanje) — a dokler ni testa, ki poganja prav to
 * konfiguracijo, ostane not-assessed, NE samodejno B.
 */
const VALIDATED_B_CODES: Readonly<Record<string, string>> = {
  // "F43.330": "skd-f-construction", // KANDIDAT za B — potreben profil-specific test
}

/** Ali podrazred z dano kodo sme dobiti nivo B (validated-archetype). */
export function validatedBaseCode(profileId: string, code: string): boolean {
  return VALIDATED_B_CODES[code] === profileId
}

/**
 * C (validated-base): profil, za katerega je STROKOVNO dokumentirano, da
 * osnovna konfiguracija (workOrders engine) zadostuje CELI izbrani sekciji,
 * ne da bi potreboval dodatne posebne evidence/obrazce/procese.
 *
 * MORA BITI NAMERNO POPULIRAN: prazna zbirka = nič se samodejno ne promovira
 * v C. Odsotnost obrazcev/workflowov NIKOLI ni dokaz ustreznosti.
 */
const BASE_SUFFICIENT_PROFILES: ReadonlySet<string> = new Set<string>([])

/**
 * Ali dejavnost res NI potrebuje dodatnih (specializiranih) evidence.
 * `workOrders === required` je NUPOgoj (obstaja splošen, preizkušen
 * delovnonalog), a C se dodeli le, kadar profil je v BASE_SUFFICIENT_PROFILES.
 */
function isDocumentedBaseSufficient(profile: ActivityProfile): boolean {
  return profile.capabilities.workOrders === "required" && BASE_SUFFICIENT_PROFILES.has(profile.id)
}

/**
 * Klasifikacija A/B/C/D/E (le kadar je `assessed`).
 *  - A / specialized-validated: subtype/division override + DOKAZAN runtime.
 *  - B / validated-archetype:    section-default na profil z DOKAZANIM runtime
 *                                (uporabni arhetip, npr. skd-f-construction).
 *  - C / validated-base:         dokumentirano, da osnovna konfiguracija zadostuje.
 *  - D / partial:                preslikava obstaja, a zahtevane zmožnosti
 *                                (workflows/forms=required) NIMAJO predlog, oz. je izjema.
 *  - E / uncovered:              resolver je padel na generični fallback.
 *  - null → not-assessed (brez sile v A/B/C).
 */
export type RowClass =
  | { kind: "A" }
  | { kind: "B" }
  | { kind: "C" }
  | { kind: "D" }
  | { kind: "E" }
  | { kind: "not-assessed" }

export interface SkdCoverageRow {
  code: string
  sl: string
  en: string
  section: string
  division: string // spekulativen/izpeljan oddelek (vzorčna koda)
  profileId: string
  profileName: string
  /** Kako je ta podrazred dejansko preslikan (iz resolverja). */
  mappingSource: SkdMappingSource
  /** Eksplicitno stanje vrednotenja. */
  assessmentStatus: AssessmentStatus
  /** A/B/C/D/E — samo kadar je `assessed`. */
  coverageLevel: CoverageLevel | null
  /** Deklarirana konfiguracija profila (niso dokaz runtime). */
  declared: DeclaredConfiguration
  /** Dokaz o delujoči poslovni poti — ali `null`, če ni dokazanega. */
  runtimeEvidence: RuntimeEvidence | null
  /** Ali je izjema (npr. S92 igre na srečo). */
  exception: boolean
}

export interface CoverageByLevel {
  specializedValidated: number
  validatedArchetype: number
  validatedBase: number
  partial: number
  uncovered: number
  notAssessed: number
}

export interface CoverageSectionSummary {
  total: number
  byLevel: CoverageByLevel
}

export interface CoverageSummary {
  classification: string
  version: string
  total: number
  assessed: number
  notAssessed: number
  byLevel: CoverageByLevel
  bySection: Record<string, CoverageSectionSummary>
  byProfile: Record<string, number>
  byMapping: Record<SkdMappingSource, number>
  /**
   * Ločeni, neprekrivajoči se metriki (revija P3 — PRAVILNO POIMENOVANJE).
   * "dokazan runtime" ≠ "deklarirana predloga" ≠ "preverjena poslovna ustreznost".
   */
  metrics: {
    /** Podrazredov, katerih profil nosi profil-specifičen runtime-dokaz. */
    runtimeProvenCount: number
    /** Podrazredov s preverjeno poslovno ustreznostjo (A+B, profileSpecific). */
    businessFitVerifiedCount: number
    /** Podrazredov, katerih profil označi zmožnost required brez dokaza (D delno). */
    requiredMissingCount: number
    /** Skupaj deklariranih predlog (forme+procesi+razširitve) po vseh profilih. */
    declaredTemplateSum: number
    /** Neocenjenih dejavnosti (brez dokazane fit ali dokumentirane podlage). */
    unassessedCount: number
  }
}

const zeroLevel = (): CoverageByLevel => ({
  specializedValidated: 0,
  validatedArchetype: 0,
  validatedBase: 0,
  partial: 0,
  uncovered: 0,
  notAssessed: 0,
})

const addLevel = (a: CoverageByLevel, b: CoverageByLevel): CoverageByLevel => ({
  specializedValidated: a.specializedValidated + b.specializedValidated,
  validatedArchetype: a.validatedArchetype + b.validatedArchetype,
  validatedBase: a.validatedBase + b.validatedBase,
  partial: a.partial + b.partial,
  uncovered: a.uncovered + b.uncovered,
  notAssessed: a.notAssessed + b.notAssessed,
})

/** Enoti konverzije row → CoverageByLevel. */
function tally(root: RowClass): { byLevel: CoverageByLevel; assessed: boolean } {
  const out = zeroLevel()
  if (root.kind === "not-assessed") {
    out.notAssessed = 1
    return { byLevel: out, assessed: false }
  }
  if (root.kind === "A") out.specializedValidated = 1
  else if (root.kind === "B") out.validatedArchetype = 1
  else if (root.kind === "C") out.validatedBase = 1
  else if (root.kind === "D") out.partial = 1
  else out.uncovered = 1
  return { byLevel: out, assessed: true }
}

/**
 * Oceni eno vrstico z uporabo deklarirane konfiguracije + runtime-evidence.
 * Pošteno: NIKOLI ne vzpostavi "C" samo zato, ker je forms==0.
 *
 * `code` je točna SKD podrazredna koda — zahteva se za podrazredno-specifično
 * dodelitev B (nikakršne profilne samodejnosti).
 */
export function classifyRow(profile: ActivityProfile, mappingSource: SkdMappingSource, isSpecialOverride: boolean, isException: boolean, code: string): RowClass {
  // E: ni ustrezne preslikave (generični fallback).
  if (mappingSource === "generic-fallback") return { kind: "E" }

  const ev = runtimeEvidenceFor(profile.id)
  const decl = declaredConfiguration(profile)

  // D-implicitne informacije izračunamo PRED A, da dokaz ne more preseči
  // manjkajočih zahtevanih zmožnosti (poštenost: D ima prednost pred A).
  // Revija šteje VSE zahtevane zmožnosti, ne le forms/workflows.
  const requiredMissing = requiredCapabilitiesMissing(profile)
  const needsWorkflows = decl.capabilities.workflows === "required"
  const needsForms = decl.capabilities.forms === "required"
  const formsOrWfMissing = (needsWorkflows && decl.workflows === 0) || (needsForms && decl.forms === 0)

  // A: izrecno specializirana (podrazred ali oddelek), DOKAZAN PROFIL-SPECIFIČNEN
  //    runtime (ev.profileSpecific === true) in NI manjkajoče zahtevane zmožnosti.
  //    Če dokaz izvira iz DRUGEGA profila, to NI A (revija P3) → not-assessed.
  if (isSpecialOverride && ev && ev.profileSpecific && !requiredMissing) return { kind: "A" }

  // D: preslikava obstaja, a zahtevane zmožnosti nimajo predlog → deklaracija
  //    zahteva runtime, ki ne obstaja, ali pa kot izjema (npr. S92).
  if (requiredMissing || formsOrWfMissing || isException) return { kind: "D" }

  // B: SAMO za točno določen podrazred, katerega poslovno jedro profil res služi
  //    (podrazredno dodeljena koda + profil-specifičen runtime-dokaz).
  //    NIKAKRŠNE samodejne promocije cele sekcije za obstoj profilnega obrazca.
  if (ev && ev.profileSpecific && validatedBaseCode(profile.id, code)) return { kind: "B" }

  // C: dokumentiran "basis zadostuje" — čista, brez skoka na runtime.
  if (isDocumentedBaseSufficient(profile)) return { kind: "C" }

  // Vse ostalo (section-default, bodisi brez runtime-evidence ali z runtime
  // zgolj za en vertikal ali brez profil-specifičnega dokaza) ostane NOT-ASSESSED.
  return { kind: "not-assessed" }
}

const profileCache = new Map<string, ActivityProfile>()
function cachedProfile(id: string): ActivityProfile {
  let p = profileCache.get(id)
  if (!p) {
    p = getProfile(id)
    profileCache.set(id, p)
  }
  return p
}

/** Grajenje celotnega registra (678 vrstic) — vsi podrazredi SKD_RECORDS ravni 5. */
export function buildCoverage(): SkdCoverageRow[] {
  const rows: SkdCoverageRow[] = []
  for (const rec of SKD_RECORDS.filter((r) => r.l === 5)) {
    const info = resolveSkdProfileInfo(rec.c)
    const p = cachedProfile(info.profileId)
    const exception = isSkdException(rec.c)
    const isSpecialOverride = info.source === "subclass-override" || info.source === "division-override"
    const klass = classifyRow(p, info.source, isSpecialOverride, exception, rec.c)
    const assessed = klass.kind !== "not-assessed"
    const decl = declaredConfiguration(p)

    rows.push({
      code: rec.c,
      sl: rec.sl,
      en: rec.en,
      section: rec.c[0],
      division: info.division ?? rec.c.slice(0, 3),
      profileId: p.id,
      profileName: p.label,
      mappingSource: info.source,
      assessmentStatus: assessed ? "assessed" : "not-assessed",
      coverageLevel: assessed ? levelToCoverage(klass) : null,
      declared: decl,
      runtimeEvidence: runtimeEvidenceFor(p.id),
      exception,
    })
  }
  return rows
}

function levelToCoverage(root: RowClass): CoverageLevel {
  if (root.kind === "not-assessed") return "partial" // ne bi smelo — not-assessed vrnemo zgoraj
  if (root.kind === "A") return "specialized-validated"
  if (root.kind === "B") return "validated-archetype"
  if (root.kind === "C") return "validated-base"
  if (root.kind === "D") return "partial"
  return "uncovered"
}

let cache: SkdCoverageRow[] | null = null
export function activityCoverage(): SkdCoverageRow[] {
  if (!cache) cache = buildCoverage()
  return cache
}

export function coverageSummary(): CoverageSummary {
  const rows = activityCoverage()
  const byProfile: Record<string, number> = {}
  const byMapping: Record<SkdMappingSource, number> = {
    "subclass-override": 0,
    "division-override": 0,
    "section-default": 0,
    "generic-fallback": 0,
  }
  const bySection: Record<string, CoverageSectionSummary> = {}

  let overall = zeroLevel()
  let assessed = 0
  let runtimeProvenCount = 0
  let businessFitVerifiedCount = 0
  let requiredMissingCount = 0
  let declaredTemplateSum = 0

  for (const r of rows) {
    const t = tally(runRowClass(r))
    overall = addLevel(overall, t.byLevel)
    if (t.assessed) assessed++
    byProfile[r.profileId] = (byProfile[r.profileId] ?? 0) + 1
    byMapping[r.mappingSource] += 1
    if (!bySection[r.section]) bySection[r.section] = { total: 0, byLevel: zeroLevel() }
    bySection[r.section].total++
    bySection[r.section].byLevel = addLevel(bySection[r.section].byLevel, t.byLevel)

    if (r.runtimeEvidence?.profileSpecific) runtimeProvenCount++
    if (r.coverageLevel === "specialized-validated" || r.coverageLevel === "validated-archetype") {
      businessFitVerifiedCount++
    }
    if (requiredCapabilitiesMissing(getProfile(r.profileId))) requiredMissingCount++
    declaredTemplateSum += r.declared.totalTemplates
  }

  return {
    classification: "SKD 2025 (SURS KLASJE)",
    version: "V1",
    total: rows.length,
    assessed,
    notAssessed: overall.notAssessed,
    byLevel: overall,
    bySection,
    byProfile,
    byMapping,
    metrics: {
      runtimeProvenCount,
      businessFitVerifiedCount,
      requiredMissingCount,
      declaredTemplateSum,
      unassessedCount: overall.notAssessed,
    },
  }
}

/** Pretvori že ocenjeno vrstico nazaj v RowClass za seštevanje. */
function runRowClass(r: SkdCoverageRow): RowClass {
  if (r.assessmentStatus === "not-assessed") return { kind: "not-assessed" }
  const mapToLevel: Record<string, CoverageLevel> = {
    "specialized-validated": "specialized-validated",
    "validated-archetype": "validated-archetype",
    "validated-base": "validated-base",
    partial: "partial",
    uncovered: "uncovered",
  }
  const key = r.coverageLevel ?? "partial"
  const value = mapToLevel[key]
  if (value === "specialized-validated") return { kind: "A" }
  if (value === "validated-archetype") return { kind: "B" }
  if (value === "validated-base") return { kind: "C" }
  if (value === "partial") return { kind: "D" }
  return { kind: "E" }
}

/** Re-exports tipa za testiranje. */
export type { SkdMappingSource }