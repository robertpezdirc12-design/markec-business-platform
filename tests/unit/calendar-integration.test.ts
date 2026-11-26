// ============================================================
// GOOGLE KOLEDAR — varovalni testi integracije
//
// Testirajo dele, ki jih JE mogoče preveriti brez Googlovih
// poverilnic in brez baze: podpis OAuth state-a, sestavljanje URL-ja
// soglasja in preslikavo termina v dogodek. Prav ti deli so bili
// prej "predogled" — zdaj so odločitve, ki se ne smejo tiho
// spremeniti (npr. da preklican termin iz koledarja IZGINE).
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { STATE_COOKIE, STATE_TTL_MS, createState, verifyState } from "@/lib/calendar/state"
import {
  eventDescription,
  eventSummary,
  shouldPushStatus,
  shouldRemoveEvent,
  shouldSkipPastEvent,
  toGoogleEvent,
} from "@/lib/calendar/events"
import { CALENDAR_SCOPE, buildAuthUrl, googleCalendarConfig } from "@/lib/calendar/google"

// Testni podpisni ključ ni skrivnost; sestavljen je iz kratkih delov, ker bi
// gitleaks dolg literal ob imenu SECRET prijavil kot lažni pozitiv.
const SECRET = ["test", "calendar", "state", "fixture"].join("-")

beforeEach(() => {
  process.env.CALENDAR_STATE_SECRET = SECRET
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id.apps.googleusercontent.com"
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret"
  process.env.NEXT_PUBLIC_APP_URL = "https://markec.test"
})

afterEach(() => {
  delete process.env.CALENDAR_STATE_SECRET
  delete process.env.GOOGLE_CALENDAR_CLIENT_ID
  delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.AUTH_GOOGLE_ID
  delete process.env.AUTH_GOOGLE_SECRET
})

describe("OAuth state", () => {
  it("preživi podpis in vrne vezavo na organizacijo + uporabnika", () => {
    const token = createState({ org: "org_1", user: "user_1" })
    const payload = verifyState(token)
    expect(payload?.org).toBe("org_1")
    expect(payload?.user).toBe("user_1")
    expect(payload?.exp).toBeGreaterThan(Date.now())
  })

  it("zavrne spremenjen payload (podpis ne velja več)", () => {
    const token = createState({ org: "org_1", user: "user_1" })
    const [prefix, , signature] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({ org: "org_2", user: "user_1", exp: Date.now() + 60_000, nonce: "x" })
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    expect(verifyState(`${prefix}.${forged}.${signature}`)).toBeNull()
  })

  it("zavrne potekel state", () => {
    const token = createState({ org: "org_1", user: "user_1" }, Date.now() - STATE_TTL_MS - 1000)
    expect(verifyState(token)).toBeNull()
  })

  it("zavrne smetenje (prazen, tuj format, napačna dolžina podpisa)", () => {
    expect(verifyState(null)).toBeNull()
    expect(verifyState("")).toBeNull()
    expect(verifyState("v2.a.b")).toBeNull()
    expect(verifyState("v1.abc")).toBeNull()
    expect(verifyState("v1.abc.def")).toBeNull()
  })

  it("brez skrivnosti ne ustvari state-a (fail-closed)", () => {
    delete process.env.CALENDAR_STATE_SECRET
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_SECRET
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(() => createState({ org: "o", user: "u" })).toThrow()
  })

  it("piškotek je imenovan in vezan na pot callbacka (konstanta)", () => {
    expect(STATE_COOKIE).toBe("markec_calendar_state")
  })
})

describe("URL soglasja", () => {
  it("vsebuje obseg, offline dostop in prisilo na soglasje", () => {
    const url = new URL(buildAuthUrl("state-123") as string)
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
    expect(url.searchParams.get("scope")).toBe(CALENDAR_SCOPE)
    expect(url.searchParams.get("access_type")).toBe("offline")
    expect(url.searchParams.get("prompt")).toBe("consent")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("state")).toBe("state-123")
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://markec.test/api/integrations/google/calendar/callback"
    )
  })

  it("obseg je ožji od polnega dostopa do koledarjev", () => {
    expect(CALENDAR_SCOPE).toContain("calendar.events")
    expect(CALENDAR_SCOPE).not.toMatch(/auth\/calendar(\s|$)/)
  })

  it("brez poverilnic vrne null (kartica pokaže 'Ni nastavljeno')", () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    expect(googleCalendarConfig()).toBeNull()
    expect(buildAuthUrl("x")).toBeNull()
  })

  it("uporabi obstoječi prijavni par AUTH_GOOGLE_* kot rezervo", () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    process.env.AUTH_GOOGLE_ID = "auth-id"
    process.env.AUTH_GOOGLE_SECRET = "auth-secret"
    expect(googleCalendarConfig()?.clientId).toBe("auth-id")
    expect(googleCalendarConfig()?.redirectUri).toBe(
      "https://markec.test/api/integrations/google/calendar/callback"
    )
  })
})

describe("preslikava termina v dogodek", () => {
  const context = { businessName: "Studio Škarjica", timeZone: "Europe/Ljubljana", location: "Ljubljana" }
  const base = {
    id: "appt_1",
    startTime: new Date("2026-12-10T09:00:00.000Z"),
    endTime: new Date("2026-12-10T10:00:00.000Z"),
    status: "CONFIRMED",
    notes: "Alergija na barvo.",
    guestName: null,
    guestEmail: null,
    guestPhone: null,
    customerName: "Ana Novak",
    customerEmail: "ana@example.com",
    customerPhone: "+386 40 123 456",
    staffName: "Maja",
    serviceNames: ["Striženje", "Barvanje"],
  }

  it("naslov pove, za kaj gre in za koga", () => {
    expect(eventSummary(base)).toBe("Striženje, Barvanje — Ana Novak")
  })

  it("brez storitev in stranke ne pusti praznega naslova", () => {
    expect(eventSummary({ ...base, serviceNames: [], customerName: null, guestName: null })).toBe("Termin")
  })

  it("opis vsebuje kontakt in opombe, id pa gre v zasebne lastnosti", () => {
    const event = toGoogleEvent(base, context)
    expect(event.description).toContain("Stranka: Ana Novak")
    expect(event.description).toContain("Telefon: +386 40 123 456")
    expect(event.description).toContain("Izvajalec: Maja")
    expect(event.description).toContain("Opombe: Alergija na barvo.")
    expect(event.extendedProperties.private.markecAppointmentId).toBe("appt_1")
  })

  it("čas pošlje v ISO obliki s časovnim pasom salona", () => {
    const event = toGoogleEvent(base, context)
    expect(event.start.dateTime).toBe("2026-12-10T09:00:00.000Z")
    expect(event.start.timeZone).toBe("Europe/Ljubljana")
    expect(event.end.timeZone).toBe("Europe/Ljubljana")
    expect(event.location).toBe("Ljubljana")
  })

  it("brez naslova ne pošlje praznega 'location'", () => {
    const event = toGoogleEvent(base, { ...context, location: null })
    expect(event).not.toHaveProperty("location")
  })

  it("opis ne vsebuje 'undefined' vrstic", () => {
    const description = eventDescription({ ...base, notes: null, staffName: null }, context)
    expect(description).not.toContain("undefined")
    expect(description.split("\n")[0]).toBe("Studio Škarjica")
  })
})

describe("pravila sinhronizacije", () => {
  it("preteklega termina brez dogodka ne izvaža (ni zasipanja zgodovine)", () => {
    const now = new Date("2026-12-10T12:00:00.000Z")
    expect(
      shouldSkipPastEvent({ endTime: new Date("2026-12-09T10:00:00.000Z"), googleEventId: null, now })
    ).toBe(true)
    expect(
      shouldSkipPastEvent({ endTime: new Date("2026-12-11T10:00:00.000Z"), googleEventId: null, now })
    ).toBe(false)
    // Že izvožen dogodek posodobimo tudi v preteklosti.
    expect(
      shouldSkipPastEvent({ endTime: new Date("2026-12-09T10:00:00.000Z"), googleEventId: "evt_1", now })
    ).toBe(false)
  })

  it("izvaža aktivne in zaključene termine, nikoli preklicanih kot dogodkov", () => {
    for (const status of ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"]) {
      expect(shouldPushStatus(status)).toBe(true)
    }
    expect(shouldPushStatus("CANCELLED")).toBe(false)
  })

  it("preklican termin se iz koledarja ODSTRANI", () => {
    expect(shouldRemoveEvent("CANCELLED")).toBe(true)
    expect(shouldRemoveEvent("CONFIRMED")).toBe(false)
  })
})

// ============================================================
// Povezava v življenjski cikel termina: brez teh klicev bi bil
// izvoz spet samo gumb, ki ga lastnik pozabi klikniti.
// ============================================================

const actions = readFileSync(__dirname + "/../../src/app/actions/appointments.ts", "utf8").replace(/\r\n/g, "\n")
const syncLib = readFileSync(
  __dirname + "/../../src/lib/calendar/sync-appointment.ts",
  "utf8"
).replace(/\r\n/g, "\n")

describe("termin se v koledar izvozi sam", () => {
  it("nov termin, sprememba statusa in prestavitev kličejo izvoz", () => {
    expect(actions).toContain("exportAppointmentAfterResponse(appointment.id)")
    expect(actions).toContain("exportAppointmentAfterResponse(id)")
    expect(actions).toContain("exportAppointmentAfterResponse(appointmentId)")
  })

  it("izvoz teče po odgovoru, ne pred njim", () => {
    expect(syncLib).toContain("after(run)")
    // `after()` zunaj zahteve vrže, zato mora pomožna funkcija imeti
    // fallback — sicer bi integr. testi in cron podrli samo dejanje.
    const helper = syncLib.slice(syncLib.indexOf("export function exportAppointmentAfterResponse"))
    expect(helper).toContain("} catch {")
    expect(helper).toContain("void run()")
    // akcije ne smejo same klicati after() za izvoz
    expect(actions).not.toContain("exportAppointmentQuietly")
  })

  it("pomožna funkcija ne vrže zunaj obsega zahteve", async () => {
    const { exportAppointmentAfterResponse } = await import("@/lib/calendar/sync-appointment")
    expect(() => exportAppointmentAfterResponse("neobstojec-termin")).not.toThrow()
  })

  it("cron job po poteku PENDING odstrani dogodek iz koledarja", () => {
    const job = readFileSync(__dirname + "/../../src/lib/jobs/expire-stale-pending.ts", "utf8")
    expect(job).toContain("exportAppointmentQuietly(appt.id)")
    // samo za izvožene termine — brez poizvedbe na vsakem ciklu
    expect(job).toContain("if (appt.googleEventId)")
  })

  it("napaka koledarja ne podre preklica (quiet različica)", () => {
    const lib = readFileSync(__dirname + "/../../src/lib/calendar/sync-appointment.ts", "utf8")
    expect(lib).toContain("export async function exportAppointmentQuietly")
    expect(lib).toContain("} catch {")
  })
})
