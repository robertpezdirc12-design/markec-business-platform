"use server"

// ============================================================
// F5.5.2 — GALERIJE (org-scoped, nad obstoječo medijsko plastjo).
// Fotografije so REFERENCE (`mediaId` = Cloudinary publicId / Media.id / URL);
// nikoli se jih pri brisanju galerije ne izbriše iz sistema, dokler je media
// morda še v uporabi drugje (Service/Product/Staff/Media) — brisanje galerije
// samo odstrani reference, ne medijskih datotek.
// ------------------------------------------------------------
// Varnost: • org-scoped resolve (requirePermissionOrg "settings.manage"),
//           • vse operacije povezane na trenutno org (IDOR varen),
//           • javna branja samo isPublic + isPublished entitete.
// ============================================================

import "server-only"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { getPublicOrg } from "@/lib/tenant"
import { bumpContentVersion } from "@/lib/content-version"

export interface GalleryDTO {
  id: string
  title: string
  description: string | null
  coverImageId: string | null
  isPublic: boolean
  isPublished: boolean
  position: number
  linkedServiceId: string | null
  linkedProductId: string | null
  linkedProjectId: string | null
  itemCount: number
}

export interface GalleryItemDTO {
  id: string
  galleryId: string
  mediaId: string
  caption: string | null
  alt: string | null
  position: number
  isPublished: boolean
}

function toGalleryDTO(g: {
  id: string
  title: string
  description: string | null
  coverImageId: string | null
  isPublic: boolean
  isPublished: boolean
  position: number
  linkedServiceId: string | null
  linkedProductId: string | null
  linkedProjectId: string | null
  _count?: { items: number }
}): GalleryDTO {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    coverImageId: g.coverImageId,
    isPublic: g.isPublic,
    isPublished: g.isPublished,
    position: g.position,
    linkedServiceId: g.linkedServiceId,
    linkedProductId: g.linkedProductId,
    linkedProjectId: g.linkedProjectId,
    itemCount: g._count?.items ?? 0,
  }
}

/** Vse galerije trenutne org (draft + published) za admin/dashboard. */
export async function getAdminGalleries(): Promise<GalleryDTO[]> {
  const { org } = await requirePermissionOrg("settings.manage")
  const rows = await prisma.gallery.findMany({
    where: { organizationId: org.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  })
  return rows.map(toGalleryDTO)
}

/** Ena galerija + njeni elementi (admin preview — vključno s draft items). */
export async function getAdminGallery(id: string): Promise<(GalleryDTO & { items: GalleryItemDTO[] }) | null> {
  const { org } = await requirePermissionOrg("settings.manage")
  const g = await prisma.gallery.findFirst({
    where: { id, organizationId: org.id },
    include: {
      items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      _count: { select: { items: true } },
    },
  })
  if (!g) return null
  return {
    ...toGalleryDTO(g),
    items: g.items.map((i) => ({
      id: i.id,
      galleryId: i.galleryId,
      mediaId: i.mediaId,
      caption: i.caption,
      alt: i.alt,
      position: i.position,
      isPublished: i.isPublished,
    })),
  }
}

export interface GalleryInput {
  title: string
  description?: string | null
  coverImageId?: string | null
  isPublic?: boolean
  isPublished?: boolean
  position?: number
  linkedServiceId?: string | null
  linkedProductId?: string | null
  linkedProjectId?: string | null
}

export interface GalleryResult {
  ok: boolean
  id?: string
  error?: string
}

/**
 * Preveri, da so podane povezave (storitev/izdelek/projekt) ORG-validne.
 * IDOR zaščita: brez tega bi uporabnik lahko povezal galerijo s tujo
 * entiteto (napačna objava / vdor v drugo org). Vrne false ob tuji
 * referenci — klicatelj naj vrne NOT_FOUND.
 */
async function validateLinkedEntities(
  orgId: string,
  input: Pick<GalleryInput, "linkedServiceId" | "linkedProductId" | "linkedProjectId">
): Promise<boolean> {
  if (input.linkedServiceId) {
    const svc = await prisma.service.findFirst({ where: { id: input.linkedServiceId, organizationId: orgId }, select: { id: true } })
    if (!svc) return false
  }
  if (input.linkedProductId) {
    const prod = await prisma.product.findFirst({ where: { id: input.linkedProductId, organizationId: orgId }, select: { id: true } })
    if (!prod) return false
  }
  if (input.linkedProjectId) {
    const proj = await prisma.project.findFirst({ where: { id: input.linkedProjectId, organizationId: orgId }, select: { id: true } })
    if (!proj) return false
  }
  return true
}

/**
 * 2D-13 (security): preveri, da coverImageId (če je DB `Media` vrstica) pripada
 * isti org kot galerija. Neobstoječ / tuj / platformni (null) media se obravnava
 * kot pri addGalleryItem: tuj DB-Media → MEDIA_FORBIDDEN, sicer dovoljeno
 * (Cloudinary publicId/URL tok ostane nespremenjen).
 */
async function mediaBelongsToOrg(orgId: string, mediaId: string | null): Promise<boolean> {
  if (!mediaId) return true
  const owner = await prisma.media.findUnique({ where: { id: mediaId }, select: { organizationId: true } }).catch(() => null)
  if (owner && owner.organizationId !== null && owner.organizationId !== orgId) return false
  return true
}

export async function createGallery(input: GalleryInput): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const title = input.title?.trim()
  if (!title) return { ok: false, error: "MISSING_TITLE" }

  // IDOR zaščita: povezava samo na lastniške entitete.
  if (!(await validateLinkedEntities(org.id, input))) return { ok: false, error: "NOT_FOUND" }
  if (!(await mediaBelongsToOrg(org.id, input.coverImageId ?? null))) return { ok: false, error: "MEDIA_FORBIDDEN" }

  const maxPos = await prisma.gallery.aggregate({
    where: { organizationId: org.id },
    _max: { position: true },
  })
  const gallery = await prisma.gallery.create({
    data: {
      organizationId: org.id,
      title,
      description: input.description ?? null,
      coverImageId: input.coverImageId ?? null,
      isPublic: input.isPublic ?? true,
      isPublished: input.isPublished ?? false,
      position: (maxPos._max.position ?? -1) + 1,
      linkedServiceId: input.linkedServiceId ?? null,
      linkedProductId: input.linkedProductId ?? null,
      linkedProjectId: input.linkedProjectId ?? null,
    },
    select: { id: true },
  })
  // F5.5.2 — nova galerija je neobjavljena sprememba (drift + sledljivost).
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Galerija ustvarjena: ${title}`,
    next: { galleryId: gallery.id, title },
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id: gallery.id }
}

export async function updateGallery(id: string, input: Partial<GalleryInput>): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const existing = await prisma.gallery.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }
  const title = input.title?.trim()
  if (title !== undefined && !title) return { ok: false, error: "MISSING_TITLE" }
  // IDOR zaščita: povezava samo na lastniške entitete.
  if (!(await validateLinkedEntities(org.id, input))) return { ok: false, error: "NOT_FOUND" }
  if (input.coverImageId !== undefined && !(await mediaBelongsToOrg(org.id, input.coverImageId ?? null))) {
    return { ok: false, error: "MEDIA_FORBIDDEN" }
  }
  await prisma.gallery.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.linkedServiceId !== undefined ? { linkedServiceId: input.linkedServiceId } : {}),
      ...(input.linkedProductId !== undefined ? { linkedProductId: input.linkedProductId } : {}),
      ...(input.linkedProjectId !== undefined ? { linkedProjectId: input.linkedProjectId } : {}),
    },
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Galerija posodobljena: ${title ?? id}`,
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

/** Brisanje galerije — od NIKOLI ne briše medijskih datotek (samo reference). */
export async function deleteGallery(id: string): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const existing = await prisma.gallery.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  // Pokreni brisanje itemov (CASCADE) + galerije. Media se ne izbriše:
  // isti mediaId je lahko v uporabi drugje (Service/Product/Staff/Media).
  await prisma.$transaction(async (tx) => {
    await tx.galleryItem.deleteMany({ where: { galleryId: id } })
    await tx.gallery.delete({ where: { id } })
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Galerija izbrisana: ${id}`,
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

// ---- Items ----

export interface GalleryItemInput {
  galleryId: string
  mediaId: string
  caption?: string | null
  alt?: string | null
  position?: number
  isPublished?: boolean
}

export async function addGalleryItem(input: GalleryItemInput): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const mediaId = input.mediaId?.trim()
  if (!mediaId) return { ok: false, error: "MISSING_MEDIA" }
  const gallery = await prisma.gallery.findFirst({ where: { id: input.galleryId, organizationId: org.id }, select: { id: true } })
  if (!gallery) return { ok: false, error: "NOT_FOUND" }

  // 2D-13 (security): ČE mediaId kaže na DB `Media` vrstico (DB-fallback pot,
  // ko Cloudinary NI konfiguriran), mora medij pripadati ISTI org kot galerija.
  // Neobstoječi / tuji ./ platformni media → enotna, nerazkrivajoča napaka, preden
  // se karkoli zapisuje. Če mediaId NI DB Media (npr. Cloudinary publicId/URL),
  // ga pustimo nespremenjenega — obvelja obstoječi Cloudinary/URL tok. Tako ne
  // razbijemo obstoječih vnosov, ki uporabljajo publicId, in zapremo tuj DB-Media
  // leak (tuja `/api/media/...` v javni galeriji).
  const mediaOwner = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { organizationId: true },
  }).catch(() => null)
  if (mediaOwner && mediaOwner.organizationId !== null && mediaOwner.organizationId !== org.id) {
    return { ok: false, error: "MEDIA_FORBIDDEN" }
  }

  const maxPos = await prisma.galleryItem.aggregate({
    where: { galleryId: input.galleryId },
    _max: { position: true },
  })
  const item = await prisma.galleryItem.create({
    data: {
      galleryId: input.galleryId,
      mediaId,
      caption: input.caption ?? null,
      alt: input.alt ?? null,
      position: (maxPos._max.position ?? -1) + 1,
      isPublished: input.isPublished ?? false,
    },
    select: { id: true },
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Fotografija dodana v galerijo ${input.galleryId}`,
    next: { itemId: item.id, galleryId: input.galleryId, mediaId },
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id: item.id }
}

export async function updateGalleryItem(id: string, input: { caption?: string | null; alt?: string | null; position?: number; isPublished?: boolean }): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const item = await prisma.galleryItem.findFirst({
    where: { id, gallery: { organizationId: org.id } },
    select: { id: true, galleryId: true },
  })
  if (!item) return { ok: false, error: "NOT_FOUND" }
  await prisma.galleryItem.update({
    where: { id },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.alt !== undefined ? { alt: input.alt } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
  })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Fotografija posodobljena: ${id}`,
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

/**
 * Odstrani fotografijo iz galerije.
 * Fotografija (media datoteka) se NE zbriše iz sistema — samo iz te galerije.
 * Tako brisanje ne more nikoli poškodovati vsebine, ki media še uporablja
 * drugje (Service/Product/Staff/druge galerije).
 */
export async function removeGalleryItem(id: string): Promise<GalleryResult> {
  const { org, session } = await requirePermissionOrg("settings.manage")
  const actorEmail = session?.user?.email
  const item = await prisma.galleryItem.findFirst({
    where: { id, gallery: { organizationId: org.id } },
    select: { id: true, galleryId: true },
  })
  if (!item) return { ok: false, error: "NOT_FOUND" }
  await prisma.galleryItem.delete({ where: { id } })
  await bumpContentVersion(org.id, actorEmail, {
    entityKey: "galleries",
    action: "UPDATE",
    summary: `Fotografija odstranjena iz galerije: ${item.galleryId}`,
  })
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

// ---- Javno branje (samo objavljeno + javno) ----

export interface PublicGalleryDTO {
  id: string
  title: string
  description: string | null
  coverImageId: string | null
  items: { mediaId: string; caption: string | null; alt: string | null; position: number }[]
}

/**
 * Predogled (pooblaščeno) — vse galerije trenutne org, vključno z osnutki.
 * Za razliko od `getPublicGalleries` predogled NE filtrira `isPublished`,
 * da podjetnik vidi neobjavljeno pripravljeno vsebino, preden jo objavi.
 * Neobjavljena govori samo, če je galerija isPublic (da se izklopljene
 * in osnutke vidi enako kot na javni strani po objavi, leprej).
 */
export async function getPreviewGalleries(_orgId?: string): Promise<PublicGalleryDTO[]> {
  // Varnost (F6.3.5): NNIKOLI ne zaupaj orgId. Le lastnik (session + membership).
  let orgId: string | null = null
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    orgId = org.id
  } catch {
    return []
  }
  const rows = await prisma.gallery.findMany({
    where: { organizationId: orgId, isPublic: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { mediaId: true, caption: true, alt: true, position: true },
      },
    },
  })
  return rows.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    coverImageId: g.coverImageId,
    items: g.items.map((i) => ({ mediaId: i.mediaId, caption: i.caption, alt: i.alt, position: i.position })),
  }))
}

/** Javne, OBJAVLJENE galerije — izključno trenutnega javnega konteksta. */
export async function getPublicGalleries(_orgId?: string): Promise<PublicGalleryDTO[]> {
  const org = await getPublicOrg()
  if (!org) return []
  const rows = await prisma.gallery.findMany({
    where: { organizationId: org.id, isPublic: true, isPublished: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { isPublished: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { mediaId: true, caption: true, alt: true, position: true },
      },
    },
  })
  return rows.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    coverImageId: g.coverImageId,
    items: g.items.map((i) => ({ mediaId: i.mediaId, caption: i.caption, alt: i.alt, position: i.position })),
  }))
}