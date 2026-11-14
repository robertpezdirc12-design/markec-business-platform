"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"
import { getPromotionRedemptions, type PromotionRedemptionRow } from "@/app/actions/promotions"

interface PromotionRedemptionsDialogProps {
  promotionId: string
  label: string
}

export function PromotionRedemptionsDialog({
  promotionId,
  label,
}: PromotionRedemptionsDialogProps) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PromotionRedemptionRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (rows) return
    setLoading(true)
    try {
      const res = await getPromotionRedemptions(promotionId, 1, 100)
      setRows(res.rows)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) load()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {label} {rows !== null ? `(${total})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? "uporaba" : total === 2 ? "uporabi" : "uporab"}
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex justify-center py-8">
            <SpinnerIcon size={24} />
          </div>
        )}
        {!loading && rows && rows.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            {label}
          </p>
        )}
        {!loading && rows && rows.length > 0 && (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Stranka</span>
              <span>Osnova</span>
              <span className="text-right">Popust</span>
              <span className="text-right">Uporabljeno</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-4 items-center gap-2 rounded-md border px-2 py-2 text-sm"
              >
                <span className="truncate">{r.guestEmail || r.customerId || "—"}</span>
                <span>{formatCurrency(r.baseAmount)}</span>
                <span className="text-right font-medium text-green-600">
                  -{formatCurrency(r.discountAmount)}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {formatDateStandard(r.createdAt, "sl")}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}