/**
 * FAZA 2 — čista logika stroškov (brez server/network odvisnosti).
 * Ločena od `src/app/actions/dashboard-costs.ts`, da je enotno testljiva.
 *
 * OPOMBA (F1): polja `materialCosts`/`laborCosts` na delovnem nalogu še niso
 * tipizirana v Prisma (Faza 1 v teku). Zato beremo dinamično — ta funkcija
 * transakcijsko pade na 0, ko polja še ne obstajajo, in jih pobere, ko jih
 * F1 doda, brez spreminjanja poročil.
 */
export interface WorkOrderCostInput {
  total: unknown
  materialCosts?: unknown
  laborCosts?: unknown
  totalCosts?: unknown
}

export interface WorkOrderCosts {
  material: number
  labor: number
  totalCosts: number
  revenue: number
  profit: number
  margin: number
}

export function readWorkOrderCosts(workOrder: object): WorkOrderCosts {
  const w = workOrder as WorkOrderCostInput
  const material = Number(w.materialCosts ?? 0) || 0
  const labor = Number(w.laborCosts ?? 0) || 0
  const totalCosts = Number(w.totalCosts ?? material + labor) || material + labor
  const revenue = Number(w.total ?? 0) || 0
  const profit = revenue - totalCosts
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0
  return { material, labor, totalCosts, revenue, profit, margin }
}