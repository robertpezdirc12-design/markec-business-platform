// ============================================================
// F5.5.4.5 — INTEGRACIJSKI TESTI AVANSNIH RAČUNOV + DATUMA STORITVE.
//
// Tečejo na ločeni bazi `markec_f554_test` (nikoli dev/prod). Uporabljajo
// resnične server actions (createDocument, changeDocumentStatus,
// recordDocumentPayment, applyAdvancesToInvoice, reverseDocumentPayment,
// reverseAdvanceAllocation, issueCreditNote, getDocumentDetail …) s mockano
// NextAuth sejo, kot v ostali F5.5.4.x suiti.
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
import {
  createDocument,
  changeDocumentStatus,
  recordDocumentPayment,
  reverseDocumentPayment,
  applyAdvancesToInvoice,
  reverseAdvanceAllocation,
  issueCreditNote,
  getDocumentDetail,
  listDocumentPayments,
  listApplicableAdvances,
} from "@/app/actions/documents"
import { splitAllocation, isSupportedVatRate, servicePeriodLabel, allocationAmountCents } from "@/lib/documents/advances"
import { docNumberLabel } from "@/lib/documents/numbering"

const ORGA = "f5545-org-a"
const ORGB = "f5545-org-b"
const ADMA = "f5545-admin-a"
const ADMB = "f5545-admin-b"
const CUST = "f5545-cust"

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

async function wipe() {
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.documentItem.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.creditNote.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await wipe()
  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  // Org A: DDV zavezanec (22%).
  await prisma.salonConfig.create({
    data: { organizationId: ORGA, name: "Salon A", address: "U1", city: "Ljubljana", zipCode: "1000", country: "SI", email: "a@x.si", vatId: "SI123", isVatRegistered: true, bankAccount: "SI56 0", registrationNumber: "12" },
  })
  // Org B: NI DDV zavezanec.
  await prisma.salonConfig.create({ data: { organizationId: ORGB, name: "Salon B", isVatRegistered: false, currency: "EUR" } })
  await prisma.customer.createMany({ data: [
    { id: CUST, organizationId: ORGA, name: "Ana Novak", email: "ana@x.si", phone: "041111" },
    { id: "f5545-cust-b", organizationId: ORGB, name: "Beta", email: "beta@x.si" },
  ] })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})

afterAll(async () => {
  await wipe()
  await prisma.$disconnect()
})

const line = (description: string, unitPrice: number, quantity = 1, vatRate?: number) => ({
  description, quantity, unitPrice, vatRate,
})

async function mkAdvance(amountBruto: number, vatRate = 22, serviceDate = "2026-05-10") {
  const c = await createDocument({ type: "ADVANCE", customerId: CUST, issueDate: "2026-05-01", serviceDate, items: [line("Avans", amountBruto, 1, vatRate)] })
  expect(c.ok).toBe(true)
  const issued = await changeDocumentStatus(c.id!, "ISSUED")
  expect(issued.ok).toBe(true)
  return c.id!
}

async function mkInvoice(amountBruto: number) {
  const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-06-01", items: [line("Racun", amountBruto, 1, 22)] })
  expect(c.ok).toBe(true)
  const issued = await changeDocumentStatus(c.id!, "ISSUED")
  expect(issued.ok).toBe(true)
  return c.id!
}

// ============================================================
describe("0) Čisto jedro (advances.ts)", () => {
  it("splitAllocation — 22% DDV iz bruto", () => {
    const s = splitAllocation(100, 22, true)
    expect(s.taxBase).toBeCloseTo(81.97, 2)
    expect(s.taxTotal).toBeCloseTo(18.03, 2)
  })
  it("splitAllocation — nezavezanec → DDV 0", () => {
    const s = splitAllocation(100, 22, false)
    expect(s.taxBase).toBe(100)
    expect(s.taxTotal).toBe(0)
  })
  it("allocationAmountCents — ne preseže odprtega", () => {
    expect(allocationAmountCents(10000, 5000)).toBe(5000)
    expect(allocationAmountCents(5000, 10000)).toBe(5000)
    expect(allocationAmountCents(0, 5000)).toBe(0)
  })
  it("isSupportedVatRate — 22/9.5/5/0 dovoljeno, posebne prepovedane", () => {
    expect(isSupportedVatRate(22)).toBe(true)
    expect(isSupportedVatRate(9.5)).toBe(true)
    expect(isSupportedVatRate(5)).toBe(true)
    expect(isSupportedVatRate(0)).toBe(true)
    expect(isSupportedVatRate(13.2)).toBe(false) // posebni režim → blokiraj
  })
  it("servicePeriodLabel loči od izdaje", () => {
    expect(servicePeriodLabel(null, new Date("2026-06-01"), new Date("2026-06-05"))).toBe("2026-06-01 – 2026-06-05")
    expect(servicePeriodLabel(new Date("2026-06-03"), null, null)).toBe("2026-06-03")
  })
})

// ============================================================
describe("1) En avans — izdaja, DDV, prejeta plačila, aplikacija na končni", () => {
  it("avansni račun: AVN serija, DDV, serviceDate; aplikacija zmanjša odprto", async () => {
    // Avans 100 € bruto (22% DDV).
    const adv = await mkAdvance(100, 22, "2026-05-10")
    const advDetail = await getDocumentDetail(adv)
    expect(advDetail!.docCode.startsWith("AVN-")).toBe(true)
    expect(advDetail!.serviceDate).toBe("2026-05-10")
    expect(advDetail!.totals.total).toBe(100)
    expect(advDetail!.totals.taxTotal).toBeCloseTo(18.03, 2)
    expect(advDetail!.totals.taxBase).toBeCloseTo(81.97, 2)

    // Prejeto predplačilo — polno (100 €).
    const pay = await recordDocumentPayment(adv, { amount: 100, method: "transfer", reference: "REF-A1" })
    expect(pay.ok).toBe(true)
    const pays = await listDocumentPayments(adv)
    expect(pays!.filter((p) => p.kind === "PAYMENT").reduce((s, p) => s + p.amount, 0)).toBe(100)

    // Končni račun 250 € (22%).
    const inv = await mkInvoice(250)
    const app = await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    expect(app.ok).toBe(true)
    expect(app.advanceTotal).toBe(100)

    // Plačilo na končnem je switched (paidAmount=100), odprto = 250-100-0-100 = 150.
    const invDetail = await getDocumentDetail(inv)
    expect(invDetail!.advanceTotal).toBe(100)
    expect(invDetail!.paidAmount).toBe(100)
    const invPays = await listDocumentPayments(inv)
    expect(invPays!.filter((p) => p.method === "advance").length).toBe(1)
  })

  it("dvojna uporaba istega avansa je zavrnjena (ADVANCE_ALREADY_USED)", async () => {
    const adv = await mkAdvance(100)
    await recordDocumentPayment(adv, { amount: 100, method: "transfer", reference: "REF-D1" })
    const inv1 = await mkInvoice(200)
    const inv2 = await mkInvoice(300)
    const a1 = await applyAdvancesToInvoice(inv1, { advanceIds: [adv] })
    expect(a1.ok).toBe(true)
    // Drugi končni račun → isti avans ne sme biti uporabljen.
    const a2 = await applyAdvancesToInvoice(inv2, { advanceIds: [adv] })
    expect(a2.ok).toBe(false)
    expect(a2.error).toBe("ADVANCE_ALREADY_USED")
  })
})

// ============================================================
describe("2) Več avansov + delna plačila", () => {
  it("dva avansa aplicirana na en končni; skupna advanceTotal", async () => {
    const a1 = await mkAdvance(50)
    const a2 = await mkAdvance(30)
    await recordDocumentPayment(a1, { amount: 50, method: "cash", reference: "R1" })
    await recordDocumentPayment(a2, { amount: 30, method: "cash", reference: "R2" })
    const inv = await mkInvoice(200)
    const app = await applyAdvancesToInvoice(inv, { advanceIds: [a1, a2] })
    expect(app.ok).toBe(true)
    expect(app.advanceTotal).toBe(80)
    const invDetail = await getDocumentDetail(inv)
    expect(invDetail!.advanceTotal).toBe(80)
    expect(invDetail!.paidAmount).toBe(80)
  })

  it("delno prejeta avansna vsota: uporabimo samo dejansko prejeto", async () => {
    // Avans znesek 100, ampak stranka je plačala le 40.
    const adv = await mkAdvance(100)
    await recordDocumentPayment(adv, { amount: 40, method: "cash", reference: "REF-P" })
    const inv = await mkInvoice(300)
    const app = await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    expect(app.ok).toBe(true)
    // Aplicira se le prejeto = 40 (ne znesek avant 100).
    expect(app.advanceTotal).toBe(40)
  })
})

// ============================================================
describe("3) Vsa plačila + storno", () => {
  it("polno plačilo računa po aplikaciji → PAID; storno avansa → open naraste", async () => {
    const adv = await mkAdvance(100)
    await recordDocumentPayment(adv, { amount: 100, method: "transfer", reference: "REF-F" })
    const inv = await mkInvoice(200)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    // Doplačilo 100 → PAID.
    const pay = await recordDocumentPayment(inv, { amount: 100, method: "cash", reference: "REF-RE" })
    expect(pay.ok).toBe(true)
    const d = await getDocumentDetail(inv)
    expect(d!.status).toBe("PAID")

    // Storno avansne aplikacije → odprto = 200.
    const rev = await reverseAdvanceAllocation(inv, adv, "preklic")
    expect(rev.ok).toBe(true)
    const d2 = await getDocumentDetail(inv)
    expect(d2!.advanceTotal).toBe(0)
    expect(d2!.paidAmount).toBe(100) // samo doplačilo ostane
  })
})

// ============================================================
describe("4) Dobropis + datumi + nespremenljivost", () => {
  it("dobropis na končni račun zmanjša creditedTotal", async () => {
    const inv = await mkInvoice(100)
    const cn = await issueCreditNote(inv, { amount: 25, reason: "vracilo" })
    expect(cn.ok).toBe(true)
    const d = await getDocumentDetail(inv)
    expect(d!.creditedTotal).toBe(25)
  })
  it("datum storitve ni zamenjan z datumom izdaje/plačilom", async () => {
    const adv = await mkAdvance(30, 22, "2026-07-15")
    await recordDocumentPayment(adv, { amount: 30, method: "cash", reference: "REF-S" })
    const inv = await mkInvoice(60)
    const di = await getDocumentDetail(inv)
    expect(di!.serviceDate).toBeNull() // končni brez serviceDate
  })
  it("izdan avansni račun ne sme biti izbrisan", async () => {
    const adv = await mkAdvance(10)
    await recordDocumentPayment(adv, { amount: 10, method: "cash", reference: "REF-X" })
    const { deleteDocument } = await import("@/app/actions/documents")
    const del = await deleteDocument(adv)
    expect(del.ok).toBe(false)
    expect(del.error).toBe("LOCKED_AFTER_ISSUE")
  })
})

// ============================================================
describe("5) Več organizacij — izolacija", () => {
  it("avans org B ni apliciran na račun org A", async () => {
    // Avans v org A.
    const advA = await mkAdvance(40)
    await recordDocumentPayment(advA, { amount: 40, method: "cash", reference: "REF-ISO" })
    // Preklop v org B — sestavimo končni račun v org B (stranka org B).
    state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
    const cB = await createDocument({ type: "INVOICE", customerId: "f5545-cust-b", issueDate: "2026-06-01", items: [line("Racun B", 90, 1, 22)] })
    expect(cB.ok).toBe(true)
    const issuedB = await changeDocumentStatus(cB.id!, "ISSUED")
    expect(issuedB.ok).toBe(true)
    // Avans org A (ne sme biti dosegljiv v org B).
    const app = await applyAdvancesToInvoice(cB.id!, { advanceIds: [advA] })
    expect(app.ok).toBe(false)
    expect(["NOT_FOUND_ADVANCE", "NOT_FOUND"]).toContain(app.error)
  })
})

// ============================================================
describe("6) DocNumberLabel — AVN serija", () => {
  it("prefix AVN za ADVANCE, ločeno po letu", () => {
    expect(docNumberLabel("ADVANCE", 2026, 1)).toBe("AVN-0001/2026")
    expect(docNumberLabel("ADVANCE", 2027, 3)).toBe("AVN-0003/2027")
    expect(docNumberLabel("INVOICE", 2026, 4)).toBe("RAC-0004/2026")
  })
})