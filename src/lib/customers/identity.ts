// ============================================================
// F5.5.3.1 — ENOTEN ORG-SCOPED IDENTITY RESOLVER za stranke.
//
// Uporabljen za vse vire nastajanja strank (rezervacija gosta,
// naročilo, obrazec/povpraševanje, walk-in, ročni vnos) — ena
// politika, ena testna matrika, brez ad-hoc email/OR pedov.
//
// Pravila (na podlagi P2 #70 «guest-identity.ts», razširjeno):
//   1. E-pošta (neobčutljivo na velike črke) je NEDVOMNA identiteta —
//      povezava ali novo-iskanje gre po njej, kadar je prisotna.
//   2. Telefonska številka SAMA NI dovolj za prevzem identitete
//      (gospodinjski/skupni telefon, reciklirana številka) — telefon
//      povezuje obstoječo stranko LE, če se ujema tudi ime (normalizirano)
//      in (stranka nima emaila ALI se emaila ujemata).
//   3. Nikoli se ne združuje po podobnem imenu ali približnem telefonu.
//   4. Vrni `{ matched: false }` namesto tihega pisanja (brez zapisa, brez
//      prepisa imena/e-pošte iz kontakta v obstoječo stranko).
//
// Čista logika (brez prisma) — enotsko testirana. Prisma dostop ostane v
// akcijah (»use server«).
// ============================================================

/** Normalizacija e-pošte: male črke, stisnjen presledek. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Normalizacija imena za primerjavo: male črke, stisnjeni presledki. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Normalizacija telefona za primerjavo: odstranimo praznine, - , ( , ). */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-()]/g, "")
}

export interface CustomerIdentityRow {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export interface ContactIdentityInput {
  name?: string | null
  email?: string | null
  phone?: string | null
}

export type IdentityResolution =
  | { matched: true; customerId: string; by: "email" | "phone" }
  | { matched: false }

/**
 * Presodi, ali dani kontakt ustreza obstoječi stranki, po enotni politiki.
 * `existing` mora biti že ORG-SCOPED (klicatelj jo je našel znotraj org).
 */
export function resolveCustomerIdentity(
  existing: CustomerIdentityRow,
  contact: ContactIdentityInput
): IdentityResolution {
  const email = normalizeEmail(contact.email || "")
  const phone = normalizePhone(contact.phone || "")
  const contactName = normalizeName(contact.name || "")

  // 1) E-pošta = identiteta (neobčutljivo).
  if (email && existing.email) {
    if (normalizeEmail(existing.email) === email) {
      return { matched: true, customerId: existing.id, by: "email" }
    }
    // E-pošta kontakta NE ustreza obstoječi — telefon ne more prevzeti
    // identitete oseb, ki upravlja drug e-poštni naslov.
    return { matched: false }
  }

  // 2) Telefon: samo ob ujemanju imena + veljavnih email-razmerij.
  if (phone && existing.phone) {
    const phoneOk = normalizePhone(existing.phone) === phone
    if (phoneOk && contactName && contactName === normalizeName(existing.name)) {
      // Stranka brez e-pošte na zapisu: ime + telefon zadoščata.
      if (!existing.email) {
        return { matched: true, customerId: existing.id, by: "phone" }
      }
      // Prijavljena čista politika: če ima obstoječa stranka email, mora
      // kontaktni email ustrezati (email=null pa dovoljuje telefon+ime).
      if (!email) {
        return { matched: true, customerId: existing.id, by: "phone" }
      }
    }
  }

  return { matched: false }
}

/**
 * Kateri kandidat v seznamu že ustreza kontaktu? Vrne prvi zadetek
 * (email ima prednost; preferira is-published/običajno vrstico).
 * Seznam mora biti ORG-SCOPED. Za dedup nove vrstice.
 */
export function pickIdentityMatch(
  candidates: CustomerIdentityRow[],
  contact: ContactIdentityInput
): CustomerIdentityRow | null {
  for (const row of candidates) {
    const res = resolveCustomerIdentity(row, contact)
    if (res.matched) return row
  }
  return null
}