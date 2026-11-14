// ============================================================
// F5.5.4.6.2 — ADAPTER e-SLOG 2.0 (Slovenski format).
//
// OPOMBA (poštena): uradna e-SLOG 2.0 XSD ni bila dokončno preverjena v tej
// fazi (uradni vir — eslog.pisrs.si — ni bil dosegljiv). Ta adapter iz
// NEVTRALNEGA modela sestavi dobro oblikovan XML z e-SLOG 2.0-semantično
// zgradbo (UBL 2.1-temeljena), ki se kasneje zaklene na uradni XSD pred
// dejanskim pošiljanjem (B2G/UJP). Vsak izhod je determinističen.
// Obseg v tej fazi: končni račun / avans / dobropis z DDV, referencami,
// prejetimi avansi in plačilnimi sredstvi — VSE iz shranjenih vrednosti.
// ============================================================

import { EInvoiceModel } from "@/lib/einvoice/model"

function esc(s: string | number | null | undefined): string {
  if (s == null) return ""
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function amt(n: number): string {
  return n.toFixed(2)
}

const ESLOG_NS = "http://www.skrlj.si/eSlog/schema/eSlogDocument-2.0"
const UBL_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"

function party(m: EInvoiceModel, seller: boolean): string {
  const p = seller ? m.seller : m.buyer
  const uw = seller ? "AccountingSupplierParty" : "AccountingCustomerParty"
  return `  <${uw} xmlns="${esc(UBL_NS)}">
    <Party>
      <PartyIdentification>
        <ID schemeID="${esc(p.vatId ? "VAT" : p.electronicIdScheme ?? "0088")}">${esc(p.vatId ?? p.electronicId ?? p.registrationNumber ?? p.name)}</ID>
      </PartyIdentification>
      <PartyName><Name>${esc(p.legalName ?? p.name)}</Name></PartyName>
      <PostalAddress>
        <StreetName>${esc(p.street ?? "")}</StreetName>
        <CityName>${esc(p.city ?? "")}</CityName>
        <PostalZone>${esc(p.postalCode ?? "")}</PostalZone>
        <Country><IdentificationCode>${esc((p.country ?? "SI").toUpperCase())}</IdentificationCode></Country>
      </PostalAddress>
      <PartyTaxScheme>
        <CompanyID>${esc(p.vatId ?? p.taxNumber ?? "")}</CompanyID>
        <TaxScheme><ID>VAT</ID></TaxScheme>
      </PartyTaxScheme>
      <PartyLegalEntity>
        <RegistrationName>${esc(p.legalName ?? p.name)}</RegistrationName>
        <CompanyID>${esc(p.registrationNumber ?? "")}</CompanyID>
      </PartyLegalEntity>
    </Party>
  </${uw}>`
}

function totalsBlock(m: EInvoiceModel): string {
  const t = m.totals
  const subs = m.taxBreakdown
    .map(
      (b) => `      <TaxSubtotal>
        <TaxableAmount currencyID="${esc(m.currency)}">${amt(b.taxableAmount)}</TaxableAmount>
        <TaxAmount currencyID="${esc(m.currency)}">${amt(b.taxAmount)}</TaxAmount>
        <TaxCategory>
          <ID>${b.vatRate > 0 ? "S" : "Z"}</ID>
          <Percent>${amt(b.vatRate)}</Percent>
          <TaxScheme><ID>VAT</ID></TaxScheme>
        </TaxCategory>
      </TaxSubtotal>`
    )
    .join("\n")
  const prepaidAmount = m.advanceRefs && m.advanceRefs.length > 0
    ? m.advanceRefs.reduce((s, a) => s + a.amount, 0)
    : 0
  const prepaid = prepaidAmount > 0
    ? `      <PrepaidAmount currencyID="${esc(m.currency)}">${amt(prepaidAmount)}</PrepaidAmount>`
    : ""
  const payable = Math.max(0, t.totalGross - prepaidAmount)
  return `  <TaxTotal xmlns="${esc(UBL_NS)}">
    <TaxAmount currencyID="${esc(m.currency)}">${amt(t.taxTotal)}</TaxAmount>
${subs}
  </TaxTotal>
  <LegalMonetaryTotal xmlns="${esc(UBL_NS)}">
    <LineExtensionAmount currencyID="${esc(m.currency)}">${amt(t.lineExtensionNet)}</LineExtensionAmount>
    <TaxExclusiveAmount currencyID="${esc(m.currency)}">${amt(t.lineExtensionNet - t.discountAmount)}</TaxExclusiveAmount>
    <TaxInclusiveAmount currencyID="${esc(m.currency)}">${amt(t.totalGross)}</TaxInclusiveAmount>
    ${t.discountAmount > 0 ? `<AllowanceTotalAmount currencyID="${esc(m.currency)}">${amt(t.discountAmount)}</AllowanceTotalAmount>` : ""}${prepaid}
    <PayableAmount currencyID="${esc(m.currency)}">${amt(payable)}</PayableAmount>
  </LegalMonetaryTotal>`
}

function lines(m: EInvoiceModel): string {
  const tag = m.kind === "CREDIT" ? "CreditNoteLine" : "InvoiceLine"
  return m.lines
    .map(
      (l, i) => `  <${tag} xmlns="${esc(UBL_NS)}">
    <ID>${i + 1}</ID>
    <LineExtensionAmount currencyID="${esc(m.currency)}">${amt(l.taxBaseLine)}</LineExtensionAmount>
    <Item>
      <Name>${esc(l.description)}</Name>
      <ClassifiedTaxCategory>
        <ID>${l.vatRate > 0 ? "S" : "Z"}</ID>
        <Percent>${amt(l.vatRate)}</Percent>
        <TaxScheme><ID>VAT</ID></TaxScheme>
      </ClassifiedTaxCategory>
    </Item>
    <Price><PriceAmount currencyID="${esc(m.currency)}">${amt(l.taxBaseLine / Math.max(1, l.quantity))}</PriceAmount></Price>
  </${tag}>`
    )
    .join("\n")
}

/**
 * Sestavi e-SLOG 2.0-stiliziran XML (UBL 2.1-semantični) iz nevtralnega
 * modela. Ne preračunava; prepiše shranjene zneske. KONČNI/AVANS/DOBROPIS.
 */
export function buildEslog20Xml(m: EInvoiceModel): string {
  const creditRef = m.creditRef
    ? `  <BillingReference xmlns="${esc(UBL_NS)}">
      <InvoiceDocumentReference>
        <ID>${esc(m.creditRef.originalCode)}</ID>
        ${m.creditRef.reason ? `<DocumentDescription>${esc(m.creditRef.reason)}</DocumentDescription>` : ""}
      </InvoiceDocumentReference>
    </BillingReference>`
    : ""
  const pays = m.kind === "CREDIT"
    ? ""
    : m.paymentsMeans
        .map((p) => `  <PaymentMeans xmlns="${esc(UBL_NS)}">
    <ID>${esc(p.code)}</ID>
    <PaymentMeansCode>${esc(p.code)}</PaymentMeansCode>
    ${p.reference ? `<InstructionNote>${esc(p.reference)}</InstructionNote>` : ""}
  </PaymentMeans>`)
        .join("\n")
  // Avansi: predstavljeni prek preceding invoice reference (BT-17) + PrepaidAmount,
  // NIKOLI kot PaymentMeansCode (97 = Clearing between partners, ni predplačilo).
  const advanceRefs = (m.kind === "CREDIT" || !m.advanceRefs || m.advanceRefs.length === 0) ? ""
    : m.advanceRefs.map((a) => `  <BillingReference xmlns="${esc(UBL_NS)}">
    <InvoiceDocumentReference>
      <ID>${esc(a.docCode)}</ID>
      <DocumentTypeCode>386</DocumentTypeCode>
      <DocumentDescription>Avansni račun</DocumentDescription>
    </InvoiceDocumentReference>
  </BillingReference>`).join("\n")
  const buyerRef = m.buyer.buyerReference ? `  <BuyerReference xmlns="${esc(UBL_NS)}">${esc(m.buyer.buyerReference)}</BuyerReference>` : ""
  const orderRef = m.buyer.orderReference ? `  <OrderReference xmlns="${esc(UBL_NS)}"><ID>${esc(m.buyer.orderReference)}</ID></OrderReference>` : ""
  const due = m.dueDate ? `  <PaymentDueDate xmlns="${esc(UBL_NS)}">${esc(m.dueDate)}</PaymentDueDate>` : ""
  const rootEl = m.kind === "CREDIT" ? "CreditNote" : "Invoice"

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSlog xmlns="${esc(ESLOG_NS)}" generatedBy="MARKEC">
  <${rootEl} xmlns="${esc(UBL_NS)}">
    <ID>${esc(m.docCode)}</ID>
    <IssueDate>${esc(m.issueDate)}</IssueDate>
    ${due}
    <DocumentCurrencyCode>${esc(m.currency)}</DocumentCurrencyCode>
    <InvoiceTypeCode>${m.invoiceTypeCode}</InvoiceTypeCode>
    ${buyerRef}
    ${orderRef}
    ${creditRef}
    ${advanceRefs}
    ${party(m, true)}
    ${party(m, false)}
    ${pays}
    ${totalsBlock(m)}
${lines(m)}
  </${rootEl}>
</eSlog>`
}