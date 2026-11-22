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

import type { ActivityProfile, CapabilityKey } from "@/lib/profiles/types"
import { getProfile } from "@/lib/profiles/registry"
import {
  resolveSkdProfileInfo,
  isSkdException,
  type SkdMappingSource,
} from "@/lib/skd/profiles"
import { SKD_RECORDS } from "@/lib/skd/data/skd2025"
import { CAPABILITY_KEYS } from "@/lib/profiles/extensions"

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
  /** Skupno število deklariranih konfiguracijskih elementov (forme+procesi+razširitve).
   *  POZOR: to NISO le predloge — razširitve niso predloge, zato ime vsebuje "elemente". */
  totalConfigElements: number
}

/**
 * Dokaz o tem, da je zmožnost dejansko prisotna v platformi, neodvisno od
 * posameznega profila. Vsak vnos je vezan na REALNO strežniško akcijo in na
 * test, ki jo poganja — zmožnost se NE šteje za dokazano le na podlagi komentarja
 * ali zgolj na podlagi katerekoli predloge (`templ > 0` je prepovedan nadomestek).
 *
 * Ločeno od `required` deklaracije v registru: zmožnost, označena kot `required`,
 * NI vrzel natanko tedaj, ko platforma ta modul res dobavlja (je v tem naboru)
 * IN test/akcija to dokazujeta. Dokumenti in blagajna (WP-1 "eno jedro za VSE
 * dejavnosti", P2 #101 računi) so dobavljeni v jedru → nista vrzel. Dostava NIMA
 * lastnega strežniškega modula (le `recordDelivery`/prevzem v inventuri in
 * work-order rokovanju) → `required` dostava je iskrena vrzel (→ D).
 */
export const CAPABILITY_EVIDENCE: Record<
  string,
  {
    module: string
    /** Testi, ki ZARES poganjajo navedeni strežniški modul/akcijo (odprti in preverjeni). */
    evidence: string
    /**
     * Pošten obseg dokaza:
     *  - "universal" = platformni engine/modul, ki deluje za VSE dejavnosti neodvisno
     *    od ničelnosti nekega profila;
     *  - "context-limited" = modul obstaja, a citirani test poganja le knjižnični
     *    del / določeno podpot (ne celotna univerzalna dobava); ali pa dokaz velja
     *    le ob prisotnosti profilnih predlog. Pri teh zmožnostih `required` NIKAKOR
     *    ne sme biti samodejno "pokrita" zgolj iz imena datoteke (glej opombo).
     */
    scope: "universal" | "context-limited"
    /** Razlog omejitve — kaj točno test NE dokaže. */
    caveat: string
  }
> = {
  // Jedro z dobavljeno strežniško akcijo + testom, ki to akcijo zares poganja.
  appointments: {
    module: "src/app/actions/appointments.ts",
    evidence: "tests/integration/f2-3/staff-multiorg.itest.ts + tests/booking-integrity-93.test.ts",
    scope: "context-limited",
    caveat: "Nobena test datoteka NE kliče createAppointment/rescheduleAppointment (glavni termini akciji): booking-integrity-93 in ostali citirani testi le preverjajo izvorno kodo (src.slice) ali poganjajo stranske akcije (updateAppointmentStatus/recordAppointmentTip/getServicesForBooking). Polno naročanje termina ni testno poganjano → context-limited.",
  },
  workOrders: {
    module: "src/app/actions/work-orders.ts + work-order-costs.ts",
    evidence: "tests/integration/tire-service.itest.ts + tests/integration/seamstress.itest.ts + tests/work-order-costs.itest.ts",
    scope: "universal",
    caveat: "tire-service.itest poganja createWorkOrder (pravi engine work-orders.ts); seamstress.itest poganja advanceWorkOrder; work-order-costs.itest poganja izračun stroškov. Delovnonaloški tok je pokrit end-to-end.",
  },
  shop: {
    module: "src/app/actions/cart.ts + orders.ts + product-checkout.ts",
    evidence: "tests/integration/f54/f551-variant-checkout.itest.ts + tests/integration/refund-order.itest.ts + tests/integration/f51/promotions.itest.ts",
    scope: "universal",
    caveat: "f551 poganja createProductCheckoutSession (product-checkout.ts) + validateCartStock (cart.ts); refund-order.itest poganja refundOrder (orders.ts); promotions.itest poganja createProductCheckoutSession. Vsi trije moduli trgovinskega toka so pokriti end-to-end.",
  },
  services: {
    module: "src/app/actions/services.ts",
    evidence: "tests/unit/services-list-ux.test.ts",
    scope: "context-limited",
    caveat: "citiran test preverja le UX izris seznama storitev; strežniškega modula services.ts NE poganja (ni servisne akcije pod testom). Dobava je del kataloga storitev, a ne 'universal' v smislu celotne strežniške dobave.",
  },
  inventory: {
    module: "src/app/actions/inventory.ts",
    evidence: "tests/integration/stock-integrity.itest.ts",
    scope: "universal",
    caveat: "stock-integrity poganja inventurno logiko prek dejanskih akcij.",
  },
  customers: {
    module: "src/app/actions/customers.ts",
    evidence: "tests/integration/f553/customers.itest.ts + tests/integration/tire-service.itest.ts",
    scope: "universal",
    caveat: "customers.itest poganja createCustomer/updateCustomer/archiveCustomer/listCustomers/getCustomerDetail/exportCustomer/anonymize na pravi DB; tire-service.itest poganja createCustomer. Univerzalni jedrni modul, dokazan end-to-end.",
  },
  staff: {
    module: "src/app/actions/staff.ts",
    evidence: "tests/integration/f2-3/staff-multiorg.itest.ts",
    scope: "universal",
    caveat: "staff-multiorg poganja staff.ts akcije (članstvo/osebje/urniki) end-to-end prek dveh org na pravi DB; univerzalni jedrni modul.",
  },
  analytics: {
    module: "src/app/actions/dashboard.ts + analytics.ts",
    evidence: "tests/analytics-e42.test.ts",
    scope: "context-limited",
    caveat: "analytics-e42 poganja le čisto funkcijo enquiryChangeDisplay (src/lib/analytics/trends); strežniških akcij getKPIData/getRevenueChartData iz dashboard.ts/analytics.ts noben test NE poganja.",
  },
  forms: {
    module: "src/app/actions/forms.ts (skupni engine)",
    evidence: "tests/integration/f2-3/f501-materialization.itest.ts",
    scope: "context-limited",
    caveat: "f501 preverja materializacijo predlog/profilno preslikavo (SKD_PROFILE_EXCEPTIONS), ne akcije forms.ts same; formulacijska dobava potrebuje profilne predloge — prazne predloge = ni dobave.",
  },
  workflows: {
    module: "engine prek forms.ts / work-orders.ts",
    evidence: "tests/integration/f2-3/f501-materialization.itest.ts",
    scope: "context-limited",
    caveat: "workflow dobava velja LE ob materializiranih workflow-predlogah profila; zmožnost `required` brez predloge je iskrena vrzel (no-template).",
  },
  // Dokumentacija + e-računi: jedrni modul, dogazan end-to-end (documents.ts + einvoices.ts). Quotes ni pokrit.
  documents: {
    module: "src/app/actions/documents.ts + einvoices.ts + quotes.ts",
    evidence: "tests/integration/f554/documents.itest.ts + tests/integration/einvoice/einvoices.itest.ts",
    scope: "universal",
    caveat: "documents.itest poganja documents.ts (getDocumentDetail/getDocumentsOverview/listDocumentCustomers) na pravi DB; einvoices.itest poganja einvoices.ts (submitEinvoice/listEinvoices/downloadEinvoice). Jedrni dokumentni+računski tok univerzalen; posamični quotes.ts ni pokrit z izvajalnim testom.",
  },
  // Blagajna (WP-1): dobavljeno v jedru za VSE dejavnosti.
  cashRegister: {
    module: "src/app/actions/cash-register.ts + direct-sale.ts",
    evidence: "tests/integration/direct-sale.itest.ts",
    scope: "context-limited",
    caveat: "direct-sale poganja direct-sale.ts; cash-register-core.test.ts preverja le src/lib/cash-register/core (ne strežniške akcije cash-register.ts), ki tako ni testno poganjana.",
  },
}
/** Zmožnosti, ki NISO dobavljene kot univerzalni jedrni modul. */
const NON_UNIVERSAL_CAPABILITIES = new Set<string>(["delivery"])

/** Ali je zmožnost dokazano dobavljena kot univerzalni jedrni modul? */
function isPlatformDeliveredCapability(key: string): boolean {
  const ev = CAPABILITY_EVIDENCE[key as CapabilityKey]
  if (!ev || NON_UNIVERSAL_CAPABILITIES.has(key)) return false
  // Honest scope: le `universal` dokaz (strežniške akcije poganjane end-to-end
  // v pravem testu na pravi DB) sme zadostiti `required`. `context-limited`
  // (le sub-path/čista funkcija ali source-read test) NI univerzalna dobava in
  // zato `required` zveze ne sme postati `not-delivered` gap. forms/workflows
  // obravnava pred tem template-materializacija (no-template) — ta funkcija se
  // zanje NE pokliče.
  return ev.scope === "universal"
}

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
    materializedForms: false,
    materializedWorkflows: false,
    note: "engine-path (work-order E2E) — materializacija profilnih predlog NI dokazana: testi ne kličejo materializeProfileAssets",
    profileSpecific: false,
  },
  apparel: {
    serverActions: ["Seamstress / body measurements"],
    actionFiles: ["src/app/actions/seamstress.ts"],
    testFiles: ["tests/integration/seamstress.itest.ts", "e2e/d-seamstress.spec.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "dokaz iz profila seamstress (materializedForms/Workflows=false — seamstress itest PID 44 seeda workflow neposredno prek prisma.workflowDefinition.create in NE kliče materializeProfileAssets; predloge tako NISO dokazano materializirane)",
    profileSpecific: false,
  },
  seamstress: {
    serverActions: ["Seamstress / body measurements"],
    actionFiles: ["src/app/actions/seamstress.ts"],
    testFiles: ["tests/integration/seamstress.itest.ts", "e2e/d-seamstress.spec.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "dokazan je engine-path (seamstress akcije) — materializedForms/Workflows=false: itest (PID 44) seeda workflow prek seedWorkflow() → prisma.workflowDefinition.create in se ne kliče materializeProfileAssets; ročni DB-zapis NI materializacija profilnih predlog.",
    profileSpecific: true,
  },
  mehanik: {
    serverActions: ["Vehicle workshop orders"],
    actionFiles: ["src/app/actions/vehicle-workshop.ts"],
    testFiles: ["tests/integration/tire-service.itest.ts", "e2e/b-tire-service.spec.ts", "tests/work-order-*.test.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "dokaz iz profila tire-service (materializedForms/Workflows=false — tire-service itest PID 47 seeda workflow prek seedWorkflow() → prisma.workflowDefinition.create in ne kliče materializeProfileAssets)",
    profileSpecific: false,
  },
  "tire-service": {
    serverActions: ["Vehicle workshop orders"],
    actionFiles: ["src/app/actions/vehicle-workshop.ts"],
    testFiles: ["tests/integration/tire-service.itest.ts", "e2e/b-tire-service.spec.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "vulkanizersko-program: dokazan je engine-path (tire-service akcije) — materializedForms/Workflows=false: itest (PID 47) seeda workflow prek seedWorkflow() → prisma.workflowDefinition.create in se ne kliče materializeProfileAssets; ročni DB-zapis NI materializacija profilnih predlog.",
    profileSpecific: true,
  },
  beekeeping: {
    serverActions: ["Apiary / colony management"],
    actionFiles: ["src/app/actions/apiculture.ts", "src/app/actions/colony-moves.ts"],
    testFiles: ["tests/integration/beekeeping-final-validation.itest.ts", "e2e/c-beekeeping.spec.ts", "tests/integration/f2-3/colony-move-2c2.itest.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "čebelarstvo: panji + žetev (batch-production) — engine-path preverjen; materializacija profilnih predlog NI dokazana (itest ne kliče materializeProfileAssets)",
    profileSpecific: true,
  },
  "skd-a-agriculture": {
    serverActions: ["Apiary / colony management (batch-production)"],
    actionFiles: ["src/app/actions/apiculture.ts", "src/app/actions/colony-moves.ts"],
    testFiles: ["tests/integration/beekeeping-final-validation.itest.ts", "e2e/c-beekeeping.spec.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "km. sekcija nosi predvsem čebelarski runtime (ni dokaz za druge podrazrede A); materializacija NI dokazana",
    profileSpecific: false,
  },
  frizer: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts", "tests/batch-74-87.test.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "booking jedro — dokaz ni profil-specifičen za frizerja; materializacija predlog NI dokazana",
    profileSpecific: false,
  },
  beauty: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "booking jedro — dokaz ni profil-specifičen za beauty; materializacija predlog NI dokazana",
    profileSpecific: false,
  },
  massage: {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "wellness terminski tok — dokaz ni profil-specifičen za massage; materializacija predlog NI dokazana",
    profileSpecific: false,
  },
  "tattoo-studio": {
    serverActions: ["Appointment booking + client records"],
    actionFiles: ["src/app/actions/appointments.ts"],
    testFiles: ["tests/booking-addons-92.test.ts", "tests/booking-integrity-93.test.ts"],
    materializedForms: false,
    materializedWorkflows: false,
    note: "studio terminski tok — dokaz ni profil-specifičen za tattoo-studio; materializacija predlog NI dokazana",
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
  /**
   * Enotni, sinhrni vir VSEH capability ključev — `CAPABILITY_KEYS` (15 ključev)
   * iz `@/lib/profiles/extensions`, ki ga sync-lock test (extensions-e21.test.ts)
   * zaklene na dejanski `CapabilityMatrix` tip. Tako nov capability ključ ne more
   * tiho izostati iz deklaracije.
   */
  const capabilities: Record<string, string> = {}
  for (const k of CAPABILITY_KEYS) capabilities[k] = cap[k] ?? "optional"
  return {
    forms,
    workflows,
    extensions,
    capabilities,
    totalConfigElements: forms + workflows + extensions,
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
  return missingRequiredCapabilities(profile).length > 0
}

/**
 * Pravila posameznih dokazal za obravnavane zmožnosti.
 *
 * `required` NI nujno vrzel: zmožnost, ki jo jedro platforme res dobavlja
 * (glej CAPABILITY_EVIDENCE — dejanska strežniška akcija + test), že samo po
 * sebi ni vrzel. Vrzel (→ D) nastane LE kadar:
 *  - nova zmožnost `required`, ki NIMA univerzalnega modula (npr. delivery),
 *  - ali `forms`/`workflows` `required`, ki nimata prijavljenih predlog
 *    (deklaracija brez materializacije).
 * `optional` nikoli ne ustvarja vrzeli.
 */
export function missingRequiredCapabilities(profile: ActivityProfile): Array<{ key: string; reason: "not-delivered" | "no-template" }> {
  const cap = (profile.capabilities ?? {}) as unknown as Record<string, "required" | "optional" | "disabled" | undefined>
  const missing: Array<{ key: string; reason: "not-delivered" | "no-template" }> = []
  for (const key of ASSESSED_CAPABILITIES) {
    if (cap[key] !== "required") continue
    // forms / workflows: zahtevani, a brez nobene predloge → vrzel (deklaracija brez vsebine).
    if (key === "forms" || key === "workflows") {
      const templateCount = key === "forms" ? (profile.forms ?? []).length : (profile.workflows ?? []).length
      if (templateCount === 0) missing.push({ key, reason: "no-template" })
      // z vsaj eno predlogo je zmožnost POKRITA (template-materializacija) —
      // forms/workflows se zato NIKOLI ne ocenjujejo po isPlatformDeliveredCapability
      // (njihov scope=context-limited nikakor ne sme postati vrzel, če predloga obstaja).
      continue
    }
    // Ostale zahtevane zmožnosti: pokrite ravno tedaj, ko jih jedro res dobavlja.
    // `templ > 0` (katerakoli predloga) NIKOLI ni del dokaza possible zmožnosti.
    if (isPlatformDeliveredCapability(key)) continue
    missing.push({ key, reason: "not-delivered" })
  }
  return missing
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
    /** Skupaj deklariranih KONFIGURACIJSKIH ELEMENTOV (forme+procesi+razširitve) — unique po profilih. */
    uniqueDeclaredConfigElementCount: number
    /** Skupaj deklariranih KONFIGURACIJSKIH ELEMENTOV (forme+procesi+razširitve) — weighted po SKD-vrsticah. */
    weightedDeclaredConfigElementCount: number
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
  let weightedDeclaredConfigElementCount = 0
  const uniqueProfiles = new Set<string>()
  let uniqueDeclaredConfigElementCount = 0

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
    // Uteženo: vsaka SKD vrstica, ki uporablja profil, prišteje njegove elemente.
    weightedDeclaredConfigElementCount += r.declared.totalConfigElements
    // Unikatno: vsak profil šteje samo enkrat, ne glede na število vrstic.
    if (!uniqueProfiles.has(r.profileId)) {
      uniqueProfiles.add(r.profileId)
      uniqueDeclaredConfigElementCount += r.declared.totalConfigElements
    }
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
      uniqueDeclaredConfigElementCount,
      weightedDeclaredConfigElementCount,
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