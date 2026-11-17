// ============================================================
// CASH REGISTER (WP-1 — BLAGAJNA) — ČISTO JEĐRO (brez DB, brez Prisma)
//
// Odločitev (enotna denarna pot): blagajna NE drži svojih prodaj.
// Vsaka prodaja je zapis v Order (isti transakcijski vzorec kot
// neposredna prodaja, actions/direct-sale.ts). Seja (CashSession) je
// dnevno KNJIŽBENO OKNO: začetni fond + vezane prodaje (Order.
// cashSessionId) + drobni stroški (CashExpense). Pri zaprtju se
// stanje predala izračuna IN primerja z ošteviljenim (variance).
//
// To jedro je čisto (pure) — enostavno testljivo, brez side-effectov.
// Vsi zneski so v EUR, 2 decimalni mesti (Decimal(10,2) v DB).
//
// Metoda plačila → vpliv na GOTOVINSKI PREDAL (drawer):
//   • "cash"     → gotovina v predal (+)
//   • "offline"  → "ob prevzemu" = gotovina, ki jo lastnik prejme
//                  neposredno → obravnava kot gotovino v predalu (+)
//   • "card"     → kartica (blagajna, WP-1) → NE vpliva na predal
//   • "transfer" → nakazilo → NE vpliva na predal (in PENDING order)
//   • "online"   → rezervirano za Stripe; nikoli v neposredni prodaji
//
// Pričakovana gotovina v predalu pri zaprtju:
//   expected = openingFloat + Σ(cash + offline) − Σ(expenses)
// Odstopanje (variance):
//   variance = countedCash − expected   (negativno = manjka gotovine)
// ============================================================

/** Veljavni plačilni metodi, ki vplivata na GOTOVINSKI predal. */
export const CASH_DRAWER_METHODS = ["cash", "offline"] as const

/** Vse metode, ki jih blagajna sprejme (prodaja). */
export const REGISTER_SALE_METHODS = [
  "cash",
  "card",
  "transfer",
  "offline",
] as const

export type CashSessionStatus = "OPEN" | "CLOSED"

export const CASH_SESSION_STATUSES: readonly CashSessionStatus[] = [
  "OPEN",
  "CLOSED",
]

export type RegisterSaleMethod = (typeof REGISTER_SALE_METHODS)[number]

/**
 * Zakljene vrstice seje za izračun. Prodaje so Order-ji (ali njihova
 * projekcija), stroški pa CashExpense. Zneski so številske vrednosti
 * (number) — v DB so Decimal(10,2); tu delamo v decimalnih enotah.
 */
export interface SessionSaleRow {
  /** paymentMethod iz Order ("cash" | "offline" | "card" | "transfer" | "online"). */
  paymentMethod: string
  /** Končni znesek prodaje (order.total), EUR. */
  amount: number
}

export interface SessionExpenseRow {
  /** Znesek stroška, EUR. */
  amount: number
}

export interface SessionTotalsInput {
  /** Ošteviljen začetni fond predala (≥ 0). */
  openingFloat: number
  sales: SessionSaleRow[]
  expenses: SessionExpenseRow[]
}

export interface SessionTotals {
  /** Vse prodaje v seji (vse metode), EUR. */
  salesTotal: number
  /** Gotovina v predalu (cash + offline), EUR. */
  cashTotal: number
  /** Kartica (card), EUR. */
  cardTotal: number
  /** Nakazilo (transfer), EUR. */
  transferTotal: number
  /** Skupni stroški, EUR. */
  expensesTotal: number
  /**
   * Pričakovana gotovina v predalu:
   * openingFloat + cashTotal − expensesTotal.
   */
  expectedCash: number
  /** Število prodaj (vse metode). */
  saleCount: number
}

/**
 * Zaokroži na 2 decimalni mesti (bankerjevih? NE — standardno
 * half-up na centu) brez plavajoče natančnosti.
 *
 * Uporabimo integer cente, da se izognemo 0.1+0.2 ≠ 0.3.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  // Množimo s 100, zaokrožimo na integer cent, delimo nazaj.
  const cents = Math.round((value + Number.EPSILON) * 100)
  return cents / 100
}

/**
 * Izračuna skupne zneske seje + pričakovano gotovino v predalu.
 * Čista funkcija — brez DB, brez side-effectov.
 */
export function computeSessionTotals(input: SessionTotalsInput): SessionTotals {
  let cash = 0
  let card = 0
  let transfer = 0
  let salesTotal = 0
  let saleCount = 0

  for (const s of input.sales) {
    const amount = round2(s.amount)
    salesTotal += amount
    saleCount += 1
    const m = s.paymentMethod
    if (m === "cash" || m === "offline") cash += amount
    else if (m === "card") card += amount
    else if (m === "transfer") transfer += amount
    // "online" se ne sešteva (ni v seji) — a varno ignoriramo.
  }

  let expensesTotal = 0
  for (const e of input.expenses) {
    expensesTotal += round2(e.amount)
  }

  return {
    salesTotal: round2(salesTotal),
    cashTotal: round2(cash),
    cardTotal: round2(card),
    transferTotal: round2(transfer),
    expensesTotal: round2(expensesTotal),
    // Pričakovana gotovina: le za GOTOVINSKI predal (cash + offline − stroški).
    // Kartica in nakazilo ne vplivata na fizično gotovino v predalu.
    expectedCash: round2(input.openingFloat + cash - expensesTotal),
    saleCount,
  }
}

/**
 * Izračuna odstopanje pri zaprtju: ošteviljeno − pričakovano.
 * Negativno = manjka gotovine, pozitivno = več kot pričakovano.
 */
export function computeVariance(expectedCash: number, countedCash: number): number {
  return round2(countedCash - expectedCash)
}

/**
 * Preveri, ali sejo lahko zapišemo (status OPEN) / zapremo (CLOSED → ne).
 * Uporabljamo za guard-je v akcijah, da ne vpišemo gib v zaprto sejo.
 */
export function canWriteToSession(status: string): status is "OPEN" {
  return status === "OPEN"
}

/**
 * Preveri, ali je plačilna metoda veljavna za prodajo NA BLAGAJNI.
 * (Blagajna sprejme gotovino, kartico, nakazilo in offline/ob prevzemu.)
 */
export function isRegisterSaleMethod(method: string): method is RegisterSaleMethod {
  return (REGISTER_SALE_METHODS as readonly string[]).includes(method)
}

/**
 * Preveri, ali je plačilna metoda "gotovinska" (vpliva na predal).
 */
export function isCashDrawerMethod(method: string): boolean {
  return (CASH_DRAWER_METHODS as readonly string[]).includes(method)
}

/**
 * Sanitizira znesek za znesek v denarni seji: število, ≥ 0, ≤ 10_000_000,
 * 2 decimalni mesti. Vrne null, če ni veljaven (uporabnik vpiše npr. "abc").
 */
export function sanitizeMoney(value: unknown, max = 10_000_000): number | null {
  const n = parseMoneyInput(value)
  if (n === null) return null
  if (n < 0) return null
  if (n > max) return null
  return round2(n)
}

/**
 * Pretvori uporabnikov vnos v število — z upoštevanjem slovenskega
 * zapisa (»12,50«) in tisočic (»1.234,56«). Brez tega bi lastnik, ki
 * vpiše znesek z vejico, dobil napako »znesek ni veljaven«.
 *
 * Pravila:
 *   • število → uporabi neposredno;
 *   • eno ločilo: vejica = decimalka (»12,5«), pika = decimalka;
 *   • oba: zadnji je decimalka, drugi je ločilo tisočic;
 *   • nič drugega (črke, več decimalk) → null.
 */
export function parseMoneyInput(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null

  const raw = value.trim().replace(/\s| /g, "")
  if (raw === "") return null
  if (!/^-?[\d.,]+$/.test(raw)) return null

  const hasComma = raw.includes(",")
  const hasDot = raw.includes(".")

  let normalized = raw
  if (hasComma && hasDot) {
    const decimal = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : "."
    const thousands = decimal === "," ? "." : ","
    normalized = raw.split(thousands).join("").replace(decimal, ".")
  } else if (hasComma) {
    // Ena vejica = decimalka; več vejic ni veljaven zapis.
    if (raw.split(",").length > 2) return null
    normalized = raw.replace(",", ".")
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}
