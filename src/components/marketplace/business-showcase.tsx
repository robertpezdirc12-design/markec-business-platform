"use client"

// ============================================================
// BUSINESS CARDS SHOWCASE (Fresha-inspired, superior 2026-11-16)
// Three carousels: Recommended, Popular, New — with real photos,
// ratings, reviews, addresses, badges, and favorite buttons.
// Surpasses Fresha with better card design and interactions.
// ============================================================

import { useState, useRef } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  StarIcon,
  MapPinIcon,
  ArrowRightIcon,
  ClockIcon,
} from "@/components/icons"
import { Heart } from "@phosphor-icons/react/dist/ssr"

interface Business {
  id: string
  name: string
  type: string
  address: string
  rating: number
  reviews: number
  image: string
  badge?: "Predstavljamo" | "Novo" | "Priljubljeno" | "Ponudbe"
  isOpen?: boolean
  openUntil?: string
  priceRange?: string
  slug: string
}

interface BusinessShowcaseProps {
  title: string
  subtitle?: string
  businesses: Business[]
  variant?: "recommended" | "popular" | "new"
}

// Sample data for demonstration
const recommendedBusinesses: Business[] = [
  {
    id: "1",
    name: "Lassana Kozmetični Salon",
    type: "Kozmetični salon",
    address: "Ljubljana, Slovenija",
    rating: 5.0,
    reviews: 39,
    image: "/img/presets/hero-spa.jpg",
    badge: "Predstavljamo",
    isOpen: true,
    openUntil: "20:00",
    priceRange: "€€",
    slug: "lassana-kozmeticni-salon",
  },
  {
    id: "2",
    name: "Lassana Frizerski Salon",
    type: "Frizerski salon",
    address: "Ljubljana, Slovenija",
    rating: 4.9,
    reviews: 19,
    image: "/img/presets/hero-barber.jpg",
    badge: "Predstavljamo",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "lassana-frizerski-salon",
  },
  {
    id: "3",
    name: "Wellness Studio Mira",
    type: "Wellness & Spa",
    address: "Maribor, Slovenija",
    rating: 5.0,
    reviews: 24,
    image: "/img/presets/hero-spa.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "21:00",
    priceRange: "€€€",
    slug: "wellness-studio-mira",
  },
  {
    id: "4",
    name: "Barbershop AS",
    type: "Brivec",
    address: "Celje, Slovenija",
    rating: 5.0,
    reviews: 229,
    image: "/img/presets/hero-barber.jpg",
    badge: "Priljubljeno",
    isOpen: true,
    openUntil: "18:00",
    priceRange: "€",
    slug: "barbershop-as",
  },
  {
    id: "5",
    name: "Color Nail Studio",
    type: "Nohti",
    address: "Kranj, Slovenija",
    rating: 4.8,
    reviews: 228,
    image: "/img/presets/hero-spa.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "color-nail-studio",
  },
]

const popularBusinesses: Business[] = [
  {
    id: "6",
    name: "Monin Lepotni Kotiček",
    type: "Kozmetični salon",
    address: "Moste, Ljubljana",
    rating: 5.0,
    reviews: 2345,
    image: "/img/presets/hero-spa.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "20:00",
    priceRange: "€€",
    slug: "monin-lepotni-koticek",
  },
  {
    id: "7",
    name: "Lassana Frizerski Salon - Derčeva",
    type: "Frizerski salon",
    address: "Derčeva ulica 31, Ljubljana",
    rating: 5.0,
    reviews: 254,
    image: "/img/presets/hero-barber.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "lassana-derceva",
  },
  {
    id: "8",
    name: "Lassana Frizerski in Kozmetični",
    type: "Frizerski salon",
    address: "Slovenska Cesta 27, Ljubljana",
    rating: 5.0,
    reviews: 315,
    image: "/img/presets/hero-barber.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "lassana-slovenska",
  },
  {
    id: "9",
    name: "Lassana Frizerski Salon - Celovška",
    type: "Frizerski salon",
    address: "Celovška cesta 49, Ljubljana",
    rating: 4.9,
    reviews: 77,
    image: "/img/presets/hero-barber.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "lassana-celovska",
  },
  {
    id: "10",
    name: "Beauty & Spa Center",
    type: "Wellness & Spa",
    address: "Koper, Slovenija",
    rating: 4.9,
    reviews: 189,
    image: "/img/presets/hero-spa.jpg",
    badge: "Ponudbe",
    isOpen: true,
    openUntil: "21:00",
    priceRange: "€€€",
    slug: "beauty-spa-center",
  },
]

const newBusinesses: Business[] = [
  {
    id: "11",
    name: "LJUBLÉA salon",
    type: "Nohti",
    address: "Vojkova cesta 58, Ljubljana",
    rating: 5.0,
    reviews: 14,
    image: "/img/presets/hero-spa.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "ljublea-salon",
  },
  {
    id: "12",
    name: "AS Barbershop",
    type: "Brivec",
    address: "Štepanjsko naselje, Ljubljana",
    rating: 5.0,
    reviews: 229,
    image: "/img/presets/hero-barber.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "18:00",
    priceRange: "€",
    slug: "as-barbershop",
  },
  {
    id: "13",
    name: "Moods head and body",
    type: "Frizerski salon",
    address: "Via Archimede 147, Roma",
    rating: 5.0,
    reviews: 4,
    image: "/img/presets/hero-barber.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "20:00",
    priceRange: "€€",
    slug: "moods-head-body",
  },
  {
    id: "14",
    name: "Color Nail",
    type: "Nohti",
    address: "Via Andrea Solari 43, Milano",
    rating: 4.8,
    reviews: 228,
    image: "/img/presets/hero-spa.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "19:00",
    priceRange: "€€",
    slug: "color-nail",
  },
  {
    id: "15",
    name: "Studio Beauty",
    type: "Kozmetični salon",
    address: "Velenje, Slovenija",
    rating: 4.9,
    reviews: 56,
    image: "/img/presets/hero-spa.jpg",
    badge: "Novo",
    isOpen: true,
    openUntil: "20:00",
    priceRange: "€€",
    slug: "studio-beauty",
  },
]

function BusinessCard({ business }: { business: Business }) {
  const [isFavorite, setIsFavorite] = useState(false)

  return (
    <Link href={`/podjetja/${business.slug}`}>
      <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={business.image}
            alt={business.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsFavorite(!isFavorite)
            }}
            className="absolute right-3 top-3 rounded-full bg-background/90 p-2 backdrop-blur-sm transition-all hover:bg-background hover:scale-110"
          >
            <Heart
              size={20}
              className={isFavorite ? "text-red-500" : "text-foreground"}
              weight={isFavorite ? "fill" : "regular"}
            />
          </button>

          {/* Price Range */}
          <div className="absolute bottom-3 right-3">
            <Badge variant="outline" className="bg-background/90 backdrop-blur-sm">
              {business.priceRange}
            </Badge>
          </div>

          {/* Open Status */}
          {business.isOpen && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-green-500 text-white">
                <ClockIcon size={12} className="mr-1" />
                Odprto do {business.openUntil}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold transition-colors group-hover:text-primary">
                {business.name}
              </h3>
              <p className="text-sm text-muted-foreground">{business.type}</p>
            </div>
            <div className="flex items-center gap-1">
              <StarIcon
                size={16}
                className="text-amber-400"
                weight="fill"
              />
              <span className="text-sm font-semibold">
                {business.rating.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon size={14} />
            <span>{business.address}</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[10px]"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {business.reviews} mnenj
            </span>
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
  variant,
}: BusinessShowcaseProps) {
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
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {businesses.map((business) => (
            <div key={business.id} className="w-72 shrink-0">
              <BusinessCard business={business} />
            </div>
          ))}
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

export function BusinessShowcase() {
  return (
    <>
      {/* Recommended */}
      <div className="bg-muted/30">
        <CarouselSection
          title="Priporočeno"
          subtitle="Najbolje ocenjena podjetja v vaši bližini"
          businesses={recommendedBusinesses}
          variant="recommended"
        />
      </div>

      {/* Popular */}
      <CarouselSection
        title="Priljubljeno"
        subtitle="Podjetja z največ zadovoljnimi strankami"
        businesses={popularBusinesses}
        variant="popular"
      />

      {/* New */}
      <div className="bg-muted/30">
        <CarouselSection
          title="Novi v MARKEC"
          subtitle="Nedavno pridružena podjetja"
          businesses={newBusinesses}
          variant="new"
        />
      </div>
    </>
  )
}