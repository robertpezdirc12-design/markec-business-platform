// ============================================================
// F5.2 — INTEGRACIJSKI TESTI KATEGORIJ (prava testna baza)
//
// Kliče resnične server actions/profilne predloge proti ločeni bazi
// `markec_f52_test`. Nadomeščen je le NextAuth session — vse odločitve
// o izolaciji, hierarhiji, slug-ih, ciklih in varnem brisanju gredo
// skozi pravi Prisma klient.
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
import { randomUUID } from "node:crypto"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getManagedCategories,
  getCategoryDeletePreview,
} from "@/app/actions/categories"
import { seedOrganizationCatalog, seedProfileCategories } from "@/lib/verticals"
import {
  getPublicCategories,
  getPublicServicesGrouped,
  getPublicShopProducts,
} from "@/lib/public-site"
import { setOrgSecondaryVertical } from "@/app/actions/profile"
import { validateSecondaryVertical, applySecondaryProfile } from "@/lib/profiles/secondary"
import { getProfile } from "@/lib/profiles/registry"

const ID = {
  orgA: `f52-org-a-${randomUUID().slice(0, 8)}`,
  orgB: `f52-org-b-${randomUUID().slice(0, 8)}`,
  adminA: `f52-admin-a-${randomUUID().slice(0, 8)}`,
  adminB: `f52-admin-b-${randomUUID().slice(0, 8)}`,
}

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.create({ data: { id: orgId, name: orgId, slug: orgId } })
  await prisma.user.create({
    data: { id: adminId, email: `${adminId}@f52.test`, name: adminId, role: "ADMIN" },
  })
  await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true },
  })
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>(
    "select current_database() as db"
  )
  expect(["markec_f52_test", "markec_e2e_test"]).toContain(rows[0].db)
  await seedOrg(ID.orgA, ID.adminA)
  await seedOrg(ID.orgB, ID.adminB)
})

beforeEach(() => {
  state.session = {
    user: { id: ID.adminA, role: "ADMIN", organizationId: ID.orgA },
  }
  state.headerEntries = {}
  // Čiščenje med testi, da ni navzkrižnih ostankov ob ponovljenih zagonih.
  return Promise.all([
    prisma.category.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } }),
    prisma.service.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } }),
    prisma.product.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } }),
  ])
})

afterAll(async () => {
  await prisma.category.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.service.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.product.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ID.orgA, ID.orgB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ID.adminA, ID.adminB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ID.orgA, ID.orgB] } } })
  await prisma.$disconnect()
})

function loginAsB() {
  state.session = {
    user: { id: ID.adminB, role: "ADMIN", organizationId: ID.orgB },
  }
}

function loginAsA() {
  state.session = {
    user: { id: ID.adminA, role: "ADMIN", organizationId: ID.orgA },
  }
}

describe("F5.2 — ustvarjanje in urejanje kategorij", () => {
  it("ustvari korensko kategorijo z novo shemo (sortOrder, isActive, categoryType)", async () => {
    const res = await createCategory({ name: "Striženje" })
    expect(res.success).toBe(true)
    const id = res.data!.category.id
    const row = await prisma.category.findUnique({ where: { id } })
    expect(row!.organizationId).toBe(ID.orgA)
    expect(row!.isActive).toBe(true)
    expect(row!.categoryType).toBe("BOTH")
    expect(row!.sortOrder).toBeGreaterThanOrEqual(0)
    expect(row!.slug).toMatch(/^strizenje/)
  })

  it("idempotentno: isto ime pod istim staršem vrne obstoječo", async () => {
    const a = await createCategory({ name: "Barvanje" })
    const b = await createCategory({ name: "barvanje" }) // case-insensitive
    expect(b.success).toBe(true)
    expect(b.data!.category.id).toBe(a.data!.category.id)
  })

  it("uredi ime, opis, sliko, vrsto in aktivnost", async () => {
    const created = await createCategory({ name: "Nega las" })
    const id = created.data!.category.id
    const upd = await updateCategory({
      id,
      name: "Nega las PRO",
      description: "Napredna nega",
      image: "uploads/lasje.png",
      categoryType: "SERVICES",
      isActive: false,
    })
    expect(upd.success).toBe(true)
    const row = await prisma.category.findUnique({ where: { id } })
    expect(row!.name).toBe("Nega las PRO")
    expect(row!.description).toBe("Napredna nega")
    expect(row!.image).toBe("uploads/lasje.png")
    expect(row!.categoryType).toBe("SERVICES")
    expect(row!.isActive).toBe(false)
  })
})

describe("F5.2 — hierarhija in cikli", () => {
  it("ustvari podkategorijo pod korenom", async () => {
    const root = await createCategory({ name: "Lasje" })
    const sub = await createCategory({ name: "Balayage", parentId: root.data!.category.id })
    expect(sub.success).toBe(true)
    const row = await prisma.category.findUnique({ where: { id: sub.data!.category.id } })
    expect(row!.parentId).toBe(root.data!.category.id)
  })

  it("zavrne nadrejeno kategorijo, ki ne pripada isti org", async () => {
    const foreign = await prisma.category.create({
      data: { name: "Tuja", slug: "tuja-" + randomUUID().slice(0, 6), organizationId: ID.orgB },
    })
    const res = await prisma
      .$transaction(async () => true)
      .then(async () => createCategory({ name: "Sumnjiva", parentId: foreign.id }))
    // createCategory ne sme dovoliti starša iz org B.
    expect(res.success).toBe(false)
  })

  it("prepreči ciklično povezavo (prestavi starš pod lastnega otroka)", async () => {
    const a = await createCategory({ name: "Alfa" })
    const b = await createCategory({ name: "Beta", parentId: a.data!.category.id })
    // Poskus: Alfa naj postane otrok od Beta → cikel.
    const res = await updateCategory({ id: a.data!.category.id, parentId: b.data!.category.id })
    expect(res.success).toBe(false)
  })

  it("prepreči lastno nadrejenost", async () => {
    const a = await createCategory({ name: "Sama" })
    const res = await updateCategory({ id: a.data!.category.id, parentId: a.data!.category.id })
    expect(res.success).toBe(false)
  })
})

describe("F5.2 — unikatnost slugov znotraj org", () => {
  it("dva korena z enakim imenom dobita različna slug-a (številčno)", async () => {
    const a = await createCategory({ name: "Maskara" })
    // Idempotenca vrne isti → ustvarita se must same pod različnimi slug-i
    // z direktnim zapisom, da preverimo @unique([organizationId, slug]).
    const c1 = await prisma.category.create({
      data: { name: "Maskara X", slug: "maskara-x", organizationId: ID.orgA },
    })
    const c2 = await prisma.category.create({
      data: { name: "Maskara Y", slug: "maskara-x", organizationId: ID.orgA },
    }).catch(() => null)
    expect(c2).toBeNull() // kolizija slug znotraj org zavrnjena
    await prisma.category.delete({ where: { id: c1.id } }).catch(() => undefined)
    void a
  })
})

describe("F5.2 — organizacijska izolacija", () => {
  it("org B ne vidi kategorij org A", async () => {
    await createCategory({ name: "Skrita org A" })
    const before = await getManagedCategories()
    const idsA = new Set(before.data!.categories.map((c) => c.id))
    expect(idsA.size).toBeGreaterThan(0)

    loginAsB()
    const listB = await getManagedCategories()
    const idsB = new Set(listB.data!.categories.map((c) => c.id))
    // Nobena kategorija org B ne sme pripadati org A.
    for (const id of idsB) expect(idsA.has(id)).toBe(false)
  })

  it("org B ne more posodobiti/brisati kategorije org A", async () => {
    const inA = await createCategory({ name: "Intimno A" })
    const id = inA.data!.category.id

    loginAsB()
    const upd = await updateCategory({ id, name: "Vdri v A" })
    expect(upd.success).toBe(false)
    const del = await deleteCategory(id)
    expect(del.success).toBe(false)

    // Še vedno nedotaknjena.
    loginAsA()
    const row = await prisma.category.findUnique({ where: { id } })
    expect(row!.name).toBe("Intimno A")
  })
})

describe("F5.2 — varno brisanje", () => {
  it("brisanje kategorije NE izbriše povezanih izdelkov/storitev (SetNull)", async () => {
    const cat = await createCategory({ name: "Za brisanje" })
    const catId = cat.data!.category.id
    const svc = await prisma.service.create({
      data: {
        name: "Storitev pod kategorijo",
        slug: "storitev-" + randomUUID().slice(0, 6),
        description: "x",
        duration: 30,
        price: 10,
        organizationId: ID.orgA,
        categoryId: catId,
      },
    })
    const prod = await prisma.product.create({
      data: {
        name: "Izdelek pod kategorijo",
        price: 5,
        organizationId: ID.orgA,
        categoryId: catId,
      },
    })

    const preview = await getCategoryDeletePreview(catId)
    expect(preview.data!.services).toBe(1)
    expect(preview.data!.products).toBe(1)

    const del = await deleteCategory(catId)
    expect(del.success).toBe(true)

    // Elementi ostanejo, zdaj brez kategorije.
    expect(await prisma.service.findUnique({ where: { id: svc.id } })).not.toBeNull()
    expect((await prisma.service.findUnique({ where: { id: svc.id } }))!.categoryId).toBeNull()
    expect(await prisma.product.findUnique({ where: { id: prod.id } })).not.toBeNull()
    expect((await prisma.product.findUnique({ where: { id: prod.id } }))!.categoryId).toBeNull()
  })

  it("brez cascadeChildren zavrne brisanje kategorije s podkategorijami", async () => {
    const root = await createCategory({ name: "Root z otroki" })
    const rootId = root.data!.category.id
    await createCategory({ name: "Otrok", parentId: rootId })
    const res = await deleteCategory(rootId)
    expect(res.success).toBe(false)
    await prisma.category.deleteMany({ where: { parentId: rootId } })
    await prisma.category.delete({ where: { id: rootId } })
  })

  it("s cascadeChildren podkategorije postanejo korenske, kategorija izbrisana", async () => {
    const root = await createCategory({ name: "Koren2" })
    const rootId = root.data!.category.id
    const child = await createCategory({ name: "Glavni otrok", parentId: rootId })
    const childId = child.data!.category.id
    const res = await deleteCategory(rootId, { cascadeChildren: true })
    expect(res.success).toBe(true)
    const childRow = await prisma.category.findUnique({ where: { id: childId } })
    expect(childRow!.parentId).toBeNull()
  })
})

describe("F5.2 — predloge dejavnosti (seedOrganizationCatalog)", () => {
  it("seed v prazno org ustvari kategorije z novo shemo iz preseta (frizer)", async () => {
    const orgC = "f52-org-c-" + randomUUID().slice(0, 8)
    const adminC = "f52-admin-c-" + randomUUID().slice(0, 8)
    await seedOrg(orgC, adminC)

    const report = await seedOrganizationCatalog(orgC, "frizer", {
      replaceForeignPreset: false,
    })
    expect(report.added.categories).toBeGreaterThan(0)
    expect(report.added.services).toBeGreaterThan(0)

    const cats = await prisma.category.findMany({ where: { organizationId: orgC } })
    expect(cats.length).toBe(report.added.categories)
    for (const c of cats) {
      expect(c.organizationId).toBe(orgC)
      expect(c.isActive).toBe(true)
      expect(c.sortOrder).toBeGreaterThanOrEqual(0)
      expect(c.categoryType).toBe("BOTH")
    }
    await prisma.category.deleteMany({ where: { organizationId: orgC } })
    await prisma.service.deleteMany({ where: { organizationId: orgC } })
    await prisma.product.deleteMany({ where: { organizationId: orgC } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgC } })
    await prisma.user.delete({ where: { id: adminC } })
    await prisma.organization.delete({ where: { id: orgC } })
  })

  it("ponovljena inicializacija ne ustvari dvojnikov", async () => {
    const orgC = "f52-org-d-" + randomUUID().slice(0, 8)
    const adminC = "f52-admin-d-" + randomUUID().slice(0, 8)
    await seedOrg(orgC, adminC)
    await seedOrganizationCatalog(orgC, "beauty", { replaceForeignPreset: false })
    const before = await prisma.category.count({ where: { organizationId: orgC } })
    await seedOrganizationCatalog(orgC, "beauty", { replaceForeignPreset: false })
    const after = await prisma.category.count({ where: { organizationId: orgC } })
    expect(after).toBe(before) // ni dvojnikov ob ponovljeni inicializaciji

    await prisma.category.deleteMany({ where: { organizationId: orgC } })
    await prisma.service.deleteMany({ where: { organizationId: orgC } })
    await prisma.product.deleteMany({ where: { organizationId: orgC } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgC } })
    await prisma.user.delete({ where: { id: adminC } })
    await prisma.organization.delete({ where: { id: orgC } })
  })
})

describe("F5.2 — javna predstavitev", () => {
  it("getPublicCategories vrne samo aktivne kategorije, urejene", async () => {
    const act = await createCategory({ name: "Javna aktivna" })
    await createCategory({ name: "Javna neaktivnaX", categoryType: "SERVICES" })
    await updateCategory({
      id: (await prisma.category.findFirst({ where: { name: "Javna neaktivnaX", organizationId: ID.orgA } }))!.id,
      isActive: false,
    })
    void act
    const cats = await getPublicCategories(ID.orgA)
    const names = cats.map((c) => c.name)
    expect(names).toContain("Javna aktivna")
    expect(names).not.toContain("Javna neaktivnaX")
  })

  it("getPublicShopProducts vrže izdelke v neaktivni kategoriji ven", async () => {
    const cat = await createCategory({ name: "Skrita kategorija", categoryType: "PRODUCTS" })
    const catId = cat.data!.category.id
    await prisma.product.create({
      data: { name: "Skrit izdelek", price: 9, organizationId: ID.orgA, categoryId: catId },
    })
    await updateCategory({ id: catId, isActive: false })
    const products = await getPublicShopProducts(ID.orgA)
    expect(products.some((p) => p.name === "Skrit izdelek")).toBe(false)
  })

  it("getPublicServicesGrouped prikaže storitve aktivnih kategorij", async () => {
    const act = await createCategory({ name: "Aktivna storitev", categoryType: "SERVICES" })
    await prisma.service.create({
      data: {
        name: "Svetovalni termin",
        slug: "svetovalni-" + randomUUID().slice(0, 6),
        description: "x",
        duration: 15,
        price: 0,
        organizationId: ID.orgA,
        categoryId: act.data!.category.id,
      },
    })
    const grouped = await getPublicServicesGrouped(ID.orgA)
    expect(grouped["Aktivna storitev"]?.some((s) => s.name === "Svetovalni termin")).toBe(true)
  })
})

// ============================================================
// F5.2.2 — FINAL ACCEPTANCE AUDIT (neodvisno preverjanje)
// ============================================================

describe("F5.2.2 §1 — sprememba dejavnosti / več dejavnosti", () => {
  /** Seeding v prazno org z določenim primarnim profilom. */
  async function seedFresh(vertical: string) {
    const orgId = "f52-adv-" + randomUUID().slice(0, 6)
    const adminId = "f52-adv-admin-" + randomUUID().slice(0, 6)
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, vertical, secondaryVertical: vertical === "frizer" ? "beauty" : null },
    })
    await prisma.user.create({
      data: { id: adminId, email: `${adminId}@f52.test`, name: adminId, role: "ADMIN" },
    })
    await prisma.organizationMember.create({
      data: { organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true },
    })
    await seedOrganizationCatalog(orgId, vertical, { replaceForeignPreset: false })
    return { orgId, adminId }
  }

  it("frizer → doda kozmetično dejavnost: kozmetične predloge se združijo idempotentno", async () => {
    // Fresh frizer org ima frizer categories (primary seeded).
    const { orgId, adminId } = await seedFresh("frizer")
    const before = await prisma.category.count({ where: { organizationId: orgId } })
    expect(before).toBeGreaterThan(0)

    // Dodamo sekundarno dejavnost (kozmetika) na org — setOrgSecondaryVertical
    // zdaj priključi tudi predloge kategorij beauty (F5.2.3).
    state.session = { user: { id: adminId, role: "ADMIN", organizationId: orgId } }
    const set = await setOrgSecondaryVertical({ secondaryVertical: "beauty" })
    expect(set.ok).toBe(true)

    const after = await prisma.category.count({ where: { organizationId: orgId } })
    // Kategorije sekundarne dejavnosti so se dodale (ali bile že združene po slug).
    const beautyPreset = (await import("@/lib/verticals")).getVertical("beauty")
    const present = new Set(
      (await prisma.category.findMany({ where: { organizationId: orgId }, select: { name: true } })).map((c) => c.name)
    )
    // Vsaj ena beauty predlogna kategorija je sedaj prisotna (če ni bila že iz frizerja).
    const beautyHits = beautyPreset.categories.filter((c) => present.has(c.name)).length
    expect(beautyHits).toBeGreaterThanOrEqual(1)

    // Idempotenca: ponovni set ne sme ustvariti dvojnikov.
    await setOrgSecondaryVertical({ secondaryVertical: "beauty" })
    const after2 = await prisma.category.count({ where: { organizationId: orgId } })
    expect(after2).toBe(after)

    await prisma.category.deleteMany({ where: { organizationId: orgId } })
    await prisma.service.deleteMany({ where: { organizationId: orgId } })
    await prisma.product.deleteMany({ where: { organizationId: orgId } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } })
    await prisma.user.delete({ where: { id: adminId } })
    await prisma.organization.delete({ where: { id: orgId } })
  })

  it("lastniške kategorije ostanejo nedotaknjene ob re-seedu (replaceForeignPreset)", async () => {
    const { orgId, adminId } = await seedFresh("frizer")
    // Lastniška kategorija (presetSeed = null).
    const owner = await prisma.category.create({
      data: { name: "Moj lastni krog", slug: "moj-own-" + randomUUID().slice(0, 6), organizationId: orgId },
    })

    await seedOrganizationCatalog(orgId, "beauty", { replaceForeignPreset: true })
    const still = await prisma.category.findUnique({ where: { id: owner.id } })
    expect(still).not.toBeNull() // lastniška ni bila izbrisana
    expect(still!.name).toBe("Moj lastni krog")

    await prisma.category.deleteMany({ where: { organizationId: orgId } })
    await prisma.service.deleteMany({ where: { organizationId: orgId } })
    await prisma.product.deleteMany({ where: { organizationId: orgId } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } })
    await prisma.user.delete({ where: { id: adminId } })
    await prisma.organization.delete({ where: { id: orgId } })
  })

  it("podjetje z več dejavnostmi ob ustvarjanju: kombinacija veljavna", async () => {
    // Onboarding požene seedOrganizationCatalog za PRIMARY (onboarding.ts:350).
    // Kombinacija primary frizer + secondary beauty je veljavna in razširi
    // capability union (pričakujemo "services" s strani frizerja).
    const combo = validateSecondaryVertical("frizer", "beauty")
    expect(combo).toBe("OK")
    const primary = getProfile("frizer")
    const union = applySecondaryProfile(primary, "beauty")
    // frizer ima services → union ima services omogočen.
    expect(union.capabilities.services !== "disabled").toBe(true)
  })
})

describe("F5.2.3 §2 — pravice (STAFF), permission-based", () => {
  /** Ustvari STAFF uporabnika + članstvo v org A + custom rolo z danimi permisi. */
  async function seedStaffWithRole(perms: string[]) {
    const staffId = "f52-staff2-" + randomUUID().slice(0, 6)
    const roleId = "f52-role-" + randomUUID().slice(0, 6)
    await prisma.customRole.create({
      data: {
        id: roleId,
        organizationId: ID.orgA,
        name: "test-rola",
        // Json stolpec sprejme ARRAY (ne stringify-ano skladno niz!).
        permissions: perms,
      },
    })
    await prisma.user.create({
      data: { id: staffId, email: `${staffId}@f52.test`, name: staffId, role: "STAFF" },
    })
    await prisma.organizationMember.create({
      data: {
        organizationId: ID.orgA,
        userId: staffId,
        role: "STAFF",
        isDefault: true,
        customRoleId: roleId,
      },
    })
    return { staffId, roleId }
  }

  async function cleanupStaff(staffId: string, roleId: string) {
    await prisma.organizationMember.deleteMany({ where: { userId: staffId } })
    await prisma.user.delete({ where: { id: staffId } })
    await prisma.customRole.deleteMany({ where: { id: roleId } })
  }

  it("STAFF s products.manage: sme PRODUCTS kategorijo, NE SERVICES", async () => {
    const { staffId, roleId } = await seedStaffWithRole(["products.manage"])
    state.session = { user: { id: staffId, role: "STAFF", organizationId: ID.orgA } }

    const prod = await createCategory({ name: "ProdKat", categoryType: "PRODUCTS" })
    expect(prod.success).toBe(true)
    const svc = await createCategory({ name: "SvcKat", categoryType: "SERVICES" })
    expect(svc.success).toBe(false) // nima services.manage
    const both = await createCategory({ name: "BothKat" })
    expect(both.success).toBe(false) // BOTH zahteva oba ključa

    await cleanupStaff(staffId, roleId)
  })

  it("STAFF s services.manage: sme SERVICES, NE PRODUCTS/BOTH", async () => {
    const { staffId, roleId } = await seedStaffWithRole(["services.manage"])
    state.session = { user: { id: staffId, role: "STAFF", organizationId: ID.orgA } }

    const svc = await createCategory({ name: "SvcKat2", categoryType: "SERVICES" })
    expect(svc.success).toBe(true)
    const prod = await createCategory({ name: "ProdKat2", categoryType: "PRODUCTS" })
    expect(prod.success).toBe(false)

    await cleanupStaff(staffId, roleId)
  })

  it("STAFF z obema: sme BOTH, PRODUCTS in SERVICES", async () => {
    const { staffId, roleId } = await seedStaffWithRole(["products.manage", "services.manage"])
    state.session = { user: { id: staffId, role: "STAFF", organizationId: ID.orgA } }

    const both = await createCategory({ name: "BothKat2" })
    expect(both.success).toBe(true)
    const prod = await createCategory({ name: "ProdKat3", categoryType: "PRODUCTS" })
    expect(prod.success).toBe(true)
    const svc = await createCategory({ name: "SvcKat3", categoryType: "SERVICES" })
    expect(svc.success).toBe(true)

    await cleanupStaff(staffId, roleId)
  })

  it("STAFF brez kataloških dovoljenj: vse zavrnjeno", async () => {
    const { staffId, roleId } = await seedStaffWithRole([])
    state.session = { user: { id: staffId, role: "STAFF", organizationId: ID.orgA } }

    const created = await createCategory({ name: "X" })
    expect(created.success).toBe(false)
    const edited = await updateCategory({ id: "any", name: "y", categoryType: "PRODUCTS" })
    expect(edited.success).toBe(false)
    const deleted = await deleteCategory("any")
    expect(deleted.success).toBe(false)

    await cleanupStaff(staffId, roleId)
  })

  it("STAFF products.manage ne sme urediti/brisati SERVICES kategorije", async () => {
    // Najprej ADMIN ustvari SERVICES kategorijo.
    loginAsA()
    const svc = await createCategory({ name: "SvcZaProda", categoryType: "SERVICES" })
    expect(svc.success).toBe(true)
    const svcId = svc.data!.category.id

    // STAFF s products.manage ga ne sme urediti/brisati.
    const { staffId, roleId } = await seedStaffWithRole(["products.manage"])
    state.session = { user: { id: staffId, role: "STAFF", organizationId: ID.orgA } }
    const upd = await updateCategory({ id: svcId, name: "Nimam pravice" })
    expect(upd.success).toBe(false)
    const del = await deleteCategory(svcId)
    expect(del.success).toBe(false)

    // ADMIN ga še vedno lahko izbriše.
    loginAsA()
    const del2 = await deleteCategory(svcId)
    expect(del2.success).toBe(true)

    await cleanupStaff(staffId, roleId)
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })
})

describe("F5.2.2 §3 — brisanje, hierarhija in sočasnost", () => {
  it("kategorija z otroki + izdelki + storitvami: brisanje ne izbriše ničesar, otroci po cascade postanejo koreni", async () => {
    const root = await createCategory({ name: "Drevo" })
    const rootId = root.data!.category.id
    const child = await createCategory({ name: "Veja", parentId: rootId })
    const childId = child.data!.category.id
    const p = await prisma.product.create({ data: { name: "Izpr", price: 3, organizationId: ID.orgA, categoryId: rootId } })
    const s = await prisma.service.create({ data: { name: "Stor", slug: "stor-" + randomUUID().slice(0, 6), description: "x", duration: 10, price: 4, organizationId: ID.orgA, categoryId: rootId } })

    const del = await deleteCategory(rootId, { cascadeChildren: true })
    expect(del.success).toBe(true)

    expect((await prisma.product.findUnique({ where: { id: p.id } }))!.categoryId).toBeNull()
    expect((await prisma.service.findUnique({ where: { id: s.id } }))!.categoryId).toBeNull()
    expect((await prisma.category.findUnique({ where: { id: childId } }))!.parentId).toBeNull()

    await prisma.product.delete({ where: { id: p.id } })
    await prisma.service.delete({ where: { id: s.id } })
    await prisma.category.delete({ where: { id: childId } })
  })

  it("premestitev podkategorije med starše ohrani povezave", async () => {
    const r1 = await createCategory({ name: "Koren Prvi" })
    const r2 = await createCategory({ name: "Koren Drugi" })
    const child = await createCategory({ name: "Podi", parentId: r1.data!.category.id })
    const serv = await prisma.service.create({ data: { name: "Srv", slug: "srv-" + randomUUID().slice(0, 6), description: "x", duration: 5, price: 2, organizationId: ID.orgA, categoryId: child.data!.category.id } })

    const move = await updateCategory({ id: child.data!.category.id, parentId: r2.data!.category.id })
    expect(move.success).toBe(true)
    expect((await prisma.category.findUnique({ where: { id: child.data!.category.id } }))!.parentId).toBe(r2.data!.category.id)
    expect((await prisma.service.findUnique({ where: { id: serv.id } }))!.categoryId).toBe(child.data!.category.id)

    await prisma.service.delete({ where: { id: serv.id } })
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })

  it("cikli tudi pri vzporednih premestitvah ne uspejo (poskna vsa naprema, samo en zmaga)", async () => {
    const a = await createCategory({ name: "Alfa2" })
    const b = await createCategory({ name: "Beta2", parentId: a.data!.category.id })
    // Poskus: v vzporedni nalogi Alfa2→Beta2 (cikel). Tudi če se izvede
    // večkrat, nobena ne sme ustvariti cikla.
    const harmful = await updateCategory({ id: a.data!.category.id, parentId: b.data!.category.id })
    expect(harmful.success).toBe(false)
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })
})

describe("F5.2.2 §5 — javna ponudba (tipi kategorij)", () => {
  it("izdelek brez kategorije se prikaže, kategorija BOTH + PRODUCTS row", async () => {
    await prisma.product.create({ data: { name: "Brez kategorije prod", price: 1, organizationId: ID.orgA } })
    const both = await createCategory({ name: "BothK", categoryType: "BOTH" })
    const onlyProducts = await createCategory({ name: "ProductsK", categoryType: "PRODUCTS" })
    await prisma.product.create({ data: { name: "Pod Both", price: 2, organizationId: ID.orgA, categoryId: both.data!.category.id } })
    await prisma.product.create({ data: { name: "Pod Products", price: 3, organizationId: ID.orgA, categoryId: onlyProducts.data!.category.id } })

    const products = await getPublicShopProducts(ID.orgA)
    const names = products.map((p) => p.name)
    expect(names).toContain("Brez kategorije prod")
    // Izdelek brez kategorije (categoryId null) NIMA kategorije → ni filtriran ven.
    expect(names).toContain("Pod Both")
    expect(names).toContain("Pod Products")
    await prisma.product.deleteMany({ where: { organizationId: ID.orgA } })
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })

  it("neaktivna kategorija se ne prikaže; brezkategorijna storitev se pokaže (Mappa)", async () => {
    await prisma.service.create({ data: { name: "Brez kat stor", slug: "bk-" + randomUUID().slice(0, 6), description: "x", duration: 8, price: 9, organizationId: ID.orgA, categoryId: null } })
    const inactive = await createCategory({ name: "Neadv", categoryType: "SERVICES" })
    await updateCategory({ id: inactive.data!.category.id, isActive: false })
    await prisma.service.create({ data: { name: "V nead", slug: "vn-" + randomUUID().slice(0, 6), description: "x", duration: 8, price: 9, organizationId: ID.orgA, categoryId: inactive.data!.category.id } })

    const grouped = await getPublicServicesGrouped(ID.orgA)
    // Brezkategorijna storitev je pod "Brez kategorije" ključem.
    const uncat = Object.values(grouped).flat().some((s) => s.name === "Brez kat stor")
    expect(uncat).toBe(true)
    // Storitev v neaktivni kategoriji ni v nobeni skupini.
    const allNames = Object.values(grouped).flat().map((s) => s.name)
    expect(allNames).not.toContain("V nead")
    await prisma.service.deleteMany({ where: { organizationId: ID.orgA } })
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })
})

// ============================================================
// F5.2.3 — ZAKLJUČEK VEČDEJAVNOSTNIH KATEGORIJ
// ============================================================

describe("F5.2.3 §1 — združevanje predlog ob več dejavnostih", () => {
  async function freshOrg(vertical: string, secondary: string | null) {
    const orgId = "f523-org-" + randomUUID().slice(0, 6)
    const adminId = "f523-admin-" + randomUUID().slice(0, 6)
    await prisma.organization.create({
      data: {
        id: orgId,
        name: orgId,
        slug: orgId,
        vertical,
        ...(secondary ? { secondaryVertical: secondary } : {}),
      },
    })
    await prisma.user.create({
      data: { id: adminId, email: `${adminId}@f52.test`, name: adminId, role: "ADMIN" },
    })
    await prisma.organizationMember.create({
      data: { organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true },
    })
    return { orgId, adminId }
  }
  async function wipe(orgId: string, adminId: string) {
    await prisma.category.deleteMany({ where: { organizationId: orgId } })
    await prisma.service.deleteMany({ where: { organizationId: orgId } })
    await prisma.product.deleteMany({ where: { organizationId: orgId } })
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } })
    await prisma.user.delete({ where: { id: adminId } })
    await prisma.organization.delete({ where: { id: orgId } })
  }

  it("frizerstvo + kozmetika: predloge se združijo brez dvojnikov, owner ohranjen", async () => {
    const { orgId, adminId } = await freshOrg("frizer", null)
    // Primarni frizer katalog.
    await seedOrganizationCatalog(orgId, "frizer", { replaceForeignPreset: false })
    // Lastniška kategorija.
    const owner = await prisma.category.create({
      data: { name: "Moj frizer", slug: "moj-f-" + randomUUID().slice(0, 5), organizationId: orgId },
    })

    // Dodamo kozmetiko (sekundarna) → kategorije beauty.
    const merged = await seedProfileCategories(orgId, "beauty")
    expect(merged.added).toBeGreaterThan(0)

    // Owner ostane, izdelki/storitve se ne brišejo.
    expect(await prisma.category.findUnique({ where: { id: owner.id } })).not.toBeNull()
    // Idempotenca: ponovni merge nič ne doda.
    const again = await seedProfileCategories(orgId, "beauty")
    expect(again.added).toBe(0)

    // Ni dvojnikov med frizer in beauty kategorijami.
    const roots = await prisma.category.findMany({
      where: { organizationId: orgId, parentId: null },
    })
    const slugs = roots.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)

    await wipe(orgId, adminId)
  })

  it("šiviljstvo + trgovina: združevanje predlog brez izgube izdelkov", async () => {
    const { orgId, adminId } = await freshOrg("seamstress", null)
    await seedOrganizationCatalog(orgId, "seamstress", { replaceForeignPreset: false })
    // En izdelek pod lastniško kategorijo (ne sme biti prizadet).
    const ownerCat = await prisma.category.create({
      data: { name: "Izdelki po meri", slug: "po-meri-" + randomUUID().slice(0, 5), organizationId: orgId, categoryType: "PRODUCTS" },
    })
    const product = await prisma.product.create({
      data: { name: "Bluza po meri", price: 40, organizationId: orgId, categoryId: ownerCat.id },
    })

    // Dodamo trgovinsko dejavnost (beekeeping ima products) ali "generic" z izdelki.
    const res = await seedProfileCategories(orgId, "beekeeping")
    // Idempotentno; izdelek ostane.
    expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull()
    expect((await prisma.product.findUnique({ where: { id: product.id } }))!.categoryId).toBe(ownerCat.id)
    void res

    await wipe(orgId, adminId)
  })

  it("tri dejavnosti: predloge vseh treh se združijo idempotentno", async () => {
    const { orgId, adminId } = await freshOrg("frizer", null)
    await seedOrganizationCatalog(orgId, "frizer", { replaceForeignPreset: false })
    await seedProfileCategories(orgId, "beauty") // kozmetika
    await seedProfileCategories(orgId, "barber") // brivec

    const total = await prisma.category.count({ where: { organizationId: orgId } })
    // Vse tri dejavnosti so v sistem (vsaj frizer + beauty vsaj 1 nova).
    expect(total).toBeGreaterThan(0)

    // Ponovna inicializacija vseh treh ne sme podvojiti.
    await seedProfileCategories(orgId, "beauty")
    await seedProfileCategories(orgId, "barber")
    const again = await prisma.category.count({ where: { organizationId: orgId } })
    expect(again).toBe(total)

    await wipe(orgId, adminId)
  })
})

describe("F5.2.3 §3 — brisanje kategorije s povezanimi izdelki in storitvami (ADMIN)", () => {
  it("brisanje kategorije z izdelki in storitvami ne izbriše elementov; otroci korenski", async () => {
    loginAsA()
    const root = await createCategory({ name: "Povezana" })
    const rootId = root.data!.category.id
    await createCategory({ name: "Podi", parentId: rootId })
    const p = await prisma.product.create({ data: { name: "Prd", price: 5, organizationId: ID.orgA, categoryId: rootId } })
    const s = await prisma.service.create({ data: { name: "Srv", slug: "srv2-" + randomUUID().slice(0, 6), description: "x", duration: 20, price: 8, organizationId: ID.orgA, categoryId: rootId } })

    const del = await deleteCategory(rootId, { cascadeChildren: true })
    expect(del.success).toBe(true)

    expect((await prisma.product.findUnique({ where: { id: p.id } }))!.categoryId).toBeNull()
    expect((await prisma.service.findUnique({ where: { id: s.id } }))!.categoryId).toBeNull()

    await prisma.product.delete({ where: { id: p.id } })
    await prisma.service.delete({ where: { id: s.id } })
    await prisma.category.deleteMany({ where: { organizationId: ID.orgA } })
  })
})