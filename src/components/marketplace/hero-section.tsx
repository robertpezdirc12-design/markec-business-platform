"use client"

// ============================================================
// HERO SECTION (Fresha-inspired, superior 2026-11-16)
// Stunning gradient hero with animated counter, search bar,
// category pills, and floating business card previews.
// Surpasses Fresha's hero with better visual hierarchy.
// ============================================================

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  SearchIcon,
  MapPinIcon,
  StarIcon,
  ArrowRightIcon,
} from "@/components/icons"
import {
  Buildings,
  Globe,
} from "@phosphor-icons/react/dist/ssr"

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const steps = 60
    const increment = target / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, target, duration])

  return { count, ref }
}

const categories = [
  { slug: "frizerski-saloni", name: "Frizerski saloni", icon: "✂️" },
  { slug: "kozmeticni-saloni", name: "Kozmetika", icon: "💅" },
  { slug: "masazni-saloni", name: "Masaža", icon: "💆" },
  { slug: "brivci", name: "Brivci", icon: "💈" },
  { slug: "nohti", name: "Nohti", icon: "💅" },
  { slug: "wellness", name: "Wellness", icon: "🧖" },
]

const floatingCards = [
  {
    name: "Lassana Salon",
    rating: 5.0,
    reviews: 39,
    type: "Kozmetični salon",
    position: "top-right",
    delay: 0,
  },
  {
    name: "Barbershop AS",
    rating: 5.0,
    reviews: 229,
    type: "Brivec",
    position: "bottom-right",
    delay: 200,
  },
]

export function HeroSection() {
  const { count: bookings, ref: bookingsRef } = useAnimatedCounter(12500, 2500)
  const { count: businesses, ref: businessesRef } = useAnimatedCounter(500, 2000)
  const { count: cities, ref: citiesRef } = useAnimatedCounter(85, 1500)

  return (
    <section className="relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-background to-accent-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />

      {/* Decorative Elements */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      {/* Floating Business Cards (desktop only) */}
      <div className="pointer-events-none absolute right-8 top-1/4 hidden lg:block">
        {floatingCards.map((card, index) => (
          <div
            key={card.name}
            className="mb-4 w-64 rounded-xl border bg-background/80 p-4 shadow-lg backdrop-blur-sm"
            style={{
              transform: `translateY(${index * 20}px)`,
              animationDelay: `${card.delay}ms`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{card.name}</p>
                <p className="text-sm text-muted-foreground">{card.type}</p>
              </div>
              <div className="flex items-center gap-1">
                <StarIcon size={14} className="text-amber-400" weight="fill" />
                <span className="text-sm font-medium">{card.rating}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {card.reviews} mnenj
            </p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="container relative mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            <span>432.594 terminov rezerviranih danes</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Rezervirajte</span>
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              lokalne storitve
            </span>
            <span className="block">samoskrbe</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Odkrijte najbolje ocenjene salone, brivce, zdravnike in lepotne
            strokovnjake, ki jim zaupajo{" "}
            <strong className="text-foreground">milijoni</strong> po vsem svetu.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-2xl border bg-background p-3 shadow-2xl sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-4">
              <SearchIcon size={22} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Kaj iščete? (striženje, masaža, pedikura...)"
                className="flex-1 bg-transparent text-base outline-none"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border px-4 py-4">
              <MapPinIcon size={22} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Lokacija"
                className="w-36 bg-transparent text-base outline-none"
              />
            </div>
            <Button size="lg" className="rounded-xl px-8 py-4 text-base">
              <SearchIcon size={20} className="mr-2" />
              Išči
            </Button>
          </div>

          {/* Category Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">Priljubljeno:</span>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/podjetja?kategorija=${encodeURIComponent(cat.name)}`}
                className="flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>

          {/* Social Proof Counter */}
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div ref={bookingsRef} className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">
                {bookings.toLocaleString("sl-SI")}+
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                terminov ta mesec
              </p>
            </div>
            <div ref={businessesRef} className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">{businesses}+</p>
              <p className="mt-1 text-sm text-muted-foreground">
                aktivnih podjetij
              </p>
            </div>
            <div ref={citiesRef} className="text-center">
              <p className="text-3xl font-bold sm:text-4xl">{cities}+</p>
              <p className="mt-1 text-sm text-muted-foreground">mest</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {[
              "✓ Brez kreditne kartice",
              "✓ Takojšnja potrditev",
              "✓ Brezplačna odpoved",
              "✓ 24/7 podpora",
            ].map((indicator) => (
              <div
                key={indicator}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="text-green-500">{indicator}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
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