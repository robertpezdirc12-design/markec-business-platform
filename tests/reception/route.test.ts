/**
 * EPIC 5 — testi strežniške rešitve (actions/reception.ts) brez Next DB.
 * `resolveReceptionRequest` je čista (brez prisma) — tukaj preverimo
 * 7 namenov + degradacijo, ko najemnik NI nastavil podatkov (brez
 * telefona/naslova/storitev/ur). To je jedro "bot ne more izmisliti".
 */
import { describe, expect, it } from "vitest"
import {
  resolveReceptionRequest,
  type ReceptionContext,
} from "@/app/actions/reception"

/** Poln kontekst (vse nastavljen). */
function fullCtx(overrides: Partial<ReceptionContext> = {}): ReceptionContext {
  return {
    locale: "sl",
    orgName: "Salon Luna",
    phone: "031 123 456",
    address: "Rožna dolina 5",
    city: "Ljubljana",
    hours: [
      { day: "Ponedeljek", value: "09:00–18:00" },
      { day: "Nedelja", value: "Zaprto" },
    ],
    services: [{ name: "Striž", price: 15, durationMin: 30 }],
    bookingHref: "/s/luna/booking",
    servicesHref: "/s/luna/services",
    ...overrides,
  }
}

describe("resolveReceptionRequest — nameni", () => {
  it("book → akcija na booking", () => {
    const r = resolveReceptionRequest("Želim termin", fullCtx())
    expect(r.intent).toBe("book")
    expect(r.action?.href).toBe("/s/luna/booking")
  })

  it("prices → cenik iz konteksta + akcija na services", () => {
    const r = resolveReceptionRequest("Koliko stane striž?", fullCtx())
    expect(r.intent).toBe("prices")
    expect(r.reply).toContain("Striž")
    expect(r.action?.href).toBe("/s/luna/services")
  })

  it("hours → ure iz konteksta", () => {
    const r = resolveReceptionRequest("Kdaj ste odprti?", fullCtx())
    expect(r.intent).toBe("hours")
    expect(r.reply).toContain("09:00–18:00")
  })

  it("location → naslov + tel akcija", () => {
    const r = resolveReceptionRequest("Kje ste?", fullCtx())
    expect(r.intent).toBe("location")
    expect(r.action?.href).toBe("tel:031123456")
  })

  it("cancel → navodilo + tel akcija", () => {
    const r = resolveReceptionRequest("Mora bi prekljucila termin", fullCtx())
    expect(r.intent).toBe("cancel")
    expect(r.action?.href).toBe("tel:031123456")
  })

  it("waitlist → akcija na booking", () => {
    const r = resolveReceptionRequest("Vpiši me na čakalno listo", fullCtx())
    expect(r.intent).toBe("waitlist")
    expect(r.action?.href).toBe("/s/luna/booking")
  })

  it("nepoznano → help, z predlogi", () => {
    const r = resolveReceptionRequest("Kaj je to?", fullCtx())
    expect(r.intent).toBe("help")
    expect(r.suggested.length).toBeGreaterThan(0)
  })
})

describe("resolveReceptionRequest — degradacija brez podatkov", () => {
  it("brez telefona: help ne omenja telefona in nima akcije", () => {
    const r = resolveReceptionRequest("Kaj je to?", fullCtx({ phone: null }))
    expect(r.reply).not.toContain("031")
    expect(r.action).toBeUndefined()
  })

  it("brez storitev: prices pade na prazno + brez cenika", () => {
    const r = resolveReceptionRequest("Cene?", fullCtx({ services: [] }))
    expect(r.intent).toBe("prices")
    expect(r.reply).not.toContain("Striž")
    // brez storitev → ni akcije na cenik (če je nastavjen telefon, je tel gumb)
    expect(r.action?.href).not.toBe("/s/luna/services")
  })

  it("brez ur: hours pade na prazno (ne izmišlja ur)", () => {
    const r = resolveReceptionRequest("Kdaj ste odprti?", fullCtx({ hours: [] }))
    expect(r.intent).toBe("hours")
    expect(r.reply).not.toContain("09:00")
  })

  it("brez naslova: location pade na prazno (ne izmišlja naslova)", () => {
    const r = resolveReceptionRequest("Kje ste?", fullCtx({ address: null, city: null }))
    expect(r.intent).toBe("location")
    expect(r.reply).not.toContain("Rožna dolina")
  })
})

describe("resolveReceptionRequest — EN", () => {
  it("angleški nameni", () => {
    const r = resolveReceptionRequest("What are your prices?", fullCtx({ locale: "en" }))
    expect(r.intent).toBe("prices")
  })
})
