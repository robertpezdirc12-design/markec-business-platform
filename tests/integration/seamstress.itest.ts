// ============================================================
// 2D-2B — ŠIVILJSTVO (seamstress) itest.
// Izolirana baza markec_e2e_test. Preverja celoten poslovni tok:
//   • meritve strank (append-only zgodovina, datum, org-scoped),
//   • naročilo po meri → WorkOrder (production-order, merilni list, rok, cena),
//   • preprečevanje podvajanja naloga iz istega merilnega lista,
//   • poraba materiala (zaloga se zniža; ni negativne; ni dvojna),
//   • sledljivost (resolveSeamstressProvenance),
//   • napredovanje → predaja → plačilo → zaključeno,
//   • IDOR in org izolacija (čebelar ne vidi šiviljske).
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
  saveMeasurement,
  listMeasurements,
  createOrderFromInquiry,
  consumeMaterialOnWorkOrder,
  resolveSeamstressProvenance,
} from "@/app/actions/seamstress"
import { advanceWorkOrder } from "@/app/actions/work-orders"

const RUN = "seam_" + Date.now().toString(36)
let orgS: string // šivilja
let orgB: string // čebelar
let userId: string
let wfS: string

async function seedWorkflow(orgId: string) {
  const def = await prisma.workflowDefinition.create({
    data: {
      organizationId: orgId,
      key: "production-order",
      name: "Proizvodni proces naročila",
      entity: "order",
      isActive: true,
      stages: {
        create: [
          { key: "inquiry", name: "Povpraševanje", order: 1 },
          { key: "measurements", name: "Meritve", order: 2 },
          { key: "quote", name: "Predračun", order: 3 },
          { key: "approval", name: "Potrditev", order: 4 },
          { key: "production", name: "Izdelava", order: 5 },
          { key: "fitting", name: "Priblon", order: 6 },
          { key: "delivery", name: "Predaja", order: 7 },
          { key: "payment", name: "Plačilo", order: 8 },
          { key: "done", name: "Zaključeno", order: 9, isFinal: true },
        ],
      },
    },
  })
  return def.id
}

beforeAll(async () => {
  const s = await prisma.organization.create({ data: { slug: `${RUN}_s`, name: `S ${RUN}`, vertical: "seamstress", publishState: "DRAFT" } })
  orgS = s.id
  const b = await prisma.organization.create({ data: { slug: `${RUN}_b`, name: `B ${RUN}`, vertical: "beekeeping", publishState: "DRAFT" } })
  orgB = b.id
  const user = await prisma.user.create({ data: { email: `${RUN}@markec.test`, name: "Maja", role: "ADMIN", organizationId: orgS, password: "x", emailVerified: new Date() } })
  userId = user.id
  await prisma.organizationMember.create({ data: { organizationId: orgS, userId: user.id, role: "ADMIN", isDefault: true } })
  state.session = { user: { id: user.id, role: "ADMIN", email: user.email } }
  wfS = await seedWorkflow(orgS)
  await seedWorkflow(orgB)
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgS, orgB] } } }).catch(() => undefined)
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

async function seedCustomer(orgId: string, email: string) {
  return prisma.customer.create({ data: { organizationId: orgId, name: "Mia Svetlič", email, phone: "031888999" } })
}

async function seedMaterial(orgId: string, stock: number) {
  return prisma.product.create({
    data: { organization: { connect: { id: orgId } }, name: `${RUN} Blago`, price: 12, trackInventory: true, stockQuantity: stock, reservedQuantity: 0, isActive: true, forSale: true },
  })
}

describe("2D-2B — šiviljstvo: poslovni tok", () => {
  let custId: string
  let matId: string

  it("1. snemanje meritev — zgodovina se ohranja (append-only)", async () => {
    const c = await seedCustomer(orgS, `${RUN}@markec.test`)
    custId = c.id
    matId = (await seedMaterial(orgS, 20)).id

    const r1 = await saveMeasurement({ customerId: custId, measuredAt: "2026-01-01", chestCm: 90, waistCm: 70, hipsCm: 95, sleeveCm: 60, byStaff: "Maja" })
    expect(r1.ok).toBe(true)
    const r2 = await saveMeasurement({ customerId: custId, measuredAt: "2026-06-01", chestCm: 92, waistCm: 72, hipsCm: 97, sleeveCm: 61, byStaff: "Maja" })
    expect(r2.ok).toBe(true)

    const hist = await listMeasurements(custId)
    expect(hist.length).toBe(2)
    expect(hist[0].chestCm).toBe(90)
    expect(hist[1].chestCm).toBe(92)
    expect(await prisma.extensionRecord.count({ where: { organizationId: orgS, customerId: custId, entityKey: "measurement" } })).toBe(2)
  })

  it("2. meritev tuji org → CUSTOMER_NOT_FOUND (IDOR)", async () => {
    const cB = await seedCustomer(orgB, `${RUN}.bee@markec.test`)
    const res = await saveMeasurement({ customerId: cB.id, measuredAt: "2026-01-01", chestCm: 88 })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("CUSTOMER_NOT_FOUND")
    expect(await prisma.extensionRecord.count({ where: { organizationId: orgS, customerId: cB.id } })).toBe(0)
  })

  it("3. naročilo po meri iz povpraševanja — WorkOrder + merilni list + rok + cena", async () => {
    const meas = await listMeasurements(custId)
    const r = await createOrderFromInquiry({
      customerId: custId,
      title: "Obleka po meri",
      description: "Dolga večerna obleka, svila, želeno.",
      agreedPrice: 180,
      deadline: "2026-07-15",
      measurementId: meas[1].id, // zadnja meritev
    })
    expect(r.ok).toBe(true)
    expect(r.workOrderId).toBeTruthy()

    const wo = await prisma.workOrder.findUnique({ where: { id: r.workOrderId! }, include: { linkedRecord: true } })
    expect(wo).not.toBeNull()
    expect(wo!.customerId).toBe(custId)
    expect(wo!.linkedRecordId).toBe(meas[1].id)
    expect(wo!.total?.toString()).toBe("180")
    expect(wo!.notes).toContain("večerna")
    expect(wo!.dueDate).not.toBeNull()
    const firstStage = await prisma.workflowStage.findFirst({ where: { definitionId: wfS }, orderBy: { order: "asc" }, select: { key: true } })
    expect(wo!.currentStageKey).toBe(firstStage!.key)

    const measRec = await prisma.extensionRecord.findUnique({ where: { id: meas[1].id } })
    expect(Array.isArray((measRec!.data as Record<string, unknown>).__workOrderIds)).toBe(true)
    expect(((measRec!.data as Record<string, unknown>).__workOrderIds as unknown[]).length).toBe(1)

    ;(globalThis as Record<string, unknown>).__seam = { woId: r.workOrderId }
  })

  it("4. podvojen nalog iz istega merilnega lista je zavrnjen (ALREADY_CREATED)", async () => {
    const meas = await listMeasurements(custId)
    const r = await createOrderFromInquiry({
      customerId: custId,
      title: "Obleka po meri (kopija)",
      description: "Poskus podvojitve.",
      measurementId: meas[1].id,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("ALREADY_CREATED")
  })

  it("5. naročilo brez merilnega lista — se NE blokira", async () => {
    const c2 = await seedCustomer(orgS, `${RUN}.nomer@markec.test`)
    const r = await createOrderFromInquiry({ customerId: c2.id, title: "Krajšanje hlač", description: "Brez merilnega lista." })
    expect(r.ok).toBe(true)
  })

  it("6. poraba materiala — zaloga se zniža (CAS), ni negativne, ni dvojna", async () => {
    const g = (globalThis as Record<string, unknown>).__seam as { woId: string }
    const before = (await prisma.product.findUnique({ where: { id: matId } }))!.stockQuantity
    const r = await consumeMaterialOnWorkOrder({ workOrderId: g.woId, lines: [{ productId: matId, quantity: 2 }] })
    expect(r.ok).toBe(true)
    expect((await prisma.product.findUnique({ where: { id: matId } }))!.stockQuantity).toBe(before - 2)

    const r2 = await consumeMaterialOnWorkOrder({ workOrderId: g.woId, lines: [{ productId: matId, quantity: 1_000_000 }] })
    expect(r2.ok).toBe(false)
    expect(r2.error).toBe("INSUFFICIENT_STOCK")
    expect((await prisma.product.findUnique({ where: { id: matId } }))!.stockQuantity).toBe(before - 2)
  })

  it("7. sledljivost — stranka, mere, naročilo, materiali", async () => {
    const g = (globalThis as Record<string, unknown>).__seam as { woId: string }
    const prov = await resolveSeamstressProvenance(g.woId)
    expect(prov).not.toBeNull()
    expect(prov!.customer?.name).toBe("Mia Svetlič")
    expect(prov!.measurement).not.toBeNull()
    expect(prov!.measurement!.measuredAt).toBe("2026-06-01")
    expect(prov!.measurement!.values.chest_cm).toBe(92)
    expect(prov!.materials.length).toBe(1)
    expect(prov!.materials[0].lines[0].quantity).toBe(2)
    expect(prov!.materials[0].stockMovements.length).toBe(1)
  })

  it("8. napredovanje → predaja → plačilo → zaključeno", async () => {
    const g = (globalThis as Record<string, unknown>).__seam as { woId: string }
    // Zaporedno napredovanje (samo sosednje stopnje dovoljene).
    const stages = ["measurements", "quote", "approval", "production", "fitting", "delivery", "payment", "done"]
    for (const s of stages) {
      const r = await advanceWorkOrder(g.woId, s)
      expect(r.ok).toBe(true)
    }
    const done = await prisma.workOrder.findUnique({ where: { id: g.woId } })
    expect(done!.status).toBe("COMPLETED")
    expect(done!.currentStageKey).toBe("done")

    const prov = await resolveSeamstressProvenance(g.woId)
    expect(prov!.done).toBe(true)
    expect(prov!.deliveredAt).not.toBeNull()
    expect(prov!.paidAt).not.toBeNull()
  })

  it("9. izolacija — čebelar nima šiviljskih; IDOR na tujem nalogu", async () => {
    const cB = await seedCustomer(orgB, `${RUN}.iso@markec.test`)
    await prisma.extensionRecord.create({ data: { organizationId: orgB, extensionId: "seamstress-measurements", entityKey: "measurement", title: "Tuja meritev", data: { measured_at: "2026-01-01" }, customerId: cB.id } })
    expect(await listMeasurements(cB.id)).toEqual([])

    const woB = await prisma.workOrder.create({ data: { organizationId: orgB, number: 1, title: "Tuj nalog", status: "OPEN", workflowDefinitionId: wfS } })
    const r = await consumeMaterialOnWorkOrder({ workOrderId: woB.id, lines: [{ productId: matId, quantity: 1 }] })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("WORKORDER_NOT_FOUND")
    expect(await resolveSeamstressProvenance(woB.id)).toBeNull()
    // Org S ima le svoje meritve; tuja v org B ni vidna v šiviljski seji.
    expect(await prisma.extensionRecord.count({ where: { organizationId: orgS, customerId: cB.id } })).toBe(0)
  })

  it("10. naročilo SAMA ne odšteje zaloge (le poraba na nalogu)", async () => {
    const before = (await prisma.product.findUnique({ where: { id: matId } }))!.stockQuantity
    await createOrderFromInquiry({ customerId: custId, title: `${RUN} brez porabe`, description: "Nič porabljeno." })
    expect((await prisma.product.findUnique({ where: { id: matId } }))!.stockQuantity).toBe(before)
  })
})