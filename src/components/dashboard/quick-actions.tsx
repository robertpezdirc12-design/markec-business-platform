import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PlusIcon,
  CalendarIcon,
  ShoppingBagIcon,
  UsersIcon,
  ScissorsIcon,
} from "@/components/icons"

// ============================================================
// QUICK ACTIONS (Fresha-inspired 2026-11-15)
// Quick access to common actions from dashboard.
// Reduces clicks for frequent tasks.
// ============================================================

interface QuickAction {
  label: string
  href: string
  icon: React.ReactNode
  color: string
}

const quickActions: QuickAction[] = [
  {
    label: "Nova rezervacija",
    href: "/dashboard/appointments/new",
    icon: <CalendarIcon size={20} />,
    color: "bg-blue-500",
  },
  {
    label: "Nova storitev",
    href: "/dashboard/services/new",
    icon: <ScissorsIcon size={20} />,
    color: "bg-purple-500",
  },
  {
    label: "Nov izdelek",
    href: "/dashboard/products/new",
    icon: <ShoppingBagIcon size={20} />,
    color: "bg-green-500",
  },
  {
    label: "Nova stranka",
    href: "/dashboard/users/new",
    icon: <UsersIcon size={20} />,
    color: "bg-orange-500",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusIcon size={20} />
          Hitra dejanja
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant="outline"
                className="flex h-auto flex-col items-center gap-2 py-4 w-full"
              >
                <div className={`${action.color} rounded-lg p-2 text-white`}>
                  {action.icon}
                </div>
                <span className="text-xs font-medium">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
