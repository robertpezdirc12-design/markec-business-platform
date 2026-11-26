// ============================================================
// HERO SECTION — honest marketplace entry point.
//
// No invented counters, no fake business cards, no dead inputs.
// Every figure displayed here comes from getMarketplaceStats()
// and is passed down by the marketplace page.
// ============================================================

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SearchIcon, MapPinIcon } from "@/components/icons"
import { ActivityExplorer } from "@/components/marketplace/activity-explorer"

const categories = [
  { slug: "frizerski-saloni", name: "Frizerski saloni", icon: "✂️" },
  { slug: "kozmeticni-saloni", name: "Kozmetika", icon: "💅" },
  { slug: "masazni-saloni", name: "Masaža", icon: "💆" },
  { slug: "brivci", name: "Brivci", icon: "💈" },
  { slug: "nohti", name: "Nohti", icon: "💅" },
  { slug: "wellness", name: "Wellness", icon: "🧖" },
]

type HeroStats = {
  totalAppointments: number
  totalBusinesses: number
  citiesCount: number
}

export function HeroSection({
  initialQuery = "",
  initialLocation = "",
  stats,
}: {
  initialQuery?: string
  initialLocation?: string
  stats: HeroStats
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-background to-accent-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            <span>Podjetja, ki so res prisotna na MARKEC-u</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Rezervirajte</span>
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              lokalne storitve
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Odkrijte podjetja po panogi in kraju. Prikazujemo samo podatke, ki
            obstajajo v platformi.
          </p>

          <form
            action="/podjetja"
            method="get"
            className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-2xl border bg-background p-3 shadow-2xl sm:flex-row sm:items-center"
          >
            <label className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-4">
              <SearchIcon size={22} className="text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={initialQuery}
                aria-label="Storitev ali podjetje"
                placeholder="Kaj iščete? (striženje, masaža, pedikura...)"
                className="min-w-0 flex-1 rounded-md bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border px-4 py-4">
              <MapPinIcon size={22} className="text-muted-foreground" />
              <input
                type="text"
                name="location"
                defaultValue={initialLocation}
                aria-label="Kraj"
                placeholder="Lokacija"
                className="w-36 min-w-0 rounded-md bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
            </label>
            <Button type="submit" size="lg" className="rounded-xl px-8 py-4 text-base">
              <SearchIcon size={20} className="mr-2" />
              Išči
            </Button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">Priljubljeno:</span>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/podjetja?kategorija=${encodeURIComponent(cat.name)}`}
                className="flex min-h-11 items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>

          <div id="dejavnosti" className="mt-4 flex scroll-mt-24 justify-center">
            <ActivityExplorer />
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">
                {stats.totalAppointments.toLocaleString("sl-SI")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">rezervacij</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">
                {stats.totalBusinesses.toLocaleString("sl-SI")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">aktivnih podjetij</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">
                {stats.citiesCount.toLocaleString("sl-SI")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">mest</p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {[
              "Išči po storitvi",
              "Išči po kraju",
              "Pravi podatki iz platforme",
              "Vmesnik v slovenščini",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-green-500">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="currentColor"
            className="text-background"
          />
        </svg>
      </div>
    </section>
  )
}
