// ============================================================
// EXTENSION CONTRACT (EPIC #1 §13) — standardized way to add
// industry-specialized entities/processes WITHOUT duplicating
// or modifying the universal core (customers, orders, forms,
// workflows, payments). Extensions are declarative: they define
// capabilities, entities and form needs; the universal core
// materializes and renders them (Phase 4+ UI).
// Client-safe: NO server-only imports.
// ============================================================

import type { CapabilityKey, ProfileFieldDef } from "./types"

export interface ExtensionEntity {
  key: string // stable entity key, e.g. "vehicle"
  name: string
  description: string
  /** Declarative fields rendered by the universal entity UI (Phase 4+). */
  fields: ProfileFieldDef[]
  /**
   * Faza 2C-2: append-only zapis zgodovine (dogodki, ki spreminjajo trenutno
   * stanje). Generični CRUD (create/update/delete) tako entiteto ZAVRNE z
   * APPEND_ONLY; dogodki se ustvarjajo izključno prek namenske strežniške
   * akcije. Univerzalni vzorec za zgodovinske dogodke vseh dejavnosti.
   */
  appendOnly?: boolean
}

export interface ExtensionDefinition {
  id: string
  name: string
  description: string
  version: number
  /** Which universal capabilities this extension builds upon. */
  capabilities: string[]
  /** Specialized entities contributed by this extension. */
  entities: ExtensionEntity[]
}

// ------------------------------------------------------------
// Typed capability dependencies (E2-1): an extension's
// `capabilities` array may only reference REAL universal
// capability keys — enforced by this tuple (compile-time via
// `satisfies`, runtime via validateExtensions v ./validate.ts, ki teče
// v testih — tests/profiles/registry-validation.test.ts).
// ------------------------------------------------------------
export const CAPABILITY_KEYS = [
  "appointments",
  "workOrders",
  "shop",
  "services",
  "inventory",
  "customers",
  "staff",
  "analytics",
  "reviews",
  "forms",
  "workflows",
  "documents",
  "delivery",
  "walkIn",
  "cashRegister",
] as const satisfies readonly CapabilityKey[]

// ------------------------------------------------------------
// First-generation extensions
// ------------------------------------------------------------

/** Vehicle registry for workshops / tire services (§21 tire service scenario). */
const vehicleWorkshop: ExtensionDefinition = {
  id: "vehicle-workshop",
  name: "Vozila in vulkanizerija",
  description:
    "Evidenca vozil strank z registrskimi podatki in dimenzijami gum; delovni nalogi se vežejo na vozilo.",
  version: 1,
  capabilities: ["customers", "workOrders", "inventory"],
  entities: [
    {
      key: "vehicle",
      name: "Vozilo",
      description: "Vozilo stranke z registrsko oznako in tehničnimi podatki.",
      fields: [
        { key: "license_plate", label: "Registrska oznaka", type: "text", required: true },
        { key: "brand_model", label: "Znamka in model", type: "text", required: true },
        { key: "year", label: "Leto proizvodnje", type: "number", required: false },
        { key: "odometer_km", label: "Kilometri", type: "number", required: false, unit: "km" },
        { key: "vin", label: "VIN številka", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "tire_set",
      name: "Komplet gum",
      description: "Dimenzije in stanje gum vozila (sezonska shranjevanje).",
      fields: [
        { key: "width_mm", label: "Širina", type: "number", required: true, unit: "mm" },
        { key: "profile_pct", label: "Profil", type: "number", required: true, unit: "%" },
        { key: "diameter_in", label: "Premer platišča", type: "number", required: true, unit: "palcev" },
        { key: "season", label: "Sezona", type: "select", required: true, options: ["Poletne", "Zimske", "Celoletne"] },
        { key: "tread_mm", label: "Globina tekalne plasti", type: "number", required: false, unit: "mm" },
      ],
    },
  ],
}

/** Body measurements for tailoring/seamstress (§21 seamstress scenario). */
const bodyMeasurements: ExtensionDefinition = {
  id: "body-measurements",
  name: "Mere telesa",
  description:
    "Shranjevanje mer strank za šivanje po meri in spremembe; mere se vežejo na naročilo in zgodovino stranke.",
  version: 1,
  capabilities: ["customers", "workOrders"],
  entities: [
    {
      key: "measurement_set",
      name: "Merilni list",
      description: "Sklop mer za eno stranko (posodabljan ob vsaki meritvi).",
      fields: [
        { key: "chest_cm", label: "Obseg prsi", type: "number", required: false, unit: "cm" },
        { key: "waist_cm", label: "Obseg pasu", type: "number", required: false, unit: "cm" },
        { key: "hips_cm", label: "Obseg bokov", type: "number", required: false, unit: "cm" },
        { key: "shoulder_cm", label: "Širina ramen", type: "number", required: false, unit: "cm" },
        { key: "sleeve_cm", label: "Dolžina rokava", type: "number", required: false, unit: "cm" },
        { key: "inseam_cm", label: "Notranja dolžina hlač", type: "number", required: false, unit: "cm" },
        { key: "height_cm", label: "Višina", type: "number", required: false, unit: "cm" },
      ],
    },
  ],
}

/**
 * ŠIVILJSTVO (2D-2B) — merilni listi z datumom, povezavo na naročilo in
 * NEDOTAKNJLJIVO zgodovino. Vsaka nova meritev = NOV `measurement` zapis
 * (appendOnly → create-only, brez update/delete), tako da zgodovina meritev
 * stranke nikoli ni prepisana. Zapisi so vezani na stranko prek
 * `ExtensionRecord.customerId` in na delovni nalog prek `order_ref` (+
 * `__workOrderIds` na zapisu).
 */
const seamstressMeasurements: ExtensionDefinition = {
  id: "seamstress-measurements",
  name: "Meritve strank",
  description:
    "Merilni listi za šivanje po meri in spremembe; vsaka meritev je nov zapis z datumom (append-only zgodovina), vezan na stranko in naročilo.",
  version: 1,
  capabilities: ["customers", "workOrders"],
  entities: [
    {
      key: "measurement",
      name: "Merilni list",
      description: "Ena meritev stranke (datum, mere v cm, povezava na naročilo). Append-only.",
      appendOnly: true,
      fields: [
        { key: "measured_at", label: "Datum meritve", type: "date", required: true },
        { key: "chest_cm", label: "Obseg prsi", type: "number", required: false, unit: "cm" },
        { key: "waist_cm", label: "Obseg pasu", type: "number", required: false, unit: "cm" },
        { key: "hips_cm", label: "Obseg bokov", type: "number", required: false, unit: "cm" },
        { key: "shoulder_cm", label: "Širina ramen", type: "number", required: false, unit: "cm" },
        { key: "sleeve_cm", label: "Dolžina rokava", type: "number", required: false, unit: "cm" },
        { key: "inseam_cm", label: "Notranja dolžina hlač", type: "number", required: false, unit: "cm" },
        { key: "height_cm", label: "Višina", type: "number", required: false, unit: "cm" },
        { key: "order_ref", label: "Povezano naročilo / delovni nalog", type: "text", required: false },
        { key: "by_staff", label: "Meril", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Batchs/lots and harvest records for producers (§21 beekeeping scenario). */
const batchProduction: ExtensionDefinition = {
  id: "batch-production",
  name: "Serije in žetev",
  description:
    "Evidence žetve/produkcije, serije (loti) in povezava na zaloge izdelkov — brez rezervacij in terminov.",
  version: 1,
  capabilities: ["inventory", "shop"],
  entities: [
    {
      key: "batch",
      name: "Serija / lot",
      description: "Serija proizvodnje z datumom, količino in sledljivostjo.",
      fields: [
        { key: "batch_code", label: "Oznaka serije", type: "text", required: true },
        { key: "production_date", label: "Datum proizvodnje/žetve", type: "date", required: true },
        { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
        { key: "product_type", label: "Vrsta (npr. med)", type: "select", required: true, options: ["Cvetlični med", "Lipov med", "Gozdni med", "Akačijski med", "Drug izdelek"] },
        { key: "apiary", label: "Panjska postaja / panj", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// BEEKEEPING — apiary & hive management (REFERENCE PHASE 1)
// Specialized entity registries for a beekeeper, built entirely
// on the UNIVERSAL extension system (§13): no schema change, no
// per-industry code. Fields/types are the universal locked set
// (text|textarea|number|date|select|checkbox); cross-entity
// relationships are expressed via shared label/select fields so
// a beekeeper can relate apiary → hive → colony → records by the
// same stable names, which the universal UI renders immediately.
// ------------------------------------------------------------
const beeApiary: ExtensionDefinition = {
  id: "bee-apiary",
  name: "Čebelnjaki in panji",
  description:
    "Čebelarske evidence: panjske postaje/čebelnjaki, panji, družine, pregledi, zdravljenje, hranjenje, matice/rojenje, opravila in pridelek medu — povezani z zalogami in trgovino.",
  version: 1,
  capabilities: ["inventory", "customers"],
  entities: [
    {
      key: "apiary",
      name: "Panjska postaja",
      description: "Lokacija/čebelnjak s številom panjev in podatki za sledenje.",
      fields: [
        { key: "name", label: "Naziv postaje", type: "text", required: true },
        { key: "location", label: "Kraj / lokacija", type: "text", required: false },
        { key: "coordinates", label: "Koordinate (G-K / DMS)", type: "text", required: false },
        { key: "hive_count", label: "Število panjev", type: "number", required: false, unit: "panjev" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "hive",
      name: "Panj",
      description: "Posamezen panj z vrsto, čiščeno močjo in umestitvijo v panjsko postajo.",
      fields: [
        { key: "label", label: "Oznaka panja", type: "text", required: true },
        { key: "apiary", label: "Panjska postaja", type: "text", required: false },
        { key: "apiary_ref", label: "Panjska postaja (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "apiary" } },
        { key: "hive_type", label: "Vrsta panja", type: "select", required: true, options: ["AŽ", "Langstroth", "Dadant", "POŠ / Karnijski", "Drugo"] },
        { key: "strength", label: "Moč družine", type: "select", required: false, options: ["Močna", "Srednja", "Šibka"] },
        { key: "installed_date", label: "Datum namestitve", type: "date", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "colony",
      name: "Čebelja družina",
      description: "Družina v panju s starostjo matice in zdravstvenim stanjem.",
      fields: [
        { key: "label", label: "Oznaka družine", type: "text", required: true },
        { key: "hive", label: "Panj", type: "text", required: false },
        { key: "hive_ref", label: "Panj (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "hive" } },
        { key: "queen_age_years", label: "Starost matice", type: "number", required: false, unit: "leta" },
        { key: "health_status", label: "Zdravstveno stanje", type: "select", required: false, options: ["Zdrava", "Pod nadzorom", "Oslabljena", "Bolezensko stanje"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "inspection",
      name: "Pregled družine",
      description: "Redni pregled z ugotovitvami, hranjenjem in znaki rojenja.",
      fields: [
        { key: "inspection_date", label: "Datum pregleda", type: "date", required: true },
        { key: "colony", label: "Čebelja družina", type: "text", required: true },
        { key: "colony_ref", label: "Čebelja družina (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "findings", label: "Ugotovitve", type: "select", required: false, options: ["V redu", "Potrebno hranjenje", "Potrebno zdravljenje", "Znaki rojenja"] },
        { key: "feeding", label: "Hranjenje opravljeno", type: "checkbox", required: false },
        { key: "queen_seen", label: "Matica opažena", type: "checkbox", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "treatment",
      name: "Zdravljenje",
      description: "Zdravljenje/preventiva z navedbo sredstva in datumom — za sledenje varnostnim intervalom.",
      fields: [
        { key: "treatment_date", label: "Datum", type: "date", required: true },
        { key: "colony", label: "Čebelja družina", type: "text", required: false },
        { key: "colony_ref", label: "Čebelja družina (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "reason", label: "Razlog", type: "select", required: false, options: ["Varooza", "Nosema", "Preventiva", "Ostalo"] },
        { key: "treatment_type", label: "Vrsta/način", type: "text", required: false },
        { key: "substance", label: "Sredstvo", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "feeding",
      name: "Hranjenje in oskrba",
      description: "Zimsko/spomladansko hranjenje po družinah s količino in vrsto.",
      fields: [
        { key: "feed_date", label: "Datum", type: "date", required: true },
        { key: "colony", label: "Čebelja družina", type: "text", required: false },
        { key: "colony_ref", label: "Čebelja družina (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "feed_type", label: "Vrsta hrane", type: "select", required: false, options: ["Sladkorni sirup", "Mošt", "Pogača", "Suhi sladkor"] },
        { key: "amount_kg", label: "Količina", type: "number", required: false, unit: "kg" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "queen_management",
      name: "Matice in rojenje",
      description: "Zamenjava/vzgoja matic, presajanje in evidentiranje rojenja.",
      fields: [
        { key: "event_date", label: "Datum", type: "date", required: true },
        { key: "colony", label: "Čebelja družina", type: "text", required: false },
        { key: "colony_ref", label: "Čebelja družina (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "action", label: "Dejanje", type: "select", required: false, options: ["Zamenjava matice", "Vzgoja nove", "Presaditev", "Združitev"] },
        { key: "queen_age_years", label: "Starost matice", type: "number", required: false, unit: "leta" },
        { key: "swarmed", label: "Rojenje zaznano", type: "checkbox", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "task",
      name: "Opravilo",
      description: "Načrtovano ali opravljeno delo na panju/postaji (odtegovanje, čiščenje, prenos).",
      fields: [
        { key: "task_date", label: "Datum", type: "date", required: true },
        { key: "task_type", label: "Vrsta", type: "select", required: false, options: ["Pregled", "Odtegovanje", "Namestitev", "Čiščenje", "Prenos", "Ostalo"] },
        { key: "target", label: "Panj / postaja", type: "text", required: false },
        { key: "colony_ref", label: "Čebelja družina (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "target_ref", label: "Tarča (postaja / panj / družina)", type: "entityReference", required: false, referenceTo: [
          { extensionId: "bee-apiary", entityKey: "apiary" },
          { extensionId: "bee-apiary", entityKey: "hive" },
          { extensionId: "bee-apiary", entityKey: "colony" },
        ] },
        { key: "completed", label: "Opravljeno", type: "checkbox", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "harvest",
      name: "Pridelek medu",
      description: "Količina pridelka po datumih, postaji in vrsti medu — povezljiva z zalogo in serijami.",
      fields: [
        { key: "harvest_date", label: "Datum žetve", type: "date", required: true },
        { key: "apiary", label: "Panjska postaja", type: "text", required: false },
        { key: "apiary_ref", label: "Panjska postaja (izberi)", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "apiary" } },
        { key: "honey_type", label: "Vrsta medu", type: "select", required: true, options: ["Cvetlični med", "Lipov med", "Gozdni med", "Akačijski med", "Drug med"] },
        { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
        { key: "hives_count", label: "Število panjev", type: "number", required: false, unit: "panjev" },
        { key: "product_reference", label: "Serija / izdelek", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "colony_move",
      name: "Selitev družine",
      description:
        "Zgodovinski dogodek selitve čebelje družine med panji — append-only (zaščiten strežniško). Univerzalni vzorec: dogodek, ki spreminja trenutno stanje zapisa.",
      appendOnly: true,
      fields: [
        { key: "colony_ref", label: "Čebelja družina", type: "entityReference", required: true, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
        { key: "from_hive_ref", label: "Iz panja", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "hive" } },
        { key: "to_hive_ref", label: "V panj", type: "entityReference", required: true, referenceTo: { extensionId: "bee-apiary", entityKey: "hive" } },
        { key: "moved_at", label: "Datum selitve", type: "text", required: false },
        { key: "recorded_at", label: "Zabeleženo", type: "text", required: false },
        { key: "reason", label: "Razlog", type: "textarea", required: false },
        { key: "performed_by", label: "Izvedel (id)", type: "text", required: false },
        { key: "baseline", label: "Začetni zapis", type: "checkbox", required: false },
        { key: "origin_unknown", label: "Izvor neznan", type: "checkbox", required: false },
        { key: "is_correction", label: "Korekcija", type: "checkbox", required: false },
        { key: "corrects_ref", label: "Popravlja dogodek (id)", type: "text", required: false },
        { key: "correction_reason", label: "Razlog popravka", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// Second-generation capability extensions (E2-1) — declared
// WITHOUT runtime behavior; profiles enable them only when a
// phase ships the matching runtime (E2-2 suppliers/inventory,
// E2-3 projects, …). No existing profile references them, so
// every tenant keeps today's experience (default disabled).
// ------------------------------------------------------------

/** Projects and tasks for multi-day jobs (photographer, cleaner, …). */
const projects: ExtensionDefinition = {
  id: "projects",
  name: "Projekti in naloge",
  description:
    "Večdnevski posli in projekti z nalogami, roki in odgovornimi — za fotografije, čistilne servise in druga dela, ki niso enkratni termini.",
  version: 1,
  capabilities: ["workOrders", "customers"],
  entities: [
    {
      key: "project",
      name: "Projekt",
      description: "Projekt/posel z začetkom, rokom, statusom in proračunom.",
      fields: [
        { key: "name", label: "Naziv projekta", type: "text", required: true },
        { key: "start_date", label: "Začetek", type: "date", required: false },
        { key: "deadline", label: "Rok izvedbe", type: "date", required: false },
        { key: "status", label: "Status", type: "select", required: true, options: ["Načrtovanje", "V teku", "Zaključen", "Preklican"] },
        { key: "budget_eur", label: "Proračun", type: "number", required: false, unit: "EUR" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "project_task",
      name: "Naloga",
      description: "Naloga znotraj projekta z odgovorno osebo in rokom.",
      fields: [
        { key: "title", label: "Naslov naloge", type: "text", required: true },
        { key: "status", label: "Status", type: "select", required: true, options: ["Odprto", "V teku", "Zaključeno"] },
        { key: "due_date", label: "Rok", type: "date", required: false },
        { key: "assignee", label: "Odgovorna oseba", type: "text", required: false },
        { key: "hours_est", label: "Predvidene ure", type: "number", required: false, unit: "h" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Multiple business locations under one tenant. */
const multiLocation: ExtensionDefinition = {
  id: "multi-location",
  name: "Več lokacij",
  description:
    "Evidenca poslovalnic z naslovi, kontakti in delovnim časom — termini, naročila in stranke se lahko vežejo na lokacijo.",
  version: 1,
  capabilities: ["customers", "appointments"],
  entities: [
    {
      key: "location",
      name: "Lokacija",
      description: "Poslovalnica/delovišče z naslovom in kontaktnimi podatki.",
      fields: [
        { key: "name", label: "Naziv lokacije", type: "text", required: true },
        { key: "address", label: "Naslov", type: "text", required: true },
        { key: "city", label: "Kraj", type: "text", required: true },
        { key: "postal_code", label: "Poštna številka", type: "text", required: false },
        { key: "phone", label: "Telefon", type: "text", required: false },
        { key: "opening_hours", label: "Delovni čas", type: "text", required: false },
        { key: "is_primary", label: "Primarna lokacija", type: "checkbox", required: false },
      ],
    },
  ],
}

/** Customer memberships / recurring revenue plans. */
const memberships: ExtensionDefinition = {
  id: "memberships",
  name: "Članstva in paketi strank",
  description:
    "Ponavljanji prihodki: članski paketi, karte in naročnine strank z veljavnostjo in statusom.",
  version: 1,
  capabilities: ["customers", "shop"],
  entities: [
    {
      key: "membership_plan",
      name: "Paket članstva",
      description: "Definicija paketa: cena, obdobje in ugodnosti.",
      fields: [
        { key: "name", label: "Naziv paketa", type: "text", required: true },
        { key: "price_eur", label: "Cena", type: "number", required: true, unit: "EUR" },
        { key: "interval", label: "Obdobje", type: "select", required: true, options: ["Mesec", "Leto"] },
        { key: "benefits", label: "Ugodnosti", type: "textarea", required: false },
        { key: "is_active", label: "Aktiven za prodajo", type: "checkbox", required: false },
      ],
    },
    {
      key: "membership",
      name: "Članstvo stranke",
      description: "Aktivno članstvo stranke z začetkom, koncem in statusom.",
      fields: [
        { key: "member_name", label: "Stranka", type: "text", required: true },
        { key: "plan_name", label: "Paket", type: "text", required: true },
        { key: "start_date", label: "Začetek", type: "date", required: true },
        { key: "end_date", label: "Konec veljavnosti", type: "date", required: false },
        { key: "status", label: "Status", type: "select", required: true, options: ["Aktivno", "Zaključeno", "Preklicano"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Suppliers for goods ordering and delivery tracking. */
const suppliers: ExtensionDefinition = {
  id: "suppliers",
  name: "Dobavitelji",
  description:
    "Evidence dobaviteljev za naročanje blaga in sledenje dobavam; povezava z gibom zaloge pride z inventarnim runtimeom (E2-2).",
  version: 1,
  capabilities: ["inventory"],
  entities: [
    {
      key: "supplier",
      name: "Dobavitelj",
      description: "Dobavitelj blaga s kontaktnimi podatki.",
      fields: [
        { key: "name", label: "Naziv", type: "text", required: true },
        { key: "contact_person", label: "Kontaktna oseba", type: "text", required: false },
        { key: "email", label: "E-pošta", type: "text", required: false },
        { key: "phone", label: "Telefon", type: "text", required: false },
        { key: "tax_number", label: "Davčna številka", type: "text", required: false },
        { key: "payment_terms", label: "Pogoji plačila", type: "text", required: false },
        { key: "address", label: "Naslov", type: "textarea", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Purchase orders and receiving — full procurement chain. */
const purchasing: ExtensionDefinition = {
  id: "purchasing",
  name: "Nabavno poslovanje",
  description:
    "Nabavni nalogi, prejem blaga in sleditev dobavam; veriga Dobavitelj → Nabavni nalog → Prejem → Zaloga.",
  version: 1,
  capabilities: ["inventory", "documents"],
  entities: [
    {
      key: "purchase_order",
      name: "Nabavni nalog",
      description: "Naročilo blaga dobavitelju s postavkami, statusom in datumom dobave.",
      fields: [
        { key: "order_number", label: "Številka naloga", type: "text", required: true },
        { key: "supplier_name", label: "Dobavitelj", type: "text", required: true },
        { key: "order_date", label: "Datum naročila", type: "date", required: true },
        { key: "expected_delivery_date", label: "Pričakovana dobava", type: "date", required: false },
        { key: "status", label: "Status", type: "select", required: true, options: ["Osnutek", "Poslano", "Delno prejeto", "Prejeto", "Preklicano"] },
        { key: "total_amount", label: "Skupni znesek", type: "number", required: false, unit: "EUR" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Work order labor tracking — hours per employee, cost calculation. */
const workOrderLabor: ExtensionDefinition = {
  id: "work-order-labor",
  name: "Delovni čas",
  description:
    "Beleženje delovnega časa na delovnem nalogu po zaposlenem; izračun dejanskih stroškov dela.",
  version: 1,
  capabilities: ["workOrders"],
  entities: [
    {
      key: "work_order_labor",
      name: "Vnos delovnega časa",
      description: "En vnos delovnega časa na delovnem nalogu (ure, postavček, opis).",
      fields: [
        { key: "work_order_number", label: "Številka delovnega naloga", type: "text", required: true },
        { key: "staff_name", label: "Izvajalec", type: "text", required: true },
        { key: "hours", label: "Ure", type: "number", required: true, unit: "h" },
        { key: "hourly_rate", label: "Urni postavček", type: "number", required: false, unit: "EUR" },
        { key: "total_cost", label: "Skupni strošek", type: "number", required: false, unit: "EUR" },
        { key: "work_date", label: "Datum dela", type: "date", required: true },
        { key: "description", label: "Opis dela", type: "textarea", required: false },
      ],
    },
  ],
}

/** Delivery zones and methods giving the `delivery` capability runtime shape. */
const deliveryRuntime: ExtensionDefinition = {
  id: "delivery-runtime",
  name: "Dostava — cone in načini",
  description:
    "Dostavne cone (poštne številke, pristojbina, brezplačno nad zneskom) in načini prevzema/dostave za spletno trgovino.",
  version: 1,
  capabilities: ["shop", "delivery"],
  entities: [
    {
      key: "delivery_zone",
      name: "Dostavna cona",
      description: "Cona po poštnih številkah s pristojbino in pogoji.",
      fields: [
        { key: "name", label: "Naziv cone", type: "text", required: true },
        { key: "postal_codes", label: "Poštne številke", type: "text", required: true, placeholder: "npr. 1000, 1230, 1291" },
        { key: "fee_eur", label: "Pristojbina", type: "number", required: true, unit: "EUR" },
        { key: "free_over_eur", label: "Brezplačno nad", type: "number", required: false, unit: "EUR" },
        { key: "eta_days", label: "Čas dostave", type: "number", required: false, unit: "dni" },
      ],
    },
    {
      key: "delivery_method",
      name: "Način dostave/prevzema",
      description: "Način, ki ga stranka izbere pri naročilu.",
      fields: [
        { key: "name", label: "Naziv", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Pošta/kurir", "Osebni prevzem", "Lastni dostavnik"] },
        { key: "price_eur", label: "Cena", type: "number", required: false, unit: "EUR" },
        { key: "is_active", label: "Aktivno", type: "checkbox", required: false },
      ],
    },
  ],
}

/** Rooms/chairs/bays as bookable resources for appointment businesses. */
const workspaceResources: ExtensionDefinition = {
  id: "workspace-resources",
  name: "Prostori in viri",
  description:
    "Stolčki, sobice in delovne postaje kot viri, na katere se vežejo termini ali delovni nalogi.",
  version: 1,
  capabilities: ["appointments", "workOrders"],
  entities: [
    {
      key: "workspace",
      name: "Delovni vir",
      description: "Fizični vir (stol, soba, plato) s kapaciteto 1 termin naenkrat.",
      fields: [
        { key: "name", label: "Naziv vira", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Stol", "Soba", "Delovna postaja", "Dvigalo", "Drug"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// Registry — validated at module load (fail fast, not silently).
// ------------------------------------------------------------

/** Quotes/invoices/documents (documents capability, Phase 4+). */
const documents: ExtensionDefinition = {
  id: "documents",
  name: "Ponudbe, predračuni in računi",
  description:
    "Poslovni dokumenti: ponudbe, predračuni, računi in dobavnice s številčenjem, statusi in izpisom — za dejavnosti, ki delajo na dokumente (delovni nalogi, projektna dela).",
  version: 1,
  capabilities: ["documents"],
  entities: [
    {
      key: "document",
      name: "Poslovni dokument",
      description: "Ponudba/predračun/račun z zneskom, statusom in številko.",
      fields: [
        { key: "number", label: "Številka", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Ponudba", "Predračun", "Račun", "Dobavnica"] },
        { key: "amount_eur", label: "Znesek", type: "number", required: false, unit: "EUR" },
        { key: "status", label: "Status", type: "select", required: true, options: ["Osnutek", "Poslano", "Potrjeno", "Plačano", "Preklicano"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

const EXTENSION_LIST: ExtensionDefinition[] = [
  vehicleWorkshop,
  bodyMeasurements,
  seamstressMeasurements,
  batchProduction,
  beeApiary,
  workspaceResources,
  // E2-1 — declared capability extensions (no profile enables them yet):
  projects,
  multiLocation,
  memberships,
  suppliers,
  purchasing,
  workOrderLabor,
  deliveryRuntime,
  documents,
]

// ------------------------------------------------------------
// Index + accessors
//
// Zod validacija (sheme + validateExtensions) je v ./validate.ts in
// teče v testih; tukaj je le še zložitev zapisa po id.
// ------------------------------------------------------------

function indexExtensions(list: ExtensionDefinition[]): Record<string, ExtensionDefinition> {
  const out: Record<string, ExtensionDefinition> = {}
  for (const ext of list) {
    if (out[ext.id]) throw new Error(`[profiles] Duplicate extension id: ${ext.id}`)
    out[ext.id] = ext
  }
  return out
}

export const EXTENSIONS: Record<string, ExtensionDefinition> = indexExtensions(EXTENSION_LIST)

export function getExtension(id: string): ExtensionDefinition | undefined {
  return EXTENSIONS[id]
}
