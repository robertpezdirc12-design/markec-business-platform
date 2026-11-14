// ============================================================
// RATE LIMIT — čista logika (testirarna brez baze)
// Preveri fiksno okno (floorWindow) in odločitev (decideRateLimit):
//   • novo okno → reset,
//   • v oknu s polnim števcem → block do konca okna,
//   • v oknu s prostorom → increment.
// ============================================================

import { describe, it, expect } from "vitest"
import { floorWindow, decideRateLimit } from "../../src/lib/rate-limit"

const W = 60_000 // 1 minuta v ms
const FLUSH_FLOOR = 60_000 * 30 // nekaj okenc, da je "now" čisto v oknu

describe("floorWindow", () => {
  it("zaokroži dani čas navzdol na začetek okna (minute → sekunda 0)", () => {
    // 1970-01-01 00:01:23.456 znotraj 1-minute okna 00:01:00
    expect(floorWindow(83_456, W).getTime()).toBe(60_000)
  })

  it("vrne isto vrednost, ko je now natanko na meji okna", () => {
    expect(floorWindow(120_000, W).getTime()).toBe(120_000)
  })

  it("je stabilen za večkratnike širine", () => {
    const now = new Date("2026-01-01T12:34:56.789Z").getTime()
    const floored = floorWindow(now, W).getTime()
    expect(floored).toBe(Math.floor(now / W) * W)
  })
})

describe("decideRateLimit", () => {
  const now = Date.now() - FLUSH_FLOOR // svež čas daleč od epoch meja

  it("vrne 'reset', ko vrstica ne obstaja", () => {
    expect(decideRateLimit(null, { limit: 5, windowMs: W, now })).toBe("reset")
  })

  it("vrne 'reset', ko je vrstica iz prejšnjega okna", () => {
    const old = { windowStart: new Date(now - W), count: 999 }
    expect(decideRateLimit(old, { limit: 5, windowMs: W, now })).toBe("reset")
  })

  it("vrne 'increment', ko v oknu še ni dosežen limit", () => {
    const row = { windowStart: new Date(floorWindow(now, W)), count: 2 }
    expect(decideRateLimit(row, { limit: 5, windowMs: W, now })).toBe("increment")
  })

  it("vrne block, ko je dosežen limit, s pozitivnim retryAfterMs do konca okna", () => {
    const row = { windowStart: new Date(floorWindow(now, W)), count: 5 }
    const d = decideRateLimit(row, { limit: 5, windowMs: W, now })
    expect(typeof d).toBe("object")
    if (d !== "reset" && d !== "increment") {
      expect(d.blocked).toBe(true)
      expect(d.retryAfterMs).toBeGreaterThan(0)
      expect(d.retryAfterMs).toBeLessThanOrEqual(W)
    } else {
      expect.fail("pričakovan blok, dobil reset/increment")
    }
  })

  it("mejni primer: zadnji dovoljeni poskus (count === limit - 1) še vrne increment", () => {
    const row = { windowStart: new Date(floorWindow(now, W)), count: 4 }
    expect(decideRateLimit(row, { limit: 5, windowMs: W, now })).toBe("increment")
  })
})