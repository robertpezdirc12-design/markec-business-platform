// ============================================================
// 2D-1O — NEPOSREDNA PRODAJA (brez Stripe) itest, izolirana baza.
// Testira createDirectOrder: transakcijsko usklajen Order+Items+
// StockMovement+znižanje zaloge, brez dvojnega/negativnega, org-scoped.
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
import { createDirectOrder } from "@/app/actions/direct-sale"

const RUN = "dso_" + Date.now().toString(36)
let orgId: string
let orgOtherId: string
let userId: string
let P_plain: string
let P_var: string
let V1_orgA: string
let P_other: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" } })
  orgId = org.id
  const orgB = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" } })
  orgOtherId = orgB.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Owner", role: "ADMIN", organizationId: org.id, password: "x", emailVerified: new Date() } })
  userId = user.id
  await prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "ADMIN", isDefault: true } })

  const pPlain = await prisma.product.create({ data: { organization: { connect: { id: org.id } }, name: `${RUN} Plain`, price: 10, trackInventory: true, stockQuantity: 40, reservedQuantity: 10, isActive: true, forSale: true } })
  P_plain = pPlain.id
  const pVar = await prisma.product.create({ data: { organization: { connect: { id: org.id } }, name: `${RUN} Var`, price: 0, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, forSale: true } })
  P_var = pVar.id
  const v1 = await prisma.productVariant.create({ data: { organization: { connect: { id: org.id } }, product: { connect: { id: P_var } }, name: "VX", sku: `${RUN}-vx`, price: 5, trackInventory: true, stockQuantity: 20, reservedQuantity: 0 } })
  V1_orgA = v1.id
  const pOther = await prisma.product.create({ data: { organization: { connect: { id: orgB.id } }, name: `${RUN} Other`, price: 1, trackInventory: true, stockQuantity: 5, reservedQuantity: 0, isActive: true, forSale: true } })
  P_other = pOther.id

  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, orgOtherId] } } }).catch(() => undefined)
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

async function stockOf(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true, reservedQuantity: true } })
  return p!
}
async function vstock(id: string) {
  const v = await prisma.productVariant.findUnique({ where: { id }, select: { stockQuantity: true } })
  return v!
}

describe("2D-1O — neposredna prodaja", () => {
  it("1. uspeh: zniža razpoložljivo zalogo, ustvari Order+Items+StockMovement", async () => {
    const before = await stockOf(P_plain) // 40/10 → available 30
    const res = await createDirectOrder({ lines: [{ productId: P_plain, quantity: 5 }], paymentMethod: "cash", notes: "test direct" })
    expect(res.success).toBe(true)
    expect(res.orderId).toBeTruthy()
    const after = await stockOf(P_plain)
    expect(after.stockQuantity).toBe(before.stockQuantity - 5) // 40-5
    expect(after.reservedQuantity).toBe(before.reservedQuantity) // 10 (rezervirano se NE proda pri direktni)
    const order = await prisma.order.findUnique({ where: { id: res.orderId! }, include: { items: true, stockMovements: true } })
    expect(order).not.toBeNull()
    expect(order!.items.length).toBe(1)
    expect(order!.items[0].quantity).toBe(5)
    expect(order!.items[0].productId).toBe(P_plain)
    expect(order!.paymentMethod).toBe("cash")
    expect(order!.stockMovements.some((m) => m.source === "ORDER" && m.direction === "OUT" && m.quantity === 5)).toBe(true)
  })

  it("2. nezadostna zaloga → INSUFFICIENT_STOCK, brez partial", async () => {
    const before = await stockOf(P_plain)
    const res = await createDirectOrder({ lines: [{ productId: P_plain, quantity: 1_000_000 }], paymentMethod: "cash" })
    expect(res.success).toBe(false)
    expect(res.error).toBe("INSUFFICIENT_STOCK")
    // brez delnih sprememb
    expect(await stockOf(P_plain)).toEqual(before)
  })

  it("3. prodaja RAZLIČICE zniža samo različico (ne product), pravilni OrderItem", async () => {
    const vBefore = await vstock(V1_orgA) // 20
    const res = await createDirectOrder({ lines: [{ productId: P_var, productVariantId: V1_orgA, quantity: 6 }], paymentMethod: "transfer" })
    expect(res.success).toBe(true)
    const vAfter = await vstock(V1_orgA)
    expect(vAfter.stockQuantity).toBe(vBefore.stockQuantity - 6) // 14
    const order = await prisma.order.findUnique({ where: { id: res.orderId! }, include: { items: { where: { productId: P_var } } } })
    expect(order!.items[0].variantId).toBe(V1_orgA)
    expect(order!.items[0].variantName).toBe("VX")
    expect(order!.items[0].quantity).toBe(6)
  })

  it("4. dve sočasni neposredni prodaji iste zaloge → samo ena uspe (serializacija)", async () => {
    const p = await prisma.product.create({ data: { organization: { connect: { id: orgId } }, name: `${RUN} C`, price: 2, trackInventory: true, stockQuantity: 10, reservedQuantity: 0, isActive: true, forSale: true } })
    const [r1, r2] = await Promise.all([
      createDirectOrder({ lines: [{ productId: p.id, quantity: 8 }], paymentMethod: "cash" }),
      createDirectOrder({ lines: [{ productId: p.id, quantity: 8 }], paymentMethod: "cash" }),
    ])
    const ok = [r1, r2].filter((r) => r.success).length
    expect(ok).toBe(1) // 8+8 > 10 → ena uspe
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(2) // 10-8
  })

  it("5. napačen productId (druga org) → NOT_FOUND", async () => {
    const res = await createDirectOrder({ lines: [{ productId: P_other, quantity: 1 }], paymentMethod: "cash" })
    expect(res.success).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
  })

  it("6. napačen/vaja varianta druge org ali drug izdelek → zavrnjen", async () => {
    const res = await createDirectOrder({ lines: [{ productId: P_var, productVariantId: "nope" }].map((x) => ({ ...x, quantity: 1 })), paymentMethod: "cash" })
    expect(res.success).toBe(false)
    // Variant ne obstaja v org A → VARIANT_NOT_FOUND ali VALIDATION
    expect(["VARIANT_NOT_FOUND", "VARIANT_MISMATCH"]).toContain(res.error)
  })

  it("7. napaka med transakcijo → rollback (noben delni podatek)", async () => {
    // Ena linija veljavna, druga s tujim produktom → celoten rollback, tudi veljavna linija ne ostane.
    const p = await prisma.product.create({ data: { organization: { connect: { id: orgId } }, name: `${RUN} R`, price: 3, trackInventory: true, stockQuantity: 5, reservedQuantity: 0, isActive: true, forSale: true } })
    const res = await createDirectOrder({
      lines: [
        { productId: p.id, quantity: 2 }, // veljavna
        { productId: P_other, quantity: 1 }, // tuja → NOT_FOUND, mora rollbackati vse
      ],
      paymentMethod: "cash",
    })
    expect(res.success).toBe(false)
    // p-jeva zaloga se ni znižala; nobeno naročilo za p ni nastalo
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(5)
    expect(await prisma.order.count({ where: { organizationId: orgId, items: { some: { productId: p.id } } } })).toBe(0)
  })
})