"use client"

// #110 — Minimax računovodska integracija (Settings → Računovodstvo).
//
// Vzorci (Google Business Profile / Shopify):
//   - enostaven "Connect" flow z jasnim statusom
//   - "Test connection" gumb za takojšnjo povratno informacijo
//   - progresivna razkritja: osnovna polja → napredne možnosti
//   - iskreno "ni povezano" stanje (brez lažnih obljub)

import { useEffect, useState, useTransition } from "react"
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Save,
  Shield,
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
  getMinimaxStatus,
  saveMinimaxConfig,
  disconnectMinimax,
  testMinimax,
  type MinimaxStatus,
} from "@/app/actions/minimax"

export function MinimaxCard() {
  const { toast } = useToast()
  const [status, setStatus] = useState<MinimaxStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [testing, setTesting] = useState(false)

  // Form state
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [organisationId, setOrganisationId] = useState("")

  useEffect(() => {
    let cancelled = false
    getMinimaxStatus()
      .then((result) => {
        if (!cancelled && !("error" in result)) {
          setStatus(result)
          if (result.organisationId) {
            setOrganisationId(String(result.organisationId))
          }
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
    if (!clientId.trim() || !clientSecret.trim() || !username.trim() || !password.trim() || !organisationId.trim()) {
      toast({
        title: "Manjkajoča polja",
        description: "Izpolnite vsa polja za povezavo z Minimax.",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      const result = await saveMinimaxConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        username: username.trim(),
        password: password.trim(),
        organisationId: parseInt(organisationId.trim(), 10),
      })

      if ("error" in result) {
        toast({
          title: "Napaka",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Minimax povezan",
          description: "Konfiguracija je shranjena. Preverite povezavo z gumbom Test.",
        })
        // Osveži status
        const newStatus = await getMinimaxStatus()
        if (!("error" in newStatus)) setStatus(newStatus)
      }
    })
  }

  function handleTest() {
    setTesting(true)
    testMinimax()
      .then((result) => {
        if ("error" in result) {
          toast({
            title: "Povezava ni uspela",
            description: result.error,
            variant: "destructive",
          })
        } else {
          toast({
            title: "Povezava vzpostavljena",
            description: result.message,
          })
        }
      })
      .finally(() => setTesting(false))
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectMinimax()
      if ("ok" in result) {
        toast({
          title: "Povezava prekinjena",
          description: "Minimax konfiguracija je odstranjena.",
        })
        setStatus({ configured: false, organisationId: null, configuredAt: null })
        setClientId("")
        setClientSecret("")
        setUsername("")
        setPassword("")
        setOrganisationId("")
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
              <Building2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Minimax
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
                Samodejni izvoz računov v računovodstvo — brez ročnega prepisovanja.
              </CardDescription>
            </div>
          </div>
          <a
            href="https://moj.minimax.si/SI/API"
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
                Minimax je povezan
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Organizacija ID: <strong>{status.organisationId}</strong>
                {status.configuredAt && (
                  <> · Povezano {new Date(status.configuredAt).toLocaleDateString("sl-SI")}</>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Računi se lahko izvažajo iz pogleda dokumentov (gumb »Izvozi v Minimax«).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
                className="h-8 rounded-full"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Plug className="h-3.5 w-3.5 mr-1.5" />
                )}
                Preveri povezavo
              </Button>
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
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Kaj potrebujete?</p>
                  <ol className="text-xs text-muted-foreground mt-1.5 space-y-1 list-decimal list-inside">
                    <li>
                      Prijavite se v{" "}
                      <a
                        href="https://moj.minimax.si"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Minimax
                      </a>{" "}
                      → Moj profil → Nova aplikacija
                    </li>
                    <li>Pridobite Client ID, Client Secret, uporabniško ime in geslo</li>
                    <li>Vnesite ID organizacije (številka v Minimax)</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="minimax-client-id">Client ID *</Label>
                <Input
                  id="minimax-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="npr. moja-aplikacija"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minimax-client-secret">Client Secret *</Label>
                <Input
                  id="minimax-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minimax-username">Uporabniško ime API *</Label>
                <Input
                  id="minimax-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="API uporabnik"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minimax-password">Geslo API *</Label>
                <Input
                  id="minimax-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minimax-org-id">ID organizacije v Minimax *</Label>
              <Input
                id="minimax-org-id"
                type="number"
                value={organisationId}
                onChange={(e) => setOrganisationId(e.target.value)}
                placeholder="npr. 123456"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Številka organizacije, ki jo vidite v Minimax (različna od MARKEC ID).
              </p>
            </div>

            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !status?.configured}
                className="h-9 rounded-full"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                Preveri povezavo
              </Button>
            </div>
          </div>
        )}

        {/* Info o omejitvah */}
        <div className="rounded-lg bg-muted/30 border p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Omogočeno:</strong> izvoz izdanih računov in dobropisov, sinhronizacija strank,
            davčno potrjevanje (prek Minimax).{" "}
            <strong>Omejitev Minimax API:</strong> 1.000 klicev/dan, 20.000/mesec.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
