import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Script from "next/script"
import { prisma } from "@/lib/prisma"
import { PublicNavbar } from "@/components/layouts/public-navbar"
import Footer from "@/components/layouts/footer"
import { getPublicOrg, getTrustedOrgSlug } from "@/lib/tenant"
import { resolvePublicEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { resolveAvailableSections } from "@/lib/public-site"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { CartOrgScope } from "@/components/shop/cart-org-scope"
import { analyticsScriptIdFor } from "@/lib/analytics/measurement-id"
import { PublicI18nProvider } from "@/components/providers/public-i18n-provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { hostFromHostHeader, isPlatformHost } from "@/lib/domains/normalize"
import { getPlatformHosts } from "@/lib/domains/provider"
import { hasUnpublishedChanges } from "@/lib/publication"
import { mergeSiteContent } from "@/lib/site-content"
import { upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { OwnerBar } from "@/components/public/owner-bar"
import { PromoBanner } from "@/components/public/promo-banner"
import { getPublicActivePromotions } from "@/lib/promotions/public"

/**
 * P2 #46/#46: section flags so the navbar never links an anchor that
 * does not exist (data gate) or a module the profile disables
 * (capability gate). Shared with the (customer) layout — navigation
 * must be identical on every public route.
 */
async function availableSectionsFor(org: {
  id: string
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
}) {
  return resolveAvailableSections(org.id, org)
}

/**
 * P1 #66: does THIS request serve a tenant site? True under /s/[slug]
 * (ORG_HEADER set by the proxy) or on a custom domain. The bare platform
 * root is the PRODUCT landing — no tenant chrome, no tenant data.
 */
async function isTenantContext(): Promise<boolean> {
  const h = await headers()
  // V-1 (issue #102): only the proxy-SIGNED header counts — a forged one
  // must not turn the platform root into a tenant surface.
  if (await getTrustedOrgSlug()) return true
  const requestHost = hostFromHostHeader(h.get("host"))
  return !!requestHost && !isPlatformHost(requestHost, getPlatformHosts())
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // P1 #66: the PLATFORM ROOT (bare "/" on a platform host) renders the
  // product landing — no tenant resolution, no tenant navbar/footer, no
  // tenant data. A provider must be able to FIND the platform.
  if (!(await isTenantContext())) {
    const platformSkipLabel =
      (await getLocaleFromCookies()) === "en" ? "Skip to content" : "Preskoči na vsebino"
    return (
      <PublicI18nProvider org={null}>
        <a
          href="#main"
          className="bg-background text-foreground sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
        >
          {platformSkipLabel}
        </a>
        <main id="main" tabIndex={-1}>{children}</main>
      </PublicI18nProvider>
    )
  }

  const org = await getPublicOrg()

  // P1 #27 (re-audit 2026-11): UNKNOWN slug ali SUSPENDED tenant pod
  // /s/[slug] prej vrnila HTTP 200 ("Stran ni objavljena") — soft 404,
  // ki ga iskalniki indeksirajo. Zdaj notFound() → pravi HTTP 404 z
  // blagovno stranjo (app/not-found.tsx). Klic je v LAYOUTU (shell
  // faza), tako da se 404 status pošlje, PREDEN streaming začne.
  // Layout niha ne dostopa do podatkov drugega najemnika (E3-8 ostaja).
  const slugHeader = await getTrustedOrgSlug()
  if (slugHeader && !org) {
    notFound()
  }

  // F5.3.2 — lastnik-u-urejljiv glavni meni + capability imena (za nav gate).
  // Pomagačne funkcije so hoisted v komponenti, torej na voljo PRI VSEH
  // predoglednih in javnih vejah (preview + unpublished + published).
  async function navFor() {
    if (!org) return undefined
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { siteContent: true },
    })
    const content = upgradeLegacyDefaultCopy(
      mergeSiteContent(config?.siteContent, org.vertical),
      org.slug
    )
    return content.nav
  }
  function capabilitiesFor() {
    if (!org) return undefined
    const prof = resolvePublicEffectiveProfile(org)
    return Object.entries(prof.capabilities)
      .filter(([, state]) => state !== "disabled")
      .map(([name]) => name)
  }

  // Publication gate (EPIC #3 E3-1): non-published tenants are private.
  // The owner/staff of THIS tenant still sees the full site as a preview,
  // with a clear banner; everyone else gets a neutral maintenance screen
  // (no tenant data is leaked — not even the business name).
  const gate = await resolvePublishGate(org)
  if (org && gate !== "published") {
    if (gate === "hidden") {
      return <MaintenanceScreen />
    }
    const previewSections = await availableSectionsFor(org)
    // E4-2b: owner preview of an UNPUBLISHED site — intentionally NO
    // analytics script (visits here are not public traffic and the
    // owner's measurement ID is scoped to the published site only).
    return (
      <PublicI18nProvider org={org}>
        <PublicNavbar
          org={{
            slug: org.slug,
            name: org.name,
            logo: org.logo,
          }}
          cta={null}
          availableSections={previewSections}
          nav={await navFor()}
          capabilitiesEnabled={capabilitiesFor()}
          shopEnabled={previewSections.shopAvailable ?? previewSections.shop}
        />
        <CartOrgScope slug={org.slug} />
        <div className="bg-amber-100 text-amber-950 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Predogled — ta stran še ni objavljena. Obiščevalci vidijo vzdrževalno
          stran, dokler je ne objavite v nastavitvah.
        </div>
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </PublicI18nProvider>
    )
  }

  // E4-2b — owner-supplied analytics (GA4). The script is injected ONLY
  // when a PUBLISHED tenant site is being served AND the owner saved a
  // valid measurement ID. Null for the platform-root default tenant
  // without a site, hidden states and invalid/absent IDs — the platform
  // itself never tracks anyone (analyticsScriptIdFor is the single
  // testable decision point for this rule).
  let analyticsId: string | null = null
  if (org && gate === "published") {
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { analyticsMeasurementId: true },
    })
    analyticsId = analyticsScriptIdFor({
      gate,
      measurementId: config?.analyticsMeasurementId,
    })
  }

  const cta = resolvePublicCta(org, await getLocaleFromCookies())

  // #98 (AD-02): povezava Živa vrsta — samo ko najemnikov profil modul
  // vklopi (capability + overrides); izklop = povezava ne obstaja (§5.2).
  const walkInEnabled = org
    ? isCapabilityEnabled(resolvePublicEffectiveProfile(org), "walkIn")
    : false

  // Košarica se ravna po resnični sekciji trgovine (objavljeni izdelki +
  // capability), ne po sami capability — šiviljstvo ima trgovino
  // »optional«, a brez izdelkov, zato košarica nima smisla.
  const publishedSections = org ? await availableSectionsFor(org) : undefined

  // F5.3.2 — lastnik-u-urejljiv glavni meni + capability imena (za nav gate).
  // Navigacija se upodobi SAMO za objavljene/nepreview kontekste; preview in
  // unpublished uporabljata isto pomoč (draft nav), da je urejevalnik WYSIWYG.
  // (funkciji navFor/capabilitiesFor sta definirani višje, pred gate-om)

  // P2 #67: owner affordance on THEIR OWN public site — resolved
  // server-side, rendered only for the owner of this organisation
  // (never embedded for customers/anonymous — conditional render only).
  const { auth } = await import("@/lib/auth/auth")
  const session = await auth()
  const isOwner =
    !!org &&
    !!session?.user?.organizationId &&
    session.user.organizationId === org.id
  let ownerBar: React.ReactNode = null
  if (isOwner && org) {
    const [pub, contentVersion] = await Promise.all([
      prisma.salonConfig.findUnique({
        where: { organizationId: org.id },
        select: { publishedContentVersion: true },
      }),
      prisma.organization.findUnique({
        where: { id: org.id },
        select: { contentVersion: true, publishedAt: true },
      }),
    ])
    ownerBar = (
      <OwnerBar
        slug={org.slug}
        hasUnpublished={hasUnpublishedChanges(
          contentVersion?.contentVersion ?? null,
          pub?.publishedContentVersion ?? null
        )}
        publishedAt={contentVersion?.publishedAt ?? null}
      />
    )
  }

  const skipLabel = (await getLocaleFromCookies()) === "en" ? "Skip to content" : "Preskoči na vsebino"

  // F5.1: javna reklamna pasica — prikaže se SAMO za objavljenega najemnika
  // (ne za draft/preview, ne za platformo brez org), ob kakršni aktivni
  // promociji. Pasica je za obiskovalce, ne le za lastnika — zato je odvisna
  // od javnega readerja, ne od seje.
  let promoBanner: React.ReactNode = null
  if (org && gate === "published") {
    const actives = await getPublicActivePromotions(org.id).catch(() => [])
    if (actives.length > 0) promoBanner = <PromoBanner promos={actives} />
  }

  return (
    <>
      {/* P2 #12 (audit-2026-11): skip link — first focusable element
          (WCAG 2.4.1 Bypass Blocks), target is <main id="main"> below. */}
      <a
        href="#main"
        className="bg-background text-foreground sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
      >
        {skipLabel}
      </a>
      {analyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}');`}
          </Script>
        </>
      )}
      <PublicI18nProvider org={org}>
        {promoBanner}
        {ownerBar}
        <PublicNavbar
          org={{
            slug: org?.slug ?? null,
            name: org?.name ?? "Podjetje",
            logo: org?.logo ?? null,
          }}
          cta={cta.enabled ? { label: cta.label, href: cta.href } : null}
          availableSections={publishedSections}
          walkInEnabled={walkInEnabled}
          nav={await navFor()}
          capabilitiesEnabled={capabilitiesFor()}
          shopEnabled={publishedSections?.shopAvailable ?? publishedSections?.shop ?? false}
        />
        <CartOrgScope slug={org?.slug ?? null} />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </PublicI18nProvider>
    </>
  )
}
