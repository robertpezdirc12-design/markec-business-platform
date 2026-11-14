// ============================================================
// F6.3.1 — SETUP testne baze markec_f631_test (E2E verifikacija).
//
// Ustvari 4 izmišljene, objavljene testne organizacije (avtomehanik,
// frizer, šivilja, čebelar) iz dejavnosti profilov, da lahko javna
// stran prikaže resno strukturo (F6.3 layout manifest). Vse podatke
// omeji na DATABASE_URL (izolirana baza); NIKOLI na markec_dev/
// produkcijo.
//
// Potek na org:
//   1. Organization (vertical → aktivni profil, publishState=PUBLISHED)
//   2. Owner user + staff (za rezervacije/osebje)
//   3. seedOrganizationCatalog (katalog storitev/izdelkov dejavnosti)
//   4. materializeProfileAssets (forms/workflows iz profila v DB)
//   5. SalonConfig.siteContent = defaultSiteContent(vertical) (+_templateId)
//      + publishedSiteContent snapshot + publishedContentVersion=1
//   6. WorkingHours (opcijsko za frizer/mehanik) — osnova za termine
// ============================================================
const DB_URL = process.env.DATABASE_URL ?? ""
if (!/markec_f631_test/.test(DB_URL)) {
  throw new Error("REFUSED: F6.3.1 setup sme teči LE na markec_f631_test")
}

import { prisma } from "../src/lib/prisma"
import { seedOrganizationCatalog } from "../src/lib/verticals"
import { defaultSiteContent } from "../src/lib/site-content"
import { materializeProfileAssets } from "../src/lib/profiles/materialize"
import { getProfile } from "../src/lib/profiles/registry"

const DEJAVNOSTI = [
  { slug: "mehanik-test", name: "Avtomehanika Test", vertical: "mehanik", ownerName: "Marko Mehanik", ownerEmail: "mk@f631.test" },
  { slug: "frizer-test", name: "Frizerski salon Test", vertical: "frizer", ownerName: "Ana Frizerka", ownerEmail: "fr@f631.test" },
  { slug: "sivilja-test", name: "Šiviljski atelje Test", vertical: "seamstress", ownerName: "Maja Šivilja", ownerEmail: "si@f631.test" },
  { slug: "cebelar-test", name: "Čebelarstvo Test", vertical: "beekeeping", ownerName: "Tone Čebelar", ownerEmail: "cb@f631.test" },
]

async function wipe() {
  const orgs = await prisma.organization.findMany({ select: { id: true } })
  for (const o of orgs) {
    await prisma.salonConfig.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.staffService.deleteMany({ where: { staff: { is: { organizationId: o.id } } } }).catch(() => {})
    await prisma.workingHours.deleteMany({ where: { staff: { is: { organizationId: o.id } } } }).catch(() => {})
    await prisma.service.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.product.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.staff.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.document.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.formDefinition.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.workflowDefinition.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.organizationMember.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.user.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await prisma.organization.deleteMany({ where: { id: o.id } })
  }
}

/** Ustvari enega objavljen fejtnega testnega tenant. */
async function createTenant(spec: (typeof DEJAVNOSTI)[number]) {
  const profile = getProfile(spec.vertical)

  const org = await prisma.organization.create({
    data: {
      slug: spec.slug,
      name: spec.name,
      vertical: spec.vertical,
      palette: profile.palette,
      status: "ACTIVE",
      publishState: "PUBLISHED",
    },
  })

  const owner = await prisma.user.create({
    data: {
      name: spec.ownerName,
      email: spec.ownerEmail,
      // Brez pravega hasha ni za prijavo, ampak obstoj lastnika zadostuje za org.
      password: "f631-test-password",
      role: "ADMIN",
      emailVerified: new Date(),
      organizationId: org.id,
    },
  })
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: owner.id, role: "ADMIN", isDefault: true },
  })

  await prisma.staff.create({
    data: {
      name: spec.ownerName,
      email: spec.ownerEmail,
      bio: `Lastnik in izvajalec storitev — ${profile.label}.`,
      isActive: true,
      userId: owner.id,
      organizationId: org.id,
    },
  })

  // Katalog storitev/izdelkov dejavnosti (v DB).
  await seedOrganizationCatalog(org.id, spec.vertical)

  // Forme/workflow-i profila → per-org FormDefinition/WorkflowDefinition.
  await materializeProfileAssets(org.id, profile.id)

  // Privzeta vsebina za dejavnost (F6.3: postavi _templateId) + objavljen snapshot.
  const content = defaultSiteContent(spec.vertical)

  await prisma.salonConfig.create({
    data: {
      organizationId: org.id,
      name: spec.name,
      email: spec.ownerEmail,
      phone: "+386 40 000 000",
      city: "Ljubljana",
      country: "SI",
      currency: "EUR",
      locale: "sl",
      timezone: "Europe/Ljubljana",
      bookingDeposit: 0,
      siteContent: content as unknown as object,
      publishedSiteContent: content as unknown as object,
      publishedContentVersion: 1,
    },
  })

  console.log(`✔ Tenanat: ${spec.name} (${profile.id}) -> /s/${org.slug}`)
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  if (rows[0].db !== "markec_f631_test") throw new Error("REFUSED: napačna baza " + rows[0].db)
  await wipe()
  for (const spec of DEJAVNOSTI) await createTenant(spec)
  console.log("F6.3.1 setup done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())