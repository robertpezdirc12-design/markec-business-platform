import type { Metadata } from "next"
import { requirePagePermission } from "@/lib/auth/guards"

// P1 #107: naslov zavihka (prej samo ime salona).
export const metadata: Metadata = {
  title: "Stranke",
  description: "CRM — kartoteka strank, zgodovina obiskov in segmenti.",
}
import { listCustomers } from "@/app/actions/customers"
import { CustomersManager } from "@/components/dashboard/customers/customers-manager"
import { CustomerSegments } from "@/components/dashboard/customer-segments"
import { ClientImport } from "@/components/dashboard/client-import"
import { BulkActions } from "@/components/dashboard/bulk-actions"
import { EmailTemplatesEditor } from "@/components/dashboard/email-templates-editor"
import { getServerI18n } from "@/lib/i18n/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersIcon, TagIcon, UploadIcon, EnvelopeIcon } from "@/components/icons"

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
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">
            <UsersIcon size={16} className="mr-2" />
            Seznam
          </TabsTrigger>
          <TabsTrigger value="segments">
            <TagIcon size={16} className="mr-2" />
            Segmenti
          </TabsTrigger>
          <TabsTrigger value="import">
            <UploadIcon size={16} className="mr-2" />
            Uvoz
          </TabsTrigger>
          <TabsTrigger value="templates">
            <EnvelopeIcon size={16} className="mr-2" />
            E-pošta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <CustomersManager
            initial={customers}
            tags={tags}
            archived={params.archived === "1"}
            search={params.search ?? ""}
            title={t.users.title}
            titleAccent={t.users.titleAccent}
            subtitle={t.users.subtitle}
          />
        </TabsContent>

        <TabsContent value="segments">
          <CustomerSegments
            segments={[
              {
                id: "vip",
                name: "VIP stranke",
                description: "Najbolj zveste in donosne stranke",
                icon: <TagIcon size={20} />,
                color: "bg-amber-500",
                count: customers.filter((c) => c.tags.includes("VIP")).length,
                criteria: "Več kot 10 obiskov ali več kot 500 € porabe",
                totalValue: 0,
              },
              {
                id: "regular",
                name: "Redne stranke",
                description: "Redno obiskujejo in porabljajo",
                icon: <UsersIcon size={20} />,
                color: "bg-green-500",
                count: customers.filter((c) => c.tags.includes("Redna stranka")).length,
                criteria: "3-10 obiskov v zadnjih 6 mesecih",
                totalValue: 0,
              },
              {
                id: "new",
                name: "Nove stranke",
                description: "Prvi obisk v zadnjem mesecu",
                icon: <UsersIcon size={20} />,
                color: "bg-blue-500",
                count: 0,
                criteria: "Prvi obisk v zadnjih 30 dneh",
                totalValue: 0,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="import">
          <ClientImport />
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplatesEditor />
        </TabsContent>
      </Tabs>
    </div>
  )
}