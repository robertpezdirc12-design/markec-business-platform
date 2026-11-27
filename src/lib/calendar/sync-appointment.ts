// ============================================================
// GOOGLE KOLEDAR — izvoz ENEGA termina
//
// Ena implementacija za vse poti: ročni "Sinhroniziraj zdaj",
// odpoved termina, spremembo statusa in prestavitev. Tako ni dveh
// resnic o tem, kdaj dogodek nastane in kdaj izgine.
//
// Pravila (src/lib/calendar/events.ts):
//   PENDING/CONFIRMED/COMPLETED/NO_SHOW → dogodek ustvari ali posodobi
//   CANCELLED                           → dogodek odstrani
//   vse ostalo                          → nič
//
// Idempotenca: `Appointment.googleEventId` pove, ali gre za prvi izvoz
// (POST) ali posodobitev (PATCH). Če je bil dogodek v Googlu ročno
// izbrisan (404/410 = "gone"), ga ustvarimo znova.
// ============================================================

import { after } from "next/server"

import { prisma } from "@/lib/prisma"
import { getConnection, validAccessToken } from "@/lib/calendar/connection"
import { createEvent, deleteEvent, googleCalendarConfig, updateEvent } from "@/lib/calendar/google"
import {
  shouldPushStatus,
  shouldRemoveEvent,
  shouldSkipPastEvent,
  toGoogleEvent,
} from "@/lib/calendar/events"

export type ExportAction = "created" | "updated" | "removed" | "skipped"
export type ExportOutcome =
  | { ok: true; action: ExportAction }
  | { ok: false; error: string; reason: "no-connection" | "no-token" | "no-config" | "api" }

export const NO_CONNECTION: ExportOutcome = {
  ok: false,
  error: "Google Calendar ni povezan",
  reason: "no-connection",
}

/**
 * Izvozi (ali odstrani) dogodek za en termin. Ne vrže napake — napako
 * vrne v rezultatu, da jo klicatelj lahko šteje ali ignorira.
 */
export async function exportAppointment(appointmentId: string): Promise<ExportOutcome> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      services: { include: { service: { select: { name: true } } } },
      customer: { select: { name: true, email: true, phone: true } },
      staff: { select: { name: true } },
      organization: { select: { id: true, name: true } },
    },
  })
  if (!appointment?.organizationId) {
    return { ok: false, error: "Termin ni povezan s podjetjem", reason: "api" }
  }

  const wantsRemove = shouldRemoveEvent(appointment.status)
  const wantsPush = shouldPushStatus(appointment.status)
  if (!wantsRemove && !wantsPush) return { ok: true, action: "skipped" }
  // Preklic brez izvoženega dogodka nima česa odstraniti.
  if (wantsRemove && !appointment.googleEventId) return { ok: true, action: "skipped" }

  // Zgodovine ne izvažamo: termin, ki se je že končal in še ni bil
  // izvožen, v koledar ne sodi (povezava se pogosto vklopi na starih
  // podatkih). Že izvožen dogodek se vseeno posodobi ali odstrani.
  if (
    shouldSkipPastEvent({
      endTime: appointment.endTime,
      googleEventId: appointment.googleEventId,
    })
  ) {
    return { ok: true, action: "skipped" }
  }

  const connection = await getConnection(appointment.organizationId)
  if (!connection) return NO_CONNECTION
  if (!googleCalendarConfig()) {
    return { ok: false, error: "Google Calendar ni nastavljen na strežniku", reason: "no-config" }
  }

  const accessToken = await validAccessToken(connection)
  if (!accessToken) {
    return {
      ok: false,
      error: "Dostop do koledarja je potekel — povežite Google Calendar znova",
      reason: "no-token",
    }
  }

  if (wantsRemove && appointment.googleEventId) {
    const removed = await deleteEvent(accessToken, connection.calendarId, appointment.googleEventId)
    // "gone" = dogodka že ni, kar je za nas enak izid kot uspešen bris.
    if (!removed.ok && removed.error !== "gone") {
      return { ok: false, error: removed.error, reason: "api" }
    }
    await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: null } })
    return { ok: true, action: "removed" }
  }

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: appointment.organizationId },
    select: { timezone: true, address: true, city: true },
  })
  const body = toGoogleEvent(
    {
      id: appointment.id,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes,
      guestName: appointment.guestName,
      guestEmail: appointment.guestEmail,
      guestPhone: appointment.guestPhone,
      customerName: appointment.customer?.name ?? null,
      customerEmail: appointment.customer?.email ?? null,
      customerPhone: appointment.customer?.phone ?? null,
      staffName: appointment.staff?.name ?? null,
      serviceNames: appointment.services.map((s) => s.service.name),
    },
    {
      businessName: appointment.organization?.name ?? "MARKEC",
      timeZone: config?.timezone || "Europe/Ljubljana",
      location: [config?.address, config?.city].filter(Boolean).join(", ") || null,
    }
  )

  if (appointment.googleEventId) {
    const updated = await updateEvent(accessToken, connection.calendarId, appointment.googleEventId, body)
    if (updated.ok) return { ok: true, action: "updated" }
    if (updated.error !== "gone") return { ok: false, error: updated.error, reason: "api" }
    // Dogodek je izginil iz Googla → ustvarimo novega.
    const recreated = await createEvent(accessToken, connection.calendarId, body)
    if (!recreated.ok) return { ok: false, error: recreated.error, reason: "api" }
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { googleEventId: recreated.value.id },
    })
    return { ok: true, action: "created" }
  }

  const created = await createEvent(accessToken, connection.calendarId, body)
  if (!created.ok) return { ok: false, error: created.error, reason: "api" }
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { googleEventId: created.value.id },
  })
  return { ok: true, action: "created" }
}

/**
 * Različica za `after()`: nikoli ne vrže in nikoli ne blokira odgovora.
 * Uporablja se ob odpovedi/statusu/prestavitvi — koledar je dodatna
 * storitev, zato napaka tam ne sme podreti glavnega dejanja.
 */
export async function exportAppointmentQuietly(appointmentId: string): Promise<void> {
  try {
    await exportAppointment(appointmentId)
  } catch {
    // namerno tiho
  }
}

/**
 * Izvoz po odgovoru strežnika.
 *
 * `after()` obstaja samo znotraj zahteve; integr. testi, cron skripte in
 * CLI orodja tečejo zunaj nje, kjer `after()` vrže ("called outside a
 * request scope") in bi podrl samo dejanje. Takrat izvoz poženemo takoj
 * in ga ne čakamo — napake pogoltne `exportAppointmentQuietly`.
 */
export function exportAppointmentAfterResponse(appointmentId: string): void {
  const run = () => exportAppointmentQuietly(appointmentId)
  try {
    after(run)
  } catch {
    void run()
  }
}
