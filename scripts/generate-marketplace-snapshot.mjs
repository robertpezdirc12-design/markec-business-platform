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
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        salonConfig: { select: { city: true, email: true, phone: true } },
        services: { take: 3, select: { name: true } },
        reviews: { where: { isActive: true }, select: { rating: true } },
        _count: { select: { reviews: { where: { isActive: true } } } },
      },
    })

    const businesses = organizations.map((org) => {
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
        phone: org.salonConfig?.phone || undefined,
        email: org.salonConfig?.email || undefined,
      }
    })

    const [totalBusinesses, totalAppointments, totalCustomers] = await Promise.all([
      prisma.organization.count({ where: { status: "ACTIVE" } }),
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
