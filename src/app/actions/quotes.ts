/**
 * FAZA 2 — VERIGA PONUDB (F2 §2). 
 *
 * Statusi ponudbe (Document.type = "QUOTE", Document.status):
 *   DRAFT → SENT → CONFIRMED  (→ pretvorba v račun)
 *           SENT → REJECTED (z razlogom)
 *           DRAFT/SENT → SUPERSEDED (ko se ustvari nova različica)
 *
 * Vse org-scoped; dostop prek requirePermissionOrg (org iz sessiona,
 * NIKOLI iz requesta). Postavke ponudbe shranjene kot DocumentItem.
 * Številčenje prek obstoječega nextDocumentNumber (ločeno per type).
 * Revizija vsake spremembe v DocumentEvent.
 */
"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import type { PermissionKey } from "@/lib/permissions/roles"
import { revalidatePath } from "next/cache"
import { nextDocumentNumber, fiscalYearOf, docNumberLabel } from "@/lib/documents/numbering"
import { computeDocument, type LineInput } from "@/lib/documents/money"

export interface QuoteLineInput {
  description: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  vatRate?: number
}

export interface CreateQuoteFromWorkOrderInput {
  workOrderId: string
  issueDate?: string
  dueDate?: string
  notes?: string
  items?: QuoteLineInput[] // če ni dano, se uporabi WorkOrder.total kot ena linija
}

export interface QuoteActionResultOk {
  ok: true
  id: string
  code: string
}
export interface QuoteActionResultErr {
  ok: false
  error: string
}
export type QuoteActionResult = QuoteActionResultOk | QuoteActionResultErr

async function orgContext(key: PermissionKey) {
  const ctx = await requirePermissionOrg(key)
  const config = await prisma.salonConfig.findUnique({ where: { organizationId: ctx.org.id } })
  return { ...ctx, config }
}

/**
 * Ustvari ponudbo iz delovnega naloga (F2 §2.1). Kopira postavke če so
 * podane; sicer ena opisna linija z WorkOrder.total (če je nastavljen).
 * Nova ponudba vedno v DRAFT; statusi SENT/CONFIRMED/REJECTED skozi ostale
 * akcije. Če za ta WO kdaj obstaja že poslana/potrjena ponudba, jo
 * uporabnik lahko zavrže (REJECTED/SUPERSEDED) preden ustvari novo.
 */
export async function createQuoteFromWorkOrder(input: CreateQuoteFromWorkOrderInput): Promise<QuoteActionResult> {
  const { org, config, session } = await orgContext("finances.documents.manage")
  const wo = await prisma.workOrder.findFirst({ where: { id: input.workOrderId, organizationId: org.id } })
  if (!wo) return { ok: false, error: "NOT_FOUND_WORKORDER" }
  if (!wo.customerId) return { ok: false, error: "WORKORDER_NO_CUSTOMER" }

  const vatEnabled = config?.isVatRegistered === true
  const currency = config?.currency ?? "EUR"

  // Postavke: uporabnikove ali pa ena linija iz WO.
  let lines: LineInput[]
  if (input.items && input.items.length > 0) {
    lines = input.items.map((it) => ({
      description: it.description.trim(),
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent ?? 0,
      vatRate: it.vatRate ?? 0,
    }))
    for (const l of lines) {
      if (!l.description) return { ok: false, error: "EMPTY_LINE" }
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) return { ok: false, error: "INVALID_QUANTITY" }
      if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) return { ok: false, error: "INVALID_PRICE" }
    }
  } else {
    if (wo.total == null) return { ok: false, error: "WORKORDER_NO_TOTAL" }
    lines = [{
      description: wo.title || "Delovni nalog",
      quantity: 1,
      unitPrice: Number(wo.total),
      discountPercent: 0,
      vatRate: 0,
    }]
  }

  const computed = computeDocument(lines, vatEnabled)
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date()
  const fiscalYear = fiscalYearOf(issueDate)

  const created = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, org.id, "QUOTE", fiscalYear)
    return tx.document.create({
      data: {
        organizationId: org.id,
        type: "QUOTE",
        number,
        status: "DRAFT",
        customerId: wo.customerId!,
        workOrderId: wo.id,
        issueDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        fiscalYear,
        currency,
        vatEnabled,
        subtotal: computed.totals.subtotal,
        discountAmount: computed.totals.discountAmount,
        taxBase: computed.totals.taxBase,
        taxTotal: computed.totals.taxTotal,
        total: computed.totals.total,
        notes: input.notes?.trim() || null,
        items: {
          create: computed.lines.map((l, i) => ({
            organizationId: org.id,
            description: lines[i].description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
            vatRate: l.vatRate,
            discountPercent: l.discountPercent ?? 0,
            taxBaseLine: l.taxBaseLine,
            vatAmount: l.vatAmount,
            position: i + 1,
          })),
        },
        events: {
          create: {
            organizationId: org.id,
            kind: "CREATED",
            message: "Ponudba ustvarjena",
            actorUserId: session.user.id,
          },
        },
      },
    })
  })
  revalidatePath("/dashboard/documents")
  return {
    ok: true,
    id: created.id,
    code: docNumberLabel("QUOTE", fiscalYear, created.number),
  }
}

/** Pošlje ponudbo stranki (DRAFT → SENT). Samo iz DRAFT. */
export async function sendQuote(id: string): Promise<QuoteActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const q = await prisma.document.findFirst({ where: { id, organizationId: org.id, type: "QUOTE" } })
  if (!q) return { ok: false, error: "NOT_FOUND" }
  if (q.status !== "DRAFT") return { ok: false, error: "BAD_STATE" }

  await prisma.document.update({
    where: { id },
    data: {
      status: "SENT",
      issuedAt: new Date(),
      issuedByUserId: q.issuedByUserId,
      events: { create: { organizationId: org.id, kind: "ISSUED", message: "Ponudba poslana stranki" } },
    },
  })
  revalidatePath("/dashboard/documents")
  return { ok: true, id, code: docNumberLabel("QUOTE", q.fiscalYear, q.number) }
}

/** Stranka/upravitelj potrdi ponudbo (SENT → CONFIRMED). */
export async function confirmQuote(id: string): Promise<QuoteActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const q = await prisma.document.findFirst({ where: { id, organizationId: org.id, type: "QUOTE" } })
  if (!q) return { ok: false, error: "NOT_FOUND" }
  if (q.status !== "SENT") return { ok: false, error: "BAD_STATE" }

  await prisma.document.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      events: { create: { organizationId: org.id, kind: "CUSTOM", message: "Ponudba potrjena" } },
    },
  })
  revalidatePath("/dashboard/documents")
  return { ok: true, id, code: docNumberLabel("QUOTE", q.fiscalYear, q.number) }
}

/** Stranka zavrne ponudbo (SENT → REJECTED) z razlogom. */
export async function rejectQuote(id: string, reason: string): Promise<QuoteActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const q = await prisma.document.findFirst({ where: { id, organizationId: org.id, type: "QUOTE" } })
  if (!q) return { ok: false, error: "NOT_FOUND" }
  if (q.status !== "SENT") return { ok: false, error: "BAD_STATE" }
  if (!reason?.trim()) return { ok: false, error: "NO_REASON" }

  await prisma.document.update({
    where: { id },
    data: {
      status: "REJECTED",
      notes: [q.notes, `Zavrnjeno: ${reason.trim()}`].filter(Boolean).join("\n"),
      events: { create: { organizationId: org.id, kind: "CUSTOM", message: `Ponudba zavrnjena — ${reason.trim()}` } },
    },
  })
  revalidatePath("/dashboard/documents")
  return { ok: true, id, code: docNumberLabel("QUOTE", q.fiscalYear, q.number) }
}

/** Označi ponudbo kot zamenjano (DRAFT/SENT → SUPERSEDED) ob novi različici. */
export async function supersedeQuote(id: string): Promise<QuoteActionResult> {
  const { org } = await requirePermissionOrg("finances.documents.manage")
  const q = await prisma.document.findFirst({ where: { id, organizationId: org.id, type: "QUOTE" } })
  if (!q) return { ok: false, error: "NOT_FOUND" }
  if (q.status !== "DRAFT" && q.status !== "SENT") return { ok: false, error: "BAD_STATE" }

  await prisma.document.update({
    where: { id },
    data: {
      status: "SUPERSEDED",
      events: { create: { organizationId: org.id, kind: "CUSTOM", message: "Ponudba zamenjana z novejšo različico" } },
    },
  })
  revalidatePath("/dashboard/documents")
  return { ok: true, id, code: docNumberLabel("QUOTE", q.fiscalYear, q.number) }
}

export interface QuoteListItem {
  id: string
  code: string
  customerName: string | null
  status: string
  total: number
  workOrderId: string | null
  issueDate: string
  sourceId: string | null
}
export type QuoteListResult = { ok: true; items: QuoteListItem[] } | { ok: false; error: string }

/** Seznam ponudb za org (skupaj s povezavo na izpeljani račun). */
export async function listQuotes(): Promise<QuoteListResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const quotes = await prisma.document.findMany({
    where: { organizationId: org.id, type: "QUOTE" },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  })
  return {
    ok: true,
    items: quotes.map((q) => ({
      id: q.id,
      code: docNumberLabel("QUOTE", q.fiscalYear, q.number),
      customerName: q.customer?.name ?? null,
      status: q.status,
      total: Number(q.total),
      workOrderId: q.workOrderId,
      issueDate: q.issueDate.toISOString(),
      sourceId: q.sourceId,
    })),
  }
}