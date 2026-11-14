"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { submitStockTake } from "@/app/actions/inventory"
import { useI18n } from "@/lib/i18n/provider"

// ============================================================
// INVENTURA (#78, client) — prešteto vs. sistem, živa razlika.
// Submit pošlje VSAKA vnesena polje; akcija zapiše SAMO neničelne
// razlike kot STOCKTAKE premike (v eni transakciji).
// Oznake: useI18n() (client bundle) — funkcije v slovarju niso
// serijalizabilne čez RSC mejo.
// ============================================================

interface StocktakeVariant {
  id: string
  name: string
  sku: string | null
  stockQuantity: number
}

interface StocktakeProduct {
  id: string
  name: string
  sku: string | null
  unit: string
  stockQuantity: number
  variants: StocktakeVariant[]
}

interface StocktakeClientProps {
  products: StocktakeProduct[]
}

type RowKey = string // "productId" ali "productId::variantId"

/** Enoličen niz vrstice za izdelek oz. posamezno varianto. */
function rowKey(productId: string, variantId?: string | null): RowKey {
  return variantId ? `${productId}::${variantId}` : productId
}

export function StocktakeClient({ products }: StocktakeClientProps) {
  const router = useRouter()
  const { t } = useI18n()
  const labels = t.products
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const [counted, setCounted] = useState<Record<RowKey, string>>({})

  // Vrstice za inventuro — za variant-led izdelek ena vrstica NA VARIANTO,
  // sicer ena za izdelek. Nikoli oboje (ne dvojnega štetja).
  const rows = useMemo(() => {
    const out: {
      key: RowKey
      productId: string
      product: StocktakeProduct
      variant: StocktakeVariant | null
      system: number
      label: string
      sku: string | null
    }[] = []
    for (const p of products) {
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          out.push({
            key: rowKey(p.id, v.id),
            productId: p.id,
            product: p,
            variant: v,
            system: v.stockQuantity,
            label: `${p.name} — ${v.name}`,
            sku: v.sku ?? p.sku,
          })
        }
      } else {
        out.push({
          key: rowKey(p.id),
          productId: p.id,
          product: p,
          variant: null,
          system: p.stockQuantity,
          label: p.name,
          sku: p.sku,
        })
      }
    }
    return out
  }, [products])

  const deltas = useMemo(() => {
    const map: Record<RowKey, number | null> = {}
    for (const r of rows) {
      const raw = counted[r.key]
      if (raw === undefined || raw === "") {
        map[r.key] = null
        continue
      }
      const n = Number(raw)
      map[r.key] = Number.isInteger(n) && n >= 0 ? n - r.system : null
    }
    return map
  }, [counted, rows])

  const filledCount = Object.values(deltas).filter((d) => d !== null).length

  const handleSubmit = () => {
    const lines = rows
      .filter((r) => deltas[r.key] !== null)
      .map((r) => ({
        productId: r.productId,
        productVariantId: r.variant?.id ?? null,
        counted: Number(counted[r.key]),
      }))

    if (lines.length === 0) {
      toast.error(labels.stocktakeEmpty)
      return
    }

    startTransition(async () => {
      const result = await submitStockTake({ note: note.trim() || undefined, lines })
      if (result.ok) {
        const adjusted = result.adjusted?.length ?? 0
        if (adjusted === 0) {
          toast.info(labels.stocktakeNoDeltas)
        } else {
          toast.success(labels.stocktakeSuccess(adjusted))
        }
        setCounted({})
        setNote("")
        router.refresh()
      } else {
        toast.error(labels.stocktakeSubmit)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{labels.stocktakeEmpty}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{labels.stocktakeTitle}</CardTitle>
          <CardDescription>
            {labels.totalProductsCount(rows.length)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="no-print"
          >
            {labels.stocktakePrint}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || filledCount === 0}>
            {isPending && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
            {labels.stocktakeSubmit}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="stocktake-note" className="no-print">
            {labels.stocktakeNoteLabel}
          </Label>
          <Input
            id="stocktake-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="no-print max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">{labels.colProduct}</th>
                <th className="pb-3 font-medium">{labels.colSku}</th>
                <th className="pb-3 text-right font-medium">{labels.stocktakeSystemLabel}</th>
                <th className="no-print pb-3 text-right font-medium">
                  {labels.stocktakeCountedLabel}
                </th>
                <th className="no-print pb-3 text-right font-medium">
                  {labels.stocktakeDeltaLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const delta = deltas[r.key]
                return (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-3 font-medium">{r.label}</td>
                    <td className="text-muted-foreground py-3 font-mono text-sm">
                      {r.sku || "—"}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {r.system} {r.product.unit}
                    </td>
                    <td className="no-print py-3 text-right">
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-label={`${labels.stocktakeCountedLabel}: ${r.label}`}
                        value={counted[r.key] ?? ""}
                        onChange={(e) =>
                          setCounted((prev) => ({ ...prev, [r.key]: e.target.value }))
                        }
                        className="ml-auto w-24 text-right"
                      />
                    </td>
                    <td
                      className={`no-print py-3 text-right font-mono font-medium ${
                        delta === null || delta === 0
                          ? "text-muted-foreground"
                          : delta > 0
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    >
                      {delta === null
                        ? "—"
                        : delta > 0
                          ? `+${delta}`
                          : String(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
