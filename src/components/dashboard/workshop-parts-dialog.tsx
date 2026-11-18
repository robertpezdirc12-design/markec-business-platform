"use client"

// ============================================================
// 2D-1S — poraba/prodaja delov na delovnem nalogu + montaža gum.
// Kliče zstrežniške akcije (org-scoped, transakcija).
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { sellPartsOnWorkOrder, recordTireSetEvent, type WorkOrderPartsResult } from "@/app/actions/vehicle-workshop"

export interface PartOption {
  productId: string
  productName: string
  price: number
  variants: { id: string; name: string; price: number }[]
}
export interface WorkshopOptions {
  vehicles: { id: string; title: string; licensePlate: string }[]
  tireSets: { id: string; title: string; dimension: string; season: string; vehicleId: string | null }[]
  products: PartOption[]
  workOrders: { id: string; number: number; title: string }[]
}

interface Props {
  options: WorkshopOptions
}

export function PartsDialogClient({ options }: Props) {
  const router = useRouter()
  const [, setOpen] = useState(false)
  // Poraba delov
  const [workOrderId, setWorkOrderId] = useState("")
  const [productIdx, setProductIdx] = useState(0)
  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)
  // Montaža gum
  const [tireSetId, setTireSetId] = useState(options.tireSets[0]?.id ?? "")
  const [mountVehicleId, setMountVehicleId] = useState("")
  const [eventType, setEventType] = useState<string>("MOUNT")
  const [treadMm, setTreadMm] = useState("")
  const [pending, start] = useTransition()

  const product = options.products[productIdx]
  const workOrdersList = options.workOrders

  const submitParts = () => {
    if (!workOrderId || !product || quantity < 1) {
      toast.error("Izberite delovni nalog, izdelek in količino.")
      return
    }
    start(async () => {
      const res = await sellPartsOnWorkOrder({
        workOrderId,
        lines: [{ productId: product.productId, productVariantId: variantId || null, quantity }],
        notes: "Poraba delov na nalogu",
      })
      if (!res.ok) {
        toast.error(errorText(res))
        return
      }
      toast.success("Poraba delov zabeležena; zaloga znižana.")
      setOpen(false)
      router.refresh()
    })
  }

  const submitTire = () => {
    if (!tireSetId) {
      toast.error("Izberite komplet pnevmatik.")
      return
    }
    start(async () => {
      const res = await recordTireSetEvent({
        tireSetId,
        eventType: eventType as "MOUNT" | "DEMOUNT" | "MOVE" | "STORAGE" | "STATUS",
        vehicleId: mountVehicleId || null,
        eventDate: undefined,
        treadMm: treadMm ? Number(treadMm) : null,
        workOrderId: workOrderId || null,
      })
      if (!res.ok) {
        toast.error(res.error === "TIRE_SET_NOT_FOUND" ? "Komplet ne obstaja." : errorText(res as WorkOrderPartsResult))
        return
      }
      toast.success("Dogodek na kompletu zabeležen.")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Poraba / prodaja delov na delovnem nalogu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ws-wo">Delovni nalog</Label>
            <select id="ws-wo" className="w-full rounded-md border px-3 py-2 text-sm" value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
              <option value="">— Izberite nalog —</option>
              {workOrdersList.map((w) => (
                <option key={w.id} value={w.id}>#{w.number} — {w.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-product">Izdelek / del</Label>
            <select id="ws-product" className="w-full rounded-md border px-3 py-2 text-sm" value={productIdx} onChange={(e) => { setProductIdx(Number(e.target.value)); setVariantId("") }}>
              {options.products.map((p, i) => (
                <option key={p.productId} value={i}>{p.productName}</option>
              ))}
            </select>
            {product && product.variants.length > 0 && (
              <select id="ws-variant" className="w-full rounded-md border px-3 py-2 text-sm" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">Brez različice</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-qty">Količina</Label>
            <Input id="ws-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <Button onClick={submitParts} disabled={pending || !workOrderId || !product}>
            {pending ? "Shranjujem …" : "Zabeleži porabo delov"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Montaža / demontaža pnevmatik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ws-tireset">Komplet pnevmatik</Label>
            <select id="ws-tireset" className="w-full rounded-md border px-3 py-2 text-sm" value={tireSetId} onChange={(e) => setTireSetId(e.target.value)}>
              {options.tireSets.map((t) => (
                <option key={t.id} value={t.id}>{t.title} — {t.dimension} ({t.season})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-tireevent">Dogodek</Label>
            <select id="ws-tireevent" className="w-full rounded-md border px-3 py-2 text-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="MOUNT">Montaža</option>
              <option value="DEMOUNT">Demontaža</option>
              <option value="MOVE">Selitev</option>
              <option value="STORAGE">Shranjevanje</option>
              <option value="STATUS">Stanje</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-tirevehicle">Vozilo (neobvezno)</Label>
            <select id="ws-tirevehicle" className="w-full rounded-md border px-3 py-2 text-sm" value={mountVehicleId} onChange={(e) => setMountVehicleId(e.target.value)}>
              <option value="">— Brez vozila —</option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.title}{v.licensePlate ? ` (${v.licensePlate})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ws-tread">Globina tekalne plasti (mm)</Label>
            <Input id="ws-tread" type="number" step="0.5" value={treadMm} onChange={(e) => setTreadMm(e.target.value)} />
          </div>
          <Button onClick={submitTire} disabled={pending || !tireSetId}>
            {pending ? "Shranjujem …" : "Zabeleži dogodek na kompletu"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Klient-posedovana lahka vrednost: delovni nalogi prihajajo iz strežnika
// prek `options.workOrders` (listWorkshopOptions). Prazen seznam = ni odprtih
// nalogov, od uporabnika se zahteva izbira naloga za porabo delov.
function errorText(res: WorkOrderPartsResult): string {
  switch (res.error) {
    case "INSUFFICIENT_STOCK": return "Ni zadostne zaloge."
    case "NOT_TRACKED": return "Izdelek ne vodi zaloge."
    case "WORKORDER_NOT_FOUND": return "Delovni nalog ne obstaja."
    case "NOT_FOUND": return "Izdelek ni najden."
    case "VALIDATION": return "Preverite vnose."
    default: return res.error ? `Napaka (${res.error}).` : "Napaka."
  }
}