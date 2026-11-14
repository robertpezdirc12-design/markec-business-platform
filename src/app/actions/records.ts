"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"

import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { validateFieldValues, deriveRecordTitle } from "@/lib/field-validation"
import type { ProfileFieldDef } from "@/lib/profiles/types"
import type { Prisma } from "@prisma/client"

// ============================================================
// EXTENSION RECORD REGISTRY (EPIC #1 §13 — Phase 6)
// Universal, data-driven CRUD for the entities that the tenant's
// ENABLED EXTENSIONS declare (vehicle-workshop → vehicle/tire_set,
// batch-production → batch, …). Nothing here knows anything about
// specific industries: (extensionId, entityKey) select the
// declaration, values are validated server-side against the
// declarative field list, storage is one org-scoped table
// (ExtensionRecord). Adding a new extension needs NO code here.
// All queries/actions are strictly org-scoped via requirePermissionOrg.
// ============================================================

export interface ExtensionEntityInfo {
  extensionId: string
  extensionName: string
  key: string
  name: string
  description: string
  fields: ProfileFieldDef[]
  recordCount: number
}

export interface ExtensionRecordItem {
  id: string
  entityKey: string
  entityName: string
  extensionName: string
  title: string
  data: Record<string, unknown>
  customerId: string | null
  customerName: string | null
  createdAt: string
  updatedAt: string
}

/** Entities contributed by the effective profile's extensions (+ counts). */
export async function getExtensionEntities(): Promise<ExtensionEntityInfo[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const out: ExtensionEntityInfo[] = []
  for (const extId of profile.extensions) {
    const ext = (await import("@/lib/profiles/extensions")).getExtension(extId)
    if (!ext) continue
    for (const entity of ext.entities) {
      const count = await prisma.extensionRecord.count({
        where: { organizationId: org.id, extensionId: ext.id, entityKey: entity.key },
      })
      out.push({
        extensionId: ext.id,
        extensionName: ext.name,
        key: entity.key,
        name: entity.name,
        description: entity.description,
        fields: entity.fields,
        recordCount: count,
      })
    }
  }
  return out
}

/** Org-scoped records for one entity (newest first). */
export async function listExtensionRecords(
  entityKey: string
): Promise<ExtensionRecordItem[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  // Guard: entityKey must belong to one of the profile's enabled
  // extensions — never serve arbitrary keys (§17).
  const owning = await findEntityOwner(profile.extensions, entityKey)
  if (!owning) return []

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, entityKey },
    include: { customer: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  })

  return records.map((r) => ({
    id: r.id,
    entityKey: r.entityKey,
    entityName: owning.entity.name,
    extensionName: owning.extension.name,
    title: r.title,
    data: (r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>,
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

async function findEntityOwner(
  extensionIds: string[],
  entityKey: string
): Promise<{
  extension: { id: string; name: string }
  entity: { key: string; name: string; fields: ProfileFieldDef[]; appendOnly?: boolean }
} | null> {
  const { getExtension } = await import("@/lib/profiles/extensions")
  for (const id of extensionIds) {
    const ext = getExtension(id)
    const entity = ext?.entities.find((e) => e.key === entityKey)
    if (ext && entity) {
      return {
        extension: { id: ext.id, name: ext.name },
        entity: { key: entity.key, name: entity.name, fields: entity.fields, appendOnly: entity.appendOnly },
      }
    }
  }
  return null
}

// ------------------------------------------------------------
// Faza 2B — pri update ohranimo legacy/ne-deklarirane ključe iz prejšnjega
// JSON-a. `clean` je samo trenutno deklariranih polj; stara polja iz stare
// sheme (npr. prejšnje `apiary` kot text) morajo ostati, dokler migracija.
// ------------------------------------------------------------
function mergeDataPreserveLegacy(
  prev: unknown,
  clean: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...clean }
  if (prev && typeof prev === "object" && !Array.isArray(prev)) {
    for (const [k, v] of Object.entries(prev as Record<string, unknown>)) {
      if (k in out) continue // novo deklarirano polje ima prednost
      out[k] = v
    }
  }
  return out
}

// ------------------------------------------------------------
// Faza 2B — org-scoped entityReference validacija.
// Preveri, da vsak entityReference polje ne-null kaza na obstoječ
// ExtensionRecord ISTE organizacije s PRAVIM (extensionId, entityKey).
// Vrednosti z brskalnika (ali direktnega API klica) se NIKOLI ne
// zaupa: neobstoječi / napačna entiteta / tuji org → INVALID_REFERENCE.
// ------------------------------------------------------------
async function validateRecordReferences(
  fields: ProfileFieldDef[],
  clean: Record<string, unknown>,
  orgId: string
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (field.type !== "entityReference" || !field.referenceTo) continue
    const value = clean[field.key]
    if (value === null || value === undefined || value === "") continue

    // Format je IZPELJAN iz referenceTo: objekt → single (string id, 2B),
    // niz → multi-target (objekt {id, extensionId, entityKey}).
    const allowed: { extensionId: string; entityKey: string }[] = Array.isArray(
      field.referenceTo
    )
      ? field.referenceTo
      : [field.referenceTo]

    if (allowed.length === 1 && !Array.isArray(field.referenceTo)) {
      // --- FAZA 2B: single (string id) — nedotaknuto, kompat ---
      const id = String(value)
      const target = await prisma.extensionRecord.findFirst({
        where: {
          id,
          organizationId: orgId,
          extensionId: allowed[0].extensionId,
          entityKey: allowed[0].entityKey,
        },
        select: { id: true },
      })
      if (!target) errors[field.key] = "INVALID_REFERENCE"
      continue
    }

    // --- FAZA 2C-1: multi-target — vrednost MORA biti objekt {id, extensionId, entityKey} ---
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors[field.key] = "INVALID_REFERENCE"
      continue
    }
    const ref = value as { id?: unknown; extensionId?: unknown; entityKey?: unknown }
    const id = typeof ref.id === "string" ? ref.id : ""
    const extensionId = typeof ref.extensionId === "string" ? ref.extensionId : ""
    const entityKey = typeof ref.entityKey === "string" ? ref.entityKey : ""
    if (!id || !extensionId || !entityKey) {
      errors[field.key] = "INVALID_REFERENCE"
      continue
    }
    // (extensionId, entityKey) mora biti v dovoljenem naboru referenceTo.
    const isAllowed = allowed.some(
      (a) => a.extensionId === extensionId && a.entityKey === entityKey
    )
    if (!isAllowed) {
      errors[field.key] = "INVALID_REFERENCE"
      continue
    }
    // id mora obstajati, biti iste org in s točno tem (extensionId, entityKey).
    const target = await prisma.extensionRecord.findFirst({
      where: { id, organizationId: orgId, extensionId, entityKey },
      select: { id: true },
    })
    if (!target) errors[field.key] = "INVALID_REFERENCE"
  }
  return errors
}

export interface SaveRecordResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  id?: string
}

export interface SaveRecordInput {
  entityKey: string
  values: Record<string, unknown>
  customerId?: string | null
}

/**
 * Create an extension record. Values are validated against the
 * declarative fields of the entity (server-side — the client can
 * never inject unknown fields). Title is derived from the first
 * meaningful value.
 */
export async function createExtensionRecord(
  input: SaveRecordInput
): Promise<SaveRecordResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const owning = await findEntityOwner(profile.extensions, input.entityKey)
  if (!owning) return { ok: false, error: "ENTITY_NOT_ENABLED" }
  // FAZA 2C-2: generični create je append-only entitetam (dogodkom zgodovine)
  // ZPREPOVEDAN — ustvarjanje gre izključno prek namenske akcije.
  if (owning.entity.appendOnly) return { ok: false, error: "APPEND_ONLY" }

  const { errors, clean } = validateFieldValues(owning.entity.fields, input.values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "VALIDATION", fieldErrors: errors }
  }

  // Customer must belong to this tenant (§3 isolation).
  const customerId = input.customerId || null
  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "INVALID_CUSTOMER" }
  }

  // Faza 2B: entityReference polja morajo kazati na obstoječ zapis JAZE iste org
  // in prave (extensionId, entityKey). ID-ji iz brskalnika niso nikoli zaupanja vredni.
  const refErrors = await validateRecordReferences(owning.entity.fields, clean, org.id)
  if (refErrors && Object.keys(refErrors).length > 0) {
    return { ok: false, error: "INVALID_REFERENCE", fieldErrors: refErrors }
  }

  const created = await prisma.extensionRecord.create({
    data: {
      organizationId: org.id,
      extensionId: owning.extension.id,
      entityKey: owning.entity.key,
      title: deriveRecordTitle(owning.entity.fields, clean, owning.entity.name),
      data: clean as unknown as Prisma.InputJsonValue,
      customerId,
    },
  })

  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true, id: created.id }
}

/** Update an org-scoped extension record (re-validated, version-free). */
export async function updateExtensionRecord(
  id: string,
  input: SaveRecordInput
): Promise<SaveRecordResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, entityKey: true, data: true },
  })
  if (!record) return { ok: false, error: "NOT_FOUND" }

  const owning = await findEntityOwner(profile.extensions, record.entityKey)
  if (!owning) return { ok: false, error: "ENTITY_NOT_ENABLED" }
  // FAZA 2C-2: generični update append-only entitete je ZPREPOVEDAN (fail-closed).
  if (owning.entity.appendOnly) return { ok: false, error: "APPEND_ONLY" }

  const { errors, clean } = validateFieldValues(owning.entity.fields, input.values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "VALIDATION", fieldErrors: errors }
  }

  const customerId = input.customerId || null
  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "INVALID_CUSTOMER" }
  }

  // Faza 2B: enaka org-scoped ref validacija kot pri create.
  const refErrors = await validateRecordReferences(owning.entity.fields, clean, org.id)
  if (refErrors && Object.keys(refErrors).length > 0) {
    return { ok: false, error: "INVALID_REFERENCE", fieldErrors: refErrors }
  }

  await prisma.extensionRecord.update({
    where: { id: record.id },
    data: {
      title: deriveRecordTitle(owning.entity.fields, clean, owning.entity.name),
      // Faza 2B: ohranimo "legacy"/ne-več-deklarirane vrednosti iz starega JSON-a,
      // da sprememba field-scheme (npr. text → entityReference z novim ključem)
      // nikoli ne izgubi obstoječih podatkov pred ločeno odobreno migracijo.
      data: mergeDataPreserveLegacy(record.data, clean) as unknown as Prisma.InputJsonValue,
      customerId,
    },
  })

  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true, id: record.id }
}

/** Delete an org-scoped extension record (linked work orders keep history). */
export async function deleteExtensionRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, entityKey: true, extensionId: true },
  })
  if (!record) return { ok: false }
  // Faza 2C-2: append-only (zgodovinski) dogodki se NIKOLI ne brišejo.
  const profile = await getSessionEffectiveProfile()
  const owning = await findEntityOwner(profile.extensions, record.entityKey)
  if (owning?.entity.appendOnly) return { ok: false, error: "APPEND_ONLY" }
  await prisma.extensionRecord.delete({ where: { id: record.id } })
  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true }
}

/** Customers for the record dialogs (org-scoped, minimal fields). */
export async function listRecordCustomers(): Promise<
  { id: string; name: string; email: string | null }[]
> {
  const { org } = await requirePermissionOrg("workorders.manage")
  return prisma.customer.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })
}

/** Minimal record list for pickers (e.g. attach a vehicle to a work order,
 *  or an entityReference field). Optionally scoped to ONE entity so the
 *  picker can never offer records of a different kind. org-scoped always. */
export async function listExtensionRecordOptions(filters?: {
  extensionId?: string
  entityKey?: string
}): Promise<
  { id: string; entityKey: string; entityName: string; title: string; customerName: string | null }[]
> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()
  if (profile.extensions.length === 0) return []

  const where: Prisma.ExtensionRecordWhereInput = {
    organizationId: org.id,
  }
  if (filters?.extensionId) {
    where.extensionId = filters.extensionId
  }
  if (filters?.entityKey) {
    where.entityKey = filters.entityKey
  }

  const records = await prisma.extensionRecord.findMany({
    where,
    include: { customer: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  })

  const { getExtension } = await import("@/lib/profiles/extensions")
  return records
    .filter((r) => profile.extensions.includes(r.extensionId))
    .map((r) => {
      const ext = getExtension(r.extensionId)
      const entity = ext?.entities.find((e) => e.key === r.entityKey)
      return {
        id: r.id,
        entityKey: r.entityKey,
        entityName: entity?.name ?? r.entityKey,
        title: r.title,
        customerName: r.customer?.name ?? null,
      }
    })
}
