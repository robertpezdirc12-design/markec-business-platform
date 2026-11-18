/**
 * FAZA 2 — UNIVERZALNI SISTEM GARANCIJ (F2 §3) in reklamacij.
 *
 * Vsi modeli so strogo org-scoped (organizationId). Dostop skozi
 * requirePermissionOrg (org pride iz sessiona, NIKOLI iz requesta).
 * Statusi so vzdrževani strežniško: preverbo poteka (EXPIRING_SOON/EXPIRED)
 * izračunamo ob branju iz datumov + mileage (mehanika) — ne odlagamo v UI.
 * Zahteva: prisma modele Warranty / WarrantyClaim (dodani v F2).
 */
"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { warrantyDefaultsForProfile, type WarrantyCreateInput, type WarrantyClaimInput, type WarrantyClaimUpdateInput, type WarrantySubjectType, type WarrantyStatus } from "@/lib/types/warranty"
import { computeWarrantyStatus } from "@/lib/warranty-logic"

export interface WarrantyResultOk {
  ok: true
  id: string
}
export interface WarrantyResultErr {
  ok: false
  error: string // NOT_FOUND | VALIDATION | NO_ACCESS | BAD_STATE | ...
}
export type WarrantyActionResult = WarrantyResultOk | WarrantyResultErr

function err(error: string): WarrantyResultErr {
  return { ok: false, error }
}

// ------------------------------------------------------------------
// BRANJE
// ------------------------------------------------------------------

export interface WarrantyListItem {
  id: string
  customerId: string
  customerName: string
  subjectType: WarrantySubjectType
  subjectLabel: string
  documentCode: string | null
  issuedDate: string
  validUntil: string | null
  validUntilMileage: number | null
  status: WarrantyStatus
}

export type WarrantyListResult = { ok: true; items: WarrantyListItem[] } | { ok: false; error: string }

/** Seznam garancij za org (po želji filter po statusu). */
export async function listWarranties(filter?: { status?: string; customerId?: string }): Promise<WarrantyListResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const rows = await prisma.warranty.findMany({
    where: {
      organizationId: org.id,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.customerId ? { customerId: filter.customerId } : {}),
    },
    include: { customer: { select: { name: true } }, document: { select: { number: true, type: true, fiscalYear: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  // Za status EXPIRING_SOON/EXPIRED potrebujemo tudi odprte reklamacije.
  const ids = rows.map((r) => r.id)
  const openClaims = ids.length
    ? await prisma.warrantyClaim.groupBy({
        by: ["warrantyId"],
        where: { warrantyId: { in: ids }, status: { in: ["PENDING", "APPROVED", "PARTIAL"] } },
        _count: true,
      })
    : []
  const openByWarranty = new Map(openClaims.map((c) => [c.warrantyId, c._count > 0]))

  const items: WarrantyListItem[] = rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customer.name,
    subjectType: r.subjectType as WarrantySubjectType,
    subjectLabel: r.subjectId,
    documentCode: r.document ? docCode(r.document) : null,
    issuedDate: r.issuedDate.toISOString(),
    validUntil: r.validUntil?.toISOString() ?? null,
    validUntilMileage: r.validUntilMileage,
    status: computeWarrantyStatus({
      validUntil: r.validUntil,
      validUntilMileage: r.validUntilMileage,
      currentMileageKm: null, // ni shranjeno splošno — mehanski extension priskrbi na detail
      declared: r.status,
      hasOpenClaim: openByWarranty.get(r.id) ?? false,
    }),
  }))
  return { ok: true, items }
}

function docCode(d: { number: number; type: string; fiscalYear: number }): string {
  const prefixMap: Record<string, string> = { QUOTE: "PON", INVOICE: "RAC", CREDIT: "DOB", ADVANCE: "AVN" }
  const p = prefixMap[d.type] ?? d.type
  return `${p}-${String(d.number).padStart(4, "0")}/${d.fiscalYear || new Date().getFullYear()}`
}

export interface WarrantyDetailResultOk {
  ok: true
  warranty: {
    id: string
    customerId: string
    customerName: string
    subjectType: WarrantySubjectType
    subjectId: string
    documentCode: string | null
    issuedDate: string
    validFrom: string
    validUntil: string | null
    validUntilMileage: number | null
    warrantyPeriodDays: number
    terms: string | null
    status: WarrantyStatus
    notes: string | null
    claims: {
      id: string
      description: string
      receivedAt: string
      status: string
      outcome: string | null
      resolution: string | null
      assignedTo: string | null
    }[]
  }
}
export type WarrantyDetailResult = WarrantyDetailResultOk | WarrantyResultErr

/** Detajl garancije z reklamacijami (org-scoped, missing → NOT_FOUND). */
export async function getWarrantyDetail(id: string): Promise<WarrantyDetailResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const row = await prisma.warranty.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: { select: { name: true } },
      document: { select: { number: true, type: true, fiscalYear: true } },
      claims: { orderBy: { receivedAt: "desc" } },
    },
  })
  if (!row) return err("NOT_FOUND")

  const hasOpenClaim = row.claims.some((c) => ["PENDING", "APPROVED", "PARTIAL"].includes(c.status))
  return {
    ok: true,
    warranty: {
      id: row.id,
      customerId: row.customerId,
      customerName: row.customer.name,
      subjectType: row.subjectType as WarrantySubjectType,
      subjectId: row.subjectId,
      documentCode: row.document ? docCode(row.document) : null,
      issuedDate: row.issuedDate.toISOString(),
      validFrom: row.validFrom.toISOString(),
      validUntil: row.validUntil?.toISOString() ?? null,
      validUntilMileage: row.validUntilMileage,
      warrantyPeriodDays: row.warrantyPeriodDays,
      terms: row.terms,
      status: computeWarrantyStatus({
        validUntil: row.validUntil,
        validUntilMileage: row.validUntilMileage,
        currentMileageKm: null,
        declared: row.status,
        hasOpenClaim,
      }),
      notes: row.notes,
      claims: row.claims.map((c) => ({
        id: c.id,
        description: c.description,
        receivedAt: c.receivedAt.toISOString(),
        status: c.status,
        outcome: c.outcome,
        resolution: c.resolution,
        assignedTo: c.assignedTo,
      })),
    },
  }
}

// ------------------------------------------------------------------
// PISANJE
// ------------------------------------------------------------------

/** Ustvari garancijo (lahko tudi avtomatsko iz računa, documentId). */
export async function createWarranty(input: WarrantyCreateInput): Promise<WarrantyActionResult> {
  const { org, session } = await requirePermissionOrg("finances.documents.manage")
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, organizationId: org.id }, select: { id: true } })
  if (!customer) return err("NOT_FOUND_CUSTOMER")

  // document (prostovoljno), če je podan — mora biti iste org.
  if (input.documentId) {
    const d = await prisma.document.findFirst({ where: { id: input.documentId, organizationId: org.id }, select: { id: true } })
    if (!d) return err("NOT_FOUND_DOCUMENT")
  }

  const def = warrantyDefaultsForProfile(org.vertical)
  const periodDays = input.warrantyPeriodDays ?? def.periodDays

  const validFrom = input.validFrom ? new Date(input.validFrom) : new Date()
  const validUntil = input.validUntil ? new Date(input.validUntil) : new Date(validFrom.getTime() + periodDays * 24 * 60 * 60 * 1000)

  const w = await prisma.warranty.create({
    data: {
      organizationId: org.id,
      customerId: input.customerId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      documentId: input.documentId ?? null,
      issuedDate: validFrom,
      validFrom,
      validUntil: input.subjectType === "REPAIR" && org.vertical === "tire-service" ? validUntil : validUntil,
      warrantyPeriodDays: periodDays,
      terms: input.terms ?? def.note,
      notes: input.notes,
      status: "ACTIVE",
      createdBy: session.user.id,
    },
  })
  revalidatePath("/dashboard/warranties")
  return { ok: true, id: w.id }
}

/** Ročno posodobi garancijo (termini, notes, status). */
export async function updateWarranty(
  id: string,
  input: { validUntil?: string; terms?: string; notes?: string; status?: string }
): Promise<WarrantyActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const existing = await prisma.warranty.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return err("NOT_FOUND")
  await prisma.warranty.update({
    where: { id },
    data: {
      ...(input.validUntil ? { validUntil: new Date(input.validUntil) } : {}),
      ...(input.terms !== undefined ? { terms: input.terms } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  })
  revalidatePath("/dashboard/warranties")
  revalidatePath(`/dashboard/warranties/${id}`)
  return { ok: true, id }
}

// ------------------------------------------------------------------
// REKLAMACIJE
// ------------------------------------------------------------------

/** Uveljavi reklamacijo na garanciji (append-only; ne spreminja garancije). */
export async function createWarrantyClaim(input: WarrantyClaimInput): Promise<WarrantyActionResult> {
  const { org, session } = await requirePermissionOrg("finances.documents.manage")
  const warranty = await prisma.warranty.findFirst({ where: { id: input.warrantyId, organizationId: org.id } })
  if (!warranty) return err("NOT_FOUND")
  if (!input.description?.trim()) return err("NO_DESCRIPTION")

  // Reklamacija marca garancijo kot CLAIMED (če še ni bila rešena ali zavrnjena).
  const claim = await prisma.$transaction(async (tx) => {
    const c = await tx.warrantyClaim.create({
      data: {
        organizationId: org.id,
        warrantyId: input.warrantyId,
        description: input.description.trim(),
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        assignedTo: input.assignedTo ?? null,
        status: input.status ?? "PENDING",
        createdBy: session.user.id,
      },
    })
    if (warranty.status !== "RESOLVED" && warranty.status !== "REJECTED") {
      await tx.warranty.update({ where: { id: warranty.id }, data: { status: "CLAIMED" } })
    }
    return c
  })
  revalidatePath("/dashboard/warranties")
  revalidatePath(`/dashboard/warranties/${input.warrantyId}`)
  return { ok: true, id: claim.id }
}

/** Posodobi rešitev reklamacije (resolution, outcome, status, assignedTo). */
export async function updateWarrantyClaim(
  claimId: string,
  input: WarrantyClaimUpdateInput
): Promise<WarrantyActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const claim = await prisma.warrantyClaim.findFirst({ where: { id: claimId, organizationId: org.id }, include: { warranty: { select: { id: true, status: true } } } })
  if (!claim) return err("NOT_FOUND")

  await prisma.warrantyClaim.update({
    where: { id: claimId },
    data: {
      ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
      ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  })

  // Kadar je reklamacija končna (RESOLVED ali REJECTED), osveži status garancije:
  // - RESOLVED → garancija nazaj na prejšnji dejanski status (ACTIVE/EXPIRED).
  // - REJECTED → garancija postane REJECTED (obvestilo uporabniku).
  const finalStatus = input.status
  if (finalStatus === "RESOLVED" && claim.warranty.status === "CLAIMED") {
    await prisma.warranty.update({ where: { id: claim.warrantyId }, data: { status: "ACTIVE" } })
  } else if (finalStatus === "REJECTED") {
    await prisma.warranty.update({ where: { id: claim.warrantyId }, data: { status: "REJECTED" } })
  }

  revalidatePath("/dashboard/warranties")
  revalidatePath(`/dashboard/warranties/${claim.warrantyId}`)
  return { ok: true, id: claimId }
}

/** Pregled statusov garancij (števci za dashboaraj opozoril). */
export async function getWarrantyStatusOverview(): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }> {
  const { org } = await requirePermissionOrg("finances.view")
  const all = await prisma.warranty.findMany({
    where: { organizationId: org.id },
    select: { id: true, validUntil: true, validUntilMileage: true, status: true },
  })
  const ids = all.map((r) => r.id)
  const openClaims = ids.length
    ? await prisma.warrantyClaim.groupBy({ by: ["warrantyId"], where: { warrantyId: { in: ids }, status: { in: ["PENDING", "APPROVED", "PARTIAL"] } }, _count: true })
    : []
  const openByWarranty = new Map(openClaims.map((c) => [c.warrantyId, c._count > 0]))
  const counts: Record<string, number> = {}
  for (const r of all) {
    const s = computeWarrantyStatus({
      validUntil: r.validUntil,
      validUntilMileage: r.validUntilMileage,
      currentMileageKm: null,
      declared: r.status,
      hasOpenClaim: openByWarranty.get(r.id) ?? false,
    })
    counts[s] = (counts[s] ?? 0) + 1
  }
  return { ok: true, counts }
}