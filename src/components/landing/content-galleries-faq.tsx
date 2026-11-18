"use client"

// F5.5.2 — javini prikaz GALERIJ in FAQ na spletni strani podjetja.
// Bere samo OBJAVLJENE + javne (isPublic && isPublished) vsebine.

import Image from "next/image"
import { useState } from "react"
import type { PublicGalleryDTO } from "@/app/actions/galleries"
import type { PublicFaqDTO } from "@/app/actions/faq"

export function GalleriesSection({ galleries }: { galleries: PublicGalleryDTO[] }) {
  if (galleries.length === 0) return null
  return (
    <section id="galerija" className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="font-heading mb-10 text-center text-3xl font-bold md:text-4xl">
          Galerija
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.flatMap((g) =>
            g.items.map((item, idx) => (
              <figure
                key={`${g.id}-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border/50"
              >
                <Image
                  src={item.mediaId}
                  alt={item.alt || g.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                {item.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8 text-sm text-white">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export function FaqSection({ faq }: { faq: PublicFaqDTO[] }) {
  const [open, setOpen] = useState<number | null>(0)
  if (faq.length === 0) return null
  return (
    <section id="pogosta-vprasanja" className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="font-heading mb-8 text-center text-3xl font-bold md:text-4xl">
          Pogosta vprašanja
        </h2>
        <div className="mx-auto max-w-3xl space-y-3">
          {faq.map((item, idx) => {
            const isOpen = open === idx
            return (
              <div key={item.id} className="border-b border-border/60">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left"
                >
                  <span className="font-medium">{item.question}</span>
                  <span aria-hidden className="text-muted-foreground">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p className="pb-4 text-muted-foreground">{item.answer}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}