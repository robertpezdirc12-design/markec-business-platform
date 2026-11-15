"use server"

// ============================================================
// NABAVNO POSLOVANJE (FAZA 1 — OJAČANJE JEDRA)
//
// Kompletna veriga: Dobavitelj → Nabavni nalog → Prejem blaga → Zaloga
//
// Dobavitelji = ExtensionRecord (suppliers razširitev)
// Nabavni nalog = ExtensionRecord (purchase_order entiteta)
// Prejem blaga = recordDelivery() iz inventory.ts (že obstaja)
//
// Vse akcije so org-scoped prek requirePermissionOrg.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { computeStockDelta } from "@/lib/inventory/stock"

const PURCHASING_EXT = "purchasing"
const PURCHASE_ORDER_KEY = "purchase_order"

// ============================================================
// Sheme in vmesniki
// ============================================================

const purchaseOrderLineSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  quantity: z.number().int().positive().max(1_000_000),
  unitPrice: z.number().nonnegative().optional(),
  description: z.string().max(500).optional(),
})

const createPurchaseOrderSchema = z.object({
  supplierRecordId: z.string().min(1).max(64),
  orderNumber: z.string().max(100).optional(),
  orderDate: z.string().optional(), // ISO datum
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(purchaseOrderLineSchema).min(1).max(100),
})

const updatePurchaseOrderSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"]).optional(),
  notes: z.string().max(1000).optional(),
})

export interface PurchaseOrderLine {
  productId: string
  productVariantId?: string | null
  quantity: number
  unitPrice?: number
  description?: string
  productName?: string
  variantName?: string
  receivedQuantity?: number
}

export interface PurchaseOrderItem {
  id: string
  orderNumber: string
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDeliveryDate: string | null
  status: "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED"
  totalAmount: number | null
  notes: string | null
  lines: PurchaseOrderLine[]
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderResult {
  ok: boolean
  error?: string
  id?: string
}

// ============================================================
// Pomožne funkcije
// ============================================================

/** Generira naslednjo številko nabavnega naloga za organizacijo. */
async function nextPurchaseOrderNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
  // P1 — PO-številke so per org edinstvene (NN-YYYY-####, v JSON data polju,
  // kjer ni DB-level unique constrainta; dodajanje stolpca/modela je prepovedano).
  // Pod sočasnimi ustvarjanji bi findMany + in-JS max lahko prebrala isto stanje
  // in izdala DUPLICIRANO številko. Rešitev brez sheme: PostgreSQL advisory
  // xact lock PER ORG — serializira samo izpeljavo številk istega najemnika,
  // različni najemniki se ne blokirajo. Zaklenjena je za trajanje transakcije
  // (sprosti se ob commit/rollback), tako da druga transakcija počaka, vidi
  // nov max in izpelje naslednjo številko. Nova jedra/sequence ni potrebna.
  // $executeRawUnsafe (ne $queryRawUnsafe) — pg_advisory_xact_lock vrača `void`,
  // kar Prisma $queryRaw NE more deserializirati (P2010). $execute ne vrača vrstic.
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)",
    `po-number:${orgId}`
  )
  const prefix = "NN-"
  const year = new Date().getFullYear()
  const records = await tx.extensionRecord.findMany({
    where: {
      organizationId: orgId,
      extensionId: PURCHASING_EXT,
      entityKey: PURCHASE_ORDER_KEY,
    },
    select: { data: true },
  })

  let maxSeq = 0
  for (const r of records) {
    const d = (r.data ?? {}) as Record<string, unknown>
    const num = typeof d.order_number === "string" ? d.order_number : ""
    const match = num.match(new RegExp(`^${prefix}${year}-(\\d+)$`))
    if (match) {
      const seq = parseInt(match[1], 10)
      if (seq > maxSeq) maxSeq = seq
    }
  }
  return `${prefix}${year}-${String(maxSeq + 1).padStart(4, "0")}`
}

/** Preveri, da dobavitelj obstaja v tej organizaciji. */
async function validateSupplier(
  tx: Prisma.TransactionClient,
  orgId: string,
  supplierId: string
): Promise<boolean> {
  const rec = await tx.extensionRecord.findFirst({
    where: {
      id: supplierId,
      organizationId: orgId,
      entityKey: "supplier",
    },
    select: { id: true, title: true },
  })
  return !!rec
}

/** Izračuna skupni znesek nabavnega naloga. */
function calculateTotal(lines: PurchaseOrderLine[]): number {
  return lines.reduce((sum, l) => {
    const price = l.unitPrice ?? 0
    return sum + price * l.quantity
  }, 0)
}

// ============================================================
// Osnovne akcije
// ============================================================

/**
 * Ustvari nov nabavni nalog.
 * Avtomatično generira številko, če ni podana.
 */
export async function createPurchaseOrder(
  input: z.input<typeof createPurchaseOrderSchema>
): Promise<PurchaseOrderResult> {
  const parsed = createPurchaseOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Preveri dobavitelja
      const supplierOk = await validateSupplier(tx, orgId, data.supplierRecordId)
      if (!supplierOk) throw new Error("SUPPLIER_NOT_FOUND")

      // Preveri izdelke
      const productIds = [...new Set(data.lines.map((l) => l.productId))]
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId: orgId, isActive: true },
        select: { id: true, name: true },
      })
      if (products.length !== productIds.length) throw new Error("PRODUCT_NOT_FOUND")

      // Preveri variante
      const variantIds = data.lines
        .map((l) => l.productVariantId)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
      if (variantIds.length > 0) {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds }, organizationId: orgId },
          select: { id: true, productId: true, name: true },
        })
        if (variants.length !== variantIds.length) throw new Error("VARIANT_NOT_FOUND")
      }

      const orderNumber = data.orderNumber || (await nextPurchaseOrderNumber(tx, orgId))
      const today = new Date().toISOString().slice(0, 10)

      // Pripravi linije z imeni izdelkov
      const productById = new Map(products.map((p) => [p.id, p]))
      const lines: PurchaseOrderLine[] = data.lines.map((l) => ({
        productId: l.productId,
        productVariantId: l.productVariantId ?? null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        description: l.description,
        productName: productById.get(l.productId)?.name,
        receivedQuantity: 0,
      }))

      const total = calculateTotal(lines)
      const supplier = await tx.extensionRecord.findFirst({
        where: { id: data.supplierRecordId, organizationId: orgId, entityKey: "supplier" },
        select: { title: true },
      })

      const recordData: Record<string, unknown> = {
        order_number: orderNumber,
        supplier_id: data.supplierRecordId,
        supplier_name: supplier?.title ?? "",
        order_date: data.orderDate || today,
        expected_delivery_date: data.expectedDeliveryDate ?? null,
        status: "DRAFT",
        notes: data.notes ?? null,
        lines,
        total_amount: total > 0 ? total : null,
      }

      const created = await tx.extensionRecord.create({
        data: {
          organizationId: orgId,
          extensionId: PURCHASING_EXT,
          entityKey: PURCHASE_ORDER_KEY,
          title: `Nabavni nalog ${orderNumber}`,
          data: recordData as unknown as Prisma.InputJsonValue,
        },
      })

      return { id: created.id }
    })

    revalidatePath("/dashboard/purchasing")
    revalidatePath("/dashboard/products")
    return { ok: true, id: result.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "SUPPLIER_NOT_FOUND") return { ok: false, error: "SUPPLIER_NOT_FOUND" }
    if (msg === "PRODUCT_NOT_FOUND") return { ok: false, error: "PRODUCT_NOT_FOUND" }
    if (msg === "VARIANT_NOT_FOUND") return { ok: false, error: "VARIANT_NOT_FOUND" }
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

/**
 * Posodobi status ali opombe nabavnega naloga.
 * Preverja dovoljene prehode statusov.
 */
export async function updatePurchaseOrder(
  id: string,
  input: z.input<typeof updatePurchaseOrderSchema>
): Promise<PurchaseOrderResult> {
  const parsed = updatePurchaseOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  try {
    const record = await prisma.extensionRecord.findFirst({
      where: { id, organizationId: orgId, entityKey: PURCHASE_ORDER_KEY },
      select: { id: true, data: true },
    })
    if (!record) return { ok: false, error: "NOT_FOUND" }

    const prev = (record.data ?? {}) as Record<string, unknown>
    const next: Record<string, unknown> = { ...prev }

    if (parsed.data.status) {
      const currentStatus = String(prev.status ?? "DRAFT")
      if (!isValidPurchaseStatusTransition(currentStatus, parsed.data.status)) {
        return { ok: false, error: "INVALID_STATUS_TRANSITION" }
      }
      next.status = parsed.data.status
    }
    if (parsed.data.notes !== undefined) next.notes = parsed.data.notes || null

    await prisma.extensionRecord.update({
      where: { id: record.id },
      data: {
        data: next as unknown as Prisma.InputJsonValue,
      },
    })

    revalidatePath("/dashboard/purchasing")
    return { ok: true, id: record.id }
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

/**
 * Seznam vseh nabavnih nalogov organizacije.
 */
export async function listPurchaseOrders(): Promise<PurchaseOrderItem[]> {
  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: PURCHASE_ORDER_KEY },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return records.map((r) => {
    const d = (r.data ?? {}) as Record<string, unknown>
    return {
      id: r.id,
      orderNumber: String(d.order_number ?? ""),
      supplierId: String(d.supplier_id ?? ""),
      supplierName: String(d.supplier_name ?? ""),
      orderDate: String(d.order_date ?? r.createdAt.toISOString().slice(0, 10)),
      expectedDeliveryDate: typeof d.expected_delivery_date === "string" ? d.expected_delivery_date : null,
      status: (d.status as PurchaseOrderItem["status"]) ?? "DRAFT",
      totalAmount: typeof d.total_amount === "number" ? d.total_amount : null,
      notes: typeof d.notes === "string" ? d.notes : null,
      lines: (Array.isArray(d.lines) ? (d.lines as PurchaseOrderLine[]) : []),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  })
}

/**
 * Podrobnosti enega nabavnega naloga.
 */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrderItem | null> {
  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: orgId, entityKey: PURCHASE_ORDER_KEY },
  })
  if (!record) return null

  const d = (record.data ?? {}) as Record<string, unknown>
  return {
    id: record.id,
    orderNumber: String(d.order_number ?? ""),
    supplierId: String(d.supplier_id ?? ""),
    supplierName: String(d.supplier_name ?? ""),
    orderDate: String(d.order_date ?? record.createdAt.toISOString().slice(0, 10)),
    expectedDeliveryDate: typeof d.expected_delivery_date === "string" ? d.expected_delivery_date : null,
    status: (d.status as PurchaseOrderItem["status"]) ?? "DRAFT",
    totalAmount: typeof d.total_amount === "number" ? d.total_amount : null,
    notes: typeof d.notes === "string" ? d.notes : null,
    lines: Array.isArray(d.lines) ? (d.lines as PurchaseOrderLine[]) : [],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * Preveri, ali je prehod statusa nabavnega naloga dovoljen.
 */
function isValidPurchaseStatusTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PARTIAL", "RECEIVED", "CANCELLED"],
    PARTIAL: ["RECEIVED", "CANCELLED"],
    RECEIVED: [],
    CANCELLED: [],
  }
  return allowed[from]?.includes(to) ?? false
}

/**
 * Označi delno ali popolnoma prejeto blago na nabavnem nalogu.
 * Posodobi receivedQuantity na linijah in status naloga.
 * Izvedeno v transakciji z preprečevanjem presežka naročene količine.
 */
export async function markPurchaseOrderReceived(
  id: string,
  receivedLines: { productId: string; productVariantId?: string | null; quantity: number }[]
): Promise<PurchaseOrderResult> {
  const { org, session } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  try {
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.extensionRecord.findFirst({
        where: { id, organizationId: orgId, entityKey: PURCHASE_ORDER_KEY },
        select: { id: true, data: true },
      })
      if (!record) throw new Error("NOT_FOUND")

      const prev = (record.data ?? {}) as Record<string, unknown>
      const lines = (Array.isArray(prev.lines) ? [...(prev.lines as PurchaseOrderLine[])] : [])
      const orderNumber =
        typeof prev.order_number === "string" && prev.order_number.trim()
          ? prev.order_number
          : null
      const supplierRecordId =
        typeof prev.supplier_id === "string" && prev.supplier_id.trim()
          ? prev.supplier_id
          : null

      // Posodobi prejete količine — prepreči prejem večjega kot naročeno
      let allReceived = lines.length > 0
      for (const line of lines) {
        const received = receivedLines.find(
          (r) =>
            r.productId === line.productId &&
            (r.productVariantId ?? null) === (line.productVariantId ?? null)
        )
        if (received) {
          const alreadyReceived = line.receivedQuantity ?? 0
          const maxAllowed = line.quantity - alreadyReceived
          if (received.quantity > maxAllowed) {
            throw new Error("OVER_RECEIPT")
          }
          line.receivedQuantity = alreadyReceived + received.quantity
        }
        if ((line.receivedQuantity ?? 0) < line.quantity) {
          allReceived = false
        }
      }

      const next: Record<string, unknown> = {
        ...prev,
        lines,
        status: allReceived ? "RECEIVED" : "PARTIAL",
      }

      await tx.extensionRecord.update({
        where: { id: record.id },
        data: {
          data: next as unknown as Prisma.InputJsonValue,
        },
      })

      // SKLADIŠČNI PREJEM — prejeti izdelki morajo povisati on-hand zalogo in
      // zapisati ledger vrstico (direction IN, source DELIVERY). Brez tega bi
      // prejem blaga pustil zalogo nespremenjeno (hrošč). Gre v isti transakciji:
      // org-scoped SELECT ... FOR UPDATE zaklene avtoritativno vrstico zaloge,
      // da sočasni prejemi ne izgubijo posodobitev.
      for (const line of lines) {
        const received = receivedLines.find(
          (r) =>
            r.productId === line.productId &&
            (r.productVariantId ?? null) === (line.productVariantId ?? null)
        )
        if (!received || received.quantity <= 0) continue

        const stockTable = line.productVariantId ? "ProductVariant" : "Product"
        const stockId = line.productVariantId ?? line.productId
        const locked = await tx.$queryRawUnsafe<{ stockQuantity: number }[]>(
          `SELECT "stockQuantity" FROM "${stockTable}" WHERE "id" = $1::text AND "organizationId" = $2::text FOR UPDATE`,
          stockId,
          orgId
        )
        // Vrstica, ki ne obstaja v tej org (IDOR-safety), se preskoči — sama
        // posodobitev PO statusa ostane veljavna ostalim linijam.
        if (locked.length !== 1) continue

        const computed = computeStockDelta(locked[0].stockQuantity, "IN", received.quantity)
        if (!computed.ok) continue // quantity je že validiran (pozitiven int)

        if (line.productVariantId) {
          await tx.productVariant.update({
            where: { id: line.productVariantId },
            data: { stockQuantity: computed.nextStock },
          })
        } else {
          await tx.product.update({
            where: { id: line.productId },
            data: { stockQuantity: computed.nextStock },
          })
        }

        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: line.productId,
            productVariantId: line.productVariantId ?? null,
            direction: "IN",
            quantity: received.quantity,
            source: "DELIVERY",
            note: orderNumber ? `Nabavni nalog ${orderNumber}` : "Nabavni nalog",
            supplierRecordId,
            createdById: session.user.id,
          },
        })
      }

      return { id: record.id }
    })

    revalidatePath("/dashboard/purchasing")
    return { ok: true, id: result.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" }
    if (msg === "OVER_RECEIPT") return { ok: false, error: "OVER_RECEIPT" }
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

// ============================================================
// Seznam dobaviteljev za UI
// ============================================================

export interface SupplierOption {
  id: string
  title: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
}

/**
 * Seznam dobaviteljev za nabavne naloge.
 * Deluje samo, če profil omogoča `suppliers` razširitev.
 */
export async function listSupplierOptions(): Promise<SupplierOption[]> {
  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, entityKey: "supplier" },
    orderBy: { title: "asc" },
    take: 200,
  })

  return records.map((r) => {
    const d = (r.data ?? {}) as Record<string, unknown>
    return {
      id: r.id,
      title: r.title,
      name: typeof d.name === "string" ? d.name : r.title,
      contactPerson: typeof d.contact_person === "string" ? d.contact_person : null,
      email: typeof d.email === "string" ? d.email : null,
      phone: typeof d.phone === "string" ? d.phone : null,
    }
  })
}
