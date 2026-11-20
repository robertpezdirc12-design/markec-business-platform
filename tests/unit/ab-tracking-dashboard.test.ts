import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// A/B tracking + dashboard regresija (runtime //xeno).
// Ščiti: (1) server actions za VIEW/CONVERSION dogodke,
// (2) booking-form pošilja oboje (view na mount, conversion ob
// oddaji), (3) admin dashboard za metrike obstaja.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

describe("A/B tracking + dashboard", () => {
  it("server actions beležijo VIEW in CONVERSION v BookingExperimentEvent", () => {
    const a = read("src/app/actions/ab-tracking.ts")
    expect(a).toContain('"use server"')
    expect(a).toContain("trackBookingView")
    expect(a).toContain("trackBookingConversion")
    expect(a).toContain("bookingExperimentEvent.create")
    expect(a).toContain('kind: "VIEW"')
    expect(a).toContain('kind: "CONVERSION"')
    expect(a).toContain("__ab") // session cookie
  })

  it("booking-form kliče VIEW na mount + CONVERSION ob oddaji", () => {
    const b = read("src/components/booking/booking-form.tsx")
    expect(b).toContain("trackBookingView")
    expect(b).toContain("trackBookingConversion")
    expect(b).toContain("trackBookingView({ organizationId, variant: abVariant")
    expect(b).toContain("trackBookingConversion")
  })

  it("varianta (short) upravlja notes polje, server page jo določa", () => {
    const step = read("src/components/booking/steps/customer-info-step.tsx")
    expect(step).toContain('variant = "full"')
    expect(step).toContain('const showNotesField = variant !== "short"')
    const page = read("src/app/(customer)/booking/page.tsx")
    expect(page).toContain("getBookingABVariant(org?.id)")
    expect(page).toContain("abVariant={abVariant}")
    expect(page).toContain("organizationId={org?.id}")
  })

  it("admin experiments dashboard agregira varianto/views/konverzijo", () => {
    const d = read("src/app/(admin)/dashboard/experiments/page.tsx")
    expect(d).toContain("bookingExperimentEvent.groupBy")
    expect(d).toContain('by: ["variant", "kind"]')
    expect(d).toContain("Konverzija")
    expect(d).toContain("_count._all")
  })

  it("Prisma model BookingExperimentEvent + enum obstajata", () => {
    const s = read("prisma/schema.prisma")
    expect(s).toContain("model BookingExperimentEvent")
    expect(s).toContain("enum BookingExperimentKind")
    expect(s).toContain("kind      BookingExperimentKind")
    expect(s).toContain("VIEW")
    expect(s).toContain("CONVERSION")
  })
})