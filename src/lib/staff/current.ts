import "server-only"
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { requireSessionOrg } from "@/lib/auth/guards"

/**
 * F2.3.1 — org-scoped staff resolution.
 *
 * A user may be an employee in MULTIPLE organizations (one Staff row per
 * (userId, organizationId)). Any lookup that previously used
 * `staff.findUnique({ where: { userId } })` (which assumed a global
 * one-to-one) MUST go through this helper, bound to the ACTIVE
 * organization — otherwise it would resolve an arbitrary Staff from the
 * wrong org (IDOR / cross-org data leak).
 *
 * All relations (StaffService/Appointment/WorkingHours) are keyed by
 * `Staff.id`; this helper only resolves WHICH Staff row to use.
 */

/**
 * The Staff row of a user in a specific organization, or null.
 * Uses the compound unique (userId, organizationId) — exact and
 * unambiguous under multi-org.
 */
export const getStaffForOrg = cache(
  async (
    userId: string,
    organizationId: string
  ): Promise<{ id: string } | null> => {
    const staff = await prisma.staff.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true, isActive: true },
    })
    // Inactive staff still resolve by id for historical reads; activation
    // gating is a separate policy concern at call sites.
    return staff ? { id: staff.id } : null
  }
)

/** Staff id of the CALLER in a specific organization (or null when not staff there). */
export async function getCurrentStaffIdInOrg(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const res = await getStaffForOrg(userId, organizationId)
  return res?.id ?? null
}

/**
 * Staff id of the caller in the SESSION organization (requireSessionOrg).
 * Returns null (does NOT throw) when the caller is staff in no org of the
 * active session. Use this in staff-portal actions — the session is bound
 * to exactly one ACTIVE org, so the result is unambiguous.
 */
export async function getCurrentStaffIdInSessionOrg(): Promise<string | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  const { org } = await requireSessionOrg()
  return getCurrentStaffIdInOrg(userId, org.id)
}