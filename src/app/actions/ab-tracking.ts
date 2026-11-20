"use server"

// ============================================================
// A/B tracking (meritev konverzije krajše booking forme).
// Shranjuje analitične dogodke v BookingExperimentEvent:
//  - VIEW       → stran booking naložena v varianti "short"|"full"
//  - CONVERSION → termin dejansko oddan v tej varianti
// Dashboard (dashboard/experiments) agregira po varianti → konverzija =
// CONVERSION / VIEW per varianta (baseline "full" vs "short").
// ============================================================

import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

const randomKey = () =>
  (typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}${Math.random().toString(36).slice(2)}`)

/** Postavi / vrne konzistenten {sessionKey} v cookie-ju __ab. */
async function getOrMakeSessionKey(orgId: string): Promise<string> {
  const c = await cookies()
  const existing = c.get("__ab")?.value
  if (existing) return existing
  const fresh = `${orgId}:${randomKey()}`
  c.set("__ab", fresh, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  })
  return fresh
}

/**
 * Zabeleži VIEW dogodek (ob nalaganju booking strani v varianti).
 */
export async function trackBookingView(input: {
  organizationId: string
  variant: "short" | "full"
}): Promise<{ ok: true }> {
  const sessionKey = await getOrMakeSessionKey(input.organizationId)
  await prisma.bookingExperimentEvent.create({
    data: {
      organizationId: input.organizationId,
      variant: input.variant,
      kind: "VIEW",
      sessionKey,
    },
  })
  return { ok: true }
}

/**
 * Zabeleži CONVERSION (ob uspešno oddanem terminu), poveže z
 * appointmentId. Kliče ga BookingForm po uspešnem submitu (tudi
 * za "brez plačila" fallback pot).
 */
export async function trackBookingConversion(input: {
  organizationId: string
  variant: "short" | "full"
  appointmentId: string
}): Promise<{ ok: true }> {
  const c = await cookies()
  const sessionKey = c.get("__ab")?.value ?? null
  await prisma.bookingExperimentEvent.create({
    data: {
      organizationId: input.organizationId,
      variant: input.variant,
      kind: "CONVERSION",
      sessionKey,
      appointmentId: input.appointmentId,
    },
  })
  return { ok: true }
}
