"use server"

import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { requirePermissionOrg, requirePermission, UnauthorizedError } from "@/lib/auth/guards"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { Prisma, type PromotionStatus } from "@prisma/client"
import { parsePromotionServerInput, type PromotionServerInput } from "@/lib/promotions/server-schema"
import { round2 } from "@/lib/promotions/engine"
import { toPromotionRule } from "@/lib/promotions/map"

// ============================================================
// F5.1 — UPRAVLJANJE PROMOCIJ (admin CRUD + statistika uporabe)
//
// Vsa pisanja so zavarovana z requirePermissionOrg("promotions.manage")
// in resolveSessionOrg → akcija deluje SAMO na lastni organizaciji
// prijavljenega člana (izolacija podjetij §5). Vhod se vedno pretvori
// skozi belo listo (server-schema) — nič surovega iz brskalnika ne
// pride neposredno v Prisma.
// ============================================================

export interface PromotionListItem {
  id: string
  name: string
  description: string | null
  discountType: "PERCENT" | "FIXED"
  discountValue: number
  scope: "WHOLE_AMOUNT" | "PRODUCTS" | "SERVICES" | "CATEGORIES"
  targetEntityIds: string[]
  code: string | null
  startsAt: Date | null
  endsAt: Date | null
  maxRedemptions: number | null
  maxPerCustomer: number | null
  minOrderValue: number | null
  status: PromotionStatus
  createdAt: Date
  updatedAt: Date
  usedCount: number
  appliedDiscountTotal: number
  /**
   * Izpeljano veljavnost stanja v UI: "active" zdaj (in znotraj okna),
   * "scheduled" (še ni začelo), "expired" (okno se je izteklo),
   * "inactive"/"draft" po statusu.
   */
  lifecycle: "active" | "scheduled" | "expired" | "inactive" | "draft"
}

function computeLifecycle(
  status: PromotionStatus,
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date = new Date()
): PromotionListItem["lifecycle"] {
  if (status !== "ACTIVE") return status === "DRAFT" ? "draft" : "inactive"
  if (startsAt && startsAt.getTime() > now.getTime()) return "scheduled"
  if (endsAt && endsAt.getTime() < now.getTime()) return "expired"
  return "active"
}

/** Seznam promocij lastne organizacije + statistika uporabe. */
export async function getAdminPromotions(): Promise<PromotionListItem[]> {
  await requirePermissionOrg("promotions.manage")
  const { org } = await currentOrg()
  const promotions = await prisma.promotion.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  })

  // Agregat uporabe v eni poizvedbi (efficientno za cele sezname).
  // F5.1.2: štejejo SAMO dokončana unovčenja (REDEEMED); rezervacije v
  // teku (RESERVED) niso uporabe, ampak začasno zaklenjena mesta.
  const redemptions = await prisma.promotionRedemption.groupBy({
    by: ["promotionId"],
    where: { organizationId: org.id, status: "REDEEMED" },
    _count: { _all: true },
    _sum: { discountAmount: true },
  })
  const usageMap = new Map(
    redemptions.map((r) => [
      r.promotionId,
      { used: r._count._all, total: r._sum.discountAmount?.toNumber() ?? 0 },
    ])
  )
  const now = new Date()
  return promotions.map((p) => {
    const usage = usageMap.get(p.id)
    return {
      ...toPromotionRule(p),
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      targetEntityIds: p.targetEntityIds,
      usedCount: usage?.used ?? 0,
      appliedDiscountTotal: round2(usage?.total ?? 0),
      lifecycle: computeLifecycle(p.status, p.startsAt, p.endsAt, now),
    }
  })
}

/** Posamezna promocija za urejanje (vključno s statistiko). */
export async function getPromotionById(id: string) {
  await requirePermissionOrg("promotions.manage")
  const { org } = await currentOrg()
  const promo = await prisma.promotion.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!promo) return null

  const usage = await prisma.promotionRedemption.aggregate({
    where: { promotionId: promo.id, organizationId: org.id, status: "REDEEMED" },
    _count: { _all: true },
    _sum: { discountAmount: true },
  })
  return {
    ...toPromotionRule(promo),
    description: promo.description,
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
    usedCount: usage._count._all,
    appliedDiscountTotal: round2(usage._sum.discountAmount?.toNumber() ?? 0),
    lifecycle: computeLifecycle(promo.status, promo.startsAt, promo.endsAt),
  }
}

/** Možnosti (products/services/categories) za izbire v obrazcu. */
export async function getPromotionTargetOptions() {
  await requirePermissionOrg("promotions.manage")
  const { org } = await currentOrg()
  const [products, services, categories] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 2000,
    }),
    prisma.service.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 2000,
    }),
    prisma.category.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 2000,
    }),
  ])
  return { products, services, categories }
}

/** Preveri in popravi identitete ciljnih entitet (org-scope). */
async function validateTargets(
  orgId: string,
  scope: string,
  ids: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return { ok: true, ids: [] }

  let existing: { id: string }[]
  if (scope === "PRODUCTS") {
    existing = await prisma.product.findMany({
      where: { id: { in: unique }, organizationId: orgId },
      select: { id: true },
    })
  } else if (scope === "SERVICES") {
    existing = await prisma.service.findMany({
      where: { id: { in: unique }, organizationId: orgId },
      select: { id: true },
    })
  } else if (scope === "CATEGORIES") {
    existing = await prisma.category.findMany({
      where: { id: { in: unique }, organizationId: orgId },
      select: { id: true },
    })
  } else {
    if (unique.length > 0) {
      return { ok: false, error: "Ciljne entitete za ta obseg niso dovoljene." }
    }
    return { ok: true, ids: [] }
  }

  const found = new Set(existing.map((e) => e.id))
  const unknown = unique.filter((id) => !found.has(id))
  if (unknown.length > 0) {
    return {
      ok: false,
      error: "Nekatere izbrane entitete pripadajo drugemu podjetju in jih ni mogoče uporabiti.",
    }
  }
  return { ok: true, ids: unique }
}

function kodaStatus(statusInput: PromotionServerInput["status"]) {
  return statusInput ?? "DRAFT"
}

// ============================================================
// F5.1 — STREŽNIŠKO GENERIRANA PROMO KODA
//
// Vzorec iz Stripe/Shopify: sistem sam ustvari berljivo kodo s
// kriptografsko varno naključnostjo in jo pred vrnitvijo preveri,
// da NIŽE NI v bazi (unikatnost). Ob redki koliziji (P2002 na
// @@unique([organizationId, code])) poskusi znova — do 5 poskusov.
// Bralec prepoznamo case-insensitive (engine uporabi toUpperCase).
// ============================================================
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // brez I,L,O,0,1,8 in dvoumnih
const CODE_LENGTH = 8

export async function generatePromotionCode(): Promise<{
  code: string
  error?: string
}> {
  try {
    await requirePermission("promotions.manage")
  } catch {
    return { code: "", error: "Nimate dovoljenja." }
  }

  const secure = () => {
    const bytes = randomBytes(CODE_LENGTH)
    let out = ""
    for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
    return out
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = secure()
    const hit = await prisma.promotion.findFirst({
      where: { code: candidate },
      select: { id: true },
    })
    if (!hit) return { code: candidate }
  }

  // Izredna varovalka — po 5 poskusih enoličen UUID (brez vezaja).
  return { code: randomBytes(6).toString("hex").toUpperCase() }
}

export async function createPromotion(data: unknown) {
  try {
    const { org } = await requirePermissionOrg("promotions.manage")

    const parsed = parsePromotionServerInput(data, "create")
    if (!parsed.ok) return { success: false as const, error: parsed.error }

    const d = parsed.data
    // Po nosilni belem listi status ni del vnosa (upravljamo ločeno);
    // default je DRAFT.
    const targetCheck = await validateTargets(org.id, d.scope, d.targetEntityIds ?? [])
    if (!targetCheck.ok) return { success: false as const, error: targetCheck.error }

    // Okno mora biti logično (ends >= starts), če sta oba podana.
    const startsAt = d.startsAt ? new Date(d.startsAt) : null
    const endsAt = d.endsAt ? new Date(d.endsAt) : null
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      return {
        success: false as const,
        error: "Končni datum veljavnosti ne sme biti pred začetnim.",
      }
    }

    const promo = await prisma.promotion.create({
      data: {
        organizationId: org.id,
        name: d.name,
        description: d.description ?? null,
        discountType: d.discountType,
        discountValue: round2(d.discountValue).toFixed(2),
        scope: d.scope,
        targetEntityIds: targetCheck.ids,
        code: d.code ?? null,
        startsAt,
        endsAt,
        maxRedemptions: d.maxRedemptions ?? null,
        maxPerCustomer: d.maxPerCustomer ?? null,
        minOrderValue: d.minOrderValue != null ? round2(d.minOrderValue).toFixed(2) : null,
        status: kodaStatus(d.status),
      },
    })
    revalidatePath("/dashboard/promotions")
    return { success: true as const, id: promo.id }
  } catch (error) {
    return handleActionError(error, "Ustvarjanje promocije ni uspelo.")
  }
}

export async function updatePromotion(id: string, data: unknown) {
  try {
    const { org } = await requirePermissionOrg("promotions.manage")

    const existing = await prisma.promotion.findFirst({
      where: { id, organizationId: org.id },
    })
    if (!existing) {
      return { success: false as const, error: "Promocija ne obstaja." }
    }

    const parsed = parsePromotionServerInput(data, "update")
    if (!parsed.ok) return { success: false as const, error: parsed.error }

    const d = parsed.data
    const scope = (d.scope ?? existing.scope) as string
    const targetCheck = await validateTargets(
      org.id,
      scope,
      Array.isArray(d.targetEntityIds) ? d.targetEntityIds : existing.targetEntityIds
    )
    if (!targetCheck.ok) return { success: false as const, error: targetCheck.error }

    const startsAt = d.startsAt !== undefined ? (d.startsAt ? new Date(d.startsAt) : null) : existing.startsAt
    const endsAt = d.endsAt !== undefined ? (d.endsAt ? new Date(d.endsAt) : null) : existing.endsAt
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      return {
        success: false as const,
        error: "Končni datum veljavnosti ne sme biti pred začetnim.",
      }
    }

    await prisma.promotion.update({
      where: { id: existing.id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
        ...(d.discountType !== undefined ? { discountType: d.discountType } : {}),
        ...(d.discountValue !== undefined ? { discountValue: round2(d.discountValue).toFixed(2) } : {}),
        ...(d.scope !== undefined ? { scope: d.scope } : {}),
        ...(Array.isArray(d.targetEntityIds) ? { targetEntityIds: targetCheck.ids } : {}),
        ...(d.code !== undefined ? { code: d.code ?? null } : {}),
        ...(d.startsAt !== undefined ? { startsAt } : {}),
        ...(d.endsAt !== undefined ? { endsAt } : {}),
        ...(d.maxRedemptions !== undefined ? { maxRedemptions: d.maxRedemptions ?? null } : {}),
        ...(d.maxPerCustomer !== undefined ? { maxPerCustomer: d.maxPerCustomer ?? null } : {}),
        ...(d.minOrderValue !== undefined
          ? { minOrderValue: d.minOrderValue != null ? round2(d.minOrderValue).toFixed(2) : null }
          : {}),
      },
    })
    revalidatePath("/dashboard/promotions")
    revalidatePath(`/dashboard/promotions/${id}`)
    return { success: true as const, id: existing.id }
  } catch (error) {
    return handleActionError(error, "Posodabljanje promocije ni uspelo.")
  }
}

/** Preklop statusa: DRAFT/ACTIVE/INACTIVE (aktiviraj / deaktiviraj). */
export async function setPromotionStatus(id: string, status: PromotionStatus) {
  try {
    const { org } = await requirePermissionOrg("promotions.manage")
    if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) {
      return { success: false as const, error: "Neveljaven status." }
    }
    const existing = await prisma.promotion.findFirst({
      where: { id, organizationId: org.id },
    })
    if (!existing) {
      return { success: false as const, error: "Promocija ne obstaja." }
    }
    await prisma.promotion.update({
      where: { id: existing.id },
      data: { status },
    })
    revalidatePath("/dashboard/promotions")
    revalidatePath(`/dashboard/promotions/${id}`)
    return { success: true as const, id: existing.id }
  } catch (error) {
    return handleActionError(error, "Spreminjanje statusa ni uspelo.")
  }
}

/** Izbriši promocijo (history redemptions ostanejo — snimljeni so na naročila). */
export async function deletePromotion(id: string) {
  try {
    const { org } = await requirePermissionOrg("promotions.manage")
    const existing = await prisma.promotion.findFirst({
      where: { id, organizationId: org.id },
    })
    if (!existing) {
      return { success: false as const, error: "Promocija ne obstaja." }
    }
    await prisma.promotion.delete({ where: { id: existing.id } })
    revalidatePath("/dashboard/promotions")
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Brisanje promocije ni uspelo.")
  }
}

/** Pregled uporabljenih promocij (redemptions) za dano promocijo. */
export interface PromotionRedemptionRow {
  id: string
  customerId: string | null
  guestEmail: string | null
  codeUsed: string | null
  discountAmount: number
  baseAmount: number
  orderId: string | null
  appointmentId: string | null
  createdAt: Date
}

export async function getPromotionRedemptions(
  id: string,
  page = 1,
  perPage = 25
): Promise<{ rows: PromotionRedemptionRow[]; total: number; page: number; perPage: number }> {
  await requirePermissionOrg("promotions.manage")
  const { org } = await currentOrg()
  const promo = await prisma.promotion.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!promo) return { rows: [], total: 0, page, perPage }

  const where = { organizationId: org.id, promotionId: id, status: "REDEEMED" as const }
  const [rows, total] = await Promise.all([
    prisma.promotionRedemption.findMany({
      where,
      select: {
        id: true,
        customerId: true,
        guestEmail: true,
        codeUsed: true,
        discountAmount: true,
        baseAmount: true,
        orderId: true,
        appointmentId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.promotionRedemption.count({ where }),
  ])
  return {
    rows: rows.map((r) => ({
      ...r,
      discountAmount: r.discountAmount.toNumber(),
      baseAmount: r.baseAmount.toNumber(),
    })),
    total,
    page,
    perPage,
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
async function currentOrg() {
  const { org } = await requirePermissionOrg("promotions.manage")
  return { org }
}

function handleActionError(error: unknown, fallback: string) {
  if (error instanceof UnauthorizedError) {
    return { success: false as const, error: error.message }
  }
  // Weird code-collision on [organizationId, code] unique.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      success: false as const,
      error: "Ta promocijska koda že obstaja v vašem podjetju.",
    }
  }
  console.error("F5.1 promotion action error:", error)
  return { success: false as const, error: fallback }
}

// Silence unused (getLocaleFromCookies retained for future multilingual use).
void getLocaleFromCookies