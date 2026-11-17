"use server"

// ============================================================
// PREDRAČUN → STRANKA + DENAR NA NAROČILU (2026-11-18)
//
// Lastnikova stran:
//   • ustvari/ponastavi javno povezavo za stranko (žeton = skrivnost),
//   • določi načrtovani depozit,
//   • zabeleži ročno prejeto plačilo (gotovina/kartica/nakazilo),
//   • vidi neplačana naročila (dolžniki).
//
// Denar se NIKOLI ne prepisuje: vsako plačilo je nova vrstica
// WorkOrderPayment, preostanek pa se izračuna (payment-summary.ts).
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { sanitizeMoney } from "@/lib/cash-register/core"
import {
  isPublicToken,
  newPublicToken,
  publicOrderPath,
  summarizePayments,
  type PaymentSummary,
} from "@/lib/work-orders/payment-summary"

export interface PaymentActionResult {
  ok: boolean
  error?: string
  path?: string
}

const MANUAL_METHODS = ["cash", "card", "transfer"] as const
const ALL_METHODS = [...MANUAL_METHODS, "stripe"] as const

/** Preveri, da naročilo pripada temu podjetju, in vrne ključne podatke. */
async function loadOrder(orderId: string, organizationId: string) {
  return prisma.workOrder.findFirst({
    where: { id: orderId, organizationId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      depositAmount: true,
      publicToken: true,
    },
  })
}

/** Ustvari javno povezavo (ali vrne obstoječo). */
export async function getOrCreateWorkOrderShareLink(
  orderId: string,
  options?: { rotate?: boolean }
): Promise<PaymentActionResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const order = await loadOrder(orderId, org.id)
  if (!order) return { ok: false, error: "NOT_FOUND" }

  let token = order.publicToken
  if (!token || options?.rotate) {
    token = newPublicToken()
    await prisma.workOrder.update({
      where: { id: order.id },
      data: { publicToken: token },
    })
  }

  if (!isPublicToken(token)) return { ok: false, error: "GENERIC" }

  revalidatePath(`/dashboard/work-orders/${orderId}`)
  return { ok: true, path: publicOrderPath(org.slug, token) }
}

const depositSchema = z.object({
  /** null = brez depozita. */
  amount: z.union([z.number(), z.string(), z.null()]),
})

/** Načrtovani depozit na naročilu (ne sme preseči zneska predračuna). */
export async function setWorkOrderDeposit(
  orderId: string,
  input: z.input<typeof depositSchema>
): Promise<PaymentActionResult> {
  const parsed = depositSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const { org, session } = await requirePermissionOrg("workorders.manage")
  const order = await loadOrder(orderId, org.id)
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }

  let amount: number | null = null
  if (parsed.data.amount !== null && parsed.data.amount !== "") {
    amount = sanitizeMoney(parsed.data.amount)
    if (amount === null || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
    const total = order.total === null ? null : Number(order.total)
    if (total === null) return { ok: false, error: "NO_TOTAL" }
    if (amount > total) return { ok: false, error: "DEPOSIT_OVER_TOTAL" }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrder.update({
      where: { id: order.id },
      data: { depositAmount: amount },
    })
    await tx.workOrderEvent.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        type: "NOTE",
        message:
          amount === null
            ? "Depozit odstranjen"
            : `Načrtovani depozit: ${amount.toFixed(2)} €`,
        actorEmail: session.user?.email ?? null,
      },
    })
  })

  revalidatePath(`/dashboard/work-orders/${orderId}`)
  return { ok: true }
}

const paymentSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  method: z.enum(MANUAL_METHODS),
  note: z.string().trim().max(300).nullable().optional(),
})

/**
 * Ročno zabeleženo plačilo (gotovina/kartica/nakazilo pri prevzemu).
 * Depozit prek Stripe zapiše webhook — tu ga ni mogoče ponarediti.
 */
export async function recordWorkOrderPayment(
  orderId: string,
  input: z.input<typeof paymentSchema>
): Promise<PaymentActionResult> {
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const amount = sanitizeMoney(parsed.data.amount)
  if (amount === null || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }

  const { org, session } = await requirePermissionOrg("workorders.manage")
  const order = await loadOrder(orderId, org.id)
  if (!order) return { ok: false, error: "NOT_FOUND" }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.workOrderPayment.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        amount,
        method: parsed.data.method,
        note: parsed.data.note ?? null,
        recordedById: session.user.id,
      },
    })
    await tx.workOrderEvent.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        type: "NOTE",
        message: `Plačilo prejeto: ${amount.toFixed(2)} € (${parsed.data.method})`,
        actorEmail: session.user?.email ?? null,
      },
    })
    return tx.workOrderPayment.aggregate({
      where: { workOrderId: order.id },
      _sum: { amount: true },
    })
  })

  // Depozit je pokrit takoj, ko vsota plačil doseže načrtovani depozit.
  const paid = Number(updated._sum.amount ?? 0)
  const deposit = order.depositAmount === null ? null : Number(order.depositAmount)
  if (deposit !== null && deposit > 0 && paid >= deposit) {
    await prisma.workOrder.updateMany({
      where: { id: order.id, depositPaidAt: null },
      data: { depositPaidAt: new Date() },
    })
  }

  revalidatePath(`/dashboard/work-orders/${orderId}`)
  revalidatePath("/dashboard/work-orders")
  revalidatePath("/dashboard/payments")
  return { ok: true }
}

export interface DebtorRow {
  id: string
  number: number
  title: string
  status: string
  dueDate: string | null
  overdue: boolean
  customerName: string | null
  customerEmail: string | null
  total: number
  paid: number
  balance: number
  /** Depozit načrtovan, a še ni pokrit. */
  depositPending: number | null
}

export interface DebtorsOverview {
  rows: DebtorRow[]
  totals: { balance: number; overdueBalance: number; count: number }
}

/**
 * Pregled neplačanih naročil: vsa odprta naročila z zneskom in
 * preostankom > 0, najprej zapadla. Sl SIGMA računa strežnik.
 */
export async function getDebtorsOverview(): Promise<DebtorsOverview> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const orders = await prisma.workOrder.findMany({
    where: { organizationId: org.id, status: "OPEN", total: { not: null } },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    take: 500,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      dueDate: true,
      total: true,
      depositAmount: true,
      customer: { select: { name: true, email: true } },
      payments: { select: { amount: true } },
    },
  })

  const now = Date.now()
  const rows: DebtorRow[] = []

  for (const o of orders) {
    const summary: PaymentSummary = summarizePayments({
      total: Number(o.total),
      depositAmount: o.depositAmount === null ? null : Number(o.depositAmount),
      payments: o.payments.map((p) => Number(p.amount)),
    })
    if (summary.balance <= 0) continue

    const deposit = summary.depositAmount
    rows.push({
      id: o.id,
      number: o.number,
      title: o.title,
      status: o.status,
      dueDate: o.dueDate?.toISOString() ?? null,
      overdue: !!o.dueDate && o.dueDate.getTime() < now,
      customerName: o.customer?.name ?? null,
      customerEmail: o.customer?.email ?? null,
      total: summary.total ?? 0,
      paid: summary.paid,
      balance: summary.balance,
      depositPending:
        deposit !== null && deposit > 0 && summary.paid < deposit
          ? Math.round((deposit - summary.paid) * 100) / 100
          : null,
    })
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.balance += r.balance
      if (r.overdue) acc.overdueBalance += r.balance
      acc.count += 1
      return acc
    },
    { balance: 0, overdueBalance: 0, count: 0 }
  )

  return {
    rows,
    totals: {
      balance: Math.round(totals.balance * 100) / 100,
      overdueBalance: Math.round(totals.overdueBalance * 100) / 100,
      count: totals.count,
    },
  }
}

/** Vsi veljavni načini plačila (za UI). */
export const WORK_ORDER_PAYMENT_METHODS = ALL_METHODS
