/**
 * Ali je e-poštni servis (Resend) dejansko konfiguriran? Brez API ključa
 * pošiljanje tiho odpove — klicatelj mora takrat pokazati alternativo
 * (npr. verifikacijsko povezavo direktno v UI), sicer uporabnik ostane
 * brez dostopa (E2E najdena luknja).
 *
 * Izvlečeno iz server action modula: v "use server" datoteki smejo biti
 * izvožene samo async funkcije, to pa je čisti sinhroni helper (testabilen).
 */
export function isEmailServiceConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const key = env.RESEND_API_KEY?.trim()
  return !!key && !key.startsWith("re_placeholder")
}

/**
 * Validirana pošiljateljska konfiguracija za en klic `resend.emails.send`.
 *
 * `null` pomeni, da se klic NE SME zgoditi: brez tega guarda pošiljatelji
 * pošljejo placeholder ključ (Resend 401) ali `from: undefined`. Preveri
 * hkrati API ključ IN pošiljateljski naslov, zato je to edini pravilni
 * vstopni guard za vse senderje v `src/lib/email/`.
 */
export interface EmailConfig {
  from: string
}

export function getEmailConfig(
  env: Record<string, string | undefined> = process.env
): EmailConfig | null {
  if (!isEmailServiceConfigured(env)) return null
  const from = env.RESEND_FROM_EMAIL?.trim()
  if (!from) return null
  return { from }
}
