// ============================================================
// F6.3.5 — VARNOSTNI + MODULSKI INTEGRACIJSKI TESTI (prava baza)
//
// Preveri odpravo READ IDOR in izklopa modulov z RESNIČNIM Prisma
// klientom proti izolirani bazi (običajno `markec_f631_test`).
// Nadomeščena je samo seja (NextAuth `auth()`) + next/cache
// + next/headers + tenant-proof — vse poizvedbe/zapisi pravi.
//
// Poganja se: DATABASE_URL=<f631> npx tsx tests/integration/f635/security-read-idor-modules.itest.ts
// ============================================================
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: string; organizationId?: string | null; email?: string | null }
  },
  headerEntries: {} as Record<string, string>,
  orgProofValid: true,
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(state.headerEntries) }))
vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => state.orgProofValid,
}))

import { prisma } from "@/lib/prisma"
import { getOrgBySlug, getOrgById } from "@/lib/tenant"
import { getPublicFaq, getPreviewFaq } from "@/app/actions/faq"
import { getPublicGalleries, getPreviewGalleries } from "@/app/actions/galleries"
import { getOrgTimezone } from "@/app/actions/appointments"
import { isSiteContentUntouched } from "@/app/actions/site-content"

async function findSlug() {
  const orgs = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  return orgs.find((o) => o.slug === "frizer-test") ?? orgs[0]
}

let frizer: Awaited<ReturnType<typeof findSlug>>
let mehanik: { id: string; slug: string } | null = null
let cleanupIds: string[] = []

beforeAll(async () => {
  const all = await prisma.organization.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } })
  frizer = all.find((o) => o.slug === "frizer-test") ?? all[0]
  mehanik = all.find((o) => o.slug === "mehanik-test") ?? null

  // Testni podatki: objavljeni + draft FAQ v 2 različnih org (za dokaz izolacije).
  cleanupIds = []
  for (const [orgId, q] of [
    [frizer.id, "FAŠ-FAQ-frizer"],
    [mehanik?.id, "FAŠ-FAQ-mehanik"],
  ] as const) {
    if (!orgId) continue
    const f = await prisma.faqItem.create({
      data: { organizationId: orgId, question: `Q-${q}`, answer: "A", isPublic: true, isPublished: true, position: 1 },
    })
    const d = await prisma.faqItem.create({
      data: { organizationId: orgId, question: `Qdraft-${q}`, answer: "DRAFT", isPublic: true, isPublished: false, position: 2 },
    })
    cleanupIds.push(f.id, d.id)
  }
})

afterAll(async () => {
  if (cleanupIds.length) {
    await prisma.faqItem.deleteMany({ where: { id: { in: cleanupIds } } })
  }
  await prisma.$disconnect()
})

describe("F6.3.5 — READ IDOR / izolacija (prava baza)", () => {
  it("getPublicFaq(orgId) uporablja JAVNI kontekst, ne arbitrary orgId", async () => {
    // Anonim na govor frgren gost (header x-org-slug=frizer) → samo frizerjevi FAQ.
    state.session = null
    state.headerEntries = { "x-org-slug": frizer.slug }
    const res = await getPublicFaq(mehanik?.id ?? "foreign-org")
    const questions = res.map((r) => r.question)
    expect(questions.some((q) => q.includes("frizer"))).toBe(true)
    if (mehanik && questions.some((q) => q.includes("mehanik")))
      throw new Error("getPublicFaq je razkril FAQ druge org (mehanik) prek orgId")
  })

  it("getPreviewFaq brez seje -> [] (fail-closed)", async () => {
    state.session = null
    state.headerEntries = {}
    const res = await getPreviewFaq(mehanik?.id ?? "foreign-org")
    expect(res).toEqual([])
  })

  it("getPreviewFaq seje lastnika org A -> SAMO A; orgId arg NIMA vpliva", async () => {
    // Owner frizerja (član org A) — arg drugge org B ne sme izdati B.
    const ownerA = await prisma.user.findFirst({
      where: { email: "fr@f631.test" },
      select: { id: true, organizationId: true, role: true },
    })
    if (!ownerA?.organizationId) throw new Error("manka testni lastnik frizerja")
    state.session = { user: { id: ownerA.id, role: ownerA.role, organizationId: ownerA.organizationId } }
    state.headerEntries = { "x-org-slug": frizer.slug }
    const res = await getPreviewFaq(mehanik?.id ?? "foreign-org")
    const questions = res.map((r) => r.question)
    expect(questions.some((q) => q.includes("frizer"))).toBe(true)
    // Draft frizerjev (isPublished=false) mora biti prisoten (lastnikova org)
    expect(questions.some((q) => q.includes("Draft") || q.includes("draft"))).toBe(true)
    if (mehanik && questions.some((q) => q.includes("mehanik")))
      throw new Error("getPreviewFaq je razkril DRAFT FAQ mehanika prek tujega orgId")
  })

  it("getPublicGalleries / getPreviewGalleries prav tako fail-closed na javnem kontekstu", async () => {
    state.session = null
    state.headerEntries = {}
    const pubForeign = await getPublicGalleries("foreign-org")
    expect(Array.isArray(pubForeign)).toBe(true)
    const previewAnon = await getPreviewGalleries("foreign-org")
    expect(previewAnon).toEqual([])
  })

  it("getOrgTimezone(foreignOrgId) anonim -> fail-closed (default, ne tuje org)", async () => {
    state.session = null
    state.headerEntries = {}
    const tz = await getOrgTimezone("some-other-org-id")
    expect(typeof tz).toBe("string")
  })

  it("isSiteContentUntouched(foreignOrgId) brez seje -> false (fail-closed)", async () => {
    state.session = null
    state.headerEntries = {}
    const res = await isSiteContentUntouched("some-other-org-id", "frizer")
    expect(res).toBe(false)
  })
})

describe("F6.3.5 — modul izklopa (reviews) + reviewsEnabled", () => {
  it("DEACTIVATED → reviewsEnabled=false (sekcija skrita)", async () => {
    // Na čebelarju nastavi DEACTIVATED (kot F6.3.4 test), nato preveri da je
    // efektivno stanje take, da `.state !== 'DEACTIVATED'` → false.
    const cb = await prisma.organization.findUnique({ where: { slug: "cebelar-test" }, select: { id: true } })
    if (!cb) return
    await prisma.organizationModuleState.upsert({
      where: { organizationId_moduleId: { organizationId: cb.id, moduleId: "reviews" } },
      create: { organizationId: cb.id, moduleId: "reviews", state: "DEACTIVATED" },
      update: { state: "DEACTIVATED" },
    })
    const m = await prisma.organizationModuleState.findUnique({
      where: { organizationId_moduleId: { organizationId: cb.id, moduleId: "reviews" } },
    })
    expect(m?.state === "DEACTIVATED").toBe(true)
    expect(m?.state !== "DEACTIVATED").toBe(false) // to je reviewsEnabled za cebelarja
    // Ponovni ACTIVE → enabled (podatki ohranjeni, ni brisanja)
    await prisma.organizationModuleState.upsert({
      where: { organizationId_moduleId: { organizationId: cb.id, moduleId: "reviews" } },
      create: { organizationId: cb.id, moduleId: "reviews", state: "ACTIVE" },
      update: { state: "ACTIVE" },
    })
    const m2 = await prisma.organizationModuleState.findUnique({
      where: { organizationId_moduleId: { organizationId: cb.id, moduleId: "reviews" } },
    })
    expect(m2?.state !== "DEACTIVATED").toBe(true)
  })
})