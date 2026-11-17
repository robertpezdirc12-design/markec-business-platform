import { describe, it, expect } from "vitest"
import { buildWorkOrderTitle, parseFormDueDate } from "@/lib/work-orders/form-mapping"
import { allowVerificationFallback } from "@/lib/email/config"

// ============================================================
// Regresijski testi — QA šiviljskega toka (2026-11-18)
//
// Ozadje: povpraševanje šivilje je vsebovalo polja garment_type, material,
// modifications in deadline. Naslov delovnega naročila je vzel PRVO
// besedilno vrednost, zato je naročilo dobilo ime
// »Podrobnosti naročila: 2026-12-05«, rok pa se sploh ni prenesel
// (naročilo je kazalo »Rok: —«).
// ============================================================

describe("buildWorkOrderTitle", () => {
  it("uporabi predmet naročila namesto datuma", () => {
    const title = buildWorkOrderTitle(
      {
        deadline: "2026-12-05",
        garment_type: "Hlače",
        material: "Volna",
        modifications: "Skrajšati za 5 cm.",
      },
      "Podrobnosti naročila"
    )
    expect(title).toBe("Hlače")
  })

  it("ne vrne datuma, številke, e-pošte ali URL-ja", () => {
    for (const value of ["2026-12-05", "12", "ana@primer.si", "https://x.si"]) {
      const title = buildWorkOrderTitle(
        { deadline: value, notes: "Popravilo prekinitve" },
        "Obrazec"
      )
      expect(title).toBe("Popravilo prekinitve")
    }
  })

  it("brez uporabnih polj vrne ime obrazca", () => {
    expect(buildWorkOrderTitle({ deadline: "2026-12-05" }, "Merilni list")).toBe(
      "Merilni list"
    )
  })
})

describe("parseFormDueDate", () => {
  it("prebere rok iz polja deadline", () => {
    const date = parseFormDueDate({ deadline: "2026-12-05" })
    expect(date?.toISOString().slice(0, 10)).toBe("2026-12-05")
  })

  it("sprejme tudi due_date in rok", () => {
    expect(parseFormDueDate({ due_date: "2026-12-06" })).toBeInstanceOf(Date)
    expect(parseFormDueDate({ rok: "2026-12-07" })).toBeInstanceOf(Date)
  })

  it("neveljaven ali manjkajoč datum vrne null", () => {
    expect(parseFormDueDate({})).toBeNull()
    expect(parseFormDueDate({ deadline: "" })).toBeNull()
    expect(parseFormDueDate({ deadline: "ni datum" })).toBeNull()
  })
})

describe("allowVerificationFallback", () => {
  it("v produkciji privzeto NE razkrije potrditvene povezave", () => {
    expect(allowVerificationFallback({ NODE_ENV: "production" })).toBe(false)
  })

  it("v razvoju dovoli fallback (e-pošta ni nastavljena)", () => {
    expect(allowVerificationFallback({ NODE_ENV: "development" })).toBe(true)
  })

  it("zastavica EMAIL_VERIFICATION_FALLBACK=1 ga omogoči tudi v produkciji", () => {
    expect(
      allowVerificationFallback({
        NODE_ENV: "production",
        EMAIL_VERIFICATION_FALLBACK: "1",
      })
    ).toBe(true)
  })

  it("zastavica =0 ga izrecno prepove", () => {
    expect(
      allowVerificationFallback({
        NODE_ENV: "development",
        EMAIL_VERIFICATION_FALLBACK: "0",
      })
    ).toBe(false)
  })
})
