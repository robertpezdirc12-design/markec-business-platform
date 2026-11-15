"use client"

// ============================================================
// SETTINGS TABS (reorganized 2026-11-15)
// 7 tabs → 4 logical groups:
//   🏢 Podjetje       — company info, profile, publication, push
//   🎨 Spletna stran  — branding, galleries/FAQ, custom profiles
//   ⚙️ Funkcije       — modules, activities, payments, config history
//   🔧 Napredno       — domains, analytics
// ============================================================

import { useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SettingsTabsProps {
  defaultTab?: string
  company: ReactNode
  website: ReactNode
  features: ReactNode
  advanced: ReactNode
}

const TAB_IDS = ["company", "website", "features", "advanced"] as const
type TabId = (typeof TAB_IDS)[number]

function resolveTab(value: string | undefined): TabId {
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : "company"
}

export function SettingsTabs({
  defaultTab,
  company,
  website,
  features,
  advanced,
}: SettingsTabsProps) {
  const [tab, setTab] = useState<TabId>(() => resolveTab(defaultTab))

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
      <TabsList>
        <TabsTrigger value="company">🏢 Podjetje</TabsTrigger>
        <TabsTrigger value="website">🎨 Spletna stran</TabsTrigger>
        <TabsTrigger value="features">⚙️ Funkcije</TabsTrigger>
        <TabsTrigger value="advanced">🔧 Napredno</TabsTrigger>
      </TabsList>

      <TabsContent value="company" forceMount className="mt-6 data-[state=inactive]:hidden">
        {company}
      </TabsContent>
      <TabsContent value="website" forceMount className="mt-6 data-[state=inactive]:hidden">
        {website}
      </TabsContent>
      <TabsContent value="features" forceMount className="mt-6 data-[state=inactive]:hidden">
        {features}
      </TabsContent>
      <TabsContent value="advanced" forceMount className="mt-6 data-[state=inactive]:hidden">
        {advanced}
      </TabsContent>
    </Tabs>
  )
}
