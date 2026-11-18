"use server"

// ============================================================
// SLEDLJIVOST PRIDELKA MEDU (2D-1P) — build na obstoječi shemi.
//
// Sledljivost poteka IZKLJUČNO prek obstoječih modelov:
//   • ExtensionRecord (harvest / batch) — pridelek + serija,
//   • StockMovement.batchRecordId — IN (polnjenje iz pridelka v
//     zalogo) in OUT (prodaja iz serije) vrstice vodijo sled,
//   • Prodajna alokacija iz več serij = ena OUT vrsta na serijo
//     s pod-količino (ni dvojnega odštevanja — en OUT na (serija,
//     količina), skupaj == količina linije).
//
// NAMERNO NI spremembe sheme/migracij: interni zapisi polnjenj so
// shranjeni v `data.__fills` na serijskem ExtensionRecord (append-only),
// količine po seriji se rekonstruirajo iz StockMovement knjige.
//
// Polja `__fills` NISO del deklarativnih `fields`; vsi zapisi, ki jih
// ustvarjamo, so strogo org-scoped in v eni transakciji (rollback ob
// napaki). Popravki DODAJEJO nove vnose (append-only) in nikoli ne
// spreminjajo starih — zgodovina ostane čista.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { orgToday } from "@/lib/org-date"

const BATCH_EXT = "batch-production"
const BATCH_KEY = "batch"
const HARVEST_KEY = "harvest"

// ------------------------------------------------------------------
// Tipi in sheme
// ------------------------------------------------------------------

export interface HarvestContribution {
  harvestId: string
  packedKg: number
}

export interface BatchFillRecord {
  idempotencyKey: string
  // Za en sam pridelek: harvestId + packedKg. Za mešanico: `contributions`
  // nosi razdelitev kg po pridelkih (harvestId ostane primarni za UI).
  harvestId: string
  packedKg: number
  contributions?: HarvestContribution[]
  productId: string
  productVariantId: string | null
  units: number // število kozarcev/embalaž (knjiženo v zalogo)
  fillDate: string // ISO datum
  note?: string
  correctionNote?: string
  createdAt: string
}

interface BatchRecordData {
  __fills?: BatchFillRecord[]
}

// createdFill input
const fillSchema = z.object({
  // Vsaj en pridelek (mešanica = več pridelkov iste vrste medu).
  harvestIds: z.array(z.string().min(1).max(64)).min(1).max(10),
  // Serija: bodisi obstoječa (batchId) bodisi nova (batchCode + metadata).
  batchId: z.string().min(1).max(64).nullable().optional(),
  batchCode: z.string().trim().min(1).max(120).optional(),
  batchProductionDate: z.string().optional(),
  batchProductType: z.string().optional(),
  batchApiary: z.string().optional(),
  batchNotes: z.string().max(500).nullable().optional(),
  // Izdelek / različica, v katero gre med.
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  // Proizvodnja
  units: z.number().int().positive().max(1_000_000), // kozarcev (v zalogo)
  packedKg: z.number().positive().max(1_000_000), // porabljena kg (izgube vštete)
  fillDate: z.string().optional(),
  idempotencyKey: z.string().min(8).max(120),
  note: z.string().max(500).nullable().optional(),
})

export type CreateFillInput = z.input<typeof fillSchema>

export interface CreateFillResult {
  ok: boolean
  error?: string
  batchId?: string
}

// ------------------------------------------------------------------
// Pomožni: branje AR chranjenih fill zapisov
// ------------------------------------------------------------------

function getFills(data: unknown): BatchFillRecord[] {
  if (data && typeof (data as BatchRecordData).__fills === "object") {
    const f = (data as BatchRecordData).__fills
    if (Array.isArray(f)) return f as BatchFillRecord[]
  }
  return []
}

/** Porabljena kg pridelka iz vseh polinjenj (append-only, vse serije org). */
async function harvestUsage(orgId: string, harvestId: string): Promise<number> {
  const batches = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, extensionId: BATCH_EXT, entityKey: BATCH_KEY },
    select: { data: true },
  })
  let used = 0
  for (const b of batches) {
    for (const f of getFills(b.data)) {
      if (f.contributions?.length) {
        for (const c of f.contributions) if (c.harvestId === harvestId) used += c.packedKg
      } else if (f.harvestId === harvestId) {
        used += f.packedKg
      }
    }
  }
  return used
}

/** Zaloga po seriji (v enotah) za dano VRSTICO (product ali variant), iz StockMovement knjige. */
async function batchNetUnits(
  orgId: string,
  batchId: string,
  opts: { productId?: string; productVariantId?: string | null }
): Promise<number> {
  const whereIn: Prisma.StockMovementWhereInput = {
    organizationId: orgId,
    batchRecordId: batchId,
    direction: "IN",
  }
  const whereOut: Prisma.StockMovementWhereInput = {
    organizationId: orgId,
    batchRecordId: batchId,
    direction: "OUT",
  }
  if (opts.productVariantId) {
    whereIn.productVariantId = opts.productVariantId
    whereOut.productVariantId = opts.productVariantId
  } else if (opts.productId) {
    whereIn.productId = opts.productId
    whereOut.productId = opts.productId
  }
  const [inn, out] = await Promise.all([
    prisma.stockMovement.aggregate({ where: whereIn, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: whereOut, _sum: { quantity: true } }),
  ])
  return (inn._sum.quantity ?? 0) - (out._sum.quantity ?? 0)
}

// ------------------------------------------------------------------
// createFillBatch — polnjenje pridelka v serijo → zaloga izdelka.
// ------------------------------------------------------------------

export async function createFillBatch(input: CreateFillInput): Promise<CreateFillResult> {
  const parsed = fillSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id
  const fillDateISO = data.fillDate || (await orgToday(orgId))

  try {
    return await prisma.$transaction(async (tx) => {
      // ---- 1) Validacija pridelkov (vsi ISTE org + vrste medu) ----
      const harvests = await tx.extensionRecord.findMany({
        where: { organizationId: orgId, extensionId: "bee-apiary", entityKey: HARVEST_KEY, id: { in: data.harvestIds } },
        select: { id: true, title: true, data: true },
      })
      if (harvests.length !== data.harvestIds.length) throw new Error("HARVEST_NOT_FOUND")
      const honeyTypes = new Set<string>()
      for (const h of harvests) {
        const ht = (h.data as Record<string, unknown>)?.honey_type
        if (typeof ht === "string") honeyTypes.add(ht)
      }
      // Ne meša se različnih vrst medu v enem polinjenju.
      if (honeyTypes.size > 1) throw new Error("HONEY_TYPE_MISMATCH")

      // ---- 2) Serija (obstoječa ali nova) — preverjamo prej kot razpoložljivost
      //        pridelka, da tuja/neveljavna serija vrne BATCH_NOT_FOUND, ne zastale
      //        INSUFFICIENT_HARVEST (tuji org ne sme potegati čez org-validacijo).
      let batchRecordId: string
      if (data.batchId) {
        const b = await tx.extensionRecord.findFirst({
          where: { id: data.batchId, organizationId: orgId, extensionId: BATCH_EXT, entityKey: BATCH_KEY },
          select: { id: true, data: true, title: true },
        })
        if (!b) throw new Error("BATCH_NOT_FOUND")
        // Idempotency: isti ključ že obstaja v tej seriji → ne dupliramo.
        if (getFills(b.data).some((f) => f.idempotencyKey === data.idempotencyKey)) {
          throw new Error("DUPLICATE_FILL")
        }
        batchRecordId = b.id
      } else {
        const code = data.batchCode?.trim() || `SERIJA-${Date.now().toString(36).toUpperCase()}`
        const created = await tx.extensionRecord.create({
          data: {
            organizationId: orgId,
            extensionId: BATCH_EXT,
            entityKey: BATCH_KEY,
            title: `${code} — ${data.batchProductionDate || "?"}`,
            data: {
              batch_code: code,
              production_date: data.batchProductionDate || fillDateISO,
              quantity_kg: data.packedKg,
              product_type: data.batchProductType || "Cvetlični med",
              apiary: data.batchApiary || null,
              notes: data.batchNotes || null,
            },
          },
          select: { id: true },
        })
        batchRecordId = created.id
      }

      // ---- 2b) Razpoložljivost pridelka (vsota vseh polinjenj tega pridelka) ----
      // Pri mešanici se data.packedKg enakomerno razporedi med prispevke;
      // vsak pridelek samostojno preverimo (ne preseže svoje pridelane količine).
      const share = data.packedKg / data.harvestIds.length
      for (const h of harvests) {
        const qtyKg = Number((h.data as Record<string, unknown>)?.quantity_kg ?? 0)
        const used = await harvestUsage(orgId, h.id)
        // Polnilo je lahko manjše od razpoložljivega; skupno porabljeno
        // NIKOLI ne preseže pridelane količine (negative preprečeno).
        if (used + share > qtyKg + 1e-9) {
          throw new Error("INSUFFICIENT_HARVEST")
        }
      }

      // ---- 4) Izdelek / varianta (org-scoped) ----
      const product = await tx.product.findFirst({
        where: { id: data.productId, organizationId: orgId, isActive: true },
        select: { id: true, trackInventory: true },
      })
      if (!product) throw new Error("PRODUCT_NOT_FOUND")
      let variantOk: string | null = null
      if (data.productVariantId) {
        const v = await tx.productVariant.findFirst({
          where: { id: data.productVariantId, productId: data.productId, organizationId: orgId },
          select: { id: true },
        })
        if (!v) throw new Error("VARIANT_MISMATCH")
        variantOk = v.id
      }

      // ---- 5) Append-only fill zapis na serijo + StockMovement IN ----
      const existing = await tx.extensionRecord.findUnique({
        where: { id: batchRecordId },
        select: { data: true },
      })
      const fills = getFills(existing?.data)
      if (fills.some((f) => f.idempotencyKey === data.idempotencyKey)) {
        throw new Error("DUPLICATE_FILL")
      }
      const fill: BatchFillRecord = {
        idempotencyKey: data.idempotencyKey,
        harvestId: data.harvestIds[0], // primarni pridelek (UI)
        packedKg: data.packedKg,
        // mešanica: razporedi kg po posameznih pridelkih (ProductionContribution)
        contributions:
          data.harvestIds.length > 1
            ? data.harvestIds.map((hid) => ({ harvestId: hid, packedKg: share }))
            : undefined,
        productId: data.productId,
        productVariantId: variantOk,
        units: data.units,
        fillDate: fillDateISO,
        note: data.note ?? undefined,
        createdAt: new Date().toISOString(),
      }
      const nextData: Record<string, unknown> = { ...(existing?.data as Record<string, unknown> | undefined) }
      nextData.__fills = [...fills, fill]

      await tx.extensionRecord.update({
        where: { id: batchRecordId },
        data: { data: nextData as unknown as Prisma.InputJsonValue },
      })

      // StockMovement IN (source MANUAL, batchRecordId) — knjiženje v zalogo.
      await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          productId: data.productId,
          ...(variantOk ? { productVariantId: variantOk } : {}),
          direction: "IN",
          quantity: data.units,
          source: "MANUAL",
          batchRecordId,
          note: data.note?.trim() || `Polinjenje serije (${data.units} enot, ${data.packedKg} kg)`,
        },
      })

      // Znižanje/višanje zaloge izdelka/variante (IN → +units).
      if (variantOk) {
        await tx.productVariant.update({ where: { id: variantOk }, data: { stockQuantity: { increment: data.units } } })
      } else {
        await tx.product.update({ where: { id: data.productId }, data: { stockQuantity: { increment: data.units } } })
      }

      return { ok: true, batchId: batchRecordId }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const known = [
      "HARVEST_NOT_FOUND",
      "HONEY_TYPE_MISMATCH",
      "INSUFFICIENT_HARVEST",
      "BATCH_NOT_FOUND",
      "DUPLICATE_FILL",
      "PRODUCT_NOT_FOUND",
      "VARIANT_MISMATCH",
    ]
    if (known.includes(msg)) return { ok: false, error: msg }
    return { ok: false, error: "TRANSACTION_FAILED" }
  } finally {
    revalidatePath("/dashboard/records")
  }
}

// ------------------------------------------------------------------
// Pregled pridelkov + njihovih proizvodnih serij + ostanka
// ------------------------------------------------------------------

export interface HarvestProductionLine {
  harvest: { id: string; title: string; honeyType: string; quantityKg: number; remainingKg: number }
  batches: { id: string; title: string; code: string; filledUnits: number; packedKg: number }[]
}

export async function getHarvestProduction(): Promise<HarvestProductionLine[]> {
  const { org } = await requirePermissionOrg("products.manage")
  const orgId = org.id

  const [harvests, batches] = await Promise.all([
    prisma.extensionRecord.findMany({
      where: { organizationId: orgId, extensionId: "bee-apiary", entityKey: HARVEST_KEY },
      select: { id: true, title: true, data: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.extensionRecord.findMany({
      where: { organizationId: orgId, extensionId: BATCH_EXT, entityKey: BATCH_KEY },
      select: { id: true, title: true, data: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ])

  const lines: HarvestProductionLine[] = []
  for (const h of harvests) {
    const d = h.data as Record<string, unknown> | undefined
    const qtyKg = Number(d?.quantity_kg ?? 0)
    let used = 0
    const matching: { id: string; title: string; code: string; filledUnits: number; packedKg: number }[] = []
    for (const b of batches) {
      const bd = getFills(b.data)
      const bCode = String((b.data as Record<string, unknown>)?.batch_code ?? b.title)
      let units = 0
      let packedUnits = 0
      for (const f of bd) {
        // pridelek je v tem fillu (mix: prek contributions)
        const inFill = f.contributions?.length
          ? f.contributions.some((c) => c.harvestId === h.id)
          : f.harvestId === h.id
        if (inFill) {
          units += f.units
          const c = f.contributions?.find((cc) => cc.harvestId === h.id)
          const packed = c ? c.packedKg : f.packedKg
          packedUnits += packed
          used += packed
        }
      }
      if (packedUnits > 0) matching.push({ id: b.id, title: b.title, code: bCode, filledUnits: units, packedKg: packedUnits })
    }
    lines.push({
      harvest: {
        id: h.id,
        title: h.title,
        honeyType: String(d?.honey_type ?? ""),
        quantityKg: qtyKg,
        remainingKg: Math.max(0, qtyKg - used),
      },
      batches: matching,
    })
  }
  return lines
}

// ------------------------------------------------------------------
// Razpoložljiva količina po serijah za eno prodajno "linijo"
// (izdelka ali različice) — uporabljena v prodajnem dialogu.
// ------------------------------------------------------------------

export interface BatchAvailability {
  batchId: string
  batchCode: string
  batchTitle: string
  available: number // neto enot na seriji (IN − OUT)
  filled: number
  sold: number
}

export async function getBatchAvailabilityForLine(
  productId: string,
  productVariantId?: string | null
): Promise<BatchAvailability[]> {
  const { org } = await requirePermissionOrg("orders.manage")
  const orgId = org.id

  const batches = await prisma.extensionRecord.findMany({
    where: { organizationId: orgId, extensionId: BATCH_EXT, entityKey: BATCH_KEY },
    select: { id: true, title: true, data: true },
    orderBy: { createdAt: "asc" },
    take: 300,
  })

  const out: BatchAvailability[] = []
  for (const b of batches) {
    const bd = getFills(b.data)
    let matchingProduct = false
    let filled = 0
    for (const f of bd) {
      const lineProduct = productVariantId ? f.productVariantId === productVariantId : f.productId === productId && !f.productVariantId
      if (lineProduct) {
        matchingProduct = true
        filled += f.units
      }
    }
    if (!matchingProduct) continue
    const net = await batchNetUnits(orgId, b.id, { productId, productVariantId })
    out.push({
      batchId: b.id,
      batchCode: String((b.data as Record<string, unknown>)?.batch_code ?? b.title),
      batchTitle: b.title,
      available: net,
      filled,
      sold: filled - net,
    })
  }
  return out
}

// ------------------------------------------------------------------
// Izvor prodaje — rekonstrukcija verige naročilo → serija → pridelek
// ------------------------------------------------------------------

export interface OrderItemProvenance {
  batchId: string
  batchCode: string
  batchTitle: string
  quantity: number
  harvests: { id: string; title: string; honeyType: string }[]
}

export interface OrderProvenance {
  orderId: string
  items: OrderItemProvenance[]
  anyBatch: boolean
}

export async function resolveOrderProvenance(orderId: string): Promise<OrderProvenance | null> {
  const { org } = await requirePermissionOrg("orders.manage")
  const orgId = org.id

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId: orgId },
    select: { id: true },
  })
  if (!order) return null

  // OUT premiki s serijo (source ORDER) → vse serije, iz katerih je bilo prodano.
  const outs = await prisma.stockMovement.findMany({
    where: { organizationId: orgId, orderId: order.id, batchRecordId: { not: null } },
    select: {
      id: true,
      quantity: true,
      batchRecordId: true,
      productId: true,
      productVariantId: true,
    },
  })
  if (outs.length === 0) return { orderId, items: [], anyBatch: false }

  const batchIds = [...new Set(outs.map((o) => o.batchRecordId!).filter(Boolean))]
  const batchRecs = await prisma.extensionRecord.findMany({
    where: { id: { in: batchIds }, organizationId: orgId },
    select: { id: true, title: true, data: true },
  })
  const byId = new Map(batchRecs.map((b) => [b.id, b]))

  const items: OrderItemProvenance[] = []
  for (const out of outs) {
    const b = byId.get(out.batchRecordId!)
    if (!b) continue
    const fills = getFills(b.data)
    const harvestIds = [
      ...new Set(fills.flatMap((f) =>
        f.contributions?.length ? f.contributions.map((c) => c.harvestId) : [f.harvestId]
      )),
    ]
    const harvestRecs = await prisma.extensionRecord.findMany({
      where: { id: { in: harvestIds }, organizationId: orgId },
      select: { id: true, title: true, data: true },
    })
    items.push({
      batchId: b.id,
      batchCode: String((b.data as Record<string, unknown>)?.batch_code ?? b.title),
      batchTitle: b.title,
      quantity: out.quantity,
      harvests: harvestRecs.map((h) => ({
        id: h.id,
        title: h.title,
        honeyType: String((h.data as Record<string, unknown>)?.honey_type ?? ""),
      })),
    })
  }

  return { orderId: order.id, items, anyBatch: true }
}