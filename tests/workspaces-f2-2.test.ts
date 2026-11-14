// ============================================================
// F2.2 — UPRAVLJANJE PODJETIJ IN POSLOVNIH PROSTOROV
//
// Strukturna jamstva: nova shema (OrganizationInvitation), čisti
// deli (validacija, generiranje), server-akcije org-scoped in
// fail-closed, UI vhodi. Vedenje dokažeta integracijski test proti
// markec_f21_test (tests/integration/f2-2/) in browser flow.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("F2.2 shema — OrganizationInvitation", () => {
  it("model obstaja z varnimi polji in unikatnimi omejitvami", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("model OrganizationInvitation"),
      schema.indexOf("}", schema.indexOf("model OrganizationInvitation"))
    )
    expect(block).toContain("token          String       @unique")
    expect(block).toContain('status         String       @default("PENDING")')
    expect(block).toContain("@@unique([organizationId, email])")
    expect(block).toContain("organizationId String")
    expect(block).toContain("expiresAt      DateTime?")
  })

  it("Organization ima invitations relacijo", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("invitations OrganizationInvitation[]")
  })
})

describe("F2.2 varnost akcij — org-scoped, fail-closed", () => {
  const actions = read("src/app/actions/workspace-management.ts")

  it("createWorkspace: nov workspace → lastnik (ADMIN), brez tujega org", () => {
    expect(actions).toContain("export async function createWorkspace")
    expect(actions).toContain('role: "ADMIN"')
    expect(actions).toContain("isDefault: true")
    expect(actions).toContain("if (!session?.user?.id)") // fail-closed brez seje
  })

  it("memberRoleIn: null za tujo/neaktivno org (brez probing-a)", () => {
    expect(actions).toContain("export async function memberRoleIn")
    expect(actions).toContain("if (!session?.user?.id) return { role: null")
    expect(actions).toContain("return role")
  })

  it("inviteMember: ADMIN + org usklajenost + staff.manage + ACTIVE gate", () => {
    expect(actions).toContain('userHasPermission(session.user.id, "staff.manage"')
    expect(actions).toContain("Le skrbnik lahko pošlje povabila")
    expect(actions).toContain("Arhiviranemu poslovnemu prostoru")
  })

  it("acceptInvitation: ne pojavi org id-a iz vnosa, token edini vir", () => {
    expect(actions).toContain("export async function acceptInvitation")
    expect(actions).toContain("where: { token")
    expect(actions).toContain('status !== "PENDING"')
  })

  it("updateMemberRole / removeMember varujeta zadnjega ADMIN", () => {
    expect(actions).toContain("adminCount <= 1")
  })

  it("archive/activate/delete so lastnik-varovani (ADMIN + status gate)", () => {
    expect(actions).toContain("membershipWithStatus(organizationId)")
    expect(actions).toContain('orgStatus !== "ACTIVE"')
  })

  it("deleteWorkspace: izrecna potrditev + poslovni podatki blokirajo izbris", () => {
    expect(actions).toContain("prisma.appointment.count")
    expect(actions).toContain("prisma.order.count")
    expect(actions).toContain('input.confirm')
    expect(actions).toContain("Izbris mora biti izrecno potrjen")
  })

  it("F2.2.1: tokeni se hashira (SHA-256), seznam povabil tokena ne vrne", () => {
    // F2.2.1 popravek: hash pomožnica je čisto jedro v lib — "use server"
    // modul sme izvažati samo async akcije (sync export je povzročil
    // "Server Actions must be async functions" in 500 na /workspaces/manage).
    const hashLib = read("src/lib/invitations/hash.ts")
    expect(hashLib).toContain('createHash("sha256")')
    expect(hashLib).toContain("digest(\"hex\")")
    expect(actions).toContain("hashInvitationToken(token)")
    // listInvitations select without token
    expect(actions).toContain("select: { email: true, role: true, status: true, createdAt: true }")
  })

  it("F2.2.1: atomski enkratni sprejem (updateMany s PENDING filterjem)", () => {
    expect(actions).toContain('updateMany({')
    expect(actions).toContain('where: { id: invitation.id, status: "PENDING" }')
  })
})

describe("F2.2 UI — vhodi", () => {
  it("obrazi obstajajo in kličejo varni actions", () => {
    const manager = read("src/components/admin/workspace-manager.tsx")
    expect(manager).toContain('from "@/app/actions/workspace-management"')
    expect(manager).toContain("createWorkspace")
    expect(manager).toContain("setDefaultWorkspace")
    expect(manager).toContain("inviteMember")
    expect(manager).not.toContain(".findMany({ where: { organizationId") // noben direct DB v klientu
  })

  it("header ima vstop v 'Moja podjetja' (role-agnostic)", () => {
    const header = read("src/components/admin/header.tsx")
    expect(header).toContain('href="/workspaces/manage"')
  })

  it("F2.2.1: UI pokaže povabilni URL z gumbom Kopiraj (token enkrat)", () => {
    const manager = read("src/components/admin/workspace-manager.tsx")
    expect(manager).toContain("createdLink")
    expect(manager).toContain("invite/${res.token}")
    expect(manager).toContain("navigator.clipboard.writeText")
    expect(manager).toContain("Kopiraj")
  })

  it("F2.2.1: izbris zahteva vnos imena prostora + potrditveni flag", () => {
    const manager = read("src/components/admin/workspace-manager.tsx")
    expect(manager).toContain('confirm: true')
    expect(manager).toContain("delConfirm")
    expect(manager).toContain("Trajno izbriši")
  })

  it("invite sprejemna stran + akcija", () => {
    const page = read("src/app/(auth)/invite/[token]/page.tsx")
    expect(page).toContain("InvitationAccept")
    const accept = read("src/components/auth/invitation-accept.tsx")
    expect(accept).toContain("acceptInvitation")
    expect(accept).toContain("revokeInvitation")
  })
})
