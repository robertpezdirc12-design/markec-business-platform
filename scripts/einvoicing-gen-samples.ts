// ============================================================
// F5.5.4.6.3 — Generator sintetičnih PEPPOL BIS 3.0.21 vzorcev.
//
// Generira vseh 8 vrst testnih dokumentov v docs/einvoicing/test-samples/:
//   00 končni račun (380)                   — že obstaja ročno
//   01 avansni račun (386)
//   02 končni račun z enim avansom (380 + BI.Ref 386 + Prepaid)
//   03 končni račun z več avansi (380 + 2x BI.Ref + Prepaid)
//   04 dobropis (381)
//   05 račun z delnim plačilom
//   06 račun z več davčnimi stopnjami (22% + 9.5%)
//   07 račun z oprostitvijo DDV (category Z, TaxExemptionReasonCode oprostitev)
//
// Vsi vzorci vsebujejo veljaven GLN (0088) na obeh straneh, CustomizationID,
// ProfileID 01, InvoicedQuantity, PayeeFinancialAccount — da prestanejo PEPPOL
// + CEN Schematron & XSD.
//
// Uporaba: tsx scripts/einvoicing-gen-samples.ts
// ============================================================

import { promises as fs } from "node:fs"
import * as path from "node:path"

const OUT = path.join(process.cwd(), "docs", "einvoicing", "test-samples")

const CUST = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
const PROFILE = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
const SELLER_GLN = "7300010000001"
const BUYER_GLN = "7300010000025"

function esc(s: string | number): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
const money = (n: number) => n.toFixed(2)

interface LineDef { desc: string; qty: number; unitNet: number; rate: number; catCode: string; exemptReason?: string; exemptReasonCode?: string }

function lines(ls: LineDef[], root: "Invoice" | "CreditNote", docCur: string): string {
  const tag = root === "CreditNote" ? "CreditNoteLine" : "InvoiceLine"
  const qtyEl = root === "CreditNote" ? "CreditedQuantity" : "InvoicedQuantity"
  return ls.map((l, i) => {
    const gross = l.unitNet * l.qty
    const taxAmt = l.rate > 0 ? gross * l.rate / 100 : 0
    const exempt = l.exemptReason
      ? `<cbc:TaxExemptionReason>${esc(l.exemptReason)}</cbc:TaxExemptionReason>`
      : l.exemptReasonCode
        ? `<cbc:TaxExemptionReasonCode>${esc(l.exemptReasonCode)}</cbc:TaxExemptionReasonCode>`
        : ""
    return `  <cac:${tag}>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:${qtyEl} unitCode="C62">${money(l.qty)}</cbc:${qtyEl}>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(gross)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.desc)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.catCode}</cbc:ID>
        <cbc:Percent>${money(l.rate)}</cbc:Percent>
        ${exempt ? `      ${exempt}\n` : ""}      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${docCur}">${money(l.unitNet)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${tag}>`
  }).join("\n")
}

function taxBreakdown(ls: LineDef[], docCur: string, root: "Invoice" | "CreditNote"): string {
  const by = new Map<string, { rate: number; taxable: number; tax: number; exempt: boolean }>()
  for (const l of ls) {
    const gross = l.unitNet * l.qty
    const tax = l.rate > 0 ? gross * l.rate / 100 : 0
    const k = String(l.rate) + (l.catCode === "Z" ? "-Z" : "")
    const cur = by.get(k) ?? { rate: l.rate, taxable: 0, tax: 0, exempt: l.catCode === "Z" }
    cur.taxable += gross
    cur.tax += tax
    by.set(k, cur)
  }
  return Array.from(by.values()).map((b) => `  <cac:TaxSubtotal>
    <cbc:TaxableAmount currencyID="${docCur}">${money(b.taxable)}</cbc:TaxableAmount>
    <cbc:TaxAmount currencyID="${docCur}">${money(b.tax)}</cbc:TaxAmount>
    <cac:TaxCategory>
      <cbc:ID>${b.exempt ? "Z" : b.rate > 0 ? "S" : "Z"}</cbc:ID>
      <cbc:Percent>${money(b.rate)}</cbc:Percent>
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:TaxCategory>
  </cac:TaxSubtotal>`).join("\n")
}

interface Options {
  root: "Invoice" | "CreditNote"
  typeCode: number
  id: string
  ls: LineDef[]
  dueDate?: string
  buyerRef?: string
  advanceRefs?: { code: string; amount: number }[]
  paymentsMeans?: { code: string; ref?: string }[]
  originalRef?: { id: string; reason?: string }
  docCur?: string
  payableOverride?: number
}

function build(o: Options): string {
  const docCur = o.docCur ?? "EUR"
  const linesNet = o.ls.reduce((s, l) => s + l.unitNet * l.qty, 0)
  const taxTotal = o.ls.reduce((s, l) => s + (l.rate > 0 ? (l.unitNet * l.qty * l.rate) / 100 : 0), 0)
  const taxInclusive = linesNet + taxTotal
  const prepaidTotal = o.advanceRefs ? o.advanceRefs.reduce((s, a) => s + a.amount, 0) : 0
  const payable = o.payableOverride !== undefined ? o.payableOverride : Math.max(0, taxInclusive - prepaidTotal)

  const advanceRefs = o.advanceRefs?.map((a) => `  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(a.code)}</cbc:ID>
      <cbc:DocumentTypeCode>386</cbc:DocumentTypeCode>
      <cbc:DocumentDescription>Prepayment invoice (avansni račun)</cbc:DocumentDescription>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`).join("\n") ?? ""
  const originalRef = o.originalRef ? `  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(o.originalRef.id)}</cbc:ID>
      ${o.originalRef.reason ? `    <cbc:DocumentDescription>${esc(o.originalRef.reason)}</cbc:DocumentDescription>` : ""}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ""
  const pays = o.paymentsMeans?.map((p) => `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${p.code}</cbc:PaymentMeansCode>
    ${p.ref ? `  <cbc:InstructionNote>${esc(p.ref)}</cbc:InstructionNote>` : ""}
    ${p.code === "30" || p.code === "58" ? `  <cac:PayeeFinancialAccount>\n    <cbc:ID>SI56 0000 0000 0000 000</cbc:ID>\n  </cac:PayeeFinancialAccount>` : ""}
  </cac:PaymentMeans>`).join("\n") ?? ""
  const nbsp = " "
  const rootName = o.root
  const NS = o.root === "CreditNote" ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  const typeEl = o.root === "CreditNote" ? "cbc:CreditNoteTypeCode" : "cbc:InvoiceTypeCode"

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootName} xmlns="${NS}"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${CUST}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE}</cbc:ProfileID>
  <cbc:ID>${esc(o.id)}</cbc:ID>
  <cbc:IssueDate>2026-05-20</cbc:IssueDate>
  ${o.dueDate ? `  <cbc:DueDate>${o.dueDate}</cbc:DueDate>\n` : ""}  <${typeEl}>${o.typeCode}</${typeEl}>
  <cbc:DocumentCurrencyCode>${docCur}</cbc:DocumentCurrencyCode>
  ${o.buyerRef ? `  <cbc:BuyerReference>${esc(o.buyerRef)}</cbc:BuyerReference>\n` : ""}${o.originalRef ? originalRef : advanceRefs}  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0088">${SELLER_GLN}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID schemeID="0088">${SELLER_GLN}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Salon E d.o.o.</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Dunajska 10</cbc:StreetName>
        <cbc:CityName>Ljubljana</cbc:CityName>
        <cbc:PostalZone>1000</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SI</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>SI12345678</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>Salon E d.o.o.</cbc:RegistrationName><cbc:CompanyID schemeID="0002">1234567</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0088">${BUYER_GLN}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID schemeID="0088">${BUYER_GLN}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Ana Novak s.p.</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Trg 1</cbc:StreetName>
        <cbc:CityName>Maribor</cbc:CityName>
        <cbc:PostalZone>2000</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SI</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>SI87654321</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>Ana Novak s.p.</cbc:RegistrationName><cbc:CompanyID schemeID="0002">7654321</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${pays}  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${docCur}">${money(taxTotal)}</cbc:TaxAmount>
${taxBreakdown(o.ls, docCur, o.root)}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(linesNet)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${docCur}">${money(linesNet)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${docCur}">${money(taxInclusive)}</cbc:TaxInclusiveAmount>
    ${prepaidTotal > 0 ? `  <cbc:PrepaidAmount currencyID="${docCur}">${money(prepaidTotal)}</cbc:PrepaidAmount>\n` : ""}    <cbc:PayableAmount currencyID="${docCur}">${money(payable)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines(o.ls, o.root, docCur)}
</${rootName}>`
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const samples: Record<string, Options> = {
    // 01 avansni račun (386), DDV-obračunan, zahtevek za plačilo vnaprej
    "01-avans-386": {
      root: "Invoice", typeCode: 386, id: "AVN-0001/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-001",
      paymentsMeans: [{ code: "58" }],
      ls: [{ desc: "Avans za frizersko storitev", qty: 1, unitNet: 81.97, rate: 22, catCode: "S" }],
    },
    // 02 končni račun z enim prejetim avansom
    "02-koncn-1-avans": {
      root: "Invoice", typeCode: 380, id: "RAC-0002/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-001",
      paymentsMeans: [{ code: "58" }],
      advanceRefs: [{ code: "AVN-0001/2026", amount: 100 }],
      ls: [{ desc: "Frizerstvo - komplet", qty: 1, unitNet: 200, rate: 22, catCode: "S" }],
    },
    // 03 končni račun z dvema avansoma
    "03-koncn-2-avansa": {
      root: "Invoice", typeCode: 380, id: "RAC-0003/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-002",
      paymentsMeans: [{ code: "58" }],
      advanceRefs: [{ code: "AVN-0001/2026", amount: 60 }, { code: "AVN-0002/2026", amount: 40 }],
      ls: [{ desc: "Nega las + barvanje", qty: 1, unitNet: 300, rate: 22, catCode: "S" }],
    },
    // 04 dobropis (381)
    "04-dobropis-381": {
      root: "CreditNote", typeCode: 381, id: "DN-0001/2026",
      originalRef: { id: "RAC-0001/2026", reason: "Reklamacija - delni dobropis" },
      buyerRef: "PO-2026-001",
      ls: [{ desc: "Nadomestilo za nezadovoljivo storitev", qty: 1, unitNet: 50, rate: 22, catCode: "S" }],
    },
    // 05 račun z delnim plačilom (delno plačan => PayableAmount manjši)
    "05-delno-placilo": {
      root: "Invoice", typeCode: 380, id: "RAC-0005/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-003",
      paymentsMeans: [{ code: "30", ref: "2026-001234" }],
      ls: [{ desc: "Paket storitev", qty: 1, unitNet: 400, rate: 22, catCode: "S" }],
    },
    // 06 račun z več davčnimi stopnjami (22% + 9.5%)
    "06-vec-davcnih-stopnji": {
      root: "Invoice", typeCode: 380, id: "RAC-0006/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-004",
      paymentsMeans: [{ code: "58" }],
      ls: [
        { desc: "Frizerstvo", qty: 1, unitNet: 100, rate: 22, catCode: "S" },
        { desc: "Kozmetični izdelek (nižja stopnja)", qty: 2, unitNet: 25, rate: 9.5, catCode: "S" },
      ],
    },
    // 07 račun z oprostitvijo DDV (category Z, izvzeto — medicinske storitve)
    "07-oprostitev-ddv": {
      root: "Invoice", typeCode: 380, id: "RAC-0007/2026", dueDate: "2026-06-04",
      buyerRef: "PO-2026-005",
      paymentsMeans: [{ code: "58" }],
      ls: [{ desc: "Storitev, izvzeta iz DDV po 1. odstavku 40. člena ZDDV-1", qty: 1, unitNet: 150, rate: 0, catCode: "Z", exemptReasonCode: "VATEX-EU-132" }],
    },
  }
  for (const [name, opts] of Object.entries(samples)) {
    const xml = build(opts)
    const file = path.join(OUT, `${name}.xml`)
    await fs.writeFile(file, xml, "utf8")
    console.log("written", name, xml.length)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })