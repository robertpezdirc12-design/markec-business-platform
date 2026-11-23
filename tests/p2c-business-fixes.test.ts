// ============================================================
// P2c (audit 2026-11) — regresijski varovali (M2, M8, M14).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P2c (M2): platform webhook — zastareli dogodki se zavržejo", () => {
  const src = read("src/app/api/webhooks/platform-stripe/route.ts")
  const fn = src.slice(src.indexOf("async function handleSubscriptionEvent"))

  it("primerja currentPeriodEnd in preskoči stale dostave", () => {
    expect(fn).toContain("snapshotPeriodEnd")
    expect(fn).toContain("localPeriodEnd")
    expect(fn).toContain("stale event")
    expect(fn).toContain("skipping")
  })
})

describe("P2c (M8): ocene — vezava na storitev + ena ocena na uporabnika", () => {
  const src = read("src/app/actions/reviews.ts")
  const fn = src.slice(src.indexOf("export async function createReview"))

  it("ocena za storitev zahteva COMPLETED termin s to storitvijo", () => {
    expect(fn).toContain("hasServicePurchase")
    expect(fn).toContain("services: { some: { serviceId: service.id } }")
  })

  it("dvojna ocena istega uporabnika + storitve je zavrnjena", () => {
    expect(fn).toContain("existingReview")
    expect(fn).toContain("Oceno za to storitev/podjetje ste že oddali.")
  })
})

describe("P2c (M14): registracija — brez enumeracije e-pošte", () => {
  const src = read("src/app/actions/auth.ts")
  const fn = src.slice(src.indexOf("export async function registerUser"))

  it("ne razkrije obstoja računa", () => {
    expect(fn).not.toContain("E-poštni naslov je že registriran.")
    expect(fn).toContain("Registracija ni uspela. Preverite podatke in poskusite znova.")
  })
})
