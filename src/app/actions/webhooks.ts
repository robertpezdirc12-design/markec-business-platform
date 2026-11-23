"use server"

// #110 — Outgoing webhooks (server actions).
// Nastavitve, CRUD, test dostave. Samo OWNER.

import { auth } from "@/lib/auth/auth"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import {
  OUTGOING_WEBHOOK_EVENTS,
  EVENT_LABELS,
  generateWebhookSecret,
  signPayload,
} from "@/lib/webhooks/outgoing"

// ── Auth ─────────────────────────────────────────────────────

async function requireOwner() {
  const session = await auth()
  if (!session?.user?.id) return { error: "unauthorized" as const }
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    if (!org) return { error: "no_org" as const }
    return { session, org }
  } catch {
    // P0 (M1, audit 2026-11): vloga OWNER ne obstaja (vloge so samo
    // ADMIN/STAFF/CLIENTE) — prejšnji `role !== "OWNER"` je ta vmesnik
    // trajno zaklenil (vedno "forbidden"). `settings.manage` je edini
    // avtoritativen prever; nepooblaščen dostop → "forbidden".
    return { error: "forbidden" as const }
  }
}

// ── Types ────────────────────────────────────────────────────

export interface WebhookSummary {
  id: string
  url: string
  events: string[]
  isActive: boolean
  successCount: number
  failureCount: number
  lastDeliveredAt: Date | null
  lastFailureAt: Date | null
  lastFailureReason: string | null
  createdAt: Date
}

// ── List ─────────────────────────────────────────────────────

export async function listWebhooks(): Promise<
  { error: string } | { webhooks: WebhookSummary[]; availableEvents: { id: string; label: string }[] }
> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const rows = await prisma.outgoingWebhook.findMany({
    where: { organizationId: authResult.org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      successCount: true,
      failureCount: true,
      lastDeliveredAt: true,
      lastFailureAt: true,
      lastFailureReason: true,
      createdAt: true,
    },
  })

  return {
    webhooks: rows.map((r) => ({
      ...r,
      events: Array.isArray(r.events) ? (r.events as string[]) : [],
    })),
    availableEvents: OUTGOING_WEBHOOK_EVENTS.map((id) => ({
      id,
      label: EVENT_LABELS[id],
    })),
  }
}

// ── Create ───────────────────────────────────────────────────

export async function createWebhook(input: {
  url: string
  events: string[]
}): Promise<{ error: string } | { ok: true; id: string; secret: string }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const url = input.url?.trim()
  if (!url) return { error: "URL je obvezen." }

  try {
    const parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "URL mora biti http ali https." }
    }
  } catch {
    return { error: "Neveljaven URL." }
  }

  const validEvents = new Set<string>(OUTGOING_WEBHOOK_EVENTS as readonly string[])
  validEvents.add("*")
  const events = (input.events ?? []).filter((e) => validEvents.has(e))
  if (events.length === 0) {
    return { error: "Izberite vsaj en dogodek." }
  }

  const secret = generateWebhookSecret()

  const wh = await prisma.outgoingWebhook.create({
    data: {
      organizationId: authResult.org.id,
      url,
      secret,
      events,
      isActive: true,
    },
  })

  // Secret vrnemo SAMO ob ustvarjanju — kasneje ni več viden.
  return { ok: true, id: wh.id, secret }
}

// ── Update ───────────────────────────────────────────────────

export async function updateWebhook(input: {
  id: string
  url?: string
  events?: string[]
  isActive?: boolean
}): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const existing = await prisma.outgoingWebhook.findFirst({
    where: { id: input.id, organizationId: authResult.org.id },
    select: { id: true },
  })
  if (!existing) return { error: "Webhook ne obstaja." }

  const data: Record<string, unknown> = {}
  if (typeof input.url === "string") {
    try {
      const parsed = new URL(input.url.trim())
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { error: "URL mora biti http ali https." }
      }
      data.url = input.url.trim()
    } catch {
      return { error: "Neveljaven URL." }
    }
  }
  if (Array.isArray(input.events)) {
    const validEvents = new Set<string>(OUTGOING_WEBHOOK_EVENTS as readonly string[])
    validEvents.add("*")
    data.events = input.events.filter((e) => validEvents.has(e))
  }
  if (typeof input.isActive === "boolean") {
    data.isActive = input.isActive
  }

  await prisma.outgoingWebhook.update({
    where: { id: existing.id },
    data,
  })
  return { ok: true }
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteWebhook(
  id: string
): Promise<{ error?: string; ok?: boolean }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const existing = await prisma.outgoingWebhook.findFirst({
    where: { id, organizationId: authResult.org.id },
    select: { id: true },
  })
  if (!existing) return { error: "Webhook ne obstaja." }

  await prisma.outgoingWebhook.delete({ where: { id } })
  return { ok: true }
}

// ── Rotate secret ────────────────────────────────────────────

export async function rotateWebhookSecret(
  id: string
): Promise<{ error: string } | { ok: true; secret: string }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const existing = await prisma.outgoingWebhook.findFirst({
    where: { id, organizationId: authResult.org.id },
    select: { id: true },
  })
  if (!existing) return { error: "Webhook ne obstaja." }

  const secret = generateWebhookSecret()
  await prisma.outgoingWebhook.update({
    where: { id },
    data: { secret },
  })
  return { ok: true, secret }
}

// ── Test ping ────────────────────────────────────────────────

export async function sendTestWebhook(
  id: string
): Promise<{ error: string } | { ok: true; status: number; message: string }> {
  const authResult = await requireOwner()
  if ("error" in authResult) return { error: authResult.error ?? "unauthorized" }

  const wh = await prisma.outgoingWebhook.findFirst({
    where: { id, organizationId: authResult.org.id },
    select: { id: true, url: true, secret: true },
  })
  if (!wh) return { error: "Webhook ne obstaja." }

  const envelope = {
    id: crypto.randomUUID(),
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { message: "Testni dogodek iz MARKEC platforme." },
  }
  const body = JSON.stringify(envelope)
  const signature = signPayload(wh.secret, body)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MARKEC-Webhook/1.0",
        "X-Markec-Event": "webhook.test",
        "X-Markec-Signature": `sha256=${signature}`,
        "X-Markec-Delivery-Id": envelope.id,
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { error: `HTTP ${res.status}: ${text.slice(0, 150)}` }
    }
    return { ok: true, status: res.status, message: "Testni dogodek uspešno dostavljen." }
  } catch (err) {
    return { error: `Napaka: ${err instanceof Error ? err.message : String(err)}` }
  }
}
