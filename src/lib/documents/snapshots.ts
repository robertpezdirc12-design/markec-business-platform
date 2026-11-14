// ============================================================
// F5.5.4.1 — POSNETKI (SNAPSHOT) IZDAJATELJA IN STRANKE.
//
// Ob izdaji dokumenta se zbere nespremenljiv posnetek izdajatelja
// (SalonConfig) in stranke (Customer). Po tem prikaz izdanega dokumenta
// NIKOLI ne bere živih podatkov — le teh JSON-ov. Sprememba podatkov
// stranke/salona pozneje ne spremeni že izdanega računa.
// ============================================================

export interface IssuerSnapshot {
  name: string
  street?: string | null
  city?: string | null
  zip?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
  vatId?: string | null
  isVatRegistered: boolean
  registrationNumber?: string | null
  bankAccount?: string | null
  currency: string
}

export interface CustomerSnapshot {
  name: string
  email?: string | null
  phone?: string | null
  // F5.5.4.6.2 — podatki kupca za e-račun (zamrznjeni ob izdaji).
  customerType?: string | null
  legalName?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  taxNumber?: string | null
  vatId?: string | null
  registrationNumber?: string | null
  electronicId?: string | null
  electronicIdScheme?: string | null
  buyerReference?: string | null
  orderReference?: string | null
}

export type IssuerSource = {
  name: string
  street?: string | null
  city?: string | null
  zip?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
  vatId?: string | null
  isVatRegistered?: boolean
  registrationNumber?: string | null
  bankAccount?: string | null
  currency?: string
}

export type CustomerSource = {
  name: string
  email?: string | null
  phone?: string | null
  // F5.5.4.6.2 — kupčevi podatki za e-račun (optional; zapolnijo se le ob e-računih).
  customerType?: string | null
  legalName?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  taxNumber?: string | null
  vatId?: string | null
  registrationNumber?: string | null
  electronicId?: string | null
  electronicIdScheme?: string | null
  buyerReference?: string | null
  orderReference?: string | null
}

export function buildIssuerSnapshot(issuer: IssuerSource): IssuerSnapshot {
  return {
    name: issuer.name,
    street: issuer.street ?? null,
    city: issuer.city ?? null,
    zip: issuer.zip ?? null,
    country: issuer.country ?? null,
    email: issuer.email ?? null,
    phone: issuer.phone ?? null,
    vatId: issuer.vatId ?? null,
    isVatRegistered: issuer.isVatRegistered === true,
    registrationNumber: issuer.registrationNumber ?? null,
    bankAccount: issuer.bankAccount ?? null,
    currency: issuer.currency ?? "EUR",
  }
}

export function buildCustomerSnapshot(c: CustomerSource): CustomerSnapshot {
  return {
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    // F5.5.4.6.2 — vse zamrznjeno v snapshot ob izdaji.
    customerType: c.customerType ?? null,
    legalName: c.legalName ?? null,
    street: c.street ?? null,
    postalCode: c.postalCode ?? null,
    city: c.city ?? null,
    country: c.country ?? null,
    taxNumber: c.taxNumber ?? null,
    vatId: c.vatId ?? null,
    registrationNumber: c.registrationNumber ?? null,
    electronicId: c.electronicId ?? null,
    electronicIdScheme: c.electronicIdScheme ?? null,
    buyerReference: c.buyerReference ?? null,
    orderReference: c.orderReference ?? null,
  }
}

export function customerNameFromSnapshot(snap: unknown): string | null {
  if (!snap || typeof snap !== "object") return null
  const s = snap as Record<string, unknown>
  return typeof s.name === "string" ? s.name : null
}