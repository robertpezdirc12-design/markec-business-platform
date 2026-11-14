// ============================================================
// PAMETNI PREDLOGI (2D-1M) — data-derived, org-scoped, non-blocking.
//
// Replaces the "forced guided install" idea: the dashboard no longer
// forces a first-run wizard — instead it offers a SMALL number of
// smart, contextual next-actions derived from the tenant's REAL
// business data on every render. Nothing is stored for completion;
// a suggestion disappears the moment its precondition flips true.
//
// Contract:
//   • Pure + client-safe (no server imports) — fully unit-testable.
//   • Org-scoped by construction: callers pass ONLY counts for the
//     ACTIVE organization (never a cross-org query result).
//   • Capability-aware: a suggestion whose module the profile disables
//     is never offered.
//   • Beekeeping chain: apiary → hive → colony → inspection → harvest
//     (each suggestion only appears when the previous is satisfied).
//   • Other activities: falls back to profile-agnostic suggestions
//     (published site, first product/order) unless the vertical has a
//     richer chain definition.
// ============================================================

export type SuggestionKey =
  | "bee.apiary"
  | "bee.hive"
  | "bee.colony"
  | "bee.inspection"
  | "bee.harvest"
  | "ws.vehicle"
  | "ws.tireSet"
  | "ws.workOrder"
  | "ws.parts"
  | "seamstress.measurement"
  | "seamstress.inquiry"
  | "seamstress.production"
  | "seamstress.materials"
  | "seamstress.delivery"
  | "publish"
  | "firstProduct"
  | "firstOrder"

export interface Suggestion {
  key: SuggestionKey
  title: string
  description: string
  href: string
  /** Beekeeping record URL param (a new record form), if applicable. */
  newRecordHref?: string
}

export interface SmartSuggestionInput {
  /** Active org (org-scoped counts only). */
  counts: {
    apiary: number
    hive: number
    colony: number
    inspection: number
    harvest: number
    products: number
    orders: number
    /** Tire-service / workshop. Optional for backward-compat call sites. */
    vehicles?: number
    tireSets?: number
    workOrders?: number
    partOrders?: number
    /** Sewing / seamstress. Optional for backward-compat call sites. */
    measurements?: number
    materialMovements?: number
    readyForDelivery?: number
  }
  published: boolean
  /** True when the active profile enables the beekeeping extension. */
  beekeeping: boolean
  /** True when the active profile enables vehicle-workshop (tire-service). */
  tireService: boolean
  /** True when the active profile enables seamstress measurements. */
  seamstress?: boolean
  /** True when the active profile can sell products (orders). */
  shopCapable: boolean
  /** Max suggestions to return (dashboard shows 3–5). */
  limit?: number
}

export function buildSmartSuggestions(input: SmartSuggestionInput): Suggestion[] {
  const out: Suggestion[] = []
  const L = input.limit ?? 4
  const c = input.counts
  const cVeh = c.vehicles ?? 0
  const cTire = c.tireSets ?? 0
  const cWo = c.workOrders ?? 0
  const cParts = c.partOrders ?? 0

  if (input.beekeeping) {
    // Beekeeping chain — only the next undone step in the natural flow.
    if (c.apiary === 0) {
      out.push({
        key: "bee.apiary",
        title: "Dodajte panjsko postajo",
        description: "Začnite z lokacijo čebelnjaka — postaja je prvi korak.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#apiary-new",
      })
    } else if (c.hive === 0) {
      out.push({
        key: "bee.hive",
        title: "Vnesite panj",
        description: "Postajo imate — dodajte vsaj en panj.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#hive-new",
      })
    } else if (c.colony === 0) {
      out.push({
        key: "bee.colony",
        title: "Evidentirajte čebeljo družino",
        description: "Panj imate — zapišite družino, ki ga naseljuje.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#colony-new",
      })
    } else if (c.inspection === 0) {
      out.push({
        key: "bee.inspection",
        title: "Zabeležite prvi pregled",
        description: "Družino imate — vsak pregled se shrani v evidenco.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#inspection-new",
      })
    } else if (c.harvest === 0) {
      out.push({
        key: "bee.harvest",
        title: "Zabeležite pridelek medu",
        description: "Po resni opaženi družini zapišite količino pridelka.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#harvest-new",
      })
    }
    if (out.length < L) {
      out.push({
        key: "publish",
        title: "Objavite svojo stran",
        description: "Objavljena stran je prvi javni vstop do naročil.",
        href: "/dashboard/settings",
      })
    }
  } else if (input.tireService) {
    // Vulkanizer / delavnica vozil — naravna veriga dela.
    if (cVeh === 0) {
      out.push({
        key: "ws.vehicle",
        title: "Vnesite prvo vozilo",
        description: "Začnite z evidenco vozila stranke (registrska, znamka/model).",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#vehicle-new",
      })
    } else if (cTire === 0) {
      out.push({
        key: "ws.tireSet",
        title: "Dodajte komplet pnevmatik",
        description: "Vozilo imate — zabeležite dimenzije in sezono kompleta gum.",
        href: "/dashboard/records",
        newRecordHref: "/dashboard/records#tire_set-new",
      })
    } else if (cWo === 0) {
      out.push({
        key: "ws.workOrder",
        title: "Ustvarite prvi delovni nalog",
        description: "Nalog poveže vozilo s postopkom (menjava gum, servis).",
        href: "/dashboard/work-orders",
      })
    } else if (cParts === 0) {
      out.push({
        key: "ws.parts",
        title: "Evidentirajte porabo delov",
        description: "Zapišite material/opremo, porabljeno na delovnem nalogu.",
        href: "/dashboard/tire-service",
      })
    }
    if (out.length < L) {
      out.push({
        key: "publish",
        title: "Objavite svojo stran",
        description: "Objavljena stran je prvi javni vstop do rezervacij menjav.",
        href: "/dashboard/settings",
      })
    }
  } else if (input.seamstress) {
    // Šivilja — naravna veriga dela: meritve → povpraševanje/naročilo → izdelava → poraba → predaja.
    const cMeas = c.measurements ?? 0
    const cWo = c.workOrders ?? 0
    const cMat = c.materialMovements ?? 0
    const cDel = c.readyForDelivery ?? 0
    if (cMeas === 0) {
      out.push({
        key: "seamstress.measurement",
        title: "Snemite prvi merilni list",
        description: "Mere strank so osnova za šivanje po meri in zgodovino meritev.",
        href: "/dashboard/seamstress#measurement",
      })
    } else if (cWo === 0) {
      out.push({
        key: "seamstress.inquiry",
        title: "Ustvarite prvo delovno naročilo",
        description: "Naročilo poveže stranko, merilni list in proizvodni proces (povpraševanje → predaja).",
        href: "/dashboard/seamstress#orders",
      })
    } else if (cMat === 0) {
      out.push({
        key: "seamstress.materials",
        title: "Evidentirajte porabo materiala",
        description: "Zapišite blago/material, porabljen na delovnem nalogu — zaloga se zniža.",
        href: "/dashboard/seamstress#materials",
      })
    } else if (cDel === 0) {
      out.push({
        key: "seamstress.delivery",
        title: "Označite izdelke, pripravljene za predajo",
        description: "Predaja in plačilo zaključita proizvodni proces naročila.",
        href: "/dashboard/seamstress#delivery",
      })
    }
    if (out.length < L) {
      out.push({
        key: "publish",
        title: "Objavite svojo stran",
        description: "Objavljena stran je prvi javni vstop do povpraševanj.",
        href: "/dashboard/settings",
      })
    }
  } else {
    // Generic (profile-agnostic) suggestions for every other activity.
    if (!input.published) {
      out.push({
        key: "publish",
        title: "Objavite svojo stran",
        description: "Objavljena stran je vidna strankam in odprta za naročila.",
        href: "/dashboard/settings",
      })
    }
    if (input.shopCapable && c.products === 0 && out.length < L) {
      out.push({
        key: "firstProduct",
        title: "Dodajte prvi izdelek",
        description: "Izdelki so osnova za spletno in poslovno prodajo.",
        href: "/dashboard/products/new",
      })
    }
    if (input.shopCapable && c.orders === 0 && out.length < L) {
      out.push({
        key: "firstOrder",
        title: "Uredite prvo prodajo",
        description: "Spremljanje naročil in zaloge se začne s prvim naročilom.",
        href: "/dashboard/orders",
      })
    }
  }

  return out.slice(0, L)
}