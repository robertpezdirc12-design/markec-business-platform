// ============================================================
// E2E GLOBAL SETUP (EPIC #3 E3-8)
// Turbopack dev compiles each route on first hit — a fresh run
// can spend minutes compiling the dashboard surface DURING a
// test, blowing test timeouts. Warm the key routes up front
// (auth-gated routes still compile on request) so specs run
// against warm pages.
//
// P9 (audit 2026-11): poleg greljnja skrbi tudi za f631 fixture
// organizacije/uporabnike (fr@f631.test, cb@f631.test), ki jih
// pričakujejo e2e spec-i (visual-editor). V itest okolju jih
// ustvarja tests/integration/itest-global-setup.ts; tukaj morajo
// obstajati tudi za Playwright.
// ============================================================

import { FullConfig } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const F631_FIXTURES = [
  {
    slug: "frizer-test",
    name: "Frizerski salon Test",
    vertical: "frizer",
    ownerName: "Ana Frizerka",
    ownerEmail: "fr@f631.test",
  },
  {
    slug: "cebelar-test",
    name: "Čebelarstvo Test",
    vertical: "beekeeping",
    ownerName: "Tone Čebelar",
    ownerEmail: "cb@f631.test",
  },
] as const

const F631_PASSWORD = "itest-fixture-password"
// f631 uporabniki polagajo hash (bcrypt) — authorize uporablja compare.
// P9: prejšnje različice so shranjevale besedilo (Invalid credentials).
const F631_PASSWORD_HASH = bcrypt.hashSync(F631_PASSWORD, 10)

async function warm(baseUrl: string, paths: string[]): Promise<void> {
  for (const p of paths) {
    await fetch(`${baseUrl}${p}`, { redirect: "follow" }).catch(() => {})
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  // f631 fixtureji (idempotentni upsert) — potrebni za visual-editor.
  try {
    for (const spec of F631_FIXTURES) {
      const org = await prisma.organization.upsert({
        where: { slug: spec.slug },
        create: {
          slug: spec.slug,
          name: spec.name,
          vertical: spec.vertical,
          status: "ACTIVE",
          publishState: "PUBLISHED",
        },
        update: {},
      })

      await prisma.user.upsert({
        where: { email: spec.ownerEmail },
        create: {
          name: spec.ownerName,
          email: spec.ownerEmail,
          password: F631_PASSWORD_HASH,
          role: "ADMIN",
          emailVerified: new Date(),
          organizationId: org.id,
        },
        // Popravi tudi obstoječe vrstice s starim (besedilnim) geslom.
        update: { password: F631_PASSWORD_HASH, emailVerified: new Date() },
      })

      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: org.id, userId: (await prisma.user.findUniqueOrThrow({ where: { email: spec.ownerEmail } })).id },
        },
        create: {
          organizationId: org.id,
          userId: (await prisma.user.findUniqueOrThrow({ where: { email: spec.ownerEmail } })).id,
          role: "ADMIN",
          isDefault: true,
        },
        update: {},
      })

      await prisma.staff.upsert({
        where: {
          userId_organizationId: {
            userId: (await prisma.user.findUniqueOrThrow({ where: { email: spec.ownerEmail } })).id,
            organizationId: org.id,
          },
        },
        create: {
          name: spec.ownerName,
          email: spec.ownerEmail,
          isActive: true,
          userId: (await prisma.user.findUniqueOrThrow({ where: { email: spec.ownerEmail } })).id,
          organizationId: org.id,
        },
        update: {},
      })
    }
  } catch (e) {
    // Fixture napaka ne sme ustaviti greljnja/testov (best-effort),
    // a logiraj — pomaga pri diagnostiki.
    console.error("[e2e global-setup] f631 fixtures failed:", e)
  }

  // Public + auth surfaces first (compile-heavy), then dashboard/admin
  // surfaces (redirect to /login when unauthenticated — still compiles).
  await warm(baseUrl, [
    "/",
    "/login",
    "/start",
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/services",
    "/dashboard/services/new",
    "/dashboard/products",
    "/dashboard/appointments",
    "/dashboard/forms",
    "/dashboard/work-orders",
    "/platform",
  ])

  await prisma.$disconnect()
}
