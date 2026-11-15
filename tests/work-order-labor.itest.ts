// ============================================================
// WORK ORDER LABOR — delovni čas na delovnem nalogu (itest).
//
// Poganja se samo ROČNO proti izolirani testni bazi markec_e2e_test
// (localhost:5433), nikoli skozi `npm test`. Labor se hrani kot
// ExtensionRecord (entityKey "work_order_labor") s snake_case JSON:
//   work_order_id, work_order_number, work_order_title, staff_id,
//   staff_name, performed_by, hours, hourly_rate, total_cost,
//   description, work_date.
//
// Pokriva: dodajanje, posodabljanje, brisanje, seštevek (skupaj ur in
// stroškov), WorkOrderEvent na spremembo, org izolacijo in varnost
// (premalo dovoljenj → UnauthorizedError).
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
  addLaborEntry,
  updateLaborEntry,
  deleteLaborEntry,
  getWorkOrderLabor,
  listAllLaborEntries,
  type LaborEntry,
} from "@/app/actions/work-order-labor"
import { UnauthorizedError } from "@/lib/auth/guards"

const RUN = "wol_" + Date.now().toString(36)
let orgA: string
let orgB: string
let ownerId: string // ADMIN v orgA (polna dovoljenja)
let staffUserKid: string // user za Staff zaposlenega
let staffId: string
let restrictedAdminId: string // ADMIN s custom rolo, ki NIMA workorders.manage
let woA: string // delovni nalog v orgA
let woB: string // delovni nalog v orgB

const LABOR_KEY = "work_order_labor"

beforeAll(async () => {
  orgA = (
    await prisma.organization.create({
      data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "generic", publishState: "DRAFT" },
    })
  ).id
  orgB = (
    await prisma.organization.create({
      data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" },
    })
  ).id

  const owner = await prisma.user.create({
    data: { email: `${RUN}@markec.test`, name: "Lastnik", role: "ADMIN", organizationId: orgA, password: "x", emailVerified: new Date() },
  })
  ownerId = owner.id
  await prisma.organizationMember.create({ data: { organizationId: orgA, userId: owner.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: owner.id, role: "ADMIN", email: owner.email } }

  // Zaposleni (Staff) za preverjanje staff_name razrešitve.
  const staffUser = await prisma.user.create({
    data: { email: `${RUN}.staff@markec.test`, name: "Zaposlena", role: "STAFF", organizationId: orgA, password: "x", emailVerified: new Date() },
  })
  staffUserKid = staffUser.id
  await prisma.organizationMember.create({ data: { organizationId: orgA, userId: staffUser.id, role: "STAFF" } })
  staffId = (
    await prisma.staff.create({ data: { name: "Zaposlena Ana", userId: staffUser.id, organizationId: orgA, isActive: true } })
  ).id

  // Omejeni ADMIN (custom rola brez workorders.manage) → varnostni test.
  const restr = await prisma.user.create({
    data: { email: `${RUN}.restricted@markec.test`, name: "Omejeni", role: "ADMIN", organizationId: orgA, password: "x", emailVerified: new Date() },
  })
  restrictedAdminId = restr.id
  const customRole = await prisma.customRole.create({
    data: { organizationId: orgA, name: `Brez nalogov ${RUN}`, permissions: ["appointments.view"] },
  })
  await prisma.organizationMember.create({
    data: { organizationId: orgA, userId: restr.id, role: "ADMIN", customRoleId: customRole.id },
  })

  woA = (
    await prisma.workOrder.create({ data: { organizationId: orgA, number: 1, title: `${RUN} Nalog A`, status: "OPEN" } })
  ).id
  woB = (
    await prisma.workOrder.create({ data: { organizationId: orgB, number: 1, title: `${RUN} Nalog B`, status: "OPEN" } })
  ).id
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => undefined)
  for (const uid of [ownerId, staffUserKid, restrictedAdminId]) {
    if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => undefined)
  }
  await prisma.$disconnect()
})

async function laborRecord(id: string) {
  const rec = await prisma.extensionRecord.findUnique({ where: { id } })
  return rec ? (rec.data as Record<string, unknown>) : null
}
async function eventCount(workOrderId: string) {
  return prisma.workOrderEvent.count({ where: { workOrderId, organizationId: orgA } })
}

describe("WorkOrderLabor — delovni čas (itest)", () => {
  let e1: string
  let e2: string
  let e2b: string

  it("1. dodajanje — ustvari ExtensionRecord (snake_case JSON) in WorkOrderEvent", async () => {
    const r1 = await addLaborEntry({
      workOrderId: woA,
      performedBy: "Ana Ros",
      hours: 2,
      hourlyRate: 50,
      description: "Frizure",
      workDate: "2026-01-10",
    })
    expect(r1.ok).toBe(true)
    e1 = r1.id!
    expect(e1).toBeTruthy()

    const d = await laborRecord(e1)
    expect(d!.work_order_id).toBe(woA)
    expect(d!.work_order_number).toBe(1)
    expect(d!.work_order_title).toBe(`${RUN} Nalog A`)
    expect(d!.performed_by).toBe("Ana Ros")
    expect(d!.staff_id).toBeNull()
    expect(d!.hours).toBe(2)
    expect(d!.hourly_rate).toBe(50)
    expect(d!.total_cost).toBe(100) // 2 * 50
    expect(d!.work_date).toBe("2026-01-10")

    // WorkOrderEvent mora biti zapisan (koda to piše pri dodajanju).
    expect(await eventCount(woA)).toBe(1)

    // staffId varianta → staff_name se razreši iz Staff vrstice.
    const r2 = await addLaborEntry({
      workOrderId: woA,
      staffId,
      hours: 3,
      hourlyRate: 40,
      workDate: "2026-01-11",
    })
    expect(r2.ok).toBe(true)
    e2 = r2.id!
    const d2 = await laborRecord(e2)
    expect(d2!.staff_id).toBe(staffId)
    expect(d2!.staff_name).toBe("Zaposlena Ana")
    expect(d2!.performed_by).toBe("Zaposlena Ana")
    expect(d2!.total_cost).toBe(120) // 3 * 40
    expect(await eventCount(woA)).toBe(2)
  })

  it("2. posodabljanje — spremeni ure in preračuna total_cost", async () => {
    const r = await updateLaborEntry(e1, { hours: 4 })
    expect(r.ok).toBe(true)
    const d = await laborRecord(e1)
    expect(d!.hours).toBe(4)
    expect(d!.total_cost).toBe(200) // 4 * 50 (rate nespremenjen)

    // OPOMBA (ugotovitev): updateLaborEntry NE zapisuje WorkOrderEvent-a.
    // Število dogodkov ostane kot po koraku 1 (2 = oba add). To zrcalimo, a
    // bi bil dogodek (npr. NOTE) na urejanje pričakovan za popolno sledljivost.
    expect(await eventCount(woA)).toBe(2)
  })

  it("3. dodajanje še enega vnosa za istega zaposlenega (za agregacijo byStaff)", async () => {
    const r2b = await addLaborEntry({ workOrderId: woA, staffId, hours: 1, hourlyRate: 40, workDate: "2026-01-12" })
    expect(r2b.ok).toBe(true)
    e2b = r2b.id!
  })

  it("4. seštevek celotnega naloga — skupaj ur in stroškov", async () => {
    const s = await getWorkOrderLabor(woA)
    expect(s).not.toBeNull()
    expect(s!.entries.length).toBe(3)
    // e1: 4h×50=200; e2: 3h×40=120; e2b: 1h×40=40
    expect(s!.totalHours).toBe(8)
    expect(s!.totalCost).toBe(360)

    // Agregacija po zaposlenih.
    const ana = s!.byStaff.find((x) => x.name === "Ana Ros")
    const zaposlena = s!.byStaff.find((x) => x.name === "Zaposlena Ana")
    expect(s!.byStaff.length).toBe(2)
    expect(ana).toMatchObject({ hours: 4, cost: 200 })
    expect(zaposlena).toMatchObject({ hours: 4, cost: 160 }) // 3+1, 120+40
  })

  it("5. brisanje vnosa", async () => {
    const r = await deleteLaborEntry(e2b)
    expect(r.ok).toBe(true)
    expect(await laborRecord(e2b)).toBeNull()
    const s = await getWorkOrderLabor(woA)
    expect(s!.entries.length).toBe(2)
    expect(s!.totalHours).toBe(7) // 4 + 3
    expect(s!.totalCost).toBe(320) // 200 + 120
  })

  it("6. listAllLaborEntries vrne le vnose te org (take=500, sort desc)", async () => {
    const all = await listAllLaborEntries()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThanOrEqual(2)
    expect(all.every((e: LaborEntry) => e.workOrderId === woA && e.workOrderNumber === 1)).toBe(true)
    expect(all.every((e: LaborEntry) => e.createdAt !== undefined)).toBe(true)
  })

  it("7. org izolacija — tuj delovni nalog in tuji vnos nista vidna/urejljiva", async () => {
    // Vnos v drugo org (orgB), ki ga pod sejo orgA ne smemo videti ali urejati.
    const foreign = await prisma.extensionRecord.create({
      data: {
        organizationId: orgB,
        extensionId: "work-order-labor",
        entityKey: LABOR_KEY,
        title: "Tuje delo",
        data: {
          work_order_id: woB,
          work_order_number: 1,
          work_order_title: `${RUN} Nalog B`,
          staff_id: null,
          staff_name: null,
          performed_by: "Tuja oseba",
          hours: 9,
          hourly_rate: 100,
          total_cost: 900,
          description: null,
          work_date: "2026-02-01",
        },
      },
    })

    // getWorkOrderLabor na tujem nalogu → null (delovni nalog ni v orgA).
    expect(await getWorkOrderLabor(woB)).toBeNull()

    // Urejanje/brisanje tujega vnosa → NOT_FOUND (org-scoped findFirst).
    expect((await updateLaborEntry(foreign.id, { hours: 1 })).error).toBe("NOT_FOUND")
    expect((await deleteLaborEntry(foreign.id)).error).toBe("NOT_FOUND")

    // Tuji vnos še vedno obstaja v orgB (ni bil spremenjen/zbrisan).
    const still = await prisma.extensionRecord.findUnique({ where: { id: foreign.id } })
    expect(still).not.toBeNull()
    expect((still!.data as Record<string, unknown>).hours).toBe(9)
  })

  it("8. varnost — ADMIN brez workorders.manage ne sme dodajati/brati", async () => {
    state.session = { user: { id: restrictedAdminId, role: "ADMIN", email: `${RUN}.restricted@markec.test` } }

    await expect(addLaborEntry({ workOrderId: woA, performedBy: "X", hours: 1 })).rejects.toThrow(UnauthorizedError)
    await expect(getWorkOrderLabor(woA)).rejects.toThrow(UnauthorizedError)
    await expect(updateLaborEntry(e1, { hours: 1 })).rejects.toThrow(UnauthorizedError)
    await expect(deleteLaborEntry(e1)).rejects.toThrow(UnauthorizedError)

    // Povrnemo sejo lastnika.
    state.session = { user: { id: ownerId, role: "ADMIN", email: `${RUN}@markec.test` } }
  })
})