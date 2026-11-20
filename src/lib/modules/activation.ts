// ============================================================
// VSTOPNA IZKUŠNJA (2026-11) — OPT-IN MODULI, ČISTA LOGIKA.
//
// Izomorfo (brez "use client", brez "use server", brez prisma):
// seedNewOrgModuleStates (src/app/actions/modules.ts) to kliče na
// strežniku, komponente in testi pa jo uvažajo na klientu. Dreveso
// odvisnosti (catalog → registry → extensions/overrides/secondary/types)
// je enako vse client-safe.
//
// En vir resnice za (a) seed ob nastanku NOVE organizacije
// (required jedro profila = ACTIVE, optional = DEACTIVATED,
// disabled = brez vrstice) in (b) "Dodaj modul z odvisnostmi"
// akcijo (enableModuleWithDependencies). Akcije (src/app/actions/
// modules.ts) delegirajo sem; komponente in TESTI lahko importirajo
// direktno (ni "use server").
//
// Semantika:
//   - modul ima capabilities (string[]) v katalogu; bazno stanje
//     modula je izpeljano iz capability matrike profila;
//   - required → privzeto vklopljen ob nastanku, a POPUSTLJIV: lastnik ga
//     sme izklopiti (politika glej policy.ts);
//   - optional → lastnik odloči (opt-in); vsi moduli so optional ali required
//     (noben modul ni več "disabled" — dvigne se na optional, "VSI MODULI ZA VSE").
// ============================================================

import type { ModuleDef, ModuleState } from "./catalog"
import { MODULES, getModule } from "./catalog"
import { getProfile } from "@/lib/profiles/registry"
import { applySecondaryProfile } from "@/lib/profiles/secondary"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"

/**
 * Bazna capability matrika = profil + secondary + overrides.
 *
 * Politika "VSI MODULI ZA VSE" (platform owner, 2026): noben modul ni več
 * prepovedan za dejavnost. Vsaka `disabled` capability se dvigne na
 * `optional`, to pa je edina preklopljiva kategorija v UI. `required`
 * se ohrani (za seed se jedro dejavnosti samodejno vklopi), a tudi ta
 * je v politiki POPUSTLJIV — lastnik ga lahko izklopi (glej policy.ts).
 */
export function baseCapabilitiesOf(org: {
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides?: unknown
}): Record<string, string> {
  const primary = getProfile(org.vertical)
  const withSecondary = applySecondaryProfile(primary, org.secondaryVertical ?? null)
  const withOverrides = applyOverrides(withSecondary, parseOverrides(org.profileOverrides))
  const raw = withOverrides.capabilities as unknown as Record<string, string>
  const base: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    // VSI moduli so dostopni; disabled dejavnosti se dvigne na optional.
    base[key] = value === "disabled" ? "optional" : value
  }
  return base
}

/** Bazno stanje modula iz capability matrike (required > hidden > disabled > optional). */
export function moduleBaseState(base: Record<string, string>, mod: ModuleDef): string {
  if (!mod.capabilities || mod.capabilities.length === 0) return "optional"
  const states = mod.capabilities.map((c: string) => base[c] ?? "disabled")
  if (states.every((st: string) => st === "disabled")) return "disabled"
  if (states.some((st: string) => st === "required")) return "required"
  if (states.some((st: string) => st === "hidden")) return "hidden"
  return "optional"
}

/**
 * Seed vrstice za NOVO organizacijo (opt-in vstopni tok):
 *   required/hidden → ACTIVE, optional → DEACTIVATED, disabled → brez vrstice.
 */
export function buildSeedRows(
  base: Record<string, string>
): { moduleId: string; state: ModuleState }[] {
  const rows: { moduleId: string; state: ModuleState }[] = []
  for (const mod of MODULES) {
    const b = moduleBaseState(base, mod)
    if (b === "disabled") continue
    if (b === "required" || b === "hidden") {
      rows.push({ moduleId: mod.id, state: "ACTIVE" })
    } else {
      rows.push({ moduleId: mod.id, state: "DEACTIVATED" })
    }
  }
  return rows
}

/** Rezultat načrta aktivacije enega modula (čist, brez I/O). */
export interface ActivationPlan {
  ok: boolean
  reasonSl?: string
  reasonEn?: string
  /** Moduli za vklop, VRSTENO: odvisnosti pred odvisniki (topološko). */
  toEnable: { id: string; nameSl: string }[]
}

/**
 * Načrt aktivacije `moduleId` v danem baznem stanju profila in trenutnih
 * shranjenih stanjih. Vrne, KAJ bi se zgodilo — ne spremeni nič.
 *
 * Pravila:
 *   - disabled se nikoli ne pojavi (baseCapabilitiesOf dvigne na optional);
 *     veje tu so defenzivna fail-closed zaščita, če bi kdaj pritekel disabled.
 *   - required/hidden odvisnost → že izpolnjena (ni treba vklopiti);
 *   - optional odvisnost (DEACTIVATED) → vključena v toEnable;
 *   - vrstni red toEnable: odvisnosti najprej (topološki prehod).
 */
export function planActivation(
  moduleId: string,
  base: Record<string, string>,
  currentStates: Record<string, string>
): ActivationPlan {
  const target = getModule(moduleId)
  if (!target)
    return { ok: false, reasonSl: "Neznan modul.", reasonEn: "Unknown module.", toEnable: [] }

  const targetBase = moduleBaseState(base, target)
  if (targetBase === "disabled") {
    return {
      ok: false,
      reasonSl: "Modul ni na voljo za tvojo dejavnost.",
      reasonEn: "This module is not available for your activity.",
      toEnable: [],
    }
  }

  const toEnableIds = new Set<string>()
  const stack = [moduleId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (toEnableIds.has(id)) continue
    const mod = getModule(id)
    if (!mod)
      return {
        ok: false,
        reasonSl: `Neznan modul: ${id}`,
        reasonEn: `Unknown module: ${id}`,
        toEnable: [],
      }
    const b = moduleBaseState(base, mod)
    const current = currentStates[id] ?? "DEACTIVATED"
    if (b === "disabled") {
      return {
        ok: false,
        reasonSl: `Odvisni modul ${mod.nameSl} ni na voljo za tvojo dejavnost.`,
        reasonEn: `Dependency module ${mod.nameEn} is not available for your activity.`,
        toEnable: [],
      }
    }
    // Odvisnost je že aktivna/skrita — ni jo treba vklopiti.
    if (
      (b === "required" || b === "hidden" || b === "optional") &&
      (current === "ACTIVE" || current === "HIDDEN") &&
      id !== moduleId
    ) {
      continue
    }
    toEnableIds.add(id)
    for (const dep of mod.dependsOn ?? []) {
      const depState = currentStates[dep] ?? "DEACTIVATED"
      if (depState === "ACTIVE" || depState === "HIDDEN") continue
      if (!toEnableIds.has(dep)) stack.push(dep)
    }
  }

  // Ciljni modul je vedno v toEnable (HIDDEN→ACTIVE upsert).
  toEnableIds.add(moduleId)

  // Vrsta: odvisnosti pred odvisniki (ponavljajoči topološki prehod).
  const ordered: string[] = []
  const remaining = new Set(toEnableIds)
  for (let i = 0; i < 20 && remaining.size > 0; i++) {
    for (const id of Array.from(remaining)) {
      const mod = getModule(id)
      const deps = (mod?.dependsOn ?? []).filter((d) => remaining.has(d))
      if (deps.length === 0) {
        ordered.push(id)
        remaining.delete(id)
      }
    }
  }
  for (const id of remaining) ordered.push(id)

  const toEnable = ordered.map((id) => {
    const m = getModule(id)
    return { id, nameSl: m?.nameSl ?? id }
  })

  return { ok: true, toEnable }
}
