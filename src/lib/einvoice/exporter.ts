// ============================================================
// F5.5.4.6.2 — EINVOICE EXPORTER (jedrni graditelj nevtralnega modela).
//
// Determinističen: enaka vhodna (nespremenljiva) Document vrstica → enak
// EInvoiceModel → enak XML. NIKOLI ne preračunava DDV / popustov /
// seštevkov: bere shranjene hodnoty (Document.taxBase/taxTotal/total;
// DocumentItem.taxBaseLine/vatAmount/vatRate/total; CreditNote.amount).
// Ne spreminja izdanega dokumenta.
// ============================================================

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  EInvoiceKind,
  EInvoiceModel,
  EInvoiceParty,
  EInvoiceTaxBreakdown,
  paymentMeansCode,
} from "@/lib/einvoice/model"

type DocumentWithItems = Prisma.DocumentGetPayload<{
  include: { items: { orderBy: { position: "asc" } }; customer: true }
}>

export type EInvoiceSource =
  | { kind: "INVOICE" | "ADVANCE"; document: DocumentWithItems }
  | { kind: "CREDIT"; document: DocumentWithItems; creditNote: Prisma.CreditNoteGetPayload<true> }

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

function partyFromSnap(snap: unknown): EInvoiceParty {
  const s = (snap ?? {}) as Record<string, unknown>
  const str = (k: string): string | null => (typeof s[k] === "string" ? (s[k] as string) : null)
  return {
    name: str("name") ?? "",
    legalName: str("legalName"),
    vatId: str("vatId"),
    taxNumber: str("taxNumber"),
    registrationNumber: str("registrationNumber"),
    electronicId: str("electronicId"),
    electronicIdScheme: str("electronicIdScheme"),
    street: str("street"),
    postalCode: str("postalCode"),
    city: str("city"),
    country: str("country"),
    email: str("email"),
    bankAccount: str("bankAccount"),
    buyerReference: str("buyerReference"),
    orderReference: str("orderReference"),
  }
}

/**
 * Zgradi nevtralni model iz NESPREMENLJIVO shranjenih podatkov dokumenta.
 * Ne poganja nobenih velikih izračunov — le prenos shranjenih vrednosti.
 */
export async function buildEInvoiceModel(
  orgId: string,
  source: EInvoiceSource
): Promise<{ model: EInvoiceModel; warnings: string[] }> {
  const warnings: string[] = []
  const d = source.document

  let creditNote: Prisma.CreditNoteGetPayload<true> | null = null
  if (source.kind === "CREDIT") creditNote = source.creditNote

  // ---- Stranki (iz snapshotov; DRAFT bi bilo treba blokirati zgoraj) ----
  const seller = partyFromSnap(d.issuerSnapshot)
  const buyer = partyFromSnap(d.customerSnapshot)

  // VZP: če kupcu manjkajo podatki, potrebn za e-račun → opozorilo (ne padec).
  if (!d.issuerSnapshot && !seller.vatId && d.vatEnabled) {
    warnings.push("Izdajatelj nima vatId — preveri davčne podatke.")
  }
  if (d.vatEnabled && !buyer.vatId) {
    // Dobropis/račun za podjetje naj ime davčno; za potrošnika je OK brez.
    warnings.push("Kupec (buyer) ni imel davčne številke pri izdaji e-računa.")
  }

  // ---- Linije ----
  const lines = (d.items ?? []).map((it) => ({
    id: it.id,
    description: it.description,
    quantity: Number(it.quantity),
    unitPriceNet: Number(it.taxBaseLine) / Math.max(1, Number(it.quantity)),
    discountPercent: Number(it.discountPercent),
    vatRate: Number(it.vatRate),
    taxBaseLine: Number(it.taxBaseLine),
    vatAmount: Number(it.vatAmount),
    totalGross: Number(it.total),
    catalogRef: it.catalogRef,
  }))

  // ---- Davčni razrez ----
  const taxMap = new Map<string, EInvoiceTaxBreakdown>()
  for (const it of d.items ?? []) {
    const rate = Number(it.vatRate)
    const key = String(rate)
    const cur = taxMap.get(key) ?? { vatRate: rate, taxableAmount: 0, taxAmount: 0 }
    cur.taxableAmount += Number(it.taxBaseLine)
    cur.taxAmount += Number(it.vatAmount)
    taxMap.set(key, cur)
  }
  const taxBreakdown = Array.from(taxMap.values()).sort((a, b) => a.vatRate - b.vatRate)

  // ---- Plačilne metode (CLEARED PAYMENT; brez REVERSAL) ----
  const pays =
    source.kind === "CREDIT"
      ? []
      : await prisma.documentPayment.findMany({
          where: { organizationId: orgId, documentId: d.id, kind: "PAYMENT", status: "CLEARED" },
          orderBy: { paidAt: "asc" },
        })
  const paymentsMeans = pays
    .map((p) => ({
      code: paymentMeansCode(p.method),
      method: p.method ?? "unknown",
      reference: p.reference,
    }))
    .filter((p) => p.code.length > 0) // avans/giftcard NE razvijamo v PaymentMeansCode

  // ---- Avansne reference (le AKTIVNE alokacije na ta račun) ----
  let advanceRefs: { docCode: string; amount: number }[] | undefined
  if (d.type === "INVOICE") {
    const allocs = await prisma.documentAdvanceAllocation.findMany({
      where: { organizationId: orgId, appliedToInvoice: d.id, status: "ACTIVE" },
      include: { advance: { select: { number: true, fiscalYear: true } } },
      orderBy: { createdAt: "asc" },
    })
    advanceRefs = allocs.map((a) => ({
      docCode: `AVN-${String(a.advance.number).padStart(4, "0")}${a.advance.fiscalYear ? `/${a.advance.fiscalYear}` : ""}`,
      amount: Number(a.amount),
    }))
  }

  // ---- Tip & typeCode ----
  // KONČNI račun 380, DOBROPIS 381, AVANS 386. NALOGA: 326/386 se ne smeta
  // zamenjati. Uporabimo 386 za avansni račun (zahtevek za plačilo pred
  // dobavo) po slovenskem/EN šifrantu in DOLOČIMO posebej.
  const kind: EInvoiceKind = source.kind
  const invoiceTypeCode = kind === "CREDIT" ? 381 : kind === "ADVANCE" ? 386 : 380

  const total = Number(d.total)
  const paidAmount = Number(d.paidAmount)
  const creditedTotal = Number(d.creditedTotal)
  const advanceTotal = Number(d.advanceTotal)
  const openAmount = Math.max(0, total - paidAmount - creditedTotal)

  const model: EInvoiceModel = {
    kind,
    docCode: creditNote
      ? `DN-${String(creditNote.number).padStart(4, "0")}${creditNote.fiscalYear ? `/${creditNote.fiscalYear}` : ""}`
      : `${d.type === "ADVANCE" ? "AVN" : "RAC"}-${String(d.number).padStart(4, "0")}${d.fiscalYear ? `/${d.fiscalYear}` : ""}`,
    documentId: d.id,
    fiscalYear: d.fiscalYear,
    number: d.number,
    issueDate: iso(d.issueDate) ?? iso(creditNote?.issuedAt ?? d.issuedAt) ?? "",
    issueDateIso: iso(d.issuedAt ?? creditNote?.issuedAt ?? d.issueDate) ?? "",
    dueDate: iso(d.dueDate),
    serviceDate: iso(d.serviceDate),
    servicePeriod: d.servicePeriodStart && d.servicePeriodEnd ? `${iso(d.servicePeriodStart)} – ${iso(d.servicePeriodEnd)}` : iso(d.serviceDate),
    invoiceTypeCode,
    vatEnabled: d.vatEnabled,
    currency: d.currency || "EUR",
    seller,
    buyer,
    lines,
    taxBreakdown,
    totals: {
      lineExtensionNet: Number(d.taxBase),
      discountAmount: Number(d.discountAmount),
      taxTotal: Number(d.taxTotal),
      totalGross: total,
      paidAmount,
      creditedTotal,
      advanceTotal,
      openAmount,
      currency: d.currency || "EUR",
    },
    paymentsMeans,
    advanceRefs,
    creditRef:
      creditNote
        ? { originalCode: creditNote.originalInvoiceCode, reason: creditNote.reason }
        : undefined,
    note: d.notes,
  }

  return { model, warnings }
}