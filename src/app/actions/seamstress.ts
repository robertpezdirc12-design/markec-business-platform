"use server"

// ============================================================
// ŠIVILJSTVO (2D-2B) — poslovni sistem za `seamstress`.
// Brez spremembe sheme — na obstoječi infrastrukturi:
//   • Meritve = ExtensionRecord (seamstress-measurements, `measurement`,
//     APPEND-ONLY → vsaka meritev nov zapis z datumom; zgodovina nič
//     ni prepisana).
//   • Naročilo = WorkOrder (9-stopenjski proizvodni proces
//     production-order: Povpraševanje → Meritve → Predračun →
//     Potrditev → Izdelava → Priblon → Predaja → Plačilo → Zaključeno).
//     `linkedRecordId → measurement`, `customerId → stranka`,
//     `dueDate → rok`, `total → dogovorjena cena`, `notes → specifikacija`.
//   • Poraba materiala = Order + OrderItem + StockMovement OUT
//     (CAS, brez negativne zaloge) + Document { workOrderId, orderId }
//     (skladno z dokumentnim številčenjem).
//   • Provenance = resolveSeamstressProvenance (naročilo → mere →
//     materiali → zaloga → izdelano → predaja → plačilo).
// Vse akcije so STRICtno org-scoped (requirePermissionOrg).
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { nextDocumentNumber, fiscalYearOf } from "@/lib/documents/numbering"
import { advanceWorkOrder } from "./work-orders"

const MEASURE_EXT = "seamstress-measurements"
const MEASURE_KEY = "measurement"

// ============================================================
// Meritve strank (append-only zgodovina)
// ============================================================

const measurementSchema = z.object({
  customerId: z.string().min(1),
  measuredAt: z.string().min(1), // ISO date "YYYY-MM-DD"
  chestCm: z.number().optional(),
  waistCm: z.number().optional(),
  hipsCm: z.number().optional(),
  shoulderCm: z.number().optional(),
  sleeveCm: z.number().optional(),
  inseamCm: z.number().optional(),
  heightCm: z.number().optional(),
  byStaff: z.string().optional(),
  notes: z.string().optional(),
  orderRef: z.string().optional(),
})

export interface MeasurementResult {
  ok: boolean
  error?: string
  measurementId?: string
}

/** Human title from a measurement's meaningful values (titulo za list). */
function measurementTitle(d: { measuredAt: string; chestCm?: number; waistCm?: number; hipsCm?: number; notes?: string }): string {
  const parts: string[] = []
  if (d.chestCm) parts.push(`${d.chestCm} prsi`)
  if (d.waistCm) parts.push(`${d.waistCm} pas`)
  if (d.hipsCm) parts.push(`${d.hipsCm} boki`)
  const base = parts.length ? parts.join(" · ") : "Merilni list"
  return `${d.measuredAt} — ${base}`
}

/**
 * Sneme (ustvari) novo meritev stranke. Append-only — vedno nov `measurement`
 * zapis, NIKOLI update/delete → zgodovina meritev se ohranja. Stranka mora
 * biti v tej org (ne IDOR).
 */
export async function saveMeasurement(input: z.input<typeof measurementSchema>): Promise<MeasurementResult> {
  const parsed = measurementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const d = parsed.data

  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, organizationId: orgId },
    select: { id: true },
  })
  if (!customer) return { ok: false, error: "CUSTOMER_NOT_FOUND" }

  const data = {
    measured_at: d.measuredAt,
    chest_cm: d.chestCm,
    waist_cm: d.waistCm,
    hips_cm: d.hipsCm,
    shoulder_cm: d.shoulderCm,
    sleeve_cm: d.sleeveCm,
    inseam_cm: d.inseamCm,
    height_cm: d.heightCm,
    by_staff: d.byStaff,
    notes: d.notes,
    order_ref: d.orderRef,
  }

  const rec = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId,
      extensionId: MEASURE_EXT,
      entityKey: MEASURE_KEY,
      title: measurementTitle({
        measuredAt: d.measuredAt,
        chestCm: d.chestCm,
        waistCm: d.waistCm,
        hipsCm: d.hipsCm,
        notes: d.notes,
      }),
      data: data as unknown as Prisma.InputJsonValue,
      customerId: d.customerId,
    },
    select: { id: true },
  })

  revalidatePath("/dashboard/seamstress")
  revalidatePath("/dashboard/customers")
  return { ok: true, measurementId: rec.id }
}

export interface MeasurementItem {
  id: string
  measuredAt: string | null
  chestCm?: number
  waistCm?: number
  hipsCm?: number
  shoulderCm?: number
  sleeveCm?: number
  inseamCm?: number
  heightCm?: number
  byStaff: string | null
  notes: string | null
  orderRef: string | null
  workOrderIds: string[]
  customerId: string | null
  customerName: string | null
  createdAt: Date
}

function toMeasurementItem(r: {
  id: string
  data: unknown
  customerId: string | null
  createdAt: Date
  customer: { name: string } | null
}): MeasurementItem {
  const d = (r.data ?? {}) as Record<string, unknown>
  return {
    id: r.id,
    measuredAt: typeof d.measured_at === "string" ? d.measured_at : null,
    chestCm: typeof d.chest_cm === "number" ? d.chest_cm : undefined,
    waistCm: typeof d.waist_cm === "number" ? d.waist_cm : undefined,
    hipsCm: typeof d.hips_cm === "number" ? d.hips_cm : undefined,
    shoulderCm: typeof d.shoulder_cm === "number" ? d.shoulder_cm : undefined,
    sleeveCm: typeof d.sleeve_cm === "number" ? d.sleeve_cm : undefined,
    inseamCm: typeof d.inseam_cm === "number" ? d.inseam_cm : undefined,
    heightCm: typeof d.height_cm === "number" ? d.height_cm : undefined,
    byStaff: typeof d.by_staff === "string" ? d.by_staff : null,
    notes: typeof d.notes === "string" ? d.notes : null,
    orderRef: typeof d.order_ref === "string" ? d.order_ref : null,
    workOrderIds: Array.isArray((r.data as Record<string, unknown>)?.__workOrderIds)
      ? ((r.data as Record<string, unknown>).__workOrderIds as unknown[]).map(String)
      : [],
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    createdAt: r.createdAt,
  }
}

/** Zgodovina meritev stranke (org-scoped, najnovejša prva). */
export async function listMeasurements(customerId: string): Promise<MeasurementItem[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { id: true },
  })
  if (!customer) return []

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: MEASURE_KEY, customerId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  return records.map(toMeasurementItem)
}

/** Vse meritve org (preglednica) — najnovejša prva. */
export async function listAllMeasurements(): Promise<MeasurementItem[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, entityKey: MEASURE_KEY },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  return records.map(toMeasurementItem)
}

// ============================================================
// Naročilo po meri (WorkOrder — proizvodni proces)
// ============================================================

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(), // specifikacija/opis izdelka
  notes: z.string().optional(),
  agreedPrice: z.number().nonnegative().optional(),
  deadline: z.string().optional(), // ISO "YYYY-MM-DD"
  measurementId: z.string().optional(),
  photoIds: z.array(z.string()).optional(), // Media IDs
})

export interface CreateOrderResult {
  ok: boolean
  error?: string
  workOrderId?: string
}

/**
 * Ustvari delovno naročilo iz povpraševanja stranke v PRVI stopnji
 * proizvodnega procesa (Povpraševanje). Poveže merilni list (če ga je
 * stranka snela) → prepreči podvojen nalog za isti merilni list.
 * Podvajanje: en merilni list → največ eno ODPRTO delovno naročilo.
 */
export async function createOrderFromInquiry(input: z.input<typeof createOrderSchema>): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const d = parsed.data

  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, organizationId: orgId },
    select: { id: true },
  })
  if (!customer) return { ok: false, error: "CUSTOMER_NOT_FOUND" }

  let measurement:
    | { id: string; title: string; data: unknown }
    | null = null
  if (d.measurementId) {
    measurement = await prisma.extensionRecord.findFirst({
      where: {
        id: d.measurementId,
        organizationId: orgId,
        extensionId: MEASURE_EXT,
        entityKey: MEASURE_KEY,
        customerId: d.customerId,
      },
      select: { id: true, title: true, data: true },
    })
    if (!measurement) return { ok: false, error: "MEASUREMENT_NOT_FOUND" }

    // Prepreči podvajanje: obstoječe ODPRTO delovno naročilo za ta merilni list?
    const existingWo = await prisma.workOrder.findFirst({
      where: { organizationId: orgId, linkedRecordId: measurement.id, status: "OPEN" },
      select: { id: true },
    })
    if (existingWo) return { ok: false, error: "ALREADY_CREATED", workOrderId: existingWo.id }
  }

  const def = await prisma.workflowDefinition.findFirst({
    where: { organizationId: orgId, entity: "order", isActive: true },
    select: { id: true },
  })
  if (!def) return { ok: false, error: "NO_WORKFLOW" }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const max = await tx.workOrder.aggregate({ where: { organizationId: orgId }, _max: { number: true } })
      const number = (max._max.number ?? 0) + 1
      const firstStage = await tx.workflowStage.findFirst({
        where: { definitionId: def.id },
        orderBy: { order: "asc" },
        select: { key: true },
      })

      const title = d.title.trim()
      const notes = d.description?.trim()
        ? `${d.description.trim()}${d.notes?.trim() ? `\n${d.notes.trim()}` : ""}`
        : d.notes?.trim()

      const wo = await tx.workOrder.create({
        data: {
          organizationId: orgId,
          number,
          title,
          status: "OPEN",
          priority: "NORMAL",
          dueDate: d.deadline ? new Date(d.deadline) : null,
          total: d.agreedPrice ?? null,
          notes,
          linkedRecordId: measurement?.id ?? null,
          customerId: d.customerId,
          workflowDefinitionId: def.id,
          currentStageKey: firstStage?.key ?? null,
          events: {
            create: {
              organizationId: orgId,
              type: "CREATED",
              message: `Povpraševanje: ${title}${d.measurementId ? " (z merilnim listom)" : ""}`,
              actorEmail: null,
            },
          },
        },
      })

      // Poveži merilni list → delovni nalog (append __workOrderIds).
      if (measurement) {
        const prev = (measurement.data ?? {}) as Record<string, unknown>
        const prevIds: string[] = Array.isArray(prev.__workOrderIds)
          ? (prev.__workOrderIds as unknown[]).map(String)
          : []
        await tx.extensionRecord.update({
          where: { id: measurement.id },
          data: {
            data: { ...prev, __workOrderIds: [...prevIds, wo.id] } as unknown as Prisma.InputJsonValue,
          },
        })
      }

      return { workOrderId: wo.id }
    })

    revalidatePath("/dashboard/seamstress")
    revalidatePath("/dashboard/work-orders")
    return { ok: true, workOrderId: result.workOrderId }
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

/** Napredek izdelave: trenutna stopnja in zgodovina (WorkOrderEvent). */
export async function getOrderProgress(workOrderId: string) {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: orgId },
    include: {
      workflowDefinition: { include: { stages: { orderBy: { order: "asc" } } } },
      events: { orderBy: { createdAt: "asc" }, select: { type: true, message: true, fromStageKey: true, toStageKey: true, createdAt: true, actorEmail: true } },
    },
  })
  if (!wo) return null
  return {
    workOrderId: wo.id,
    number: wo.number,
    title: wo.title,
    status: wo.status,
    currentStageKey: wo.currentStageKey,
    stageIndex: wo.workflowDefinition?.stages.findIndex((s) => s.key === wo.currentStageKey) ?? -1,
    stageCount: wo.workflowDefinition?.stages.length ?? 0,
    events: wo.events,
  }
}

// ============================================================
// Poraba materiala / blaga (CAS, brez negativne zaloge)
// ============================================================

const materialLineSchema = z.object({
  productId: z.string().min(1),
  productVariantId: z.string().optional(),
  quantity: z.number().int().positive(),
})

const consumeMaterialSchema = z.object({
  workOrderId: z.string().min(1),
  lines: z.array(materialLineSchema).min(1),
  notes: z.string().optional(),
})

export interface ConsumeMaterialResult {
  ok: boolean
  error?: string
  orderId?: string
  documentId?: string
}

/** Atomarno zniža zalogo (CAS — nikoli pod razpoložljivo). */
async function decrementStock(
  tx: Prisma.TransactionClient,
  table: "Product" | "ProductVariant",
  id: string,
  qty: number
): Promise<boolean> {
  const r = await tx.$executeRawUnsafe(
    `UPDATE "${table}" SET "stockQuantity" = "stockQuantity" - $2::int
     WHERE "id" = $1::text AND "stockQuantity" - "reservedQuantity" >= $2::int`,
    id,
    qty
  )
  return r === 1
}

/**
 * Porabi blago/material na šiviljskem delovnem nalogu. Zniža zalogo (CAS,
 * ni negativne/rezervirane), ustvari Order + OrderItem + StockMovement OUT +
 * DRAFT Document { workOrderId, orderId } + WorkOrderEvent. Napaka → rollback.
 */
export async function consumeMaterialOnWorkOrder(input: z.input<typeof consumeMaterialSchema>): Promise<ConsumeMaterialResult> {
  const parsed = consumeMaterialSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { org, session } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const wo = await prisma.workOrder.findFirst({
    where: { id: data.workOrderId, organizationId: orgId },
    select: { id: true, customerId: true },
  })
  if (!wo) return { ok: false, error: "WORKORDER_NOT_FOUND" }

  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: orgId, isActive: true },
    select: { id: true, name: true, price: true, trackInventory: true },
  })
  if (products.length !== productIds.length) return { ok: false, error: "NOT_FOUND" }
  const productById = new Map(products.map((p) => [p.id, p]))

  const variantIds = data.lines.map((l) => l.productVariantId).filter((v): v is string => typeof v === "string" && v.length > 0)
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({ where: { id: { in: variantIds }, organizationId: orgId }, select: { id: true, productId: true, name: true, sku: true, price: true } })
    : []
  if (variants.length !== variantIds.length) return { ok: false, error: "VARIANT_NOT_FOUND" }
  for (const l of data.lines) {
    if (!l.productVariantId) continue
    const v = variants.find((x) => x.id === l.productVariantId)
    if (!v || v.productId !== l.productId) return { ok: false, error: "VARIANT_MISMATCH" }
  }
  const variantById = new Map(variants.map((v) => [v.id, v]))

  try {
    const result = await prisma.$transaction(async (tx) => {
      const decrements: { productId: string; variantId?: string | null }[] = []
      for (const line of data.lines) {
        if (line.productVariantId) {
          const ok = await decrementStock(tx, "ProductVariant", line.productVariantId, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId, variantId: line.productVariantId })
        } else {
          const p = productById.get(line.productId)!
          if (!p.trackInventory) throw new Error("NOT_TRACKED")
          const ok = await decrementStock(tx, "Product", line.productId, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId })
        }
      }

      let subtotal = 0
      for (const l of data.lines) {
        const v = l.productVariantId ? variantById.get(l.productVariantId)! : null
        subtotal += Number(v ? v.price ?? 0 : productById.get(l.productId)!.price ?? 0) * l.quantity
      }

      const created = await tx.order.create({
        data: {
          organizationId: orgId,
          customerId: wo.customerId ?? null,
          subtotal,
          tax: 0,
          total: subtotal,
          status: "PAID",
          paymentMethod: "offline",
          notes: `Poraba materiala na delovnem nalogu #${wo.id.slice(-6)} (šiviljstvo)`,
          items: {
            create: data.lines.map((l) => {
              const v = l.productVariantId ? variantById.get(l.productVariantId)! : null
              const unit = v ? Number(v.price ?? 0) : Number(productById.get(l.productId)!.price ?? 0)
              return {
                productId: l.productId,
                variantId: l.productVariantId ?? null,
                variantName: v ? v.name : null,
                variantSku: v ? v.sku : null,
                variantPrice: l.productVariantId ? unit : null,
                quantity: l.quantity,
                price: unit,
              }
            }),
          },
        },
      })

      for (const d of decrements) {
        const line = data.lines.find((x) => x.productId === d.productId && (d.variantId ? x.productVariantId === d.variantId : !x.productVariantId))!
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: d.productId,
            ...(d.variantId ? { productVariantId: d.variantId } : {}),
            direction: "OUT",
            quantity: line.quantity,
            source: "ORDER",
            orderId: created.id,
            note: `Poraba materiala na delovnem nalogu #${wo.id.slice(-6)}`,
          },
        })
      }

      const fiscalYear = fiscalYearOf(new Date())
      const number = await nextDocumentNumber(tx, orgId, "INVOICE", fiscalYear)
      const doc = await tx.document.create({
        data: {
          organizationId: orgId,
          type: "INVOICE",
          number,
          status: "DRAFT",
          workOrderId: data.workOrderId,
          orderId: created.id,
          issueDate: new Date(),
          fiscalYear,
          currency: "EUR",
          vatEnabled: false,
          subtotal,
          discountAmount: 0,
          taxBase: subtotal,
          taxTotal: 0,
          total: subtotal,
          notes: "Šiviljstvo — poraba materiala (sledljivost).",
        },
      })

      await tx.workOrderEvent.create({
        data: {
          organizationId: orgId,
          workOrderId: data.workOrderId,
          type: "NOTE",
          message: `Poraba materiala: ${data.lines.reduce((s, l) => s + l.quantity, 0)} kos → naročilo ${created.id.slice(-6)} / dokument ${number}`,
          actorEmail: session.user?.email ?? null,
        },
      })

      return { orderId: created.id, documentId: doc.id }
    })

    revalidatePath("/dashboard/seamstress")
    revalidatePath("/dashboard/work-orders")
    return { ok: true, orderId: result.orderId, documentId: result.documentId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "INSUFFICIENT_STOCK") return { ok: false, error: "INSUFFICIENT_STOCK" }
    if (msg === "NOT_TRACKED") return { ok: false, error: "NOT_TRACKED" }
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

// ============================================================
// Sledljivost — naročilo → mere → material → izdelano → predaja → plačilo
// ============================================================

export async function resolveSeamstressProvenance(workOrderId: string) {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: orgId },
    include: {
      linkedRecord: { select: { id: true, title: true, data: true, customerId: true, createdAt: true } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      events: { orderBy: { createdAt: "asc" }, select: { type: true, message: true, actorEmail: true, createdAt: true, toStageKey: true } },
    },
  })
  if (!wo) return null

  // Mere, uporabljene za to naročilo (iz povezanega merilnega lista).
  let measurement: {
    measuredAt: string | null
    values: Record<string, unknown>
    createdAt: Date
  } | null = null
  if (wo.linkedRecord) {
    const d = (wo.linkedRecord.data ?? {}) as Record<string, unknown>
    measurement = {
      measuredAt: typeof d.measured_at === "string" ? d.measured_at : null,
      values: Object.fromEntries(Object.entries(d).filter(([k]) => /(_cm)$/.test(k) && typeof d[k] === "number")),
      createdAt: wo.linkedRecord.createdAt,
    }
  }

  // Materiali / poraba prek Document ↔ Order ↔ StockMovement OUT.
  const docs = await prisma.document.findMany({
    where: { organizationId: orgId, workOrderId: wo.id, orderId: { not: null } },
    select: { id: true, number: true, orderId: true },
  })
  const orderIds = docs.map((d) => d.orderId).filter((x): x is string => !!x)
  let materials: {
    orderId: string
    documentNumber: number | null
    lines: { productId: string; name: string; quantity: number; price: number }[]
    stockMovements: { productId: string; name: string; quantity: number }[]
    createdAt: Date
  }[] = []
  if (orderIds.length) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, organizationId: orgId },
      include: { items: { include: { product: { select: { name: true } } } } },
    })
    const movements = await prisma.stockMovement.findMany({
      where: { organizationId: orgId, orderId: { in: orderIds }, direction: "OUT" },
      include: { product: { select: { name: true } } },
    })
    materials = orders.map((o) => {
      const doc = docs.find((d) => d.orderId === o.id)
      const sms = movements.filter((m) => m.orderId === o.id).map((m) => ({ productId: m.productId, name: m.product?.name ?? "—", quantity: m.quantity }))
      return {
        orderId: o.id,
        documentNumber: doc ? doc.number : null,
        lines: o.items.map((it) => ({ productId: it.productId, name: it.product?.name ?? "—", quantity: it.quantity, price: Number(it.price) })),
        stockMovements: sms,
        createdAt: o.createdAt,
      }
    })
  }

  // Izdelano / predano / plačano = stopnje iz events (tok).
  const deliveryEvent = wo.events.find((e) => e.toStageKey === "delivery" || e.toStageKey === "predaja")
  const paymentEvent = wo.events.find((e) => e.toStageKey === "payment" || e.toStageKey === "plačilo")
  const done = wo.status === "COMPLETED"

  return {
    workOrderId: wo.id,
    number: wo.number,
    title: wo.title,
    status: wo.status,
    currentStageKey: wo.currentStageKey,
    agreedPrice: wo.total != null ? Number(wo.total) : null,
    notes: wo.notes,
    deadline: wo.dueDate,
    customer: wo.customer
      ? { id: wo.customer.id, name: wo.customer.name, email: wo.customer.email, phone: wo.customer.phone }
      : null,
    measurement,
    materials,
    deliveredAt: deliveryEvent?.createdAt ?? null,
    paidAt: paymentEvent?.createdAt ?? null,
    done,
    events: wo.events.map((e) => ({ type: e.type, message: e.message, actorEmail: e.actorEmail, createdAt: e.createdAt })),
  }
}

// ============================================================
// Šiviljska nadzorna plošča — agregati
// ============================================================

export interface SeamstressOverview {
  counts: {
    inquiries: number
    customOrders: number
    activeOrders: number
    measurements: number
    measuredCustomers: number
    materialsConsumed: number
    readyForDelivery: number
    lowStock: number
  }
  recentMeasurements: MeasurementItem[]
  myMeasurements: MeasurementItem[]
  recentOrders: { id: string; number: number; title: string; status: string; currentStageKey: string | null; currentStage: string | null; customerName: string | null; dueDate: Date | null; total: number | null; createdAt: Date }[]
  readyForDeliveryOrders: { id: string; number: number; title: string; customerName: string | null }[]
  lowStockMaterials: { id: string; name: string; stock: number; reserved: number; available: number }[]
}

const STAGE_LABELS: Record<string, string> = {
  inquiry: "Povpraševanje",
  measurements: "Meritve",
  quote: "Predračun",
  approval: "Potrditev",
  production: "Izdelava",
  fitting: "Priblon",
  delivery: "Predaja",
  payment: "Plačilo",
  done: "Zaključeno",
}

export async function getSeamstressOverview(): Promise<SeamstressOverview | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const [custCount, measTotal, orders, materialOrders, products] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.extensionRecord.count({ where: { organizationId: orgId, entityKey: MEASURE_KEY } }),
    prisma.workOrder.findMany({
      where: { organizationId: orgId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.order.count({ where: { organizationId: orgId, items: { some: {} }, status: "PAID", notes: { contains: "Poraba materiala" } } }),
    prisma.product.findMany({
      where: { organizationId: orgId, trackInventory: true },
      select: { id: true, name: true, stockQuantity: true, reservedQuantity: true },
    }),
  ])

  const lowStock = products.filter((p) => p.stockQuantity - p.reservedQuantity <= 0)
  const readyForDeliveryOrders = orders
    .filter((o) => o.status === "OPEN" && (o.currentStageKey === "delivery" || o.currentStageKey === "predaja"))
    .map((o) => ({ id: o.id, number: o.number, title: o.title, customerName: o.customer?.name ?? null }))

  const allMeasure = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: MEASURE_KEY },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  const recentMeasurements = allMeasure.map(toMeasurementItem)
  const measuredCustomers = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: MEASURE_KEY },
    distinct: ["customerId"],
    select: { customerId: true },
  })

  return {
    counts: {
      inquiries: orders.filter((o) => o.currentStageKey === "inquiry").length,
      customOrders: orders.length,
      activeOrders: orders.filter((o) => o.status === "OPEN").length,
      measurements: measTotal,
      measuredCustomers: measuredCustomers.filter((m) => m.customerId).length,
      materialsConsumed: materialOrders,
      readyForDelivery: readyForDeliveryOrders.length,
      lowStock: lowStock.length,
    },
    recentMeasurements,
    myMeasurements: recentMeasurements,
    recentOrders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      title: o.title,
      status: o.status,
      currentStageKey: o.currentStageKey,
      currentStage: o.currentStageKey ? STAGE_LABELS[o.currentStageKey] ?? o.currentStageKey : null,
      customerName: o.customer?.name ?? null,
      dueDate: o.dueDate,
      total: o.total != null ? Number(o.total) : null,
      createdAt: o.createdAt,
    })),
    readyForDeliveryOrders,
    lowStockMaterials: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stockQuantity,
      reserved: p.reservedQuantity,
      available: p.stockQuantity - p.reservedQuantity,
    })),
  }
}

// ============================================================
// Napredovanje / predaja / preveritev materialov
// ============================================================

/** Premakne naročilo na predajo (stage delivery) prek univerzalnega napredovanja. */
export async function markReadyForDelivery(workOrderId: string): Promise<{ ok: boolean; error?: string }> {
  return advanceWorkOrder(workOrderId, "delivery")
}

/** Premakne na zaključeno (skupaj s plačilom, če je zaporedje omogoča). */
export async function completeOrder(workOrderId: string): Promise<{ ok: boolean; error?: string }> {
  return advanceWorkOrder(workOrderId, "done")
}