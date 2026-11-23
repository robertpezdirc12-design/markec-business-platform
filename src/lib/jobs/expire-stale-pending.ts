/**
 * P1 #76 — potekli PENDING termini → CANCELLED (+ e-pošta o preteku).
 *
 * Enaka pravila kot lenobni čiščenje v getAdminAppointments (dashboard),
 * ampak GLOBALNO in ZAŽOGANO: lenobna verzija se sproži šele, ko kdo
 * odpre nadzorno ploščo — najemnik, ki vikend ne odpre dashboarda, je
 * imel zamrznjene PENDING terme tri dni. Ta job je zanesljiva pot,
 * dashboard ostaneta pasovni varovalki.
 *
 * P0 (S4, audit 2026-11): samo PENDING → CANCELLED (potekli termini).
 * Samodejna pretvorba CONFIRMED → NO_SHOW je odstranjena — končanje
 * termina ni dokaz, da stranka ni prišla (in bi sprožilo off-session
 * bremenitev pologa). NO_SHOW nastane izključno ročno prek
 * updateAppointmentStatus.
 */

import { prisma } from "@/lib/prisma"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendAppointmentExpiredEmail } from "@/lib/email/appointment-expired"
import { formatSalonTime, safeTimezone } from "@/lib/booking-time"

const BATCH_SIZE = 100

export async function expireStalePending(
  now: Date = new Date()
): Promise<{ sent: number; failed: number; skipped?: string; detail?: Record<string, unknown> }> {
  if (!isEmailServiceConfigured()) {
    // Tudi brez e-pošte mora stanja čistiti — samo pošiljanje se izpusti.
    const quiet = await cancelStale(now, false)
    return { sent: 0, failed: 0, skipped: "no-email-transport", detail: quiet }
  }

  const detail = await cancelStale(now, true)
  return { sent: detail.notified, failed: detail.notifyFailed, detail }
}

async function cancelStale(
  now: Date,
  notify: boolean
): Promise<{
  cancelled: number
  noShow: number
  notified: number
  notifyFailed: number
  charged: number
  chargeFailed: number
}> {
  // noShow/charged/chargeFailed so trajno 0 (samodejna pretvorba in
  // bremenitev sta odstranjeni) — polja ostajajo za kompatibilnost
  // klicateljev (cron route, dashboard).
  let cancelled = 0
  let notified = 0
  let notifyFailed = 0

  // --- PENDING + endTime v preteklosti → CANCELLED (+ opis o preteku) ---
  const stale = await prisma.appointment.findMany({
    where: { status: "PENDING", endTime: { lt: now } },
    take: BATCH_SIZE,
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
      organization: { select: { salonConfig: { select: { timezone: true } } } },
    },
  })

  await Promise.allSettled(
    stale.map(async (appt) => {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "CANCELLED" },
      })
      cancelled += 1

      const email = appt.customer?.email || appt.guestEmail
      if (notify && email) {
        try {
          const result = await sendAppointmentExpiredEmail({
            email,
            customerName: appt.customer?.name || appt.guestName || "Customer",
            serviceName: appt.services.map((s) => s.service.name).join(", "),
            staffName: appt.staff?.name || "Our Staff",
            appointmentDate: appt.startTime,
            appointmentTime: formatSalonTime(
              appt.startTime,
              safeTimezone(appt.organization?.salonConfig?.timezone)
            ),
            depositAmount: appt.depositAmount.toNumber(),
          })
          if (result?.success === false) notifyFailed += 1
          else notified += 1
        } catch {
          notifyFailed += 1
        }
      }
    })
  )

  // P0 (S4, audit 2026-11): samodejna pretvorba CONFIRMED → NO_SHOW in
  // samodejna bremenitev pologa ob njej sta ODSTRANJENI. Končanje termina
  // (endTime) ni dokaz, da stranka ni prišla — salon lahko pozabi označiti
  // storitev kot COMPLETED, kar bi sprožilo off-session bremenitev kartice.
  // NO_SHOW nastane izključno ročno prek updateAppointmentStatus (in prav
  // zanj še vedno velja ročna bremenitev / status CHARGED).
  return { cancelled, noShow: 0, notified, notifyFailed, charged: 0, chargeFailed: 0 }
}
