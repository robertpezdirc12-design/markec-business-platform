"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireDocumentPermission } from "@/lib/auth/guards"
import { computeDocument, type LineInput } from "@/lib/documents/money"
import { nextDocumentNumber, fiscalYearOf, docNumberLabel } from "@/lib/documents/numbering"
import { buildIssuerSnapshot, buildCustomerSnapshot } from "@/lib/documents/snapshots"
import {
  toCents,
  fromCents,
  reconcilePaymentState,
  creditAllowedCents,
  canBookPayment,
} from "@/lib/documents/ledger"
import { buildDocumentPdf, sha256Buffer, safePdfFilename, type PdfDocumentPayload } from "@/lib/documents/pdf"
import {
  allocationAmountCents,
  splitAllocation,
  isSupportedVatRate,
  isoDate,
  servicePeriodLabel,
} from "@/lib/documents/advances"
import { sendDocumentEmail } from "@/lib/email/document-send"

// ============================================================
// DOCUMENTS: QUOTES + INVOICES (F5.5.4.1)
//
//  • Vse akcije so org-scoped + IDOR-varno (`where {id, organizationId}`).
//  • Branje/pregled -> requireDocumentPermission("finances.view").
//    Pisanje/izdajanje -> requireDocumentPermission("finances.documents.manage").
//    Plačila -> "finances.documents.pay"; dobropisi -> "finances.documents.credit".
//    STAFF z ustreznim ključem je dovoljen; STAFF brez ključa zavrnjen.
//  • Nespremenljivost: po ISSUED (in vseh terminalnih statusih) se vsebina
//    ne more več spreminjati; prikaz izdanega dokumenta bere POSNETEK
//    (issuerSnapshot/customerSnapshot), ne živih Customer/SalonConfig.
//  • Številčenje per org+tip+poslovno leto prek DocumentSequence (FOR
//    UPDATE) — vzporedno izdajanje ne more dobiti iste številke.
//  • Totali so strežniško izračunani (cena BRUTO / DDV vključen).
// ============================================================

export type DocumentType = "QUOTE" | "INVOICE" | "ADVANCE"

/** Uporabniška napaka z rezultatno kodo (ok:false) za prekinitev transakcije. */
class DocError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

export interface DocumentLineInput {
  description: string
  quantity: number
  unitPrice: number // BRUTO (DDV vključen)
  discountPercent?: number
  vatRate?: number
  catalogRef?: string
}

export interface CustomerSourceRef {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export interface DocumentItemInfo {
  id: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  vatRate: number
  vatAmount: number
  total: number
}

export interface DocumentTotalsInfo {
  subtotal: number
  discountAmount: number
  taxBase: number
  taxTotal: number
  total: number
  vatEnabled: boolean
  currency: string
}

export interface DocumentListItem {
  id: string
  type: DocumentType
  number: number
  docCode: string
  fiscalYear: number
  status: string
  customerName: string | null
  workOrderId: string | null
  workOrderTitle: string | null
  workOrderNumber: number | null
  orderId: string | null
  orderLabel: string | null
  appointmentId: string | null
  issueDate: string
  dueDate: string | null
  total: number
  overdue: boolean
  createdAt: string
}

// F5.5.4.5.2 — ločen seznam avansov (ne meša se s ponudbami/računi).
export interface AdvanceListItem {
  id: string
  docCode: string
  fiscalYear: number
  number: number
  status: string
  customerName: string | null
  issueDate: string
  total: number // predvideni/bručni znesek avansa
  received: number // dejansko prejeto + nevrnjeno (paidAmount)
  used: number // bruto že Apliciranega dela (vsota ACTIVE alokacij)
  unused: number // Max(0, received − used); odprto za nadaljnjo uporabo
  parentInvoiceCode: string | null // kam je trenutno Apliciran (AKTIVNO)
}

// F5.5.4.5.2 — ločene statistike avansov, izven prihodkov/bančnih prilivov.
export interface AdvanceStats {
  issued: number // izdanih avansov (status ≠ DRAFT)
  received: number // Σ prejetega (paidAmount) vseh izdanih
  unpaid: number // Σ(total − paidAmount) vseh izdanih (neplačani delež)
  used: number // število AKTIVNIH alokacij
  unused: number // število izdanih avansov brez AKTIVNE alokacije
}

export interface AdvanceAllocationHistoryRow {
  id: string
  appliedToInvoice: string
  invoiceCode: string
  amount: number
  taxBase: number
  taxTotal: number
  status: string // ACTIVE | REVOKED
  allocatedAt: string | null
  revokedAt: string | null
  revokedById: string | null
  revokeReason: string | null
}

export interface DocsStats {
  quotesDraft: number
  quotesSent: number
  quotesAccepted: number
  quotesRejected: number
  invoicesDraft: number
  invoicesIssued: number
  invoicesUnpaid: number
  invoicesPaid: number
  unpaidTotal: number
  overdueCount: number
}

export interface DocumentsOverview {
  quotes: DocumentListItem[]
  invoices: DocumentListItem[]
  advances: AdvanceListItem[]
  stats: DocsStats
  advanceStats: AdvanceStats
  openWorkOrders: { id: string; number: number; title: string }[]
  openOrders: OrderSourceRef[]
  appointments: AppointmentSourceRef[]
}

export interface DocumentSourceRef {
  id: string
  number: number
  title: string
}

export interface OrderSourceRef {
  id: string
  label: string
}

export interface AppointmentSourceRef {
  id: string
  startTime: string
  customerName: string | null
}

export interface DocumentDetail {
  id: string
  type: DocumentType
  number: number
  docCode: string
  fiscalYear: number
  status: string
  statusLabel: string
  issuedAt: string | null
  issueDate: string
  dueDate: string | null
  notes: string | null
  customer: {
    id?: string | null
    name: string
    email?: string | null
    phone?: string | null
    fromSnapshot: boolean
  } | null
  issuer: {
    name: string
    street?: string | null
    city?: string | null
    zip?: string | null
    country?: string | null
    email?: string | null
    phone?: string | null
    vatId?: string | null
    isVatRegistered: boolean
    vatLabel: string
    registrationNumber?: string | null
    bankAccount?: string | null
  } | null
  workOrder: { id: string; number: number; title: string } | null
  order: OrderSourceRef | null
  appointment: AppointmentSourceRef | null
  totals: DocumentTotalsInfo
  paidAmount: number // F5.5.4.2
  creditedTotal: number // F5.5.4.2
  items: DocumentItemInfo[]
  createdAt: string
  // F5.5.4.5 — avansi + datum storitve
  serviceDate: string | null
  servicePeriod: string | null
  advanceTotal: number
  advanceRefs: { id: string; docCode: string; amount: number }[]
  // F5.5.4.5.2 — odprti znesek (total − paid − credited; avans ŽE v paidAmount).
  openAmount: number
}

const DOC_TYPES = ["QUOTE", "INVOICE", "ADVANCE"] as const

function mb(v: unknown): string | null {
  return v == null ? null : String(v)
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Razreši prikaznega izdajatelja: POSNETEK za izdane, živo SalonConfig za DRAFT. */
function resolveIssuerForDisplay(
  issuerSnapshot: unknown,
  live: { name: string; address?: string | null; city?: string | null; zip?: string | null; country?: string | null; email?: string | null; phone?: string | null; vatId?: string | null; isVatRegistered?: boolean; registrationNumber?: string | null; bankAccount?: string | null; vatLabel?: string }
) {
  if (issuerSnapshot && typeof issuerSnapshot === "object") {
    const s = issuerSnapshot as Record<string, unknown>
    const isVat = s.isVatRegistered === true
    return {
      name: mb(s.name) ?? "",
      street: mb(s.street),
      city: mb(s.city),
      zip: mb(s.zip),
      country: mb(s.country),
      email: mb(s.email),
      phone: mb(s.phone),
      vatId: mb(s.vatId),
      isVatRegistered: isVat,
      vatLabel: isVat ? (mb(s.vatLabel) ?? "DDV zavezanec") : "ni DDV zavezanec",
      registrationNumber: mb(s.registrationNumber),
      bankAccount: mb(s.bankAccount),
    }
  }
  return {
    name: live.name,
    street: live.address ?? null,
    city: live.city ?? null,
    zip: live.zip ?? null,
    country: live.country ?? null,
    email: live.email ?? null,
    phone: live.phone ?? null,
    vatId: live.vatId ?? null,
    isVatRegistered: live.isVatRegistered === true,
    vatLabel: live.vatLabel ?? (live.isVatRegistered ? "DDV zavezanec" : "ni DDV zavezanec"),
    registrationNumber: live.registrationNumber ?? null,
    bankAccount: live.bankAccount ?? null,
  }
}

function serializeListItem(
  d: {
    id: string
    type: string
    number: number
    status: string
    fiscalYear: number
    issueDate: Date
    dueDate: Date | null
    total: { toNumber(): number }
    createdAt: Date
    customer: { name: string } | null
    customerSnapshot: unknown
    workOrder: { id: string; number: number; title: string } | null
    order: { id: string; guestName: string | null; customer: { name: string } | null } | null
    appointment: { id: string } | null
  }
): DocumentListItem {
  const overdue =
    d.type === "INVOICE" &&
    d.status === "ISSUED" &&
    !!d.dueDate &&
    d.dueDate.getTime() < Date.now()
  const snapName =
    d.customerSnapshot && typeof d.customerSnapshot === "object"
      ? (d.customerSnapshot as Record<string, unknown>).name
      : null
  return {
    id: d.id,
    type: d.type as DocumentType,
    number: d.number,
    docCode: docNumberLabel(d.type as DocumentType, d.fiscalYear, d.number),
    fiscalYear: d.fiscalYear,
    status: d.status,
    customerName: mb(snapName) ?? d.customer?.name ?? null,
    workOrderId: d.workOrder?.id ?? null,
    workOrderTitle: d.workOrder?.title ?? null,
    workOrderNumber: d.workOrder?.number ?? null,
    orderId: d.order?.id ?? null,
    orderLabel: d.order ? (d.order.customer?.name ?? d.order.guestName ?? "Naročilo") : null,
    appointmentId: d.appointment?.id ?? null,
    issueDate: d.issueDate.toISOString(),
    dueDate: d.dueDate?.toISOString() ?? null,
    total: d.total.toNumber(),
    overdue,
    createdAt: d.createdAt.toISOString(),
  }
}

function computeStats(
  docs: { type: string; status: string; dueDate: Date | null; total: { toNumber(): number } }[]
): DocsStats {
  const now = Date.now()
  const stats: DocsStats = {
    quotesDraft: 0, quotesSent: 0, quotesAccepted: 0, quotesRejected: 0,
    invoicesDraft: 0, invoicesIssued: 0, invoicesUnpaid: 0, invoicesPaid: 0,
    unpaidTotal: 0, overdueCount: 0,
  }
  for (const d of docs) {
    if (d.type === "QUOTE") {
      if (d.status === "DRAFT") stats.quotesDraft++
      if (d.status === "SENT") stats.quotesSent++
      if (d.status === "ACCEPTED") stats.quotesAccepted++
      if (d.status === "REJECTED") stats.quotesRejected++
      continue
    }
    if (d.type === "ADVANCE") {
      // F5.5.4.5.1: avansni račun NIKOLI ne sme biti štet kot neplačani
      // račun ali v unpaidTotal — to je predplačniški zahtevek, ne
      // prihodkovni dolg. (Namenske "avansne statistike" so predmet
      // ločenega predloga; odstranjen iz osnovne statistike.)
      continue
    }
    // INVOICE
    if (d.status === "DRAFT") stats.invoicesDraft++
    if (d.status === "ISSUED") {
      stats.invoicesIssued++
      stats.invoicesUnpaid++ // izdan, še ni plačan
      stats.unpaidTotal += d.total.toNumber()
      if (d.dueDate && d.dueDate.getTime() < now) stats.overdueCount++
    }
    if (d.status === "PARTIALLY_PAID") {
      stats.invoicesUnpaid++ // delno plačan, a odprt znesek > 0
    }
    if (d.status === "PAID") stats.invoicesPaid++
  }
  return stats
}

function snapNameOf(snapshot: unknown): string | null {
  return snapshot && typeof snapshot === "object" && "name" in snapshot
    ? (snapshot as Record<string, unknown>).name as string
    : null
}

/** Bralni pregled dokumentov + izvori za povezave. */
export async function getDocumentsOverview(): Promise<DocumentsOverview> {
  const { org } = await requireDocumentPermission("finances.view")

  const [docs, openWorkOrders, openOrders, appointments] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId: org.id, type: { in: [...DOC_TYPES] } },
      include: {
        customer: { select: { name: true } },
        workOrder: { select: { id: true, number: true, title: true } },
        order: { select: { id: true, guestName: true, customer: { select: { name: true } } } },
        appointment: { select: { id: true } },
      },
      orderBy: [{ type: "asc" }, { fiscalYear: "desc" }, { number: "desc" }],
    }),
    prisma.workOrder.findMany({
      where: { organizationId: org.id, status: "OPEN" },
      select: { id: true, number: true, title: true },
      orderBy: { number: "desc" },
      take: 200,
    }),
    prisma.order.findMany({
      where: { organizationId: org.id, status: { in: ["PAID", "COMPLETED", "PENDING"] } },
      select: { id: true, guestName: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.appointment.findMany({
      where: { organizationId: org.id, status: "COMPLETED" },
      select: { id: true, startTime: true, customer: { select: { name: true } }, guestName: true },
      orderBy: { startTime: "desc" },
      take: 200,
    }),
  ])

  const quotes = docs.filter((d) => d.type === "QUOTE").map(serializeListItem)
  // F5.5.4.5.2 — AVANSI SO LOČENI od ponudb in končnih računov; INVOICE tab
  // vsebuje samo navadne račune.
  const invoices = docs.filter((d) => d.type === "INVOICE").map(serializeListItem)
  const advancesRaw = docs.filter((d) => d.type === "ADVANCE")

  // Pripomocek: used (ACTIVE alokacije) po avansu + oznaka trenutnega računa,
  // na katerega je avans Apliciran (ACTIVE). Paralelne bralne poizvedbe.
  const [allocs, parents] = await Promise.all([
    prisma.documentAdvanceAllocation.findMany({
      where: { organizationId: org.id, status: "ACTIVE" },
      select: { advanceId: true, amount: true, appliedToInvoice: true },
    }),
    (async () => {
      const activeIds = await prisma.documentAdvanceAllocation
        .findMany({ where: { organizationId: org.id, status: "ACTIVE" }, select: { appliedToInvoice: true } })
        .then((rows) => [...new Set(rows.map((r) => r.appliedToInvoice))])
      return activeIds.length
        ? prisma.document.findMany({
            where: { organizationId: org.id, id: { in: activeIds } },
            select: { id: true, number: true, fiscalYear: true },
          })
        : ([] as { id: string; number: number; fiscalYear: number }[])
    })(),
  ])

  const usedByAdvance = new Map<string, number>()
  const parentCodeByAdvance = new Map<string, string | null>()
  for (const a of allocs) {
    const cents = (Math.round((a.amount.toNumber() + Number.EPSILON) * 100))
    usedByAdvance.set(a.advanceId, (usedByAdvance.get(a.advanceId) ?? 0) + cents)
    const p = parents.find((pd) => pd.id === a.appliedToInvoice)
    if (p) parentCodeByAdvance.set(a.advanceId, docNumberLabel("INVOICE", p.fiscalYear, p.number))
  }
  const usedEur = (cents: number) => Math.round(cents) / 100

  const advances: AdvanceListItem[] = advancesRaw.map((a) => {
    const received = a.paidAmount.toNumber()
    const usedCents = usedByAdvance.get(a.id) ?? 0
    const used = usedEur(usedCents)
    const unused = Math.round(Math.max(0, received - used) * 100) / 100
    return {
      id: a.id,
      docCode: docNumberLabel("ADVANCE", a.fiscalYear, a.number),
      fiscalYear: a.fiscalYear,
      number: a.number,
      status: a.status,
      customerName: mb(snapNameOf(a.customerSnapshot)) ?? a.customer?.name ?? null,
      issueDate: a.issueDate.toISOString(),
      total: a.total.toNumber(),
      received: Math.round(received * 100) / 100,
      used,
      unused,
      parentInvoiceCode: parentCodeByAdvance.get(a.id) ?? null,
    }
  })

  // F5.5.4.5.2 — ločene statistike avansov (izven prihodkov / blagajne).
  const issuedA = advancesRaw.filter((a) => a.status !== "DRAFT")
  let receivedSum = 0
  let unpaidSum = 0
  for (const a of issuedA) {
    receivedSum += a.paidAmount.toNumber()
    unpaidSum += Math.max(0, a.total.toNumber() - a.paidAmount.toNumber())
  }
  const advanceStats: AdvanceStats = {
    issued: issuedA.length,
    received: Math.round(receivedSum * 100) / 100,
    unpaid: Math.round(unpaidSum * 100) / 100,
    used: allocs.length,
    unused: issuedA.filter((a) => (usedByAdvance.get(a.id) ?? 0) === 0).length,
  }

  return {
    quotes,
    invoices,
    advances,
    stats: computeStats(docs),
    advanceStats,
    openWorkOrders,
    openOrders: openOrders.map((o) => ({ id: o.id, label: o.customer?.name ?? o.guestName ?? o.id })),
    appointments: appointments.map((a) => ({
      id: a.id,
      startTime: a.startTime.toISOString(),
      customerName: a.customer?.name ?? a.guestName ?? null,
    })),
  }
}

/** Bralni pregled podrobnosti (posnetek za izdane dokumente). */
export async function getDocumentDetail(id: string): Promise<DocumentDetail | null> {
  const { org } = await requireDocumentPermission("finances.view")

  const doc = await prisma.document.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      workOrder: { select: { id: true, number: true, title: true } },
      order: { select: { id: true, guestName: true, customer: { select: { name: true } } } },
      appointment: { select: { id: true, startTime: true, customer: { select: { name: true } }, guestName: true } },
      items: { orderBy: { position: "asc" } },
    },
  })
  if (!doc) return null

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
  })
  const isIssued = doc.status !== "DRAFT"

  const issuer = resolveIssuerForDisplay(doc.issuerSnapshot, {
    name: config?.name ?? org.name,
    address: config?.address ?? null,
    city: config?.city ?? null,
    zip: config?.zipCode ?? null,
    country: config?.country ?? null,
    email: config?.email ?? null,
    phone: config?.phone ?? null,
    vatId: config?.vatId ?? null,
    isVatRegistered: config?.isVatRegistered ?? false,
    registrationNumber: config?.registrationNumber ?? null,
    bankAccount: config?.bankAccount ?? null,
    vatLabel: config?.isVatRegistered ? `DDV ${config.vatId ?? ""}`.trim() : "ni DDV zavezanec",
  })

  const customerSnapshot = doc.customerSnapshot && typeof doc.customerSnapshot === "object"
    ? (doc.customerSnapshot as Record<string, unknown>)
    : null

  // Izdani dokument -> naziv iz posnetka; DRAFT -> živo.
  const displayCustomer = customerSnapshot
    ? {
        id: doc.customerId ?? null,
        name: mb(customerSnapshot.name) ?? doc.customer?.name ?? "—",
        email: mb(customerSnapshot.email) ?? doc.customer?.email ?? null,
        phone: mb(customerSnapshot.phone) ?? doc.customer?.phone ?? null,
        fromSnapshot: true,
      }
    : doc.customer
      ? { id: doc.customer.id, name: doc.customer.name, email: doc.customer.email, phone: doc.customer.phone, fromSnapshot: false }
      : null

  const vatEnabled = isIssued ? doc.vatEnabled : (config?.isVatRegistered ?? false)

  // F5.5.4.5: aplikirani avansi (INVOICE) za prikaz reference — le AKTIVNI.
  const allocs = doc.type === "INVOICE"
    ? await prisma.documentAdvanceAllocation.findMany({
        where: { appliedToInvoice: doc.id, status: "ACTIVE" },
        include: { advance: { select: { number: true, fiscalYear: true } } },
        orderBy: { createdAt: "asc" },
      })
    : []
  const advanceRefs = allocs.map((a) => ({ id: a.id, docCode: docNumberLabel("ADVANCE", a.advance.fiscalYear, a.advance.number), amount: a.amount.toNumber() }))

  // F5.5.4.5.2 — odprti znesek v skladu z denarnim tokom: avans je ŽE v
  // paidAmount (interni prenos), zato se NE odšteva drugič. openAmount je
  // izključno bruto, ki ga stranka še dejansko dolguje:
  //   openAmount = total − paid − credited   (advanceTotal je samo prikaz/audit).
  const openAmount = Math.max(0, doc.total.toNumber() - doc.paidAmount.toNumber() - doc.creditedTotal.toNumber())

  return {
    id: doc.id,
    type: doc.type as DocumentType,
    number: doc.number,
    docCode: docNumberLabel(doc.type as DocumentType, doc.fiscalYear, doc.number),
    fiscalYear: doc.fiscalYear,
    status: doc.status,
    statusLabel: doc.status,
    issuedAt: doc.issuedAt?.toISOString() ?? null,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate?.toISOString() ?? null,
    notes: doc.notes,
    customer: displayCustomer,
    issuer,
    workOrder: doc.workOrder ? { id: doc.workOrder.id, number: doc.workOrder.number, title: doc.workOrder.title } : null,
    order:
      doc.order
        ? { id: doc.order.id, label: doc.order.customer?.name ?? doc.order.guestName ?? "Naročilo" }
        : null,
    appointment:
      doc.type === "INVOICE" && doc.appointment
        ? {
            id: doc.appointment.id,
            startTime: doc.appointment.startTime.toISOString(),
            customerName: doc.appointment.customer?.name ?? doc.appointment.guestName ?? null,
          }
        : null,
    totals: {
      subtotal: num(doc.subtotal),
      discountAmount: num(doc.discountAmount),
      taxBase: num(doc.taxBase),
      taxTotal: num(doc.taxTotal),
      total: doc.total.toNumber(),
      vatEnabled,
      currency: doc.currency || "EUR",
    },
    paidAmount: num(doc.paidAmount),
    creditedTotal: num(doc.creditedTotal),
    items: doc.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: num(it.quantity),
      unitPrice: it.unitPrice.toNumber(),
      discountPercent: num(it.discountPercent),
      vatRate: num(it.vatRate),
      vatAmount: num(it.vatAmount),
      total: it.total.toNumber(),
    })),
    createdAt: doc.createdAt.toISOString(),
    serviceDate: isoDate(doc.serviceDate),
    servicePeriod: servicePeriodLabel(doc.serviceDate, doc.servicePeriodStart, doc.servicePeriodEnd),
    advanceTotal: num(doc.advanceTotal),
    advanceRefs,
    openAmount: Math.round(openAmount * 100) / 100,
  }
}

export interface CreateDocumentInput {
  type: DocumentType
  customerId?: string | null
  workOrderId?: string | null
  orderId?: string | null
  appointmentId?: string | null
  issueDate?: string | null
  dueDate?: string | null
  // F5.5.4.5 — datum / obdobje opravljene storitve (ločeno od issue/due).
  serviceDate?: string | null
  servicePeriodStart?: string | null
  servicePeriodEnd?: string | null
  // F5.5.4.5 — za ADVANCE: datum dejansko prejetega predplačila (ločeno od
  // predvidenega datuma storitve; NA-ner zamenjan).
  advanceReceivedAt?: string | null
  notes?: string | null
  items: DocumentLineInput[]
}

export interface DocumentActionResult {
  ok: boolean
  error?: string
  id?: string
}

function validateDocInput(input: CreateDocumentInput): { ok: true; lines: LineInput[] } | { ok: false; error: string } {
  if (input.type !== "QUOTE" && input.type !== "INVOICE" && input.type !== "ADVANCE")
    return { ok: false, error: "INVALID_TYPE" }
  if (!input.items || input.items.length === 0)
    return { ok: false, error: "NO_ITEMS" }
  const lines: LineInput[] = []
  for (const it of input.items) {
    const description = it.description?.trim()
    if (!description) return { ok: false, error: "EMPTY_LINE" }
    if (!Number.isFinite(it.quantity) || it.quantity <= 0)
      return { ok: false, error: "INVALID_QUANTITY" }
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0)
      return { ok: false, error: "INVALID_PRICE" }
    // F5.5.4.5: za avansni račun ni nepodprtih davčnih režimov — če stopnja ni
    // splošno podprta, izdajo BLOKIRAJ (namesto napačnega obračuna).
    if (input.type === "ADVANCE" && !isSupportedVatRate(it.vatRate ?? 0))
      return { ok: false, error: "UNSUPPORTED_VAT_RATE" }
    lines.push({
      description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent ?? 0,
      vatRate: it.vatRate ?? 0,
    })
  }
  return { ok: true, lines }
}

/** Konfiguracija izdajatelja za orodni vnos (branje). */
export async function getDocumentIssuerConfig(): Promise<{
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  zip?: string | null
  country?: string | null
  vatId?: string | null
  isVatRegistered: boolean
  currency: string
}> {
  const { org } = await requireDocumentPermission("finances.view")
  const config = await prisma.salonConfig.findUnique({ where: { organizationId: org.id } })
  return {
    name: config?.name ?? org.name,
    email: config?.email ?? null,
    phone: config?.phone ?? null,
    address: config?.address ?? null,
    city: config?.city ?? null,
    zip: config?.zipCode ?? null,
    country: config?.country ?? null,
    vatId: config?.vatId ?? null,
    isVatRegistered: config?.isVatRegistered ?? false,
    currency: config?.currency ?? "EUR",
  }
}

async function validateLinksOrgScoped(
  orgId: string,
  input: CreateDocumentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.workOrderId) {
    const wo = await prisma.workOrder.findFirst({ where: { id: input.workOrderId, organizationId: orgId }, select: { id: true } })
    if (!wo) return { ok: false, error: "NOT_FOUND_WORKORDER" }
  }
  if (input.orderId) {
    const o = await prisma.order.findFirst({ where: { id: input.orderId, organizationId: orgId }, select: { id: true } })
    if (!o) return { ok: false, error: "NOT_FOUND_ORDER" }
  }
  if (input.appointmentId) {
    const a = await prisma.appointment.findFirst({ where: { id: input.appointmentId, organizationId: orgId }, select: { id: true } })
    if (!a) return { ok: false, error: "NOT_FOUND_APPOINTMENT" }
  }
  return { ok: true }
}

/** Ustvari dokument v DRAFT; številka iz DocumentSequence (org+tip+leto). */
export async function createDocument(input: CreateDocumentInput): Promise<DocumentActionResult> {
  const { org } = await requireDocumentPermission("finances.documents.manage")
  const v = validateDocInput(input)
  if (!v.ok) return { ok: false, error: v.error }

  if (input.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: input.customerId, organizationId: org.id }, select: { id: true } })
    if (!c) return { ok: false, error: "NOT_FOUND_CUSTOMER" }
  }
  const linkCheck = await validateLinksOrgScoped(org.id, input)
  if (!linkCheck.ok) return { ok: false, error: linkCheck.error }

  // Davčna politika iz konfiguracije org (NIKOLI ne predpostavljamo DDV).
  const config = await prisma.salonConfig.findUnique({ where: { organizationId: org.id } })
  const vatEnabled = config?.isVatRegistered === true
  const currency = config?.currency ?? "EUR"

  const computed = computeDocument(v.lines, vatEnabled)

  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date()
  const fiscalYear = fiscalYearOf(issueDate)

  const created = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, org.id, input.type, fiscalYear)
    return tx.document.create({
      data: {
        organizationId: org.id,
        type: input.type,
        number,
        status: "DRAFT",
        customerId: input.customerId || null,
        workOrderId: input.workOrderId || null,
        orderId: input.orderId || null,
        appointmentId: input.appointmentId || null,
        issueDate,
        fiscalYear,
        currency,
        vatEnabled,
        subtotal: computed.totals.subtotal,
        discountAmount: computed.totals.discountAmount,
        taxBase: computed.totals.taxBase,
        taxTotal: computed.totals.taxTotal,
        total: computed.totals.total,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
        servicePeriodStart: input.servicePeriodStart ? new Date(input.servicePeriodStart) : null,
        servicePeriodEnd: input.servicePeriodEnd ? new Date(input.servicePeriodEnd) : null,
        notes: input.notes?.trim() || null,
        items: {
          create: computed.lines.map((l, i) => ({
            organizationId: org.id,
            description: v.lines[i].description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
            vatRate: l.vatRate,
            discountPercent: l.discountPercent,
            taxBaseLine: l.taxBaseLine,
            vatAmount: l.vatAmount,
            position: i + 1,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

/** Uredi dokument — SAMO v DRAFT; po ISSUED in terminalnih statusih prepovedano. */
export async function updateDocument(id: string, input: CreateDocumentInput): Promise<DocumentActionResult> {
  const { org } = await requireDocumentPermission("finances.documents.manage")
  const doc = await prisma.document.findFirst({ where: { id, organizationId: org.id } })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status !== "DRAFT") return { ok: false, error: "LOCKED_AFTER_ISSUE" }

  const v = validateDocInput(input)
  if (!v.ok) return { ok: false, error: v.error }

  if (input.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: input.customerId, organizationId: org.id }, select: { id: true } })
    if (!c) return { ok: false, error: "NOT_FOUND_CUSTOMER" }
  }
  const linkCheck = await validateLinksOrgScoped(org.id, input)
  if (!linkCheck.ok) return { ok: false, error: linkCheck.error }

  const config = await prisma.salonConfig.findUnique({ where: { organizationId: org.id } })
  const vatEnabled = config?.isVatRegistered === true
  const computed = computeDocument(v.lines, vatEnabled)
  const issueDate = input.issueDate ? new Date(input.issueDate) : doc.issueDate

  await prisma.$transaction(async (tx) => {
    await tx.documentItem.deleteMany({ where: { documentId: doc.id } })
    await tx.document.update({
      where: { id: doc.id },
      data: {
        customerId: input.customerId || null,
        workOrderId: input.workOrderId || null,
        orderId: input.orderId || null,
        appointmentId: input.appointmentId || null,
        issueDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
        servicePeriodStart: input.servicePeriodStart ? new Date(input.servicePeriodStart) : null,
        servicePeriodEnd: input.servicePeriodEnd ? new Date(input.servicePeriodEnd) : null,
        notes: input.notes?.trim() || null,
        subtotal: computed.totals.subtotal,
        discountAmount: computed.totals.discountAmount,
        taxBase: computed.totals.taxBase,
        taxTotal: computed.totals.taxTotal,
        total: computed.totals.total,
        items: {
          create: computed.lines.map((l, i) => ({
            organizationId: org.id,
            description: v.lines[i].description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
            vatRate: l.vatRate,
            discountPercent: l.discountPercent,
            taxBaseLine: l.taxBaseLine,
            vatAmount: l.vatAmount,
            position: i + 1,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/documents")
  revalidatePath(`/dashboard/documents/${doc.id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: doc.id }
}

/** Izbriši dokument — le DRAFT (osnutke je treba moči umakniti). */
export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const { org } = await requireDocumentPermission("finances.documents.manage")
  const doc = await prisma.document.findFirst({ where: { id, organizationId: org.id } })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status !== "DRAFT") return { ok: false, error: "LOCKED_AFTER_ISSUE" }
  await prisma.document.delete({ where: { id: doc.id } })
  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: doc.id }
}

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "REJECTED", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED"],
}
const INVOICE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
}
const ADVANCE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
}

/** Pred izdajo preveri obvezna polja (stranka, vsaj ena linija, total). */
function validateForIssue(doc: {
  type: string
  customerId: string | null
  customerSnapshot: unknown
  issueDate: Date
  items?: { total: unknown; vatRate?: unknown }[]
}): string | null {
  if (doc.type === "INVOICE" && !doc.customerId && !doc.customerSnapshot)
    return "INVOICE_NEEDS_CUSTOMER"
  // F5.5.4.5: avansni račun NUJNO potrebuje stranko (zapovedi prejemnik) in
  // le podprte davčne stopnje.
  if (doc.type === "ADVANCE") {
    if (!doc.customerId && !doc.customerSnapshot) return "INVOICE_NEEDS_CUSTOMER"
    if (doc.items?.some((it) => !isSupportedVatRate(Number(it.vatRate) || 0))) return "UNSUPPORTED_VAT_RATE"
  }
  if (!doc.items || doc.items.length === 0) return "NO_ITEMS"
  return null
}

/**
 * Spremeni status dokumenta (validiran prehod). Ob prehodu v ISSUED se
 * zbere nespremenljiv snapshot in dokument zaklene. Po ISSUED ni več
 * mogoče spreminjati vsebine (razen statusnega napredka).
 */
export async function changeDocumentStatus(id: string, status: string): Promise<DocumentActionResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.manage")
  const doc = await prisma.document.findFirst({ where: { id, organizationId: org.id }, include: { items: true } })
  if (!doc) return { ok: false, error: "NOT_FOUND" }

  const allowed = doc.type === "QUOTE" ? QUOTE_TRANSITIONS : doc.type === "ADVANCE" ? ADVANCE_TRANSITIONS : INVOICE_TRANSITIONS
  const next = allowed[doc.status] ?? []
  if (!next.includes(status)) return { ok: false, error: "INVALID_TRANSITION" }

  // IMMUTABILNOST: nikoli ne vračaj iz terminalnega statusa.
  if (doc.status === "PAID" || doc.status === "ACCEPTED" || doc.status === "REJECTED") {
    return { ok: false, error: "INVALID_TRANSITION" }
  }

  const issueValidation = validateForIssue(doc)
  if (status === "ISSUED" && issueValidation) return { ok: false, error: issueValidation }

  await prisma.$transaction(async (tx) => {
    let data: Prisma.DocumentUpdateInput = { status }
    if (status === "ISSUED") {
      // Zberi nespremenljiv posnetek izdajatelja in stranke.
      const config = await tx.salonConfig.findUnique({ where: { organizationId: org.id } })
      // F5.5.4.6.2 — ob izdaji se v customerSnapshot zamrznejo tudi e-račun polja
      // kupca (naslov, davčna, matična, ID...). Vsa so optional, dokler
      // podjetje ne začne uporabljati e-računov — obstoječe stranke niso
      // prisiljene v izpolnjevanje.
      const customer = doc.customerId
        ? await tx.customer.findUnique({
            where: { id: doc.customerId },
            select: {
              name: true, email: true, phone: true,
              customerType: true, legalName: true, street: true, postalCode: true, city: true,
              country: true, taxNumber: true, vatId: true, registrationNumber: true,
              electronicId: true, electronicIdScheme: true, buyerReference: true, orderReference: true,
            },
          })
        : null
      data = {
        status,
        issuedAt: new Date(),
        issuedByUserId: session?.user?.id ?? null,
        issuerSnapshot: buildIssuerSnapshot({
          name: config?.name ?? org.name,
          street: config?.address ?? null,
          city: config?.city ?? null,
          zip: config?.zipCode ?? null,
          country: config?.country ?? null,
          email: config?.email ?? null,
          phone: config?.phone ?? null,
          vatId: config?.vatId ?? null,
          isVatRegistered: config?.isVatRegistered ?? false,
          registrationNumber: config?.registrationNumber ?? null,
          bankAccount: config?.bankAccount ?? null,
          currency: doc.currency,
        }) as unknown as Prisma.InputJsonValue,
        customerSnapshot: customer
          ? (buildCustomerSnapshot(customer) as unknown as Prisma.InputJsonValue)
          : undefined,
        vatEnabled: config?.isVatRegistered ?? doc.vatEnabled,
      }
    }
    await tx.document.update({ where: { id: doc.id }, data })
    // F5.5.4.2 — revizijska sled življenjskega cikla.
    await logEvent(
      tx,
      doc.id,
      org.id,
      status === "ISSUED" ? "ISSUED" : status === "CANCELLED" ? "CANCELLED" : status,
      session?.user?.id ?? null,
      `Stanje: ${doc.status} → ${status}`
    )
  })

  revalidatePath("/dashboard/documents")
  revalidatePath(`/dashboard/documents/${doc.id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: doc.id }
}

/** Pokaži dokument (kvote → račun) v DRAFT; za izdane ni več mogoče. */
export async function convertQuoteToSuggestedInvoice(quoteId: string, issueDate?: string): Promise<DocumentActionResult> {
  const { org } = await requireDocumentPermission("finances.documents.manage")
  const quote = await prisma.document.findFirst({
    where: { id: quoteId, organizationId: org.id, type: "QUOTE" },
    include: { items: { orderBy: { position: "asc" } } },
  })
  if (!quote) return { ok: false, error: "NOT_FOUND" }
  if (quote.status !== "ACCEPTED") return { ok: false, error: "NOT_ACCEPTED" }

  const issue = new Date(issueDate ?? quote.issueDate)
  const fiscalYear = fiscalYearOf(issue)

  const created = await prisma.$transaction(async (tx) => {
    await nextDocumentNumber(tx, org.id, "INVOICE", fiscalYear)
    const seq = await tx.documentSequence.findUnique({
      where: { organizationId_type_fiscalYear: { organizationId: org.id, type: "INVOICE", fiscalYear } },
    })
    return tx.document.create({
      data: {
        organizationId: org.id,
        type: "INVOICE",
        number: seq!.current,
        status: "DRAFT",
        customerId: quote.customerId,
        workOrderId: quote.workOrderId,
        orderId: quote.orderId,
        appointmentId: quote.appointmentId,
        issueDate: issue,
        dueDate: quote.dueDate,
        currency: quote.currency,
        fiscalYear,
        vatEnabled: quote.vatEnabled,
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxBase: quote.taxBase,
        taxTotal: quote.taxTotal,
        total: quote.total,
        notes: quote.notes,
        items: {
          create: quote.items.map((it) => ({
            organizationId: org.id,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
            vatRate: it.vatRate,
            discountPercent: it.discountPercent,
            taxBaseLine: it.taxBaseLine,
            vatAmount: it.vatAmount,
            position: it.position,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

/** Stranke za izbirnik (branje). */
export async function listDocumentCustomers(): Promise<CustomerSourceRef[]> {
  const { org } = await requireDocumentPermission("finances.view")
  const customers = await prisma.customer.findMany({
    where: { organizationId: org.id, isArchived: false },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take: 300,
  })
  return customers
}

/** Izbriši (in reexposition) — backward-compatible z obstoječim `convertQuoteToInvoice`. */
export async function convertQuoteToInvoice(id: string): Promise<DocumentActionResult> {
  return convertQuoteToSuggestedInvoice(id)
}

// ============================================================
// F5.5.4.2 — PLAČILA, DOBROPISI IN ŽIVLJENJSKI CIKEL
// ============================================================

export interface PaymentInput {
  amount: number // EUR, > 0
  method?: string | null
  reference?: string | null // unikaten sklic (prepreči dvojno knjiženje)
  paidAt?: string | null
}

export interface PaymentResult {
  ok: boolean
  error?: string
  id?: string
  status?: string
  openAmount?: number
}

export interface DocumentPaymentInfo {
  id: string
  kind: string
  amount: number
  method: string | null
  reference: string | null
  paidAt: string
  status: string
  reversalOfId: string | null
}

export interface DocumentCreditInfo {
  id: string
  number: number
  docCode: string
  status: string
  amount: number
  taxBase: number
  taxTotal: number
  vatEnabled: boolean
  reason: string | null
  issuedAt: string
  originalInvoiceCode: string
}

/** Pridobi izdan račun (org-scoped) ali vrni null. */
async function getOrgInvoice(docId: string, orgId: string) {
  return prisma.document.findFirst({
    where: { id: docId, organizationId: orgId, type: "INVOICE" },
  })
}

/** Pridobi izdan dokument, ki lahko nosi plačila/dobropise (INVOICE ali ADVANCE). */
async function getPayableDoc(docId: string, orgId: string) {
  return prisma.document.findFirst({
    where: { id: docId, organizationId: orgId, type: { in: ["INVOICE", "ADVANCE"] } },
  })
}

/** Rekoncilira status dokumenta iz plačil/dobropisov in zabeleži spremembo. */
async function reconcileDocument(
  tx: Prisma.TransactionClient,
  doc: { id: string; organizationId: string; total: { toNumber(): number }; status: string; dueDate: Date | null }
): Promise<{ status: string; paidAmount: number; creditedTotal: number; openAmount: number; overdue: boolean }> {
  const [aggPaid, aggCredit] = await Promise.all([
    tx.documentPayment.aggregate({
      where: { documentId: doc.id, status: "CLEARED" },
      _sum: { amount: true },
    }),
    tx.creditNote.aggregate({
      where: { invoiceId: doc.id, status: "ISSUED" },
      _sum: { amount: true },
    }),
  ])
  const totalCents = toCents(doc.total.toNumber())
  const paidCents = toCents(aggPaid._sum.amount?.toNumber() ?? 0)
  const creditedCents = toCents(aggCredit._sum.amount?.toNumber() ?? 0)
  const terminal = doc.status === "CANCELLED" || doc.status === "ACCEPTED" || doc.status === "REJECTED"
  const st = reconcilePaymentState({
    totalCents,
    paidCents,
    creditedCents,
    dueDate: doc.dueDate ? doc.dueDate.getTime() : null,
    now: Date.now(),
    statusBefore: doc.status,
    terminal,
  })

  await tx.document.update({
    where: { id: doc.id },
    data: {
      status: st.status,
      paidAmount: fromCents(st.paidCents),
      creditedTotal: fromCents(st.creditedCents),
    },
  })

  return {
    status: st.status,
    paidAmount: fromCents(st.paidCents),
    creditedTotal: fromCents(st.creditedCents),
    openAmount: fromCents(st.openCents),
    overdue: st.overdue,
  }
}

async function logEvent(
  tx: Prisma.TransactionClient,
  docId: string,
  organizationId: string,
  kind: string,
  actorUserId: string | null,
  message: string,
  amount?: number
) {
  await tx.documentEvent.create({
    data: { documentId: docId, organizationId, kind, actorUserId, message, amount: amount ?? null },
  })
}

/**
 * Knjiži plačilo na račun. Zaščite: (a) ne sme preseči odprtega zneska
 * (preplačilo → OVERPAYMENT), (b) isti `reference` ne sme biti vknjižen
 * dvakrat (delni unikat), (c) storno NI tiho brisanje (REVERSAL vrstica),
 * (d) plačilo obdela SAMO izdan račun (ne DRAFT/QUOTE/CANCELLED).
 */
export async function recordDocumentPayment(docId: string, input: PaymentInput): Promise<PaymentResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.pay")
  const doc = await getPayableDoc(docId, org.id)
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status !== "ISSUED" && doc.status !== "PARTIALLY_PAID" && doc.status !== "PAID") {
    return { ok: false, error: "NOT_PAYABLE" }
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
  const reference = input.reference?.trim() || null
  const method = input.method?.trim() || null
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()
  const amountCents = toCents(amount)

  // Vse preverbe in knjiženje potekajo v transakciji z zaklepom vrstice
  // dokumenta (FOR UPDATE), da vzporedna plačila istega računa ne presežejo
  // odprtega zneska (aplikativni neverjetni preplet) in se reference ne
  // podvojijo med dvema transakcijama.
  try {
    const payment = await prisma.$transaction(async (tx) => {
      // Zakleni dokument, da se knjižbe za ta račun serijalizirajo.
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${doc.id} FOR UPDATE`

      const aggPaid = await tx.documentPayment.aggregate({
        where: { documentId: doc.id, status: "CLEARED" },
        _sum: { amount: true },
      })
      const paidCents = toCents(aggPaid._sum.amount?.toNumber() ?? 0)
      const credited = await tx.document.aggregate({ where: { id: doc.id }, _sum: { creditedTotal: true } })
      const creditedCents = toCents(credited._sum.creditedTotal?.toNumber() ?? 0)

      // Dvojno knjiženje iste reference (ročno + delni unikat v bazi).
      if (reference) {
        const dup = await tx.documentPayment.findFirst({
          where: { organizationId: org.id, documentId: doc.id, reference, kind: "PAYMENT", status: "CLEARED" },
          select: { id: true },
        })
        if (dup) throw new DocError("DUPLICATE_PAYMENT")
      }

      const openCents = toCents(doc.total.toNumber()) - paidCents - creditedCents
      if (!canBookPayment(openCents, amountCents)) throw new DocError("OVERPAYMENT")

      const p = await tx.documentPayment.create({
        data: {
          organizationId: org.id,
          documentId: doc.id,
          kind: "PAYMENT",
          amount,
          method,
          reference,
          paidAt,
          recordedById: session?.user?.id ?? null,
        },
      })
      const rec = await reconcileDocument(tx, doc)
      await logEvent(tx, doc.id, org.id, rec.status, session?.user?.id ?? null, `Plačilo ${amount.toFixed(2)} €`, amount)
      return { id: p.id, status: rec.status, openAmount: rec.openAmount }
    })
    revalidatePath("/dashboard/documents")
    revalidatePath(`/dashboard/documents/${doc.id}`)
    return { ok: true, ...payment }
  } catch (e) {
    if (e instanceof DocError) return { ok: false, error: e.message }
    // P2002 = delni unikat reference → dvojno plačilo.
    if (e instanceof Error && "code" in (e as object) && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "DUPLICATE_PAYMENT" }
    }
    throw e
  }
}

/** Seznam plačil računa (branje). */
export async function listDocumentPayments(docId: string): Promise<DocumentPaymentInfo[] | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const doc = await getPayableDoc(docId, org.id)
  if (!doc) return null
  const rows = await prisma.documentPayment.findMany({
    where: { organizationId: org.id, documentId: doc.id },
    orderBy: { paidAt: "asc" },
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: r.amount.toNumber(),
    method: r.method,
    reference: r.reference,
    paidAt: r.paidAt.toISOString(),
    status: r.status,
    reversalOfId: r.reversalOfId,
  }))
}

/**
 * Storno (razveljavitev) plačila — sledljiv negativen vnos (REVERSAL), nikoli
 * tiho brisanje. Izvirno plačilo ostane v knjigi; paidAmount se zniža.
 */
export async function reverseDocumentPayment(docId: string, paymentId: string, reason?: string): Promise<PaymentResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.pay")
  const doc = await getPayableDoc(docId, org.id)
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  const payment = await prisma.documentPayment.findFirst({
    where: { id: paymentId, organizationId: org.id, documentId: doc.id, kind: "PAYMENT" },
  })
  if (!payment) return { ok: false, error: "NOT_FOUND_PAYMENT" }
  // Plačilo, ki je že stornirano, se ne sme še enkrat stornirati.
  const already = await prisma.documentPayment.findFirst({
    where: { reversalOfId: payment.id, kind: "REVERSAL", status: "CLEARED" },
    select: { id: true },
  })
  if (already) return { ok: false, error: "ALREADY_REVERSED" }

  const reversalAmount = -payment.amount.toNumber()
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${doc.id} FOR UPDATE`
    await tx.documentPayment.create({
      data: {
        organizationId: org.id,
        documentId: doc.id,
        kind: "REVERSAL",
        amount: reversalAmount,
        method: payment.method,
        reference: null,
        paidAt: new Date(),
        reversalOfId: payment.id,
        recordedById: session?.user?.id ?? null,
      },
    })
    await reconcileDocument(tx, doc)
    await logEvent(
      tx,
      doc.id,
      org.id,
      "REVERSAL",
      session?.user?.id ?? null,
      `Storno plačila ${payment.amount.toNumber().toFixed(2)} €${reason ? ` (${reason})` : ""}`,
      reversalAmount
    )
  })
  revalidatePath("/dashboard/documents")
  revalidatePath(`/dashboard/documents/${doc.id}`)
  return { ok: true, id: paymentId }
}

// ============================================================
// F5.5.4.5 — AVANSNI RAČUNI: aplikacija na končni račun.
//
// Postopek apliciranja:
//  1) Preverimo, da je avans org-scoped, tip ADVANCE, STATUS != DRAFT,
//     še NI apliciran (DocumentAdvanceAllocation.@unique) in da obstaja
//     stranka.
//  2) Preverimo dejansko prejeto+nevrnjeno vsoto na avansu (paidAmount;
//     storno z REVERSAL zniža). Apliciramo le tisto, kar je res prejeto.
//  3) Ne smemo preseči odprtega zneska končnega računa.
//  4) Ustvarimo DocumentPayment (method="advance", reference=AVN-kod) na
//     končnem računu → paidAmount naraste prek obstoječega ledžerja.
//  5) Ustvarimo DocumentAdvanceAllocation (guard dvojne uporabe) in
//     advancedTotal na končnem (prikaz) + parentInvoiceId na avansu.
//  Vse v eni transakciji z FOR UPDATE zaklepom končnega računa.
// ============================================================

export interface AdvanceRef {
  id: string
  docCode: string
  received: number // dejansko prejeto+nevrnjeno (bruto)
}

/** Seznam aplicirljivih avansov (branje) za izbirnik na končnem računu. */
export async function listApplicableAdvances(invoiceId: string): Promise<AdvanceRef[] | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const inv = await prisma.document.findFirst({ where: { id: invoiceId, organizationId: org.id, type: "INVOICE" } })
  if (!inv) return null
  const advances = await prisma.document.findMany({
    where: {
      organizationId: org.id,
      type: "ADVANCE",
      status: { not: "DRAFT" },
      parentInvoiceId: null, // doslej neuporabljeni
    },
    orderBy: { number: "asc" },
  })
  return advances.map((a) => ({
    id: a.id,
    docCode: docNumberLabel("ADVANCE", a.fiscalYear, a.number),
    received: a.paidAmount.toNumber(),
  }))
}

export interface ApplyAdvancesInput {
  advanceIds: string[]
}

export interface ApplyAdvancesResult {
  ok: boolean
  error?: string
  allocations?: { advanceId: string; amount: number; docCode: string }[]
  advanceTotal?: number
}

/**
 * Aplicira enega ali več avansov na končni račun. Prepreči dvojno uporabo
 * (dokument + DB @unique). Uporablja samo dejansko prejeto+nevrnjeno vsoto.
 */
export async function applyAdvancesToInvoice(
  invoiceId: string,
  input: ApplyAdvancesInput
): Promise<ApplyAdvancesResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.manage")
  const inv = await getOrgInvoice(invoiceId, org.id)
  if (!inv) return { ok: false, error: "NOT_FOUND" }
  if (inv.status !== "ISSUED" && inv.status !== "PARTIALLY_PAID" && inv.status !== "PAID") {
    return { ok: false, error: "NOT_PAYABLE" }
  }
  const ids = [...new Set(input.advanceIds ?? [])]
  if (ids.length === 0) return { ok: false, error: "NO_ADVANCES" }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${inv.id} FOR UPDATE`

      // Stanje končnega računa v centih.
      const aggPaid = await tx.documentPayment.aggregate({ where: { documentId: inv.id, status: "CLEARED" }, _sum: { amount: true } })
      const aggCredit = await tx.creditNote.aggregate({ where: { invoiceId: inv.id, status: "ISSUED" }, _sum: { amount: true } })
      const invTotalCents = toCents(inv.total.toNumber())
      const invPaidCents = toCents(aggPaid._sum.amount?.toNumber() ?? 0)
      const invCreditedCents = toCents(aggCredit._sum.amount?.toNumber() ?? 0)
      let openCents = invTotalCents - invPaidCents - invCreditedCents

      const allocations: { advanceId: string; amount: number; docCode: string }[] = []
      for (const adid of ids) {
        const adv = await tx.document.findFirst({
          where: { id: adid, organizationId: org.id, type: "ADVANCE" },
        })
        if (!adv) throw new DocError("NOT_FOUND_ADVANCE")
        if (adv.status === "DRAFT") throw new DocError("ADVANCE_NOT_ISSUED")
        // Dvojna uporaba → delni unikatni indeks (status='ACTIVE') bo ujel;
        // tu še eksplicitno za lep napaka. Stornirana (REVOKED) alokacija avansa
        // NE blokira ponovne uporabe.
        const used = await tx.documentAdvanceAllocation.findFirst({
          where: { organizationId: org.id, advanceId: adid, status: "ACTIVE" },
          select: { id: true },
        })
        if (used) throw new DocError("ADVANCE_ALREADY_USED")
        // Uporabimo le dejansko prejeto+nevrnjeno vsoto.
        const recvAgg = await tx.documentPayment.aggregate({
          where: { documentId: adid, status: "CLEARED" },
          _sum: { amount: true },
        })
        const receivedCents = toCents(recvAgg._sum.amount?.toNumber() ?? 0)
        if (receivedCents <= 0) throw new DocError("NO_ADVANCE_RECEIVED")

        const allocCents = allocationAmountCents(receivedCents, openCents)
        if (allocCents <= 0) throw new DocError("OVERPAYMENT")

        const amountBruto = fromCents(allocCents)
        const vatRateNumber = effectiveVatRate(adv)
        const split = splitAllocation(amountBruto, vatRateNumber, adv.vatEnabled)

        // 4) Knjižba plačila na končnem računu (method="advance") → paidAmount ↑.
        await tx.documentPayment.create({
          data: {
            organizationId: org.id,
            documentId: inv.id,
            kind: "PAYMENT",
            amount: amountBruto,
            method: "advance",
            reference: `AVN-${String(adv.number).padStart(4, "0")}`,
            paidAt: new Date(),
            recordedById: session?.user?.id ?? null,
          },
        })
        // 5) Guard + povezava. (status ACTIVE privzeto; eksplicitno zaradi jasnosti.)
        await tx.documentAdvanceAllocation.create({
          data: {
            organizationId: org.id,
            advanceId: adid,
            appliedToInvoice: inv.id,
            amount: amountBruto,
            taxBase: split.taxBase,
            taxTotal: split.taxTotal,
            vatEnabled: adv.vatEnabled,
            status: "ACTIVE",
            allocatedAt: new Date(),
            createdAt: new Date(),
          },
        })
        await tx.document.update({
          where: { id: adid },
          data: { parentInvoiceId: inv.id },
        })
        allocations.push({ advanceId: adid, amount: amountBruto, docCode: docNumberLabel("ADVANCE", adv.fiscalYear, adv.number) })
        openCents -= allocCents
      }

      // Posodobi advanceTotal na končnem + status (samo AKTIVNE alokacije).
      const allocAgg = await tx.documentAdvanceAllocation.aggregate({
        where: { appliedToInvoice: inv.id, status: "ACTIVE" },
        _sum: { amount: true },
      })
      const newAdvanceTotal = fromCents(toCents(allocAgg._sum.amount?.toNumber() ?? 0))
      await tx.document.update({
        where: { id: inv.id },
        data: { advanceTotal: newAdvanceTotal },
      })
      await reconcileDocument(tx, inv)
      await logEvent(tx, inv.id, org.id, "PAID", session?.user?.id ?? null, `Aplicirani avansi: ${allocations.length} (${newAdvanceTotal.toFixed(2)} €)`)
      return { allocations, advanceTotal: newAdvanceTotal }
    })

    revalidatePath("/dashboard/documents")
    revalidatePath(`/dashboard/documents/${inv.id}`)
    revalidatePath("/dashboard")
    return { ok: true, ...result }
  } catch (e) {
    if (e instanceof DocError) return { ok: false, error: e.message }
    if (e instanceof Error && "code" in (e as object) && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "ADVANCE_ALREADY_USED" }
    }
    throw e
  }
}

/** Izračuna efektivno DDV stopnjo iz totalov avansa (za razčlenitev alokacije). */
function effectiveVatRate(adv: { total: { toNumber(): number }; taxTotal: { toNumber(): number }; vatEnabled: boolean }): number {
  if (!adv.vatEnabled) return 0
  const total = adv.total.toNumber()
  const tax = adv.taxTotal.toNumber()
  const base = total - tax
  if (base <= 0) return 22
  const rate = (tax / base) * 100
  return Math.round(rate * 100) / 100
}

/** Prekliče aplikacijo avansa (storno plačila na končnem + guard). */
export async function reverseAdvanceAllocation(invoiceId: string, advanceId: string, reason?: string): Promise<PaymentResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.manage")
  const inv = await getOrgInvoice(invoiceId, org.id)
  if (!inv) return { ok: false, error: "NOT_FOUND" }
  const alloc = await prisma.documentAdvanceAllocation.findFirst({
    where: { organizationId: org.id, advanceId, status: "ACTIVE" },
  })
  if (!alloc || alloc.appliedToInvoice !== inv.id) return { ok: false, error: "NOT_FOUND_ALLOCATION" }

  // Poišči pripadajočo knjižbo method="advance" (reference=AVN-xxxx) na končnem.
  // F6.1 (IDOR): branch vedno org-scoped — ne smemo brati številke dokumenta
  // druge organizacije prek tujega advanceId (fail-closed).
  const adv = await prisma.document.findFirst({ where: { id: advanceId, organizationId: org.id }, select: { number: true, fiscalYear: true } })
  if (!adv) return { ok: false, error: "NOT_FOUND_ALLOCATION" }
  const refCode = adv ? `AVN-${String(adv.number).padStart(4, "0")}` : "AVN-"
  const target = await prisma.documentPayment.findFirst({
    where: {
      organizationId: org.id,
      documentId: inv.id,
      kind: "PAYMENT",
      method: "advance",
      reference: refCode,
      reversalOfId: null,
      status: "CLEARED",
    },
    orderBy: { createdAt: "desc" },
  })
  if (!target) return { ok: false, error: "NOT_FOUND_PAYMENT" }
  const already = await prisma.documentPayment.findFirst({
    where: { reversalOfId: target.id, kind: "REVERSAL", status: "CLEARED" },
    select: { id: true },
  })
  if (already) return { ok: false, error: "ALREADY_REVERSED" }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${inv.id} FOR UPDATE`
    await tx.documentPayment.create({
      data: {
        organizationId: org.id,
        documentId: inv.id,
        kind: "REVERSAL",
        amount: -target.amount.toNumber(),
        method: "advance",
        reference: null,
        paidAt: new Date(),
        reversalOfId: target.id,
        recordedById: session?.user?.id ?? null,
      },
    })
    // F5.5.4.5.2 — MEHKI STORNO: vrstice alokacije NE brišemo, ampak jo označimo
    // z REVOKED + metapodatki storniranja, da zgodovina uporabe ostane ohranjena
    // (znesek, davčna osnova, DDV, čas uporabe, kdo in razlog storniranja).
    await tx.documentAdvanceAllocation.updateMany({
      where: { organizationId: org.id, advanceId, appliedToInvoice: inv.id, status: "ACTIVE" },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedById: session?.user?.id ?? null,
        revokeReason: reason?.trim() || null,
      },
    })
    // Avans postane ponovno uporaben (ni več vezan na ta končni račun).
    // F6.1 (IDOR): update MUSt biti org-scoped — nikoli ne spreminjamo dokumenta
    // druge organizacije (advanceId), čeprav je alokacija že varovana zgoraj.
    await tx.document.updateMany({
      where: { id: advanceId, organizationId: org.id },
      data: { parentInvoiceId: null },
    })
    // advanceTotal na končnem = vsota le AKTIVNIH alokacij (stornirane se ne štejejo).
    const agg = await tx.documentAdvanceAllocation.aggregate({
      where: { appliedToInvoice: inv.id, status: "ACTIVE" },
      _sum: { amount: true },
    })
    await tx.document.update({
      where: { id: inv.id },
      data: { advanceTotal: fromCents(toCents(agg._sum.amount?.toNumber() ?? 0)) },
    })
    await reconcileDocument(tx, inv)
    await logEvent(tx, inv.id, org.id, "REVERSAL", session?.user?.id ?? null, `Storno aplikacije avansa${reason ? ` (${reason})` : ""}`)
  })
  revalidatePath("/dashboard/documents")
  revalidatePath(`/dashboard/documents/${inv.id}`)
  return { ok: true, id: advanceId }
}

/**
 * F5.5.4.5.2 — ZGODOVINA UPORABE / STORNIRANJA avansa. Vrne vse alokacije
 * (AKTIVNE in REVOKED) z metapodatki storniranja ter pripadajoče REVERSAL
 * knjižbe na končnem. Org-varano. Za UI.
 */
export async function getAdvanceHistory(advanceId: string): Promise<{
  allocations: AdvanceAllocationHistoryRow[]
  reversals: { paymentAmount: number; paidAt: string }[]
} | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const adv = await prisma.document.findFirst({
    where: { id: advanceId, organizationId: org.id, type: "ADVANCE" },
    select: { id: true },
  })
  if (!adv) return null

  const allocs = await prisma.documentAdvanceAllocation.findMany({
    where: { organizationId: org.id, advanceId },
    include: { invoice: { select: { number: true, fiscalYear: true } } },
    orderBy: { createdAt: "asc" },
  })

  const invoiceIds = [...new Set(allocs.map((a) => a.appliedToInvoice))]
  const revRows = invoiceIds.length
    ? await prisma.documentPayment.findMany({
        where: {
          organizationId: org.id,
          documentId: { in: invoiceIds },
          kind: "REVERSAL",
          method: "advance",
          reference: null,
        },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: "asc" },
      })
    : []

  return {
    allocations: allocs.map((a) => ({
      id: a.id,
      appliedToInvoice: a.appliedToInvoice,
      invoiceCode: docNumberLabel("INVOICE", a.invoice.fiscalYear, a.invoice.number),
      amount: a.amount.toNumber(),
      taxBase: a.taxBase.toNumber(),
      taxTotal: a.taxTotal.toNumber(),
      status: a.status,
      allocatedAt: a.allocatedAt?.toISOString() ?? null,
      revokedAt: a.revokedAt?.toISOString() ?? null,
      revokedById: a.revokedById,
      revokeReason: a.revokeReason,
    })),
    reversals: revRows.map((r) => ({ paymentAmount: r.amount.toNumber(), paidAt: r.paidAt.toISOString() })),
  }
}

export async function issueCreditNote(
  invoiceId: string,
  input: { amount: number; reason?: string | null }
): Promise<PaymentResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.credit")
  const inv = await getOrgInvoice(invoiceId, org.id)
  if (!inv) return { ok: false, error: "NOT_FOUND" }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" }
  const amountCents = toCents(amount)

  // Preverba dovoljenega ostanka znotraj transakcije z zaklepom vrstice.
  try {
    const fiscalYear = inv.fiscalYear
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${inv.id} FOR UPDATE`
      const credited = await tx.creditNote.aggregate({ where: { invoiceId: inv.id, status: "ISSUED" }, _sum: { amount: true } })
      const creditedCents = toCents(credited._sum.amount?.toNumber() ?? 0)
      const allowedCents = creditAllowedCents(toCents(inv.total.toNumber()), creditedCents)
      if (amountCents > allowedCents) throw new DocError("CREDIT_EXCEEDS_ALLOWED")

      // Razčlenitev DDV za dobropis na podlagi deleža v izvirnem računu.
      const totalNum = inv.total.toNumber()
      const taxTotalNum = inv.taxTotal.toNumber()
      const ratio = totalNum > 0 ? amount / totalNum : 0
      const cnTax = Math.round(taxTotalNum * ratio * 100) / 100
      const cnBase = Math.round((amount - cnTax) * 100) / 100

      const number = await nextDocumentNumber(tx, org.id, "CREDIT", fiscalYear)
      const cn = await tx.creditNote.create({
        data: {
          organizationId: org.id,
          number,
          fiscalYear,
          invoiceId: inv.id,
          customerId: inv.customerId,
          originalInvoiceNumber: inv.number,
          originalInvoiceCode: docNumberLabel("INVOICE", inv.fiscalYear, inv.number),
          amount,
          taxBase: cnBase,
          taxTotal: cnTax,
          vatEnabled: inv.vatEnabled,
          reason: input.reason?.trim() || null,
          issuedById: session?.user?.id ?? null,
        },
      })
      const rec = await reconcileDocument(tx, inv)
      await logEvent(tx, inv.id, org.id, rec.status, session?.user?.id ?? null, `Dobropis ${amount.toFixed(2)} €`, -amount)
      return { id: cn.id, number, status: rec.status, openAmount: rec.openAmount }
    })
    revalidatePath("/dashboard/documents")
    revalidatePath(`/dashboard/documents/${invoiceId}`)
    return { ok: true, id: `${created.id}`, status: created.status, openAmount: created.openAmount }
  } catch (e) {
    if (e instanceof DocError) return { ok: false, error: e.message }
    throw e
  }
}

/** Dobropisi računa (branje). */
export async function listDocumentCredits(invoiceId: string): Promise<DocumentCreditInfo[] | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const doc = await getOrgInvoice(invoiceId, org.id)
  if (!doc) return null
  const rows = await prisma.creditNote.findMany({
    where: { organizationId: org.id, invoiceId: doc.id },
    orderBy: { issuedAt: "desc" },
  })
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    docCode: docNumberLabel("CREDIT", c.fiscalYear, c.number),
    status: c.status,
    amount: c.amount.toNumber(),
    taxBase: c.taxBase.toNumber(),
    taxTotal: c.taxTotal.toNumber(),
    vatEnabled: c.vatEnabled,
    reason: c.reason,
    issuedAt: c.issuedAt.toISOString(),
    originalInvoiceCode: c.originalInvoiceCode,
  }))
}

/** Dogodki življenjskega cikla dokumenta (branje). */
export async function getDocumentTimeline(docId: string): Promise<
  { id: string; kind: string; message: string | null; amount: number | null; actorUserId: string | null; createdAt: string }[] | null
> {
  const { org } = await requireDocumentPermission("finances.view")
  const doc = await prisma.document.findFirst({ where: { id: docId, organizationId: org.id }, select: { id: true } })
  if (!doc) return null
  const rows = await prisma.documentEvent.findMany({
    where: { documentId: doc.id, organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map((e) => ({
    id: e.id,
    kind: e.kind,
    message: e.message,
    amount: e.amount?.toNumber() ?? null,
    actorUserId: e.actorUserId,
    createdAt: e.createdAt.toISOString(),
  }))
}

export interface ReceivableRow {
  customerId: string | null
  customerName: string | null
  openTotal: number
  count: number
}

/** Odprte terjatve po stranki (in org) — za pregled odprtih zneskov. */
export async function getCustomerReceivables(): Promise<ReceivableRow[]> {
  const { org } = await requireDocumentPermission("finances.view")
  const invoices = await prisma.document.findMany({
    where: { organizationId: org.id, type: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    select: { id: true, customerId: true, customer: { select: { name: true } }, customerSnapshot: true, total: true, paidAmount: true, creditedTotal: true },
  })
  const byCustomer = new Map<string | null, ReceivableRow>()
  for (const inv of invoices) {
    const open =
      inv.total.toNumber() - inv.paidAmount.toNumber() - inv.creditedTotal.toNumber()
    const key = inv.customerId
    const name = inv.customerSnapshot && typeof inv.customerSnapshot === "object" ? (inv.customerSnapshot as Record<string, unknown>).name as string : inv.customer?.name ?? null
    const cur = byCustomer.get(key) ?? { customerId: key, customerName: name ?? null, openTotal: 0, count: 0 }
    cur.openTotal = Math.round((cur.openTotal + Math.max(0, open)) * 100) / 100
    cur.count += 1
    if (!cur.customerName) cur.customerName = name ?? null
    byCustomer.set(key, cur)
  }
  return Array.from(byCustomer.values()).sort((a, b) => b.openTotal - a.openTotal)
}

// ============================================================
// F5.5.4.3 — PDF, ELEKTRONSKI ARHIV IN POŠILJANJE
// ============================================================

const EUR_FMT = (n: number) =>
  new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(n)

/** Zgradi PDF vsebino iz posnetka (nespremenljivo). Za DRAFT/ne izdanega vrne null. */
async function buildPdfPayload(docId: string, orgId: string): Promise<PdfDocumentPayload | null> {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { items: { orderBy: { position: "asc" } }, payments: { where: { status: "CLEARED" }, orderBy: { paidAt: "asc" } } },
  })
  if (!doc || doc.organizationId !== orgId) return null
  if (doc.type === "QUOTE" && doc.status === "DRAFT") return null
  if (doc.status === "DRAFT") return null

  const isIssued = doc.status !== "DRAFT"
  const issuerSnap = isIssued && doc.issuerSnapshot && typeof doc.issuerSnapshot === "object"
    ? (doc.issuerSnapshot as Record<string, unknown>)
    : null
  const config = await prisma.salonConfig.findUnique({ where: { organizationId: orgId } })
  const custSnap = doc.customerSnapshot && typeof doc.customerSnapshot === "object"
    ? (doc.customerSnapshot as Record<string, unknown>)
    : null

  const total = doc.total.toNumber()
  const paid = doc.paidAmount.toNumber()
  const credited = doc.creditedTotal.toNumber()
  const advanceTotalNum = doc.advanceTotal.toNumber()
  // F5.5.4.5.2 — DENARNI TOK BREZ DVOJNEGA ODŠTEVANJA: interni prenos avansa
  // je ŽE vštet v paidAmount, zato ga ne odštevamo še drugič. advanceTotal je
  // SAMO prikazno/revizijsko polje (razčlenitev, kolikšen del plačila je iz
  // predplačila), nikoli del izračuna odprtega zneska.
  const open = Math.max(0, total - paid - credited)

  const title = doc.type === "QUOTE" ? "PONUDBA" : doc.type === "ADVANCE" ? "AVANSNI RAČUN" : doc.type === "CREDIT" ? "DOBROPIS" : "RAČUN"
  const paymentsLabel = doc.type === "INVOICE"
    ? [
        ...(doc.advanceTotal.toNumber() > 0 ? [{ label: "Že izkazani avansi", value: EUR_FMT(advanceTotalNum) }] : []),
        { label: "Plačano", value: EUR_FMT(paid) },
        { label: "Dobropisi", value: EUR_FMT(credited) },
        { label: "Odprto za plačilo", value: EUR_FMT(open) },
      ]
    : []

  // F5.5.4.5: aplikirane AKTIVNE avanse na ta račun (za prikaz reference + DDV).
  const allocs = doc.type === "INVOICE"
    ? await prisma.documentAdvanceAllocation.findMany({
        where: { appliedToInvoice: doc.id, status: "ACTIVE" },
        include: { advance: { select: { number: true, fiscalYear: true } } },
        orderBy: { createdAt: "asc" },
      })
    : []
  const advanceRefs = allocs.map((a) => docNumberLabel("ADVANCE", a.advance.fiscalYear, a.advance.number))

  // Za ADVANCE: datum prejema predplačila = najzgodnejše prejeto plačilo.
  const advanceReceivedAt = doc.type === "ADVANCE"
    ? (() => {
        const paidRows = doc.payments ?? []
        if (paidRows.length === 0) return null
        const dt = paidRows[0]?.paidAt
        return dt ? dt.toISOString().slice(0, 10) : null
      })()
    : null

  return {
    title,
    docCode: docNumberLabel(doc.type as "QUOTE" | "INVOICE" | "ADVANCE" | "CREDIT", doc.fiscalYear, doc.number),
    issueDate: doc.issueDate.toISOString().slice(0, 10),
    dueDate: doc.dueDate ? doc.dueDate.toISOString().slice(0, 10) : null,
    serviceDate: isoDate(doc.serviceDate),
    servicePeriod: servicePeriodLabel(doc.serviceDate, doc.servicePeriodStart, doc.servicePeriodEnd),
    advanceReceivedAt,
    advanceRefs,
    advanceTotal: EUR_FMT(advanceTotalNum),
    status: doc.status,
    currency: doc.currency || "EUR",
    issuer: {
      name: (issuerSnap?.name as string) ?? config?.name ?? "",
      vatId: (issuerSnap?.vatId as string) ?? config?.vatId ?? null,
      registrationNumber: (issuerSnap?.registrationNumber as string) ?? config?.registrationNumber ?? null,
      bankAccount: (issuerSnap?.bankAccount as string) ?? config?.bankAccount ?? null,
      email: (issuerSnap?.email as string) ?? config?.email ?? null,
      phone: (issuerSnap?.phone as string) ?? config?.phone ?? null,
      street: (issuerSnap?.street as string) ?? config?.address ?? null,
      city: (issuerSnap?.city as string) ?? config?.city ?? null,
      zip: (issuerSnap?.zip as string) ?? config?.zipCode ?? null,
    },
    customer: custSnap
      ? { name: (custSnap.name as string) ?? "—", email: custSnap.email as string, phone: custSnap.phone as string }
      : null,
    lines: doc.items.map((it) => ({
      description: it.description,
      quantity: num(it.quantity).toString(),
      unitPrice: EUR_FMT(it.unitPrice.toNumber()),
      vatRate: num(it.vatRate).toString(),
      total: EUR_FMT(it.total.toNumber()),
    })),
    subtotal: EUR_FMT(num(doc.subtotal)),
    discount: num(doc.discountAmount) > 0 ? EUR_FMT(num(doc.discountAmount)) : "",
    taxBase: EUR_FMT(num(doc.taxBase)),
    taxTotal: EUR_FMT(num(doc.taxTotal)),
    total: EUR_FMT(total),
    vatEnabled: doc.vatEnabled,
    payments: paymentsLabel,
    note: doc.notes,
  }
}

export interface ArchiveResult {
  ok: boolean
  error?: string
  id?: string
  sha256?: string
  filename?: string
  size?: number
  alreadyArchived?: boolean
}

/**
 * Arhivira izdani dokument (qnenspremenljiv PDF). Če je že arhiviran, vrne
 * obstoječi original (NI prepisa — @unique(documentId)). IDOR-varano.
 */
export async function archiveDocument(docId: string): Promise<ArchiveResult> {
  const { org, session } = await requireDocumentPermission("finances.view")
  const doc = await prisma.document.findFirst({ where: { id: docId, organizationId: org.id } })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status === "DRAFT") return { ok: false, error: "NOT_ISSUED" }

  const existing = await prisma.documentArchive.findUnique({ where: { documentId: doc.id } })
  if (existing) {
    return {
      ok: true,
      alreadyArchived: true,
      id: existing.id,
      sha256: existing.sha256,
      filename: existing.filename,
      size: existing.size,
    }
  }

  const payload = await buildPdfPayload(doc.id, org.id)
  if (!payload) return { ok: false, error: "NOT_AVAILABLE" }
  const pdf = buildDocumentPdf(payload)
  const sha = sha256Buffer(pdf)
  const filename = safePdfFilename(payload.docCode, payload.title.toLowerCase())

  try {
    const archived = await prisma.documentArchive.create({
      data: {
        organizationId: org.id,
        documentId: doc.id,
        doctype: doc.type,
        docCode: payload.docCode,
        filename,
        size: pdf.length,
        sha256: sha,
        data: pdf.toString("base64"),
        generatedById: session?.user?.id ?? null,
      },
    })
    await logEvent(prisma, doc.id, org.id, doc.status, session?.user?.id ?? null, `Arhivirano: ${filename}`)
    return { ok: true, id: archived.id, sha256: sha, filename, size: pdf.length }
  } catch (e) {
    if (e instanceof Error && "code" in (e as object) && (e as { code?: string }).code === "P2002") {
      return { ok: true, error: "ALREADY_ARCHIVED", alreadyArchived: true }
    }
    throw e
  }
}

/** Metapodatki arhiva (branje) — varno za ogled/ponovno arhiviranje. */
export async function getDocumentArchiveMeta(docId: string): Promise<{
  archived: boolean
  id?: string
  sha256?: string
  filename?: string
  size?: number
  createdAt?: string
} | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const doc = await prisma.document.findFirst({ where: { id: docId, organizationId: org.id }, select: { id: true } })
  if (!doc) return null
  const a = await prisma.documentArchive.findUnique({ where: { documentId: doc.id } })
  if (!a) return { archived: false }
  return { archived: true, id: a.id, sha256: a.sha256, filename: a.filename, size: a.size, createdAt: a.createdAt.toISOString() }
}

/** Prenese arhiviran PDF (org-scoped, integriteta preverjena) — za zaščiteno ruto. */
export async function downloadDocumentArchive(archiveId: string): Promise<{
  pdf: Buffer
  filename: string
  sha256: string
} | null> {
  const { org } = await requireDocumentPermission("finances.view")
  const a = await prisma.documentArchive.findFirst({ where: { id: archiveId, organizationId: org.id } })
  if (!a) return null
  const pdf = Buffer.from(a.data, "base64")
  if (sha256Buffer(pdf) !== a.sha256) return null // integritetna preverba ob prenosu
  return { pdf, filename: a.filename, sha256: a.sha256 }
}

export interface SendDocumentResult {
  ok: boolean
  error?: string
  status?: "SENT" | "FAILED" | "UNSENT"
  logId?: string
  messageId?: string
  toEmail?: string
}

/**
 * Pošlje dokument (arhiviran PDF) na naslov stranke. Zabeleži izid; status
 * je SENT le ob dejanski potrditvi ponudnika, ob napaki FAILED, brez
 * konfiguriranega ponudnika pa UNSENT (nikoli se ne trdi, da je poslano).
 * IDOR/org-scoped; dovoljenje finances.documents.manage (pošiljanje =
 * izdajanje).
 */
export async function sendDocument(
  docId: string,
  input: { toEmail: string; subject?: string }
): Promise<SendDocumentResult> {
  const { org, session } = await requireDocumentPermission("finances.documents.manage")
  const doc = await prisma.document.findFirst({ where: { id: docId, organizationId: org.id } })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status === "DRAFT") return { ok: false, error: "NOT_ISSUED" }

  const arch = await prisma.documentArchive.findUnique({ where: { documentId: doc.id } })
  if (!arch) return { ok: false, error: "NOT_ARCHIVED" }

  const toEmail = input.toEmail?.trim().toLowerCase()
  if (!toEmail || !toEmail.includes("@")) return { ok: false, error: "INVALID_EMAIL" }
  const subject = input.subject?.trim() || `${arch.docCode} — dokument`

  const summary = await getDocumentDetail(doc.id)
  const totalLabel = summary ? EUR_FMT(summary.totals.total) : ""
  const customerName = summary?.customer?.name ?? ""
  const issuerName = summary?.issuer?.name ?? ""

  const outcome = await sendDocumentEmail({
    toEmail,
    docCode: arch.docCode,
    doctype: doc.type,
    customerName,
    issuerName,
    totalLabel,
    subject,
    attachmentBase64: arch.data,
    attachmentFilename: arch.filename,
  })

  const log = await prisma.documentSendLog.create({
    data: {
      organizationId: org.id,
      documentId: doc.id,
      doctype: doc.type,
      docCode: arch.docCode,
      toEmail,
      subject,
      status: outcome.status,
      error: outcome.error ?? null,
      messageId: outcome.messageId ?? null,
      archiveId: arch.id,
      sentById: session?.user?.id ?? null,
    },
  })

  await logEvent(prisma, doc.id, org.id, doc.status, session?.user?.id ?? null,
    `Pošiljanje ${arch.docCode} → ${toEmail}: ${outcome.status}`)
  revalidatePath("/dashboard/documents")
  return {
    ok: outcome.status === "SENT",
    status: outcome.status,
    error: outcome.error ?? undefined,
    logId: log.id,
    messageId: outcome.messageId,
    toEmail,
  }
}

/** Zgodovina pošiljanja dokumenta (branje). */
export async function getDocumentSendLogs(docId: string): Promise<
  { id: string; toEmail: string; subject: string; status: string; error: string | null; sentAt: string }[] | null
> {
  const { org } = await requireDocumentPermission("finances.view")
  const doc = await prisma.document.findFirst({ where: { id: docId, organizationId: org.id }, select: { id: true } })
  if (!doc) return null
  const rows = await prisma.documentSendLog.findMany({
    where: { documentId: doc.id, organizationId: org.id },
    orderBy: { sentAt: "desc" },
    take: 50,
  })
  return rows.map((r) => ({
    id: r.id,
    toEmail: r.toEmail,
    subject: r.subject,
    status: r.status,
    error: r.error,
    sentAt: r.sentAt.toISOString(),
  }))
}