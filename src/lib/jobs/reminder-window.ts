/**
 * P1 #76 — čista logika opomnikov (brez stran-skih uvozov).
 *
 * Ločena od `send-due-reminders.ts`, ker ta vleče `@/app/actions/sms` → auth →
 * `next/server`, ki pod Vitestom pade. Te funkcije so čiste in nevidne od
 * pošiljanja — zato so izpostavljene kjerkoli (job, test) brez stranskih učinkov.
 */

import type { Prisma } from "@prisma/client"

/** Čisto okno opomnika (23–25 h v prihodnje) — testabilno. */
export function reminderWindow(now: Date = new Date()): {
  horizonStart: Date
  horizonEnd: Date
} {
  return {
    horizonStart: new Date(now.getTime() + 23 * 3_600_000),
    horizonEnd: new Date(now.getTime() + 25 * 3_600_000),
  }
}

/** Prisma where za opomnike — export za teste pogodbe (statusi, okno). */
export function dueReminderWhere(
  now: Date = new Date()
): Prisma.AppointmentWhereInput {
  const { horizonStart, horizonEnd } = reminderWindow(now)
  return {
    status: { in: ["PENDING", "CONFIRMED"] },
    reminderSentAt: null,
    startTime: { gte: horizonStart, lt: horizonEnd },
  }
}