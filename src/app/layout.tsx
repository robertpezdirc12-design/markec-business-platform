import type { Metadata, Viewport } from "next"
import { Great_Vibes, Poppins, Playfair_Display, Cormorant_Garamond, Oswald, Montserrat, Inter, Lora } from "next/font/google"
import { SessionProvider } from "@/components/providers/session-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { CartProvider } from "@/components/providers/cart-provider"
import { TooltipProvider } from "@/components/providers/tooltip-provider"

import { Toaster } from "sonner"
import "./globals.css"
import { auth } from "@/lib/auth/auth"
import { getOrgBySlug, getOrgById, getTrustedOrgSlug } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { paletteCssVars, paletteDarkTextVars, PALETTES, FONT_CSS_VARS, type Palette, upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { themeToCssVars, sanitizeTypography, type SiteTheme } from "@/lib/site-design"
import { mergeSiteContent } from "@/lib/site-content"
import { CurrencyProvider } from "@/lib/currency"
import { platformThemeCss } from "@/lib/platform-theme"
import { resolvePublishGate } from "@/lib/publish-gate"
import {
  buildTenantMetadata,
  buildTenantJsonLd,
  aggregateRatingForTenant,
  resolveAppUrl,
  type SeoContext,
} from "@/lib/seo"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getDictionary } from "@/lib/i18n/dictionaries"
import {
  PLATFORM_LOCALE_HEADER,
  resolveHtmlLocale,
  resolvePlatformLandingLocale,
} from "@/lib/i18n/platform-locale"
import {
  PLATFORM_LANDING_HEADER,
  isPlatformLandingRequest,
} from "@/lib/platform-shell"
import { headers } from "next/headers"
import type { Organization } from "@prisma/client"

// P0 #1 (walkthrough): Rouge Script NIMA latin-ext subseta (šumniki š/č/ž so
// padali v fallback pisavo) → Great Vibes, ki ima polno latin-ext podporo.
// CSS spremenljivka ostane --font-rouge-script (FontKey "rouge" je v DB).
// T9 (LCP 2026-11-14): preload: false — pod Fast-3G je 10 prednaloženih
// woff2 (~136 KB, Poppins 4 teže × 2 + GV 2) utopilo render-blocking CSS
// (FCP/LCP 2,9–3,4 s). Z display:swap se besedilo nariše takoj s fallback
// pisavo, font pa pride, ko ga CSS dejansko potrebuje (brskalnik ga ohrani
// v predpomnilniku med stranežami).
const rougeScript = Great_Vibes({
  variable: "--font-rouge-script",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
  preload: false,
})

// P1 #10 (audit-2026-11): samo privzeti par (Poppins + Great Vibes) se je
// prednaložil; ostale družine so na voljo najemnikom brez <link rel=preload>.
// T9 (LCP 2026-11-14): tudi privzeti par NE PREDNALOŽI več — glej razlago
// zgoraj (LCP landinga 3,3 s → cilj < 2,5 s; teže 400–700 ostanejo, ker jih
// UI dejansko rabijo; prednaložitev je bila edina ovira, ne obseg).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
})

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"], display: "swap", preload: false })
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap", preload: false })
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin", "latin-ext"], display: "swap", preload: false })
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "latin-ext"], display: "swap", preload: false })
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap", preload: false })
const lora = Lora({ variable: "--font-lora", subsets: ["latin", "latin-ext"], display: "swap", preload: false })

/** Resolve which organization brands the current request:
 *  1. tenant from /s/[slug] (header set AND SIGNED by proxy — V-1, issue
 *     #102: an unsigned visitor-supplied header is ignored) — publish-gated:
 *     a draft tenant brands the page only for its own owner (EPIC #3 E3-1),
 *     so guest metadata/theme never leak an unpublished tenant
 *  2. signed-in user's organization (dashboard)
 *
 *  P1 #66/#68: there is NO platform-root fallback. The bare host is a
 *  PRODUCT surface (/, /login, /register, /start) — the oldest published
 *  tenant must not brand it (visible theme, head metadata or JSON-LD).
 *  Bare content paths (/shop, /services, …) are 308-redirected by the
 *  proxy to /s/<slug> and arrive here WITH the signed x-org-slug header,
 *  so no tenant loses branding; auth is platform-level by design (#53). */
async function resolveBrandOrg(): Promise<Organization | null> {
  try {
    // F1: /en is a PLATFORM marketing route. The proxy sets this header
    // only for that path (and strips any visitor-supplied value), so a
    // signed-in tenant owner must not see their own theme/JSON-LD wrapped
    // around the English landing. The session fallback below would
    // otherwise re-brand it (the session is platform-wide by design).
    if ((await headers()).get(PLATFORM_LOCALE_HEADER) === "en") return null
    const slug = await getTrustedOrgSlug()
    if (slug) {
      const org = await getOrgBySlug(slug)
      if (org) {
        const gate = await resolvePublishGate(org)
        return gate === "hidden" ? null : org
      }
    }
    const session = await auth()
    if (session?.user?.organizationId) {
      return await getOrgById(session.user.organizationId)
    }
    return null
  } catch {
    return null
  }
}

// Naslovna vrstica mobilnega brskalnika (theme-color) je del videza
// strani: platforma je kremna, zato naj bo tudi pas nad stranjo.
// Najemnikom je NE vsiljujemo — njihova paleta je lahko povsem
// drugačna in napačna barva je slabša od privzete. Zato vrednost
// dobijo le platformne strani (brez podpisane najemniške domene).
export async function generateViewport(): Promise<Viewport> {
  const org = await resolveBrandOrg()
  if (org && (await getTrustedOrgSlug())) return {}
  return {
    themeColor: [
      // Enaki vrednosti kot --background v globals.css (light/dark).
      { media: "(prefers-color-scheme: light)", color: "#FDFBFA" },
      { media: "(prefers-color-scheme: dark)", color: "#100E0F" },
    ],
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = resolveAppUrl()
  const org = await resolveBrandOrg()

  if (!org) {
    // P1 #66/#68: platforma govori sama zase. Goli gost (/, /login, /start)
    // dobi produktni naslov IN SME biti indeksiran (izložba platforme);
    // skriti osnutek pod /s/<slug> (glava prisotna) ostane brez indeksa.
    const barePlatform = !(await getTrustedOrgSlug())
    // P3 #73: izložba potrebuje socialni predogled + kanonični URL —
    // v soudeležbi (ogled linka v sporočilu) je to prva točka pridobitve.
    // Skriti osnutek NE sme dobiti platformskih og:* vrednosti (isto
    // brezPlatform pogoj ju ločuje); najemniške vrednosti spodaj zmagajo.
    if (barePlatform) {
      const productTitle = "MARKEC – MY BUSINESS PLATFORM"
      const productDescription =
        "Tvoje podjetje. Tvoja spletna stran. Tvoje stranke. Tvoja platforma. MARKEC ni izdelovalec spletnih strani — je enostaven sistem, v katerem podjetnik brez programiranja upravlja celotno svojo spletno poslovno prisotnost: spletno stran, trgovino, rezervacije in stranke."
      return {
        // SEO (audit 2026-11): metadataBase omogoča RELATIVNE canonical-e
        // na vseh platform straneh (prej so se resolvljali na VERCEL_URL).
        metadataBase: new URL(appUrl),
        title: productTitle,
        description: productDescription,
        alternates: { canonical: appUrl },
        openGraph: {
          type: "website",
          url: appUrl,
          siteName: "MARKEC",
          title: productTitle,
          description: productDescription,
          locale: "sl_SI",
          // #73 + F1: the product needs a social preview when its link
          // is shared. The /en route overrides this block with en_US.
          images: [
            {
              url: `${appUrl}/og-default.png`,
              width: 1200,
              height: 630,
              alt: "MARKEC – MY BUSINESS PLATFORM",
            },
          ],
        },
        robots: { index: true, follow: true },
      }
    }
    return {
      title: "MARKEC – MY BUSINESS PLATFORM",
      description:
        "Rezervacije, trgovina in predstavitev vašega podjetja",
      robots: { index: false, follow: false },
    }
  }

  const [config, gate] = await Promise.all([
    prisma.salonConfig.findUnique({ where: { organizationId: org.id } }),
    resolvePublishGate(org),
  ])
  const content = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug
  )

  // Kontekst: /s/[slug] prek proxyja > goli javni dostop (prva objavljena) >
  // prijavljena seja (dashboard) — zasebno.
  const tenantSlugHeader = await getTrustedOrgSlug()
  const session = await auth()
  const context: SeoContext = tenantSlugHeader
    ? "tenant"
    : session
      ? "private"
      : "bare"

  return buildTenantMetadata({
    org: { name: org.name, slug: org.slug, logo: org.logo },
    content,
    appUrl,
    context,
    indexable: context === "bare" ? true : gate === "published",
  })
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const org = await resolveBrandOrg()
  let themeCss = ""
  let orgCurrency = "EUR"
  let jsonLd: Record<string, unknown> | null = null
  if (org) {
    const paletteId = org.palette && PALETTES[org.palette] ? org.palette : "rose"
    const palette: Palette = PALETTES[paletteId]
    const vars = paletteCssVars(palette)
    // P1 #7 (audit-2026-11): temni temi lastni besedilni odtenki
    // (svetlejši kot svetli način, AA varni na temnem ozadju).
    const darkVars = paletteDarkTextVars(palette)
    themeCss = `:root{${Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")}}.dark{${Object.entries(darkVars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")}}`
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { currency: true, siteContent: true, theme: true },
    })
    // F5.3.2 — lastnik-u-urejljiva grafika (barve/pisave) v SalonConfig.theme
    // se prekriva čez paleto; kontrast je validiral `updateTheme`. Vbrizgane
    // custom props so berene v globals.css (`--f532-*` → shadcn/org tokeni).
    if (config?.theme && typeof config.theme === "object") {
      const f532 = themeToCssVars(config.theme as unknown as SiteTheme)
      const parts = Object.entries(f532).map(([k, v]) => `${k}:${v}`)
      const themeObj = config.theme as Record<string, unknown>
      // Varnost: sanitizirana tipografija (sanitizeTypography) — surove
      // vrednosti iz baze se NE vbrizgajo v <style> (XSS vektor).
      const typo = sanitizeTypography(themeObj.typography)
      // pisave: mapiraj FontKey → CSS var (komponente berejo --org-font-heading/body)
      const heading = FONT_CSS_VARS[typo.fontHeading]
      const body = FONT_CSS_VARS[typo.fontBody]
      parts.push(`--org-font-heading:${heading}`)
      parts.push(`--org-font-body:${body}`)
      // font sizing/weight
      parts.push(`--f532-heading-scale:${typo.headingScale}`)
      parts.push(`--f532-base-font-size:${typo.baseFontSize}px`)
      // :root — pritaj za paleto, da lastnikova tema PREMAGA palette (later = wins)
      themeCss += `:root{${parts.join(";")}}`
    }
    orgCurrency = config?.currency || "EUR"

    // JSON-LD samo za javne kontekste (tenant/bare) objavljenih najemnikov.
    const tenantSlugHeader = await getTrustedOrgSlug()
    const session = await auth()
    const context: SeoContext = tenantSlugHeader
      ? "tenant"
      : session
        ? "private"
        : "bare"
    if (context !== "private") {
      const gate = await resolvePublishGate(org)
      if (gate === "published") {
        const content = upgradeLegacyDefaultCopy(
          mergeSiteContent(config?.siteContent, org.vertical),
          org.slug
        )
        // P2 #75: realna povprečna ocena (samo aktivne vrstice) v JSON-LD.
        const aggregateRating = await aggregateRatingForTenant(org.id)
        jsonLd = buildTenantJsonLd({
          org: { name: org.name, slug: org.slug, logo: org.logo, vertical: org.vertical },
          content,
          appUrl: resolveAppUrl(),
          indexable: true,
          aggregateRating,
        })
      }
    }
  } else {
    // #94 — PLATFORMSKA LUPINA (brez najemniškega konteksta: landing,
    // /start, prijava): nevtralna profesionalna osnova + poglobljena
    // rose kot edini akcent. Najemniške strani to NE vidijo — ko org
    // obstaja, zgornja veja vbrizga njihovo paleto. Script pisava
    // ostane izključno najemniška (h1/h2/h3 fallback je --font-heading
    // = Poppins; org premaga prek --org-font-heading). Vrednosti živijo
    // v src/lib/platform-theme.ts (single source of truth — CI kontrast
    // test bere iste vrednosti).
    themeCss = platformThemeCss()
  }

  // F1: <html lang> follows the URL on the English landing. The value is
  // set (and stripped on the way in) by the proxy; the admin cookie still
  // decides the language everywhere else. Never trust a raw visitor header.
  // F2: on the two marketing routes the URL decides the language outright —
  // an owner with an English admin cookie must not get lang="en" on the
  // Slovenian "/" landing.
  const requestHeaders = await headers()
  const isPlatformLanding = isPlatformLandingRequest(
    requestHeaders.get(PLATFORM_LANDING_HEADER)
  )
  const urlLocaleHeader = requestHeaders.get(PLATFORM_LOCALE_HEADER)
  const landingLocale = resolvePlatformLandingLocale(urlLocaleHeader)
  const cookieLocale = await getLocaleFromCookies()
  const htmlLocale = isPlatformLanding
    ? landingLocale
    : resolveHtmlLocale(cookieLocale, urlLocaleHeader)

  // F2: structured data belongs in <head>, not in a client-gated <body>.
  // Tenant JSON-LD is built above only for published tenants; a platform
  // landing must never emit both.
  const platformJsonLd =
    isPlatformLanding && !org
      ? {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "MARKEC",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: getDictionary(landingLocale).landing.meta.description,
          inLanguage: ["sl", "en"],
        }
      : null

  // CartProvider is now SSR-safe (it renders children on the server — see
  // src/components/providers/cart-provider.tsx).It used to return null on the
  // server and blank the entire SSR body; that gate is gone, so the whole
  // platform server-renders. We still keep the landing branch for clarity but
  // it no longer changes rendering behaviour.
  const pageTree = <TooltipProvider>{children}</TooltipProvider>

  return (
    <html
      lang={htmlLocale}
      className="scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {themeCss && <style id="org-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {jsonLd && (
          <script
            type="application/ld+json"
            // Varnost: "<" ubežen — JSON v <script> nikoli ne sme vsebovati
            // konca oznake (lastniška polja (ime/opis) lahko vsebujejo "</script>").
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
          />
        )}
        {platformJsonLd && (
          <>
            <script
              type="application/ld+json"
              // Varnost: glej zgoraj — "<" ubežen.
              dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd).replace(/</g, "\\u003c") }}
            />
            <meta
              property="og:locale:alternate"
              content={landingLocale === "en" ? "sl_SI" : "en_US"}
            />
          </>
        )}
      </head>
      <body
        className={`${rougeScript.variable} ${poppins.variable} ${playfair.variable} ${cormorant.variable} ${oswald.variable} ${montserrat.variable} ${inter.variable} ${lora.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <CurrencyProvider currency={orgCurrency}>
              {isPlatformLanding ? (
                pageTree
              ) : (
                <CartProvider>{pageTree}</CartProvider>
              )}
            </CurrencyProvider>

            <Toaster position="top-right" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
