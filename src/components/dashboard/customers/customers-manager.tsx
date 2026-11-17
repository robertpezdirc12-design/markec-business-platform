"use client"

// ============================================================
// F5.5.3.1 — ENOTEN ZASLON »MOJE STRANKE« (dashboard/customers).
// Seznam z iskanjem/filtri, ročno dodajanje, urejanje, arhiviranje,
// GDPR izvoz/anonimizacija. Org-scoped prek strežniških akcij.
// ============================================================

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusIcon, PencilIcon, TrashIcon, ArchiveIcon, DownloadIcon, SearchIcon } from "@/components/icons"
import { toast } from "sonner"
import type { CustomerListItem } from "@/app/actions/customers"
import {
  createCustomer,
  updateCustomer,
  archiveCustomer,
  unarchiveCustomer,
  exportCustomerData,
  anonymizeCustomer,
} from "@/app/actions/customers"

interface Props {
  initial: CustomerListItem[]
  tags: string[]
  archived: boolean
  search: string
  title: string
  titleAccent: string
  subtitle: string
}

interface FormState {
  name: string
  email: string
  phone: string
  notes: string
  tags: string
  dateOfBirth: string
  marketingConsent: boolean
}

const EMPTY: FormState = { name: "", email: "", phone: "", notes: "", tags: "", dateOfBirth: "", marketingConsent: false }

export function CustomersManager({ initial, tags, archived, search, title, titleAccent, subtitle }: Props) {
  const router = useRouter()
  // Seznam bere NEPOSREDNO iz props. Prej je bil kopiran v useState(initial),
  // zato router.refresh() po dodajanju stranke ni osvežil seznama — nova
  // stranka se je pokazala šele po ročnem osvežitvi strani (v produkciji
  // je seznam še naprej kazal »Ni strank«).
  const rows: CustomerListItem[] = initial
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerListItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)

  const refresh = (archivedState?: boolean, tag?: string) => {
    const base = "/dashboard/customers"
    const params = new URLSearchParams()
    const showArchived = archivedState ?? archived
    if (params.has("search") || search) params.set("search", search)
    if (showArchived) params.set("archived", "1")
    if (tag) params.set("tag", tag)
    const qs = params.toString()
    router.push(qs ? `${base}?${qs}` : base)
    router.refresh()
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (c: CustomerListItem) => {
    setEditing(c)
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      tags: c.tags.join(", "),
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : "",
      marketingConsent: c.marketingConsent,
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Vnesite ime stranke.")
      return
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      dateOfBirth: form.dateOfBirth || null,
      marketingConsent: form.marketingConsent,
    }
    setBusy(true)
    try {
      const res = editing
        ? await updateCustomer(editing.id, payload)
        : await createCustomer(payload)
      if (!res.ok) {
        const msg =
          res.error === "DUPLICATE_CUSTOMER"
            ? "Stranka s tem kontaktom že obstaja — izberite obstoječo stranko, ne ustvarjajte dvojnika."
            : res.error === "DUPLICATE_EMAIL"
              ? "E-poštni naslov je že v rabi pri drugi stranki."
              : res.error === "MISSING_NAME"
                ? "Vnesite ime."
                : "Shranjevanje ni uspelo."
        toast.error(msg)
        return
      }
      toast.success(editing ? "Stranka posodobljena." : "Stranka dodana.")
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async (c: CustomerListItem) => {
    const res = c.isArchived ? await unarchiveCustomer(c.id) : await archiveCustomer(c.id)
    if (!res.ok) {
      toast.error("Dejanje ni uspelo.")
      return
    }
    toast.success(c.isArchived ? "Stranka ponovno aktivna." : "Stranka arhivirana.")
    router.refresh()
  }

  const doAnonymize = async (c: CustomerListItem) => {
    if (!window.confirm("Anonimizirati to stranko (GDPR)? Zgodovina ostane, osebni podatki se izbrišejo.")) return
    const res = await anonymizeCustomer(c.id)
    if (!res.ok) {
      toast.error("Anonimizacija ni uspela.")
      return
    }
    toast.success("Stranka anonimizirana.")
    router.refresh()
  }

  const doExport = async (c: CustomerListItem) => {
    const res = await exportCustomerData(c.id)
    if (!res.ok) {
      toast.error("Izvoz ni uspel.")
      return
    }
    // JSON za GDPR — predaj lastniku.
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stranka-${c.name.replace(/\s+/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>
            {title} <span className="text-primary">{titleAccent}</span>
          </CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={archived ? "outline" : "default"} onClick={() => refresh(!archived)}>
            <ArchiveIcon className="mr-1 h-4 w-4" />
            {archived ? "Aktivne" : "Arhiv"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Dodaj stranko
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vrstica filtra + iskanje */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const s = String(fd.get("q") ?? "")
              const params = new URLSearchParams()
              if (s) params.set("search", s)
              if (archived) params.set("archived", "1")
              router.push(`/dashboard/customers?${params.toString()}`)
            }}
          >
            <Input name="q" defaultValue={search} placeholder="Išči po imenu, e-pošti, telefonu…" className="max-w-xs" />
            <Button size="sm" type="submit" aria-label="Išči stranke">
              <SearchIcon className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-1">
            {tags.map((tg) => (
              <Badge key={tg} variant="outline" className="cursor-pointer" onClick={() => refresh(archived, tg)}>
                {tg}
              </Badge>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {archived ? "Ni arhiviranih strank." : "Ni strank. Dodajte prvo."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Stranka</th>
                  <th className="pb-3 font-medium">Kontakt</th>
                  <th className="pb-3 text-right font-medium">Oznake</th>
                  <th className="pb-3 text-center font-medium">Termini</th>
                  <th className="pb-3 text-center font-medium">Naročila</th>
                  <th className="pb-3 text-right font-medium">Poraba</th>
                  <th className="pb-3 text-right font-medium">Dejanja</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                          {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.isArchived ? "Arhivirano" : c.userId ? "Registriran" : "Brez računa"}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3">
                      {c.email && <p className="text-xs">{c.email}</p>}
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {c.tags.map((tg) => (
                          <Badge key={tg} variant="outline" className="text-[10px]">
                            {tg}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-center">{c._count.appointments}</td>
                    <td className="py-3 text-center">{c._count.orders}</td>
                    <td className="py-3 text-right">
                      {new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(c.totalSpent)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/customers/${c.id}`}>
                          <Button variant="ghost" size="icon" aria-label="Odpri stranko">
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => toggleArchive(c)} aria-label="Arhiviraj">
                          <ArchiveIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Uredi">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => doExport(c)} aria-label="Izvozi (GDPR)">
                          <DownloadIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => doAnonymize(c)} aria-label="Anonimiziraj">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Dodajanje / urejanje */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Uredi stranko" : "Nova stranka"}</DialogTitle>
            <DialogDescription>Kontaktnji podatki in oznake. Stranka je vedno povezana z vašim podjetjem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Ime in priimek</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="npr. Ana Novak" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-email">E-pošta</Label>
                <Input id="c-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ana@primer.si" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Telefon</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="040 123 456" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-dob">Rojstni dan</Label>
                <Input id="c-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-tags">Oznake (segmenti)</Label>
                <Input id="c-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="VIP, redna" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Poslovne opombe</Label>
              <Textarea id="c-notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Privatne opombe lastnika…" />
            </div>
            <div className="space-y-1.5 rounded-md border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="c-consent"
                  checked={form.marketingConsent}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, marketingConsent: v === true }))}
                />
                <Label htmlFor="c-consent" className="text-sm font-normal leading-snug">
                  Privolitev za marketing (GDPR)
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Stranka je eksplicitno privolila v prejemanje marketinških e-sporočil (novice, rojstne akcije,
                    ponovne aktivacije). Brez privolitve kampanje te stranke <em>ne kontaktirajo</em>.
                  </span>
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Prekliči</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Shranjevanje…" : editing ? "Shrani spremembe" : "Dodaj stranko"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}