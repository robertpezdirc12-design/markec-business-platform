"use client"

// T9 (bundle 2026-11): ADMIN provider — celoten slovar (dictionaries.ts).
// Kontekst + logika živita v ./context (BaseI18nProvider); ta wrapper samo
// poda admin slovarski modul. Javno drevo uporablja provider-public.tsx
// z javno podmnožico (dictionaries-public.ts) — tako admin slovarji
// (settings 62 KB, dashboard, catalog-docs …) ne potujejo na javne strani.

import { BaseI18nProvider, type BaseI18nProviderProps } from "./context"
import { getDictionary } from "./dictionaries"

type AdminI18nProviderProps = Omit<BaseI18nProviderProps, "getDict">

export function AdminI18nProvider(props: AdminI18nProviderProps) {
  return <BaseI18nProvider {...props} getDict={getDictionary} />
}

export { useI18n } from "./context"
export { localeLabels, locales } from "./config"
