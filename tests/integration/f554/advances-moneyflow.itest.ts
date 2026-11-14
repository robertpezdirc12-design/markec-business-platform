// ============================================================
// F5.5.4.5.1 — PREVERJANJE DENARNEGA TOKA + RAČUNOVODSKE LOGIKE.
//
// Sledimo enemu denarnemu prilivu skozi celoten tok:
//   DocumentPayment(avans) → DocumentAdvanceAllocation →
//   DocumentPayment(končni, method="advance" = INTERNI prenos)
//
// Dokazujemo:
//   • dejanski gotovinski/bančni priliv obstaja NAJVEČ ENKRAT;
//   • prenos na končni račun NI drugi blagajniški priliv (method="advance"
//     je rezervirana interna oznaka, ne npr. cash/card/transfer);
//   • ne podvoji se v getCustomerReceivables;
//   • stanja obeh dokumentov so pravilna;
//   • evidence po stranki so pravilne.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null } },
}))

vi.mock("@/lib/auth/auth", () => ({ auth: async () => state.session, unstable_update: async () => null, handlers: {}, signIn: async () => undefined, signOut: async () => undefined }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import {
  createDocument, changeDocumentStatus, recordDocumentPayment, applyAdvancesToInvoice,
  getDocumentDetail, listDocumentPayments, getCustomerReceivables,
} from "@/app/actions/documents"

const ORGA = "f5545-mf-org"
const ADMA = "f5545-mf-admin"
const CUST = "f5545-mf-cust"

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(rows[0].db).toBe("markec_f554_test")
  await prisma.documentAdvanceAllocation.deleteMany({}).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORGA } })
  await prisma.user.deleteMany({ where: { id: ADMA } })
  await prisma.organization.deleteMany({ where: { id: ORGA } })
  await prisma.organization.create({ data: { id: ORGA, name: ORGA, slug: ORGA } })
  await prisma.user.create({ data: { id: ADMA, email: `${ADMA}@f.test`, name: ADMA, role: "ADMIN", organizationId: ORGA } })
  await prisma.organizationMember.create({ data: { organizationId: ORGA, userId: ADMA, role: "ADMIN", isDefault: true } })
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Salon", isVatRegistered: true, vatId: "SI123" } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana", email: "a@x.si" } })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})

afterAll(async () => {
  await prisma.documentAdvanceAllocation.deleteMany({}).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORGA } })
  await prisma.user.deleteMany({ where: { id: ADMA } })
  await prisma.organization.deleteMany({ where: { id: ORGA } })
  await prisma.$disconnect()
})

const line = (description: string, unitPrice: number, quantity = 1, vatRate?: number) => ({ description, quantity, unitPrice, vatRate })

async function mk(type: "ADVANCE" | "INVOICE", amount: number) {
  const c = await createDocument({ type, customerId: CUST, items: [line("X", amount, 1, 22)] })
  expect(c.ok).toBe(true)
  expect((await changeDocumentStatus(c.id!, "ISSUED")).ok).toBe(true)
  return c.id!
}

describe("1) Denarni tok — avans → prenos na končni → brez dvojnega priliva", () => {
  it("en kontrolerski priliv na avansu; prenos na končnem je INTERNI (method=advance)", async () => {
    const adv = await mk("ADVANCE", 100)
    // 1) Dejanski priliv: 100 € gotovine na avansnem računu.
    const real = await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "MF-REAL-1" })
    expect(real.ok).toBe(true)

    const inv = await mk("INVOICE", 250)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })

    // 2) Plačila dokumentov.
    const advPays = (await listDocumentPayments(adv))!
    const invPays = (await listDocumentPayments(inv))!

    // Samo 1 "real" priliv na avansu; na končnem je zgolj INTERNI prenos.
    const realInflows = [...advPays, ...invPays].filter((p) => p.kind === "PAYMENT" && p.method !== "advance")
    const internalTransfers = invPays.filter((p) => p.method === "advance")
    expect(realInflows).toHaveLength(1)
    expect(realInflows[0].amount).toBe(100)
    expect(realInflows[0].method).toBe("cash")
    expect(realInflows[0].reference).toBe("MF-REAL-1")
    expect(internalTransfers).toHaveLength(1)
    expect(internalTransfers[0].amount).toBe(100)

    // 3) Vsota vseh knjiženih plačil po metodi: gotovina se šteje LE enkrat.
    const cashTotal = [...advPays, ...invPays].filter((p) => p.method === "cash" && p.kind === "PAYMENT").reduce((s, p) => s + p.amount, 0)
    expect(cashTotal).toBe(100)
    // (advance metoda ni "cash"; ne poveča blagajne)
    const advanceTotalEntries = invPays.filter((p) => p.method === "advance" && p.kind === "PAYMENT").reduce((s, p) => s + p.amount, 0)
    expect(advanceTotalEntries).toBe(100)

    // 4) Stanji dokumentov.
    const advD = (await getDocumentDetail(adv))!
    expect(advD.paidAmount).toBe(100)
    expect(advD.status).toBe("PAID")
    const invD = (await getDocumentDetail(inv))!
    expect(invD.paidAmount).toBe(100)
    expect(invD.advanceTotal).toBe(100)
    // F5.5.4.5.2 — odprti znesek BREZ dvojnega odštevanja: avans je ŽE v
    // paidAmount (interni prenos), zato se advanceTotal ne odšteva drugič.
    // openAmount = total − paid − credited = 250 − 100 − 0 = 150.
    expect(invD.openAmount).toBe(150)
    expect(invD.totals.total - invD.paidAmount - invD.creditedTotal).toBe(150)
  })

  it("getCustomerReceivables ne podvoji avansa (odprto = total − paid − credited, paid vklj. prenos)", async () => {
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "transfer", reference: "MF-RECEIV" })
    const inv = await mk("INVOICE", 200)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    // Končni: total 200 - paid 100 (prenos) - credited 0 = 100 odprto.
    const rec = await getCustomerReceivables()
    const row = rec.find((r) => r.customerId === CUST)
    expect(row).toBeDefined()
    expect(row!.openTotal).toBe(100) // enkratno — ne 200, ne 0
    expect(row!.count).toBe(1)
  })
})