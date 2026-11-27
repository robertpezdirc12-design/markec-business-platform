"use server"

// ============================================================
// GOOGLE KOLEDAR — AKCIJE (status, odklop, sinhronizacija)
//
// Vsaka akcija je org-scoped prek `requirePermissionOrg("settings.manage")`:
// koledar vsebuje IMENA IN KONTAKTE strank, zato dostop ni "samo UI".
//
// Izvoz posameznega termina živi v src/lib/calendar/sync-appointment.ts —
// ista funkcija, ki jo kličejo odpoved in spremembe statusa. Ta datoteka
// skrbi le za pregled nad celotnim naborom terminov (gumb "Sinhroniziraj").
// ============================================================

import { revalidatePath } from "next/cache"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import {
  deleteConnection,
  getConnection,
  recordSyncResult,
  validAccessToken,
} from "@/lib/calendar/connection"
import { googleCalendarConfig } from "@/lib/calendar/google"
import { exportAppointment } from "@/lib/calendar/sync-appointment"

export type CalendarActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

export interface CalendarSyncSummary {
  created: number
  updated: number
  removed: number
  failed: number
}

export type CalendarSyncResult =
  | { ok: true; summary: CalendarSyncSummary }
  | { ok: false; error: string }

const SETTINGS_PATH = "/dashboard/settings"
const CONCURRENCY = 5

export async function disconnectCalendar(): Promise<CalendarActionResult> {
  const { org } = await requirePermissionOrg("settings.manage")
  // Trd izbris: vrstica ne ostane z "mrtvimi" žetoni. Dogodkov v
  // Googlovem koledarju NE brišemo — to ni naša lastnina.
  await deleteConnection(org.id)
  revalidatePath(SETTINGS_PATH)
  return { ok: true, message: "Google Calendar je odklopljen. Dogodki, ki so že v koledarju, ostanejo." }
}

export async function syncCalendar(): Promise<CalendarSyncResult> {
  const { org } = await requirePermissionOrg("settings.manage")

  const connection = await getConnection(org.id)
  if (!connection) return { ok: false, error: "Google Calendar ni povezan." }
  if (!googleCalendarConfig()) {
    return { ok: false, error: "Google Calendar ni nastavljen na strežniku (manjkajo poverilnice)." }
  }

  const accessToken = await validAccessToken(connection)
  if (!accessToken) {
    return { ok: false, error: "Dostop do koledarja je potekel. Povežite Google Calendar znova." }
  }

  // Okno: od včeraj do +18 mesecev. Preklicani termini se vedno
  // obdelajo, tudi če so stari — sicer bi v koledarju ostali "duhovi".
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const until = new Date(Date.now() + 548 * 24 * 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      OR: [
        {
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
          startTime: { gte: since, lte: until },
        },
        { status: "CANCELLED", googleEventId: { not: null } },
      ],
    },
    select: { id: true },
    orderBy: { startTime: "asc" },
    take: 500,
  })

  const summary: CalendarSyncSummary = { created: 0, updated: 0, removed: 0, failed: 0 }
  let firstError: string | null = null

  // Po 5 vzporedno: hitreje od zaporednega klica, a dovolj nizko, da
  // ne sprožimo Googlovega 429 (rate limit).
  for (let i = 0; i < appointments.length; i += CONCURRENCY) {
    await Promise.all(
      appointments.slice(i, i + CONCURRENCY).map(async ({ id }) => {
        const result = await exportAppointment(id)
        if (!result.ok) {
          summary.failed += 1
          firstError ??= result.error
          return
        }
        if (result.action === "created") summary.created += 1
        else if (result.action === "updated") summary.updated += 1
        else if (result.action === "removed") summary.removed += 1
      })
    )
  }

  await recordSyncResult(org.id, { error: firstError })
  revalidatePath(SETTINGS_PATH)

  if (summary.failed > 0) {
    return {
      ok: false,
      error: `${summary.failed} terminov ni bilo mogoče izvoziti. ${firstError ?? ""}`.trim(),
    }
  }

  return { ok: true, summary }
}
