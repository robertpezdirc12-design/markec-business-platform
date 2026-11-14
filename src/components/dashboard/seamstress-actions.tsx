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
            <div>
              <Label>Stranka</Label>
              <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                <SelectTrigger><SelectValue placeholder="Izberite stranko" /></SelectTrigger>
                <SelectContent>
                  {knownCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum meritve</Label>
              <Input type="date" value={form.measuredAt} onChange={(e) => set("measuredAt", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Obseg prsi (cm)</Label><Input type="number" value={form.chestCm} onChange={(e) => set("chestCm", e.target.value)} /></div>
              <div><Label>Obseg pasu (cm)</Label><Input type="number" value={form.waistCm} onChange={(e) => set("waistCm", e.target.value)} /></div>
              <div><Label>Obseg bokov (cm)</Label><Input type="number" value={form.hipsCm} onChange={(e) => set("hipsCm", e.target.value)} /></div>
              <div><Label>Širina ramen (cm)</Label><Input type="number" value={form.shoulderCm} onChange={(e) => set("shoulderCm", e.target.value)} /></div>
              <div><Label>Dolžina rokava (cm)</Label><Input type="number" value={form.sleeveCm} onChange={(e) => set("sleeveCm", e.target.value)} /></div>
              <div><Label>Notr. dolžina hlač (cm)</Label><Input type="number" value={form.inseamCm} onChange={(e) => set("inseamCm", e.target.value)} /></div>
              <div><Label>Višina (cm)</Label><Input type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></div>
              <div><Label>Meril (osebje)</Label><Input value={form.byStaff} onChange={(e) => set("byStaff", e.target.value)} /></div>
            </div>
            <div>
              <Label>Povezano naročilo / delovni nalog</Label>
              <Input value={form.orderRef} onChange={(e) => set("orderRef", e.target.value)} />
            </div>
            <div>
              <Label>Opombe</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
            <div>
              <Label>Stranka</Label>
              <Select value={order.customerId} onValueChange={(v) => setOrderField("customerId", v)}>
                <SelectTrigger><SelectValue placeholder="Izberite stranko" /></SelectTrigger>
                <SelectContent>
                  {knownCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Naziv naročila</Label>
              <Input value={order.title} onChange={(e) => setOrderField("title", e.target.value)} placeholder="npr. Obleka po meri" />
            </div>
            <div>
              <Label>Merilni list (neobvezno)</Label>
              <Select value={order.measurementId} onValueChange={(v) => setOrderField("measurementId", v)}>
                <SelectTrigger><SelectValue placeholder="Brez merilnega lista" /></SelectTrigger>
                <SelectContent>
                  {measurements.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{`${m.customerName ?? "?"} · ${m.measuredAt ?? "—"}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Specifikacija / opis izdelka</Label>
              <Textarea value={order.description} onChange={(e) => setOrderField("description", e.target.value)} placeholder="Vrsta oblačila, material, želene spremembe…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Dogovorjena cena (€)</Label><Input type="number" value={order.agreedPrice} onChange={(e) => setOrderField("agreedPrice", e.target.value)} /></div>
              <div><Label>Rok izdelave</Label><Input type="date" value={order.deadline} onChange={(e) => setOrderField("deadline", e.target.value)} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submitOrder} disabled={isPending}>Ustvari naročilo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </>
  )
}