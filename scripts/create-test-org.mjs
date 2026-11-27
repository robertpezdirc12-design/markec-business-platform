/**
 * Create the test salon directly via Prisma CLI (bypasses broken React UI on /start)
 * Run once; idempotent.
 */
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const slug = "salon-lina-frizer"
  const existing = await prisma.organization.findUnique({ where: { slug } })
  if (existing) {
    console.log(`[SKIP] Organization "${slug}" already exists`)
    return
  }

  const org = await prisma.organization.create({
    data: {
      name: "Frizerski salon Lina",
      slug: slug,
      description: "Sveto in profesionalno frizersko poslovanje z individualnim pristopom.",
      ownerEmail: "lina.frizerka@markectest.si",
      ownerName: "Lina Kovač",
      status: "ACTIVE",
      vertical: { id: "frizer" },
    },
  })

  console.log(`[OK] Created organization "${slug}" (id: ${org.id})`)

  // Default contact info
  await prisma.contact.updateOrCreate({
    where: { orgId_slug_unique: { orgId: org.id, slug } },
    create: {
      orgId: org.id,
      type: "phone",
      phone: "+38641555321",
      label: "Telefon",
    },
  })

  // Default email contact
  await prisma.contact.updateOrCreate({
    where: { orgId_slug_unique: { orgId: org.id, slug } },
    create: {
      orgId: org.id,
      type: "email",
      phone: "lina@frizerskillsiona.si",
      label: "E-poška",
    },
  })

  // Add default staff (the "owner")
  await prisma.staff.create({
    data: {
      orgId: org.id,
      name: "Lina Kovač",
      phone: "+38641555321",
      vertical: "frizer",
      role: "owner",
      avatar: null,
    },
  })

  // Add some default services
  const services = [
    { name: "Striženje", duration: 30, price: 2800 },
    { name: "Barvanje", duration: 45, price: 5500 },
    { name: "Styling", duration: 20, price: 2000 },
    { name: "Nega las", duration: 30, price: 2200 },
    { name: "Keratin", duration: 60, price: 9900 },
    { name: "Makra", duration: 15, price: 1400 },
  ]
  for (const s of services) {
    await prisma.service.create({
      data: { name: s.name, duration: s.duration, price: s.price, orgId: org.id },
    })
  }

  // Add a couple of sample products
  const products = [
    { name: "Šampon za sijočost", category: "Kemija", price: 8.90, description: "Dobro narežani šamponi za sijočnost in barvanje." },
    { name: "Keratin maska", category: "Nega", price: 14.90, description: "Glaznost in hodi iz 10 minut." },
    { name: "Hranilno olje", category: "Nega", price: 6.50, description: "Hranilno olje za prepišne lasi." },
  ]
  for (const p of products) {
    await prisma.product.create({
      data: { name: p.name, category: p.category, price: p.price, description: p.description, orgId: org.id },
    })
  }

  await prisma.$disconnect()
  console.log("Done. Open https://rcbeautysalon-phi.vercel.app/s/salon-lina-frizer to test.")
}

main().catch(e => { console.error(e); process.exit(1) })