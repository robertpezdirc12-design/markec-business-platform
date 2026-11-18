// ============================================================
// OUTGOING WEBHOOKS (#110, Faza 3)
//
// Obvestila tretjim osebam ob dogodkih v sistemu.
// Lastnik registrira URL in izbere dogodke; ob vsakem dogodku
// pošljemo HTTP POST s HMAC-SHA256 podpisom.
//
// Varnost:
// - Secret se shrani v bazo, nikoli ne v payload.
// - Podpis: HMAC-SHA256(secret, rawBody) → X-Markec-Signature.
// - Retry z eksponentnim backoffom (max 3 poskusi).
// - Dead-letter po izčrpanih poskusih.
//
// ============================================================

import crypto from "crypto"
import { prisma } from "@/lib/prisma"

// ── Event types ──────────────────────────────────────────────

/** Podprti dogodki za outgoing webhooks. */
export const OUTGOING_WEBHOOK_EVENTS = [
  "appointment.created",
  "appointment.updated",
  "appointment.cancelled",
  "order.created",
  "order.paid",
  "order.fulfilled",
  "customer.created",
  "customer.updated",
  "walkin.called",
  "payment.received",
] as const

export type OutgoingWebhookEvent = (typeof OUTGOING_WEBHOOK_EVENTS)[number]

/** Človeško berljiva imena dogodkov (za UI). */
export const EVENT_LABELS: Record<OutgoingWebhookEvent, string> = {
  "appointment.created": "Nov termin",
  "appointment.updated": "Termin posodobljen",
  "appointment.cancelled": "Termin preklican",
  "order.created": "Novo naročilo",
  "order.paid": "Naročilo plačano",
  "order.fulfilled": "Naročilo izpolnjeno",
  "customer.created": "Nova stranka",
  "customer.updated": "Stranka posodobljena",
  "walkin.called": "Walk-in klican",
  "payment.received": "Plačilo prejeto",
}

// ── Signing ──────────────────────────────────────────────────

/**
 * HMAC-SHA256 podpis telesa (raw JSON string).
 * Prejemnik lahko preveri pristnost z istim secretom.
 */
export function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

/** Verifikacija podpisa (za testiranje / dokumentacijo). */
export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = signPayload(secret, body)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/** Generiraj naključni secret za nov webhook. */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`
}

// ── Dispatch ─────────────────────────────────────────────────

export interface DispatchResult {
  webhookId: string
  deliveryId: string
  status: "delivered" | "failed" | "pending_retry" | "dead"
  responseStatus?: number
  error?: string
}

/**
 * Pošlji dogodek vsem aktivnim webhookom organizacije,
 * ki so naročeni na ta dogodek.
 *
 * Best-effort: napake pri posameznem webhooku ne ustavijo ostalih.
 * Klicatelj ne čaka na delivery — fire-and-forget vzorec je OK,
 * a tu izvedemo prvi poskus takoj in vrnemo rezultat.
 */
export async function dispatchOutgoingEvent(
  organizationId: string,
  event: OutgoingWebhookEvent | string,
  data: Record<string, unknown>
): Promise<DispatchResult[]> {
  const webhooks = await prisma.outgoingWebhook.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      secret: true,
      events: true,
    },
  })

  const subscribed = webhooks.filter((wh) => {
    const events = wh.events as string[] | null
    if (!Array.isArray(events)) return false
    return events.includes("*") || events.includes(event)
  })

  if (subscribed.length === 0) return []

  const timestamp = new Date().toISOString()
  const envelope = {
    id: crypto.randomUUID(),
    event,
    timestamp,
    data,
  }
  const body = JSON.stringify(envelope)

  const results = await Promise.allSettled(
    subscribed.map(async (wh): Promise<DispatchResult> => {
      const delivery = await prisma.outgoingWebhookDelivery.create({
        data: {
          webhookId: wh.id,
          event,
          payload: envelope as unknown as object,
          status: "pending",
          attempt: 1,
          maxAttempts: 3,
        },
      })

      return attemptDelivery({
        deliveryId: delivery.id,
        webhookId: wh.id,
        url: wh.url,
        secret: wh.secret,
        event,
        body,
        attempt: 1,
        maxAttempts: 3,
      })
    })
  )

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          webhookId: subscribed[i].id,
          deliveryId: "",
          status: "failed" as const,
          error: String(r.reason).slice(0, 200),
        }
  )
}

// ── Delivery ─────────────────────────────────────────────────

interface AttemptParams {
  deliveryId: string
  webhookId: string
  url: string
  secret: string
  event: string
  body: string
  attempt: number
  maxAttempts: number
}

async function attemptDelivery(params: AttemptParams): Promise<DispatchResult> {
  const { deliveryId, webhookId, url, secret, event, body, attempt, maxAttempts } = params

  const signature = signPayload(secret, body)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MARKEC-Webhook/1.0",
        "X-Markec-Event": event,
        "X-Markec-Signature": `sha256=${signature}`,
        "X-Markec-Delivery-Id": deliveryId,
        "X-Markec-Timestamp": new Date().toISOString(),
      },
      body,
      signal: controller.signal,
    })

    const responseBody = await res.text().catch(() => "")
    const truncatedBody = responseBody.slice(0, 1000)

    if (res.ok) {
      await Promise.all([
        prisma.outgoingWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "delivered",
            responseStatus: res.status,
            responseBody: truncatedBody,
            deliveredAt: new Date(),
          },
        }),
        prisma.outgoingWebhook.update({
          where: { id: webhookId },
          data: {
            successCount: { increment: 1 },
            lastDeliveredAt: new Date(),
          },
        }),
      ])
      return { webhookId, deliveryId, status: "delivered", responseStatus: res.status }
    }

    // Non-2xx: retry or dead-letter
    return handleFailure({
      deliveryId,
      webhookId,
      attempt,
      maxAttempts,
      responseStatus: res.status,
      error: `HTTP ${res.status}: ${truncatedBody.slice(0, 200)}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return handleFailure({
      deliveryId,
      webhookId,
      attempt,
      maxAttempts,
      error: message.slice(0, 200),
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function handleFailure(params: {
  deliveryId: string
  webhookId: string
  attempt: number
  maxAttempts: number
  responseStatus?: number
  error: string
}): Promise<DispatchResult> {
  const { deliveryId, webhookId, attempt, maxAttempts, responseStatus, error } = params

  if (attempt < maxAttempts) {
    // Eksponentni backoff: 1min, 5min, 15min
    const delays = [60_000, 5 * 60_000, 15 * 60_000]
    const delay = delays[attempt - 1] ?? delays[delays.length - 1]
    const nextRetryAt = new Date(Date.now() + delay)

    await prisma.outgoingWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "pending",
        attempt: attempt + 1,
        nextRetryAt,
        responseStatus: responseStatus ?? null,
        responseBody: error,
      },
    })
    return {
      webhookId,
      deliveryId,
      status: "pending_retry",
      responseStatus,
      error,
    }
  }

  // Dead-letter
  await Promise.all([
    prisma.outgoingWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "dead",
        responseStatus: responseStatus ?? null,
        responseBody: error,
      },
    }),
    prisma.outgoingWebhook.update({
      where: { id: webhookId },
      data: {
        failureCount: { increment: 1 },
        lastFailureAt: new Date(),
        lastFailureReason: error.slice(0, 300),
      },
    }),
  ])
  return { webhookId, deliveryId, status: "dead", responseStatus, error }
}

// ── Retry job ────────────────────────────────────────────────

/**
 * Ponovi čakajoče dostave (za cron).
 * Poišče deliveries s status=pending in nextRetryAt <= now.
 */
export async function retryPendingDeliveries(
  now: Date = new Date(),
  batchSize = 50
): Promise<{ retried: number; delivered: number; dead: number }> {
  const pending = await prisma.outgoingWebhookDelivery.findMany({
    where: {
      status: "pending",
      nextRetryAt: { lte: now },
      attempt: { gt: 1 }, // attempt 1 je že poskusen takoj; retry so attempt > 1
    },
    take: batchSize,
    orderBy: { nextRetryAt: "asc" },
    include: {
      webhook: {
        select: { id: true, url: true, secret: true, isActive: true },
      },
    },
  })

  let delivered = 0
  let dead = 0

  for (const d of pending) {
    if (!d.webhook.isActive) {
      await prisma.outgoingWebhookDelivery.update({
        where: { id: d.id },
        data: { status: "dead", responseBody: "Webhook deaktiviran" },
      })
      dead++
      continue
    }

    const result = await attemptDelivery({
      deliveryId: d.id,
      webhookId: d.webhook.id,
      url: d.webhook.url,
      secret: d.webhook.secret,
      event: d.event,
      body: JSON.stringify(d.payload),
      attempt: d.attempt,
      maxAttempts: d.maxAttempts,
    })

    if (result.status === "delivered") delivered++
    if (result.status === "dead") dead++
  }

  return { retried: pending.length, delivered, dead }
}
