// ============================================================
// F5.5.4.6.2 — zakrjevalni enotni testi za buildUbl21Xml (PEPPOL BIS 3.0.21).
//
// Popravljeni hrošči, ki se tu zaklenejo (najdeni z živim uradnim
// validatorjem XSD+Schematron s test-samplei):
//   1) podvojen AccountingSupplierParty/AccountingCustomerParty → XSD invalid;
//   2) cbc:PaymentDueDate (ne obstaja v UBL 2.1 Invoice) namesto cbc:DueDate;
//   3) PartyIdentification/ID shema: 0088/GLN za VAT-neveljavno; sedaj ISO 6523
//      ICD (0002=matična, 0088=GLN z GS1 kontrolno števko);
//   4) prazna PartyLegalEntity/CompanyID ne sme biti izpisana (R008).
//   Vsi 4 so bili dokazano popravljeni, da XSD + PEPPOL-EN16931 + CEN-EN16931
//   (ob veljavnih matični/davčni/GLN) vrnejo PASS.
// ============================================================

import { describe, expect, it } from "vitest"
import { buildUbl21Xml } from "@/lib/einvoice/ubl21"
import type { EInvoiceModel } from "@/lib/einvoice/model"

function baseModel(): EInvoiceModel {
  return {
    kind: "INVOICE",
    docCode: "RAC-2026-0184",
    documentId: "doc-184",
    fiscalYear: 2026,
    number: 184,
    issueDate: "2026-11-15",
    issueDateIso: "2026-11-15T09:30:00Z",
    dueDate: "2026-12-05",
    serviceDate: "2026-11-12",
    servicePeriod: null,
    invoiceTypeCode: 380,
    vatEnabled: true,
    currency: "EUR",
    seller: {
      name: "RC Beauty Salon d.o.o.",
      legalName: "RC Beauty Salon d.o.o.",
      vatId: "SI12345678",
      taxNumber: "12345678",
      registrationNumber: "9876543",
      electronicId: "SI12345678",
      electronicIdScheme: "9929",
      street: "Prešernova 10",
      postalCode: "1000",
      city: "Ljubljana",
      country: "SI",
      bankAccount: "SI56 0201 1025 0000 123",
    },
    buyer: {
      name: "Obrt Primer d.o.o.",
      legalName: "Obrt Primer d.o.o.",
      vatId: "SI87654321",
      registrationNumber: "5432109",
      buyerReference: "PO-2026-0084",
      street: "Glavni trg 5",
      postalCode: "2000",
      city: "Maribor",
      country: "SI",
    },
    lines: [
      { id: "1", description: "Frizerstvo", quantity: 1, unitPriceNet: 25, discountPercent: 0, vatRate: 22, taxBaseLine: 25, vatAmount: 5.5, totalGross: 30.5 },
      { id: "2", description: "Barvanje", quantity: 1, unitPriceNet: 60, discountPercent: 0, vatRate: 22, taxBaseLine: 60, vatAmount: 13.2, totalGross: 73.2 },
    ],
    taxBreakdown: [{ vatRate: 22, taxableAmount: 85, taxAmount: 18.7 }],
    totals: { lineExtensionNet: 85, discountAmount: 0, taxTotal: 18.7, totalGross: 103.7, paidAmount: 0, creditedTotal: 0, advanceTotal: 0, openAmount: 103.7, currency: "EUR" },
    paymentsMeans: [{ code: "30", method: "Kreditni prenos", reference: "RAC-2026-0184" }],
  }
}

function count(tag: string, xml: string): number {
  const re = new RegExp(`<${tag}[\\s>/]`, "g")
  return (xml.match(re) ?? []).length
}

describe("F5.5.4.6.2 — buildUbl21Xml PEPPOL BIS strukturna skladnost", () => {
  const xml = buildUbl21Xml(baseModel())

  it("1) AccountingSupplierParty in AccountingCustomerParty nista podvojeni", () => {
    // count šteje SAMO odpiralne oznake (</cac: se ne ujema) → 1 odpiralna, brez gnezdenja.
    expect(count("cac:AccountingSupplierParty", xml)).toBe(1)
    expect(count("cac:AccountingCustomerParty", xml)).toBe(1)
    // Ni gnezdenja (odprava hrošča: x2 v headerju + x2 v helperju).
    expect(xml).not.toContain('<cac:AccountingSupplierParty>\n<cac:AccountingSupplierParty>')
  })

  it("2) uporablja cbc:DueDate, NE cbc:PaymentDueDate", () => {
    expect(xml).toContain("<cbc:DueDate>2026-12-05</cbc:DueDate>")
    expect(xml).not.toContain("PaymentDueDate")
  })

  it("3) PartyIdentification/ID uporablja ISO 6523 ICD 0002 (matična) za prodajalca in kupca", () => {
    expect(xml).toContain('<cbc:ID schemeID="0002">9876543</cbc:ID>')
    expect(xml).toContain('<cbc:ID schemeID="0002">5432109</cbc:ID>')
  })

  it("4) ne izpiše prazne CompanyID v PartyLegalEntity, kadar ni matične", () => {
    const noReg = baseModel()
    noReg.seller.registrationNumber = null
    noReg.buyer.registrationNumber = null
    const x = buildUbl21Xml(noReg)
    expect(x).not.toContain("<cbc:CompanyID schemeID=\"0002\"></cbc:CompanyID>")
    expect(x).not.toContain("<cbc:CompanyID schemeID=\"0002\"/>")
  })

  it("PEPPOL zahtevana polja (CustomizationID, ProfileID) prisotna", () => {
    expect(xml).toContain("urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0")
    expect(xml).toContain("urn:fdc:peppol.eu:2017:poacc:billing:01:1.0")
  })

  it("EndpointID nosi EAS shemo 9929 (VAT) kadar elektornski ID ni validen GLN", () => {
    // Seller ima vatId + electronicIdScheme 9929 → EAS VAT na EndpointID.
    expect(xml).toContain('<cbc:EndpointID schemeID="9929">SI12345678</cbc:EndpointID>')
  })
})