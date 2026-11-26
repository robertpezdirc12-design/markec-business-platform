"use client"

// ============================================================
// SETTINGS TABS (reorganized 2026-11-15)
// 7 tabs → 4 logical groups:
//   Podjetje       — company info, profile, publication, push, Google koledar
//   Spletna stran  — branding, galleries/FAQ, custom profiles
//   Funkcije       — modules, activities, payments, config history
//   Napredno       — domains, analytics
//
// Na 360 px se štiri oznake ne prilegajo v eno vrstico (prej so tekle
// izven zaslona in povzročale vodoravni drsnik). Zato seznam ovije v
// dve vrstici, na >=sm pa ostane ena.
// ============================================================

import { useState, type ReactNode } from "react"
import { Buildings, PaintBrush, SquaresFour, Wrench } from "@phosphor-icons/react/dist/ssr"
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
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:h-9 sm:w-auto sm:flex-nowrap">
        <TabsTrigger value="company" className="gap-1.5">
          <Buildings size={16} aria-hidden />
          Podjetje
        </TabsTrigger>
        <TabsTrigger value="website" className="gap-1.5">
          <PaintBrush size={16} aria-hidden />
          Spletna stran
        </TabsTrigger>
        <TabsTrigger value="features" className="gap-1.5">
          <SquaresFour size={16} aria-hidden />
          Funkcije
        </TabsTrigger>
        <TabsTrigger value="advanced" className="gap-1.5">
          <Wrench size={16} aria-hidden />
          Napredno
        </TabsTrigger>
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
