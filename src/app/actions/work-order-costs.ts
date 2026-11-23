"use server"

// ============================================================
// IZRAČUN STROŠKOV DELOVNEGA NALOGA (FAZA 2 — osnova)
//
// Univerzalna funkcija, ki združuje:
//   • Stroške materialov (iz porabe na delovnem nalogu)
//   • Stroške dela (iz beleženja delovnega časa)
//
// Omogoča analizo donosnosti posameznega delovnega naloga.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import { getWorkOrderLabor, type WorkOrderLaborSummary } from "./work-order-labor"

export interface MaterialCostItem {
  productId: string
  productName: string
  variantName: string | null
  quantity: number
  unitPrice: number
  totalCost: number
}

export interface MaterialCostSummary {
  totalCost: number
  items: MaterialCostItem[]
}

export interface WorkOrderCosts {
  workOrderId: string
  workOrderNumber: number
  title: string
  agreedPrice: number | null // dogovorjena cena (če je podana)
  materialCosts: MaterialCostSummary
  laborCosts: WorkOrderLaborSummary | null
  laborCostsKnown: boolean // ali so vsi delovni stroški popolnoma znani
  totalCost: number // material + labor (delovni, če so znani)
  profit: number | null // agreedPrice - totalCost (če je agreedPrice znan)
  profitMargin: number | null // profit / agreedPrice * 100
}

/**
 * Izračuna stroške materialov za delovni nalog.
 * Išče Order + OrderItem, povezane z delovnim nalogom prek Document.
 */
export async function calculateMaterialCosts(workOrderId: string): Promise<MaterialCostSummary> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  // Poišči dokumente, ki povezujejo ta delovni nalog z naročili.
  // M12 (audit 2026-11): ponovno izdani dokumenti za isto naročilo ne
  // smejo podvojiti materialnih stroškov → orderIds dedupliciramo
  // (dokumenti so lahko QUOTE/INVOICE/ADVANCE — šteje naročilo, ne
  // število dokumentov zanj).
  const docs = await prisma.document.findMany({
    where: {
      organizationId: orgId,
      workOrderId,
      orderId: { not: null },
    },
    select: { orderId: true },
  })

  const orderIds = [
    ...new Set(docs.map((d) => d.orderId).filter((x): x is string => !!x)),
  ]
  const items: MaterialCostItem[] = []

  if (orderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, organizationId: orgId },
      include: { items: { include: { product: { select: { name: true } } } } },
    })

    for (const order of orders) {
      for (const it of order.items) {
        const unitPrice = Number(it.price)
        items.push({
          productId: it.productId,
          productName: it.product?.name ?? "—",
          variantName: it.variantName,
          quantity: it.quantity,
          unitPrice,
          totalCost: unitPrice * it.quantity,
        })
      }
    }
  }

  const totalCost = items.reduce((s, i) => s + i.totalCost, 0)
  return { totalCost, items }
}

/**
 * Kompleten izračun stroškov delovnega naloga: materiali + delo.
 */
export async function calculateWorkOrderCosts(workOrderId: string): Promise<WorkOrderCosts | null> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const orgId = org.id

  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: orgId },
    select: { id: true, number: true, title: true, total: true },
  })
  if (!wo) return null

  const materialCosts = await calculateMaterialCosts(workOrderId)
  const laborCosts = await getWorkOrderLabor(workOrderId)

  const agreedPrice = wo.total !== null ? Number(wo.total) : null
  // Materialni stroški so vedno znani (iz OrderItem), delovni pa se dodajo, če so na voljo
  let totalCost: number = materialCosts.totalCost
  let laborCostsKnown = true

  if (laborCosts) {
    if (laborCosts.totalCost !== null) {
      totalCost += laborCosts.totalCost
    } else {
      laborCostsKnown = false
    }
  } else {
    laborCostsKnown = false
  }

  let profit: number | null = null
  let profitMargin: number | null = null
  if (agreedPrice !== null) {
    profit = agreedPrice - totalCost
    profitMargin = agreedPrice > 0 ? (profit / agreedPrice) * 100 : null
  }

  return {
    workOrderId: wo.id,
    workOrderNumber: wo.number,
    title: wo.title,
    agreedPrice,
    materialCosts,
    laborCosts,
    laborCostsKnown,
    totalCost,
    profit,
    profitMargin,
  }
}
