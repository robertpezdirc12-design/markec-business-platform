import { getSalonSettings } from "@/app/actions/settings"
import { getPublicationStatus } from "@/app/actions/publication"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { AnalyticsIntegrationCard } from "@/components/dashboard/analytics-integration-card"
import { PushCard } from "@/components/dashboard/push-card"
import { BrandingTabs } from "@/components/dashboard/branding-tabs"
import { PaymentsSettings } from "@/components/dashboard/payments-settings"
import { MinimaxCard } from "@/components/dashboard/minimax-card"
import { SmsCard } from "@/components/dashboard/sms-card"
import { WebhooksCard } from "@/components/dashboard/webhooks-card"
import { ProfileOverview } from "@/components/dashboard/profile-overview"
import { ModulesOverview } from "@/components/dashboard/modules-overview"
import { ModulesConfigurator } from "@/components/dashboard/modules-configurator"
import { ActivitiesCard } from "@/components/dashboard/activities-card"
import { ConfigHistoryCard } from "@/components/dashboard/config-history-card"
import { CustomProfileBuilder } from "@/components/dashboard/custom-profile-builder"
import { PublicationCard } from "@/components/dashboard/publication-card"
import { DomainsCard } from "@/components/dashboard/domains-card"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { GoogleCalendarSync } from "@/components/dashboard/google-calendar-sync"
import { DISCONNECTED_STATUS, getConnection, toStatus } from "@/lib/calendar/connection"
import { ContentManager } from "@/components/dashboard/content/content-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { getSessionPlanContext } from "@/lib/plans/resolve"
import { loadBillingOverview } from "@/lib/payments/billing-overview"
import { getDomainsStatus } from "@/app/actions/domains"
import { requirePagePermission } from "@/lib/auth/guards"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; tab?: string; calendar?: string }>
}) {
  // Custom roles (G8): server-side page guard
  await requirePagePermission("settings.manage")
  const [{ t }, params, settings, publication, org, _planContext, domains] = await Promise.all([
    getServerI18n(),
    searchParams,
    getSalonSettings(),
    getPublicationStatus(),
    getSessionOrg(),
    getSessionPlanContext(),
    getDomainsStatus(),
  ])

  // Billing read model depends on the resolved tenant — one extra
  // sequential read after the parallel block above.
  const _billing = org ? await loadBillingOverview(org.id) : null

  // GOOGLE KOLEDAR: stanje povezave bere STRAN (ne odjemalec), zato
  // kartica ob nalaganju ne more lagati. Brez organizacije ostane
  // privzeto "nepovezano".
  const calendarStatus = org
    ? toStatus(await getConnection(org.id))
    : DISCONNECTED_STATUS

  // #54: booking rules are dead UI for profiles without appointments —
  // the same capability gate the public site applies to /booking.
  const appointmentsEnabled = await getSessionEffectiveProfile().then((p) =>
    isCapabilityEnabled(p, "appointments")
  )

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.title}</CardTitle>
          <CardDescription>{t.settings.loadError}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  // P2 #43: globinska povezava iz vodenega vstopa — odpre zavihek
  // "Spletna stran" neposredno (/dashboard/settings?tab=website).
  return (
    <SettingsTabs defaultTab={params.tab}
      company={
        <div className="space-y-6">
          <PublicationCard
            initial={publication}
            siteHref={org ? `/s/${org.slug}` : null}
          />
          <ProfileOverview />
          <SettingsForm
            initialSettings={settings}
            appointmentsEnabled={appointmentsEnabled}
          />
          {/* #99: push obvestila lastniku (nov termin, odpoved) */}
          <PushCard />
          {/* Izvoz terminov v lastnikov Google Koledar (dvostransko soglasje). */}
          <GoogleCalendarSync status={calendarStatus} notice={params.calendar ?? null} />
        </div>
      }
      website={
        <div className="space-y-6">
          <BrandingTabs />
          <ContentManager />
          {org && <CustomProfileBuilder orgId={org.id} />}
        </div>
      }
      features={
        <div className="space-y-6">
          {/* F5.4.1: enoten »Moji moduli« zaslon — združuje module (ModulesV2Card)
              in prejšnje module ModulesConfigurator v en pregled. ModulesOverview
              ureja module; ModulesConfigurator nastal SAMO za dashboard widgete. */}
          <ModulesOverview />
          <ModulesConfigurator />
          <ActivitiesCard />
          <PaymentsSettings />
          <MinimaxCard />
          <SmsCard />
          <WebhooksCard />
          <ConfigHistoryCard />
        </div>
      }
      advanced={
        <div className="space-y-6">
          <DomainsCard
            initial={domains}
            sitePath={org ? `/s/${org.slug}` : null}
          />
          {/* E4-2b: owner-supplied analytics (GA4) — optional, honest default = no script. */}
          <AnalyticsIntegrationCard initialValue={settings.analyticsMeasurementId ?? null} />
        </div>
      }
    />
  )
}
