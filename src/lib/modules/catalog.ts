// ============================================================
// #100 8.C (F2) — KATALOG MODULOV (čista jedra)
// Modul = poslovna funkcija (več kot capability): ima ime, opis,
// capability-je, odvisnosti. Vklop/izklop na ravni podjetja
// NEODVISNO od vertikale — vertikala samo PREDLAGA (F1 SKD).
//
// Pravila (načrt §5):
//  - izklop ≠ izguba podatkov (samo vhodi izginejo);
//  - odvisnosti deklarirane — vklop z neizpolnjeno odvisnostjo dobi
//    jasno sporočilo (ne tiho kaskado); izklop, od katerega je odvisen
//    drug modul, zahteva potrditev;
//  - brez vrstice moduleState = vertikalni privzeti (ni spremembe).
// ============================================================

import type { CapabilityKey, CapabilityState } from "@/lib/profiles/types"

export type ModuleState = "ACTIVE" | "DEACTIVATED" | "HIDDEN"

export interface ModuleDef {
  /** Stabilen id — za v1 = capability ključ (1 : 1 katalog). */
  id: CapabilityKey
  nameSl: string
  nameEn: string
  descriptionSl: string
  descriptionEn: string
  /** Capability-ji, ki jih modul poganja (vklop/izklop celotnega sklopa). */
  capabilities: CapabilityKey[]
  /** Moduli, ki morajo biti vklopljeni, da je ta smiseln. */
  dependsOn: CapabilityKey[]
}

export const MODULES: ModuleDef[] = [
  {
    id: "appointments",
    nameSl: "Rezervacije in koledar",
    nameEn: "Bookings & calendar",
    descriptionSl: "Spletna rezervacija terminov, urniki, opomniki, čakalna lista.",
    descriptionEn: "Online bookings, schedules, reminders, waitlist.",
    capabilities: ["appointments"],
    dependsOn: ["services"],
  },
  {
    id: "services",
    nameSl: "Storitve in cenik",
    nameEn: "Services & pricing",
    descriptionSl: "Katalog storitev s cenami, trajanjem in dodatki.",
    descriptionEn: "Service catalog with prices, durations and add-ons.",
    capabilities: ["services"],
    dependsOn: [],
  },
  {
    id: "workOrders",
    nameSl: "Delovna naročila",
    nameEn: "Work orders",
    descriptionSl: "Delovni nalogi s procesi (vulkanizer, serviser, šivilja …).",
    descriptionEn: "Work orders with workflows (workshop, tailoring …).",
    capabilities: ["workOrders"],
    dependsOn: [],
  },
  {
    id: "shop",
    nameSl: "Spletna trgovina",
    nameEn: "Online shop",
    descriptionSl: "Izdelki, košarica, Stripe checkout, naročila strank.",
    descriptionEn: "Products, cart, Stripe checkout, customer orders.",
    capabilities: ["shop"],
    dependsOn: [],
  },
  {
    id: "inventory",
    nameSl: "Zaloge",
    nameEn: "Inventory",
    descriptionSl: "Evidenca zalog, gibi, inventura, opozorila nizke zaloge.",
    descriptionEn: "Stock records, movements, stocktakes, low-stock alerts.",
    capabilities: ["inventory"],
    dependsOn: [],
  },
  {
    id: "customers",
    nameSl: "Stranke",
    nameEn: "Customers",
    descriptionSl: "Baza strank, oznake, zgodovina obiskov in naročil.",
    descriptionEn: "Customer database, tags, visit and order history.",
    capabilities: ["customers"],
    dependsOn: [],
  },
  {
    id: "staff",
    nameSl: "Zaposleni in urniki",
    nameEn: "Staff & schedules",
    descriptionSl: "Osebje, povezava storitev, urniki, portal za osebje.",
    descriptionEn: "Team, service links, schedules, staff portal.",
    capabilities: ["staff"],
    dependsOn: [],
  },
  {
    id: "analytics",
    nameSl: "Statistika in poročila",
    nameEn: "Analytics & reports",
    descriptionSl: "KPI-ji, prihodki, zasedenost, GA4 integracija.",
    descriptionEn: "KPIs, revenue, occupancy, GA4 integration.",
    capabilities: ["analytics"],
    dependsOn: [],
  },
  {
    id: "reviews",
    nameSl: "Ocene strank",
    nameEn: "Customer reviews",
    descriptionSl: "Zbiranje in objava ocen na javni strani.",
    descriptionEn: "Collecting and publishing reviews on the public site.",
    capabilities: ["reviews"],
    dependsOn: [],
  },
  {
    id: "forms",
    nameSl: "Obrazci in povpraševanja",
    nameEn: "Forms & inquiries",
    descriptionSl: "Dinamični obrazci, povpraševanja, sprejemni obrazci terminov.",
    descriptionEn: "Dynamic forms, inquiries, intake forms on bookings.",
    capabilities: ["forms"],
    dependsOn: [],
  },
  {
    id: "workflows",
    nameSl: "Poslovni procesi",
    nameEn: "Business workflows",
    descriptionSl: "Konfigurabilne faze procesov za delovna naročila.",
    descriptionEn: "Configurable process stages for work orders.",
    capabilities: ["workflows"],
    dependsOn: ["workOrders"],
  },
  {
    id: "documents",
    nameSl: "Dokumenti (ponudbe, računi)",
    nameEn: "Documents (quotes, invoices)",
    descriptionSl: "Ponudbe in računi s per-org številčenjem.",
    descriptionEn: "Quotes and invoices with per-org numbering.",
    capabilities: ["documents"],
    dependsOn: [],
  },
  {
    id: "delivery",
    nameSl: "Dostava",
    nameEn: "Delivery",
    descriptionSl: "Dostava naročil (runtime razširitev trgovine).",
    descriptionEn: "Order delivery (shop runtime extension).",
    capabilities: ["delivery"],
    dependsOn: ["shop"],
  },
  {
    id: "walkIn",
    nameSl: "Walk-in vrsta",
    nameEn: "Walk-in queue",
    descriptionSl: "Živa vrsta brez računa — prijava in javni status.",
    descriptionEn: "Live queue without account — join and public status.",
    capabilities: ["walkIn"],
    dependsOn: [],
  },
  {
    id: "cashRegister",
    nameSl: "Blagajna",
    nameEn: "Cash register",
    descriptionSl:
      "Dnevna denarna seja: odpiranje z začetnim fondom, prodaje (gotovina/kartica/nakazilo), drobni stroški in odstopanje ob zaprtju.",
    descriptionEn:
      "Daily cash session: opening float, sales (cash/card/transfer), small expenses and closing variance.",
    capabilities: ["cashRegister"],
    dependsOn: [],
  },
]

/** IDs v hitrem nizu (validacija vnosa). */
export const MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map((m) => m.id))

export function getModule(id: string): ModuleDef | null {
  return MODULES.find((m) => m.id === id) ?? null
}

export type ModuleStateMap = Record<string, ModuleState>

/**
 * Efektivna capability matrika (DASHBOARD): vertikalni profil + moduleStates.
 *
 * F5.4.1 (P0) — ORGANIZACIJSKO STANJE NE SME PREGLASITI AVTORITATIVNIH
 * PRAVIL AKTIVNEGA PROFILA:
 *   - `required` je vedno funkcionalno aktiven (moduleState DEACTIVATED ga ne
 *     sme izklopiti; vsilimo ACTIVE kot funcionalno).
 *   - `disabled` se nikoli ne sme vklopiti (moduleState ACTIVE/HIDDEN ne sme
 *     odpreti — ostaja disabled).
 *   - `optional` sme biti ACTIVE / HIDDEN / DEACTIVATED po izbiri lastnika.
 * To je ena politika z `modulePolicyFor` v src/lib/modules/policy.ts.
 */
export function effectiveCapabilities(
  profileCapabilities: Record<string, string>,
  states: ModuleStateMap
): Record<string, string> {
  const out = { ...profileCapabilities }
  for (const mod of MODULES) {
    const state = states[mod.id]
    if (!state) continue
    for (const cap of mod.capabilities) {
      const base = out[cap] as CapabilityState | undefined
      if (base === "disabled") {
        // disabled: nikoli vklopljen (moduleState ne sme odpreti).
        out[cap] = "disabled"
        continue
      }
      if (base === "required") {
        // required: vedno aktiven (moduleState ga ne sme izklopiti).
        out[cap] = "required"
        continue
      }
      // optional: podvržen definira modul.
      out[cap] = state === "DEACTIVATED" ? "disabled" : (base ?? "optional")
    }
  }
  return out
}

/**
 * Efektivna matrika za JAVNO stran (F5.4.1): ločena od plošče.
 *
 * Pravila javne vidnosti (ne sme zamenjati funkcionalne aktivacije):
 *   - HIDDEN → javno izklopljeno (disabled), tudi za required modul (vidnost
 *     je ločena od aktivacije — §5);
 *   - DEACTIVATED → javno izklopljeno (disabled), razen required (zaklenjeno);
 *   - ACTIVE / brez vrstice → javno tisto, kar profil določi (required/optional);
 *   - disabled → nikoli (tudi ACTIVE ga ne odpre).
 * Dashboard uporablja `effectiveCapabilities` (kjer HIDDEN pomeni »plošča dela«).
 */
export function effectivePublicCapabilities(
  profileCapabilities: Record<string, string>,
  states: ModuleStateMap
): Record<string, string> {
  const out: Record<string, string> = { ...profileCapabilities }
  for (const mod of MODULES) {
    const state = states[mod.id]
    if (!state) continue
    for (const cap of mod.capabilities) {
      const base = out[cap] as CapabilityState | undefined
      if (base === "disabled") {
        out[cap] = "disabled"
        continue
      }
      if (state === "HIDDEN") {
        out[cap] = "disabled" // javno skrito — ločeno od aktivacije
        continue
      }
      if (state === "DEACTIVATED") {
        out[cap] = base === "required" ? "required" : "disabled"
        continue
      }
      // ACTIVE: javno enako kot profil (required ali optional).
      out[cap] = base ?? "disabled"
    }
  }
  return out
}

/** Odvisni moduli (kdo zahteva ta modul) — za opozorilo pred izklopom. */
export function dependentsOf(moduleId: string): ModuleDef[] {
  return MODULES.filter((m) => m.dependsOn.includes(moduleId as CapabilityKey))
}

/** Manjkajoče odvisnosti za vklop (vklop gre z jasnimi sporočili). */
export function missingDependencies(
  moduleId: string,
  states: ModuleStateMap
): ModuleDef[] {
  const mod = getModule(moduleId)
  if (!mod) return []
  return mod.dependsOn
    .filter((dep) => (states[dep] ?? "ACTIVE") === "DEACTIVATED")
    .map((dep) => getModule(dep))
    .filter((m): m is ModuleDef => m !== null)
}
