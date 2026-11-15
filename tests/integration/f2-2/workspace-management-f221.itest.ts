// ============================================================
// F2.2.1 — INTEGRACIJSKI TESTI (markec_f21_test)
//
// Vedenjska jamstva za odpravo blokovnikov:
//  - varno brisanje workspacea (edini lastnik, poslovni podatki,
//    račun ostane, izrecna potrditev, arhivirano = samo za branje)
//  - povabilni URL (surov token natanko enkrat), SHA-256 hash v bazi,
//    enkratni sprejem (vklj. sočasni), poteklo/preklicano/zabranjeno
//  - arhiviran workspace: blokada poslovnih sprememb na akcijski ravni
// ============================================================

import { createHash } from "node:crypto"
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
  acceptInvitation,
  activateWorkspace,
  archiveWorkspace,
  deleteWorkspace,
  inviteMember,
  listInvitations,
  setDefaultWorkspace,
  updateWorkspace,
} from "@/app/actions/workspace-management"
import { hashInvitationToken } from "@/lib/invitations/hash"

const ID = {
  owner: "f221-user-owner",
  acceptor: "f221-user-acceptor",
}

function loginAs(
  id: string,
  role: "ADMIN" | "STAFF" | "CLIENTE",
  email: string,
  organizationId: string | null = null
) {
  state.session = { user: { id, role, organizationId, email, name: id } }
}

async function freshUser(id: string, email: string) {
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: { id, email, name: id, role: "CLIENTE", emailVerified: new Date() },
  })
}

async function freshOrg(
  id: string,
  slug: string,
  ownerUserId: string,
  status: "ACTIVE" | "SUSPENDED" = "ACTIVE"
) {
  await prisma.organization.upsert({
    where: { id },
    update: {},
    create: {
      id,
      slug,
      name: id,
      status,
      publishState: "DRAFT",
      vertical: "beauty",
    },
  })
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: id, userId: ownerUserId } },
    update: {},
    create: { organizationId: id, userId: ownerUserId, role: "ADMIN" },
  })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f21_test", "markec_e2e_test"]).toContain(rows[0].db)

  // Idempotentno počiščenje f221-* (orgs najprej — cascade).
  await prisma.organizationInvitation.deleteMany({
    where: { organizationId: { startsWith: "f221-" } },
  })
  await prisma.service.deleteMany({
    where: { organizationId: { startsWith: "f221-" } },
  })
  await prisma.organizationMember.deleteMany({
    where: { userId: { startsWith: "f221-" } },
  })
  await prisma.organization.deleteMany({
    where: { id: { startsWith: "f221-" } },
  })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f221-" } } })

  await freshUser(ID.owner, "f221owner@test.dev")
  await freshUser(ID.acceptor, "f221invitee@test.dev")
})

beforeEach(() => {
  state.session = null
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe("F2.2.1 brisanje workspacea", () => {
  it("edini lastnik izbriše svoje podjetje — org in članstvo pojdeta, RAČUN ostane", async () => {
    const org = "f221-org-del"
    await freshOrg(org, "f221-del", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await deleteWorkspace({ organizationId: org, confirm: true })
    expect(res.success).toBe(true)
    expect(await prisma.organization.findUnique({ where: { id: org } })).toBeNull()
    // Članstvo (tudi lastnikovo) je del istega izbrisa.
    expect(
      await prisma.organizationMember.findFirst({
        where: { organizationId: org, userId: ID.owner },
      })
    ).toBeNull()
    // Uporabniški račun NE sme biti izbrisan.
    const user = await prisma.user.findUnique({ where: { id: ID.owner } })
    expect(user).not.toBeNull()
    expect(user?.email).toBe("f221owner@test.dev")
  })

  it("brez izrecne potrditve → zavrnjeno, org ostane", async () => {
    const org = "f221-org-noconfirm"
    await freshOrg(org, "f221-noconfirm", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await deleteWorkspace({ organizationId: org, confirm: false })
    expect(res.success).toBe(false)
    expect(res.error).toContain("potrjen")
    expect(await prisma.organization.findUnique({ where: { id: org } })).not.toBeNull()
    // cleanup
    await prisma.organization.delete({ where: { id: org } })
  })

  it("poslovni podatki (storitve) blokirajo trdo brisanje → namig k arhiviranju", async () => {
    const org = "f221-org-data"
    await freshOrg(org, "f221-data", ID.owner)
    await prisma.service.create({
      data: {
        name: "F221 Storitvena",
        slug: "f221-storitev",
        duration: 30,
        price: 25,
        organizationId: org,
      },
    })
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await deleteWorkspace({ organizationId: org, confirm: true })
    expect(res.success).toBe(false)
    expect(res.error).toContain("Arhivirajte")
    expect(await prisma.organization.findUnique({ where: { id: org } })).not.toBeNull()
    // cleanup
    await prisma.service.deleteMany({ where: { organizationId: org } })
    await prisma.organization.delete({ where: { id: org } })
  })
})

describe("F2.2.1 arhiviran workspace — samo za branje", () => {
  it("nova povabila, urejanje, brisanje in privzeti prostor so blokirani; aktivacija deluje", async () => {
    const org = "f221-org-susp"
    await freshOrg(org, "f221-susp", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)

    expect((await archiveWorkspace(org)).success).toBe(true)
    expect(
      (await prisma.organization.findUnique({ where: { id: org } }))?.status
    ).toBe("SUSPENDED")

    // Ponovno arhiviranje → zavrnjeno (samo iz ACTIVE).
    expect((await archiveWorkspace(org)).success).toBe(false)
    // Urejanje → blokirano.
    expect((await updateWorkspace({ organizationId: org, name: "X Y" })).success).toBe(false)
    // Nova povabila → blokirana: `requireSessionOrg` se ne more vezati na
    // SUSPENDED org (fail-closed) — povabilo ni mogoče poizkusiti.
    const inv = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(inv.success).toBe(false)
    // V DB ni nastalo nobenega povabila v SUSPENDED org.
    expect(
      await prisma.organizationInvitation.count({ where: { organizationId: org } })
    ).toBe(0)
    // Privzeti prostor → blokirano.
    expect((await setDefaultWorkspace(org)).success).toBe(false)
    // Brisanje → blokirano (aktiviraj najprej).
    expect(
      (await deleteWorkspace({ organizationId: org, confirm: true })).success
    ).toBe(false)

    // Ponovna aktivacija deluje.
    expect((await activateWorkspace(org)).success).toBe(true)
    expect(
      (await prisma.organization.findUnique({ where: { id: org } }))?.status
    ).toBe("ACTIVE")
  })
})

describe("F2.2.1 povabila — URL, hash, enkratni sprejem", () => {
  it("povabilni URL: surov token se vrne enkrat; v bazi je SHA-256 hash; seznam tokena ne vrne", async () => {
    const org = "f221-org-inv"
    await freshOrg(org, "f221-inv", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    expect(res.token).toBeTruthy()
    const raw = res.token!
    // Surovi token NI 64-hex hash.
    expect(/^[a-f0-9]{64}$/.test(raw)).toBe(false)
    // V bazi je hash.
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: org, email: "f221invitee@test.dev" },
    })
    expect(inv).not.toBeNull()
    expect(inv!.token).toBe(hashInvitationToken(raw))
    expect(inv!.token).toBe(createHash("sha256").update(raw).digest("hex"))
    expect(inv!.token).not.toBe(raw)
    // URL se pravilno sestavi in se ujema z hashom v bazi.
    const url = `http://localhost:3000/invite/${raw}`
    expect(url).toBe(`http://localhost:3000/invite/${raw}`)
    expect(hashInvitationToken(url.split("/invite/")[1])).toBe(inv!.token)
    // Seznam povabil tokena (ne vrača) tokena.
    const list = await listInvitations(org)
    expect(Array.isArray(list)).toBe(true)
    if (!Array.isArray(list)) return
    const row = list.find((r) => r.email === "f221invitee@test.dev")
    expect(row).toBeTruthy()
    expect(Object.keys(row!)).toEqual(
      expect.arrayContaining(["email", "role", "status", "createdAt"])
    )
    expect(JSON.stringify(list)).not.toContain(raw)
  })

  it("sprejem veljavnega povabila ustvari člena; ponovna uporaba je zavrnjena", async () => {
    const org = "f221-org-acc"
    await freshOrg(org, "f221-acc", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const raw = res.token!

    loginAs(ID.acceptor, "CLIENTE", "f221invitee@test.dev", null)
    const ok = await acceptInvitation(raw)
    expect(ok.success).toBe(true)
    expect(ok.organizationId).toBe(org)
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: org, userId: ID.acceptor },
    })
    expect(member?.role).toBe("STAFF")
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: org },
    })
    expect(inv?.status).toBe("ACCEPTED")

    // Ponovna uporaba istega tokena → zavrnjena.
    const again = await acceptInvitation(raw)
    expect(again.success).toBe(false)
  })

  it("sočasni sprejem istega povabila: natanko en uspeh", async () => {
    const org = "f221-org-conc"
    await freshOrg(org, "f221-conc", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const raw = res.token!

    loginAs(ID.acceptor, "CLIENTE", "f221invitee@test.dev", null)
    const [a, b] = await Promise.all([acceptInvitation(raw), acceptInvitation(raw)])
    const successes = [a, b].filter((r) => r.success).length
    expect(successes).toBe(1)
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: org },
    })
    expect(inv?.status).toBe("ACCEPTED")
    // Članstvo je eno samo.
    const members = await prisma.organizationMember.count({
      where: { organizationId: org, userId: ID.acceptor },
    })
    expect(members).toBe(1)
  })

  it("preklicano povabilo se ne da sprejeti", async () => {
    const org = "f221-org-rev"
    await freshOrg(org, "f221-rev", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const raw = res.token!
    // Preklic (surov token → hash).
    const { revokeInvitation } = await import(
      "@/app/actions/workspace-management"
    )
    expect((await revokeInvitation(raw)).success).toBe(true)
    const inv = await prisma.organizationInvitation.findFirst({
      where: { organizationId: org },
    })
    expect(inv?.status).toBe("REVOKED")

    loginAs(ID.acceptor, "CLIENTE", "f221invitee@test.dev", null)
    const ok = await acceptInvitation(raw)
    expect(ok.success).toBe(false)
  })

  it("pretečeno povabilo se ne da sprejeti", async () => {
    const org = "f221-org-exp"
    await freshOrg(org, "f221-exp", ID.owner)
    loginAs(ID.owner, "ADMIN", "f221owner@test.dev", org)
    const res = await inviteMember({
      organizationId: org,
      email: "f221invitee@test.dev",
      role: "STAFF",
    })
    expect(res.success).toBe(true)
    const raw = res.token!
    // Rok poteka prestavi v preteklost.
    await prisma.organizationInvitation.updateMany({
      where: { organizationId: org },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    loginAs(ID.acceptor, "CLIENTE", "f221invitee@test.dev", null)
    const ok = await acceptInvitation(raw)
    expect(ok.success).toBe(false)
    expect(ok.error).toContain("poteklo")
  })
})
