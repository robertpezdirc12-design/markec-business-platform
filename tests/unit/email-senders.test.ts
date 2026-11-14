// ============================================================
// 2D-5 — HARDENING SENDERS: ko e-poštni servis ni konfiguriran, sme
// posrednik vrniti `notConfigured:true` in NIKOLI ne sme sprožiti
// Resend-401 s placeholder ključem. Preverimo, da se resend.emails.send
// ne kliče in da je rezultat iskren (ne lažni uspeh).
//
// Uporaba (guard):
//   node scripts/run-with-test-db.mjs vitest run tests/unit/email-senders.test.ts
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// Resend botimo — testiramo, da ga posrednik NE kliče, ko ni konfiguriran.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = { send: sendMock }
  },
}))

// Preprečimo branje pravega .env med testom: rezultat mora biti neodvisen.
let savedKey: string | undefined
let savedFrom: string | undefined
beforeAll(() => {
  savedKey = process.env.RESEND_API_KEY
  savedFrom = process.env.RESEND_FROM_EMAIL
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
})
afterAll(() => {
  if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey
  if (savedFrom !== undefined) process.env.RESEND_FROM_EMAIL = savedFrom
})

import { sendVerificationEmail } from "@/lib/email/email-verification"
import { sendPasswordResetEmail } from "@/lib/email/password-reset"
import { sendAccountActivatedEmail } from "@/lib/email/account-activated"

describe("2D-5 — hardening e-poštnih pošiljateljev", () => {
  it("sendVerificationEmail NE sproži Resend-a in vrne notConfigured ob odsotnem ključu", async () => {
    const res = await sendVerificationEmail("a@b.si", "token123")
    expect(res.success).toBe(false)
    expect((res as { notConfigured?: boolean }).notConfigured).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("sendPasswordResetEmail NE sproži Resend-a in vrne notConfigured ob odsotnem ključu", async () => {
    const res = await sendPasswordResetEmail("a@b.si", "token123")
    expect(res.success).toBe(false)
    expect((res as { notConfigured?: boolean }).notConfigured).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("sendAccountActivatedEmail NE sproži Resend-a in vrne notConfigured ob odsotnem ključu", async () => {
    const res = await sendAccountActivatedEmail("a@b.si")
    expect(res.success).toBe(false)
    expect((res as { notConfigured?: boolean }).notConfigured).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })
})