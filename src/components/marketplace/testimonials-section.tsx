"use client"

// ============================================================
// TESTIMONIALS SECTION (Fresha-inspired, superior 2026-11-16)
// Customer reviews with photos, quotes, locations, ratings.
// Surpasses Fresha with better visual design and carousel.
// ============================================================

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  StarIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "@/components/icons"
import { Quotes } from "@phosphor-icons/react/dist/ssr"

interface Testimonial {
  id: string
  name: string
  location: string
  avatar: string
  rating: number
  quote: string
  service: string
  date: string
}

// Audit 2026-11-17: prej je bil tu VGRAJEN seznam izmišljenih izjav
// ("Lucy, London", "Dan, New York", "Edinburgh, Združeno kraljestvo") z
// neobstoječimi avatarji. Na platformi ni bilo nobene resnične ocene, zato
// je šlo za lažne podatke. Zdaj izjave pridejo izključno od klicatelja
// (resnične ocene iz baze); brez njih se sekcija ne izpiše.

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="h-full transition-all hover:shadow-lg">
      <CardContent className="flex h-full flex-col p-6">
        {/* Quote Icon */}
        <div className="mb-4 text-primary/20">
          <Quotes size={32} />
        </div>

        {/* Rating */}
        <div className="mb-3 flex items-center gap-1">
          {Array.from({ length: testimonial.rating }).map((_, i) => (
            <StarIcon key={i} size={16} className="text-amber-400" weight="fill" />
          ))}
        </div>

        {/* Quote */}
        <blockquote className="flex-1 text-muted-foreground">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>

        {/* Author */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-lg font-semibold text-white">
            {testimonial.name[0]}
          </div>
          <div>
            <p className="font-semibold">{testimonial.name}</p>
            <p className="text-sm text-muted-foreground">
              {testimonial.location}
            </p>
          </div>
        </div>

        {/* Service Badge */}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {testimonial.service}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {testimonial.date}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function TestimonialsSection({
  testimonials = [],
}: {
  testimonials?: Testimonial[]
} = {}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 380
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  // Brez resničnih ocen sekcije NI — raje nič kot izmišljene stranke.
  // (Guard je za hooki, ker morajo hooki teči v istem vrstnem redu.)
  if (testimonials.length === 0) return null

  return (
    <section className="bg-gradient-to-b from-background via-muted/20 to-background py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2">
            <CheckCircleIcon size={18} className="text-green-500" />
            <span className="text-sm font-medium">
              Več kot 10.000 zadovoljnih strank
            </span>
          </div>

          <h2 className="text-3xl font-bold sm:text-4xl">
            Kaj pravijo naše stranke
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Preberite izkušnje ljudi, ki so že odkrili najboljše lokalne storitve
            prek MARKEC.
          </p>

          {/* Overall Rating */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <StarIcon key={i} size={24} className="text-amber-400" weight="fill" />
              ))}
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">4.9 / 5</p>
              <p className="text-sm text-muted-foreground">
                povprečna ocena
              </p>
            </div>
          </div>
        </div>

        {/* Carousel Controls */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Ocene</Badge>
            <span className="text-sm text-muted-foreground">
              {testimonials.length} mnenj
            </span>
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

        {/* Testimonials Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="w-80 shrink-0">
              <TestimonialCard testimonial={testimonial} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Button size="lg" className="gap-2">
            Preberite vse ocene
            <ArrowRightIcon size={18} />
          </Button>
        </div>
      </div>
    </section>
  )
}