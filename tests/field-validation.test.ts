// ============================================================
// EPIC #1 Phase 7 — shared dynamic field validation (§8, §17)
// ONE validation implementation guards every dynamic surface
// (public inquiry form, extension record registry). The client
// can never inject unknown fields, wrong types or unlisted
// select options — these tests lock that in.
// ============================================================

import { describe, it, expect } from "vitest"
import { validateFieldValues, deriveRecordTitle } from "@/lib/field-validation"

const fields = [
  { key: "name", label: "Ime", type: "text", required: true },
  { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
  { key: "honey_type", label: "Vrsta", type: "select", required: true, options: ["Lipov med", "Gozdni med"] },
  { key: "harvest_date", label: "Datum", type: "date", required: false },
  { key: "organic", label: "Ekološko", type: "checkbox", required: false },
  { key: "notes", label: "Opombe", type: "textarea", required: false },
]

describe("validateFieldValues", () => {
  it("accepts a full valid submission with typed cleaning", () => {
    const { errors, clean } = validateFieldValues(fields, {
      name: "Med 2026",
      quantity_kg: "42.5",
      honey_type: "Lipov med",
      harvest_date: "2026-07-15",
      organic: "on",
      notes: "  dobava do konca meseca  ",
    })
    expect(errors).toEqual({})
    expect(clean).toEqual({
      name: "Med 2026",
      quantity_kg: 42.5, // number, not string
      honey_type: "Lipov med",
      harvest_date: "2026-07-15",
      organic: true, // checkbox coerced
      notes: "dobava do konca meseca", // trimmed
    })
  })

  it("rejects missing required fields with per-field errors", () => {
    const { errors } = validateFieldValues(fields, {})
    expect(errors).toEqual({
      name: "required",
      quantity_kg: "required",
      honey_type: "required",
    })
  })

  it("REJECTS fields the client injected that are not in the definition (§17)", () => {
    const { clean } = validateFieldValues(fields, {
      name: "X",
      quantity_kg: 1,
      honey_type: "Gozdni med",
      injected_admin_field: "pwned",
      organizationId: "other-tenant",
    })
    expect(clean).not.toHaveProperty("injected_admin_field")
    expect(clean).not.toHaveProperty("organizationId")
  })

  it("rejects non-numeric values for number fields", () => {
    const { errors } = validateFieldValues(fields, {
      name: "X",
      quantity_kg: "abc",
      honey_type: "Gozdni med",
    })
    expect(errors.quantity_kg).toBe("number")
  })

  it("rejects select values outside the allowed options", () => {
    const { errors } = validateFieldValues(fields, {
      name: "X",
      quantity_kg: 1,
      honey_type: "Navadni sladkor",
    })
    expect(errors.honey_type).toBe("option")
  })

  it("rejects invalid dates", () => {
    const { errors } = validateFieldValues(fields, {
      name: "X",
      quantity_kg: 1,
      honey_type: "Gozdni med",
      harvest_date: "not-a-date",
    })
    expect(errors.harvest_date).toBe("date")
  })

  it("allows optional fields to be empty", () => {
    const { errors, clean } = validateFieldValues(fields, {
      name: "X",
      quantity_kg: 1,
      honey_type: "Gozdni med",
    })
    expect(errors).toEqual({})
    expect(clean).not.toHaveProperty("notes")
  })
})

describe("deriveRecordTitle", () => {
  it("prefers the first REQUIRED text/select value", () => {
    const title = deriveRecordTitle(
      fields,
      { name: "Med 2026", honey_type: "Lipov med" },
      "Serija"
    )
    expect(title).toBe("Med 2026")
  })

  it("falls back to the entity name when nothing usable is present", () => {
    const title = deriveRecordTitle(fields, {}, "Serija / lot")
    expect(title).toBe("Serija / lot")
  })
})

// Faza 2B — entityReference type-clean (existence/org-scope je server-side v
// records.ts; tukaj se potrdi le, da je vrednost string id oz. null/izpust).
describe("entityReference field (Type-clean)", () => {
  const refFields = [
    { key: "colony_ref", label: "Čebelja družina", type: "entityReference", required: false, referenceTo: { extensionId: "bee-apiary", entityKey: "colony" } },
    { key: "apiary_ref", label: "Panjska postaja", type: "entityReference", required: true, referenceTo: { extensionId: "bee-apiary", entityKey: "apiary" } },
  ] as const

  it("sprejme veljaven id kot string (brez napake)", () => {
    const { errors, clean } = validateFieldValues(refFields, {
      colony_ref: "cmw1id000000000000000001",
      apiary_ref: "cmw1id000000000000000002",
    })
    expect(errors).toEqual({})
    expect(clean.colony_ref).toBe("cmw1id000000000000000001")
    expect(clean.apiary_ref).toBe("cmw1id000000000000000002")
  })

  it("optional reference lahko ostane prazna/null", () => {
    const { errors, clean } = validateFieldValues(refFields, {
      colony_ref: null,
      apiary_ref: "cmw1id000000000000000003",
    })
    expect(errors).toEqual({})
    // Prazna neobvezna vrednost se prezre (ključ ni napisan; server ga
    // interpretira kot "brez povezave").
    expect(clean).not.toHaveProperty("colony_ref")
    expect(clean.apiary_ref).toBe("cmw1id000000000000000003")
  })

  it("required reference neprazna (prazno → required error)", () => {
    const { errors } = validateFieldValues(refFields, { apiary_ref: "" })
    expect(errors.apiary_ref).toBe("required")
  })

  it("prečisti/omeji preveč dolg id", () => {
    const { clean } = validateFieldValues(refFields, {
      colony_ref: "x".repeat(500),
      apiary_ref: "cmw1id000000000000000004",
    })
    // preverimo samo, da je omejena dolžina (robustnost ne sme vrči)
    expect(clean.colony_ref).toHaveLength(200)
  })

  it("multi-target (referenceTo niz) — sprejme objekt {id, extensionId, entityKey}", () => {
    const multi = [
      { key: "target_ref", label: "Tarča", type: "entityReference", required: false, referenceTo: [
        { extensionId: "bee-apiary", entityKey: "apiary" },
        { extensionId: "bee-apiary", entityKey: "hive" },
        { extensionId: "bee-apiary", entityKey: "colony" },
      ] },
    ] as const
    const { errors, clean } = validateFieldValues(multi, {
      target_ref: { id: "cmw1id000000000000000009", extensionId: "bee-apiary", entityKey: "colony" },
    })
    expect(errors).toEqual({})
    expect(clean.target_ref).toEqual({ id: "cmw1id000000000000000009", extensionId: "bee-apiary", entityKey: "colony" })
  })

  it("multi-target — napačen format (string v multi polju) → napaka, ni tihega sprejema", () => {
    const multi = [
      { key: "target_ref", label: "Tarča", type: "entityReference", required: false, referenceTo: [
        { extensionId: "bee-apiary", entityKey: "apiary" },
        { extensionId: "bee-apiary", entityKey: "hive" },
      ] },
    ] as const
    const { errors } = validateFieldValues(multi, { target_ref: "cmw1id-string-not-obj" })
    expect(errors.target_ref).toBe("INVALID_REFERENCE")
  })
})
