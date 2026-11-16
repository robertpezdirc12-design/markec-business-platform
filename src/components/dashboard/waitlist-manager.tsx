"use client"

// ============================================================
// WAITLIST MANAGER (Fresha-inspired 2026-11-15)
// Manage appointment waitlist for busy time slots.
// Like Fresha's "Waitlist" — fill cancellations automatically.
// ============================================================

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  BellIcon,
  ArrowRightIcon,
} from "@/components/icons"

interface WaitlistEntry {
  id: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  serviceName: string
  preferredDate: string
  preferredTime: string
  status: "WAITING" | "NOTIFIED" | "BOOKED" | "CANCELLED"
  addedAt: string
  priority: number // 1 = highest
}

interface WaitlistManagerProps {
  entries: WaitlistEntry[]
}

const statusConfig = {
  WAITING: { label: "Čaka", color: "bg-amber-500 text-white" },
  NOTIFIED: { label: "Obveščen", color: "bg-blue-500 text-white" },
  BOOKED: { label: "Rezerviran", color: "bg-green-500 text-white" },
  CANCELLED: { label: "Preklican", color: "bg-gray-500 text-white" },
}

export function WaitlistManager({ entries }: WaitlistManagerProps) {
  const [items, setItems] = useState<WaitlistEntry[]>(entries)

  const handleNotify = (id: string) => {
    setItems((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "NOTIFIED" as const } : e))
    )
    toast.success("Stranka obveščena o prostem terminu!")
  }

  const handleBook = (id: string) => {
    setItems((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "BOOKED" as const } : e))
    )
    toast.success("Termin rezerviran iz čakalne vrste!")
  }

  const handleCancel = (id: string) => {
    setItems((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "CANCELLED" as const } : e))
    )
    toast.success("Vnos odstranjen iz čakalne vrste")
  }

  const waitingEntries = items.filter((e) => e.status === "WAITING")
  const notifiedEntries = items.filter((e) => e.status === "NOTIFIED")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Čakalna vrsta</h2>
          <p className="text-muted-foreground">
            Stranke, ki čakajo na prost termin.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <ClockIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Čaka</p>
                <p className="text-2xl font-bold">{waitingEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <BellIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Obveščenih</p>
                <p className="text-2xl font-bold">{notifiedEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500 p-3 text-white">
                <CheckCircleIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skupaj</p>
                <p className="text-2xl font-bold">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waitlist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon size={20} />
            Čakajoče stranke
          </CardTitle>
          <CardDescription>
            Ko se sprosti termin, obvestite naslednjo stranko v vrsti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-8 text-center">
              <UsersIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Čakalna vrsta je prazna.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items
                .sort((a, b) => a.priority - b.priority)
                .map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      entry.status === "BOOKED"
                        ? "bg-green-50 border-green-200"
                        : entry.status === "NOTIFIED"
                          ? "bg-blue-50 border-blue-200"
                          : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Priority */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold">
                        {index + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{entry.customerName}</p>
                          <Badge className={statusConfig[entry.status].color}>
                            {statusConfig[entry.status].label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{entry.serviceName}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ClockIcon size={12} />
                            {entry.preferredDate} {entry.preferredTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {entry.status === "WAITING" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleNotify(entry.id)}
                          >
                            <BellIcon size={14} className="mr-1" />
                            Obvesti
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBook(entry.id)}
                          >
                            Rezerviraj
                          </Button>
                        </>
                      )}
                      {entry.status === "NOTIFIED" && (
                        <Button
                          size="sm"
                          onClick={() => handleBook(entry.id)}
                        >
                          <CheckCircleIcon size={14} className="mr-1" />
                          Potrdi rezervacijo
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(entry.id)}
                      >
                        <XCircleIcon size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>Kako deluje čakalna vrsta?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Stranka se doda v čakalno vrsto</p>
                <p className="text-sm text-muted-foreground">
                  Ko so termini zasedeni, se stranka lahko prijavi v čakalno vrsto.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Sprosti se termin</p>
                <p className="text-sm text-muted-foreground">
                  Ko stranka prekliče ali spremeni termin, se sprosti prostor.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Obvestite naslednjo stranko</p>
                <p className="text-sm text-muted-foreground">
                  Kliknite &quot;Obvesti&quot; in stranka prejme e-pošto o prostem terminu.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
