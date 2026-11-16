import { EnvelopeIcon } from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getMarketingOverview } from "@/app/actions/marketing"
import { MarketingClient } from "@/components/dashboard/marketing-client"
import { EmailBlast } from "@/components/dashboard/email-blast"
import { AutomationRules } from "@/components/dashboard/automation-rules"
import { GiftCards } from "@/components/dashboard/gift-cards"
import { LoyaltyProgram } from "@/components/dashboard/loyalty-program"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gift, Star } from "@phosphor-icons/react/dist/ssr"

// ============================================================
// #95 — MARKETING AVTOMATIKA (admin)
// Dve avtomatski e-poštni kampanji (reaktivacija, no-show follow-up)
// na segmentih strank. Pošteno: dnevnik poslanih, dedup, odjava z
// odgovorom; kampanja kontaktira samo obstoječe stranke.
// ============================================================

export default async function MarketingPage() {
  await requirePagePermission("customers.manage")
  const [, overview] = await Promise.all([getServerI18n(), getMarketingOverview()])

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <EnvelopeIcon size={24} className="mr-2 inline text-primary-text" />
            Marketing
          </h1>
          <p className="text-muted-foreground">
            Avtomatska e-pošta vašim strankam — reaktivacija in sledenje po ne-prihodu.
            Vsako sporočilo nosi povezavo za odjavo (funkcionalna, AD-03).
          </p>
        </div>
        <p className="text-muted-foreground text-sm shrink-0">
          Odjavljenih naslovov:{" "}
          <span className="text-foreground font-medium">{overview.unsubscribedCount}</span>
        </p>
        <div className="flex items-center gap-3">
          <EmailBlast
            availableTags={overview.availableTags}
            customerCounts={overview.customerCounts}
            totalCustomers={overview.totalCustomers}
            marketingConsentCount={overview.marketingConsentCount}
          />
        </div>
      </div>

      <MarketingClient
        campaigns={overview.campaigns}
        bookingLink={overview.bookingLink}
      />

      {/* Automation Rules */}
      <AutomationRules />

      {/* Gift Cards & Loyalty */}
      <Tabs defaultValue="gift-cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gift-cards">
            <Gift size={16} className="mr-2" />
            Darilni boni
          </TabsTrigger>
          <TabsTrigger value="loyalty">
            <Star size={16} className="mr-2" />
            Program zvestobe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gift-cards">
          <GiftCards />
        </TabsContent>

        <TabsContent value="loyalty">
          <LoyaltyProgram />
        </TabsContent>
      </Tabs>
    </div>
  )
}
