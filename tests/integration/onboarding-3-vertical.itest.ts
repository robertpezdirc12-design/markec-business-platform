// ============================================================
// 2D-3 — SAMOPOSTREŽNI ONBOARDING: trije ločeni uporabniki → trije
// pravilnouni sistemi za čebelarja, vulkanizerja in šiviljo.
//
// Za vsako dejavnost kliče REALNI `createSalonOrganization` (produkcijski
// server action, ki ga uporablja /start čarovnik). Anonymous branch
// (auth() = null) ustvari nov User + Org + çlanstvo + katalog + profile
// elementi + SalonConfig. Nato preverimo PRAVILNO vertikalo, katalog, forme,
// workflow in module (ne samo oznako vertikale).
//
// Izolirana DB (markec_e2e_test); guard:
//   node scripts/run-with-test-db.mjs vitest run --config vitest.itest.config.ts \
//     tests/integration/onboarding-3-vertical.itest.ts
// ============================================================

import { afterAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ session: null as null | { user?: unknown } }))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => undefined,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => null }) }))
// 2D-4: createSalonOrganization now calls after() to queue the verification email.
vi.mock("next/server", () => ({ after: () => Promise.resolve(undefined) }))


import { prisma } from "@/lib/prisma"
import { createSalonOrganization } from "@/app/actions/onboarding"

const RUN = Date.now().toString(36).slice(-6)
const SLUGS = { bee: `2d3-bee-${RUN}`, vul: `2d3-vul-${RUN}`, seam: `2d3-seam-${RUN}` }
const EMAILS = { bee: `2d3.bee.${RUN}@markec.test`, vul: `2d3.vul.${RUN}@markec.test`, seam: `2d3.seam.${RUN}@markec.test` }

async function makeOrg(vertical: "beekeeping" | "tire-service" | "seamstress") {
  const key = vertical === "beekeeping" ? "bee" : vertical === "tire-service" ? "vul" : "seam"
  return createSalonOrganization({
    name: `2D3 ${key} ${RUN}`,
    slug: SLUGS[key],
    vertical,
    ownerName: `Owner ${key}`,
    email: EMAILS[key],
    password: "Vstop2d3_2026!",
    palette: vertical === "beekeeping" ? "amber" : vertical === "tire-service" ? "charcoal" : "teal",
    teamSize: "solo",
  } as never)
}

// Za čebelarja: izdelki (med), a brez storitev.
async function assertBeekeeping(orgId: string) {
  const services = await prisma.service.count({ where: { organizationId: orgId } })
  const products = await prisma.product.count({ where: { organizationId: orgId } })
  const cats = await prisma.category.findMany({ where: { organizationId: orgId }, select: { name: true } })
  const wf = await prisma.workflowDefinition.count({ where: { organizationId: orgId } })
  const forms = await prisma.formDefinition.count({ where: { organizationId: orgId } })
  expect(services).toBe(0) // čebelar nima storitev (izdelki so osnova)
  expect(products).toBeGreaterThan(0) // medeni izdelki
  expect(cats.some((c) => c.name === "Izdelki")).toBe(true)
  expect(wf).toBe(0) // čebelar nima workflow-a
  expect(forms).toBe(1) // (vsaj en dinamični obrazec)
}

// Za vulkanizerja: storitve + staff + rezervacijski workflow (work-order).
async function assertVulcanizer(orgId: string) {
  const services = await prisma.service.count({ where: { organizationId: orgId } })
  const staff = await prisma.staff.count({ where: { organizationId: orgId } })
  const hours = await prisma.workingHours.count({ where: { staff: { organizationId: orgId } } })
  const wf = await prisma.workflowDefinition.findMany({ where: { organizationId: orgId }, include: { stages: true } })
  const forms = await prisma.formDefinition.count({ where: { organizationId: orgId } })
  const cats = await prisma.category.findMany({ where: { organizationId: orgId }, select: { name: true } })
  expect(services).toBeGreaterThan(0)
  expect(cats.map((c) => c.name).sort()).toEqual(["Servis vozil", "Vulkanizerija"].sort())
  expect(staff).toBe(1)
  expect(hours).toBeGreaterThanOrEqual(5) // delovni čas (Pon–Pet, Sob)
  expect(wf.length).toBe(1)
  expect(wf[0].stages.length).toBeGreaterThanOrEqual(5)
  expect(forms).toBeGreaterThanOrEqual(1)
  // Vulkanizer ima appointments (termini menjave), SKBDA lahko rezervira.
  const orgRow = await prisma.organization.findUnique({ where: { id: orgId }, select: { vertical: true } })
  expect(orgRow!.vertical).toBe("tire-service")
}

// Za šiviljo: storitve (šivanje po meri), proizvodni workflow production-order in forme.
async function assertSeamstress(orgId: string) {
  const services = await prisma.service.count({ where: { organizationId: orgId } })
  const cats = await prisma.category.findMany({ where: { organizationId: orgId }, select: { name: true } })
  const wf = await prisma.workflowDefinition.findMany({ where: { organizationId: orgId }, include: { stages: true } })
  const forms = await prisma.formDefinition.count({ where: { organizationId: orgId } })
  expect(services).toBeGreaterThan(0)
  expect(cats.map((c) => c.name).sort()).toEqual(
    ["Spremembe oblačil", "Popravila", "Šivanje po meri"].sort()
  )
  expect(wf.length).toBe(1)
  expect(wf[0].key).toBe("production-order")
  expect(wf[0].stages.length).toBeGreaterThanOrEqual(8) // 9-stopenjski proizvodni proces
  expect(forms).toBeGreaterThanOrEqual(2) // order-details + merilni list
  const orgRow = await prisma.organization.findUnique({ where: { id: orgId }, select: { vertical: true } })
  expect(orgRow!.vertical).toBe("seamstress")
}

describe("2D-3 — samopostrežni onboarding za tri reference", () => {
  it("čebelar: nova org + račun + katalog medenih izdelkov (brez storitev/rezervacij)", async () => {
    const res = await makeOrg("beekeeping")
    // eslint-disable-next-line no-console
    console.log("bee res:", JSON.stringify(res))
    expect(res.success).toBe(true)
    const org = await prisma.organization.findUnique({ where: { slug: SLUGS.bee } })
    const user = await prisma.user.findUnique({ where: { email: EMAILS.bee } })
    expect(org!.vertical).toBe("beekeeping")
    const member = await prisma.organizationMember.findFirst({ where: { organizationId: org!.id, userId: user!.id } })
    expect(member!.role).toBe("ADMIN")
    expect(member!.isDefault).toBe(true)
    // 2D-4: nova samopostrežna registracija NIMA več samodejne verifikacije.
    expect(user!.emailVerified).toBeNull()
    // Brez e-poštnega servisa server vrne verificationUrl (iskreno, ne dostava).
    expect((res as { verificationUrl?: string }).verificationUrl).toContain("/verify-email?token=")
    await assertBeekeeping(org!.id)
  })

  it("vulkanizer: nova org + račun + storitve + staff + workflow (appointments)", async () => {
    const res = await makeOrg("tire-service")
    expect(res.success).toBe(true)
    const org = await prisma.organization.findUnique({ where: { slug: SLUGS.vul } })
    const user = await prisma.user.findUnique({ where: { email: EMAILS.vul } })
    expect(org!.vertical).toBe("tire-service")
    const member = await prisma.organizationMember.findFirst({ where: { organizationId: org!.id, userId: user!.id } })
    expect(member!.role).toBe("ADMIN")
    // 2D-4: račun ni samodejno verificiran.
    expect(user!.emailVerified).toBeNull()
    expect((res as { verificationUrl?: string }).verificationUrl).toContain("/verify-email?token=")
    await assertVulcanizer(org!.id)
  })

  it("šivilja: nova org + račun + storitve + production-order workflow + forme", async () => {
    const res = await makeOrg("seamstress")
    expect(res.success).toBe(true)
    const org = await prisma.organization.findUnique({ where: { slug: SLUGS.seam } })
    const user = await prisma.user.findUnique({ where: { email: EMAILS.seam } })
    expect(org!.vertical).toBe("seamstress")
    const member = await prisma.organizationMember.findFirst({ where: { organizationId: org!.id, userId: user!.id } })
    expect(member!.role).toBe("ADMIN")
    expect(member!.isDefault).toBe(true)
    // 2D-4: račun ni samodejno verificiran.
    expect(user!.emailVerified).toBeNull()
    expect((res as { verificationUrl?: string }).verificationUrl).toContain("/verify-email?token=")
    await assertSeamstress(org!.id)
  })

  it("izolacija: trije ločeni uporabniki, vsak v natanko 1 org; noben drugi ne vidi tujih članstev", async () => {
    for (const key of ["bee", "vul", "seam"] as const) {
      const u = await prisma.user.findUnique({ where: { email: EMAILS[key] } })
      const memberships = await prisma.organizationMember.count({ where: { userId: u!.id } })
      expect(memberships).toBe(1)
    }
    // Čižetri → vsak uporabnik ima eno in edino članstvo.
    const beeMemberships = await prisma.organizationMember.count({
      where: { user: { email: EMAILS.bee } },
    })
    expect(beeMemberships).toBe(1)
  })
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { slug: { in: [SLUGS.bee, SLUGS.vul, SLUGS.seam] } } }).catch(() => undefined)
  await prisma.$disconnect()
})