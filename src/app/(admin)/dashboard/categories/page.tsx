import { getManagedCategories } from "@/app/actions/categories"
import { getServerI18n } from "@/lib/i18n/server"
import { requireAnyPermissionOrg } from "@/lib/auth/guards"
import { CategoryManager } from "@/components/dashboard/category-manager"

export const metadata = { title: "Kategorije" }

export default async function CategoriesPage() {
  // Kategorije so skupne izdelkom in storitvam — zadostuje en ključ.
  // (Page guard: redirect na dashboard pri pomanjkanju pravice.)
  await requireAnyPermissionOrg(["products.manage", "services.manage"])

  const res = await getManagedCategories()
  const list = res.success && res.data ? res.data.categories : []

  const t = (await getServerI18n()).t

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.categories.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.categories.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">{t.categories.subtitle}</p>
        </div>
      </div>

      <CategoryManager initial={list} />
    </div>
  )
}