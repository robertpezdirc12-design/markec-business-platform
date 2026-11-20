import { describe, it, expect } from "vitest"
import { computeWarrantyStatus } from "../src/lib/warranty-logic"
import { warrantyDefaultsForProfile } from "../src/lib/types/warranty"

const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-01-15T00:00:00Z")

function input(over: Partial<Parameters<typeof computeWarrantyStatus>[0]> = {}) {
  return {
    validUntil: new Date(now.getTime() + 200 * DAY), // dlje kot 30 dni → ACTIVE
    validUntilMileage: null,
    currentMileageKm: null,
    declared: "ACTIVE",
    hasOpenClaim: false,
    now,
    ...over,
  }
}

describe("computeWarrantyStatus (Faza 2 garancije)", () => {
  it("ACTIVE za dolgo veljavno garancijo brez reklamacije", () => {
    expect(computeWarrantyStatus(input())).toBe("ACTIVE")
  })

  it("EXPIRED ko je validUntil pretekel", () => {
    const s = computeWarrantyStatus(input({ validUntil: new Date(now.getTime() - 1 * DAY) }))
    expect(s).toBe("EXPIRED")
  })

  it("EXPIRING_SOON ko ostane manj kot 30 dni", () => {
    const s = computeWarrantyStatus(input({ validUntil: new Date(now.getTime() + 10 * DAY) }))
    expect(s).toBe("EXPIRING_SOON")
  })

  it("CLAIMED ko je odprta reklamacija (tudi če datum še aktiven)", () => {
    const s = computeWarrantyStatus(input({ hasOpenClaim: true }))
    expect(s).toBe("CLAIMED")
  })

  it("mehanika: kilometraža preklene datum (kar prej nastopi)", () => {
    // validUntil daleč, ampak kilometrina že dosežena → EXPIRED
    const s = computeWarrantyStatus(
      input({
        validUntil: new Date(now.getTime() + 200 * DAY),
        validUntilMileage: 10000,
        currentMileageKm: 12000,
      })
    )
    expect(s).toBe("EXPIRED")
  })

  it("mehanika: kilometraža pod mejo + veljaven datum → ACTIVE", () => {
    const s = computeWarrantyStatus(
      input({ validUntilMileage: 10000, currentMileageKm: 5000 })
    )
    expect(s).toBe("ACTIVE")
  })
})

describe("warrantyDefaultsForProfile (F2 §3.3)", () => {
  it("mehanik: 180 dni ali 10.000 km", () => {
    const d = warrantyDefaultsForProfile("tire-service")
    expect(d.periodDays).toBe(180)
    expect(d.mileageLimitKm).toBe(10000)
  })
  it("šiviljstvo: 90 dni", () => {
    expect(warrantyDefaultsForProfile("seamstress").periodDays).toBe(90)
  })
  it("čebelarstvo: 2 leti (zakonsko)", () => {
    expect(warrantyDefaultsForProfile("beekeeping").periodDays).toBe(365 * 2)
  })
  it("neznan profil → varno falthrough 90 dni", () => {
    expect(warrantyDefaultsForProfile("nepoznan").periodDays).toBe(90)
  })
  it("oblačilna delavnica: 90 dni (napake v izdelavi)", () => {
    expect(warrantyDefaultsForProfile("apparel").periodDays).toBe(90)
  })
  it("tetovirni studio: 30 dni (popolnitev/barva)", () => {
    expect(warrantyDefaultsForProfile("tattoo-studio").periodDays).toBe(30)
  })
})