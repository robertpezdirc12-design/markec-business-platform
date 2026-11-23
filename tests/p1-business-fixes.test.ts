// ============================================================
// P1 (audit 2026-11) — regresijski varovali za poslovno-logične
// popravke (S5–S8, M3, M13). Vir-nivojski pregledi, enako kot drugi
// security/architecture testi v repozitoriju.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P1 (S5): opomniki — okno 0–24h", () => {
  it("reminderWindow pokrije celotnih 24h v prihodnost", () => {
    const src = read("src/lib/jobs/reminder-window.ts")
    expect(src).toContain("horizonStart: now")
    expect(src).toContain("24 * 3_600_000")
  })
})

describe("P1 (S6): reschedule — dodatki + vir pod ključavnico", () => {
  const src = read("src/app/actions/appointments.ts")
  const reschedule = src.slice(src.indexOf("export async function rescheduleAppointment"))

  it("trajanje vključuje dodatke iz snapshota", () => {
    expect(reschedule).toContain("addonDuration")
    expect(reschedule).toContain("appointment.addons")
  })

  it("vir se zaklene in preveri pod ključavnico", () => {
    expect(reschedule).toContain(
      "bookingLockKeys(org.id, appointment.staffId, appointment.resourceRecordId)"
    )
    expect(reschedule).toContain("resourceBusy")
  })
})

describe("P1 (S7): stripe fallback — dodatki enako kot webhook", () => {
  const src = read("src/app/actions/stripe.ts")
  const verify = src.slice(src.indexOf("export async function verifyAndCreateAppointment"))

  it("razrešuje addonIds org-scoped iz DB", () => {
    expect(verify).toContain("serviceAddon.findMany")
    expect(verify).toContain("addonDuration")
  })

  it("snapshot dodatkov gre na zapis termina", () => {
    expect(verify).toContain("addons: selectedAddons")
  })
})

describe("P1 (S8): naročila — prehodi + refund zaščita", () => {
  const src = read("src/app/actions/orders.ts")

  it("updateOrderStatus ima tabelo dovoljenih prehodov", () => {
    expect(src).toContain("ORDER_STATUS_TRANSITIONS")
    expect(src).toContain('PAID: ["COMPLETED", "REFUNDED"]')
    expect(src).toContain("REFUNDED: []")
  })

  it("refundOrder blokira PENDING in dvojno vračilo zaloge", () => {
    const refund = src.slice(src.indexOf("export async function refundOrder"))
    expect(refund).toContain('order.status === "PENDING"')
    expect(refund).toContain("existingReturns")
    expect(refund).toContain('source: "RETURN"')
  })
})

describe("P1 (M3): direct-sale — plan limit naročil", () => {
  const src = read("src/app/actions/direct-sale.ts")
  it("vsebuje checkPlanLimit + monthStartUtc", () => {
    expect(src).toContain("checkPlanLimit(getPlan(org.plan), \"orders\", monthOrders)")
    expect(src).toContain("monthStartUtc()")
  })
})

describe("P1 (M13): createWorkspace — materializacija profila", () => {
  const src = read("src/app/actions/workspace-management.ts")
  const create = src.slice(src.indexOf("export async function createWorkspace"))
  it("kliče materializeProfileAssets in seedNewOrgModuleStates", () => {
    expect(create).toContain("materializeProfileAssets(org.id, vertical)")
    expect(create).toContain("seedNewOrgModuleStates(org.id, vertical, null)")
  })
})
