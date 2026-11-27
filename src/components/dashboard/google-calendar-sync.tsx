"use client"

// ============================================================
// GOOGLE KOLEDAR — KARTICA V NASTAVITVAH (resnična povezava)
//
// Prej je bila to predogledna kartica: gumbi so prikazali "povezano"
// in "5 terminov posodobljenih", v resnici pa ni bilo ne OAuth toka
// ne shrambe žetonov. Zdaj je povezava RESNIČNA (src/lib/calendar/*),
// zato kartica ne obljublja ničesar, česar ne zmore:
//
//  * gumb "Poveži" vodi na /api/integrations/google/calendar/connect
//    (strežniška OAuth preusmeritev, brez skrivnosti v brskalniku),
//  * "Sinhroniziraj zdaj" izvozi termine v Google (MARKEC → Google),
//  * uvoz iz Googla NI podprt — to kartica pove, namesto da bi
//    ponujala stikalo za "dvosmerno",
//  * brez strežniških poverilnic se prikaže "Ni nastavljeno" in
//    NAVODILO, kaj nastaviti — ne gumb, ki ne bi deloval.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import {
  CalendarIcon,
  CheckCircleIcon,
  CloseIcon,
  WarningCircleIcon,
} from "@/components/icons"
import { ArrowsClockwise as RefreshIcon } from "@phosphor-icons/react/dist/ssr"
import type { CalendarStatus } from "@/lib/calendar/connection"
import { disconnectCalendar, syncCalendar } from "@/app/actions/calendar"

interface GoogleCalendarSyncProps {
  status: CalendarStatus
  /** Koda iz `?calendar=` po vrnitvi iz Googla (connected, denied, …). */
  notice?: string | null
}

const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Google Calendar je povezan. Kliknite »Sinhroniziraj zdaj«, da se obstoječi termini izvozijo; novi se izvažajo samodejno." },
  denied: { tone: "error", text: "Povezava je bila preklicana v Googlu — nič ni bilo spremenjeno." },
  state: { tone: "error", text: "Povezava je potekla ali je bila prekinjena. Poskusite znova." },
  failed: { tone: "error", text: "Povezave z Googlom ni bilo mogoče dokončati. Poskusite znova." },
  scope: { tone: "error", text: "Google ni dovolil dostopa do koledarja. Ob ponovnem poskusu potrdite dostop do dogodkov." },
  permission: { tone: "error", text: "Za povezavo koledarja potrebujete dovoljenje za urejanje nastavitev." },
  "no-org": { tone: "error", text: "Podjetje ni bilo prepoznano. Osvežite stran in poskusite znova." },
  session: { tone: "error", text: "Prijava je med povezovanjem potekla. Prijavite se in poskusite znova." },
  unconfigured: { tone: "error", text: "Google Calendar na strežniku ni nastavljen (manjkajo poverilnice)." },
}

function formatWhen(iso: string | null): string {
  if (!iso) return "še ni sinhronizirano"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "še ni sinhronizirano"
  return date.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short" })
}

export function GoogleCalendarSync({ status, notice }: GoogleCalendarSyncProps) {
  const [syncing, setSyncing] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  // Sporočilo iz naslova (calendar=...) ostane v URL-ju; uporabnik ga
  // mora zapreti, sicer bi viselo do naslednje navigacije.
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const connected = status.connected
  const configured = status.configured
  const banner = notice ? NOTICES[notice] : undefined

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncCalendar()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const { created, updated, removed } = result.summary
      if (created + updated + removed === 0) {
        toast.success("Vse je že usklajeno — ni bilo česa izvoziti.")
        return
      }
      const parts = [
        created > 0 ? `${created} novih` : null,
        updated > 0 ? `${updated} posodobljenih` : null,
        removed > 0 ? `${removed} odstranjenih` : null,
      ].filter(Boolean)
      toast.success(`Izvoz končan: ${parts.join(", ")}.`)
    } catch {
      toast.error("Izvoz ni uspel. Poskusite znova.")
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setConfirmDisconnect(false)
    try {
      const result = await disconnectCalendar()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
    } catch {
      toast.error("Odklop ni uspel. Poskusite znova.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon size={20} />
              Google Calendar
            </CardTitle>
            <CardDescription>Termini se samodejno izvažajo v vaš Google Koledar.</CardDescription>
          </div>
          {!configured ? (
            <Badge variant="outline" className="text-muted-foreground">
              Ni nastavljeno
            </Badge>
          ) : connected ? (
            <Badge variant="outline" className="text-success">
              <CheckCircleIcon size={12} className="mr-1" />
              Povezano
            </Badge>
          ) : (
            <Badge variant="outline">Ni povezano</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {banner && !bannerDismissed && (
          <div
            // napaka je za bralnike zaslona alarm, ne zgolj obvestilo
            role={banner.tone === "ok" ? "status" : "alert"}
            className={
              banner.tone === "ok"
                ? "border-border bg-muted/40 mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed"
                : "border-destructive/40 bg-destructive/5 text-destructive mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed"
            }
          >
            {banner.tone === "ok" ? (
              <CheckCircleIcon size={14} className="mt-0.5 shrink-0" />
            ) : (
              <WarningCircleIcon size={14} className="mt-0.5 shrink-0" />
            )}
            <p className="flex-1">{banner.text}</p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Zapri obvestilo"
              className="hover:bg-background/60 -m-1 shrink-0 rounded p-1 transition-colors"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        {!configured ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Povezava je pripravljena, a na strežniku še ni nastavljena. Lastnik
              platforme mora v okolje dodati <code className="text-foreground">GOOGLE_CALENDAR_CLIENT_ID</code>{" "}
              in <code className="text-foreground">GOOGLE_CALENDAR_CLIENT_SECRET</code> (ali
              uporabiti obstoječa <code className="text-foreground">AUTH_GOOGLE_*</code>) ter v
              Google Cloud dodati preusmeritveni naslov{" "}
              <code className="text-foreground">/api/integrations/google/calendar/callback</code>.
            </p>
          </div>
        ) : !connected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CalendarIcon size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="mb-2 font-semibold">Povežite Google Calendar</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Ko povežete, se novi in prestavljeni termini izvozijo samodejno.
              </p>
              {/* Navaden <a>: to je strežniška preusmeritev na Google,
                  ne odjemalska akcija — zato brez fetch/JS. */}
              <Button asChild>
                <a href="/api/integrations/google/calendar/connect">
                  <CalendarIcon size={16} className="mr-2" />
                  Poveži Google Calendar
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Kaj povezava naredi</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-success" />
                  Nov in prestavljen termin se izvozi samodejno
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-success" />
                  Preklican termin iz koledarja izgine
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-success" />
                  Termine vidite tudi v mobilnem koledarju
                </li>
              </ul>
              <p className="text-muted-foreground text-xs">
                Smer je enosmerna: MARKEC → Google. Termini, ki jih vstavite
                neposredno v Google, se v MARKEC ne uvozijo.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                  <CheckCircleIcon size={20} className="text-success" />
                </div>
                <div>
                  <p className="font-medium">
                    {status.accountEmail ?? "Google Calendar povezan"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Zadnja sinhronizacija: {formatWhen(status.lastSyncAt)}
                  </p>
                </div>
              </div>
              <Button onClick={handleSync} disabled={syncing}>
                <RefreshIcon size={16} className={`mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Izvažam…" : "Sinhroniziraj zdaj"}
              </Button>
            </div>

            {status.lastSyncError && (
              <p
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed"
              >
                <WarningCircleIcon size={16} className="mt-0.5 shrink-0" />
                Zadnji izvoz ni uspel v celoti: {status.lastSyncError}
              </p>
            )}

            <div className="text-muted-foreground space-y-1 text-xs">
              <p>
                Termini se izvažajo samodejno ob rezervaciji, prestavitvi in
                preklicu. Gumb »Sinhroniziraj zdaj« je za prvo polnjenje in
                popravke (npr. ko v Googlu kaj ročno spremenite).
              </p>
              <p>
                Zajeti so termini od včeraj do 18 mesecev naprej.
              </p>
              <p>
                Uvoz iz Googla ni podprt — termine, ki jih vstavite v Google, v
                MARKEC vnesite ročno.
              </p>
            </div>

            <div>
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDisconnect(true)}
              >
                Odklopi
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Odklopim Google Calendar?"
        description="MARKEC ne bo več izvažal terminov v ta koledar. Dogodki, ki so že v koledarju, ostanejo; žetoni za dostop se izbrišejo."
        confirmLabel="Odklopi"
        cancelLabel="Prekliči"
        variant="destructive"
        onConfirm={handleDisconnect}
      />
    </Card>
  )
}
