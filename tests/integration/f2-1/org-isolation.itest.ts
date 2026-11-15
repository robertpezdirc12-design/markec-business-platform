// ============================================================
// F2.1 — VARNOSTNI INTEGRACIJSKI TESTI (prava testna baza)
//
// Ti testi NE preverjajo izvorne kode kot niz. Kličejo resnične
// strežniške funkcije (resolverje, guarde, server actions) proti
// resnični, ločeni bazi `markec_f21_test` (glej seed.mjs).
//
// Edino kar je nadomeščeno je *seja* (NextAuth `auth()`) in
// `next/cache` / `next/headers` — vse odločitve o dostopu, vse
// poizvedbe in vsi zapisi gredo skozi pravi Prisma klient.
// ============================================================

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: {
      id: string
      role: "ADMIN" | "STAFF" | "CLIENTE"
      organizationId?: string | null
      email?: string | null
      name?: string | null
    }
  },
  updates: [] as unknown[],
  headerEntries: {} as Record<string, string>,
  orgProofValid: true,
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async (patch: unknown) => {
    state.updates.push(patch)
    return null
  },
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headerEntries),
}))

vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => state.orgProofValid,
}))

import { prisma } from "@/lib/prisma"
import {
  resolveSessionOrganization,
  requireSessionOrg,
  hasActiveMembershipInOrg,
  UnauthorizedError,
} from "@/lib/auth/guards"
import { resolveActiveOrganizationId } from "@/lib/auth/memberships"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { getPublicOrg, requireAdminOrg, getSessionOrg, getResolvedOrg } from "@/lib/tenant"
import { switchActiveOrganization } from "@/app/actions/organization-switch"
import { getWorkspacePicker, getActiveWorkspaceCount } from "@/app/actions/workspaces"
import {
  getAdminUsers,
  updateCustomerTags,
  updateCustomerBirthday,
  updateCustomerNotes,
  updateUserRole,
  adminSetUserPassword,
  deleteUser,
} from "@/app/actions/users"

const ID = {
  orgA: "f21-org-a",
  orgB: "f21-org-b",
  orgC: "f21-org-c",
  orgD: "f21-org-draft",
  orgS: "f21-org-suspended",
  admin: "f21-user-admin",
  staff: "f21-user-staff",
  cliente: "f21-user-cliente",
  otherAdmin: "f21-user-other-admin",
  legacy: "f21-user-legacy",
  suspendedOnly: "f21-user-suspended-only",
  clientA: "f21-user-client-a",
  clientB: "f21-user-client-b",
  customerA: "f21-customer-a",
  customerB: "f21-customer-b",
}

function loginAs(
  id: string,
  role: "ADMIN" | "STAFF" | "CLIENTE",
  organizationId: string | null = null
) {
  state.session = {
    user: { id, role, organizationId, email: `${id}@f21.test`, name: id },
  }
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f21_test", "markec_e2e_test"]).toContain(rows[0].db)
  const orgs = await prisma.organization.count({
    where: { id: { startsWith: "f21-" } },
  })
  expect(orgs).toBe(5)
})

beforeEach(() => {
  state.session = null
  state.updates = []
  state.headerEntries = {}
  state.orgProofValid = true
})

afterAll(async () => {
  await prisma.$disconnect()
})

// ------------------------------------------------------------
// 1. Org resolver — fail-closed, brez globalnega fallbacka
// ------------------------------------------------------------
describe("F2.1 §2 — enoten fail-closed org resolver", () => {
  it("lastni ACTIVE workspace se razreši iz članstva", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    const org = await resolveSessionOrganization(state.session)
    expect(org?.id).toBe(ID.orgA)

    loginAs(ID.admin, "ADMIN", ID.orgB)
    expect((await resolveSessionOrganization(state.session))?.id).toBe(ID.orgB)
  })

  it("tuji/stari JWT org NE more vezati seje na tuje podjetje", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgC) // C is ACTIVE but NOT a membership
    const org = await resolveSessionOrganization(state.session)
    expect(org?.id).toBe(ID.orgA) // falls back to own default, never C
    expect(org?.id).not.toBe(ID.orgC)
    expect(await resolveActiveOrganizationId(ID.admin, ID.orgC)).toBe(ID.orgA)
  })

  it("račun BREZ članstev (legacy) ni razrešen niti s ponarejenim orgId", async () => {
    loginAs(ID.legacy, "ADMIN", null)
    expect(await resolveSessionOrganization(state.session)).toBeNull()

    loginAs(ID.legacy, "ADMIN", ID.orgA) // forged/stale JWT pointer
    // `resolveActiveOrganizationId` still does the legacy dual-read and
    // returns A — but the membership-evidence check MUST deny it.
    expect(await resolveActiveOrganizationId(ID.legacy, ID.orgA)).toBe(ID.orgA)
    expect(await resolveSessionOrganization(state.session)).toBeNull()
  })

  it("članstvo samo v SUSPENDED orgu → null (fail-closed)", async () => {
    loginAs(ID.suspendedOnly, "ADMIN", ID.orgS)
    expect(await resolveSessionOrganization(state.session)).toBeNull()
    expect(await resolveActiveOrganizationId(ID.suspendedOnly, ID.orgS)).toBeNull()
  })

  it("anonimni klic → null", async () => {
    expect(await resolveSessionOrganization(null)).toBeNull()
  })

  it("requireSessionOrg() zavrne legacy / suspended / anonimnega", async () => {
    for (const [id, orgId] of [
      [ID.legacy, ID.orgA],
      [ID.suspendedOnly, ID.orgS],
    ] as const) {
      loginAs(id, "ADMIN", orgId)
      await expect(requireSessionOrg()).rejects.toBeInstanceOf(UnauthorizedError)
    }
    state.session = null
    await expect(requireSessionOrg()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it("requireSessionOrg() vrne lastni org za veljavno članstvo", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgB)
    const { session, org } = await requireSessionOrg()
    expect(session.user.id).toBe(ID.admin)
    expect(org.id).toBe(ID.orgB)
  })

  it("requireAdminOrg() NE uporabi več 'prvo ACTIVE podjetje' rezerve", async () => {
    loginAs(ID.legacy, "ADMIN", null)
    await expect(requireAdminOrg()).rejects.toBeInstanceOf(UnauthorizedError)

    loginAs(ID.admin, "ADMIN", ID.orgA)
    expect((await requireAdminOrg()).org.id).toBe(ID.orgA)
  })

  it("getSessionOrg() je prav tako fail-closed", async () => {
    loginAs(ID.legacy, "ADMIN", null)
    expect(await getSessionOrg()).toBeNull()
    loginAs(ID.admin, "ADMIN", ID.orgB)
    expect((await getSessionOrg())?.id).toBe(ID.orgB)
  })

  it("getResolvedOrg(): prijavljen ADMIN brez razrešenega org → null, ne javni default", async () => {
    loginAs(ID.legacy, "ADMIN", null)
    expect(await getResolvedOrg()).toBeNull()
    loginAs(ID.admin, "ADMIN", ID.orgA)
    expect((await getResolvedOrg())?.id).toBe(ID.orgA)
  })

  it("CLIENTE ostane na javni veji (nima administratorskega konteksta)", async () => {
    loginAs(ID.cliente, "CLIENTE", null)
    expect(await resolveSessionOrganization(state.session)).toBeNull()
    expect(await getEffectivePermissions(ID.cliente, ID.orgA)).toEqual([])
    // Public resolution still serves the platform root tenant.
    expect(await getResolvedOrg()).not.toBeNull()
  })
})

// ------------------------------------------------------------
// 2. Preklop organizacije zahteva veljavno ACTIVE članstvo
// ------------------------------------------------------------
describe("F2.1 §3 — preklop A→B→A in zavrnitev tujih/neaktivnih", () => {
  it("tuji ACTIVE org (C) ni preklopnik; DB kazalec ostane nespremenjen", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: ID.admin } })).organizationId
    const res = await switchActiveOrganization(ID.orgC)
    expect(res.success).toBe(false)
    expect(res.error).toContain("ni na voljo")
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: ID.admin } })).organizationId
    expect(after).toBe(before)
  })

  it("SUSPENDED org ni preklopnik (tudi če je org znan)", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    expect((await switchActiveOrganization(ID.orgS)).success).toBe(false)
  })

  it("lastni SUSPENDED član je zavrnjen z 'ni aktivno'", async () => {
    loginAs(ID.suspendedOnly, "ADMIN", null)
    const res = await switchActiveOrganization(ID.orgS)
    expect(res.success).toBe(false)
    expect(res.error).toContain("ni aktivno")
  })

  it("neprijavljen preklop je zavrnjen", async () => {
    expect((await switchActiveOrganization(ID.orgB)).success).toBe(false)
  })

  it("A→B→A: obe smeri, JWT update, persistenca zadnjega workspacea", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    const toB = await switchActiveOrganization(ID.orgB)
    expect(toB.success).toBe(true)
    expect(toB.organizationName).toContain("Vulkanizer")
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ID.admin } })).organizationId
    ).toBe(ID.orgB)
    expect(state.updates).toEqual([{ user: { organizationId: ID.orgB } }])

    loginAs(ID.admin, "ADMIN", ID.orgB)
    const toA = await switchActiveOrganization(ID.orgA)
    expect(toA.success).toBe(true)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ID.admin } })).organizationId
    ).toBe(ID.orgA)
    expect((await resolveSessionOrganization(state.session))?.id).toBe(ID.orgB)
  })
})

// ------------------------------------------------------------
// 3. Izolacija branja
// ------------------------------------------------------------
describe("F2.1 §3 — uporabnik org A ne bere podatkov B", () => {
  it("vstopna tabla prikaže SAMO lastna ACTIVE članstva (A + B, brez C in SUSPENDED)", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    const { workspaces, activeOrganizationId } = await getWorkspacePicker()
    expect(workspaces.map((w) => w.id).sort()).toEqual([ID.orgA, ID.orgB].sort())
    expect(activeOrganizationId).toBe(ID.orgA)
    expect(await getActiveWorkspaceCount()).toBe(2)
  })

  it("getAdminUsers() v A ne vrne uporabnikov B", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgA)
    const users = await getAdminUsers()
    const emails = users.map((u) => u.email)
    expect(emails).not.toContain("bclient@f21.test")
    expect(emails).not.toContain("other@f21.test")
    expect(emails).toContain("aclient@f21.test")
  })

  it("getAdminUsers() v B ne vrne uporabnikov A", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgB)
    const emails = (await getAdminUsers()).map((u) => u.email)
    expect(emails).not.toContain("aclient@f21.test")
    expect(emails).toContain("bclient@f21.test")
  })

  it("getEffectivePermissions: tuji admin v A nima pravic; naš admin nima pravic v C", async () => {
    expect(await getEffectivePermissions(ID.otherAdmin, ID.orgA)).toEqual([])
    expect(await getEffectivePermissions(ID.admin, ID.orgC)).toEqual([])
    expect(await getEffectivePermissions(ID.admin, ID.orgA)).toContain("settings.manage")
  })

  it("DRAFT predogled: ponarejen x-org-slug + legacy JWT pointer ne odpre tuje strani", async () => {
    // The old gate trusted session.user.organizationId === org.id.
    // Give the caller a JWT that *claims* the DRAFT org, but no membership.
    loginAs(ID.legacy, "ADMIN", ID.orgD)
    state.headerEntries = { "x-org-slug": "f21-draft", "x-org-slug-proof": "signed" }
    expect(await hasActiveMembershipInOrg(ID.legacy, ID.orgD)).toBe(false)
    expect(await getPublicOrg()).toBeNull()

    // A real member of an org may preview (positive control on the helper).
    expect(await hasActiveMembershipInOrg(ID.admin, ID.orgA)).toBe(true)
  })
})

// ------------------------------------------------------------
// 4. Izolacija spreminjanja + operacije nad uporabniki B
// ------------------------------------------------------------
describe("F2.1 §3 — uporabnik org A ne spreminja podatkov B", () => {
  beforeEach(() => loginAs(ID.admin, "ADMIN", ID.orgA))

  it("updateCustomerTags(customerB) je zavrnjen in B ostane nedotaknjena", async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: ID.customerB } })
    const res = await updateCustomerTags(ID.customerB, ["HACKED"])
    expect(res.success).toBe(false)
    const after = await prisma.customer.findUniqueOrThrow({ where: { id: ID.customerB } })
    expect(after.tags).toEqual(before.tags)
    expect(after.tags).not.toContain("HACKED")
  })

  it("updateCustomerBirthday(customerB) je zavrnjen", async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: ID.customerB } })
    expect((await updateCustomerBirthday(ID.customerB, "1990-01-01")).success).toBe(false)
    const after = await prisma.customer.findUniqueOrThrow({ where: { id: ID.customerB } })
    expect(after.dateOfBirth).toEqual(before.dateOfBirth)
  })

  it("updateCustomerNotes(userB) je zavrnjen", async () => {
    expect((await updateCustomerNotes(ID.clientB, "HACKED")).success).toBe(false)
  })

  it("updateUserRole(userB) je zavrnjen z 'ni član tega salona'", async () => {
    const res = await updateUserRole(ID.clientB, "STAFF")
    expect(res.success).toBe(false)
    expect(res.error).toContain("ni član")
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ID.clientB } })).role).toBe("CLIENTE")
  })

  it("adminSetUserPassword(userB) je zavrnjen in hash gesla ostane", async () => {
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: ID.clientB } })).password
    const res = await adminSetUserPassword({
      userId: ID.clientB,
      password: "F21NewPass!2026",
    })
    expect(res.success).toBe(false)
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: ID.clientB } })).password
    expect(after).toBe(before)
  })

  it("deleteUser(userB) je zavrnjen in uporabnik še obstaja", async () => {
    expect((await deleteUser(ID.clientB)).success).toBe(false)
    expect(await prisma.user.findUnique({ where: { id: ID.clientB } })).not.toBeNull()
  })

  it("POZITIVNA KONTROLA: lastna stranka A se lahko uredi (guard ni vedno false)", async () => {
    const res = await updateCustomerTags(ID.customerA, ["VIP"])
    expect(res.success).toBe(true)
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: ID.customerA } })).tags).toContain("VIP")
    // restore for other runs
    await prisma.customer.update({ where: { id: ID.customerA }, data: { tags: [] } })
  })

  it("preklop na B potem dovoli urejanje B (kontekst se res spremeni)", async () => {
    loginAs(ID.admin, "ADMIN", ID.orgB)
    expect((await updateCustomerTags(ID.customerB, ["B-OK"])).success).toBe(true)
    expect((await updateCustomerTags(ID.customerA, ["LEAK"])).success).toBe(false)
    await prisma.customer.update({ where: { id: ID.customerB }, data: { tags: [] } })
  })
})

// ------------------------------------------------------------
// 5. STAFF: različne vloge in dovoljenja glede na aktivni org
// ------------------------------------------------------------
describe("F2.1 §3 — STAFF v dveh orgih z različnimi vlogami/pravicami", () => {
  it("OrganizationMember.role se razlikuje med A in B", async () => {
    const a = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: ID.orgA, userId: ID.staff } },
    })
    const b = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: ID.orgB, userId: ID.staff } },
    })
    expect(a.role).toBe("STAFF")
    expect(b.role).toBe("ADMIN")
    expect(a.customRoleId).not.toBe(b.customRoleId)
  })

  it("efektivna dovoljenja so strogo per-org in se ne prelivajo", async () => {
    const permsA = await getEffectivePermissions(ID.staff, ID.orgA)
    const permsB = await getEffectivePermissions(ID.staff, ID.orgB)
    expect(permsA).toEqual(["appointments.view", "appointments.manage", "customers.manage"])
    expect(permsB).toEqual(["products.manage", "orders.manage", "analytics.view"])
    expect(permsA.some((p) => permsB.includes(p))).toBe(false)
  })

  it("aktivni org STAFF se razreši A ali B glede na sejo", async () => {
    loginAs(ID.staff, "STAFF", ID.orgA)
    expect((await resolveSessionOrganization(state.session))?.id).toBe(ID.orgA)
    loginAs(ID.staff, "STAFF", ID.orgB)
    expect((await resolveSessionOrganization(state.session))?.id).toBe(ID.orgB)
  })

  it("STAFF v tujem orgu C nima nobenih pravic", async () => {
    expect(await getEffectivePermissions(ID.staff, ID.orgC)).toEqual([])
  })
})
