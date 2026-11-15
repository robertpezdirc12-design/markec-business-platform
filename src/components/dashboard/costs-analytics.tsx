// FAZA 2 — UI: stroškovna analitika (F2 §4) v nadzorni plošči.
"use client"

import { useState, useTransition, useEffect } from "react"
import {
  getCostsByMonth,
  getCostsByCustomer,
  type MonthlyRow,
  type CustomerCostRow,
} from "@/app/actions/dashboard-costs"

const eur = (n: number) => `${n.toFixed(2)} €`

export function CostsAnalytics() {
  const [months, setMonths] = useState<MonthlyRow[] | null>(null)
  const [customers, setCustomers] = useState<CustomerCostRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const [m, c] = await Promise.all([getCostsByMonth(), getCostsByCustomer()])
      if (m.ok) setMonths(m.rows)
      else setError(m.error)
      if (c.ok) setCustomers(c.rows)
    })
  }, [])

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Prihodki / stroški / dobiček po mesecih</h2>
        {!months ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nalaganje…</div>
        ) : months.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Ni podatkov za mesečni pregled.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Mesec</th>
                  <th className="px-3 py-2 text-right">Prihodki</th>
                  <th className="px-3 py-2 text-right">Stroški mat.</th>
                  <th className="px-3 py-2 text-right">Delo</th>
                  <th className="px-3 py-2 text-right">Stroški skupaj</th>
                  <th className="px-3 py-2 text-right">Dobiček</th>
                  <th className="px-3 py-2 text-right">Marža</th>
                </tr>
              </thead>
              <tbody>
                {months.map((r) => (
                  <tr key={`${r.year}-${r.month}`} className="border-t">
                    <td className="px-3 py-2">{`${r.year}-${String(r.month).padStart(2, "0")}`}</td>
                    <td className="px-3 py-2 text-right">{eur(r.revenue)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.costMaterial)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.costLabor)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.costTotal)}</td>
                    <td className={`px-3 py-2 text-right ${r.profit < 0 ? "text-destructive" : ""}`}>{eur(r.profit)}</td>
                    <td className="px-3 py-2 text-right">{r.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Pregled po strankah</h2>
        {!customers ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nalaganje…</div>
        ) : customers.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Ni podatkov o strankah.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Stranka</th>
                  <th className="px-3 py-2 text-right">Naročil</th>
                  <th className="px-3 py-2 text-right">Prihodki</th>
                  <th className="px-3 py-2 text-right">Ø vrednost</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((r) => (
                  <tr key={r.customerId} className="border-t">
                    <td className="px-3 py-2">{r.customerName}</td>
                    <td className="px-3 py-2 text-right">{r.orderCount}</td>
                    <td className="px-3 py-2 text-right">{eur(r.revenue)}</td>
                    <td className="px-3 py-2 text-right">{eur(r.avgOrderValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}