// ============================================================
// F5.4.1 — ENOTNA POLITIKA MODULOV (avtoritativna pravila).
//
// Poskuša odpraviti P0 varnostno napako: module-tabela pot je lahko
// stanje (OrganizationModuleState) NE sme preglasiti avtoritativni
// CapabilityMatrix aktivnega profila. Tu so stroga pravila:
//
//   required  → vselej aktivno in ZAKLENJENO  (ni DEACTIVATED, ni HIDDEN-izklopljen na javni kolicini);
//   optional  → lastnik sme vklopiti/izklopiti (ACTIVE / HIDDEN / DEACTIVATED);
//   disabled  → NIKOLI ni mogoče vklopiti     (moduleState ACTIVE ga ne sme odpresti).
//
// ModulKatalog (src/lib/modules/catalog.ts) ostaja vir opisov/odvisnosti;
// politika tukaj je edini izračun, ki odloča, KAJ je dovoljeno in KAJ se
// dejansko zgodi. `resolve.ts` jo uporablja za končno matriko, `setModuleState`
// za strežniško validacijo — in enotski testi za neprekinjeno zaščito.
//
// Client-safe: čiste funkcije, brez prisma/server-only.
// ============================================================

import type { CapabilityState } from "@/lib/profiles/types"
import type { ModuleState } from "./catalog"

/// Kategorija, ki jo podjetnik vidi (in ki izvira iz avtoritativnih pravil).
export type ModuleCategory =
  | "required"   // obvezen — zaklenjen, vselej aktiven
  | "recommended" // priporočen (optional kapaciteta, ki profil predlaga) — aktiven, preklopljiv
  | "available"  // izberna kapaciteta, ki ni predpisana kot required; preklopljiv, trenutno ON ali OFF
  | "disabled"   // nedovoljen za ta profil — nikoli vklopljen

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
 * Končno funkcionalno stanje enega modula po autoritativnih pravilih.
 *
 * Pravilo: moduleStates lahko ZNIŽA optional (→disabled) in DVIZNE optional
 * (→aktiven), a nikoli ne sme:
 *   - deaktivirati `required` modula (zaklenjen spodaj navzgor na ACTIVE),
 *   - odpreti `disabled` modula (moduleState ACTIVE/HIDDEN ne smeta odpreti).
 * HIDDEN ohranja funkcionalno aktivacijo, le javno skrije (§5 ločitev).
 */
export function modulePolicyFor(
  baseCapabilityState: CapabilityState,
  moduleState?: ModuleState
): { effective: CapabilityState; active: boolean; hidden: boolean; modified: boolean } {
  // required: ne glede na moduleState — lahko je ACTIVE ali HIDDEN (funkcionalno aktivno),
  // nikoli DEACTIVATED (ki bi ga izklopil).
  if (baseCapabilityState === "required") {
    const hidden = moduleState === "HIDDEN"
    return { effective: "required", active: true, hidden, modified: !!moduleState && moduleState !== "ACTIVE" }
  }
  // disabled: nikoli se ne sme vklopiti — moduleState ACTIVE/HIDDEN ne smeta obrniti.
  if (baseCapabilityState === "disabled") {
    return { effective: "disabled", active: false, hidden: false, modified: false }
  }
  // optional: funkcionalna aktivacija določa veljavnost; DEACTIVATED šele izklopi.
  if (moduleState === "DEACTIVATED") {
    return { effective: "disabled", active: false, hidden: false, modified: true }
  }
  const hidden = moduleState === "HIDDEN"
  return { effective: "optional", active: true, hidden, modified: !!moduleState }
}

/**
 * Ali je predlagana sprememba stanja dovoljena pod avtoritativno politiko.
 * Vrne ok, ali pa napako z razlogom (SL/EN) — setModuleState jo vme.
 */
export function isTransitionAllowed(
  baseCapabilityState: CapabilityState,
  requested: ModuleState
): { ok: true } | { ok: false; reasonSl: string; reasonEn: string } {
  if (baseCapabilityState === "required") {
    if (requested === "DEACTIVATED") {
      return {
        ok: false,
        reasonSl: "Ta modul je obvezen za tvojo dejavnost in ga ni mogoče izklopiti.",
        reasonEn: "This module is required for your activity and cannot be disabled.",
      }
    }
    // ACTIVE ali HIDDEN sta sprejemljiva (HIDDEN = javno skrit, plošča dela).
    return { ok: true }
  }
  if (baseCapabilityState === "disabled") {
    // disabled se ne sme vklopiti; tudi ACTIVE/HIDDEN (odklepanje) je zavrnjeno.
    return {
      ok: false,
      reasonSl: "Ta modul za tvojo dejavnost ni na voljo in ga ni mogoče vklopiti.",
      reasonEn: "This module is not available for your activity and cannot be enabled.",
    }
  }
  // optional: vse tri eksplicitno — lastnik izbira.
  return { ok: true }
}

// VSTOPNA IZKUŠNJA (2026-11): opt-in aktivacija modulov (planActivation,
// buildSeedRows, seedNewOrgModuleStates) je v src/app/actions/modules.ts
// — EN VIR RESNICE za seed ob nastanku org in za "Dodaj skupaj z
// odvisnostmi" akcijo (enableModuleWithDependencies).