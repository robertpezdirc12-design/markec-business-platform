"use client"

// ============================================================
// CUSTOMER SEGMENTS (Fresha-inspired 2026-11-15)
// Segment customers by behavior and value.
// Like Fresha's "Client Segments" for targeted marketing.
// ============================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  UsersIcon,
  StarIcon,
  TrendingUpIcon,
  ClockIcon,
  WarningCircleIcon,
} from "@/components/icons"

interface CustomerSegment {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
  count: number
  criteria: string
  totalValue: number
}

interface CustomerSegmentsProps {
  segments: CustomerSegment[]
  onSendCampaign?: (segmentId: string) => void
}

const defaultSegments: CustomerSegment[] = [
  {
    id: "vip",
    name: "VIP stranke",
    description: "Najbolj zveste in donosne stranke",
    icon: <StarIcon size={20} />,
    color: "bg-amber-500",
    count: 0,
    criteria: "Več kot 10 obiskov ali več kot 500 € porabe",
    totalValue: 0,
  },
  {
    id: "regular",
    name: "Redne stranke",
    description: "Redno obiskujejo in porabljajo",
    icon: <StarIcon size={20} />,
    color: "bg-green-500",
    count: 0,
    criteria: "3-10 obiskov v zadnjih 6 mesecih",
    totalValue: 0,
  },
  {
    id: "new",
    name: "Nove stranke",
    description: "Prvi obisk v zadnjem mesecu",
    icon: <UsersIcon size={20} />,
    color: "bg-blue-500",
    count: 0,
    criteria: "Prvi obisk v zadnjih 30 dneh",
    totalValue: 0,
  },
  {
    id: "atrisk",
    name: "V riziku",
    description: "Dolgo brez obiska — potrebujejo reaktivacijo",
    icon: <WarningCircleIcon size={20} />,
    color: "bg-red-500",
    count: 0,
    criteria: "Brez obiska več kot 90 dni",
    totalValue: 0,
  },
  {
    id: "inactive",
    name: "Neaktivne",
    description: "Brez obiska več kot 180 dni",
    icon: <ClockIcon size={20} />,
    color: "bg-gray-500",
    count: 0,
    criteria: "Brez obiska več kot 180 dni",
    totalValue: 0,
  },
]

export function CustomerSegments({
  segments = defaultSegments,
  onSendCampaign,
}: CustomerSegmentsProps) {
  return (
    <div className="space-y-6">
      {/* Segment Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment) => (
          <Card key={segment.id} className="relative overflow-hidden">
            <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full ${segment.color} opacity-10`} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className={`${segment.color} rounded-lg p-2 text-white`}>
                  {segment.icon}
                </div>
                <Badge variant="outline">{segment.count} strank</Badge>
              </div>
              <CardTitle className="mt-2">{segment.name}</CardTitle>
              <CardDescription>{segment.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Criteria */}
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">Kriterij:</p>
                  <p className="text-xs">{segment.criteria}</p>
                </div>

                {/* Value */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Skupna vrednost:</span>
                  <span className="font-semibold">{segment.totalValue} €</span>
                </div>

                {/* Action */}
                {onSendCampaign && segment.count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onSendCampaign(segment.id)}
                  >
                    Pošlji kampanjo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Segment Strategy Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon size={20} />
            Strategija segmentacije
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <StarIcon size={18} className="text-amber-500" />
                <span className="font-medium">VIP stranke</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Ekskluzivne ponudbe in prednostne rezervacije</li>
                <li>• Osebna zahvala in darila ob obletnicah</li>
                <li>• Povabila na posebne dogodke</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <WarningCircleIcon size={18} className="text-red-500" />
                <span className="font-medium">Stranke v riziku</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Reaktivacijska kampanja s popustom</li>
                <li>• Osebno sporočilo: &quot;Pogrešamo vas!&quot;</li>
                <li>• Vprašanje o izkušnji (feedback)</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <UsersIcon size={18} className="text-blue-500" />
                <span className="font-medium">Nove stranke</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Topla dobrodošlica po prvem obisku</li>
                <li>• Vabilo k ponovni rezervaciji</li>
                <li>• Prošnja za oceno/mnenje</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <StarIcon size={18} className="text-green-500" />
                <span className="font-medium">Redne stranke</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Program zvestobe (zbirajte točke)</li>
                <li>• Priporočila na podlagi zgodovine</li>
                <li>• Rojstnodnevne ugodnosti</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
