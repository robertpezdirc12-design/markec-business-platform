// ============================================================
// 2D-1P — SLEDLJIVOST PRIDELKA MEDU (harvest → serija → izdelek →
// zaloga → prodaja → izvor). Izolirana baza markec_e2e_test.
//
// Preverja na obstoječi shemi (NI sprememb sheme):
//   createFillBatch (polnjenje v serijo + StockMovement IN + zaloga),
//   getHarvestProduction, getBatchAvailabilityForLine,
//   createDirectOrder z batchAllocations (prodaja iz ene/več serij),
//   resolveOrderProvenance (izvor v naročilu),
//   nezadostna serija, sočasne prodaje, rollback, tuja org.
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
import { createFillBatch, getHarvestProduction, getBatchAvailabilityForLine, resolveOrderProvenance } from "@/app/actions/traceability"
import { createDirectOrder } from "@/app/actions/direct-sale"

const RUN = "tr_" + Date.now().toString(36)
let orgId: string
let orgOtherId: string
let userId: string
let H1: string // harvest 1 (10 kg cvetlični) — test 1 porab
let H2: string // harvest 2 (5 kg cvetlični) — test 11 (dup)
let H_mixA: string // harvest za test mešanice (8 kg)
let H_mixB: string // harvest za test mešanice (7 kg)
let H_other: string // harvest druge org
let B1: string // serija 1
let B2: string // serija 2
let P_med: string // izdelek Cvetlični med
let V_250: string // varianta 250g
let V_500: string // varianta 500g
let P_otherOrg: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" } })
  orgId = org.id
  const orgB = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" } })
  orgOtherId = orgB.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Owner", role: "ADMIN", organizationId: org.id, password: "x", emailVerified: new Date() } })
  userId = user.id
  await prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }

  // Pridelki (ExtensionRecord, extensionId bee-apiary, entityKey harvest)
  const h1 = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "bee-apiary", entityKey: "harvest",
      title: `Pridelek ${RUN} H1`,
      data: { honey_type: "Cvetlični med", quantity_kg: 10, harvest_date: "2026-01-10" },
    },
  })
  H1 = h1.id
  const h2 = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "bee-apiary", entityKey: "harvest",
      title: `Pridelek ${RUN} H2`,
      data: { honey_type: "Cvetlični med", quantity_kg: 5, harvest_date: "2026-01-12" },
    },
  })
  H2 = h2.id
  // Harvesta za test 2 (mešanica, ista vrsta medu) — zadostna kapaciteta.
  const hmA = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "bee-apiary", entityKey: "harvest",
      title: `Pridelek ${RUN} HMIXA`,
      data: { honey_type: "Cvetlični med", quantity_kg: 8, harvest_date: "2026-01-13" },
    },
  })
  H_mixA = hmA.id
  const hmB = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "bee-apiary", entityKey: "harvest",
      title: `Pridelek ${RUN} HMIXB`,
      data: { honey_type: "Cvetlični med", quantity_kg: 7, harvest_date: "2026-01-13" },
    },
  })
  H_mixB = hmB.id
  const hOther = await prisma.extensionRecord.create({
    data: {
      organizationId: orgOtherId, extensionId: "bee-apiary", entityKey: "harvest",
      title: `Pridelek ${RUN} OTHER`, data: { honey_type: "Gozdni med", quantity_kg: 9 },
    },
  })
  H_other = hOther.id

  // Serije
  const b1 = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "batch-production", entityKey: "batch",
      title: `Serija ${RUN} B1`,
      data: { batch_code: "SER-1", production_date: "2026-01-15", quantity_kg: 0, product_type: "Cvetlični med" },
    },
  })
  B1 = b1.id
  const b2 = await prisma.extensionRecord.create({
    data: {
      organizationId: orgId, extensionId: "batch-production", entityKey: "batch",
      title: `Serija ${RUN} B2`,
      data: { batch_code: "SER-2", production_date: "2026-01-16", quantity_kg: 0, product_type: "Cvetlični med" },
    },
  })
  B2 = b2.id

  // Izdelek z različicama
  const pMed = await prisma.product.create({
    data: { organization: { connect: { id: orgId } }, name: `${RUN} Cvetlični med`, price: 10, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, forSale: true },
  })
  P_med = pMed.id
  const v250 = await prisma.productVariant.create({
    data: { organization: { connect: { id: orgId } }, product: { connect: { id: P_med } }, name: "250 g", sku: `${RUN}-250`, price: 5, trackInventory: true, stockQuantity: 0, reservedQuantity: 0 },
  })
  V_250 = v250.id
  const v500 = await prisma.productVariant.create({
    data: { organization: { connect: { id: orgId } }, product: { connect: { id: P_med } }, name: "500 g", sku: `${RUN}-500`, price: 9, trackInventory: true, stockQuantity: 0, reservedQuantity: 0 },
  })
  V_500 = v500.id

  const pOther = await prisma.product.create({
    data: { organization: { connect: { id: orgB.id } }, name: `${RUN} Tuja`, price: 1, trackInventory: true, stockQuantity: 10, reservedQuantity: 0, isActive: true, forSale: true },
  })
  P_otherOrg = pOther.id
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, orgOtherId] } } }).catch(() => undefined)
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

describe("2D-1P — sledljivost", () => {
  it("1. pridelek → proizvodna serija: fill zviša zalogo, doda OUT?/IN, ostane razpoložljivo", async () => {
    // 10 kg pridelka → 20×500 g (packed 10 kg realno)
    const res = await createFillBatch({
      harvestIds: [H1], batchId: B1, productId: P_med, productVariantId: V_500,
      units: 20, packedKg: 10, idempotencyKey: `${RUN}-fill1`,
    })
    expect(res.ok).toBe(true)
    expect(res.batchId).toBe(B1)

    const v = await prisma.productVariant.findUnique({ where: { id: V_500 }, select: { stockQuantity: true } })
    expect(v!.stockQuantity).toBe(20)

    const inn = await prisma.stockMovement.findFirst({
      where: { batchRecordId: B1, productVariantId: V_500, direction: "IN" },
    })
    expect(inn).not.toBeNull()
    expect(inn!.quantity).toBe(20)

    // 20 zasedejo 20 od 20; 0 na voljo, nadaljnji fill preseže pridelek
    const lastRes = await createFillBatch({
      harvestIds: [H1], batchId: B1, productId: P_med, productVariantId: V_500,
      units: 1, packedKg: 1, idempotencyKey: `${RUN}-oversell`,
    })
    expect(lastRes.ok).toBe(false)
    expect(lastRes.error).toBe("INSUFFICIENT_HARVEST")
  })

  it("2. več pridelkov → ena serija (mešanica), ista vrsta medu", async () => {
    // 6 kg iz H_mixA (3) + H_mixB (3) → serija B2 (12 enot 500g)
    const res = await createFillBatch({
      harvestIds: [H_mixA, H_mixB], batchId: B2, productId: P_med, productVariantId: V_500,
      units: 12, packedKg: 6, idempotencyKey: `${RUN}-fill2-mix`,
    })
    expect(res.ok).toBe(true)
    // Serija dobi __fills z contributions (oba pridelka)
    const b = await prisma.extensionRecord.findUnique({ where: { id: B2 }, select: { data: true } })
    expect((b!.data as any).__fills.length).toBe(1)
    expect((b!.data as any).__fills[0].contributions.length).toBe(2)
    expect((b!.data as any).__fills[0].contributions.map((c: any) => c.harvestId).sort()).toEqual([H_mixA, H_mixB].sort())
    // neto po seriji (IN 12)
    const av = await getBatchAvailabilityForLine(P_med, V_500)
    const b2av = av.find((a) => a.batchId === B2)
    expect(b2av).toBeTruthy()
    expect(b2av!.available).toBe(12)
    expect(b2av!.filled).toBe(12)
  })

  it("3. ena serija → več izdelkov/različic: isti pridelek pride v B1 (500g) in B2 (250g)", async () => {
    // H1 ima še 10−10(used)=0? Ne — beforeAll H1=10, fill1 porabal 10 → 0.
    // Uporabimo H2 (5 kg) za drugo različico serije B2.
    const res = await createFillBatch({
      harvestIds: [H2], batchId: B2, productId: P_med, productVariantId: V_250,
      units: 10, packedKg: 2.5, idempotencyKey: `${RUN}-fill3`,
    })
    expect(res.ok).toBe(true)
    const v250 = await prisma.productVariant.findUnique({ where: { id: V_250 }, select: { stockQuantity: true } })
    expect(v250!.stockQuantity).toBe(10)
    const av = await getBatchAvailabilityForLine(P_med, V_250)
    expect(av.find((a) => a.batchId === B2 && a.available === 10)).toBeTruthy()
  })

  it("4. izdelek iz več serij: B1 + B2 → 500g, prodaja razdeli med obe", async () => {
    // B1 ima 20 enot 500g, B2 ima 12 enot 500g. Prodaj 5 iz B1 + 3 iz B2.
    const res = await createDirectOrder({
      lines: [{
        productId: P_med, productVariantId: V_500, quantity: 8,
        batchAllocations: [
          { batchRecordId: B1, quantity: 5 },
          { batchRecordId: B2, quantity: 3 },
        ],
      }],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(true)
    // Dve OUT vrstici s serijo
    const outs = await prisma.stockMovement.findMany({
      where: { orderId: res.orderId!, direction: "OUT", batchRecordId: { not: null } },
      orderBy: { quantity: "desc" },
    })
    expect(outs.length).toBe(2)
    const b1out = outs.find((o) => o.batchRecordId === B1)!
    const b2out = outs.find((o) => o.batchRecordId === B2)!
    expect(b1out.quantity).toBe(5)
    expect(b2out.quantity).toBe(3)
    // Skupna količina prodanih iz serij je še vedno 8 = prodano v OUT (ni dvojnega)
    const allOuts = await prisma.stockMovement.findMany({ where: { orderId: res.orderId!, direction: "OUT" } })
    expect(allOuts.reduce((s, o) => s + o.quantity, 0)).toBe(8)

    // Provenance — izvor v naročilu
    const prov = await resolveOrderProvenance(res.orderId!)
    expect(prov).not.toBeNull()
    expect(prov!.anyBatch).toBe(true)
    expect(prov!.items.length).toBe(2)
    expect(prov!.items.some((i) => i.batchId === B1 && i.quantity === 5)).toBe(true)
    expect(prov!.items.some((i) => i.batchId === B2 && i.quantity === 3)).toBe(true)
    const b1p = prov!.items.find((i) => i.batchId === B1)!
    expect(b1p.harvests.some((h) => h.id === H1)).toBe(true)
  })

  it("5. prodaja iz ene serije (zadostno)", async () => {
    // B2 500g ima 12−3=9; prodaj 4 iz B2.
    const res = await createDirectOrder({
      lines: [{
        productId: P_med, productVariantId: V_500, quantity: 4,
        batchAllocations: [{ batchRecordId: B2, quantity: 4 }],
      }],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(true)
    const av = await getBatchAvailabilityForLine(P_med, V_500)
    const b2av = av.find((a) => a.batchId === B2)!
    expect(b2av.available).toBe(12 - 3 - 4) // 5
  })

  it("6. nezadostna količina v seriji → BATCH_INSUFFICIENT, brez delnih zapisov", async () => {
    // B1 500g ima 20−5=15; poskusi prodati 99 iz B1 → zavrnjeno, nič se ne zniža.
    const before = await prisma.productVariant.findUnique({ where: { id: V_500 }, select: { stockQuantity: true } })
    const res = await createDirectOrder({
      lines: [{
        productId: P_med, productVariantId: V_500, quantity: 99,
        batchAllocations: [{ batchRecordId: B1, quantity: 99 }],
      }],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe("BATCH_INSUFFICIENT")
    const after = await prisma.productVariant.findUnique({ where: { id: V_500 }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(before!.stockQuantity)
  })

  it("7. dve sočasni prodaji iste serije → skupaj nikoli več kot neto (serializacija)", async () => {
    // B1 500g ima 15. Dva sočasna poskusa prodati vsak 10 → samo en uspe (15 < 20).
    const [r1, r2] = await Promise.all([
      createDirectOrder({
        lines: [{ productId: P_med, productVariantId: V_500, quantity: 10, batchAllocations: [{ batchRecordId: B1, quantity: 10 }] }],
        paymentMethod: "cash",
      }),
      createDirectOrder({
        lines: [{ productId: P_med, productVariantId: V_500, quantity: 10, batchAllocations: [{ batchRecordId: B1, quantity: 10 }] }],
        paymentMethod: "cash",
      }),
    ])
    const ok = [r1, r2].filter((r) => r.success).length
    expect(ok).toBe(1)
    const av = await getBatchAvailabilityForLine(P_med, V_500)
    const b1av = av.find((a) => a.batchId === B1)!
    expect(b1av.available).toBe(15 - 10) // ena prodaja speljana
  })

  it("8. rollback: napaka v eni liniji (tuja org) odnaša celoten naročilo", async () => {
    const before = await prisma.productVariant.findUnique({ where: { id: V_500 }, select: { stockQuantity: true } })
    const res = await createDirectOrder({
      lines: [
        { productId: P_med, productVariantId: V_500, quantity: 2, batchAllocations: [{ batchRecordId: B1, quantity: 2 }] },
        { productId: P_otherOrg, quantity: 1 }, // tuja org → NOT_FOUND
      ],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(false)
    const after = await prisma.productVariant.findUnique({ where: { id: V_500 }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(before!.stockQuantity)
  })

  it("9. tuja organizacija: serija druge org ni dosegljiva / harv ni mogoč", async () => {
    // Serija z druge org → BATCH_NOT_FOUND (tuja), harv z druge org → HARVEST_NOT_FOUND.
    const bOther = await prisma.extensionRecord.create({
      data: { organizationId: orgOtherId, extensionId: "batch-production", entityKey: "batch", title: `Tuja ${RUN}`, data: { batch_code: "T", quantity_kg: 5 } },
    })
    const resB = await createFillBatch({
      harvestIds: [H1], batchId: bOther.id, productId: P_med, productVariantId: V_500,
      units: 1, packedKg: 0.5, idempotencyKey: `${RUN}-otherbatch`,
    })
    expect(resB.ok).toBe(false)
    expect(resB.error).toBe("BATCH_NOT_FOUND")

    const resH = await createFillBatch({
      harvestIds: [H_other], batchId: B2, productId: P_med, productVariantId: V_500,
      units: 1, packedKg: 0.5, idempotencyKey: `${RUN}-otherharv`,
    })
    expect(resH.ok).toBe(false)
    expect(resH.error).toBe("HARVEST_NOT_FOUND")
  })

  it("10. HONEY_TYPE_MISMATCH: mešanje vrst medu v enem polinjenju prepovedano", async () => {
    const hG = await prisma.extensionRecord.create({
      data: { organizationId: orgId, extensionId: "bee-apiary", entityKey: "harvest", title: `Gozd ${RUN}`, data: { honey_type: "Gozdni med", quantity_kg: 5 } },
    })
    const res = await createFillBatch({
      harvestIds: [H1, hG.id], batchId: B2, productId: P_med, productVariantId: V_250,
      units: 2, packedKg: 1, idempotencyKey: `${RUN}-mixed`,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("HONEY_TYPE_MISMATCH")
  })

  it("11. DUPLICATE_FILL: ponovitev istega idempotencyKey ni dvojno knjiženje", async () => {
    const before = await prisma.productVariant.findUnique({ where: { id: V_250 }, select: { stockQuantity: true } })
    const res = await createFillBatch({
      harvestIds: [H2], batchId: B2, productId: P_med, productVariantId: V_250,
      units: 5, packedKg: 1.25, idempotencyKey: `${RUN}-dup`,
    })
    expect(res.ok).toBe(true)
    const res2 = await createFillBatch({
      harvestIds: [H2], batchId: B2, productId: P_med, productVariantId: V_250,
      units: 5, packedKg: 1.25, idempotencyKey: `${RUN}-dup`,
    })
    expect(res2.ok).toBe(false)
    expect(res2.error).toBe("DUPLICATE_FILL")
    const after = await prisma.productVariant.findUnique({ where: { id: V_250 }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(before!.stockQuantity + 5) // samo enkrat
  })

  it("12. plačilni status: gotovina → PAID, nakazilo → PENDING, online zavrnjen", async () => {
    const red1 = await createDirectOrder({ lines: [{ productId: P_med, productVariantId: V_250, quantity: 1 }], paymentMethod: "cash" })
    expect(red1.success).toBe(true)
    const o1 = await prisma.order.findUnique({ where: { id: red1.orderId! }, select: { status: true, paymentMethod: true } })
    expect(o1!.status).toBe("PAID")
    expect(o1!.paymentMethod).toBe("cash")

    const red2 = await createDirectOrder({ lines: [{ productId: P_med, productVariantId: V_250, quantity: 1 }], paymentMethod: "transfer" })
    expect(red2.success).toBe(true)
    const o2 = await prisma.order.findUnique({ where: { id: red2.orderId! }, select: { status: true, paymentMethod: true } })
    expect(o2!.status).toBe("PENDING") // ni prejeto, dokler ni potrjeno

    const red3 = await createDirectOrder({ lines: [{ productId: P_med, productVariantId: V_250, quantity: 1 }], paymentMethod: "online" })
    expect(red3.success).toBe(false)
    expect(red3.error).toBe("ONLINE_NOT_SUPPORTED")
  })

  it("13. resolveOrderProvenance za naročilo brez serije → anyBatch=false", async () => {
    const red = await createDirectOrder({ lines: [{ productId: P_med, productVariantId: V_250, quantity: 1 }], paymentMethod: "cash" })
    const prov = await resolveOrderProvenance(red.orderId!)
    expect(prov!.anyBatch).toBe(false)
    expect(prov!.items.length).toBe(0)
  })

  it("14. vsebina poslovnega toka v podrobnostih: getHarvestProduction pokaže serije in ostanek", async () => {
    const lines = await getHarvestProduction()
    const h1line = lines.find((l) => l.harvest.id === H1)
    expect(h1line).toBeTruthy()
    // H1: 10 kg, porabljeno 10 (fill1) → 0
    expect(h1line!.harvest.remainingKg).toBeCloseTo(0, 1)
    expect(h1line!.batches.filter((b) => b.id === B1).length).toBeGreaterThanOrEqual(1)
  })
})