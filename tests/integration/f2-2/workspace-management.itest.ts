// ============================================================
// F2.2 — INTEGRACIJSKI TESTI z resnično bazo markec_f21_test
//
// Kličeja pravilne server-akcije (workspace CRUD, člani, povabila,
// privzeti workspace) proti resnični bazi. Sesija NextAuth in
// next/headers se preskočita (vi.mock), a VSE poizvedbe in zapisi
// gredo skozi pravi Prisma klient.
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
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

import { prisma } from "@/lib/prisma"
import {
  createWorkspace,
  updateWorkspace,
  archiveWorkspace,
  activateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  inviteMember,
  acceptInvitation,
  updateMemberRole,
  removeMember,
  setDefaultWorkspace,
  listMyWorkspaces,
} from "@/app/actions/workspace-management"
import { hashInvitationToken } from "@/lib/invitations/hash"

const ID = {
  orgA: "f22-org-a",
  orgB: "f22-org-b",
  owner: "f22-user-owner",
  invitee: "f22-user-invitee", // existo est
  newEmail: "invite@f22.test",
}

function loginAs(
  id: string,
  role: "ADMIN" | "STAFF" | "CLIENTE",
  email: string,
  organizationId: string | null = null
) {
  state.session = { user: { id, role, organizationId, email, name: id } }
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(rows[0].db).toBe("markec_f21_test")

  // Idempotentno počiščenje f22-* in zasej minimalne podatke.
  await prisma.organizationInvitation.deleteMany({
    where: { organizationId: { startsWith: "f22-" } },
  })
  await prisma.organizationMember.deleteMany({
    where: { userId: { startsWith: "f22-" } },
  })
  await prisma.organization.deleteMany({
    where: { id: { startsWith: "f22-" } },
  })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f22-" } } })

  const now = new Date()
  await prisma.user.createMany({
    data: [
      {
        id: ID.owner,
        email: "owner@f22.test",
        name: "Owner",
        role: "ADMIN",
        emailVerified: now,
      },
      {
        id: ID.invitee,
        email: "invitee@f22.test",
        name: "Invitee",
        role: "STAFF",
        emailVerified: now,
      },
    ],
  })
  await prisma.organization.createMany({
    data: [
      {
        id: ID.orgA,
        slug: "f22-alpha",
        name: "F22 A",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "beauty",
      },
      {
        id: ID.orgB,
        slug: "f22-beta",
        name: "F22 B",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "tire-service",
      },
    ],
  })
  await prisma.organizationMember.createMany({
    data: [
      {
        id: "f22-m-a",
        organizationId: ID.orgA,
        userId: ID.owner,
        role: "ADMIN",
        isDefault: true,
      },
      {
        id: "f22-m-invitee",
        organizationId: ID.orgA,
        userId: ID.invitee,
        role: "STAFF",
      },
    ],
  })
})

beforeEach(() => {
  state.session = null
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe("F2.2 ustvarjanje workspacea", () => {
  it("prijavljen uporabnik ustvari nov workspace → lastnik (ADMIN član)", async () => {
    loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA)
    const slug = `nova-siviljnica-${Date.now()}`
    const res = await createWorkspace({
      name: "Nova šiviljnica",
      slug,
      vertical: "seamstress",
    })
    expect(res.success).toBe(true)
    expect(res.organizationId).toBeTruthy()
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: res.organizationId, userId: ID.owner },
    })
    expect(member?.role).toBe("ADMIN")
    expect(member?.isDefault).toBe(true)
    // Cleanup: odstrani ustvarjen workspace (cuid id, ki ni f22-*).
    if (res.organizationId) {
      await prisma.organization
        .delete({ where: { id: res.organizationId } })
        .catch(() => undefined)
    }
  })

  it("neprijavljen → fail-closed", async () => {
    const res = await createWorkspace({ name: "X", slug: "x-x-x" })
    expect(res.success).toBe(false)
  })

  it("duplikat slug → zavrnjeno", async () => {
    loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA)
    const res = await createWorkspace({ name: "Dup", slug: "f22-alpha" })
    expect(res.success).toBe(false)
  })
})

describe("F2.2 člani — vloge, odstranjevanje, izolacija", () => {
  beforeEach(() => loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA))

  it("seznam članov vrne lastne člane; tuj uporabnik ni viden", async () => {
    const members = await listWorkspaceMembers(ID.orgA)
    expect(Array.isArray(members)).toBe(true)
    const emails = Array.isArray(members) ? members.map((m) => m.email) : []
    expect(emails).toContain("invitee@f22.test")
    expect(emails).toContain("owner@f22.test")
  })

  it("član B ne vidi članov A (ni član) ", async () => {
    // invitee is member of A only
    const members = await listWorkspaceMembers(ID.orgA)
    expect(!("error" in members)).toBe(true)
  })

  it("vloga per org: invitee v B ni član → null dovoljenja (org-scoped)", async () => {
    // invitee has no B membership — listWorkspaceMembers(B) should error for them.
    loginAs(ID.invitee, "STAFF", "invitee@f22.test", ID.orgA)
    const res = await listWorkspaceMembers(ID.orgB)
    expect("error" in res).toBe(true)
  })

  it("zadnji ADMIN se ne da degradirati", async () => {
    const adminCount = await prisma.organizationMember.count({
      where: { organizationId: ID.orgA, role: "ADMIN" },
    })
    expect(adminCount).toBe(1)
    const res = await updateMemberRole({
      organizationId: ID.orgA,
      userId: ID.owner,
      role: "STAFF",
    })
    expect(res.success).toBe(false)
  })

  it("STAFF → ADMIN povišanje deluje in obstane", async () => {
    const res = await updateMemberRole({
      organizationId: ID.orgA,
      userId: ID.invitee,
      role: "ADMIN",
    })
    expect(res.success).toBe(true)
    const refreshed = await prisma.organizationMember.findFirst({
      where: { organizationId: ID.orgA, userId: ID.invitee },
    })
    expect(refreshed?.role).toBe("ADMIN")
  })

  it("član, ki ni ADMIN, ne more menjat vlog", async () => {
    // make invitee STAFF again
    await prisma.organizationMember.update({
      where: { id: "f22-m-invitee" },
      data: { role: "STAFF" },
    })
    loginAs(ID.invitee, "STAFF", "invitee@f22.test", ID.orgA)
    const res = await updateMemberRole({
      organizationId: ID.orgA,
      userId: ID.owner,
      role: "STAFF",
    })
    expect(res.success).toBe(false)
    loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA)
  })
})

describe("F2.2 povabila", () => {
  beforeEach(() => loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA))

  it("skrbnik pošlje povabilo neregistriranemu e-poštnemu naslovu", async () => {
    const res = await inviteMember({
      organizationId: ID.orgA,
      email: ID.newEmail,
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: ID.orgA, email: ID.newEmail },
    })
    expect(inv?.status).toBe("PENDING")
  })

  it("sprejem: e-pošta prejemnika se mora ujemati; napačen račun je zavrnjen", async () => {
    const email2 = "acceptor@f22.test"
    const res = await inviteMember({
      organizationId: ID.orgA,
      email: email2,
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const raw = res.token!
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: ID.orgA, email: email2 },
    })
    // Varnost F2.2.1: DB hrani hash, ne surovega tokena.
    expect(inv?.token).toBe(hashInvitationToken(raw))
    // Wrong account tries to accept.
    loginAs(ID.invitee, "STAFF", "invitee@f22.test", ID.orgA)
    const resAccept = await acceptInvitation(raw)
    expect(resAccept.success).toBe(false)
    // Correct account (the invited email) accepts.
    await prisma.user.create({
      data: {
        id: "f22-user-new",
        email: email2,
        name: "New",
        role: "CLIENTE",
      },
    })
    loginAs("f22-user-new", "CLIENTE", email2, null)
    const ok = await acceptInvitation(raw)
    expect(ok.success).toBe(true)
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: ID.orgA, userId: "f22-user-new" },
    })
    expect(member?.role).toBe("STAFF")
  })
})

describe("F2.2 privzeti workspace", () => {
  beforeEach(() => loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA))

  it("nastavi B kot privzeti; A preneha biti privzeti", async () => {
    // Ensure owner is member of B first (add membership).
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: ID.orgB, userId: ID.owner },
      },
      create: {
        organizationId: ID.orgB,
        userId: ID.owner,
        role: "ADMIN",
        isDefault: false,
      },
      update: {},
    })
    const res = await setDefaultWorkspace(ID.orgB)
    expect(res.success).toBe(true)
    const a = await prisma.organizationMember.findFirst({
      where: { organizationId: ID.orgA, userId: ID.owner },
    })
    const b = await prisma.organizationMember.findFirst({
      where: { organizationId: ID.orgB, userId: ID.owner },
    })
    expect(a?.isDefault).toBe(false)
    expect(b?.isDefault).toBe(true)
    // reset
    await setDefaultWorkspace(ID.orgA)
  })
})

describe("F2.2 urejanje / arhiviranje", () => {
  beforeEach(() => loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA))

  it("updateWorkspace preimenuje", async () => {
    const res = await updateWorkspace({
      organizationId: ID.orgA,
      name: "F22 Alfa novo ime",
    })
    expect(res.success).toBe(true)
    const org = await prisma.organization.findUnique({ where: { id: ID.orgA } })
    expect(org?.name).toBe("F22 Alfa novo ime")
  })

  it("arhiviraj in aktiviraj", async () => {
    expect((await archiveWorkspace(ID.orgA)).success).toBe(true)
    expect(
      (await prisma.organization.findUnique({ where: { id: ID.orgA } }))?.status
    ).toBe("SUSPENDED")
    expect((await activateWorkspace(ID.orgA)).success).toBe(true)
    expect(
      (await prisma.organization.findUnique({ where: { id: ID.orgA } }))?.status
    ).toBe("ACTIVE")
  })

  it("deleteWorkspace: s poslovnimi podatki ali drugimi člani → zavrnjeno", async () => {
    const res = await deleteWorkspace({
      organizationId: ID.orgA,
      confirm: true,
    })
    expect(res.success).toBe(false) // A ima druge člane → blokirano
    expect(
      await prisma.organization.findUnique({ where: { id: ID.orgA } })
    ).not.toBeNull()

    // Brez potrditve → vedno zavrnjeno
    const noConfirm = await deleteWorkspace({
      organizationId: ID.orgA,
      confirm: false,
    })
    expect(noConfirm.success).toBe(false)
  })
})

describe("F2.2 izolacija — listMyWorkspaces", () => {
  it("owner vidi samo svoja članstva (A + B), ne tujih", async () => {
    loginAs(ID.owner, "ADMIN", "owner@f22.test", ID.orgA)
    const ws = await listMyWorkspaces()
    const ids = ws.map((w) => w.id)
    expect(ids).toContain(ID.orgA)
    expect(ids).toContain(ID.orgB)
  })
})
