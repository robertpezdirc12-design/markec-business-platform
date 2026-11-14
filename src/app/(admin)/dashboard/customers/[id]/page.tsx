import { notFound } from "next/navigation"
import { requirePagePermission } from "@/lib/auth/guards"
import { getCustomerDetail } from "@/app/actions/customers"
import { CustomerDetailView } from "@/components/dashboard/customers/customer-detail"
import { getServerI18n } from "@/lib/i18n/server"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: PageProps) {
  await requirePagePermission("customers.manage")
  const [{ t }] = await Promise.all([getServerI18n()])
  const { id } = await params
  const customer = await getCustomerDetail(id)
  if (!customer) notFound()

  return <CustomerDetailView customer={customer} usersTitle={t.users.title} />
}