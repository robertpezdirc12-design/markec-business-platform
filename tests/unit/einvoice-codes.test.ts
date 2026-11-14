// ============================================================
// F5.5.4.6.3 — Enotni testi kritične kontrole kod (zamrjeni in odvisni od NE-lažne
// validacije). NE zahteva bazo / Java — preverja čisto TS logiko.
//
// Pokriva §3: 386 (prepayment), 326 (partial, PEPPOL-P0112 le DE), 380, 381,
// paymentMeansCode — 97 NE sme biti avans (Clearing between partners).
// ============================================================

import { describe, expect, it } from "vitest"
import { paymentMeansCode, EInvoiceModel } from "@/lib/einvoice/model"
import { validateEInvoice, isWellFormedXml } from "@/lib/einvoice/validate"

function baseModel(over: Partial<EInvoiceModel>): EInvoiceModel {
  return {
    kind: "INVOICE",
    docCode: "RAC-0001/2026",
    documentId: "d1",
    fiscalYear: 2026,
    number: 1,
    issueDate: "2026-05-20",
    issueDateIso: "2026-05-20T00:00:00.000Z",
    dueDate: "2026-06-04",
    serviceDate: null,
    servicePeriod: null,
    invoiceTypeCode: 380,
    vatEnabled: true,
    currency: "EUR",
    seller: { name: "Salon E", vatId: "SI12345678", country: "SI" },
    buyer: { name: "Ana Novak", vatId: "SI87654321", country: "SI", buyerReference: "PO-1" },
    lines: [{ id: "l1", description: "Storitev", quantity: 1, unitPriceNet: 81.97, discountPercent: 0, vatRate: 22, taxBaseLine: 81.97, vatAmount: 18.03, totalGross: 100 }],
    taxBreakdown: [{ vatRate: 22, taxableAmount: 81.97, taxAmount: 18.03 }],
    totals: { lineExtensionNet: 81.97, discountAmount: 0, taxTotal: 18.03, totalGross: 100, paidAmount: 0, creditedTotal: 0, advanceTotal: 0, openAmount: 100, currency: "EUR" },
    paymentsMeans: [],
    ...over,
  }
}

describe("F5.5.4.6.3 — paymentMeansCode (UNCL 4461)", () => {
  it("transfer → 30, cash → 10, card → 54 (respektivno kode, ne izmišljujemo)", () => {
    expect(paymentMeansCode("transfer")).toBe("30")
    expect(paymentMeansCode("cash")).toBe("10")
    expect(paymentMeansCode("card")).toBe("54")
    expect(paymentMeansCode("online")).toBe("30")
  })
  it("advance/giftcard NE sme dati 97 — vrne prazno (avans NI PaymentMeansCode)", () => {
    expect(paymentMeansCode("advance")).toBe("")
    expect(paymentMeansCode("giftcard")).toBe("")
    // 97 = Clearing between partners — to NIKOLI ne sme biti uporabljeno za avans.
    expect(paymentMeansCode("advance")).not.toBe("97")
  })
})

describe("F5.5.4.6.3 — InvoiceTypeCode / CreditNoteTypeCode kontrole (§3)", () => {
  it("avansni račun (kind ADVANCE) MORA imeti 386 (PEPPOL-P0100)", () => {
    const m = baseModel({ kind: "ADVANCE", invoiceTypeCode: 380 })
    const r = validateEInvoice("<x></x>", m)
    expect(r.businessOk).toBe(false)
    expect(r.errors.some((e) => e.includes("386"))).toBe(true)
    // pravilno: 386 napravi brez napake glede tipa
    const ok = validateEInvoice("<x></x>", baseModel({ kind: "ADVANCE", invoiceTypeCode: 386 }))
    expect(ok.errors.some((e) => e.includes("InvoiceTypeCode 386"))).toBe(false)
  })
  it("326 (partial) je dovoljen le za nemške organizacije (PEPPOL-P0112)", () => {
    // SI seller + SI buyer → 326 ni dovoljen
    const si = validateEInvoice("<x></x>", baseModel({ kind: "INVOICE", invoiceTypeCode: 326 }))
    expect(si.businessOk).toBe(false)
    expect(si.errors.some((e) => e.includes("326"))).toBe(true)
    // DE + DE → 326 je dovoljen (ni napake)
    const de = validateEInvoice(
      "<x></x>",
      baseModel({ kind: "INVOICE", invoiceTypeCode: 326, seller: { name: "X", country: "DE" }, buyer: { name: "Y", country: "DE" } })
    )
    expect(de.errors.some((e) => e.includes("326"))).toBe(false)
  })
  it("dobropis MORa 381 (PEPPOL-P0101)", () => {
    const m = baseModel({ kind: "CREDIT", invoiceTypeCode: 380 })
    expect(validateEInvoice("<x/>", m).errors.some((e) => e.includes("381"))).toBe(true)
    const ok = validateEInvoice("<x/>", baseModel({ kind: "CREDIT", invoiceTypeCode: 381 }))
    expect(ok.errors.some((e) => e.includes("381"))).toBe(false)
  })
  it("PaymentMeansCode 97 v paymentsMeans sproži poslovno napako (ni avans)", () => {
    const m = baseModel({ paymentsMeans: [{ code: "97", method: "transfer" }] })
    const r = validateEInvoice("<x/>", m)
    expect(r.errors.some((e) => e.includes("97"))).toBe(true)
  })
  it("isWellFormedXml je determinističen", () => {
    expect(isWellFormedXml("<?xml version='1.0'?><Invoice/>")).toBe(true)
    expect(isWellFormedXml("<a><b></a>")).toBe(false)
    expect(isWellFormedXml("<Invoice/>")).toBe(true)
  })
})