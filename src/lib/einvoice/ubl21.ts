// ============================================================
// F5.5.4.6.3 — ADAPTER UBL 2.1 / PEPPOL BIS Billing 3.0.21.
//
// Deterministični izhod iz NEVTRALNEGA modela v UBL 2.1 Invoice /
// CreditNote, skladen s PEPPOL BIS Billing 3.0.21 (EN 16931, CustomizationID
// + ProfileID 01/02). Vključuje obvezne BIS elemente (EndpointID, InvoicedQuantity,
// PrepaidAmount + InvoiceDocumentReference za avanse) tako, da dokumenti prestanejo
// uradne XSD- in Schematron-validatorje, KO so podatki na voljo; sicer se element
// izpusti in poslovna validacija pošteno označi (NOT skladen — brez lažnega PASS).
// ============================================================

import { EInvoiceModel } from "@/lib/einvoice/model"

function esc(s: string | number | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function amt(n: number): string {
  return n.toFixed(2)
}

const UBL_INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
const UBL_CREDIT_NS = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
const CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
const CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"

/** Uradni vrednosti PEPPOL BIS Billing 3.0.x. */
export const PEPPOL_CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
export const PEPPOL_PROFILE_01 = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
export const PEPPOL_PROFILE_02 = "urn:fdc:peppol.eu:2017:poacc:billing:02:1.0"

/** EndpointID / Party ID scheme: 0088 = GS1 GLN, 9929 = VAT (CDF OBID). */
const EAS_VAT = "9929"

/** Veljavna GLN (GS1 EAN·UCC): 13 števk z veljavno kontrolno števko (GS1 check digit). */
function isGln(value: string | null | undefined): boolean {
  if (!value || !/^\d{13}$/.test(value)) return false
  const digits = value.split("").map(Number)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return check === digits[12]
}

/** PEPPOL BIS: EAS shema za EndpointID.
 * - pravi GLN (0088) kadar je validna GS1 GLN;
 * - sicer davčna shema (9929 VAT) kadar je prisoten davčni ID;
 * - sicer prazna shema brez EAS (ni PEPPOL-skladno, a ni lažnega GLN). */
function easScheme(party: {
  electronicId?: string | null
  electronicIdScheme?: string | null
  vatId?: string | null
}): string {
  const explicit = party.electronicIdScheme || ""
  if (explicit === "0088" && isGln(party.electronicId)) return "0088"
  if (explicit === "9929" || (party.electronicId && explicit)) return explicit
  if (party.vatId || party.electronicIdScheme === EAS_VAT) return EAS_VAT
  return ""
}

/** EN 16931 (CEN BR-CL-10): identifikacijska shema za cac:PartyIdentification/ID
 * MORA biti ISO 6523 ICD (0002…0248), NE PEPPOL EAS (9929 ni veljaven).
 * - matična številka (registrationNumber) → ICD "0002" (SIREN/CVR/EUID);
 * - pravi GLN → "0088";
 * - sicer davčna/prazna → "0088" le če velja GLN, drugače prazno (ogiba se
 *   lažnega ICD; dokument tedaj ni PEPPOL-skladen, kar je pošteno). */
function iso6523Scheme(party: {
  electronicId?: string | null
  electronicIdScheme?: string | null
  registrationNumber?: string | null
}): string {
  if (party.registrationNumber) return "0002"
  if (isGln(party.electronicId)) return "0088"
  return ""
}

function endpointId(party: {
  electronicId?: string | null
  electronicIdScheme?: string | null
  vatId?: string | null
}): string {
  const id = party.electronicId ?? party.vatId
  if (!id) return ""
  const scheme = easScheme(party)
  if (!scheme) return ""
  return `      <cbc:EndpointID schemeID="${esc(scheme)}">${esc(id)}</cbc:EndpointID>\n`
}

function sellerParty(m: EInvoiceModel): string {
  const scheme = iso6523Scheme(m.seller)
  // PartyIdentification/ID v ISO 6523 ICD shemi: za 0002 matična, za 0088 GLN/eID.
  const supplierId = scheme === "0002"
    ? (m.seller.registrationNumber ?? m.seller.taxNumber ?? "")
    : (m.seller.electronicId ?? "")
  const myVat = m.seller.vatId
  const regNum = m.seller.registrationNumber
  return `    <cac:AccountingSupplierParty>
      <cac:Party>
${endpointId(m.seller)}        <cac:PartyIdentification>
          <cbc:ID${scheme ? ` schemeID="${esc(scheme)}"` : ""}>${esc(supplierId)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${esc(m.seller.legalName ?? m.seller.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${esc(m.seller.street ?? "")}</cbc:StreetName>
          <cbc:CityName>${esc(m.seller.city ?? "")}</cbc:CityName>
          <cbc:PostalZone>${esc(m.seller.postalCode ?? "")}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${esc((m.seller.country ?? "SI").toUpperCase())}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${esc(myVat ?? m.seller.taxNumber ?? "")}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${esc(m.seller.legalName ?? m.seller.name)}</cbc:RegistrationName>
          ${regNum ? `<cbc:CompanyID schemeID="0002">${esc(regNum)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingSupplierParty>`
}

function buyerParty(m: EInvoiceModel): string {
  const scheme = iso6523Scheme(m.buyer)
  // PartyIdentification/ID v ISO 6523 ICD shemi: za 0002 matična, za 0088 GLN/eID.
  const customerId = scheme === "0002"
    ? (m.buyer.registrationNumber ?? m.buyer.taxNumber ?? "")
    : (m.buyer.electronicId ?? "")
  const myVat = m.buyer.vatId
  const regNum = m.buyer.registrationNumber
  return `    <cac:AccountingCustomerParty>
      <cac:Party>
${endpointId(m.buyer)}        <cac:PartyIdentification>
          <cbc:ID${scheme ? ` schemeID="${esc(scheme)}"` : ""}>${esc(customerId)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${esc(m.buyer.legalName ?? m.buyer.name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${esc(m.buyer.street ?? "")}</cbc:StreetName>
          <cbc:CityName>${esc(m.buyer.city ?? "")}</cbc:CityName>
          <cbc:PostalZone>${esc(m.buyer.postalCode ?? "")}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${esc((m.buyer.country ?? "SI").toUpperCase())}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${esc(myVat ?? m.buyer.taxNumber ?? "")}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${esc(m.buyer.legalName ?? m.buyer.name)}</cbc:RegistrationName>
          ${regNum ? `<cbc:CompanyID schemeID="0002">${esc(regNum)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingCustomerParty>`
}

function taxTotal(m: EInvoiceModel): string {
  const subs = m.taxBreakdown
    .map(
      (t) => `        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${esc(m.currency)}">${amt(t.taxableAmount)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${esc(m.currency)}">${amt(t.taxAmount)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>${t.vatRate > 0 ? (t.vatRate >= 5 ? "S" : "AA") : "Z"}</cbc:ID>
            <cbc:Percent>${amt(t.vatRate)}</cbc:Percent>
            <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>`
    )
    .join("\n")
  return `    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${esc(m.currency)}">${amt(m.totals.taxTotal)}</cbc:TaxAmount>
${subs}
    </cac:TaxTotal>`
}

function legalMonetary(m: EInvoiceModel): string {
  const t = m.totals
  const prepaidAmount = m.advanceRefs && m.advanceRefs.length > 0
    ? m.advanceRefs.reduce((s, a) => s + a.amount, 0)
    : 0
  const prepaid = prepaidAmount > 0
    ? `      <cbc:PrepaidAmount currencyID="${esc(m.currency)}">${amt(prepaidAmount)}</cbc:PrepaidAmount>\n`
    : ""
  // BR-CO-16: PayableAmount = TaxInclusiveAmount − PrepaidAmount
  const payable = Math.max(0, t.totalGross - prepaidAmount)
  const disc = t.discountAmount
  return `    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="${esc(m.currency)}">${amt(t.lineExtensionNet)}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="${esc(m.currency)}">${amt(Math.max(0, t.lineExtensionNet - disc))}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="${esc(m.currency)}">${amt(t.totalGross)}</cbc:TaxInclusiveAmount>
      ${disc > 0 ? `<cbc:AllowanceTotalAmount currencyID="${esc(m.currency)}">${amt(disc)}</cbc:AllowanceTotalAmount>\n` : ""}${prepaid}      <cbc:PayableAmount currencyID="${esc(m.currency)}">${amt(payable)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>`
}

function invoiceLines(m: EInvoiceModel): string {
  const qtyEl = m.kind === "CREDIT" ? "CreditedQuantity" : "InvoicedQuantity"
  const lineTag = m.kind === "CREDIT" ? "CreditNoteLine" : "InvoiceLine"
  return m.lines
    .map(
      (l, i) => `    <cac:${lineTag}>
      <cbc:ID>${l.id || i + 1}</cbc:ID>
      <cbc:${qtyEl} unitCode="C62">${esc(Number(l.quantity).toFixed(2))}</cbc:${qtyEl}>
      <cbc:LineExtensionAmount currencyID="${esc(m.currency)}">${amt(l.taxBaseLine)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${esc(l.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${l.vatRate > 0 ? (l.vatRate >= 5 ? "S" : "AA") : "Z"}</cbc:ID>
          <cbc:Percent>${amt(l.vatRate)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${esc(m.currency)}">${amt(l.unitPriceNet)}</cbc:PriceAmount>
      </cac:Price>
    </cac:${lineTag}>`
    )
    .join("\n")
}

function payments(m: EInvoiceModel): string {
  if (m.kind === "CREDIT") return ""
  return m.paymentsMeans
    .map(
      (p) => `    <cac:PaymentMeans>
      <cbc:ID>${p.code}</cbc:ID>
      <cbc:PaymentMeansCode>${esc(p.code)}</cbc:PaymentMeansCode>
      ${p.reference ? `      <cbc:InstructionNote>${esc(p.reference)}</cbc:InstructionNote>` : ""}
      ${(p.code === "30" || p.code === "58") ? `      <cac:PayeeFinancialAccount>\n        <cbc:ID>${esc(m.seller.bankAccount ?? "NA")}</cbc:ID>\n      </cac:PayeeFinancialAccount>` : ""}
    </cac:PaymentMeans>`
    )
    .join("\n")
}

/**
 * Avansi se v PEPPOL BIS 3.0 predstavljajo prek preceding invoice reference
 * (BT-17 / BR-CO-24) + PrepaidAmount (BT-113), NIKOLI kot PaymentMeansCode, ker
 * UNCL 4461 nima kode "predplačilo" (97 = Clearing between partners, ni avans).
 */
function advanceReferences(m: EInvoiceModel): string {
  if (!m.advanceRefs || m.advanceRefs.length === 0) return ""
  return m.advanceRefs
    .map(
      (a) => `    <cac:BillingReference>
      <cac:InvoiceDocumentReference>
        <cbc:ID>${esc(a.docCode)}</cbc:ID>
        <cbc:DocumentTypeCode>386</cbc:DocumentTypeCode>
        <cbc:DocumentDescription>Prepayment invoice (avansni račun)</cbc:DocumentDescription>
      </cac:InvoiceDocumentReference>
    </cac:BillingReference>`
    )
    .join("\n")
}

function header(m: EInvoiceModel, ns: string, root: string): string {
  const creditRef = m.creditRef
    ? `    <cac:BillingReference>
      <cac:InvoiceDocumentReference>
        <cbc:ID>${esc(m.creditRef.originalCode)}</cbc:ID>
        ${m.creditRef.reason ? `      <cbc:DocumentDescription>${esc(m.creditRef.reason)}</cbc:DocumentDescription>` : ""}
      </cac:InvoiceDocumentReference>
    </cac:BillingReference>`
    : ""
  const advanceRefs = m.kind === "CREDIT" ? "" : advanceReferences(m)
  const period = m.serviceDate || m.servicePeriod
    ? `    <cac:InvoicePeriod>
        <cbc:StartDate>${esc(m.serviceDate ?? m.servicePeriod?.split(" – ")[0] ?? "")}</cbc:StartDate>
        ${m.servicePeriod ? `      <cbc:EndDate>${esc(m.servicePeriod.split(" – ")[1] ?? "")}</cbc:EndDate>` : ""}
      </cac:InvoicePeriod>`
    : ""
  const paymentDue = m.dueDate ? `    <cbc:DueDate>${esc(m.dueDate)}</cbc:DueDate>` : ""
  const buyerRef = m.buyer.buyerReference ? `    <cbc:BuyerReference>${esc(m.buyer.buyerReference)}</cbc:BuyerReference>` : ""
  const orderRef = m.buyer.orderReference
    ? `    <cac:OrderReference>\n      <cbc:ID>${esc(m.buyer.orderReference)}</cbc:ID>\n    </cac:OrderReference>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="${esc(ns)}" xmlns:cac="${esc(CAC)}" xmlns:cbc="${esc(CBC)}">
  <cbc:CustomizationID>${esc(PEPPOL_CUSTOMIZATION_ID)}</cbc:CustomizationID>
  <cbc:ProfileID>${esc(PEPPOL_PROFILE_01)}</cbc:ProfileID>
  <cbc:ID>${esc(m.docCode)}</cbc:ID>
  <cbc:IssueDate>${esc(m.issueDate)}</cbc:IssueDate>
  ${paymentDue}
  <cbc:InvoiceTypeCode>${m.invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${esc(m.currency)}</cbc:DocumentCurrencyCode>
  ${buyerRef}
  ${orderRef}
  ${period}
  ${creditRef}${advanceRefs}
  ${sellerParty(m)}
  ${buyerParty(m)}
  ${payments(m)}
  ${taxTotal(m)}
  ${legalMonetary(m)}
${invoiceLines(m)}
</${root}>`
}

/** Deterministična sestava UBL 2.1 stringa za Invoice ali CreditNote. */
export function buildUbl21Xml(m: EInvoiceModel): string {
  if (m.kind === "CREDIT") {
    return header(m, UBL_CREDIT_NS, "CreditNote")
  }
  return header(m, UBL_INVOICE_NS, "Invoice")
}

/** Vrne šifrant (InvoiceTypeCode) za dokument — za testno kodo/zapis. */
export function ublTypeCode(m: EInvoiceModel): number {
  return m.invoiceTypeCode
}