"use client"

// ============================================================
// F5.5.3.1 — PODROBNO STANJE STRANKE (dashboard/customers/[id]).
// Zgodovina vseh poslovnih relacij + urejanje opomb + GDPR.
// ============================================================

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeftIcon, ArchiveIcon, TrashIcon } from "@/components/icons"
import { toast } from "sonner"
import type { CustomerDetail } from "@/app/actions/customers"
import {
  updateCustomerNotesByCustomerId,
  archiveCustomer,
  unarchiveCustomer,
  exportCustomerData,
  anonymizeCustomer,
} from "@/app/actions/customers"
import { formatDateStandard } from "@/lib/utils/format"

const EUR = (n: number) =>
  new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(n)

function HistoryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="min-w-0 flex-1">{children}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function CustomerDetailView({ customer, usersTitle }: { customer: CustomerDetail; usersTitle: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState(customer.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const res = await updateCustomerNotesByCustomerId(customer.id, notes)
      if (!res.success) {
        toast.error(res.error || "Shranjevanje opomb ni uspelo.")
        return
      }
      toast.success("Opombe shranjene.")
    } finally {
      setSavingNotes(false)
    }
  }

  const toggleArchive = async () => {
    const res = customer.isArchived ? await unarchiveCustomer(customer.id) : await archiveCustomer(customer.id)
    if (!res.ok) {
      toast.error("Dejanje ni uspelo.")
      return
    }
    toast.success(customer.isArchived ? "Stranka ponovno aktivna." : "Stranka arhivirana.")
    router.refresh()
  }

  const doExport = async () => {
    const res = await exportCustomerData(customer.id)
    if (!res.ok) {
      toast.error("Izvoz ni uspel.")
      return
    }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stranka-${customer.name.replace(/\s+/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doAnonymize = async () => {
    if (!window.confirm("Anonimizirati to stranko (GDPR)? Zgodovina ostane, osebni podatki se izbrišejo.")) return
    const res = await anonymizeCustomer(customer.id)
    if (!res.ok) {
      toast.error("Anonimizacija ni uspela.")
      return
    }
    toast.success("Stranka anonimizirana.")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Glava */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/customers">
            <Button variant="ghost" size="icon" aria-label="Nazaj">
              <ArrowLeftIcon size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {customer.name}
              {customer.isArchived && <Badge variant="secondary">Arhivirano</Badge>}
              {!customer.userId && <Badge variant="outline">Brez računa</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">
              {customer.email ?? "brez e-pošte"}
              {customer.phone ? ` · ${customer.phone}` : ""} · {EUR(customer.totalSpent)} skupaj
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={toggleArchive}>
            <ArchiveIcon className="mr-1 h-4 w-4" />
            {customer.isArchived ? "Odprite" : "Arhiviraj"}
          </Button>
          <Button size="sm" variant="outline" onClick={doExport}>
            Izvozi (GDPR)
          </Button>
          <Button size="sm" variant="destructive" onClick={doAnonymize}>
            <TrashIcon className="mr-1 h-4 w-4" />
            Anonimiziraj
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Opombe */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Poslovne opombe</CardTitle>
            <CardDescription>Zasebne opombe lastnika (niso vidne stranki).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="…" />
            <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? "Shranjevanje…" : "Shrani opombe"}
            </Button>
          </CardContent>
        </Card>

        {/* Zgodovina */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rezervacije ({customer.appointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ni terminov.</p>
              ) : (
                customer.appointments.map((a) => (
                  <HistoryItem key={a.id} label={`${formatDateStandard(a.startTime)} · ${a.status} · ${a.totalPrice ? EUR(a.totalPrice) : "—"}`}>
                    {a.services.map((s) => s.name).join(", ") || "Brez storitve"}
                  </HistoryItem>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Naročila ({customer.orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ni naročil.</p>
              ) : (
                customer.orders.map((o) => (
                  <HistoryItem key={o.id} label={`${formatDateStandard(o.createdAt)} · ${EUR(o.total)} · ${o.status}`}>
                    {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "Naročilo"}
                  </HistoryItem>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dokumenti ({customer.documents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brez dokumentov.</p>
                ) : (
                  customer.documents.map((d) => (
                    <HistoryItem key={d.id} label={`${d.type} #${d.number} · ${EUR(d.total)} · ${d.status}`}>
                      {d.status}
                    </HistoryItem>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Delovna naročila ({customer.workOrders.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.workOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brez delovnih naročil.</p>
                ) : (
                  customer.workOrders.map((w) => (
                    <HistoryItem key={w.id} label={`#${w.number} · ${w.status}`}>
                      {w.title}
                    </HistoryItem>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projekti ({customer.projects.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brez projektov.</p>
                ) : (
                  customer.projects.map((p) => (
                    <HistoryItem key={p.id} label={`${p.status}${p.deadline ? ` · ${formatDateStandard(p.deadline)}` : ""}`}>
                      {p.name}
                    </HistoryItem>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Walk-in vstopi ({customer.walkInEntries.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.walkInEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brez walk-in vstopov.</p>
                ) : (
                  customer.walkInEntries.map((w) => (
                    <HistoryItem key={w.id} label={`${w.ticketCode} · ${w.status}`}>
                      {w.name}
                    </HistoryItem>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Obrazci/povpraševanja ({customer.formSubmissions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.formSubmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brez oddaj obrazcev.</p>
              ) : (
                customer.formSubmissions.map((f) => (
                  <HistoryItem key={f.id} label={`${formatDateStandard(f.createdAt)}`}>
                    {f.status}
                  </HistoryItem>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{usersTitle} — F5.5.3.1</p>
    </div>
  )
}