// F5.5.4.5.1 — preverba, ali ADVANCE uide v globalne statistike (computeStats).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null } } }))
vi.mock("@/lib/auth/auth", () => ({ auth: async () => state.session, unstable_update: async () => null, handlers: {}, signIn: async () => undefined, signOut: async () => undefined }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))
import { prisma } from "@/lib/prisma"
import { createDocument, changeDocumentStatus, getDocumentsOverview } from "@/app/actions/documents"

const ORGA = "f5545-st-org"
const ADMA = "f5545-st-admin"
const CUST = "f5545-st-cust"

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test"]).toContain(rows[0].db)
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organization.deleteMany({ where: { id: ORGA } })
  await prisma.user.deleteMany({ where: { id: ADMA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organization.create({ data: { id: ORGA, name: ORGA, slug: ORGA } })
  await prisma.user.create({ data: { id: ADMA, email: `${ADMA}@f.test`, name: ADMA, role: "ADMIN", organizationId: ORGA } })
  await prisma.organizationMember.create({ data: { organizationId: ORGA, userId: ADMA, role: "ADMIN", isDefault: true } })
  await prisma.salonConfig.create({ data: { organizationId: ORGA, isVatRegistered: true, vatId: "SI1" } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana" } })
})
beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
})
afterAll(async () => {
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.organization.deleteMany({ where: { id: ORGA } })
  await prisma.user.deleteMany({ where: { id: ADMA } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORGA } })
  await prisma.customer.deleteMany({ where: { organizationId: ORGA } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: ORGA } })
  await prisma.$disconnect()
})

describe("computeStats — ADVANCE ne sme uiti v neplačane račune", () => {
  it("izdani, neprejeti avans ne sme povečati unpaidTotal / invoicesUnpaid", async () => {
    const c = await createDocument({ type: "ADVANCE", customerId: CUST, items: [{ description: "A", quantity: 1, unitPrice: 80, vatRate: 22 }] })
    expect(c.ok).toBe(true)
    await changeDocumentStatus(c.id!, "ISSUED")
    const ov = await getDocumentsOverview()
    // FIXED: ADVANCE ni del neplačanih računov / unpaidTotal.
    expect(ov.stats.unpaidTotal).toBe(0)
    expect(ov.stats.invoicesIssued).toBe(0)
    expect(ov.stats.invoicesPaid).toBe(0)
  })
  it("pravi INVOICE se še vedno šteje v unpaidTotal", async () => {
    const c = await createDocument({ type: "INVOICE", customerId: CUST, items: [{ description: "I", quantity: 1, unitPrice: 120, vatRate: 22 }] })
    expect(c.ok).toBe(true)
    await changeDocumentStatus(c.id!, "ISSUED")
    const ov = await getDocumentsOverview()
    expect(ov.stats.invoicesIssued).toBe(1)
    expect(ov.stats.unpaidTotal).toBe(120)
  })
})