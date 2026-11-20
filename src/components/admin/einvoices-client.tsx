"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { downloadEinvoice, submitEinvoice } from "@/app/actions/einvoices"

type Row = {
  id: string
  docCode: string
  kindLabel: string
  format: string
  status: string
  validated: boolean
  businessOk: boolean
  xsdApplied: boolean
  peppolApplied: boolean
  standardVersion: string
  size: number
  sha256: string
  createdAt: string
  validationMessages: string | null
}

type Labels = {
  empty: string
  emptyHint: string
  docCode: string
  kind: string
  format: string
  status: string
  validation: string
  downloadXml: string
  sha256: string
  createdAt: string
  sentHint: string
  validated: string
  notValidated: string
  // F5.5.4.6.3 §5
  stageCreated: string
  stageBasic: string
  stageXsd: string
  stageBusiness: string
  stageProfile: string
  stageReady: string
  stageNotVerified: string
  noXsd: string
  noPeppol: string
  xsdPass: string
  peppolPass: string
  xsdFail: string
  peppolFail: string
  // F5.5.4.6.4 — pošiljanje
  send: string
  sendTo: string
  sending: string
  sentState: string
  failedSend: string
  alreadySent: string
  needsChannel: string
  chooseChannel: string
}

function shortHash(h: string): string {
  return h.length > 16 ? h.slice(0, 12) + "…" + h.slice(-8) : h
}

/** Izvede (pošteni) 5-stopenjski status iz shranjenih polj. */
function stages(r: Row, l: Labels): { label: string; ok: boolean | null }[] {
  // 1) XML ustvarjen
  const s: { label: string; ok: boolean | null }[] = [{ label: l.stageCreated, ok: true }]
  // 2) osnovno preverjen (dobro oblikovan + matematika)
  s.push({ label: l.stageBasic, ok: r.businessOk })
  // 3) XSD
  s.push({ label: r.xsdApplied ? l.stageXsd : l.noXsd, ok: r.xsdApplied })
  // 4) poslovno
  s.push({ label: l.stageBusiness, ok: r.businessOk })
  // 5) PEPPOL/e-SLOG profil
  s.push({ label: r.peppolApplied ? l.stageProfile : l.noPeppol, ok: r.peppolApplied })
  return s
}

function validatePill(r: Row, l: Labels): { text: string; cls: string } {
  if (!r.businessOk) return { text: l.notValidated, cls: "bg-amber-500/15 text-amber-600" }
  if (r.peppolApplied && r.xsdApplied && r.validated) {
    return { text: l.stageProfile, cls: "bg-emerald-500/15 text-emerald-600" }
  }
  if (r.xsdApplied && !r.peppolApplied) return { text: l.noPeppol, cls: "bg-amber-500/15 text-amber-600" }
  if (!r.xsdApplied && r.peppolApplied) return { text: l.noXsd, cls: "bg-amber-500/15 text-amber-600" }
  if (!r.xsdApplied && !r.peppolApplied) return { text: l.stageNotVerified, cls: "bg-slate-500/15 text-slate-600" }
  return { text: l.notValidated, cls: "bg-amber-500/15 text-amber-600" }
}

export function EinvoicesClient({
  rows,
  labels,
  channels,
}: {
  rows: Row[]
  labels: Labels
  channels: { id: string; label: string }[]
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [channel, setChannel] = useState<string>("")
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const download = async (row: Row) => {
    setDownloading(row.id)
    try {
      const res = await downloadEinvoice(row.id)
      if (!res) return
      const blob = new Blob([res.xml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const doSend = async (row: Row) => {
    const ch = channel || channels[0]?.id
    if (!ch) {
      setNotice({ kind: "err", text: labels.needsChannel })
      return
    }
    setSendingId(row.id)
    setNotice(null)
    try {
      const res = await submitEinvoice(row.id, ch)
      if (res.ok) {
        setNotice({ kind: "ok", text: res.alreadySubmitted ? labels.alreadySent : labels.sentState })
        // Po osvežitvi statusa preprosto preberi — revalidatePath na strežniku
        // preobrusi podatke; lokalno status pustimo isti, iz strani jo sproži owner.
        row.status = res.state ?? row.status
        if (res.state === "FAILED") setNotice({ kind: "err", text: res.error ?? labels.failedSend })
        else if (res.state === "SENT" || res.state === "DELIVERED") setNotice({ kind: "ok", text: labels.sentState })
      } else {
        setNotice({ kind: "err", text: res.error ?? labels.failedSend })
      }
    } catch {
      setNotice({ kind: "err", text: labels.failedSend })
    } finally {
      setSendingId(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p className="font-medium">{labels.empty}</p>
        <p className="text-sm">{labels.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      {notice ? (
        <div
          className={`px-3 py-2 text-sm ${notice.kind === "ok" ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}
        >
          {notice.text}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">{labels.sendTo}:</span>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded border bg-background px-2 py-1 text-sm"
          aria-label={labels.chooseChannel}
        >
          {channels.length === 0 ? <option value="">{labels.needsChannel}</option> : null}
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{labels.docCode}</th>
              <th className="hidden px-3 py-2 sm:table-cell">{labels.kind}</th>
              <th className="hidden px-3 py-2 md:table-cell">{labels.format}</th>
              <th className="px-3 py-2">{labels.status}</th>
              <th className="px-3 py-2">{labels.validation}</th>
              <th className="hidden px-3 py-2 lg:table-cell">{labels.sha256}</th>
              <th className="px-3 py-2 text-right">{labels.downloadXml}</th>
              <th className="px-3 py-2 text-right">{labels.sendTo}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const pill = validatePill(r, labels)
              const st = stages(r, labels)
              const sent = r.status === "SENT" || r.status === "DELIVERED"
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs">{r.docCode}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{r.kindLabel}</td>
                  <td className="hidden px-3 py-2 md:table-cell text-xs">{r.format}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${sent ? "bg-emerald-500/15 text-emerald-600" : r.status === "FAILED" ? "bg-red-500/15 text-red-600" : r.status === "VALIDATED" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                      {r.status}
                    </span>
                    {r.standardVersion ? (
                      <span className="block mt-1 text-[10px] text-muted-foreground">{r.standardVersion}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${pill.cls}`}>{pill.text}</span>
                    {!r.businessOk && r.validationMessages ? (
                      <span className="block mt-1 text-[10px] text-amber-600">{r.validationMessages.slice(0, 70)}…</span>
                    ) : null}
                    <div className="mt-2 space-y-1">
                      {st.map((sg) => (
                        <div key={sg.label} className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${sg.ok === true ? "bg-emerald-500" : sg.ok === null ? "bg-slate-300" : "bg-amber-500"}`}
                          />
                          <span className="text-[10px] text-muted-foreground">{sg.label}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground lg:table-cell" title={r.sha256}>
                    {shortHash(r.sha256)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" disabled={downloading === r.id} onClick={() => download(r)}>
                      {downloading === r.id ? "…" : labels.downloadXml}
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {sent ? (
                      <span className="text-xs text-emerald-600">{labels.sentState}</span>
                    ) : (
                      <Button size="sm" disabled={sendingId === r.id || channels.length === 0} onClick={() => doSend(r)}>
                        {sendingId === r.id ? labels.sending : labels.send}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}