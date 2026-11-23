/**
 * P1 #76 — opomniki 24 h pred terminom (edini sistemski casovnik v izdelku).
 *
 * Dve pravili pomembnejši od kode:
 *
 * 1. AT-LEAST-ONCE, namenoma: `reminderSentAt` se zapiše PO uspešnem
 *    pošiljanju. Če proces pade med pošiljanjem in zapisom, bo naslednji
 *    tek opomnik poslal ponovno — podvojen opomnik je neškodljiv, izpuščen
 *    pa ne. To je dokumentirana odločitev, ne napaka.
 *
 * 2. NIKOLI za CANCELLED / NO_SHOW: statusni filter spodaj je del
 *    pogodbe, ne optimizacija — odpovedani termin ne dobi opomnika.
 *
 * Idempotentnost: `reminderSentAt = null` je ključ — drugi tek ne pošlje
 * ničesar istemu terminu. Okno 0–24 h pred startTime (P1/S5) pomeni, da
 * dnevni cron (03:00 UTC) pokrije VSE termine v naslednjih 24 urah.
 */

import { prisma } from "@/lib/prisma"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendAppointmentReminderEmail } from "@/lib/email/appointment-reminder"
import { formatSalonTime, safeTimezone } from "@/lib/booking-time"
import { reminderWindow } from "@/lib/jobs/reminder-window"
import { buildPushPayload } from "@/lib/push/core"
import { notifyUser } from "@/lib/push/send"
import { sendAppointmentReminderSms } from "@/app/actions/sms"

const BATCH_SIZE = 100

export async function sendDueReminders(now: Date = new Date()): Promise<{
  sent: number
  failed: number
  skipped?: string
  detail?: Record<string, unknown>
}> {
  if (!isEmailServiceConfigured()) {
    // Brez Resend ključa job mirno izstopi — brez izjem, brez retry storma.
    return { sent: 0, failed: 0, skipped: "no-email-transport" }
  }

  const { horizonStart, horizonEnd } = reminderWindow(now)

  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null, // ← idempotentnost
      startTime: { gte: horizonStart, lt: horizonEnd },
    },
    take: BATCH_SIZE, // omejena serija na tek
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { name: true, email: true, userId: true, phone: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true, duration: true } } } },
      organization: {
        select: {
          id: true,
          name: true,
          salonConfig: { select: { timezone: true } },
        },
      },
    },
  })

  let sent = 0
  let failed = 0

  // Posamezen neuspeh ne ustavi serije (allSettled na nivoju TERMINA).
  await Promise.allSettled(
    due.map(async (appt) => {
      const email = appt.customer?.email || appt.guestEmail
      if (!email) {
        // Brez kanala ne moremo opomniti — zapišemo reminderSentAt, da
        // termin ne blokira serije za vedno (opomnik brez naslova ne obstaja).
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSentAt: new Date() },
        })
        return
      }

      const serviceName =
        appt.services.map((s) => s.service.name).join(", ") || "Termin"
      const customerName = appt.customer?.name || appt.guestName || ""
      // Pošiljatelj/identiteta vedno iz ORGANIZACIJE termina — najemniško varno.
      const orgName = appt.organization?.name || "Salon"
      // Čas v LOKALNEM pasu najemnika (ni vsak salon v Ljubljani).
      const tz = safeTimezone(appt.organization?.salonConfig?.timezone)

      const result = await sendAppointmentReminderEmail({
        email,
        customerName,
        serviceName,
        staffName: appt.staff?.name || orgName,
        appointmentDate: appt.startTime,
        appointmentTime: formatSalonTime(appt.startTime, tz),
        duration:
          appt.services.reduce((sum, s) => sum + (s.service.duration ?? 0), 0) ||
          60,
        reminderType: "24h",
      })

      if (result?.success === false) {
        failed += 1
        return
      }

      // #108 — push obvestilo stranki (poleg e-pošte). Best-effort:
      // če stranka nima naročnine ali push ni nastavljen, se tiho preskoči.
      // E-pošta je še vedno primarni kanal — push je dodatna plast.
      if (appt.customer?.userId) {
        await notifyUser(
          appt.customer.userId,
          buildPushPayload("appointment_reminder", {
            date: formatSalonTime(appt.startTime, tz),
          })
        ).catch(() => ({ sent: 0, skipped: true }))
      }

      // #110 — SMS opomnik (poleg e-pošte in push). Best-effort:
      // če stranka nima telefona ali SMS ni nastavljen, se tiho preskoči.
      const customerPhone = appt.customer?.phone || appt.guestPhone
      const orgId = appt.organizationId ?? appt.organization?.id
      if (customerPhone && orgId) {
        await sendAppointmentReminderSms(orgId, {
          serviceName,
          date: appt.startTime,
          customerPhone,
          businessName: orgName,
          timeZone: tz,
        }).catch(() => ({ ok: false }))
      }

      // Zapis šele PO uspešnem pošiljanju (at-least-once, glej zgoraj).
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      })
      sent += 1
    })
  )

  return { sent, failed, detail: { due: due.length, horizonStart, horizonEnd } }
}
