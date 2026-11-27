"use client"

// ============================================================
// BUSINESS CARDS SHOWCASE (Fresha-inspired, superior 2026-11-16)
// Three carousels: Recommended, Popular, New — with real photos,
// ratings, reviews, addresses, badges, and favorite buttons.
// Surpasses Fresha with better card design and interactions.
// ============================================================

import { useRef } from "react"
import Image from "next/image"
import { verticalCardImage } from "@/lib/marketplace/card-image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  StarIcon,
  MapPinIcon,
  ArrowRightIcon,
  ClockIcon,
  StorefrontIcon,
} from "@/components/icons"
import { openStateFor } from "@/lib/hours/open-state"

interface Business {
  id: string
  name: string
  type: string
  address: string
  rating: number
  reviews: number
  /** Logotip ali null — takrat se uporabi slika po dejavnosti. */
  image?: string | null
  badge?: "Predstavljamo" | "Novo" | "Priljubljeno" | "Ponudbe"
  isOpen?: boolean
  openUntil?: string
  priceRange?: string
  slug: string
  category?: string
  city?: string
  description?: string
  services?: string[]
  /** Prve tri storitve z trajanjem/ceno (snapshot, audit 2026-11-18). */
  serviceItems?: { name: string; minutes: number | null; price: number | null }[]
  /** Tedenski delovni čas za značko »Odprto do …«. */
  hours?: { day: number; open: string; close: string }[]
}

interface BusinessShowcaseProps {
  recommendedBusinesses?: Business[]
  popularBusinesses?: Business[]
  newBusinesses?: Business[]
  /** Iskalni način: naslov prve sekcije je "Rezultati iskanja". */
  isSearchResults?: boolean
  /** Za pošteno prazno stanje — brez izmišljenih "popularnih" podjetij. */
  query?: string
  location?: string
}

interface CarouselSectionProps {
  title: string
  subtitle?: string
  businesses: Business[]
  variant?: "recommended" | "popular" | "new"
}


function formatPrice(price: number): string {
  return `${price.toFixed(2).replace(".", ",")} €`
}

function BusinessCard({ business }: { business: Business }) {
  // Stanje odprtja se izračuna ob izrisu — snapshot nosi tedenski vzorec,
  // zato značka nikoli ne zastara (prej je bila polje `isOpen`, ki ga nihče
  // ni napolnil).
  const openState = openStateFor(business.hours)
  const services = business.serviceItems ?? []
  return (
    <Link href={`/s/${business.slug}`}>
      <Card className="group overflow-hidden transition duration-300 hover:shadow-xl hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={business.image || verticalCardImage(business.category)}
            alt={business.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Badge */}
          {business.badge && (
            <div className="absolute left-3 top-3">
              <Badge
                variant="secondary"
                className="bg-background/90 backdrop-blur-sm"
              >
                {business.badge}
              </Badge>
            </div>
          )}

          {/* Audit 2026-11-17: srček je bil okras — stanje je živelo samo v
              komponenti, se ni nikamor shranilo in je ob navigaciji izginilo
              (6 gumbov brez dostopnega imena). Priljubljene bomo dodali z
              resnično shrambo; do takrat gumba ni. */}
          {/* Cenovni razred — samo ko je znan (prej vedno "€€") */}
          {business.priceRange && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="outline" className="bg-background/90 backdrop-blur-sm">
                {business.priceRange}
              </Badge>
            </div>
          )}

          {/* Open Status — resnično stanje iz delovnega časa */}
          {(openState.state === "open" || openState.state === "closed") && (
            <div className="absolute bottom-3 left-3">
              <Badge
                className={
                  openState.state === "open"
                    ? "bg-green-600 text-white"
                    : "bg-background/90 text-foreground backdrop-blur-sm"
                }
                title={openState.label}
              >
                <ClockIcon size={12} className="mr-1" />
                {openState.state === "open"
                  ? `Odprto do ${openState.until}`
                  : "Zaprto"}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 font-semibold leading-tight transition-colors group-hover:text-primary">
              {business.name}
            </h3>
            {/* Ocena samo z dejanskimi mnenji — prej je vsaka kartica
                kazala "0.0" s polno zvezdico, kar izgleda kot slaba ocena. */}
            {business.reviews > 0 ? (
              <div className="flex shrink-0 items-center gap-1">
                <StarIcon size={16} className="text-amber-400" weight="fill" />
                <span className="text-sm font-semibold">
                  {business.rating.toFixed(1)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground shrink-0 text-xs">Novo</span>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">{business.type}</p>

          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon size={14} className="shrink-0" />
            <span className="truncate">{business.address}</span>
          </div>

          {/* Storitve z trajanjem in ceno — stranka vidi, KAJ se prodaja
              (audit 2026-11-18; prej samo ime podjetja in naslov). */}
          {services.length > 0 && (
            <ul className="mt-3 space-y-1 border-t pt-2">
              {services.slice(0, 3).map((service) => (
                <li
                  key={service.name}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="truncate">{service.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {service.minutes ? `${service.minutes} min` : ""}
                    {service.minutes && service.price != null ? " · " : ""}
                    {service.price != null ? formatPrice(service.price) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Prej so bili tu trije izmišljeni avatarji "A/B/C" — enaki na
                  vseh karticah. Zdaj samo resnično število mnenj. */}
              <span className="text-muted-foreground text-xs">
                {business.reviews === 0
                  ? "Brez mnenj"
                  : business.reviews === 1
                    ? "1 mnenje"
                    : business.reviews === 2
                      ? "2 mnenji"
                      : `${business.reviews} mnenj`}
              </span>
            </div>
            {services.length > 0 && (
              <span className="text-primary group-hover:underline text-xs font-medium">
                Poglej vse storitve →
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function CarouselSection({
  title,
  subtitle,
  businesses,
}: CarouselSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {businesses.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll("left")}
                className="rounded-full"
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scroll("right")}
                className="rounded-full"
              >
                →
              </Button>
            </div>
          )}
        </div>

        {/* Carousel / honest empty state */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {businesses.length === 0 ? (
            <p className="text-muted-foreground py-8 text-sm">
              Trenutno ni podjetij za prikaz. Podatki se prikažejo, ko so v
              platformi res prisotni.
            </p>
          ) : (
            businesses.map((business) => (
              <div key={business.id} className="w-72 shrink-0">
                <BusinessCard business={business} />
              </div>
            ))
          )}
        </div>

        {/* View All */}
        <div className="mt-6 text-center">
          <Link href="/podjetja">
            <Button variant="outline" className="gap-2">
              Vsa podjetja
              <ArrowRightIcon size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function BusinessShowcase({
  recommendedBusinesses = [],
  popularBusinesses = [],
  newBusinesses = [],
  /** Iskalni način: naslov prve sekcije je "Rezultati iskanja". */
  isSearchResults = false,
  query = "",
  location = "",
}: BusinessShowcaseProps) {
  // No sample fallbacks. An empty section stays empty and says so.
  // Prazna vrstica (karusel brez kartic) ni nikoli uporabna — prej se je
  // v načinu brskanja izpisala kot prazna sekcija z naslovom. Zato se
  // sekcije prikažejo samo, ko imajo vsebino (ne glede na način).
  const showRecommended = recommendedBusinesses.length > 0
  const showPopular = popularBusinesses.length > 0
  const showNew = newBusinesses.length > 0

  // Ni lažnih "sample" podjetij. Ko je katalog prazen ali iskanje ne najde
  // zadetka, prikažemo eno jasno sporočilo — ne treh praznih karuselov.
  if (!showRecommended && !showPopular && !showNew) {
    const suffix = [
      query ? ` za »${query}«` : "",
      location ? ` v ${location}` : "",
    ].join("")

    return (
      <section className="container mx-auto px-4 py-10">
        <div className="bg-card rounded-2xl border px-5 py-4 sm:px-8">
          {isSearchResults ? (
            <EmptyState
              icon={<MapPinIcon size={44} />}
              title={`Ni rezultatov${suffix}`}
              description="Prikazujemo samo podjetja, ki so res objavljena v platformi. Preverite zapis ali izberite drugo dejavnost."
              action={{ label: "Počisti iskanje", href: "/podjetja" }}
              secondaryAction={{
                label: "Razišči dejavnosti",
                href: "/podjetja#dejavnosti",
              }}
              size="lg"
            />
          ) : (
            <EmptyState
              icon={<StorefrontIcon size={44} />}
              title="Tržnica še nima objavljenih podjetij"
              description="Ko se podjetje pridruži in objavi svoj profil, bo njegova kartica vidna tukaj. Do takrat lahko raziščete dejavnosti."
              action={{ label: "Objavi svoj profil", href: "/za-podjetja" }}
              secondaryAction={{
                label: "Razišči dejavnosti",
                href: "/podjetja#dejavnosti",
              }}
              size="lg"
            />
          )}
        </div>
      </section>
    )
  }

  return (
    <>
      {showRecommended && (
        <div className="bg-muted/30">
          <CarouselSection
            title={isSearchResults ? "Rezultati iskanja" : "Priporočeno"}
            subtitle={
              isSearchResults
                ? "Podjetja, ki ustrezajo vaši poizvedbi"
                : "Podjetja, ki so trenutno aktivna v platformi"
            }
            businesses={recommendedBusinesses}
            variant="recommended"
          />
        </div>
      )}

      {showPopular && (
        <CarouselSection
          title="Priljubljeno"
          subtitle="Podjetja z največ ocenami"
          businesses={popularBusinesses}
          variant="popular"
        />
      )}

      {showNew && (
        <div className="bg-muted/30">
          <CarouselSection
            title="Novi v MARKEC"
            subtitle="Nedavno pridružena podjetja"
            businesses={newBusinesses}
            variant="new"
          />
        </div>
      )}
    </>
  )
}