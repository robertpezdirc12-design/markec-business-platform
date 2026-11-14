// ============================================================
// TOČKA 8 — GDPR: pravica do izvoza (Art. 20) in izbrisa (Art. 17).
//
// Pokrije:
//  1. exportMyData brez prijave → zavrnjen.
//  2. exportMyData prijavljen → strukturiran JSON (user, customer,
//     appointments, orders, reviews) z resničnimi podatki seeda.
//  3. deleteMyAccount z NAPAČNIM geslom → zavrnjen, račun ostane.
//  4. deleteMyAccount s pravim geslom → success; User izbrisan;
//     Customer ANONIMIZIRAN (ime, email, telefon, DOB, povezava);
//     poslovne evidence (termin, naročilo) OSTANEJO — davčna/računska
//     hramba, kot je dokumentirano v akciji.
//
// Izolirana DB (markec_e2e_test, Docker port 5433):
//   node scripts/run-with-test-db.mjs vitest run --config vitest.itest.config.ts \
//     tests/integration/gdpr-account.itest.ts
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user?: unknown } }))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))
vi.mock("next/server", () => ({ after: (fn: () => unknown) => Promise.resolve(undefined) }))

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { exportMyData, deleteMyAccount } from "@/app/actions/account"

const RUN = Date.now().toString(36).slice(-6)
const EMAIL = `t8.gdpr.${RUN}@markec.test`
const PASS = "Gdpr_izbris_2026!"

let orgId: string
let userId: string
let customerId: string
let orderId: string
let appointmentId: string
let reviewId: string

describe("T8 — GDPR izvoz in izbris računa (Art. 20 / Art. 17)", () => {
  beforeAll(async () => {
    state.session = null

    const passwordHash = await bcrypt.hash(PASS, 10)
    const org = await prisma.organization.create({
      data: { name: `GDPR Test Org ${RUN}`, slug: `gdpr-test-${RUN}` },
    })
    orgId = org.id
    const user = await prisma.user.create({
      data: {
        name: "Janez GDPR",
        email: EMAIL,
        password: passwordHash,
        emailVerified: new Date(),
      },
    })
    userId = user.id
    const customer = await prisma.customer.create({
      data: {
        name: "Janez Testnež",
        email: EMAIL,
        phone: "040 123 456",
        notes: "Testna stranka",
        dateOfBirth: new Date("1990-05-15"),
        userId: user.id,
        organizationId: orgId,
      },
    })
    customerId = customer.id

    const staffUser = await prisma.user.create({
      data: {
        name: "Staff GDPR",
        email: `t8.staff.${RUN}@markec.test`,
        emailVerified: new Date(),
      },
    })
    const staff = await prisma.staff.create({
      data: { name: "Test Staff", userId: staffUser.id, organizationId: orgId },
    })

    const appt = await prisma.appointment.create({
      data: {
        customerId,
        organizationId: orgId,
        staffId: staff.id,
        startTime: new Date("2026-11-20T10:00:00Z"),
        endTime: new Date("2026-11-20T11:00:00Z"),
        status: "CONFIRMED",
        depositPaid: true,
        depositAmount: 10,
        totalPrice: 25.5,
      },
    })
    appointmentId = appt.id

    const order = await prisma.order.create({
      data: {
        customerId,
        organizationId: orgId,
        subtotal: 42.5,
        total: 42.5,
        status: "COMPLETED",
      },
    })
    orderId = order.id

    const review = await prisma.review.create({
      data: {
        comment: "Odlična storitev",
        rating: 5,
        organizationId: orgId,
        userId: user.id,
      },
    })
    reviewId = review.id
  })

  afterAll(async () => {
    // Počisti vse testne zapise (User je morda že izbrisan — cascade na review).
    await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => undefined)
    await prisma.appointment.deleteMany({ where: { id: appointmentId } }).catch(() => undefined)
    await prisma.review.deleteMany({ where: { id: reviewId } }).catch(() => undefined)
    await prisma.customer.deleteMany({ where: { id: customerId } }).catch(() => undefined)
    await prisma.staff.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, `t8.staff.${RUN}@markec.test`] } } }).catch(() => undefined)
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => undefined)
  })

  it("1. izvoz brez prijave → zavrnjen", async () => {
    state.session = null
    const res = await exportMyData()
    expect(res).toMatchObject({ success: false })
  })

  it("2. izvoz prijavljenega → strukturiran JSON z vsemi osebnimi podatki seeda", async () => {
    state.session = { user: { id: userId } }
    const res = await exportMyData()
    if (!("generatedAt" in res)) throw new Error(JSON.stringify(res))

    expect(res.user.email).toBe(EMAIL)
    expect(res.user.name).toBe("Janez GDPR")
    expect(res.customer?.phone).toBe("040 123 456")
    expect(res.customer?.dateOfBirth).toBe("1990-05-15T00:00:00.000Z")
    expect(res.appointments).toHaveLength(1)
    expect(res.appointments[0].status).toBe("CONFIRMED")
    expect(res.orders).toHaveLength(1)
    expect(res.orders[0].totalCents).toBe(4250)
    expect(res.orders[0].status).toBe("COMPLETED")
    expect(res.reviews).toHaveLength(1)
    expect(res.reviews[0].rating).toBe(5)
  })

  it("3. izbris z napačnim geslom → zavrnjen, račun ostane", async () => {
    state.session = { user: { id: userId } }
    const res = await deleteMyAccount("NapačnoGeslo123!")
    expect(res).toMatchObject({ success: false, error: "Geslo ni pravilno." })

    const stillThere = await prisma.user.findUnique({ where: { id: userId } })
    expect(stillThere).not.toBeNull()
  })

  it("4. izbris s pravim geslom → User izbrisan, Customer anonimiziran, evidence ostanejo", async () => {
    state.session = { user: { id: userId } }
    const res = await deleteMyAccount(PASS)
    expect(res).toMatchObject({ success: true })

    // Pravica do pozabe: prijavni račun izginil.
    const userGone = await prisma.user.findUnique({ where: { id: userId } })
    expect(userGone).toBeNull()

    // Anonimizacija stranke: osebni podatki očiščeni, povezava prekinjena.
    const anon = await prisma.customer.findUnique({ where: { id: customerId } })
    expect(anon?.name).toBe("Anonimiziran")
    expect(anon?.email).toBeNull()
    expect(anon?.phone).toBeNull()
    expect(anon?.notes).toBeNull()
    expect(anon?.dateOfBirth).toBeNull()
    expect(anon?.userId).toBeNull()
    expect(anon?.tags).toEqual([])

    // Poslovne evidence OSTANEJO (davčna/računska hramba) — brez osebnih podatkov.
    const orderKept = await prisma.order.findUnique({ where: { id: orderId } })
    expect(orderKept).not.toBeNull()
    const apptKept = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    expect(apptKept).not.toBeNull()
  })

  it("5. po izbrisu izvoz ni več mogoč (račun ne obstaja)", async () => {
    state.session = { user: { id: userId } }
    const res = await exportMyData()
    expect(res).toMatchObject({ success: false })
  })
})
