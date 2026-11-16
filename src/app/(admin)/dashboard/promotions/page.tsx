import Link from "next/link"
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusIcon, TagIcon } from "@/components/icons"
import {
  getAdminPromotions,
  type PromotionListItem,
} from "@/app/actions/promotions"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"
import { PromotionActions } from "@/components/dashboard/promotion-actions"
import { PromotionRedemptionsDialog } from "@/components/dashboard/promotion-redemptions-dialog"
import { DealsManager } from "@/components/dashboard/deals-manager"
import { SmartPricing } from "@/components/dashboard/smart-pricing"

function LifecycleBadge({ lifecycle }: { lifecycle: PromotionListItem["lifecycle"] }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
  const map: Record<PromotionListItem["lifecycle"], string> = {
    active: "bg-green-100 text-green-700",
    scheduled: "bg-blue-100 text-blue-700",
    expired: "bg-amber-100 text-amber-700",
    draft: "bg-muted text-muted-foreground",
    inactive: "bg-zinc-100 text-zinc-500",
  }
  const labelMap: Record<PromotionListItem["lifecycle"], string> = {
    active: "lifecycleActive",
    scheduled: "lifecycleScheduled",
    expired: "lifecycleExpired",
    draft: "lifecycleDraft",
    inactive: "lifecycleInactive",
  }
  return <span className={`${base} ${map[lifecycle]}`}>{labelMap[lifecycle]}</span>
}

export default async function PromotionsPage() {
  await requirePagePermission("promotions.manage")
  const [{ t }, promotions] = await Promise.all([
    getServerI18n(),
    getAdminPromotions(),
  ])

  const now = new Date()
  const activeNow = promotions.filter(
    (p) =>
      p.lifecycle === "active" ||
      (p.status === "ACTIVE" && p.endsAt && p.endsAt > now)
  ).length
  const totalRedemptions = promotions.reduce((s, p) => s + p.usedCount, 0)
  const totalDiscount = promotions.reduce((s, p) => s + p.appliedDiscountTotal, 0)

  const scopeLabel = (p: PromotionListItem): string => {
    const base =
      p.scope === "WHOLE_AMOUNT"
        ? t.promotions.scopeWhole
        : p.scope === "PRODUCTS"
          ? t.promotions.scopeProducts
          : p.scope === "SERVICES"
            ? t.promotions.scopeServices
            : t.promotions.scopeCategories
    if (p.targetEntityIds.length === 0 && p.scope !== "WHOLE_AMOUNT") {
      return p.scope === "PRODUCTS" ? t.promotions.allProducts : t.promotions.allServices
    }
    return base
  }

  const discountLabel = (p: PromotionListItem): string =>
    p.discountType === "PERCENT"
      ? `-${p.discountValue}%`
      : `-${formatCurrency(p.discountValue)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.promotions.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.promotions.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">{t.promotions.subtitle}</p>
        </div>
        <Link href="/dashboard/promotions/new">
          <Button>
            <PlusIcon size={16} className="mr-2" />
            {t.promotions.addPromotion}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.promotions.totalPromotions}</CardDescription>
            <CardTitle className="text-3xl">{promotions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.promotions.activePromotions}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeNow}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.promotions.totalRedemptions}</CardDescription>
            <CardTitle className="text-3xl">{totalRedemptions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.promotions.totalDiscountGiven}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(totalDiscount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t.promotions.colPromotion}</CardTitle>
            <CardDescription>{t.promotions.subtitle}</CardDescription>
          </div>
        </CardHeader>
        <div className="divide-y">
          {promotions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <TagIcon size={40} className="text-muted-foreground" />
              <div>
                <p className="font-medium">{t.promotions.noPromotions}</p>
                <p className="text-muted-foreground text-sm">
                  {t.promotions.noPromotionsDesc}
                </p>
              </div>
              <Link href="/dashboard/promotions/new">
                <Button>{t.promotions.createFirst}</Button>
              </Link>
            </div>
          ) : (
            promotions.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/promotions/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <LifecycleBadge lifecycle={p.lifecycle} />
                    {p.code && (
                      <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs">
                        {p.code}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {discountLabel(p)} · {scopeLabel(p)}
                    {p.endsAt &&
                      ` · ${formatDateStandard(p.endsAt, "sl")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right text-sm">
                    <span className="text-muted-foreground">
                      {t.promotions.colUses}:
                    </span>{" "}
                    {p.maxRedemptions != null
                      ? `${p.usedCount} / ${p.maxRedemptions}`
                      : p.usedCount}
                  </div>
                  <PromotionRedemptionsDialog promotionId={p.id} label={t.promotions.viewRedemptions} />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/promotions/${p.id}/edit`}>
                      {t.promotions.edit}
                    </Link>
                  </Button>
                  <PromotionActions id={p.id} status={p.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Deals Manager */}
      <DealsManager />

      {/* Smart Pricing */}
      <SmartPricing />
    </div>
  )
}

// options for target pickers live on the create/edit form pages