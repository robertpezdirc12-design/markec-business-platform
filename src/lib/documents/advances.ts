// ============================================================
// F5.5.4.5 — ČISTO JEDRO ZA AVANSNE RAČUNE.
//
// Ločimo pravila:
//  • AVANSNI RAČUN (Document.type="ADVANCE", serija AVN-…): dokument, ki
//    zapoveduje plačilo pred dobavo. DDV se obračuna od DEJANSKO PREJETEGA
//    bruto predplačila v skladu z režimom organizacije (vatEnabled) — tu
//    uporabimo isti obratni-DDV mehanizem kot za račun (money.ts).
//  • RECEIVED (prejeto predplačilo) — evidenciramo s DocumentPayment na
//    avansnem dokumentu. Ločimo od "načrtovane" vrednosti avansa (na podlagi
//    predvidenih linij) — aplikacija uporabi SAMO dejansko prejeto+nevrnjeno
//    vsoto (paidAmount − negativni stornovi).
//  • ALLOCATION (DocumentAdvanceAllocation): en avans → največ EN končni
//    račun (odločitev F5.5.4.5). @unique(org, advanceId) prepreči dvojno.
//    Aplicira se le do odprtega zneska končnega računa (nikoli prekomerno).
//  • REVERSE (storno) — REVERSAL DocumentPayment; nikoli tiho brisanje.
//  • CREDIT (dobropis) — kadar je potrebna davčna korekcija (CreditNote).
// ============================================================

/**
 * Slovenske splošne DDV stopnje. Posebni režimi (npr. posebne stopnje ob
 * gradbeništvu, posebni obračunski režimi) NISO implementirani; pri avansu
 * z nepodprto stopnjo je treba izdajo BLOKIRATI namesto napačnega obračuna.
 * (Standardna/8. člen-splošna = 22 %, znižana = 9.5 % / 5 %; 0 = oprostitev
 * ali transakcija brez DDV.) Vrednosti veljajo po splošnem režimu ZDDV-1.
 */
export const SUPPORTED_VAT_RATES = new Set([0, 5, 9.5, 22])

/**
 * Ali je stopnja podprta za avansni račun. Če org uporablja posebni režim
 * (katerega MARKEC ne zna obračunati), vrnemo false → UI blokira izdajo.
 */
export function isSupportedVatRate(vatRate: number): boolean {
  return SUPPORTED_VAT_RATES.has(vatRate)
}

/** Dejansko prejeto + nevrnjeno (neposredno) stanje avansa — v centih. */
export function advanceReceivedCents(clearedPayments: { amount: number }[]): number {
  return clearedPayments.reduce((s, p) => s + Math.round(p.amount * 100), 0)
}

/**
 * Aplicirati količino avansa na končni račun: prenesemo le čim več, kolikor
 * je odprtega stanja končnega računa — nikoli prek. Znana pa je vsota vseh
 * že apliciranih avansov (ali za ta konkretni — v tej fazi en).
 * Vrne aplicirani bruto (cents).
 */
export function allocationAmountCents(
  availableCents: number, // prejeto+nevrnjeno stanje avansa
  invoiceOpenCents: number // še odprto stanje končnega računa
): number {
  if (availableCents <= 0 || invoiceOpenCents <= 0) return 0
  return Math.min(availableCents, invoiceOpenCents)
}

/** Razčleni aplicirani bruto znesek na DDV za vrstico v DocumentAdvanceAllocation. */
export function splitAllocation(
  amountBruto: number, // bruto (z DDV), 2-dec
  vatRateNumber: number, // efektivna stopnja iz avansa (0..100)
  vatEnabled: boolean
): { taxBase: number; taxTotal: number } {
  if (!vatEnabled || vatRateNumber <= 0) return { taxBase: amountBruto, taxTotal: 0 }
  const base = Math.round((amountBruto / (1 + vatRateNumber / 100)) * 100) / 100
  return { taxBase: base, taxTotal: Math.round((amountBruto - base) * 100) / 100 }
}

/** Normalizira datum v ISO (YYYY-MM-DD) ali null. */
export function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

/** Opisni niz za datum/obdobje opravljene storitve (za PDF/UI). */
export function servicePeriodLabel(serviceDate: Date | null, start: Date | null, end: Date | null): string | null {
  if (serviceDate) return isoDate(serviceDate)
  if (start || end) {
    const s = isoDate(start)
    const e = isoDate(end)
    if (s && e) return `${s} – ${e}`
    return s ?? e
  }
  return null
}