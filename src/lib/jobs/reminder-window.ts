/**
 * P1 #76 — čista logika opomnikov (brez stran-skih uvozov).
 *
 * Ločena od `send-due-reminders.ts`, ker ta vleče `@/app/actions/sms` → auth →
 * `next/server`, ki pod Vitestom pade. Te funkcije so čiste in nevidne od
 * pošiljanja — zato so izpostavljene kjerkoli (job, test) brez stranskih učinkov.
 */

import type { Prisma } from "@prisma/client"

/**
 * Čisto okno opomnika (0–24 h v prihodnost) — testabilno.
 *
 * P1 (S5, audit 2026-11): dnevni cron (03:00 UTC, vercel.json) mora
 * pokriti VSE termine v naslednjih 24 urah. Prejšnje okno 23–25 h je
 * zamudilo vse termine zunaj tega dvournega pasu (opomnik nikoli ni
 * odšel). Idempotenca ostaja na `reminderSentAt`.
 */
export function reminderWindow(now: Date = new Date()): {
  horizonStart: Date
  horizonEnd: Date
} {
  return {
    horizonStart: now,
    horizonEnd: new Date(now.getTime() + 24 * 3_600_000),
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