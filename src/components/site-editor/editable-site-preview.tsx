"use client"

// ============================================================
// F5.3.1 — VGRAJENI PREDOGLED (teče v iframe na /s/[slug]/preview?edit=1).
//
// Predogled NIKOLI ne izračunava približne kopije — uporablja ISTI
// `HomeContent` renderer kot javna stran, z `editMode` (izbirljive
// sekcije) in s trenutnim osnutkom, ki ga sproti pošlje urejevalnik
// (parent) prek postMessage. Ob izbiri sekcije sporoči parentu.
// Sporočila so origin-checked prek bridge modula (same-origin).
// ============================================================

import { useCallback, useEffect, useState } from "react"
import {
  HomeContent,
  type Service,
  type Product,
  type Staff,
} from "@/components/landing/home-content"
import type { LandingTestimonial } from "@/components/landing/testimonials-section"
import { PREVIEW_SOURCE, isEditorMessage } from "@/lib/site-editor-bridge"
import type { SiteContent } from "@/lib/site-content"
import type { PublicGalleryDTO } from "@/app/actions/galleries"
import type { PublicFaqDTO } from "@/app/actions/faq"

interface Props {
  initialContent: SiteContent
  org: { slug: string | null; name: string; logo: string | null }
  featuredServices: Service[]
  featuredProducts: Product[]
  featuredStaff: Staff[]
  ctaLinks: { primaryCta: unknown; secondaryCta: unknown }
  ctaSectionHref: string
  hasServices: boolean
  hasProducts: boolean
  previewGalleries?: PublicGalleryDTO[]
  previewFaq?: PublicFaqDTO[]
  /** F6.3.5.1: modul ocen aktiven (OrganizationModuleState.reviews != DEACTIVATED). */
  reviewsEnabled?: boolean
  testimonials?: LandingTestimonial[]
  canReviewBusiness?: boolean
}

export function EditableSitePreview({
  initialContent,
  org,
  featuredServices,
  featuredProducts,
  featuredStaff,
  ctaLinks,
  ctaSectionHref,
  hasServices,
  hasProducts,
  previewGalleries = [],
  previewFaq = [],
  reviewsEnabled = true,
  testimonials = [],
  canReviewBusiness = false,
}: Props) {
  // Lokalni osnutek: sprva strežniški, nato ga sproti nadgrajuje parent.
  const [content, setContent] = useState<SiteContent>(initialContent)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isEditorMessage(event.data)) return
      // Parent pošlje celoten osnutek → takojšnja posodobitev brez DB kroga.
      setContent(event.data.content)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const handleSectionSelect = useCallback((sectionKey: string) => {
    window.parent.postMessage(
      { source: PREVIEW_SOURCE, type: "section-select", sectionKey },
      window.location.origin
    )
  }, [])

  return (
    <div className="min-h-screen">
      <HomeContent
        org={org}
        profileId={(org as unknown as { vertical?: string | null }).vertical ?? undefined}
        content={content}
        ctaLinks={ctaLinks as never}
        ctaSectionHref={ctaSectionHref}
        featuredServices={featuredServices}
        featuredProducts={featuredProducts}
        featuredStaff={featuredStaff}
        hasServices={hasServices}
        hasProducts={hasProducts}
        publicGalleries={previewGalleries}
        publicFaq={previewFaq}
        reviewsEnabled={reviewsEnabled}
        testimonials={testimonials}
        canReviewBusiness={canReviewBusiness}
        editMode
        onSectionSelect={handleSectionSelect}
      />
    </div>
  )
}