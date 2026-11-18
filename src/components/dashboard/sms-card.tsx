"use client"

// #110 — 46elks SMS integracija (Settings → Obvestila).
//
// Vzorci: enostaven "Connect" flow, test pošiljanje, iskreno stanje.
// Progresivna razkritja: osnovna polja → napredne možnosti.

import { useEffect, useState, useTransition } from "react"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Save,
  Send,
  Unplug,
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
import { useToast } from "@/hooks/use-toast"
import {
  getSmsStatus,
  saveSmsConfig,
  disconnectSms,
  testSms,
  type SmsStatus,
} from "@/app/actions/sms"

export function SmsCard() {
  const { toast } = useToast()
  const [status, setStatus] = useState<SmsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [testing, setTesting] = useState(false)

  // Form state
  const [apiKey, setApiKey] = useState("")
  const [apiPassword, setApiPassword] = useState("")
  const [senderName, setSenderName] = useState("MARKEC")
  const [testPhone, setTestPhone] = useState("")

  useEffect(() => {
    let cancelled = false
    getSmsStatus()
      .then((result) => {
        if (!cancelled && !("error" in result)) {
          setStatus(result)
          if (result.senderName) setSenderName(result.senderName)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSave() {
    if (!apiKey.trim() || !apiPassword.trim()) {
      toast({
        title: "Manjkajoča polja",
        description: "API ključ in geslo sta obvezna.",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      const result = await saveSmsConfig({
        apiKey: apiKey.trim(),
        apiPassword: apiPassword.trim(),
        senderName: senderName.trim() || "MARKEC",
      })

      if ("error" in result) {
        toast({
          title: "Napaka",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "SMS povezava shranjena",
          description: "Preverite delovanje s testnim sporočilom.",
        })
        const newStatus = await getSmsStatus()
        if (!("error" in newStatus)) setStatus(newStatus)
      }
    })
  }

  function handleTest() {
    if (!testPhone.trim()) {
      toast({
        title: "Vnesite številko",
        description: "Za test vnesite telefonsko številko.",
        variant: "destructive",
      })
      return
    }

    setTesting(true)
    testSms(testPhone.trim())
      .then((result) => {
        if ("error" in result) {
          toast({
            title: "Test ni uspel",
            description: result.error,
            variant: "destructive",
          })
        } else {
          toast({
            title: "SMS poslan",
            description: result.message,
          })
        }
      })
      .finally(() => setTesting(false))
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectSms()
      if ("ok" in result) {
        toast({
          title: "SMS povezava prekinjena",
          description: "Konfiguracija je odstranjena.",
        })
        setStatus({ configured: false, senderName: null, configuredAt: null })
        setApiKey("")
        setApiPassword("")
        setSenderName("MARKEC")
      }
    })
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
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                SMS obvestila
                {status?.configured ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Povezano
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Ni povezano
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                SMS opomniki in obvestila strankam — manj zamujenih terminov.
              </CardDescription>
            </div>
          </div>
          <a
            href="https://46elks.com/docs/send-sms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Dokumentacija <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {status?.configured ? (
          /* ── POVEZANO ──────────────────────────────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                SMS obvestila so aktivna
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pošiljatelj: <strong>{status.senderName}</strong>
                {status.configuredAt && (
                  <> · Povezano {new Date(status.configuredAt).toLocaleDateString("sl-SI")}</>
                )}
              </p>
            </div>

            {/* Test pošiljanje */}
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Test pošiljanje</p>
              <div className="flex gap-2">
                <Input
                  placeholder="+38641234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  className="h-9 rounded-full shrink-0"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Pošlji test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Testno sporočilo bo poslano na vneseno številko. Cena: ~0,05 €.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isPending}
                className="h-8 rounded-full text-destructive hover:text-destructive"
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Prekini povezavo
              </Button>
            </div>
          </div>
        ) : (
          /* ── NI POVEZANO — nastavitveni obrazec ─────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3.5">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Kaj potrebujete?</p>
                  <ol className="text-xs text-muted-foreground mt-1.5 space-y-1 list-decimal list-inside">
                    <li>
                      Ustvarite račun na{" "}
                      <a
                        href="https://46elks.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        46elks.com
                      </a>
                    </li>
                    <li>Poiščite API Username in API Password v nastavitvah</li>
                    <li>Vnesite ju spodaj</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-2">
                    Plačilo po porabi (~0,05 €/SMS). Mesečna naročnina ni potrebna.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sms-api-key">API Username *</Label>
                <Input
                  id="sms-api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="uXXXXXXX"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sms-api-password">API Password *</Label>
                <Input
                  id="sms-api-password"
                  type="password"
                  value={apiPassword}
                  onChange={(e) => setApiPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sms-sender">Ime pošiljatelja</Label>
                <Input
                  id="sms-sender"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="MARKEC"
                  maxLength={11}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Ime, ki ga vidijo prejemniki (do 11 znakov, samo črke in številke).
                </p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isPending}
              className="h-9 rounded-full"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Shrani in poveži
            </Button>
          </div>
        )}

        {/* Info o uporabi */}
        <div className="rounded-lg bg-muted/30 border p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Samodejna obvestila:</strong> opomniki za termine (24h prej),
            »naročilo pripravljeno za prevzem«, walk-in »na vrsti ste«.{" "}
            <strong>Cena:</strong> ~0,05 € na SMS del.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
