"use client"

// #108 — 1-klik ponovni nakup. Gumb na strani podrobnosti naročila
// (Moja naročila → Naročilo → "Ponovi naročilo"). Pokliče server akcijo,
// ki preracuna cene/zalogo in odpre Stripe Checkout z istimi izdelki.

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowsClockwise as RepeatIcon } from "@phosphor-icons/react/dist/ssr"
import { reorderFromOrder } from "@/app/actions/orders"

interface ReorderButtonProps {
  orderId: string
  /** Ime organizacije za tenant-prefixed redirect. */
  orgSlug?: string | null
}

export function ReorderButton({ orderId, orgSlug }: ReorderButtonProps) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleReorder() {
    startTransition(async () => {
      const result = await reorderFromOrder(orderId)
      if (result.success && result.checkoutUrl) {
        if (result.skipped?.length) {
          toast.warning(
            `Nekateri izdelki niso več na voljo: ${result.skipped.join(", ")}. Preostali so dodani v košarico.`
          )
        }
        setDone(true)
        window.location.assign(result.checkoutUrl)
      } else {
        toast.error(result.error ?? "Ponovni nakup ni uspel.")
      }
    })
  }

  return (
    <Button
      onClick={handleReorder}
      disabled={pending || done}
      className="w-full"
      variant="outline"
    >
      <RepeatIcon size={16} className="mr-2" />
      {pending ? "Pripravljam …" : "Ponovi naročilo"}
    </Button>
  )
}
