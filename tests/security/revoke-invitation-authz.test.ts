// P1 (audit 2026-11) — `revokeInvitation` ni preverjal, KDO preklicuje.
//
// Akcija je sprejela poljuben žeton in povabilo preklicala brez seje; ker je
// "use server", je bila to javna končna točka. Zdaj velja: prijavljen moraš
// biti, preklicati sme le prejemnik povabila ali ADMIN organizacije, ki je
// povabilo izdala. Testi zaklepajo obe veji in fail-closed vedenje.
import { beforeEach, describe, expect, it, vi } from "vitest"

const state: {
  session: { user: { id: string; email?: string } } | null
  invitation: {
    id: string
    status: string
    email: string
    organizationId: string
  } | null
  memberRole: string | null
  updated: Array<Record<string, unknown>>
  revalidated: string[]
} = {
  session: null,
  invitation: null,
  memberRole: null,
  updated: [],
  revalidated: [],
}

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => {
    state.revalidated.push(p)
  },
  revalidateTag: () => undefined,
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

vi.mock("@/lib/prisma", () => {
  const prisma = {
    organizationInvitation: {
      findUnique: async () => state.invitation,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        state.updated.push({ ...args.where, ...args.data })
        return {}
      },
    },
    organizationMember: {
      findUnique: async () => (state.memberRole ? { role: state.memberRole, organization: { status: "ACTIVE" } } : null),
    },
  }
  return { prisma }
})

const { revokeInvitation } = await import("@/app/actions/workspace-management")

const TOKEN = "povabilo-abc"
const INVITATION = {
  id: "inv_1",
  status: "PENDING",
  email: "novi@example.com",
  organizationId: "org_1",
}

beforeEach(() => {
  state.session = null
  state.invitation = { ...INVITATION }
  state.memberRole = null
  state.updated = []
  state.revalidated = []
})

describe("revokeInvitation — avtorizacija", () => {
  it("brez seje ne prekliče ničesar (javna končna točka → fail closed)", async () => {
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(false)
    expect(r.error).toContain("Prijavite se")
    expect(state.updated).toEqual([])
  })

  it("nepovabljen uporabnik brez ADMIN vloge ne prekliče", async () => {
    state.session = { user: { id: "u_tuj", email: "tuj@example.com" } }
    state.memberRole = "MEMBER"
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(false)
    expect(r.error).toContain("le prejemnik ali skrbnik")
    expect(state.updated).toEqual([])
  })

  it("uporabnik brez članstva v organizaciji ne prekliče", async () => {
    state.session = { user: { id: "u_tuj", email: "tuj@example.com" } }
    state.memberRole = null
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(false)
    expect(state.updated).toEqual([])
  })

  it("prejemnik povabila (ujemanje e-pošte ne glede na velikost črk) prekliče", async () => {
    state.session = { user: { id: "u_invitee", email: "NOVI@Example.com" } }
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(true)
    expect(state.updated).toHaveLength(1)
    expect(state.updated[0]).toMatchObject({ id: "inv_1", status: "REVOKED" })
    expect(state.revalidated).toContain("/workspaces")
  })

  it("ADMIN iste organizacije prekliče tudi tuje povabilo", async () => {
    state.session = { user: { id: "u_admin", email: "admin@example.com" } }
    state.memberRole = "ADMIN"
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(true)
    expect(state.updated[0]).toMatchObject({ id: "inv_1", status: "REVOKED" })
  })

  it("že preklicano/nesklepano povabilo vrne sporočilo brez zapisa", async () => {
    state.session = { user: { id: "u_admin", email: "admin@example.com" } }
    state.memberRole = "ADMIN"
    state.invitation = { ...INVITATION, status: "ACCEPTED" }
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(false)
    expect(r.error).toContain("ni več v pripravi")
    expect(state.updated).toEqual([])
  })

  it("neobstoječe povabilo ne razkrije ničesar in ne zapiše", async () => {
    state.session = { user: { id: "u_admin", email: "admin@example.com" } }
    state.memberRole = "ADMIN"
    state.invitation = null
    const r = await revokeInvitation(TOKEN)
    expect(r.success).toBe(false)
    expect(state.updated).toEqual([])
  })
})
