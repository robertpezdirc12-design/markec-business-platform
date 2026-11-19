import { describe, it, expect } from "vitest"
import { loginSchema, registerSchema } from "../src/lib/validations/auth"

// ============================================================
// AUTH VALIDATIONS — login sprejme e-pošto ALI uporabniško ime;
// register ima neobvezen username z omejitvami znakov/dolžine.
// ============================================================

describe("loginSchema", () => {
  it("sprejme e-poštni naslov kot login", () => {
    const r = loginSchema.safeParse({ login: "janez@primer.si", password: "geslo123" })
    expect(r.success).toBe(true)
  })

  it("sprejme uporabniško ime kot login (brez @)", () => {
    const r = loginSchema.safeParse({ login: "janez_123", password: "geslo123" })
    expect(r.success).toBe(true)
  })

  it("zavrne prazen login", () => {
    const r = loginSchema.safeParse({ login: "", password: "geslo123" })
    expect(r.success).toBe(false)
  })

  it("zavrne prekratek login (< 3 znaki)", () => {
    const r = loginSchema.safeParse({ login: "ab", password: "geslo123" })
    expect(r.success).toBe(false)
  })
})

describe("registerSchema — username", () => {
  it("dovoli brez username (neobvezno)", () => {
    const r = registerSchema.safeParse({
      name: "Janez",
      email: "janez@primer.si",
      password: "Geslo123abc",
      confirmPassword: "Geslo123abc",
    })
    expect(r.success).toBe(true)
  })

  it("sprejme veljavno uporabniško ime (male črke, številke, podčrtaj)", () => {
    const r = registerSchema.safeParse({
      name: "Janez",
      email: "janez@primer.si",
      username: "janez_123",
      password: "Geslo123abc",
      confirmPassword: "Geslo123abc",
    })
    expect(r.success).toBe(true)
  })

  it("zavrne nedovoljene znake (velike črke, presledki)", () => {
    const r = registerSchema.safeParse({
      name: "Janez",
      email: "janez@primer.si",
      username: "Janez 123",
      password: "Geslo123abc",
      confirmPassword: "Geslo123abc",
    })
    expect(r.success).toBe(false)
  })

  it("zavrne prekratko uporabniško ime (< 3)", () => {
    const r = registerSchema.safeParse({
      name: "Janez",
      email: "janez@primer.si",
      username: "ab",
      password: "Geslo123abc",
      confirmPassword: "Geslo123abc",
    })
    expect(r.success).toBe(false)
  })
})