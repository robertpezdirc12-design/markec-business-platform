import { requirePagePermission } from "@/lib/auth/guards"
import { listCustomers } from "@/app/actions/customers"
import { CustomersManager } from "@/components/dashboard/customers/customers-manager"
import { getServerI18n } from "@/lib/i18n/server"

interface PageProps {
  searchParams: Promise<{ search?: string; archived?: string; tag?: string }>
}

export default async function CustomersPage({ searchParams }: PageProps) {
  await requirePagePermission("customers.manage")
  const params = await searchParams
  const [{ t }] = await Promise.all([getServerI18n()])

  const customers = await listCustomers({
    search: params.search,
    tag: params.tag,
    archived: params.archived === "1",
  })
  const tags = Array.from(
    new Set(customers.flatMap((c) => c.tags))
  ).sort((a, b) => a.localeCompare(b, "sl"))

  return (
    <div className="space-y-6">
      <CustomersManager
        initial={customers}
        tags={tags}
        archived={params.archived === "1"}
        search={params.search ?? ""}
        title={t.users.title}
        titleAccent={t.users.titleAccent}
        subtitle={t.users.subtitle}
      />
    </div>
  )
}