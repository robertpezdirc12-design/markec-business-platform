/**
 * MARKEC — ustvari TRETJO referenčno org: ŠIVILJSTVO (seamstress).
 * Nova, LOČENA organizacija in nov uporabniški račun — ne dopolnitev
 * čebelarja ali vulkanizerja. Vse org-scoped na 'svezi-atelje-2d2'.
 *
 * Idempotentno; test-baza-only ('markec_e2e_test'). Ne dotika se
 * čebelarjeve ('svezi-cebeler-2d1l') niti vulkanizerjeve ('svezi-vulkanizer-2d1s')
 * organizacije ali podatkov.
 *
 * Run: DATABASE_URL=…test… npx tsx scripts/seed-seamstress-complete.ts
 */
import { prisma } from "../src/lib/prisma"
import bcrypt from "bcryptjs"
import { seedOrganizationCatalog } from "../src/lib/verticals"
import { defaultSiteContent } from "../src/lib/site-content"
import { materializeProfileAssets } from "../src/lib/profiles/materialize"
import { getProfile } from "../src/lib/profiles/registry"

const SLUG = "svezi-atelje-2d2"
const OWNER_EMAIL = "atelje.fresh@markec.test"
const OWNER_NAME = "Maja Šivilja"
const ORG_NAME = "Šiviljski atelje Sveti Jurij"
const DEMO_CUSTOMER_EMAIL = "mia.svetlo@markec.test"

function assertTarget(dbUrl: string) {
  if (!/markec_e2e_test/.test(dbUrl)) {
    throw new Error(`REFUSED: seed-seamstress-complete sme teči le na markec_e2e_test (trenutno: ${dbUrl})`)
  }
}

// Materjala za šivanje — izdelki z zalogo (m² blaga, vrvica, zadrga, gumbi).
async function seedMaterials(orgId: string) {
  const materials = [
    { name: "Blago bombaž (m²)", price: 12, sku: "BOMBAZ-M2", stock: 40 },
    { name: "Blago svila (m²)", price: 22, sku: "SVILA-M2", stock: 20 },
    { name: "Vrvica bombaž (m)", price: 1.5, sku: "VRVICA-M", stock: 100 },
    { name: "Zadrga kovinska (kos)", price: 3, sku: "ZADRGA-K", stock: 50 },
    { name: "Gumbi (set)", price: 2, sku: "GUMBI-SET", stock: 60 },
  ]
  for (const m of materials) {
    const exists = await prisma.product.findFirst({ where: { organizationId: orgId, sku: m.sku } })
    if (exists) continue
    await prisma.product.create({
      data: {
        organization: { connect: { id: orgId } },
        name: m.name,
        sku: m.sku,
        price: m.price,
        trackInventory: true,
        stockQuantity: m.stock,
        reservedQuantity: 0,
        isActive: true,
        forSale: true,
      },
    })
  }
}

async function main() {
  assertTarget(process.env.DATABASE_URL ?? "")

  // --- 1) Uporabnik (lastnik) + organizacija + članstvo ---
  let owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })
  if (!owner) {
    const hash = await bcrypt.hash("demo1234", 10)
    owner = await prisma.user.create({
      data: { email: OWNER_EMAIL, name: OWNER_NAME, role: "ADMIN", password: hash, emailVerified: new Date() },
    })
    console.log("✔ Z ustvarjen lastnik (nov uporabniški račun).")
  } else {
    console.log("• Lastnik že obstaja.")
  }

  let org = await prisma.organization.findUnique({ where: { slug: SLUG } })
  if (!org) {
    org = await prisma.organization.create({
      data: { slug: SLUG, name: ORG_NAME, vertical: "seamstress", palette: "teal", publishState: "DRAFT" },
    })
    console.log(`✔ Z ustvarjena nova org (${SLUG}, seamstress).`)
  } else {
    console.log("• Org že obstaja.")
  }

  // Članstvo (lastnik ↔ org).
  const existingMember = await prisma.organizationMember.findFirst({ where: { organizationId: org.id, userId: owner.id } })
  if (!existingMember) {
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId: owner.id, role: "ADMIN", isDefault: true } })
    await prisma.user.update({ where: { id: owner.id }, data: { organizationId: org.id } })
    console.log("✔ Članstvo ustvarjeno (ADMIN, default).")
  }

  // --- 2) Katalog storitev dejavnosti + materiali ---
  const report = await seedOrganizationCatalog(org.id, org.vertical)
  console.log(`✔ Katalog: +${report.added.services} storitev, +${report.added.products} izdelkov, +${report.added.categories} kategorij.`)
  await seedMaterials(org.id)
  console.log("✔ Materiali za šivanje (zaloga) dodani.")

  // --- 3) Osebje (lastnik) + delovni čas ---
  let staff = await prisma.staff.findFirst({ where: { userId: owner.id } })
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        bio: "Lastnica in mojstrica šivilja z dolgoletnimi izkušnjami s šivanjem po meri.",
        isActive: true,
        userId: owner.id,
        organizationId: org.id,
      },
    })
    console.log("✔ Ustvarjeno osebje (lastnica).")
  }
  const existingHours = await prisma.workingHours.count({ where: { staffId: staff.id } })
  if (existingHours === 0) {
    const days = [1, 2, 3, 4, 5, 6]
    for (const day of days) {
      const end = day === 6 ? "13:00" : "17:00"
      await prisma.workingHours.create({ data: { staffId: staff.id, dayOfWeek: day, startTime: "09:00", endTime: end, isActive: true } })
    }
    console.log("✔ Delovni čas (Pon–Pet 9–17, Sob 9–13).")
  }

  // --- 4) SalonConfig z lastno javno vsebino dejavnosti ---
  let cfg = await prisma.salonConfig.findFirst({ where: { organizationId: org.id } })
  if (!cfg) {
    const content = defaultSiteContent(org.vertical)
    await prisma.salonConfig.create({
      data: {
        organizationId: org.id,
        name: ORG_NAME,
        email: "info@atelje-sveti-jurij.si",
        phone: "+386 40 111 222",
        city: "Sveti Jurij",
        country: "SI",
        currency: "EUR",
        locale: "sl",
        timezone: "Europe/Ljubljana",
        bookingDeposit: 0,
        cancellationPolicy: "Spremembe in odpovedi sporočite vsaj 24 ur vnaprej.",
        siteContent: content as unknown as object,
        publishedSiteContent: content as unknown as object,
        publishedContentVersion: 1,
      },
    })
    console.log("✔ SalonConfig (lastna javna vsebina šiviljstva) + snapshot.")
  }

  // --- 5) Forme/workflow-i profila (idempotentno) ---
  await materializeProfileAssets(org.id, org.vertical)
  console.log(`✔ Profilni elementi (${getProfile(org.vertical).label}).`)

  // --- 6) Vzorčna stranka (za merilni list / naročilo v E2E) ---
  let demoCustomer = await prisma.customer.findFirst({ where: { organizationId: org.id, email: DEMO_CUSTOMER_EMAIL } })
  if (!demoCustomer) {
    demoCustomer = await prisma.customer.create({
      data: { organizationId: org.id, name: "Mia Svetlič", email: DEMO_CUSTOMER_EMAIL, phone: "+386 31 888 999" },
    })
    console.log("✔ Vzorčna stranka (za merilni list / naročilo).")
  }

  console.log("KONEC — šiviljska org pripravljena (pred objavo).")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())