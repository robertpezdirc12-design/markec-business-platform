// ============================================================
// (marketing) ROUTE GROUP LAYOUT
// Skupna lupina za platformne marketinške/pravne strani:
// glava + noga. Prej so te strani živele v (public), kjer za
// platformni kontekst ni ne glave ne noge — obiskovalec s Cenika
// ni imel nobene poti naprej (audit 2026-11-17).
// ============================================================

import { PlatformMarketingHeader } from "@/components/layouts/platform-marketing-header"
import { EnhancedFooter } from "@/components/marketplace/enhanced-footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PlatformMarketingHeader />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <EnhancedFooter />
    </div>
  )
}
