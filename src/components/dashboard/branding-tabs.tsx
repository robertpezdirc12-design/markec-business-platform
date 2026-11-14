"use client"

// ============================================================
// F5.3.1 — IZGLED IN VSEBINA: preklop med vizualnim urejevalnikom
// (privzeti) in klasičnim form-based urejevalnikom.
//
// Ne gradimo vzporednega CMS-a — oba načina pišeta v ISTI model
// (SiteContent → SalonConfig.siteContent, objava → publishedSiteContent).
// Vizualni način je namenjen podjetniku; klasični obrazec ostane na voljo
// za napredne nastavitve (paleta, logotip, tema, vertical switch, vse polja).
// Oba sta force-mounted, da se stanje ne izgubi ob preklopu.
// ============================================================

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SiteVisualEditor } from "@/components/site-editor/site-visual-editor"
import { BrandingEditor } from "@/components/dashboard/branding-editor"

export function BrandingTabs() {
  const [mode, setMode] = useState<"visual" | "form">("visual")

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "form")}>
        <TabsList>
          <TabsTrigger value="visual">Vizualni urejevalnik</TabsTrigger>
          <TabsTrigger value="form">Klasični obrazec</TabsTrigger>
        </TabsList>
        <TabsContent value="visual" forceMount className="mt-4 data-[state=inactive]:hidden">
          <SiteVisualEditor />
        </TabsContent>
        <TabsContent value="form" forceMount className="mt-4 data-[state=inactive]:hidden">
          <BrandingEditor />
        </TabsContent>
      </Tabs>
    </div>
  )
}