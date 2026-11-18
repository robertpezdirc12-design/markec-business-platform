// ============================================================
// F5.5.1 — ProductVariants → Checkout (integracijska verifikacija).
//
// Teče na `markec_f54_test`. Dokaže, da se izbrana različica pravilno
// prenese od košarice do ustvarjenega/plačanega naročila:
//   1. izdelek brez različic → OrderItem.variantId = null;
//   2. izdelek z različico → OrderItem.variantId + snapshot (name/price);
//   3. različni ceni variant → cena različice v OrderItem;
//   4. zaloga različice — oversell zavrnjen;
//   5. org izolacija — variant iz orgB ni mogoč v orgA checkout;
//   6. urejanje izdelka/različice po nakupu → snapshot na OrderItem ostane.
// ============================================================

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: string; organizationId?: string | null; email?: string | null; name?: string | null }
  },
  headerEntries: {} as Record<string, string>,
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headerEntries),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
  }),
}))

vi.mock("@/lib/tenant-proof", () => ({
  ORG_HEADER: "x-org-slug",
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

import { prisma } from "@/lib/prisma"
import { createProductCheckoutSession } from "@/app/actions/product-checkout"
import {
  applyOrderStockDecrement,
  convertReservationToSale,
  reserveStock,
  releaseStockReservation,
} from "@/lib/orders/stock"
import { validateCartStock } from "@/app/actions/cart"

const ID = {
  orgA: "f551-org-a",
  orgB: "f551-org-b",
  plain: "f551-product-plain",
  withVar: "f551-product-var",
  vL: "f551-var-l",
  vXL: "f551-var-xl",
  crossVariant: "f551-var-cross", // v orgB
}

async function freshOrg(id: string, slug: string) {
  await prisma.organization.upsert({
    where: { id },
    update: { publishState: "PUBLISHED" },
    create: {
      id,
      slug,
      name: id,
      status: "ACTIVE",
      publishState: "PUBLISHED",
      vertical: "generic",
      plan: "scale",
    },
  })
}

async function clean() {
  await prisma.orderItem.deleteMany({ where: { productId: { startsWith: "f551-" } } })
  await prisma.order.deleteMany({ where: { id: { startsWith: "f551-" } } })
  await prisma.stockMovement.deleteMany({ where: { productId: { startsWith: "f551-" } } })
  await prisma.productVariant.deleteMany({ where: { id: { startsWith: "f551-" } } })
  await prisma.product.deleteMany({ where: { id: { startsWith: "f551-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f551-" } } })
}

function cartItem(productId: string, price: number, qty: number, variant?: { id: string; name: string; sku: string | null }) {
  return {
    productId,
    name: variant ? `Izdelek — ${variant.name}` : "Izdelek",
    image: null,
    quantity: qty,
    price,
    stockQuantity: 100,
    ...(variant ? { variantId: variant.id, variantName: variant.name, variantSku: variant.sku } : {}),
  }
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f54_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)

  await clean()

  await freshOrg(ID.orgA, "f551-alpha")
  await freshOrg(ID.orgB, "f551-beta")

  // Izdelek brez različic.
  await prisma.product.create({
    data: { id: ID.plain, name: "Plain", price: 10, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 5 },
  })

  // Izdelek z dvema različicama (L 20€/8 kos, XL 25€/2 kos).
  await prisma.product.create({
    data: { id: ID.withVar, name: "Shirt", price: 18, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 0 },
  })
  await prisma.productVariant.create({
    data: { id: ID.vL, organizationId: ID.orgA, productId: ID.withVar, name: "L", sku: "SHIRT-L", price: 20, stockQuantity: 8 },
  })
  await prisma.productVariant.create({
    data: { id: ID.vXL, organizationId: ID.orgA, productId: ID.withVar, name: "XL", sku: "SHIRT-XL", price: 25, stockQuantity: 2 },
  })

  // Varianta, ki pripada orgB (leak-check).
  await prisma.product.create({
    data: { id: "f551-product-cross", name: "Cross", price: 5, organizationId: ID.orgB, forSale: true },
  })
  await prisma.productVariant.create({
    data: { id: ID.crossVariant, organizationId: ID.orgB, productId: "f551-product-cross", name: "X", price: 7, stockQuantity: 3 },
  })
})

beforeEach(() => {
  state.session = null
  state.headerEntries = {}
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ------------------------------------------------------------
// §8 — prenos različice v naročilo
// ------------------------------------------------------------
describe("F5.5.1 — variant prenese v naročilo", () => {
  it("izdelek Z različico → OrderItem.variantId + snapshot (name/cena)", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    const contact = { name: "Stranka2", email: "s2@f551.test", phone: "051 222 222" }
    // Debug: preveri, da je različica dejansko v bazi za orgA.
    const probe = await prisma.productVariant.findMany({
      where: { id: ID.vL, organizationId: ID.orgA },
      select: { id: true, price: true, productId: true },
    })
    expect(probe).toHaveLength(1)
    expect(probe[0].price?.toNumber()).toBe(20)
    const res = await createProductCheckoutSession(
      [cartItem(ID.withVar, 20, 1, { id: ID.vL, name: "L", sku: "SHIRT-L" })],
      contact
    )
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({ where: { id: res.orderId }, include: { items: true } })
    expect(order?.items).toHaveLength(1)
    const oi = order!.items[0]
    expect(oi.variantId).toBe(ID.vL)
    expect(oi.variantName).toBe("L")
    expect(oi.variantSku).toBe("SHIRT-L")
    expect(oi.price.toNumber()).toBe(20) // cena različice, ne osnovnega izdelka
  })

  it("različni ceni variant → vsaka po svoji ceni (L=20, XL=25)", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    const contact = { name: "K3", email: "k3@f551.test", phone: "051 333 333" }
    const res = await createProductCheckoutSession(
      [
        cartItem(ID.withVar, 20, 1, { id: ID.vL, name: "L", sku: "SHIRT-L" }),
        cartItem(ID.withVar, 25, 1, { id: ID.vXL, name: "XL", sku: "SHIRT-XL" }),
      ],
      contact
    )
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({ where: { id: res.orderId }, include: { items: true } })
    expect(order?.items).toHaveLength(2)
    const l = order!.items.find((i) => i.variantId === ID.vL)!
    const xl = order!.items.find((i) => i.variantId === ID.vXL)!
    expect(l.price.toNumber()).toBe(20)
    expect(xl.price.toNumber()).toBe(25)
  })

  it("zaloga različice — oversell (qty > variant stock) zavrnjen", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    // XL ima 2 kosa; zahteva 5 → validateCartStock zavrne.
    const stock = await validateCartStock([
      cartItem(ID.withVar, 25, 5, { id: ID.vXL, name: "XL", sku: "SHIRT-XL" }),
    ])
    expect(stock.valid).toBe(false)
  })

  it("izdelek BREZ različic → OrderItem.variantId = null (backward compat)", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    const contact = { name: "Stranka", email: "s@f551.test", phone: "051 111 111" }
    const res = await createProductCheckoutSession([cartItem(ID.plain, 10, 2)], contact)
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({ where: { id: res.orderId }, include: { items: true } })
    expect(order?.items).toHaveLength(1)
    expect(order?.items[0].variantId).toBeNull()
    expect(order?.items[0].price.toNumber()).toBe(10)
  })
})

// ------------------------------------------------------------
// §7 — org izolacija
// ------------------------------------------------------------
describe("F5.5.1 — org izolacija različic", () => {
  it("variant iz orgB ni mogoč v orgA checkout (rejected)", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    const contact = { name: "K4", email: "k4@f551.test", phone: "051 444 444" }
    // crossVariant pripada orgB — prijavljen kot f551-alpha orgA.
    const res = await createProductCheckoutSession(
      [cartItem("f551-product-cross", 7, 1, { id: ID.crossVariant, name: "X", sku: null })],
      contact
    )
    // Izdelek ne obstaja v orgA → zavrnjeno (idempotent ali error).
    expect(res.success).toBe(false)
  })
})

// ------------------------------------------------------------
// §8 — urejanje izdelka po nakupu
// ------------------------------------------------------------
describe("F5.5.1 — snapshot po urejanju", () => {
  it("OrderItem snapshot (cena/naziv) ostane po spremembi izdelka", async () => {
    state.headerEntries = { "x-org-slug": "f551-alpha" }
    const contact = { name: "K5", email: "k5@f551.test", phone: "051 555 555" }
    const res = await createProductCheckoutSession(
      [cartItem(ID.withVar, 20, 1, { id: ID.vL, name: "L", sku: "SHIRT-L" })],
      contact
    )
    expect(res.success).toBe(true)
    const before = await prisma.orderItem.findFirst({
      where: { orderId: res.orderId, variantId: ID.vL },
    })
    expect(before?.price.toNumber()).toBe(20)

    // Spremeni ceno različice L na 99 in ime.
    await prisma.productVariant.update({
      where: { id: ID.vL },
      data: { price: 99, name: "L-X", sku: "SHIRT-L-X" },
    })

    const after = await prisma.orderItem.findUnique({ where: { id: before!.id } })
    // Zgodovinsko naročilo ostane nespremenjeno.
    expect(after!.price.toNumber()).toBe(20)
    expect(after!.variantName).toBe("L")
    expect(after!.variantSku).toBe("SHIRT-L")
  })
})

// ------------------------------------------------------------
// F5.5.1.1 — ATOMSKA konkurenčnost: zadnji kos se proda le enkrat.
//
// Rešitev: `applyOrderStockDecrement` zniža zalogo samo s pogojem
// `stockQuantity >= quantity` (atomski `updateMany`). Dva vzporedna poteka
// ob PAID ne moreta oba uspeti: drugi dobi count 0 → izjemo, trasakcija
// se prekliče, zaloga ne gre v negativ, StockMovement se ne zapiše.
// ------------------------------------------------------------
describe("F5.5.1.1 — atomska konkurenčnost (zadnji kos)", () => {
  it("izdelek brez različic — stock 1, dve seji → točno 1 uspe, 0 zaloge, 1 StockMovement", async () => {
    // Nov izdelek brez različic, zaloga 1.
    const pid = "f551-race-plain"
    await prisma.product.create({
      data: { id: pid, name: "RacePlain", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 1 },
    })
    // Orderja morata obstajati (FK StockMovement.orderId), kot v realni prodaji.
    await prisma.order.createMany({
      data: ["f551-race-o1", "f551-race-o2"].map((id) => ({
        id,
        subtotal: 5,
        tax: 0,
        total: 5,
        status: "PENDING",
        organizationId: ID.orgA,
      })),
    })

    const runTx = async (orderId: string) =>
      prisma.$transaction(async (tx) => {
        await applyOrderStockDecrement(
          tx,
          { productId: pid, variantId: null, variantName: null, variantSku: null, quantity: 1, price: 5, name: "RacePlain", image: null },
          ID.orgA,
          orderId
        )
      })

    const results = await Promise.allSettled([runTx("f551-race-o1"), runTx("f551-race-o2")])
    const fulfilled = results.filter((r) => r.status === "fulfilled").length
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toBe(1)
    expect(rejected).toHaveLength(1)
    expect(String(rejected[0].reason)).toContain("STOCK_CONFLICT")

    const prod = await prisma.product.findUniqueOrThrow({ where: { id: pid } })
    expect(prod.stockQuantity).toBe(0) // NE negativno
    const moves = await prisma.stockMovement.count({ where: { orderId: { in: ["f551-race-o1", "f551-race-o2"] } } })
    expect(moves).toBe(1) // samo en zapis zaloge (skladno)
  })

  it("izdelek z različicami — variant stock 1, dve seji, različne košarice → točno 1 uspe", async () => {
    // Nova različica z zalogo 1 na obstoječem izdelku z variantami.
    const vid = "f551-race-variant"
    await prisma.product.create({
      data: { id: "f551-race-varprod", name: "RaceVarProd", price: 8, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 0 },
    })
    await prisma.productVariant.create({
      data: { id: vid, organizationId: ID.orgA, productId: "f551-race-varprod", name: "One", price: 9, stockQuantity: 1 },
    })
    await prisma.order.createMany({
      data: ["f551-race-vo1", "f551-race-vo2"].map((id) => ({
        id,
        subtotal: 9,
        tax: 0,
        total: 9,
        status: "PENDING",
        organizationId: ID.orgA,
      })),
    })

    const runTx = async (orderId: string) =>
      prisma.$transaction(async (tx) => {
        await applyOrderStockDecrement(
          tx,
          { productId: "f551-race-varprod", variantId: vid, variantName: "One", variantSku: null, quantity: 1, price: 9, name: "RaceVarProd", image: null },
          ID.orgA,
          orderId
        )
      })

    const results = await Promise.allSettled([runTx("f551-race-vo1"), runTx("f551-race-vo2")])
    const fulfilled = results.filter((r) => r.status === "fulfilled").length
    expect(fulfilled).toBe(1)
    const rejected = results.filter((r) => r.status === "rejected")
    expect(String(rejected[0].reason)).toContain("STOCK_CONFLICT")

    const varRow = await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })
    expect(varRow.stockQuantity).toBe(0)
  })
})

// ------------------------------------------------------------
// F5.5.1.2 — ONLINE INVENTORY RESERVATION.
// Ločimo razpoložljivo / rezervirano / prodano. Atomični helperji:
// reserveStock (ob začetku seje), convertReservationToSale (ob PAID),
// releaseStockReservation (ob expired/unpaid). Stanja preverjena atomično.
// ------------------------------------------------------------
describe("F5.5.1.2 — online inventory reservation", () => {
  function line(pid: string, qty: number, vid: string | null) {
    return { productId: pid, variantId: vid, variantName: vid ? "V" : null, variantSku: null, quantity: qty, price: 1, name: "", image: null }
  }
  const P = "f5512-prod"
  const V = "f5512-var"

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "OrderItem" WHERE "orderId" IN ('f5512-ord','f5512-ord2','f5512-ord3')`
    ).catch(() => undefined)
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Order" WHERE id IN ('f5512-ord','f5512-ord2','f5512-ord3')`
    ).catch(() => undefined)
    await prisma.$executeRawUnsafe(`DELETE FROM "StockMovement" WHERE "productId" = $1`, P).catch(() => undefined)
    await prisma.$executeRawUnsafe(`DELETE FROM "ProductVariant" WHERE id = $1`, V).catch(() => undefined)
    await prisma.$executeRawUnsafe(`DELETE FROM "Product" WHERE id = $1`, P).catch(() => undefined)
  })

  it("atomska rezervacija: zaloga 1, dve seji → samo eden dobi rezervacijo", async () => {
    await prisma.productVariant.deleteMany({ where: { id: V } }).catch(() => undefined)
    await prisma.product.delete({ where: { id: P } }).catch(() => undefined)
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 1, reservedQuantity: 0 },
    })
    await prisma.productVariant.create({
      data: { id: V, organizationId: ID.orgA, productId: P, name: "V", price: null, stockQuantity: 1, reservedQuantity: 0 },
    })

    const r = await Promise.all([
      prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA)),
      prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA)),
    ])
    expect(r.filter(Boolean)).toHaveLength(1) // točno eden dobi rezervacijo

    const row = await prisma.product.findUniqueOrThrow({ where: { id: P } })
    expect(row.stockQuantity).toBe(1) // dejanska zaloga NIZA znižana ob rezervaciji
    expect(row.reservedQuantity).toBe(1) // rezervirano 1

    // Čiščenje.
    await prisma.productVariant.delete({ where: { id: V } })
    await prisma.product.delete({ where: { id: P } })
  })

  it("neuspešen checkout (release) sprosti rezervacijo → drugi lahko kupi", async () => {
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 1, reservedQuantity: 0 },
    })
    const r1 = await prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA))
    expect(r1).toBe(true)
    const released = await prisma.$transaction((tx) => releaseStockReservation(tx, line(P, 1, null), ID.orgA))
    expect(released).toBe(true)
    // Nova seja ga lahko rezervira.
    const r2 = await prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA))
    expect(r2).toBe(true)
    await prisma.$transaction((tx) => releaseStockReservation(tx, line(P, 1, null), ID.orgA))
    await prisma.product.delete({ where: { id: P } }).catch(() => undefined)
  })

  it("uspešno plačilo pretvori rezervacijo v prodajo (stock −=, reserved −=)", async () => {
    await prisma.order.delete({ where: { id: "f5512-ord" } }).catch(() => undefined)
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 3, reservedQuantity: 0 },
    })
    await prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA))
    const ordId = "f5512-ord"
    await prisma.order.create({
      data: { id: ordId, subtotal: 5, tax: 0, total: 5, status: "PENDING", organizationId: ID.orgA, paymentMethod: "online" },
    })
    const ok = await prisma.$transaction((tx) =>
      convertReservationToSale(tx, line(P, 1, null), ID.orgA, ordId)
    )
    expect(ok).toBe(true)
    const row = await prisma.product.findUniqueOrThrow({ where: { id: P } })
    expect(row.stockQuantity).toBe(2) // prodano 1
    expect(row.reservedQuantity).toBe(0) // rezerva sproščena
    const moves = await prisma.stockMovement.count({ where: { orderId: ordId } })
    expect(moves).toBe(1)
    await prisma.order.delete({ where: { id: ordId } }).catch(() => undefined)
    await prisma.product.delete({ where: { id: P } }).catch(() => undefined)
  })

  it("ponovljeni webhook (double convert) ne podvoji prodaje", async () => {
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 2, reservedQuantity: 1 },
    })
    const ordId = "f5512-ord2"
    await prisma.order.create({
      data: { id: ordId, subtotal: 5, tax: 0, total: 5, status: "PENDING", organizationId: ID.orgA, paymentMethod: "online" },
    })
    const first = await prisma.$transaction((tx) => convertReservationToSale(tx, line(P, 1, null), ID.orgA, ordId))
    const second = await prisma.$transaction((tx) => convertReservationToSale(tx, line(P, 1, null), ID.orgA, ordId))
    expect(first).toBe(true)
    expect(second).toBe(false) // ni več rezerve → ne podvoji
    const row = await prisma.product.findUniqueOrThrow({ where: { id: P } })
    expect(row.stockQuantity).toBe(1) // znižano točno enkrat
    await prisma.order.delete({ where: { id: ordId } }).catch(() => undefined)
    await prisma.product.delete({ where: { id: P } }).catch(() => undefined)
  })

  it("zamujen release ob že plačani ne sprosti (fail-closed / reserved ne gre v negativ)", async () => {
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 1, reservedQuantity: 0 },
    })
    // Rezerviraj in takoj convert (simulira: webhook je zamudil, order plačan).
    await prisma.$transaction((tx) => reserveStock(tx, line(P, 1, null), ID.orgA))
    const ordId = "f5512-ord3"
    await prisma.order.create({
      data: { id: ordId, subtotal: 5, tax: 0, total: 5, status: "PAID", organizationId: ID.orgA, paymentMethod: "online" },
    })
    await prisma.$transaction((tx) => convertReservationToSale(tx, line(P, 1, null), ID.orgA, ordId))
    // Zamujen expired-webhook poskuša sprostiti — reserved je 0 → ne sprosti (vre false).
    const released = await prisma.$transaction((tx) => releaseStockReservation(tx, line(P, 1, null), ID.orgA))
    expect(released).toBe(false)
    const row = await prisma.product.findUniqueOrThrow({ where: { id: P } })
    expect(row.reservedQuantity).toBe(0)
    expect(row.stockQuantity).toBe(0)
    await prisma.order.delete({ where: { id: ordId } }).catch(() => undefined)
    await prisma.product.delete({ where: { id: P } }).catch(() => undefined)
  })

  it("izolacija: variant rezerva ne vpliva na drug variant / izdelek", async () => {
    await prisma.product.create({
      data: { id: P, name: "ResProd", price: 5, organizationId: ID.orgA, forSale: true, trackInventory: true, stockQuantity: 2, reservedQuantity: 0 },
    })
    await prisma.productVariant.create({
      data: { id: V, organizationId: ID.orgA, productId: P, name: "V", price: null, stockQuantity: 1, reservedQuantity: 0 },
    })
    // Rezerviraj variant → izdelek (bazni) ostane neprizadet.
    await prisma.$transaction((tx) => reserveStock(tx, line(P, 1, V), ID.orgA))
    const base = await prisma.product.findUniqueOrThrow({ where: { id: P } })
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: V } })
    expect(base.reservedQuantity).toBe(0)
    expect(variant.reservedQuantity).toBe(1)
    await prisma.productVariant.delete({ where: { id: V } })
    await prisma.product.delete({ where: { id: P } })
  })
})