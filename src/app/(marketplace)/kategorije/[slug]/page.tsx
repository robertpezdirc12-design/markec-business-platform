import Link from "next/link"
import { notFound } from "next/navigation"
import { BusinessShowcase } from "@/components/marketplace/business-showcase"
import { BigStatsSection } from "@/components/marketplace/big-stats-section"
import { EnhancedFooter } from "@/components/marketplace/enhanced-footer"
import { getSnapshot, getSnapshotStats } from "@/lib/marketplace/snapshot"
import {
  MARKETPLACE_CATEGORIES,
  businessesInCategory,
  getMarketplaceCategory,
} from "@/lib/marketplace/categories"

// ============================================================
// KATEGORIJA TRŽNICE — /kategorije/<slug>
//
// Audit 2026-11-18: noga tržnice je ves čas kazala na to pot, strani pa
// ni bilo → 404 za obiskovalca. Podatki pridejo iz statičnega snapshot-a
// (brez DB poizvedbe), enako kot /podjetja, zato Cloudflare zdrži.
// ============================================================

export const dynamic = "force-dynamic"

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params
  const category = getMarketplaceCategory(slug)
  if (!category) return { title: "Kategorija ne obstaja | MARKEC" }
  return {
    title: `${category.label} | MARKEC`,
    description: `${category.description} Preglejte podjetja v kategoriji ${category.label} na MARKEC.`,
  }
}

export default async function MarketplaceCategoryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const category = getMarketplaceCategory(slug)
  if (!category) notFound()

  const sp = (await searchParams) ?? {}
  const rawCity = Array.isArray(sp.mesto) ? sp.mesto[0] : sp.mesto
  const city = (rawCity ?? "").trim()

  const snapshot = getSnapshot()
  const stats = getSnapshotStats()
  const inCategory = businessesInCategory(snapshot.businesses, category)
  // Mesto je neobvezen filter (povezave iz "Kategorija v mestu").
  const businesses = city
    ? inCategory.filter((b) => b.city.toLocaleLowerCase("sl").includes(city.toLocaleLowerCase("sl")))
    : inCategory

  return (
    <div className="min-h-screen">
      <section className="border-border/40 bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <nav aria-label="Drobna pot" className="text-muted-foreground mb-4 text-sm">
            <Link href="/podjetja" className="hover:text-foreground underline">
              Vsa podjetja
            </Link>{" "}
            / <span className="text-foreground">{category.label}</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden="true" className="mr-2">
              {category.icon}
            </span>
            {category.label}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">{category.description}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {city
              ? `${businesses.length} podjetij · ${city}`
              : businesses.length === 1
                ? "1 podjetje v tej kategoriji"
                : `${businesses.length} podjetij v tej kategoriji`}
          </p>
        </div>
      </section>

      {businesses.length > 0 ? (
        <BusinessShowcase recommendedBusinesses={businesses} isSearchResults />
      ) : (
        <section className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-medium">
            {city
              ? `V kategoriji ${category.label} v kraju ${city} še ni objavljenih podjetij.`
              : "V tej kategoriji še ni objavljenih podjetij."}
          </p>
          <p className="text-muted-foreground mt-2">
            Ko se podjetje v tej dejavnosti objavi, se pojavi tukaj samodejno.
          </p>
          <Link href="/podjetja" className="text-primary-text mt-6 inline-block underline">
            Razišči vsa podjetja →
          </Link>
        </section>
      )}

      {/* Druge kategorije — resnični seznam, brez izmišljenih števcev. */}
      <section className="border-border/40 bg-muted/20 border-t py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-5 text-xl font-semibold">Druge kategorije</h2>
          <div className="flex flex-wrap gap-3">
            {MARKETPLACE_CATEGORIES.filter((c) => c.slug !== category.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/kategorije/${c.slug}`}
                className="bg-background hover:border-primary hover:bg-primary/5 flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all"
              >
                <span aria-hidden="true">{c.icon}</span>
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
