"use server"

// ============================================================
// PREDRAČUN → STRANKA (javna stran naročila)
//
// Stranka odpre /s/<slug>/order/<token> (žeton pozna samo ona) in lahko:
//   • potrdi predračun (ceno in rok) — stopnja »Predračun« in »Potrditev
//     stranke« se zaključita, naročilo gre v izdelavo,
//   • predračun zavrne z razlogom (naročilo ostane odprto, lastnik dobi
//     jasen zapis v zgodovini),
//   • plača depozit prek Stripe — z lastnikovim ključem (platforma nima
//     svojega); brez ključa se gumb ne prikaže.
//
// Vse je org-scoped: žeton se išče samo znotraj najemnika, ki ga
// razreši tenant kontekst (podpisana glava iz proxyja).
// ============================================================

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { getResolvedOrg } from "@/lib/tenant"
import { getStripeForOrg, isOrgStripeConfigured } from "@/lib/stripe"
import { tenantReturnBase } from "@/lib/tenant/return-base"
import { isPublicToken } from "@/lib/work-orders/payment-summary"

export interface PublicOrderActionState {
  ok: boolean
  error?: string
  checkoutUrl?: string
}

const APPROVAL_STAGE = /approval|potrditev|confirm|odobritev/i
const QUOTE_STAGE = /quote|predracun|predračun|ponudba|estimate/i

/** Naročilo po javnem žetonu — vedno znotraj trenutnega najemnika. */
async function loadByToken(token: string) {
  if (!isPublicToken(token)) return null
  const org = await getResolvedOrg()
  if (!org) return null

  const order = await prisma.workOrder.findFirst({
    where: { publicToken: token, organizationId: org.id },
    include: {
      workflowDefinition: { include: { stages: { orderBy: { order: "asc" } } } },
      payments: { select: { amount: true } },
    },
  })
  return order ? { org, order } : null
}

/** Rate-limit po IP: prepreči ugibanje žetonov in ponovno klikanje. */
const attempts = new Map<string, { count: number; resetAt: number }>()

async function allowAttempt(limit = 12, windowMs = 60_000): Promise<boolean> {
  let ip = "unknown"
  try {
    const h = await headers()
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
  } catch {
    // brez glave — uporabi skupno vedro
  }
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}

/**
 * Premakne naročilo naprej skozi stopnji »predračun« in »potrditev«.
 * Vsak korak je sosednji (invariant, ki ga uveljavlja advanceWorkOrder),
 * zato gre za dve ločeni, a zaporedni spremembi — obe ostaneta v zgodovini.
 */
async function advanceAfterApproval(
  orgId: string,
  order: {
    id: string
    currentStageKey: string | null
    workflowDefinition: {
      stages: { key: string; name: string; order: number; isFinal: boolean }[]
    } | null
  },
  actorEmail: string | null
): Promise<string[]> {
  const stages = order.workflowDefinition?.stages ?? []
  if (stages.length === 0) return []

  const applied: string[] = []
  let currentKey = order.currentStageKey

  for (let step = 0; step < 2; step++) {
    const idx = stages.findIndex((s) => s.key === currentKey)
    if (idx < 0) break
    const next = stages[idx + 1]
    if (!next) break

    const currentName = stages[idx].name
    // Nadaljuj samo, dokler stojimo na predračunu ali potrditvi.
    if (
      !QUOTE_STAGE.test(currentKey ?? "") &&
      !APPROVAL_STAGE.test(currentKey ?? "") &&
      !QUOTE_STAGE.test(currentName) &&
      !APPROVAL_STAGE.test(currentName)
    ) {
      break
    }

    await prisma.workOrder.update({
      where: { id: order.id },
      data: {
        currentStageKey: next.key,
        status: next.isFinal ? "COMPLETED" : "OPEN",
      },
    })
    await prisma.workOrderEvent.create({
      data: {
        organizationId: orgId,
        workOrderId: order.id,
        type: "STAGE_CHANGED",
        fromStageKey: currentKey,
        toStageKey: next.key,
        message: `Stranka je potrdila predračun — ${next.name}`,
        actorEmail,
      },
    })
    applied.push(next.key)
    currentKey = next.key
  }

  return applied
}

/** Stranka potrdi predračun. */
export async function approveWorkOrderQuote(
  token: string
): Promise<PublicOrderActionState> {
  if (!(await allowAttempt())) return { ok: false, error: "RATE_LIMITED" }

  const found = await loadByToken(token)
  if (!found) return { ok: false, error: "NOT_FOUND" }
  const { org, order } = found

  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }
  if (order.customerApprovedAt) return { ok: true } // idempotentno
  if (order.customerDeclinedAt) return { ok: false, error: "ALREADY_DECLINED" }
  if (order.total === null) return { ok: false, error: "NO_TOTAL" }

  await prisma.workOrder.update({
    where: { id: order.id },
    data: { customerApprovedAt: new Date() },
  })
  await prisma.workOrderEvent.create({
    data: {
      organizationId: org.id,
      workOrderId: order.id,
      type: "NOTE",
      message: "Stranka je potrdila predračun (javna povezava)",
      actorEmail: null,
    },
  })

  await advanceAfterApproval(org.id, order, null)

  revalidatePath(`/dashboard/work-orders/${order.id}`)
  revalidatePath("/dashboard/work-orders")
  return { ok: true }
}

/** Stranka predračun zavrne (z razlogom). */
export async function declineWorkOrderQuote(
  token: string,
  reason: string
): Promise<PublicOrderActionState> {
  if (!(await allowAttempt())) return { ok: false, error: "RATE_LIMITED" }

  const trimmed = reason.trim().slice(0, 500)
  if (trimmed.length < 3) return { ok: false, error: "REASON_REQUIRED" }

  const found = await loadByToken(token)
  if (!found) return { ok: false, error: "NOT_FOUND" }
  const { org, order } = found

  if (order.customerApprovedAt) return { ok: false, error: "ALREADY_APPROVED" }
  if (order.customerDeclinedAt) return { ok: true }

  await prisma.workOrder.update({
    where: { id: order.id },
    data: { customerDeclinedAt: new Date(), declineReason: trimmed },
  })
  await prisma.workOrderEvent.create({
    data: {
      organizationId: org.id,
      workOrderId: order.id,
      type: "NOTE",
      message: `Stranka je zavrnila predračun: ${trimmed}`,
      actorEmail: null,
    },
  })

  revalidatePath(`/dashboard/work-orders/${order.id}`)
  return { ok: true }
}

/**
 * Plačilo depozita prek Stripe. Znesek = še nepokriti del načrtovanega
 * depozita; brez načrtovanega depozita ali brez najemnikovega Stripe
 * ključa akcija vrne jasno napako (UI gumba ne prikaže).
 */
export async function createWorkOrderDepositCheckout(
  token: string
): Promise<PublicOrderActionState> {
  if (!(await allowAttempt())) return { ok: false, error: "RATE_LIMITED" }

  const found = await loadByToken(token)
  if (!found) return { ok: false, error: "NOT_FOUND" }
  const { org, order } = found

  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }
  if (!isOrgStripeConfigured(org)) return { ok: false, error: "STRIPE_NOT_CONFIGURED" }

  const deposit = order.depositAmount === null ? null : Number(order.depositAmount)
  if (deposit === null || deposit <= 0) return { ok: false, error: "NO_DEPOSIT" }

  const paid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remaining = Math.round((deposit - paid) * 100) / 100
  if (remaining <= 0.5) return { ok: false, error: "DEPOSIT_ALREADY_PAID" }

  const stripeClient = getStripeForOrg(org)
  if (!stripeClient) return { ok: false, error: "STRIPE_NOT_CONFIGURED" }

  const base = await tenantReturnBase()
  const path = `/s/${org.slug}/order/${token}`

  // Valuta je nastavitev salona (SalonConfig), ne organizacije.
  const config = await prisma.salonConfig.findFirst({
    where: { organizationId: org.id },
    select: { currency: true },
  })
  const currency = (config?.currency || "EUR").toLowerCase()

  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Depozit za naročilo #${String(order.number).padStart(3, "0")}`,
              description: order.title,
            },
            unit_amount: Math.round(remaining * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "work_order_deposit",
        workOrderId: order.id,
        orgId: org.id,
        token,
      },
      success_url: `${base}${path}?paid=1`,
      cancel_url: `${base}${path}`,
    })

    return { ok: true, checkoutUrl: session.url ?? undefined }
  } catch (error) {
    console.error("[work-order-public] Napaka pri ustvarjanju Stripe seje:", error)
    return { ok: false, error: "STRIPE_ERROR" }
  }
}
