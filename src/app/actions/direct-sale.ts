"use server"

// ============================================================
// NEPOSREDNA PRODAJA (ADMIN, brez Stripe) — 2D-1O.
//
// Lastnik po načinu "gotovina/nakazilo" (paymentMethod != "online")
// ustvari naročilo NEposredno iz admin UI-ja, brez Stripe plačilnega
// toka. Vse (Order + OrderItems + StockMovement + znižanje zaloge)
// poteka v ENI transakciji z zaklepanjem vrstice (P1-D-1C) — nobenega
// dvojnega odštevanja, nobene negativne zaloge, nobenega delnega stanja.
//
// Pravila:
//   • org-scoped (requirePermissionOrg "orders.manage")
//   • linije: productId (+ opcijsko productVariantId), quantity > 0
//   • varianta mora pripadati izdelku IN tej org; ni mešanja product/
//     variant na isti izdelek v enem naročilu (vsaka linija izbere svojo
//     avtoritativno raven zaloge: variant, če je variantId — sicer product)
//   • znižanje samo z "stock − reserved >= qty" (ne prodaj rezervirano,
//     ne negativno zalogo); SELECT … FOR UPDATE + svež branja
//   • cena = product.price (gross), subtotal/total brez DDV dodatka;
//     paymentMethod privzeto "offline" (gotovina/nakazilo)
//   • napaka → celoten rollback (brez delnih podatkov)
//
// 2D-1P — PLAČILNI STATUS (§6):
//   • online NIKOLI v neposredni prodaji (tu ni dejanskega plačila) → zavrnjen.
//   • gotovina ("cash") / ob prevzemu ("offline") → PAID (prodaja je takoj
//     zaključena, denar fizično prejet).
//   • nakazilo ("transfer") → PENDING – NIKOLI ni označeno prejeto, dokler
//     ni potrjeno (knjiženje ostane na roko prek statusa naročila).
//
// 2D-1P — PRODAJA IZ SERIJE:
//   linija lahko nosi `batchAllocations: [{batchRecordId, quantity}]`, kar
//   prodano količino razdeli med eno ali več serij. Vsaka alokacija ustvari
//   eno OUT StockMovement s `batchRecordId` (sledljivost izvora v naročilu);
//   vsota alokacij == quantity linije, vsaka alokacija ≤ neto zaloge serije
//   (Σ IN − Σ OUT), s SELECT … FOR UPDATE na seriji za sočasne prodaje.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const lineSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  quantity: z.number().int().positive().max(1_000_000),
  // 2D-1P: prodaja iz serije oz. razdeli količino med več serij.
  // Vsi alloc-e so org-scoped in ne smejo preseči razpoložljive neto
  // količine serije; vsota alloc-e == quantity.
  batchAllocations: z
    .array(
      z.object({
        batchRecordId: z.string().min(1).max(64),
        quantity: z.number().int().positive().max(1_000_000),
      })
    )
    .max(20)
    .optional(),
})

const directSaleSchema = z.object({
  lines: z.array(lineSchema).min(1).max(100),
  // Optional existing customer (org-scoped, validated server-side).
  customerId: z.string().min(1).max(64).nullable().optional(),
  paymentMethod: z.enum(["offline", "cash", "transfer", "online"]).optional(),
  notes: z.string().max(500).nullable().optional(),
})

export interface DirectSaleResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * Ena linija v transakciji: zniža VARIANTO ali PRODUKT zalogo (odvisno
 * od avtoritativne ravni) z CAS-pogojem "stock − reserved >= qty".
 * Vrne true, če je bilo stanje dejansko znižano (ni dvojnega, ni negativnega).
 */
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

export async function createDirectOrder(input: z.input<typeof directSaleSchema>): Promise<DirectSaleResult> {
  const parsed = directSaleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "VALIDATION" }
  const data = parsed.data

  const { org } = await requirePermissionOrg("orders.manage")

  // ---- Org-scoped validacija produktov + variant ---------------------------------
  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: org.id, isActive: true },
    select: { id: true, name: true, price: true, trackInventory: true }, // price se pretvori spodaj iz Decimala v number
  })
  if (products.length !== productIds.length) {
    return { success: false, error: "NOT_FOUND" }
  }

  const variantIds = data.lines
    .map((l) => l.productVariantId)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
  let variants: { id: string; productId: string; name: string; sku: string | null; price: unknown }[] = []
  if (variantIds.length) {
    variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, organizationId: org.id },
      select: { id: true, productId: true, name: true, sku: true, price: true },
    })
    if (variants.length !== variantIds.length) return { success: false, error: "VARIANT_NOT_FOUND" }
    // vsaka varianta mora pripadati izdelku (kot v input liniji)
    for (const l of data.lines) {
      if (!l.productVariantId) continue
      const v = variants.find((x) => x.id === l.productVariantId)
      if (!v || v.productId !== l.productId) return { success: false, error: "VARIANT_MISMATCH" }
    }
  }

  // ---- 2D-1P: org-scoped validacija serij + neto količin (IN − OUT) ----
  const batchLineIds: { lineId: number; batchId: string; qty: number }[] = []
  data.lines.forEach((l, li) => {
    for (const a of l.batchAllocations ?? []) {
      batchLineIds.push({ lineId: li, batchId: a.batchRecordId, qty: a.quantity })
    }
  })
  let batchRecs: { id: string }[] = []
  if (batchLineIds.length) {
    const batchIds = [...new Set(batchLineIds.map((b) => b.batchId))]
    batchRecs = await prisma.extensionRecord.findMany({
      where: { id: { in: batchIds }, organizationId: org.id, entityKey: "batch" },
      select: { id: true },
    })
    if (batchRecs.length !== batchIds.length) return { success: false, error: "BATCH_NOT_FOUND" }
    const batchIdSet = new Set(batchRecs.map((b) => b.id))
    // skumulirana neto zaloga po (linija) → preverimo na transakcijskem branju
    for (const a of batchLineIds) {
      if (!batchIdSet.has(a.batchId)) return { success: false, error: "BATCH_NOT_FOUND" }
    }
  }

  // ---- Opcijska stranka (org-scoped) ---------------------------------------------
  if (data.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { success: false, error: "CUSTOMER_NOT_FOUND" }
  }

  const productById = new Map(products.map((p) => [p.id, p]))
  const variantById = new Map(variants.map((v) => [v.id, v]))

  // 2D-1P §6 — plačilni status neposredne prodaje:
  //   • online nikoli v neposredni prodaji (ni dejanskega plačila tu).
  //   • gotovina/offline: PAID šele ob zaključeni prodaji (takoj).
  //   • nakazilo (transfer): PENDING — ni označeno prejeto, dokler ni potrjeno.
  const method = data.paymentMethod ?? "offline"
  if (method === "online") return { success: false, error: "ONLINE_NOT_SUPPORTED" }
  const orderStatus: "PAID" | "PENDING" = method === "transfer" ? "PENDING" : "PAID"

  try {
    const order = await prisma.$transaction(async (tx) => {
      // ---- 0) 2D-1P: zaklepanje serij (SELECT ... FOR UPDATE) pred neto
      //        preverjanjem — dve sočasni prodaji iste serije se serializirata,
      //        tako da skupna prodaja ne preseže razpoložljive količine serije.
      const batchLockIds = [
        ...new Set(
          data.lines.flatMap((l) =>
            (l.batchAllocations ?? []).map((a) => a.batchRecordId)
          )
        ),
      ]
      // Zakleni vsako serijo posebej (skalarni param, zanesljiv FOR UPDATE).
      for (const bid of batchLockIds) {
        const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "ExtensionRecord" WHERE "id" = $1::text AND "organizationId" = $2::text FOR UPDATE`,
          bid,
          org.id
        )
        if (locked.length !== 1) throw new Error("BATCH_NOT_FOUND")
      }

      // ---- 1) 2D-1P: neto zaloga serije (IN − OUT) vs. alokacija ----
      // Preverjamo PRED znižanjem fizične zaloge, da je serija avtoritativni
      // vir (BATCH_INSUFFICIENT pride ven pred INSUFFICIENT_STOCK) — vse v
      // ISTI transakciji, brez delnih zapisov.
      for (let li = 0; li < data.lines.length; li++) {
        const allocs = data.lines[li].batchAllocations ?? []
        if (allocs.length === 0) continue
        // vsota alokacij mora biti == količina linije
        const allocSum = allocs.reduce((s, a) => s + a.quantity, 0)
        if (allocSum !== data.lines[li].quantity) throw new Error("BATCH_ALLOCATION_MISMATCH")
        const product = productById.get(data.lines[li].productId)!
        for (const a of allocs) {
          // neto = Σ(IN batch) − Σ(OUT batch) za to linijo (variant/product)
          const net = await tx.stockMovement.aggregate({
            where: {
              organizationId: org.id,
              batchRecordId: a.batchRecordId,
              ...(data.lines[li].productVariantId
                ? { productVariantId: data.lines[li].productVariantId }
                : { productId: product.id, productVariantId: null }),
              direction: "IN",
            },
            _sum: { quantity: true },
          })
          const used = await tx.stockMovement.aggregate({
            where: {
              organizationId: org.id,
              batchRecordId: a.batchRecordId,
              ...(data.lines[li].productVariantId
                ? { productVariantId: data.lines[li].productVariantId }
                : { productId: product.id, productVariantId: null }),
              direction: "OUT",
            },
            _sum: { quantity: true },
          })
          const available = (net._sum.quantity ?? 0) - (used._sum.quantity ?? 0)
          if (a.quantity > available) throw new Error("BATCH_INSUFFICIENT")
        }
      }

      // ---- 2) Zaklepanje + znižanje zaloge (P1-D-1C: sveže stanje, atomsko) ----
      const decrements: { productId: string; variantId?: string | null; lineIdx: number }[] = []
      for (let li = 0; li < data.lines.length; li++) {
        const line = data.lines[li]
        if (line.productVariantId) {
          const v = variantById.get(line.productVariantId)!
          // variant: product je "container" brez lastnega stocka? Še ni — znižujemo VARIANTO.
          const ok = await decrementStock(tx, "ProductVariant", v.id, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId, variantId: v.id, lineIdx: li })
        } else {
          const p = productById.get(line.productId)!
          if (!p.trackInventory) throw new Error("NOT_TRACKED")
          const ok = await decrementStock(tx, "Product", p.id, line.quantity)
          if (!ok) throw new Error("INSUFFICIENT_STOCK")
          decrements.push({ productId: line.productId, lineIdx: li })
        }
      }

      // ---- 2b) Order + Items ----
      let subtotal = 0
      for (const l of data.lines) {
        const v = l.productVariantId ? variantById.get(l.productVariantId)! : null
        const unit = v ? Number(v.price ?? 0) : Number(productById.get(l.productId)!.price ?? 0)
        subtotal += unit * l.quantity
      }

      const created = await tx.order.create({
        data: {
          organizationId: org.id,
          customerId: data.customerId ?? null,
          subtotal,
          tax: 0,
          total: subtotal,
          status: orderStatus,
          paymentMethod: method,
          notes: data.notes?.trim() || "Neposredna prodaja (brez spletnega plačila).",
          items: {
            create: data.lines.map((l) => {
              const unit = l.productVariantId
                ? Number(variantById.get(l.productVariantId)!.price ?? 0)
                : Number(productById.get(l.productId)!.price ?? 0)
              const v = l.productVariantId ? variantById.get(l.productVariantId)! : null
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

      // ---- 3) StockMovement (ORDER) s serijo, kjer je podana ----
      for (const d of decrements) {
        const line = data.lines[d.lineIdx]
        const allocs = line.batchAllocations ?? []
        if (allocs.length === 0) {
          await tx.stockMovement.create({
            data: {
              organizationId: org.id,
              productId: d.productId,
              ...(d.variantId ? { productVariantId: d.variantId } : {}),
              direction: "OUT",
              quantity: line.quantity,
              source: "ORDER",
              orderId: created.id,
              ...(data.notes ? { note: data.notes.trim() } : {}),
            },
          })
        } else {
          // Ena OUT vrsta na (serija, količina) — ne dvojno odštevanje,
          // sledljivost izvora per-serija.
          for (const a of allocs) {
            await tx.stockMovement.create({
              data: {
                organizationId: org.id,
                productId: d.productId,
                ...(d.variantId ? { productVariantId: d.variantId } : {}),
                direction: "OUT",
                quantity: a.quantity,
                source: "ORDER",
                orderId: created.id,
                batchRecordId: a.batchRecordId,
                ...(data.notes ? { note: data.notes.trim() } : {}),
              },
            })
          }
        }
      }

      return created
    })

    revalidatePath("/dashboard/orders")
    return { success: true, orderId: order.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "INSUFFICIENT_STOCK") return { success: false, error: "INSUFFICIENT_STOCK" }
    if (msg === "NOT_TRACKED") return { success: false, error: "NOT_TRACKED" }
    if (msg === "BATCH_ALLOCATION_MISMATCH") return { success: false, error: "BATCH_ALLOCATION_MISMATCH" }
    if (msg === "BATCH_INSUFFICIENT") return { success: false, error: "BATCH_INSUFFICIENT" }
    if (msg === "BATCH_NOT_FOUND") return { success: false, error: "BATCH_NOT_FOUND" }
    // Nobena druga napaka ne sme pustiti delnega stanja → transakcija se rollbacka.
    return { success: false, error: "TRANSACTION_FAILED" }
  }
}