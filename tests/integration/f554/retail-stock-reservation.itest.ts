// ============================================================
// F6.1 (potrditev) — SERVER-SIDE AVTORITETA ZALOGE ob spletnem checkoutu.
//
// Kupčeva košarica hrani MAX (available) ob DODAJANJU in ga prikazuje
// v košarici. Če se zaloga po tem ZMANJŠA (scenarij 6 potrditve), košarica
// ne more vedeti — ZATO je zadnja beseda na strežniku: `reserveStock` je
// atomarno pogojen s `stockQuantity − reservedQuantity >= qty` in vrne
// false (→ checkout zavrne) takoj, ko ni več razpoložljivega. To je
// avtoritativna zaščita "prepreči prodajo količine, ki ni več razpoložljiva",
// neodvisna od UI. Tudi sočasne rezervacije so zaščitene (row-lock + pogoj).
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null } } }))
vi.mock("@/lib/auth/auth", () => ({ auth: async () => state.session, unstable_update: async () => null, handlers: {}, signIn: async () => undefined, signOut: async () => undefined }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { reserveStock, convertReservationToSale, type PricedLine } from "@/app/actions/product-checkout"

const ORG = "f61-avail-org"
const ADMIN = "f61-avail-admin"

async function wipe() {
  // OrderItem nima lastnega organizationId — brišemo po relaciji Order→org.
  await prisma.orderItem.deleteMany({ where: { order: { organizationId: ORG } } }).catch(() => {})
  await prisma.order.deleteMany({ where: { organizationId: ORG } }).catch(() => {})
  await prisma.product.deleteMany({ where: { organizationId: ORG } }).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { organizationId: ORG } }).catch(() => {})
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } })
  await prisma.user.deleteMany({ where: { id: ADMIN } })
  await prisma.organization.deleteMany({ where: { id: ORG } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(rows[0].db).toBe("markec_f554_test")
  await wipe()
  await prisma.organization.create({ data: { id: ORG, name: ORG, slug: ORG } })
  await prisma.user.create({ data: { id: ADMIN, email: `${ADMIN}@f.test`, name: ADMIN, role: "ADMIN", organizationId: ORG } })
  await prisma.organizationMember.create({ data: { organizationId: ORG, userId: ADMIN, role: "ADMIN", isDefault: true } })
})
afterAll(async () => { await wipe(); await prisma.$disconnect() })

function line(productId: string, quantity: number): PricedLine {
  return { productId, variantId: null, variantName: null, variantSku: null, quantity, price: 100, name: "X", image: null }
}

describe("F6.1 potrditev — server-side zaščita zaloge (reserveStock)", () => {
  it("zavrne rezervacijo nad available (stock 10, reserved 7 → qty 4 NAMAHA)", async () => {
    const p = await prisma.product.create({ data: { organizationId: ORG, name: "Zavoj", price: 100, stockQuantity: 10, reservedQuantity: 7 } })
    // available = 3. Zahteva 4 → ATomarno ne gre (pogoj stock−reserved>=4 NE drži).
    await prisma.$transaction(async (tx) => {
      const ok = await reserveStock(tx, line(p.id, 4), ORG)
      expect(ok).toBe(false)
    })
    // reserved se NI spremenil (še 7 — nobena rezervacija ni bila dodana).
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true, reservedQuantity: true } })
    expect(after!.stockQuantity).toBe(10)
    expect(after!.reservedQuantity).toBe(7)
  })

  it("omogoči rezervacijo do available (stock 10, reserved 7 → qty 3 gre)", async () => {
    const p = await prisma.product.create({ data: { organizationId: ORG, name: "Zravla", price: 100, stockQuantity: 10, reservedQuantity: 7 } })
    await prisma.$transaction(async (tx) => {
      const ok = await reserveStock(tx, line(p.id, 3), ORG)
      expect(ok).toBe(true)
    })
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { reservedQuantity: true } })
    expect(after!.reservedQuantity).toBe(10) // 7 + 3 = 10 → vse rezervirano
  })

  it("sočasni zahtevki ne morejo preseči available (oba rezervirata 4 od available 5, le eden uspe)", async () => {
    const p = await prisma.product.create({ data: { organizationId: ORG, name: "Konk", price: 100, stockQuantity: 10, reservedQuantity: 5 } })
    // available = 5. Dva različna transakcijska "kupca" zahtevata po 4 —
    // zaradi row-lock + pogoj v realni sočasnosti bi drugi dobil false.
    // Tu s serijskim izvajanjem simuliramo ISTI izid (drugi zavrne, ko ne zmore).
    let r1 = false
    let r2 = false
    await prisma.$transaction(async (tx) => { r1 = await reserveStock(tx, line(p.id, 4), ORG) })
    await prisma.$transaction(async (tx) => { r2 = await reserveStock(tx, line(p.id, 4), ORG) })
    expect(r1).toBe(true)
    expect(r2).toBe(false) // po 1. rezervaciji je available = 1 → 2. ne gre
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { reservedQuantity: true } })
    expect(after!.reservedQuantity).toBe(9) // 5+4 → 9 (ne 13)
  })

  it("pretvorba rezervacije v prodajo zmanjša stock in sprosti reserved", async () => {
    const p = await prisma.product.create({ data: { organizationId: ORG, name: "Prod", price: 100, stockQuantity: 8, reservedQuantity: 3 } })
    const order = await prisma.order.create({ data: { organizationId: ORG, subtotal: 200, total: 200 } })
    await prisma.$transaction(async (tx) => {
      const okR = await reserveStock(tx, line(p.id, 2), ORG)
      expect(okR).toBe(true) // available 5 → rezervira 2 (reserved=5)
      const okC = await convertReservationToSale(tx, line(p.id, 2), ORG, order.id)
      expect(okC).toBe(true)
    })
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true, reservedQuantity: true } })
    expect(after!.stockQuantity).toBe(6) // 8−2
    expect(after!.reservedQuantity).toBe(3) // 5−2
  })

  it("pretvorbo onemogoči, če reserved ne zadošča (ne sprosti več kot je rezervirano)", async () => {
    const p = await prisma.product.create({ data: { organizationId: ORG, name: "Pred", price: 100, stockQuantity: 8, reservedQuantity: 2 } })
    const order = await prisma.order.create({ data: { organizationId: ORG, subtotal: 100, total: 100 } })
    await prisma.$transaction(async (tx) => {
      const okC = await convertReservationToSale(tx, line(p.id, 5), ORG, order.id)
      expect(okC).toBe(false) // reserved 2 < 5 → no-op
    })
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true, reservedQuantity: true } })
    expect(after!.stockQuantity).toBe(8)
    expect(after!.reservedQuantity).toBe(2)
  })
})