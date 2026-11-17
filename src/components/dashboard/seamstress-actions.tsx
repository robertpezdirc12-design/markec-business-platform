"use client"

// 2D-2B — šiviljske hitre akcije: snemaj meritev in novo naročilo po meri.
// Kliče server akcije iz seamstress.ts (org-scoped).

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { saveMeasurement, createOrderFromInquiry } from "@/app/actions/seamstress"
import type { MeasurementItem } from "@/app/actions/seamstress"

interface Props {
  measurements: MeasurementItem[]
  customers?: { id: string; name: string }[]
}

export function SeamstressActions({ measurements, customers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [measureOpen, setMeasureOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Stranke za izbiro: iz meritev (server) + celoten seznam strank (server-provided).
  const knownCustomers = (customers ?? []).length > 0
    ? customers!
    : (measurements
        .filter((m) => m.customerId)
        .reduce<{ id: string; name: string }[]>((acc, m) => {
          if (!acc.some((c) => c.id === m.customerId)) acc.push({ id: m.customerId!, name: m.customerName ?? m.customerId! })
          return acc
        }, [])
      )

  // ---- Meritev ----
  const [form, setForm] = useState({
    customerId: "",
    measuredAt: new Date().toISOString().slice(0, 10),
    chestCm: "",
    waistCm: "",
    hipsCm: "",
    shoulderCm: "",
    sleeveCm: "",
    inseamCm: "",
    heightCm: "",
    byStaff: "",
    notes: "",
    orderRef: "",
  })
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  async function submitMeasure() {
    setError(null); setMessage(null)
    if (!form.customerId) { setError("Izberite stranko."); return }
    const res = await saveMeasurement({
      customerId: form.customerId,
      measuredAt: form.measuredAt,
      chestCm: form.chestCm ? Number(form.chestCm) : undefined,
      waistCm: form.waistCm ? Number(form.waistCm) : undefined,
      hipsCm: form.hipsCm ? Number(form.hipsCm) : undefined,
      shoulderCm: form.shoulderCm ? Number(form.shoulderCm) : undefined,
      sleeveCm: form.sleeveCm ? Number(form.sleeveCm) : undefined,
      inseamCm: form.inseamCm ? Number(form.inseamCm) : undefined,
      heightCm: form.heightCm ? Number(form.heightCm) : undefined,
      byStaff: form.byStaff || undefined,
      notes: form.notes || undefined,
      orderRef: form.orderRef || undefined,
    })
    if (!res.ok) { setError(res.error ?? "Napaka pri snemanju."); return }
    setMessage("Meritev shranjena.")
    setMeasureOpen(false)
    startTransition(() => router.refresh())
  }

  // ---- Naročilo ----
  const [order, setOrder] = useState({
    customerId: "",
    title: "",
    description: "",
    agreedPrice: "",
    deadline: "",
    measurementId: "",
  })
  const setOrderField = (k: keyof typeof order, v: string) => setOrder((p) => ({ ...p, [k]: v }))

  async function submitOrder() {
    setError(null); setMessage(null)
    if (!order.customerId) { setError("Izberite stranko."); return }
    if (!order.title) { setError("Vnesite naziv naročila."); return }
    const res = await createOrderFromInquiry({
      customerId: order.customerId,
      title: order.title,
      description: order.description || undefined,
      agreedPrice: order.agreedPrice ? Number(order.agreedPrice) : undefined,
      deadline: order.deadline || undefined,
      measurementId: order.measurementId || undefined,
    })
    if (!res.ok) { setError(res.error ?? "Napaka pri ustvarjanju."); return }
    setMessage(res.error === "ALREADY_CREATED" ? "Naročilo za ta merilni list že obstaja." : "Delovno naročilo ustvarjeno.")
    setOrderOpen(false)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <Dialog open={measureOpen} onOpenChange={setMeasureOpen}>
        <DialogTrigger asChild>
          <Button>Snemaj meritev</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merilni list</DialogTitle>
            <DialogDescription>Nova meritev stranke (append-only — zgodovina se ohrani).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              {/* Radix Select je gumb (combobox) — povezava z oznako gre
                  prek aria-labelledby, ne prek label[for]. */}
              <Label id="meas-customer-label">Stranka</Label>
              <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                <SelectTrigger aria-labelledby="meas-customer-label"><SelectValue placeholder="Izberite stranko" /></SelectTrigger>
                <SelectContent>
                  {knownCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meas-date">Datum meritve</Label>
              <Input id="meas-date" type="date" value={form.measuredAt} onChange={(e) => set("measuredAt", e.target.value)} />
            </div>
            {/* Audit 2026-11-18: polja so bila brez oznak, povezanih s poljem
                (label[for]) — bralnik zaslona je prebral le "število", ne pa
                "Obseg prsi". Zdaj ima vsako polje svoj id + oznako. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2"><Label htmlFor="meas-chest">Obseg prsi (cm)</Label><Input id="meas-chest" type="number" inputMode="decimal" step="0.5" min="0" value={form.chestCm} onChange={(e) => set("chestCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-waist">Obseg pasu (cm)</Label><Input id="meas-waist" type="number" inputMode="decimal" step="0.5" min="0" value={form.waistCm} onChange={(e) => set("waistCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-hips">Obseg bokov (cm)</Label><Input id="meas-hips" type="number" inputMode="decimal" step="0.5" min="0" value={form.hipsCm} onChange={(e) => set("hipsCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-shoulder">Širina ramen (cm)</Label><Input id="meas-shoulder" type="number" inputMode="decimal" step="0.5" min="0" value={form.shoulderCm} onChange={(e) => set("shoulderCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-sleeve">Dolžina rokava (cm)</Label><Input id="meas-sleeve" type="number" inputMode="decimal" step="0.5" min="0" value={form.sleeveCm} onChange={(e) => set("sleeveCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-inseam">Notr. dolžina hlač (cm)</Label><Input id="meas-inseam" type="number" inputMode="decimal" step="0.5" min="0" value={form.inseamCm} onChange={(e) => set("inseamCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-height">Višina (cm)</Label><Input id="meas-height" type="number" inputMode="decimal" step="0.5" min="0" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="meas-by-staff">Meril (osebje)</Label><Input id="meas-by-staff" value={form.byStaff} onChange={(e) => set("byStaff", e.target.value)} /></div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meas-order-ref">Povezano naročilo / delovni nalog</Label>
              <Input id="meas-order-ref" value={form.orderRef} onChange={(e) => set("orderRef", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meas-notes">Opombe</Label>
              <Textarea id="meas-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button onClick={submitMeasure} disabled={isPending}>Shrani meritev</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Novo naročilo</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo naročilo po meri</DialogTitle>
            <DialogDescription>Iz povpraševanja stranke — ustvari delovno naročilo v proizvodnem procesu.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label id="order-customer-label">Stranka</Label>
              <Select value={order.customerId} onValueChange={(v) => setOrderField("customerId", v)}>
                <SelectTrigger aria-labelledby="order-customer-label"><SelectValue placeholder="Izberite stranko" /></SelectTrigger>
                <SelectContent>
                  {knownCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-title">Naziv naročila</Label>
              <Input id="order-title" value={order.title} onChange={(e) => setOrderField("title", e.target.value)} placeholder="npr. Obleka po meri" />
            </div>
            <div className="grid gap-2">
              <Label id="order-measurement-label">Merilni list (neobvezno)</Label>
              <Select value={order.measurementId} onValueChange={(v) => setOrderField("measurementId", v)}>
                <SelectTrigger aria-labelledby="order-measurement-label"><SelectValue placeholder="Brez merilnega lista" /></SelectTrigger>
                <SelectContent>
                  {measurements.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{`${m.customerName ?? "?"} · ${m.measuredAt ?? "—"}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-description">Specifikacija / opis izdelka</Label>
              <Textarea id="order-description" value={order.description} onChange={(e) => setOrderField("description", e.target.value)} placeholder="Vrsta oblačila, material, želene spremembe…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2"><Label htmlFor="order-price">Dogovorjena cena (€)</Label><Input id="order-price" type="number" inputMode="decimal" step="0.01" min="0" value={order.agreedPrice} onChange={(e) => setOrderField("agreedPrice", e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="order-deadline">Rok izdelave</Label><Input id="order-deadline" type="date" value={order.deadline} onChange={(e) => setOrderField("deadline", e.target.value)} /></div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button onClick={submitOrder} disabled={isPending}>Ustvari naročilo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </>
  )
}