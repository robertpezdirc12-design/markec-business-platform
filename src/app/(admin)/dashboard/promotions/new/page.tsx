import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { PromotionForm } from "@/components/dashboard/promotion-form"
import { getPromotionTargetOptions } from "@/app/actions/promotions"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

export default async function NewPromotionPage() {
  await requirePagePermission("promotions.manage")
  const [{ t }, options] = await Promise.all([
    getServerI18n(),
    getPromotionTargetOptions(),
  ])

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
            {t.promotions.formTitleNew}
          </h1>
          <p className="text-muted-foreground">{t.promotions.subtitle}</p>
        </div>
      </div>
      <PromotionForm mode="create" options={options} />
    </div>
  )
}