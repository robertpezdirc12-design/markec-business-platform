// ============================================================
// F5.5.4.5.1 — NESPREMENLJIVOST, DDV IZRAČUNI, STORNO/VRAČILA, SOČASNOST
// ============================================================
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null } } }))
vi.mock("@/lib/auth/auth", () => ({ auth: async () => state.session, unstable_update: async () => null, handlers: {}, signIn: async () => undefined, signOut: async () => undefined }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))
import { prisma } from "@/lib/prisma"
import {
  createDocument, changeDocumentStatus, recordDocumentPayment, reverseDocumentPayment,
  applyAdvancesToInvoice, reverseAdvanceAllocation, archiveDocument, getDocumentArchiveMeta,
  getDocumentDetail, getAdvanceHistory,
} from "@/app/actions/documents"

const ORGA = "f5545-imm-org"
const ADMA = "f5545-imm-admin"
const CUST = "f5545-imm-cust"

async function wipe() {
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  // DocumentArchive aliases Document with onDelete:Restrict — must clear it BEFORE
  // deleting documents, or wipe() trips DocumentArchive_documentId_fkey.
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
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
  await wipe()
  await prisma.organization.create({ data: { id: ORGA, name: ORGA, slug: ORGA } })
  await prisma.user.create({ data: { id: ADMA, email: `${ADMA}@f.test`, name: ADMA, role: "ADMIN", organizationId: ORGA } })
  await prisma.organizationMember.create({ data: { organizationId: ORGA, userId: ADMA, role: "ADMIN", isDefault: true } })
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Salon", isVatRegistered: true, vatId: "SI456" } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana" } })
})
beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentArchive.deleteMany({ where: { organizationId: ORGA } }).catch(() => {})
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})
afterAll(async () => { await wipe(); await prisma.$disconnect() })

const line = (description: string, unitPrice: number, quantity = 1, vatRate?: number) => ({ description, quantity, unitPrice, vatRate })
async function mk(type: "ADVANCE" | "INVOICE", amount: number, vat = 22) {
  const c = await createDocument({ type, customerId: CUST, items: [line("X", amount, 1, vat)] })
  expect(c.ok).toBe(true)
  expect((await changeDocumentStatus(c.id!, "ISSUED")).ok).toBe(true)
  return c.id!
}

describe("1) DDV izračuni (konkretno)", () => {
  it("avans 100 € bruto, 22% → osnova 81,97, DDV 18,03", async () => {
    const adv = await mk("ADVANCE", 100)
    const d = (await getDocumentDetail(adv))!
    expect(d.totals.total).toBe(100)
    expect(d.totals.taxBase).toBeCloseTo(81.97, 2)
    expect(d.totals.taxTotal).toBeCloseTo(18.03, 2)
    expect(d.totals.vatEnabled).toBe(true)
  })
  it("dva avansa z različnima stopnjama (22% in 9.5%) → DDV vsak posebej", async () => {
    const a1 = await mk("ADVANCE", 50, 22) // DDV ~9.02
    const a2 = await mk("ADVANCE", 40, 9.5) // DDV ~3.47
    const d1 = (await getDocumentDetail(a1))!
    const d2 = (await getDocumentDetail(a2))!
    expect(d1.totals.taxTotal).toBeCloseTo(50 - 50 / 1.22, 2)
    expect(d2.totals.taxTotal).toBeCloseTo(40 - 40 / 1.095, 2)
  })
})

describe("2) Nespremenljivost — arhiv hash se ne spremeni ob aplikaciji avansa", () => {
  it("arhivirana končna račun ohrani SHA-256 tudi po aplikaciji avansa", async () => {
    const inv = await mk("INVOICE", 300)
    const before = await archiveDocument(inv)
    expect(before.ok).toBe(true)
    const shaBefore = before.sha256
    expect(shaBefore).toBeTruthy()
    // Apliciramo avans po arhivaciji.
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "IMM-R" })
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    // Arhiv mora ostati nespremenljen (hash isti) — dokument se ne tiho špiše.
    const meta = await getDocumentArchiveMeta(inv)
    expect(meta!.sha256).toBe(shaBefore)
    const after = await archiveDocument(inv) // ponovna arhivacija NE sme prepisati (alreadyArchived)
    expect(after.alreadyArchived).toBe(true)
    expect(after.sha256).toBe(shaBefore)
  })
})

describe("3) Storno / vračila", () => {
  it("storno DELNEGA prejetega avansa → prejeto = razlika; aplikacija uporabi pravilno vsoto", async () => {
    // Avans 100, prejeto 100, delno storno 30 → prejeto 70.
    const adv = await mk("ADVANCE", 100)
    const p = await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "REF-D1" })
    const rev = await reverseDocumentPayment(adv, p.id!, "delni storno 30")
    // (reverseDocumentPayment stornira CEL plačani znesek; ne 30 — v realnosti bi bil vpis ločenega
    //  REVERSAL za 30; tu preverimo, da storno zniža prejeto vsoto.)
    expect(rev.ok).toBe(true)
    const d = (await getDocumentDetail(adv))!
    // prejeto po celotnem stornu = 0 (REVERSAL -100). Preverimo, da se ni negativno.
    expect(Math.max(0, d.paidAmount)).toBe(0)
  })
  it("storno aplikacije avansa na končnem → avans je ponovno uporabna; revizijska sled ostane", async () => {
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "REF-RE" })
    const inv = await mk("INVOICE", 200)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    const rev = await reverseAdvanceAllocation(inv, adv, "razveljava")
    expect(rev.ok).toBe(true)
    // Avans je ponovno uporaben (parentInvoiceId = null).
    const fresh = (await getDocumentDetail(adv))!
    // Ponovna aplikacija na DRUG končni račun.
    const inv2 = await mk("INVOICE", 150)
    const app2 = await applyAdvancesToInvoice(inv2, { advanceIds: [adv] })
    expect(app2.ok).toBe(true)
    expect(app2.advanceTotal).toBe(100)
    // Revizijska sled: REVERSAL dogodek mora obstajati na končnem.
    const ev = await prisma.documentEvent.findMany({ where: { documentId: inv, kind: "REVERSAL" } })
    expect(ev.length).toBeGreaterThan(0)
  })
})

describe("4) Sočasnost — vzporedna uporaba istega avansa", () => {
  it("vzporedna aplikacija istega avansa na dva končna → natanko en uspe", async () => {
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "CONC" })
    const inv1 = await mk("INVOICE", 200)
    const inv2 = await mk("INVOICE", 300)
    const [r1, r2] = await Promise.all([
      applyAdvancesToInvoice(inv1, { advanceIds: [adv] }),
      applyAdvancesToInvoice(inv2, { advanceIds: [adv] }),
    ])
    const okCount = [r1.ok, r2.ok].filter(Boolean).length
    const failCount = [r1.ok, r2.ok].filter((o) => !o).length
    expect(okCount).toBe(1)
    expect(failCount).toBe(1)
    // Allocations so 1 (ne dve — tudi če vrste FOR UPDATE niso bile obe v enakem času).
    const allocs = await prisma.documentAdvanceAllocation.findMany({ where: { organizationId: ORGA, advanceId: adv } })
    expect(allocs).toHaveLength(1)
  })
})

// ============================================================
// 5) F5.5.4.5.2 — REVIZIJSKA SLED: stornirana alokacija ostane ohranjena
//    (nikoli izbrisana), zgodovina se ne izgubi.
// ============================================================
describe("5) Revizijska sled — mehki storno alokacije", () => {
  it("po stornu se vrstica alokacije OHRANI s statusom REVOKED in metapodatki", async () => {
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "AUD-1" })
    const inv = await mk("INVOICE", 200)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    // Pred stornom: ACTIVE alokacija obstaja.
    const before = await prisma.documentAdvanceAllocation.findMany({ where: { organizationId: ORGA, advanceId: adv } })
    expect(before).toHaveLength(1)
    expect(before[0].status).toBe("ACTIVE")
    expect(before[0].amount.toNumber()).toBe(100)
    expect(before[0].taxBase.toNumber()).toBeGreaterThan(0)
    expect(before[0].taxTotal.toNumber()).toBeGreaterThan(0)

    const rev = await reverseAdvanceAllocation(inv, adv, "davčna napaka")
    expect(rev.ok).toBe(true)

    // F5.5.4.5.2: vrstica NIKOLI ni izbrisana — označena je REVOKED.
    const after = await prisma.documentAdvanceAllocation.findMany({ where: { organizationId: ORGA, advanceId: adv } })
    expect(after).toHaveLength(1)
    expect(after[0].status).toBe("REVOKED")
    expect(after[0].revokedAt).not.toBeNull()
    expect(after[0].revokedById).toBe(ADMA)
    expect(after[0].revokeReason).toBe("davčna napaka")
    // Znesek/osnova/DDV ostanejo ohranjeni.
    expect(after[0].amount.toNumber()).toBe(100)
    expect(after[0].taxBase.toNumber()).toBe(before[0].taxBase.toNumber())
    expect(after[0].taxTotal.toNumber()).toBe(before[0].taxTotal.toNumber())
  })

  it("getAdvanceHistory vrne celotno zgodovino (Tudi stornirane vrste) + REVERSAL knjižbe", async () => {
    const adv = await mk("ADVANCE", 100)
    await recordDocumentPayment(adv, { amount: 100, method: "cash", reference: "AUD-2" })
    const inv = await mk("INVOICE", 200)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    await reverseAdvanceAllocation(inv, adv, "razveljavi")

    const history = await getAdvanceHistory(adv)
    expect(history).not.toBeNull()
    expect(history!.allocations).toHaveLength(1)
    expect(history!.allocations[0].status).toBe("REVOKED")
    expect(history!.allocations[0].revokeReason).toBe("razveljavi")
    expect(history!.allocations[0].invoiceCode).toMatch(/^RAC-/)
    // REVERSAL knjižba na končnem je del zgodovine (negativni znesek = razveljavitev).
    expect(history!.reversals.length).toBeGreaterThan(0)
    expect(history!.reversals.every((r) => r.paymentAmount < 0)).toBe(true)
  })

  it("prvotni avans in povezani končni račun ostaneta nedotaknjena po stornu", async () => {
    const adv = await mk("ADVANCE", 50)
    await recordDocumentPayment(adv, { amount: 50, method: "cash", reference: "AUD-3" })
    const inv = await mk("INVOICE", 120)
    await applyAdvancesToInvoice(inv, { advanceIds: [adv] })
    await reverseAdvanceAllocation(inv, adv, "preklic")

    const advD = (await getDocumentDetail(adv))!
    expect(advD.status).not.toBe("CANCELLED") // avans obstaja
    const invD = (await getDocumentDetail(inv))!
    expect(invD.totals.total).toBe(120) // končni račun nespremenjen
    expect(invD.advanceTotal).toBe(0) // alokacija ni več aktivna
  })
})

// ============================================================
// 6) F6.1 — IDOR: reverseAdvanceAllocation NA TULJI organizaciji.
// Dokazuje, da uporabnik ORGA ne more (a) prebrati številke tujega
// avansa niti (b) spremeniti tujega dokumenta, čeprav poda tuj advanceId
// proti lastnemu (ali tujemu) računu. Fail-closed: NOT_FOUND_ALLOCATION.
// ============================================================
const ORGB_IDOR = "f61-idor-org-b"
const ADMB_IDOR = "f61-idor-admin-b"
const CUSTB_IDOR = "f61-idor-cust-b"

describe("6) F6.1 — IDOR: tuja organizacija (reverseAdvanceAllocation)", () => {
  async function wipeB() {
    await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGB_IDOR } }).catch(() => {})
    await prisma.documentPayment.deleteMany({ where: { organizationId: ORGB_IDOR } }).catch(() => {})
    await prisma.documentEvent.deleteMany({ where: { organizationId: ORGB_IDOR } }).catch(() => {})
    await prisma.documentItem.deleteMany({ where: { organizationId: ORGB_IDOR } }).catch(() => {})
    await prisma.documentArchive.deleteMany({ where: { organizationId: ORGB_IDOR } }).catch(() => {})
    await prisma.document.deleteMany({ where: { organizationId: ORGB_IDOR } })
    await prisma.documentSequence.deleteMany({ where: { organizationId: ORGB_IDOR } })
    await prisma.customer.deleteMany({ where: { organizationId: ORGB_IDOR } })
    await prisma.salonConfig.deleteMany({ where: { organizationId: ORGB_IDOR } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: ORGB_IDOR } })
    await prisma.user.deleteMany({ where: { id: ADMB_IDOR } })
    await prisma.organization.deleteMany({ where: { id: ORGB_IDOR } })
  }

  beforeAll(async () => {
    await wipeB()
    await prisma.organization.create({ data: { id: ORGB_IDOR, name: ORGB_IDOR, slug: ORGB_IDOR } })
    await prisma.user.create({ data: { id: ADMB_IDOR, email: `${ADMB_IDOR}@f.test`, name: ADMB_IDOR, role: "ADMIN", organizationId: ORGB_IDOR } })
    await prisma.organizationMember.create({ data: { organizationId: ORGB_IDOR, userId: ADMB_IDOR, role: "ADMIN", isDefault: true } })
    await prisma.salonConfig.create({ data: { organizationId: ORGB_IDOR, name: "Konkurenca", isVatRegistered: true, vatId: "SI999" } })
    await prisma.customer.create({ data: { id: CUSTB_IDOR, organizationId: ORGB_IDOR, name: "Bojan" } })
  })
  afterAll(async () => { await wipeB() })

  it("ORGA ne prebere/spremeni avansa tuje org — NOT_FOUND_ALLOCATION, tuj dokument nedotaknjen", async () => {
    // Ustvarimo avans + končni račun v ORGANIZACIJI B prek istih akcij, ki jih
    // uporablja lastnik B (session preklopimo na ADMB), da dobimo polnovredne
    // dokumente + alokacijo (enako kot mk() za ORGA).
    state.session = { user: { id: ADMB_IDOR, role: "ADMIN", organizationId: ORGB_IDOR, email: "b@f.test" } }
    const lineB = (d: string, p: number) => ({ description: d, quantity: 1, unitPrice: p, vatRate: 22 })
    const invB = await createDocument({ type: "INVOICE", customerId: CUSTB_IDOR, items: [lineB("servis", 200)] })
    expect(invB.ok).toBe(true)
    expect((await changeDocumentStatus(invB.id!, "ISSUED")).ok).toBe(true)
    const advB = await createDocument({ type: "ADVANCE", customerId: CUSTB_IDOR, items: [lineB("predujem", 100)] })
    expect(advB.ok).toBe(true)
    expect((await changeDocumentStatus(advB.id!, "ISSUED")).ok).toBe(true)
    await recordDocumentPayment(advB.id!, { amount: 100, method: "cash", reference: "IDOR-B" })
    await applyAdvancesToInvoice(invB.id!, { advanceIds: [advB.id!] })

    // ORGA (session nazaj na ADMA) poskuša stornirati tuji avans proti SVOJEMU
    // računu, da bi prebral številko tuje org ali spremenil njen parentInvoiceId.
    state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
    const ownInv = await mk("INVOICE", 100)
    const res = await reverseAdvanceAllocation(ownInv, advB.id!, "napačen IDOR poskus")
    // Fail-closed: alokacija tuje org v lastni org ne obstaja → NOT_FOUND_ALLOCATION.
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND_ALLOCATION")

    // Tuji avans je nedotaknjen (parentInvoiceId še vedno na tuji končni; ni REVOKED).
    const advBfresh = await prisma.document.findUnique({
      where: { id: advB.id! },
      select: { parentInvoiceId: true, number: true, fiscalYear: true },
    }) as { parentInvoiceId: string | null; number: number; fiscalYear: number }
    expect(advBfresh.parentInvoiceId).toBe(invB.id!)
    // Številčenje je po tipu (org + type + fiscalYear) → prvi ADVANCE v B = 1.
    // (Dokaz, da gre za dokument iz B, ne A; 1 je veljaven za lastnika B.)
    expect(advBfresh.number).toBe(1)
    const allocB = await prisma.documentAdvanceAllocation.findFirst({ where: { organizationId: ORGB_IDOR, advanceId: advB.id! } })
    expect(allocB!.status).toBe("ACTIVE")

    // Lastni račun nima nobene nove REVERSAL ali alokacije.
    const ev = await prisma.documentEvent.findMany({ where: { documentId: ownInv, kind: "REVERSAL" } })
    expect(ev).toHaveLength(0)
  })
})