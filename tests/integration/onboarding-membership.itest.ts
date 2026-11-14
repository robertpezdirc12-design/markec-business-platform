// ============================================================
// 2D-1L — REGRESIJSKI TEST: ČLANSTVO (OrganizationMember) OB NOVI
// ANONIMNI REGISTRACIJI (onboarding.ts).
//
// Izolirana DB (markec_e2e_test). Mock-only: NextAuth session ni knjižna —
// auth() vrne null (anonimna registracija). Vse ostalo (User, Organization,
// OrganizationMember, katalog) gre skozi pravi Prisma klient + dejansko
// `createSalonOrganization` server action.
//
// Uporaba (guard):
//   node scripts/run-with-test-db.mjs vitest run --config vitest.itest.config.ts tests/integration/onboarding-membership.itest.ts
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user?: unknown },
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))
// 2D-4: createSalonOrganization now queues the verification email via after().
vi.mock("next/server", () => ({ after: () => Promise.resolve(undefined) }))

import { prisma } from "@/lib/prisma"
import { createSalonOrganization } from "@/app/actions/onboarding"

// Enolični identifikator za ponovljivo delovanje (vsak tek čisti po sebi).
const RUN = Date.now().toString(36)
const EMAIL = `2d1l.${RUN}@markec.test`
const SLUG = `2d1l-${RUN}`
const NAME = `2D1L Test ${RUN}`

async function makeOrg(req: { email?: string; slug?: string } = {}) {
  return createSalonOrganization({
    name: NAME,
    slug: req.slug ?? SLUG,
    vertical: "beekeeping",
    ownerName: "Test Lastnik",
    email: req.email ?? EMAIL,
    password: "TestPass_2d1l_2026",
    palette: "amber",
  } as never)
}

beforeAll(async () => {
  state.session = null // anonimna registracija
})

afterAll(async () => {
  // Cleanup: zbriši org (cascade odstrani tudi pripadajoče članstvo in user-ja).
  await prisma.organization.deleteMany({ where: { slug: SLUG } }).catch(() => undefined)
  await prisma.$disconnect()
})

describe("2D-1L: organizacija + članstvo ob novi anonimni registraciji", () => {
  it("1. nova registracija ustvari User + Organization + OrganizationMember(ADMIN)", async () => {
    const res = await makeOrg()
    expect(res.success).toBe(true)

    const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
    const user = await prisma.user.findUnique({ where: { email: EMAIL } })
    expect(org).not.toBeNull()
    expect(user).not.toBeNull()
    expect(user!.role).toBe("ADMIN")

    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: org!.id, userId: user!.id },
    })
    expect(member).not.toBeNull()
    expect(member!.role).toBe("ADMIN")
    expect(member!.organizationId).toBe(org!.id)
    expect(member!.userId).toBe(user!.id)
  })

  it("2. prvo članstvo ima isDefault=true", async () => {
    const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
    const user = await prisma.user.findUnique({ where: { email: EMAIL } })
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: org!.id, userId: user!.id },
    })
    expect(member!.isDefault).toBe(true)
  })

  it("3. ponovljeno izvajanje ne ustvari podvojenega članstva (idempotentno)", async () => {
    const countBefore = await prisma.organizationMember.count({
      where: { organization: { slug: SLUG } },
    })
    // Vnovičen klic z istim emailom vrne napake (že registriran), a brez Nove članstva.
    const res2 = await makeOrg()
    expect(res2.success).toBe(false)
    const countAfter = await prisma.organizationMember.count({
      where: { organization: { slug: SLUG } },
    })
    expect(countAfter).toBe(countBefore)
    expect(countBefore).toBe(1)
  })
})

describe("2D-1L: kompatibilnost backfill", () => {
  it("6. obstoječi backfill ostane združljiv (skips obstoječ par)", async () => {
    const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
    const user = await prisma.user.findUnique({ where: { email: EMAIL } })
    const before = await prisma.organizationMember.count({
      where: { organizationId: org!.id, userId: user!.id },
    })
    // Simuliramo backfill: createMany skipDuplicates ne sme podvojiti.
    const created = await prisma.organizationMember.createMany({
      data: { organizationId: org!.id, userId: user!.id, role: "ADMIN", isDefault: true },
      skipDuplicates: true,
    })
    expect(created.count).toBe(0)
    const after = await prisma.organizationMember.count({
      where: { organizationId: org!.id, userId: user!.id },
    })
    expect(after).toBe(before)
    expect(before).toBe(1)
  })
})

describe("2D-1L: fail-closed na neobstoj članstva", () => {
  it("7. bris organizacije odstrani članstvo (cascade) — ni navideznega uspešnega stanja", async () => {
    const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
    const user = await prisma.user.findUnique({ where: { email: EMAIL } })
    expect(
      await prisma.organizationMember.count({ where: { organizationId: org!.id, userId: user!.id } })
    ).toBe(1)
    // Org smo sprva le pripravili; v afterAll bo zbrisan (cascade). Tu potrdimo,
    // da bris org odstrani članstvo.
    const del = await prisma.organization.deleteMany({ where: { slug: SLUG } })
    expect(del.count).toBe(1)
    expect(
      await prisma.organizationMember.count({ where: { organizationId: org!.id } })
    ).toBe(0)
    // Od tu je org umaknjena; user (račun) sme ostati (org ni edino lastn.»).
    // Pomembno: članstvo je odstranjeno — ni navideznega uspešnega stanja.
    const userAfter = await prisma.user.findUnique({ where: { email: EMAIL } })
    expect(userAfter).not.toBeNull() // račun lastnika ostane (veljavno)
    expect(
      await prisma.organizationMember.count({ where: { userId: userAfter!.id } })
    ).toBe(0)
  })
})