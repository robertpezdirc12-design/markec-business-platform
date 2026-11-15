import { requirePagePermission } from "@/lib/auth/guards"
import { CostsAnalytics } from "@/components/dashboard/costs-analytics"

// FAZA 2 — STROŠKOVNA ANALITIKA (F2 §4) nadzorna plošča.
// Stroški materiala/dela čakajo F1; ta pregled prihodek (iz računov) takoj.
export default async function CostsPage() {
  await requirePagePermission("finances.view")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analitika stroškov</h1>
        <p className="text-muted-foreground">
          Prihodki, stroški, dobiček in marža po mesecih in strankah.
        </p>
      </div>
      <CostsAnalytics />
    </div>
  )
}