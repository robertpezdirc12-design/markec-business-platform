// ============================================================
// F5.5.4.6.4 — Enotni testi varnostnega sloja poverilnic + kanalne pogodbe.
//
// Dokazuje: AES-256-GCM round-trip, da se čisti secret NIKOLI ne shrani, da je
// redakcija varna, ter da je validateSubmitPayload strog (nujno za zanesljivo
// pošiljanje). Brez mreže / baze — čista TS.
// ============================================================

import { describe, expect, it } from "vitest"
import { encryptSecret, decryptSecret, redact } from "@/lib/einvoice/secrets"
import { validateSubmitPayload, retryDelayMs, MAX_RETRIES } from "@/lib/einvoice/channel"

// Najvišja neodvisnost: privzeto appKey fallback je AUTH_SECRET ali EINVOICE_SECRET_KEY.
// Za deterministično izvedbo nastavimo EINVOICE_SECRET_KEY samo za te teste.
process.env.EINVOICE_SECRET_KEY = "test-key-that-is-long-enough-0123456789"

describe("F5.5.4.6.4 — secrets.ts (AES-256-GCM)", () => {
  it("round-trip: šifriranje → odšifriranje vrne identičen čisti secret", () => {
    const plain = "super-secret-token-123"
    const enc = encryptSecret(plain)
    expect(enc).not.toContain(plain) // čisti tekst ne sme biti v šifriranem nizu
    expect(enc).toMatch(/^[A-Za-z0-9+/=]+\|[A-Za-z0-9+/=]+\|[A-Za-z0-9+/=]+$/) // iv|tag|cipher
    expect(decryptSecret(enc)).toBe(plain)
  })
  it("različni klici (naključni IV) dajo različne šifratne, vendar isti plain", () => {
    const enc1 = encryptSecret("abc")
    const enc2 = encryptSecret("abc")
    expect(enc1).not.toBe(enc2) // GCM random IV → različen output
    expect(decryptSecret(enc1)).toBe(decryptSecret(enc2))
  })
  it("redact ne razkrije sekreta", () => {
    const s = encryptSecret("my-token-1234")
    expect(redact(s)).not.toContain("my-token")
    expect(redact("")).toBe("")
  })
})

describe("F5.5.4.6.4 — channel.ts (pogodba/idempotency/retry)", () => {
  it("validateSubmitPayload zavrne manjkajoče (recipient rečimo obvezno) in prazno XML", () => {
    const bad = validateSubmitPayload({ einvoiceId: "x", organizationId: "o", docCode: "", format: "UBL21_PEPPOL_3", xml: "", xmlSha256: "123", recipientId: "" })
    expect(bad.ok).toBe(false)
    expect(bad.errors.length).toBeGreaterThanOrEqual(3)
  })
  it("valid payload sprejme", () => {
    const p = {
      einvoiceId: "e1",
      organizationId: "org1",
      docCode: "RAC-1",
      format: "UBL21_PEPPOL_3",
      xml: "<Invoice/>",
      xmlSha256: "a".repeat(64),
      recipientId: "0088:7300010000002",
    }
    expect(validateSubmitPayload(p).ok).toBe(true)
  })
  it("retry backoff je deterministično filter in omejen", () => {
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(3)
    for (let i = 1; i <= 4; i++) {
      const d = retryDelayMs(i)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(8000 + 250)
    }
  })
})