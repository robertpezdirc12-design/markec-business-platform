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

/** EndpointID / Party ID scheme: 0088 = GS1 GLN (EAS; veljavno za B2B v PEPPOL). */
const EAS_SI = "0088"

function endpointId(party: { electronicId?: string | null; electronicIdScheme?: string | null }): string {
  const id = party.electronicId
  if (!id) return ""
  const scheme = party.electronicIdScheme || EAS_SI
  return `      <cbc:EndpointID schemeID="${esc(scheme)}">${esc(id)}</cbc:EndpointID>\n`
}

function sellerParty(m: EInvoiceModel): string {
  const supplierId = m.seller.vatId ?? m.seller.electronicId ?? m.seller.registrationNumber ?? m.seller.name
  const myVat = m.seller.vatId
  return `    <cac:AccountingSupplierParty>
      <cac:Party>
${endpointId(m.seller)}        <cac:PartyIdentification>
          <cbc:ID schemeID="${esc(m.seller.electronicIdScheme ?? EAS_SI)}">${esc(supplierId)}</cbc:ID>
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
          <cbc:CompanyID schemeID="0002">${esc(m.seller.registrationNumber ?? "")}</cbc:CompanyID>
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingSupplierParty>`
}

function buyerParty(m: EInvoiceModel): string {
  const customerId = m.buyer.electronicId ?? m.buyer.vatId ?? m.buyer.buyerReference ?? m.buyer.name
  const myVat = m.buyer.vatId
  return `    <cac:AccountingCustomerParty>
      <cac:Party>
${endpointId(m.buyer)}        <cac:PartyIdentification>
          <cbc:ID schemeID="${esc(m.buyer.electronicIdScheme ?? (m.buyer.vatId ? EAS_SI : EAS_SI))}">${esc(customerId)}</cbc:ID>
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
          <cbc:CompanyID schemeID="0002">${esc(m.buyer.registrationNumber ?? "")}</cbc:CompanyID>
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
  const paymentDue = m.dueDate ? `    <cbc:PaymentDueDate>${esc(m.dueDate)}</cbc:PaymentDueDate>` : ""
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
  <cac:AccountingSupplierParty>${sellerParty(m)}</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${buyerParty(m)}</cac:AccountingCustomerParty>
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