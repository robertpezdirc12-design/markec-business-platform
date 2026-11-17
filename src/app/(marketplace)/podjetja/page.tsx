import Link from "next/link"
import { HeroSection } from "@/components/marketplace/hero-section"
import { BusinessShowcase } from "@/components/marketplace/business-showcase"
import { TestimonialsSection } from "@/components/marketplace/testimonials-section"
import { BigStatsSection } from "@/components/marketplace/big-stats-section"
import { BrowseByLocation } from "@/components/marketplace/browse-by-location"
import { B2BShowcase } from "@/components/marketplace/b2b-showcase"
import { AppDownloadSection } from "@/components/marketplace/app-download-section"
import { EnhancedFooter } from "@/components/marketplace/enhanced-footer"
import {
  getSnapshot,
  getSnapshotStats,
  filterBusinesses,
  getShowcase,
  snapshotAgeLabel,
} from "@/lib/marketplace/snapshot"

// Podatki so generirani ob buildu v snapshot JSON in uvoženi kot navaden
// modul — ob zahtevku NI DB poizvedb. Stran ostane dynamic, da searchParams
// (?q=, ?location=) še vedno filtrira v spominu. Samo SSR (kot na naslovnici)
// je bistveno cenejši od 5 Prisma/Neon poizvedb, zatoWorkers Free zdrži.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "MARKEC — Rezervirajte lokalne storitve",
  description:
    "Odkrijte podjetja po panogi in kraju. Prikazujemo samo podjetja, ki so res prisotna v platformi.",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

// Marketplace category pills use human labels, while the snapshot stores
// vertical ids. Map the six public labels to a search term the filter understands.
const CATEGORY_QUERY: Record<string, string> = {
  "Frizerski saloni": "frizer",
  Kozmetika: "kozmet",
  Masaža: "masaž",
  Brivci: "briv",
  Nohti: "noht",
  Wellness: "wellness",
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const categoryParam = first(params.kategorija)
  const rawQuery = first(params.q) || categoryParam
  const query = CATEGORY_QUERY[rawQuery] ?? rawQuery
  const location = first(params.location) || first(params.mesto)
  const hasSearch = Boolean(query || location)

  // Vse iz statičnega snapshot-a — brez Prisma, brez fetch-a, brez DB.
  const snapshot = getSnapshot()
  const stats = getSnapshotStats()
  const filtered = hasSearch
    ? filterBusinesses(snapshot.businesses, query, location)
    : []
  const showcase = getShowcase(snapshot.businesses)

  return (
    <div className="min-h-screen">
      <HeroSection initialQuery={query} initialLocation={location} stats={stats} />

      <div className="border-border/40 border-b bg-muted/20 py-2">
        <div className="container mx-auto px-4 text-xs text-muted-foreground">
          {snapshotAgeLabel()}
        </div>
      </div>

      {hasSearch && (
        <div className="border-border/40 border-b bg-muted/20 py-3">
          <div className="container mx-auto px-4 text-sm text-muted-foreground">
            Rezultati za <strong className="text-foreground">{query || "vsa podjetja"}</strong>
            {location ? ` v ${location}` : ""} · {filtered.length} podjetij
            <Link href="/podjetja" className="ml-3 underline">
              Ponastavi iskanje
            </Link>
          </div>
        </div>
      )}

      <BusinessShowcase
        recommendedBusinesses={hasSearch ? filtered : showcase.recommended}
        popularBusinesses={hasSearch ? [] : showcase.popular}
        newBusinesses={hasSearch ? [] : showcase.new}
        isSearchResults={hasSearch}
      />

      {!hasSearch && (
        <>
          <TestimonialsSection />
          <B2BShowcase />
          <AppDownloadSection
            bookingsCount={stats.totalAppointments}
            businessesCount={stats.totalBusinesses}
          />
          <BrowseByLocation businesses={snapshot.businesses} />
        </>
      )}

      <BigStatsSection
        totalAppointments={stats.totalAppointments}
        totalBusinesses={stats.totalBusinesses}
        citiesCount={stats.citiesCount}
        totalCustomers={stats.totalCustomers}
      />

      <EnhancedFooter />
    </div>
  )
}
