// ============================================================
// F5.5.4.1 — ČISTO JEDRO ZA IZRAČUN ZNESKOV DOKUMENTA.
//
// Vsa denarna izračunavanja tečejo TU (strežniško), nikoli v odjemalcu.
// Konvencija: cena je BRUTO (DDV vključen, slovensko), zato je
// `total = subtotal` (znesek z DDV), `taxBase` je neto osnova in
// `taxTotal` je DDV. Če organizacija NI DDV zavezanec (vatEnabled=false),
// je DDV 0 in total == taxBase.
//
// Zaokroževanje: vedno na 2 decimalki, HALF-UP. Vsaka linija se zaokroži
// posebej; dokumentna vsota je vsota zaokroženih linij (jasno, ponovljivo).
// ============================================================

/** Stopnja v odstotkih (0–100), zaokrožena na 2 decimalki. */
export interface MoneyInput {
  currency: string
  vatEnabled: boolean
}

export interface LineInput {
  description: string
  quantity: number
  unitPrice: number // BRUTO (DDV vključen)
  discountPercent?: number // 0–100
  vatRate?: number // 0–100 (stopnja zavezanca)
}

export interface LineResult {
  quantity: number
  unitPrice: number // bruto
  discountPercent: number
  vatRate: number
  /** bruto linija pred popustom = qty × unitPrice */
  gross: number
  /** bruto linija po popustu */
  grossAfterDiscount: number
  /** neto osnova linije (brez DDV) */
  taxBaseLine: number
  /** DDV za linijo */
  vatAmount: number
  /** linijski znesek z DDV (== grossAfterDiscount) */
  total: number
}

export interface DocumentTotals {
  subtotal: number // Σ grossAfterDiscount
  discountAmount: number // Σ razlike med gross in grossAfterDiscount
  taxBase: number // Σ taxBaseLine
  taxTotal: number // Σ vatAmount
  total: number // == subtotal (končni znesek z DDV)
}

/** Zaokroži na 2 decimalki, HALF-UP (stran od nič). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Razčleni številko v "centih" za deterministične primerjave. */
export function toCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100)
}

/** Parse nezaupljivega vhodnega števila v finite number ali null. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function clampPercent(v: number | null | undefined, fallback = 0): number {
  const n = v ?? fallback
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, round2(n)))
}

/**
 * Izračuna eno linijo. Če `vatEnabled` je false, se davčna stopnja vsili 0.
 * Neto osnova se izračuna iz bruto vrednosti (obratni DDV).
 */
export function computeLine(
  input: LineInput,
  vatEnabled: boolean
): LineResult {
  const quantity = Number.isFinite(input.quantity) ? Math.max(0, input.quantity) : 0
  const unitPrice = Number.isFinite(input.unitPrice) ? Math.max(0, input.unitPrice) : 0
  const discountPercent = clampPercent(input.discountPercent)
  // Če org ni zavezanec, DDV ne štejemo (stopnja vsiljena 0).
  const vatRate = vatEnabled ? clampPercent(input.vatRate) : 0

  const gross = round2(quantity * unitPrice)
  const grossAfterDiscount = round2(gross * (1 - discountPercent / 100))

  let taxBaseLine: number
  let vatAmount: number
  if (vatRate > 0) {
    // Obratni DDV iz bruto: neto = bruto / (1 + rate/100)
    taxBaseLine = round2(grossAfterDiscount / (1 + vatRate / 100))
    vatAmount = round2(grossAfterDiscount - taxBaseLine)
  } else {
    taxBaseLine = grossAfterDiscount
    vatAmount = 0
  }

  return {
    quantity,
    unitPrice,
    discountPercent,
    vatRate,
    gross,
    grossAfterDiscount,
    taxBaseLine,
    vatAmount,
    total: grossAfterDiscount,
  }
}

/** Izračuna vse linije in dokumentne totale. */
export function computeDocument(
  lines: LineInput[],
  vatEnabled: boolean
): { lines: LineResult[]; totals: DocumentTotals } {
  const computed = lines.map((l) => computeLine(l, vatEnabled))

  let subtotal = 0
  let discountAmount = 0
  let taxBase = 0
  let taxTotal = 0
  for (const l of computed) {
    subtotal = round2(subtotal + l.grossAfterDiscount)
    discountAmount = round2(discountAmount + (l.gross - l.grossAfterDiscount))
    taxBase = round2(taxBase + l.taxBaseLine)
    taxTotal = round2(taxTotal + l.vatAmount)
  }

  return {
    lines: computed,
    totals: {
      subtotal,
      discountAmount,
      taxBase,
      taxTotal,
      total: subtotal, // bruto konvencija: končni znesek z DDV = subtotal (z DDV)
    },
  }
}