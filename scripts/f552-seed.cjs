// ============================================================
// F5.5.2 — SEED za ločeno testno bazo markec_f552_test.
//   node scripts/f552-seed.cjs
// Varnostna zapora: zavrne, če DATABASE_URL ne kaže natanko na
// markec_f552_test. Idempotentno (počisti lastne f552-* pred ponovnim).
// ============================================================

const { PrismaClient } = require("@prisma/client")
const { hashSync } = require("bcryptjs")

const url = process.env.DATABASE_URL || ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f552_test(\?|$)/.test(url)
if (!safe) {
  console.error("REFUSED: DATABASE_URL must point to markec_f552_test.")
  process.exit(1)
}

const prisma = new PrismaClient()

const ID = {
  org: "f552-org",
  admin: "f552-user-admin",
  member: "f552-member-admin",
  config: "f552-config",
  cat: "f552-cat",
  svc: "f552-svc",
  prod: "f552-prod",
  configNew: "f552-config-new",
}

async function clean() {
  await prisma.faqItem.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.galleryItem.deleteMany({ where: { gallery: { organizationId: { startsWith: "f552-" } } } })
  await prisma.gallery.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.organizationMember.deleteMany({ where: { userId: { startsWith: "f552-" } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f552-" } } })
  await prisma.service.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.product.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.category.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { startsWith: "f552-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f552-" } } })
}

async function seed() {
  await clean()
  const password = hashSync("F552test!2026", 10)
  const now = new Date()

  await prisma.organization.create({
    data: {
      id: ID.org,
      slug: "f552-salon",
      name: "Salon F5.5.2",
      status: "ACTIVE",
      publishState: "UNPUBLISHED",
      vertical: "beauty",
      plan: "scale",
    },
  })

  await prisma.user.create({
    data: {
      id: ID.admin,
      email: "lastnik@f552.test",
      name: "Lastnik F5.5.2",
      role: "ADMIN",
      organizationId: ID.org,
      password,
      emailVerified: now,
    },
  })

  await prisma.organizationMember.create({
    data: { id: ID.member, organizationId: ID.org, userId: ID.admin, role: "ADMIN", isDefault: true },
  })

  await prisma.salonConfig.create({
    data: { id: ID.config, organizationId: ID.org, timezone: "Europe/Ljubljana" },
  })

  await prisma.category.create({
    data: { id: ID.cat, name: "Striženje", slug: "f552-strizenje", organizationId: ID.org },
  })

  await prisma.service.create({
    data: {
      id: ID.svc,
      name: "Žensko striženje",
      slug: "f552-zensko-strizenje",
      duration: 45,
      price: 25,
      organizationId: ID.org,
      categoryId: ID.cat,
      isActive: true,
    },
  })

  await prisma.product.create({
    data: {
      id: ID.prod,
      name: "Šampon Aloe",
      sku: "F552-P1",
      price: 12,
      organizationId: ID.org,
      categoryId: ID.cat,
      forSale: true,
    },
  })

  // Druga org za test izolacije (naj ne vidi dokumentov A).
  await prisma.organization.create({
    data: {
      id: "f552-org-b",
      slug: "f552-salon-b",
      name: "Konkurenca B",
      status: "ACTIVE",
      publishState: "PUBLISHED",
      vertical: "hair",
      plan: "scale",
      publishedAt: now,
    },
  })

  console.log("Seeded markec_f552_test:", ID.org)
  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})