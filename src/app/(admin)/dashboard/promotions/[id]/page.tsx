import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeftIcon } from "@/components/icons"
import { getPromotionById } from "@/app/actions/promotions"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"
import { PromotionActions } from "@/components/dashboard/promotion-actions"
import { PromotionRedemptionsDialog } from "@/components/dashboard/promotion-redemptions-dialog"
import { PromotionShareCard } from "@/components/dashboard/promotion-share-card"
import { getSessionOrg } from "@/lib/tenant"

interface PromotionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PromotionDetailPage({ params }: PromotionDetailPageProps) {
  await requirePagePermission("promotions.manage")
  const { id } = await params
  const [{ t }, promotion, org] = await Promise.all([
    getServerI18n(),
    getPromotionById(id),
    getSessionOrg(),
  ])
  if (!promotion) notFound()

  const discountLabel =
    promotion.discountType === "PERCENT"
      ? `-${promotion.discountValue}%`
      : `-${formatCurrency(promotion.discountValue)}`

  const scopeLabel =
    promotion.scope === "WHOLE_AMOUNT"
      ? t.promotions.scopeWhole
      : promotion.scope === "PRODUCTS"
        ? t.promotions.scopeProducts
        : promotion.scope === "SERVICES"
          ? t.promotions.scopeServices
          : t.promotions.scopeCategories

  const startsLabel = promotion.startsAt
    ? formatDateStandard(promotion.startsAt, "sl")
    : "takoj"
  const endsLabel = promotion.endsAt
    ? formatDateStandard(promotion.endsAt, "sl")
    : "brez roka"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/promotions">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {promotion.name}
          </h1>
          <p className="text-muted-foreground">
            {discountLabel} · {scopeLabel}
          </p>
        </div>
        <div className="ml-auto">
          <PromotionActions id={promotion.id} status={promotion.status} />
        </div>
      </div>

      {/* Shareable link + QR (Shopify vzorec) — deli promo kodo tako, da se
          samodejno vnese v košarico. */}
      {promotion.code && (
        <PromotionShareCard
          orgSlug={org?.slug ?? null}
          code={promotion.code}
          name={promotion.name}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.promotions.title}</CardTitle>
            <CardDescription>{t.promotions.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label={t.promotions.name} value={promotion.name} />
            <Row label={t.promotions.description} value={promotion.description ?? "—"} />
            <Row label={t.promotions.discountType} value={discountLabel} />
            <Row label={t.promotions.scope} value={scopeLabel} />
            <Row label={t.promotions.codeLabel} value={promotion.code ?? t.promotions.noCode} />
            <Row label={t.promotions.startsAt} value={startsLabel} />
            <Row label={t.promotions.endsAt} value={endsLabel} />
            <Row
              label={t.promotions.maxRedemptions}
              value={
                promotion.maxRedemptions != null
                  ? `${promotion.usedCount} / ${promotion.maxRedemptions}`
                  : t.promotions.unlimited
              }
            />
            <Row
              label={t.promotions.maxPerCustomer}
              value={
                promotion.maxPerCustomer != null
                  ? String(promotion.maxPerCustomer)
                  : t.promotions.unlimited
              }
            />
            <Row
              label={t.promotions.minOrderValue}
              value={
                promotion.minOrderValue != null && promotion.minOrderValue > 0
                  ? formatCurrency(promotion.minOrderValue)
                  : "—"
              }
            />
            <Row
              label={t.promotions.totalDiscountGiven}
              value={`-${formatCurrency(promotion.appliedDiscountTotal)}`}
            />
            <Row
              label={t.promotions.colUses}
              value={String(promotion.usedCount)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.promotions.viewRedemptions}</CardTitle>
            <CardDescription>
              {promotion.usedCount}{" "}
              {promotion.usedCount === 1 ? "uporaba" : "uporab"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PromotionRedemptionsDialog
              promotionId={promotion.id}
              label={t.promotions.viewRedemptions}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}