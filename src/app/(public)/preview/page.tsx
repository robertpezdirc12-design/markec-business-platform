import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { getTrustedOrgSlug, getOrgBySlug } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { hasUnpublishedChanges, parsePublishState } from "@/lib/publication"
import { mergeSiteContent } from "@/lib/site-content"
import { upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { resolveSessionOrganization } from "@/lib/auth/guards"
import {
  getPublicFeaturedProducts,
  getPublicFeaturedServices,
  getPublicFeaturedStaff,
  getPublicTestimonials,
} from "@/lib/public-site"
import { HomeContent } from "@/components/landing/home-content"
import { resolveCtaLinks, resolveCtaSectionHref } from "@/lib/public-cta"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { PreviewBanner } from "@/components/public/preview-banner"
import { EditableSitePreview } from "@/components/site-editor/editable-site-preview"
import { getPreviewGalleries } from "@/app/actions/galleries"
import { getPreviewFaq } from "@/app/actions/faq"
import type { CtaLink } from "@/lib/site-content"

// ============================================================
// DRAFT PREVIEW (EPIC #3 E3-2) — /s/[slug]/preview
//
// Renders the WORKING site content (draft) instead of the published
// snapshot. Strictly owner/staff-only: anyone else is redirected to
// the public site, so drafts can never leak.
//
// ?edit=1 — F5.3.1: vgrajen v vizualni urejevalnik (iframe, istega
// vira). Renderira isti HomeContent v `editMode` in sprejema osnutek
// prek postMessage; PreviewBanner se v tem načinu izpusti.
// ============================================================

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const params = await searchParams
  const isEditMode = params.edit === "1"
  // V-1 (issue #102): only the proxy-SIGNED header selects the tenant.
  const slug = await getTrustedOrgSlug()
  if (!slug) redirect("/")

  const org = await getOrgBySlug(slug)
  if (!org) redirect("/")

  // Owner gate: only this tenant's OWN signed-in users may preview drafts.
  // 2D-6 (Agent D finding): use the membership-evidenced resolver, not the
  // legacy JWT `organizationId` pointer (which a removed/deactivated user's
  // stale token could carry) — a draft editor must prove membership.
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/s/${org.slug}`)
  }
  const sessionOrg = await resolveSessionOrganization(session)
  if (sessionOrg?.id !== org.id) {
    redirect(`/s/${org.slug}`)
  }

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { siteContent: true, publishedContentVersion: true },
  })

  // ALWAYS the live working content — that is the point of the preview.
  // #100 MARKEC: zastarela platformsko privzeta besedila demo najemnika se
  // nadgradijo enako kot na javni strani — predogled je resničen (WYSIWYG).
  const content = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug,
    org.vertical
  )
  const [featuredServices, featuredProducts, featuredStaff, previewGalleries, previewFaq, reviewsModule, testimonials] = await Promise.all([
    getPublicFeaturedServices(org.id),
    getPublicFeaturedProducts(org.id),
    getPublicFeaturedStaff(org.id),
    // F5.5.2 — predogled prikaže OBJAVLJENE + osnutke (draft) galerij/FAQ.
    getPreviewGalleries(org.id),
    getPreviewFaq(org.id),
    // F6.3.5 — izklopljen modul ocen skrije sekcijo tudi v predogledu.
    prisma.organizationModuleState
      .findUnique({
        where: { organizationId_moduleId: { organizationId: org.id, moduleId: "reviews" } },
        select: { state: true },
      })
      .catch(() => null),
    // F6.3.5.1 — realne ocene za lastniški vizualni pregled (ista data kot javna).
    getPublicTestimonials(org.id),
  ])
  const reviewsEnabled = reviewsModule?.state !== "DEACTIVATED"

  const state = parsePublishState(org.publishState)
  const unpublished = hasUnpublishedChanges(
    org.contentVersion,
    config?.publishedContentVersion ?? null
  )

  // F5.3.1: vgrajen v urejevalnik (iframe) — brez bannera, s klicnimi
  // sekcijami; parent hoče isti renderer kot javna stran.
  if (isEditMode) {
    const ctaLinks = resolveCtaLinks(org, content) as {
      primaryCta: CtaLink
      secondaryCta: CtaLink | null
    }
    return (
      <EditableSitePreview
        initialContent={content}
        org={{ slug: org.slug, name: org.name, logo: org.logo }}
        ctaLinks={ctaLinks}
        ctaSectionHref={resolveCtaSectionHref(org, content.cta.buttonHref)}
        featuredServices={featuredServices}
        featuredProducts={featuredProducts}
        featuredStaff={featuredStaff}
        previewGalleries={previewGalleries}
        previewFaq={previewFaq}
        hasServices={featuredServices.length > 0}
        hasProducts={featuredProducts.length > 0}
        testimonials={testimonials}
        canReviewBusiness={
          !isCapabilityEnabled(resolveEffectiveProfile(org), "services")
        }
        reviewsEnabled={reviewsEnabled}
      />
    )
  }

  return (
    <div>
      <PreviewBanner
        state={state}
        hasUnpublishedChanges={unpublished}
        siteUrl={`/s/${org.slug}`}
      />
      <main>
        <HomeContent
          org={{ slug: org.slug, name: org.name, logo: org.logo }}
          profileId={org.vertical ?? undefined}
          content={content}
          ctaLinks={resolveCtaLinks(org, content)}
          ctaSectionHref={resolveCtaSectionHref(org, content.cta.buttonHref)}
          serviceCtaLabel={
            resolveEffectiveProfile(org).capabilities.appointments !== "disabled"
              ? "Rezerviraj"
              : "Poglej"
          }
          featuredServices={featuredServices}
          featuredProducts={featuredProducts}
          featuredStaff={featuredStaff}
          hasServices={featuredServices.length > 0}
          hasProducts={featuredProducts.length > 0}
          publicGalleries={previewGalleries}
          publicFaq={previewFaq}
          // P2 #75: predogled pokaže formo za oceno podjetja za profile brez
          // storitev — ista pravila kot javna stran.
          canReviewBusiness={
            !isCapabilityEnabled(resolveEffectiveProfile(org), "services")
          }
          // F6.3.5: izklopljen modul ocen skrije sekcijo v predogledu.
          reviewsEnabled={reviewsEnabled}
        />
      </main>
    </div>
  )
}
