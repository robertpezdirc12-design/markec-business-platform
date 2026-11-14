"use server"

// ============================================================
// CATEGORIES (P3 #52 → F5.2) — kategorije in podkategorije.
//
// P3 #52 je dodal pot do PRVE kategorije (inline izbirnik v obrazcu
// izdelka/storitve, idempotentno glede imena). F5.2 razširi v celotno
// upravljanje: hierarhija (parentId), opis, slika, slug (edinstven
// znotraj org), sortOrder, isActive, categoryType in varno brisanje.
//
// Permissions: KATEGORIJE delijo izdelki in storitve → zadostuje kateri
// koli ključ (`products.manage` ali `services.manage`); ni novega ključa.
// Vsaka mutacija preveri organizacijsko pripadnost kategorije in
// starša/otrok (strežniško, fail-closed).
// ============================================================

import { prisma } from "@/lib/prisma"
import { UnauthorizedError, requireCatalogPermission } from "@/lib/auth/guards"
import { slugify } from "@/lib/tenant"
import { normalizeCategoryName } from "@/lib/dashboard/category-picker"
import type { Prisma, CategoryType } from "@prisma/client"
import type { PermissionKey } from "@/lib/permissions/roles"

const NAME_MAX = 60
const DESC_MAX = 500

/**
 * F5.2.3 — pravilo "kdo sme kateri tip kategorij":
 *  - PRODUCTS → products.manage
 *  - SERVICES → services.manage
 *  - BOTH      → products.manage IN services.manage (odločitev akcije)
 */
function canManageType(permissions: PermissionKey[], type: CategoryType): boolean {
  if (type === "PRODUCTS") return permissions.includes("products.manage")
  if (type === "SERVICES") return permissions.includes("services.manage")
  return permissions.includes("products.manage") && permissions.includes("services.manage")
}

export interface CategoryResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** Osnovni prikaz upravljanja: kategorija + števci + starš. */
export interface ManagedCategory {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  sortOrder: number
  isActive: boolean
  categoryType: CategoryType
  parentId: string | null
  presetSeed: string | null
  productCount: number
  serviceCount: number
  childCount: number
}

// ---------------------------------------------------------------
// Validacije in pomoži (strežniške, en vir resnice)
// ---------------------------------------------------------------

function tryMessage(error: unknown): string | undefined {
  if (error instanceof UnauthorizedError) return error.message
  return undefined
}

/** Slug, edinstven znotraj najemnika (doda -2, -3 …). */
async function uniqueSlug(
  organizationId: string,
  base: string
): Promise<string> {
  const clean = slugify(base) || "kategorija"
  let candidate = clean
  for (let i = 2; i <= 50; i++) {
    const taken = await prisma.category.findFirst({
      where: { organizationId, slug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
    candidate = `${clean}-${i}`
  }
  return `${clean}-${Date.now().toString(36)}`
}

/** Zgradi drevesno prvobitino in preveri, da parentId ne naredi cikla. */
async function assertNoCycle(
  organizationId: string,
  categoryId: string,
  newParentId: string | null
): Promise<boolean> {
  if (!newParentId) return true
  let cursor: string | null = newParentId
  // Hoja do korena: če naletimo na categoryId, bi nastal cikel.
  for (let hops = 0; hops < 100; hops++) {
    if (cursor === categoryId) return false
    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    })
    if (!parent) return false // starš ne obstaja ali ne pripada org
    if (parent.parentId === null) return true
    cursor = parent.parentId
  }
  return false
}

/** Preveri, da parentId pripada isti org (če je podano). */
async function assertParentInOrg(
  organizationId: string,
  parentId: string | null
): Promise<boolean> {
  if (!parentId) return true
  const parent = await prisma.category.findFirst({
    where: { id: parentId, organizationId },
    select: { id: true },
  })
  return !!parent
}

// ---------------------------------------------------------------
// Seznami
// ---------------------------------------------------------------

/** Vse kategorije org s števci (za stran upravljanja). */
export async function getManagedCategories(): Promise<
  CategoryResult<{ categories: ManagedCategory[] }>
> {
  try {
    const { org } = await requireCatalogPermission()
    const categories = await prisma.category.findMany({
      where: { organizationId: org.id },
      orderBy: [{ parentId: { sort: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            children: true,
            products: { where: { isActive: true } },
            services: { where: { isActive: true } },
          },
        },
      },
    })
    const mapped: ManagedCategory[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      categoryType: c.categoryType,
      parentId: c.parentId,
      presetSeed: c.presetSeed,
      productCount: c._count.products,
      serviceCount: c._count.services,
      childCount: c._count.children,
    }))
    return { success: true, data: { categories: mapped } }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Napaka pri nalaganju kategorij." }
  }
}

/** Preprost seznam aktivnih kategorij (za izbirnike v obrazcih). */
export async function getCategoryOptions(): Promise<
  CategoryResult<{ categories: { id: string; name: string }[] }>
> {
  try {
    const { org } = await requireCatalogPermission()
    const categories = await prisma.category.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    })
    return { success: true, data: { categories } }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Napaka pri nalaganju kategorij." }
  }
}

// ---------------------------------------------------------------
// Ustvarjanje
// ---------------------------------------------------------------

export interface CreateCategoryInput {
  name: string
  parentId?: string | null
  description?: string | null
  image?: string | null
  categoryType?: CategoryType
}

export async function createCategory(
  input: CreateCategoryInput
): Promise<CategoryResult<{ category: { id: string; name: string } }>> {
  try {
    const { org, permissions } = await requireCatalogPermission()

    const type = input.categoryType ?? "BOTH"
    if (!canManageType(permissions, type)) {
      return {
        success: false,
        error:
          type === "BOTH"
            ? "Za ustvarjanje kategorije za izdelke IN storitve potrebujete obe dovoljenji (izdelki + storitve)."
            : `Nimate dovoljenja za kategorije vrste "${type === "PRODUCTS" ? "izdelki" : "storitve"}".`,
      }
    }

    const valid = normalizeCategoryName(input.name)
    if (!valid.ok) {
      return {
        success: false,
        error:
          valid.reason === "too-long"
            ? `Ime kategorije je predolgo (največ ${NAME_MAX} znakov).`
            : "Ime kategorije mora imeti vsaj 2 znaka.",
      }
    }
    const desc = (input.description ?? "").trim()
    if (desc.length > DESC_MAX) {
      return { success: false, error: `Opis je predolg (največ ${DESC_MAX} znakov).` }
    }

    const parentId = input.parentId || null
    if (!(await assertParentInOrg(org.id, parentId))) {
      return { success: false, error: "Nadrejena kategorija ne obstaja ali ne pripada vašemu podjetju." }
    }

    // Idempotentnost: isto ime pod ISTIM staršem → vrni obstoječo.
    const existing = await prisma.category.findFirst({
      where: {
        organizationId: org.id,
        parentId,
        name: { equals: valid.name, mode: "insensitive" },
      },
      select: { id: true, name: true },
    })
    if (existing) {
      return { success: true, data: { category: existing } }
    }

    const slug = await uniqueSlug(org.id, valid.name)
    // Največji sortOrder + 1 znotraj istega starša.
    const max = await prisma.category.aggregate({
      where: { organizationId: org.id, parentId },
      _max: { sortOrder: true },
    })
    const created = await prisma.category.create({
      data: {
        organizationId: org.id,
        name: valid.name,
        slug,
        parentId,
        description: desc || null,
        image: input.image?.trim() || null,
        categoryType: input.categoryType ?? "BOTH",
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        isActive: true,
      },
      select: { id: true, name: true },
    })

    return { success: true, data: { category: created } }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Ustvarjanje kategorije ni uspelo." }
  }
}

// ---------------------------------------------------------------
// Urejanje
// ---------------------------------------------------------------

export interface UpdateCategoryInput {
  id: string
  name?: string
  parentId?: string | null
  description?: string | null
  image?: string | null
  categoryType?: CategoryType
  isActive?: boolean
}

export async function updateCategory(
  input: UpdateCategoryInput
): Promise<CategoryResult> {
  try {
    const { org, permissions } = await requireCatalogPermission()

    const category = await prisma.category.findFirst({
      where: { id: input.id, organizationId: org.id },
      select: { id: true, parentId: true, categoryType: true },
    })
    if (!category) {
      return { success: false, error: "Kategorija ne obstaja ali ne pripada vašemu podjetju." }
    }

    // F5.2.3: pravica se nanaša na kategorijo po njenem CURRENT tipu
    // (produkti/storitve/oboje) in na NOVI tip, če se ta spreminja.
    if (!canManageType(permissions, category.categoryType)) {
      return { success: false, error: "Nimate dovoljenja za urejanje te kategorije." }
    }
    if (input.categoryType !== undefined && input.categoryType !== category.categoryType) {
      if (!canManageType(permissions, input.categoryType)) {
        return { success: false, error: "Nimate dovoljenja za spremembo tipa kategorije." }
      }
    }

    const data: Prisma.CategoryUpdateInput = {}

    if (input.name !== undefined) {
      const valid = normalizeCategoryName(input.name)
      if (!valid.ok) {
        return {
          success: false,
          error:
            valid.reason === "too-long"
              ? `Ime kategorije je predolgo (največ ${NAME_MAX} znakov).`
              : "Ime kategorije mora imeti vsaj 2 znaka.",
        }
      }
      data.name = valid.name
      data.slug = await uniqueSlug(org.id, valid.name)
    }
    if (input.description !== undefined) {
      const desc = (input.description ?? "").trim()
      if (desc.length > DESC_MAX) {
        return { success: false, error: `Opis je predolg (največ ${DESC_MAX} znakov).` }
      }
      data.description = desc || null
    }
    if (input.image !== undefined) data.image = input.image?.trim() || null
    if (input.categoryType !== undefined) data.categoryType = input.categoryType
    if (input.isActive !== undefined) data.isActive = input.isActive

    if (input.parentId !== undefined) {
      const newParentId = input.parentId || null
      if (newParentId === category.id) {
        return { success: false, error: "Kategorija ne more biti lastna nadrejena kategorija." }
      }
      if (!(await assertParentInOrg(org.id, newParentId))) {
        return { success: false, error: "Nadrejena kategorija ne obstaja ali ne pripada vašemu podjetju." }
      }
      if (!(await assertNoCycle(org.id, category.id, newParentId))) {
        return { success: false, error: "Te premestitve ni mogoče izvesti, ker bi povzročila ciklično povezavo." }
      }
      data.parent = newParentId
        ? { connect: { id: newParentId } }
        : { disconnect: true }
    }

    await prisma.category.update({
      where: { id: category.id },
      data,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Posodabljanje kategorije ni uspelo." }
  }
}

// ---------------------------------------------------------------
// Vrstni red (bulk)
// ---------------------------------------------------------------

/** Postavimo vrstni red po podanem vrstnem redu ID-jev (loop). */
export async function reorderCategories(
  orderedIds: string[]
): Promise<CategoryResult> {
  try {
    const { org, permissions } = await requireCatalogPermission()
    const ids: string[] = []
    for (const raw of orderedIds) {
      const idsIn = await prisma.category.findFirst({
        where: { id: raw, organizationId: org.id },
        select: { id: true, categoryType: true },
      })
      // F5.2.3: premikanje zahteva pravico nad tipom kategorije.
      if (idsIn && canManageType(permissions, idsIn.categoryType)) ids.push(idsIn.id)
    }
    // Samo ID-ji, ki NISO otroci istega starša prek vmesnika — upravljanje
    // vrstnega reda znotraj vsake skupine (koreni in podkategorije ločeno).
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.category.update({
          where: { id },
          data: { sortOrder: i },
        })
      )
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Posodabljanje vrstnega reda ni uspelo." }
  }
}

// ---------------------------------------------------------------
// Brisanje (varno: NE izbriše elementov; SetNull)
// ---------------------------------------------------------------

/**
 * Varno brisanje kategorije:
 *  - ne izbriše povezanih izdelkov/storitev (shema: onDelete SetNull → postanejo "brez kategorije");
 *  - zahteva, da kategorija nima podkategorij (ali jih uporabnik prej prestavi/izbriše);
 *  - preveri pripadnost org in v varnem ključu NE izvaja slepega delete-a.
 */
export async function deleteCategory(
  id: string,
  opts: {
    /** Ko je true, podkategorije ostanejo in postanejo korenske (parentId=null). */
    cascadeChildren?: boolean
  } = {}
): Promise<CategoryResult<{ orphanedProducts: number; orphanedServices: number }>> {
  try {
    const { org, permissions } = await requireCatalogPermission()

    const category = await prisma.category.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true, categoryType: true },
    })
    if (!category) {
      return { success: false, error: "Kategorija ne obstaja ali ne pripada vašemu podjetju." }
    }
    // F5.2.3: brisanje kategorično glede na njen tip.
    if (!canManageType(permissions, category.categoryType)) {
      return { success: false, error: "Nimate dovoljenja za brisanje te kategorije." }
    }

    // Številki povezanih elementov, da UI predhodno pokaže, in za poročilo.
    const linked = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, services: true, children: true } },
      },
    })
    const childCount = linked?._count.children ?? 0
    if (childCount > 0 && !opts.cascadeChildren) {
      return {
        success: false,
        error: `Kategorija ima ${childCount} podkategorij. Najprej jih prestavite (ali izberite brisanje z njihovim ohranitvijo kot korenske).`,
      }
    }

    // Naredi podkategorije korenske (ne jih brisati) in potem izbriši kategorijo.
    if (childCount > 0) {
      await prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      })
    }

    await prisma.category.delete({ where: { id } })

    return {
      success: true,
      data: {
        orphanedProducts: linked?._count.products ?? 0,
        orphanedServices: linked?._count.services ?? 0,
      },
    }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Brisanje kategorije ni uspelo." }
  }
}

// ---------------------------------------------------------------
// Povzetek brisanja (za predhodno potrditev UI)
// ---------------------------------------------------------------

/** Pred brisanjem: koliko elementov/podkategorij je povezanih. */
export async function getCategoryDeletePreview(
  id: string
): Promise<
  CategoryResult<{ name: string; products: number; services: number; children: number }>
> {
  try {
    const { org, permissions } = await requireCatalogPermission()
    const category = await prisma.category.findFirst({
      where: { id, organizationId: org.id },
      select: {
        id: true,
        name: true,
        categoryType: true,
        _count: { select: { products: true, services: true, children: true } },
      },
    })
    if (!category) {
      return { success: false, error: "Kategorija ne obstaja." }
    }
    if (!canManageType(permissions, category.categoryType)) {
      return { success: false, error: "Nimate dovoljenja za brisanje te kategorije." }
    }
    return {
      success: true,
      data: {
        name: category.name,
        products: category._count.products,
        services: category._count.services,
        children: category._count.children,
      },
    }
  } catch (error) {
    return { success: false, error: tryMessage(error) ?? "Napaka pri pregledu kategorije." }
  }
}