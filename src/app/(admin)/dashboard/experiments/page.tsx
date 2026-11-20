import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePagePermission } from "@/lib/auth/guards"
import { getServerI18n } from "@/lib/i18n/server"
import { getResolvedOrg } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

// ============================================================
// A/B eksperiment (krajša booking forma) — dashboard.
// Agregira BookingExperimentEvent za trenutno org: število prikazov
// (VIEW) in oddanih terminov (CONVERSION) po varianti, ter stopnjo
// konverzije (%). Basline "full" vs eksperiment "short". Povežemo
// z appointment konverzijo tudi pri oddchi brez DEPOSIT/PENDING.
// ============================================================

interface Row {
  views: number
  conversions: number
  rate: number
}

async function collectByVariant(orgId: string): Promise<Record<string, Row>> {
  const events = await prisma.bookingExperimentEvent.groupBy({
    by: ["variant", "kind"],
    where: { organizationId: orgId },
    _count: { _all: true },
  })
  const map: Record<string, Row> = {
    full: { views: 0, conversions: 0, rate: 0 },
    short: { views: 0, conversions: 0, rate: 0 },
  }
  for (const e of events) {
    const row = map[e.variant] ?? { views: 0, conversions: 0, rate: 0 }
    if (e.kind === "VIEW") row.views += e._count._all
    else row.conversions += e._count._all
    map[e.variant] = row
  }
  for (const k of Object.keys(map) as Array<keyof typeof map>) {
    map[k].rate =
      map[k].views > 0 ? (map[k].conversions / map[k].views) * 100 : 0
  }
  return map
}

export default async function ExperimentsPage() {
  // A/B metrike so del upravljanja poslovanja — večinoma lastnik/admin.
  await requirePagePermission("appointments.view")
  const [{ t }, org] = await Promise.all([getServerI18n(), getResolvedOrg()])
  const orgId = org?.id ?? ""
  const by = await collectByVariant(orgId)
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "0.0")

  const card = (label: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Prikazi (VIEW)</span>
          <span className="font-semibold">{by[label].views}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Oddani (CONVERSION)</span>
          <span className="font-semibold">{by[label].conversions}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Konverzija</span>
          <span className="font-semibold">{fmt(by[label].rate)}%</span>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">A/B — krajša booking forma</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Primerjava polne (full) in krajše (short) oblike: vsako ne-obvezno
            polje zniža konverzijo (NN/g). Prikazujemo dejanske dogodke,
            zabeležene obaut z varianto, ki jo je server dodelil obiskovalcu
            (runtime //xeno — ni build-time).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {card("full")}
        {card("short")}
      </div>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Kako deluje: ko obiskovalec naloži booking stran, server prijavi
            VIEW v njegovo varianto; ob dejanskem oddaji termina še CONVERSION.
            Konverzija = oddani / prikazi × 100. Za prav A/B naj org spremeni
            <code className="mx-1 rounded bg-muted px-1">BOOKING_AB_VARIANT</code>
            v <span className="font-medium">short</span> (ali pusti prazno —
            takrat se varianta razdeli 50/50 po org). Vrednost je runtime, ne
            ob build.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}