import { describe, it, expect } from "vitest"
import {
  summarizePayments,
  isDepositCovered,
  isPublicToken,
  publicOrderPath,
  newPublicToken,
  PUBLIC_TOKEN_BYTES,
} from "@/lib/work-orders/payment-summary"

// ============================================================
// PREDRAČUN → STRANKA + DENAR NA NAROČILU (2026-11-18)
//
// Denar se ne prepisuje: preostanek = znesek − Σ plačil. Ti testi
// zaklenejo pravila, po katerih UI prikazuje »odprto/plačano« in po
// katerih se odloča, ali je depozit pokrit.
// ============================================================

describe("summarizePayments", () => {
  it("brez zneska je stanje NONE (predračun še ni določen)", () => {
    const s = summarizePayments({ total: null, depositAmount: null, payments: [] })
    expect(s.state).toBe("NONE")
    expect(s.total).toBeNull()
    expect(s.balance).toBe(0)
  })

  it("znesek brez plačil je UNPAID in preostanek = znesek", () => {
    const s = summarizePayments({ total: 45, depositAmount: 20, payments: [] })
    expect(s.state).toBe("UNPAID")
    expect(s.paid).toBe(0)
    expect(s.balance).toBe(45)
  })

  it("delno plačilo je PARTIAL s pravilnim preostankom", () => {
    const s = summarizePayments({ total: 45, depositAmount: 20, payments: [20] })
    expect(s.state).toBe("PARTIAL")
    expect(s.paid).toBe(20)
    expect(s.balance).toBe(25)
  })

  it("polno plačilo je PAID in preostanek 0", () => {
    const s = summarizePayments({ total: 45, depositAmount: 20, payments: [20, 25] })
    expect(s.state).toBe("PAID")
    expect(s.balance).toBe(0)
    expect(s.paid).toBe(45)
  })

  it("preplačilo ne naredi negativnega preostanka", () => {
    const s = summarizePayments({ total: 45, depositAmount: 20, payments: [50] })
    expect(s.state).toBe("PAID")
    expect(s.balance).toBe(0)
    expect(s.paid).toBe(50)
  })

  it("ne izgubi centa pri seštevanju", () => {
    const s = summarizePayments({
      total: 0.3,
      depositAmount: null,
      payments: [0.1, 0.2],
    })
    expect(s.paid).toBe(0.3)
    expect(s.state).toBe("PAID")
    expect(s.balance).toBe(0)
  })

  it("brez zneska a s plačili preostanka ne izmišljuje", () => {
    const s = summarizePayments({ total: null, depositAmount: null, payments: [10] })
    expect(s.state).toBe("NONE")
    expect(s.paid).toBe(10)
    expect(s.balance).toBe(0)
  })
})

describe("isDepositCovered", () => {
  it("depozit je pokrit šele, ko je plačano dovolj", () => {
    expect(isDepositCovered(20, 0)).toBe(false)
    expect(isDepositCovered(20, 19.99)).toBe(false)
    expect(isDepositCovered(20, 20)).toBe(true)
    expect(isDepositCovered(20, 30)).toBe(true)
  })

  it("brez načrtovanega depozita ni nič »pokrito«", () => {
    expect(isDepositCovered(null, 100)).toBe(false)
    expect(isDepositCovered(0, 100)).toBe(false)
  })
})

describe("javni žeton", () => {
  it("nov žeton je 64 znakov hex in prepoznan", () => {
    const token = newPublicToken()
    expect(token).toHaveLength(PUBLIC_TOKEN_BYTES * 2)
    expect(isPublicToken(token)).toBe(true)
  })

  it("vsak klic vrne drug žeton (ni predvidljivega zaporedja)", () => {
    const a = newPublicToken()
    const b = newPublicToken()
    expect(a).not.toBe(b)
  })

  it("zavrne neveljavne žetone (kratek, ne-hex, prazen)", () => {
    expect(isPublicToken("")).toBe(false)
    expect(isPublicToken("abc")).toBe(false)
    expect(isPublicToken("z".repeat(64))).toBe(false)
    expect(isPublicToken(null)).toBe(false)
    expect(isPublicToken(undefined)).toBe(false)
  })

  it("pot povezave je vedno pod najemnikom", () => {
    expect(publicOrderPath("atelje", "a".repeat(64))).toBe(
      `/s/atelje/order/${"a".repeat(64)}`
    )
  })
})
