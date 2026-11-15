// ============================================================
// P1 — NABAVNA VERIGA (Dobavitelj → Nabavni nalog → Prejem → Zaloga)
// itest proti izolirani bazi markec_e2e_test.
//
// Pokriva:
//   • atomsko generiranje številk PO (NN-YYYY-####) pod sočasnostjo
//   • ustvarjanje dobavitelja (ExtensionRecord entityKey="supplier")
//   • createPurchaseOrder (DRAFT)
//   • delni prejem → PARTIAL + Skladiščni prejem (StockMovement IN/DELIVERY,
//     zvišanje on-hand zaloge)
//   • končni prejem → RECEIVED
//   • preverjen popravek hrošča: prejem MORA povečati zalogo
//   • OVER_RECEIPT zavrnjen (brez delnih sprememb)
//   • dovoljene/nedovoljene spremembe statusa
//   • izolacija najemnikov (PO org A ni videv/uporabljiv iz org B)
//
// VARNOST: izvaja se IZKLJUČNO proti markec_e2e_test (5433) prek DATABASE_URL
// iz .env.test. NIKOLI skozi `npm test` (privzeto vitest.config.ts).
//
// Zagon prek uradnega varnega wrapperja (scripts/run-with-test-db.mjs + fail-closed guard):
//   npm run test:itest -- tests/purchasing-flow.itest.ts
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
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  markPurchaseOrderReceived,
  updatePurchaseOrder,
} from "@/app/actions/purchasing"

const RUN = "spo_" + Date.now().toString(36)
let orgAId: string
let orgBId: string
let userAId: string
let userBId: string
let supplierAId: string
let supplierBId: string
let pA: string
let pA2: string
let pVarId: string
let pVarProductId: string
let pB: string

type POLine = {
  productId: string
  productVariantId?: string | null
  quantity: number
  receivedQuantity?: number
}

async function readPO(id: string): Promise<{
  orderNumber: string
  supplierId: string
  status: string
  lines: POLine[]
}> {
  const rec = await prisma.extensionRecord.findFirstOrThrow({
    where: { id, entityKey: "purchase_order" },
  })
  const d = (rec.data ?? {}) as Record<string, unknown>
  return {
    orderNumber: String(d.order_number ?? ""),
    supplierId: String(d.supplier_id ?? ""),
    status: String(d.status ?? "DRAFT"),
    lines: Array.isArray(d.lines) ? (d.lines as POLine[]) : [],
  }
}

async function stockOf(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { stockQuantity: true } })
  return p!
}
async function vstock(variantId: string) {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { stockQuantity: true } })
  return v!
}

beforeAll(async () => {
  const orgA = await prisma.organization.create({
    data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" },
  })
  orgAId = orgA.id
  const orgB = await prisma.organization.create({
    data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" },
  })
  orgBId = orgB.id

  const userA = await prisma.user.create({
    data: {
      email: `${RUN}-a@markec.test`,
      name: "Owner A",
      role: "ADMIN",
      organizationId: orgA.id,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userAId = userA.id
  const userB = await prisma.user.create({
    data: {
      email: `${RUN}-b@markec.test`,
      name: "Owner B",
      role: "ADMIN",
      organizationId: orgB.id,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userBId = userB.id
  await prisma.organizationMember.create({ data: { organizationId: orgA.id, userId: userA.id, role: "ADMIN", isDefault: true } })
  await prisma.organizationMember.create({ data: { organizationId: orgB.id, userId: userB.id, role: "ADMIN", isDefault: true } })

  // Dobavitelji kot ExtensionRecord (entityKey="supplier"), kot jih vidi validateSupplier.
  const supA = await prisma.extensionRecord.create({
    data: {
      organizationId: orgA.id,
      extensionId: "suppliers",
      entityKey: "supplier",
      title: `${RUN} Dobavitelj A`,
      data: { name: `${RUN} Dobavitelj A` },
    },
  })
  supplierAId = supA.id
  const supB = await prisma.extensionRecord.create({
    data: {
      organizationId: orgB.id,
      extensionId: "suppliers",
      entityKey: "supplier",
      title: `${RUN} Dobavitelj B`,
      data: { name: `${RUN} Dobavitelj B` },
    },
  })
  supplierBId = supB.id

  // Izdelki org A.
  const pa = await prisma.product.create({
    data: {
      organization: { connect: { id: orgA.id } },
      name: `${RUN} Plain`,
      price: 10,
      trackInventory: true,
      stockQuantity: 100,
      reservedQuantity: 0,
      isActive: true,
      forSale: true,
    },
  })
  pA = pa.id
  const pa2 = await prisma.product.create({
    data: {
      organization: { connect: { id: orgA.id } },
      name: `${RUN} Plain2`,
      price: 15,
      trackInventory: true,
      stockQuantity: 50,
      reservedQuantity: 0,
      isActive: true,
      forSale: true,
    },
  })
  pA2 = pa2.id
  const pvar = await prisma.product.create({
    data: {
      organization: { connect: { id: orgA.id } },
      name: `${RUN} Var`,
      price: 0,
      trackInventory: true,
      stockQuantity: 0,
      reservedQuantity: 0,
      isActive: true,
      forSale: true,
    },
  })
  pVarProductId = pvar.id
  const v = await prisma.productVariant.create({
    data: {
      organization: { connect: { id: orgA.id } },
      product: { connect: { id: pvar.id } },
      name: "VX",
      sku: `${RUN}-vx`,
      price: 5,
      trackInventory: true,
      stockQuantity: 30,
      reservedQuantity: 0,
    },
  })
  pVarId = v.id

  // Izdelek org B.
  const pb = await prisma.product.create({
    data: {
      organization: { connect: { id: orgB.id } },
      name: `${RUN} B-product`,
      price: 7,
      trackInventory: true,
      stockQuantity: 20,
      reservedQuantity: 0,
      isActive: true,
      forSale: true,
    },
  })
  pB = pb.id

  state.session = { user: { id: userA.id, role: "ADMIN", email: userA.email } }
})

afterAll(async () => {
  await prisma.extensionRecord
    .deleteMany({ where: { id: { in: [supplierAId, supplierBId] } } })
    .catch(() => undefined)
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined)
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => undefined)
  await prisma.$disconnect()
})

describe("nabavna veriga (P1)", () => {
  it("1. celotna veriga: dobavitelj → PO → delni prejem → končni prejem, zaloga raste", async () => {
    const beforeA = await stockOf(pA)
    const res = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [
        { productId: pA, quantity: 10 },
        { productId: pA2, quantity: 4 },
      ],
    })
    expect(res.ok).toBe(true)
    const id = res.id!
    const po1 = await readPO(id)
    expect(po1.status).toBe("DRAFT")
    // atomsko generirana številka oblike NN-YYYY-####
    expect(po1.orderNumber).toMatch(/^NN-\d{4}-\d{4}$/)
    expect(po1.supplierId).toBe(supplierAId)
    expect(po1.lines).toHaveLength(2)
    expect(po1.lines[0].receivedQuantity).toBe(0)
    // zaloga se ob USTVARJANJU še NI spremenila
    expect((await stockOf(pA)).stockQuantity).toBe(beforeA.stockQuantity)

    // DELNI prejem pA: 6 od 10
    const rp1 = await markPurchaseOrderReceived(id, [{ productId: pA, quantity: 6 }])
    expect(rp1.ok).toBe(true)
    const po2 = await readPO(id)
    expect(po2.status).toBe("PARTIAL")
    expect(po2.lines[0].receivedQuantity).toBe(6)
    // SKLADIŠČNI PREJEM: pA +6, pA2 se še ni prejel
    const afterPartial = await stockOf(pA)
    expect(afterPartial.stockQuantity).toBe(beforeA.stockQuantity + 6)
    expect((await stockOf(pA2)).stockQuantity).toBe(50)

    // KONČNI prejem preostanka pA (4) + pA2 (4)
    const rp2 = await markPurchaseOrderReceived(id, [
      { productId: pA, quantity: 4 },
      { productId: pA2, quantity: 4 },
    ])
    expect(rp2.ok).toBe(true)
    const po3 = await readPO(id)
    expect(po3.status).toBe("RECEIVED")
    expect(po3.lines[0].receivedQuantity).toBe(10)
    expect(po3.lines[1].receivedQuantity).toBe(4)
    expect((await stockOf(pA)).stockQuantity).toBe(beforeA.stockQuantity + 10)
    expect((await stockOf(pA2)).stockQuantity).toBe(50 + 4)

    // Vedno po ena DELIVERY/IN vrstica v evidence na prejet izdelek
    const movements = await prisma.stockMovement.findMany({
      where: { organizationId: orgAId, productId: pA, source: "DELIVERY", direction: "IN" },
    })
    expect(movements).toHaveLength(2) // 6 in 4
    const totalIn = movements.reduce((s, m) => s + m.quantity, 0)
    expect(totalIn).toBe(10)
    expect(movements.every((m) => m.supplierRecordId === supplierAId)).toBe(true)
  })

  it("2. prejem RAZLIČICE poveča samo zalogo različice in zapiše StockMovement", async () => {
    const vBefore = await vstock(pVarId)
    const res = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [{ productId: pVarProductId, productVariantId: pVarId, quantity: 7 }],
    })
    expect(res.ok).toBe(true)
    const id = res.id!
    const rp = await markPurchaseOrderReceived(id, [{ productId: pVarProductId, productVariantId: pVarId, quantity: 7 }])
    expect(rp.ok).toBe(true)
    const vAfter = await vstock(pVarId)
    expect(vAfter.stockQuantity).toBe(vBefore.stockQuantity + 7)
    const movements = await prisma.stockMovement.findMany({
      where: { organizationId: orgAId, productVariantId: pVarId, source: "DELIVERY", direction: "IN" },
    })
    const mv = movements.find((m) => m.quantity === 7)
    expect(mv).toBeTruthy()
  })

  it("3. OVER_RECEIPT zavrne prejem nad naročeno, brez delnih sprememb (rollback)", async () => {
    const beforeA = await stockOf(pA)
    const res = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [{ productId: pA, quantity: 3 }],
    })
    expect(res.ok).toBe(true)
    const id = res.id!
    const over = await markPurchaseOrderReceived(id, [{ productId: pA, quantity: 5 }])
    expect(over.ok).toBe(false)
    expect(over.error).toBe("OVER_RECEIPT")
    // zaloga se NI spremenila, receivedQuantity ostaja 0, status še vedno DRAFT
    expect((await stockOf(pA)).stockQuantity).toBe(beforeA.stockQuantity)
    const po = await readPO(id)
    expect(po.lines[0].receivedQuantity).toBe(0)
    expect(po.status).toBe("DRAFT")
    // Brez StockMovement za TO številko naloga (scoped na orderNumber, ne na
    // produkt — pA si deli zgodovina prejšnjih testov).
    expect(
      await prisma.stockMovement.count({
        where: { organizationId: orgAId, note: { contains: po.orderNumber } },
      })
    ).toBe(0)
  })

  it("4. statusni prehodi: DRAFT→SENT→RECEIVED; nedovoljeni prehodi zavrnjeni", async () => {
    const res = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [{ productId: pA2, quantity: 2 }],
    })
    expect(res.ok).toBe(true)
    const id = res.id!

    // DRAFT → SENT (dovoljen)
    const s1 = await updatePurchaseOrder(id, { status: "SENT" })
    expect(s1.ok).toBe(true)
    expect((await readPO(id)).status).toBe("SENT")

    // SENT → RECEIVED prek prejema (dovoljen), preko update PRAV tako
    const s2 = await updatePurchaseOrder(id, { status: "RECEIVED" })
    expect(s2.ok).toBe(true)
    expect((await readPO(id)).status).toBe("RECEIVED")

    // RECEIVED → CANCELLED ni dovoljen
    const bad = await updatePurchaseOrder(id, { status: "CANCELLED" })
    expect(bad.ok).toBe(false)
    expect(bad.error).toBe("INVALID_STATUS_TRANSITION")
    expect((await readPO(id)).status).toBe("RECEIVED")

    // DRAFT → CANCELLED (dovoljen)
    const c = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [{ productId: pA, quantity: 1 }],
    })
    expect(c.ok).toBe(true)
    const cancelled = await updatePurchaseOrder(c.id!, { status: "CANCELLED" })
    expect(cancelled.ok).toBe(true)
    expect((await readPO(c.id!)).status).toBe("CANCELLED")
  })

  it("5. sočasna ustvarjanja generirajo EDINSTVENE številke PO (atomsko številčenje)", async () => {
    // Ločena org, da števci ne vplivajo na prejšnje teste.
    const org = await prisma.organization.create({
      data: { slug: `${RUN}_conc`, name: `Conc ${RUN}`, vertical: "generic", publishState: "DRAFT" },
    })
    const user = await prisma.user.create({
      data: {
        email: `${RUN}-conc@markec.test`,
        name: "Conc",
        role: "ADMIN",
        organizationId: org.id,
        password: "x",
        emailVerified: new Date(),
      },
    })
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "ADMIN", isDefault: true } })
    const supplier = await prisma.extensionRecord.create({
      data: {
        organizationId: org.id,
        extensionId: "suppliers",
        entityKey: "supplier",
        title: `${RUN} Dobavitelj conc`,
        data: { name: `${RUN} Dobavitelj conc` },
      },
    })
    const product = await prisma.product.create({
      data: {
        organization: { connect: { id: org.id } },
        name: `${RUN} Conc product`,
        price: 2,
        trackInventory: true,
        stockQuantity: 0,
        reservedQuantity: 0,
        isActive: true,
        forSale: true,
      },
    })

    // Začasno zamenjamo session na userja conc-org
    const prevSession = state.session
    state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }

    try {
      const N = 6
      const results = await Promise.all(
        Array.from({ length: N }, () =>
          createPurchaseOrder({ supplierRecordId: supplier.id, lines: [{ productId: product.id, quantity: 1 }] })
        )
      )
      expect(results.every((r) => r.ok)).toBe(true)
      const numbers = await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "purchase_order" },
        select: { data: true },
      })
      const nums = numbers.map((r) => String((r.data as { order_number?: unknown })?.order_number ?? ""))
      expect(nums.length).toBe(N)
      expect(new Set(nums).size).toBe(N) // vse edinstvene, nobene duplikacije
      for (const n of nums) expect(n).toMatch(/^NN-\d{4}-\d{4}$/)
    } finally {
      state.session = prevSession
      await prisma.extensionRecord
        .deleteMany({ where: { organizationId: org.id } })
        .catch(() => undefined)
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined)
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined)
    }
  })

  it("6. izolacija najemnikov: PO org A ni videv/uporabljiv iz org B", async () => {
    // PO org A (kot user A)
    const resA = await createPurchaseOrder({
      supplierRecordId: supplierAId,
      lines: [{ productId: pA, quantity: 5 }],
    })
    expect(resA.ok).toBe(true)
    const poAId = resA.id!

    // PO org B (kot user A je bila prej; preklopimo na user B)
    const prevSession = state.session
    state.session = { user: { id: userBId, role: "ADMIN", email: `${RUN}-b@markec.test` } }
    try {
      // user B ne vidi PO org A
      expect(await getPurchaseOrder(poAId)).toBeNull()
      expect(
        (await listPurchaseOrders()).some((p) => p.id === poAId)
      ).toBe(false)
      // user B ne more prejeti/posodobiti PO org A
      const rec = await markPurchaseOrderReceived(poAId, [{ productId: pA, quantity: 5 }])
      expect(rec.ok).toBe(false)
      expect(rec.error).toBe("NOT_FOUND")
      const upd = await updatePurchaseOrder(poAId, { status: "SENT" })
      expect(upd.ok).toBe(false)
      expect(upd.error).toBe("NOT_FOUND")

      // user B lahko normalno ustvari svoj PO (šítevilka per org, ne globalna)
      const resB = await createPurchaseOrder({
        supplierRecordId: supplierBId,
        lines: [{ productId: pB, quantity: 3 }],
      })
      expect(resB.ok).toBe(true)
      const poB = await readPO(resB.id!)
      expect(poB.orderNumber).toMatch(/^NN-\d{4}-\d{4}$/)
      const recB = await markPurchaseOrderReceived(resB.id!, [{ productId: pB, quantity: 3 }])
      expect(recB.ok).toBe(true)
      const afterB = await stockOf(pB)
      expect(afterB.stockQuantity).toBe(23) // 20 + 3
    } finally {
      state.session = prevSession
    }
  })
})