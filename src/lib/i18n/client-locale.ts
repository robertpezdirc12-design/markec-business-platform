"use client"

// Navor za javni kupni tok (trgovina/košarica/gift).
//
// Javne najemniške strani so ovite v PublicI18nProvider → AdminI18nProvider,
// zato imamo na voljo obstoječ `useI18n().locale`, ki je determinističen iz
// serverja (initialLocale iz getLocaleFromCookies). Ni pollinga in ni bliska
// napačnega jezika — server pravilno izriše ob prvi hidraciji.

import type { Locale } from "./config"
// T9: useI18n iz ./context (listič) — ./provider vleče celoten slovar.
import { useI18n } from "./context"

/**
 * Odjemalski jezikovni navor za javni del aplikacije. Vrne trenutni jezik
 * ("sl" | "en") iz ActiveI18nProvider-ja (server-deterministično).
 */
export function useLocale(): Locale {
  return useI18n().locale
}

/** Izberi vrednost glede na jezik: pick(locale, "slovensko", "english"). */
export function pick(locale: Locale, sl: string, en: string): string {
  return locale === "en" ? en : sl
}