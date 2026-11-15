/**
 * FAZA 2 — Tipi za verigo dokumentov (ponudba → račun → dobropis) in plačila.
 * Ogledalo statusov iz poslovne logike (prisma://Document.type/status ter
 * dokumentne verige). Ky temelj na obstoječem zrelem dokumentnem sistemu.
 */

// ============================================
// DOKUMENTNE VRSTE (razširitev Document.type)
// ============================================
export type DocumentKind = "QUOTE" | "INVOICE" | "ADVANCE" | "CREDIT"

// ============================================
// STATUSI PONUDB (F2 §2.1)
// ============================================
export type QuoteStatus =
  | "DRAFT" // osnutek — edina, ki se lahko ureja/briše
  | "SENT" // poslano stranki
  | "CONFIRMED" // potrjeno → edina, ki se lahko pretvori v račun
  | "REJECTED" // zavrnjeno (z razlogom)
  | "SUPERSEDED" // zamenjano z novejšo različico (stare ostanejo v zgodovini)

export type QuoteRejectReason =
  | "PRICE" // previsoka cena
  | "TIMING" // rok izvedbe
  | "CHANGED_MIND"
  | "OTHER"

// ============================================
// STATUSI RAČUNA (F2 §2.3)
// ============================================
export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CREDITED"
  | "CANCELLED"

// ============================================
// STATUSI PLAČILA (F2 §2.3)
// ============================================
export type PaymentStatus = "PENDING" | "RECEIVED" | "MATCHED" | "REFUNDED"

// ============================================
// VERIGA DOKUMENTOV
// ============================================
/**
 * Predstavlja eno povezavo v verigi: izvorni dokument (npr. QUOTE) →
 * izpeljani dokument (npr. INVOICE). Uporablja se za prikaz zgodovine.
 */
export interface DocumentChainLink {
  documentId: string
  kind: DocumentKind
  code: string // npr. PON-0001/2026, RAC-0001/2026
  status: string
  total: number
  issuedAt: string | null
  sourceDocumentId: string | null
}

/** Celotna veriga za en delovni nalog, od ponudbe do dobropisov. */
export interface DocumentChain {
  workOrderId: string | null
  links: DocumentChainLink[]
}

/** Vizualni opis izvora (za UI prikaz "Izhaja iz: PON-0001/2026"). */
export interface DocumentSourceInfo {
  quoteId: string | null
  invoiceId: string | null
  creditNoteIds: string[]
}