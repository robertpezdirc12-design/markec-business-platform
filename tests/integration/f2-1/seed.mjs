// ============================================================
// F2.1 — SEED ZA LOČENO TESTNO BAZO (nikoli produkcijsko)
//
//   node tests/integration/f2-1/seed.mjs
//
// Varnostna zapora: skripta zavrne delo, če DATABASE_URL ne kaže
// natanko na `markec_f21_test`. S tem je onemogočeno, da bi kdorkoli
// nehote seedal `markec_dev`, `beauty_salon` ali produkcijsko bazo.
//
// Idempotentno: vse vrstice imajo fiksne `f21-*` ID-je, zato se
// ponovni zagon najprej počisti samo lastne podatke (deleteMany z
// `id startsWith "f21-"`), tuji podatki ostanejo nedotaknjeni.
// ============================================================

import { PrismaClient } from "@prisma/client"
import { hashSync } from "bcryptjs"

const url = process.env.DATABASE_URL ?? ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f21_test(\?|$)/.test(url)
if (!safe) {
  console.error(
    "REFUSED: DATABASE_URL must point to the dedicated test database " +
      "markec_f21_test. Got: " +
      (url.replace(/\/\/[^@]*@/, "//***@") || "(unset)")
  )
  process.exit(1)
}

export const TEST_PASSWORD = "F21test!2026"
const password = hashSync(TEST_PASSWORD, 10)
const now = new Date()

const prisma = new PrismaClient()

const ID = {
  orgA: "f21-org-a",
  orgB: "f21-org-b",
  orgC: "f21-org-c",
  orgD: "f21-org-draft",
  orgS: "f21-org-suspended",
  admin: "f21-user-admin",
  staff: "f21-user-staff",
  cliente: "f21-user-cliente",
  otherAdmin: "f21-user-other-admin",
  legacy: "f21-user-legacy",
  suspendedOnly: "f21-user-suspended-only",
  clientA: "f21-user-client-a",
  clientB: "f21-user-client-b",
  roleA: "f21-custom-role-a",
  roleB: "f21-custom-role-b",
}

async function clean() {
  // Children first (FK-safe), only rows created by this seed.
  await prisma.organizationMember.deleteMany({
    where: { userId: { startsWith: "f21-" } },
  })
  await prisma.customer.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.staff.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.service.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.product.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.customRole.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: "f21-" } } })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "f21-" } } })
}

async function seed() {
  await clean()

  // ---- Organizations -------------------------------------------------
  // orgB has a deliberately long, realistic Slovenian company name for
  // the 390/768/1440 px visual regression (F1 measured 534px overflow).
  await prisma.organization.createMany({
    data: [
      {
        id: ID.orgA,
        slug: "f21-alpha",
        name: "Frizerski salon Alfa — F2.1 (A)",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "beauty",
        plan: "scale",
      },
      {
        id: ID.orgB,
        slug: "f21-beta",
        name:
          "Vulkanizer & avtoservis Murn d.o.o. — poslovna enota Ljubljana Bežigrad (B)",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "tire-service",
        plan: "scale",
      },
      {
        id: ID.orgC,
        slug: "f21-gamma",
        name: "Gamma d.o.o. — tuje podjetje (ni članstva)",
        status: "ACTIVE",
        publishState: "PUBLISHED",
        vertical: "beauty",
        plan: "scale",
      },
      {
        id: ID.orgD,
        slug: "f21-draft",
        name: "Neobjavljeni osnutek (DRAFT, nobeno članstvo)",
        status: "ACTIVE",
        publishState: "DRAFT",
        vertical: "beauty",
        plan: "scale",
      },
      {
        id: ID.orgS,
        slug: "f21-suspended",
        name: "Začasno ustavljeni salon (SUSPENDED)",
        status: "SUSPENDED",
        publishState: "PUBLISHED",
        vertical: "beauty",
        plan: "scale",
      },
    ],
  })

  // ---- Custom roles (org-scoped, per-org permission sets) ------------
  await prisma.customRole.createMany({
    data: [
      {
        id: ID.roleA,
        organizationId: ID.orgA,
        name: "Sprejem (A)",
        permissions: [
          "appointments.view",
          "appointments.manage",
          "customers.manage",
        ],
      },
      {
        id: ID.roleB,
        organizationId: ID.orgB,
        name: "Vodja trgovine (B)",
        permissions: ["products.manage", "orders.manage", "analytics.view"],
      },
    ],
  })

  // ---- Users ---------------------------------------------------------
  const user = (id, email, name, role, organizationId = null) => ({
    id,
    email,
    name,
    role,
    organizationId,
    password,
    emailVerified: now,
  })
  await prisma.user.createMany({
    data: [
      user(ID.admin, "admin@f21.test", "Alfa & Beta lastnik", "ADMIN", ID.orgA),
      user(ID.staff, "staff@f21.test", "Zaposleni v dveh vlogah", "STAFF", ID.orgA),
      user(ID.cliente, "cliente@f21.test", "Stranka brez delovnega prostora", "CLIENTE"),
      user(ID.otherAdmin, "other@f21.test", "Lastnik Game", "ADMIN", ID.orgC),
      // Pre-backfill ADMIN: zero memberships AND no legacy orgId. Under the
      // old resolver this account fell back to the FIRST ACTIVE tenant.
      user(ID.legacy, "legacy@f21.test", "Legacy admin brez članstev", "ADMIN"),
      // Membership exists, but only in a SUSPENDED tenant.
      user(ID.suspendedOnly, "suspended@f21.test", "Admin ustavljenega salona", "ADMIN"),
      user(ID.clientA, "aclient@f21.test", "Stranka A", "CLIENTE", ID.orgA),
      user(ID.clientB, "bclient@f21.test", "Stranka B", "CLIENTE", ID.orgB),
    ],
  })

  // ---- Memberships ---------------------------------------------------
  await prisma.organizationMember.createMany({
    data: [
      // ADMIN: two organizations, A is the default workspace.
      {
        id: "f21-member-admin-a",
        organizationId: ID.orgA,
        userId: ID.admin,
        role: "ADMIN",
        isDefault: true,
      },
      {
        id: "f21-member-admin-b",
        organizationId: ID.orgB,
        userId: ID.admin,
        role: "ADMIN",
        isDefault: false,
      },
      // STAFF: two organizations with DIFFERENT roles AND permissions.
      {
        id: "f21-member-staff-a",
        organizationId: ID.orgA,
        userId: ID.staff,
        role: "STAFF",
        customRoleId: ID.roleA,
        isDefault: true,
      },
      {
        id: "f21-member-staff-b",
        organizationId: ID.orgB,
        userId: ID.staff,
        role: "ADMIN",
        customRoleId: ID.roleB,
        isDefault: false,
      },
      // Foreign org's own admin (isolation target).
      {
        id: "f21-member-other-c",
        organizationId: ID.orgC,
        userId: ID.otherAdmin,
        role: "ADMIN",
        isDefault: true,
      },
      // Only a SUSPENDED membership -> must resolve to null (fail-closed).
      {
        id: "f21-member-suspended",
        organizationId: ID.orgS,
        userId: ID.suspendedOnly,
        role: "ADMIN",
        isDefault: true,
      },
    ],
  })

  // ---- Customer / Service / Product data in A, B and C ---------------
  await prisma.customer.createMany({
    data: [
      { id: "f21-customer-a", name: "Stranka A", organizationId: ID.orgA, userId: ID.clientA },
      { id: "f21-customer-b", name: "Stranka B", organizationId: ID.orgB, userId: ID.clientB },
      { id: "f21-customer-c", name: "Stranka C (tuja)", organizationId: ID.orgC },
    ],
  })
  await prisma.service.createMany({
    data: [
      { id: "f21-service-a", name: "Storitev A", slug: "f21-storitev-a", duration: 30, price: 10, organizationId: ID.orgA },
      { id: "f21-service-b", name: "Storitev B", slug: "f21-storitev-b", duration: 60, price: 20, organizationId: ID.orgB },
    ],
  })
  await prisma.product.createMany({
    data: [
      { id: "f21-product-a", name: "Izdelek A", price: 5, sku: "F21-A", organizationId: ID.orgA },
      { id: "f21-product-b", name: "Izdelek B", price: 7, sku: "F21-B", organizationId: ID.orgB },
    ],
  })

  // ---- SalonConfig (dashboard reads it; keeps the real flow clean) ---
  await prisma.salonConfig.createMany({
    data: [
      { id: "f21-config-a", organizationId: ID.orgA, timezone: "Europe/Ljubljana" },
      { id: "f21-config-b", organizationId: ID.orgB, timezone: "Europe/Ljubljana" },
      { id: "f21-config-c", organizationId: ID.orgC, timezone: "Europe/Ljubljana" },
    ],
  })
}

try {
  const db = await prisma.$queryRawUnsafe("select current_database() as db")
  console.log("Seed target:", JSON.stringify(db))
  await seed()
  const counts = {
    organizations: await prisma.organization.count({ where: { id: { startsWith: "f21-" } } }),
    users: await prisma.user.count({ where: { id: { startsWith: "f21-" } } }),
    memberships: await prisma.organizationMember.count({ where: { id: { startsWith: "f21-" } } }),
    customers: await prisma.customer.count({ where: { id: { startsWith: "f21-" } } }),
    services: await prisma.service.count({ where: { id: { startsWith: "f21-" } } }),
    products: await prisma.product.count({ where: { id: { startsWith: "f21-" } } }),
    customRoles: await prisma.customRole.count({ where: { id: { startsWith: "f21-" } } }),
  }
  console.log("Seeded:", JSON.stringify(counts))
  console.log("Shared test password:", TEST_PASSWORD)
} finally {
  await prisma.$disconnect()
}
