// FAZA 2 — UI: seznam ponudb + potrditev/zavrnitev/supersede (F2 §2).
"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { listQuotes, sendQuote, confirmQuote, rejectQuote, supersedeQuote, type QuoteListResult, type QuoteListItem } from "@/app/actions/quotes"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Osnutek",
  SENT: "Poslano",
  CONFIRMED: "Potrjeno",
  REJECTED: "Zavrnjeno",
  SUPERSEDED: "Zamenjano",
}

export function QuotesDashboard() {
  const router = useRouter()
  const [items, setItems] = useState<QuoteListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  const reload = () =>
    startTransition(async () => {
      const r = await listQuotes()
      if (!r.ok) return setError(r.error)
      setItems(r.items)
      setError(null)
    })

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setActionId(id)
    await fn()
    setActionId(null)
    reload()
    router.refresh()
  }

  if (!items) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Nalaganje ponudb…{error ? ` (${error})` : ""}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ponudbe</h1>
        <span className="text-sm text-muted-foreground">{items.length} ponudb</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Ni še nobene ponudbe. Ustvarite jo iz delovnega naloga.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Številka</th>
                <th className="px-4 py-2">Stranka</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Znesek</th>
                <th className="px-4 py-2">Datum</th>
                <th className="px-4 py-2 text-right">Dejanja</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{it.code}</td>
                  <td className="px-4 py-2">{it.customerName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[it.status] ?? it.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{it.total.toFixed(2)} €</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(it.issueDate).toLocaleDateString("sl-SI")}</td>
                  <td className="px-4 py-2 text-right">
                    {it.status === "DRAFT" && (
                      <ActionButton busy={pending && actionId === it.id} onClick={() => act(it.id, () => sendQuote(it.id))}>
                        Pošlji
                      </ActionButton>
                    )}
                    {it.status === "SENT" && (
                      <>
                        <ActionButton busy={pending && actionId === it.id} onClick={() => act(it.id, () => confirmQuote(it.id))}>
                          Potrdi
                        </ActionButton>
                        <ActionButton
                          busy={pending && actionId === it.id}
                          tone="danger"
                          onClick={() => {
                            const reason = window.prompt("Razlog zavrnitve:")
                            if (reason) act(it.id, () => rejectQuote(it.id, reason))
                          }}
                        >
                          Zavrni
                        </ActionButton>
                      </>
                    )}
                    {(it.status === "DRAFT" || it.status === "SENT") && (
                      <ActionButton
                        busy={pending && actionId === it.id}
                        tone="ghost"
                        onClick={() => act(it.id, () => supersedeQuote(it.id))}
                      >
                        Zamenjaj
                      </ActionButton>
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

function ActionButton({
  children,
  onClick,
  busy,
  tone = "default",
}: {
  children: React.ReactNode
  onClick: () => void
  busy?: boolean
  tone?: "default" | "danger" | "ghost"
}) {
  const base =
    tone === "danger"
      ? "border-destructive text-destructive hover:bg-destructive/10"
      : tone === "ghost"
        ? "text-muted-foreground hover:bg-muted"
        : "border-primary text-primary hover:bg-primary/10"
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`mr-1 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${base}`}
    >
      {busy ? "…" : children}
    </button>
  )
}