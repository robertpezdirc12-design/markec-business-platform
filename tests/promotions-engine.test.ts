// ============================================================
// F5.1 — ENOTNI TESTI PROMO ENGINA (čista logika, brez DB)
//
// Pokriva vse vrste popustov in pravila §4: percent/fixed, scope
// (WHOLE_AMOUNT/PRODUCTS/SERVICES/CATEGORIES), časovno okno, promo
// kodo, minimalno vrednost, ne-negativno ceno in prekrivanje (največ
// ena promocija, največji zmaga).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  bestPromotion,
  buildPromotionSnapshot,
  computeDiscountAmount,
  evaluatePromotion,
  isEligible,
  lineAmount,
  round2,
  type PromotionRule,
  type PricingLine,
} from "@/lib/promotions/engine"

const rule = (over: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "p1",
  organizationId: "org-a",
  name: "Test promo",
  discountType: "PERCENT",
  discountValue: 20,
  scope: "WHOLE_AMOUNT",
  targetEntityIds: [],
  code: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  maxPerCustomer: null,
  minOrderValue: null,
  status: "ACTIVE",
  ...over,
})

// Dve vrstici izdelkov enakega cenovnega profila.
const prod = (id: string, price: number, categoryId = "cat1"): PricingLine => ({
  kind: "product",
  productId: id,
  categoryId,
  amount: price,
  quantity: 1,
})

const serv = (id: string, price: number, categoryId = "catX"): PricingLine => ({
  kind: "service",
  serviceId: id,
  categoryId,
  amount: price,
  quantity: 1,
})

describe("computeDiscountAmount", () => {
  it("percent popust = base * pct / 100, centno zaokrožen", () => {
    const r = rule({ discountValue: 20 })
    expect(computeDiscountAmount(r, [prod("a", 100)] )).toBe(20)
    expect(computeDiscountAmount(r, [prod("a", 19.99)] )).toBe(round2((19.99 * 20) / 100))
  })

  it("percent normalizira nad 100 % na 100 %", () => {
    const r = rule({ discountValue: 150 })
    expect(computeDiscountAmount(r, [prod("a", 100)] )).toBe(100)
  })

  it("fiksni popust nikoli ne preseže osnove (ne-negativna cena)", () => {
    const r = rule({ discountType: "FIXED", discountValue: 500 })
    expect(computeDiscountAmount(r, [prod("a", 30)] )).toBe(30)
  })

  it("ničelna osnova → 0 popusta", () => {
    expect(computeDiscountAmount(rule(), [])).toBe(0)
  })
})

describe("scope / affectedLines", () => {
  const lines = [prod("p1", 10, "c1"), prod("p2", 20, "c2"), serv("s1", 30, "c1")]

  it("WHOLE_AMOUNT pokrije vse vrstice", () => {
    const r = rule({ scope: "WHOLE_AMOUNT" })
    expect(evaluatePromotion(r, lines)?.baseAmount).toBe(60)
  })

  it("PRODUCTS z izbranimi ID-ji pokrije samo te izdelke", () => {
    const r = rule({ scope: "PRODUCTS", targetEntityIds: ["p1"] })
    expect(evaluatePromotion(r, lines)?.baseAmount).toBe(10)
  })

  it("PRODUCTS s prazno listo = vsi izdelki", () => {
    const r = rule({ scope: "PRODUCTS", targetEntityIds: [] })
    expect(evaluatePromotion(r, lines)?.baseAmount).toBe(30)
  })

  it("SERVICES pokrije samo storitve", () => {
    const r = rule({ scope: "SERVICES", targetEntityIds: ["s1"] })
    expect(evaluatePromotion(r, lines)?.baseAmount).toBe(30)
  })

  it("CATEGORIES pokrije izdelke+storitve v izbranih kategorijah", () => {
    const r = rule({ scope: "CATEGORIES", targetEntityIds: ["c1"] })
    expect(evaluatePromotion(r, lines)?.baseAmount).toBe(40)
  })

  it("brez pokritih vrstic → null (ne velja)", () => {
    const r = rule({ scope: "PRODUCTS", targetEntityIds: ["miss"] })
    expect(evaluatePromotion(r, lines)).toBeNull()
  })
})

describe("isEligible — status, okno, minimum", () => {
  const now = new Date("2026-01-15T12:00:00Z")
  const lines = [prod("p1", 100)]

  it("neaktiven / osnutek ne velja", () => {
    expect(isEligible(rule({ status: "INACTIVE" }), lines, now)).toBe(false)
    expect(isEligible(rule({ status: "DRAFT" }), lines, now)).toBe(false)
  })

  it("časovno okno", () => {
    expect(
      isEligible(rule({ startsAt: new Date("2026-01-01"), endsAt: new Date("2026-01-31") }), lines, now)
    ).toBe(true)
    expect(
      isEligible(rule({ startsAt: new Date("2026-02-01") }), lines, now)
    ).toBe(false) // še ni začelo
    expect(
      isEligible(rule({ endsAt: new Date("2026-01-01") }), lines, now)
    ).toBe(false) // poteklo
  })

  it("minimalna vrednost naročila", () => {
    expect(isEligible(rule({ minOrderValue: 50 }), lines, now)).toBe(true)
    expect(isEligible(rule({ minOrderValue: 150 }), lines, now)).toBe(false)
  })
})

describe("bestPromotion — prekrivanje in koda", () => {
  const now = new Date("2026-01-15T12:00:00Z")
  const lines = [prod("p1", 100)]

  it("med avtomatskimi zmaga NAJVEČJI popust (največ ena)", () => {
    const small = rule({ id: "small", discountValue: 5, code: null })
    const big = rule({ id: "big", discountValue: 50, code: null })
    const picked = bestPromotion([small, big], lines, { now })
    expect(picked?.rule.id).toBe("big")
    expect(picked?.discountAmount).toBe(50)
  })

  it("vnesena koda izbere prav to promocijo", () => {
    const coded = rule({ id: "coded", code: "SUMMER20", discountValue: 20 })
    const auto = rule({ id: "auto", discountValue: 40, code: null })
    const picked = bestPromotion([coded, auto], lines, { code: "summer20", now })
    expect(picked?.rule.id).toBe("coded")
    expect(picked?.discountAmount).toBe(20)
  })

  it("tuja/neveljavna koda → null (tudi če minil avtomatski)", () => {
    const auto = rule({ id: "auto", discountValue: 40, code: null })
    expect(bestPromotion([auto], lines, { code: "NOPE", now })).toBeNull()
  })

  it("nepokrita koda ne blokira, če je podan neveljaven code (brez kode → auto)", () => {
    const auto = rule({ id: "auto", discountValue: 40, code: null })
    expect(bestPromotion([auto], lines, { now })?.rule.id).toBe("auto")
  })

  it("nobena ne velja → null", () => {
    expect(bestPromotion([rule({ status: "DRAFT" })], lines, { now })).toBeNull()
  })
})

describe("snapshot & lineAmount", () => {
  it("lineAmount upošteva količino (amount je že × qty), sešteva", () => {
    const lines = [prod("a", 10), { ...prod("b", 20), quantity: 2 }]
    // amount je vrstica (10 in 20) → skupaj 30. Količina je meta.
    expect(lineAmount(lines)).toBe(30)
  })

  it("buildPromotionSnapshot je immutabilna kopija pravil", () => {
    const r = rule({ targetEntityIds: ["x", "y"] })
    const snap = buildPromotionSnapshot(r, {
      baseAmount: 100,
      discountAmount: 20,
      affectedLines: 1,
    })
    expect(snap.promotionId).toBe("p1")
    expect(snap.discountAmount).toBe(20)
    expect(snap.targetEntityIds).toEqual(["x", "y"])
    // Mutacija izvornega arraya ne sme spremeniti posnetka.
    r.targetEntityIds.push("z")
    expect(snap.targetEntityIds).toEqual(["x", "y"])
    expect(typeof snap.appliedAt).toBe("string")
  })
})