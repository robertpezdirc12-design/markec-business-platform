// ============================================================
// F5.5.3 — SEED za ločeno testno bazo markec_f553_test.
//   node scripts/f553-seed.cjs
// Varnostna zapora: zavrne, če ne kaže natanko na markec_f553_test.
// ============================================================

const { PrismaClient } = require("@prisma/client")
const { hashSync } = require("bcryptjs")

const url = process.env.DATABASE_URL || ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f553_test(\?|$)/.test(url)
if (!safe) {
  console.error("REFUSED: DATABASE_URL must point to markec_f553_test.")
  process.exit(1)
}

const prisma = new PrismaClient()
const ID = {
  orgA: "f553-org-a",
  orgB: "f553-org-b",
  adminA: "f553-admin-a",
  adminB: "f553-admin-b",
  catA: "f553-cat-a",
  svcA1: "f553-svc-a1",
  prodA1: "f553-prod-a1",
  staffA1: "f553-staff-a1",
  userClient: "f553-client-user",
}

async function clean() {
  await prisma.walkInEntry.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.project.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.document.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.order.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.customer.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.staff.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f553-" } } })
  await prisma.product.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.service.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.category.deleteMany({ where: { organizationId: { startsWith: "f553-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f553-" } } })
}

async function seed() {
  await clean()
  const password = hashSync("F553test!2026", 10)
  const now = new Date()

  await prisma.organization.createMany({
    data: [
      { id: ID.orgA, name: "Frizer Alfa F5.5.3", slug: "f553-alfa", status: "ACTIVE", publishState: "PUBLISHED", vertical: "beauty", plan: "scale", publishedAt: now },
      { id: ID.orgB, name: "Avtoservis Beta F5.5.3", slug: "f553-beta", status: "ACTIVE", publishState: "PUBLISHED", vertical: "mehanik", plan: "scale", publishedAt: now },
    ],
  })
  await prisma.user.createMany({
    data: [
      { id: ID.adminA, email: "alfa@f553.test", name: "Lastnik Alfa", role: "ADMIN", organizationId: ID.orgA, password, emailVerified: now },
      { id: ID.adminB, email: "beta@f553.test", name: "Lastnik Beta", role: "ADMIN", organizationId: ID.orgB, password, emailVerified: now },
      { id: ID.userClient, email: "stranka@f553.test", name: "Karla Stranka", role: "CLIENTE", password, emailVerified: now },
    ],
  })
  await prisma.organizationMember.createMany({
    data: [
      { id: "f553-member-a", organizationId: ID.orgA, userId: ID.adminA, role: "ADMIN", isDefault: true },
      { id: "f553-member-b", organizationId: ID.orgB, userId: ID.adminB, role: "ADMIN", isDefault: true },
    ],
  })
  await prisma.category.createMany({
    data: [{ id: ID.catA, name: "Striženje", slug: "f553-strizenje", organizationId: ID.orgA }],
  })
  await prisma.service.createMany({
    data: [{ id: ID.svcA1, name: "Žensko striženje", slug: "f553-zensko", duration: 45, price: 25, organizationId: ID.orgA, categoryId: ID.catA, isActive: true }],
  })
  await prisma.product.createMany({
    data: [{ id: ID.prodA1, name: "Šampon", price: 12, sku: "F553-P1", organizationId: ID.orgA, forSale: true }],
  })
  await prisma.staff.createMany({
    data: [{ id: ID.staffA1, name: "Osebje 1", organizationId: ID.orgA, userId: ID.adminA, isActive: true }],
  })

  console.log("Seeded", ID.orgA, "+", ID.orgB)
  await prisma.$disconnect()
}

seed().catch((e) => { console.error(e); process.exit(1) })