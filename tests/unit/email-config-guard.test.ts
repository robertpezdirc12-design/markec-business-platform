// ============================================================
// EMAIL GUARD — vsi pošiljatelji morajo biti fail-closed.
//
// Pred tem je bilo utrjenih le 5 od 16 senderjev; ostali so klicali
// `resend.emails.send` s placeholder ključem (401) in
// `from: process.env.RESEND_FROM_EMAIL!` (lahko undefined).
//
// Ta test preveri:
//  1. getEmailConfig() — čisti helper (ključ IN pošiljatelj);
//  2. noben od 16 senderjev ne pokliče Resenda, ko konfiguracija manjka;
//  3. manjkajoč RESEND_FROM_EMAIL kljub veljavnemu ključu ne povzroči klica;
//  4. ko je konfiguracija veljavna, se `from` dejansko posreduje;
//  5. statična invarianta: noben sender ne sme več uporabljati `!`.
// ============================================================

import fs from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock("resend", () => ({
  Resend: class ResendMock {
    emails = { send: sendMock }
  },
}))

// Predloge se ne smejo renderirati v testu; ohranimo vse komponente,
// zamenjamo le `render`, da je test hiter in determinističen.
vi.mock("@react-email/components", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, render: vi.fn(async () => "<html></html>") }
})

import { getEmailConfig, isEmailServiceConfigured } from "@/lib/email/config"
import { sendAppointmentCancelledEmail } from "@/lib/email/appointment-cancelled"
import { sendAppointmentCompletedEmail } from "@/lib/email/appointment-completed"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"
import { sendAppointmentExpiredEmail } from "@/lib/email/appointment-expired"
import { sendAppointmentReminderEmail } from "@/lib/email/appointment-reminder"
import { sendAppointmentRescheduledEmail } from "@/lib/email/appointment-rescheduled"
import { sendBillingReminderEmail } from "@/lib/email/billing-reminder"
import { sendDailyDigestEmail } from "@/lib/email/daily-digest"
import { sendDocumentEmail } from "@/lib/email/document-send"
import { sendGiftCardEmail } from "@/lib/email/gift-card"
import { sendMarketingCampaignEmail } from "@/lib/email/marketing-campaign"
import { sendNoShowNotificationEmail } from "@/lib/email/no-show-notification"
import { sendWaitlistNotifyEmail } from "@/lib/email/waitlist-notify"
import { sendVerificationEmail } from "@/lib/email/email-verification"
import { sendPasswordResetEmail } from "@/lib/email/password-reset"
import { sendAccountActivatedEmail } from "@/lib/email/account-activated"

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
  else delete process.env.RESEND_API_KEY
  if (savedFrom !== undefined) process.env.RESEND_FROM_EMAIL = savedFrom
  else delete process.env.RESEND_FROM_EMAIL
})

beforeEach(() => {
  sendMock.mockReset()
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
})

const d = new Date("2026-01-01T10:00:00Z")
const params = {
  email: "guest@example.test",
  customerName: "Guest",
  serviceName: "Haircut",
  staffName: "Ana",
  appointmentDate: d,
  appointmentTime: "10:00",
  duration: 60,
  totalPrice: 40,
  depositAmount: 10,
  appointmentId: "booking-12345678",
  cancelledByAdmin: true,
  reminderType: "24h" as const,
  oldDate: d,
  oldTime: "09:00",
  newDate: d,
  newTime: "11:00",
  subject: "Test subject",
  body: "Test body",
  businessName: "Salon",
  todayLabel: "Today",
  name: "Guest",
  bookingUrl: "https://example.test/book",
  code: "GIFT-1",
  faceValue: 50,
  productName: "Gift card",
  salonName: "Salon",
  orgName: "Salon",
  plan: "Pro",
  kind: "reminder" as const,
  billingHref: "https://example.test/billing",
  unsubscribeUrl: null,
}

const docParams = {
  toEmail: "guest@example.test",
  docCode: "DOC-1",
  doctype: "invoice",
  customerName: "Guest",
  issuerName: "Salon",
  totalLabel: "40,00 €",
  subject: "Document",
  attachmentBase64: "JVBERi0xLjQ=",
  attachmentFilename: "doc.pdf",
}

type Result = { success?: boolean; notConfigured?: boolean; status?: string }

/** 15 senderjev z enotno obliko rezultata + document-send z `status`. */
const senders: Array<{ name: string; call: () => Promise<Result> }> = [
  { name: "appointment-cancelled", call: () => sendAppointmentCancelledEmail(params) },
  { name: "appointment-completed", call: () => sendAppointmentCompletedEmail(params) },
  { name: "appointment-confirmation", call: () => sendAppointmentConfirmationEmail(params) },
  { name: "appointment-expired", call: () => sendAppointmentExpiredEmail(params) },
  { name: "appointment-reminder", call: () => sendAppointmentReminderEmail(params) },
  { name: "appointment-rescheduled", call: () => sendAppointmentRescheduledEmail(params) },
  { name: "billing-reminder", call: () => sendBillingReminderEmail(params) },
  { name: "daily-digest", call: () => sendDailyDigestEmail(params) },
  { name: "gift-card", call: () => sendGiftCardEmail(params) },
  { name: "marketing-campaign", call: () => sendMarketingCampaignEmail(params) },
  { name: "no-show-notification", call: () => sendNoShowNotificationEmail(params) },
  { name: "waitlist-notify", call: () => sendWaitlistNotifyEmail(params) },
  { name: "email-verification", call: () => sendVerificationEmail(params.email, "tok") },
  { name: "password-reset", call: () => sendPasswordResetEmail(params.email, "tok") },
  { name: "account-activated", call: () => sendAccountActivatedEmail(params.email) },
]

describe("getEmailConfig — čisti helper", () => {
  it("zavrne manjkajoč ključ", () => {
    expect(getEmailConfig({})).toBeNull()
    expect(isEmailServiceConfigured({})).toBe(false)
  })

  it("zavrne placeholder ključ in presledke", () => {
    expect(getEmailConfig({ RESEND_API_KEY: "re_placeholder_not_configured", RESEND_FROM_EMAIL: "a@b.si" })).toBeNull()
    expect(getEmailConfig({ RESEND_API_KEY: "   ", RESEND_FROM_EMAIL: "a@b.si" })).toBeNull()
  })

  it("zavrne veljaven ključ brez pošiljatelja", () => {
    expect(getEmailConfig({ RESEND_API_KEY: "re_live_key", RESEND_FROM_EMAIL: "  " })).toBeNull()
    expect(getEmailConfig({ RESEND_API_KEY: "re_live_key" })).toBeNull()
  })

  it("vrne triman pošiljatelj za veljavno konfiguracijo", () => {
    expect(getEmailConfig({ RESEND_API_KEY: "re_live_key", RESEND_FROM_EMAIL: "  noreply@rcbeautysalon.org  " })).toEqual({
      from: "noreply@rcbeautysalon.org",
    })
  })
})

describe("16/16 senderjev je fail-closed", () => {
  it.each(senders)("$name ne pokliče Resenda brez konfiguracije", async ({ call }) => {
    const res = await call()
    expect(res.success).toBe(false)
    expect(res.notConfigured).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("document-send vrne UNSENT brez konfiguracije", async () => {
    const res = await sendDocumentEmail(docParams)
    expect(res.status).toBe("UNSENT")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("veljaven ključ brez RESEND_FROM_EMAIL še vedno ne pokliče Resenda", async () => {
    process.env.RESEND_API_KEY = "re_live_key"
    delete process.env.RESEND_FROM_EMAIL
    for (const { call } of senders) {
      const res = await call()
      expect(res.success).toBe(false)
      expect(res.notConfigured).toBe(true)
    }
    expect((await sendDocumentEmail(docParams)).status).toBe("FAILED")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("število preverjenih senderjev je 15 + document-send", () => {
    expect(senders).toHaveLength(15)
  })
})

describe("veljavna konfiguracija dejansko pošlje", () => {
  it("pošlje z resolvanim `from` (ne undefined)", async () => {
    process.env.RESEND_API_KEY = "re_live_key"
    process.env.RESEND_FROM_EMAIL = "noreply@rcbeautysalon.org"
    sendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null })

    const res = await sendAppointmentConfirmationEmail(params)
    expect(res.success).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0].from).toBe("noreply@rcbeautysalon.org")

    const waitlist = await sendWaitlistNotifyEmail(params)
    expect(waitlist.success).toBe(true)
    expect(sendMock.mock.calls[1][0].from).toBe("noreply@rcbeautysalon.org")
  })
})

describe("statična invarianta nad src/lib/email", () => {
  it("noben sender ne uporablja RESEND_FROM_EMAIL! in vsak ima config guard", () => {
    const dir = path.resolve(process.cwd(), "src/lib/email")
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "config.ts")
    expect(files.length).toBe(16)
    for (const file of files) {
      const src = fs.readFileSync(path.join(dir, file), "utf8")
      expect(src, `${file} še vedno uporablja RESEND_FROM_EMAIL!`).not.toContain("RESEND_FROM_EMAIL!")
      expect(
        /getEmailConfig\(\)|isEmailServiceConfigured\(\)/.test(src),
        `${file} nima config guarda`
      ).toBe(true)
    }
  })
})
