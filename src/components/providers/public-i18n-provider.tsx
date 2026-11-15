import { getLocaleFromCookies } from "@/lib/i18n/server"
import { PublicI18nProviderClient } from "@/lib/i18n/provider-public"

/**
 * i18n za javne najemniške strani (P1): enak cookie in slovar kot
 * nadzorna plošča — jezikovni preklopnik v navbarju deluje takoj.
 * Profil dejavnosti omogoča tudi terminologijo po panogi (term()).
 *
 * T9 (bundle 2026-11): server wrapper prebere locale iz cookieja in
 * renderira CLIENT PublicI18nProviderClient, ki uporablja samo JAVNO
 * podmnožico slovarjev (dictionaries-public.ts) — admin slovarji
 * (256 KB) ne potujejo več v client bundle javnih strani.
 */
export async function PublicI18nProvider({
  org,
  children,
}: {
  org?: {
    vertical?: string | null
    secondaryVertical?: string | null
    profileOverrides?: unknown
  } | null
  children: React.ReactNode
}) {
  const locale = await getLocaleFromCookies()

  return (
    <PublicI18nProviderClient
      initialLocale={locale}
      profileId={org?.vertical ?? undefined}
      secondaryVertical={org?.secondaryVertical ?? null}
      profileOverrides={org?.profileOverrides}
    >
      {children}
    </PublicI18nProviderClient>
  )
}
