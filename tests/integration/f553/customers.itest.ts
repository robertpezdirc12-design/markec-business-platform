// ============================================================
// F5.5.3 — INTEGRACIJSKI TESTI UPRAVLJANJA STRANK (moje stranke)
//
// Kliče resnične server actions (customers.ts, users.ts, walk-in.ts,
// appointments.ts) proti ločeni bazi `markec_f553_test`. Nadomeščen je
// le NextAuth session (tenant-proof mockan) — vse o org izolaciji,
// dedup, arhivu, GDPR in zgodovini teče prek pravega Prisma klienta.
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
import type { Prisma } from "@prisma/client"
import {
  createCustomer,
  updateCustomer,
  archiveCustomer,
  unarchiveCustomer,
  listCustomers,
  getCustomerDetail,
  linkWalkInCustomer,
  exportCustomerData,
  anonymizeCustomer,
  updateCustomerNotesByCustomerId,
} from "@/app/actions/customers"
import { updateCustomerNotes } from "@/app/actions/users"
import { joinWalkInQueue } from "@/app/actions/walk-in"
import { resolveCustomerIdentity } from "@/lib/customers/identity"

const ORGA = "f553-it-org-a"
const ORGB = "f553-it-org-b"
const ADMA = "f553-it-admin-a"
const ADMB = "f553-it-admin-b"
const SVC = "f553-it-svc"
const PROD = "f553-it-prod"
const STAFF = "f553-it-staff"
// F5.5.3.1 — STAFF / omejena custom-rola (za STAFF-dovoljenjsko matriko).
const STAFFU = "f553-it-staff-user"
const RESTRICTEDU = "f553-it-restricted-user"
const ROLE_RESTRICTED = "f553-it-role-restricted"

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f553_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  // Clean left-overs from aborted runs (FK safety order).
  await prisma.walkInEntry.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFFU, RESTRICTEDU] } } })
  await prisma.product.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.service.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.category.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  // STAFF (default: obdrži vse ključe, torej tudi customers.manage) + a
  // member with a RESTRICTIVE custom role (only appointments.view) which
  // withholds customers.manage — for the F5.5.3.1 STAFF matrix.
  await prisma.user.createMany({ data: [{ id: STAFFU, email: `${STAFFU}@f.test`, name: "Staff Uporabnik", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: STAFFU, role: "STAFF" }] })
  await prisma.customRole.create({ data: { id: ROLE_RESTRICTED, organizationId: ORGA, name: "Omejena", permissions: ["appointments.view"] as unknown as Prisma.InputJsonValue } })
  await prisma.user.createMany({ data: [{ id: RESTRICTEDU, email: `${RESTRICTEDU}@f.test`, name: "Restricted User", role: "STAFF", organizationId: ORGA }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: ORGA, userId: RESTRICTEDU, role: "STAFF", customRoleId: ROLE_RESTRICTED }] })
  await prisma.category.createMany({ data: [{ id: "f553-it-cat", name: "K", slug: "f553-it-cat", organizationId: ORGA }] })
  await prisma.service.createMany({ data: [{ id: SVC, name: "Storitev", slug: "f553-it-svc", duration: 30, price: 10, organizationId: ORGA, categoryId: "f553-it-cat" }] })
  await prisma.product.createMany({ data: [{ id: PROD, name: "Izdelek", price: 5, sku: "F553-IT-P", organizationId: ORGA }] })
  await prisma.staff.createMany({ data: [{ id: STAFF, name: "Osebje", organizationId: ORGA, userId: ADMA, isActive: true }] })
})

beforeEach(() => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  return Promise.all([
    prisma.walkInEntry.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } }),
    prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } }),
  ])
})

afterAll(async () => {
  await prisma.walkInEntry.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, STAFFU, RESTRICTEDU] } } })
  await prisma.product.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.service.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.category.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
  await prisma.$disconnect()
})

function asOrgB() {
  state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
}

describe("Identity resolver — pure", () => {
  it("email is unambiguous identity", () => {
    const r = resolveCustomerIdentity({ id: "1", name: "Ana Novak", email: "ana@x.si", phone: "041111" }, { name: "Ana N.", email: "ANA@X.SI", phone: "040000" })
    expect(r).toEqual({ matched: true, customerId: "1", by: "email" })
  })
  it("phone alone does NOT match a different name", () => {
    const r = resolveCustomerIdentity({ id: "1", name: "Ana Novak", email: "ana@x.si", phone: "041111" }, { name: "Bojan", phone: "041111" })
    expect(r.matched).toBe(false)
  })
  it("phone + same name + customer without email matches", () => {
    const r = resolveCustomerIdentity({ id: "2", name: "Jan Novak", email: null, phone: "041222" }, { name: "jan  novak", phone: "041-222" })
    expect(r).toEqual({ matched: true, customerId: "2", by: "phone" })
  })
  it("does not match different email even if phone matches", () => {
    const r = resolveCustomerIdentity({ id: "3", name: "Meta", email: "meta@x.si", phone: "041333" }, { name: "Meta", email: "druga@y.si", phone: "041333" })
    expect(r.matched).toBe(false)
  })
})

describe("Ročno dodajanje, urejanje, arhiviranje", () => {
  it("createCustomer + updateCustomer + listCustomers", async () => {
    const c1 = await createCustomer({ name: "Ana Novak", email: "ana@x.si", phone: "041111" })
    expect(c1.ok).toBe(true)
    const before = await createCustomer({ name: "Ana Novak", email: "ANA@x.si", phone: "040000" })
    expect(before.ok).toBe(false) // email duplicate / identity match
    const upd = await updateCustomer(c1.id!, { phone: "040000", tags: ["VIP"], notes: "redna" })
    expect(upd.ok).toBe(true)
    const list = await listCustomers({})
    expect(list.find((c) => c.id === c1.id)?.phone).toBe("040000")
    expect(list.find((c) => c.id === c1.id)?.tags).toEqual(["VIP"])
  })

  it("archive + unarchive (history preserved)", async () => {
    const c = await createCustomer({ name: "Meta" })
    await archiveCustomer(c.id!)
    expect((await listCustomers({})).find((x) => x.id === c.id)).toBeUndefined()
    expect((await listCustomers({ archived: true })).find((x) => x.id === c.id)?.isArchived).toBe(true)
    await unarchiveCustomer(c.id!)
    expect((await listCustomers({})).find((x) => x.id === c.id)?.isArchived).toBe(false)
  })
})

describe("Org izolacija + IDOR", () => {
  it("georg B ne vidi in ne upravlja strank A", async () => {
    const c = await createCustomer({ name: "A-stranka", email: "a@x.si", phone: "041111" })
    asOrgB()
    expect(await listCustomers({})).toHaveLength(0)
    expect(await getCustomerDetail(c.id!)).toBeNull()
    const upd = await updateCustomer(c.id!, { phone: "090999" })
    expect(upd.ok).toBe(false)
    const arch = await archiveCustomer(c.id!)
    expect(arch.ok).toBe(false)
    const anon = await anonymizeCustomer(c.id!)
    expect(anon.ok).toBe(false)
    const exp = await exportCustomerData(c.id!)
    expect(exp.ok).toBe(false)
  })
})

describe("Opombe za stranke brez računa", () => {
  it("updateCustomerNotesByCustomerId deluje za lead (brez User)", async () => {
    const c = await createCustomer({ name: "Lead", email: "lead@x.si" })
    const res = await updateCustomerNotesByCustomerId(c.id!, "Opomba za lead")
    expect(res.success).toBe(true)
    expect((await listCustomers({})) .find((x) => x.id === c.id)?.notes).toBe("Opomba za lead")
    // Stari updateCustomerNotes (userId) mora vrniti napako (ne user-a),
     // ne pa pasti in doger. Lead brez računa ne sme biti dosegljiv po userId.
     const legacy = await updateCustomerNotes(c.id!, "x")
     expect(legacy.success).toBe(false)
  })
})

describe("Walk-in povezava", () => {
  it("linkWalkInCustomer poveže vstop s stranko samo v isti org", async () => {
    const c = await createCustomer({ name: "Walk gost", phone: "041999" })
    // Javni vstop se ustvari (mock session za javne poti je ID-org oblivious;
    // uporabimo neposredni create z joinWalkInQueue — gost brez računa).
    const join = await joinWalkInQueue({ name: "Walk gost", phone: "041999" })
    expect(join.success).toBe(true)
    const entry = await prisma.walkInEntry.findFirst({ where: { organizationId: ORGA } })
    expect(entry).toBeTruthy()
    expect(entry?.customerId).toBeNull() // ne samodejno (zasebnost)
    const link = await linkWalkInCustomer(entry!.id, c.id!)
    expect(link.ok).toBe(true)
    const detail = await getCustomerDetail(c.id!)
    expect(detail?.walkInEntries.length).toBe(1)
    // IDOR: B ne more povezati A vstopa.
    asOrgB()
    const bad = await linkWalkInCustomer(entry!.id, c.id!)
    expect(bad.ok).toBe(false)
  })
})

describe("Zgodovina + GDPR", () => {
  it("getCustomerDetail vključi (po pogoji) zgodovino; export/anonymize", async () => {
    const c = await createCustomer({ name: "Zgodovina", email: "z@x.si", phone: "041000" })
    // Ustvarimo termin + delovni nalog + dokument za stranko.
    const dt = new Date()
    await prisma.appointment.create({ data: { staffId: STAFF, customerId: c.id!, organizationId: ORGA, startTime: dt, endTime: new Date(Date.now() + 3600e3), totalPrice: 25, status: "COMPLETED" } })
    await prisma.workOrder.create({ data: { organizationId: ORGA, customerId: c.id!, number: 1, title: "Servis 1", status: "COMPLETED" } })
    await prisma.document.create({ data: { organizationId: ORGA, customerId: c.id!, type: "INVOICE", number: 1, fiscalYear: new Date().getFullYear(), status: "DRAFT", total: 25, subtotal: 25, taxBase: 25, taxTotal: 0, issueDate: dt, dueDate: dt } })

    const detail = await getCustomerDetail(c.id!)
    expect(detail).not.toBeNull()
    expect(detail!.appointments.length).toBeGreaterThanOrEqual(1)
    expect(detail!.workOrders.length).toBeGreaterThanOrEqual(1)
    expect(detail!.documents.length).toBeGreaterThanOrEqual(1)
    expect(detail!.totalSpent).toBe(25)

    // GDPR izvoz.
    const exp = await exportCustomerData(c.id!)
    expect(exp.ok).toBe(true)
    if (exp.ok) expect(exp.data.email).toBe("z@x.si")

    // Anonimizacija: obdrži zgodovino, zbriše osebne podatke.
    await anonymizeCustomer(c.id!)
    const after = await prisma.customer.findUnique({ where: { id: c.id! } })
    expect(after?.email).toBeNull()
    expect(after?.phone).toBeNull()
    expect(after?.name).toBe("Anonimizirana stranka")
    expect(after?.isArchived).toBe(true)
    // Zgodovina (termin, nalog, dok.) ostane.
    expect(await prisma.appointment.count({ where: { customerId: c.id! } })).toBe(1)
    expect(await prisma.workOrder.count({ where: { customerId: c.id! } })).toBe(1)
    expect(await prisma.document.count({ where: { customerId: c.id! } })).toBe(1)
  })
})

// ============================================================
// F5.5.3.1 — STAFF dostopna matrika + ista oseba v dveh org.
// ============================================================

function asStaff() {
  state.session = { user: { id: STAFFU, role: "STAFF", organizationId: ORGA, email: "s@f.test" } }
}

function asRestricted() {
  state.session = { user: { id: RESTRICTEDU, role: "STAFF", organizationId: ORGA, email: "r@f.test" } }
}

describe("STAFF z dovoljenjem (privzeta polna vloga)", () => {
  beforeEach(() => {
    asStaff()
  })
  it("STAFF (brez custom role) lahko ustvari, uredi in arhivira stranko", async () => {
    const c = await createCustomer({ name: "Staff stranka", email: "staff@x.si", phone: "041111" })
    expect(c.ok).toBe(true)
    const upd = await updateCustomer(c.id!, { notes: "opomba", tags: ["Redna"] })
    expect(upd.ok).toBe(true)
    const list = await listCustomers({})
    expect(list.find((x) => x.id === c.id)?.notes).toBe("opomba")
    const arch = await archiveCustomer(c.id!)
    expect(arch.ok).toBe(true)
    expect((await listCustomers({})).find((x) => x.id === c.id)).toBeUndefined()
    expect((await listCustomers({ archived: true })).find((x) => x.id === c.id)?.isArchived).toBe(true)
    // Skupna poraba + detail dostopna.
    expect(await getCustomerDetail(c.id!)).not.toBeNull()
  })
})

describe("STAFF s custom role brez customers.manage (zavrnjen)", () => {
  beforeEach(() => {
    asRestricted()
  })
  it("vse customer akcije vržejo Unauthorized (fail-closed)", async () => {
    await expect(createCustomer({ name: "X" })).rejects.toThrow()
    await expect(updateCustomer("any-id", { name: "Y" })).rejects.toThrow()
    await expect(listCustomers({})).rejects.toThrow()
    await expect(archiveCustomer("any-id")).rejects.toThrow()
    await expect(anonymizeCustomer("any-id")).rejects.toThrow()
    await expect(exportCustomerData("any-id")).rejects.toThrow()
    await expect(linkWalkInCustomer("any-entry", "any-cust")).rejects.toThrow()
    await expect(getCustomerDetail("any-id")).rejects.toThrow()
  })
  it("ne more zapisati opomb (notes prav tako gated, fail-closed)", async () => {
    const res = await updateCustomerNotesByCustomerId("any-id", "x")
    expect(res.success).toBe(false)
    // Zapis brez dovoljenja nikoli ne uspe — ne glede na customerId.
  })
})

describe("Ista oseba v dveh organizacijah", () => {
  it("org A in org B imata LOČEN Customer; sprememba v A ne spremeni B", async () => {
    // Kot ADMIN A ustvarimo stranko "Zajc" z enim emailom.
    const cA = await createCustomer({ name: "Janez Zajc", email: "zajc@x.si", phone: "041000" })
    expect(cA.ok).toBe(true)
    // Ista oseba v org B ima svojo vrstico (org-scoped) — ista e-pošta NI
    // blokirana, ker identity-politika velja znotraj org.
    asOrgB()
    const cB = await createCustomer({ name: "Janez Zajc", email: "zajc@x.si", phone: "041000" })
    expect(cB.ok).toBe(true)
    expect(cB.id).not.toBe(cA.id)
    // Sprememba v B (npr. anonimizacija) ne vpliva na A.
    await anonymizeCustomer(cB.id!)
    const afterB = await prisma.customer.findUnique({ where: { id: cB.id! } })
    expect(afterB?.email).toBeNull()
    const afterA = await prisma.customer.findUnique({ where: { id: cA.id! } })
    expect(afterA?.email).toBe("zajc@x.si")
    expect(afterA?.isArchived).toBe(false)
    // B ne vidi A-jevega seznama.
    expect(await listCustomers({})).toHaveLength(0)
  })
})