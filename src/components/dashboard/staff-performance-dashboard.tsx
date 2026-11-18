// ============================================================
// STAFF PERFORMANCE DASHBOARD (Fresha-inspired 2026-11-15)
// Team performance metrics: revenue, appointments, ratings.
// Like Fresha's "Team" → "Performance" view.
// ============================================================

import { Card, CardContent } from "@/components/ui/card"
import {
  UsersIcon,
  StarIcon,
  
  CurrencyDollarIcon,
  TrendingUpIcon,
} from "@/components/icons"

interface StaffPerformance {
  id: string
  name: string
  role: string
  avatar?: string | null
  metrics: {
    revenue: number
    appointments: number
    completedAppointments: number
    averageRating: number
    totalHours: number
    clientRetention: number // percentage
  }
}

interface StaffPerformanceDashboardProps {
  staff: StaffPerformance[]
  totalRevenue?: number
}

function StaffCard({ staff, maxRevenue }: { staff: StaffPerformance; maxRevenue: number }) {
  const { metrics } = staff
  const revenuePercent = maxRevenue > 0 ? (metrics.revenue / maxRevenue) * 100 : 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {/* Staff info */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
              {staff.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <p className="font-semibold">{staff.name}</p>
              <p className="text-sm text-muted-foreground">{staff.role}</p>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1">
            <StarIcon size={16} className="text-amber-400" />
            <span className="font-medium">{metrics.averageRating.toFixed(1)}</span>
          </div>
        </div>

        {/* Revenue bar */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prihodki</span>
            <span className="font-semibold">{metrics.revenue} €</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${revenuePercent}%` }}
            />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold">{metrics.appointments}</p>
            <p className="text-xs text-muted-foreground">Terminov</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold">{metrics.totalHours}h</p>
            <p className="text-xs text-muted-foreground">Delovnih ur</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold">{metrics.clientRetention}%</p>
            <p className="text-xs text-muted-foreground">Ohranitev strank</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-lg font-bold">
              {metrics.completedAppointments}/{metrics.appointments}
            </p>
            <p className="text-xs text-muted-foreground">Uspešnost</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StaffPerformanceDashboard({
  staff,
  totalRevenue = 0,
}: StaffPerformanceDashboardProps) {
  const maxRevenue = Math.max(...staff.map((s) => s.metrics.revenue), 0)

  // Top performer
  const topPerformer = staff.reduce((top, s) =>
    s.metrics.revenue > (top?.metrics.revenue || 0) ? s : top
  , staff[0])

  return (
    <div className="space-y-6">
      {/* Team Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-500 p-3 text-white">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ekipa</p>
                <p className="text-2xl font-bold">{staff.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-500 p-3 text-white">
                <CurrencyDollarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skupni prihodki</p>
                <p className="text-2xl font-bold">{totalRevenue} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-500 p-3 text-white">
                <StarIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Povprečna ocena</p>
                <p className="text-2xl font-bold">
                  {(staff.reduce((sum, s) => sum + s.metrics.averageRating, 0) / staff.length).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-500 p-3 text-white">
                <TrendingUpIcon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Najboljši</p>
                <p className="text-lg font-bold">{topPerformer?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Cards */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Uspešnost po članih ekipe</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <StaffCard key={member.id} staff={member} maxRevenue={maxRevenue} />
          ))}
        </div>
      </div>
    </div>
  )
}
