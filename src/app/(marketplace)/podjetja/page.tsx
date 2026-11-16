import { HeroSection } from "@/components/marketplace/hero-section"
import { BusinessShowcase } from "@/components/marketplace/business-showcase"
import { TestimonialsSection } from "@/components/marketplace/testimonials-section"
import { BigStatsSection } from "@/components/marketplace/big-stats-section"
import { BrowseByLocation } from "@/components/marketplace/browse-by-location"
import { B2BShowcase } from "@/components/marketplace/b2b-showcase"
import { AppDownloadSection } from "@/components/marketplace/app-download-section"
import { EnhancedFooter } from "@/components/marketplace/enhanced-footer"

// ============================================================
// MARKETPLACE MAIN PAGE (Fresha-inspired, superior 2026-11-16)
// Complete marketplace with all sections assembled.
// Surpasses Fresha with better organization and visual design.
// ============================================================

export const metadata = {
  title: "MARKEC — Rezervirajte lokalne storitve samoskrbe",
  description:
    "Odkrijte najbolje ocenjene salone, brivce, zdravnike in lepotne strokovnjake. Rezervirajte termin v nekaj klikih.",
}

export default function MarketplacePage() {
  return (
    <div className="min-h-screen">
      {/* 1. Hero with Search */}
      <HeroSection />

      {/* 2. Business Showcase (Recommended + Popular + New) */}
      <BusinessShowcase />

      {/* 3. Testimonials */}
      <TestimonialsSection />

      {/* 4. Big Statistics */}
      <BigStatsSection />

      {/* 5. B2B Showcase */}
      <B2BShowcase />

      {/* 6. App Download */}
      <AppDownloadSection
        bookingsCount={12500}
        businessesCount={500}
      />

      {/* 7. Browse by Location */}
      <BrowseByLocation />

      {/* 8. Enhanced Footer */}
      <EnhancedFooter />
    </div>
  )
}