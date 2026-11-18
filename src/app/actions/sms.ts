"use server"

// #110 — 46elks SMS akcije (server actions).
// Varnost: zahteva OWNER vlogo za konfiguracijo, ORG_MEMBER za pošiljanje.
// Gesla se NE vračajo nazaj v UI.

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import {
  sendSms,
  normalizeSlovenianPhone,
  isValidE164,
  countSmsParts,
  SMS_TEMPLATES,
  type SmsConfig,
} from "@/lib/sms/46elks"

// ── Helpers ──────────────────────────────────────────────────

async function requireOwner() {
  const session = await auth()
  if (!session?.user?.id) return { error: "unauthorized" as const }
  const { org } = await requirePermissionOrg("settings.manage")
  if (!org) return { error: "no_org" as const }

  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: org.id, userId: session.user.id },
    },
    select: { role: true },
  })
  if (member?.role !== "OWNER") return { error: "forbidden" as const }

  return { session, org }
}

/** Sestavi SmsConfig iz baze. Če ni nastavljeno → null. */
async function loadSmsConfig(orgId: string): Promise<SmsConfig | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      smsApiKey: true,
      smsApiPassword: true,
      smsSenderName: true,
    },
  })
  if (!org?.smsApiKey || !org.smsApiPassword) return null

  return {
    apiKey: org.smsApiKey,
    apiPassword: org.smsApiPassword,
    senderName: org.smsSenderName ?? "MARKEC",
  }
}

// ── Settings ─────────────────────────────────────────────────

export interface SmsStatus {
  configured: boolean
  senderName: string | null
  configuredAt: Date | null
}

/** Vrne stanje SMS povezave (brez občutljivih podatkov). */
export async function getSmsStatus(): Promise<
  { error: string } | SmsStatus
> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const org = await prisma.organization.findUnique({
    where: { id: authResult.org.id },
    select: {
      smsApiKey: true,
      smsSenderName: true,
      smsConfiguredAt: true,
    },
  })

  return {
    configured: Boolean(org?.smsApiKey),
    senderName: org?.smsSenderName ?? null,
    configuredAt: org?.smsConfiguredAt ?? null,
  }
}

/** Shrani SMS konfiguracijo. */
export async function saveSmsConfig(input: {
  apiKey: string
  apiPassword: string
  senderName: string
}): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  if (!input.apiKey?.trim() || !input.apiPassword?.trim()) {
    return { error: "API ključ in geslo sta obvezna." }
  }

  await prisma.organization.update({
    where: { id: authResult.org.id },
    data: {
      smsApiKey: input.apiKey.trim(),
      smsApiPassword: input.apiPassword.trim(),
      smsSenderName: input.senderName?.trim() || "MARKEC",
      smsConfiguredAt: new Date(),
    },
  })

  return { ok: true }
}

/** Prekini SMS povezavo. */
export async function disconnectSms(): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  await prisma.organization.update({
    where: { id: authResult.org.id },
    data: {
      smsApiKey: null,
      smsApiPassword: null,
      smsSenderName: null,
      smsConfiguredAt: null,
    },
  })

  return { ok: true }
}

/** Testiraj SMS — pošlji testno sporočilo na dano številko. */
export async function testSms(
  phoneNumber: string
): Promise<{ error: string } | { ok: true; message: string }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const cfg = await loadSmsConfig(authResult.org.id)
  if (!cfg) {
    return { error: "SMS ni nastavljen. Najprej shranite konfiguracijo." }
  }

  const normalized = normalizeSlovenianPhone(phoneNumber) ?? (isValidE164(phoneNumber) ? phoneNumber.trim() : null)
  if (!normalized) {
    return { error: `Neveljavna telefonska številka: ${phoneNumber}` }
  }

  const result = await sendSms(
    cfg,
    normalized,
    `Testno sporočilo iz MARKEC. SMS povezava deluje!`,
    { from: cfg.senderName }
  )

  if (!result.ok) {
    return { error: `Pošiljanje ni uspelo: ${result.error}` }
  }

  return {
    ok: true,
    message: `Testno sporočilo poslano na ${normalized}. Status: ${result.status}`,
  }
}

// ── Send SMS (for internal use by other actions) ────────────

/**
 * Pošlji SMS prek organizacijske konfiguracije.
 * Uporabijo jo ostale akcije (termini, naročila, walk-in).
 * Vrne null, če SMS ni nastavljen ali pošiljanje ni uspelo.
 */
export async function sendOrgSms(
  orgId: string,
  to: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const cfg = await loadSmsConfig(orgId)
  if (!cfg) return { ok: false, error: "SMS ni nastavljen" }

  const result = await sendSms(cfg, to, message)
  return result.ok
    ? { ok: true, messageId: result.messageId }
    : { ok: false, error: result.error }
}

// ── SMS notifications for business events ────────────────────

/**
 * Pošlji opomnik za termin (24h prej).
 * Kliče se iz sendDueReminders job-a.
 */
export async function sendAppointmentReminderSms(
  orgId: string,
  appointment: {
    serviceName: string
    date: Date
    customerPhone: string | null
    businessName: string
    timeZone?: string
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!appointment.customerPhone) {
    return { ok: false, error: "Stranka nima telefonske številke" }
  }

  const tz = appointment.timeZone || "Europe/Ljubljana"
  const message = SMS_TEMPLATES.appointmentReminder({
    serviceName: appointment.serviceName,
    date: appointment.date.toLocaleDateString("sl-SI", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    }),
    time: appointment.date.toLocaleTimeString("sl-SI", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    }),
    businessName: appointment.businessName,
  })

  return sendOrgSms(orgId, appointment.customerPhone, message)
}

/**
 * Pošlji obvestilo "naročilo pripravljeno za prevzem".
 */
export async function sendOrderReadySms(
  orgId: string,
  order: {
    orderNumber: string
    customerPhone: string | null
    businessName: string
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!order.customerPhone) {
    return { ok: false, error: "Stranka nima telefonske številke" }
  }

  const message = SMS_TEMPLATES.orderReady({
    orderNumber: order.orderNumber,
    businessName: order.businessName,
  })

  return sendOrgSms(orgId, order.customerPhone, message)
}

/**
 * Pošlji obvestilo walk-in "na vrsti ste".
 */
export async function sendWalkInSms(
  orgId: string,
  walkIn: {
    ticketCode: string
    customerPhone: string | null
    businessName: string
    type: "your_turn" | "up_next"
    positionsAhead?: number
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!walkIn.customerPhone) {
    return { ok: false, error: "Stranka nima telefonske številke" }
  }

  const message =
    walkIn.type === "your_turn"
      ? SMS_TEMPLATES.walkInYourTurn({
          ticketCode: walkIn.ticketCode,
          businessName: walkIn.businessName,
        })
      : SMS_TEMPLATES.walkInUpNext({
          ticketCode: walkIn.ticketCode,
          positionsAhead: walkIn.positionsAhead ?? 1,
          businessName: walkIn.businessName,
        })

  return sendOrgSms(orgId, walkIn.customerPhone, message)
}

// ── SMS cost estimation ──────────────────────────────────────

/** Izračunaj ceno pošiljanja (orientacijsko). */
export async function estimateSmsCost(
  message: string,
  recipientCount: number = 1
): Promise<{
  partsPerMessage: number
  totalParts: number
  estimatedCostEur: number
  note: string
}> {
  const parts = countSmsParts(message)
  const totalParts = parts * recipientCount
  // Orientacijska cena: ~0,05 € na del (46elks cenik za Slovenijo)
  const estimatedCostEur = totalParts * 0.05

  return {
    partsPerMessage: parts,
    totalParts,
    estimatedCostEur: Math.round(estimatedCostEur * 100) / 100,
    note: `Orientacijsko: ${totalParts} delov × ~0,05 € = ~${estimatedCostEur.toFixed(2)} €. Natančen cenik: 46elks.com/pricing`,
  }
}
