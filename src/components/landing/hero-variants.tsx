"use client"

// ============================================================
// F6.3 — HERO RAZLIČICE (layout strukture po dejavnosti).
//
// Do F6.3 je bil hero vedno velik gradienten centered slog. Te različice
// ponujajo drugačno STRUKTURO predstavitvenega območja (tipografsko
// razmerje z sliko / kompaktna minimalna pasica) za dejavnosti, kjer
// velik centered hero ni pravi (npr. šivilja, čebelar). Vsaka različica
// je namenska React komponenta (ne CSS-vrtenje istega HTML-ja).
//
// Uporablja iste podatke kot obstoječi hero (`content.hero`, CTA povezave),
// zato lastnik ureja besedila/fotografije v obstoječem urejevalniku.
// ============================================================

import Image from "next/image"
import Link from "next/link"
import type { CtaLink } from "@/lib/site-content"

interface HeroContentShape {
  eyebrow?: string
  title: string
  subtitle: string
  imageUrl?: string | null
  videoUrl?: string | null
}

interface HeroVariantProps {
  content: HeroContentShape
  primaryCta: CtaLink
  secondaryCta: CtaLink | null | undefined
  toHref: (href: string) => string
  accentTitle?: string
}

/** Split hero: levo besedilo (visoka tipografija), desno fotografija.
 *  Uporaba: dejavnosti, ki delujejo na obravnavanih stvareh (mehanik/servis). */
export function SplitHero({ content, primaryCta, secondaryCta, toHref, accentTitle }: HeroVariantProps) {
  const title = accentTitle ?? content.title
  return (
    <section className="from-primary to-primary/80 relative overflow-hidden bg-linear-to-br text-white">
      <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          {content.eyebrow && (
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-white/70">
              {content.eyebrow}
            </p>
          )}
          <h1 className="font-heading text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">{content.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={toHref(primaryCta.href)}
              className="bg-background text-foreground hover:bg-background/90 inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold transition"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta && (
              <Link
                href={toHref(secondaryCta.href)}
                className="border border-white/40 text-white hover:bg-white/10 inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold transition"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
        <div className="order-first lg:order-last">
          {content.imageUrl ? (
            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <Image
                src={content.imageUrl}
                alt={content.title}
                width={1200}
                height={800}
                className="aspect-[3/2] h-auto w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[3/2] rounded-2xl bg-white/10" />
          )}
        </div>
      </div>
    </section>
  )
}

/** Minimal hero: kompaktna, bela pasica z besedilom v središču.
 *  Uporaba: atelje/šivilja, pridelovalec, konzultanti. */
export function MinimalHero({ content, primaryCta, secondaryCta, toHref }: HeroVariantProps) {
  return (
    <section className="border-border/40 border-b bg-background py-16 lg:py-20">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        {content.eyebrow && (
          <p className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-[0.25em]">
            {content.eyebrow}
          </p>
        )}
        <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl lg:text-5xl">
          {content.title}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{content.subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={toHref(primaryCta.href)}
            className="bg-primary text-primary-foreground inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold transition"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={toHref(secondaryCta.href)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center rounded-lg border border-border px-6 py-3 text-sm font-semibold transition"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}