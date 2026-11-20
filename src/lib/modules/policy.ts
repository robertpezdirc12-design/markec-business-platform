// ============================================================
// F5.4.1 — ENOTNA POLITIKA MODULOV (avtoritativna pravila).
//
// Politika "VSI MODULI ZA VSE" (platform owner, 2026):
//   - required → jedro dejavnosti, PRIVZETO vklopljeno ob seedu, a POPUSTLJIV
//     (lastnik ga sme izklopiti ali javno skriti);
//   - optional → lastnik sme vklopiti/izklopiti (ACTIVE / HIDDEN / DEACTIVATED);
//   - disabled → ni več mogoče: baseCapabilitiesOf vsako disabled capability
//     dvigne na optional, torej je vsak modul na voljo vsaki dejavnosti.
//
// Kot posledica NIKAKRŠEN modul ni več zaklenjen ali nedovoljen — vsak je
// preklopljiv. ModulKatalog (src/lib/modules/catalog.ts) ostaja vir
// opisov/odvisnosti; politika tukaj je edini izračun, ki odloča, KAJ je
// dovoljeno in KAJ se dejansko zgodi. `resolve.ts` jo uporablja za končno
// matriko, `setModuleState` za strežniško validacijo — in enotski testi za
// neprekinjeno zaščito.
//
// Client-safe: čiste funkcije, brez prisma/server-only.
// ============================================================

import type { CapabilityState } from "@/lib/profiles/types"
import type { ModuleState } from "./catalog"

/// Kategorija, ki jo podjetnik vidi (in ki izvira iz avtoritativnih pravil).
/// Politika "VSI MODULI ZA VSE": kategoriji `required` in `disabled` se v UI
/// ne prikazujeta več (categoryFor nikoli ne vrne teh) — ohranjeni sta le
/// zaradi tipa/compat. Dejansko se prikaže `recommended` oz. `available`.
export type ModuleCategory =
  | "required"   // privzeto vklopljen (jedro dejavnosti) — ohranjeno tip / compat
  | "recommended" // privzeto aktiven / trenutno vklopljen — preklopljiv
  | "available"  // preklopljiv, trenutno OFF
  | "disabled"   // neuporabljen (vedno dvignjen na optional) — ohranjeno / compat

export interface ModulePolicyView {
  id: string
  category: ModuleCategory
  /** Izvorna avtoriteta profila (pred overrides-in-moduleStates). */
  baseState: CapabilityState
  /** Končno FUNCTIONALNO stanje, ki dejansko velja. */
  effectiveState: CapabilityState
  /** Ali je v stopnji "aktiven" (delujoče v poslovnem okolju). */
  active: boolean
  /** Ali je v okolju funkcionalno aktiven, a javno SKRIT (HIDDEN). */
  hidden: boolean
  /** Ali je to stanje spremenjeno iz profila (lastnik/moduleStates). */
  modified: boolean
  /** Človeško razumljiv razlog (SL), če je stanje zaklenjeno ali nedovoljeno. */
  reasonSl?: string
  reasonEn?: string
}

/**
 * Končno funkcionalno stanje enega modula po avtoritativnih pravilih.
 *
 * Politika "VSI MODULI ZA VSE" (platform owner, 2026): `disabled` ne obstaja
 * več — vsi moduli so preklopljivi. `required` je le privzeta aktivacija ob
 * seedu (jedro dejavnosti vklopljeno na začetku), a je POPUSTLJIV: lastnik
 * ga sme izklopiti (DEACTIVATED) ali javno skriti (HIDDEN).
 */
export function modulePolicyFor(
  baseCapabilityState: CapabilityState,
  moduleState?: ModuleState
): { effective: CapabilityState; active: boolean; hidden: boolean; modified: boolean } {
  // required: privzeto aktivno; lastnik sme izklopiti (DEACTIVATED) ali skriti.
  if (baseCapabilityState === "required") {
    if (moduleState === "DEACTIVATED") {
      return { effective: "required", active: false, hidden: false, modified: true }
    }
    const hidden = moduleState === "HIDDEN"
    return { effective: "required", active: true, hidden, modified: !!moduleState && moduleState !== "ACTIVE" }
  }
  // optional: funkcionalna aktivacija določa veljavnost; DEACTIVATED izklopi.
  if (moduleState === "DEACTIVATED") {
    return { effective: "disabled", active: false, hidden: false, modified: true }
  }
  const hidden = moduleState === "HIDDEN"
  return { effective: "optional", active: true, hidden, modified: !!moduleState }
}

/**
 * Ali je predlagana sprememba stanja dovoljena pod avtoritativno politiko.
 * Politika "VSI MODULI ZA VSE": required in optional sta oba POPUSTLJIVA —
 * lastnik sme vklopiti, izklopiti ali skriti katerikoli modul.
 */
export function isTransitionAllowed(
  _baseCapabilityState: CapabilityState,
  _requested: ModuleState
): { ok: true } | { ok: false; reasonSl: string; reasonEn: string } {
  // required in optional: lastnik izbira prosto. Noben modul ni nikoli blokiran.
  return { ok: true }
}

// VSTOPNA IZKUŠNJA (2026-11): opt-in aktivacija modulov (planActivation,
// buildSeedRows, seedNewOrgModuleStates) je v src/app/actions/modules.ts
// — EN VIR RESNICE za seed ob nastanku org in za "Dodaj skupaj z
// odvisnostmi" akcijo (enableModuleWithDependencies).