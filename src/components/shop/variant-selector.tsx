"use client"

// F5.5.1 — izbira različice izdelka na javni trgovini.
// Kupec izbere različico → vidi pravo ceno in razpoložljivost → doda točno
// to različico v košarico. Izdelek brez različic (variants.length === 0)
// prikaže navaden gumb (nespremenjen tok).

import { useState } from "react"
import { cn } from "@/lib/utils"
import { AddToCartButton } from "@/components/shop/add-to-cart-button"

export interface PublicVariant {
  id: string
  name: string
  sku: string | null
  price: number | null
  stockQuantity: number
}

interface VariantSelectorProps {
  productId: string
  productName: string
  image: string | null
  basePrice: number
  /** Zaloga izdelka brez različic (uporabljena le, ko variants.length === 0). */
  baseStockQuantity: number
  variants: PublicVariant[]
}

export function VariantSelector({
  productId,
  productName,
  image,
  basePrice,
  baseStockQuantity,
  variants,
}: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    variants.length > 0 ? variants[0].id : null
  )

  if (variants.length === 0) {
    // Izdelek brez različic — originalni tok.
    const inStock = baseStockQuantity > 0
    return (
      <AddToCartButton
        product={{ id: productId, name: productName, image, price: basePrice }}
        inStock={inStock}
        stockQuantity={baseStockQuantity}
      />
    )
  }

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const price = selected.price ?? basePrice
  const inStock = selected.stockQuantity > 0

  return (
    <div className="space-y-4">
      {/* Izbira različice */}
      <div>
        <p className="mb-2 text-sm font-medium">Različica</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const isSel = v.id === selected.id
            const out = v.stockQuantity <= 0
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                disabled={v.stockQuantity <= 0}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  isSel
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-muted/50",
                  out && "opacity-50 line-through"
                )}
              >
                {v.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cena izbrane različice */}
      <p className="text-2xl font-semibold">{price.toFixed(2)} €</p>
      {!inStock && (
        <p className="text-sm text-destructive">
          Ta različica trenutno ni na zalogi.
        </p>
      )}

      <AddToCartButton
        product={{
          id: productId,
          name: productName,
          image,
          price,
        }}
        inStock={inStock}
        stockQuantity={selected.stockQuantity}
        variantId={selected.id}
        variantName={selected.name}
        variantSku={selected.sku}
      />
    </div>
  )
}