// ============================================================
// CAMPAIGN ANALYTICS (Fresha-inspired 2026-11-15)
// Track marketing campaign performance with charts and metrics.
// Shows opens, clicks, conversions, revenue.
// ============================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  TrendingUpIcon,
  EnvelopeIcon,
  EyeIcon,
  CurrencyDollarIcon,
  UsersIcon,
} from "@/components/icons"
import { CursorClick as CursorClickIcon } from "@phosphor-icons/react/dist/ssr"

interface CampaignStats {
  name: string
  sentCount: number
  openCount: number
  clickCount: number
  conversionCount: number
  revenue: number
  sentAt: string
}

interface CampaignAnalyticsProps {
  campaigns: CampaignStats[]
  totalRevenue?: number
  totalSent?: number
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subValue?: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`${color} rounded-lg p-3 text-white`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CampaignAnalytics({
  campaigns,
  totalRevenue = 0,
  totalSent = 0,
}: CampaignAnalyticsProps) {
  // Brez kampanj ni metrik. Prej je 0 % odprtij sprožilo napačen nasvet
  // "Nizka stopnja odprtij" — to je bil lažen vpogled, ne analitika.
  if (campaigns.length === 0 && totalSent === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="px-5">
          <EmptyState
            icon={<EnvelopeIcon size={44} />}
            title="Še ni poslanih kampanj"
            description="Ko bo poslana prva kampanja, se bodo odprtja, kliki in prihodki prikazali tukaj. Prikazujemo samo resnične rezultate."
            action={{ label: "Ustvari kampanjo", href: "/dashboard/marketing" }}
            secondaryAction={{
              label: "Oglej si stranke",
              href: "/dashboard/customers",
            }}
            size="md"
          />
        </CardContent>
      </Card>
    )
  }

  const totalOpens = campaigns.reduce((sum, c) => sum + c.openCount, 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clickCount, 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversionCount, 0)

  const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0
  const clickRate = totalOpens > 0 ? Math.round((totalClicks / totalOpens) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<EnvelopeIcon size={24} />}
          label="Poslano"
          value={totalSent}
          subValue="e-sporočil"
          color="bg-blue-500"
        />
        <StatCard
          icon={<EyeIcon size={24} />}
          label="Odprto"
          value={`${openRate}%`}
          subValue={`${totalOpens} odprtij`}
          color="bg-green-500"
        />
        <StatCard
          icon={<CursorClickIcon size={24} />}
          label="Klik"
          value={`${clickRate}%`}
          subValue={`${totalClicks} klikov`}
          color="bg-purple-500"
        />
        <StatCard
          icon={<CurrencyDollarIcon size={24} />}
          label="Prihodek"
          value={`${totalRevenue} €`}
          subValue={`${totalConversions} konverzij`}
          color="bg-amber-500"
        />
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon size={20} />
            Uspešnost kampanj
          </CardTitle>
          <CardDescription>
            Primerjava učinkovitosti posameznih kampanj.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Kampanja</th>
                  <th className="pb-3 font-medium">Poslano</th>
                  <th className="pb-3 font-medium">Odprto</th>
                  <th className="pb-3 font-medium">Klik</th>
                  <th className="pb-3 font-medium">Konverzije</th>
                  <th className="pb-3 font-medium">Prihodek</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Ni podatkov o kampanjah
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr key={campaign.name} className="border-b">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.sentAt}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">{campaign.sentCount}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span>{campaign.openCount}</span>
                          <Badge variant="outline" className="text-green-600">
                            {campaign.sentCount > 0
                              ? Math.round((campaign.openCount / campaign.sentCount) * 100)
                              : 0}%
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span>{campaign.clickCount}</span>
                          <Badge variant="outline" className="text-purple-600">
                            {campaign.openCount > 0
                              ? Math.round((campaign.clickCount / campaign.openCount) * 100)
                              : 0}%
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3">{campaign.conversionCount}</td>
                      <td className="py-3 font-semibold text-green-600">
                        {campaign.revenue} €
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon size={20} />
            Priporočila za izboljšave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {openRate < 20 && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                <span className="text-amber-500">💡</span>
                <div>
                  <p className="font-medium text-amber-800">
                    Nizka stopnja odprtij ({openRate}%)
                  </p>
                  <p className="text-sm text-amber-700">
                    Poskusite z bolj privlačnimi zadevami (emoji, vprašanja, osebni nagovor).
                  </p>
                </div>
              </div>
            )}
            {clickRate < 5 && openRate >= 20 && (
              <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
                <span className="text-blue-500">💡</span>
                <div>
                  <p className="font-medium text-blue-800">
                    Nizka stopnja klikov ({clickRate}%)
                  </p>
                  <p className="text-sm text-blue-700">
                    Dodajte jasen CTA gumb in omogočite enostavno rezervacijo.
                  </p>
                </div>
              </div>
            )}
            {openRate >= 20 && clickRate >= 5 && (
              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-3">
                <span className="text-green-500">✅</span>
                <div>
                  <p className="font-medium text-green-800">
                    Odlična uspešnost!
                  </p>
                  <p className="text-sm text-green-700">
                    Vaše kampanje dosegajo nadpovprečne rezultate. Nadaljujte tako!
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
