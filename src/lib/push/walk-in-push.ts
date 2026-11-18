// ============================================================
// #108 — WALK-IN PUSH (anonimno, na vstopnici)
// Gost na javni strani /vrsta se lahko naroči na push obvestila.
// Ker gost NI prijavljen (ni User), so VAPID ključi shranjeni
// neposredno na WalkInEntry (pushEndpoint/pushP256dh/pushAuth).
//
// Pošiljanje je vedno best-effort: brez VAPID ključev = no-op,
// zastarela naročnina (404/410) se pobriše, napaka ne ustavi vrste.
// ============================================================

import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { isPushConfigured, type PushPayload } from "./core"

function vapidSubject(): string {
  return process.env.VAPID_SUBJECT || "mailto:info@markec.si"
}

/**
 * Pošlje push obvestilo ENI walk-in vstopnici (gost na napravi).
 * Vrne število poslanih (0 ali 1) — kliče se po prehodu statusa.
 */
export async function notifyWalkInEntry(
  entryId: string,
  payload: PushPayload
): Promise<{ sent: number; skipped: boolean }> {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!isPushConfigured(pub, priv)) return { sent: 0, skipped: true }
  webpush.setVapidDetails(vapidSubject(), pub!, priv!)

  const entry = await prisma.walkInEntry.findUnique({
    where: { id: entryId },
    select: { id: true, pushEndpoint: true, pushP256dh: true, pushAuth: true },
  })
  if (!entry?.pushEndpoint || !entry.pushP256dh || !entry.pushAuth) {
    return { sent: 0, skipped: true }
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: entry.pushEndpoint,
        keys: { p256dh: entry.pushP256dh, auth: entry.pushAuth },
      },
      JSON.stringify(payload)
    )
    return { sent: 1, skipped: false }
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined
    // 404/410 = naročnina zastarela (naprava odstranjena / brskalnik počiščen).
    if (status === 404 || status === 410) {
      await prisma.walkInEntry
        .update({
          where: { id: entry.id },
          data: { pushEndpoint: null, pushP256dh: null, pushAuth: null },
        })
        .catch(() => undefined)
    }
    return { sent: 0, skipped: false }
  }
}

/**
 * Obvesti NASLEDNJEGA v vrsti (prvi WAITING), da se pripravi.
 * Kliče se po vsakem prehodu (SERVING → SERVED / callNext).
 */
export async function notifyUpNext(
  organizationId: string
): Promise<{ sent: number; skipped: boolean }> {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!isPushConfigured(pub, priv)) return { sent: 0, skipped: true }

  const next = await prisma.walkInEntry.findFirst({
    where: { organizationId, status: "WAITING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      pushEndpoint: true,
      pushP256dh: true,
      pushAuth: true,
    },
  })
  if (!next?.pushEndpoint || !next.pushP256dh || !next.pushAuth) {
    return { sent: 0, skipped: true }
  }

  const { buildPushPayload } = await import("./core")
  return notifyWalkInEntry(
    next.id,
    buildPushPayload("walkin_up_next", { position: 1 })
  )
}
