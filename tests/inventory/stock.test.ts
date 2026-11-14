// ============================================================
// E2-2 — inventory stock rules (EPIC #2, pure logic).
// computeStockDelta is THE gate both the server action and the
// checkout flow share: positive integer quantities only, IN
// adds, OUT subtracts, negative results are rejected BEFORE any
// write — state and ledger can never disagree about a rejected
// movement.
// ============================================================

import { describe, it, expect } from "vitest"
import { computeStockDelta, computeAvailableStock } from "@/lib/inventory/stock"

describe("E2-2 computeStockDelta — receipts (IN)", () => {
  it("adds to the current stock", () => {
    expect(computeStockDelta(0, "IN", 5)).toEqual({ ok: true, nextStock: 5 })
    expect(computeStockDelta(10, "IN", 1)).toEqual({ ok: true, nextStock: 11 })
  })

  it("allows receipt onto zero stock", () => {
    expect(computeStockDelta(0, "IN", 1)).toEqual({ ok: true, nextStock: 1 })
  })
})

describe("E2-2 computeStockDelta — issues (OUT)", () => {
  it("subtracts from the current stock", () => {
    expect(computeStockDelta(10, "OUT", 4)).toEqual({ ok: true, nextStock: 6 })
  })

  it("allows an issue down to exactly zero", () => {
    expect(computeStockDelta(7, "OUT", 7)).toEqual({ ok: true, nextStock: 0 })
  })

  it("REJECTS an issue below zero (§11 — never sell what isn't there)", () => {
    expect(computeStockDelta(3, "OUT", 4)).toEqual({
      ok: false,
      reason: "NEGATIVE_STOCK",
    })
    expect(computeStockDelta(0, "OUT", 1)).toEqual({
      ok: false,
      reason: "NEGATIVE_STOCK",
    })
  })
})

describe("E2-2 computeStockDelta — quantity validation", () => {
  it("rejects zero, negative and non-integer quantities", () => {
    expect(computeStockDelta(10, "IN", 0).ok).toBe(false)
    expect(computeStockDelta(10, "OUT", 0).ok).toBe(false)
    expect(computeStockDelta(10, "IN", -3).ok).toBe(false)
    expect(computeStockDelta(10, "IN", 2.5).ok).toBe(false)
    expect(computeStockDelta(10, "IN", 0.1).ok).toBe(false)
  })

  it("rejects corrupt current stock values", () => {
    expect(computeStockDelta(-1, "IN", 5).ok).toBe(false)
    expect(computeStockDelta(1.5, "IN", 5).ok).toBe(false)
  })

  it("never mutates its inputs (pure)", () => {
    const current = 5
    computeStockDelta(current, "IN", 3)
    expect(current).toBe(5)
  })
})

// ============================================================
// F6.1 — computeAvailableStock = stockQuantity − reservedQuantity.
// Enotni vir resnice za javni prikaz, košarico in checkout UI.
// Robni primeri (naloga): 0 zaloge, delno rezervirana, vsa rezervirana,
// več kot zaloga rezervirano (ne gre v negativ), neveljavni vnosi.
// ============================================================
describe("F6.1 computeAvailableStock — razpoložljiva zaloga", () => {
  it("brez rezervacij: available == stock", () => {
    expect(computeAvailableStock(10, 0)).toBe(10)
    expect(computeAvailableStock(1, 0)).toBe(1)
  })
  it("delno rezervirana: available = stock − reserved", () => {
    expect(computeAvailableStock(10, 3)).toBe(7)
    expect(computeAvailableStock(5, 2)).toBe(3)
  })
  it("vsa rezervirana → 0 (razprodano)", () => {
    expect(computeAvailableStock(5, 5)).toBe(0)
  })
  it("nula zaloge, nič rezervacij → 0", () => {
    expect(computeAvailableStock(0, 0)).toBe(0)
  })
  it("rezervirano presega zalogo → clamp na 0 (ne gre v negativ)", () => {
    expect(computeAvailableStock(3, 5)).toBe(0)
    expect(computeAvailableStock(10, 12)).toBe(0)
  })
  it("neveljavni vnosi (NaN/Infinity) → 0 (fail-safe)", () => {
    expect(computeAvailableStock(NaN, 0)).toBe(0)
    expect(computeAvailableStock(10, Number.POSITIVE_INFINITY)).toBe(0)
  })
  it("decimalni vnosi se zaokrožijo navzdol (floor) → nikoli negativni", () => {
    expect(computeAvailableStock(10.9, 3.2)).toBe(7)
    expect(computeAvailableStock(1.9, 2.1)).toBe(0)
  })
})
