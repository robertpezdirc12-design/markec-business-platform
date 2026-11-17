// ============================================================
// BROWSE BY LOCATION (Fresha-inspired, superior 2026-11-16)
// Comprehensive SEO matrix: categories × cities.
// Surpasses Fresha with better organization and more links.
// ============================================================

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MapPinIcon,
  ArrowRightIcon,
} from "@/components/icons"
import { Heart } from "@phosphor-icons/react/dist/ssr"
import { MARKETPLACE_CATEGORIES, countByCategory } from "@/lib/marketplace/categories"

const countries = [
  "Slovenija",
  "Avstrija",
  "Italija",
  "Hrvaška",
  "Madžarska",
  "Nemčija",
]

const citiesByCountry: Record<string, string[]> = {
  Slovenija: [
    "Ljubljana",
    "Maribor",
    "Celje",
    "Kranj",
    "Koper",
    "Velenje",
    "Novo mesto",
    "Ptuj",
    "Nova Gorica",
    "Murska Sobota",
  ],
  Avstrija: ["Dunaj", "Gradec", "Innsbruck", "Salzburg", "Celovec"],
  Italija: ["Trst", "Milano", "Rim", "Benetke", "Bologna"],
  Hrvaška: ["Zagreb", "Split", "Reka", "Dubrovnik", "Pula"],
  Madžarska: ["Budimpešta", "Seged", "Peč", "Debrecen"],
  Nemčija: ["München", "Berlin", "Hamburg", "Frankfurt", "Köln"],
}

// Audit 2026-11-18: seznam je bil lepotni in z IZMIŠLJENIMI števci
// (96, 128, 68 …), čeprav v platformi ni toliko podjetij. Zdaj so
// kategorije en vir (src/lib/marketplace/categories.ts), števci pa
// prihajajo iz resničnega snapshot-a (0 se ne izpiše).
const categories = MARKETPLACE_CATEGORIES

export function BrowseByLocation({
  businesses = [],
}: {
  /** Resnična podjetja iz snapshot-a — za poštene števce po kategoriji. */
  businesses?: { type?: string | null; category?: string | null }[]
}) {
  const counts = countByCategory(businesses)
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Brskajte po kraju
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Najdite popolno storitev v vaši bližini — po državi, mestu ali
            kategoriji.
          </p>
        </div>

        {/* Country Tabs */}
        <div className="mb-8 flex flex-wrap gap-3">
          {countries.map((country, index) => (
            <button
              key={country}
              className={`rounded-full px-6 py-3 text-sm font-medium transition-all ${
                index === 0
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "border bg-background hover:border-primary hover:bg-primary/5"
              }`}
            >
              {country}
            </button>
          ))}
        </div>

        {/* Cities Matrix */}
        <div className="mb-12">
          <h3 className="mb-6 text-xl font-semibold">Priljubljeno</h3>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Categories */}
            <div>
              <h4 className="mb-4 font-semibold text-primary">Kategorije</h4>
              <ul className="space-y-3">
                {categories.slice(0, 8).map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/kategorije/${cat.slug}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      {counts[cat.slug] > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({counts[cat.slug]})
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2-4: Cities */}
            {["Ljubljana", "Maribor", "Celje"].map((city) => (
              <div key={city}>
                <h4 className="mb-4 font-semibold text-primary">{city}</h4>
                <ul className="space-y-3">
                  {categories.slice(0, 8).map((cat) => (
                    <li key={cat.slug}>
                      <Link
                        href={`/kategorije/${cat.slug}?mesto=${encodeURIComponent(city)}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span>{cat.label} v {city}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-12">
          <h3 className="mb-6 text-xl font-semibold">Vse kategorije</h3>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/kategorije/${cat.slug}`}
                className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* All Cities */}
        <div>
          <h3 className="mb-6 text-xl font-semibold">Vsa mesta</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(citiesByCountry).map(([country, cities]) => (
              <div key={country}>
                <h4 className="mb-3 font-semibold text-primary">{country}</h4>
                <ul className="space-y-2">
                  {cities.map((city) => (
                    <li key={city}>
                      <Link
                        href={`/podjetja?mesto=${encodeURIComponent(city)}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <MapPinIcon size={14} />
                        <span>{city}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* SEO Links */}
        <div className="mt-12 border-t pt-8">
          <h3 className="mb-6 text-xl font-semibold">Priljubljene kombinacije</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Kozmetični saloni v Ljubljani",
              "Frizerski saloni v Mariboru",
              "Masažni saloni v Celju",
              "Brivci v Kranju",
              "Nohti v Kopru",
              "Wellness v Velenju",
              "Salon za depilacijo v Novem mestu",
              "Medspas v Ptuju",
              "Frizerski saloni v Ljubljani",
              "Kozmetični saloni v Mariboru",
              "Masažni saloni v Ljubljani",
              "Brivci v Celju",
            ].map((link) => (
              <Link
                key={link}
                href={`/podjetja?iskanje=${encodeURIComponent(link)}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {link}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link href="/podjetja">
            <Button size="lg" className="gap-2">
              Razišči vsa podjetja
              <ArrowRightIcon size={18} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}