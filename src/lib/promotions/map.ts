// ============================================================
// F5.1 — Prisma Promotion → PromotionRule (čisti mapper) +
// org-scoped loader, deljen med checkoutom, rezervacijami in
// admin akcijami. Brez `"use server"` — lahko ga kliče kdorkoli
// na strežniku.
// ============================================================

import type { Promotion, PromotionStatus } from "@prisma/client"

export type PromotionScopeValue = "WHOLE_AMOUNT" | "PRODUCTS" | "SERVICES" | "CATEGORIES"
export type PromotionDiscountTypeValue = "PERCENT" | "FIXED"

export interface MappedPromotion {
  id: string
  organizationId: string
  name: string
  discountType: PromotionDiscountTypeValue
  discountValue: number
  scope: PromotionScopeValue
  targetEntityIds: string[]
  code: string | null
  startsAt: Date | null
  endsAt: Date | null
  maxRedemptions: number | null
  maxPerCustomer: number | null
  minOrderValue: number | null
  status: PromotionStatus
}

/** Pretvori Prisma vrstico v čisti PromotionRule (engine/redeem). */
export function toPromotionRule(p: {
  id: string
  organizationId: string
  name: string
  discountType: Promotion["discountType"]
  discountValue: { toNumber(): number } | number
  scope: Promotion["scope"]
  targetEntityIds: string[]
  code: string | null
  startsAt: Date | null
  endsAt: Date | null
  maxRedemptions: number | null
  maxPerCustomer: number | null
  minOrderValue: { toNumber(): number } | number | null
  status: PromotionStatus
}): MappedPromotion {
  const num = (v: { toNumber(): number } | number) =>
    typeof v === "number" ? v : v.toNumber()
  return {
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    discountType: p.discountType,
    discountValue: num(p.discountValue),
    scope: p.scope,
    targetEntityIds: p.targetEntityIds,
    code: p.code,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    maxRedemptions: p.maxRedemptions,
    maxPerCustomer: p.maxPerCustomer,
    minOrderValue: p.minOrderValue == null ? null : num(p.minOrderValue),
    status: p.status,
  }
}

interface PromotionLoader {
  promotion: {
    findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>
  }
}

/** Naloži vse ACTIVE promocije podjetja. Deluje z glavnim klientom in
 *  s transakcijskim klientom (oba izpostavljata enako `promotion.findMany`). */
export async function loadActivePromotions(
  db: PromotionLoader,
  orgId: string
): Promise<MappedPromotion[]> {
  const rows = (await db.promotion.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
  })) as Promotion[]
  return rows.map(toPromotionRule)
}