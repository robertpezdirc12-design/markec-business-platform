// ============================================================
// BUSINESS REPORTS DASHBOARD (Fresha-inspired 2026-11-15)
// Key business metrics with visual charts.
// Revenue, appointments, customers, services performance.
// ============================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  TrendingUpIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  UsersIcon,
  ScissorsIcon,
  ShoppingBagIcon,
} from "@/components/icons"
import { TrendDown as TrendingDownIcon } from "@phosphor-icons/react/dist/ssr"

interface BusinessMetrics {
  revenue: {
    today: number
    thisWeek: number
    thisMonth: number
    lastMonth: number
    change: number // percentage
  }
  appointments: {
    today: number
    thisWeek: number
    thisMonth: number
    completed: number
    cancelled: number
    noShow: number
  }
  customers: {
    total: number
    new: number
    returning: number
    averageVisitValue: number
  }
  services: {
    top: { name: string; count: number; revenue: number }[]
  }
  products: {
    top: { name: string; count: number; revenue: number }[]
  }
}

interface ReportsDashboardProps {
  metrics: BusinessMetrics
}

function MetricCard({
  icon,
  label,
  value,
  change,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  change?: number
  color: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`${color} rounded-lg p-3 text-white`}>
              {icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
              {change >= 0 ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
              <span className="text-sm font-medium">
                {change >= 0 ? "+" : ""}{change}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Simple bar chart
function MiniBarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data)
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{label}</p>
      <div className="flex h-20 items-end gap-1">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary"
            style={{ height: `${(value / max) * 100}%` }}
            title={`${value}`}
          />
        ))}
      </div>
    </div>
  )
}

export function ReportsDashboard({ metrics }: ReportsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<CurrencyDollarIcon size={24} />}
          label="Danes"
          value={`${metrics.revenue.today} €`}
          color="bg-green-500"
        />
        <MetricCard
          icon={<CurrencyDollarIcon size={24} />}
          label="Ta teden"
          value={`${metrics.revenue.thisWeek} €`}
          color="bg-blue-500"
        />
        <MetricCard
          icon={<CurrencyDollarIcon size={24} />}
          label="Ta mesec"
          value={`${metrics.revenue.thisMonth} €`}
          change={metrics.revenue.change}
          color="bg-purple-500"
        />
        <MetricCard
          icon={<CalendarIcon size={24} />}
          label="Termini danes"
          value={metrics.appointments.today}
          color="bg-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Appointments Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon size={20} />
              Statistika terminov
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-2xl font-bold text-green-700">
                    {metrics.appointments.completed}
                  </p>
                  <p className="text-xs text-green-600">Zaključeno</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-2xl font-bold text-red-700">
                    {metrics.appointments.cancelled}
                  </p>
                  <p className="text-xs text-red-600">Preklicano</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-2xl font-bold text-gray-700">
                    {metrics.appointments.noShow}
                  </p>
                  <p className="text-xs text-gray-600">Ni prišel</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ta teden</span>
                  <span className="font-medium">{metrics.appointments.thisWeek} terminov</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ta mesec</span>
                  <span className="font-medium">{metrics.appointments.thisMonth} terminov</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon size={20} />
              Stranke
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">
                    {metrics.customers.total}
                  </p>
                  <p className="text-sm text-blue-600">Vseh strank</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">
                    {metrics.customers.new}
                  </p>
                  <p className="text-sm text-green-600">Novih ta mesec</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vračajoče se</span>
                  <span className="font-medium">{metrics.customers.returning}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Povprečna vrednost obiska</span>
                  <span className="font-medium">{metrics.customers.averageVisitValue} €</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Services & Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScissorsIcon size={20} />
              Najbolj priljubljene storitve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.services.top.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Ni podatkov
                </p>
              ) : (
                metrics.services.top.map((service, i) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{i + 1}</Badge>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.count} uporab
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-green-600">{service.revenue} €</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBagIcon size={20} />
              Najbolj prodajani izdelki
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.products.top.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Ni podatkov
                </p>
              ) : (
                metrics.products.top.map((product, i) => (
                  <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{i + 1}</Badge>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.count} prodanih
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-green-600">{product.revenue} €</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
