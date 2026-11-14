/**
 * MARKEC — dopolni VULKANIZER referenčno org ('svezi-vulkanizer-2d1s') na popolno
 * najemniško podjetje — ISTO skupno infrastrukturo kot čebelar (2D-1L):
 *   • katalog storitev dejavnosti (seedOrganizationCatalog: Vulkanizerija + Servis vozil)
 *   • osebje (lastnik) + delovni čas (osnova za rezervacije)
 *   • SalonConfig z lastno javno vsebino (defaultSiteContent("tire-service")) + snapshot
 *   • forme/workflow-i profila (materializeProfileAssets) — idempotentno
 *
 * Vse org-scoped na 'svezi-vulkanizer-2d1s'; čebelarjeve org/podatki ostanejo nedotaknjeni.
 * Ščiti pred nenamernim zagonom mimo testne baze markec_e2e_test.
 *
 * Run: DATABASE_URL=…test… npx tsx scripts/seed-vulkanizer-complete.ts
 */
import { prisma } from "../src/lib/prisma"
import bcrypt from "bcryptjs"
import { seedOrganizationCatalog } from "../src/lib/verticals"
import { defaultSiteContent } from "../src/lib/site-content"
import { materializeProfileAssets } from "../src/lib/profiles/materialize"
import { getProfile } from "../src/lib/profiles/registry"

const SLUG = "svezi-vulkanizer-2d1s"
const OWNER_EMAIL = "cebeler.tire@markec.test"

function assertTarget(dbUrl: string) {
  if (!/markec_e2e_test/.test(dbUrl)) {
    throw new Error(`REFUSED: seed-vulkanizer-complete sme teči le na markec_e2e_test (trenutno: ${dbUrl})`)
  }
}

async function main() {
  assertTarget(process.env.DATABASE_URL ?? "")

  const org = await prisma.organization.findUnique({ where: { slug: SLUG } })
  if (!org) throw new Error(`Ni org ${SLUG}`)

  console.log(`• Org: ${org.name} (${org.vertical}) — dopolnjujem najemniško podjetje.`)

  // 1) Katalog storitev (Vulkanizerija + Servis vozil) + izdelki — org-scoped.
  const report = await seedOrganizationCatalog(org.id, org.vertical)
  console.log(`✔ Katalog: +${report.added.services} storitev, +${report.added.products} izdelkov, +${report.added.categories} kategorij.`)

  // 2) Lastnik kot osebje + delovni čas (Pon–Pet 9–18, Sob 9–13) — osnova rezervacij.
  let staff = await prisma.staff.findFirst({ where: { userId: (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } }))!.id } })
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        name: "Marko Vulkanizer",
        email: OWNER_EMAIL,
        bio: "Lastnik in mojster vulkanizer z dolgoletnimi izkušnjami.",
        isActive: true,
        userId: (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } }))!.id,
        organizationId: org.id,
      },
    })
    console.log("✔ Ustvarjeno osebje (lastnik).")
  } else {
    console.log("• Osebje že obstaja.")
  }
  const existingHours = await prisma.workingHours.count({ where: { staffId: staff.id } })
  if (existingHours === 0) {
    const days = [1, 2, 3, 4, 5, 6]
    for (const day of days) {
      const end = day === 6 ? "13:00" : "18:00"
      await prisma.workingHours.create({
        data: { staffId: staff.id, dayOfWeek: day, startTime: "09:00", endTime: end, isActive: true },
      })
    }
    console.log("✔ Delovni čas (Pon–Pet 9–18, Sob 9–13).")
  }

  // 3) Dodeli vse storitve osebju (za rezervacije).
  const services = await prisma.service.findMany({ where: { organizationId: org.id }, select: { id: true } })
  const existingSS = await prisma.staffService.count({ where: { staffId: staff.id } })
  if (existingSS === 0 && services.length) {
    for (const s of services) await prisma.staffService.create({ data: { staffId: staff.id, serviceId: s.id } })
    console.log(`✔ Dodeljenih ${services.length} storitev osebju.`)
  }

  // 4) SalonConfig z lastno javno vsebino dejavnosti + objavljen snapshot.
  let cfg = await prisma.salonConfig.findFirst({ where: { organizationId: org.id } })
  if (!cfg) {
    const content = defaultSiteContent(org.vertical)
    await prisma.salonConfig.create({
      data: {
        organizationId: org.id,
        name: org.name,
        email: "info@vulkanizer-marko.si",
        phone: "+386 51 444 555",
        city: "Šentjur",
        country: "SI",
        currency: "EUR",
        locale: "sl",
        timezone: "Europe/Ljubljana",
        bookingDeposit: 20,
        cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
        siteContent: content as unknown as object,
        publishedSiteContent: content as unknown as object,
        publishedContentVersion: 1,
      },
    })
    console.log("✔ SalonConfig (lastna javna vsebina vulkanizerja) + snapshot.")
  } else {
    console.log("• SalonConfig že obstaja.")
  }

  // 5) Forme/workflow-i profila (idempotentno).
  await materializeProfileAssets(org.id, org.vertical)
  console.log(`✔ Profilni elementi (${getProfile(org.vertical).label}).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())