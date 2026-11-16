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
  category?: string
  city?: string
  description?: string
  services?: string[]
}

interface BusinessShowcaseProps {
  recommendedBusinesses?: Business[]
  popularBusinesses?: Business[]
  newBusinesses?: Business[]
  /** Search results: hide sections that have no data instead of showing empty carousels. */
  hideEmptySections?: boolean
}

interface CarouselSectionProps {
  title: string
  subtitle?: string
  businesses: Business[]
  variant?: "recommended" | "popular" | "new"
}


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
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 font-semibold leading-tight transition-colors group-hover:text-primary">
              {business.name}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
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

          <p className="mt-1 text-sm text-muted-foreground">{business.type}</p>

          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon size={14} className="shrink-0" />
            <span className="truncate">{business.address}</span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Avatar stack */}
              <div className="flex -space-x-1.5">
                {["#E8B4B8", "#B8D4E3", "#C5E3B8"].map((color, i) => (
                  <div
                    key={i}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-medium text-white"
                    style={{ backgroundColor: color }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {business.reviews} mnenj
              </span>
            </div>
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
  hideEmptySections = false,
}: BusinessShowcaseProps) {
  // No sample fallbacks. An empty section stays empty and says so.
  const showRecommended = !hideEmptySections || recommendedBusinesses.length > 0
  const showPopular = !hideEmptySections || popularBusinesses.length > 0
  const showNew = !hideEmptySections || newBusinesses.length > 0

  return (
    <>
      {showRecommended && (
        <div className="bg-muted/30">
          <CarouselSection
            title={hideEmptySections ? "Rezultati iskanja" : "Priporočeno"}
            subtitle={
              hideEmptySections
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