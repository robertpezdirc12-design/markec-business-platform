// P0 (audit 2026-11) — žeton za ponastavitev gesla se hrani HASHIRAN.
//
// Pred tem je bil `User.resetToken` v čistini: kopija baze (backup, replika,
// poljuben SELECT) je pomenila prevzem kateregakoli računa, ker je žeton edini
// dokaz za zamenjavo gesla. Testi zaklepajo pogodbo modula, na katerem stoji
// `forgotPassword`/`resetPassword`.
import { describe, expect, it } from "vitest"
import {
  hashResetToken,
  resetTokenLookupValues,
  resetTokenMatches,
} from "@/lib/auth/reset-token"

const RAW = "3f8a1c0d9b7e5f2a4c6d8e0b1a3f5c7d9e1b3a5c"

describe("hashResetToken", () => {
  it("vrne SHA-256 hex (64 znakov) in ni enak surovemu žetonu", () => {
    const h = hashResetToken(RAW)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toBe(RAW)
  })

  it("je determinističen (isti žeton → isti hash) in različen za različne žetone", () => {
    expect(hashResetToken(RAW)).toBe(hashResetToken(RAW))
    expect(hashResetToken(`${RAW}x`)).not.toBe(hashResetToken(RAW))
  })
})

describe("resetTokenLookupValues", () => {
  it("najprej poišče hash, nato surovo vrednost (prehodno stanje)", () => {
    const values = resetTokenLookupValues(RAW)
    expect(values).toEqual([hashResetToken(RAW), RAW])
  })

  it("nikoli ne vrne podvojene vrednosti (Set semantika)", () => {
    for (const raw of [RAW, hashResetToken(RAW), "x", ""]) {
      const values = resetTokenLookupValues(raw)
      expect(new Set(values).size).toBe(values.length)
      expect(values[0]).toBe(hashResetToken(raw))
    }
  })
})

describe("resetTokenMatches", () => {
  it("sprejme novo obliko (shranjen hash)", () => {
    expect(resetTokenMatches(hashResetToken(RAW), RAW)).toBe(true)
  })

  it("sprejme staro obliko (shranjena čistina) — vrstice iz prejšnjih izdaj", () => {
    expect(resetTokenMatches(RAW, RAW)).toBe(true)
  })

  it("zavrne napačen žeton, prazno shranjeno vrednost in prazen vnos", () => {
    expect(resetTokenMatches(hashResetToken("drug-žeton"), RAW)).toBe(false)
    expect(resetTokenMatches(null, RAW)).toBe(false)
    expect(resetTokenMatches("", RAW)).toBe(false)
    expect(resetTokenMatches(hashResetToken(RAW), "")).toBe(false)
  })

  it("zavrne tudi hash drugega žetona enake dolžine (ne le po dolžini)", () => {
    const other = resetTokenLookupValues("a".repeat(RAW.length))[0]
    expect(resetTokenMatches(other, RAW)).toBe(false)
  })
})
