"use client"

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
  }
  return (
    <Button onClick={handleAddToCart} variant={inStock ? "default" : "secondary"}  disabled={!inStock} className="w-full">
      <ShoppingCartIcon className="mr-2 h-4 w-4" />
      {inStock ? pick(locale, "Dodaj v košarico", "Add to cart") : pick(locale, "Ni na zalogi", "Out of stock")}
    </Button>
  )
}
