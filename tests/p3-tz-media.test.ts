// ============================================================
// P3 (audit 2026-11) — regresijski varovali (M19 staff tz, M15 media).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P3 (M19): staff statistika uporablja časovni pas salona", () => {
  const src = read("src/app/actions/staff.ts")

  it("salonDayBounds uporablja salonConfig.timezone + dayBounds", () => {
    expect(src).toContain("function salonDayBounds")
    expect(src).toContain("salonConfig.findFirst")
    expect(src).toContain("dayBounds(today, tz)")
  })

  it("today/month filtri uporabljajo salon meje (ne server-UTC)", () => {
    expect(src).toContain("bounds?.dayStart")
    expect(src).toContain("bounds?.monthStart")
  })

  it("ne vsebuje več startOfDay/endOfDay/startOfMonth/endOfMonth", () => {
    expect(src).not.toMatch(/\bstartOfDay\b/)
    expect(src).not.toMatch(/\bstartOfMonth\b/)
  })
})

describe("P3 (M15): media izbris — org-scoped DELETE", () => {
  const src = read("src/app/api/media/[id]/route.ts")

  it("obstaja DELETE handler z lastniško preverbo", () => {
    expect(src).toContain("export async function DELETE(")
    expect(src).toContain("organizationMember.findFirst")
    expect(src).toContain("staff.findFirst")
    expect(src).toContain("prisma.media.delete")
  })

  it("neobstoječ ID / nepoblaščen dostop → 404", () => {
    expect(src).toContain('status: 404')
    expect(src).toContain('error: "Not found"')
  })
})
