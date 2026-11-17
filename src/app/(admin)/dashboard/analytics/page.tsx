import { Suspense } from "react"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { CampaignAnalytics } from "@/components/dashboard/campaign-analytics"
import { DataConnector } from "@/components/dashboard/data-connector"
import {
  getKPIData,
  getRevenueChartData,
  getTopServices,
  getTopProducts,
  getAppointmentsByStatus,
  getEnquiriesByStatus,
  getStaffPerformance,
} from "@/app/actions/analytics"
import { PeriodType } from "@/lib/interfaces"
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton"
import { requirePagePermission } from "@/lib/auth/guards"

export const metadata = {
  // P1 #107: slovenski naslov namesto mešanice "Analytics | Poslovna
  // platforma" — preostanek iz zgodnjega prevoda.
  title: "Analitika",
  description:
    "Pregled uspešnosti poslovanja — prihodki, termini, naročila in stranke.",
}

interface AnalyticsPageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  // Custom roles (G8): server-side page guard
  await requirePagePermission("analytics.view")
  const params = await searchParams
  const period = (params.period as PeriodType) || "30d"

  // Validate period
  const validPeriods: PeriodType[] = ["7d", "30d", "90d", "12m"]
  const validPeriod = validPeriods.includes(period) ? period : "30d"

  // Fetch all data in parallel on the server
  const [kpi, revenue, topServices, topProducts, appointmentsStatus, enquiriesStatus, staffPerformance] =
    await Promise.all([
      getKPIData(validPeriod),
      getRevenueChartData(validPeriod),
      getTopServices(validPeriod),
      getTopProducts(validPeriod),
      getAppointmentsByStatus(validPeriod),
      getEnquiriesByStatus(validPeriod),
      getStaffPerformance(validPeriod),
    ])

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsDashboard
          data={{
            kpi,
            revenue,
            topServices,
            topProducts,
            appointmentsStatus,
            enquiriesStatus,
            staffPerformance,
          }}
          period={validPeriod}
        />
      </Suspense>

      {/* Campaign Analytics */}
      <CampaignAnalytics
        campaigns={[]}
        totalRevenue={0}
        totalSent={0}
      />

      {/* Data Connector */}
      <DataConnector />
    </div>
  )
}
