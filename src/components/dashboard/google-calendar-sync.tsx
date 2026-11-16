"use client"

// ============================================================
// GOOGLE CALENDAR SYNC (Fresha-inspired 2026-11-15)
// Two-way sync with Google Calendar.
// Import/export appointments, conflict resolution.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  CalendarIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@/components/icons"
import { ArrowsClockwise as RefreshIcon } from "@phosphor-icons/react/dist/ssr"

interface GoogleCalendarSyncProps {
  isConnected?: boolean
  lastSyncAt?: string | null
  syncDirection?: "import" | "export" | "both"
  autoSync?: boolean
  conflictResolution?: "prefer-google" | "prefer-markec" | "manual"
}

export function GoogleCalendarSync({
  isConnected = false,
  lastSyncAt,
  syncDirection = "both",
  autoSync = true,
  conflictResolution = "manual",
}: GoogleCalendarSyncProps) {
  const [connected, setConnected] = useState(isConnected)
  const [syncing, setSyncing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [direction, setDirection] = useState(syncDirection)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(autoSync)
  const [conflictMode, setConflictMode] = useState(conflictResolution)

  const handleConnect = async () => {
    // In real app, this would trigger Google OAuth flow
    toast.info("Odpiranje Google prijave...")
    
    // Simulate connection
    setTimeout(() => {
      setConnected(true)
      toast.success("Google Calendar povezan!")
    }, 1500)
  }

  const handleDisconnect = () => {
    setConnected(false)
    toast.success("Google Calendar odklopljen")
  }

  const handleSync = async () => {
    setSyncing(true)
    
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000))
    
    setSyncing(false)
    toast.success("Sinhronizacija uspešna! 5 terminov posodobljenih.")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon size={20} />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Sinhronizacija terminov z Google Koledarjem.
            </CardDescription>
          </div>
          {connected && (
            <Badge variant="outline" className="text-green-600">
              <CheckCircleIcon size={12} className="mr-1" />
              Povezano
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!connected ? (
          /* Not connected state */
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CalendarIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="mb-2 font-semibold">Povežite Google Calendar</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Sinhronizirajte termine med MARKEC in Google Koledarjem.
              </p>
              <Button onClick={handleConnect}>
                <CalendarIcon size={16} className="mr-2" />
                Poveži Google Calendar
              </Button>
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Zakaj povezati?</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-green-500" />
                  Avtomatska sinhronizacija terminov
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-green-500" />
                  Vidite termine v mobilnem koledarju
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-green-500" />
                  Opomniki iz Googla
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon size={14} className="text-green-500" />
                  Dvosmerna sinhronizacija
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* Connected state */
          <div className="space-y-6">
            {/* Sync status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircleIcon size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Google Calendar povezan</p>
                  <p className="text-sm text-muted-foreground">
                    {lastSyncAt
                      ? `Zadnja sinhronizacija: ${lastSyncAt}`
                      : "Še ni sinhronizirano"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshIcon size={16} className={`mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sinhroniziram..." : "Sinhroniziraj zdaj"}
              </Button>
            </div>

            {/* Sync direction */}
            <div>
              <h4 className="mb-3 text-sm font-medium">Smer sinhronizacije</h4>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setDirection("import")}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    direction === "import"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <ArrowLeftIcon size={20} className="mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">Samo uvoz</p>
                  <p className="text-xs text-muted-foreground">Google → MARKEC</p>
                </button>
                <button
                  onClick={() => setDirection("export")}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    direction === "export"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <ArrowRightIcon size={20} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Samo izvoz</p>
                  <p className="text-xs text-muted-foreground">MARKEC → Google</p>
                </button>
                <button
                  onClick={() => setDirection("both")}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    direction === "both"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <RefreshIcon size={20} className="mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium">Dvosmerno</p>
                  <p className="text-xs text-muted-foreground">Obe smeri</p>
                </button>
              </div>
            </div>

            {/* Auto sync */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Samodejna sinhronizacija</p>
                <p className="text-sm text-muted-foreground">
                  Sinhroniziraj vsakih 15 minut
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              />
            </div>

            {/* Conflict resolution */}
            <div>
              <h4 className="mb-3 text-sm font-medium">Reševanje konfliktov</h4>
              <Select value={conflictMode} onValueChange={(v: any) => setConflictMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefer-google">Preferiraj Google</SelectItem>
                  <SelectItem value="prefer-markec">Preferiraj MARKEC</SelectItem>
                  <SelectItem value="manual">Ročno reševanje</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Kaj storiti, ko se termin spremeni v obeh sistemih?
              </p>
            </div>

            {/* Settings button */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSettings(true)}>
                Napredne nastavitve
              </Button>
              <Button variant="destructive" onClick={handleDisconnect}>
                Odklopi
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Napredne nastavitve</DialogTitle>
            <DialogDescription>
              Prilagodite sinhronizacijo z Google Koledarjem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Koledar za sinhronizacijo</label>
              <Select defaultValue="primary">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primarni koledar</SelectItem>
                  <SelectItem value="work">Delovni koledar</SelectItem>
                  <SelectItem value="personal">Osebni koledar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Barva terminov</label>
              <Select defaultValue="default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Privzeta</SelectItem>
                  <SelectItem value="blue">Modra</SelectItem>
                  <SelectItem value="green">Zelena</SelectItem>
                  <SelectItem value="purple">Vijolična</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Opomniki</label>
              <Select defaultValue="15">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minut prej</SelectItem>
                  <SelectItem value="15">15 minut prej</SelectItem>
                  <SelectItem value="30">30 minut prej</SelectItem>
                  <SelectItem value="60">1 uro prej</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Prekliči
            </Button>
            <Button onClick={() => {
              setShowSettings(false)
              toast.success("Nastavitve shranjene")
            }}>
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}