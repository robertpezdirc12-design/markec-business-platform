"use client"

// #110 — Outgoing webhooks (Settings).
// Registracija URL-jev za prejemanje dogodkov iz platforme.

import { useEffect, useState, useTransition } from "react"
import {
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  sendTestWebhook,
  type WebhookSummary,
} from "@/app/actions/webhooks"

export function WebhooksCard() {
  const { toast } = useToast()
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([])
  const [events, setEvents] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // New webhook form
  const [showForm, setShowForm] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null)

  async function refresh() {
    const result = await listWebhooks()
    if (!("error" in result)) {
      setWebhooks(result.webhooks)
      setEvents(result.availableEvents)
    }
  }

  useEffect(() => {
    let cancelled = false
    listWebhooks()
      .then((result) => {
        if (cancelled || "error" in result) return
        setWebhooks(result.webhooks)
        setEvents(result.availableEvents)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function toggleEvent(eventId: string) {
    setNewEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
  }

  function handleCreate() {
    if (!newUrl.trim()) {
      toast({ title: "URL je obvezen", variant: "destructive" })
      return
    }
    if (newEvents.length === 0) {
      toast({ title: "Izberite vsaj en dogodek", variant: "destructive" })
      return
    }
    startTransition(async () => {
      const result = await createWebhook({ url: newUrl.trim(), events: newEvents })
      if ("error" in result) {
        toast({ title: "Napaka", description: result.error, variant: "destructive" })
      } else {
        setRevealedSecret({ id: result.id, secret: result.secret })
        setNewUrl("")
        setNewEvents([])
        setShowForm(false)
        toast({ title: "Webhook ustvarjen", description: "Shranite skrivni ključ — ne bo več prikazan." })
        await refresh()
      }
    })
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await updateWebhook({ id, isActive })
      await refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteWebhook(id)
      if ("error" in result) {
        toast({ title: "Napaka", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Webhook izbrisan" })
        if (revealedSecret?.id === id) setRevealedSecret(null)
        await refresh()
      }
    })
  }

  function handleTest(id: string) {
    startTransition(async () => {
      const result = await sendTestWebhook(id)
      if ("error" in result) {
        toast({ title: "Test ni uspel", description: result.error, variant: "destructive" })
      } else {
        toast({ title: "Test uspel", description: result.message })
      }
    })
  }

  function handleRotate(id: string) {
    startTransition(async () => {
      const result = await rotateWebhookSecret(id)
      if ("error" in result) {
        toast({ title: "Napaka", description: result.error, variant: "destructive" })
      } else {
        setRevealedSecret({ id, secret: result.secret })
        toast({ title: "Nov skrivni ključ", description: "Shranite ga — ne bo več prikazan." })
      }
    })
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret)
      toast({ title: "Kopirano v odložišče" })
    } catch {
      toast({ title: "Kopiranje ni uspelo", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Webhook className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Pošiljajte dogodke iz platforme na vaše strežnike (npr. Zapier, Make, lastni sistemi).
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full shrink-0"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Dodaj
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revealed secret banner */}
        {revealedSecret && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Skrivni ključ (shranite ga zdaj — ne bo več prikazan):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 break-all">
                {revealedSecret.secret}
              </code>
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => copySecret(revealedSecret.secret)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Podpis: <code>X-Markec-Signature: sha256=HMAC_SHA256(secret, body)</code>
            </p>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL *</Label>
              <Input
                id="wh-url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhooks/markec"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Dogodki *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {events.map((ev) => (
                  <label key={ev.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={newEvents.includes(ev.id)}
                      onCheckedChange={() => toggleEvent(ev.id)}
                    />
                    <span>{ev.label}</span>
                    <code className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">{ev.id}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={isPending} className="h-9 rounded-full">
                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Ustvari
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="h-9 rounded-full">
                Prekliči
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {webhooks.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground py-2">
            Ni nastavljenih webhookov. Dodajte endpoint za prejemanje dogodkov.
          </p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="rounded-lg border p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-medium break-all">{wh.url}</code>
                      {wh.isActive ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Aktiven
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          <XCircle className="h-3 w-3 mr-1" />Neaktiven
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(wh.events as string[]).map((e) => (
                        <Badge key={e} variant="secondary" className="text-[10px] font-normal">
                          {e}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Uspešno: {wh.successCount} · Neuspešno: {wh.failureCount}
                      {wh.lastFailureReason && (
                        <span className="text-destructive"> · Zadnja napaka: {wh.lastFailureReason.slice(0, 80)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" disabled={isPending} onClick={() => handleTest(wh.id)}>
                    <Send className="h-3 w-3 mr-1" />Test
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" disabled={isPending} onClick={() => handleRotate(wh.id)}>
                    <RefreshCw className="h-3 w-3 mr-1" />Nov ključ
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" disabled={isPending} onClick={() => handleToggle(wh.id, !wh.isActive)}>
                    {wh.isActive ? "Deaktiviraj" : "Aktiviraj"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs rounded-full text-destructive hover:text-destructive" disabled={isPending} onClick={() => handleDelete(wh.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />Izbriši
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg bg-muted/30 border p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Varnost:</strong> vsak zahtevek je podpisan z <code>X-Markec-Signature</code> (HMAC-SHA256).
            Preverite podpis na svojem strežniku. Neuspešne dostave se ponovijo do 3× z eksponentnim zamikom.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
