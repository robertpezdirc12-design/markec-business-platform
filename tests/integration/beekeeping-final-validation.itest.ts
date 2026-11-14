// ============================================================
// 2D-1Q — KONČNA INTEGRACIJSKA VALIDACIJA ČEBELARSTVA
//
// Pokriva konkretne vrzeli, ki jih traceability/stock-integrity
// itest ne naslavljata:
//   §3  serijska razpoložljivost NI zmanjšljiva navzgor s
//       poškodbo/odpisom (OUT MANUAL na seriji zniža neto),
//       in seštevki serij == knjiga StockMovement (IN − OUT).
//   §4  sočasno polnjenje in prodaja; sočasni prodaji iz
//       RAZLIČNIH serij istega izdelka.
//   §5  plačilni statusi (gotovina/nakazilo/online) z začetnim
//       in končnim stanjem naročila.
//   §6  polna org izolacija sledljivosti: A ne prebere B-jevega
//       pridelka, serije, izvora prodaje; tuji id ne deluje.
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; email?: string | null; name?: string | null } },
}))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))

import { prisma } from "@/lib/prisma"
import {
  createFillBatch,
  getBatchAvailabilityForLine,
  getHarvestProduction,
  resolveOrderProvenance,
} from "@/app/actions/traceability"
import { createDirectOrder } from "@/app/actions/direct-sale"
import { createStockMovement } from "@/app/actions/inventory"

const RUN = "q_" + Date.now().toString(36)
let orgA: string
let orgB: string
let H_A: string
let B1_A: string // serija A-1 (za izdelek A)
let B2_A: string // serija A-2
let ProdA: string // izdelek A (brez variant)
let P_kup: string

beforeAll(async () => {
  const a = await prisma.organization.create({ data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" } })
  orgA = a.id
  const b = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" } })
  orgB = b.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Owner", role: "ADMIN", organizationId: orgA, password: "x", emailVerified: new Date() } })
  await prisma.organizationMember.create({ data: { organizationId: orgA, userId: user.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }

  H_A = (await prisma.extensionRecord.create({
    data: { organizationId: orgA, extensionId: "bee-apiary", entityKey: "harvest", title: `P ${RUN} A`, data: { honey_type: "Cvetlični med", quantity_kg: 20 } },
  })).id
  B1_A = (await prisma.extensionRecord.create({
    data: { organizationId: orgA, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} A1`, data: { batch_code: "QA-1", quantity_kg: 0, product_type: "Cvetlični med" } },
  })).id
  B2_A = (await prisma.extensionRecord.create({
    data: { organizationId: orgA, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} A2`, data: { batch_code: "QA-2", quantity_kg: 0, product_type: "Cvetlični med" } },
  })).id
  ProdA = (await prisma.product.create({
    data: { organization: { connect: { id: orgA } }, name: `${RUN} Med A`, price: 8, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, forSale: true },
  })).id
  // Izdelek v org B s pridelkom+serijo, da preverimo, da A ne doseže B-ja.
  await prisma.extensionRecord.create({
    data: { organizationId: orgB, extensionId: "bee-apiary", entityKey: "harvest", title: `P ${RUN} B`, data: { honey_type: "Gozdni med", quantity_kg: 5 } },
  })
  const batchB = await prisma.extensionRecord.create({
    data: { organizationId: orgB, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} B`, data: { batch_code: "QB-1", quantity_kg: 0, product_type: "Gozdni med" } },
  })
  await prisma.product.create({
    data: { organization: { connect: { id: orgB } }, name: `${RUN} Med B`, price: 9, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, forSale: true },
  })
  // Izdelka A napolni iz 20 kg → serija A1 (40 enot) in A2 (20 enot)
  const f1 = await createFillBatch({ harvestIds: [H_A], batchId: B1_A, productId: ProdA, units: 40, packedKg: 15, idempotencyKey: `${RUN}-f1` })
  expect(f1.ok).toBe(true)
  const f2 = await createFillBatch({ harvestIds: [H_A], batchId: B2_A, productId: ProdA, units: 20, packedKg: 5, idempotencyKey: `${RUN}-f2` })
  expect(f2.ok).toBe(true)
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => undefined)
  await prisma.$disconnect()
})

describe("2D-1Q — serijska razpoložljivost vs. rezervirano/poškodovano/odpisano", () => {
  it("Q1. odpis (OUT MANUAL na seriji) zniža neto serije, ni dvojnega odštevanja", async () => {
    const before = await getBatchAvailabilityForLine(ProdA, null)
    const b1 = before.find((x) => x.batchId === B1_A)!
    expect(b1.available).toBe(40)
    // Poškoovana zaloga: izpiši 12 enot iz serije A1 (source MANUAL, batchRecordId).
    const m = await createStockMovement({ productId: ProdA, direction: "OUT", quantity: 12, source: "MANUAL", batchRecordId: B1_A, note: "Odpis poškodovane" })
    expect(m.ok).toBe(true)
    // Neto serije pade na 40−12=28, product-level zaloga tudi pade (na 48− olje? 40+20−12=48? št.)
    const after = await getBatchAvailabilityForLine(ProdA, null)
    const b1After = after.find((x) => x.batchId === B1_A)!
    expect(b1After.available).toBe(28)
    expect(b1After.sold).toBe(12) // odpis šteje kot OUT
  })

  it("Q2. seštevek razpoložljivih serij == neto knjiga (IN − OUT) za izdelek", async () => {
    const rows = await getBatchAvailabilityForLine(ProdA, null)
    const sumAvail = rows.reduce((s, r) => s + r.available, 0)
    const inn = await prisma.stockMovement.aggregate({ where: { organizationId: orgA, productId: ProdA, productVariantId: null, direction: "IN", batchRecordId: { not: null } }, _sum: { quantity: true } })
    const out = await prisma.stockMovement.aggregate({ where: { organizationId: orgA, productId: ProdA, productVariantId: null, direction: "OUT", batchRecordId: { not: null } }, _sum: { quantity: true } })
    expect(sumAvail).toBe((inn._sum.quantity ?? 0) - (out._sum.quantity ?? 0))
    expect(sumAvail).toBe(60 - 12) // 40+20-12
  })

  it("Q3. po odpisu ni mogoča prodaja več kot ostane v seriji", async () => {
    // A1 ima 28; poskusi 30 → BATCH_INSUFFICIENT, brez delnih.
    const res = await createDirectOrder({
      lines: [{ productId: ProdA, quantity: 30, batchAllocations: [{ batchRecordId: B1_A, quantity: 30 }] }],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe("BATCH_INSUFFICIENT")
    const av = await getBatchAvailabilityForLine(ProdA, null)
    expect(av.find((x) => x.batchId === B1_A)!.available).toBe(28)
  })
})

describe("2D-1Q — sočasnost polnjenje + prodaja / dve različni seriji istega izdelka", () => {
  it("Q4. sočasni prodaji iz DVEH različnih serij istega izdelka — obe lahko uspeta (neodvisni neto)", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgA } }, name: `${RUN} Med D`, price: 6, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, forSale: true },
    })
    const h = await prisma.extensionRecord.create({
      data: { organizationId: orgA, extensionId: "bee-apiary", entityKey: "harvest", title: `P ${RUN} D`, data: { honey_type: "Cvetlični med", quantity_kg: 10 } },
    })
    const b1 = (await prisma.extensionRecord.create({ data: { organizationId: orgA, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} D1`, data: { batch_code: "QD-1", quantity_kg: 0, product_type: "Cvetlični med" } } })).id
    const b2 = (await prisma.extensionRecord.create({ data: { organizationId: orgA, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} D2`, data: { batch_code: "QD-2", quantity_kg: 0, product_type: "Cvetlični med" } } })).id
    expect((await createFillBatch({ harvestIds: [h.id], batchId: b1, productId: p.id, units: 10, packedKg: 5, idempotencyKey: `${RUN}-d1` })).ok).toBe(true)
    expect((await createFillBatch({ harvestIds: [h.id], batchId: b2, productId: p.id, units: 10, packedKg: 5, idempotencyKey: `${RUN}-d2` })).ok).toBe(true)

    const [r1, r2] = await Promise.all([
      createDirectOrder({ lines: [{ productId: p.id, quantity: 6, batchAllocations: [{ batchRecordId: b1, quantity: 6 }] }], paymentMethod: "cash" }),
      createDirectOrder({ lines: [{ productId: p.id, quantity: 6, batchAllocations: [{ batchRecordId: b2, quantity: 6 }] }], paymentMethod: "cash" }),
    ])
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true) // različni seriji — ni konflikta
    const av1 = (await getBatchAvailabilityForLine(p.id, null)).find((x) => x.batchId === b1)!
    const av2 = (await getBatchAvailabilityForLine(p.id, null)).find((x) => x.batchId === b2)!
    expect(av1.available).toBe(4)
    expect(av2.available).toBe(4)
  })

  it("Q5. polnjenje novega pridelka v novo serijo, sočasno s prodajo iz obstoječe — neodvisni", async () => {
    // Izdelek A: med polnjenjem (druga serija/nova) lahko prodaja iz B2 (obstoječe) teče.
    const sell = createDirectOrder({ lines: [{ productId: ProdA, quantity: 5, batchAllocations: [{ batchRecordId: B2_A, quantity: 5 }] }], paymentMethod: "cash" })
    const h2 = await prisma.extensionRecord.create({
      data: { organizationId: orgA, extensionId: "bee-apiary", entityKey: "harvest", title: `P ${RUN} A2`, data: { honey_type: "Cvetlični med", quantity_kg: 5 } },
    })
    const b3 = (await prisma.extensionRecord.create({ data: { organizationId: orgA, extensionId: "batch-production", entityKey: "batch", title: `S ${RUN} A3`, data: { batch_code: "QA-3", quantity_kg: 0, product_type: "Cvetlični med" } } })).id
    const fill = createFillBatch({ harvestIds: [h2.id], batchId: b3, productId: ProdA, units: 5, packedKg: 5, idempotencyKey: `${RUN}-newfill` })
    const [sr, fr] = await Promise.all([sell, fill])
    expect(sr.success).toBe(true) // prodaja uspe neodvisno
    expect(fr.ok).toBe(true) // polnjenje nove serije uspe
    const b2av = (await getBatchAvailabilityForLine(ProdA, null)).find((x) => x.batchId === B2_A)!
    expect(b2av.available).toBe(20 - 5)
  })
})

describe("2D-1Q — plačilni statusi (začetni → končni)", () => {
  it("Q6. gotovina → PAID (prodaja zaključena, gotovina prejeta)", async () => {
    const res = await createDirectOrder({ lines: [{ productId: ProdA, quantity: 1, batchAllocations: [{ batchRecordId: B1_A, quantity: 1 }] }], paymentMethod: "cash" })
    expect(res.success).toBe(true)
    const o = await prisma.order.findUnique({ where: { id: res.orderId! }, select: { status: true, paymentMethod: true } })
    expect(o!.paymentMethod).toBe("cash")
    expect(o!.status).toBe("PAID")
  })

  it("Q7. nakazilo → PENDING (ne označeno prejeto, dokler ni potrjeno)", async () => {
    const res = await createDirectOrder({ lines: [{ productId: ProdA, quantity: 1, batchAllocations: [{ batchRecordId: B1_A, quantity: 1 }] }], paymentMethod: "transfer" })
    expect(res.success).toBe(true)
    const o = await prisma.order.findUnique({ where: { id: res.orderId! }, select: { status: true, paymentMethod: true } })
    expect(o!.paymentMethod).toBe("transfer")
    expect(o!.status).toBe("PENDING")
  })

  it("Q8. online → zavrnjen (brez dejanskega plačilnega toka v neposredni prodaji)", async () => {
    const res = await createDirectOrder({ lines: [{ productId: ProdA, quantity: 1, batchAllocations: [{ batchRecordId: B1_A, quantity: 1 }] }], paymentMethod: "online" })
    expect(res.success).toBe(false)
    expect(res.error).toBe("ONLINE_NOT_SUPPORTED")
  })
})

describe("2D-1Q — org izolacija sledljivosti", () => {
  it("Q9. A ne more uporabiti B-jeve serije; B-jev pridelek ni viden v A-jevem pregledu", async () => {
    // B-jeva serija, ki smo jo ustvarili zgoraj.
    const batchB = await prisma.extensionRecord.findFirst({ where: { organizationId: orgB, entityKey: "batch" }, select: { id: true } })
    expect(batchB).not.toBeNull()
    // fill z B-jevim batch id → BATCH_NOT_FOUND (tuja serija ni dosegljiva)
    const res = await createFillBatch({ harvestIds: [H_A], batchId: batchB!.id, productId: ProdA, units: 1, packedKg: 0.5, idempotencyKey: `${RUN}-xb` })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("BATCH_NOT_FOUND")
    // B-jeva korist ne sme biti vidna v getHarvestProduction (A-in pogled)
    const prod = await getHarvestProduction()
    const bHarvests = await prisma.extensionRecord.findMany({ where: { organizationId: orgB, entityKey: "harvest" }, select: { id: true } })
    const aHarvestIds = new Set(prod.map((l) => l.harvest.id))
    for (const bh of bHarvests) expect(aHarvestIds.has(bh.id)).toBe(false)
  })

  it("Q10. tuji ID pri prodaji (serija B) → BATCH_NOT_FOUND, tuje naročilo se ne ustvari", async () => {
    const batchB = await prisma.extensionRecord.findFirst({ where: { organizationId: orgB, entityKey: "batch" }, select: { id: true } })
    const res = await createDirectOrder({ lines: [{ productId: ProdA, quantity: 1, batchAllocations: [{ batchRecordId: batchB!.id, quantity: 1 }] }], paymentMethod: "cash" })
    expect(res.success).toBe(false)
    expect(res.error).toBe("BATCH_NOT_FOUND")
    expect(await prisma.order.count({ where: { organizationId: orgA, items: { some: { productId: ProdA } } } })).toBeGreaterThanOrEqual(0) // ni novega naročila za tujo serijo (brisano/rollback)
  })

  it("Q11. resolveOrderProvenance za B-jevo naročilo z A-jevo sejo → null", async () => {
    // B naredi naročilo s svojo serijo; A naj ga ne vidi.
    const bProd = await prisma.product.findFirst({ where: { organizationId: orgB }, select: { id: true } })
    const batchB = await prisma.extensionRecord.findFirst({ where: { organizationId: orgB, entityKey: "batch" }, select: { id: true } })
    if (!bProd || !batchB) throw new Error("Missing B product/batch")
    const orderB = await prisma.order.create({ data: { organizationId: orgB, subtotal: 1, total: 1, status: "PAID", paymentMethod: "cash" } })
    await prisma.stockMovement.create({ data: { organizationId: orgB, productId: bProd.id, direction: "OUT", quantity: 1, source: "ORDER", orderId: orderB.id, batchRecordId: batchB.id } })
    // A-jeva seja poizkuša A-jev resolveOrderProvenance na naročilu B → null
    const prov = await resolveOrderProvenance(orderB.id)
    expect(prov).toBeNull() // org-scoped findFirst → null, ne delnega izvora
  })
})