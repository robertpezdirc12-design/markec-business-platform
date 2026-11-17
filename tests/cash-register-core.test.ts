import { describe, it, expect } from "vitest"
import {
  computeSessionTotals,
  computeVariance,
  round2,
  sanitizeMoney,
  canWriteToSession,
  isCashDrawerMethod,
  isRegisterSaleMethod,
  CASH_DRAWER_METHODS,
  REGISTER_SALE_METHODS,
} from "@/lib/cash-register/core"

// ============================================================
// BLAGAJNA (WP-1) — čisto jedro
//
// Denarni izračuni so edini del blagajne, kjer se lahko tiho izgubi
// cent (ali cel znesek). Zato so tu ločeni od DB in pokriti s testi:
//   • predal = začetni fond + gotovina − stroški
//   • kartica in nakazilo NE vplivata na gotovino v predalu
//   • odstopanje = oštevilčeno − pričakovano
// ============================================================

describe("computeSessionTotals", () => {
  it("sešteje prodaje po načinih in loči predal od kartice", () => {
    const t = computeSessionTotals({
      openingFloat: 50,
      sales: [
        { paymentMethod: "cash", amount: 20 },
        { paymentMethod: "offline", amount: 10 },
        { paymentMethod: "card", amount: 35.5 },
        { paymentMethod: "transfer", amount: 100 },
      ],
      expenses: [{ amount: 5 }],
    })

    expect(t.salesTotal).toBe(165.5)
    expect(t.cashTotal).toBe(30) // cash + offline
    expect(t.cardTotal).toBe(35.5)
    expect(t.transferTotal).toBe(100)
    expect(t.expensesTotal).toBe(5)
    expect(t.saleCount).toBe(4)
    // predal: 50 + 30 − 5 = 75 (kartica in nakazilo ne prideta v predal)
    expect(t.expectedCash).toBe(75)
  })

  it("ne šteje spletnih (online) prodaj v sejo", () => {
    const t = computeSessionTotals({
      openingFloat: 0,
      sales: [{ paymentMethod: "online", amount: 99 }],
      expenses: [],
    })
    expect(t.cashTotal).toBe(0)
    expect(t.expectedCash).toBe(0)
  })

  it("prazna seja = samo fond", () => {
    const t = computeSessionTotals({ openingFloat: 12.34, sales: [], expenses: [] })
    expect(t.salesTotal).toBe(0)
    expect(t.expectedCash).toBe(12.34)
    expect(t.saleCount).toBe(0)
  })

  it("ne ustvarja napak s plavajočo vejico", () => {
    const t = computeSessionTotals({
      openingFloat: 0,
      sales: [
        { paymentMethod: "cash", amount: 0.1 },
        { paymentMethod: "cash", amount: 0.2 },
      ],
      expenses: [],
    })
    expect(t.cashTotal).toBe(0.3)
    expect(t.expectedCash).toBe(0.3)
  })

  it("stroški lahko predal spravijo v minus (odkrito, ne skrito)", () => {
    const t = computeSessionTotals({
      openingFloat: 0,
      sales: [{ paymentMethod: "cash", amount: 10 }],
      expenses: [{ amount: 25 }],
    })
    expect(t.expectedCash).toBe(-15)
  })
})

describe("computeVariance", () => {
  it("manjko je negativen, višek pozitiven, ujemanje nič", () => {
    expect(computeVariance(100, 95)).toBe(-5)
    expect(computeVariance(100, 103)).toBe(3)
    expect(computeVariance(100, 100)).toBe(0)
  })

  it("zaokroži na cent", () => {
    expect(computeVariance(10.005, 10.01)).toBe(0)
  })
})

describe("round2 / sanitizeMoney", () => {
  it("round2 zaokroži na dve decimalki", () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.344)).toBe(2.34)
    expect(round2(Number.NaN)).toBe(0)
  })

  it("sanitizeMoney sprejme število in številski niz", () => {
    expect(sanitizeMoney(12.345)).toBe(12.35)
    expect(sanitizeMoney("7.5")).toBe(7.5)
  })

  it("sprejme slovenski zapis z vejico in tisočicami", () => {
    expect(sanitizeMoney("12,50")).toBe(12.5)
    expect(sanitizeMoney("1.234,56")).toBe(1234.56)
    expect(sanitizeMoney("1,234.56")).toBe(1234.56)
    expect(sanitizeMoney(" 45,00 ")).toBe(45)
    expect(sanitizeMoney("12,5,5")).toBeNull()
  })

  it("sanitizeMoney zavrne negativno, neskončno in preveliko", () => {
    expect(sanitizeMoney(-1)).toBeNull()
    expect(sanitizeMoney(Number.POSITIVE_INFINITY)).toBeNull()
    expect(sanitizeMoney("abc")).toBeNull()
    expect(sanitizeMoney(10_000_001)).toBeNull()
  })
})

describe("guardji seje", () => {
  it("v zaprto sejo ni mogoče pisati", () => {
    expect(canWriteToSession("OPEN")).toBe(true)
    expect(canWriteToSession("CLOSED")).toBe(false)
  })

  it("samo cash in offline sta gotovini v predalu", () => {
    expect(CASH_DRAWER_METHODS).toEqual(["cash", "offline"])
    expect(isCashDrawerMethod("cash")).toBe(true)
    expect(isCashDrawerMethod("card")).toBe(false)
    expect(isCashDrawerMethod("transfer")).toBe(false)
  })

  it("blagajna ne sprejme spletnega plačila", () => {
    expect(isRegisterSaleMethod("cash")).toBe(true)
    expect(isRegisterSaleMethod("card")).toBe(true)
    expect(isRegisterSaleMethod("transfer")).toBe(true)
    expect(isRegisterSaleMethod("offline")).toBe(true)
    expect(isRegisterSaleMethod("online")).toBe(false)
    expect(REGISTER_SALE_METHODS).not.toContain("online")
  })
})
