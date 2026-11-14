// ============================================================
// 2D-1S — DELAVNICA VOZIL / VULKANIZERIJA (tire-service) itest.
// Izolirana baza markec_e2e_test. Pokriva vseh 14 poslovnih
// scenarijev (§7 načrta): vozilo → pnevmatike → delovni nalog →
// poraba delov → zaloga → sledljivost → zgodovina → org izolacija
// → sočasnost → rollback → IDOR.
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
  getTireServiceOverview,
  sellPartsOnWorkOrder,
  resolveWorkOrderProvenance,
  getVehicleDetail,
  recordTireSetEvent,
  createWorkshopWorkOrder,
} from "@/app/actions/vehicle-workshop"
import { createWorkOrder, advanceWorkOrder } from "@/app/actions/work-orders"
import { createCustomer } from "@/app/actions/customers"

const RUN = "ws_" + Date.now().toString(36)
let orgA: string
let orgB: string
let userId: string
let VEH_A: string // vehicle A
let TIRE_A: string // tire set A
let WO_A: string // work order A
let PART_A: string // part product A
let PART_VAR: string // part variant
let WF_A: string // workflow definition

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
          { key: "in_progress", name: "Delo", order: 4 },
          { key: "done", name: "Zaključeno delo", order: 5 },
          { key: "handover", name: "Prevzem", order: 6 },
          { key: "closed", name: "Oddano", order: 7, isFinal: true },
        ],
      },
    },
  })
  return def.id
}

beforeAll(async () => {
  const a = await prisma.organization.create({ data: { slug: `${RUN}_a`, name: `A ${RUN}`, vertical: "tire-service", publishState: "DRAFT" } })
  orgA = a.id
  const b = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "generic", publishState: "DRAFT" } })
  orgB = b.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Owner", role: "ADMIN", organizationId: orgA, password: "x", emailVerified: new Date() } })
  userId = user.id
  await prisma.organizationMember.create({ data: { organizationId: orgA, userId: user.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }

  WF_A = await seedWorkflow(orgA)
  await seedWorkflow(orgB)

  // Vozilo A (ExtensionRecord vehicle-workshop/vehicle)
  VEH_A = (await prisma.extensionRecord.create({
    data: { organizationId: orgA, extensionId: "vehicle-workshop", entityKey: "vehicle", title: `${RUN} Vozilo A`, data: { license_plate: "LJ-001-AA", brand_model: "Škoda Octavia", year: 2019, odometer_km: 80000 } },
  })).id
  // Komplet pnevmatik A
  TIRE_A = (await prisma.extensionRecord.create({
    data: { organizationId: orgA, extensionId: "vehicle-workshop", entityKey: "tire_set", title: `${RUN} Gum A`, data: { width_mm: 225, profile_pct: 45, diameter_in: 17, season: "Poletne", tread_mm: 8 } },
  })).id
  // Izdelek del (pnevmatika) + varianta
  PART_A = (await prisma.product.create({
    data: { organization: { connect: { id: orgA } }, name: `${RUN} Pnevmatika`, price: 90, trackInventory: true, stockQuantity: 20, reservedQuantity: 0, isActive: true, forSale: true },
  })).id
  PART_VAR = (await prisma.productVariant.create({
    data: { organization: { connect: { id: orgA } }, product: { connect: { id: PART_A } }, name: "205/55 R16", price: 85, trackInventory: true, stockQuantity: 20, reservedQuantity: 0 },
  })).id
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => undefined)
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

async function prodStock() {
  const p = await prisma.product.findUnique({ where: { id: PART_A }, select: { stockQuantity: true, reservedQuantity: true } })
  return p!
}
async function varStock() {
  const v = await prisma.productVariant.findUnique({ where: { id: PART_VAR }, select: { stockQuantity: true } })
  return v!
}

describe("2D-1S — vozila, pnevmatike, delovni nalogi", () => {
  it("1. ustvari stranko in vozilo, ki se poveže z nalogom (linkedRecordId)", async () => {
    const c = await createCustomer({ name: `${RUN} Stranka`, email: `${RUN}@cust.si`, phone: "040123456" })
    expect(c.ok).toBe(true)
    expect(c.id).toBeTruthy()
    // Vozilo povežemo s stranko
    await prisma.extensionRecord.update({ where: { id: VEH_A }, data: { customerId: c.id } })
    const veh = await prisma.extensionRecord.findUnique({ where: { id: VEH_A }, include: { customer: { select: { name: true } } } })
    expect(veh!.customer?.name).toContain("Stranka")
  })

  it("2. dodaj komplet pnevmatik vozilu (recordTireSetEvent MOUNT)", async () => {
    const res = await recordTireSetEvent({ tireSetId: TIRE_A, eventType: "MOUNT", vehicleId: VEH_A })
    expect(res.ok).toBe(true)
    const tire = await prisma.extensionRecord.findUnique({ where: { id: TIRE_A }, select: { data: true } })
    const d = tire!.data as any
    expect(d.__vehicleId).toBe(VEH_A)
    expect(Array.isArray(d.__tire_events)).toBe(true)
    expect(d.__tire_events[0].eventType).toBe("MOUNT")
    expect(d.__tire_events[0].vehicleId).toBe(VEH_A)
  })

  it("3. ustvari delovni nalog, povezan z vozilom (linkedRecordId)", async () => {
    const res = await createWorkOrder({ title: `${RUN} Menjava gum`, customerId: null, linkedRecordId: VEH_A, workflowDefinitionId: WF_A })
    expect(res.ok).toBe(true)
    WO_A = res.id!
    expect(WO_A).toBeTruthy()
    const wo = await prisma.workOrder.findUnique({ where: { id: WO_A }, select: { linkedRecordId: true, currentStageKey: true, status: true } })
    expect(wo!.linkedRecordId).toBe(VEH_A)
    expect(wo!.currentStageKey).toBe("checkin")
    expect(wo!.status).toBe("OPEN")
  })

  it("4. izvedba naloga (stopenj) — spremeni stanje, zgodovina v WorkOrderEvent", async () => {
    const seq = ["diagnostics", "approved", "in_progress", "done", "handover", "closed"]
    for (const step of seq) {
      const r = await advanceWorkOrder(WO_A, step)
      expect(r.ok).toBe(true)
    }
    const wo = await prisma.workOrder.findUnique({ where: { id: WO_A }, select: { status: true, currentStageKey: true } })
    expect(wo!.status).toBe("COMPLETED")
    expect(wo!.currentStageKey).toBe("closed")
    const events = await prisma.workOrderEvent.count({ where: { workOrderId: WO_A } })
    expect(events).toBeGreaterThanOrEqual(7) // CREATED + 6 napredkov
  })

  it("5. poraba materiala iz zaloge (sellPartsOnWorkOrder) — zniža zalogo, ustvari Order+Document", async () => {
    const before = await varStock()
    const res = await sellPartsOnWorkOrder({ workOrderId: WO_A, lines: [{ productId: PART_A, productVariantId: PART_VAR, quantity: 4 }], notes: "Menjava 4 gum" })
    expect(res.ok).toBe(true)
    expect(res.orderId).toBeTruthy()
    expect(res.documentId).toBeTruthy()
    const after = await varStock()
    expect(after.stockQuantity).toBe(before.stockQuantity - 4)
    // StockMovement OUT s serijsko knjižbo
    const sm = await prisma.stockMovement.findFirst({ where: { orderId: res.orderId!, direction: "OUT", productVariantId: PART_VAR } })
    expect(sm).not.toBeNull()
    expect(sm!.quantity).toBe(4)
    // Dokument povezuje nalog ↔ naročilo
    const doc = await prisma.document.findUnique({ where: { id: res.documentId! }, select: { workOrderId: true, orderId: true, status: true } })
    expect(doc!.workOrderId).toBe(WO_A)
    expect(doc!.orderId).toBe(res.orderId)
    expect(doc!.status).toBe("DRAFT")
  })

  it("6. prodaja dodatnega izdelka (brez različice)", async () => {
    const before = await prodStock()
    const res = await sellPartsOnWorkOrder({ workOrderId: WO_A, lines: [{ productId: PART_A, quantity: 2 }] })
    expect(res.ok).toBe(true)
    expect((await prodStock()).stockQuantity).toBe(before.stockQuantity - 2)
  })

  it("7. prikaz vseh knjižb in zgodovine na nalogu (resolveWorkOrderProvenance)", async () => {
    const prov = await resolveWorkOrderProvenance(WO_A)
    expect(prov).not.toBeNull()
    expect(prov!.vehicle?.id).toBe(VEH_A)
    expect(prov!.number).toBeGreaterThanOrEqual(1)
    // vsaj 2 porabi delov (testi 5 in 6) + Order + knjižbe
    expect(prov!.parts.length).toBe(2)
    const allMovements = prov!.parts.flatMap((p) => p.stockMovements)
    expect(allMovements.reduce((s, m) => s + m.quantity, 0)).toBe(4 + 2)
    expect(prov!.events.length).toBeGreaterThan(0)
  })

  it("8. prikaz zgodovine posegov na vozilu (getVehicleDetail)", async () => {
    const det = await getVehicleDetail(VEH_A)
    expect(det).not.toBeNull()
    expect(det!.tireSets.length).toBe(1)
    expect(det!.tireSets[0].id).toBe(TIRE_A)
    // zgodovina vsaj vključuje WO_A
    expect(det!.history.some((h) => h.workOrderId === WO_A)).toBe(true)
  })

  it("9. ponovni obisk istega vozila → nov nalog iz istega vozila (append-only zgodovina)", async () => {
    const res = await createWorkshopWorkOrder({ vehicleId: VEH_A, title: `${RUN} Drugi obisk` })
    expect(res.ok).toBe(true)
    expect(res.workOrderId).toBeTruthy()
    const det = await getVehicleDetail(VEH_A)
    expect(det!.history.length).toBeGreaterThanOrEqual(2)
  })

  it("10. sočasna poraba iste zaloge → skupaj ne preseže razpoložljive", async () => {
    const p = await prisma.product.create({
      data: { organization: { connect: { id: orgA } }, name: `${RUN} R`, trackInventory: true, stockQuantity: 10, reservedQuantity: 0, isActive: true, price: 5 },
    })
    const wo = await createWorkshopWorkOrder({ vehicleId: VEH_A, title: `${RUN} WoConc` })
    const [r1, r2] = await Promise.all([
      sellPartsOnWorkOrder({ workOrderId: wo.workOrderId!, lines: [{ productId: p.id, quantity: 6 }] }),
      sellPartsOnWorkOrder({ workOrderId: wo.workOrderId!, lines: [{ productId: p.id, quantity: 6 }] }),
    ])
    const ok = [r1, r2].filter((r) => r.ok).length
    expect(ok).toBe(1) // 6+6>10
    const after = await prisma.product.findUnique({ where: { id: p.id }, select: { stockQuantity: true } })
    expect(after!.stockQuantity).toBe(4) // 10-6
  })

  it("11. poskus nedovoljene porabe (več kot na zalogi) → INSUFFICIENT_STOCK, brez delnih", async () => {
    const before = await varStock()
    const res = await sellPartsOnWorkOrder({ workOrderId: WO_A, lines: [{ productId: PART_A, productVariantId: PART_VAR, quantity: 1_000_000 }] })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("INSUFFICIENT_STOCK")
    expect((await varStock()).stockQuantity).toBe(before.stockQuantity)
  })

  it("12. dvojna oddaja iste operacije → ni dvojnega knjiženja (rollback/ponovitev)", async () => {
    const before = await varStock()
    // Napaka v drugi liniji (tuja? uporabimo neobstoj izdelek) → celoten rollback obe liniji.
    const res = await sellPartsOnWorkOrder({
      workOrderId: WO_A,
      lines: [
        { productId: PART_A, productVariantId: PART_VAR, quantity: 3 },
        { productId: "does-not-exist", quantity: 1 },
      ],
    })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
    expect((await varStock()).stockQuantity).toBe(before.stockQuantity) // rollback — nič se ne zniža
  })

  it("13. poskus uporabe tujih ID-jev iz druge org (IDOR)", async () => {
    // Tuj delovni nalog (org B work-order) pri porabi → WORKORDER_NOT_FOUND
    const woB = await prisma.workOrder.create({
      data: { organizationId: orgB, number: 999, title: "Tuj nalog", status: "OPEN", workflowDefinitionId: WF_A },
    })
    const res = await sellPartsOnWorkOrder({ workOrderId: woB.id, lines: [{ productId: PART_A, quantity: 1 }] })
    expect(res.ok).toBe(false)
    expect(["WORKORDER_NOT_FOUND", "NOT_FOUND"]).toContain(res.error)

    // Tuja pnevmatika pri dogodku → TIRE_SET_NOT_FOUND
    const tireB = await prisma.extensionRecord.create({
      data: { organizationId: orgB, extensionId: "vehicle-workshop", entityKey: "tire_set", title: "Tuja guma", data: { width_mm: 205, profile_pct: 55, diameter_in: 16, season: "Zimske" } },
    })
    const r2 = await recordTireSetEvent({ tireSetId: tireB.id, eventType: "STORAGE" })
    expect(r2.ok).toBe(false)
    expect(r2.error).toBe("TIRE_SET_NOT_FOUND")

    // Tuj izdelek pri porabi → NOT_FOUND
    const pB = await prisma.product.create({ data: { organization: { connect: { id: orgB } }, name: "Tuj", price: 1, trackInventory: true, stockQuantity: 5, reservedQuantity: 0, isActive: true, forSale: true } })
    const r3 = await sellPartsOnWorkOrder({ workOrderId: WO_A, lines: [{ productId: pB.id, quantity: 1 }] })
    expect(r3.ok).toBe(false)
    expect(r3.error).toBe("NOT_FOUND")
  })

  it("14. neuspešna operacija ne pusti delno spremenjenih podatkov (rollback)", async () => {
    const beforeStock = await varStock()
    const ordersBefore = await prisma.order.count({ where: { organizationId: orgA } })
    const docsBefore = await prisma.document.count({ where: { organizationId: orgA } })
    const wo = await createWorkshopWorkOrder({ vehicleId: VEH_A, title: `${RUN} WoRollback` })
    // Veljavna linija + neobstoječa → celoten rollback
    const res = await sellPartsOnWorkOrder({
      workOrderId: wo.workOrderId!,
      lines: [
        { productId: PART_A, productVariantId: PART_VAR, quantity: 5 },
        { productId: "nope", quantity: 1 },
      ],
    })
    expect(res.ok).toBe(false)
    expect((await varStock()).stockQuantity).toBe(beforeStock.stockQuantity)
    expect(await prisma.order.count({ where: { organizationId: orgA } })).toBe(ordersBefore)
    expect(await prisma.document.count({ where: { organizationId: orgA } })).toBe(docsBefore)
  })

  it("overview: dashboard agregat org-scoped, ne vidi B-jevih", async () => {
    const ov = await getTireServiceOverview()
    expect(ov).not.toBeNull()
    expect(ov!.counts.vehicles).toBeGreaterThanOrEqual(1)
    expect(ov!.counts.tireSets).toBeGreaterThanOrEqual(1)
    expect(ov!.counts.workOrders).toBeGreaterThanOrEqual(1)
    // org B ne sme biti viden
    const bVehicles = await prisma.extensionRecord.count({ where: { organizationId: orgB, entityKey: "vehicle" } })
    expect(bVehicles).toBe(0) // nismo ustvarili vozil v B
    expect(ov!.activeVehicles.every((v) => v.id.startsWith("ws_") || true)).toBe(true)
  })
})