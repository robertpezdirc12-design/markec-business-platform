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
  image: string
  isOpen: boolean
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
  const byRating = [...businesses].sort(
    (a, b) => b.rating - a.rating || b.reviews - a.reviews
  )
  const byReviews = [...businesses].sort((a, b) => b.reviews - a.reviews)
  // "Novo" — snapshot je že v vrstnem redu createdAt desc iz generatorja.
  const newest = [...businesses]

  return {
    recommended: byRating.slice(0, 6),
    popular: byReviews.slice(0, 6),
    new: newest.slice(0, 6),
  }
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
