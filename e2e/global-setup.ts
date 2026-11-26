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

  // S5 (visual-editor): frizer-test needs a PUBLISHED gallery + FAQ so the
  // public page renders `#galerija` / `#pogosta-vprasanja`. Idempotent —
  // create only when absent (re-runs against a persistent DB stay clean).
  // cebelar-test is intentionally left gallery/FAQ-free: S1b asserts that
  // the beekeeper page shows ZERO of these (tenant isolation).
  try {
    const frizer = await prisma.organization.findUnique({
      where: { slug: "frizer-test" },
    })
    if (frizer) {
      const hasGallery = await prisma.gallery.count({
        where: { organizationId: frizer.id, isPublic: true, isPublished: true },
      })
      if (hasGallery === 0) {
        const g = await prisma.gallery.create({
          data: {
            organizationId: frizer.id,
            title: "Galerija frizerskih del",
            isPublic: true,
            isPublished: true,
          },
        })
        await prisma.galleryItem.create({
          data: {
            galleryId: g.id,
            // 1px data-URI placeholder — the section renders even if the
            // <img> is empty; S5 asserts the section is visible, not the
            // image bytes.
            mediaId: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAEcAJFAKVzrwIAAAABklEQVR4nGNgYGBgAAAACQAB6sHUTwAAAABJRU5ErkJggg==",
            caption: "E2E galerija",
            position: 0,
            isPublished: true,
          },
        })
      }
      const hasFaq = await prisma.faqItem.count({
        where: { organizationId: frizer.id, isPublic: true, isPublished: true },
      })
      if (hasFaq === 0) {
        await prisma.faqItem.create({
          data: {
            organizationId: frizer.id,
            question: "Kje lahko rezerviram termin?",
            answer: "Poziv v gumb Rezerviraj na zgornjem delu strani.",
            isPublic: true,
            isPublished: true,
            position: 0,
          },
        })
      }
    }
  } catch (e) {
    console.error("[e2e global-setup] frizer gallery/faq seed failed:", e)
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
