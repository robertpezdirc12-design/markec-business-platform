import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReceiptIcon, WarningCircleIcon } from "@/components/icons"
import { requirePagePermission } from "@/lib/auth/guards"
import { getServerI18n } from "@/lib/i18n/server"
import { getDebtorsOverview } from "@/app/actions/work-order-payments"

// ============================================================
// PLAČILA IN PREOSTANKI (2026-11-18)
//
// Pregled dolžnikov: odprta delovna naročila z zneskom in neporavnanim
// preostankom. Denar se NE vodi tu — vsako plačilo je vrstica na naročilu
// (WorkOrderPayment), ta stran je samo pogled »kdo še ni plačal«.
// ============================================================

export default async function PaymentsPage() {
  await requirePagePermission("workorders.manage")
  const [{ t, locale }, overview] = await Promise.all([
    getServerI18n(),
    getDebtorsOverview(),
  ])
  const p = t.common.paymentsPage

  const eur = (n: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-GB" : "sl-SI", {
      style: "currency",
      currency: "EUR",
    }).format(n)

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—"

  const stats = [
    { key: "outstanding", label: p.totalOutstanding, value: eur(overview.totals.balance) },
    { key: "overdue", label: p.overdue, value: eur(overview.totals.overdueBalance) },
    { key: "count", label: p.orders, value: String(overview.totals.count) },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ReceiptIcon size={26} />
          {p.title}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-prose">{p.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.key}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overview.rows.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-6">
            <ReceiptIcon size={20} className="text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{p.empty}</p>
              <p className="text-muted-foreground mt-1 text-sm">{p.emptyHint}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-4 py-3 font-medium">{p.columns.order}</th>
                  <th className="px-4 py-3 font-medium">{p.columns.customer}</th>
                  <th className="px-4 py-3 font-medium">{p.columns.due}</th>
                  <th className="px-4 py-3 text-right font-medium">{p.columns.total}</th>
                  <th className="px-4 py-3 text-right font-medium">{p.columns.paid}</th>
                  <th className="px-4 py-3 text-right font-medium">{p.columns.balance}</th>
                  <th className="px-4 py-3 font-medium">{p.columns.deposit}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {overview.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        #{String(row.number).padStart(3, "0")} · {row.title}
                      </div>
                      {row.overdue && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600">
                          <WarningCircleIcon size={12} />
                          {p.overdueBadge}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.customerName ?? "—"}
                      {row.customerEmail && (
                        <div className="text-muted-foreground text-xs">{row.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(row.dueDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(row.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(row.paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {eur(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.depositPending === null ? "—" : eur(row.depositPending)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/work-orders/${row.id}`}>{p.open}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
