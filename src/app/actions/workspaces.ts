"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { resolveActiveOrganizationId } from "@/lib/auth/memberships"
import { verticalLabelFor } from "@/lib/profiles/vertical-label"

// Re-export čistega jedra, da lahko klicatelji uporabljajo en vir resnice.
export { verticalLabelFor }

// ============================================================
// F1 #100 — VSTOPNA TABLA (izbira poslovnega prostora)
// Uporabnik z več workspace-i (podjetji) na računu dobi po
// prijavi enostavno tablo za izbiro. En workspace = nič za izbiro
// (gre naravnost v dashboard). Varnost: članstva brana sveže iz
// baze (nikoli iz JWT-ja), samo ACTIVE organizacije.
// ============================================================

export interface WorkspaceCard {
  id: string
  name: string
  slug: string
  logo: string | null
  vertical: string | null
  verticalLabel: string | null
  role: string
  isDefault: boolean
  isActive: boolean
}

export interface WorkspacePickerPayload {
  workspaces: WorkspaceCard[]
  /** ID workspace-a, ki je trenutno aktiven v seji (če obstaja). */
  activeOrganizationId: string | null
}

/** Število aktivnih workspace-ov uporabnika (za preusmeritve po prijavi). */
export async function getActiveWorkspaceCount(): Promise<number> {
  const session = await auth()
  if (!session?.user?.id) return 0
  return prisma.organizationMember.count({
    where: {
      userId: session.user.id,
      organization: { status: "ACTIVE" },
    },
  })
}

/**
 * Vsa aktivna članstva uporabnika s podatki za vstopno tablo.
 * Sorte: default najprej, nato najstarejše (stabilen vrstni red).
 */
export async function getWorkspacePicker(): Promise<WorkspacePickerPayload> {
  const session = await auth()
  if (!session?.user?.id) {
    return { workspaces: [], activeOrganizationId: null }
  }

  const [memberships, activeOrgId] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { userId: session.user.id, organization: { status: "ACTIVE" } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        role: true,
        isDefault: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            vertical: true,
          },
        },
      },
    }),
    // Aktivni org iz članstev (M2 dvojno branje) — ne iz JWT-ja samega.
    resolveActiveOrganizationId(
      session.user.id,
      session.user.organizationId ?? null
    ),
  ])

  const workspaces: WorkspaceCard[] = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    logo: m.organization.logo,
    vertical: m.organization.vertical,
    verticalLabel: verticalLabelFor(m.organization.vertical),
    role: m.role,
    isDefault: m.isDefault,
    isActive: m.organization.id === activeOrgId,
  }))

  return { workspaces, activeOrganizationId: activeOrgId }
}
