import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePagePermission } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"
import { FillBatchDialog, type FillHarvest, type FillBatch, type FillProduct } from "@/components/dashboard/fill-batch-dialog"
import { getHarvestProduction } from "@/app/actions/traceability"

// ============================================================
// SLEDLJIVOST PRIDELKA MEDU (2D-1P) — pridelek → serija → izdelek
// → zaloga → prodaja → izvor. Org-scoped; uporablja obstoječo shemo.
// ============================================================

export default async function TraceabilityPage() {
  await requirePagePermission("products.manage")
  const org = await getSessionOrg()

  const [production] = await Promise.all([getHarvestProduction()])

  // Opcije za polnjenje: pridelki, serije, izdelki (+ različice) — org-scoped.
  let harvests: FillHarvest[] = []
  let batches: FillBatch[] = []
  let products: FillProduct[] = []
  if (org) {
    const [harvRecs, batchRecs, prodRecs] = await Promise.all([
      prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "harvest" },
        select: { id: true, title: true, data: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "batch" },
        select: { id: true, title: true, data: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.product.findMany({
        where: { organizationId: org.id, isActive: true, forSale: true },
        select: {
          id: true,
          name: true,
          variants: { select: { id: true, name: true }, where: { isActive: true } },
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ])

    harvests = harvRecs.map((r) => {
      const d = (r.data as Record<string, unknown>) || {}
      const line = production.find((p) => p.harvest.id === r.id)
      return {
        id: r.id,
        title: r.title,
        honeyType: String(d.honey_type ?? ""),
        quantityKg: Number(d.quantity_kg ?? 0),
        remainingKg: line?.harvest.remainingKg ?? Number(d.quantity_kg ?? 0),
      }
    })

    batches = batchRecs.map((r) => ({
      id: r.id,
      code: String((r.data as Record<string, unknown>)?.batch_code ?? r.title),
      title: r.title,
    }))

    products = prodRecs.map((p) => ({
      productId: p.id,
      productName: p.name,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name })),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sledljivost pridelka</h1>
        <p className="text-muted-foreground">
          Pridelek medu → proizvodna serija → izdelek → zaloga → prodaja → izvor.
        </p>
      </div>

      <FillBatchDialog harvests={harvests} batches={batches} products={products} />

      {/* Pridelki in proizvodne serije */}
      <Card>
        <CardHeader>
          <CardTitle>Pridelki in proizvodne serije</CardTitle>
        </CardHeader>
        <CardContent>
          {production.length === 0 ? (
            <p className="text-muted-foreground">
              Ni še zabeleženih pridelkov. Najprej vnesite pridelek prek Evidence.
            </p>
          ) : (
            <div className="space-y-4">
              {production.map((line) => (
                <div key={line.harvest.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{line.harvest.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {line.harvest.honeyType || "—"} · pridelano {line.harvest.quantityKg.toFixed(2)} kg
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      ostanek {line.harvest.remainingKg.toFixed(2)} kg
                    </span>
                  </div>
                  {line.batches.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {line.batches.map((b) => (
                        <li key={b.id} className="flex items-center justify-between text-muted-foreground">
                          <span>
                            <span className="font-mono text-xs">{b.code}</span> — {b.title}
                          </span>
                          <span>
                            {b.filledUnits} enot · {b.packedKg.toFixed(2)} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Še ni povezane proizvodne serije.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}