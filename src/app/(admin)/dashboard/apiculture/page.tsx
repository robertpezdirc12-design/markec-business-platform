import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  UsersIcon,
  HouseIcon,
  CalendarIcon,
  PlusIcon,
  PackageIcon,
  WarningCircleIcon,
} from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { getApicultureOverview } from "@/app/actions/apiculture"
import { buildSmartSuggestions } from "@/lib/profiles/smart-suggestions"
import { SmartSuggestionsCard } from "@/components/dashboard/smart-suggestions-card"

// ============================================================
// ČEBELARSKA NADZORNA PLOŠČA (Z1) — profesionalni pregled za
// čebelarja. Prikazuje ŽIVE podatke iz ExtensionRecord (bee-apiary)
// + zaloge in naročil. Vsa polja org-scoped; prazna stanja prikazana
// kot informacija (brez izmišljenih statistik). Dostop je omejen na
// profil z "bee-apiary" razširitvijo.
// ============================================================

export default async function ApicultureDashboard() {
  await requirePagePermission("workorders.manage")
  const [{ t }] = await Promise.all([getServerI18n()])
  const profile = await getSessionEffectiveProfile()
  const isBeekeeper = profile.extensions.includes("bee-apiary")
  const overview = isBeekeeper ? await getApicultureOverview() : null

  // 2D-1M — pametni predlogi (non-blocking, data-derived, org-scoped).
  // Izhajajo iz dejanskega stanja evidence (getApicultureOverview), ne iz
  // dejavnosti; izginejo, ko je korak opravljen (prem flagri flips).
  const suggestions = isBeekeeper && overview
    ? buildSmartSuggestions({
        counts: {
          apiary: overview.counts.apiary,
          hive: overview.counts.hive,
          colony: overview.counts.colony,
          inspection: overview.counts.inspection,
          harvest: overview.counts.harvest,
          products: overview.products.length,
          orders: overview.recentOrders,
        },
        published: false, // publikaarni status za čebelarja dalje naj tu; settings dostopen
        beekeeping: true,
        shopCapable: true,
        tireService: false,
        limit: 4,
      })
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isBeekeeper ? "Pregled čebelarstva" : t.dashboard.title}
          </h1>
          <p className="text-muted-foreground">
            {isBeekeeper
              ? "Živi pregled panjskih postaj, panjev, družin, opravil, pridelkov, zaloge in naročil."
              : "Ta plošča je namenjena profilu Čebelar."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/records">
              <PlusIcon size={16} className="mr-1" /> Evidence
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/products">
              <PackageIcon size={16} className="mr-1" /> Izdelki
            </Link>
          </Button>
        </div>
      </div>

      {/* 2D-1M — pametni predlogi (ne-obvezni, osnovni workspace ostane). */}
      {isBeekeeper && overview && (
        <SmartSuggestionsCard
          verticalLabel="Čebelarstvo"
          suggestions={suggestions}
        />
      )}

      {!isBeekeeper || !overview ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aktiviran profil nima razširitve čebelarstva (bee-apiary).
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Čebelarstvo — števci */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Panjske postaje", value: overview.counts.apiary, icon: HouseIcon },
              { label: "Panji", value: overview.counts.hive, icon: PackageIcon },
              { label: "Čebelje družine", value: overview.counts.colony, icon: UsersIcon },
              { label: "Pregledi", value: overview.counts.inspection, icon: CalendarIcon },
              { label: "Pridelki", value: overview.counts.harvest, icon: PackageIcon },
              { label: "Zdravljenja", value: overview.counts.treatment, icon: WarningCircleIcon },
              { label: "Hranjenje", value: overview.counts.feeding, icon: PackageIcon },
              { label: "Opravila", value: overview.counts.task, icon: CalendarIcon },
            ].map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                  <c.icon size={18} className="text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Opravila / roki */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Zadnji pregledi</CardTitle>
                <CardDescription>Najnovejši vpisi pregledov družin.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.recentInspections.length === 0 ? (
                  <p className="text-muted-foreground">Ni še zabeleženih pregledov.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.recentInspections.map((i) => (
                      <li key={i.id} className="flex items-center justify-between">
                        <span className="truncate">{i.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {i.createdAt.toLocaleDateString("sl-SI")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opravila, zdravljenja in oskrba</CardTitle>
                <CardDescription>Prihajajoča in odprta opravila.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.tasksDue.length === 0 ? (
                  <p className="text-muted-foreground">Ni odprtih opravil.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.tasksDue.map((x) => (
                      <li key={x.id} className="flex items-center justify-between">
                        <span className="truncate">{x.title || x.entityKey}</span>
                        <span className="text-muted-foreground text-xs">{x.entityKey}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trgovina in zaloge */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Izdelki in zaloge</CardTitle>
                <CardDescription>Razpoložljiva in rezervirana zaloga.</CardDescription>
              </div>
              <Link href="/dashboard/products/stocktake">
                <Button variant="outline" size="sm">Inventura</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {overview.products.length === 0 ? (
                <p className="text-muted-foreground">Ni objavljenih izdelkov.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2">Izdelek</th>
                        <th className="pb-2 text-right">Zaloga</th>
                        <th className="pb-2 text-right">Rezervirano</th>
                        <th className="pb-2 text-right">Razpoložljivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.products.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{p.name}</td>
                          <td className="py-2 text-right">{p.stock}</td>
                          <td className="py-2 text-right">{p.reserved}</td>
                          <td className="py-2 text-right">{p.available}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {overview.lowStock > 0 && (
                <p className="text-amber-600 mt-3 flex items-center gap-1 text-sm">
                  <WarningCircleIcon size={15} /> {overview.lowStock} izdelek(ov) z nizko zalogo (≤ 5).
                </p>
              )}
              <p className="text-muted-foreground mt-3 text-sm">
                Naročila v zadnjih 14 dneh: <strong>{overview.recentOrders}</strong>
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}