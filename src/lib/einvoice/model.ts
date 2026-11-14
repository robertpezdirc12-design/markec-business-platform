// ============================================================
// F5.5.4.6.2 — NEVTRALNI SEMANTIČNI MODEL E-RAČUNA.
//
// Skupni vmesni zapis, iz katerega nastanejo različni tehnični formati
// (e-SLOG 2.0, UBL 2.1 / PEPPOL BIS 3.0.x, kasneje CII...). Eksporter
// NIKOLI ne preračunava DDV/popustov/nekaterih prehodov — bere NESPRE-
// MENLJIVO shranjene vrednosti obstoječega dokumentnega sistema
// (Document.taxBase/taxTotal/total, DocumentItem.taxBaseLine/vatAmount/
// vatRate/total, CreditNote.amount/taxBase/taxTotal).
// ============================================================

export type EInvoiceKind = "INVOICE" | "ADVANCE" | "CREDIT"
export type EInvoiceFormat = "ESLOG_2" | "UBL21_PEPPOL_3"

export interface EInvoiceParty {
  name: string
  legalName?: string | null
  vatId?: string | null // SI-davčno (DDV)
  taxNumber?: string | null // druga davčna številka
  registrationNumber?: string | null // matična
  electronicId?: string | null
  electronicIdScheme?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null // ISO alpha-2
  email?: string | null
  bankAccount?: string | null // IBAN (izdajatelj)
  buyerReference?: string | null // referenca kupca
  orderReference?: string | null // referenca naročila
}

export interface EInvoiceLine {
  id: string
  description: string
  quantity: number
  unitPriceNet: number // iz DocumentItem (neto — taxBaseLine/qty)
  discountPercent: number
  vatRate: number
  taxBaseLine: number // neto osnova linije
  vatAmount: number // DDV linije
  totalGross: number // bruto linija (z DDV)
  catalogRef?: string | null
}

export interface EInvoiceTaxBreakdown {
  vatRate: number
  taxableAmount: number // neto
  taxAmount: number // DDV
}

export interface EInvoiceTotals {
  lineExtensionNet: number // Σ taxBaseLine
  discountAmount: number
  taxTotal: number
  totalGross: number // == Document.total
  paidAmount: number
  creditedTotal: number
  advanceTotal: number
  openAmount: number
  currency: string
}

export interface EInvoiceModel {
  kind: EInvoiceKind
  docCode: string
  documentId: string
  fiscalYear: number
  number: number
  issueDate: string // YYYY-MM-DD
  issueDateIso: string
  dueDate: string | null
  serviceDate: string | null
  servicePeriod: string | null
  invoiceTypeCode: number // 380 | 386 | ...  (za končni/avans) ali creditNoteTypeCode 381
  vatEnabled: boolean
  currency: string
  seller: EInvoiceParty
  buyer: EInvoiceParty
  lines: EInvoiceLine[]
  taxBreakdown: EInvoiceTaxBreakdown[]
  totals: EInvoiceTotals
  paymentsMeans: { code: string; method: string; reference?: string | null }[]
  advanceRefs?: { docCode: string; amount: number }[]
  creditRef?: { originalCode: string; reason?: string | null } | null
  note?: string | null
}

/** Preslikava DocumentPayment.method → UNCL 4461 (PaymentMeansCode) za UBL. */
export function paymentMeansCode(method: string | null | undefined): string {
  switch (method) {
    case "cash": return "10"       // 10 = In cash
    case "transfer": return "30"   // 30 = Credit transfer
    case "card": return "54"       // 54 = Credit card
    case "online": return "30"     // online plačila (Stripe) ≈ kreditni transfer
    case "giftcard": return ""     // ni veljavne UNCL 4461 kode za bonus kartico → izpusti
    case "advance": return ""      // AVANS NI PaymentMeansCode: UNCL 4461 97 = Clearing between
                                   // partners, NE predplačilo. Avans → PrepaidAmount + BillingReference.
    default: return ""
  }
}