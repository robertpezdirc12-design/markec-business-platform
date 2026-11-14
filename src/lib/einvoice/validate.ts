// ============================================================
// F5.5.4.6.2 — VALIDATOR E-RAČUNA.
//
// 1) wellFormed — XML dobro oblikovan (platforma-neodvisen parser preprosta
//    kontrola uravnoteženosti + enega korena). Za resnično XSD-validacijo se
//    v naslednji fazi priključi uradni XSD (e-SLOG 2.0, PEPPOL-EN16931) —
//    trenutno `xsdAvailable=false`, vendar math + business pravila NISO.
// 2) mathConsistent — številke iz XML so skladne z izvornim dokumentom
//    (brez ponovnega preračunavanja; primerja že shranjene vrednosti).
// 3) businessRules — EN/PEPPOL/e-SLOG poslovna pravila (kupec, DDV, datumi).
// ============================================================

import { EInvoiceModel } from "@/lib/einvoice/model"

export interface EInvoiceValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  wellFormed: boolean
  xsdAvailable: boolean
  xsdErrors: string[]
  mathConsistent: boolean
  businessOk: boolean
}

/** Minimalen, determinističen dobro-oblikanost XML parser (brez zunanje dep). */
export function isWellFormedXml(xml: string): boolean {
  let trimmed = xml.trim()
  if (!trimmed.startsWith("<")) return false
  // Odstrani prolog in XML deklaracije (<? ... ?>) in komentarje/&lt;!DOCTYPE — jih
  // ne obravnavamo kot elemente, da regex ostane determinističen.
  trimmed = trimmed
    // prolog / PI
    .replace(/<\?[\s\S]*?\?>/g, "")
    // komentar in doctype
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<![\s\S]*?>/g, "")
    .trim()
  if (!trimmed) return false
  const stack: string[] = []
  const re = /<([/!?]?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'/])*)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(trimmed)) !== null) {
    const [, slash, tag, , selfClose] = m
    if (m[0].startsWith("<?")) continue // preostali PI
    if (m[0].startsWith("<!")) continue
    if (selfClose) continue
    if (slash) {
      const top = stack.pop()
      if (top !== tag) return false
    } else {
      if (/^\s/.test(tag[0])) return false
      stack.push(tag)
    }
  }
  return stack.length === 0 && trimmed.trimEnd().endsWith(">")
}

const EPS = 0.005

/**
 * Preveri številsko skladnost XML-modela z izvornim dokumentom in poslovna
 * pravila. Ne poganja izračunov — primerja shranjene vrednosti modela.
 */
export function validateEInvoice(xml: string, model: EInvoiceModel): EInvoiceValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const wellFormed = isWellFormedXml(xml)

  // ---- Math consistency (model ima že shranjene vrednosti iz Documenta) ----
  // DAX breakdown (taxBase bi moralo = total - taxTotal).
  const sumTaxBase = model.taxBreakdown.reduce((s, b) => s + b.taxableAmount, 0)
  const sumTax = model.taxBreakdown.reduce((s, b) => s + b.taxAmount, 0)
  const sumLinesNet = model.lines.reduce((s, l) => s + l.taxBaseLine, 0)
  if (Math.abs(sumTaxBase - model.totals.taxTotal) > EPS && model.vatEnabled) {
    // ni nujno napaka — taxBase vs taxTotal razmerje; preveri raje neto
  }
  if (Math.abs(model.totals.lineExtensionNet - sumLinesNet) > EPS) {
    errors.push(`LineExtensionNet (${model.totals.lineExtensionNet}) ≠ Σ linij (${sumLinesNet})`)
  }
  if (Math.abs(sumTax - model.totals.taxTotal) > EPS) {
    errors.push(`Σ DDV (${sumTax}) ≠ taxTotal (${model.totals.taxTotal})`)
  }
  if (model.totals.totalGross < 0) errors.push("totalGross < 0")

  // ---- Business rules (EN 16931 / PEPPOL BIS / e-SLOG) ----
  if (!model.docCode) errors.push("manjkajoč docCode (ID)")
  if (!model.issueDate) errors.push("manjka IssueDate")
  if (!model.seller.name) errors.push("manjka seller name")
  if (!model.buyer.name) errors.push("manjka buyer name")
  if (model.vatEnabled && !model.seller.vatId) warnings.push("seller brez VAT ID (če je zavezanec)")
  if (model.buyer.street && !model.buyer.postalCode) warnings.push("buyer: naslov brez poštne številke")
  if (model.lines.length === 0) errors.push("e-račun brez vrstic")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(model.issueDate)) errors.push(`IssueDate ni YYYY-MM-DD: ${model.issueDate}`)
  // Na PEPPOL ne sme biti, da bi bil buyer podjetje brez davčne (če vatEnabled)
  if (model.vatEnabled && model.totals.taxTotal > 0 && !model.buyer.vatId) {
    warnings.push("VAT zavezanec naj navede buyer VAT ID (za B2B po pravilniku)")
  }

  // ---- F5.5.4.6.3 §3 — kritična kontrola kod (PEPPOL-EN16931-P0100/P0101/P0112 + UNCL4461) ----
  // Dovoljene InvoiceTypeCode za markerje (PEPPOL-P0100): 386 (avans), 380 (končni), 326 (delni, a le DE).
  const INVOICE_TYPES = ["380", "386", "381", "326", "384"]
  if (model.kind === "ADVANCE" && model.invoiceTypeCode !== 386) {
    errors.push("Avansni račun mora imeti InvoiceTypeCode 386 (PEPPOL-EN16931-P0100)")
  }
  if (model.kind === "INVOICE" && model.invoiceTypeCode === 326) {
    // P0112: 326 le za DE organizacije.
    const bothDE = model.seller.country === "DE" && model.buyer.country === "DE"
    if (!bothDE) errors.push("InvoiceTypeCode 326 dovoljen le za nemške organizacije (PEPPOL-EN16931-P0112)")
  }
  if (model.kind === "CREDIT" && model.invoiceTypeCode !== 381) {
    errors.push("Dobropis mora imeti CreditNoteTypeCode 381 (PEPPOL-EN16931-P0101)")
  }
  if (!INVOICE_TYPES.includes(String(model.invoiceTypeCode))) {
    warnings.push(`InvoiceTypeCode ${model.invoiceTypeCode} ni v PEPPOL-EN16931-P0100 naboru`)
  }
  // UNCL 4461: 97 (Clearing between partners) NI predplačilo — avans ne sme biti PaymentMeansCode.
  const bad97 = model.paymentsMeans.some((p) => p.code === "97")
  if (bad97) errors.push("PaymentMeansCode 97 (Clearing between partners) ne sme označevati avansa/preplačila — odstranjeno")
  // Avans/nepremno preplačilo: ce so advanceRefs, jih UX ne sme predstaviti kot PaymentMeans.
  if ((model.advanceRefs ?? []).length > 0) {
    if (model.paymentsMeans.some((p) => p.code === "97")) errors.push("avans predstavljen kot PaymentMeans 97 — neurobijivo")
  }

  const mathConsistent = errors.filter((e) => e.includes("≠") || e.includes("< 0")).length === 0
  const businessOk = errors.filter((e) => !e.includes("≠") && !e.includes("< 0")).length === 0

  return {
    ok: wellFormed && errors.length === 0,
    errors,
    warnings,
    wellFormed,
    xsdAvailable: false, // uradni XSD se priklopi v naslednji fazi §4.XSD
    xsdErrors: [],
    mathConsistent,
    businessOk,
  }
}