// ============================================================
// STATIC MARKETPLACE SNAPSHOT — client-safe in-memory filtering.
//
// Podatki so generirani ob buildu (scripts/generate-marketplace-snapshot.mjs)
// in uvoženi kot navaden JSON. Ni Prisma, ni DB povezave, ni fetch-a ob
// zahtevku — zato Cloudflare Workers Free (10 ms CPU) zdrži.
// ============================================================

import snapshot from "@/data/marketplace-snapshot.json"

export interface SnapshotBusiness {
  id: string
  name: string
  type: string
  address: string
  rating: number
  reviews: number
  /** Logotip podjetja; null = slike še ni naložilo. */
  image: string | null
  isOpen?: boolean
  openUntil?: string
  priceRange?: string
  slug: string
  category: string
  city: string
  services?: string[]
  phone?: string
  email?: string
}

export interface SnapshotStats {
  totalBusinesses: number
  totalAppointments: number
  totalCustomers: number
  citiesCount: number
  averageRating: number
}

export interface MarketplaceSnapshot {
  generatedAt: string | null
  businesses: SnapshotBusiness[]
  stats: SnapshotStats
}

const data = snapshot as MarketplaceSnapshot

export function getSnapshot(): MarketplaceSnapshot {
  return data
}

export function getSnapshotStats(): SnapshotStats {
  return data.stats
}

/** Filtrira podjetja v spominu — enakovredno prejšnji DB poizvedbi. */
export function filterBusinesses(
  businesses: SnapshotBusiness[],
  query: string,
  location: string
): SnapshotBusiness[] {
  const q = query.trim().toLocaleLowerCase("sl")
  const loc = location.trim().toLocaleLowerCase("sl")

  return businesses.filter((b) => {
    if (q) {
      const haystack = [
        b.name,
        b.type,
        b.category,
        b.city,
        ...(b.services ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("sl")
      if (!haystack.includes(q)) return false
    }
    if (loc && !b.city.toLocaleLowerCase("sl").includes(loc)) return false
    return true
  })
}

/**
 * Razdeli podjetja v tri kategorije za prikaz brez iskanja — brez DB.
 */
export function getShowcase(businesses: SnapshotBusiness[]) {
  // Audit 2026-11-17 (dve napaki hkrati):
  //  1. Vsaka kategorija je vzela prvih 6 iz SVOJEGA vrstnega reda — pri
  //     majhnem katalogu so bile to ISTE kartice trikrat (18 kartic za 6
  //     podjetij).
  //  2. "Priporočeno"/"Priljubljeno" sta vsebovali tudi podjetja z 0 mnenj,
  //     čeprav podnaslov obeta ocene.
  // Zdaj: priporočena/priljubljena so SAMO podjetja z dejanskimi mnenji,
  // vsako podjetje dobi natanko eno mesto, ostala (brez mnenj) so "Novo".
  const withReviews = businesses.filter((b) => b.reviews > 0)

  // Kadar je ocenjenih podjetij malo, "Priporočeno" ne sme pojesti vseh,
  // sicer "Priljubljeno" ostane prazno — zato približno pol/pol (največ 6).
  const recommendedLimit = Math.min(
    6,
    Math.max(1, Math.ceil(withReviews.length / 2))
  )
  const recommended = [...withReviews]
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, recommendedLimit)
  const recommendedIds = new Set(recommended.map((b) => b.id))

  const popular = withReviews
    .filter((b) => !recommendedIds.has(b.id))
    .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
    .slice(0, 6)
  const popularIds = new Set(popular.map((b) => b.id))

  // "Novo" — v vrstnem redu createdAt desc iz generatorja (novi najprej).
  const fresh = businesses
    .filter((b) => !recommendedIds.has(b.id) && !popularIds.has(b.id))
    .slice(0, 6)

  return { recommended, popular, new: fresh }
}

/** Človeku berljiv datum generiranja snapshot-a (za pošteno oznako). */
export function snapshotAgeLabel(): string {
  if (!data.generatedAt) return "Podatki trenutno niso na voljo"
  const date = new Date(data.generatedAt)
  if (Number.isNaN(date.getTime())) return "Podatki trenutno niso na voljo"
  return `Podatki posodobljeni ${date.toLocaleString("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`
}
