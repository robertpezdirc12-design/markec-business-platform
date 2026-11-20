import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

// U6 — Feedback pri ponovni rezervaciji. Regresijska zaščita: ko je stranka
// prijavljena, server action šteje njene veljavne obiske per strokovnjaka
// (visitCount) in UI pokaže "Ponovni obisk (N× pri X)". Brez prijave se
// število ne izpostavlja; štetje je best-effort in ne sme vreči rezervacije.

const __dirname = dirname(fileURLToPath(import.meta.url))
const actionPath = join(__dirname, "../../src/app/actions/appointments.ts")
const stepPath = join(__dirname, "../../src/components/booking/steps/staff-step.tsx")
const interfacesPath = join(__dirname, "../../src/lib/interfaces.ts")
const bookingPath = join(__dirname, "../../src/lib/i18n/dict/booking.ts")

describe("U6 revisit feedback", () => {
  it("AvailableStaffMember ima opcijski visitCount", async () => {
    const src = await readFile(interfacesPath, "utf8")
    expect(src).toContain("visitCount?: number")
  })

  it("server action šteje obiske per strokovnjaka (brez CANCELLED/NO_SHOW)", async () => {
    const src = await readFile(actionPath, "utf8")
    expect(src).toContain("prisma.appointment.groupBy")
    expect(src).toContain('by: ["staffId"]')
    expect(src).toContain("customerId: customer.id")
    expect(src).toContain('notIn: ["CANCELLED", "NO_SHOW"]')
    expect(src).toContain("staff.visitCount = n")
  })

  it("štetje je best-effort (catch ne vrže rezervacije)", async () => {
    const src = await readFile(actionPath, "utf8")
    expect(src).toContain("// Štetje obiskov je bonusa (best-effort)")
    expect(src).toContain("} catch {")
  })

  it("staff-kartica prikaže badge 'Ponovni obisk' ko je visitCount > 0", async () => {
    const src = await readFile(stepPath, "utf8")
    expect(src).toContain("staff.visitCount ?")
    expect(src).toContain("t.booking.revisit")
    expect(src).toContain("t.booking.revisitCount")
    expect(src).toContain(".replace(\"{count}\", String(staff.visitCount))")
  })

  it("i18n ključa revisit in revisitCount obstajata v obeh jezikih", async () => {
    const src = await readFile(bookingPath, "utf8")
    expect(src).toContain('revisit: "Ponovni obisk"')
    expect(src).toContain('revisitCount: "{count}× pri {name}"')
    expect(src).toContain('revisit: "Returning visit"')
    expect(src).toContain('revisitCount: "{count}× with {name}"')
  })
})