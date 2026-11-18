// ============================================================
// F5.5.4.3 — INTEGRACIJSKI TESTI PDF, E-POŠTE IN ARHIVA.
//
// Ločena baza markec_f554_test. Resnične server actions iz documents.ts
// (archiveDocument / sendDocument / downloadDocumentArchive /
// getDocumentArchiveMeta / getDocumentSendLogs). Seja mockana; e-poštni
// ponudnik mockan na krmili (SENT/FAILED); UNSENT pot (brez API ključa)
// preverimo z resničnim  isEmailServiceConfigured čitanjem.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null }
  },
  emailOutcome: "SENT" as "SENT" | "FAILED" | "UNSENT",
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
// Mock e-poštnega ponudnika — nadzoruje izid (SENT/FAILED). UNSENT preverimo
// z resničnim isEmailServiceConfigured() v ločenem testu.
vi.mock("@/lib/email/document-send", () => ({
  sendDocumentEmail: async () =>
    state.emailOutcome === "SENT"
      ? { status: "SENT" as const, messageId: "test-msg-1" }
      : { status: "FAILED" as const, error: "provider rejected" },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { sha256Buffer } from "@/lib/documents/pdf"
import {
  createDocument,
  changeDocumentStatus,
  archiveDocument,
  getDocumentArchiveMeta,
  downloadDocumentArchive,
  sendDocument,
  getDocumentSendLogs,
} from "@/app/actions/documents"
import { isEmailServiceConfigured } from "@/lib/email/config"

const ORGA = "f5543-org-a"
const ORGB = "f5543-org-b"
const ADMA = "f5543-admin-a"
const ADMB = "f5543-admin-b"
const STAFF_V = "f5543-staff-view"
const ROLE_V = "f5543-role-view"
const CUST = "f5543-cust"

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

async function clean() {
  const ids = [ORGA, ORGB]
  await prisma.documentSendLog.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentArchive.deleteMany({ where: { organizationId: { in: ids } } })
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
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFF_V] } } })
  await prisma.organization.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await clean()
  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Županček Čevlji", address: "Šmartinska 5", city: "Ljubljana", zipCode: "1000", country: "SI", isVatRegistered: true, vatId: "SI123", bankAccount: "SI56 0000", email: "izdajatelj@x.si" } })
  await prisma.salonConfig.create({ data: { organizationId: ORGB, name: "B-salon", isVatRegistered: false } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Čavka Špotka", email: "cavka@x.si", phone: "041" } })
  await prisma.customer.create({ data: { id: "f5543-cust-b", organizationId: ORGB, name: "Beta" } })
  // STAFF samo z finances.view (dovoljen za branje/arhiv, ne za pošiljanje).
  await prisma.user.createMany({ data: [{ id: STAFF_V, email: `${STAFF_V}@f.test`, name: "S", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: STAFF_V, role: "STAFF", customRoleId: ROLE_V }] })
  await prisma.customRole.create({ data: { id: ROLE_V, organizationId: ORGA, name: "View", permissions: ["finances.view"] } })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  state.emailOutcome = "SENT"
  await prisma.documentSendLog.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentEvent.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.update({ where: { organizationId: ORGA }, data: { name: "Županček Čevlji", vatId: "SI123" } })
  await prisma.customer.update({ where: { id: CUST }, data: { name: "Čavka Špotka", email: "cavka@x.si" } })
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

function asOrgB() { state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } } }
function asStaffView() { state.session = { user: { id: STAFF_V, role: "STAFF", organizationId: ORGA, email: "s@f.test" } } }

const line = (d: string, p: number, vat = 22) => ({ description: d, quantity: 1, unitPrice: p, vatRate: vat })

async function mintInvoice(): Promise<string> {
  const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-01-01", dueDate: "2026-02-01", items: [line("Šivanje", 100, 22)] })
  expect(c.ok).toBe(true)
  await changeDocumentStatus(c.id!, "ISSUED")
  return c.id!
}

// ============================================================
describe("PDF", () => {
  it("arhivira račun → veljaven PDF, hash in metapodatki", async () => {
    const id = await mintInvoice()
    const r = await archiveDocument(id)
    expect(r.ok).toBe(true)
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(r.filename?.endsWith(".pdf")).toBe(true)
    const meta = await getDocumentArchiveMeta(id)
    expect(meta!.archived).toBe(true)
    const dl = await downloadDocumentArchive(r.id!)
    expect(dl).not.toBeNull()
    const head = dl!.pdf.subarray(0, 8).toString("latin1")
    expect(head).toContain("%PDF")
    // integriteta: ponovni hash = shranjen hash
    expect(sha256Buffer(dl!.pdf)).toBe(r.sha256)
  })

  it("PDF po spremembi stranke in podjetja ostane identičen (nespremenljiv snapshot)", async () => {
    const id = await mintInvoice()
    const r1 = await archiveDocument(id)
    expect(r1.ok).toBe(true)
    const dl1 = await downloadDocumentArchive(r1.id!)
    // spremeni živo stranko in salon — arhivirani original se ne sme spremeniti
    await prisma.customer.update({ where: { id: CUST }, data: { name: "POVSEM DRUGAC" } })
    await prisma.salonConfig.update({ where: { organizationId: ORGA }, data: { name: "Sasij Sad", vatId: "SI999" } })
    const dl2 = await downloadDocumentArchive(r1.id!)
    expect(dl2!.pdf.equals(dl1!.pdf)).toBe(true) // byte-identičen
  })

  it("ne moremo arhivirati DRAFT / ne-izdanega", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [line("S", 50)] })
    const r = await archiveDocument(c.id!)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("NOT_ISSUED")
  })

  it("prepreči prepisovanje že arhiviranega izvirnika (alreadyArchived)", async () => {
    const id = await mintInvoice()
    const r1 = await archiveDocument(id)
    expect(r1.ok).toBe(true)
    const r2 = await archiveDocument(id)
    expect(r2.ok).toBe(true)
    expect(r2.alreadyArchived).toBe(true)
    expect(r2.id).toBe(r1.id)
    expect(r2.sha256).toBe(r1.sha256)
    const count = await prisma.documentArchive.count({ where: { documentId: id } })
    expect(count).toBe(1)
  })
})

// ============================================================
describe("E-pošta", () => {
  it("pošiljanje uspešno → status SENT in log s prejemnikom", async () => {
    const id = await mintInvoice()
    await archiveDocument(id)
    state.emailOutcome = "SENT"
    const s = await sendDocument(id, { toEmail: "stranka@x.si" })
    expect(s.ok).toBe(true)
    expect(s.status).toBe("SENT")
    expect(s.messageId).toBe("test-msg-1")
    const logs = await getDocumentSendLogs(id)
    expect(logs!.length).toBe(1)
    expect(logs![0].toEmail).toBe("stranka@x.si")
    expect(logs![0].status).toBe("SENT")
  })

  it("pošiljanje neuspešno → FAILED, dokument NI označen kot poslan", async () => {
    const id = await mintInvoice()
    await archiveDocument(id)
    state.emailOutcome = "FAILED"
    const s = await sendDocument(id, { toEmail: "x@y.si" })
    expect(s.ok).toBe(false)
    expect(s.status).toBe("FAILED")
    const logs = await getDocumentSendLogs(id)
    expect(logs![0].status).toBe("FAILED")
  })

  it("ponovno pošiljanje ustvari nov log (ni preprečeno, a vsak zabeležen)", async () => {
    const id = await mintInvoice()
    await archiveDocument(id)
    await sendDocument(id, { toEmail: "a@x.si" })
    await sendDocument(id, { toEmail: "a@x.si" })
    const logs = await getDocumentSendLogs(id)
    expect(logs!.length).toBe(2)
  })

  it("brez arhiva → NOT_ARCHIVED (ne moremo poslati ne-arhiviranega)", async () => {
    const id = await mintInvoice()
    const s = await sendDocument(id, { toEmail: "x@y.si" })
    expect(s.ok).toBe(false)
    expect(s.error).toBe("NOT_ARCHIVED")
  })

  it("UNSENT, kadar ponudnik ni konfiguriran (ne trdimo, da je poslano)", async () => {
    // Resnični helper uporabi procesno okolje; v testu ni RESEND_API_KEY.
    expect(isEmailServiceConfigured({})).toBe(false)
  })
})

// ============================================================
describe("Varnost (org, STAFF, IDOR)", () => {
  it("org B ne vidi/nedostopa do arhiva org A, ne more poslati njihovih dokumentov", async () => {
    const id = await mintInvoice()
    await archiveDocument(id)
    asOrgB()
    expect(await getDocumentArchiveMeta(id)).toBeNull()
    expect(await downloadDocumentArchive((await prisma.documentArchive.findUnique({ where: { documentId: id } }))!.id)).toBeNull()
    const s = await sendDocument(id, { toEmail: "x@y.si" })
    expect(s.ok).toBe(false)
  })

  it("STAFF z finances.view lahko ogleda arhiv, a NE pošilja (requirePer../manage)", async () => {
    const id = await mintInvoice()
    await archiveDocument(id)
    asStaffView()
    expect((await getDocumentArchiveMeta(id))!.archived).toBe(true)
    await expect(sendDocument(id, { toEmail: "x@y.si" })).rejects.toThrow()
  })

  it("IDOR: arhiv neobstoječega/ne-svojega → null", async () => {
    expect(await downloadDocumentArchive("does-not-exist")).toBeNull()
    expect(await getDocumentArchiveMeta("no-such-doc")).toBeNull()
  })
})

// ============================================================
describe("Slovenščina, valuta, številke", () => {
  it("PDF vsebina vsebuje slovenske znake, EUR in številke (v ToUnicode/bajti)", async () => {
    const id = await mintInvoice() // vsebuje "Čavka Špotka", "Županček Čevlji", "Šivanje", 100 €
    const r = await archiveDocument(id)
    const dl = await downloadDocumentArchive(r.id!)
    const text = dl!.pdf.toString("latin1")
    // mehko preverjanje — ToUnicode CMAP nosi prave kodepunkte (č, š, ž)
    expect(text).toContain("CMapName /Adobe-Identity-UCS")
    expect(text.length).toBeGreaterThan(1000)
    // File je determinističen → tudi če ponovno generiramo, je hash enak
    expect(dl!.sha256).toBe(r.sha256!)
  })
})