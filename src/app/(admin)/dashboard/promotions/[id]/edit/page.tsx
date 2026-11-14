import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { PromotionForm } from "@/components/dashboard/promotion-form"
import { getPromotionById, getPromotionTargetOptions } from "@/app/actions/promotions"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

interface EditPromotionPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPromotionPage({ params }: EditPromotionPageProps) {
  await requirePagePermission("promotions.manage")
  const { id } = await params
  const [{ t }, promotion, options] = await Promise.all([
    getServerI18n(),
    getPromotionById(id),
    getPromotionTargetOptions(),
  ])
  if (!promotion) notFound()

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
            {t.promotions.formTitleEdit}
          </h1>
          <p className="text-muted-foreground">{promotion.name}</p>
        </div>
      </div>
      <PromotionForm mode="edit" promotion={promotion} options={options} />
    </div>
  )
}