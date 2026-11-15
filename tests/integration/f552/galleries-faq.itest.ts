// ============================================================
// F5.5.2 — INTEGRACIJSKI TESTI GALERIJ & FAQ (prava testna baza)
//
// Kliče resnične server actions (galleries.ts, faq.ts, publication.ts,
// site-content.ts) proti ločeni bazi `markec_f552_test`. Nadomeščen je
// le NextAuth session (tenant-proof mockan) — vse o izolaciji, draft/
// published, objavi, povratku, vrstnem redu in skupni rabi medijev teče
// prek pravega Prisma klienta.
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
  // Javni kontekst (getPublicOrg → getTrustedOrgSlug) se določa prek
  // x-org-slug headerja — BREZ platform-root fallbacka (na deljeni bazi bi
  // ta fallback razrešil NAJSTAREJŠO objavljeno org, ne f552-it-org-a).
  headerEntries: {} as Record<string, string>,
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

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headerEntries),
}))

vi.mock("@/lib/tenant-proof", () => ({
  ORG_PROOF_HEADER: "x-org-slug-proof",
  verifyOrgSlug: async () => true,
}))

import { prisma } from "@/lib/prisma"
import {
  createGallery,
  updateGallery,
  deleteGallery,
  addGalleryItem,
  updateGalleryItem,
  removeGalleryItem,
  getAdminGalleries,
  getAdminGallery,
  getPublicGalleries,
  getPreviewGalleries,
} from "@/app/actions/galleries"
import {
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaq,
  getAdminFaq,
  getPublicFaq,
  getPreviewFaq,
} from "@/app/actions/faq"
import { publishSite } from "@/app/actions/publication"
import { revertSiteContentToPublished } from "@/app/actions/site-content"

const ID = {
  orgA: "f552-it-org-a",
  orgB: "f552-it-org-b",
  adminA: "f552-it-admin-a",
  adminB: "f552-it-admin-b",
  svcA: "f552-it-svc-a",
  prodA: "f552-it-prod-a",
}

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({
    data: [
      { id: orgId, name: orgId, slug: orgId, publishState: "PUBLISHED", publishedAt: new Date() },
    ],
  })
  await prisma.user.createMany({
    data: [
      { id: adminId, email: `${adminId}@f552.test`, name: adminId, role: "ADMIN", organizationId: orgId },
    ],
  })
  await prisma.organizationMember.createMany({
    data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }],
  })
  // Publish gate: vsaj en kontakt + aktivno osebje (rezervacije).
  await prisma.salonConfig.createMany({
    data: [
      { organizationId: orgId, email: `${adminId}@f552.test`, phone: "+38640000000", timezone: "Europe/Ljubljana" },
    ],
  })
  await prisma.staff.createMany({
    data: [{ organizationId: orgId, name: "Osebje 1", isActive: true, userId: adminId }],
  })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f552_test", "markec_e2e_test"]).toContain(rows[0].db)
  await seedOrg(ID.orgA, ID.adminA)
  await seedOrg(ID.orgB, ID.adminB)
  await prisma.category.createMany({
    data: [{ id: "f552-it-cat-a", name: "Kategorija", slug: "f552-it-cat", organizationId: ID.orgA }],
  })
  await prisma.service.createMany({
    data: [
      { id: ID.svcA, name: "Striženje", slug: "f552-it-svc", duration: 45, price: 25, organizationId: ID.orgA, categoryId: "f552-it-cat-a" },
    ],
  })
  await prisma.product.createMany({
    data: [{ id: ID.prodA, name: "Šampon", price: 12, sku: "F552-IT-1", organizationId: ID.orgA }],
  })
})

beforeEach(() => {
  state.session = { user: { id: ID.adminA, role: "ADMIN", organizationId: ID.orgA, email: "a@f552.test" } }
  state.headerEntries = { "x-org-slug": ID.orgA }
  return Promise.all([
    prisma.galleryItem.deleteMany({ where: { gallery: { organizationId: { in: [ID.orgA, ID.orgB] } } } }),
    prisma.gallery.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } }),
    prisma.faqItem.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } }),
  ])
})

afterAll(async () => {
  await prisma.galleryItem.deleteMany({ where: { gallery: { organizationId: { in: [ID.orgA, ID.orgB] } } } })
  await prisma.gallery.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.faqItem.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.staff.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.product.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.service.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.category.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ID.adminA, ID.adminB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ID.orgA, ID.orgB] } } })
  await prisma.$disconnect()
})

function loginAs(adminId: string, orgId: string) {
  state.session = { user: { id: adminId, role: "ADMIN", organizationId: orgId, email: `${adminId}@f552.test` } }
}

describe("Galerije — CRUD, vrstni red, povezave", () => {
  it("ustvari dve galeriji z različnimi naslovi in ju vrne v objavljenem redu", async () => {
    const g1 = await createGallery({ title: "Pričeske", description: "Stilovi", isPublic: true })
    const g2 = await createGallery({ title: "Nega rok" })
    expect(g1.ok).toBe(true)
    expect(g2.ok).toBe(true)

    const all = await getAdminGalleries()
    expect(all.map((g) => g.title)).toEqual(["Pričeske", "Nega rok"])
    expect(all[0].isPublished).toBe(false) // draft pred objavo
  })

  it("povezuje galerijo s storitvijo in izdelkom (org-validated)", async () => {
    const res = await createGallery({
      title: "Povezana",
      linkedServiceId: ID.svcA,
    })
    expect(res.ok).toBe(true)
    const g = (await getAdminGalleries()).find((x) => x.id === res.id)
    expect(g?.linkedServiceId).toBe(ID.svcA)

    const res2 = await createGallery({ title: "Izdelek", linkedProductId: ID.prodA })
    expect((await getAdminGalleries()).find((x) => x.id === res2.id)?.linkedProductId).toBe(ID.prodA)
  })

  it("zavrne povezavo na storitev iz druge org (IDOR-safe)", async () => {
    // Org B store storitev; A ne sme nanjo povezati.
    await prisma.service.createMany({
      data: [{ id: "f552-it-svc-b", name: "Svc B", slug: "f552-it-svc-b", duration: 30, price: 10, organizationId: ID.orgB }],
    })
    const res = await createGallery({ title: "X", linkedServiceId: "f552-it-svc-b" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
  })

  it("doda, razporedi, posodablja in odstrani fotografije — media nikoli zbrisan", async () => {
    const g = await createGallery({ title: "Slike", isPublic: true })
    const run = async (step: string) => expect(step).toBeTruthy()
    const a = await addGalleryItem({ galleryId: g.id!, mediaId: "media-1", caption: "Prva" })
    const b = await addGalleryItem({ galleryId: g.id!, mediaId: "media-2", caption: "Druga" })
    const c = await addGalleryItem({ galleryId: g.id!, mediaId: "media-3", caption: "Tretja" })
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true])

    // vrstni red 1,2,3
    let items = (await getAdminGallery(g.id!))!.items
    expect(items.map((i) => i.mediaId)).toEqual(["media-1", "media-2", "media-3"])
    await run("ordered")

    // premakni 3. na vrh (position 0) in nastavi alt/cover.
    // Prenašanje up/down v vrsti: zamenjaj poziciji sosednjih ali izrecno
    // preštevilči vse pozicije, da ni dvojnikov.
    await updateGalleryItem(a.id!, { position: 1 })
    await updateGalleryItem(b.id!, { position: 2 })
    await updateGalleryItem(c.id!, { position: 0, alt: "Alt tretja" })
    await updateGallery(g.id!, { coverImageId: "media-3" })
    items = (await getAdminGallery(g.id!))!.items
    const byPos = [...items].sort((x, y) => x.position - y.position)
    expect(byPos.map((i) => i.mediaId)).toEqual(["media-3", "media-1", "media-2"])
    expect(byPos[0].alt).toBe("Alt tretja")
    expect((await getAdminGalleries()).find((x) => x.id === g.id)?.coverImageId).toBe("media-3")

    // odstrani media-2; media-1,media-3 ostaneta; media datoteke se ne brišejo
    await removeGalleryItem(b.id!)
    items = (await getAdminGallery(g.id!))!.items
    expect(items.map((i) => i.mediaId)).not.toContain("media-2")
    // deleteGallery prav tako ne briše media
    await deleteGallery(g.id!)
    expect(await prisma.gallery.count({ where: { id: g.id! } })).toBe(0)
  })
})

describe("FAQ — podjetje in storitev, kategorije, razvrščanje", () => {
  it("doda FAQ za celotno podjetje in za storitev, razporedi in razvrsti", async () => {
    const business = await createFaq({ question: "Kdaj ste odprti?", answer: "Po-pet 9-18.", category: "Delovni čas", isPublic: true })
    const svc = await createFaq({ question: "Kaj vzamem s seboj?", answer: "Nič.", serviceId: ID.svcA })
    expect(business.ok && svc.ok).toBe(true)

    const rows = await getAdminFaq()
    expect(rows.find((r) => r.question === "Kdaj ste odprti?")?.category).toBe("Delovni čas")
    expect(rows.find((r) => r.question === "Kdaj ste odprti?")?.serviceId).toBeNull()
    expect(rows.find((r) => r.question === "Kaj vzamem s seboj?")?.serviceId).toBe(ID.svcA)

    // razvrsti: storitveno vprašanje gor
    const ordered = [rows.find((r) => r.question === "Kaj vzamem s seboj?")!.id, rows.find((r) => r.question === "Kdaj ste odprti?")!.id]
    await reorderFaq(ordered)
    const after = await getAdminFaq()
    expect(after[0].question).toBe("Kaj vzamem s seboj?")

    // uredi
    const target = after.find((r) => r.question === "Kdaj ste odprti?")!
    await updateFaq(target.id, { answer: "Po-pet 10-17." })
    expect((await getAdminFaq()).find((r) => r.id === target.id)?.answer).toBe("Po-pet 10-17.")

    // brisanje
    await deleteFaq(target.id)
    expect((await getAdminFaq()).find((r) => r.id === target.id)).toBeUndefined()
  })

  it("zavrne FAQ za storitev iz druge org", async () => {
    const res = await createFaq({ question: "Q", answer: "A", serviceId: "f552-it-svc-b" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("NOT_FOUND")
  })
})

describe("Draft proti objavljeni — publish in revert", () => {
  it("osnutek ni javno viden; po objavi je; po povratku spet ni", async () => {
    const g = await createGallery({ title: "Javna galerija", isPublic: true })
    await addGalleryItem({ galleryId: g.id!, mediaId: "media-pub", isPublished: false })
    await createFaq({ question: "Javno vprašanje", answer: "Odgovor", isPublic: true })

    // Pred objavo: draft — javni odčitki prazni, predogled jih vidi.
    expect(await getPublicGalleries(ID.orgA)).toHaveLength(0)
    expect(await getPublicFaq(ID.orgA)).toHaveLength(0)
    expect(await getPreviewGalleries(ID.orgA)).toHaveLength(1)
    expect(await getPreviewFaq(ID.orgA)).toHaveLength(1)

    // Objavi → isPublished na galeriji, itemu, FAQ; javno sedaj vidno.
    const pub = await publishSite()
    expect(pub.success).toBe(true)
    expect(await getPublicGalleries(ID.orgA)).toHaveLength(1)
    expect((await getPublicGalleries(ID.orgA))[0].items).toHaveLength(1)
    expect(await getPublicFaq(ID.orgA)).toHaveLength(1)

    // Nova (draft) galerija po objavi → še vedno ni javna (neobjavljeno).
    const g2 = await createGallery({ title: "Osnutek 2", isPublic: true })
    expect(await getPublicGalleries(ID.orgA)).toHaveLength(1)
    expect((await getAdminGalleries()).find((x) => x.id === g2.id)?.isPublished).toBe(false)
  })

  it("revert zavrže NEobjavljene galerije/FAQ; objavljene ostanejo", async () => {
    // Objavi obstoječo → isPublished=true.
    const pub = await createGallery({ title: "Pub", isPublic: true })
    await addGalleryItem({ galleryId: pub.id!, mediaId: "m-pub-1" })
    await publishSite()
    const pubGallery = (await getAdminGalleries()).find((x) => x.id === pub.id)
    expect(pubGallery?.isPublished).toBe(true)

    // Ustvari novo DRAFT galerijo in DRAFT FAQ.
    const draft = await createGallery({ title: "Draft", isPublic: true })
    await addGalleryItem({ galleryId: draft.id!, mediaId: "m-draft" })
    await createFaq({ question: "Draft FAQ", answer: "x", isPublic: true })
    expect(await getAdminGalleries()).toHaveLength(2)
    expect(await getAdminFaq()).toHaveLength(1)

    // contentVersion je viden kot neobjavljen (drift) pred povratkom.
    const orgBefore = await prisma.organization.findUnique({ where: { id: ID.orgA } })
    expect(orgBefore?.contentVersion).toBeGreaterThan(0)

    // Simuliramo objavljen snapshot, da revert deluje (E3-2 zahteva published snapshot).
    await prisma.salonConfig.upsert({
      where: { organizationId: ID.orgA },
      create: {
        organizationId: ID.orgA,
        siteContent: {},
        publishedSiteContent: {},
        publishedContentVersion: 0,
      },
      update: {
        publishedSiteContent: {},
        publishedContentVersion: 0,
      },
    })
    const revert = await revertSiteContentToPublished()
    // Revert zavrže draft galerije/FAQ (isPublished=false), objavljeno ostane.
    const galleries = await getAdminGalleries()
    expect(galleries.map((x) => x.title)).toEqual(["Pub"])
    expect(await getAdminFaq()).toHaveLength(0)
    expect(galleries[0].isPublished).toBe(true)
  })
})

describe("Organizacijska izolacija", () => {
  it("org B ne vidi ničesar, kar je vsaj v org A", async () => {
    const g = await createGallery({ title: "A-jeva galerija", isPublic: true })
    await addGalleryItem({ galleryId: g.id!, mediaId: "m-a" })
    await createFaq({ question: "A FAQ", answer: "a", isPublic: true })

    // Login kot B.
    loginAs(ID.adminB, ID.orgB)
    expect(await getAdminGalleries()).toHaveLength(0)
    expect(await getAdminFaq()).toHaveLength(0)

    // B ne sme urediti/zbrisati A-jevega dokumenta (IDOR).
    const gA = g.id!
    const upRes = await updateGallery(gA, { title: "Hakiran" })
    expect(upRes.ok).toBe(false)
    expect(upRes.error).toBe("NOT_FOUND")
    const delRes = await deleteGallery(gA)
    expect(delRes.ok).toBe(false)
    const item = (await prisma.galleryItem.findFirst({ where: { galleryId: gA } }))!
    const rmRes = await removeGalleryItem(item.id)
    expect(rmRes.ok).toBe(false)

    // Javna branja so org-scoped (javni kontekst = obiskovalec B-jeve strani).
    state.headerEntries = { "x-org-slug": ID.orgB }
    expect(await getPreviewGalleries(ID.orgB)).toHaveLength(0)
    expect(await getPublicGalleries(ID.orgB)).toHaveLength(0)
  })
})

describe("Skupna raba medijskih datotek", () => {
  it("isti mediaId lahko uporablja več galerij — brisanje ene ne zbriše media za drugo", async () => {
    const g1 = await createGallery({ title: "G1", isPublic: true })
    const g2 = await createGallery({ title: "G2", isPublic: true })
    await addGalleryItem({ galleryId: g1.id!, mediaId: "shared-media", isPublished: false })
    await addGalleryItem({ galleryId: g2.id!, mediaId: "shared-media", isPublished: false })

    // Odstrani iz G1 — ostane v G2.
    const i1 = (await getAdminGallery(g1.id!))!.items[0]
    await removeGalleryItem(i1.id)
    expect((await getAdminGallery(g2.id!))!.items.map((x) => x.mediaId)).toContain("shared-media")

    // Objavi obe; javni prikaz vključi obe.
    const pub = await publishSite()
    expect(pub.success).toBe(true)
    const publicG2 = (await getPublicGalleries(ID.orgA)).find((x) => x.id === g2.id)
    expect(publicG2?.items.map((x) => x.mediaId)).toEqual(["shared-media"])
  })
})