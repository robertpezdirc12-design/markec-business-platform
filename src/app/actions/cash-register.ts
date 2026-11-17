"use server"

// ============================================================
// BLAGAJNA (WP-1) — strežniške akcije
//
// Enotna denarna pot: blagajna NE ustvarja svojih prodaj. Vsaka prodaja
// je Order (neposredna prodaja, actions/direct-sale.ts), seja pa je
// dnevno knjižbeno okno:
//   • odprtje z ošteviljenim začetnim fondom,
//   • vezane prodaje (Order.cashSessionId),
//   • drobni stroški (CashExpense),
//   • zaprtje z izračunom pričakovane gotovine in odstopanja.
//
// Izračuni so v čistem jedru src/lib/cash-register/core.ts (brez DB) —
// te akcije samo berejo/pišejo in ga kličejo, da UI in testi računajo
// enako.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  canWriteToSession,
  computeSessionTotals,
  computeVariance,
  sanitizeMoney,
  type SessionTotals,
} from "@/lib/cash-register/core"

export interface CashSessionView {
  id: string
  status: string
  openedAt: string
  closedAt: string | null
  openingFloat: number
  openedByEmail: string | null
  closedByEmail: string | null
  staffName: string | null
  notes: string | null
  /** Živi izračun (odprta seja) oz. shranjen snapshot (zaprta). */
  totals: SessionTotals
  actualAmount: number | null
  varianceAmount: number | null
}

export interface CashTransactionView {
  id: string
  type: "SALE" | "EXPENSE"
  at: string
  label: string
  amount: number
  orderId: string | null
  paymentMethod: string | null
}

export interface CashRegisterState {
  openSession: CashSessionView | null
  history: CashSessionView[]
  transactions: CashTransactionView[]
  /** Aktivni izdelki, ki jih je mogoče prodati na blagajni. */
  products: { id: string; name: string; price: number; stock: number }[]
  customers: { id: string; name: string; email: string | null }[]
}

export interface CashActionResult {
  ok: boolean
  error?: string
  sessionId?: string
}

const orgScoped = { organizationId: true as const }

async function loadSessionView(
  session: {
    id: string
    status: string
    openedAt: Date
    closedAt: Date | null
    openingFloat: unknown
    openedBy?: { email: string | null } | null
    closedBy?: { email: string | null } | null
    staffName?: string | null
    notes: string | null
    cashSalesTotal: unknown
    cardSalesTotal: unknown
    transferSalesTotal: unknown
    expensesTotal: unknown
    expectedAmount: unknown
    actualAmount: unknown
    varianceAmount: unknown
    salesCount?: number
  },
  live?: SessionTotals
): Promise<CashSessionView> {
  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
  const nullable = (v: unknown) => (v === null || v === undefined ? null : Number(v))

  return {
    id: session.id,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    openingFloat: num(session.openingFloat),
    openedByEmail: session.openedBy?.email ?? null,
    closedByEmail: session.closedBy?.email ?? null,
    staffName: session.staffName ?? null,
    notes: session.notes,
    totals:
      live ??
      ({
        salesTotal: num(session.cashSalesTotal) + num(session.cardSalesTotal) + num(session.transferSalesTotal),
        cashTotal: num(session.cashSalesTotal),
        cardTotal: num(session.cardSalesTotal),
        transferTotal: num(session.transferSalesTotal),
        expensesTotal: num(session.expensesTotal),
        expectedCash: num(session.expectedAmount),
        saleCount: session.salesCount ?? 0,
      } satisfies SessionTotals),
    actualAmount: nullable(session.actualAmount),
    varianceAmount: nullable(session.varianceAmount),
  }
}

/** Seja + njeni živi zneski (prodaje iz Order, stroški iz CashExpense). */
async function readLiveSession(sessionId: string): Promise<{
  orders: { total: unknown; paymentMethod: string | null }[]
  expenses: { amount: unknown }[]
}> {
  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { cashSessionId: sessionId },
      select: { total: true, paymentMethod: true },
    }),
    prisma.cashExpense.findMany({
      where: { sessionId },
      select: { amount: true },
    }),
  ])
  return { orders, expenses }
}

/** Stanje blagajne za UI: odprta seja, gibi, zgodovina, izdelki, stranke. */
export async function getCashRegisterState(): Promise<CashRegisterState> {
  const { org } = await requirePermissionOrg("orders.manage")

  const [open, closed, products, customers] = await Promise.all([
    prisma.cashSession.findFirst({
      where: { organizationId: org.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: {
        openedBy: { select: { email: true } },
        closedBy: { select: { email: true } },
      },
    }),
    prisma.cashSession.findMany({
      where: { organizationId: org.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 10,
      include: {
        openedBy: { select: { email: true } },
        closedBy: { select: { email: true } },
      },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, price: true, stockQuantity: true },
    }),
    prisma.customer.findMany({
      where: { organizationId: org.id, isArchived: false },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, email: true },
    }),
  ])

  let openSession: CashSessionView | null = null
  let transactions: CashTransactionView[] = []

  if (open) {
    const { orders, expenses } = await readLiveSession(open.id)
    const totals = computeSessionTotals({
      openingFloat: Number(open.openingFloat),
      sales: orders.map((o) => ({
        paymentMethod: o.paymentMethod ?? "cash",
        amount: Number(o.total),
      })),
      expenses: expenses.map((e) => ({ amount: Number(e.amount) })),
    })
    openSession = await loadSessionView(open, totals)

    const [saleRows, expenseRows] = await Promise.all([
      prisma.order.findMany({
        where: { cashSessionId: open.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          createdAt: true,
          guestName: true,
          customer: { select: { name: true } },
          items: {
            select: {
              variantName: true,
              product: { select: { name: true } },
            },
            take: 3,
          },
        },
      }),
      prisma.cashExpense.findMany({
        where: { sessionId: open.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, label: true, amount: true, createdAt: true },
      }),
    ])

    transactions = [
      ...saleRows.map((o) => ({
        id: o.id,
        type: "SALE" as const,
        at: o.createdAt.toISOString(),
        label:
          o.customer?.name ||
          o.guestName ||
          o.items
            .map((i) => i.variantName ?? i.product?.name ?? "")
            .filter(Boolean)
            .join(", ") ||
          "Prodaja",
        amount: Number(o.total),
        orderId: o.id,
        paymentMethod: o.paymentMethod,
      })),
      ...expenseRows.map((e) => ({
        id: e.id,
        type: "EXPENSE" as const,
        at: e.createdAt.toISOString(),
        label: e.label,
        amount: Number(e.amount),
        orderId: null,
        paymentMethod: null,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1))
  }

  return {
    openSession,
    history: await Promise.all(closed.map((s) => loadSessionView(s))),
    transactions,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: p.stockQuantity,
    })),
    customers,
  }
}

const openSchema = z.object({
  openingFloat: z.union([z.number(), z.string()]),
  staffId: z.string().min(1).max(64).nullable().optional(),
})

/** Odpre novo sejo. Druga odprta seja v istem podjetju ni dovoljena. */
export async function openCashSession(
  input: z.input<typeof openSchema>
): Promise<CashActionResult> {
  const parsed = openSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const openingFloat = sanitizeMoney(parsed.data.openingFloat)
  if (openingFloat === null) return { ok: false, error: "INVALID_AMOUNT" }

  const { org, session } = await requirePermissionOrg("orders.manage")

  const existing = await prisma.cashSession.findFirst({
    where: { organizationId: org.id, status: "OPEN" },
    select: { id: true },
  })
  if (existing) return { ok: false, error: "ALREADY_OPEN" }

  // Zaposleni mora pripadati istemu podjetju (mehka referenca).
  let staffId: string | null = null
  if (parsed.data.staffId) {
    const staff = await prisma.staff.findFirst({
      where: { id: parsed.data.staffId, organizationId: org.id },
      select: { id: true },
    })
    if (staff) staffId = staff.id
  }

  const created = await prisma.cashSession.create({
    data: {
      ...orgScoped,
      organizationId: org.id,
      openedById: session.user.id,
      staffId,
      openingFloat,
      status: "OPEN",
    },
    select: { id: true },
  })

  revalidatePath("/dashboard/cash-register")
  return { ok: true, sessionId: created.id }
}

const expenseSchema = z.object({
  label: z.string().trim().min(2).max(120),
  category: z.enum(["drobci", "nakup", "drugo"]).optional(),
  amount: z.union([z.number(), z.string()]),
})

/** Drobni strošek se knjiži izključno v ODPRTO sejo. */
export async function addCashExpense(
  input: z.input<typeof expenseSchema>
): Promise<CashActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const amount = sanitizeMoney(parsed.data.amount)
  if (amount === null || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }

  const { org, session } = await requirePermissionOrg("orders.manage")

  const open = await prisma.cashSession.findFirst({
    where: { organizationId: org.id, status: "OPEN" },
    select: { id: true, status: true },
  })
  if (!open) return { ok: false, error: "NO_OPEN_SESSION" }
  if (!canWriteToSession(open.status)) return { ok: false, error: "SESSION_CLOSED" }

  await prisma.cashExpense.create({
    data: {
      organizationId: org.id,
      sessionId: open.id,
      label: parsed.data.label,
      category: parsed.data.category ?? "drugo",
      amount,
      recordedById: session.user.id,
    },
  })

  revalidatePath("/dashboard/cash-register")
  return { ok: true, sessionId: open.id }
}

const closeSchema = z.object({
  countedCash: z.union([z.number(), z.string()]),
  notes: z.string().trim().max(500).nullable().optional(),
})

/**
 * Zapre sejo: izračuna pričakovano gotovino iz dejanskih prodaj in
 * stroškov, shrani snapshot + odstopanje. Zaprte seje ni mogoče
 * ponovno odpreti (denarna zgodovina ostane nespremenjena).
 */
export async function closeCashSession(
  input: z.input<typeof closeSchema>
): Promise<CashActionResult> {
  const parsed = closeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const countedCash = sanitizeMoney(parsed.data.countedCash)
  if (countedCash === null) return { ok: false, error: "INVALID_AMOUNT" }

  const { org, session } = await requirePermissionOrg("orders.manage")

  const open = await prisma.cashSession.findFirst({
    where: { organizationId: org.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  })
  if (!open) return { ok: false, error: "NO_OPEN_SESSION" }

  const { orders, expenses } = await readLiveSession(open.id)
  const totals = computeSessionTotals({
    openingFloat: Number(
      (
        await prisma.cashSession.findUnique({
          where: { id: open.id },
          select: { openingFloat: true },
        })
      )?.openingFloat ?? 0
    ),
    sales: orders.map((o) => ({
      paymentMethod: o.paymentMethod ?? "cash",
      amount: Number(o.total),
    })),
    expenses: expenses.map((e) => ({ amount: Number(e.amount) })),
  })

  const variance = computeVariance(totals.expectedCash, countedCash)

  await prisma.cashSession.update({
    where: { id: open.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: session.user.id,
      salesCount: totals.saleCount,
      cashSalesTotal: totals.cashTotal,
      cardSalesTotal: totals.cardTotal,
      transferSalesTotal: totals.transferTotal,
      expensesTotal: totals.expensesTotal,
      expectedAmount: totals.expectedCash,
      actualAmount: countedCash,
      varianceAmount: variance,
      notes: parsed.data.notes ?? null,
    },
  })

  revalidatePath("/dashboard/cash-register")
  return { ok: true, sessionId: open.id }
}
