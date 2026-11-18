// ============================================================
// VERTICALS — SEED (SERVER LE)
//
// Ločeno od verticals.ts NAMERNA (FAZA 3 perf, 2026-11): ta sekcija
// je uporabljala prisma KOT VREDNOST in je prek site-design.ts →
// FONT_CSS_VARS vlekla cel Prisma runtime (437 KB / ~120 KB gzip) v
// ADMIN client bundle. verticals.ts je client-safe (PALETTES,
// VERTICALS, fontovi — site-design/site-editor v brskalniku).
//
// Uporabniki (vsi server): actions/onboarding.ts, actions/guided-entry.ts,
// actions/site-content.ts (dynamic import).
// ============================================================

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import {
  getVertical,
  type PresetCategory,
  type CatalogSeedReport,
} from "@/lib/verticals"

/**
 * Fill in the MISSING parts of a preset's catalog (P2 #59): categories +
 * services when the tenant has none, products when the tenant has none —
 * independently, so a tenant with categories still gets products of a
 * product-centric preset (and vice versa).
 *
 * Provenance (`presetSeed`): every row this function creates is flagged with
 * the preset id. With `replaceForeignPreset` (vertical switch), sample rows of
 * OTHER presets are replaced, while owner-created rows (presetSeed = null) are
 * never touched. Sample rows already referenced by real business data
   * (appointments, orders) are kept — they are history, not samples.
   */
 async function seedPresetCategory(
   prismaClient: {
     category: Prisma.CategoryDelegate
     service: Prisma.ServiceDelegate
   },
   orgId: string,
   presetId: string,
   cat: PresetCategory,
   parentId: string | null,
   parentSlug: string | null,
   report: CatalogSeedReport
 ): Promise<void> {
   // F5.2: unikaten slug znotraj org. Podkategorije dobijo korensko predpono
     // (npr. "cena-delo"), da ni kolizije med korenskimi in podrejenimi slug-i.
   const raw = parentSlug ? `${parentSlug}-${cat.slug}` : cat.slug
   const unique = await uniqueCategorySlug(prismaClient, orgId, raw)
   const category = await prismaClient.category.create({
     data: {
       name: cat.name,
       slug: unique,
       categoryType: cat.categoryType ?? "BOTH",
       sortOrder: report.added.categories,
       isActive: true,
       parentId,
       organizationId: orgId,
       presetSeed: presetId,
     },
   })
   report.added.categories += 1

   for (const [i, svc] of cat.services.entries()) {
     await prismaClient.service.create({
       data: {
         name: svc.name,
         slug: `${category.slug}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
         description: svc.description,
         duration: svc.duration,
         price: svc.price,
         imageUrl: svc.imageUrl,
         isActive: true,
         isFeatured: !!svc.isFeatured && i < 2,
         order: i,
         organizationId: orgId,
         categoryId: category.id,
         presetSeed: presetId,
       },
     })
     report.added.services += 1
   }

   // Rekurzivno seje podkategorije pod istim korenom.
   for (const sub of cat.subcategories ?? []) {
     await seedPresetCategory(prismaClient, orgId, presetId, sub, category.id, category.slug, report)
   }
 }

 /** Ustvari unikaten Category slug znotraj org (doda številko, če je zaseden). */
 async function uniqueCategorySlug(
   prismaClient: { category: Prisma.CategoryDelegate },
   orgId: string,
   base: string
 ): Promise<string> {
   const clean = base.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "kategorija"
   let candidate = clean
   let i = 2
   for (;;) {
     const taken = await prismaClient.category.findFirst({
       where: { organizationId: orgId, slug: candidate },
       select: { id: true },
     })
     if (!taken) return candidate
     candidate = `${clean}-${i++}`
   }
 }

 export async function seedOrganizationCatalog(
  orgId: string,
  verticalId: string,
  opts: { replaceForeignPreset?: boolean } = {}
): Promise<CatalogSeedReport> {
  const preset = getVertical(verticalId)
  const report: CatalogSeedReport = {
    added: { categories: 0, services: 0, products: 0 },
    replaced: { categories: 0, services: 0, products: 0 },
    kept: 0,
  }

  // ------------------------------------------------------------
  // P2 #59: the two halves of the catalog are independent — the old
  // implementation early-returned when ANY category existed, which made
  // "Dopolni katalog" a silent no-op for product-centric presets
  // (beekeeping ships categories: []) and left stale honey products on a
  // seamstress site.
  // ------------------------------------------------------------

  // Replace foreign-preset sample rows first (vertical switch flow):
  // rows flagged with a DIFFERENT preset id are the previous activity's
  // samples. Owner-created rows (presetSeed = null) are never touched;
  // sample rows with real business history (appointments/orders) are kept.
  if (opts.replaceForeignPreset) {
    const foreign = preset.id
    const replacedServices = await prisma.service.deleteMany({
      where: {
        organizationId: orgId,
        presetSeed: { not: null, notIn: [foreign] },
        appointmentServices: { none: {} },
      },
    })
    report.replaced.services = replacedServices.count
    report.kept += await prisma.service.count({
      where: {
        organizationId: orgId,
        presetSeed: { not: null, notIn: [foreign] },
        appointmentServices: { some: {} },
      },
    })
    const replacedProducts = await prisma.product.deleteMany({
      where: {
        organizationId: orgId,
        presetSeed: { not: null, notIn: [foreign] },
        orderItems: { none: {} },
      },
    })
    report.replaced.products = replacedProducts.count
    report.kept += await prisma.product.count({
      where: {
        organizationId: orgId,
        presetSeed: { not: null, notIn: [foreign] },
        orderItems: { some: {} },
      },
    })
    // Categories last (services already removed): a category is replaced
    // only when it holds no owner-created service (those were placed there
    // deliberately and must not be orphaned).
    const replacedCategories = await prisma.category.deleteMany({
      where: {
        organizationId: orgId,
        presetSeed: { not: null, notIn: [foreign] },
        services: { none: { presetSeed: null } },
      },
    })
    report.replaced.categories = replacedCategories.count
  }

  const existingCats = await prisma.category.count({ where: { organizationId: orgId } })
  if (existingCats === 0) {
    // F5.2: kategorije dobijo novo shemo (isActive, sortOrder, categoryType)
    // in poljubno hierarhijo. Idempotentno: zgodi se le, ko org nima še
    // nobene kategorije (nobenih dvojnikov ob ponovljeni inicializaciji).
    for (const cat of preset.categories) {
      await seedPresetCategory(prisma, orgId, preset.id, cat, null, null, report)
    }
  }

  // Sample products for product-centric profiles (e.g. beekeeping) —
  // independent of the category guard above (P2 #59).
  if (preset.products?.length) {
    const existingProducts = await prisma.product.count({ where: { organizationId: orgId } })
    if (existingProducts === 0) {
      const res = await prisma.product.createMany({
        data: preset.products.map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price,
          trackInventory: p.trackInventory ?? true,
          stockQuantity: p.stockQuantity,
          images: p.imageUrl ? [p.imageUrl] : [],
          isActive: true,
          isFeatured: !!p.isFeatured,
          organizationId: orgId,
          presetSeed: preset.id,
        })),
      })
      report.added.products = res.count
    }
  }

  return report
}

/**
 * F5.2.3 — združi predloge KATEGORIJ enega profila v obstoječe drevo
 * najemnika, IDEMPOTENTNO in ADITIVNO:
 *  - ne izbriše lastniških kategorij, izdelkov ali storitev;
 *  - ne ustvari podvojenih predlog (dedup po slug znotraj org — več
 *    dejavnosti lahko deli isto drevo);
 *  - ponovljena inicializacija ne doda ničesar (idempotentno);
 *  - predloge različnih dejavnosti se pravilno združijo (skupni slug = en
 *    vozlišče, manjkajoči otroci se dopolnijo).
 * Seja SAMO kategorije (ne vzorčnih storitev), da ne pride do prekrivanja —
 * podjetnik doda storitve/izdelke v nova vozlišča sam.
 */
export async function seedProfileCategories(
  orgId: string,
  presetId: string
): Promise<{ added: number }> {
  const preset = getVertical(presetId)
  const report = { added: 0 }

  async function node(
    cat: PresetCategory,
    parentId: string | null,
    parentSlug: string | null
  ): Promise<void> {
    const slugCand = parentSlug ? `${parentSlug}-${cat.slug}` : cat.slug
    const existing = await prisma.category.findFirst({
      where: { organizationId: orgId, slug: slugCand },
      select: { id: true, slug: true },
    })
    if (existing) {
      // Vozlišče že obstaja → rekurzivno dopolni samo manjkajoče otroke.
      for (const sub of cat.subcategories ?? []) {
        await node(sub, existing.id, existing.slug)
      }
      return
    }
    // Največji sortOrder znotraj istega starša + 1 (preliminarno).
    const max = await prisma.category.aggregate({
      where: { organizationId: orgId, parentId },
      _max: { sortOrder: true },
    })
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: slugCand,
        categoryType: cat.categoryType ?? "BOTH",
        isActive: true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        parentId,
        organizationId: orgId,
        presetSeed: presetId,
      },
      select: { id: true, slug: true },
    })
    report.added += 1
    for (const sub of cat.subcategories ?? []) {
      await node(sub, created.id, created.slug)
    }
  }

  for (const cat of preset.categories) {
    await node(cat, null, null)
  }
  return report
}
