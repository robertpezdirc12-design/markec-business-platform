"use client"

// ============================================================
// SLEDLJIVOST — polnjenje pridelka v proizvodno serijo (2D-1P).
// Stranka: izbere pridelek, serijo (obstoječo ali novo), izdelek/
// različico ter zapiše količino in dejansko porabljeno kg. Kliče
// createFillBatch (strežniško, org-scoped, transakcija + rollback).
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createFillBatch } from "@/app/actions/traceability"

export interface FillHarvest {
  id: string
  title: string
  honeyType: string
  quantityKg: number
  remainingKg: number
}
export interface FillBatch {
  id: string
  code: string
  title: string
}
export interface FillProduct {
  productId: string
  productName: string
  variants: { id: string; name: string }[]
}

interface Props {
  harvests: FillHarvest[]
  batches: FillBatch[]
  products: FillProduct[]
}

export function FillBatchDialog({ harvests, batches, products }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [harvestId, setHarvestId] = useState(harvests[0]?.id ?? "")
  const [batchMode, setBatchMode] = useState<"existing" | "new">("new")
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "")
  const [batchCode, setBatchCode] = useState("")
  const [productIdx, setProductIdx] = useState(0)
  const [variantId, setVariantId] = useState("")
  const [units, setUnits] = useState(1)
  const [packedKg, setPackedKg] = useState(1)
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [pending, start] = useTransition()

  const product = products[productIdx]

  const submit = () => {
    const key =
      idempotencyKey.trim() ||
      `fill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    start(async () => {
      if (!harvestId || !product) {
        toast.error("Izberite pridelek in izdelek.")
        return
      }
      const res = await createFillBatch({
        harvestIds: [harvestId],
        ...(batchMode === "existing"
          ? { batchId }
          : { batchCode: batchCode.trim() || undefined }),
        productId: product.productId,
        productVariantId: variantId || null,
        units: Math.max(1, units),
        packedKg: Math.max(0.001, packedKg),
        idempotencyKey: key,
      })
      if (!res.ok) {
        toast.error(errorText(res.error))
        return
      }
      toast.success("Polnjenje zabeleženo; zaloga povečana.")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Polnjenje pridelka v serijo</h2>
          {!open && (
            <Button size="sm" onClick={() => setOpen(true)}>
              + Novo polnjenje
            </Button>
          )}
        </div>

        {open && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Pridelek</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={harvestId}
                onChange={(e) => setHarvestId(e.target.value)}
              >
                {harvests.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} — {h.honeyType} (ostane {h.remainingKg.toFixed(2)} kg)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Serija</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={batchMode}
                onChange={(e) => setBatchMode(e.target.value as "existing" | "new")}
              >
                <option value="new">Nova serija</option>
                <option value="existing">Obstoječa serija</option>
              </select>
              {batchMode === "existing" ? (
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.title}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="Oznaka nove serije (npr. SERIJA-2026-01)"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label>Izdelek / različica</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={productIdx}
                onChange={(e) => {
                  setProductIdx(Number(e.target.value))
                  setVariantId("")
                }}
              >
                {products.map((p, i) => (
                  <option key={p.productId} value={i}>
                    {p.productName}
                  </option>
                ))}
              </select>
              {product && product.variants.length > 0 && (
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  <option value="">Brez različice (glavni izdelek)</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Število enot (v zalogo)</Label>
                <Input
                  type="number"
                  min={1}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>Porabljena kg iz pridelka</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.001}
                  value={packedKg}
                  onChange={(e) => setPackedKg(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Idempotency ključ (neobvezno; prepreči dvojno knjiženje)</Label>
              <Input
                placeholder="npr. fill-2026-01-15-r1"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <Button
                onClick={submit}
                disabled={
                  pending ||
                  !harvestId ||
                  !product ||
                  (batchMode === "existing" ? !batchId : !batchCode.trim())
                }
              >
                {pending ? "Shranjujem …" : "Zabeleži polnjenje"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function errorText(code?: string): string {
  switch (code) {
    case "INSUFFICIENT_HARVEST":
      return "Premalo razpoložljivega pridelka (porabljeno > pridelano)."
    case "HONEY_TYPE_MISMATCH":
      return "Ne morete mešati različnih vrst medu v enem polnjenju."
    case "DUPLICATE_FILL":
      return "Ta polnitev je že zabeležena (podvojen idempotency ključ)."
    case "BATCH_NOT_FOUND":
      return "Izbrana serija ne obstaja v tej organizaciji."
    case "HARVEST_NOT_FOUND":
      return "Izbrani pridelek ni več razpoložljiv."
    case "VALIDATION":
      return "Preverite vnose."
    default:
      return code ? `Napaka (${code}).` : "Napaka."
  }
}