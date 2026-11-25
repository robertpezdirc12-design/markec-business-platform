"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart-store"
import { ShoppingCartIcon } from "@/components/icons"
import { useLocale, pick } from "@/lib/i18n/client-locale"

interface AddToCartButtonProps {
  product: {
    id: string
    name: string
    image: string | null
    price: number
  }
  inStock?: boolean
  /** P1 #37 (re-audit 2026-11): zaloga se shrani v košarico, da UI lahko
   * omeji količino (max) in javi \"Na zalogi je le še X kos\". */
  stockQuantity?: number | null
  /** F5.5.1 — izbrana različica (optional). Ko je podan variantId, se v
   * košarico doda točno ta različica (ločeno od drugih variant istega
   * izdelka), s pravo ceno in nazivom različice. */
  variantId?: string | null
  variantName?: string | null
  variantSku?: string | null
}
export function AddToCartButton({
  product,
  inStock = true,
  stockQuantity = null,
  variantId,
  variantName,
  variantSku,
}: AddToCartButtonProps) {
  const { addItem } = useCartStore()
  const locale = useLocale()
  const [pulsing, setPulsing] = useState(false)
  const [added, setAdded] = useState(false)
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const announceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = variantName ? `${product.name} — ${variantName}` : product.name

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: label,
      image: product.image,
      price: product.price,
      stockQuantity,
      variantId,
      variantName,
      variantSku,
    })

    if (pulseTimeout.current) clearTimeout(pulseTimeout.current)
    setPulsing(true)
    pulseTimeout.current = setTimeout(() => setPulsing(false), 150)
    // AT (WCAG 4.1.3 / NN/g feedback): "Dodano v košarico" za bralnik —
    // vizualni pulse bralnik ne zazna. Live regija je stalno v DOM.
    if (announceTimeout.current) clearTimeout(announceTimeout.current)
    setAdded(true)
    announceTimeout.current = setTimeout(() => setAdded(false), 1600)
  }
  return (
    <>
      {/* Live regija stalno v DOM — bralnik napove "Dodano v košarico"
          tudi če je vizualni pulse ne-viden (WCAG 4.1.3). */}
      <p role="status" className="sr-only" aria-live="polite">
        {added ? pick(locale, "Dodano v košarico", "Added to cart") : ""}
      </p>
      <Button
      onClick={handleAddToCart}
      variant={inStock ? "default" : "secondary"}
      disabled={!inStock}
      aria-label={inStock ? pick(locale, `Dodaj v košarico: ${label}`, `Add to cart: ${label}`) : undefined}
      className={`w-full transition-transform duration-150 ${pulsing ? "scale-[1.05]" : "scale-100"}`}
    >
      <ShoppingCartIcon className="mr-2 h-4 w-4" />
      {inStock ? pick(locale, "Dodaj v košarico", "Add to cart") : pick(locale, "Ni na zalogi", "Out of stock")}
    </Button>
    </>
  )
}
