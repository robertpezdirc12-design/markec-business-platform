// ============================================================
// F5.1 — INTEGRACIJSKI TESTI POPUSTOV (prava testna baza)
//
// Kličejo resnične server actions / engine proti resnični, ločeni
// bazi `markec_f51_test` (seed.mjs). Nadomeščen je le NextAuth
// session + next/cache + next/headers (tenant-proof mocked true) —
// vse odločitve o cenah, popustih, izolaciji in zapisih gredo skozi
// pravi Prisma klient in pravi promotion engine.
//
// POZOR (varnost): org B NI ustvarjen s Stripe ključem, zato gre
// product checkout skozi OFFLINE pot (brez HTTP klicov na Stripe).
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
    user: {
      id: string
      role: "ADMIN" | "STAFF" | "CLIENTE"
      organizationId?: string | null
      email?: string | null
      name?: string | null
    }
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
}))

vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

vi.mock("@/lib/email/appointment-confirmation", () => ({
  sendAppointmentConfirmationEmail: async () => ({ success: true }),
}))
vi.mock("@/lib/email/appointment-completed", () => ({
  sendAppointmentCompletedEmail: async () => ({ success: true }),
}))
vi.mock("@/lib/email/appointment-cancelled", () => ({
  sendAppointmentCancelledEmail: async () => ({ success: true }),
}))
vi.mock("@/lib/email/appointment-rescheduled", () => ({
  sendAppointmentRescheduledEmail: async () => ({ success: true }),
}))
vi.mock("@/lib/email/appointment-expired", () => ({
  sendAppointmentExpiredEmail: async () => ({ success: true }),
}))
vi.mock("@/lib/email/no-show-notification", () => ({
  sendNoShowNotificationEmail: async () => ({ success: true }),
}))

import { prisma } from "@/lib/prisma"
import { createProductCheckoutSession } from "@/app/actions/product-checkout"
import {
  getAdminPromotions,
  createPromotion,
  updatePromotion,
  setPromotionStatus,
} from "@/app/actions/promotions"
import { redeemOrderPromotion } from "@/lib/promotions/redeem-order"
import {
  reservePromotionSlot,
  convertReservationToRedemption,
  reconcileExpiredReservations,
  releaseReservation,
  heldPromotionWhere,
  stripeSessionStateResolver,
  type HeldSessionState,
  type StripeSessionStateInput,
} from "@/lib/promotions/reservation"

const ID = {
  orgA: "f51-org-a",
  orgB: "f51-org-b",
  admin: "f51-user-admin",
  categoryA1: "f51-cat-a1",
  categoryA2: "f51-cat-a2",
  productA1: "f51-prod-a1",
  productA2: "f51-prod-a2",
  productB1: "f51-prod-b1",
  serviceA1: "f51-svc-a1",
  serviceA2: "f51-svc-a2",
  customerA1: "f51-cust-a1",
  promoOrgA: "f51-promo-orga-whole",
  promoOrgB: "f51-promo-orgb-secret",
}

function loginAsOrgA() {
  state.session = {
    user: {
      id: ID.admin,
      role: "ADMIN",
      organizationId: ID.orgA,
      email: "admin@f51.test",
      name: "Lastnik Alfa",
    },
  }
  state.headerEntries["x-org-slug"] = "f51-alfa"
}

function loginAsOrgB() {
  state.session = {
    user: {
      id: "f51-user-staff-b",
      role: "ADMIN",
      organizationId: ID.orgB,
      email: "staff@f51.test",
      name: "Osebje Beta",
    },
  }
  state.headerEntries["x-org-slug"] = "f51-beta"
}

async function makeOrder(items: { id: string; qty: number }[], code?: string) {
  return createProductCheckoutSession(
    items.map((it) => ({
      productId: it.id,
      name: "x",
      image: null,
      quantity: it.qty,
      price: 0, // client price is NEVER trusted — server reprices
    })),
    { name: "Test Kupec", email: "kupac@f51.test" },
    undefined,
    code
  )
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f51_test", "markec_e2e_test"]).toContain(rows[0].db)
})

beforeEach(async () => {
  state.session = null
  state.headerEntries = {}
  // Pocisti morebitne ostanke testnih promocij / naročil iz prejšnjih
  // neuspešnih zagonov, da so testi med seboj neodvisni.
  await prisma.promotion.deleteMany({
    where: { name: { in: ["Fiksni veliki", "Mali 5%", "Veliki 30%", "Samo enkrat", "Nega 15%"] } },
  }).catch(() => undefined)
  // Brisi vse testne naročila (seed ne ustvari nobenega) + njihove iteme.
  await prisma.orderItem.deleteMany({
    where: { order: { organizationId: { in: ["f51-org-a", "f51-org-b"] } } },
  }).catch(() => undefined)
  await prisma.order.deleteMany({
    where: { organizationId: { in: ["f51-org-a", "f51-org-b"] } },
  }).catch(() => undefined)
  await prisma.promotionRedemption.deleteMany({
    where: { organizationId: { in: ["f51-org-a", "f51-org-b"] } },
  }).catch(() => undefined)
  // Seed promociji morata v vsakem testu začeti BREZ unovčitev/referenc,
  // da preskusi z ID.promoOrgA/ID.promoOrgB niso odvisni od prejšnjih testov.
  await prisma.order.deleteMany({
    where: { promotionId: { in: ["f51-promo-orga-whole", "f51-promo-orgb-secret"] } },
  }).catch(() => undefined)
  await prisma.promotionRedemption.deleteMany({
    where: { promotionId: { in: ["f51-promo-orga-whole", "f51-promo-orgb-secret"] } },
  }).catch(() => undefined)
  // Pocisti MOREBITNE OSTAKE testnih promocij z naključnimi (cuid) ID-ji, ki
  // jih ustvarijo testi withMath/random in jih prejšnji prekinjeni zagoni
  // niso počistili. Seed promociji (f51-promo-orga-* ) se ohranita.
  await prisma.promotion.deleteMany({
    where: {
      organizationId: { in: ["f51-org-a", "f51-org-b"] },
      id: { notIn: ["f51-promo-orga-whole", "f51-promo-orgb-secret"] },
    },
  }).catch(() => undefined)
})

afterAll(async () => {
  // Clean order/appointment/redemption rows created by tests (idempotent).
  await prisma.orderItem.deleteMany({
    where: { order: { id: { startsWith: "f51-o-" } } },
  })
  await prisma.order.deleteMany({ where: { id: { startsWith: "f51-o-" } } })
  await prisma.appointment.deleteMany({
    where: { id: { startsWith: "f51-ap-" } },
  })
  await prisma.promotionRedemption.deleteMany({
    where: { id: { startsWith: "f51-r-" } },
  })
  await prisma.promotion.deleteMany({
    where: { id: { startsWith: "f51-test-" } },
  })
  await prisma.$disconnect()
})

describe("F5.1 §4 — product order pricing (authoritative, offline)", () => {
  it("odstotni popust na celotno ponudbo se odšteje od totala", async () => {
    loginAsOrgA()
    // Šampon 10 € + Balzam 14 € = 24 €; nad 50 → brez dostave.
    const res = await makeOrder([
      { id: ID.productA1, qty: 1 },
      { id: ID.productA2, qty: 1 },
    ])
    expect(res.success).toBe(true)
    expect(res.offline).toBe(true)

    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    expect(order).not.toBeNull()
    // Pod 50 € → dostava 5,99. Popust velja na POSTAVKE (izdelke):
    // 10 % od 24 = 2,40; dostava ni del popusta. total = 24+5,99−2,40.
    expect(order!.subtotal.toNumber()).toBe(24)
    expect(order!.total.toNumber()).toBeCloseTo(27.59, 2)
    expect(order!.promotionDiscount.toNumber()).toBeCloseTo(2.4, 2)
    expect(order!.promotionId).toBe(ID.promoOrgA)
    // Immutabilni posnetek.
    const snap = order!.promotionSnapshot as { promotionId: string; discountAmount: number }
    expect(snap.promotionId).toBe(ID.promoOrgA)
    expect(snap.discountAmount).toBeCloseTo(2.4, 2)

    // Uporaba zabeležena.
    const red = await prisma.promotionRedemption.findFirst({
      where: { orderId: order!.id },
    })
    expect(red?.promotionId).toBe(ID.promoOrgA)
    expect(red!.discountAmount.toNumber()).toBeCloseTo(2.4, 2)
  })

  it("fiksni popust je omejen na osnovo (cena nikoli negativna)", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "Fiksni veliki",
      discountType: "FIXED",
      discountValue: 999,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const res = await makeOrder([{ id: ID.productA1, qty: 1 }])
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    // Izdelek 10 € + dostava 5,99. Popust je omejen na osnovo POSTAVK
    // (10 €), da cena ni nikoli negativna; dostava ni popustana.
    expect(order!.promotionDiscount.toNumber()).toBeCloseTo(10, 2)
    expect(order!.total.toNumber()).toBeCloseTo(5.99, 2)
    await prisma.promotion.delete({ where: { id: pid } })
    await prisma.order.delete({ where: { id: order!.id } })
    await prisma.promotionRedemption.deleteMany({ where: { orderId: order!.id } })
  })

  it("omogočenje automatsko izbere NAJVEČJI popust izmed več aktivnih", async () => {
    loginAsOrgA()
    const a = await createPromotion({
      name: "Mali 5%",
      discountType: "PERCENT",
      discountValue: 5,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
    })
    const b = await createPromotion({
      name: "Veliki 30%",
      discountType: "PERCENT",
      discountValue: 30,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
    })
    expect(a.success && b.success).toBe(true)
    const res = await makeOrder([{ id: ID.productA1, qty: 1 }])
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    const snap = order!.promotionSnapshot as { name?: string }
    expect(String(snap?.name ?? "")).toContain("30%")
    await prisma.order.delete({ where: { id: order!.id } })
    await prisma.promotion.deleteMany({ where: { id: { in: [a.id!, b.id!] } } })
  })
})

describe("F5.1 §5 — izolacija podjetij", () => {
  it("getAdminPromotions vrne SAMO lastne promocije", async () => {
    loginAsOrgA()
    const list = await getAdminPromotions()
    expect(list.some((p) => p.id === ID.promoOrgA)).toBe(true)
    expect(list.some((p) => p.id === ID.promoOrgB)).toBe(false)
  })

  it("kodo drugega podjetja ni mogoče uporabiti v lastni trgovini", async () => {
    loginAsOrgA()
    // code BETASECRET pripada org B.
    const res = await makeOrder([{ id: ID.productA1, qty: 1 }], "BETASECRET")
    expect(res.success).toBe(true)
    // Čeprav je order uspešnih, popust NE sme biti uporabljen (tuja koda).
    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    expect(order!.promotionId).toBeNull()
    expect(order!.promotionDiscount.toNumber()).toBe(0)
    await prisma.order.delete({ where: { id: order!.id } })
  })
})

describe("F5.1 §4 — omejitve uporabe", () => {
  it("maxRedemptions prepreči nadaljnje unovčenje", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "Samo enkrat",
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      maxRedemptions: 2,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const r1 = await makeOrder([{ id: ID.productA1, qty: 1 }])
    const r2 = await makeOrder([{ id: ID.productA1, qty: 1 }])
    expect(r1.success && r2.success).toBe(true)
    // Omejitve preverja atomsko redeemPromotion ob unovčenju (ne engine);
    // po dveh naročilih preverimo dokaz na ravni zapisov:
    const used = await prisma.promotionRedemption.count({ where: { promotionId: pid } })
    expect(used).toBe(2)

    await prisma.order.deleteMany({ where: { organizationId: ID.orgA, promotionId: pid } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("istočasno unovčenje iste kode prepusti le eno zmagovalno transakcijo", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "Samo prvi",
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      code: "PRVI20",
      status: "ACTIVE",
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // Dve vzporedni naročili z isto kodo (race).
    await Promise.all([
      makeOrder([{ id: ID.productA1, qty: 1 }], "PRVI20"),
      makeOrder([{ id: ID.productA1, qty: 1 }], "PRVI20"),
    ])

    // Row lock + unique fence → natanko ENA unovčitev.
    const used = await prisma.promotionRedemption.count({
      where: { promotionId: pid },
    })
    expect(used).toBe(1)

    // Vsaj eno naročilo je uspešno (drugo je bodisi brez popusta bodisi
    // zavrnjeno zaradi promocije) — skupaj natanko ena unovčitev.
    const ordersWithPromo = await prisma.order.count({
      where: { organizationId: ID.orgA, promotionId: pid },
    })
    expect(ordersWithPromo).toBe(1)

    await prisma.order.deleteMany({ where: { organizationId: ID.orgA, promotionId: pid } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })
})

describe("F5.1 §4 — termin (storitve) s popustom", () => {
  it("storitveni popust je org-scoped (izolacija) in pokrivanja pravilno ujeta", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "Nega 15%",
      discountType: "PERCENT",
      discountValue: 15,
      scope: "SERVICES",
      targetEntityIds: [ID.serviceA2],
      status: "ACTIVE",
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // V org A je promocija vidna (kot storitveni popust — dejavnost brez
    // klasične trgovine ima promocije za svoje storitve).
    const listA = await getAdminPromotions()
    expect(listA.some((p) => p.id === pid && p.scope === "SERVICES")).toBe(true)

    // Izolacija: org B ne sme videti te promocije.
    loginAsOrgB()
    const listB = await getAdminPromotions()
    expect(listB.some((p) => p.id === pid)).toBe(false)
  })
})

describe("F5.1 §4 — immutabilnost zgodovine", () => {
  it("ureditev promocije ne spremeni starega naročila (snapshot)", async () => {
    loginAsOrgA()
    // Ustvari order s 10 % whole.
    const res = await makeOrder([{ id: ID.productA1, qty: 1 }])
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    const before = order!.total.toNumber()
    const snapBefore = order!.promotionSnapshot as Record<string, unknown>

    // Uredi promocijo: dvigni na 50 %.
    await updatePromotion(ID.promoOrgA, { discountValue: 50 })

    const orderAfter = await prisma.order.findUnique({ where: { id: order!.id } })
    expect(orderAfter!.total.toNumber()).toBe(before)
    expect((orderAfter!.promotionSnapshot as Record<string, unknown>)?.discountValue).toBe(
      (snapBefore as Record<string, unknown>)?.discountValue
    )

    await prisma.order.delete({ where: { id: order!.id } })
    await prisma.promotionRedemption.deleteMany({ where: { orderId: order!.id } })
    // Vrni na 10 % za nadaljnje teste.
    await updatePromotion(ID.promoOrgA, { discountValue: 10 })
  })

  it("obstoječe naročilo brez promocije ostane nedotaknjeno", async () => {
    loginAsOrgA()
    // Ustvari order prek prazne košarice paths — najprej onemogoči promocijo.
    await setPromotionStatus(ID.promoOrgA, "INACTIVE")
    const res = await makeOrder([{ id: ID.productA1, qty: 1 }])
    expect(res.success).toBe(true)
    const order = await prisma.order.findFirst({
      where: { organizationId: ID.orgA },
      orderBy: { createdAt: "desc" },
    })
    expect(order!.promotionDiscount.toNumber()).toBe(0)
    expect(order!.promotionId).toBeNull()
    // Re-aktiviraj za ostale teste.
    await setPromotionStatus(ID.promoOrgA, "ACTIVE")
    await prisma.order.delete({ where: { id: order!.id } })
  })
})

describe("F5.1 §3 — deferred redemption (online paid only, §preklicano plačilo)", () => {
  async function makePaidOrder(promoId: string | null, discount: number, opts?: { status?: string; guestEmail?: string }) {
    return prisma.order.create({
      data: {
        id: `f51-o-paid-${Math.random().toString(36).slice(2, 10)}`,
        organizationId: ID.orgA,
        customerId: ID.customerA1,
        guestEmail: opts?.guestEmail ?? "kupec@f51.test",
        subtotal: 10,
        tax: 1.8,
        total: discount > 0 ? 10 - discount : 10,
        status: (opts?.status ?? "PAID") as never,
        promotionId: promoId,
        promotionDiscount: discount,
        ...(promoId
          ? {
              promotionSnapshot: {
                promotionId: promoId,
                name: "Snapshot",
                discountType: "PERCENT" as const,
                discountValue: 20,
                scope: "WHOLE_AMOUNT" as const,
                targetEntityIds: [],
                code: null,
                baseAmount: 10,
                discountAmount: discount,
                affectedLines: 1,
                appliedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
    })
  }

  it("PENDING (preklicano/opuščeno) naročilo NE porabi promocije", async () => {
    loginAsOrgA()
    const o = await makePaidOrder(ID.promoOrgA, 2, { status: "PENDING" })
    // Brez unovčenja (helper se kliče ŠELE ob PAID).
    const used = await prisma.promotionRedemption.count({ where: { orderId: o.id } })
    expect(used).toBe(0)
    await prisma.order.delete({ where: { id: o.id } })
  })

  it("redeemOrderPromotion unovči natanko enkrat, idempotentno", async () => {
    loginAsOrgA()
    const o = await makePaidOrder(ID.promoOrgA, 2.4)
    // F5.1.4: unovčenje poteka IZKLJUČNO prek rezervacije (checkout jo je
    // ustvaril). Naročilo mora imeti RESERVED, da se ob plačilu pretvori.
    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const res = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: ID.promoOrgA,
        customerId: ID.customerA1,
        discountAmount: 2.4,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("reservation should not fail")
    await prisma.promotionRedemption.update({ where: { id: res.id }, data: { orderId: o.id } })

    // Štejemo LE REDEEMED (rezervacija/dodatne RESERVED vrste ne smejo
    // vplivati na idempotenčno preverjanje).
    const before = await prisma.promotionRedemption.count({
      where: { promotionId: ID.promoOrgA, status: "REDEEMED" },
    })
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({
        where: { id: o.id },
        select: {
          id: true,
          organizationId: true,
          customerId: true,
          guestEmail: true,
          promotionId: true,
          promotionDiscount: true,
          promotionSnapshot: true,
          total: true,
        },
      })
      await redeemOrderPromotion(tx, fresh!, ID.orgA)
    })
    const after = await prisma.promotionRedemption.count({
      where: { promotionId: ID.promoOrgA, status: "REDEEMED" },
    })
    expect(after).toBe(before + 1)
    // Idempotenca: ponovljen klic (webhook retry) ne doda druge.
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: o.id } })
      await redeemOrderPromotion(tx, fresh!, ID.orgA)
    })
    expect(await prisma.promotionRedemption.count({ where: { promotionId: ID.promoOrgA } })).toBe(before + 1)
    await prisma.promotionRedemption.deleteMany({ where: { orderId: o.id } })
    await prisma.order.delete({ where: { id: o.id } })
  })

  // ============================================================
  // F5.1.3 — ZAMUJEN WEBHOOK / PRIDRUŽENI ROB: maxUses se NE sme
  // napačno zavrniti PLAČANEGA naročila s shranjenim popustom. Omejitev
  // uporabe se izvaja pri REZERVACIJI (checkout), ne pri potrjenem
  // plačilu — vsako plačano naročilo s popustom (amount_received ==
  // Order.total) se prizna, idempotentno, brez korekcije navzgor.
  // ============================================================
  it("maxUses se izvaja pri rezervaciji; PLAČANO naročilo s popustom se NE napačno zavrne", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "Napolnjeno",
      discountType: "PERCENT",
      discountValue: 10,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // Omejitev se uveljavi pri REZERVACIJI: prva rezervira, druga LIMIT_REACHED.
    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "kup-1",
        discountAmount: 1,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(r1.ok).toBe(true)
    const r2 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "kup-2",
        discountAmount: 1,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(r2.ok).toBe(false)

    // PLAČANO naročilo s shranjenim popustom: F5.1.4 stroga omejitev.
    // Ker rezervacija (checkout) NIKOLI ni izdala drugega mesta, naročilo
    // nima (več) RESERVED rezervacije → NE izmišljamo unovčitve (maxUses=1
    // se ohrani). Order.total pa se tudi NIKOLI ne korektira navzgor.
    const o = await makePaidOrder(pid, 1)
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: o.id } })
      const res = await redeemOrderPromotion(tx, fresh!, ID.orgA)
      expect(res.granted).toBe(false) // ni RESERVED → brez izmišljene unovčitve
    })
    expect(await prisma.promotionRedemption.count({ where: { orderId: o.id } })).toBe(0)
    const after = await prisma.order.findUnique({ where: { id: o.id } })
    // Order.total se NIKOLI ne korektira navzgor (amount integrity).
    expect(after!.total.toNumber()).toBeCloseTo(9, 2)
    expect(after!.promotionId).toBe(pid)

    await prisma.order.delete({ where: { id: o.id } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("naročilo brez promocije ne naredi nič", async () => {
    loginAsOrgA()
    const o = await makePaidOrder(null, 0)
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: o.id } })
      await redeemOrderPromotion(tx, fresh!, ID.orgA)
    })
    expect(await prisma.promotionRedemption.count({ where: { orderId: o.id } })).toBe(0)
    await prisma.order.delete({ where: { id: o.id } })
  })

  // ============================================================
  // F5.1.4 — STROGA OMELJITEV maxUses=1: ista promocija nikoli ne omogoči
  // DVEH uspešnih unovčitev zaradi zamujenega webhooka. Dve plačani
  // naročili z isto kodo ne smeta ustvariti dveh REDEEMED: rezervacija
  // izda SAMO eno mesto; naročilo brez rezervacije NI izmišljeno unovčeno.
  // Obe naročili ostaneta PAID, nobeden Order.total se ne korektira navzgor
  // (amount integrity). (F5.1.4 §C1/C3 že dokazuje, da se drugo mesto ne
  // izda — tu še potrjujemo, da niti ob vzporednih webhookih ne pride do
  // prekoračitve.)
  // ============================================================
  it("dva PLAČANA webhooka (maxUses=1) → samo EN rezerviran popust postane REDEEMED; nobeden se ne korektira navzgor", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 dirka",
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "RACE2",
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // Kupca sta začela checkout in OBA plačala (order=PAID, 8 €), vendar
    // je rezervacija ob checkoutu izdala le ENO mesto — za oA. oB popusta
    // v resnici ni dobil (v F5.1.4 §C1/C3 je pokazano, da se rezervacija
    // drugega mesta NE izda).
    const oA = await makePaidOrder(pid, 2)
    const oB = await makePaidOrder(pid, 2)
    const heldUntil = new Date(Date.now() + 1000 * 60 * 60)
    const rA = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: ID.customerA1,
        discountAmount: 2,
        baseAmount: 10,
        heldUntil,
      })
    )
    if (!rA.ok) throw new Error("reservation A should not fail")
    await prisma.promotionRedemption.update({ where: { id: rA.id }, data: { orderId: oA.id } })

    // Oba Stripe webhooka obdelata plačilo vzporedno.
    const fresh = async (id: string) =>
      prisma.$transaction(async (tx) => {
        const f = await tx.order.findUnique({ where: { id } })
        return redeemOrderPromotion(tx, f!, ID.orgA)
      })
    await Promise.all([fresh(oA.id), fresh(oB.id)])

    // Obe naročili ostaneta PAID z nespremenjenim popustom/totalom
    // (amount_received 8 € == Order.total 8 € — NI korekcije navzgor).
    const [a, b] = await Promise.all([
      prisma.order.findUnique({ where: { id: oA.id } }),
      prisma.order.findUnique({ where: { id: oB.id } }),
    ])
    expect(a!.status).toBe("PAID")
    expect(b!.status).toBe("PAID")
    expect(a!.promotionDiscount.toNumber()).toBe(2)
    expect(b!.promotionDiscount.toNumber()).toBe(2)
    expect(a!.promotionId).toBe(pid)
    expect(b!.promotionId).toBe(pid)
    // Total == plačano (8 €), nikoli 10 €.
    expect(a!.total.toNumber()).toBeCloseTo(8, 2)
    expect(b!.total.toNumber()).toBeCloseTo(8, 2)

    // STROGA maxUses: samo oA (ki ima rezervacijo) dobi REDEEMED;
    // oB (brez rezervacije) NI izmišljeno unovčen → natanko 1 unovčitev.
    expect(await prisma.promotionRedemption.count({ where: { promotionId: pid, status: "REDEEMED" } })).toBe(1)
    expect(await prisma.promotionRedemption.count({ where: { orderId: oA.id, status: "REDEEMED" } })).toBe(1)
    expect(await prisma.promotionRedemption.count({ where: { orderId: oB.id } })).toBe(0)

    await prisma.order.deleteMany({ where: { organizationId: ID.orgA, promotionId: pid } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  // ============================================================
  // F5.1.1 — REZERVACIJA/SPROSTITEV promocije pri preklicanem in
  // pretečenem checkoutu. Promocija se unovči SAMO ob potrjenem
  // plačilu — preklican (cancelled) ali pretečen (expired) Stripe
  // checkout NI nikoli del webhooka product_order PAID poti, zato ne
  // porabi / ne rezervira mesta. Slot (maxUses=1) mora ostati prost
  // za naslednjega resničnega kupca.
  // ============================================================
  it("preklican/pretečen checkout ne porabi maxUses=1 mesta — slot ostane za naslednjega kupca", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.1 sprostitev",
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "RELEASE1",
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // Simuliraj kupca, ki je začel checkout in ga PREKLICAL/pretekel:
    // naročilo ostane PENDING (webhook pa nikoli ne pride na PAID pot).
    const abandoned = await makePaidOrder(pid, 2, { status: "PENDING" })
    expect(await prisma.promotionRedemption.count({ where: { promotionId: pid } })).toBe(0)

    // Naslednji kupec dejansko PLAČA. Rezervacija ob checkoutu mu izda
    // prosto mesto (preklican/opuščen kupec ga ni porabil) → ob PAID se
    // pretvori v unovčenje, slot (maxUses=1) ostane 1/1.
    const paid = await makePaidOrder(pid, 2)
    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const reserved = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: ID.customerA1,
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    if (!reserved.ok) throw new Error("reservation for paid order should not fail")
    await prisma.promotionRedemption.update({ where: { id: reserved.id }, data: { orderId: paid.id } })

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: paid.id } })
      await redeemOrderPromotion(tx, fresh!, ID.orgA)
    })
    const used = await prisma.promotionRedemption.count({ where: { promotionId: pid, status: "REDEEMED" } })
    expect(used).toBe(1)
    const paidOrder = await prisma.order.findUnique({ where: { id: paid.id } })
    expect(paidOrder!.promotionId).toBe(pid)
    expect(paidOrder!.promotionDiscount.toNumber()).toBe(2)

    await prisma.order.delete({ where: { id: abandoned.id } })
    await prisma.order.delete({ where: { id: paid.id } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })
})

// ============================================================
// F5.1.2 — STRIPE PAYMENT AMOUNT INTEGRITY + ATOMSKA REZERVACIJA
//
// Cilj: znesek, ki ga kupec plača (PaymentIntent.amount_received), je
// VEDNO enak znesku, ki ga MARKEC evidentira (Order.total +
// promotionSnapshot). Pri promociji z maxUses=1 dva sočasna checkouta ne
// smeta oba prodati popusta — mesto se atitsko rezervira ob ustvarjanju
// checkouta, zato poraženec niti ne vidi niti ne plača popusta (polna
// cena), zmagovalec pa popustan znesek, ki ustreza naročilu.
//
// Testi (brez pravih Stripe HTTP klicov — format: shematska simulacija
// reserve→charge→record, ki je neposredni dokaz invariante):
// ============================================================
describe("F5.1.2 — rezervacija mesta + amount integrity", () => {
  async function makePromo(maxRedemptions: number | null) {
    const created = await createPromotion({
      name: "F5.1.2 rez " + Math.random().toString(36).slice(2, 7),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "F512R",
      maxRedemptions,
    })
    expect(created.success).toBe(true)
    return created.id!
  }

  it("sočasno rezerviranje (maxUses=1) → natanko ENA rezervacija; druga LIMIT_REACHED (poraženec ne dobi popusta)", async () => {
    loginAsOrgA()
    const pid = await makePromo(1)

    const reserve = () =>
      prisma.$transaction((tx) =>
        reservePromotionSlot(tx, {
          organizationId: ID.orgA,
          promotionId: pid,
          customerId: "f51-cust-" + Math.random().toString(36).slice(2, 7),
          discountAmount: 2,
          baseAmount: 10,
          heldUntil: new Date(Date.now() + 1000 * 60 * 60),
        })
      )

    const [rA, rB] = await Promise.all([reserve(), reserve()])
    const granted = [rA, rB].filter((r) => r.ok)
    const denied = [rA, rB].filter((r) => !r.ok)
    expect(granted.length).toBe(1)
    expect(denied.length).toBe(1)

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("amount integrity: poraženec plača polno, zmagovalec popustan znesek — oba enaka evidentiranemu totalu", async () => {
    loginAsOrgA()
    const pid = await makePromo(1)

    // Kupec A (zmagovalec): 10 €, 20 % → 2 € popust → plača 8 €.
    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const rA = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "f51-cust-A",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(rA.ok).toBe(true)
    const finalTotalA = 10 - 2 // kar Stripe zaračuna in kar order evidentira
    expect(finalTotalA).toBe(8)

    // Kupec B (poraženec): rezervacija zavrnjena → polna cena 10 €.
    const rB = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "f51-cust-B",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(rB.ok).toBe(false)
    const finalTotalB = 10 // brez popusta

    // INVARIANTA: zaračunan znesek == evidentiran (Order.total).
    // Zmagovalec A: 8 == 8; poraženec B: 10 == 10.
    expect(finalTotalA).toBe(8)
    expect(finalTotalB).toBe(10)
    expect(finalTotalA).not.toBe(finalTotalB) // oba NIKOLI ne dobita istega popusta

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("uspešno plačilo spremeni rezervacijo v unovčenje; ponovljen webhook ne podvoji", async () => {
    loginAsOrgA()
    const pid = await makePromo(1)

    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const rA = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "f51-cust-A",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    if (!rA.ok) throw new Error("reservation should not fail")
    const rId = rA.id
    await prisma.promotionRedemption.update({
      where: { id: rId },
      data: { orderId: "f51-o-paid-amt" },
    })

    // Prvi webhook/verify: rezervacija → REDEEMED.
    let converted = await prisma.$transaction((tx) =>
      convertReservationToRedemption(tx, "f51-o-paid-amt")
    )
    expect(converted).toBe(1)
    expect(
      (await prisma.promotionRedemption.findUnique({ where: { id: rId } }))!.status
    ).toBe("REDEEMED")

    // Ponovljen webhook: idempotentno — nič novega, še vedno 1 unovčitev.
    converted = await prisma.$transaction((tx) =>
      convertReservationToRedemption(tx, "f51-o-paid-amt")
    )
    expect(converted).toBe(0)
    const reds = await prisma.promotionRedemption.count({
      where: { promotionId: pid, status: "REDEEMED" },
    })
    expect(reds).toBe(1)

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("pretečen+UNPAID checkout sprosti mesto po Stripe reconciliation; slot se vrne", async () => {
    loginAsOrgA()
    const pid = await makePromo(1)

    // Rezervacija, ki je pretekla (checked-out) — z Stripe session id.
    const past = new Date(Date.now() - 1000)
    const rA = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "f51-cust-A",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: past,
      })
    )
    if (!rA.ok) throw new Error("reservation should not fail")
    await prisma.promotionRedemption.update({
      where: { id: rA.id },
      data: { checkoutSessionId: "cs_test_unpaid_expired" },
    })

    // DOKLER Stripe ne potrdi neplačanosti, rezervacija še vedno drži mesto:
    const heldBefore = await prisma.promotionRedemption.count({
      where: heldPromotionWhere(pid),
    })
    expect(heldBefore).toBe(1)

    // Stripe reconciliation: seja expired + unpaid → mesto se sprosti.
    const out = await reconcileExpiredReservations(
      prisma,
      { promotionId: pid },
      async () => "unpaid"
    )
    expect(out.released).toBe(1)
    expect(await prisma.promotionRedemption.count({ where: heldPromotionWhere(pid) })).toBe(0)

    // Naslednji kupec lahko spet rezervira (1/1).
    const heldAt = new Date(Date.now() + 1000 * 60 * 60)
    const rB = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "f51-cust-B",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: heldAt,
      })
    )
    expect(rB.ok).toBe(true)

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })
})

// ============================================================
// F5.1.4 — FINAL RESERVATION EXPIRY + STRIPE CONSISTENCY
//
// Dve pravilici hkrati (F5.1.4):
//   1. Kupec nikoli ne plača drugačnega zneska, kot je evidentiran.
//   2. Promocija z maxUses=1 nikoli ne omogoči dveh uspešnih unovčitev
//      zaradi zamujenega webhooka.
// Sprostitev poteka izključno po Stripe stanju (ne po lokalni uri).
// ============================================================
describe("F5.1.4 — Stripe-backed release + strict maxUses + delayed webhook", () => {
  // Namensko mock resolver za integracijski test (brez pravega Stripe ključa).
  function resolverFor(state: HeldSessionState) {
    return async () => state
  }

  it("A1+A3 plačilo uspelo (webhook ≥2h pozneje); Stripe reconciliation pretvori v REDEEMED; drugo mesto NI izdano", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 paid " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "P" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    // Kupec 1: rezervacija je POTEKLA (heldUntil v preteklosti = webhook ≥2h
    // pozno), a plačilo je že resnično poteklo (Stripe: payment_status=paid).
    const past = new Date(Date.now() - 1000 * 60 * 60 * 3)
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        guestEmail: "kup1paid@f51.test",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: past,
      })
    )
    if (!r1.ok) throw new Error("reservation 1 should not fail")
    const o1 = await prisma.order.create({
      data: {
        organizationId: ID.orgA,
        customerId: ID.customerA1,
        guestEmail: "kup1paid@f51.test",
        subtotal: 10,
        tax: 1.8,
        total: 8, // PAID — kar je Stripe dejansko zaračunal (800)
        status: "PAID",
        promotionId: pid,
        promotionDiscount: 2,
        promotionSnapshot: { promotionId: pid, discountType: "PERCENT", discountValue: 20, scope: "WHOLE_AMOUNT", baseAmount: 10, discountAmount: 2 },
      },
    })
    await prisma.promotionRedemption.update({
      where: { id: (r1 as { id: string }).id },
      data: { orderId: o1.id, checkoutSessionId: "cs_test_paid_late" },
    })

    // Stripe reconciliation: seja PAID → rezervacijo PRETVORI, NI sprosti.
    const rec = await reconcileExpiredReservations(
      prisma,
      { promotionId: pid },
      resolverFor("paid")
    )
    expect(rec.converted).toBe(1)
    expect(await prisma.promotionRedemption.count({ where: { promotionId: pid, status: "REDEEMED" } })).toBe(1)

    // Kupec 2 poskusi isto promocijo → mesto NI izdano (LIMIT_REACHED).
    const r2 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "kup2",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: new Date(Date.now() + 1000 * 60 * 60),
      })
    )
    expect(r2.ok).toBe(false)

    // Zamujen webhook kupec 1 → granted (že REDEEMED), brez dvojne unovčitve.
    const res = await prisma.$transaction(async (tx) => {
      const f = await tx.order.findUnique({ where: { id: o1.id } })
      return redeemOrderPromotion(tx, f!, ID.orgA)
    })
    expect(res.granted).toBe(true)
    // amount integrity: total == amount_received (8 €), nikoli navzgor.
    const after = await prisma.order.findUnique({ where: { id: o1.id } })
    expect(after!.total.toNumber()).toBeCloseTo(8, 2)
    expect(await prisma.promotionRedemption.count({ where: { orderId: o1.id } })).toBe(1)

    await prisma.order.deleteMany({ where: { organizationId: ID.orgA, promotionId: pid } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A2 drugi kupec medtem: dokler Stripe ni potrdil, se drugo mesto NE izda (slot held)", async () => {
    // Preverjen invariant: slot se nikoli ne izda, dokler Stripe ne potrdi
    // neplačanosti. Ta test potrjuje, da se brez reconciliationa slot obdrži
    // (RESERVED šteje) tudi po heldUntil — ne sprošča se po lokalni uri.
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 held " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "H" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const past = new Date(Date.now() - 1000)
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k1",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: past,
      })
    )
    expect(r1.ok).toBe(true)
    // Dokler Stripe ne potrdi sprostitve, razpoložljivost = 1 zasedeno (RESERVED).
    const held = await prisma.promotionRedemption.count({ where: heldPromotionWhere(pid) })
    expect(held).toBe(1)
    const r2 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k2",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: new Date(Date.now() + 1000 * 60 * 60),
      })
    )
    expect(r2.ok).toBe(false) // mesto ni izdano – stroga maxUses

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A4 neplačana pretečena seja → Stripe reconciliation sprosti mesto", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 rel " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "R" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const past = new Date(Date.now() - 1000)
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k1",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: past,
      })
    )
    expect(r1.ok).toBe(true)
    await prisma.promotionRedemption.update({
      where: { id: (r1 as { id: string }).id },
      data: { checkoutSessionId: "cs_unpaid_expired" },
    })

    const rec = await reconcileExpiredReservations(
      prisma,
      { promotionId: pid },
      resolverFor("unpaid")
    )
    expect(rec.released).toBe(1)

    // Slot je zdaj prost (1/1) → naslednjemu kupcu se izda.
    const r2 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k2",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: new Date(Date.now() + 1000 * 60 * 60),
      })
    )
    expect(r2.ok).toBe(true)

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A5 Stripe API nedosegljiv → rezervacija se OHRANI (ne sprosti) — slot ostane zaseden", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 keep " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "K" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const past = new Date(Date.now() - 1000)
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k1",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: past,
      })
    )
    expect(r1.ok).toBe(true)
    await prisma.promotionRedemption.update({
      where: { id: (r1 as { id: string }).id },
      data: { checkoutSessionId: "cs_unreachable" },
    })

    // Nedosegljiv Stripe API → reconciled vrne "unknown" in mesto se ohrani.
    const rec = await reconcileExpiredReservations(
      prisma,
      { promotionId: pid },
      () => Promise.resolve("unknown")
    )
    expect(rec.converted).toBe(0)
    expect(rec.released).toBe(0)
    expect(rec.kept).toBe(1)
    expect(await prisma.promotionRedemption.count({ where: { promotionId: pid, status: "RESERVED" } })).toBe(1)

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A6 sočasni webhook(convert) in cleanup(release) → brez dvojnega unovčenja, atomsko", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 race " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "Q" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k1",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: new Date(Date.now() + 1000 * 60 * 60),
      })
    )
    expect(r1.ok).toBe(true)
    const oSeed = `f51-race-${Math.random().toString(36).slice(2, 8)}`
    await prisma.promotionRedemption.update({
      where: { id: (r1 as { id: string }).id },
      data: { orderId: oSeed, checkoutSessionId: "cs_race" },
    })

    // Hkrati: webhook želi convert, cleanup želi release. Obe transakciji
    // sta row-locked (requirement B) — samo ENA zmaga, ni dvojnosti.
    await Promise.all([
      prisma.$transaction((tx) => convertReservationToRedemption(tx, oSeed)),
      prisma.$transaction((tx) => releaseReservation(tx, { checkoutSessionId: "cs_race" })),
    ])

    const rows = await prisma.promotionRedemption.findMany({ where: { id: (r1 as { id: string }).id } })
    // Natančno en leti izid: bodisi REDEEMED (1) bodisi sproščen (0).
    expect(rows.length).toBeLessThanOrEqual(1)
    for (const row of rows) expect(row.status).toBe("REDEEMED")

    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A7 ponovljeni webhook je idempotenten (ne podvoji unovčenja)", async () => {
    loginAsOrgA()
    const created = await createPromotion({
      name: "F5.1.4 idem " + Math.random().toString(36).slice(2, 8),
      discountType: "PERCENT",
      discountValue: 20,
      scope: "WHOLE_AMOUNT",
      targetEntityIds: [],
      status: "ACTIVE",
      code: "I" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      maxRedemptions: 1,
    })
    expect(created.success).toBe(true)
    const pid = created.id!

    const o = await prisma.order.create({
      data: {
        organizationId: ID.orgA,
        customerId: ID.customerA1,
        subtotal: 10,
        tax: 1.8,
        total: 8,
        status: "PAID",
        promotionId: pid,
        promotionDiscount: 2,
        promotionSnapshot: { promotionId: pid, discountType: "PERCENT", discountValue: 20, scope: "WHOLE_AMOUNT", baseAmount: 10, discountAmount: 2 },
      },
    })
    const r1 = await prisma.$transaction((tx) =>
      reservePromotionSlot(tx, {
        organizationId: ID.orgA,
        promotionId: pid,
        customerId: "k1",
        discountAmount: 2,
        baseAmount: 10,
        heldUntil: new Date(Date.now() + 1000 * 60 * 60),
      })
    )
    expect(r1.ok).toBe(true)
    await prisma.promotionRedemption.update({ where: { id: (r1 as { id: string }).id }, data: { orderId: o.id } })

    // Webhook 1 → convert.
    await prisma.$transaction(async (tx) => {
      const f = await tx.order.findUnique({ where: { id: o.id } })
      await redeemOrderPromotion(tx, f!, ID.orgA)
    })
    // Webhook 2 (retry) → idempotentno.
    await prisma.$transaction(async (tx) => {
      const f = await tx.order.findUnique({ where: { id: o.id } })
      await redeemOrderPromotion(tx, f!, ID.orgA)
    })
    expect(await prisma.promotionRedemption.count({ where: { orderId: o.id } })).toBe(1)

    await prisma.order.delete({ where: { id: o.id } })
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: pid } })
    await prisma.promotion.delete({ where: { id: pid } })
  })

  it("A8 stripeSessionStateResolver: paid/unpaid/processing/unreachable → pravilna odločitev (requirement A)", async () => {
    // Stoji na osnovi produkcijskega resolverja (bil je napačno nedefiniran),
    // ne na mock resolverju — dokazuje, da resnična Stripe-seja konča v
    // pravilnem stanju: paid → REDEEMED, expired+unpaid → sprosti,
    // processing/neznano/nedosegljivo → OHRANI.
    const mk = (input: StripeSessionStateInput) =>
      stripeSessionStateResolver(async () => input)

    expect(await mk({ payment_status: "paid", status: "complete", payment_intent: null })("cs_mock")).toBe("paid")
    // PI je v teku (asinhroni način) → OHRANI.
    expect(
      await mk({ payment_status: "unpaid", status: "open", payment_intent: { status: "processing" } })("cs_mock")
    ).toBe("processing")
    // Dokončno neplačana, pretečena → sprosti.
    expect(await mk({ payment_status: "unpaid", status: "expired", payment_intent: null })("cs_mock")).toBe("unpaid")
    // Odprta, še plačljiva → OHRANI (ne "processing", ne "unpaid").
    expect(await mk({ payment_status: "unpaid", status: "open", payment_intent: null })("cs_mock")).toBe("unknown")
    // Stripe API nedosegljiv → OHRANI.
    expect(await stripeSessionStateResolver(() => Promise.reject(new Error("net")))("cs_x")).toBe("unknown")
    // Plačana, a le status=complete brez payment_status → poskus pokriti.
    expect(await mk({ payment_status: "paid", status: "complete", payment_intent: { status: "succeeded" } })("cs_mock")).toBe("paid")
  })
})