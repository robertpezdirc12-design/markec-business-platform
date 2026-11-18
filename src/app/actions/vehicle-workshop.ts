"use server"

// ============================================================
// DELAVNICA VOZIL & VULKANIZERIJA (2D-1S) — poslovni sistem za
// `tire-service` / `mehanik`, brez spremembe sheme.
//
// Sledljivost gradi IZKLJUČNO na obstoječih modelih:
//   • Vehicle / tire_set = ExtensionRecord (vehicle-workshop),
//   • WorkOrder.linkedRecordId → vozilo (že obstaja),
//   • Poraba/prodaja delov = Order + OrderItem + StockMovement OUT
//     (source ORDER, orderId) — enak način kot createDirectOrder,
//   • Povezava delovni nalog ↔ naročilo prek Document
//     { workOrderId, orderId } + nextDocumentNumber (skladno z
//     dokumentnim številčenjem, NIKOLI vzporedna serija),
//   • Delovno nalog zgodovina = WorkOrderEvent (že obstaja).
//
// Vrsta zapisov `data.__tire_events` (na tire_set) je append-only
// (montaža/demontaža/selitev) — kot čebelarski `__fills`.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { orgToday } from "@/lib/org-date"
import { consumeOnWorkOrder, type ConsumptionResult } from "./work-order-consumption"
import { VEHICLE_WORKSHOP_CONSUMPTION_OPTS } from "@/lib/consumption-options"

const VEHICLE_KEY = "vehicle"
const TIRE_SET_KEY = "tire_set"

// ============================================================
// Pregledna plošča delavnice
// ============================================================

export interface TireServiceOverview {
  orgName: string
  counts: {
    vehicles: number
    tireSets: number
    workOrders: number
    activeWorkOrders: number
    completedWorkOrders: number
    todayOrders: number
    lowStockParts: number
  }
  recentWorkOrders: { id: string; number: number; title: string; status: string; currentStageKey: string | null; createdAt: Date }[]
  activeVehicles: { id: string; title: string; data: Record<string, unknown>; licensePlate: string; customerName: string | null }[]
  lowStock: { id: string; name: string; stock: number; reserved: number; available: number }[]
  parts: { id: string; name: string; stock: number; reserved: number; available: number }[]
}

export async function getTireServiceOverview(): Promise<TireServiceOverview | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)

  const [vehicleCount, tireCount, workOrderCount, activeCount, completedCount, todayOrders, vehicles, workOrders, parts] =
    await Promise.all([
      prisma.extensionRecord.count({ where: { organizationId: orgId, entityKey: VEHICLE_KEY } }),
      prisma.extensionRecord.count({ where: { organizationId: orgId, entityKey: TIRE_SET_KEY } }),
      prisma.workOrder.count({ where: { organizationId: orgId } }),
      prisma.workOrder.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.workOrder.count({ where: { organizationId: orgId, status: "COMPLETED" } }),
      prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: startToday } } }),
      prisma.extensionRecord.findMany({
        where: { organizationId: orgId, entityKey: VEHICLE_KEY },
        include: { customer: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.workOrder.findMany({
        where: { organizationId: orgId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.product.findMany({
        where: { organizationId: orgId, isActive: true, trackInventory: true },
        select: { id: true, name: true, stockQuantity: true, reservedQuantity: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ])

  const partRows = parts.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stockQuantity,
    reserved: p.reservedQuantity,
    available: Math.max(0, p.stockQuantity - p.reservedQuantity),
  }))
  const lowStock = partRows.filter((p) => p.available <= 5)

  return {
    orgName: org.name,
    counts: {
      vehicles: vehicleCount,
      tireSets: tireCount,
      workOrders: workOrderCount,
      activeWorkOrders: activeCount,
      completedWorkOrders: completedCount,
      todayOrders: todayOrders,
      lowStockParts: lowStock.length,
    },
    recentWorkOrders: workOrders.map((w) => ({
      id: w.id,
      number: w.number,
      title: w.title,
      status: w.status,
      currentStageKey: w.currentStageKey,
      createdAt: w.createdAt,
    })),
    activeVehicles: vehicles.map((v) => ({
      id: v.id,
      title: v.title,
      data: (v.data && typeof v.data === "object" ? v.data : {}) as Record<string, unknown>,
      licensePlate: String((v.data as Record<string, unknown>)?.license_plate ?? ""),
      customerName: v.customer?.name ?? null,
    })),
    lowStock,
    parts: partRows,
  }
}

// ============================================================
// Prodaja / poraba delov na delovnem nalogu.
// Uporablja UNIVERZALNO funkcijo consumeOnWorkOrder iz jedra.
// ============================================================

const partLineSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  quantity: z.number().int().positive().max(1_000_000),
})
const _workOrderPartsSchema = z.object({
  workOrderId: z.string().min(1).max(64),
  lines: z.array(partLineSchema).min(1).max(50),
  notes: z.string().max(500).nullable().optional(),
})

export interface WorkOrderPartsResult {
  ok: boolean
  error?: string
  orderId?: string
  documentId?: string
}

/**
 * Proda/porabi dele na delovnem nalogu.
 * DELEGIRA na univerzalno funkcijo consumeOnWorkOrder z opcijami za servis vozil.
 * Dokument se ustvari kot QUOTE (osnutek ponudbe), ne kot INVOICE —
 * ločitev med porabo in dejanskim računom.
 */
export async function sellPartsOnWorkOrder(
  input: z.input<typeof _workOrderPartsSchema>
): Promise<WorkOrderPartsResult> {
  const result: ConsumptionResult = await consumeOnWorkOrder(input, VEHICLE_WORKSHOP_CONSUMPTION_OPTS)
  return result as WorkOrderPartsResult
}

// ============================================================
// Sledljivost: delovni nalog → vozilo → deli → zaloga → zgodovina
// ============================================================

export interface WorkOrderPartProvenance {
  orderId: string
  documentNumber: number | null
  lines: { productId: string; productName: string; variantName: string | null; quantity: number; price: number }[]
  createdAt: Date
  stockMovements: { productId: string; productName: string; quantity: number }[]
}

export interface WorkOrderProvenance {
  workOrderId: string
  number: number
  title: string
  status: string
  currentStageKey: string | null
  vehicle: { id: string; title: string; licensePlate: string } | null
  customerName: string | null
  parts: WorkOrderPartProvenance[]
  events: { type: string; message: string | null; actorEmail: string | null; createdAt: Date }[]
}

export async function resolveWorkOrderProvenance(workOrderId: string): Promise<WorkOrderProvenance | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: orgId },
    include: {
      linkedRecord: { select: { id: true, title: true, data: true } },
      customer: { select: { name: true } },
      events: { select: { type: true, message: true, actorEmail: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!wo) return null

  // DRAFT dokumenti, ki povezujejo ta nalog z naročili (poraba delov).
  const docs = await prisma.document.findMany({
    where: { organizationId: orgId, workOrderId: wo.id, orderId: { not: null } },
    select: { id: true, number: true, fiscalYear: true, orderId: true },
  })
  const orderIds = docs.map((d) => d.orderId).filter((x): x is string => !!x)
  let parts: WorkOrderPartProvenance[] = []
  if (orderIds.length) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, organizationId: orgId },
      include: { items: { include: { product: { select: { name: true } } } } },
    })
    const movements = await prisma.stockMovement.findMany({
      where: { organizationId: orgId, orderId: { in: orderIds }, direction: "OUT" },
      include: { product: { select: { name: true } } },
    })
    parts = orders.map((o) => {
      const doc = docs.find((d) => d.orderId === o.id)
      const sms = movements.filter((m) => m.orderId === o.id).map((m) => ({ productId: m.productId, productName: m.product?.name ?? "—", quantity: m.quantity }))
      return {
        orderId: o.id,
        documentNumber: doc ? doc.number : null,
        lines: o.items.map((it) => ({
          productId: it.productId,
          productName: it.product?.name ?? "—",
          variantName: it.variantName,
          quantity: it.quantity,
          price: Number(it.price),
        })),
        createdAt: o.createdAt,
        stockMovements: sms,
      }
    })
  }

  return {
    workOrderId: wo.id,
    number: wo.number,
    title: wo.title,
    status: wo.status,
    currentStageKey: wo.currentStageKey,
    vehicle: wo.linkedRecord
      ? {
          id: wo.linkedRecord.id,
          title: wo.linkedRecord.title,
          licensePlate: String((wo.linkedRecord.data as Record<string, unknown>)?.license_plate ?? ""),
        }
      : null,
    customerName: wo.customer?.name ?? null,
    parts,
    events: wo.events.map((e) => ({ type: e.type, message: e.message, actorEmail: e.actorEmail, createdAt: e.createdAt })),
  }
}

// ============================================================
// Vozilo: podrobnost + zgodovina posegov
// ============================================================

export interface TireSetSummary {
  id: string
  title: string
  data: Record<string, unknown>
  dimension: string // e.g. "205/55 R16"
  season: string
  eventCount: number
}

export interface VehicleDetail {
  id: string
  title: string
  licensePlate: string
  data: Record<string, unknown>
  customerName: string | null
  customerId: string | null
  tireSets: TireSetSummary[]
  history: WorkOrderProvenance[] // vsi posegi na vozilu
}

export async function getVehicleDetail(vehicleId: string): Promise<VehicleDetail | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  const vehicle = await prisma.extensionRecord.findFirst({
    where: { id: vehicleId, organizationId: orgId, entityKey: VEHICLE_KEY },
    include: { customer: { select: { name: true } } },
  })
  if (!vehicle) return null

  // Kompleti pnevmatik, povezani z vozilom (prek data.__vehicleId).
  const allTireSets = await prisma.extensionRecord.findMany({ where: { organizationId: orgId, entityKey: TIRE_SET_KEY }, select: { id: true, title: true, data: true } })
  const tireSets = allTireSets
    .filter((t) => (t.data as Record<string, unknown>)?.__vehicleId === vehicle.id)
    .map<TireSetSummary>((t) => {
      const d = (t.data ?? {}) as Record<string, unknown>
      const events = Array.isArray(d.__tire_events) ? (d.__tire_events as unknown[]) : []
      return {
        id: t.id,
        title: t.title,
        data: d,
        dimension: `${d.width_mm ?? "?"}/${d.profile_pct ?? "?"} R${d.diameter_in ?? "?"}`,
        season: String(d.season ?? ""),
        eventCount: events.length,
      }
    })

  // Delovni nalogi vozila: prvi prek linkedRecordId + vsi (vklj. ponovni
  // obiski) prek vozila.data.__workOrderIds (append-only, ker je
  // WorkOrder.linkedRecordId @unique — shematska omejitev).
  const vehData = (vehicle.data ?? {}) as Record<string, unknown>
  const linkedIds: string[] = Array.isArray(vehData.__workOrderIds) ? (vehData.__workOrderIds as string[]) : []
  const woRows = await prisma.workOrder.findMany({
    where: { organizationId: orgId, OR: [{ linkedRecordId: vehicle.id }, { id: { in: linkedIds as string[] } }] },
    select: { id: true },
  })

  const history: WorkOrderProvenance[] = []
  for (const w of woRows) {
    const prov = await resolveWorkOrderProvenance(w.id)
    if (prov) history.push(prov)
  }
  history.sort((a, b) => a.number - b.number)

  return {
    id: vehicle.id,
    title: vehicle.title,
    licensePlate: String((vehicle.data as Record<string, unknown>)?.license_plate ?? ""),
    data: (vehicle.data ?? {}) as Record<string, unknown>,
    customerName: vehicle.customer?.name ?? null,
    customerId: vehicle.customerId,
    tireSets,
    history,
  }
}

// ============================================================
// Komplet pnevmatik: append-only montaža/demontaža/selitev
// ============================================================

const tireEventSchema = z.object({
  tireSetId: z.string().min(1).max(64),
  eventType: z.enum(["MOUNT", "DEMOUNT", "MOVE", "STORAGE", "STATUS"]),
  vehicleId: z.string().min(1).max(64).nullable().optional(),
  workOrderId: z.string().min(1).max(64).nullable().optional(),
  eventDate: z.string().optional(),
  treadMm: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export interface TireEventResult {
  ok: boolean
  error?: string
}

interface TireEventRecord {
  eventType: string
  vehicleId: string | null
  workOrderId: string | null
  eventDate: string
  treadMm?: number | null
  status?: string | null
  notes?: string | null
  performedBy: string | null
  createdAt: string
}

/**
 * Zabeleži dogodek na komplet pnevmatik (append-only v data.__tire_events)
 * in po potrebi poveže komplet z vozilom (data.__vehicleId). Nikoli ne
 * spreminja starih dogodkov — zgodovina ostane čista.
 */
export async function recordTireSetEvent(input: z.input<typeof tireEventSchema>): Promise<TireEventResult> {
  const parsed = tireEventSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data
  const { org, session } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  // Pred transakcijo (orgToday odpre svojo povezavo — ne znotraj tx).
  const eventDate = data.eventDate || (await orgToday(orgId))

  try {
    return await prisma.$transaction(async (tx) => {
      const tire = await tx.extensionRecord.findFirst({ where: { id: data.tireSetId, organizationId: orgId, entityKey: TIRE_SET_KEY }, select: { id: true, data: true } })
      if (!tire) throw new Error("TIRE_SET_NOT_FOUND")

      const vehicleId: string | null = data.vehicleId ?? null
      if (vehicleId) {
        const v = await tx.extensionRecord.findFirst({ where: { id: vehicleId, organizationId: orgId, entityKey: VEHICLE_KEY }, select: { id: true } })
        if (!v) throw new Error("VEHICLE_NOT_FOUND")
      }
      if (data.workOrderId) {
        const w = await tx.workOrder.findFirst({ where: { id: data.workOrderId, organizationId: orgId }, select: { id: true } })
        if (!w) throw new Error("WORKORDER_NOT_FOUND")
      }

      const prevData = (tire.data ?? {}) as Record<string, unknown>
      const prevEvents = Array.isArray(prevData.__tire_events) ? (prevData.__tire_events as TireEventRecord[]) : []
      const evt: TireEventRecord = {
        eventType: data.eventType,
        vehicleId,
        workOrderId: data.workOrderId ?? null,
        eventDate,
        treadMm: data.treadMm ?? (typeof prevData.tread_mm === "number" ? prevData.tread_mm : null),
        status: data.status ?? null,
        notes: data.notes ?? null,
        performedBy: session.user?.email ?? null,
        createdAt: new Date().toISOString(),
      }
      const nextData: Record<string, unknown> = { ...prevData, __tire_events: [...prevEvents, evt] }
      if (vehicleId) nextData.__vehicleId = vehicleId

      await tx.extensionRecord.update({ where: { id: tire.id }, data: { data: nextData as unknown as Prisma.InputJsonValue } })
      return { ok: true }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (["TIRE_SET_NOT_FOUND", "VEHICLE_NOT_FOUND", "WORKORDER_NOT_FOUND"].includes(msg)) return { ok: false, error: msg }
    return { ok: false, error: "TRANSACTION_FAILED" }
  } finally {
    revalidatePath("/dashboard/tire-service")
  }
}

// ============================================================
// Delovni nalog za vozilo delavnice (poljubno ponovnih obiskov).
// Ker je WorkOrder.linkedRecordId @unique (vsaj EN nalog na vozilo
// FIFO), pri ponovnih obiskih vozilo drži seznam __workOrderIds v
// svojem data JSON (append-only) — tako je zgodovina vozila polna
// brez spremembe sheme.
// ============================================================

const woInputSchema = z.object({
  vehicleId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  dueDate: z.string().optional().nullable(),
  priority: z.string().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export interface WorkshopWorkOrderResult {
  ok: boolean
  error?: string
  workOrderId?: string
}

export async function createWorkshopWorkOrder(input: z.input<typeof woInputSchema>): Promise<WorkshopWorkOrderResult> {
  const parsed = woInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  const vehicle = await prisma.extensionRecord.findFirst({ where: { id: parsed.data.vehicleId, organizationId: orgId, entityKey: VEHICLE_KEY }, select: { id: true, data: true } })
  if (!vehicle) return { ok: false, error: "VEHICLE_NOT_FOUND" }

  const def = await prisma.workflowDefinition.findFirst({ where: { organizationId: orgId, entity: "order", isActive: true }, select: { id: true } })
  if (!def) return { ok: false, error: "NO_WORKFLOW" }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Ali ima vozilo že delovni nalog prek linkedRecordId? Kliče se z
      // linkedRecordId SAMO za prvi nalog, da @unique ne pade.
      const existingLinked = await tx.workOrder.count({ where: { organizationId: orgId, linkedRecordId: vehicle.id } })
      const linkRec = existingLinked === 0 ? vehicle.id : null
      const max = await tx.workOrder.aggregate({ where: { organizationId: orgId }, _max: { number: true } })
      const number = (max._max.number ?? 0) + 1

      // Append-only seznam nalogov vozila (pred shranjevanjem ID se le prebere).
      const prev = (vehicle.data ?? {}) as Record<string, unknown>
      const prevIds: string[] = Array.isArray(prev.__workOrderIds) ? (prev.__workOrderIds as string[]) : []

      const wo = await tx.workOrder.create({
        data: {
          organizationId: orgId,
          number,
          title: parsed.data.title,
          status: "OPEN",
          priority: parsed.data.priority ?? "NORMAL",
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          notes: parsed.data.notes ?? null,
          linkedRecordId: linkRec,
          workflowDefinitionId: def.id,
          currentStageKey: (await tx.workflowStage.findFirst({ where: { definitionId: def.id }, orderBy: { order: "asc" }, select: { key: true } }))!.key,
          events: { create: { organizationId: orgId, type: "CREATED", message: parsed.data.title, actorEmail: null } },
        },
      })
      // Vpiši ID naloga v vozilo (append-only zgodovina ponovnih obiskov).
      await tx.extensionRecord.update({ where: { id: vehicle.id }, data: { data: { ...prev, __workOrderIds: [...prevIds, wo.id] } } })
      return { workOrderId: wo.id }
    })
    revalidatePath("/dashboard/tire-service")
    return { ok: true, workOrderId: created.workOrderId }
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

// ============================================================
// Seznami za UI (opcije): vozila in kompleti pnevmatik (org-scoped)
// ============================================================

export async function listWorkshopOptions() {
  const { org } = await requirePermissionOrg("workorders.manage")
  const [vehicles, tireSets, products, workOrders] = await Promise.all([
    prisma.extensionRecord.findMany({ where: { organizationId: org.id, entityKey: VEHICLE_KEY }, select: { id: true, title: true, data: true }, orderBy: { title: "asc" }, take: 200 }),
    prisma.extensionRecord.findMany({ where: { organizationId: org.id, entityKey: TIRE_SET_KEY }, select: { id: true, title: true, data: true }, orderBy: { title: "asc" }, take: 200 }),
    prisma.product.findMany({ where: { organizationId: org.id, isActive: true, trackInventory: true }, select: { id: true, name: true, price: true, variants: { select: { id: true, name: true, price: true } } }, orderBy: { name: "asc" }, take: 200 }),
    prisma.workOrder.findMany({ where: { organizationId: org.id, status: "OPEN" }, select: { id: true, number: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ])
  return {
    vehicles: vehicles.map((v) => ({ id: v.id, title: v.title, licensePlate: String((v.data as Record<string, unknown>)?.license_plate ?? "") })),
    tireSets: tireSets.map((t) => {
      const d = (t.data ?? {}) as Record<string, unknown>
      return {
        id: t.id,
        title: t.title,
        dimension: `${d.width_mm ?? "?"}/${d.profile_pct ?? "?"} R${d.diameter_in ?? "?"}`,
        season: String(d.season ?? ""),
        vehicleId: typeof d.__vehicleId === "string" ? d.__vehicleId : null,
      }
    }),
    products: products.map((p) => ({
      productId: p.id,
      productName: p.name,
      price: Number(p.price),
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: Number(v.price ?? p.price) })),
    })),
    workOrders: workOrders.map((w) => ({ id: w.id, number: w.number, title: w.title })),
  }
}