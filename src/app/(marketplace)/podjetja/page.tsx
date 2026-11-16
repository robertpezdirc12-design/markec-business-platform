import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  SearchIcon,
  MapPinIcon,
  CalendarIcon,
  StarIcon,
  ArrowRightIcon,
  ScissorsIcon,
  SparkleIcon,
  UsersIcon,
  TrendingUpIcon,
} from "@/components/icons"
import { Heart as HeartIcon } from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

// ============================================================
// MARKETPLACE LANDING (Fresha-inspired 2026-11-16)
// Public discovery page: search + categories + featured businesses.
// Like Fresha's homepage — the entry point for customers.
// ============================================================

// Revalidate every 5 minutes
export const revalidate = 300

const categories = [
  {
    slug: "frizerski-saloni",
    name: "Frizerski saloni",
    icon: "✂️",
    count: 128,
    color: "bg-purple-100 text-purple-700",
  },
  {
    slug: "kozmeticni-saloni",
    name: "Kozmetični saloni",
    icon: "💅",
    count: 96,
    color: "bg-pink-100 text-pink-700",
  },
  {
    slug: "masazni-saloni",
    name: "Masažni saloni",
    icon: "💆",
    count: 74,
    color: "bg-blue-100 text-blue-700",
  },
  {
    slug: "brivci",
    name: "Brivci",
    icon: "💈",
    count: 52,
    color: "bg-amber-100 text-amber-700",
  },
  {
    slug: "nohti",
    name: "Nohti",
    icon: "💅",
    count: 68,
    color: "bg-green-100 text-green-700",
  },
  {
    slug: "depilacija",
    name: "Depilacija",
    icon: "🌸",
    count: 45,
    color: "bg-rose-100 text-rose-700",
  },
  {
    slug: "wellness",
    name: "Wellness & Spa",
    icon: "🧖",
    count: 38,
    color: "bg-teal-100 text-teal-700",
  },
  {
    slug: "zdravniki",
    name: "Zdravniki",
    icon: "⚕️",
    count: 89,
    color: "bg-red-100 text-red-700",
  },
]

const cities = [
  "Ljubljana",
  "Maribor",
  "Celje",
  "Kranj",
  "Koper",
  "Velenje",
  "Novo mesto",
  "Ptuj",
]

export default async function MarketplacePage() {
  // Fetch real businesses from database
  const businesses = await prisma.organization.findMany({
    where: {
      // Only show active organizations with public sites
      slug: { not: "" },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      // Profile image would come from settings
    },
    take: 8,
  })

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Rezervirajte lokalne
              <br />
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                storitve samoskrbe
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Odkrijte najbolje ocenjene salone, brivce, zdravnike in lepotne
              strokovnjake, ki jim zaupajo tisoči strank.
            </p>

            {/* Search Bar */}
            <div className="mt-8 flex flex-col gap-3 rounded-2xl border bg-background p-3 shadow-lg sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl border px-4 py-3">
                <SearchIcon size={20} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Kaj iščete? (striženje, masaža...)"
                  className="flex-1 bg-transparent text-base outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border px-4 py-3">
                <MapPinIcon size={20} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Lokacija"
                  className="w-32 bg-transparent text-base outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border px-4 py-3">
                <CalendarIcon size={20} className="text-muted-foreground" />
                <span className="text-muted-foreground">Kadarkoli</span>
              </div>
              <Button size="lg" className="rounded-xl px-8">
                Išči
              </Button>
            </div>

            {/* Social Proof */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-medium"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">12.500+</strong> terminov,
                rezerviranih ta mesec
              </p>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      </section>

      {/* Categories Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Raziščite kategorije</h2>
              <p className="mt-1 text-muted-foreground">
                Najdite popolno storitev zase
              </p>
            </div>
            <Link href="/kategorije">
              <Button variant="outline">
                Vse kategorije
                <ArrowRightIcon size={16} className="ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <Link key={category.slug} href={`/kategorije/${category.slug}`}>
                <Card className="transition-all hover:shadow-md hover:-translate-y-1">
                  <CardContent className="p-6 text-center">
                    <div
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${category.color}`}
                    >
                      {category.icon}
                    </div>
                    <h3 className="mt-3 font-semibold">{category.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {category.count} podjetij
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Businesses */}
      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Priporočeno</h2>
              <p className="mt-1 text-muted-foreground">
                Najbolje ocenjena podjetja v vaši bližini
              </p>
            </div>
            <Link href="/podjetja">
              <Button variant="outline">
                Vsa podjetja
                <ArrowRightIcon size={16} className="ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Lassana Kozmetični Salon",
                type: "Kozmetični salon",
                address: "Ljubljana, Slovenija",
                rating: 5.0,
                reviews: 39,
                image: "/placeholder-salon.jpg",
                badge: "Priporočamo",
              },
              {
                name: "Lassana Frizerski Salon",
                type: "Frizerski salon",
                address: "Ljubljana, Slovenija",
                rating: 4.9,
                reviews: 19,
                image: "/placeholder-hair.jpg",
                badge: "Priporočamo",
              },
              {
                name: "Wellness Studio Mira",
                type: "Wellness & Spa",
                address: "Maribor, Slovenija",
                rating: 5.0,
                reviews: 24,
                image: "/placeholder-wellness.jpg",
                badge: "Novo",
              },
              {
                name: "Barbershop AS",
                type: "Brivec",
                address: "Celje, Slovenija",
                rating: 5.0,
                reviews: 229,
                image: "/placeholder-barber.jpg",
                badge: "Priljubljeno",
              },
            ].map((business) => (
              <Link key={business.name} href={`/podjetja/${business.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-1">
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-muted">
                    <div className="absolute left-2 top-2">
                      <Badge
                        variant="secondary"
                        className="bg-background/90 backdrop-blur"
                      >
                        {business.badge}
                      </Badge>
                    </div>
                    <button className="absolute right-2 top-2 rounded-full bg-background/90 p-2 backdrop-blur transition-colors hover:bg-background">
                      <HeartIcon size={18} />
                    </button>
                    <div className="flex h-full items-center justify-center">
                      <ScissorsIcon size={32} className="text-muted-foreground/50" />
                    </div>
                  </div>

                  {/* Info */}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{business.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {business.type}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPinIcon size={14} />
                          {business.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StarIcon
                          size={14}
                          className="text-amber-400"
                          weight="fill"
                        />
                        <span className="text-sm font-medium">
                          {business.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {business.reviews} mnenj
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold">Kako deluje?</h2>
            <p className="mt-1 text-muted-foreground">
              Rezervirajte v 3 preprostih korakih
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Poiščite storitev",
                description: "Izberite kategorijo, lokacijo in želeni termin.",
                icon: <SearchIcon size={24} />,
                color: "bg-blue-100 text-blue-600",
              },
              {
                step: "2",
                title: "Izberite podjetje",
                description: "Primerjajte ocene, cene in razpoložljivost.",
                icon: <StarIcon size={24} />,
                color: "bg-amber-100 text-amber-600",
              },
              {
                step: "3",
                title: "Rezervirajte",
                description: "Potrdite rezervacijo v nekaj klikih.",
                icon: <CalendarIcon size={24} />,
                color: "bg-green-100 text-green-600",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${item.color}`}
                >
                  {item.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by City */}
      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-2xl font-bold">Brskajte po kraju</h2>

          <div className="flex flex-wrap gap-3">
            {cities.map((city) => (
              <Link key={city} href={`/podjetja?mesto=${encodeURIComponent(city)}`}>
                <Button variant="outline" className="rounded-full">
                  <MapPinIcon size={14} className="mr-2" />
                  {city}
                </Button>
              </Link>
            ))}
          </div>

          {/* SEO links */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { category: "Frizerski saloni", city: "Ljubljana" },
              { category: "Kozmetični saloni", city: "Ljubljana" },
              { category: "Masažni saloni", city: "Maribor" },
              { category: "Brivci", city: "Celje" },
            ].map((item) => (
              <Link
                key={`${item.category}-${item.city}`}
                href={`/podjetja?kategorija=${encodeURIComponent(item.category)}&mesto=${encodeURIComponent(item.city)}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {item.category} v {item.city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="from-primary to-accent bg-linear-to-r py-16 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">
            Imate salon ali studio?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Pridružite se MARKEC in začnite sprejemati rezervacije danes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8">
                Registrirajte podjetje
                <ArrowRightIcon size={18} className="ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 px-8 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Preberite več
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}