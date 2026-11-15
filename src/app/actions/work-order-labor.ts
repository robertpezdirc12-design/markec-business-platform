"use server"

// ============================================================
// SLEDENJE DELOVNEMU ČASU (FAZA 1 — OJAČANJE JEDRA)
//
// Beleženje delovnega časa na delovnem nalogu po zaposlenem.
// Omogoča izračun dejanskih stroškov dela in analizo donosnosti.
//
// Delovni čas = ExtensionRecord (work_order_labor entiteta),
// povezan z delovnim nalogom in zaposlenim.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const LABOR_EXT = "work-order-labor"
const LABOR_KEY = "work_order_labor"

// ============================================================
// Sheme in vmesniki
// ============================================================

const addLaborSchema = z.object({
  workOrderId: z.string().min(1).max(64),
  staffId: z.string().min(1).max(64).optional(), // zaposleni (Staff)
  performedBy: z.string().max(100).optional(), // ročno vneseno ime, če ni staffId
  hours: z.number().positive().max(1000), // ure dela
  hourlyRate: z.number().nonnegative().optional(), // urni postavček
  description: z.string().max(500).optional(), // opis opravljenega dela
  workDate: z.string().optional(), // ISO datum dela
})

const updateLaborSchema = z.object({
  hours: z.number().positive().max(1000).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  description: z.string().max(500).optional(),
  workDate: z.string().optional(),
})

export interface LaborEntry {
  id: string
  workOrderId: string
  workOrderNumber: number | null
  workOrderTitle: string | null
  staffId: string | null
  staffName: string | null
  performedBy: string | null
  hours: number
  hourlyRate: number | null
  totalCost: number | null
  description: string | null
  workDate: string
  createdAt: string
  createdBy: string | null
}

export interface WorkOrderLaborSummary {
  totalHours: number
  totalCost: number | null
  entries: LaborEntry[]
  byStaff: {
    staffId: string | null
    name: string
    hours: number
    cost: number | null
  }[]
}

export interface LaborResult {
  ok: boolean
  error?: string
  id?: string
}

// ============================================================
// Pomožne funkcije
// ============================================================

/** Pretvori vnos iz baze v LaborEntry. */
function toLaborEntry(r: {
  id: string
  data: unknown
  createdAt: Date
  createdBy?: { email: string | null } | null
}): LaborEntry {
  const d = (r.data ?? {}) as Record<string, unknown>
  const hours = typeof d.hours === "number" ? d.hours : 0
  const rate = typeof d.hourly_rate === "number" ? d.hourly_rate : null
  return {
    id: r.id,
    workOrderId: String(d.work_order_id ?? ""),
    workOrderNumber: typeof d.work_order_number === "number" ? d.work_order_number : null,
    workOrderTitle: typeof d.work_order_title === "string" ? d.work_order_title : null,
    staffId: typeof d.staff_id === "string" ? d.staff_id : null,
    staffName: typeof d.staff_name === "string" ? d.staff_name : null,
    performedBy: typeof d.performed_by === "string" ? d.performed_by : null,
    hours,
    hourlyRate: rate,
    totalCost: rate !== null ? hours * rate : null,
    description: typeof d.description === "string" ? d.description : null,
    workDate: typeof d.work_date === "string" ? d.work_date : r.createdAt.toISOString().slice(0, 10),
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy?.email ?? null,
  }
}

// ============================================================
// Osnovne akcije
// ============================================================

/**
 * Dodaj delovni čas na delovni nalog.
 */
export async function addLaborEntry(input: z.input<typeof addLaborSchema>): Promise<LaborResult> {
  const parsed = addLaborSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { org, session } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Preveri delovni nalog
      const wo = await tx.workOrder.findFirst({
        where: { id: data.workOrderId, organizationId: orgId },
        select: { id: true, number: true, title: true },
      })
      if (!wo) throw new Error("WORKORDER_NOT_FOUND")

      // Preveri zaposlenega (če je podan)
      let staffName: string | null = null
      if (data.staffId) {
        const staff = await tx.staff.findFirst({
          where: { id: data.staffId, organizationId: orgId },
          select: { id: true, name: true },
        })
        if (!staff) throw new Error("STAFF_NOT_FOUND")
        staffName = staff.name
      }

      const workDate = data.workDate || new Date().toISOString().slice(0, 10)
      const hourlyRate = data.hourlyRate ?? null
      const totalCost = hourlyRate !== null ? data.hours * hourlyRate : null

      const recordData: Record<string, unknown> = {
        work_order_id: wo.id,
        work_order_number: wo.number,
        work_order_title: wo.title,
        staff_id: data.staffId ?? null,
        staff_name: staffName,
        performed_by: data.performedBy ?? staffName,
        hours: data.hours,
        hourly_rate: hourlyRate,
        total_cost: totalCost,
        description: data.description ?? null,
        work_date: workDate,
      }

      const title = `${wo.number} · ${staffName || data.performedBy || "Delo"} · ${data.hours}h`

      const created = await tx.extensionRecord.create({
        data: {
          organizationId: orgId,
          extensionId: LABOR_EXT,
          entityKey: LABOR_KEY,
          title,
          data: recordData as unknown as Prisma.InputJsonValue,
        },
      })

      // Dodaj dogodek v delovni nalog
      await tx.workOrderEvent.create({
        data: {
          organizationId: orgId,
          workOrderId: wo.id,
          type: "NOTE",
          message: `Delovni čas: ${data.hours}h${staffName ? ` (${staffName})` : ""}${data.description ? ` — ${data.description.slice(0, 100)}` : ""}`,
          actorEmail: session.user?.email ?? null,
        },
      })

      return { id: created.id }
    })

    revalidatePath("/dashboard/work-orders")
    revalidatePath(`/dashboard/work-orders/${data.workOrderId}`)
    return { ok: true, id: result.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "WORKORDER_NOT_FOUND") return { ok: false, error: "WORKORDER_NOT_FOUND" }
    if (msg === "STAFF_NOT_FOUND") return { ok: false, error: "STAFF_NOT_FOUND" }
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

/**
 * Posodobi obstoječi vnos delovnega časa.
 */
export async function updateLaborEntry(
  id: string,
  input: z.input<typeof updateLaborSchema>
): Promise<LaborResult> {
  const parsed = updateLaborSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  try {
    const record = await prisma.extensionRecord.findFirst({
      where: { id, organizationId: orgId, entityKey: LABOR_KEY },
      select: { id: true, data: true },
    })
    if (!record) return { ok: false, error: "NOT_FOUND" }

    const prev = (record.data ?? {}) as Record<string, unknown>
    const next: Record<string, unknown> = { ...prev }

    if (parsed.data.hours !== undefined) {
      next.hours = parsed.data.hours
      // Ponovno izračunaj skupni strošek
      const rate = typeof next.hourly_rate === "number" ? next.hourly_rate : null
      next.total_cost = rate !== null ? parsed.data.hours * rate : null
    }
    if (parsed.data.hourlyRate !== undefined) {
      next.hourly_rate = parsed.data.hourlyRate
      const hours = typeof next.hours === "number" ? next.hours : 0
      next.total_cost = parsed.data.hourlyRate * hours
    }
    if (parsed.data.description !== undefined) next.description = parsed.data.description || null
    if (parsed.data.workDate !== undefined) next.work_date = parsed.data.workDate

    await prisma.extensionRecord.update({
      where: { id: record.id },
      data: {
        data: next as unknown as Prisma.InputJsonValue,
      },
    })

    revalidatePath("/dashboard/work-orders")
    return { ok: true, id: record.id }
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

/**
 * Izbriši vnos delovnega časa.
 */
export async function deleteLaborEntry(id: string): Promise<LaborResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: orgId, entityKey: LABOR_KEY },
    select: { id: true },
  })
  if (!record) return { ok: false, error: "NOT_FOUND" }

  await prisma.extensionRecord.delete({ where: { id: record.id } })

  revalidatePath("/dashboard/work-orders")
  return { ok: true, id: record.id }
}

/**
 * Vrni vse vnose delovnega časa za en delovni nalog.
 */
export async function getWorkOrderLabor(workOrderId: string): Promise<WorkOrderLaborSummary | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  // Preveri, da je delovni nalog v tej org
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: orgId },
    select: { id: true },
  })
  if (!wo) return null

  const records = await prisma.extensionRecord.findMany({
    where: {
      organizationId: orgId,
      entityKey: LABOR_KEY,
      // Filtriramo samo tiste, ki pripadajo temu delovnemu nalogu — filter se
      // izvede V BAZI (JSON path query), ne v JavaScriptu po prenosu vseh vnosov.
      data: { path: ["work_order_id"], equals: workOrderId } as Prisma.JsonFilter,
    },
    orderBy: { createdAt: "desc" },
  })

  const entries = records.map(toLaborEntry)

  // Izračun skupaj
  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  const totalCost = entries.every((e) => e.totalCost !== null)
    ? entries.reduce((s, e) => s + (e.totalCost ?? 0), 0)
    : null

  // Po zaposlenih
  const byStaffMap = new Map<
    string,
    { staffId: string | null; name: string; hours: number; cost: number | null }
  >()
  for (const e of entries) {
    const key = e.staffId || `manual:${e.performedBy || "neznano"}`
    const existing = byStaffMap.get(key)
    if (existing) {
      existing.hours += e.hours
      if (existing.cost !== null && e.totalCost !== null) {
        existing.cost += e.totalCost
      } else {
        existing.cost = null
      }
    } else {
      byStaffMap.set(key, {
        staffId: e.staffId,
        name: e.staffName || e.performedBy || "Neznano",
        hours: e.hours,
        cost: e.totalCost,
      })
    }
  }

  return {
    totalHours,
    totalCost,
    entries,
    byStaff: Array.from(byStaffMap.values()),
  }
}

/**
 * Vrni vse vnose delovnega časa za celotno organizacijo (za poročila).
 */
export async function listAllLaborEntries(dateFrom?: string, dateTo?: string): Promise<LaborEntry[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: LABOR_KEY },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  let entries = records.map(toLaborEntry)

  // Filtriranje po datumu
  if (dateFrom) {
    entries = entries.filter((e) => e.workDate >= dateFrom)
  }
  if (dateTo) {
    entries = entries.filter((e) => e.workDate <= dateTo)
  }

  return entries
}

// ============================================================
// Seznam zaposlenih za UI
// ============================================================

export interface StaffOption {
  id: string
  name: string
  email: string | null
  phone: string | null
  defaultTipPercent: number | null
}

/**
 * Seznam zaposlenih za izbiro pri beleženju časa.
 */
export async function listLaborStaffOptions(): Promise<StaffOption[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const staff = await prisma.staff.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, name: true, email: true, phone: true, defaultTipPercent: true },
    orderBy: { name: "asc" },
  })
  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    defaultTipPercent: s.defaultTipPercent ? Number(s.defaultTipPercent) : null,
  }))
}
