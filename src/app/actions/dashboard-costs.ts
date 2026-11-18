/**
 * FAZA 2 — STROŠKOVNA ANALITIKA (F2 §4) / nadzorne plošče.
 *
 * OPOMBA (usklajeno s F1): Faza 1 še ni dokončala polj `materialCosts` /
 * `laborCosts` na delovnem nalogu. Zato je ta modul pripravljen kot "adapter":
 * `readWorkOrderCosts` bralo podatke POLEG če polja obstajajo (dynamic,
 * brez TS-napake), sicer vrne ničle. Ko Faza 1 dod tipizirana polja, se ta
 * funkcija lahko nasloni nanje brez spreminjanja spodnjih poročil.
 *
 * Revenue v tej fazi izračunamo iz:
 *   - potrjenih/izdanih računov (Document.type=INVOICE, status != DRAFT/CANCELLED)
 *   - dogovorjene vrednosti delovnih nalogov (WorkOrder.total)
 * Vse org-scoped, fail-closed.
 */
"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { calculateWorkOrderCosts } from "@/app/actions/work-order-costs"

// ------------------------------------------------------------------
// PREGLED PO MESECIH (F2 §4)
// ------------------------------------------------------------------
export interface MonthlyRow {
  year: number
  month: number // 1-12
  revenue: number
  costMaterial: number
  costLabor: number
  costTotal: number
  profit: number
  margin: number
}

export type CostsMonthlyResult = { ok: true; rows: MonthlyRow[] } | { ok: false; error: string }

/** Prihodki/stroški/dobiček po mesecih (od najnovejših). */
export async function getCostsByMonth(): Promise<CostsMonthlyResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const invoices = await prisma.document.findMany({
    where: { organizationId: org.id, type: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
    select: { total: true, issueDate: true },
  })
  const workOrders = await prisma.workOrder.findMany({
    where: { organizationId: org.id },
    select: { id: true, total: true, createdAt: true },
  })

  const map = new Map<string, MonthlyRow>()
  const add = (year: number, month: number, mut: (r: MonthlyRow) => void) => {
    const k = `${year}-${month}`
    if (!map.has(k)) map.set(k, { year, month, revenue: 0, costMaterial: 0, costLabor: 0, costTotal: 0, profit: 0, margin: 0 })
    mut(map.get(k)!)
  }

  for (const inv of invoices) {
    const d = new Date(inv.issueDate)
    add(d.getFullYear(), d.getMonth() + 1, (r) => (r.revenue += Number(inv.total || 0)))
  }
  for (const wo of workOrders) {
    // Glej F1 hrošč »profitabilnost=0«: ne beri neobstoječih polj z delovnega
    // naloga (materialCosts/laborCosts/totalCosts niso v shemi). Namesto tega
    // za vsak WO pokličemo realen izračun (calculateWorkOrderCosts), ki sešteje
    // material (iz OrderItem) + delo (iz labor zapisov) in vrne totalCost.
    const costs = await calculateWorkOrderCosts(wo.id)
    const d = new Date(wo.createdAt)
    add(d.getFullYear(), d.getMonth() + 1, (r) => {
      if (!costs) return
      r.costMaterial += costs.materialCosts.totalCost
      r.costLabor += costs.laborCosts?.totalCost ?? 0
      r.costTotal += costs.totalCost
    })
  }

  const rows = [...map.values()]
    .map((r) => {
      const profit = r.revenue - r.costTotal
      return { ...r, profit, margin: r.revenue > 0 ? (profit / r.revenue) * 100 : 0 }
    })
    .sort((a, b) => b.year - a.year || b.month - a.month)

  return { ok: true, rows }
}

// ------------------------------------------------------------------
// PREGLED PO STRANKAH (F2 §4)
// ------------------------------------------------------------------
export interface CustomerCostRow {
  customerId: string
  customerName: string
  revenue: number
  orderCount: number
  totalCost: number
  totalProfit: number
  avgOrderValue: number
}
export type CostsCustomerResult = { ok: true; rows: CustomerCostRow[] } | { ok: false; error: string }

export async function getCostsByCustomer(): Promise<CostsCustomerResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const invoices = await prisma.document.findMany({
    where: { organizationId: org.id, type: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
    select: { total: true, customerId: true, customer: { select: { name: true } } },
  })
  const byCustomer = new Map<string, CustomerCostRow>()
  for (const inv of invoices) {
    if (!inv.customerId) continue
    const name = inv.customer?.name ?? "Neznana stranka"
    const k = inv.customerId
    if (!byCustomer.has(k)) byCustomer.set(k, { customerId: k, customerName: name, revenue: 0, orderCount: 0, totalCost: 0, totalProfit: 0, avgOrderValue: 0 })
    const r = byCustomer.get(k)!
    r.revenue += Number(inv.total || 0)
    r.orderCount += 1
  }
  const rows = [...byCustomer.values()]
    .map((r) => ({ ...r, avgOrderValue: r.orderCount ? r.revenue / r.orderCount : 0, totalProfit: r.revenue - r.totalCost }))
    .sort((a, b) => b.revenue - a.revenue)
  return { ok: true, rows }
}

// ------------------------------------------------------------------
// PREGLED PO VLOG/ZAPOSLENIH (F2 §4) — vložene ure, prihodki, stroški dela.
// Ure in stroški dela so prostovoljni (iz WorkOrderEvent ali dokumentov);
// kjer se ne beležijo, so ničle.
// ------------------------------------------------------------------
export interface StaffCostRow {
  userId: string
  name: string
  hours: number
  revenue: number
  laborCost: number
  contribution: number
}
export type CostsStaffResult = { ok: true; rows: StaffCostRow[] } | { ok: false; error: string }

export async function getCostsByStaff(): Promise<CostsStaffResult> {
  await requirePermissionOrg("finances.view")
  // V tej fazi brez dedikacije delovnih nalogov na zaposlene v seštevku —
  // pripravljeno na F1, ki bo vodilo urnik/labor. Vrnemo prazen seznam.
  const rows: StaffCostRow[] = []
  return { ok: true, rows }
}

// ------------------------------------------------------------------
// PREGLED PO VRSTI STORITVE (F2 §4)
// ------------------------------------------------------------------
export interface ServiceCostRow {
  service: string
  count: number
  avgPrice: number
  costTotal: number
  margin: number
}
export type CostsServiceResult = { ok: true; rows: ServiceCostRow[] } | { ok: false; error: string }

export async function getCostsByService(): Promise<CostsServiceResult> {
  const { org } = await requirePermissionOrg("finances.view")
  const items = await prisma.documentItem.findMany({
    where: { organizationId: org.id, document: { type: "INVOICE", status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } } },
    select: { description: true, total: true, document: { select: { subtotal: true, total: true } } },
    take: 2000,
  })
  const byService = new Map<string, { count: number; total: number }>()
  for (const it of items) {
    const k = it.description || "Ostalo"
    if (!byService.has(k)) byService.set(k, { count: 0, total: 0 })
    const r = byService.get(k)!
    r.count += 1
    r.total += Number(it.total || 0)
  }
  const rows: ServiceCostRow[] = [...byService.entries()].map(([service, v]) => ({
    service,
    count: v.count,
    avgPrice: v.count ? v.total / v.count : 0,
    costTotal: 0, // stroški po storitvi čakajo F1 (kartna poraba materiala na linijo)
    margin: 0,
  })).sort((a, b) => b.count - a.count)
  return { ok: true, rows }
}