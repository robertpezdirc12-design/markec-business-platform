"use server"

// ============================================================
// F5.5.2 — FAQ (pogosta vprašanja).
// Podpira vprašanja za CELOTNO podjetje (serviceId = null) in za posamezno
// storitev (serviceId set). Org-scoped, s kategorijo, vrstnim redom,
// javno vidnostjo in draft/published.
// Varnost: vsi mutatorji org-scoped (requirePermissionOrg "settings.manage"),
// IDOR-safe (vzame samo vrstice lastniške org).
// ============================================================

import "server-only"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { getPublicOrg } from "@/lib/tenant"
import { bumpContentVersion } from "@/lib/content-version"

export interface FaqItemDTO {
  id: string
  question: string
  answer: string
  category: string | null
  position: number
  isPublic: boolean
  isPublished: boolean
  serviceId: string | null
}

export interface FaqResult {
  ok: boolean
  id?: string
  error?: string
}

function toDTO(f: {
  id: string
  question: string
  answer: string
  category: string | null
  position: number
  isPublic: boolean
  isPublished: boolean
  serviceId: string | null
}): FaqItemDTO {
  return {
    id: f.id,
    question: f.question,
    answer: f.answer,
    category: f.category,
    position: f.position,
    isPublic: f.isPublic,
    isPublished: f.isPublished,
    serviceId: f.serviceId,
  }
}

/** Vsa FAQ trenutne org (draft + published) za admin. */
export async function getAdminFaq(): Promise<FaqItemDTO[]> {
  const { org } = await requirePermissionOrg("settings.manage")
  const rows = await prisma.faqItem.findMany({
    where: { organizationId: org.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })
  return rows.map(toDTO)
}

export interface FaqInput {
  question: string
  answer: string
  category?: string | null
  isPublic?: boolean
  isPublished?: boolean
  serviceId?: string | null
}

export async function createFaq(input: FaqInput): Promise<FaqResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const question = input.question?.trim()
  const answer = input.answer?.trim()
  if (!question) return { ok: false, error: "MISSING_QUESTION" }
  if (!answer) return { ok: false, error: "MISSING_ANSWER" }

  // serviceId mora pripadati tej org (IDOR-safe).
  if (input.serviceId) {
    const svc = await prisma.service.findFirst({
      where: { id: input.serviceId, organizationId: org.id },
      select: { id: true },
    })
    if (!svc) return { ok: false, error: "NOT_FOUND" }
  }

  const maxPos = await prisma.faqItem.aggregate({
    where: { organizationId: org.id, serviceId: input.serviceId ?? null },
    _max: { position: true },
  })
  const row = await prisma.faqItem.create({
    data: {
      organizationId: org.id,
      question,
      answer,
      category: input.category?.trim() ? input.category.trim() : null,
      isPublic: input.isPublic ?? true,
      isPublished: input.isPublished ?? false,
      serviceId: input.serviceId ?? null,
      position: (maxPos._max.position ?? -1) + 1,
    },
    select: { id: true },
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "faq",
    action: "UPDATE",
    summary: `FAQ dodano: ${question}`,
    next: { faqId: row.id, question },
  })
  revalidatePath("/dashboard/form")
  revalidatePath("/dashboard")
  return { ok: true, id: row.id }
}

export async function updateFaq(id: string, input: Partial<FaqInput>): Promise<FaqResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const existing = await prisma.faqItem.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  const question = input.question?.trim()
  const answer = input.answer?.trim()
  if (question !== undefined && !question) return { ok: false, error: "MISSING_QUESTION" }
  if (answer !== undefined && !answer) return { ok: false, error: "MISSING_ANSWER" }
  if (input.serviceId) {
    const svc = await prisma.service.findFirst({
      where: { id: input.serviceId, organizationId: org.id },
      select: { id: true },
    })
    if (!svc) return { ok: false, error: "NOT_FOUND" }
  }

  await prisma.faqItem.update({
    where: { id },
    data: {
      ...(question !== undefined ? { question } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(input.category !== undefined ? { category: input.category?.trim() ? input.category.trim() : null } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
    },
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "faq",
    action: "UPDATE",
    summary: `FAQ posodobljeno: ${id}`,
  })
  revalidatePath("/dashboard/form")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

export async function deleteFaq(id: string): Promise<FaqResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const existing = await prisma.faqItem.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }
  await prisma.faqItem.delete({ where: { id } })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "faq",
    action: "UPDATE",
    summary: `FAQ izbrisano: ${id}`,
  })
  revalidatePath("/dashboard/form")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

/** Reorder FAQ: predaja vrstni red (position) v enem pozivu, atomsko. */
export async function reorderFaq(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.faqItem.updateMany({
        where: { id, organizationId: org.id },
        data: { position: index },
      })
    )
  )
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "faq",
    action: "UPDATE",
    summary: `Vrstni red FAQ posodobljen`,
  })
  revalidatePath("/dashboard/form")
  revalidatePath("/dashboard")
  return { ok: true }
}

// ---- Javno branje (samo objavljeno) ----

export interface PublicFaqDTO {
  id: string
  question: string
  answer: string
  category: string | null
  serviceId: string | null
}

/** Predogled — SAMO lastnik tej org (session-scoped, fail-closed). */
export async function getPreviewFaq(_orgId?: string): Promise<PublicFaqDTO[]> {
  // Varnost (F6.3.5): NNIKOLI ne zaupaj orgId iz zahteve. Org se določi iz
  // prijavljene seje (+ aktivno članstvo). Neprijavljen ali tuj owner → [].
  let orgId: string | null = null
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    orgId = org.id
  } catch {
    return []
  }
  const rows = await prisma.faqItem.findMany({
    where: { organizationId: orgId, isPublic: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true, serviceId: true },
  })
  return rows.map((r) => ({ ...r }))
}

/** Javne, OBJAVLJENE FAQ podjetja — izključno trenutnega javnega konteksta. */
export async function getPublicFaq(_orgId?: string): Promise<PublicFaqDTO[]> {
  // Varnost (F6.3.5): javna vsebina se vedno veže na pravilno razrešen JAVNI
  // kontekst (getPublicOrg — signed header/URL/domain). Pošiljanje tujega
  // `orgId` ne pomaga: vrne samo javne (objavljene) FAQ tega gostitelja.
  const org = await getPublicOrg()
  if (!org) return []
  const rows = await prisma.faqItem.findMany({
    where: { organizationId: org.id, isPublic: true, isPublished: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true, serviceId: true },
  })
  return rows.map((r) => ({ ...r }))
}