"use server"

// ============================================================
// Števci za stransko navigacijo — "at-a-glance" operativna slika
// za recepcijo (U7): neprebrani pogovori, čakajoča čakalna lista,
// nepotrjeni termini. Org-scoped — nikoli števec druge org.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

export interface NavCounters {
  /** Pogovori v statusu ACTIVE (pričakujejo lastnikov odgovor). */
  chatActive: number
  /** Čakalna lista v statusu WAITING (čaka na obvestilo). */
  waitlist: number
  /** Termini v statusu PENDING (potrebujejo potrditev). */
  apptPending: number
}

/** Org-scoped števci za navigacijo (le voidi=appointments.view). */
export async function getNavCounters(): Promise<{
  ok: boolean
  error?: string
  counters?: NavCounters
}> {
  try {
    const { org } = await requirePermissionOrg("appointments.view")

    const [chatActive, waitlist, apptPending] = await prisma.$transaction([
      // Conversation.ACTIVE — neprebrani, čakajo lastnika.
      prisma.conversation.count({
        where: { organizationId: org.id, status: "ACTIVE" },
      }),
      // WaitlistEntry.WAITING — čakajo na prosto mesto.
      prisma.waitlistEntry.count({
        where: { organizationId: org.id, status: "WAITING" },
      }),
      // Appointment.PENDING — čakajo na potrditev.
      prisma.appointment.count({
        where: { organizationId: org.id, status: "PENDING" },
      }),
    ])

    return { ok: true, counters: { chatActive, waitlist, apptPending } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}