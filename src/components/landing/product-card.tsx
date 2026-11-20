"use client"
import { useFormatPrice } from "@/lib/currency"
import { useEffect, useRef, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"
import Image from "next/image"
import { ToteIcon, CheckIcon } from "@/components/icons"
import { useCartStore } from "@/store/cart-store"
import { useI18n } from "@/lib/i18n/context"

interface ProductCardProps {
  id: string
  name: string
  price: number
  category: string
  image?: string | null
  /** Prefix for internal links, e.g. "/s/salon-luna" on tenant sites. */
  hrefPrefix?: string
}

export function ProductCard({ id, name, price, category, image, hrefPrefix = "" }: ProductCardProps) {
  const fmt = useFormatPrice()
  const addItem = useCartStore((state) => state.addItem)
  const { t } = useI18n()

  const [added, setAdded] = useState(false)
  const announceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (announceTimeout.current) clearTimeout(announceTimeout.current)
  }, [])

  const handleAddToCart = () => {
    addItem({
      productId: id,
      name,
      image: image ?? null,
      price,
    })
    // AT + vizualni feedback: dodajanje v košarico mora biti nedvoumno
    // (NN/g feedback / WCAG 4.1.3) — live regija stalno v DOM.
    if (announceTimeout.current) clearTimeout(announceTimeout.current)
    setAdded(true)
    announceTimeout.current = setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Card className="group border-primary/10 overflow-hidden transition-all duration-300 hover:shadow-xl">
      <div className="bg-muted/30 relative aspect-square overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
          
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"/>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
            <ToteIcon size={48} weight="light" className="text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs font-semibold">
            {category}
          </span>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-lg group-hover:text-accent-text transition-colors">{name}</CardTitle>
        <CardDescription className="text-primary-text text-xl font-bold group-hover:text-accent-text transition-colors">
          {fmt(price)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {/* P1 #8 (audit-2026-11): asChild — single tab stop, no <a><button>. */}
          <Button
            asChild
            variant="outline"
            className="w-full border-primary/50 hover:bg-primary hover:text-primary-foreground"
          >
            <Link href={`${hrefPrefix}/shop/${id}`}>{t.public.details}</Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleAddToCart}
                aria-label={t.public.addToCartNamed(name)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {added ? <CheckIcon size={16} aria-hidden /> : <ToteIcon size={16} aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t.public.addToCart}</p>
            </TooltipContent>
          </Tooltip>
          {/* Live regija stalno v DOM — bralnik napove "Dodano v košarico"
              (vizualna sprememba ikone je za AT ne-vidna; WCAG 4.1.3). */}
          <p role="status" className="sr-only" aria-live="polite">
            {added ? t.public.addedToCart : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
