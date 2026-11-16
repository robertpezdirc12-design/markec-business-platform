// ============================================================
// SERVICES PRICE LIST (Fresha-inspired 2026-11-15)
// Public-facing price list with categories.
// Like Fresha's "Services" catalog — clean, elegant, mobile-first.
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClockIcon, ArrowRightIcon, StarIcon } from "@/components/icons"

interface PriceListItem {
  name: string
  description?: string | null
  price: number
  duration?: number | null
  isFeatured?: boolean
  imageUrl?: string | null
  bookingUrl?: string
}

interface PriceListCategory {
  name: string
  description?: string | null
  items: PriceListItem[]
}

interface ServicesPriceListProps {
  categories: PriceListCategory[]
  businessName?: string
  showBookButton?: boolean
}

function PriceListRow({ item }: { item: PriceListItem }) {
  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{item.name}</h4>
          {item.isFeatured && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <StarIcon size={10} className="mr-1" />
              Priporočeno
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
        {item.duration && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon size={12} />
            {item.duration} minut
          </div>
        )}
      </div>
      <div className="ml-4 text-right">
        <p className="text-lg font-semibold">{item.price} €</p>
        {item.bookingUrl && (
          <Link href={item.bookingUrl}>
            <Button variant="ghost" size="sm" className="mt-1">
              Rezerviraj
              <ArrowRightIcon size={12} className="ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export function ServicesPriceList({
  categories,
  businessName,
  showBookButton = true,
}: ServicesPriceListProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      {businessName && (
        <div className="text-center">
          <h2 className="text-3xl font-bold">{businessName}</h2>
          <p className="mt-2 text-muted-foreground">
            Naša ponudba storitev in cenik
          </p>
        </div>
      )}

      {/* Categories */}
      {categories.map((category, categoryIndex) => (
        <Card key={category.name}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                {categoryIndex + 1}
              </span>
              {category.name}
            </CardTitle>
            {category.description && (
              <p className="text-muted-foreground">{category.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {category.items.map((item, itemIndex) => (
                <div key={item.name}>
                  <PriceListRow item={item} />
                  {itemIndex < category.items.length - 1 && (
                    <Separator className="opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Book Now CTA */}
      {showBookButton && (
        <div className="text-center">
          <Link href="/booking">
            <Button size="lg" className="px-8">
              Rezervirajte termin zdaj
              <ArrowRightIcon size={16} className="ml-2" />
            </Button>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Enostavna spletna rezervacija 24/7
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMPACT PRICE LIST (for embedding in pages)
// ============================================================

export function CompactPriceList({ items }: { items: PriceListItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.name}
          className="flex items-center justify-between rounded-lg border px-4 py-2"
        >
          <div>
            <p className="font-medium">{item.name}</p>
            {item.duration && (
              <p className="text-xs text-muted-foreground">{item.duration} min</p>
            )}
          </div>
          <p className="font-semibold">{item.price} €</p>
        </div>
      ))}
    </div>
  )
}
