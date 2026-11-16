"use client"

// ============================================================
// FAZA 2C-3 — UNIVERZALNI RECORD DETAIL (generični vzorec)
//
// NAMEN: odpreti podrobnosti posameznega ExtensionRecord (tabela → gumb
// "Podrobnosti"), prikazati njegova polja in omogočiti RAZŠIRJENE SEKCIJE
// odvisne od vrste entitete — brez da bi jedro vsebovalo industrijske podrobnosti.
//
// Zgradba:
//   - generični del nariše vsa deklarativna polja entitete (vrednosti, ne urejanje).
//   - razširive je switch na `entity.key`: za "colony" se izriše čebelarski
//     razdelek (trenutna lokacija + zgodovina selitev + Preseli/Popravi), ki
//     klice le obstojece strežniške akcije. Druge dejavnosti lahko dodajo
//     LASTNE razširitvene sekcije v tem istem vzorcu (npr. "service_event").
//
// Vse akcije so org-scoped (requirePermissionOrg na strežniku); `performed_by`
// se NIKOLI ne posilja iz browserja. `colony.hive_ref` ostaja edini vir lokacije.
// ============================================================

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { SpinnerGapIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import type { ExtensionEntityInfo, ExtensionRecordItem } from "@/app/actions/records"
import { listExtensionRecordOptions } from "@/app/actions/records"
import {
  createColonyMove,
  correctColonyMove,
  listColonyMoveDetail,
} from "@/app/actions/colony-moves"
import type { ProfileFieldDef } from "@/lib/profiles/types"

interface RecordDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: ExtensionEntityInfo
  record: ExtensionRecordItem
}

function labelOf(f: ProfileFieldDef): string {
  return f.label
}

export function RecordDetail({ open, onOpenChange, entity, record }: RecordDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record.title}</DialogTitle>
          <DialogDescription>{entity.name} · {entity.extensionId}</DialogDescription>
        </DialogHeader>

        {/* Generični del: izpis polj (read-only) */}
        <div className="grid gap-3 sm:grid-cols-2">
          {entity.fields
            .filter((f) => f.type !== "textarea")
            .slice(0, 12)
            .map((f) => (
              <div key={f.key}>
                <div className="text-muted-foreground text-xs">{labelOf(f)}</div>
                <div className="text-sm">{valueText(entity.fields, record, f)}</div>
              </div>
            ))}
        </div>

        {/* RAZŠIRITEV za čebeljo družino — izolira čebelarsko logiko od jedra */}
        {entity.key === "colony" ? (
          <ColonyDetailSection colonyId={record.id} onRefreshRequested={() => {}} />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zapri
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function valueText(
  fields: ProfileFieldDef[],
  record: ExtensionRecordItem,
  f: ProfileFieldDef
): string {
  const v = (record.data as Record<string, unknown>)[f.key]
  if (v === undefined || v === null || v === "") return "—"
  if (typeof v === "object") {
    const o = v as { id?: string; extensionId?: string; entityKey?: string }
    return o.id ? o.id : JSON.stringify(v)
  }
  return String(v)
}

// ============================================================
// ČEBELARSKA RAZŠIRITEV — zgodovina selitev družine (2C-3)
// Klice le obstoječe akcije (createColonyMove / correctColonyMove /
// listColonyMoveDetail). performed_by bere strežnik; UI ga ne posilja.
// ============================================================
function ColonyDetailSection({ colonyId }: { colonyId: string; onRefreshRequested: () => void }) {
  const { t, locale } = useI18n()
  const D = t.recordsPage.detail
  const [data, setData] = useState<Awaited<ReturnType<typeof listColonyMoveDetail>> | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [hiveOptions, setHiveOptions] = useState<{ id: string; title: string }[]>([])
  const [, startTransition] = useTransition()

  // reload counter za osvežitev po akciji
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    listColonyMoveDetail(colonyId)
      .then((d) => {
        if (alive) { setData(d); setLoadErr(null) }
      })
      .catch(() => {
        if (alive) setLoadErr(D.loadError)
      })
    listExtensionRecordOptions({ extensionId: "bee-apiary", entityKey: "hive" })
      .then((rows) => {
        if (alive) setHiveOptions(rows.map((r) => ({ id: r.id, title: r.title })))
      })
      .catch(() => {
        if (alive) setHiveOptions([])
      })
    return () => {
      alive = false
    }
  }, [colonyId, tick, D.loadError])

  const currentHiveTitle = data?.currentHiveTitle
  const currentApiary = data?.currentApiaryTitle
  const events = data?.events ?? []

  const [moveOpen, setMoveOpen] = useState(false)
  const [correction, setCorrection] = useState<{ eventId: string; target: string; reason: string } | null>(null)
  const [pending, startPending] = useTransition()

  const resolveError = (code: string | undefined): string => {
    switch (code) {
      case "DUPLICATE": return D.duplicateMove
      case "STALE_MOVED_AT": return D.staleMovedAt
      case "STATE_MISMATCH": return D.stateMismatch
      case "SAME_HIVE": return D.sameHive
      case "INVALID_REFERENCE":
      case "INVALID": return D.invalidReference
      case "APPEND_ONLY": return D.appendOnly
      case "FORBIDDEN": return D.forbidden
      default: return D.genericMoveError
    }
  }

  const onMove = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const f = new FormData(form)
    const toHive = String(f.get("toHive") || "")
    const movedAt = String(f.get("movedAt") || "") || null
    const reason = String(f.get("reason") || "") || undefined
    if (!toHive) return
    startPending(async () => {
      const res = await createColonyMove({ colonyId, toHiveId: toHive, movedAt, reason })
      if (res.ok) {
        toast.success(D.moveSuccess)
        setMoveOpen(false)
        setTick((x) => x + 1)
      } else {
        toast.error(resolveError(res.error))
      }
    })
  }

  const onCorrection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!correction) return
    const toHiveId = correction.target
    if (!toHiveId) return
    startPending(async () => {
      const res = await correctColonyMove(correction.eventId, { toHiveId, reason: correction.reason || undefined })
      if (res.ok) {
        toast.success(D.correctSuccess)
        setCorrection(null)
        setTick((x) => x + 1)
      } else {
        toast.error(resolveError(res.error))
      }
    })
  }

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—"
    try {
      return new Date(iso).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US", { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return iso
    }
  }
  const fmtDateTime = (iso?: string | null) => {
    if (!iso) return "—"
    try {
      return new Date(iso).toLocaleString(locale === "sl" ? "sl-SI" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch {
      return iso
    }
  }

  if (loadErr) return <div className="text-destructive text-sm">{loadErr}</div>
  if (!data) return <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm"><SpinnerGapIcon className="animate-spin" /> …</div>

  return (
    <div className="rounded-lg border pt-4">
      {/* Trenutna lokacija */}
      <div className="mb-1 px-4">
        <div className="text-muted-foreground text-xs">{D.currentLocation}</div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{currentHiveTitle || D.notLocated}</span>
          {currentApiary ? (
            <span className="text-muted-foreground text-xs">· {D.currentApiary}: {currentApiary}</span>
          ) : null}
        </div>
      </div>

      {/* Akcija: Preseli družino */}
      <div className="px-4 pt-3">
        <Button size="sm" onClick={() => setMoveOpen(true)} disabled={pending}>
          {D.moveColony}
        </Button>
      </div>

      {/* Zgodovina */}
      <div className="px-4 pt-4">
        <div className="text-sm font-medium">{D.history}</div>
        {events.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">{D.noHistory}</p>
        ) : (
          <ul className="space-y-0">
            {events.map((ev) => {
              const isBase = ev.baseline
              const isCorr = ev.isCorrection
              return (
                <li key={ev.id} className="flex gap-3 border-l py-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {isBase ? (
                        <Badge variant="secondary">{D.baseline}</Badge>
                      ) : isCorr ? (
                        <Badge variant="destructive" className="bg-amber-100 text-amber-900 hover:bg-amber-100">{D.correction}</Badge>
                      ) : (
                        <Badge variant="outline">{D.movePreview}</Badge>
                      )}
                      {ev.correctsRef || isCorr ? (
                        <span className="text-xs">
                          {isCorr ? `${D.corrected} · ${ev.correctionReason ?? ""}` : D.corrected}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm">
                      {isBase ? (
                        <>
                          <span className="font-medium">{ev.toHiveTitle || D.unknownHive}</span>
                          <span className="text-muted-foreground text-xs"> — {D.baselineHint}</span>
                        </>
                      ) : (
                        <>
                          <span>{ev.originUnknown ? D.originUnknown : ev.fromHiveTitle || D.unknownHive}</span>
                          <span className="mx-1">→</span>
                          <span className="font-medium">{ev.toHiveTitle || D.unknownHive}</span>
                        </>
                      )}
                    </div>
                    {ev.reason ? <div className="text-muted-foreground text-xs">“{ev.reason}”</div> : null}
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span>{D.movedAt}: {fmtDate(ev.movedAt)}</span>
                      <span>{D.recordedAt}: {fmtDateTime(ev.recordedAt)}</span>
                      <span>{D.performer}: {ev.performedByName ?? D.unknownUser}</span>
                    </div>
                  </div>
                  {!isCorr && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start text-xs"
                      onClick={() => setCorrection({ eventId: ev.id, target: ev.toHiveId, reason: "" })}
                    >
                      {D.correctEvent}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Forma: nova selitev */}
      {moveOpen ? (
        <form onSubmit={onMove} className="space-y-3 border-t p-4">
          <div className="text-sm font-medium">{D.moveColony}</div>
          <div className="grid gap-2">
            <label className="text-muted-foreground text-xs">{D.targetHive}</label>
            <select name="toHive" className="border-input bg-background h-10 rounded-md border px-3 text-sm">
              <option value="">— {D.targetHive} —</option>
              {hiveOptions.filter((h) => h.id !== data.currentHiveId).map((h) => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-xs">{D.moveDateLabel}</label>
              <input type="date" name="movedAt" className="border-input bg-background h-10 rounded-md border px-3 text-sm" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">{D.reason}</label>
              <input type="text" name="reason" className="border-input bg-background h-10 rounded-md border px-3 text-sm" />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={pending}>{D.confirmMove}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMoveOpen(false)}>{t.recordsPage.cancel}</Button>
        </form>
      ) : null}

      {/* Forma: korekcija */}
      {correction ? (
        <form onSubmit={onCorrection} className="space-y-3 border-t p-4">
          <div className="text-sm font-medium">{D.correctEvent}</div>
          <div className="grid gap-2">
            <label className="text-muted-foreground text-xs">{D.targetHive}</label>
            <select
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={correction.target}
              onChange={(e) => setCorrection((c) => c && { ...c, target: e.target.value })}
            >
              <option value="">—</option>
              {hiveOptions.map((h) => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground text-xs">{D.correctionReason}</label>
            <input
              type="text"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              value={correction.reason}
              onChange={(e) => setCorrection((c) => c && { ...c, reason: e.target.value })}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>{D.confirmCorrection}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCorrection(null)}>{t.recordsPage.cancel}</Button>
        </form>
      ) : null}
    </div>
  )
}