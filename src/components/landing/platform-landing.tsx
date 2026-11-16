import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Languages,
  MapPin,
  Menu,
  PencilLine,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { DemoTourButton } from "@/components/landing/demo-tour"
import { PLANS } from "@/lib/plans/registry"
import { landingSl, landingEn, type LandingDictionary } from "@/lib/i18n/dict/landing"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/i18n/config"

// ============================================================
// P1 #66 / F1 — PLATFORM LANDING (the product's front door).
//
// "/"  → Slovenian, "/en" → English. Both are SERVER components: the
// language is part of the URL, not a cookie or a client-side switch,
// so crawlers and no-JS visitors get the right copy and metadata.
//
// Owner positioning (commit 15aa272) is kept VERBATIM in dict/landing.ts
// (hero.h1Lead / h1Accent / tagline / lead and the three "Kako deluje"
// steps). F1 adds: product visual, 5 real preset-image examples, FAQ,
// registry-driven plans with an honest pricing note, legal footer and a
// crawlable endonym language switcher. ONE primary CTA above the fold.
//
// The activity cards are a SAMPLE of 5 of the 12 registered profiles —
// the universal "generic" preset stays available in StartWizard but is
// deliberately not shown as a marketing example (owner decision 7. 11.).
// ============================================================

const MODULE_ICONS = [CalendarDays, ShoppingBag, PencilLine, Languages]

export function PlatformLanding({
  locale,
  dashboardHref,
}: {
  locale: Locale
  /** lastnik (7. 11. 2026): prijavljen lastnik vidi VSTOPNO stran (glavna
   * MARKEC reklama) — le glava pokaže "Moja plošča" namesto prijave. */
  dashboardHref?: string | null
}) {
  // T9 (bundle): lokalni slovar namesto getDictionary — slednji vleče VSE
  // slovarje (settings 60 KB …) v client bundle landinga.
  const t: LandingDictionary = locale === "en" ? landingEn : landingSl
  const plans = Object.values(PLANS)
  const isEn = locale === "en"
  const otherLangHref = isEn ? "/" : "/en"

  // Crawlable language links — endonyms, no IP/Accept-Language redirect,
  // and deliberately NOT writing the admin LOCALE_COOKIE.
  const langLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      hrefLang={href === "/en" ? "en" : "sl"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-[13px] leading-none transition-colors",
        active
          ? "bg-background text-foreground font-semibold shadow-sm"
          : "text-muted-foreground hover:text-foreground font-medium"
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="from-background via-background to-muted/40 min-h-screen bg-linear-to-b">
      {/* F2: SoftwareApplication JSON-LD and og:locale:alternate are emitted
          by the root layout's <head> (see src/app/layout.tsx). Keeping them
          here would duplicate the structured data in the rendered HTML. */}
      {/* Header */}
      <header className="border-border/40 dark:bg-background/80 sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2">
            <Logo variant="navbar" />
          </Link>
          <nav
            aria-label={t.aria.nav}
            className="text-muted-foreground ml-4 hidden items-center gap-5 text-sm lg:flex"
          >
            <Link href="#moduli" className="hover:text-foreground">
              {t.nav.modules}
            </Link>
            <Link href="#primeri" className="hover:text-foreground">
              {t.nav.examples}
            </Link>
            <Link href="#koraki" className="hover:text-foreground">
              {t.nav.steps}
            </Link>
            <Link href="#paketi" className="hover:text-foreground">
              {t.nav.plans}
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Cene
            </Link>
          </nav>
          <span className="flex-1" />
          {/* Mobile navigation — CSS-only <details> keeps this a server component. */}
          <details className="group relative lg:hidden">
            <summary
              aria-label={t.aria.menu}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div className="border-border bg-background absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border p-2 shadow-xl">
              <Link href="#moduli" className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm">
                {t.nav.modules}
              </Link>
              <Link href="#primeri" className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm">
                {t.nav.examples}
              </Link>
              <Link href="#koraki" className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm">
                {t.nav.steps}
              </Link>
              <Link href="#paketi" className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm">
                {t.nav.plans}
              </Link>
              <Link href="/pricing" className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm">
                {isEn ? "Pricing" : "Cene"}
              </Link>
              <Link
                href={dashboardHref ?? "/login"}
                className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm"
              >
                {dashboardHref ? t.nav.dashboard : t.nav.login}
              </Link>
              <Link
                href="/start"
                className="bg-primary text-primary-foreground mt-1 block rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
              >
                {t.nav.cta}
              </Link>
            </div>
          </details>
          <div
            role="group"
            aria-label={t.aria.lang}
            className="bg-muted/60 flex shrink-0 items-center gap-0.5 rounded-lg p-1"
          >
            {langLink("/", t.languages.sl, !isEn)}
            {langLink("/en", t.languages.en, isEn)}
          </div>
          <Link
            href={dashboardHref ?? "/login"}
            className="text-muted-foreground hover:text-foreground hidden text-sm md:inline"
          >
            {dashboardHref ? t.nav.dashboard : t.nav.login}
          </Link>
          <Button
            asChild
            size="sm"
            className="min-h-11 shadow-md max-[420px]:hidden"
          >
            <Link href="/start">{t.nav.cta}</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero — premium gradient + animated social proof + dual CTAs */}
        <section className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
          
          {/* Decorative Elements */}
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <div className="lg:max-w-3xl">
              {/* Badge */}
              <p className="text-primary-text border-border bg-background/80 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <Sparkles className="size-4" aria-hidden="true" />
                {t.hero.eyebrow}
              </p>
              
              {/* Headline */}
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                {t.hero.h1Lead}{" "}
                <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                  {t.hero.h1Accent}
                </span>
              </h1>
              
              {/* Tagline */}
              <p className="text-muted-foreground mt-3 text-xs font-medium tracking-[0.2em] uppercase">
                {t.hero.tagline}
              </p>
              
              {/* Lead */}
              <p className="text-muted-foreground mt-5 max-w-xl text-lg md:text-xl">
                {t.hero.lead}
              </p>
              
              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="min-h-12 shadow-lg">
                  <Link href="/start">
                    {t.hero.cta}
                    <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                  </Link>
                </Button>
                {t.examples.demo ? (
                  <DemoTourButton
                    vertical="cebelar"
                    accent="#d97706"
                    label={t.examples.demo.label}
                    stepsRaw={t.examples.demo.steps}
                    variant="outline"
                    className="min-h-12"
                  />
                ) : null}
              </div>
              
              {/* Micro copy */}
              <p className="text-muted-foreground mt-5 text-sm">{t.hero.micro}</p>
              
              {/* No invented ratings or customer counts. Verified proof is
                  shown only when it comes from the database. */}
            </div>
          </div>
        </section>

        {/* Trust strip — verifiable facts only, no invented numbers/logos. */}
        <div className="border-border/40 bg-muted/30 border-y py-6">
          <ul className="container mx-auto grid grid-cols-1 gap-4 px-4 text-center text-sm sm:grid-cols-2 lg:grid-cols-4">
            {t.trust.map((item) => (
              <li
                key={item}
                className="text-muted-foreground flex items-center justify-center gap-3"
              >
                <span className="bg-primary/10 text-primary-text flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Marketplace Search — Fresha-inspired discovery entry */}
        <section className="border-border/40 bg-gradient-to-b from-muted/20 to-background py-12">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
                Išči storitve
              </p>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                Rezervirajte lokalne storitve samoskrbe
              </h2>
              <p className="text-muted-foreground mt-2">
                Odkrijte najbolje ocenjene salone, brivce in lepotne strokovnjake.
              </p>
            </div>

            {/* Search Bar — real query, no dead inputs. */}
            <form
              action="/podjetja"
              method="get"
              className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 rounded-2xl border bg-background p-3 shadow-lg sm:flex-row sm:items-center"
            >
              <label className="flex flex-1 items-center gap-2 rounded-xl border px-4 py-3">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  name="q"
                  aria-label={isEn ? "Service or business" : "Storitev ali podjetje"}
                  placeholder={isEn ? "What are you looking for?" : "Kaj iščete? (striženje, masaža...)"}
                  className="min-w-0 flex-1 bg-transparent text-base outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border px-4 py-3 sm:w-40">
                <MapPin className="size-5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  name="location"
                  aria-label={isEn ? "Location" : "Kraj"}
                  placeholder={isEn ? "Location" : "Kraj"}
                  className="min-w-0 w-full bg-transparent text-base outline-none"
                />
              </label>
              <Button type="submit" size="lg" className="w-full rounded-xl px-8 sm:w-auto">
                {isEn ? "Search" : "Išči"}
              </Button>
            </form>

            {/* Quick links */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {[
                "Frizerski saloni",
                "Kozmetika",
                "Masaža",
                "Brivci",
                "Nohti",
                "Wellness",
              ].map((category) => (
                <Link
                  key={category}
                  href={`/podjetja?kategorija=${encodeURIComponent(category)}`}
                  className="rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {category}
                </Link>
              ))}
            </div>

            {/* CTA to marketplace */}
            <div className="mt-6 text-center">
              <Link
                href="/podjetja"
                className="text-primary-text text-sm font-medium hover:underline"
              >
                Razišči vsa podjetja →
              </Link>
            </div>
          </div>
        </section>

        {/* Problem → modules — premium cards with icons */}
        <section id="moduli" className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
              {t.problem.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold">{t.problem.title}</h2>
            <p className="text-muted-foreground mt-4">{t.problem.lead}</p>
          </div>
          
          {/* Problem cards */}
          <ul className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
            {t.problem.cards.map((card, i) => (
              <li
                key={card.title}
                className="border-border/60 bg-card group rounded-xl border p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                  <span className="text-2xl">{["⚠️", "⏳", "📭"][i]}</span>
                </div>
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {card.body}
                </p>
              </li>
            ))}
          </ul>
          
          {/* Module cards */}
          <ul className="mx-auto mt-8 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.modules.map((mod, i) => {
              const Icon = MODULE_ICONS[i] ?? Sparkles
              return (
                <li
                  key={mod.title}
                  className="border-border/60 bg-card group rounded-xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                >
                  <span className="bg-primary/10 text-primary-text mb-4 flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold">{mod.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {mod.body}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Examples — 5 of 12 registered profiles. 3 + 2 centered on desktop. */}
        <section
          id="primeri"
          className="border-border/40 bg-muted/30 border-y py-16"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
                {t.examples.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold">{t.examples.title}</h2>
              <p className="text-muted-foreground mt-4">{t.examples.lead}</p>
            </div>
            <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
              {t.examples.items.map((item, i) => (
                <li
                  key={item.vertical}
                  className={
                    i === 3
                      ? "lg:col-span-2 lg:col-start-2"
                      : i === 4
                        ? "lg:col-span-2 lg:col-start-4"
                        : "lg:col-span-2"
                  }
                >
                  <Link
                    href={`/start?vertical=${item.vertical}`}
                    className="border-border/60 bg-card group flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 hover:border-primary/40"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground">
                          Začni zdaj →
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="mt-2 text-lg font-semibold transition-colors group-hover:text-primary">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground mt-2 flex-1 text-sm">
                        {item.body}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-xs">
              {t.examples.more}
            </p>
          </div>
        </section>

        {/* How it works — premium visual flow with connecting lines */}
        <section id="koraki" className="container mx-auto px-4 py-16">
          <div className="text-center">
            <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
              {t.steps.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-bold">{t.steps.title}</h2>
          </div>
          <ol className="mx-auto mt-12 grid max-w-6xl gap-8 sm:grid-cols-2 md:grid-cols-4">
            {t.steps.items.map((step, i) => (
              <li key={step.title} className="relative text-center">
                {/* Connecting line */}
                {i < 3 && (
                  <div className="absolute left-1/2 top-8 hidden h-px w-full bg-gradient-to-r from-primary/30 to-transparent md:block" />
                )}
                
                {/* Step number */}
                <div className="bg-primary/10 text-primary-text relative z-10 mx-auto mb-5 flex size-14 items-center justify-center rounded-full text-2xl font-bold">
                  {i + 1}
                </div>
                
                {/* Step content */}
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Plans — real limits/features from the registry, no invented prices. */}
        <section
          id="paketi"
          className="border-border/40 bg-muted/30 border-y py-16"
        >
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
                {t.plans.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold">{t.plans.title}</h2>
              <p className="text-muted-foreground mt-4">{t.plans.lead}</p>
            </div>
            <ul className="mx-auto mt-12 grid max-w-5xl items-stretch gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className={
                    plan.id === "pro"
                      ? "border-primary bg-card relative flex flex-col rounded-2xl border-2 p-8 shadow-xl"
                      : "border-border/60 bg-card flex flex-col rounded-2xl border p-8 shadow-sm transition-all hover:shadow-md"
                  }
                >
                  {plan.id === "pro" && (
                    <span className="bg-primary text-primary-foreground absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-md">
                      {t.plans.badge}
                    </span>
                  )}
                  <h3 className="text-primary-text text-sm font-bold tracking-widest">
                    {plan.label}
                  </h3>
                  <p className="text-muted-foreground mt-3 min-h-12 text-sm">
                    {plan.description[locale]}
                  </p>
                  {plan.priceMonthly >= 0 && (
                    <p className="text-foreground mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {plan.priceMonthly === 0
                          ? "0 €"
                          : `${(plan.priceMonthly / 100).toFixed(0)} €`}
                      </span>
                      <span className="text-muted-foreground text-sm">/ mesec</span>
                    </p>
                  )}
                  <ul className="text-muted-foreground mt-6 mb-8 flex-1 space-y-3 text-sm">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f.sl} className="flex items-start gap-2.5">
                        <CheckCircle2
                          className="text-primary-text mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{f[locale]}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.id === "pro" ? "default" : "outline"}
                    className="w-full min-h-11"
                  >
                    <Link href="/start">{t.plans.cta}</Link>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground border-border bg-background mx-auto mt-8 max-w-3xl rounded-xl border p-4 text-center text-sm">
              {t.plans.note}
            </p>
            <div className="mt-6 text-center">
              <Link
                href="/pricing"
                className="text-primary-text text-sm font-medium hover:underline"
              >
                Poglej vse cene in primerjavo paketov →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ / objections — premium accordion */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center">
            <p className="text-primary-text text-xs font-semibold tracking-wider uppercase">
              Pomoč
            </p>
            <h2 className="mt-3 text-3xl font-bold">{t.faq.title}</h2>
          </div>
          <div className="border-border mx-auto mt-10 max-w-3xl border-t">
            {t.faq.items.map((item) => (
              <details
                key={item.q}
                className="group border-border border-b py-5"
              >
                <summary className="hover:text-primary-text flex cursor-pointer list-none items-center justify-between gap-4 font-semibold transition-colors">
                  <span className="text-lg">{item.q}</span>
                  <span
                    className="text-primary-text flex size-8 shrink-0 items-center justify-center rounded-full bg-muted transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <span className="text-xl leading-none">+</span>
                  </span>
                </summary>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA — gradient + urgency + trust badges */}
        <section className="from-primary to-accent bg-linear-to-r py-20 text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold">{t.final.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-xl opacity-90">{t.final.lead}</p>
            
            {/* CTA Button */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-primary mt-8 min-h-14 bg-white px-10 text-lg hover:bg-white/90"
            >
              <Link href="/start">
                {t.final.cta}
                <ArrowRight className="ml-2 size-6" aria-hidden="true" />
              </Link>
            </Button>
            
            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 opacity-80">
              {["✓ Brez kreditne kartice", "✓ 14 dni brezplačno", "✓ Prekličite kadarkoli"].map((badge) => (
                <span key={badge} className="text-sm">{badge}</span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border/40 bg-muted/20 border-t py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <Logo variant="navbar" />
              <p className="text-muted-foreground text-sm">
                © {new Date().getFullYear()} · {t.foot.tag}
              </p>
            </div>
            
            {/* Legal links */}
            <nav aria-label={t.aria.legal} className="flex flex-wrap gap-5">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t.foot.privacy}
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t.foot.terms}
              </Link>
              <Link href="/cookies" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t.foot.cookies}
              </Link>
            </nav>
            
            {/* Platform links */}
            <nav aria-label={t.aria.footer} className="flex flex-wrap gap-5">
              <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {dashboardHref ? t.foot.dashboard : t.foot.login}
              </Link>
              <Link href="/start" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                {t.foot.start}
              </Link>
              <Link
                href={otherLangHref}
                hrefLang={isEn ? "sl" : "en"}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {isEn ? t.languages.sl : t.languages.en}
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
