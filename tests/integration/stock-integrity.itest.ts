// ============================================================
// 2D-1N — CELOVITA INTEGRACIJSKA VALIDACIJA ZALOG + SOČASNI TESTI
// (P1-D-1A/B/C) proti izolirani bazi `markec_e2e_test`.
//
// Mock-only: NextAuth session (nastavimo lastnega userja z ADMIN member
// v ACTIVE org). Vse ostalo (prisma, server actions) je resnično.
//
// Uporaba (guard):
//   node scripts/run-with-test-db.mjs vitest run --config vitest.itest.config.ts tests/integration/stock-integrity.itest.ts
//
// Deterministično: unikaten prefix v vsakem teku; afterAll izbriše vse
// pod svojim prefixom (product/org), tako da je ponovljivo.
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: string; email?: string | null; name?: string | null }
  },
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
  recordDelivery,
  createStockMovement,
  submitStockTake,
  getStockSummary,
} from "@/app/actions/inventory"
import {
  reserveStock,
  releaseStockReservation,
  convertReservationToSale,
} from "@/lib/orders/stock"

const RUN = "2d1n_" + Date.now().toString(36)
let orgId: string
let orgOtherId: string
let userId: string
let P_plain: string // produkt brez variant
let P_var: string // produkt z variantami
let V1: string
let V2: string
let P_other: string // produkt v drugi org (izolacija)
const cleanup: string[] = []

async function seed() {
  // Org A (glavna) + user (ADMIN member)
  const org = await prisma.organization.create({
    data: { slug: `${RUN}_a`, name: `Org A ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" },
  })
  orgId = org.id
  const orgB = await prisma.organization.create({
    data: { slug: `${RUN}_b`, name: `Org B ${RUN}`, vertical: "generic", publishState: "DRAFT" },
  })
  orgOtherId = orgB.id
  const user = await prisma.user.create({
    data: {
      email: `${RUN}@markec.test`,
      name: "Test Owner",
      role: "ADMIN",
      organizationId: org.id,
      password: "x",
      emailVerified: new Date(),
    },
  })
  userId = user.id
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: "ADMIN", isDefault: true },
  })
  await prisma.organizationMember.create({
    data: { organizationId: orgB.id, userId: user.id, role: "ADMIN", isDefault: false },
  })

  // Izdelki
  const pPlain = await prisma.product.create({
    data: { organization: { connect: { id: org.id } }, name: `${RUN} Plain`, trackInventory: true, stockQuantity: 100, reservedQuantity: 10, isActive: true, price: 0 },
  })
  P_plain = pPlain.id
  const pVar = await prisma.product.create({
    data: { organization: { connect: { id: org.id } }, name: `${RUN} Variant`, trackInventory: true, stockQuantity: 0, reservedQuantity: 0, isActive: true, price: 0 },
  })
  P_var = pVar.id
  const v1 = await prisma.productVariant.create({
    data: { organization: { connect: { id: org.id } }, product: { connect: { id: P_var } }, name: "V1", sku: `${RUN}-v1`, trackInventory: true, stockQuantity: 30, reservedQuantity: 5 },
  })
  V1 = v1.id
  const v2 = await prisma.productVariant.create({
    data: { organization: { connect: { id: org.id } }, product: { connect: { id: P_var } }, name: "V2", sku: `${RUN}-v2`, trackInventory: true, stockQuantity: 40, reservedQuantity: 0 },
  })
  V2 = v2.id
  const pOther = await prisma.product.create({
    data: { organization: { connect: { id: orgB.id } }, name: `${RUN} Other`, trackInventory: true, stockQuantity: 50, reservedQuantity: 0, isActive: true, price: 0 },
  })
  P_other = pOther.id

  state.session = { user: { id: user.id, role: "ADMIN", email: user.email, name: "Test Owner" } }
  cleanup.push(orgId, orgOtherId)
}

beforeAll(async () => {
  await seed()
})

afterAll(async () => {
  // Izolirano čiščenje: zbriši samo svoje org (cascade → user/membership)/products.
  for (const id of cleanup) {
    await prisma.organization.delete({ where: { id } }).catch(() => undefined)
  }
  // user se z organidenca obdrži (account-level), zbrišemo ga po cleanup.
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

async function stock(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true, reservedQuantity: true } })
  return { stock: p!.stockQuantity, reserved: p!.reservedQuantity }
}

describe("2D-1N — A. Prevzem dobave", () => {
  it("A1. recordDelivery poveča stockQuantity + ustvari DELIVERY premike", async () => {
    const before = await stock(P_plain)
    const res = await recordDelivery({
      documentNumber: `D-${RUN}`,
      lines: [{ productId: P_plain, quantity: 20 }],
    })
    expect(res.ok).toBe(true)
    expect(res.receivedCount).toBe(1)
    const after = await stock(P_plain)
    expect(after.stock).toBe(before.stock + 20)
    const moves = await prisma.stockMovement.count({
      where: { organizationId: orgId, productId: P_plain, source: "DELIVERY" },
    })
    expect(moves).toBeGreaterThanOrEqual(1)
  })

  it("A2. neveljavna količina (0) → VALIDATION, brez spremembe", async () => {
    const before = await stock(P_plain)
    const res = await recordDelivery({ lines: [{ productId: P_plain, quantity: 0 }] })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("VALIDATION")
    expect(await stock(P_plain)).toEqual(before)
  })

  it("A3. tuji izdelek (org B) ni sprejet (NOT_FOUND)", async () => {
    const res = await recordDelivery({ lines: [{ productId: P_other, quantity: 5 }] })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
  })
})

describe("2D-1N — B. Rezervacije", () => {
  it("B1. reserveStock poveča reservedQuantity (atomarno)", async () => {
    const before = await stock(P_plain) // 100/10
    await prisma.$transaction(async (tx) => {
      const ok = await reserveStock(tx, { productId: P_plain, quantity: 5 } as never, orgId)
      expect(ok).toBe(true)
    })
    const after = await stock(P_plain)
    expect(after.reserved).toBe(before.reserved + 5)
  })

  it("B2. reserveStock nad razpoložljivo → false, brez spremembe (RESERVED_BLOCK logika)", async () => {
    // razpoložljivo = stock - reserved (sveže po B1). Poskušamo po 1_000_000.
    const before = await stock(P_plain)
    await prisma.$transaction(async (tx) => {
      const ok = await reserveStock(tx, { productId: P_plain, quantity: 1_000_000 } as never, orgId)
      expect(ok).toBe(false)
    })
    expect(await stock(P_plain)).toEqual(before)
  })

  it("B3. releaseStockReservation zniža reserved", async () => {
    const before = await stock(P_plain)
    await prisma.$transaction(async (tx) => {
      const ok = await releaseStockReservation(tx, { productId: P_plain, quantity: 5 } as never, orgId)
      expect(ok).toBe(true)
    })
    const after = await stock(P_plain)
    expect(after.reserved).toBe(before.reserved - 5)
    // vmesne spremembe ne smejo vplivati na stock
    expect(after.stock).toBe(before.stock)
  })

  it("B4. convertReservationToSale (potrjena prodaja) — stock in reserved se znižata", async () => {
    const before = await stock(P_plain)
    expect(before.reserved).toBeGreaterThanOrEqual(5)
    const order = await prisma.order.create({
      data: { organization: { connect: { id: orgId } }, subtotal: 0, total: 0, paymentMethod: "offline", status: "PENDING" },
    })
    await prisma.$transaction(async (tx) => {
      const ok = await convertReservationToSale(tx, { productId: P_plain, quantity: 5 } as never, orgId, order.id)
      expect(ok).toBe(true)
    })
    const after = await stock(P_plain)
    expect(after.stock).toBe(before.stock - 5)
    expect(after.reserved).toBe(before.reserved - 5)
  })
})

describe("2D-1N — C. Zaščita zaloge", () => {
  it("C1. createStockMovement OUT nad zalogo → NEGATIVE_STOCK, brez premika", async () => {
    const m = await createStockMovement({
      productId: P_plain,
      direction: "OUT",
      quantity: 1_000_000,
      source: "MANUAL",
    })
    expect(m.ok).toBe(false)
    expect(m.error).toBe("NEGATIVE_STOCK")
  })

  it("C2. OUT nad razpoložljivo zalogo → zavrnjen (RESERVED_BLOCK / NEGATIVE_STOCK)", async () => {
    // Po B koraku je available = stock - reserved; OUT mora biti <= available.
    const s = await stock(P_plain)
    const m = await createStockMovement({ productId: P_plain, direction: "OUT", quantity: (s.stock - s.reserved) + 1, source: "MANUAL" })
    expect(m.ok).toBe(false) // bodisi RESERVED_BLOCK ali NEGATIVE_STOCK — vedno zavrnjen
    expect(["RESERVED_BLOCK", "NEGATIVE_STOCK", "VALIDATION"]).toContain(m.error)
  })

  it("C3. neuspešna operacija ne spremeni stock niti ne ustvari premika", async () => {
    const before = await stock(P_plain)
    const movesBefore = await prisma.stockMovement.count({ where: { productId: P_plain } })
    const m = await createStockMovement({ productId: P_plain, direction: "OUT", quantity: 1_000_000 })
    expect(m.ok).toBe(false)
    expect(await stock(P_plain)).toEqual(before)
    expect(await prisma.stockMovement.count({ where: { productId: P_plain } })).toBe(movesBefore)
  })
})

describe("2D-1N — D. Inventura", () => {
  it("D1. navzgor (counted > sistem) → IN premik", async () => {
    const before = await stock(P_var) // product-level (ne varianta)
    const res = await submitStockTake({ lines: [{ productId: P_var, counted: before.stock + 10 }] })
    expect(res.ok).toBe(true)
    const after = await stock(P_var)
    expect(after.stock).toBe(before.stock + 10)
  })

  it("D2. navzdol (counted < sistem) → OUT premik", async () => {
    const before = await stock(P_var)
    const res = await submitStockTake({ lines: [{ productId: P_var, counted: before.stock - 3 }] })
    expect(res.ok).toBe(true)
    expect((await stock(P_var)).stock).toBe(before.stock - 3)
  })

  it("D3. VARIANT-level inventura — neodvisno stanje", async () => {
    const vBefore = await prisma.productVariant.findUnique({ where: { id: V1 }, select: { stockQuantity: true } })
    const res = await submitStockTake({ lines: [{ productId: P_var, productVariantId: V1, counted: vBefore!.stockQuantity + 7 }] })
    expect(res.ok).toBe(true)
    const vAfter = await prisma.productVariant.findUnique({ where: { id: V1 }, select: { stockQuantity: true } })
    expect(vAfter!.stockQuantity).toBe(vBefore!.stockQuantity + 7)
  })
})

describe("2D-1N — E. Izdelki in različice", () => {
  let productStockBeforeVariantOut: number

  it("E0. shranimo product-level zalogo pred variant OUT", async () => {
    productStockBeforeVariantOut = (await stock(P_var)).stock
  })

  it("E1. OUT na varianti V2 (available) uspe in ne dotakne V1", async () => {
    const v2Before = await prisma.productVariant.findUnique({ where: { id: V2 }, select: { stockQuantity: true } })
    const v1Before = await prisma.productVariant.findUnique({ where: { id: V1 }, select: { stockQuantity: true } })
    const m = await createStockMovement({ productId: P_var, productVariantId: V2, direction: "OUT", quantity: 5, source: "RETURN" })
    expect(m.ok).toBe(true)
    const v2After = await prisma.productVariant.findUnique({ where: { id: V2 }, select: { stockQuantity: true } })
    const v1After = await prisma.productVariant.findUnique({ where: { id: V1 }, select: { stockQuantity: true } })
    expect(v2After!.stockQuantity).toBe(v2Before!.stockQuantity - 5)
    expect(v1After!.stockQuantity).toBe(v1Before!.stockQuantity)
  })

  it("E2. variant-level OUT NE spremeni product-level zaloge (brez dvojnega odštevanja)", async () => {
    const sAfter = await stock(P_var)
    // product-level stock mora ostati natanko enak kot pred variant OUT (E1)
    expect(sAfter.stock).toBe(productStockBeforeVariantOut)
  })
})

describe("2D-1N — P1-D-1C sočasni testi", () => {
  it("P1. dve sočasni prodaji iste zaloge — skupaj ne presežeta razpoložljive", async () => {
    // Ustvari produkt z zadostno zalogo za dve ločeni prodaji.
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgId } }, name: `${RUN} Concur1`, trackInventory: true, stockQuantity: 20, reservedQuantity: 0, isActive: true, price: 0 },
    })
    // Dve SOČASNI OUT-ji po 12 (vsaka sama > 20? ne; 12+12=24 > 20 → ena mora zavrniti).
    const [r1, r2] = await Promise.all([
      createStockMovement({ productId: p.id, direction: "OUT", quantity: 12 }),
      createStockMovement({ productId: p.id, direction: "OUT", quantity: 12 }),
    ])
    const okCount = [r1, r2].filter((r) => r.ok).length
    const after = (await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true } }))!
    expect(okCount).toBe(1) // samo ena uspe (12+12>20)
    expect(after.stockQuantity).toBe(8) // 20 - 12
  })

  it("P2. sočasna dobava in prodaja — končno stanje ustreza pravilom", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgId } }, name: `${RUN} Concur2`, trackInventory: true, stockQuantity: 10, reservedQuantity: 0, isActive: true, price: 0 },
    })
    const before = 10
    const [d, m] = await Promise.all([
      recordDelivery({ lines: [{ productId: p.id, quantity: 25 }] }),
      createStockMovement({ productId: p.id, direction: "OUT", quantity: 15 }),
    ])
    const after = (await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true } }))!
    // Serializirano (FOR UPDATE): natanko en red — dobava vedno uspe (IN na obst.-produkt),
    // OUT uspe LE, če teče po dobavi (razpoložljivo 35 ≥ 15). Končno stanje je eksaktno
    // odvisno od reducirja zaporedja, zato preverimo natanko tisto vrednost, ki jo
    // uspela operacija zagotovi (brez približkov / `expected - 1`).
    expect(d.ok).toBe(true) // dobava vedno uspe
    const expected = before + 25 - (m.ok ? 15 : 0)
    expect(after.stockQuantity).toBe(expected)
    // V obeh redih: brez negativne zaloge.
    expect(after.stockQuantity).toBeGreaterThanOrEqual(0)
    // OUT ni mogel povzročiti negativnega: če je m.ok true, je stock po dobavi bil ≥15.
    if (m.ok) expect(expected).toBe(20)
  })

  it("P4. dve sočasni rezervaciji — ne presegata razpoložljive", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgId } }, name: `${RUN} Concur3`, trackInventory: true, stockQuantity: 10, reservedQuantity: 0, isActive: true, price: 0 },
    })
    const [x, y] = await Promise.all([
      prisma.$transaction((tx) => reserveStock(tx, { productId: p.id, quantity: 8 } as never, orgId)),
      prisma.$transaction((tx) => reserveStock(tx, { productId: p.id, quantity: 8 } as never, orgId)),
    ])
    const after = (await prisma.product.findUnique({ where: { id: p.id }, select: { reservedQuantity: true } }))!
    expect((x ? 1 : 0) + (y ? 1 : 0)).toBe(1) // le eden uspe (8+8>10)
    expect(after.reservedQuantity).toBe(8) // ena uspela rezervacija
  })

  it("P5. sprostitev rezervacije med prodajo — nobenih negativnih rezervacij", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgId } }, name: `${RUN} Concur4`, trackInventory: true, stockQuantity: 10, reservedQuantity: 3, isActive: true, price: 0 },
    })
    // Potrebujemo REALNO naročilo (convertReservationToSale piše StockMovement z orderId FK).
    const order = await prisma.order.create({
      data: {
        organization: { connect: { id: orgId } },
        subtotal: 0,
        total: 0,
        paymentMethod: "offline",
        status: "PENDING",
      },
    })
    await prisma.$transaction((tx) => reserveStock(tx, { productId: p.id, quantity: 2 } as never, orgId))
    // sprosti 2 v eni trans., in prodaj rezervirano 3 v drugi (sočasno, isti lock)
    const [rel, conv] = await Promise.all([
      prisma.$transaction((tx) => releaseStockReservation(tx, { productId: p.id, quantity: 2 } as never, orgId)),
      prisma.$transaction((tx) => convertReservationToSale(tx, { productId: p.id, quantity: 3 } as never, orgId, order.id)),
    ])
    const after = (await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true, reservedQuantity: true } }))!
    // Serializirano: stock 10, reserved 5 (po +2). release(-2) in convert(-3 stock, -3 reserved).
    // Kombinacija je poslovno veljavna (5 >= 2 in 3) → obe uspeta; končno stanje je neodvisno
    // od reda: stock 7, reserved 0. Noben rezultat ni negativen.
    expect(rel).toBe(true)
    expect(conv).toBe(true)
    expect(after.stockQuantity).toBe(7)
    expect(after.reservedQuantity).toBe(0)
  })

  it("P7. dostop dveh organizacij do različnih zalog (izolacija)", async () => {
    // createStockMovement na izdelek druge org mora zavrniti (NOT_FOUND)
    const before = (await prisma.product.findUnique({ where: { id: P_other }, select: { stockQuantity: true } }))!
    const m = await createStockMovement({ productId: P_other, direction: "OUT", quantity: 5 })
    expect(m.ok).toBe(false)
    expect(m.error).toBe("NOT_FOUND")
    const after = (await prisma.product.findUnique({ where: { id: P_other }, select: { stockQuantity: true } }))!
    expect(after.stockQuantity).toBe(before.stockQuantity)
    // tudi dobava na tuji izdelek zavrnjena (A3 že; tukaj sz potencialnim variant ✓)
  })
})

describe("2D-1N — Varnost / org izolacija", () => {
  it("I1. tuji izdelek / varianta ID zavrnjen na strežniku", async () => {
    const m = await createStockMovement({ productId: P_other, direction: "OUT", quantity: 1 })
    expect(m.ok).toBe(false)
    expect(m.error).toBe("NOT_FOUND")
    const d = await recordDelivery({ lines: [{ productId: P_other, quantity: 1 }] })
    expect(d.ok).toBe(false)
    expect(d.error).toBe("NOT_FOUND")
    const s = await submitStockTake({ lines: [{ productId: P_other, counted: 1 }] })
    expect(s.ok).toBe(false)
    expect(s.error).toBe("NOT_FOUND")
  })

  it("I2. tuja VARIANTA (druga org) ni uporabna ne za premik ne za materiale", async () => {
    // Ustvari VARIANTO v org B (druga org).
    const foreignVariant = await prisma.productVariant.create({
      data: { organization: { connect: { id: orgOtherId } }, product: { connect: { id: P_other } }, name: "Foreign Var", sku: `${RUN}-fv`, trackInventory: true, stockQuantity: 9, reservedQuantity: 0 },
    })
    // createStockMovement z variantId tuje org + izdelek druge org → NOT_FOUND
    const m = await createStockMovement({ productId: P_other, productVariantId: foreignVariant.id, direction: "OUT", quantity: 1 })
    expect(m.ok).toBe(false)
    expect(m.error).toBe("NOT_FOUND")
    // tudi če bi poslal izdelek naše org + tujo varianto → VARIANT_MISMATCH/NOT_FOUND
    const m2 = await createStockMovement({ productId: P_var, productVariantId: foreignVariant.id, direction: "OUT", quantity: 1 })
    expect(m2.ok).toBe(false)
    // varianta tuje org ne sme spremeniti njenega stanja prek premika iz org A
    const after = await prisma.productVariant.findUnique({ where: { id: foreignVariant.id }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(9)
  })
})