// ============================================================
// GOOGLE KOLEDAR — PRESLIKAVA TERMINA V DOGODEK (čista logika)
//
// Tu ni nobenega omrežja in nobene baze: vhod je termin, izhod je
// telo za Google Calendar API. Zato je ta del mogoče testirati brez
// Googlovih poverilnic — in prav to je bil razlog, da je ločen od
// `google.ts` (ki dela `fetch`).
//
// Pravila, ki jih določimo TU in ne v UI:
// * naslov dogodka = storitve + stranka (lastnik v koledarju takoj ve,
//   za kaj gre, ne da bi odprl dogodek),
// * termin, ki je PREKLICAN, se iz koledarja ODSTRANI (ne pusti
//   "duha" v koledarju, ki bi lastniku lagal, da termin še stoji),
// * id termina gre v `extendedProperties.private`, da dogodek lahko
//   povežemo nazaj tudi, če izgubimo lokalni `googleEventId`.
// ============================================================

/** Statusi, ki jih izvažamo v koledar. */
export const PUSHED_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const

/** Ali termin sploh sodi v koledar? */
export function shouldPushStatus(status: string): boolean {
  return (PUSHED_STATUSES as readonly string[]).includes(status)
}

/** Ali je treba dogodek iz koledarja odstraniti (termin preklican)? */
export function shouldRemoveEvent(status: string): boolean {
  return status === "CANCELLED"
}

export interface CalendarEventInput {
  id: string
  startTime: Date
  endTime: Date
  status: string
  notes?: string | null
  guestName?: string | null
  guestEmail?: string | null
  guestPhone?: string | null
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  staffName?: string | null
  serviceNames: string[]
}

export interface CalendarEventContext {
  businessName: string
  timeZone: string
  location?: string | null
}

export interface GoogleCalendarEvent {
  summary: string
  description: string
  location?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  extendedProperties: { private: Record<string, string> }
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim()
}

/** Naslov dogodka: "Striženje, Barvanje — Ana Novak". */
export function eventSummary(input: CalendarEventInput): string {
  const services = input.serviceNames.map(clean).filter(Boolean)
  const who = clean(input.customerName) || clean(input.guestName)
  const servicePart = services.length > 0 ? services.join(", ") : "Termin"
  return who ? `${servicePart} — ${who}` : servicePart
}

/** Opis dogodka: kontakt stranke, izvajalec, opombe. */
export function eventDescription(input: CalendarEventInput, ctx: CalendarEventContext): string {
  const name = clean(input.customerName) || clean(input.guestName)
  const email = clean(input.customerEmail) || clean(input.guestEmail)
  const phone = clean(input.customerPhone) || clean(input.guestPhone)
  const lines = [
    ctx.businessName,
    name ? `Stranka: ${name}` : null,
    phone ? `Telefon: ${phone}` : null,
    email ? `E-pošta: ${email}` : null,
    input.staffName ? `Izvajalec: ${input.staffName}` : null,
    input.notes ? `Opombe: ${input.notes}` : null,
    `MARKEC #${input.id}`,
  ].filter((line): line is string => Boolean(line))
  return lines.join("\n")
}

/**
 * Ali naj termin, ki se je končal že pred časom `now`, dobi NOV dogodek?
 * Ne: povezava se pogosto vklopi na obstoječi salonski zgodovini in
 * koledar ne sme biti zasut s termini iz preteklosti. Že izvožen
 * dogodek (`googleEventId`) se vseeno posodobi ali odstrani — takrat
 * uporabnik ve, da dogodek obstaja.
 */
export function shouldSkipPastEvent(input: {
  endTime: Date
  googleEventId: string | null
  now?: Date
}): boolean {
  if (input.googleEventId) return false
  return input.endTime.getTime() < (input.now ?? new Date()).getTime()
}

/**
 * Telo dogodka za Google Calendar API. `dateTime` je ISO 8601 z
 * `timeZone` poleg — Google takrat NE ugiba po brskalniku, ampak
 * upošteva časovni pas salona (nujno za poletni/zimski čas).
 */
export function toGoogleEvent(
  input: CalendarEventInput,
  ctx: CalendarEventContext
): GoogleCalendarEvent {
  return {
    summary: eventSummary(input),
    description: eventDescription(input, ctx),
    ...(ctx.location ? { location: ctx.location } : {}),
    start: { dateTime: input.startTime.toISOString(), timeZone: ctx.timeZone },
    end: { dateTime: input.endTime.toISOString(), timeZone: ctx.timeZone },
    extendedProperties: { private: { markecAppointmentId: input.id } },
  }
}

