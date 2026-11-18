// P2 (audit 2026-11) — šifriranje skrivnosti v mirovanju (AES-256-GCM).
//
// Stripe ključ vsakega salona je bil v bazi v čistini: kopija baze je
// pomenila možnost obračuna na račun salona. Testi zaklepajo: roundtrip,
// prehodno stanje (stare vrstice v čistini), fail-closed brez ključa in
// integriteto (spremenjen ciphertext se ne odpre).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  isSecretsEncryptionEnabled,
} from "@/lib/crypto/secrets"

const KEY = "test-only-encryption-key-0123456789abcdef"
const PLAIN = "sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz"

const original = process.env.SECRETS_ENCRYPTION_KEY

beforeEach(() => {
  process.env.SECRETS_ENCRYPTION_KEY = KEY
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  if (original === undefined) delete process.env.SECRETS_ENCRYPTION_KEY
  else process.env.SECRETS_ENCRYPTION_KEY = original
  vi.restoreAllMocks()
})

describe("encryptSecret / decryptSecret", () => {
  it("roundtrip vrne enako vrednost", () => {
    const enc = encryptSecret(PLAIN)
    expect(enc).not.toContain(PLAIN)
    expect(decryptSecret(enc)).toBe(PLAIN)
  })

  it("vsak zapis ima svoj IV (isti vnos → različen ciphertext)", () => {
    const a = encryptSecret(PLAIN)
    const b = encryptSecret(PLAIN)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(PLAIN)
    expect(decryptSecret(b)).toBe(PLAIN)
  })

  it("zapis je označen z enc:v1: in prepoznan kot šifriran", () => {
    const enc = encryptSecret(PLAIN)
    expect(enc.startsWith("enc:v1:")).toBe(true)
    expect(isEncryptedSecret(enc)).toBe(true)
    expect(isEncryptedSecret(PLAIN)).toBe(false)
  })

  it("ne šifrira dvakrat (že šifriran vnos ostane nespremenjen)", () => {
    const enc = encryptSecret(PLAIN)
    expect(encryptSecret(enc)).toBe(enc)
    expect(decryptSecret(enc)).toBe(PLAIN)
  })

  it("prazne vrednosti in null/undefined obravnava kot prazno", () => {
    expect(encryptSecret("")).toBe("")
    expect(decryptSecret(null)).toBeNull()
    expect(decryptSecret(undefined)).toBeNull()
    expect(decryptSecret("")).toBeNull()
  })
})

describe("prehodno stanje (stare vrstice v čistini)", () => {
  it("nešifrirano vrednost vrne kot je — brez migracije", () => {
    expect(decryptSecret(PLAIN)).toBe(PLAIN)
  })

  it("nešifrirano vrednost vrne tudi, ko ključ NI nastavljen", () => {
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(decryptSecret(PLAIN)).toBe(PLAIN)
    expect(isSecretsEncryptionEnabled()).toBe(false)
  })
})

describe("fail-closed brez ključa", () => {
  it("brez ključa se skrivnost shrani NEŠIFRIRANA (aplikacija mora delovati) + opozorilo", () => {
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(encryptSecret(PLAIN)).toBe(PLAIN)
    expect(console.warn).toHaveBeenCalled()
  })

  it("šifrirane vrednosti brez ključa NE odpre tiho — vrže napako", () => {
    const enc = encryptSecret(PLAIN)
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(() => decryptSecret(enc)).toThrow(/SECRETS_ENCRYPTION_KEY/)
  })
})

describe("integriteta", () => {
  it("spremenjen ciphertext vrže napako (GCM auth tag)", () => {
    const enc = encryptSecret(PLAIN)
    const parts = enc.split(":")
    const ct = parts[4]
    const tampered = [...parts.slice(0, 4), ct.slice(0, -4) + (ct.endsWith("A") ? "BBBB" : "AAAA")].join(":")
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it("pokvarjen zapis (premalo delov) vrže jasno napako", () => {
    expect(() => decryptSecret("enc:v1:onlyone")).toThrow(/pokvarjen/)
  })

  it("drug ključ ne odpre vrednosti", () => {
    const enc = encryptSecret(PLAIN)
    process.env.SECRETS_ENCRYPTION_KEY = "neki-drug-kljuc-0123456789abcdefghij"
    expect(() => decryptSecret(enc)).toThrow()
  })
})
