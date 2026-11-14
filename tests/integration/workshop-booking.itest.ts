// ============================================================
// 2D-1W — REZERVACIJA → VOZILO → DELOVNI NALOG (tire-service) itest.
// Izolirana baza markec_e2e_test. Preverja shemo-free povezavo:
//   • vozilo se poveže s stranko / rezervacijo (data.__appointments),
//   • iz potrjene rezervacije nastane delovni nalog,
//   • prepoved podvajanja naloga iz iste rezervacije,
//   • sledljivost (izvor → vozilo → stranka → let),
//   • odsotnost odštevanja zaloge pri sami rezervaciji,
//   • org izolacija (IDOR, beekeeper org brez zapisov).
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
  linkVehicleToAppointment,
  createWorkOrderFromAppointment,
} from "@/app/actions/workshop-booking"
import { sellPartsOnWorkOrder, resolveWorkOrderProvenance } from "@/app/actions/vehicle-workshop"

const RUN = "wbo_" + Date.now().toString(36)
let orgV: string // vulkanizer org
let orgB: string // beekeeper org
let userId: string
let wfV: string

async function seedWorkflow(orgId: string) {
  const def = await prisma.workflowDefinition.create({
    data: {
      organizationId: orgId,
      key: "work-order",
      name: "Delovni nalog",
      entity: "order",
      isActive: true,
      stages: {
        create: [
          { key: "checkin", name: "Sprejem", order: 1 },
          { key: "diagnostics", name: "Pregled", order: 2 },
          { key: "approved", name: "Potrjeno", order: 3 },
          { key: "closed", name: "Oddano", order: 4, isFinal: true },
        ],
      },
    },
  })
  return def.id
}

beforeAll(async () => {
  const v = await prisma.organization.create({ data: { slug: `${RUN}_v`, name: `V ${RUN}`, vertical: "tire-service", publishState: "DRAFT" } })
  orgV = v.id
  const b = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" } })
  orgB = b.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Owner", role: "ADMIN", organizationId: orgV, password: "x", emailVerified: new Date() } })
  userId = user.id
  await prisma.organizationMember.create({ data: { organizationId: orgV, userId: user.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }
  wfV = await seedWorkflow(orgV)
  await seedWorkflow(orgB)
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgV, orgB] } } }).catch(() => undefined)
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

async function seedCustomer(orgId: string, email: string) {
  return prisma.customer.create({ data: { organizationId: orgId, name: "Janez Novak", email, phone: "040123456" } })
}

async function seedAppointment(orgId: string, status: string, customerId: string | null) {
  const nonce = `${RUN}.${orgId.slice(-6)}.${Math.random().toString(36).slice(2, 8)}`
  const st = await prisma.user.create({
    data: { organizationId: orgId, name: "Mehanik", email: `st${nonce}@markec.test`, role: "STAFF", password: "x", emailVerified: new Date() },
  })
  const staff = await prisma.staff.create({
    data: { organizationId: orgId, name: "Mehanik", email: st.email, isActive: true, userId: st.id },
  })
  const svc = await prisma.service.create({
    data: { organizationId: orgId, slug: `menjava-gum-${nonce}`, name: "Menjava gum", price: 40, duration: 60, isActive: true },
  })
  const appt = await prisma.appointment.create({
    data: {
      organizationId: orgId,
      staffId: staff.id,
      customerId,
      startTime: new Date(Date.now() + 86400000 * 7),
      endTime: new Date(Date.now() + 86400000 * 7 + 3600000),
      status: status as never,
      totalPrice: 40,
      depositAmount: 0,
      services: { create: { serviceId: svc.id } },
    },
    include: { services: { include: { service: { select: { name: true } } } } },
  })
  return appt
}

describe("2D-1W — rezervacija → vozilo → delovni nalog", () => {
  it("1. vozilo se poveže s stranko in rezervacijo (linkVehicleToAppointment)", async () => {
    const c = await seedCustomer(orgV, `${RUN}.cust@markec.test`)
    const appt = await seedAppointment(orgV, "CONFIRMED", c.id)
    const svcNames = ["Menjava gum"]

    const res = await linkVehicleToAppointment({
      organizationId: orgV,
      customerId: c.id,
      appointmentId: appt.id,
      vehiclePlate: "LJ-777-XX",
      vehicleName: "VW Golf",
      serviceNames: svcNames,
    })
    expect(res.ok).toBe(true)
    expect(res.vehicleId).toBeTruthy()

    const veh = await prisma.extensionRecord.findUnique({ where: { id: res.vehicleId! } })
    expect(veh).not.toBeNull()
    expect(veh!.customerId).toBe(c.id)
    const vehData = (veh!.data ?? {}) as Record<string, unknown>
    const links = Array.isArray(vehData.__appointments) ? (vehData.__appointments as { appointmentId: string }[]) : []
    expect(links.some((l) => l.appointmentId === appt.id)).toBe(true)

    // priprava za nadaljevanje
    ;(globalThis as Record<string, unknown>).__wbo = { apptId: appt.id, vehId: res.vehicleId, custId: c.id }
  })

  it("2. povzeta akcija ne podvoji vozila (ista tablica → isti vehicle)", async () => {
    const g = (globalThis as Record<string, unknown>).__wbo as { apptId: string; vehId: string; custId: string }
    const c2 = await seedCustomer(orgV, `${RUN}.cust2@markec.test`)
    const appt2 = await seedAppointment(orgV, "PENDING", c2.id)
    const res = await linkVehicleToAppointment({
      organizationId: orgV,
      customerId: c2.id,
      appointmentId: appt2.id,
      vehiclePlate: "LJ-777-XX",
      serviceNames: ["Menjava gum"],
    })
    expect(res.vehicleId).toBe(g.vehId)
  })

  it("3. iz PENDING rezervacije naloga NI mogoče ustvariti (NOT_CONFIRMED)", async () => {
    const c = await seedCustomer(orgV, `${RUN}.pend@markec.test`)
    const appt = await seedAppointment(orgV, "PENDING", c.id)
    await linkVehicleToAppointment({
      organizationId: orgV, customerId: c.id, appointmentId: appt.id, vehiclePlate: "LJ-888-YY", serviceNames: ["Menjava gum"],
    })
    const res = await createWorkOrderFromAppointment({ appointmentId: appt.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_CONFIRMED")
  })

  it("4. iz potrjene rezervacije se ustvari delovni nalog + povezava nazaj", async () => {
    const g = (globalThis as Record<string, unknown>).__wbo as { apptId: string; vehId: string; custId: string }
    const res = await createWorkOrderFromAppointment({ appointmentId: g.apptId })
    expect(res.ok).toBe(true)
    expect(res.workOrderId).toBeTruthy()

    const wo = await prisma.workOrder.findUnique({ where: { id: res.workOrderId! }, include: { events: true } })
    expect(wo).not.toBeNull()
    expect(wo!.customerId).toBe(g.custId)
    // izvor v dešifru (data.__appointments)
    const veh = await prisma.extensionRecord.findUnique({ where: { id: g.vehId } })
    const vehData = (veh!.data ?? {}) as Record<string, unknown>
    const link = (Array.isArray(vehData.__appointments) ? (vehData.__appointments as { appointmentId: string; workOrderId?: string }[]) : []).find((l) => l.appointmentId === g.apptId)
    expect(link?.workOrderId).toBe(res.workOrderId)
    // dogodek CREATED z referenco na rezervacijo
    expect(wo!.events.some((e) => e.message?.includes("iz rezervacije"))).toBe(true)

    // shrani za naslednji test
    ;(globalThis as Record<string, unknown>).__wbo = { ...g, woId: res.workOrderId }
  })

  it("5. podvojeno ustvarjanje naloga iz iste rezervacije je zavrnjeno (ALREADY_CREATED)", async () => {
    const g = (globalThis as Record<string, unknown>).__wbo as { apptId: string; woId: string }
    const res = await createWorkOrderFromAppointment({ appointmentId: g.apptId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("ALREADY_CREATED")
    expect(res.workOrderId).toBe(g.woId)
    const count = await prisma.workOrder.count({ where: { organizationId: orgV } })
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it("6a. poraba delov na nalogu iz rezervacije zniža zalogo (obstaja Order+Document+StockMovement)", async () => {
    const g = (globalThis as Record<string, unknown>).__wbo as { woId: string }
    // ustvari del (pnevmatiko) na zalogi
    const part = await prisma.product.create({
      data: { organization: { connect: { id: orgV } }, name: `${RUN} Pnevmatika`, price: 85, trackInventory: true, stockQuantity: 20, reservedQuantity: 0, isActive: true, forSale: true },
    })
    const before = (await prisma.product.findUnique({ where: { id: part.id } }))!.stockQuantity
    const res = await sellPartsOnWorkOrder({ workOrderId: g.woId, lines: [{ productId: part.id, quantity: 2 }] })
    expect(res.ok).toBe(true)
    const after = (await prisma.product.findUnique({ where: { id: part.id } }))!.stockQuantity
    expect(after).toBe(before - 2)
    // order + document + stock movement nastanejo
    expect(await prisma.stockMovement.count({ where: { organizationId: orgV, direction: "OUT", orderId: { not: null } } })).toBeGreaterThan(0)
  })

  it("6b. provenance iz naloga pokaže izvor: rezervacija + stranka + vozilo + zaloga", async () => {
    const g = (globalThis as Record<string, unknown>).__wbo as { woId: string; apptId: string; custId: string; vehId: string }
    const prov = await resolveWorkOrderProvenance(g.woId)
    expect(prov).not.toBeNull()
    expect(prov!.vehicle).not.toBeNull()
    expect(prov!.vehicle!.id).toBe(g.vehId)
    expect(prov!.customerName).toBe("Janez Novak")
    expect(prov!.parts.length).toBeGreaterThan(0) // porabljeni deli
    expect(prov!.parts[0].stockMovements.length).toBeGreaterThan(0) // premiki zaloge
    // izvor v vehicle.data.__appointments (workOrderId ↔ apptId)
    const veh = await prisma.extensionRecord.findUnique({ where: { id: g.vehId } })
    const vd = (veh!.data ?? {}) as Record<string, unknown>
    const links = Array.isArray(vd.__appointments) ? (vd.__appointments as { appointmentId: string; workOrderId?: string }[]) : []
    expect(links.some((l) => l.appointmentId === g.apptId && l.workOrderId === g.woId)).toBe(true)
  })

  it("6. rezervacija sama NE odšteje zaloge (vozilo ni prodajni zapis)", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgV } }, name: `${RUN} Del`, price: 10, trackInventory: true, stockQuantity: 50, reservedQuantity: 0, isActive: true, forSale: true },
    })
    const before = (await prisma.product.findUnique({ where: { id: p.id } }))!.stockQuantity
    // nova rezervacija z vozilom — ne sme spremeniti zaloge
    const c = await seedCustomer(orgV, `${RUN}.noinv@markec.test`)
    const appt = await seedAppointment(orgV, "PENDING", c.id)
    await linkVehicleToAppointment({ organizationId: orgV, customerId: c.id, appointmentId: appt.id, vehiclePlate: "LJ-999-ZZ", serviceNames: ["Menjava gum"] })
    const after = (await prisma.product.findUnique({ where: { id: p.id } }))!.stockQuantity
    expect(after).toBe(before)
  })

  it("7. vbrizg v tujo org je zavrnjen (IDOR) — beekeeper dobiva nič", async () => {
    // beekeeper org nima povezav iz vulkanizerja
    const beeVehicles = await prisma.extensionRecord.count({ where: { organizationId: orgB, entityKey: "vehicle" } })
    expect(beeVehicles).toBe(0)
    // tuja org rezervacija ni dosegljiva prek vulkanizerjeve seje
    const cB = await seedCustomer(orgB, `${RUN}.bee@markec.test`)
    const apptB = await seedAppointment(orgB, "CONFIRMED", cB.id)
    const res = await createWorkOrderFromAppointment({ appointmentId: apptB.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("APPOINTMENT_NOT_FOUND")
  })
})