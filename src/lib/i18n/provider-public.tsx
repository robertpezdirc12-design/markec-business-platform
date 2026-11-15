"use client"

// T9 (bundle 2026-11): JAVNI provider — samo javna podmnožica slovarjev
// (dictionaries-public.ts: common/public/landing/auth/booking/orders/
// categories/promotions). Admin slovarji (settings 62 KB …) ostanejo
// izven client bundleja javnih strani. Kontekst je skupen z admin
// providerjem (./context) — useI18n deluje v obeh drevesih.

import { BaseI18nProvider, type BaseI18nProviderProps } from "./context"
import { getPublicDictionary } from "./dictionaries-public"

type PublicI18nProviderProps = Omit<BaseI18nProviderProps, "getDict">

export function PublicI18nProviderClient(props: PublicI18nProviderProps) {
  return <BaseI18nProvider {...props} getDict={getPublicDictionary} />
}

export { useI18n } from "./context"
