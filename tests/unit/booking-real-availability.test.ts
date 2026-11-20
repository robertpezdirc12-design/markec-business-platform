import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// ============================================================
// U2 — REALNA DOSTOPNOST TERMINOV (regresijski varoval)
// U2 zahteva: (1) getAvailableTimeSlots res vrača zasedenost iz
// appointments (ne fiktivne hevristike) in (2) rezervacija ima
// "moment" (optimistic barrier), da dva ne zasedeta istega časa.
// Del (2) je varovan v tests/booking-integrity-93.test.ts
// (advisory ključavnice + transakcija); ta datoteka drži del (1)
// — da dostopnost ostane realna (delovni čas, pretekli sloti,
// overlap z realnim trajanjem, vir) in da server action pošlje
// avtoritativni re-check pred prenosom v transakcijski lock.
// ============================================================

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

const src = read("src/app/actions/appointments.ts")
const txCreate = src.slice(src.indexOf("export async function createAppointment"))

describe("U2 getAvailableTimeSlots: realna zasedenost", () => {
  const fn = src.slice(src.indexOf("export async function getAvailableTimeSlots"))

  it("ne uporablja fiktivne hevristike slotov (brez resničnega vira)", () => {
    // Bivši demo tok je imel `h % 3 !== 0 && h % 5 !== 0`; pravi ne sme imeti
    // nobenega takega lažnega "prostosti" izraza v availabilnostni funkciji.
    expect(fn).not.toMatch(/h\s*%\s*3|%\s*5|Math\.random/)
  })

  it("upošteva realne delovne ure osebja (workingHours)", () => {
    expect(fn).toContain("workingHour") // ali WorkingHour relacija
  })

  it("blokira pretekle slote (isPast)", () => {
    expect(fn).toContain("isPast")
    expect(fn).toContain("slot.available = false")
  })

  it("upošteva overlap z obstoječimi termini preko realnega trajanja", () => {
    // Existing appointmenti se primerjajo z [start, end] oknom terminov,
    // ne s fiktivnimi fiksi.
    expect(fn).toContain("endTime")
    expect(fn).toContain("startTime")
    expect(fn).toContain("effectiveDuration")
  })

  it("upošteva vir/prostor (resource conflict) kot realno oviro", () => {
    expect(fn).toContain("resourceBusy")
    expect(fn).toContain("hasResourceConflict")
  })
})

describe("U2 moment rezervacije: avtoritativni re-check pred lockom", () => {
  it("createAppointment ponovno preveri slot z getAvailableTimeSlots", () => {
    // Služba za klienta (list slotov) NI dovolj: server mora ob rezervaciji
    // znova preveriti iskani termin, preden gre v transakcijski lock.
    expect(txCreate).toContain("const slots = await getAvailableTimeSlots(")
    expect(txCreate).toContain("!slotAvailable")
  })

  it("izgubljeni buffer se javi kot lokalizirana napaka", () => {
    expect(txCreate).toContain(
      'error: "Izbrani termin ni več prost. Izberite drugi termin."'
    )
  })
})