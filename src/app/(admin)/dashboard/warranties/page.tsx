import { requirePagePermission } from "@/lib/auth/guards"
import { WarrantiesDashboard } from "@/components/dashboard/warranties-dashboard"

// FAZA 2 — GARANCIJE (F2 §3): univerzalni sistem garancij + reklamacij.
export default async function WarrantiesPage() {
  await requirePagePermission("finances.view")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Garancije</h1>
        <p className="text-muted-foreground">
          Univerzalni sistem garancij in reklamacij. Posebnosti po dejavnosti: mehanik (čas + km),
          šiviljstvo (90 dni), čebelarstvo (zakonsko jamstvo 2 leti).
        </p>
      </div>
      <WarrantiesDashboard />
    </div>
  )
}