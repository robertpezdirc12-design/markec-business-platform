"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  requireSession,
  resolveSessionOrganization,
  UnauthorizedError,
} from "@/lib/auth/guards"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { recordConfigChange } from "@/lib/config-history/record"
import {
  MODULES,
  dependentsOf,
  missingDependencies,
  getModule,
  type ModuleState,
  type ModuleStateMap,
} from "@/lib/modules/catalog"
import {
  isTransitionAllowed,
  modulePolicyFor,
  type ModuleCategory,
} from "@/lib/modules/policy"
import { getProfile } from "@/lib/profiles/registry"
import { applySecondaryProfile } from "@/lib/profiles/secondary"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import type { CapabilityState } from "@/lib/profiles/types"

// ============================================================
// #100 8.C (F2) + F5.4.1 (P0) — MODULI (akcije)
// Enoten konfigurator + AVTORITATIVNA politika:
//   • module-tabela stanja NE sme preglasiti required/disabled profila;
//   • required  → zaklenjeno (ni DEACTIVATED);
//   • disabled  → nikoli vklopljeno (ACTIVE/HIDDEN zavrnjena);
//   • optional  → lastnik vklopi/izklopi.
// Izklop NIKOLI ne izgubi podatkov; odvisnosti deklarirane (opozorilo).
// Vsaka sprememba gre v ConfigChangeLog.
// ============================================================

/** Bazna (rapidna) capability matrika = profil + secondary + overrides, BREZ moduleStates. */
function baseCapabilitiesOf(org: {
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
}): Record<string, CapabilityState> {
  const withSecondary = applySecondaryProfile(getProfile(org.vertical), org.secondaryVertical)
  const withOverrides = applyOverrides(withSecondary, parseOverrides(org.profileOverrides))
  const caps = withOverrides.capabilities as unknown as Record<string, CapabilityState>
  return { ...caps }
}

/**
 * F5.4.2 §3 — upravljanje modulov je ORG-SCOPED in PERMISSION-BASED
 * (ne samo po globalni vlogi). To je namerna, ciljana razlika od
 * `requirePermissionOrg` (ki omeji na ADMIN): lastnik (ADMIN) in člani s
 * custom vlogo, ki vsebuje `settings.manage`, lahko upravljajo module
 * SVOJE organizacije; STAFF ali član brez tega dovoljenja je zavrnjen
 * (fail-closed). Ključ je PERMISIJI PO ORGANIZACIJI, nikoli globalna vloga.
 */
async function requireModuleManageOrg(): Promise<{
  session: { user: { id: string; email?: string | null; name?: string | null } }
  org: { id: string; vertical: string | null; secondaryVertical?: string | null; profileOverrides: unknown }
}> {
  const session = await requireSession()
  const org = await resolveSessionOrganization(session)
  if (!org) {
    throw new UnauthorizedError("No organization found for this account")
  }
  const perms = await getEffectivePermissions(session.user.id, org.id)
  if (!perms.includes("settings.manage")) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return {
    session: session as never,
    org: {
      id: org.id,
      vertical: org.vertical,
      secondaryVertical: (org as { secondaryVertical?: string | null }).secondaryVertical ?? null,
      profileOverrides: org.profileOverrides,
    },
  }
}

export interface ModuleView {
  id: string
  nameSl: string
  nameEn: string
  descriptionSl: string
  descriptionEn: string
  dependsOn: string[]
  /** Kategorija, ki jo podjetnik vidi (F5.4.1). */
  category: ModuleCategory
  /** Bazno stanje iz profila (authority before moduleStates). */
  baseState: CapabilityState
  /** Efektivno storitveno stanje (katero dejansko velja — after policy). */
  effectiveState: CapabilityState
  /** Trenutni modulni state iz moduleStates (brez vrstice = ACTIVE privzeto). */
  state: ModuleState
  /** Ali je modul funkcionalno aktiven (plošča deluje). */
  active: boolean
  /** Ali je javno skrit (HIDDEN), a ploščno aktiven. */
  hidden: boolean
  /** Ali drži razlog za zaklenjeno/nedovoljeno (SL/EN). */
  reasonSl?: string
  reasonEn?: string
}

async function loadStates(orgId: string): Promise<ModuleStateMap> {
  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: orgId },
    select: { moduleId: true, state: true },
  })
  const states: ModuleStateMap = {}
  for (const r of rows) {
    if (r.state === "ACTIVE" || r.state === "DEACTIVATED" || r.state === "HIDDEN") {
      states[r.moduleId] = r.state
    }
  }
  return states
}

function policyReason(base: CapabilityState, state: ModuleState): { reasonSl?: string; reasonEn?: string } {
  if (base === "required" && state === "DEACTIVATED") {
    return {
      reasonSl: "Ta modul je obvezen za tvojo dejavnost — vedno ostane vklopljen.",
      reasonEn: "This module is required for your activity and stays enabled.",
    }
  }
  if (base === "disabled") {
    return {
      reasonSl: "Ta modul za tvojo dejavnost ni na voljo.",
      reasonEn: "This module is not available for your activity.",
    }
  }
  return {}
}

export async function getModuleOverview(): Promise<{
  modules: ModuleView[]
  dependentWarnings: Record<string, string[]>
}> {
  const { org } = await requireModuleManageOrg()

  // F5.4.1 §2: proaktivno uredi shranjena stanja, ki niso v skladu s politiko
  // profila (required DEACTIVATED, disabled ACTIVE/HIDDEN) — brez brisanja podatkov.
  await reconcileModuleStates()

  const base = baseCapabilitiesOf(org)
  const states = await loadStates(org.id)

  const modules: ModuleView[] = MODULES.map((m) => {
    const baseState = (base[m.id] ?? "optional") as CapabilityState
    const state = states[m.id] ?? "ACTIVE"
    const policy = modulePolicyFor(baseState, state)
    const { reasonSl, reasonEn } = policyReason(baseState, state)
    return {
      id: m.id,
      nameSl: m.nameSl,
      nameEn: m.nameEn,
      descriptionSl: m.descriptionSl,
      descriptionEn: m.descriptionEn,
      dependsOn: m.dependsOn,
      category: categoryFor(baseState, policy.active),
      baseState,
      effectiveState: policy.effective,
      state,
      active: policy.active,
      hidden: policy.hidden,
      reasonSl,
      reasonEn,
    }
  })

  const dependentWarnings: Record<string, string[]> = {}
  for (const m of MODULES) dependentWarnings[m.id] = dependentsOf(m.id).map((d) => d.nameSl)

  return { modules, dependentWarnings }
}

/** Kategorija za prikaz (F5.4.1). */
function categoryFor(base: CapabilityState, active: boolean): ModuleCategory {
  if (base === "required") return "required"
  if (base === "disabled") return "disabled"
  // optional: navodilo govori o "priporočeni" — v v1 označimo vse optional kot "available".
  // Tu ohranimo možnost, da kasneje profil izrazito "recommend" ločimo od zgolj optional.
  return active ? "recommended" : "available"
}

export async function setModuleState(
  moduleId: string,
  state: ModuleState
): Promise<{ success: boolean; error?: string; warnings?: string[]; allowed?: boolean }> {
  const { org, session } = await requireModuleManageOrg()

  const mod = getModule(moduleId)
  if (!mod || !MODULES.some((m) => m.id === moduleId)) {
    return { success: false, error: "Neznan modul." }
  }

  // F5.4.1 (P0): avtoritativna politika — required/disabled preverjanja.
  const base = baseCapabilitiesOf(org)
  const baseState = (base[moduleId] ?? "optional") as CapabilityState
  const transition = isTransitionAllowed(baseState, state)
  if (!transition.ok) {
    return { success: false, error: transition.reasonSl, allowed: false }
  }

  const rows = await loadStates(org.id)
  const states: ModuleStateMap = { ...rows }
  const previous = states[moduleId] ?? "ACTIVE"

  // Izklop: moduli odvisni od tega ostanejo — opozorilo (ni tihe kaskade).
  let warnings: string[] = []
  if (state === "DEACTIVATED") {
    const dependents = dependentsOf(moduleId).filter(
      (d) => (states[d.id] ?? "ACTIVE") === "ACTIVE"
    )
    if (dependents.length > 0) {
      warnings = dependents.map(
        (d) => `Modul »${d.nameSl}« je odvisen od tega modula — preveri njegovo delovanje.`
      )
    }
  }

  // Vklop: manjkajoča odvisnost jasno povej (ne samodejno vklopi, lastnik odloči).
  if (state === "ACTIVE") {
    const missing = missingDependencies(moduleId, states).filter((m) => {
      // prepovedane odvisnosti (disabled) se nikoli ne vklopi — samo opozori.
      const depBase = (base[m.id] ?? "optional") as CapabilityState
      return depBase !== "disabled"
    })
    if (missing.length > 0 && previous !== "DEACTIVATED") {
      return {
        success: false,
        error: `Najprej vklopi odvisne module: ${missing.map((m) => m.nameSl).join(", ")}.`,
        allowed: true,
      }
    }
    if (missing.length > 0) {
      warnings = missing.map(
        (m) => `Odvisni modul »${m.nameSl}« je izklopljen — vklopi ga, če potrebuješ.`
      )
    }
  }

  await prisma.organizationModuleState.upsert({
    where: { organizationId_moduleId: { organizationId: org.id, moduleId } },
    create: { organizationId: org.id, moduleId, state },
    update: { state },
  })

  const actorEmail = session.user.email ?? "unknown"
  await recordConfigChange({
    organizationId: org.id,
    actorEmail,
    entityKey: `module:${moduleId}`,
    action: "UPDATE",
    summary: `Modul ${mod.nameSl}: ${previous} → ${state}`,
    previous: { state: previous },
    next: { state },
  }).catch(() => undefined)

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true, warnings, allowed: true }
}

// ============================================================
// F5.4.1 §2 — SANITIZACIJA OBSTOJEČIH, ZA POLITIKO NESKLADNIH STANJ.
// Required modul, ki je kdaj v preteklosti prejel DEACTIVATED, ali disabled
// modul z ACTIVE/HIDDEN: ne brišemo podatkov (tabela je prikazana), le
// popravimo DRŽENO stanje na smiselno (required → ne-expliciten/ACTIVE;
// disabled → odstranimo prepovedan ACTIVE). Kliče se idempotentno iz
// getModuleOverview (samo za lastnika) in ob prijavi v dashboard.
// ============================================================
export async function reconcileModuleStates(): Promise<{ fixed: number }> {
  const { org } = await requireModuleManageOrg()
  const base = baseCapabilitiesOf(org)
  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: org.id },
    select: { id: true, moduleId: true, state: true },
  })

  let fixed = 0
  for (const row of rows) {
    const b = (base[row.moduleId] ?? "optional") as CapabilityState
    // required DEACTIVATED → umaknemo (privzeta ACTIVE, brez izgube).
    // disabled ACTIVE/HIDDEN → umaknemo (podel neodprave stanja).
    const bad =
      (b === "required" && row.state === "DEACTIVATED") ||
      (b === "disabled" && (row.state === "ACTIVE" || row.state === "HIDDEN"))
    if (!bad) continue
    await prisma.organizationModuleState.delete({ where: { id: row.id } })
    fixed += 1
  }
  if (fixed > 0) {
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard")
  }
  return { fixed }
}