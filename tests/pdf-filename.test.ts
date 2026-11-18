import { describe, it, expect } from "vitest"
import { safePdfFilename } from "@/lib/documents/pdf"

// Ime datoteke se uporabi v glavi Content-Disposition. Testi zaklepajo
// lastnost, da izhod nikoli ne vsebuje narekovajev, novih vrstic ali
// ne-ASCII znakov — ne glede na to, kaj vnese uporabnik v naslov dokumenta.
describe("safePdfFilename", () => {
  it("ohrani berljivo ime za običajen slovenski naslov", () => {
    expect(safePdfFilename("RAČ-2026-001", "Račun za storitve")).toBe(
      "Racun-za-storitve-RAC-2026-001.pdf"
    )
  })

  it("odstrani narekovaje in novo vrstico (header injection)", () => {
    const name = safePdfFilename('A"B\nC', 'Naslov "zlonamerno"\r\nX-Evil: 1')
    expect(name).not.toMatch(/["\r\n]/)
    expect(name.endsWith(".pdf")).toBe(true)
  })

  it("prevede šumnike in ne-ASCII znake v varen ASCII", () => {
    const name = safePdfFilename("ČŠŽ-1", "Šivilja – ženska obleka")
    expect(name).toMatch(/^[a-zA-Z0-9._-]+\.pdf$/)
  })

  it("nikoli ne vrne praznega imena", () => {
    expect(safePdfFilename("", "")).toBe("dokument.pdf")
    expect(safePdfFilename("///", "!!!")).toBe("dokument.pdf")
  })

  it("omeji dolžino imena", () => {
    const name = safePdfFilename("X".repeat(400), "Y".repeat(400))
    expect(name.length).toBeLessThanOrEqual(124)
  })
})
