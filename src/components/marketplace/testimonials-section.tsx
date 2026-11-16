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

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Lucy",
    location: "London, VB",
    avatar: "/avatars/lucy.jpg",
    rating: 5,
    quote:
      "Odlična izkušnja, enostavna rezervacija. Plačilo zdravljenja je tako priročno — ne potrebujete gotovine ali kartice!",
    service: "Kozmetična nega",
    date: "pred 2 dnevoma",
  },
  {
    id: "2",
    name: "Dan",
    location: "New York, ZDA",
    avatar: "/avatars/dan.jpg",
    rating: 5,
    quote:
      "Freshini opomniki olajšajo življenje. Našel sem tudi nekaj dobrih brivcev, do katerih nisem vedel, in obstajajo.",
    service: "Stiženje",
    date: "pred 1 tednom",
  },
  {
    id: "3",
    name: "Dale",
    location: "Sydney, Avstralija",
    avatar: "/avatars/dale.jpg",
    rating: 5,
    quote:
      "Fresho uporabljam že dve leti in je daleč najboljša rezervacijska platforma, ki sem jo uporabil. Toplo priporočam!",
    service: "Masaža",
    date: "pred 3 dnevi",
  },
  {
    id: "4",
    name: "Cameron",
    location: "Edinburgh, Združeno kraljestvo",
    avatar: "/avatars/cameron.jpg",
    rating: 5,
    quote:
      "Moj nasvet za samoskrbo: Fresha je moja priljubljena aplikacija za masaže in obrazne tretmaje. Z lahko najdem rezervacijo preprosto — to mi je všeč!",
    service: "Obrazna nega",
    date: "pred 5 dnevi",
  },
  {
    id: "5",
    name: "Ana",
    location: "Ljubljana, Slovenija",
    avatar: "/avatars/ana.jpg",
    rating: 5,
    quote:
      "Končno imam vse na enem mestu. Rezervacije, opomniki, plačila — vse deluje brezhibno. Priporočam vsakemu salonu!",
    service: "Wellness",
    date: "pred 1 dnevom",
  },
  {
    id: "6",
    name: "Marko",
    location: "Maribor, Slovenija",
    avatar: "/avatars/marko.jpg",
    rating: 5,
    quote:
      "Kot lastnik salona sem navdušen. MARKEC mi je prihranil ure dela tedensko. Stranke so zadovoljne, jaz pa tudi.",
    service: "Poslovna stran",
    date: "pred 1 tednom",
  },
]

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

export function TestimonialsSection() {
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