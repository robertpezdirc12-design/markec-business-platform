// ============================================================
// F5.1 — SEED ZA LOČENO TESTNO BAZO (nikoli produkcijsko)
//
//   node tests/integration/f51/seed.mjs
//
// Varnostna zapora: skripta zavrne delo, če DATABASE_URL ne kaže
// natanko na `markec_f51_test`. Idempotentno: počisti le lastne
// `f51-*` vrstice pred ponovnim zagonom.
//
// Baza se pred tem postavi s:
//   docker exec beauty-salon-db psql -U postgres -c "CREATE DATABASE markec_f51_test;"
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f51_test?schema=public&& npx prisma db push --skip-generate
// ============================================================

import { PrismaClient } from "@prisma/client"
import { hashSync } from "bcryptjs"

const url = process.env.DATABASE_URL ?? ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f51_test(\?|$)/.test(url)
if (!safe) {
  console.error(
    "REFUSED: DATABASE_URL must point to the dedicated test database " +
      "markec_f51_test. Got: " +
      (url.replace(/\/\/[^@]*@/, "//***@") || "(unset)")
  )
  process.exit(1)
}

export const TEST_PASSWORD = "F51test!2026"
const now = new Date()

const prisma = new PrismaClient()

const ID = {
  orgA: "f51-org-a",
  orgB: "f51-org-b",
  admin: "f51-user-admin",
  staffB: "f51-user-staff-b",
  euro: "EUR",

  categoryA1: "f51-cat-a1",
  categoryA2: "f51-cat-a2",
  productA1: "f51-prod-a1",
  productA2: "f51-prod-a2",
  productB1: "f51-prod-b1",
  serviceA1: "f51-svc-a1",
  serviceA2: "f51-svc-a2",

  customerA1: "f51-cust-a1",
}

async function clean() {
  await prisma.promotionRedemption.deleteMany({
    where: { organizationId: { startsWith: "f51-" } },
  })
  await prisma.promotion.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  // Orders may have auto-generated (cuid) ids — clean by tenant scope.
  await prisma.orderItem.deleteMany({
    where: { order: { organizationId: { startsWith: "f51-" } } },
  })
  await prisma.order.deleteMany({
    where: { organizationId: { startsWith: "f51-" } },
  })
  await prisma.appointment.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.appointmentService.deleteMany({
    where: { service: { organizationId: { startsWith: "f51-" } } },
  })
  await prisma.promotionRedemption.deleteMany({
    where: { organizationId: { startsWith: "f51-" } },
  })
  await prisma.organizationMember.deleteMany({
    where: { userId: { startsWith: "f51-" } },
  })
  await prisma.customer.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.service.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.product.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.category.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.staff.deleteMany({ where: { organizationId: { startsWith: "f51-" } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f51-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f51-" } } })
}

async function seed() {
  await clean()
  const password = hashSync(TEST_PASSWORD, 10)

  await prisma.organization.createMany({
    data: [
      {
        id: ID.orgA,
        slug: "f51-alfa",
        name: "Salon Alfa F5.1",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "beauty",
        plan: "scale",
        // NO stripeSecretKey → product checkout uses the OFFLINE path
        // (no Stripe HTTP calls needed in tests).
      },
      {
        id: ID.orgB,
        slug: "f51-beta",
        name: "Salon Beta F5.1",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "beauty",
        plan: "scale",
      },
    ],
  })

  await prisma.user.createMany({
    data: [
      {
        id: ID.admin,
        email: "admin@f51.test",
        name: "Lastnik Alfa",
        role: "ADMIN",
        organizationId: ID.orgA,
        password,
        emailVerified: now,
      },
      {
        id: ID.staffB,
        email: "staff@f51.test",
        name: "Osebje Beta",
        role: "ADMIN",
        organizationId: ID.orgB,
        password,
        emailVerified: now,
      },
    ],
  })

  await prisma.organizationMember.createMany({
    data: [
      {
        id: "f51-member-admin-a",
        organizationId: ID.orgA,
        userId: ID.admin,
        role: "ADMIN",
        isDefault: true,
      },
      {
        id: "f51-member-staff-b",
        organizationId: ID.orgB,
        userId: ID.staffB,
        role: "ADMIN",
        isDefault: true,
      },
    ],
  })

  // Categories + products + services in A.
  await prisma.category.createMany({
    data: [
      { id: ID.categoryA1, name: "Frizure", slug: "f51-frizure", organizationId: ID.orgA },
      { id: ID.categoryA2, name: "Nega", slug: "f51-nega", organizationId: ID.orgA },
    ],
  })
  await prisma.product.createMany({
    data: [
      { id: ID.productA1, name: "Šampon", price: 10, sku: "F51-P1", organizationId: ID.orgA, categoryId: ID.categoryA2, trackInventory: true, stockQuantity: 20, forSale: true },
      { id: ID.productA2, name: "Balzam", price: 14, sku: "F51-P2", organizationId: ID.orgA, categoryId: ID.categoryA2, trackInventory: true, stockQuantity: 20, forSale: true },
      { id: ID.productB1, name: "Tuji gel", price: 200, sku: "F51-PB", organizationId: ID.orgB, trackInventory: true, stockQuantity: 20, forSale: true },
    ],
  })
  await prisma.service.createMany({
    data: [
      { id: ID.serviceA1, name: "Sličanje", slug: "f51-svicenje", duration: 30, price: 25, organizationId: ID.orgA, categoryId: ID.categoryA1 },
      { id: ID.serviceA2, name: "Nega rok", slug: "f51-nega-rok", duration: 45, price: 40, organizationId: ID.orgA, categoryId: ID.categoryA2 },
    ],
  })

  await prisma.customer.createMany({
    data: [{ id: ID.customerA1, name: "Stranka A", organizationId: ID.orgA }],
  })

  await prisma.salonConfig.createMany({
    data: [
      { id: "f51-config-a", organizationId: ID.orgA, timezone: "Europe/Ljubljana", bookingDeposit: 20, bookingDepositType: "FIXED" },
      { id: "f51-config-b", organizationId: ID.orgB, timezone: "Europe/Ljubljana" },
    ],
  })

  // Two starter promotions for isolation tests (org-scoped).
  await prisma.promotion.createMany({
    data: [
      {
        id: "f51-promo-orga-whole",
        organizationId: ID.orgA,
        name: "Alfa 10% celotna ponudba",
        discountType: "PERCENT",
        discountValue: 10,
        scope: "WHOLE_AMOUNT",
        targetEntityIds: [],
        status: "ACTIVE",
      },
      {
        id: "f51-promo-orgb-secret",
        organizationId: ID.orgB,
        name: "Beta tajna promocija",
        discountType: "PERCENT",
        discountValue: 50,
        scope: "WHOLE_AMOUNT",
        targetEntityIds: [],
        code: "BETASECRET",
        status: "ACTIVE",
      },
    ],
  })
}

try {
  const db = await prisma.$queryRawUnsafe("select current_database() as db")
  console.log("F5.1 seed target:", JSON.stringify(db))
  if (db[0]?.db !== "markec_f51_test") {
    console.error("REFUSED: not markec_f51_test")
    process.exit(1)
  }
  await seed()
  const counts = {
    organizations: await prisma.organization.count({ where: { id: { startsWith: "f51-" } } }),
    products: await prisma.product.count({ where: { id: { startsWith: "f51-" } } }),
    services: await prisma.service.count({ where: { id: { startsWith: "f51-" } } }),
    promotions: await prisma.promotion.count({ where: { id: { startsWith: "f51-" } } }),
  }
  console.log("Seeded:", JSON.stringify(counts))
} finally {
  await prisma.$disconnect()
}