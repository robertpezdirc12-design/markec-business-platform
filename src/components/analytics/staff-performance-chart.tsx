"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarChart } from "@tremor/react"
import { StaffPerformance } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"
import { UserCogIcon } from "@/components/icons"

// F2.2.2 P2-9: pri ničelnih/nepravilnih vrednostih Tremorjev BarChart ne sme
// proizvesti NaN koordinat (<rect y=NaN>). Vsako plottano vrednost sanitiziramo
// na končno število (NaN/Infinity/negativno nedoločeno → 0) — graf ostane
// prazen stolpec, namesto da zruši SVG os.
const finiteOrZero = (v: number): number =>
  Number.isFinite(v) ? v : 0

interface StaffPerformanceChartProps {
  data: StaffPerformance[]
}

export function StaffPerformanceChart({ data }: StaffPerformanceChartProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  // The Tremor `categories` are LOCALIZED (e.g. "Termini"/"Prihodki" in sl).
  // The data keys MUST match those exact strings, otherwise Recharts reads
  // `undefined` and renders <rect y="NaN"> (F2.2.2 P2-9 — zero-value charts).
  const [catAppointments, catRevenue, catTips, catCommission] =
    t.analytics.staffPerformance.categories
  const chartData = data.map((staff) => ({
    name: staff.name,
    [catAppointments]: finiteOrZero(staff.appointments),
    [catRevenue]: finiteOrZero(staff.revenue),
    // #79: payroll stolpci kot LOČENE kategorije — graf jih ne sešteje v prihodek.
    [catTips]: finiteOrZero(staff.tips),
    [catCommission]: finiteOrZero(staff.commission),
  }))

  const totalAppointments = data.reduce((sum, s) => sum + finiteOrZero(s.appointments), 0)
  const totalRevenue = data.reduce((sum, s) => sum + finiteOrZero(s.revenue), 0)
  const totalTips = data.reduce((sum, s) => sum + finiteOrZero(s.tips), 0)
  const totalCommission = data.reduce((sum, s) => sum + finiteOrZero(s.commission), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
              <UserCogIcon size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t.analytics.staffPerformance.title}{" "}
                <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                  {t.analytics.staffPerformance.titleAccent}
                </span>
              </CardTitle>
              <CardDescription>{t.analytics.staffPerformance.description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalAppointments(totalAppointments)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalRevenue}:{" "}
                <span className="font-semibold text-foreground">{fmt(totalRevenue)}</span>
              </span>
            </div>
            {/* #79: ločene vsote za napitnine in provizije — payroll vrstici. */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalTips}:{" "}
                <span className="font-semibold text-foreground">{fmt(totalTips)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-sky-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalCommission}:{" "}
                <span className="font-semibold text-foreground">{fmt(totalCommission)}</span>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50">
            <BarChart
              className="h-72"
              data={chartData}
              index="name"
              categories={[t.analytics.staffPerformance.categories[0], t.analytics.staffPerformance.categories[1]]}
              colors={["rose", "amber"]}
              yAxisWidth={60}
              showAnimation
              showGridLines
              valueFormatter={(value: number) =>
                finiteOrZero(value).toLocaleString()
              }
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">{t.analytics.staffPerformance.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
