import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { requirePagePermission } from "@/lib/auth/guards"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { getTireServiceOverview, listWorkshopOptions } from "@/app/actions/vehicle-workshop"
import { buildSmartSuggestions } from "@/lib/profiles/smart-suggestions"
import { SmartSuggestionsCard } from "@/components/dashboard/smart-suggestions-card"
import { PartsDialogClient } from "@/components/dashboard/workshop-parts-dialog"

// ============================================================
// DELAVNICA VOZIL & VULKANIZERIJA (2D-1S) — dashboard.
// Prikazuje žive podatke: vozila, kompleti pnevmatik, delovni
// nalogi, nizka zaloga delov, prodaja delov. Org-scoped.
// ============================================================

export default async function TireServiceDashboard() {
  await requirePagePermission("workorders.manage")
  const [{ t }] = await Promise.all([getServerI18n()])
  const profile = await getSessionEffectiveProfile()
  const isTireService = profile.extensions.includes("vehicle-workshop")
  const [overview, options] = await Promise.all([
    isTireService ? getTireServiceOverview().catch(() => null) : Promise.resolve(null),
    isTireService ? listWorkshopOptions().catch(() => null) : Promise.resolve(null),
  ])

  const suggestions = isTireService && overview
    ? buildSmartSuggestions({
        counts: {
          apiary: 0,
          hive: 0,
          colony: 0,
          inspection: 0,
          harvest: 0,
          products: overview.parts.length,
          orders: overview.counts.todayOrders,
          vehicles: overview.counts.vehicles,
          tireSets: overview.counts.tireSets,
          workOrders: overview.counts.workOrders,
          partOrders: overview.counts.completedWorkOrders,
        },
        published: false,
        tireService: true,
        beekeeping: false,
        shopCapable: true,
        limit: 4,
      })
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isTireService ? "Pregled delavnice" : t.dashboard.title}
          </h1>
          <p className="text-muted-foreground">
            Vozila, kompleti pnevmatik, delovni nalogi, poraba delov in zaloga.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/records">Evidence</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/work-orders">Delovni nalogi</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/products">Izdelki / zaloga</Link>
          </Button>
        </div>
      </div>

      {!isTireService || !overview ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aktivirani profil nima razširitve delavnice vozil (vehicle-workshop).
          </CardContent>
        </Card>
      ) : (
        <>
          {suggestions.length > 0 && (
            <SmartSuggestionsCard verticalLabel="Vulkanizer & avtoservis" suggestions={suggestions} />
          )}

          {/* Koristni kazalniki */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Vozila", value: overview.counts.vehicles },
              { label: "Kompleti gum", value: overview.counts.tireSets },
              { label: "Delovni nalogi", value: overview.counts.workOrders },
              { label: "Aktivni (odprti)", value: overview.counts.activeWorkOrders },
              { label: "Odprava v 14 d", value: overview.counts.todayOrders },
            ].map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hitra akcija: poraba delov na delovnem nalogu */}
          {options && (
            <PartsDialogClient options={options} />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Vozila */}
            <Card>
              <CardHeader>
                <CardTitle>Vozila</CardTitle>
                <CardDescription>Evidenca vozil strank.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.activeVehicles.length === 0 ? (
                  <p className="text-muted-foreground">Ni še vozil.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.activeVehicles.map((v) => (
                      <li key={v.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="font-medium">{v.title}</p>
                        <p className="text-muted-foreground text-xs">{v.licensePlate || "—"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Delovni nalogi */}
            <Card>
              <CardHeader>
                <CardTitle>Zadnji delovni nalogi</CardTitle>
                <CardDescription>Nedavno ustvarjeni nalogi.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.recentWorkOrders.length === 0 ? (
                  <p className="text-muted-foreground">Ni še delovnih nalogov.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.recentWorkOrders.map((w) => (
                      <li key={w.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="font-medium">#{w.number} — {w.title}</p>
                        <p className="text-muted-foreground text-xs">status {w.status} · etapa {w.currentStageKey ?? "—"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Zaloga delov */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Zaloga delov in opreme</CardTitle>
                <CardDescription>Razpoložljiva in rezervirana zaloga.</CardDescription>
              </div>
              <Link href="/dashboard/products/stocktake">
                <Button variant="outline" size="sm">Inventura</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {overview.parts.length === 0 ? (
                <p className="text-muted-foreground">Ni izdelkov z zalogo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Izdelek</th>
                        <th className="pb-2 font-medium">Zaloga</th>
                        <th className="pb-2 font-medium">Rezervirano</th>
                        <th className="pb-2 font-medium">Razpoložljivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.parts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3 font-medium">{p.name}</td>
                          <td className="py-3">{p.stock}</td>
                          <td className="py-3">{p.reserved}</td>
                          <td className="py-3">{p.available}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {overview.lowStock.length > 0 && (
                <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  {overview.lowStock.length} izdelek(ov) na nizki zalogi (≤ 5).
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}