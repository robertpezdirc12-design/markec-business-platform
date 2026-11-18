/**
 * P0 (audit 2026-11) — VEZAVA NAJEMNIKA NA STRIPE WEBHOOK.
 *
 * Večnajemniška postavitev: vsak salon vpiše ISTO končno točko v SVOJ Stripe
 * račun, zato ima vsaka organizacija svojo `whsec_` skrivnost. Webhook zato
 * preizkusi vse shranjene skrivnosti — a mora nato VEDETI, KATERA je uspela.
 *
 * Napaka, ki jo ta modul preprečuje: prej je verifikacija vrnila samo dogodek,
 * najemnik pa se je določil iz `metadata.orgId` (podatek, ki ga nadzoruje
 * pošiljatelj). Najemnik, ki pozna svojo skrivnost, je lahko podpisal
 * poljuben payload in v metadata zapisal ŽRTEV → preklic tujega naročila,
 * potrditev tujega termina brez plačila.
 *
 * Pravilo: podpis je edini vir resnice. `metadata.orgId` je samo TRDITEV, ki
 * mora soglašati s podpisom; neskladje pomeni zavrnitev dostave (fail-closed).
 * Odsotnost trditve ni napaka — starejše seje je niso imele.
 */

/** Prebere `metadata.orgId` iz objekta dogodka (checkout seja, plačilo …). */
export function extractClaimedOrgId(object: unknown): string | null {
  if (!object || typeof object !== "object") return null
  const metadata = (object as { metadata?: unknown }).metadata
  if (!metadata || typeof metadata !== "object") return null
  const claimed = (metadata as Record<string, unknown>).orgId
  return typeof claimed === "string" && claimed.length > 0 ? claimed : null
}

export type TenantBinding =
  | { ok: true; claimed: string | null }
  | { ok: false; reason: "org_mismatch"; claimed: string }

/**
 * Preveri, ali dostava sme posegati v podatke podpisane organizacije.
 *
 * @param claimedOrgId  vrednost iz metadata (lahko null)
 * @param signedOrgId   organizacija, katere skrivnost je podpisala dostavo
 */
export function checkTenantBinding(
  claimedOrgId: string | null,
  signedOrgId: string
): TenantBinding {
  if (claimedOrgId && claimedOrgId !== signedOrgId) {
    return { ok: false, reason: "org_mismatch", claimed: claimedOrgId }
  }
  return { ok: true, claimed: claimedOrgId }
}
