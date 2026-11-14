"use server"

// ============================================================
// ČEBELARSKA NADZORNA PLOŠČA (Z1) — živi podatki iz ExtensionRecord
// (bee-apiary) + inetory in naročil. Org-scoped; prazna stanja.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

export interface ApicultureOverview {
  orgName: string
  counts: {
    apiary: number
    hive: number
    colony: number
    inspection: number
    treatment: number
    feeding: number
    queenManagement: number
    task: number
    harvest: number
  }
  recentInspections: { id: string; title: string; createdAt: Date }[]
  tasksDue: { id: string; title: string; entityKey: string }[]
  products: { id: string; name: string; stock: number; reserved: number; available: number }[]
  lowStock: number
  recentOrders: number
}

const BEE_EXT = "bee-apiary"

/** Števci enot po entityKey za aktivno org (vsi <= org). */
async function countEntities(orgId: string) {
  const rows = await prisma.extensionRecord.groupBy({
    by: ["entityKey"],
    where: { organizationId: orgId, extensionId: BEE_EXT },
    _count: { _all: true },
  })
  const m: Record<string, number> = {}
  for (const r of rows) m[r.entityKey] = r._count._all
  return m
}

export async function getApicultureOverview(): Promise<ApicultureOverview | null> {
  const { org } = await requirePermissionOrg("workorders.manage")

  // Vsi pod-inquiry so org-scoped klancji (reads); izven $transaction,
  // da ni neželenega nedefiniranega rezultata v server-action runtime.
  const [counts, recentInspections, tasksDue, products] = await Promise.all([
    countEntities(org.id),
    prisma.extensionRecord.findMany({
      where: { organizationId: org.id, extensionId: BEE_EXT, entityKey: "inspection" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.extensionRecord.findMany({
      where: {
        organizationId: org.id,
        extensionId: BEE_EXT,
        entityKey: { in: ["task", "treatment", "feeding"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, entityKey: true },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, stockQuantity: true, reservedQuantity: true },
      orderBy: { name: "asc" },
      take: 12,
    }),
  ])

  const cfg = { counts, recentInspections, tasksDue, products }

  const availableList = (cfg.products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stockQuantity,
    reserved: p.reservedQuantity,
    available: Math.max(0, p.stockQuantity - p.reservedQuantity),
  }))
  const lowStock = availableList.filter((p) => p.available <= 5).length

  const recentOrders = await prisma.order.count({
    where: { organizationId: org.id, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
  })

  return {
    orgName: org.name,
    counts: {
      apiary: cfg.counts?.apiary ?? 0,
      hive: cfg.counts?.hive ?? 0,
      colony: cfg.counts?.colony ?? 0,
      inspection: cfg.counts?.inspection ?? 0,
      treatment: cfg.counts?.treatment ?? 0,
      feeding: cfg.counts?.feeding ?? 0,
      queenManagement: cfg.counts?.queen_management ?? 0,
      task: cfg.counts?.task ?? 0,
      harvest: cfg.counts?.harvest ?? 0,
    },
    recentInspections: cfg.recentInspections ?? [],
    tasksDue: cfg.tasksDue ?? [],
    products: availableList,
    lowStock,
    recentOrders,
  }
}