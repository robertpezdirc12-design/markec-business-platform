import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { requirePagePermission } from "@/lib/auth/guards"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { getSeamstressOverview, listAllMeasurements } from "@/app/actions/seamstress"
import { listCustomers } from "@/app/actions/customers"
import { buildSmartSuggestions } from "@/lib/profiles/smart-suggestions"
import { SmartSuggestionsCard } from "@/components/dashboard/smart-suggestions-card"
import { SeamstressActions } from "@/components/dashboard/seamstress-actions"

export default async function SeamstressDashboard() {
  await requirePagePermission("workorders.manage")
  const profile = await getSessionEffectiveProfile()
  const isSeamstress = profile.extensions.includes("seamstress-measurements")
  const [overview, measurements, customers] = await Promise.all([
    isSeamstress ? getSeamstressOverview().catch(() => null) : Promise.resolve(null),
    isSeamstress ? listAllMeasurements().catch(() => []) : Promise.resolve([]),
    isSeamstress ? listCustomers().catch(() => []) : Promise.resolve([]),
  ])
  const customerOptions = customers.map((c) => ({ id: c.id, name: c.name }))

  const suggestions = isSeamstress && overview
    ? buildSmartSuggestions({
        counts: {
          apiary: 0,
          hive: 0,
          colony: 0,
          inspection: 0,
          harvest: 0,
          products: 0,
          orders: overview.counts.customOrders,
          workOrders: overview.counts.customOrders,
          measurements: overview.counts.measurements,
          materialMovements: overview.counts.materialsConsumed,
          readyForDelivery: overview.counts.readyForDelivery,
        },
        published: false,
        tireService: false,
        beekeeping: false,
        seamstress: true,
        shopCapable: true,
        limit: 4,
      })
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {profile.label}
          </h1>
          <p className="text-muted-foreground">
            Povpraševanja, naročila po meri, meritve, poraba materiala, predaja in plačila.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SeamstressActions measurements={measurements} customers={customerOptions} />
          <Button asChild variant="outline">
            <Link href="/dashboard/records">Evidence</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/projects">Projekti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/products">Materiali / zaloga</Link>
          </Button>
        </div>
      </div>

      {!isSeamstress || !overview ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aktivirani profil nima razširitve šiviljstva (seamstress-measurements).
          </CardContent>
        </Card>
      ) : (
        <>
          {suggestions.length > 0 && (
            <SmartSuggestionsCard verticalLabel={profile.label} suggestions={suggestions} />
          )}

          {/* Koristni kazalniki */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Povpraševanja", value: overview.counts.inquiries, href: "/dashboard/work-orders" },
              { label: "Naročila po meri", value: overview.counts.customOrders, href: "/dashboard/work-orders" },
              { label: "Meritve strank", value: overview.counts.measurements, href: "/dashboard/seamstress#measurements" },
              { label: "Roki izdelave", value: overview.recentOrders.filter((o) => o.dueDate).length, href: "/dashboard/work-orders" },
              { label: "Za predajo", value: overview.counts.readyForDelivery, href: "/dashboard/work-orders" },
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

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Aktivna dela</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.counts.activeOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Poraba materiala</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.counts.materialsConsumed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Nizka zaloga materialov</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.counts.lowStock}</div>
              </CardContent>
            </Card>
          </div>

          {/* Naročila po meri */}
          <Card id="orders">
            <CardHeader>
              <CardTitle>Naročila po meri</CardTitle>
              <CardDescription>Proizvodni proces: povpraševanje → meritve → predračun → potrditev → izdelava → predaja → plačilo.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.recentOrders.length === 0 ? (
                <p className="text-muted-foreground">Ni še naročil. Ustvarite prvo iz povpraševanja stranke.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.recentOrders.map((o) => (
                    <li key={o.id} className="border-b last:border-0 pb-2 last:pb-0 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link href={`/dashboard/work-orders/${o.id}`} className="font-medium hover:underline">
                          #{o.number} — {o.title}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {o.customerName ?? "—"} · stopnja: {o.currentStage ?? o.status}
                          {o.dueDate ? ` · rok: ${o.dueDate.toISOString().slice(0, 10)}` : ""}
                          {o.total != null ? ` · cena: ${o.total.toFixed(2)} €` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Meritve strank */}
            <Card id="measurements">
              <CardHeader>
                <CardTitle>Meritve strank</CardTitle>
                <CardDescription>Merilni listi (append-only — vsaka meritev nov zapis z datumom in zgodovino).</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.recentMeasurements.length === 0 ? (
                  <p className="text-muted-foreground">Ni še meritev. Snemite prvi merilni list stranke.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.recentMeasurements.slice(0, 8).map((m) => (
                      <li key={m.id} className="border-b last:border-0 pb-2 last:pb-0 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{m.customerName ?? "Brez stranke"} · {m.measuredAt ?? "—"}</p>
                          <p className="text-muted-foreground text-xs">
                            prsi {m.chestCm ?? "—"} · pas {m.waistCm ?? "—"} · boki {m.hipsCm ?? "—"} · rokav {m.sleeveCm ?? "—"} · nogav.dolž. {m.inseamCm ?? "—"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Za predajo */}
            <Card id="delivery">
              <CardHeader>
                <CardTitle>Izdelki, pripravljeni za predajo</CardTitle>
                <CardDescription>Naročila v stopnji predaje, pripravljena za prevzem in plačilo.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.readyForDeliveryOrders.length === 0 ? (
                  <p className="text-muted-foreground">Ni izdelkov, pripravljenih za predajo.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.readyForDeliveryOrders.map((o) => (
                      <li key={o.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <Link href={`/dashboard/work-orders/${o.id}`} className="font-medium hover:underline">
                          #{o.number} — {o.title}
                        </Link>
                        <p className="text-muted-foreground text-xs">{o.customerName ?? "—"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nizka zaloga materialov */}
          <Card>
            <CardHeader>
              <CardTitle>Zaloga materialov</CardTitle>
              <CardDescription>Blago in drug material z nizko ali izčrpano zalogo.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.lowStockMaterials.length === 0 ? (
                <p className="text-muted-foreground">Dovolj materiala na zalogi.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Material</th>
                        <th className="pb-2 font-medium">Zaloga</th>
                        <th className="pb-2 font-medium">Rezervirano</th>
                        <th className="pb-2 font-medium">Razpoložljivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.lowStockMaterials.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2">{m.name}</td>
                          <td className="py-2">{m.stock}</td>
                          <td className="py-2">{m.reserved}</td>
                          <td className="py-2">{m.available}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}