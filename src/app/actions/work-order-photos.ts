"use server"

// ============================================================
// FOTOGRAFIJE NAROČILA (2026-11-18)
//
// Fotografija se zapiše s stopnjo, v kateri je nastala. Slika sama gre
// prek obstoječega /api/upload (Cloudinary ali DB media storage), tu se
// shrani samo zapis — zato ni drugega poti za naložiti datoteko in ni
// podvojenega quotaštevca.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import {
  canAddPhoto,
  sanitizeCaption,
  MAX_PHOTOS_PER_ORDER,
} from "@/lib/work-orders/photo-rules"

export interface WorkOrderPhotoView {
  id: string
  url: string
  caption: string | null
  stageKey: string | null
  stageName: string | null
  createdAt: string
}

export interface AddPhotoInput {
  orderId: string
  url: string
  publicId?: string | null
  caption?: string | null
  /** Stopnja, v kateri je fotografija nastala (privzeto trenutna). */
  stageKey?: string | null
}

export interface PhotoActionResult {
  ok: boolean
  error?: string
  id?: string
}

export async function addWorkOrderPhoto(
  input: AddPhotoInput
): Promise<PhotoActionResult> {
  const { org, session } = await requirePermissionOrg("workorders.manage")

  const order = await prisma.workOrder.findFirst({
    where: { id: input.orderId, organizationId: org.id },
    select: {
      id: true,
      currentStageKey: true,
      status: true,
      _count: { select: { photos: true } },
    },
  })
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }

  const guard = canAddPhoto({
    currentCount: order._count.photos,
    url: input.url,
  })
  if (!guard.ok) return { ok: false, error: guard.error }

  const created = await prisma.workOrderPhoto.create({
    data: {
      organizationId: org.id,
      workOrderId: order.id,
      stageKey: input.stageKey ?? order.currentStageKey ?? null,
      url: input.url,
      publicId: input.publicId ?? null,
      caption: sanitizeCaption(input.caption),
      uploadedById: session.user?.id ?? null,
    },
    select: { id: true },
  })

  await prisma.workOrderEvent.create({
    data: {
      organizationId: org.id,
      workOrderId: order.id,
      type: "NOTE",
      message: `Dodana fotografija (${order._count.photos + 1}/${MAX_PHOTOS_PER_ORDER})`,
      actorEmail: session.user?.email ?? null,
    },
  })

  revalidatePath(`/dashboard/work-orders/${order.id}`)
  return { ok: true, id: created.id }
}

export async function deleteWorkOrderPhoto(
  photoId: string
): Promise<PhotoActionResult> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const photo = await prisma.workOrderPhoto.findFirst({
    where: { id: photoId, organizationId: org.id },
    select: { id: true, workOrderId: true },
  })
  if (!photo) return { ok: false, error: "NOT_FOUND" }

  await prisma.workOrderPhoto.delete({ where: { id: photo.id } })
  revalidatePath(`/dashboard/work-orders/${photo.workOrderId}`)
  return { ok: true }
}

/** Fotografije za podrobnosti naročila (ime stopnje iz workflowa). */
export async function getWorkOrderPhotos(
  orderId: string
): Promise<WorkOrderPhotoView[]> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const order = await prisma.workOrder.findFirst({
    where: { id: orderId, organizationId: org.id },
    select: { id: true },
  })
  if (!order) return []

  const photos = await prisma.workOrderPhoto.findMany({
    where: { organizationId: org.id, workOrderId: order.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, caption: true, stageKey: true, createdAt: true },
  })

  const stageKeys = Array.from(
    new Set(photos.map((p) => p.stageKey).filter((k): k is string => !!k))
  )
  const stages = stageKeys.length
    ? await prisma.workflowStage.findMany({
        where: { key: { in: stageKeys }, definition: { organizationId: org.id } },
        select: { key: true, name: true },
      })
    : []
  const nameByKey = new Map(stages.map((s) => [s.key, s.name]))

  return photos.map((p) => ({
    id: p.id,
    url: p.url,
    caption: p.caption,
    stageKey: p.stageKey,
    stageName: p.stageKey ? (nameByKey.get(p.stageKey) ?? p.stageKey) : null,
    createdAt: p.createdAt.toISOString(),
  }))
}
