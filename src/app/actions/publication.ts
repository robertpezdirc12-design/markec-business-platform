"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import {
  hasUnpublishedChanges,
  parsePublishState,
  validatePublishRequirements,
} from "@/lib/publication"
import {
  mergeSiteContent,
  type ContentActivityMismatch,
} from "@/lib/site-content"
import { isSampleImageUrl, upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export interface PublicationStatus {
  state: ReturnType<typeof parsePublishState>
  publishedAt: Date | null
  /** True when the working content differs from the published snapshot (E3-2). */
  hasUnpublishedChanges: boolean
  /** True when a published snapshot exists (false = pre-E3-2 tenant). */
  hasPublishedSnapshot: boolean
  /** F5.3.1: trenutna verzija osnutka (za optimistično zaščito hkratnega urejanja). */
  contentVersion: number
  /** P2 #61: non-blocking pre-publish advisories (sample imagery, hidden legacy rows). */
  warnings: string[]
}

/** Current publication state for the Settings card. */
export async function getPublicationStatus(): Promise<PublicationStatus> {
  const { org } = await requirePermissionOrg("settings.manage")
  const [config, serviceCount, productCount, activeStaffCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true, siteContent: true, publishedContentVersion: true },
    }),
    prisma.service.count({ where: { organizationId: org.id } }),
    prisma.product.count({ where: { organizationId: org.id } }),
    prisma.staff.count({ where: { organizationId: org.id, isActive: true } }),
  ])
  const profile = resolveEffectiveProfile(org)

  // P2 #61: pre-publish advisories computed with the SAME validator the
  // publish action uses — behavior can never drift between surfaces.
  const rendered = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug,
    org.vertical
  )
  const usesOnlySampleImages =
    isSampleImageUrl(rendered.hero.imageUrl) &&
    isSampleImageUrl(rendered.about.imageUrl) &&
    isSampleImageUrl(rendered.cta.imageUrl)
  const validation = validatePublishRequirements({
    orgName: org.name,
    contactEmail: config?.email ?? null,
    contactPhone: config?.phone ?? null,
    serviceCount,
    productCount,
    capabilities: {
      services: profile.capabilities.services,
      shop: profile.capabilities.shop,
    },
    // #112-1: obljuba rezervacij = appointments omogočen + booking CTA.
    bookingPromised:
      profile.capabilities.appointments !== "disabled" &&
      profile.website.ctaMode === "booking",
    activeStaffCount,
    siteContent: config?.siteContent ?? null,
    vertical: org.vertical,
    usesOnlySampleImages,
  })

  return {
    state: parsePublishState(org.publishState),
    publishedAt: org.publishedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(
      org.contentVersion,
      config?.publishedContentVersion ?? null
    ),
    hasPublishedSnapshot: config?.publishedContentVersion != null,
    contentVersion: org.contentVersion,
    warnings: validation.warnings,
  }
}

/**
 * Publish the tenant site. Runs the requirement gate FIRST: on failure the
 * publish state is untouched (a failed publish can never replace a working
 * site) and the caller receives actionable errors.
 *
 * A successful publish also SNAPSHOTS the current site content (E3-2): the
 * public site renders the snapshot, so draft edits stay private until the next
 * publish. Tenants without a stored snapshot keep rendering live content
 * (pre-E3-2 behavior, unchanged).
 */
export async function publishSite(): Promise<
  | { success: true; warnings: string[] }
  | { success: false; errors: string[]; mismatch: ContentActivityMismatch | null }
> {
  const { org, session } = await requirePermissionOrg("settings.manage")

  const [config, serviceCount, productCount, activeStaffCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true, siteContent: true },
    }),
    prisma.service.count({ where: { organizationId: org.id } }),
    prisma.product.count({ where: { organizationId: org.id } }),
    // #112-1: rezervacije brez osebja javno ne delujejo (čakalna lista).
    prisma.staff.count({ where: { organizationId: org.id, isActive: true } }),
  ])
  const profile = resolveEffectiveProfile(org)

  // P2 #61: what the site will actually RENDER is the merged content —
  // sample-imagery detection runs on that view (missing fields fall back
  // to the preset samples).
  const rendered = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug,
    org.vertical
  )
  const usesOnlySampleImages =
    isSampleImageUrl(rendered.hero.imageUrl) &&
    isSampleImageUrl(rendered.about.imageUrl) &&
    isSampleImageUrl(rendered.cta.imageUrl)

  const validation = validatePublishRequirements({
    orgName: org.name,
    contactEmail: config?.email ?? null,
    contactPhone: config?.phone ?? null,
    serviceCount,
    productCount,
    capabilities: {
      services: profile.capabilities.services,
      shop: profile.capabilities.shop,
    },
    // #112-1: obljuba rezervacij = appointments omogočen + booking CTA.
    bookingPromised:
      profile.capabilities.appointments !== "disabled" &&
      profile.website.ctaMode === "booking",
    activeStaffCount,
    siteContent: config?.siteContent ?? null,
    vertical: org.vertical,
    usesOnlySampleImages,
  })

  if (!validation.ok) {
    return { success: false, errors: validation.errors, mismatch: validation.mismatch }
  }

  const snapshotVersion = org.contentVersion
  const snapshotContent = config?.siteContent ?? undefined
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { publishState: "PUBLISHED", publishedAt: new Date() },
    }),
    // Freeze exactly the content that is now live. Null siteContent is fine —
    // the public site falls back to the vertical defaults (as it always has).
    prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        name: org.name,
        siteContent: snapshotContent,
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
      update: {
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
    }),
    // Točka 6 — append-only zgodovina objav: vsako objavo zamrzni v novo
    // vrsto, da je "vrni prejšnjo objavo" mogoč z eno točko (nikoli brisanje).
    prisma.publicationHistory.create({
      data: {
        organizationId: org.id,
        contentVersion: snapshotVersion,
        siteContent: (snapshotContent ?? undefined) as Prisma.InputJsonValue | undefined,
        createdByUserId: session?.user?.id ?? null,
        note: "objava",
      },
    }),
  ])

  // F5.5.2 — objavi tudi galerije in FAQ te org (draft → published).
  // Samo ta stopnja nastavi isPublished=true; draft, ki ni bil še objavljen,
  // se objavi tudi na spletni strani. Povratek na prejšnjo objavljeno se za
  // galerije/FAQ izvaja z update/delete z isPublished=false (neodvisno od JSON
  // SiteContent, ki ostane po obstoječem contentVersion sistemu).
  await prisma.$transaction([
    prisma.gallery.updateMany({
      where: { organizationId: org.id, isPublished: false },
      data: { isPublished: true },
    }),
    prisma.galleryItem.updateMany({
      where: { gallery: { organizationId: org.id }, isPublished: false },
      data: { isPublished: true },
    }),
    prisma.faqItem.updateMany({
      where: { organizationId: org.id, isPublished: false },
      data: { isPublished: true },
    }),
  ])

  revalidatePath("/", "layout")
  return { success: true, warnings: validation.warnings }
}

/** Unpublish (take the site back to maintenance). Data is never touched. */
export async function unpublishSite(): Promise<{ success: true }> {
  const { org } = await requirePermissionOrg("settings.manage")
  await prisma.organization.update({
    where: { id: org.id },
    data: { publishState: "UNPUBLISHED" },
  })
  revalidatePath("/", "layout")
  return { success: true }
}

export interface PublicationHistoryEntry {
  id: string
  contentVersion: number
  publishedAt: Date
  createdByUserId: string | null
  note: string | null
}

/**
 * Točka 6 — zgodovina objav (append-only, najnovejša prva).
 * Vrne lahke vrstice (brez težke vsebine) — vsebina se pri PREGLEDU
 * posamezne vrstice naloži ločeno (historyContent).
 */
export async function listPublicationHistory(): Promise<PublicationHistoryEntry[]> {
  const { org } = await requirePermissionOrg("settings.manage")
  const rows = await prisma.publicationHistory.findMany({
    where: { organizationId: org.id },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      contentVersion: true,
      publishedAt: true,
      createdByUserId: true,
      note: true,
    },
  })
  return rows
}

/**
 * Točka 6 — vmetnitev prejšnje objave z enim klikom.
 * Prekopira izbrano zgodovinsko vsebino NAZAJ v osnutek in poveča
 * contentVersion. Ne objavi samodejno (uporabnik po preverbi OBJAVI).
 * Zgodovine NE briše — append-only.
 */
export async function revertToPublication(historyId: string): Promise<
  | { success: true; contentVersion: number }
  | { success: false; error: string }
> {
  const { org } = await requirePermissionOrg("settings.manage")
  const entry = await prisma.publicationHistory.findFirst({
    where: { id: historyId, organizationId: org.id },
    select: { siteContent: true, contentVersion: true },
  })
  if (!entry) return { success: false, error: "Objava ni najdena (ali ni vaša)." }

  // Prekopiraj zgodovinsko vsebino v osnutek + dvigni verzijo (append-only;
  // sama zgodovina ostane nespremenjena).
  const updated = await prisma.$transaction(async (tx) => {
    const orgNext = await tx.organization.update({
      where: { id: org.id },
      data: { contentVersion: { increment: 1 } },
      select: { contentVersion: true },
    })
    await tx.salonConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        name: org.name,
        siteContent: (entry.siteContent ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
      update: { siteContent: (entry.siteContent ?? Prisma.DbNull) as Prisma.InputJsonValue },
    })
    return orgNext.contentVersion
  })

  revalidatePath("/", "layout")
  return { success: true, contentVersion: updated }
}

export interface ShareInfo {
  url: string
  slug: string
  name: string
  customDomain: string | null
  publishedAt: Date | null
}

/**
 * Točka 6 — QR / deljenje po objavi. Vrne človeški javni URL podjetja:
 * primarna (preverjena) lastna domena, če obstaja, sicer platformna
 * pot `/s/{slug}`. Uporablja se za QR kodo in povezavo za deljenje.
 */
export async function getShareInfo(): Promise<ShareInfo> {
  const { org } = await requirePermissionOrg("settings.manage")

  // Primarna preverjena domena (če obstaja) → naslov izven platforme.
  const primary = await prisma.customDomain.findFirst({
    where: { organizationId: org.id, isPrimary: true, verifiedAt: { not: null } },
    select: { domain: true },
  })

  // PUBLIC origin: NEXT_PUBLIC_APP_URL, z normalizacijo končnega "/".
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")

  const customDomain = primary?.domain ?? null
  const url = customDomain
    ? `https://${customDomain}`
    : `${origin}/s/${org.slug}`

  const config = await prisma.organization.findUnique({
    where: { id: org.id },
    select: { publishedAt: true },
  })

  return {
    url,
    slug: org.slug,
    name: org.name,
    customDomain,
    publishedAt: config?.publishedAt ?? null,
  }
}
