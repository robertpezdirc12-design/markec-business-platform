// ============================================================
// F5.1 — STREŽNIŠKA VALIDACIJA PROMOCIJ (bela lista polj)
// ============================================================

import { describe, it, expect } from "vitest"
import { parsePromotionServerInput } from "@/lib/promotions/server-schema"

describe("parsePromotionServerInput (create)", () => {
  it("sprejme poln veljaven vnos", () => {
    const res = parsePromotionServerInput(
      {
        name: "Poletje",
        description: "Popust za poletje",
        discountType: "PERCENT",
        discountValue: 20,
        scope: "WHOLE_AMOUNT",
        targetEntityIds: [],
        code: "POLETJE20",
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-08-31T23:59:59.000Z",
        maxRedemptions: 100,
        maxPerCustomer: 1,
        minOrderValue: 30,
      },
      "create"
    )
    expect(res.ok).toBe(true)
  })

  it("zavrne ime brez vrednosti in negativen popust", () => {
    expect(parsePromotionServerInput({ name: "", discountType: "PERCENT", discountValue: 20 }, "create").ok).toBe(false)
    expect(parsePromotionServerInput({ name: "x", discountType: "PERCENT", discountValue: -5 }, "create").ok).toBe(false)
  })

  it("zavrne neveljavno kodo z znaki", () => {
    const res = parsePromotionServerInput(
      { name: "x", discountType: "PERCENT", discountValue: 10, code: "<script>" },
      "create"
    )
    expect(res.ok).toBe(false)
  })

  it("normalizira kodo na velike črke", () => {
    const res = parsePromotionServerInput(
      { name: "x", discountType: "PERCENT", discountValue: 10, code: "summer20" },
      "create"
    )
    if (res.ok) expect(res.data.code).toBe("SUMMER20")
  })
})

describe("parsePromotionServerInput (update)", () => {
  it("pri posodobitvi prepušča SAMO lastniška polja (brez statusa)", () => {
    const res = parsePromotionServerInput(
      { name: "Nov", status: "ACTIVE", discountValue: 10 },
      "update"
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.name).toBe("Nov")
      expect(res.data.status).toBeUndefined()
    }
  })

  it("dovoli delno posodobitev (prazno je veljavno)", () => {
    expect(parsePromotionServerInput({}, "update").ok).toBe(true)
  })
})