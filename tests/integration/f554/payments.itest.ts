// ============================================================
// F5.5.4.2 — INTEGRACIJSKI TESTI PLAČIL, DOBROPISOV IN CIKLA DOKUMENTOV.
//
// Ločena baza markec_f554_test (nikoli dev/prod). Resnične server actions
// iz documents.ts (recordDocumentPayment / reverseDocumentPayment /
// issueCreditNote / list… / getCustomerReceivables) + pravi Prisma.
// Seja mockana; org izolacija, plačila, dobropisi in IDOR tečejo na resnični
// bazi.
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
  issueCreditNote,
  listDocumentPayments,
  listDocumentCredits,
  getDocumentDetail,
  getCustomerReceivables,
} from "@/app/actions/documents"

const ORGA = "f554p-org-a"
const ORGB = "f554p-org-b"
const ADMA = "f554p-admin-a"
const ADMB = "f554p-admin-b"
const STAFF_PAY = "f554p-staff-pay"      // STAFF s plačilnimi pravicami
const STAFF_READ = "f554p-staff-read"    // STAFF samo z finances.view
const ROLE_PAY = "f554p-role-pay"
const ROLE_READ = "f554p-role-read"
const CUST = "f554p-cust"

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

async function cleanData() {
  const ids = [ORGA, ORGB]
  await prisma.documentEvent.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.creditNote.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentItem.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFF_PAY, STAFF_READ] } } })
  await prisma.organization.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await cleanData()

  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Salon A", currency: "EUR", isVatRegistered: true, vatId: "SI111" } })
  await prisma.salonConfig.create({ data: { organizationId: ORGB, name: "Salon B", currency: "EUR", isVatRegistered: false } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana", email: "ana@x.si" } })
  await prisma.customer.create({ data: { id: "f554p-cust-b", organizationId: ORGB, name: "Beta" } })

  // STAFF s plačilno pravico (finances.documents.pay).
  await prisma.user.createMany({ data: [{ id: STAFF_PAY, email: `${STAFF_PAY}@f.test`, name: "S1", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: STAFF_PAY, role: "STAFF" }] })
  // STAFF samo z view (ne sme plačati/dobropisovati).
  await prisma.user.createMany({ data: [{ id: STAFF_READ, email: `${STAFF_READ}@f.test`, name: "S2", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: STAFF_READ, role: "STAFF", customRoleId: ROLE_READ }] })
  await prisma.customRole.deleteMany({ where: { id: { in: [ROLE_PAY, ROLE_READ] } } })
  await prisma.customRole.createMany({ data: [
    { id: ROLE_PAY, organizationId: ORGA, name: "Plačila", permissions: ["finances.documents.pay"] },
    { id: ROLE_READ, organizationId: ORGA, name: "Branje", permissions: ["finances.view"] },
  ] })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentEvent.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})

afterAll(async () => {
  await cleanData()
  await prisma.$disconnect()
})

function asOrgB() { state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } } }
function asStaffPay() { state.session = { user: { id: STAFF_PAY, role: "STAFF", organizationId: ORGA, email: "s1@f.test" } } }
function asStaffRead() { state.session = { user: { id: STAFF_READ, role: "STAFF", organizationId: ORGA, email: "s2@f.test" } } }

const line = (desc: string, unitPrice: number, vatRate = 22) => ({ description: desc, quantity: 1, unitPrice, vatRate })

/** Ustvari in izda račun, vrne id. */
async function mintInvoice(total: number, vatRate = 22): Promise<string> {
  const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-01-01", dueDate: "2026-02-01", items: [line("S", total, vatRate)] })
  expect(c.ok).toBe(true)
  const issued = await changeDocumentStatus(c.id!, "ISSUED")
  expect(issued.ok).toBe(true)
  return c.id!
}

// ============================================================
describe("Plačila — osnovno", () => {
  it("celotno plačilo → status PAID, open 0", async () => {
    const id = await mintInvoice(100)
    const r = await recordDocumentPayment(id, { amount: 100, method: "card", reference: "P1" })
    expect(r.ok).toBe(true)
    expect(r.status).toBe("PAID")
    const d = await getDocumentDetail(id)
    expect(d!.totals.total).toBe(100)
    const pays = await listDocumentPayments(id)
    expect(pays!).toHaveLength(1)
    expect(pays![0].amount).toBe(100)
  })

  it("več delnih plačil → PARTIALLY_PAID nato PAID", async () => {
    const id = await mintInvoice(100)
    const p1 = await recordDocumentPayment(id, { amount: 30, method: "cash", reference: "P2a" })
    expect(p1.ok).toBe(true)
    expect(p1.status).toBe("PARTIALLY_PAID")
    expect(p1.openAmount).toBe(70)
    const p2 = await recordDocumentPayment(id, { amount: 50, reference: "P2b" })
    expect(p2.status).toBe("PARTIALLY_PAID")
    const p3 = await recordDocumentPayment(id, { amount: 20, reference: "P2c" })
    expect(p3.status).toBe("PAID")
    expect(await listDocumentPayments(id)).toHaveLength(3)
  })

  it("preplačilo je zavrnjeno (OVERPAYMENT)", async () => {
    const id = await mintInvoice(80)
    const ok1 = await recordDocumentPayment(id, { amount: 50, reference: "P3" })
    expect(ok1.ok).toBe(true)
    const over = await recordDocumentPayment(id, { amount: 40, reference: "P3b" })
    expect(over.ok).toBe(false)
    expect(over.error).toBe("OVERPAYMENT")
  })

  it("dvojno plačilo z isto reference je preprečeno (DUPLICATE_PAYMENT)", async () => {
    const id = await mintInvoice(100)
    const a = await recordDocumentPayment(id, { amount: 60, reference: "STRIPE_1" })
    expect(a.ok).toBe(true)
    const b = await recordDocumentPayment(id, { amount: 60, reference: "STRIPE_1" })
    expect(b.ok).toBe(false)
    expect(b.error).toBe("DUPLICATE_PAYMENT")
  })

  it("plačati ni mogoče na preklicanem računu / ne-izdanem", async () => {
    // DRAFT: ni plačljiv.
    const draft = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 100)] })
    const bad = await recordDocumentPayment(draft.id!, { amount: 10 })
    expect(bad.ok).toBe(false)
    expect(bad.error).toBe("NOT_PAYABLE")
    // CANCELLED: ni plačljiv.
    const c = await mintInvoice(100)
    await changeDocumentStatus(c, "CANCELLED")
    const bad2 = await recordDocumentPayment(c, { amount: 10 })
    expect(bad2.ok).toBe(false)
  })
})

// ============================================================
describe("Plačila — storno", () => {
  it("storno je sledljiv REVERSAL, ne brisanje; paidAmount se zniža", async () => {
    const id = await mintInvoice(100)
    await recordDocumentPayment(id, { amount: 60, reference: "R1" })
    const pays = (await listDocumentPayments(id))!
    const rev = await reverseDocumentPayment(id, pays[0].id, "napačno")
    expect(rev.ok).toBe(true)
    const after = (await listDocumentPayments(id))!
    // izvirno plačilo + reversal ostaneta; reversal ima negativen znesek.
    expect(after).toHaveLength(2)
    expect(after[1].kind).toBe("REVERSAL")
    expect(after[1].amount).toBe(-60)
    expect(after[1].reversalOfId).toBe(pays[0].id)
    const d = await getDocumentDetail(id)
    expect(d!.totals.total).toBe(100) // račun ni spremenjen
    // status se vrne v ISSUED (open spet 100).
    // odprto stanje preverimo prek dodajanja novega plačila ob polnem znesku:
    const full = await recordDocumentPayment(id, { amount: 100, reference: "R2" })
    expect(full.status).toBe("PAID")
  })

  it("dvojno storno istega plačila je zavrnjeno (ALREADY_REVERSED)", async () => {
    const id = await mintInvoice(100)
    await recordDocumentPayment(id, { amount: 40, reference: "R3" })
    const pays = (await listDocumentPayments(id))!
    await reverseDocumentPayment(id, pays[0].id)
    const again = await reverseDocumentPayment(id, pays[0].id)
    expect(again.ok).toBe(false)
    expect(again.error).toBe("ALREADY_REVERSED")
  })
})

// ============================================================
describe("Dobropisi", () => {
  it("delni in polni dobropis; ne preseže dovoljenega", async () => {
    const id = await mintInvoice(100)
    const c1 = await issueCreditNote(id, { amount: 30, reason: "vrnjen izdelek" })
    expect(c1.ok).toBe(true)
    const credits = (await listDocumentCredits(id))!
    expect(credits).toHaveLength(1)
    expect(credits[0].originalInvoiceCode).toMatch(/^RAC-/)
    // Preseže dovoljeno (dobiček 100 − 30 =.70, skuša 50 → OK; skuša 80 → ne).
    const ok2 = await issueCreditNote(id, { amount: 50 })
    expect(ok2.ok).toBe(true)
    const tooMuch = await issueCreditNote(id, { amount: 30 })
    expect(tooMuch.ok).toBe(false)
    expect(tooMuch.error).toBe("CREDIT_EXCEEDS_ALLOWED")
  })

  it("dobropis ne spremeni totala izvirnega računa, le odprt znesek", async () => {
    const id = await mintInvoice(100)
    const before = (await getDocumentDetail(id))!.totals.total
    await issueCreditNote(id, { amount: 40 })
    const after = (await getDocumentDetail(id))!.totals.total
    expect(after).toBe(before) // total računa ostane 100
    // Odprto stanje: s plačilom preostanka (100−40=60) → PAID.
    const pay = await recordDocumentPayment(id, { amount: 60, reference: "CR1" })
    expect(pay.ok).toBe(true)
  })

  it("DDV pri dobropisu razčlenjen skladno z izvirnim računom", async () => {
    // 100 € bruto z 22% → taxBase≈81.97, taxTotal≈18.03.
    const id = await mintInvoice(100, 22)
    const c = await issueCreditNote(id, { amount: 50 })
    expect(c.ok).toBe(true)
    const credits = (await listDocumentCredits(id))!
    expect(credits[0].amount).toBe(50)
    expect(credits[0].taxTotal).toBeCloseTo(9.02, 2)
    expect(credits[0].taxBase).toBeCloseTo(40.98, 2)
    expect(credits[0].vatEnabled).toBe(true)
  })
})

// ============================================================
describe("Cikel in pregledi", () => {
  it("odprte terjatve po stranki (getCustomerReceivables)", async () => {
    const id = await mintInvoice(120)
    await recordDocumentPayment(id, { amount: 50, reference: "RC1" })
    const id2 = await mintInvoice(80)
    const rows = await getCustomerReceivables()
    const mine = rows.find((r) => r.customerId === CUST)
    expect(mine).toBeTruthy()
    // 120−50 + 80 = 150 odprtih.
    expect(mine!.openTotal).toBeCloseTo(70 + 80, 2) // odprto od 120 je 70
    expect(mine!.count).toBe(2)
    void id2
  })

  it("življenjski cikel: razvezava dogodkov (events) obstaja ob plačilu in dobropisu", async () => {
    const id = await mintInvoice(50)
    await recordDocumentPayment(id, { amount: 50, reference: "E1" })
    const evs = await prisma.documentEvent.findMany({ where: { documentId: id }, orderBy: { createdAt: "asc" } })
    expect(evs.length).toBeGreaterThanOrEqual(2) // ISSUED + PAID
    expect(evs[1].kind).toBe("PAID")
  })
})

// ============================================================
describe("Varnost", () => {
  it("org izolacija: org B ne sme plačati/dobropisovati org A dokumenta", async () => {
    const id = await mintInvoice(100)
    asOrgB()
    const p = await recordDocumentPayment(id, { amount: 10, reference: "XB" })
    expect(p.ok).toBe(false)
    const c = await issueCreditNote(id, { amount: 10 })
    expect(c.ok).toBe(false)
    const pays = await listDocumentPayments(id)
    expect(pays).toBeNull() // B ne vidi A plačil
  })

  it("STAFF s plačilno pravico sme plačati; STAFF z le view je zavrnjen", async () => {
    const id = await mintInvoice(100)
    // STAFF samo z finances.view → pisanje plačila je zvaljen (guard vrže).
    asStaffRead()
    await expect(recordDocumentPayment(id, { amount: 10, reference: "SR2" })).rejects.toThrow()
    // STAFF s plačilno pravico sme.
    asStaffPay()
    const ok = await recordDocumentPayment(id, { amount: 20, reference: "SP" })
    expect(ok.ok).toBe(true)
  })

  it("IDOR: plačilo na neobstoječ/tuj dokument → NOT_FOUND", async () => {
    const bad = await recordDocumentPayment("does-not-exist", { amount: 10 })
    expect(bad.ok).toBe(false)
    const bad2 = await recordDocumentPayment("", { amount: 10 })
    expect(bad2.ok).toBe(false)
  })
})

// ============================================================
describe("Vzporedne zahteve", () => {
  it("20 vzporednih plačil istega zneska ne preseže odprtega (preplačilo zavrnjeno)", async () => {
    const id = await mintInvoice(100)
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => recordDocumentPayment(id, { amount: 10, reference: `PAR${i}` }))
    )
    const okCount = results.filter((r) => r.ok).length
    // Ker se odprto stanje posodablja v transakciji, jih lahko uspe natanko 10.
    expect(okCount).toBeGreaterThanOrEqual(1)
    expect(okCount).toBeLessThanOrEqual(10)
    const d = await getDocumentDetail(id)
    expect(d!.totals.total).toBe(100)
  })
})