#!/usr/bin/env node
/**
 * MARKETPLACE BUILD-TIME SNAPSHOT
 *
 * Cloudflare Workers Free ima 10 ms CPU limit na zahtevek. Pet vzporednih
 * Prisma/Neon poizvedb na /podjetja ta prag prebije (error 1101/1102).
 *
 * Rešitev: podatke za javno tržnico pridobimo ENKRAT ob buildu v GitHub
 * Actionsu (kjer je DATABASE_URL na voljo in ni CPU limita) in jih
 * zapišemo v statičen JSON. /podjetja potem filtrira ta JSON v spominu
 * brez nobene DB povezave ob zahtevku.
 *
 * Generiranje je varno:
 *  - če DATABASE_URL ni nastavljen → napiše prazen snapshot (ne pade),
 *  - če baza ni dosegljiva → napiše prazen snapshot (ne pade),
 *  - vedno zapiše generatedAt, da UI lahko pošteno pokaže starost podatkov.
 *
 * Pokliče ga scripts/build-smart.mjs pred skritjem .env datotek.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, "../src/data/marketplace-snapshot.json")

// Enako pravilo kot src/lib/tenant-flags.ts (isInternalTenantSlug):
// demo/test/qa najemniki se ne smejo pojavljati v JAVNI tržnici —
// isti filter že varuje sitemap.xml in robots.txt za /s/<slug>. Generator
// snapshot-a ga je do zdaj spregledal, zato so QA/Test podjetja
// (npr. "QA Meh Mehanik", "Atelje Test Šivilja QA") končala v /podjetja.
// Ujame predpono ("demo-", "test-", "qa-") in notranji segment ("-test-").
const INTERNAL_TENANT_SLUG = /^(demo|test|qa)[-]|[-](demo|test|qa)[-]/i
function isInternalTenantSlug(slug) {
  return !!(slug && INTERNAL_TENANT_SLUG.test(slug))
}

const EMPTY = {
  generatedAt: null,
  businesses: [],
  stats: {
    totalBusinesses: 0,
    totalAppointments: 0,
    totalCustomers: 0,
    citiesCount: 0,
    averageRating: 0,
  },
}

function writeSnapshot(data) {
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + "\n", "utf8")
  console.log(
    `[snapshot] written to ${OUTPUT} (${data.businesses.length} businesses, ` +
      `generatedAt=${data.generatedAt})`
  )
}

function createClient(databaseUrl) {
  if (databaseUrl.includes("neon")) {
    neonConfig.fetchConnectionCache = true
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) })
  }
  return new PrismaClient()
}

/** Tedenski delovni čas iz objavljene vsebine (fallback: osnutek). */
function readOpeningHours(salonConfig) {
  if (!salonConfig) return []
  const source = salonConfig.publishedSiteContent ?? salonConfig.siteContent
  if (!source || typeof source !== "object") return []
  const hours = source.openingHours
  if (!Array.isArray(hours)) return []
  return hours
    .filter(
      (h) =>
        h &&
        typeof h.day === "number" &&
        typeof h.open === "string" &&
        typeof h.close === "string"
    )
    .map((h) => ({ day: h.day, open: h.open, close: h.close }))
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.log("[snapshot] DATABASE_URL ni nastavljen — pišem prazen snapshot.")
    writeSnapshot(EMPTY)
    return
  }

  let prisma
  try {
    prisma = createClient(databaseUrl)
    // Preverimo povezljivost z najcenejšo poizvedbo.
    await prisma.organization.count()
  } catch (error) {
    console.warn(
      "[snapshot] baza ni dosegljiva — pišem prazen snapshot:",
      error instanceof Error ? error.message : String(error)
    )
    writeSnapshot(EMPTY)
    return
  }

  try {
    const organizations = await prisma.organization.findMany({
      // JAVNO prikažemo izključno PUBLISHED podjetja. Prej smo vzeli vse
      // ACTIVE — toda javni /s/{slug} se odpre le PUBLISHED (glej
      // headerOrgAccessible in tenant.ts): ob kliku smo dobili 404.
      // Poleg tega spodaj v JS izpustimo demo/test/qa najemnike.
      where: { status: "ACTIVE", publishState: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        salonConfig: {
          select: {
            city: true,
            email: true,
            phone: true,
            siteContent: true,
            publishedSiteContent: true,
          },
        },
        services: {
          where: { isActive: true },
          take: 3,
          orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
          select: { name: true, duration: true, price: true },
        },
        reviews: { where: { isActive: true }, select: { rating: true } },
        _count: { select: { reviews: { where: { isActive: true } } } },
      },
    })

    // Notranje (demo/test/qa) najemnike izpustimo iz javne tržnice —
    // isti filter kot sitemap/robots (isInternalTenantSlug) PLUS testne
    // poštne domene. Slug regex ne zajame vseh oblik
    // (npr. "vizualna-testna-delavnica" — pridevnik "testna"), pa tudi
    // testni najemniki ne uporabljajo vedno @markec-test.si — "Vizualna
    // Testna Delavnica" ima @example.com (RFC 2606 testna domena).
    // Filter na domene je varen: prava podjetja nimajo @markec-test.si
    // niti @example.com.
    const publicOrganizations = organizations.filter(
      (org) =>
        !isInternalTenantSlug(org.slug) &&
        !/@(?:markec-test\.si|example\.(?:com|org|net))$/i.test(org.salonConfig?.email ?? "")
    )

    const businesses = publicOrganizations.map((org) => {
      const avgRating =
        org.reviews.length > 0
          ? org.reviews.reduce((sum, r) => sum + r.rating, 0) / org.reviews.length
          : 0
      return {
        id: org.id,
        name: org.name,
        type: org.vertical || "Storitev",
        address: org.salonConfig?.city || "Slovenija",
        rating: Math.round(avgRating * 10) / 10,
        reviews: org._count.reviews,
        // Brez logotipa ostane `null` — nadomestno sliko po dejavnosti
        // izbere prikaz (verticalCardImage v src/lib/marketplace/snapshot.ts).
        // Prej je vsako podjetje dobilo ISTO splošno sliko, ki ni obstajala.
        image: org.logo || null,
        // isOpen/openUntil/priceRange sta bila VEDNO "true"/"20:00"/"€€" za
        // vsa podjetja — izmišljeni podatki. Odstranjeno; kartica ju izpiše
        // le, ko ju ima (in ko ju bo snapshot znal res izračunati).
        slug: org.slug,
        category: org.vertical || "splošno",
        city: org.salonConfig?.city || "Slovenija",
        services: org.services.map((s) => s.name),
        // Audit 2026-11-18: kartica na tržnici mora pokazati KAJ podjetje
        // dela (ime + trajanje + cena), ne le imena podjetja — tako kot
        // Fresha prikazuje tri storitve z "View N matching services".
        serviceItems: org.services.map((s) => ({
          name: s.name,
          minutes: s.duration ?? null,
          price: s.price != null ? Number(s.price) : null,
        })).filter((s) => s.name),
        // Delovni čas za značko "Odprto do 19:00" (izračun na odjemalcu,
        // ker je snapshot statičen; ure so tedenski vzorec, ki ne zastara).
        hours: readOpeningHours(org.salonConfig),
        phone: org.salonConfig?.phone || undefined,
        email: org.salonConfig?.email || undefined,
      }
    })

    // totalBusinesses = število JAVNIH (PUBLISHED, ne-notranjih) podjetij —
    // štejemo že filtriran seznam, ne več Prisma count (ki bi štel tudi
    // demo/test/qa najemnike in tako "napihnil" števec nad ogledljiva).
    const totalBusinesses = publicOrganizations.length
    const [totalAppointments, totalCustomers] = await Promise.all([
      prisma.appointment.count(),
      prisma.customer.count(),
    ])

    const cities = await prisma.salonConfig.findMany({
      where: { city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    })
    const reviewAgg = await prisma.review.aggregate({
      where: { isActive: true },
      _avg: { rating: true },
    })

    writeSnapshot({
      generatedAt: new Date().toISOString(),
      businesses,
      stats: {
        totalBusinesses,
        totalAppointments,
        totalCustomers,
        citiesCount: cities.length,
        averageRating: Math.round((reviewAgg._avg.rating || 0) * 10) / 10,
      },
    })
  } catch (error) {
    console.error(
      "[snapshot] napaka pri branju podatkov — pišem prazen snapshot:",
      error instanceof Error ? error.message : String(error)
    )
    writeSnapshot(EMPTY)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  // Nikoli ne ustavimo builda zaradisnapshota — raje prazen podatek kot
  // padel deploy.
  console.error("[snapshot] nepričakovana napaka:", error)
  writeSnapshot(EMPTY)
})
