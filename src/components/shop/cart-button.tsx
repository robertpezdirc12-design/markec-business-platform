"use client"

import { Button } from "@/components/ui/button"
import { ShoppingCartIcon } from "@/components/icons"
import { useCartStore } from "@/store/cart-store"
import { useOrgPrefix } from "@/lib/org-path-hooks"
import { useRouter } from "next/navigation"
import { useLocale, pick } from "@/lib/i18n/client-locale"

interface CartButtonProps {
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  mobile?: boolean
}

export function CartButton({
  size = "lg",
  className = "",
  mobile = false,
}: CartButtonProps) {
  const itemCount = useCartStore((state) => state.getTotalItems())
  const router = useRouter()
  const prefix = useOrgPrefix()
  const locale = useLocale()

  return (
    <Button
      onClick={() => router.push(`${prefix}/cart`)}
      size={size}
      className={`${mobile ? "rounded-full shadow-lg" : ""} ${className}`}
    >
      <ShoppingCartIcon size={20} weight="regular" className="mr-2" />
      {pick(locale, "Košarica", "Cart")} {itemCount > 0 && `(${itemCount})`}
    </Button>
  )
}
