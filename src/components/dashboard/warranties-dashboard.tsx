// FAZA 2 — UI: garancije in reklamacije (F2 §3).
"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  listWarranties,
  getWarrantyStatusOverview,
  createWarrantyClaim,
  type WarrantyListItem,
} from "@/app/actions/warranties"

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktivna",
  EXPIRING_SOON: "Poteče kmalu",
  EXPIRED: "Pretekla",
  CLAIMED: "Reklamacija",
  RESOLVED: "Rešena",
  REJECTED: "Zavrnjena",
}

export function WarrantiesDashboard() {
  const router = useRouter()
  const [items, setItems] = useState<WarrantyListItem[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [claimId, setClaimId] = useState<string | null>(null)

  const reload = () =>
    startTransition(async () => {
      const [listR, overR] = await Promise.all([listWarranties(), getWarrantyStatusOverview()])
      if (listR.ok) setItems(listR.items)
      else setError(listR.error)
      if (overR.ok) setCounts(overR.counts)
    })

  useEffect(() => {
    reload()
  }, [])

  const openClaim = async (warrantyId: string, customerName: string) => {
    const description = window.prompt(`Reklamacija za stranko ${customerName} — opišite težavo:`)
    if (!description) return
    setClaimId(warrantyId)
    await createWarrantyClaim({ warrantyId, description })
    setClaimId(null)
    reload()
    router.refresh()
  }

  if (!items) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Nalaganje garancij…{error ? ` (${error})` : ""}</div>
  }

  return (
    <div className="space-y-4">
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-card p-3">
              <div className="text-2xl font-bold">{v}</div>
              <div className="text-xs text-muted-foreground">{STATUS_LABEL[k] ?? k}</div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Ni še garancij. Garancija nastane iz računa za izdelek ali storitev.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Stranka</th>
                <th className="px-4 py-2">Predmet</th>
                <th className="px-4 py-2">Dokument</th>
                <th className="px-4 py-2">Velja do</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Rezerviranja</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2">{it.customerName}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{it.subjectType} · {it.subjectLabel}</td>
                  <td className="px-4 py-2 font-mono text-xs">{it.documentCode ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {it.validUntil ? new Date(it.validUntil).toLocaleDateString("sl-SI") : "—"}
                    {it.validUntilMileage != null ? ` (do ${it.validUntilMileage} km)` : ""}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[it.status] ?? it.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(it.status === "ACTIVE" || it.status === "EXPIRING_SOON") && (
                      <button
                        type="button"
                        disabled={pending && claimId === it.id}
                        onClick={() => openClaim(it.id, it.customerName)}
                        className="mr-1 inline-flex items-center rounded-md border border-destructive px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      >
                        {pending && claimId === it.id ? "…" : "Reklamacija"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}