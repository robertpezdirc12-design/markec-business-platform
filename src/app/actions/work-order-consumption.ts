"use server"

// ============================================================
// UNIVERZALNA PORABA NA DELOVNEM NALOGU (FAZA 1 — OJAČANJE JEDRA)
//
// Refaktoring dveh skoraj identičnih funkcij v eno univerzalno:
//   • vehicle-workshop.ts: sellPartsOnWorkOrder()
//   • seamstress.ts: consumeMaterialOnWorkOrder()
//
// Ista funkcionalnost se implementira samo ENKRAT v jedru, nato pa
// jo vsi profili uporabljajo na svoj način.
//
// Logika ostane enaka: CAS znižanje zaloge → Order + OrderItem →
// StockMovement OUT → Document (QUOTE/INVOICE) → WorkOrderEvent.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { nextDocumentNumber, fiscalYearOf, type DocType } from "@/lib/documents/numbering"

// ============================================================
// Skupne sheme in vmesniki
// ============================================================

const lineSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  quantity: z.number().int().positive().max(1_000_000),
})

const consumptionSchema = z.object({
  workOrderId: z.string().min(1).max(64),
  lines: z.array(lineSchema).min(1).max(50),
  notes: z.string().max(500).nullable().optional(),
})

export interface ConsumptionResult {
  ok: boolean
  error?: string
  orderId?: string
  documentId?: string
}

export interface ConsumptionOptions {
  /** Ali naj se uporabi customerId iz delovnega naloga. Privzeto: true. */
  useWorkOrderCustomer?: boolean
  /** Tip dokumenta, ki se ustvari. Privzeto: "QUOTE" (ločitev porabe od računa). */
  documentType?: DocType
  /** Status dokumenta. Privzeto: "DRAFT". */
  documentStatus?: string
  /** Opomba v Order. */
  orderNotes?: string
  /** Opomba v Document. */
  documentNotes?: string
  /** Sporočilo v WorkOrderEvent. */
  eventMessage?: (totalQty: number, orderShortId: string, docNumber: number) => string
  /** Seznam poti za revalidacijo po uspehu. */
  revalidatePaths?: string[]
  /**
   * Idempotency key proti dvojni porabi (dvojni klik / retry klienta).
   * Če je podana in je bila ista koda zabeležena v tej organizaciji zadnjih
   * 24h, se funkcija NE izvede znova — vrne se rezultat prejšnje izvedbe
   * ({ orderId, documentId }). Ključ se zabeleži znotraj ISTE transakcije
   * kot poraba, zato dva hkratna klica ne moreta oba mimo preverbe.
   */
  idempotencyKey?: string
}

// ============================================================
// Pomožne funkcije
// ============================================================

/** Atomarno zniža zalogo določene vrstice (CAS — nikoli pod razpoložljivo). */
async function decrementStock(
  tx: Prisma.TransactionClient,
  table: "Product" | "ProductVariant",
  id: string,
  orgId: string,
  qty: number
): Promise<boolean> {
  if (table !== "Product" && table !== "ProductVariant") {
    throw new Error("INVALID_TABLE")
  }
  const r = await tx.$executeRawUnsafe(
    `UPDATE "${table}" SET "stockQuantity" = "stockQuantity" - $2::int
     WHERE "id" = $1::text AND "organizationId" = $3::text
       AND "stockQuantity" - "reservedQuantity" >= $2::int`,
    id,
    qty,
    orgId
  )
  return r === 1
}

// ============================================================
// Idempotency — zaščita pred dvojno porabo (dvojni klik / retry).
//
// Brez spremembe sheme uporabimo obstoječi model RateLimit, ki ima že
// @@unique([scope, key]) — org vstavimo v `scope`, idempotency key v `key`,
// ob tem pa ima `expiresAt` (24h okno) in ga cron/stale-wash ob izteku zbriše
// (glej api/cron/tick). To je edina edinstvena-per-org omejitev na obstoječem
// modelu, ki daje PRAVO hkratno zaščito: samo en klic uspe s create, drugi
// dobi P2002 in je celotna transakcija razveljavljena (nič ni porabljeno).
// ============================================================

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000
const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"

/** Org-scoped scope — @@unique([scope, key]) tako velja PER ORGANIZACIJO. */
function idempotencyScope(orgId: string): string {
  return `work-order-consumption:${orgId}`
}

/** Marker, ki ga zapišemo v Order.notes, da lahko ob ponovitvi ključa
 *  najdemo že ustvarjen rezultat ({ orderId, documentId }). */
function idempotencyMarker(key: string): string {
  return `[idem:${key}]`
}

/** Ali je napaka P2002 (kršitev edinstvene omejitve) — npr. hkratni klic. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  )
}

/**
 * Vrne obstoječ rezultat za ključ, če ta obstaja v 24h oknu in je že nastal
 * Order z markerjem. Sicer vrne null (ključ prvič ali preveč star).
 */
async function resolveIdempotentResult(
  orgId: string,
  idempotencyKey: string
): Promise<{ orderId: string; documentId: string } | null> {
  const rate = await prisma.rateLimit.findUnique({
    where: { scope_key: { scope: idempotencyScope(orgId), key: idempotencyKey } },
    select: { expiresAt: true },
  })
  if (!rate || rate.expiresAt.getTime() <= Date.now()) return null

  const order = await prisma.order.findFirst({
    where: { organizationId: orgId, notes: { contains: idempotencyMarker(idempotencyKey) } },
    select: { id: true, documents: { select: { id: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
  })
  if (!order) return null
  return { orderId: order.id, documentId: order.documents.length > 0 ? order.documents[0].id : "" }
}

// ============================================================
// GLAVNA UNIVERZALNA FUNKCIJA
// ============================================================

/**
 * Univerzalna poraba materialov/delov na delovnem nalogu.
 * Zniža zalogo (CAS, ni negativne/rezervirane), ustvari
 * Order + OrderItem + StockMovement OUT + Document + WorkOrderEvent.
 * Napaka → celoten rollback.
 *
 * @param input Vhodni podatki (delovni nalog, postavke, opombe)
 * @param options Opcije za prilagoditev profilu (stranka, tip dokumenta, besedila)
 */
export async function consumeOnWorkOrder(
  input: z.input<typeof consumptionSchema>,
  options: ConsumptionOptions = {}
): Promise<ConsumptionResult> {
  const parsed = consumptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  // Privzete vrednosti opcij
  const opts: Required<
    Omit<ConsumptionOptions, "eventMessage" | "revalidatePaths" | "idempotencyKey">
  > & {
    eventMessage?: ConsumptionOptions["eventMessage"]
    revalidatePaths?: ConsumptionOptions["revalidatePaths"]
  } = {
    useWorkOrderCustomer: options.useWorkOrderCustomer ?? true,
    documentType: options.documentType ?? "QUOTE",
    documentStatus: options.documentStatus ?? "DRAFT",
    orderNotes: options.orderNotes ?? "Poraba na delovnem nalogu",
    documentNotes: options.documentNotes ?? "Delovni nalog — poraba (sledljivost).",
  }
  opts.eventMessage = options.eventMessage
  opts.revalidatePaths = options.revalidatePaths

  const { org, session } = await requirePermissionOrg("orders.manage")
  const orgId = org.id

  const idempotencyKey = options.idempotencyKey

  // Idempotency preverba pred težkimi deli: če je ključ že zabeležen v tej
  // org (zadnjih 24h), vrni obstoječi rezultat in NE ponovi porabe.
  if (idempotencyKey) {
    const existing = await resolveIdempotentResult(orgId, idempotencyKey)
    if (existing) {
      return { ok: true, orderId: existing.orderId, documentId: existing.documentId }
    }
  }

  // Delovni nalog mora biti v tej org (ne IDOR).
  const wo = await prisma.workOrder.findFirst({
    where: { id: data.workOrderId, organizationId: orgId },
    select: { id: true, customerId: true },
  })
  if (!wo) return { ok: false, error: "WORKORDER_NOT_FOUND" }

  // Preberi izdelke in variante
  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: orgId, isActive: true },
    select: { id: true, name: true, price: true, trackInventory: true },
  })
  if (products.length !== productIds.length) return { ok: false, error: "NOT_FOUND" }

  const variantIds = data.lines
    .map((l) => l.productVariantId)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, organizationId: orgId },
        select: { id: true, productId: true, name: true, sku: true, price: true },
      })
    : []
  if (variants.length !== variantIds.length) return { ok: false, error: "VARIANT_NOT_FOUND" }

  for (const l of data.lines) {
    if (!l.productVariantId) continue
    const v = variants.find((x) => x.id === l.productVariantId)
    if (!v || v.productId !== l.productId) return { ok: false, error: "VARIANT_MISMATCH" }
  }

  const productById = new Map(products.map((p) => [p.id, p]))
  const variantById = new Map(variants.map((v) => [v.id, v]))

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- 0) Zabeleži idempotency ključ PRVO — v isti transakciji kot poraba.
      //          @@unique([scope, key]) na RateLimit pomeni, da dva hkratna klica
      //          ne moreta oba mimo preverbe: drugi dobi P2002 in se celotna
      //          transakcija razveljavi preden se porabi karkoli. ----
      if (idempotencyKey) {
        try {
          await tx.rateLimit.create({
            data: {
              scope: idempotencyScope(orgId),
              key: idempotencyKey,
              windowStart: new Date(),
              count: 1,
              expiresAt: new Date(Date.now() + IDEMPOTENCY_WINDOW_MS),
            },
          })
        } catch (e) {
          // Hkratni klic je že uspel → prekini, da se karkoli (zaloga) NE porabi.
          if (isUniqueViolation(e)) throw new Error(IDEMPOTENCY_CONFLICT)
          throw e
        }
      }

      // ---- 1) Znižanje zaloge (CAS) ----
      const decrements: { productId: string; variantId?: string | null }[] = []
      for (const line of data.lines) {
        if (line.productVariantId) {
          const v = variantById.get(line.productVariantId)!
          const ok = await decrementStock(tx, "ProductVariant", v.id, orgId, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId, variantId: v.id })
        } else {
          const p = productById.get(line.productId)!
          if (!p.trackInventory) throw new Error("NOT_TRACKED")
          const ok = await decrementStock(tx, "Product", p.id, orgId, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId })
        }
      }

      // ---- 2) Order + Items ----
      let subtotal = 0
      for (const l of data.lines) {
        const v = l.productVariantId ? variantById.get(l.productVariantId)! : null
        subtotal += Number(v ? v.price ?? 0 : productById.get(l.productId)!.price ?? 0) * l.quantity
      }

      const created = await tx.order.create({
        data: {
          organizationId: orgId,
          customerId: opts.useWorkOrderCustomer ? wo.customerId ?? null : null,
          subtotal,
          tax: 0,
          total: subtotal,
          status: "PAID",
          paymentMethod: "offline",
          notes: `${opts.orderNotes} #${wo.id.slice(-6)}${
            idempotencyKey ? `\n${idempotencyMarker(idempotencyKey)}` : ""
          }`,
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

      // ---- 3) StockMovement OUT (source ORDER, orderId) ----
      for (const d of decrements) {
        const line = data.lines.find(
          (x) =>
            x.productId === d.productId &&
            (d.variantId ? x.productVariantId === d.variantId : !x.productVariantId)
        )!
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: d.productId,
            ...(d.variantId ? { productVariantId: d.variantId } : {}),
            direction: "OUT",
            quantity: line.quantity,
            source: "ORDER",
            orderId: created.id,
            ...(data.notes
              ? { note: `Delovni nalog: ${data.notes.trim()}` }
              : { note: `${opts.orderNotes} #${wo.id.slice(-6)}` }),
          },
        })
      }

      // ---- 4) Document { workOrderId, orderId } — povezava nalog↔naročilo ----
      const fiscalYear = fiscalYearOf(new Date())
      const number = await nextDocumentNumber(tx, orgId, opts.documentType, fiscalYear)
      const doc = await tx.document.create({
        data: {
          organizationId: orgId,
          type: opts.documentType,
          number,
          status: opts.documentStatus,
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
          notes: opts.documentNotes,
        },
      })

      // ---- 5) WorkOrderEvent za revizijsko sled ----
      const totalQty = data.lines.reduce((s, l) => s + l.quantity, 0)
      const defaultEventMsg = `Poraba: ${totalQty} kos → naročilo ${created.id.slice(-6)} / dokument ${number}`
      const eventMsg = opts.eventMessage
        ? opts.eventMessage(totalQty, created.id.slice(-6), number)
        : defaultEventMsg

      await tx.workOrderEvent.create({
        data: {
          organizationId: orgId,
          workOrderId: data.workOrderId,
          type: "NOTE",
          message: eventMsg,
          actorEmail: session.user?.email ?? null,
        },
      })

      return { orderId: created.id, documentId: doc.id }
    })

    // Revalidacija poti
    if (opts.revalidatePaths && opts.revalidatePaths.length > 0) {
      for (const path of opts.revalidatePaths) {
        revalidatePath(path)
      }
    } else {
      // Privzete poti za splošni primer
      revalidatePath("/dashboard/work-orders")
      revalidatePath("/dashboard")
    }

    return { ok: true, orderId: result.orderId, documentId: result.documentId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    // Hkratni dvojni klic z isto idempotency-key: transakcija tega klica je bila
    // razveljavljena (nič porabljenega). Poišči rezultat zmagovalnega klica.
    if (msg === IDEMPOTENCY_CONFLICT && idempotencyKey) {
      const existing = await resolveIdempotentResult(orgId, idempotencyKey)
      if (existing) {
        return { ok: true, orderId: existing.orderId, documentId: existing.documentId }
      }
      // Zmagovalni klic morda še ni dokončal — klient naj ponovi / osveži.
      return { ok: false, error: "IDEMPOTENCY_CONFLICT_RETRY" }
    }
    if (msg === "INSUFFICIENT_STOCK") return { ok: false, error: "INSUFFICIENT_STOCK" }
    if (msg === "NOT_TRACKED") return { ok: false, error: "NOT_TRACKED" }
    if (msg === "WORKORDER_NOT_FOUND") return { ok: false, error: "WORKORDER_NOT_FOUND" }
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}

// ============================================================
// Konfiguracijske opcije porabe so v @/lib/consumption-options (izven "use server").
// Next Build ne dovoli izvoženih objektov iz Server Action modulov.
// ============================================================
