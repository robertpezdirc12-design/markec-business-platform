"use client"

// ============================================================
// NEPOSREDNA PRODAJA (2D-1O) — admin dialog za ročno naročilo
// brez Stripe (gotovina / nakazilo). Kliče `createDirectOrder`.
// Validacije potekajo strežniško; tu le pošljemo vnos in pokažemo
// rezultat / napake.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createDirectOrder } from "@/app/actions/direct-sale"

export interface SellableLine {
  productId: string
  productName: string
  price: number
  variantId?: string | null
  variantName?: string | null
}

export interface DirectSaleCustomer {
  id: string
  name: string
  email?: string | null
}

// 2D-1P — razpoložljive serije za posamezno prodajno linijo.
export interface LineBatchOption {
  productId: string
  variantId: string | null
  batches: { batchId: string; batchCode: string; available: number }[]
}

interface Props {
  lines: SellableLine[]
  customers: DirectSaleCustomer[]
  batchesByLine?: LineBatchOption[]
}

const PAY_METHODS = [
  { value: "offline", label: "Ob prevzemu" },
  { value: "cash", label: "Gotovina" },
  { value: "transfer", label: "Nakazilo" },
] as const

export function DirectSaleDialog({ lines, customers, batchesByLine = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [line, setLine] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [customerId, setCustomerId] = useState<string>("")
  const [payment, setPayment] = useState<string>("offline")
  const [pending, start] = useTransition()
  // 2D-1P — izbira prodaje iz serije (avtoritativna neto zaloga serije).
  const [batchCode, setBatchCode] = useState<string>("")

  const chosen = lines[line]
  const chosenBatches = batchesByLine.find(
    (b) =>
      b.productId === chosen?.productId &&
      (chosen?.variantId ? b.variantId === chosen.variantId : b.variantId === null)
  )?.batches

  const submit = () => {
    if (!chosen) return
    const selectedBatch = chosenBatches?.find((b) => b.batchCode === batchCode)
    start(async () => {
      const res = await createDirectOrder({
        lines: [
          {
            productId: chosen.productId,
            productVariantId: chosen.variantId ?? null,
            quantity,
            ...(selectedBatch
              ? { batchAllocations: [{ batchRecordId: selectedBatch.batchId, quantity }] }
              : {}),
          },
        ],
        customerId: customerId || null,
        paymentMethod: payment as "offline" | "cash" | "transfer" | "online",
        notes: "Neposredna prodaja (brez spletnega plačila).",
      })
      if (!res.success) {
        toast.error(errorText(res.error))
        return
      }
      toast.success("Neposredna prodaja zabeležena.")
      setOpen(false)
      router.push(`/dashboard/orders/${res.orderId}`)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Neposredna prodaja</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neposredna prodaja (brez Stripe)</DialogTitle>
          <DialogDescription>
            Preproda izdelek/različico, zabeležite plačilo in zniža se razpoložljiva zaloga.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Izdelek / različica</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={line}
              onChange={(e) => setLine(Number(e.target.value))}
            >
              {lines.map((l, i) => (
                <option key={`${l.productId}-${l.variantId}`} value={i}>
                  {l.productName}
                  {l.variantName ? ` · ${l.variantName}` : ""} — {l.price.toFixed(2)} €
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Količina</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          {chosenBatches && chosenBatches.length > 0 && (
            <div className="space-y-1">
              <Label>Proda iz serije (sledljivost)</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
              >
                <option value="">— Brez serije (splošna zaloga) —</option>
                {chosenBatches.map((b) => (
                  <option key={b.batchId} value={b.batchCode}>
                    {b.batchCode} — na voljo {b.available} kos
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Kupec (neobvezno)</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— Brez stranke —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Način plačila</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Prekliči</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Ustvarjam …" : "Ustvari naročilo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function errorText(code?: string): string {
  switch (code) {
    case "INSUFFICIENT_STOCK":
      return "Ni zadostne zaloge."
    case "BATCH_INSUFFICIENT":
      return "V izbrani seriji ni zadostne količine."
    case "BATCH_ALLOCATION_MISMATCH":
      return "Alokacija serije ne ustreza količini."
    case "BATCH_NOT_FOUND":
      return "Izbrana serija ne obstaja."
    case "NOT_TRACKED":
      return "Izdelek ne vodi zaloge."
    case "ONLINE_NOT_SUPPORTED":
      return "Spletno plačilo v neposredni prodaji ni podprto."
    default:
      return code ? `Napaka (${code}).` : "Napaka pri prodaji."
  }
}