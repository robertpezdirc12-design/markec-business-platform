import { requirePagePermission } from "@/lib/auth/guards"
import { QuotesDashboard } from "@/components/dashboard/quotes-dashboard"

// FAZA 2 — PONUDBE (F2 §2): seznam ponudb + potrdi/zavrni/zamenjaj.
export default async function QuotesPage() {
  await requirePagePermission("finances.view")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ponudbe</h1>
        <p className="text-muted-foreground">
          Veriga ponudba → račun. Ustvarite ponudbo iz delovnega naloga, pošljite stranki ter po
          potrditvi pretvorite v račun.
        </p>
      </div>
      <QuotesDashboard />
    </div>
  )
}