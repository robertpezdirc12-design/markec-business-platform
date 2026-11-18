"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg, requireUnrestrictedAdmin } from "@/lib/auth/guards"

import { isValidPermissionSet } from "@/lib/permissions/roles"

// ============================================================
// Custom roles CRUD (EPIC #4 G8) — org-scoped, admin-only.
// Permission keys are ALWAYS validated against the catalog; the
// client never dictates raw permission data.
// ============================================================

const roleDataSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional().nullable(),
  permissions: z
    .array(z.string())
    .refine(isValidPermissionSet, {
      message: "Neznana dovoljenja",
    }),
})

export type CustomRoleInput = z.infer<typeof roleDataSchema>

/** All custom roles of the salon, newest first, with org-scoped member counts. */
export async function listCustomRoles() {
  const { org } = await requirePermissionOrg("staff.manage")

  const [roles, counts] = await Promise.all([
    prisma.customRole.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organizationMember.groupBy({
      by: ["customRoleId"],
      where: { organizationId: org.id, customRoleId: { not: null } },
      _count: { _all: true },
    }),
  ])
  const countByRole = new Map(counts.map((c) => [c.customRoleId, c._count._all]))

  return roles.map((role) => ({
    ...role,
    _count: { users: countByRole.get(role.id) ?? 0 },
  }))
}

/** Org members that can receive a custom role (ADMIN/STAFF only). */
export async function listAssignableMembers() {
  const { org } = await requirePermissionOrg("staff.manage")

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: org.id,
      role: { in: ["ADMIN", "STAFF"] },
    },
    select: {
      userId: true,
      role: true,
      customRoleId: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
  })

  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role as "ADMIN" | "STAFF",
    customRoleId: m.customRoleId,
  }))
}

export async function createCustomRole(input: CustomRoleInput) {
  // E4-6b: administering the permission catalog escalates privileges —
  // restricted admins must never grant what they do not hold.
  const { org } = await requireUnrestrictedAdmin()
  const data = roleDataSchema.parse(input)

  const duplicate = await prisma.customRole.findFirst({
    where: { organizationId: org.id, name: data.name },
    select: { id: true },
  })
  if (duplicate) {
    return { success: false as const, error: "Vloga s tem imenom že obstaja." }
  }

  const role = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
    },
  })
  return { success: true as const, id: role.id }
}

export async function updateCustomRole(id: string, input: CustomRoleInput) {
  const { org } = await requireUnrestrictedAdmin()
  const data = roleDataSchema.parse(input)

  const existing = await prisma.customRole.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) {
    return { success: false as const, error: "Vloga ne obstaja." }
  }

  const duplicate = await prisma.customRole.findFirst({
    where: { organizationId: org.id, name: data.name, id: { not: id } },
    select: { id: true },
  })
  if (duplicate) {
    return { success: false as const, error: "Vloga s tem imenom že obstaja." }
  }

  await prisma.customRole.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
    },
  })
  return { success: true as const }
}

export async function deleteCustomRole(id: string) {
  const { org } = await requireUnrestrictedAdmin()

  const existing = await prisma.customRole.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) {
    return { success: false as const, error: "Vloga ne obstaja." }
  }

  // OrganizationMember.customRoleId is a stored FK without a Prisma
  // relation, so ON DELETE SET NULL does not reach it. Clear the org-scoped
  // assignments first (otherwise stale ids would linger), then delete.
  // User.customRoleId keeps its ON DELETE SET NULL behaviour.
  await prisma.$transaction([
    prisma.organizationMember.updateMany({
      where: { organizationId: org.id, customRoleId: id },
      data: { customRoleId: null },
    }),
    prisma.customRole.delete({ where: { id } }),
  ])
  return { success: true as const }
}

/** Assign (or clear, with null) a custom role for an org member. */
export async function assignCustomRole(
  userId: string,
  customRoleId: string | null
) {
  // E4-6b: assigning a role GRANTS its permissions to a member — a
  // restricted admin must never grant what they do not hold.
  const { session, org } = await requireUnrestrictedAdmin()

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
    select: { id: true, userId: true, role: true },
  })
  if (!member || member.role === "CLIENTE") {
    return { success: false as const, error: "Član ne obstaja." }
  }

  // E4-6b: no self-assignment — an admin who restricts themselves could
  // no longer reach this editor (requireUnrestrictedAdmin) and, in a
  // single-owner salon, nobody could undo it. Use another unrestricted
  // admin or the platform console for such changes.
  if (member.userId === session.user.id) {
    return {
      success: false as const,
      error: "Svoje vloge po meri ne morete spremeniti.",
    }
  }

  if (customRoleId !== null) {
    const role = await prisma.customRole.findFirst({
      where: { id: customRoleId, organizationId: org.id },
      select: { id: true },
    })
    if (!role) {
      return { success: false as const, error: "Vloga ne obstaja." }
    }
  }

  // G8 source of truth: the assignment is PER ORGANIZATION. The org-scoped
  // permission path (src/lib/permissions/effective.ts) reads
  // OrganizationMember.customRoleId; User.customRoleId is only kept in sync
  // for legacy call sites that do not pass an organizationId.
  await prisma.$transaction([
    prisma.organizationMember.update({
      where: { id: member.id },
      data: { customRoleId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { customRoleId },
    }),
  ])
  return { success: true as const }
}
