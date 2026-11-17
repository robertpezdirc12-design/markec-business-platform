"use client"

// ============================================================
// APP DOWNLOAD SECTION (Fresha-inspired 2026-11-16)
// QR code + App Store / Google Play badges.
// Like Fresha's "Prenesite aplikacijo" section.
// ============================================================

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRightIcon,
  StarIcon,
  UsersIcon,
  CalendarIcon,
  CheckCircleIcon,
} from "@/components/icons"
import Link from "next/link"

interface AppDownloadSectionProps {
  /** Number of bookings this month (for social proof) */
  bookingsCount?: number
  /** Number of active businesses */
  businessesCount?: number
  /** App Store URL */
  appStoreUrl?: string
  /** Google Play URL */
  playStoreUrl?: string
}

export function AppDownloadSection({
  bookingsCount = 12500,
  businessesCount = 500,
  appStoreUrl = "#",
  playStoreUrl = "#",
}: AppDownloadSectionProps) {
  // Poštenost: brez prave povezave NI gumba, ki obljublja aplikacijo.
  // Default "#" pomeni "aplikacije še ni" — takrat razdelek pove resnico
  // in skrije trgovine ter QR kodo (prej so bili mrtvi linki na #).
  const hasStoreLinks = appStoreUrl !== "#" || playStoreUrl !== "#"

  const [animatedCount, setAnimatedCount] = useState(0)

  // Animate counter on mount
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = bookingsCount / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= bookingsCount) {
        setAnimatedCount(bookingsCount)
        clearInterval(timer)
      } else {
        setAnimatedCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [bookingsCount])

  return (
    <section className="from-primary to-accent text-primary-foreground bg-linear-to-r py-16">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: Copy */}
          <div>
            <Badge variant="secondary" className="mb-4">
              {hasStoreLinks
                ? "📱 Na voljo na Apple & Google"
                : "📱 Aplikacija v pripravi"}
            </Badge>

            <h2 className="text-3xl font-bold sm:text-4xl">
              {hasStoreLinks
                ? "Prenesite aplikacijo MARKEC"
                : "MARKEC na vašem telefonu"}
            </h2>

            <p className="mt-4 text-lg opacity-90">
              {hasStoreLinks
                ? "Rezervirajte nepozabna lepotna in wellness doživetja z mobilno aplikacijo MARKEC."
                : "Do takrat rezervirajte prek spletne strani — deluje odlično tudi na telefonu, brez namestitve."}
            </p>

            {/* Social Proof Counter */}
            <div className="mt-8 flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold">
                  {animatedCount.toLocaleString("sl-SI")}+
                </p>
                <p className="text-sm opacity-75">terminov ta mesec</p>
              </div>
              <div className="bg-primary-foreground/20 h-12 w-px" />
              <div>
                <p className="text-3xl font-bold">{businessesCount}+</p>
                <p className="text-sm opacity-75">aktivnih podjetij</p>
              </div>
            </div>

            {/* Store Badges — samo z resničnimi povezavami */}
            {hasStoreLinks && (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center gap-3 rounded-xl border px-6 py-3 transition-colors"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <p className="text-xs opacity-75">Prenesite na</p>
                    <p className="font-semibold">App Store</p>
                  </div>
                </a>

                <a
                  href={playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center gap-3 rounded-xl border px-6 py-3 transition-colors"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  <div>
                    <p className="text-xs opacity-75">Prenesite na</p>
                    <p className="font-semibold">Google Play</p>
                  </div>
                </a>
              </div>
            )}

            {/* QR Code — skrita, dokler ni prave povezave do trgovine */}
            {hasStoreLinks && (
              <div className="mt-8">
                <div className="border-primary-foreground/20 bg-primary-foreground/10 inline-block rounded-xl border p-4">
                  <div className="flex items-center gap-4">
                    {/* QR Code placeholder */}
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-white">
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 80 80"
                        fill="none"
                        className="text-black"
                      >
                        {/* QR code pattern */}
                        <rect
                          x="4"
                          y="4"
                          width="24"
                          height="24"
                          rx="2"
                          fill="black"
                        />
                        <rect
                          x="52"
                          y="4"
                          width="24"
                          height="24"
                          rx="2"
                          fill="black"
                        />
                        <rect
                          x="4"
                          y="52"
                          width="24"
                          height="24"
                          rx="2"
                          fill="black"
                        />
                        <rect
                          x="8"
                          y="8"
                          width="16"
                          height="16"
                          rx="1"
                          fill="white"
                        />
                        <rect
                          x="56"
                          y="8"
                          width="16"
                          height="16"
                          rx="1"
                          fill="white"
                        />
                        <rect
                          x="8"
                          y="56"
                          width="16"
                          height="16"
                          rx="1"
                          fill="white"
                        />
                        <rect x="12" y="12" width="8" height="8" fill="black" />
                        <rect x="60" y="12" width="8" height="8" fill="black" />
                        <rect x="12" y="60" width="8" height="8" fill="black" />
                        {/* Center dots */}
                        <rect x="36" y="36" width="8" height="8" fill="black" />
                        <rect x="44" y="36" width="8" height="8" fill="black" />
                        <rect x="36" y="44" width="8" height="8" fill="black" />
                        <rect x="44" y="44" width="8" height="8" fill="black" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Skenirajte kodo</p>
                      <p className="text-sm opacity-75">
                        Prenesite aplikacijo neposredno
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: App Preview */}
          <div className="relative hidden lg:block">
            <div className="mx-auto max-w-sm">
              {/* Phone mockup */}
              <div className="border-primary-foreground/20 bg-background relative rounded-[2.5rem] border-[8px] shadow-2xl">
                {/* Notch */}
                <div className="bg-primary-foreground/20 absolute top-0 left-1/2 h-6 w-32 -translate-x-1/2 rounded-b-2xl" />

                {/* Screen content */}
                <div className="p-6 pt-8">
                  {/* App header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
                        M
                      </div>
                      <span className="text-foreground font-semibold">
                        MARKEC
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-primary/10 h-8 w-8 rounded-full" />
                    </div>
                  </div>

                  {/* Search */}
                  <div className="mb-4 flex items-center gap-2 rounded-xl border p-2">
                    <span className="text-muted-foreground text-sm">
                      🔍 Išči storitve...
                    </span>
                  </div>

                  {/* Categories */}
                  <div className="mb-4 flex gap-2">
                    {["✂️", "💅", "💆", "💈"].map((emoji) => (
                      <div
                        key={emoji}
                        className="bg-muted flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>

                  {/* Business card */}
                  <div className="rounded-xl border p-3">
                    <div className="from-primary/20 to-accent/20 mb-2 h-20 rounded-lg bg-gradient-to-br" />
                    <p className="text-foreground text-sm font-semibold">
                      Trendy Studio
                    </p>
                    <p className="text-muted-foreground text-xs">
                      ⭐ 5,0 · 1.743 mnenj
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <CalendarIcon
                        size={12}
                        className="text-muted-foreground"
                      />
                      <span className="text-muted-foreground text-xs">
                        Odprto danes 9:00–18:00
                      </span>
                    </div>
                  </div>

                  {/* Bottom nav */}
                  <div className="mt-4 flex items-center justify-around border-t pt-4">
                    {[
                      { icon: "🏠", label: "Domov" },
                      { icon: "🔍", label: "Išči" },
                      { icon: "📅", label: "Termini" },
                      { icon: "👤", label: "Profil" },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="text-lg">{item.icon}</div>
                        <p className="text-muted-foreground text-[10px]">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
