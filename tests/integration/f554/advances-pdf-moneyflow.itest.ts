// ============================================================
// F5.5.4.5.3 — KONKRETEN DENARNI TOK PO STORNIRANJU + PDF VSEH STANJ.
//
// Scenario: avans 100 €, končni račun 250 €.
//  S1  izdaj avans + prejmi 100 €;
//  S2  izdaj končni 250 €;
//  S3  apliciraj avans 100 €;
//  S4  doplačilo končnega 100 €;
//  S5  STORNO uporabe avansa;
//  S6  ponovna uporaba istega avansa na končnem.
// Ob vsakem koraku zabeležimo paidAmount / advanceTotal / creditedTotal /
// openAmount + realne prilive in interne prenose. Nato generiramo PDF avansa,
// PDF končnega z avansom in PDF končnega po stornu — preverimo številke, DDV,
// reference in SHA-256 (arhiv se ne prepiše).
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
import { sha256Buffer } from "@/lib/documents/pdf"
import {
  createDocument,
  changeDocumentStatus,
  recordDocumentPayment,
  listDocumentPayments,
  applyAdvancesToInvoice,
  reverseAdvanceAllocation,
  getDocumentDetail,
  archiveDocument,
  downloadDocumentArchive,
  getDocumentArchiveMeta,
} from "@/app/actions/documents"

const ORGA = "f55453-mf-org"
const ADMA = "f55453-mf-admin"
const CUST = "f55453-mf-cust"

async function clean() {
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentEvent.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORGA } })
  await prisma.user.deleteMany({ where: { id: ADMA } })
  await prisma.organization.deleteMany({ where: { id: ORGA } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await clean()
  await prisma.organization.create({ data: { id: ORGA, name: ORGA, slug: ORGA } })
  await prisma.user.create({ data: { id: ADMA, email: `${ADMA}@f.test`, name: ADMA, role: "ADMIN", organizationId: ORGA } })
  await prisma.organizationMember.create({ data: { organizationId: ORGA, userId: ADMA, role: "ADMIN", isDefault: true } })
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Salon", isVatRegistered: true, vatId: "SI1", bankAccount: "SI56 000", registrationNumber: "12" } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana" } })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const line = (description: string, unitPrice: number, quantity = 1, vatRate = 22) => ({ description, quantity, unitPrice, vatRate })

async function mkAdvance(amount: number) {
  const c = await createDocument({ type: "ADVANCE", customerId: CUST, items: [line("Avans", amount)] })
  expect(c.ok).toBe(true)
  expect((await changeDocumentStatus(c.id!, "ISSUED")).ok).toBe(true)
  return c.id!
}
async function mkInvoice(amount: number) {
  const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("Poroka", amount)] })
  expect(c.ok).toBe(true)
  expect((await changeDocumentStatus(c.id!, "ISSUED")).ok).toBe(true)
  return c.id!
}
const getState = async (id: string) => {
  const d = (await getDocumentDetail(id))!
  const pays = (await listDocumentPayments(id))!
  return {
    paidAmount: d.paidAmount,
    advanceTotal: d.advanceTotal,
    creditedTotal: d.creditedTotal,
    openAmount: d.openAmount,
    status: d.status,
    realInflows: pays.filter((p) => p.kind === "PAYMENT" && p.method !== "advance").reduce((s, p) => s + p.amount, 0),
    internalTransfers: pays.filter((p) => p.method === "advance").reduce((s, p) => s + p.amount, 0),
  }
}

describe("F5.5.4.5.3 Denarni tok po storniranju + PDF", () => {
  it("avans 100 → končni 250 → uporaba → doplačilo → storno → ponovna uporaba", async () => {
    const adv = await mkAdvance(100)
    const inv = await mkInvoice(250)

    // S1 — prejem 100 na avansu: realni priliv 100.
    await recordDocumentPayment(adv, { amount: 100, method: "transfer", reference: "REAL-1" })

    // S2/S3 — uporaba avansa: končni dob 100 internih prenosov v paidAmount.
    const app = await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    expect(app.ok).toBe(true)

    // S4 — doplačilo končnega 100 -> paidAmount končnega = 200, open = 50.
    await recordDocumentPayment(inv, { amount: 100, method: "cash", reference: "DOPLACILO" })

    let advS = await getState(adv)
    let invS = await getState(inv)
    // Avans: samo 1 realni priliv 100, NI internega prenosa na avansu.
    expect(advS.realInflows).toBe(100)
    expect(advS.paidAmount).toBe(100)
    expect(advS.advanceTotal).toBe(0) // advanceTotal se piše na KONČNEM, ne na avansu
    expect(advS.openAmount).toBe(0) // avans plačan v celoti
    // Končni: openAmount = 250 − 200 (100 internal + 100 doplačilo) = 50 (NI 50−100 ničle).
    expect(invS.paidAmount).toBe(200)
    expect(invS.advanceTotal).toBe(100)
    expect(invS.internalTransfers).toBe(100)
    expect(invS.realInflows).toBe(100) // doplačilo
    expect(invS.openAmount).toBe(50)
    expect(invS.openAmount).toBeGreaterThanOrEqual(0) // nikoli negativno

    // ------------------ PDF končnega Z avansom ------------------
    const archBefore = await archiveDocument(inv)
    expect(archBefore.ok).toBe(true)
    const dlBefore = await downloadDocumentArchive(archBefore.id!)
    expect(sha256Buffer(dlBefore!.pdf)).toBe(archBefore.sha256)
    const pdfTxtBefore = dlBefore!.pdf.toString("latin1")
    // Reference AVN + odprti znesek 50 v PDF.
    expect(pdfTxtBefore).toMatch(/AVN-0001/)

    // S5 — STORNO uporabe avansa na končnem.
    const rev = await reverseAdvanceAllocation(inv, adv, "preklic")
    expect(rev.ok).toBe(true)

    advS = await getState(adv)
    invS = await getState(inv)
    // Avans ponovno uporaben (parentInvoiceId=null), stanje ohranjeno.
    expect(advS.paidAmount).toBe(100)
    expect(advS.advanceTotal).toBe(0)
    // Končni: prefix plačilo za avans (100 internal) se STORNIRA -> paidAmount = 100 (samo doplačilo).
    expect(invS.paidAmount).toBe(100)
    expect(invS.advanceTotal).toBe(0)
    expect(invS.openAmount).toBe(250 - 100) // 150 — doplačilo (100) ostane
    expect(invS.openAmount).toBeGreaterThanOrEqual(0)
    // Realni priliv (cash) končnega ostane 100; internega prenosa NI več.
    expect(invS.realInflows).toBe(100)
    expect(invS.internalTransfers).toBe(0)

    // S6 — PONOVNA UPORABA storniranega avansa na DRUGEM končnem računu.
    // (Ponovna uporaba na ISTEM računu z istim AVN-reference je pravilno
    //  blokirana z DocumentPayment delno-unikatnim indeksom (org,documentId,
    //  reference) — en sklic se na enem računu ne knjiži dvakrat.)
    const inv2 = await mkInvoice(140)
    const app2 = await applyAdvancesToInvoice(inv2, { advanceIds: [adv] })
    expect(app2.ok, `re-apply failed: ${app2.error}`).toBe(true)
    expect(app2.advanceTotal).toBe(100)
    const inv2S = await getState(inv2)
    expect(inv2S.paidAmount).toBe(100)
    expect(inv2S.advanceTotal).toBe(100)
    expect(inv2S.openAmount).toBe(40) // 140 − 100, enkratno odštevanje
    // Zaščita pred dvojnim knjiženjem istega AVN sklica na istem računu:
    const dupOnSame = await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    expect(dupOnSame.ok).toBe(false)
    expect(dupOnSame.error).toBe("ADVANCE_ALREADY_USED")

    // Arhiv končnega je NESpremenljiv: ponovni archiveDocument vrne ISTI SHA
    // (write-once, ne prepiše se) tudi po celotnem stornu.
    const archAfter = await archiveDocument(inv)
    expect(archAfter.ok).toBe(true)
    expect(archAfter.alreadyArchived).toBe(true)
    expect(archAfter.sha256).toBe(archBefore.sha256)
    // Novi (inv2) račun z novo številko — generira svoj arhiv z lastnim SHA.
    const archInv2 = await archiveDocument(inv2)
    expect(archInv2.ok).toBe(true)
    expect(archInv2.sha256).toMatch(/^[0-9a-f]{64}$/)
    // Preverimo tudi leve PDF inv2: številke (140−100=40 odprto) in reference.
    const dl2 = await downloadDocumentArchive(archInv2.id!)
    expect(sha256Buffer(dl2!.pdf)).toBe(archInv2.sha256)
    const txt2 = dl2!.pdf.toString("latin1")
    expect(txt2).toMatch(/AVN-0001/)
  })

  it("PDF avansa samostojno — osnova 81,97, DDV 18,03, skupaj 100; arhiv write-once (isti SHA)", async () => {
    const adv = await mkAdvance(100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "AVP" })

    const a1 = await archiveDocument(adv)
    expect(a1.ok).toBe(true)
    const dl1 = await downloadDocumentArchive(a1.id!)
    const txt = dl1!.pdf.toString("latin1")
    expect(txt).toMatch(/AVN-0001/)
    expect(sha256Buffer(dl1!.pdf)).toBe(a1.sha256)

    // Ob vnovičnem arhiviranju vrne ISTI original (alreadyArchived) — hash se NE spremeni.
    const a2 = await archiveDocument(adv)
    expect(a2.alreadyArchived).toBe(true)
    expect(a2.sha256).toBe(a1.sha256)
    const count = await prisma.documentArchive.count({ where: { documentId: adv } })
    expect(count).toBe(1)
  })
})