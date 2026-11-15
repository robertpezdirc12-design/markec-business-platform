// ============================================================
// F5.5.4.1 — INTEGRACIJSKI TESTI VARNOSTI IN PRAVILNOSTI DOKUMENTOV.
//
// Tečejo na ločeni bazi `markec_f554_test` (nikoli dev/prod). Kličejo
// resnične server actions iz documents.ts (create/update/issue/convert/
// delete) + čiste denarne jedro. Seja (NextAuth) je mockana — org
// izolacija, posnetki, zaklep po ISSUED, številčenje in IDOR tečejo
// skozi pravi Prisma klient.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null }
  },
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { computeDocument, round2 } from "@/lib/documents/money"
import {
  createDocument,
  updateDocument,
  deleteDocument,
  changeDocumentStatus,
  getDocumentDetail,
  getDocumentsOverview,
  listDocumentCustomers,
} from "@/app/actions/documents"

const ORGA = "f554-org-a"
const ORGB = "f554-org-b"
const ADMA = "f554-admin-a"
const ADMB = "f554-admin-b"
const STAFFA = "f554-staff-a"        // ADMIN poln (privzete pravice)
const RESTRICTED = "f554-restricted" // STAFF s custom rolo brez finances.*
const ROLE_RESTRICTED = "f554-role-r"
const CUST = "f554-cust"
const STAFFROW = "f554-staff-row"

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test"]).toContain(rows[0].db)
  // Cleanup (FK varnostni red).
  await prisma.documentItem.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.order.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFFA, RESTRICTED] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })

  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  await prisma.salonConfig.create({
    data: {
      organizationId: ORGA,
      name: "Frizerski salon A",
      currency: "EUR",
      address: "Ulica 1",
      city: "Ljubljana",
      zipCode: "1000",
      country: "SI",
      email: "a@salon.si",
      phone: "041000",
      vatId: "SI12345678",
      isVatRegistered: true, // org A je DDV zavezanec
      bankAccount: "SI56 0000 0000 0000 000",
      registrationNumber: "12345678",
    },
  })
  // Org B NI DDV zavezanec.
  await prisma.salonConfig.create({
    data: { organizationId: ORGB, name: "Savt A", currency: "EUR", isVatRegistered: false, address: "Pot 2", city: "Novo mesto", zipCode: "8000", country: "SI" },
  })
  await prisma.customer.createMany({ data: [
    { id: CUST, organizationId: ORGA, name: "Ana Novak", email: "ana@x.si", phone: "041111", },
    { id: "f554-cust-b", organizationId: ORGB, name: "Beta", email: "beta@x.si" },
  ] })

  // STAFF s polno vlogo (privzete: vse pravice) + omejena custom-rola.
  await prisma.user.createMany({ data: [{ id: STAFFA, email: `${STAFFA}@f.test`, name: "Staff", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: STAFFA, role: "STAFF" }] })
  await prisma.staff.create({ data: { id: STAFFROW, name: "Neka Oseba", organizationId: ORGA, userId: STAFFA, isActive: true } })
  await prisma.customRole.create({ data: { id: ROLE_RESTRICTED, organizationId: ORGA, name: "Brez finanč", permissions: ["appointments.view"] } })
  await prisma.user.createMany({ data: [{ id: RESTRICTED, email: `${RESTRICTED}@f.test`, name: "Restricted", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: RESTRICTED, role: "STAFF", customRoleId: ROLE_RESTRICTED }] })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.update({ where: { id: CUST }, data: { name: "Ana Novak", email: "ana@x.si", phone: "041111" } })
  // Ponastavi davčno konfiguracijo org A (testi 2/6 jo spremenijo).
  await prisma.salonConfig.update({
    where: { organizationId: ORGA },
    data: { name: "Frizerski salon A", vatId: "SI12345678", bankAccount: "SI56 0000 0000 0000 000", registrationNumber: "12345678", isVatRegistered: true },
  })
})

afterAll(async () => {
  await prisma.documentItem.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.order.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFFA, RESTRICTED] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
  await prisma.$disconnect()
})

function asOrgB() {
  state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
}
function asStaff() {
  state.session = { user: { id: STAFFA, role: "STAFF", organizationId: ORGA, email: "s@f.test" } }
}
function asRestricted() {
  state.session = { user: { id: RESTRICTED, role: "STAFF", organizationId: ORGA, email: "r@f.test" } }
}

const line = (description: string, unitPrice: number, quantity = 1, vatRate?: number, discountPercent?: number) => ({
  description, quantity, unitPrice, vatRate, discountPercent,
})

// ============================================================
describe("0) Čisto denarno jedro (money.ts)", () => {
  it("round2 je HALF-UP na 2 decimalki", () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.5)).toBe(2.5)
    expect(round2(0.125)).toBe(0.13)
  })
  it("DDV zavezanec: bruto total = osnova + DDV; obratni DDV", () => {
    // 100,00 € bruto z 22% DDV vključeno → neto ~81,97, DDV ~18,03.
    const r = computeDocument([line("S", 100, 1, 22)], true)
    expect(r.totals.total).toBe(100)
    expect(r.totals.subtotal).toBe(100)
    expect(r.totals.taxBase).toBeCloseTo(81.97, 2)
    expect(r.totals.taxTotal).toBeCloseTo(18.03, 2)
  })
  it("Nezavezanec: DDV = 0, total = osnova", () => {
    const r = computeDocument([line("S", 100, 1, 22)], false)
    expect(r.totals.taxTotal).toBe(0)
    expect(r.totals.taxBase).toBe(100)
    expect(r.totals.total).toBe(100)
  })
  it("Popust po liniji zmanjša osnovo in DDV", () => {
    const r = computeDocument([line("S", 100, 1, 22, 10)], true) // 10% popust → bruto 90
    expect(r.totals.total).toBe(90)
    expect(r.totals.discountAmount).toBe(10)
    expect(r.totals.taxBase).toBeCloseTo(73.77, 2)
  })
  it("Cene se zaokrožijo kot bruto z DDV vključeno", () => {
    const r = computeDocument([line("S", 9.99, 3, 22)], true)
    expect(r.totals.total).toBe(round2(29.97))
  })
})

// ============================================================
describe("1) Nespremenljivost — sprememba stranke po izdaji", () => {
  it("po ISSUED sprememba imena/e-pošte stranke NE spremeni izdanega računa", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-03-01", dueDate: "2026-04-01", items: [line("Storitev", 100, 1, 22)] })
    expect(c.ok).toBe(true)
    const issued = await changeDocumentStatus(c.id!, "ISSUED")
    expect(issued.ok).toBe(true)
    // Spremenimo stranko (živi Customer).
    await prisma.customer.update({ where: { id: CUST }, data: { name: "POVSEM DRUGO IME", email: "drugi@x.si" } })
    const d = await getDocumentDetail(c.id!)
    expect(d!.customer!.name).toBe("Ana Novak")
    expect(d!.customer!.email).toBe("ana@x.si")
    expect(d!.customer!.fromSnapshot).toBe(true)
    expect(d!.issuer!.name).toBe("Frizerski salon A")
  })
})

// ============================================================
describe("2) Nespremenljivost — sprememba salona po izdaji", () => {
  it("po ISSUED sprememba podatkov salona (naziv, DDV, IBAN) NE spremeni izdanega računa", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-03-01", items: [line("S", 100, 1, 22)] })
    await changeDocumentStatus(c.id!, "ISSUED")
    await prisma.salonConfig.update({ where: { organizationId: ORGA }, data: { name: "Novo ime salona", vatId: "SI999", bankAccount: "SI99", isVatRegistered: false } })
    const d = await getDocumentDetail(c.id!)
    expect(d!.issuer!.name).toBe("Frizerski salon A")
    expect(d!.issuer!.vatId).toBe("SI12345678")
    expect(d!.issuer!.bankAccount).toBe("SI56 0000 0000 0000 000")
    expect(d!.issuer!.isVatRegistered).toBe(true)
  })
})

// ============================================================
describe("3) Nespremenljivost — cene in davčne stopnje", () => {
  it("po ISSUED sprememba vrstic (cena, DDV) ni mogoča; dokument ostane identičen", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S1", 50, 2, 22), line("S2", 30, 1, 9.5)] })
    await changeDocumentStatus(c.id!, "ISSUED")
    // updateDocument mora biti zavrnjen po ISSUED.
    const upd = await updateDocument(c.id!, { type: "INVOICE", customerId: CUST, items: [line("SPREJ", 999, 1, 0)] })
    expect(upd.ok).toBe(false)
    expect(upd.error).toBe("LOCKED_AFTER_ISSUE")
    // deleteDocument prav tako zavrnjen.
    const del = await deleteDocument(c.id!)
    expect(del.ok).toBe(false)
    // Vrstice ostanejo nespremenjene.
    const d = await getDocumentDetail(c.id!)
    expect(d!.items).toHaveLength(2)
    expect(d!.items[0].unitPrice).toBe(50)
    expect(d!.items[0].vatRate).toBe(22)
    expect(d!.items[1].vatRate).toBe(9.5)
  })
})

// ============================================================
describe("4) DRAFT — urejanje in brisanje", () => {
  it("DRAFT je mogoče urediti in izbrisati; ISSUED zaklenjen", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("A", 10)] })
    const upd = await updateDocument(c.id!, { type: "INVOICE", customerId: CUST, items: [line("B", 25), line("C", 5)] })
    expect(upd.ok).toBe(true)
    const d = await getDocumentDetail(c.id!)
    expect(d!.items).toHaveLength(2)
    expect(d!.items[0].description).toBe("B")
    expect(d!.totals.total).toBe(30)
    // Brisanje DRAFT.
    const del = await deleteDocument(c.id!)
    expect(del.ok).toBe(true)
    expect(await getDocumentDetail(c.id!)).toBeNull()
  })
})

// ============================================================
describe("5) Številčenje — poslovno leto in hkratno izdajanje", () => {
  it("uničen? — številčenje per org+tip+leto: DVA dokumenta istega leta dobita 1 in 2; naslednje leto spet 1", async () => {
    const a = await createDocument({ type: "INVOICE", issueDate: "2026-01-01", customerId: CUST, items: [line("X", 10)] })
    const b = await createDocument({ type: "INVOICE", issueDate: "2026-02-01", customerId: CUST, items: [line("Y", 10)] })
    const ya = await createDocument({ type: "INVOICE", issueDate: "2027-01-01", customerId: CUST, items: [line("Z", 10)] })
    const da = await getDocumentDetail(a.id!)
    const db = await getDocumentDetail(b.id!)
    const dy = await getDocumentDetail(ya.id!)
    expect(da!.number).toBe(1)
    expect(da!.fiscalYear).toBe(2026)
    expect(db!.number).toBe(2)
    expect(db!.fiscalYear).toBe(2026)
    expect(dy!.number).toBe(1) // novo leto se začne z 1
    expect(dy!.fiscalYear).toBe(2027)
    // unikatna kombinacija org+tip+leto+številka — naravno edinstvena.
  })

  it("hkratno izdajanje je zaporedno (no duplicated numbers) — 20 vzporednih", async () => {
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createDocument({
          type: "INVOICE",
          issueDate: "2026-03-15",
          customerId: CUST,
          items: [line(`R${i}`, 10)],
        })
      )
    )
    expect(created.every((r) => r.ok)).toBe(true)
    const ids = created.map((r) => r.id!)
    const docs = await prisma.document.findMany({ where: { id: { in: ids } }, select: { number: true, fiscalYear: true } })
    const numbers = docs.map((d) => `${d.fiscalYear}-${d.number}`)
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

// ============================================================
describe("6) DDV zavezanec in nezavezanec", () => {
  it("org A (zavezanec) izračuna DDV; org B (nezavezanec) ima DDV 0", async () => {
    const a = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 100, 1, 22)] })
    const da = await getDocumentDetail(a.id!)
    expect(da!.totals.vatEnabled).toBe(true)
    expect(da!.totals.taxTotal).toBeGreaterThan(0)
    // Org B (nezavezanec) s svojim strankom.
    asOrgB()
    const b = await createDocument({ type: "INVOICE", customerId: "f554-cust-b", items: [line("T", 100, 1, 22)] })
    expect(b.ok).toBe(true)
    const db = await getDocumentDetail(b.id!)
    expect(db!.totals.vatEnabled).toBe(false)
    expect(db!.totals.taxTotal).toBe(0)
    expect(db!.totals.total).toBe(100)
  })
})

// ============================================================
describe("7) Povezave (Order/Appointment/WorkOrder) + org izolacija", () => {
  it("dokument se lahko poveže z Order, Appointment in WorkOrder, a SAMO v svoji org", async () => {
    const wo = await prisma.workOrder.create({ data: { organizationId: ORGA, number: 1, title: "Servis", status: "OPEN" } })
    const order = await prisma.order.create({ data: { organizationId: ORGA, customerId: CUST, subtotal: 10, tax: 0, total: 10, status: "PAID" } })
    const appt = await prisma.appointment.create({ data: { staffId: STAFFROW, customerId: CUST, organizationId: ORGA, startTime: new Date(), endTime: new Date(Date.now() + 3600e3), totalPrice: 10, status: "COMPLETED" } })

    const c = await createDocument({
      type: "INVOICE", customerId: CUST, workOrderId: wo.id, orderId: order.id, appointmentId: appt.id, items: [line("S", 10)],
    })
    expect(c.ok).toBe(true)
    const d = await getDocumentDetail(c.id!)
    expect(d!.workOrder!.id).toBe(wo.id)
    expect(d!.order!.id).toBe(order.id)
    expect(d!.appointment!.id).toBe(appt.id)

    // IDOR: povezava na tuje naročilo iz druge org mora biti zavrnjena.
    asOrgB()
    const orderB = await prisma.order.create({ data: { organizationId: ORGB, customerId: "f554-cust-b", subtotal: 5, tax: 0, total: 5, status: "PAID" } })
    const bad = await createDocument({ type: "INVOICE", customerId: "f554-cust-b", orderId: order.id, items: [line("S", 10)] }) // tuje naročilo org A!
    expect(bad.ok).toBe(false)
    expect(bad.error).toBe("NOT_FOUND_ORDER")
    void orderB
  })
})

// ============================================================
describe("8) IDOR + org izolacija + neposredni klici", () => {
  it("org B ne vidi/ne upravlja dokumenta org A", async () => {
    const a = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 10)] })
    asOrgB()
    expect(await getDocumentDetail(a.id!)).toBeNull()
    const upd = await updateDocument(a.id!, { type: "INVOICE", customerId: "f554-cust-b", items: [line("X", 1)] })
    expect(upd.ok).toBe(false)
    const iss = await changeDocumentStatus(a.id!, "ISSUED")
    expect(iss.ok).toBe(false)
    const del = await deleteDocument(a.id!)
    expect(del.ok).toBe(false)
  })
  it("IDOR prek listDocumentCustomers", async () => {
    asOrgB()
    const c = await listDocumentCustomers()
    expect(c.find((x) => x.id === CUST)).toBeUndefined()
  })
})

// ============================================================
describe("9) STAFF matrika dovoljenj", () => {
  it("STAFF s polno vlogo (finances.documents.manage) sme ustvarjati in izdajati", async () => {
    asStaff()
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 50)] })
    expect(c.ok).toBe(true)
    expect((await changeDocumentStatus(c.id!, "ISSUED")).ok).toBe(true)
  })
  it("STAFF z omejeno rolo (brez finances.*) je zavrnjen (fail-closed) za branje IN pisanje", async () => {
    asRestricted()
    await expect(createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 1)] })).rejects.toThrow()
    await expect(getDocumentsOverview()).rejects.toThrow()
    await expect(listDocumentCustomers()).rejects.toThrow()
  })
  it("STAFF a privilégié READ vendar ne WRITE (custom rola z finances.view) ne sme ustvariti", async () => {
    // Ustvari custom rolo z le finances.view.
    const role = await prisma.customRole.create({ data: { organizationId: ORGA, name: "View only", permissions: ["finances.view"] } })
    await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: ORGA, userId: RESTRICTED } }, data: { customRoleId: role.id } })
    asRestricted()
    // view deluje
    expect((await getDocumentsOverview()).quotes.length).toBeGreaterThanOrEqual(0)
    // pisati ne sme
    await expect(createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 1)] })).rejects.toThrow()
  })
})

// ============================================================
describe("10) Manipulacija z zneski prek odjemalca", () => {
  it("server izračuna total — odjemalec ne more poslati svojega totala", async () => {
    // createDocument sprejme le postavke, ne totala; strežnik izračuna.
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 33.33, 3)] })
    expect(c.ok).toBe(true)
    const d = await getDocumentDetail(c.id!)
    expect(d!.totals.total).toBe(round2(99.99))
    expect(d!.items[0].total).toBe(round2(99.99))
  })
  it("issueDate se ne sme spreminjati po izdaji (fiscalYear fiksen)", async () => {
    const c = await createDocument({ type: "INVOICE", issueDate: "2026-01-01", customerId: CUST, items: [line("S", 10)] })
    await changeDocumentStatus(c.id!, "ISSUED")
    const d = await getDocumentDetail(c.id!)
    expect(d!.fiscalYear).toBe(2026)
    // update zavrnjen
    const upd = await updateDocument(c.id!, { type: "INVOICE", issueDate: "2030-01-01", customerId: CUST, items: [line("X", 1)] })
    expect(upd.ok).toBe(false)
  })
})