// ============================================================
// P2b (audit 2026-11) — regresijski varovali za preostale
// funkcionalne najdbe (M7, M4, M9, M10, M11, M12).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P2b (M7): odpoved termina obnovi paketno sejo", () => {
  const src = read("src/app/actions/appointments.ts")
  const cancel = src.slice(src.indexOf("export async function cancelAppointment"))

  it("v transakciji poveča sessionsLeft in vrne EXHAUSTED → ACTIVE", () => {
    expect(cancel).toContain("prepaidRedemption.findFirst")
    expect(cancel).toContain("sessionsLeft: { increment: 1 }")
    expect(cancel).toContain('status: "EXHAUSTED"')
    expect(cancel).toContain('data: { status: "ACTIVE" }')
  })

  it("terminalna stanja se ne odpovedujejo znova", () => {
    expect(cancel).toContain('appt.status === "CANCELLED"')
    expect(cancel).toContain('appt.status === "NO_SHOW"')
  })
})

describe("P2b (M4): closeCashSession — transakcija + FOR UPDATE", () => {
  const src = read("src/app/actions/cash-register.ts")
  const close = src.slice(src.indexOf("export async function closeCashSession"))

  it("zaklene sejo (SELECT … FOR UPDATE) in pogojno zapre (status='OPEN')", () => {
    expect(close).toContain("FOR UPDATE")
    expect(close).toContain('status = \'OPEN\'')
    expect(close).toContain("updateMany")
    expect(close).toContain("if (closed.count === 0)")
  })
})

describe("P2b (M9): updateAppointmentStatus — tabela prehodov", () => {
  const src = read("src/app/actions/appointments.ts")
  const fn = src.slice(src.indexOf("export async function updateAppointmentStatus"))

  it("dovoljeni prehodi so definirani in preverjeni", () => {
    expect(fn).toContain("APPOINTMENT_STATUS_TRANSITIONS")
    expect(fn).toContain("terminalni")
    expect(fn).toContain("ni dovoljen")
  })
})

describe("P2b (M10): e-SLOG 2.0 — Quantity na vrsticah", () => {
  const src = read("src/lib/einvoice/eslog20.ts")
  it("izpiše <Quantity unitCode=\"C62\">", () => {
    expect(src).toContain('<Quantity unitCode="C62">')
  })
})

describe("P2b (M11): izdanega dokumenta s plačili ni mogoče preklicati", () => {
  const src = read("src/app/actions/documents.ts")
  const fn = src.slice(src.indexOf("export async function changeDocumentStatus"))

  it("preveri plačila in aktivne avanse pred CANCELLED", () => {
    expect(fn).toContain("documentPayment.count")
    expect(fn).toContain("documentAdvanceAllocation.count")
    expect(fn).toContain('error: "HAS_PAYMENTS"')
  })
})

describe("P2b (M12): materialni stroški — dedup orderIds (brez podvajanja)", () => {
  const src = read("src/app/actions/work-order-costs.ts")
  const fn = src.slice(src.indexOf("export async function calculateMaterialCosts"))

  it("deduplicira orderIds (ponovno izdani dokumenti ne podvojijo stroškov)", () => {
    expect(fn).toContain("new Set(")
    expect(fn).toContain("orderId: { not: null }")
  })
})
