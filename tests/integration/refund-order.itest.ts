// ============================================================
// P3-H — VRAČILO NAROČILA (refundOrder)
// Prava testna baza (f631). Preverja org-scope (tuj uporabnik),
// stanje varh (samo PAID/COMPLETED), atomsko vračanje zaloge
// (StockMovement RETURN → stockQuantity nazaj) in status REFUNDED.
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; organizationId?: string | null } },
  headerEntries: {} as Record<string, string>,
  role: "ADMIN" as string,
  userId: "" as string,
  orgId: null as string | null,
}))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(state.headerEntries) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { refundOrder } from "@/app/actions/orders"

// Potrebujemo obstoječega testnega najemnika (uporabnik z organizacijo).
// Primarno f681/e2e sejno okolje; če ga ni (bazni seed je bil izpraznjen),
// fallback na itest fixture lastnika (tests/integration/itest-global-setup.ts).
const ACTOR_EMAIL = "cebeler.fresh@markec.test"
const ACTOR_FALLBACK_EMAIL = "cb@f631.test"

describe("refundOrder — vračilo naročila", () => {
  let orgId: string
  let prodId: string
  let orderId: string

  beforeAll(async () => {
    // Najdi / pripravi testno organizacijo prek uporabnika, ki IMA članstvo
    // (f681 uporabnik je lahko brez članstva, če je bil seed izpraznjen).
    let owner: { id: string; role: string } | null = null
    let org: { id: string; slug: string } | null = null
    for (const email of [ACTOR_EMAIL, ACTOR_FALLBACK_EMAIL]) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      if (!u) continue
      const o = await prisma.organization.findFirst({
        where: { members: { some: { userId: u.id } } },
        select: { id: true, slug: true },
      })
      if (o) {
        owner = u
        org = o
        break
      }
    }
    if (!owner || !org) throw new Error(`testni uporabnik z organizacijo (${ACTOR_EMAIL} / ${ACTOR_FALLBACK_EMAIL}) ne obstaja`)
    orgId = org.id
    state.role = owner.role
    state.userId = owner.id
    state.session = { user: { id: owner.id, role: owner.role, organizationId: orgId } }
    state.headerEntries = { "x-org-slug": org.slug }

    const p = await prisma.product.create({
      data: {
        organization: { connect: { id: orgId } },
        name: `Refund Test Izdelek ${Date.now()}`,
        price: new Prisma.Decimal(500), // 5,00 €
        stockQuantity: 10,
        reservedQuantity: 0,
        trackInventory: true,
        isActive: true,
        forSale: true,
      },
    })
    prodId = p.id

    const o = await prisma.order.create({
      data: {
        organizationId: orgId,
        subtotal: 1000,
        tax: 0,
        total: 1000,
        status: "PAID",
        paymentMethod: "offline",
      },
      select: { id: true },
    })
    orderId = o.id

    await prisma.orderItem.create({
      data: { orderId, productId: prodId, quantity: 2, price: 500 },
    })
    // Simuliraj prodajo: zaloga 10 → 8.
    await prisma.product.update({ where: { id: prodId }, data: { stockQuantity: 8 } })
  })

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({ where: { id: orderId } })
    } catch { /* naloge lahko že izbrisane */ }
    try {
      await prisma.product.deleteMany({ where: { id: prodId } })
    } catch { /* whatever */ }
  })

  it("vrača zalogo in prestavi naročilo v REFUNDED", async () => {
    const res = await refundOrder(orderId)
    expect(res.success).toBe(true)
    expect(res.refundedAmount).toBe(1000)

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe("REFUNDED")

    const product = await prisma.product.findUnique({ where: { id: prodId } })
    expect(product?.stockQuantity).toBe(10) // 8 + 2 vrnjeno

    const moves = await prisma.stockMovement.findMany({ where: { orderId } })
    expect(moves.length).toBe(1)
    expect(moves[0].direction).toBe("IN")
    expect(moves[0].source).toBe("RETURN")
    expect(moves[0].quantity).toBe(2)
  })

  it("že refundirano naročilo zavrne", async () => {
    const res = await refundOrder(orderId)
    expect(res.success).toBe(false)
  })

  it("tuje / neobstoječe naročilo zavrne (org-scope)", async () => {
    const res = await refundOrder("non-existent-order-id")
    expect(res.success).toBe(false)
  })
})