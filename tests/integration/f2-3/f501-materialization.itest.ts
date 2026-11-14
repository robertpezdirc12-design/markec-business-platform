// ============================================================
// F5.0.1 — integracijska verifikacija workspace materializacije za
// izjeme in reprezentativne SKD podrazrede (markec_f23_test).
//
// Dokaže (na podatkovni ravni, brez brskalnika — brskalniška plast je
// v tem okolju za zaporo dostopnega žetona): za izbrani konkretni
// podrazred se razreši pravilen profil in ta profil materializira
// uporaben, ne-prazen poslovni workspace (katalog + materializacija).
// ============================================================

import { beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; email?: string | null } },
}))
vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined, delete: () => undefined }),
}))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { resolveSkdProfile, SKD_PROFILE_EXCEPTIONS } from "@/lib/skd/profiles"
import { SKD_BY_LEVEL } from "@/lib/skd/data/skd2025"
import { seedOrganizationCatalog } from "@/lib/verticals"
import { materializeProfileAssets } from "@/lib/profiles/materialize"

const PREFIX = "f501-"

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  // F6.4: sprejme uradno izolirano materializacijsko bazo (markec_f501_test,
  // migrirana z official migracijami) ali legacy f23 (če je migrirana).
  expect(["markec_f23_test", "markec_f501_test"]).toContain(rows[0].db)
  await prisma.organization.deleteMany({ where: { id: { startsWith: PREFIX } } })
})

describe("F5.0.1 — workspace materializacija za perfilarne izjeme", () => {
  // Pridobi subclasses znotraj vsake izjeme za reprezentativno preverbo.
  const hitExceptionSubclasses = (code: string) =>
    SKD_BY_LEVEL[5].filter((r) => r.c.startsWith(code))

  for (const ex of SKD_PROFILE_EXCEPTIONS) {
    it(`izjema ${ex.code} -> ${ex.usedProfile}: workspace je uporaben in ne-prazen`, async () => {
      const profile = resolveSkdProfile(ex.code)
      expect(profile.id).toBe(ex.usedProfile)

      const subclasses = hitExceptionSubclasses(ex.code)
      expect(subclasses.length).toBeGreaterThan(0)

      // Nov workspace za to dejavnost.
      const orgId = `${PREFIX}${ex.code.replace(/[^A-Z0-9]/gi, "").toLowerCase()}`
      await prisma.organization.deleteMany({ where: { id: orgId } })
      await prisma.organization.create({
        data: { id: orgId, name: `F5.0.1 ${ex.code}`, slug: orgId, vertical: profile.id, publishState: "DRAFT" },
      })

      // Katalog + materializacija (kot to naredi createSalonOrganization).
      const catReport = await seedOrganizationCatalog(orgId, profile.id)
      await materializeProfileAssets(orgId, profile.id)

      // Meritve "uporabnega, ne-praznega" workspacea.
      const [cats, services, products] = await Promise.all([
        prisma.category.count({ where: { organizationId: orgId } }),
        prisma.service.count({ where: { organizationId: orgId } }),
        prisma.product.count({ where: { organizationId: orgId } }),
      ])
      const forms = await prisma.formDefinition.count({ where: { organizationId: orgId } })
        .catch(() => 0)

      console.log(
        `[F5.0.1] ${ex.code} -> ${profile.id}: cats=${cats} services=${services} products=${products} forms=${forms}`
      )

      // Ne-prazen: vsaj kategorija ali storitev (dodan katalog) in/ali materializirani obrazci.
      const hasCatalog = cats > 0 || services > 0 || products > 0
      const hasAssets = forms > 0

      // Generični / sekcijski profil mora vedno dati delujoč začetek:
      // bodisi vzorčni katalog bodisi materializirane definicije profile.
      expect(hasCatalog || hasAssets, `${ex.code} workspace empty`).toBe(true)
      // Pričakovano: generic vsebuje vzorčni katalog (2 storitvi).
      expect(catReport.added.categories + catReport.added.services + catReport.added.products)
        .toBeGreaterThan(0)

      await prisma.organization.deleteMany({ where: { id: orgId } })
    })
  }

  it("reprezentativni podrazredi (ne-izjeme) dobijo svoj namenski profil", () => {
    const cases: [string, string][] = [
      ["T96.210", "frizer"],
      ["T95.310", "mehanik"],
      ["A01.110", "skd-a-agriculture"],
      ["G47.740", "skd-g-retail"],
    ]
    for (const [code, expected] of cases) {
      expect(resolveSkdProfile(code).id, code).toBe(expected)
    }
  })
})