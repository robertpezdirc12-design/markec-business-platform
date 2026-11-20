"use client"

// #98: javni vhod v vrsto — prijava (ime, opcionalno telefon) ali
// preverba pozicije po kodi vstopnice. Samodejna osvežitev 30 s, ko
// gost sledi svoji vstopnici.

import { useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getWalkInStatus,
  joinWalkInQueue,
  subscribeWalkInPush,
} from "@/app/actions/walk-in"
import { urlBase64ToUint8Array } from "@/lib/push/vapid-key"

export function WalkInPublicClient() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [ticket, setTicket] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [servingNow, setServingNow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // lastnik (#112 UX): preverba po kodi je ZA VRNJENE goste — na prvem
  // zaslonu skrita, odpre se prek majhne povezave (prej je stala med
  // vpisnim gumbom in je delovala kot nepotrebna).
  const [showCheck, setShowCheck] = useState(false)
  const [pending, startTransition] = useTransition()
  // #108 — push obvestila (opt-in): "na vrsti ste" brez osveževanja strani.
  const [pushState, setPushState] = useState<"idle" | "asking" | "enabled" | "unsupported">("idle")

  function checkStatus(code: string, fromInput: boolean) {
    if (fromInput) setError(null)
    startTransition(async () => {
      const res = await getWalkInStatus(code)
      if (res.success) {
        setPosition(res.position ?? null)
        setServingNow(res.servingNow === true)
        if (fromInput) setTicket(code.trim().toUpperCase())
      } else {
        if (fromInput) setError(res.error ?? "Vstopnice ni bilo mogoče najti.")
      }
    })
  }

  // Sledenje: samodejna osvežitev, dokler gost gleda svojo vstopnico.
  useEffect(() => {
    if (!ticket) return
    const timer = setInterval(() => {
      checkStatus(ticket, false)
    }, 30_000)
    return () => clearInterval(timer)
  }, [ticket])

  function join() {
    setError(null)
    startTransition(async () => {
      const res = await joinWalkInQueue({ name, phone })
      if (res.success && res.ticketCode) {
        setTicket(res.ticketCode)
        setName("")
        setPhone("")
        await checkStatus(res.ticketCode, false)
        // #108 — preveri, ali naprava podpira push.
        if ("serviceWorker" in navigator && "PushManager" in window) {
          setPushState("asking")
        } else {
          setPushState("unsupported")
        }
      } else {
        setError(res.error ?? "Vpis v vrsto ni uspel. Poskusite znova.")
      }
    })
  }

  // #108 — naročnina na push obvestila za vstopnico (anonimno, prek koda).
  async function enablePush() {
    if (!ticket) return
    try {
      const reg = await navigator.serviceWorker.ready
      // VAPID javni ključ pridobimo iz obstoječega push vira — če push
      // ni nastavljen na strežniku, gumb ne ponudi lažnega obljube.
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await subscribeWalkInPush({
          ticketCode: ticket,
          endpoint: existing.endpoint,
          keys: {
            p256dh: existing.toJSON().keys?.p256dh,
            auth: existing.toJSON().keys?.auth,
          },
        })
        setPushState("enabled")
        return
      }
      // Brez VAPID ključa ne moremo ustvariti naročnine — pošteno povemo.
      const config = await fetch("/api/push/config").then((r) => r.json()).catch(() => null)
      const vapidKey = config?.vapidPublicKey
      if (!vapidKey) {
        setPushState("unsupported")
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const json = sub.toJSON()
      await subscribeWalkInPush({
        ticketCode: ticket,
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      })
      setPushState("enabled")
    } catch {
      setPushState("unsupported")
    }
  }

  if (ticket) {
    return (
      <Card className="mt-6">
        <CardHeader className="text-center">
          <CardTitle className="text-base">Vaša vstopnica</CardTitle>
          <p className="font-mono text-3xl font-bold tracking-widest">{ticket}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {servingNow ? (
            <p className="text-lg font-semibold" role="status">
              Na potezi ste! Pojdite na vrata. 🎉
            </p>
          ) : position ? (
            <p className="text-lg" role="status">
              Ste <strong>{position}.</strong> v vrsti.
            </p>
          ) : (
            <p className="text-muted-foreground" role="status">
              Vaša vstopnica ni več v vrsti.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Pozicija se samodejno osvežuje. Zapišite si kodo vstopnice.
          </p>
          {/* #108 — push obvestilo "na vrsti ste" (opt-in, nevsiljivo). */}
          {pushState === "asking" && (
            <Button variant="outline" size="sm" onClick={enablePush} disabled={pending}>
              🔔 Obvesti me, ko sem na vrsti
            </Button>
          )}
          {pushState === "enabled" && (
            <p className="text-xs text-green-600 dark:text-green-400" role="status">
              ✓ Obveščali vas bomo, ko boste na vrsti.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="walkin-name">Ime *</Label>
          <Input
            id="walkin-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Ana Novak"
            maxLength={60}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="walkin-phone">Telefon (neobvezno)</Label>
          <Input
            id="walkin-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="npr. 040 123 456"
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button onClick={join} disabled={pending || name.trim().length < 2} className="w-full">
          {pending ? "Vpisujem …" : "Vpiši me v vrsto"}
        </Button>

        {showCheck ? (
          <div className="flex items-center gap-2">
            <Input
              value={ticket ?? ""}
              onChange={(e) => setTicket(e.target.value.toUpperCase())}
              placeholder="Številka vstopnice"
              maxLength={6}
              aria-label="Številka vstopnice"
              className="font-mono tracking-widest"
              autoFocus
            />
            <Button
              variant="outline"
              onClick={() => ticket && checkStatus(ticket, true)}
              disabled={pending || !ticket}
            >
              Preveri
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCheck(true)}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Imate že številko? Preverite svojo pozicijo
          </button>
        )}
      </CardContent>
    </Card>
  )
}
