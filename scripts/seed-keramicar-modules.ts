/**
 * MARKEC — NADGRADNJA keramičarja (skd-f-construction, F43.33) — moduli, ki
 * jih je keramičar pred tem imel prave (forms/workflows so bili []):
 *   1. materializeProfileAssets  → ustvari FormDefinition (povpraševanje
 *      projekta, sprejem naročila) + WorkflowDefinition (proces delovnega
 *      naloga) v DB (create-if-missing).
 *   2. seedOrganizationCatalog("construction", replaceForeignPreset:true) →
 *      zamenja generic vzorčne storitve z gradbenim/keramičarskim katalogom
 *      (polaganje ploščic, fugiranje, tlakovanje …) + materiali (products).
 *
 * Idempotentno, namenjeno DevOps skripti (ne test bazi). Ne dotika se drugih
 * org. Poženem: pnpm exec tsx scripts/seed-keramicar-modules.ts
 */
import { prisma } from "../src/lib/prisma"
import { seedOrganizationCatalog } from "../src/lib/verticals-seed"
import { materializeProfileAssets } from "../src/lib/profiles/materialize"
import { getProfile } from "../src/lib/profiles/registry"
import { verticalSiteContent, getVertical } from "../src/lib/verticals"

const SLUG = "keramika-novak"

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
  if (!org) {
    console.error(`Org "${SLUG}" ne obstaja.`)
    return
  }
  const profile = getProfile(org.vertical)

  // 1) Forme + workflow-i (create-if-missing).
  const m = await materializeProfileAssets(org.id, profile.id)
  console.log(`materialize → profile ${profile.id}: forms=${m.forms}, workflows=${m.workflows}`)

  // 2) Katalog construction (zamenja generic vzorce).
  const r = await seedOrganizationCatalog(org.id, "construction", { replaceForeignPreset: true })
  console.log(
    `katalog → added {cat:${r.added.categories}, svc:${r.added.services}, prod:${r.added.products}}, ` +
      `replaced {cat:${r.replaced.categories}, svc:${r.replaced.services}, prod:${r.replaced.products}}, kept:${r.kept}`
  )

  // 3) Javna vsebina → construction osnutek (org še ni objavljena in nima
  //    lastniških uredb; ponastavimo na pravi gradbeni presea za MBO).
  const siteContent = verticalSiteContent("construction") as unknown as object
  await prisma.salonConfig.update({
    where: { organizationId: org.id },
    data: { siteContent },
  })
  console.log(`siteContent → construction (${Object.keys(siteContent).length} ključev)`)

  // 4) INKREMENTALNI dodatek — seedOrganizationCatalog doda celotne predloge
  //    le, ko je org še brez kategorij. Ker keramičar že ima katalog, se nove
  //    kategorije/storitve/materiali iz konstrukcijskega preseta (estrihi,
  //    vodotesenje, dodatni materiali) tukaj dodajo ADITIVNO in idempotentno
  //    (create-if-missing po imenu). Obstoječega se ne dotikamo.
  const preset = getVertical("construction")
  for (const cat of preset.categories) {
    const existingCat = await prisma.category.findFirst({
      where: {
        organizationId: org.id,
        categoryType: (cat.categoryType ?? "BOTH") as never,
        name: cat.name,
      },
      select: { id: true },
    })
    const catId = existingCat?.id ?? null
    if (!existingCat) {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          categoryType: cat.categoryType ?? "BOTH",
          sortOrder: 100,
          isActive: true,
          organizationId: org.id,
          presetSeed: preset.id,
        },
      })
      console.log(`  + kategorija: ${cat.name}`)
      for (const [i, svc] of cat.services.entries()) {
        await prisma.service.create({
          data: {
            name: svc.name,
            slug: `${created.slug}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
            description: svc.description,
            duration: svc.duration,
            price: svc.price,
            imageUrl: svc.imageUrl,
            isActive: true,
            isFeatured: !!svc.isFeatured && i < 2,
            order: i,
            organizationId: org.id,
            categoryId: created.id,
            presetSeed: preset.id,
          },
        })
        console.log(`    + storitev: ${svc.name}`)
      }
      continue
    }
    // Kategorija že obstaja → dodaj le manjkajoče storitve (po imenu).
    const existingServices = new Set(
      (
        await prisma.service.findMany({
          where: { organizationId: org.id, categoryId: existingCat.id },
          select: { name: true },
        })
      ).map((s) => s.name)
    )
    for (const [i, svc] of cat.services.entries()) {
      if (existingServices.has(svc.name)) continue
      await prisma.service.create({
        data: {
          name: svc.name,
          slug: `${existingCat.id.slice(0, 8)}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
          description: svc.description,
          duration: svc.duration,
          price: svc.price,
          imageUrl: svc.imageUrl,
          isActive: true,
          isFeatured: !!svc.isFeatured,
          order: i,
          organizationId: org.id,
          categoryId: existingCat.id,
          presetSeed: preset.id,
        },
      })
      console.log(`  + storitev: ${cat.name} → ${svc.name}`)
    }
  }
  // Materiali (products) — poiščemo po imenu, dodamo manjkajoče.
  const existingProductNames = new Set(
    (
      await prisma.product.findMany({
        where: { organizationId: org.id },
        select: { name: true },
      })
    ).map((p) => p.name)
  )
  for (const p of preset.products ?? []) {
    if (existingProductNames.has(p.name)) continue
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        trackInventory: p.trackInventory ?? true,
        stockQuantity: p.stockQuantity,
        images: p.imageUrl ? [p.imageUrl] : [],
        isActive: true,
        isFeatured: !!p.isFeatured,
        organizationId: org.id,
        presetSeed: preset.id,
      },
    })
    console.log(`  + material: ${p.name}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})