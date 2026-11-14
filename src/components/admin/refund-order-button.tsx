"use client"

// P3-H — gumb za vračilo naročila v podrobnostih naročila.
// Viden samo za refundabilna stanja (PAID/COMPLETED); po kliku vpraša za
// potrditev, pokliče server action refundOrder in osveži stran.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ArrowCounterClockwise, CircleNotch } from "@phosphor-icons/react/dist/ssr"
import { refundOrder } from "@/app/actions/orders"

interface RefundOrderButtonProps {
  orderId: string
  refundable: boolean
  /** Human-readable potrjen znesek (npr. "34,50 €") — pokaže se v opozorilu. */
  amountLabel?: string
}

export function RefundOrderButton({
  orderId,
  refundable,
  amountLabel,
}: RefundOrderButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!refundable) return null

  const onConfirm = () => {
    startTransition(async () => {
      const res = await refundOrder(orderId)
      if (!res.success) {
        toast.error(res.error || "Vračilo naročila ni uspelo.")
        return
      }
      toast.success(
        res.refundedAmount != null
          ? `Naročilo je refundirano (${amountLabel ?? "znesek"}).`
          : "Naročilo je refundirano."
      )
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
      >
        {pending ? (
          <CircleNotch size={16} className="animate-spin" />
        ) : (
          <ArrowCounterClockwise size={16} className="mr-1" />
        )}
        Vračilo
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Vračilo naročila"
        description={`Ste prepričani, da želite refundirati to naročilo${
          amountLabel ? ` (${amountLabel})` : ""
        }? Zaloga izdelkov se vrne, denarni znesek pa morate vrniti kupcu (npr. offline ali prek Stripe Dashboard).`}
        confirmLabel="Refundiraj naročilo"
        onConfirm={onConfirm}
        variant="destructive"
      />
    </>
  )
}