import { HeroSection } from "@/components/marketplace/hero-section"
import { BusinessShowcase } from "@/components/marketplace/business-showcase"
import { TestimonialsSection } from "@/components/marketplace/testimonials-section"
import { BigStatsSection } from "@/components/marketplace/big-stats-section"
import { BrowseByLocation } from "@/components/marketplace/browse-by-location"
import { B2BShowcase } from "@/components/marketplace/b2b-showcase"
import { AppDownloadSection } from "@/components/marketplace/app-download-section"
import { EnhancedFooter } from "@/components/marketplace/enhanced-footer"
import {
  getRecommendedBusinesses,
  getPopularBusinesses,
  getNewBusinesses,
  getMarketplaceStats,
} from "@/app/actions/marketplace"

// ============================================================
// MARKETPLACE MAIN PAGE (Fresha-inspired, superior 2026-11-16)
// Complete marketplace with all sections assembled.
// Surpasses Fresha with better organization and visual design.
// ============================================================

export const metadata = {
  title: "MARKEC — Rezervirajte lokalne storitve",
  description:
    "Odkrijte najbolje ocenjene salone, brivce, zdravnike in lepotne strokovnjake. Rezervirajte termin v nekaj klikih.",
}

export default async function MarketplacePage() {
  // Fetch real data from database
  const [recommendedBusinesses, popularBusinesses, newBusinesses, stats] =
    await Promise.all([
      getRecommendedBusinesses(),
      getPopularBusinesses(),
      getNewBusinesses(),
      getMarketplaceStats(),
    ])

  return (
    <div className="min-h-screen">
      {/* 1. Hero with Search */}
      <HeroSection />

      {/* 2. Business Showcase (Recommended + Popular + New) */}
      <BusinessShowcase
        recommendedBusinesses={recommendedBusinesses}
        popularBusinesses={popularBusinesses}
        newBusinesses={newBusinesses}
      />

      {/* 3. Testimonials */}
      <TestimonialsSection />

      {/* 4. Big Statistics */}
      <BigStatsSection
        totalAppointments={stats.totalAppointments}
        totalBusinesses={stats.totalBusinesses}
        citiesCount={stats.citiesCount}
        totalCustomers={stats.totalCustomers}
      />

      {/* 5. B2B Showcase */}
      <B2BShowcase />

      {/* 6. App Download */}
      <AppDownloadSection
        bookingsCount={stats.totalAppointments}
        businessesCount={stats.totalBusinesses}
      />

      {/* 7. Browse by Location */}
      <BrowseByLocation />

      {/* 8. Enhanced Footer */}
      <EnhancedFooter />
    </div>
  )
}