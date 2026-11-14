"use server"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { computeStockDelta, type StockDirectionValue } from "@/lib/inventory/stock"
import { isLowStock, resolveReorderPoint } from "@/lib/inventory/low-stock"

// ============================================================
// INVENTORY RUNTIME (EPIC #2 E2-2) — stock movement ledger.
// Manual receipts/issues update the product/variant stock AND
// append a ledger row in ONE transaction; negative stock is
// rejected (§11). All queries/actions are strictly org-scoped
// via requirePermissionOrg. Traceability links (supplier/batch) must
// belong to the same tenant AND to an extension the profile
// actually enables — the client can never inject foreign ids.
// ============================================================

const movementInputSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().positive().max(1_000_000),
  note: z.string().max(500).nullable().optional(),
  supplierRecordId: z.string().min(1).max(64).nullable().optional(),
  batchRecordId: z.string().min(1).max(64).nullable().optional(),
  // #78: RETURN is a first-class receipt source (customer brought it back).
  // DELIVERY/STOCKTAKE have their own dedicated flows below — the generic
  // manual form must not pretend to be a delivery document or a count.
  source: z.enum(["MANUAL", "RETURN"]).optional(),
})

export type MovementInput = z.input<typeof movementInputSchema>

/** Error codes the UI maps to bilingual text. */
export type MovementErrorCode =
  | "VALIDATION"
  | "INVALID_QUANTITY"
  | "NEGATIVE_STOCK"
  | "RESERVED_BLOCK"
  | "NOT_FOUND"
  | "VARIANT_MISMATCH"
  | "RECORD_LINK"
  | "NOT_TRACKED"
  | "GENERIC"

export interface MovementResult {
  ok: boolean
  error?: MovementErrorCode
  fieldErrors?: Record<string, string>
  nextStock?: number
}

export interface StockMovementItem {
  id: string
  direction: StockDirectionValue
  quantity: number
  source: "MANUAL" | "ORDER" | "DELIVERY" | "STOCKTAKE" | "RETURN"
  note: string | null
  variantName: string | null
  supplierTitle: string | null
  batchTitle: string | null
  orderNumber: string | null
  createdByName: string | null
  createdAt: string
}

export interface StockLinkOptions {
  suppliers: { id: string; title: string }[]
  batches: { id: string; title: string }[]
}

/** Prisma TransactionClient — uporabljen za zaklepanje vrstic. */
type StockRowLock =
  | { ok: true; stockQuantity: number; reservedQuantity: number }
  | { ok: false; reason: "NOT_FOUND" | "NOT_TRACKED" }

/**
 * P1-D-1C — atomično zaklene avtoritativno zalogovno vrstico (SELECT ... FOR
 * UPDATE) in s svežim stanjem vrne naslednje posodobitve, da se izogne
 * izgubljenim posodobitvam pri sočasnih operacijah.
 *
 * Zaklepa ProductVariant, kadar je izbrana varianta (nikoli Product hkrati);
 * drugače Product. Org pripadnost se preveri v ISTEM SELECT-u (prepreči IDOR).
 * Vrstni red zaklepanja je enoten: najprej Product, nato ProductVariant (tam,
 * kjer ga ni, se zaklene le ena vrstica).
 */
async function lockStockRow(
  tx: Prisma.TransactionClient,
  orgId: string,
  productId: string,
  variantId?: string | null
): Promise<StockRowLock> {
  const table = variantId ? "ProductVariant" : "Product"
  const id = variantId ?? productId
  const rows = await tx.$queryRawUnsafe<{ stockQuantity: number; reservedQuantity: number }[]>(
    `SELECT "stockQuantity", "reservedQuantity"
     FROM "${table}"
     WHERE "id" = $1::text AND "organizationId" = $2::text
     FOR UPDATE`,
    id,
    orgId
  )
  if (rows.length !== 1) return { ok: false, reason: "NOT_FOUND" }
  return { ok: true, stockQuantity: rows[0].stockQuantity, reservedQuantity: rows[0].reservedQuantity }
}

/**
 * P1-D-1C — izračuna dovoljeno spremembo na svežem, zaklenjenem stanju,
 * vključno s pravilom "stockQuantity >= reservedQuantity" za OUT premike.
 */
function computeSafeDelta(
  fresh: { stockQuantity: number; reservedQuantity: number },
  direction: StockDirectionValue,
  quantity: number
): { ok: true; nextStock: number } | { ok: false; reason: "NEGATIVE_STOCK" | "RESERVED_BLOCK" } {
  const computed = computeStockDelta(fresh.stockQuantity, direction, quantity)
  if (!computed.ok) return { ok: false, reason: "NEGATIVE_STOCK" as const }
  // OUT prejemom (odštevanje fizične zaloge) ne sme pasti pod rezervirano.
  if (direction === "OUT" && computed.nextStock < fresh.reservedQuantity) {
    return { ok: false, reason: "RESERVED_BLOCK" }
  }
  return { ok: true, nextStock: computed.nextStock }
}

/**
 * Record ONE manual stock movement (receipt or issue) and update
 * the stock state atomically. The pure rule (computeStockDelta)
 * decides BEFORE any write — a rejected movement leaves both the
 * state and the ledger untouched.
 */
export async function createStockMovement(
  input: MovementInput
): Promise<MovementResult> {
  const parsed = movementInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION" }
  }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  // Product must belong to THIS tenant (§3 isolation).
  const product = await prisma.product.findFirst({
    where: { id: data.productId, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (!product) return { ok: false, error: "NOT_FOUND" }
  if (!product.trackInventory) return { ok: false, error: "NOT_TRACKED" }

  // Variant (optional) must belong to the product.
  let variant: { id: string; stockQuantity: number } | null = null
  if (data.productVariantId) {
    const v = await prisma.productVariant.findFirst({
      where: {
        id: data.productVariantId,
        productId: product.id,
        organizationId: org.id,
      },
      select: { id: true, stockQuantity: true },
    })
    if (!v) return { ok: false, error: "VARIANT_MISMATCH" }
    if (!v.stockQuantity && v.stockQuantity !== 0) {
      return { ok: false, error: "VALIDATION" }
    }
    variant = { id: v.id, stockQuantity: v.stockQuantity }
  }

  // Traceability links must exist in THIS tenant and belong to an
  // entity the effective profile actually enables.
  const profile = await getSessionEffectiveProfile()
  const supplierEnabled = profile.extensions.includes("suppliers")
  const batchEnabled = profile.extensions.includes("batch-production")

  if (data.supplierRecordId) {
    if (!supplierEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.supplierRecordId,
        organizationId: org.id,
        entityKey: "supplier",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }
  if (data.batchRecordId) {
    if (!batchEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.batchRecordId,
        organizationId: org.id,
        entityKey: "batch",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }

  const currentStock = variant ? variant.stockQuantity : product.stockQuantity
  const computed = computeStockDelta(
    currentStock,
    data.direction as StockDirectionValue,
    data.quantity
  )
  if (!computed.ok) {
    return {
      ok: false,
      error: computed.reason === "NEGATIVE_STOCK" ? "NEGATIVE_STOCK" : "INVALID_QUANTITY",
    }
  }
  // P1-D-1C — autoritativno stanje se prebere pod zaklepom v transakciji;
  // tu je le varna privzeta vrednost za primer rollbacka (ne uporablja se za
  // zapis, ampak kot rezultat ob uspehu).
  let nextStock = computed.nextStock

  try {
    await prisma.$transaction(async (tx) => {
      // P1-D-1C — autoritativno, sveže stanje pod zaklepanjem (ne zauploadano
      // pre-branu), da dva vzporedna premika ne izgubita posodobitve.
      const lock = await lockStockRow(tx, org.id, product.id, variant?.id)
      if (!lock.ok) {
        throw new Error(lock.reason === "NOT_FOUND" ? "NOT_FOUND" : "NOT_TRACKED")
      }
      const safe = computeSafeDelta(
        { stockQuantity: lock.stockQuantity, reservedQuantity: lock.reservedQuantity },
        data.direction as StockDirectionValue,
        data.quantity
      )
      if (!safe.ok) {
        throw new Error(safe.reason === "NEGATIVE_STOCK" ? "NEGATIVE_STOCK" : "RESERVED_BLOCK")
      }
      nextStock = safe.nextStock

      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stockQuantity: safe.nextStock },
        })
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: safe.nextStock },
        })
      }

      // 2) LEDGER — append-only row for the same event.
      await tx.stockMovement.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          productVariantId: variant?.id ?? null,
          direction: data.direction,
          quantity: data.quantity,
          source: data.source ?? "MANUAL",
          note: data.note?.trim() || null,
          supplierRecordId: data.supplierRecordId ?? null,
          batchRecordId: data.batchRecordId ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg === "NEGATIVE_STOCK") return { ok: false, error: "NEGATIVE_STOCK" }
    if (msg === "RESERVED_BLOCK") return { ok: false, error: "RESERVED_BLOCK" }
    if (msg === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" }
    if (msg === "NOT_TRACKED") return { ok: false, error: "NOT_TRACKED" }
    console.error("[inventory] movement transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${product.id}/edit`)
  revalidatePath("/dashboard")

  return { ok: true, nextStock }
}

/** Ledger entries for one product (org-scoped, newest first). */
export async function listStockMovements(
  productId: string
): Promise<StockMovementItem[]> {
  const { org } = await requirePermissionOrg("products.manage")

  // Guard: product must belong to this tenant — never serve foreign rows.
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
    select: { id: true },
  })
  if (!product) return []

  const rows = await prisma.stockMovement.findMany({
    where: { organizationId: org.id, productId },
    include: {
      productVariant: { select: { name: true } },
      supplierRecord: { select: { title: true } },
      batchRecord: { select: { title: true } },
      order: { select: { id: true, guestName: true, customer: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    quantity: r.quantity,
    source: r.source,
    note: r.note,
    variantName: r.productVariant?.name ?? null,
    supplierTitle: r.supplierRecord?.title ?? null,
    batchTitle: r.batchRecord?.title ?? null,
    orderNumber: r.order
      ? (r.order.customer?.name ?? r.order.guestName ?? r.order.id)
      : null,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Picker options for the movement form. Suppliers come from the
 * `suppliers` extension entity, batches from `batch-production` —
 * both only when the effective profile enables them.
 */
export async function getStockLinkOptions(): Promise<StockLinkOptions> {
  const { org } = await requirePermissionOrg("products.manage")
  const profile = await getSessionEffectiveProfile()

  const suppliers = profile.extensions.includes("suppliers")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "supplier" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  const batches = profile.extensions.includes("batch-production")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "batch" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  return {
    suppliers: suppliers.map((s) => ({ id: s.id, title: s.title })),
    batches: batches.map((b) => ({ id: b.id, title: b.title })),
  }
}

/** Dashboard widget input: stock counts + the lowest-stock items. */
export interface StockSummary {
  inStock: number
  low: number
  out: number
  lowItems: { id: string; name: string; stockQuantity: number }[]
}

/**
 * Seštevek zaloge za dashboard widget (lowStock).
 *
 * #78: prag NI več trdo kodirana 10 — per-izdelek reorderPoint razreši
 * low-stock helper (isti helper kot stats kartica in tabela), tako da se
 * widget in /dashboard/products ne moreta razlikovati.
 */
export async function getStockSummary(): Promise<StockSummary> {
  const { org } = await requirePermissionOrg("products.manage")

  const [out, trackedRows] = await Promise.all([
    prisma.product.count({
      where: { organizationId: org.id, stockQuantity: { equals: 0 } },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, stockQuantity: { gt: 0 } },
      select: { id: true, name: true, stockQuantity: true, reorderPoint: true },
      orderBy: { stockQuantity: "asc" },
    }),
  ])

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { defaultReorderPoint: true },
  })
  const orgDefault = config?.defaultReorderPoint ?? null

  const lowRows = trackedRows.filter((r) =>
    isLowStock(r.stockQuantity, resolveReorderPoint(r.reorderPoint, orgDefault))
  )

  return {
    inStock: trackedRows.length - lowRows.length,
    low: lowRows.length,
    out,
    lowItems: lowRows.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name,
      stockQuantity: r.stockQuantity,
    })),
  }
}

// ============================================================
// #78: PREJEM BLAGA (DELIVERY) — "prejeli smo dobavo" kot EN dogodek.
// En submission = N StockMovement vrstic z ISTO referenco (vir DELIVERY,
// skupni note "Dobava {documentNumber}"), vsaka linija pa posodobi
// stockQuantity v isti transakciji. Prejem je Vedno IN — blago prihaja.
// ============================================================

const deliveryLineSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(1_000_000),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
})

const deliverySchema = z.object({
  documentNumber: z.string().max(100).optional(),
  supplierRecordId: z.string().min(1).max(64).nullable().optional(),
  lines: z.array(deliveryLineSchema).min(1, "Dobava mora imeti vsaj eno linijo").max(100),
})

export type DeliveryInput = z.input<typeof deliverySchema>

export interface DeliveryResult {
  ok: boolean
  error?:
    | "VALIDATION"
    | "NOT_FOUND"
    | "NOT_TRACKED"
    | "VARIANT_MISMATCH"
    | "RECORD_LINK"
    | "GENERIC"
  receivedCount?: number
}

/**
 * Prejmi dobavo: en dogodek, N linij, ena transakcija.
 * Vse linije morajo pripadati temu najemniku; sledljivost dobavitelja
 * velja samo, kadar profil omogoča `suppliers` extensijo (kot pri
 * ročnem premiku).
 */
export async function recordDelivery(input: DeliveryInput): Promise<DeliveryResult> {
  const parsed = deliverySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  // Enako kljucu vsak id: linije z istim izdelkom se seštejejo.
  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (products.length !== productIds.length) {
    return { ok: false, error: "NOT_FOUND" }
  }
  const untracked = products.find((p) => !p.trackInventory)
  if (untracked) return { ok: false, error: "NOT_TRACKED" }

  const profile = await getSessionEffectiveProfile()
  const supplierEnabled = profile.extensions.includes("suppliers")
  if (data.supplierRecordId && !supplierEnabled) {
    return { ok: false, error: "RECORD_LINK" }
  }
  if (data.supplierRecordId) {
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.supplierRecordId,
        organizationId: org.id,
        entityKey: "supplier",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }

  // Variante (opcijsko) morajo pripadati svojemu izdelku.
  const variantIds = data.lines
    .map((l) => l.productVariantId)
    .filter((v): v is string => typeof v === "string")
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, organizationId: org.id },
        select: { id: true, productId: true, stockQuantity: true },
      })
    : []
  for (const line of data.lines) {
    if (!line.productVariantId) continue
    const v = variants.find((x) => x.id === line.productVariantId)
    if (!v || v.productId !== line.productId) {
      return { ok: false, error: "VARIANT_MISMATCH" }
    }
  }

  const reference = data.documentNumber?.trim()
    ? `Dobava ${data.documentNumber.trim()}`
    : "Dobava"

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of data.lines) {
        const product = products.find((p) => p.id === line.productId)!
        const variant = line.productVariantId
          ? variants.find((v) => v.id === line.productVariantId)!
          : null
        // P1-D-1C — sveže stanje pod zaklepanjem, da sočasne dobave ne izgubijo
        // posodobitve (IN nikoli ne gre pod nič, a mora biti konsistentno).
        const lock = await lockStockRow(tx, org.id, line.productId, variant?.id)
        if (!lock.ok) continue // NE obstaja / druga org → preskoči to vrstico
        const safe = computeSafeDelta(
          { stockQuantity: lock.stockQuantity, reservedQuantity: lock.reservedQuantity },
          "IN",
          line.quantity
        )
        if (!safe.ok) continue

        if (variant) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: safe.nextStock },
          })
        } else {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: safe.nextStock },
          })
        }

        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            productVariantId: variant?.id ?? null,
            direction: "IN",
            quantity: line.quantity,
            source: "DELIVERY",
            note: reference,
            supplierRecordId: data.supplierRecordId ?? null,
            createdById: session.user.id,
          },
        })
      }
    })
  } catch (error) {
    console.error("[inventory] delivery transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard")

  return { ok: true, receivedCount: data.lines.length }
}

// ============================================================
// #78: INVENTURA (STOCKTAKE) — prešteto stanje se zapiše kot RAZLIKA
// (prešteto − sistem), NIČesar se ne prepiše direktno. Celotna vrednost
// evidence je v tem, da razlaga trenutno številko: vsak popravek ima
// svojo vrstico z virom STOCKTAKE. Inventura je reverzibilna z naslednjim
// štetjem. Ničelne razlike NE pišejo (brez šuma v evidenci).
// ============================================================

const stocktakeLineSchema = z.object({
  productId: z.string().min(1).max(64),
  // P1-D-1B — inventura lahko šteje posamezno VARIANTO (variant-level).
  productVariantId: z.string().min(1).max(64).optional().nullable(),
  counted: z.number().int().min(0).max(1_000_000),
})

const stocktakeSchema = z.object({
  note: z.string().max(200).optional(),
  lines: z.array(stocktakeLineSchema).min(1).max(500),
})

export type StockTakeInput = z.input<typeof stocktakeSchema>

export interface StockTakeResult {
  ok: boolean
  error?: "VALIDATION" | "NOT_FOUND" | "NOT_TRACKED" | "VARIANT_MISMATCH" | "GENERIC"
  adjusted?: {
    productId: string
    productVariantId?: string | null
    name: string
    delta: number
  }[]
}

/**
 * Inventura: za vsak izdelek z NENIČELNO razliko zapiši premik
 * (sign razlike določi smer) in posodobi stanje v eni transakciji.
 */
export async function submitStockTake(input: StockTakeInput): Promise<StockTakeResult> {
  const parsed = stocktakeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (products.length !== productIds.length) {
    return { ok: false, error: "NOT_FOUND" }
  }
  const untracked = products.find((p) => !p.trackInventory)
  if (untracked) return { ok: false, error: "NOT_TRACKED" }

  // P1-D-1B — variant-aware: preberi variantne linije (org-scoped, pripadajo izdelku).
  const variantIds = data.lines
    .map((l) => l.productVariantId)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, organizationId: org.id },
        select: { id: true, productId: true, stockQuantity: true, trackInventory: true },
      })
    : []
  if (variants.length !== variantIds.length) {
    return { ok: false, error: "VARIANT_MISMATCH" }
  }
  for (const line of data.lines) {
    if (!line.productVariantId) continue
    const v = variants.find((x) => x.id === line.productVariantId)
    if (!v || v.productId !== line.productId) {
      return { ok: false, error: "VARIANT_MISMATCH" }
    }
    if (!v.trackInventory) {
      return { ok: false, error: "NOT_TRACKED" }
    }
  }

  const adjusted: {
    productId: string
    productVariantId?: string | null
    name: string
    delta: number
  }[] = []
  try {
    await prisma.$transaction(async (tx) => {
      for (const line of data.lines) {
        const product = products.find((p) => p.id === line.productId)!
        const variant = line.productVariantId
          ? variants.find((v) => v.id === line.productVariantId)!
          : null
        // P1-D-1C — inventura mora delati na SVEŽEM, zaklenjenem stanju, da
        // sočasna prodaja/prejem med inventuro ne povzroči zastarelega delte.
        const lock = await lockStockRow(tx, org.id, line.productId, variant?.id)
        if (!lock.ok) continue
        const baseline = lock.stockQuantity
        const delta = line.counted - baseline
        if (delta === 0) continue // neničelne razlike se pišejo SAMO

        const direction: StockDirectionValue = delta > 0 ? "IN" : "OUT"
        const safe = computeSafeDelta(
          { stockQuantity: lock.stockQuantity, reservedQuantity: lock.reservedQuantity },
          direction,
          Math.abs(delta)
        )
        if (!safe.ok) continue // ne more iti pod nič / pod rezervirano

        if (variant) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: safe.nextStock },
          })
        } else {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: safe.nextStock },
          })
        }
        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            productVariantId: variant?.id ?? null,
            direction,
            quantity: Math.abs(delta),
            source: "STOCKTAKE",
            note:
              data.note?.trim() ||
              `Inventura: prešteto ${line.counted}, sistem ${baseline}`,
            createdById: session.user.id,
          },
        })
        adjusted.push({
          productId: product.id,
          productVariantId: variant?.id ?? null,
          name: variant ? `${product.name} (${variant.id})` : product.name,
          delta,
        })
      }
    })
  } catch (error) {
    console.error("[inventory] stocktake transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard/products/stocktake")
  revalidatePath("/dashboard")

  return { ok: true, adjusted }
}
