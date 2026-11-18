/**
 * EPIC 5 — testi čiste jedri recepcionista (intents.ts).
 * Brez baze, brez Next-a: samo razvrščanje in gradnja odgovora.
 */
import { describe, expect, it } from "vitest"
import {
  buildReply,
  classifyIntent,
  normalizeText,
  type ReceptionContext,
} from "@/lib/reception/intents"

function makeCtx(overrides: Partial<ReceptionContext> = {}): ReceptionContext {
  return {
    locale: "sl",
    orgName: "Salon Luna",
    phone: "031 123 456",
    address: "Rožna dolina 5",
    city: "Ljubljana",
    hours: [
      { day: "Ponedeljek", value: "09:00–18:00" },
      { day: "Sobota", value: "09:00–13:00" },
      { day: "Nedelja", value: "Zaprto" },
    ],
    services: [
      { name: "Striž", price: 15, durationMin: 30 },
      { name: "Barvanje", price: 60, durationMin: 90 },
    ],
    bookingHref: "/booking",
    servicesHref: "/services",
    ...overrides,
  }
}

describe("normalizeText", () => {
  it("odstrani dijakritike in zmanjša", () => {
    expect(normalizeText("ŽelEL bi termin")).toBe("zelel bi termin")
    expect(normalizeText("Čaka na uro")).toBe("caka na uro")
  })
})

describe("classifyIntent (SL)", () => {
  it("razpozna rezervacijo", () => {
    expect(classifyIntent("Želim termin", "sl")).toBe("book")
    expect(classifyIntent("Rezerviraj mi uro", "sl")).toBe("book")
    expect(classifyIntent("Imate prost termin v ponedeljek?", "sl")).toBe("book")
    expect(classifyIntent("Bi se lahko dogovorili?", "sl")).toBe("book")
  })

  it("razpozna čakalno listo pred rezervacijo", () => {
    expect(classifyIntent("Ali me lahko vpišete na čakalno listo?", "sl")).toBe(
      "waitlist"
    )
    expect(classifyIntent("Čakalna lista za striž", "sl")).toBe("waitlist")
  })

  it("razpozna cene", () => {
    expect(classifyIntent("Koliko stane striž?", "sl")).toBe("prices")
    expect(classifyIntent("Pokaži cenik", "sl")).toBe("prices")
    expect(classifyIntent("Kakšne imate cene?", "sl")).toBe("prices")
  })

  it("razpozna delovni čas", () => {
    expect(classifyIntent("Kdaj ste odprti?", "sl")).toBe("hours")
    expect(classifyIntent("Kakšne so vaše delovne ure?", "sl")).toBe("hours")
    expect(classifyIntent("Do kdaj ste odprti?", "sl")).toBe("hours")
  })

  it("razpozna lokacijo", () => {
    expect(classifyIntent("Kje se nahajate?", "sl")).toBe("location")
    expect(classifyIntent("Kakšen je naslov?", "sl")).toBe("location")
    expect(classifyIntent("Je mogoče parkirati?", "sl")).toBe("location")
  })

  it("razpozna preklic — in ima prednost pred terminom", () => {
    expect(classifyIntent("Želim preklic termina", "sl")).toBe("cancel")
    expect(classifyIntent("Mora bi prestavila termin", "sl")).toBe("cancel")
    expect(classifyIntent("Odpovem prihodnji obisk", "sl")).toBe("cancel")
  })

  it("razpozna pozdrav", () => {
    expect(classifyIntent("Pozdravljeni", "sl")).toBe("greeting")
    expect(classifyIntent("Dober dan!", "sl")).toBe("greeting")
    expect(classifyIntent("Hvala", "sl")).toBe("greeting")
  })

  it("neznano besedilo → help", () => {
    expect(classifyIntent("Kaj pomeni res?!", "sl")).toBe("help")
    expect(classifyIntent("asdfgh", "sl")).toBe("help")
    expect(classifyIntent("", "sl")).toBe("help")
  })

  it("ne zamenja 'ure' v besedi z namenom ure", () => {
    // 'ure' v 'kulture' ne sme zadeti (besedna meja)
    expect(classifyIntent("V kulture ne gre", "sl")).toBe("help")
  })
})

describe("classifyIntent (EN)", () => {
  it("razpozna namene", () => {
    expect(classifyIntent("I'd like to book an appointment", "en")).toBe("book")
    expect(classifyIntent("What are your prices?", "en")).toBe("prices")
    expect(classifyIntent("When are you open on Saturday?", "en")).toBe("hours")
    expect(classifyIntent("Where are you located?", "en")).toBe("location")
    expect(classifyIntent("I need to cancel my appointment", "en")).toBe("cancel")
    expect(classifyIntent("Put me on the waiting list", "en")).toBe("waitlist")
    expect(classifyIntent("Hello!", "en")).toBe("greeting")
    expect(classifyIntent("What is up?", "en")).toBe("help")
  })
})

describe("buildReply", () => {
  it("book: vabljiv odgovor + gumb na rezervacijo", () => {
    const reply = buildReply("book", makeCtx())
    expect(reply.text).toContain("Salon Luna")
    expect(reply.action).toEqual({ label: "Rezerviraj", href: "/booking" })
    expect(reply.suggested.length).toBeGreaterThan(0)
  })

  it("prices: cenik iz konteksta (iz DB, ne izmišljen)", () => {
    const reply = buildReply("prices", makeCtx())
    expect(reply.text).toContain("Striž")
    expect(reply.text).toContain("Barvanje")
    expect(reply.text).toContain("15")
    expect(reply.action?.href).toBe("/services")
  })

  it("prices: brez storitev — brez cenika, z telefonom", () => {
    const reply = buildReply("prices", makeCtx({ services: [] }))
    expect(reply.text).not.toContain("Striž")
    expect(reply.text).toContain("031 123 456")
  })

  it("hours: ure iz konteksta", () => {
    const reply = buildReply("hours", makeCtx())
    expect(reply.text).toContain("Ponedeljek")
    expect(reply.text).toContain("09:00–18:00")
  })

  it("location: naslov + telefon; brez telefona ni telefona", () => {
    const withPhone = buildReply("location", makeCtx())
    expect(withPhone.text).toContain("Rožna dolina 5")
    expect(withPhone.text).toContain("Ljubljana")
    expect(withPhone.text).toContain("031 123 456")
    expect(withPhone.action?.href).toBe("tel:031123456")

    const noPhone = buildReply("location", makeCtx({ phone: null }))
    expect(noPhone.text).not.toContain("031")
    expect(noPhone.action).toBeUndefined()
  })

  it("cancel: navodilo za prijavljenega + telefon", () => {
    const reply = buildReply("cancel", makeCtx())
    expect(reply.text).toContain("Moji termini")
    expect(reply.action?.href).toBe("tel:031123456")
  })

  it("greeting: pozdrav z imenom najemnika", () => {
    const reply = buildReply("greeting", makeCtx())
    expect(reply.text).toContain("Dobrodošli v Salon Luna")
  })

  it("help: ponudi izbire; brez telefona brez telefona", () => {
    const reply = buildReply("help", makeCtx())
    expect(reply.text).toContain("031 123 456")

    const noPhone = buildReply("help", makeCtx({ phone: null }))
    expect(noPhone.text).not.toContain("031")
    expect(noPhone.action).toBeUndefined()
  })

  it("EN: angleški odgovori", () => {
    const ctx = makeCtx({ locale: "en", bookingHref: "/en/booking" })
    const reply = buildReply("book", ctx)
    expect(reply.text).toContain("Salon Luna")
    expect(reply.action).toEqual({ label: "Book now", href: "/en/booking" })
  })
})
