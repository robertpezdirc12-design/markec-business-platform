/**
 * Ali je e-poštni servis (Resend) dejansko konfiguriran? Brez API ključa
 * pošiljanje tiho odpove — klicatelj mora takrat pokazati alternativo
 * (npr. verifikacijsko povezavo direktno v UI), sicer uporabnik ostane
 * brez dostopa (E2E najdena luknja).
 *
 * Izvlečeno iz server action modula: v "use server" datoteki smejo biti
 * izvožene samo async funkcije, to pa je čisti sinhroni helper (testabilen).
 */
/**
 * Ali smemo uporabniku POKAZATI potrditveno povezavo namesto e-pošte?
 *
 * Fallback je nujen, dokler e-poštni servis ni nastavljen (drugače se nov
 * uporabnik ne more potrditi). Istočasno je varnostno občutljiv: kdor vidi
 * žeton, lahko potrdi račun brez dostopa do poštnega nabiralnika.
 *
 * Zato: privzeto dovoljeno SAMO izven produkcije; v produkciji le z
 * eksplicitno zastavico EMAIL_VERIFICATION_FALLBACK=1 (dokler ni Resend
 * ključa). Ko je e-pošta nastavljena, zastavico odstranite.
 */
export function allowVerificationFallback(
  env: Record<string, string | undefined> = process.env
): boolean {
  const flag = env.EMAIL_VERIFICATION_FALLBACK?.trim().toLowerCase()
  if (flag === "0" || flag === "false" || flag === "off") return false
  if (flag === "1" || flag === "true" || flag === "on") return true
  return env.NODE_ENV !== "production"
}

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
