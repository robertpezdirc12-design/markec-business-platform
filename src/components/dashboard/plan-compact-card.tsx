import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PlanContext } from "@/lib/plans/resolve"

interface PlanCompactCardProps {
  planContext: PlanContext
}

/**
 * COMPACT plan status for the dashboard (2026-11-15 reorganization).
 * Shows plan name + top usage bars. Full plan management: "Upravljaj paket".
 */
export function PlanCompactCard({ planContext }: PlanCompactCardProps) {
  const { plan, usage } = planContext

  const rows = [
    { label: "Storitve", used: usage.services, max: plan.limits.services },
    { label: "Izdelki", used: usage.products, max: plan.limits.products },
    { label: "Zaposleni", used: usage.staff, max: plan.limits.staff },
    { label: "Naročila", used: usage.orders, max: plan.limits.orders },
  ].filter((l) => l.max !== null && l.max > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Paket in raba</CardTitle>
        <Badge variant="secondary" className="text-xs">{plan.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((l) => {
          const pct = Math.min((l.used / (l.max ?? 1)) * 100, 100)
          return (
            <div key={l.label} className="space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>{l.label}</span>
                <span>{l.used} / {l.max}</span>
              </div>
              <div className="bg-primary/10 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        <Link
          href="/dashboard/settings"
          className="text-primary hover:underline inline-block pt-1 text-xs font-medium"
        >
          Upravljaj paket →
        </Link>
      </CardContent>
    </Card>
  )
}
