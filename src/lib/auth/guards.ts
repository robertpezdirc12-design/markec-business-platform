import { auth } from "@/lib/auth/auth"
import { UserRole, type Organization } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { PermissionKey } from "@/lib/permissions/roles"
import { hasAllPermissions } from "@/lib/permissions/roles"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { resolveActiveOrganizationId } from "@/lib/auth/memberships"

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/**
 * Returns the current session or throws UnauthorizedError.
 * Use inside every mutating / admin-only server action.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError("You must be signed in to perform this action")
  }
  return session
}

/**
 * Returns the current session or throws if the user's role is not allowed.
 */
export async function requireRole(roles: UserRole[]) {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return session
}

/** Admin-only guard */
export function requireAdmin() {
  return requireRole(["ADMIN"])
}

/** Staff-or-admin guard */
export function requireStaffOrAdmin() {
  return requireRole(["ADMIN", "STAFF"])
}

/**
 * True if the current caller is an authenticated staff/admin user.
 * Used for employee-only pricing — MUST be derived server-side,
 * never trusted from client arguments.
 */
export async function isEmployeeSession(): Promise<boolean> {
  const session = await auth()
  if (!session?.user) return false
  return session.user.role === "STAFF" || session.user.role === "ADMIN"
}

// ============================================================
// Custom roles (EPIC #4 G8)
// ============================================================

/**
 * Action guard: throws when the current member lacks the permission.
 * Effective permissions are read FRESH from the DB — role edits apply
 * on the next request even for long-lived JWT sessions.
 */
export async function requirePermission(key: PermissionKey) {
  const session = await requireSession()
  // F0: org-scoped permissions (role + custom role per active org).
  const org = await resolveSessionOrg(session)
  const perms = await getEffectivePermissions(session.user.id, org?.id)
  if (!perms.includes(key)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return session
}

/**
 * Page guard: same rule as requirePermission but REDIRECTS to the
 * dashboard instead of throwing (for server components).
 */
export async function requirePagePermission(key: PermissionKey) {
  const session = await requireSession()
  // F0: org-scoped permissions (role + custom role per active org).
  const org = await resolveSessionOrg(session)
  const perms = await getEffectivePermissions(session.user.id, org?.id)
  if (!perms.includes(key)) {
    redirect("/dashboard")
  }
  return session
}

/**
 * Page guard for privilege-escalating administration (E4-6b): the
 * custom-roles editor. Restricted admins are redirected to the
 * dashboard — they may never administer the permission catalog.
 */
export async function requireUnrestrictedPage() {
  const session = await requireSession()
  // F0: org-scoped permissions (role + custom role per active org).
  const org = await resolveSessionOrg(session)
  const perms = await getEffectivePermissions(session.user.id, org?.id)
  if (!hasAllPermissions(perms)) {
    redirect("/dashboard")
  }
  return session
}

// ============================================================
// Full permission matrix (E4-6b): permission + org in one gate
// ============================================================

// ============================================================
// F2.1 — ENOTEN, FAIL-CLOSED RAZREŠEVALNIK SEJNE ORGANIZACIJE
// ============================================================
//
// F2.0 je štiri "prvo ACTIVE podjetje" rezerve strogo pogoji z M2
// pravilom o legacy računih. F2.1 jih za AVTENTICIRANE poti ukinja:
// globalni ADMIN brez dokazanega članstva ni smel biti vezan na
// naključnega najemnika (nastavitve, terminologija in cilj akcij so
// pripadali drugemu podjetju). Edini dovoljen vir resnice so lastne
// AKTIVNE `OrganizationMember` vrstice.
//
// Javne/anonimne rezerve v tenant.ts (`getPublicOrg` platformni koren,
// anonimna veja `getResolvedOrg`) ostanejo NEDOTAKNJENE — ne
// razrešujejo seje in so nujne za javno stran platforme.
//
// NOTE: intentionally implemented with direct prisma calls (not imported
// from @/lib/tenant) — tenant.ts already imports this module and a
// reverse import would create a require cycle.

export interface SessionOrgRef {
  user: {
    id?: string
    organizationId?: string | null
    role: string
  }
}

/**
 * The ONE session-org resolver. Returns an Organization only when ALL of
 * these hold:
 *  1. the caller has a session with a user id;
 *  2. `resolveActiveOrganizationId` resolves an id from the user's own
 *     ACTIVE memberships (never from a stale JWT alone);
 *  3. an `OrganizationMember` row EXISTS for (that org, that user) — this
 *     is the evidence check that kills the legacy global fallback;
 *  4. the organization itself is ACTIVE.
 *
 * Any failure -> `null` (fail-closed). There is deliberately NO
 * "first ACTIVE organization" fallback here.
 */
export async function resolveSessionOrganization(
  session: SessionOrgRef | null | undefined
): Promise<Organization | null> {
  const userId = session?.user?.id
  if (!userId) return null

  const activeOrgId = await resolveActiveOrganizationId(
    userId,
    session?.user?.organizationId ?? null
  )
  if (!activeOrgId) return null

  // Evidence of belonging: a membership row IN the resolved org. A user
  // with zero memberships (pre-backfill account) resolves to null even if
  // their JWT points at an org — that is precisely the F2.1 requirement
  // "manjkajoča organizacija ne povzroči dostopa prek globalnega
  // fallbacka".
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: activeOrgId, userId },
    },
    select: { organization: { select: { status: true } } },
  })
  if (!membership || membership.organization.status !== "ACTIVE") return null

  return prisma.organization.findUnique({ where: { id: activeOrgId } })
}

/**
 * F2.1 action guard: a signed-in caller bound to exactly one of their own
 * ACTIVE workspaces. Throws `UnauthorizedError` when the org cannot be
 * safely resolved — access is DENIED, never rerouted to a default tenant.
 */
export async function requireSessionOrg(): Promise<{
  session: Awaited<ReturnType<typeof requireSession>>
  org: Organization
}> {
  const session = await requireSession()
  const org = await resolveSessionOrganization(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  return { session, org }
}

/** Backwards-compatible thin wrapper — one resolver, no second source. */
async function resolveSessionOrg(
  session: SessionOrgRef
): Promise<Organization | null> {
  return resolveSessionOrganization(session)
}

/**
 * F2.1 — evidence check for OWNER PREVIEW of an unpublished tenant.
 *
 * The old gates compared `session.user.organizationId === org.id`, i.e. a
 * legacy JWT pointer with no membership proof. A stale or forged pointer
 * could expose another tenant's DRAFT site. Preview is now granted only
 * by an actual ACTIVE `OrganizationMember` row in that exact org.
 */
export async function hasActiveMembershipInOrg(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const row = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    select: { organization: { select: { status: true } } },
  })
  return !!row && row.organization.status === "ACTIVE"
}

/**
 * Action guard for the full permission matrix (E4-6b): throws
 * UnauthorizedError when the caller lacks the permission OR cannot be
 * bound to an organization. Returns the same shape as `requireAdminOrg`,
 * so every migrated call site is a drop-in replacement.
 *
 * Invariants (byte-for-byte legacy behaviour for everyone without a
 * custom role):
 *  - the admin action surface stays ADMIN-only (same as requireAdminOrg;
 *    STAFF keep the staff portal, never admin actions)
 *  - ADMIN/STAFF WITHOUT a custom role hold ALL permission keys
 *  - a custom role RESTRICTS (see `effectivePermissionKeys`) — G8's
 *    "admin brez financ" is enforced here at the ACTION layer
 */
export async function requirePermissionOrg(key: PermissionKey): Promise<{
  session: {
    user: {
      id: string
      role: string
      email?: string | null
      name?: string | null
    }
  }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  // F0: resolve the org FIRST so permissions are checked org-scoped
  // (role + custom role per OrganizationMember), never against a stale
  // global User.role that could grant another workspace's rights.
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const perms = await getEffectivePermissions(session.user.id, org.id)
  if (!perms.includes(key)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return {
    session: session as unknown as {
      user: {
        id: string
        role: string
        email?: string | null
        name?: string | null
      }
    },
    org,
  }
}

/**
 * P3 #52: varianta requirePermissionOrg za dejavnosti, ki jih delita
 * DVA modula (kategorije pripadajo storitvam IN izdelkom) — zadostuje
 * KATERAKOLI ključ. Prej lovilnicatch-pareti v akcijah; zdaj en vir
 * resnice za "ali smem ta modul z dotično pravico".
 */
export async function requireAnyPermissionOrg(keys: PermissionKey[]): Promise<{
  session: {
    user: {
      id: string
      role: string
      email?: string | null
      name?: string | null
    }
  }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  // F0: org-scoped permissions (see requirePermissionOrg).
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const perms = await getEffectivePermissions(session.user.id, org.id)
  const allowed = keys.some((k) => perms.includes(k))
  if (!allowed) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return {
    session: session as unknown as {
      user: {
        id: string
        role: string
        email?: string | null
        name?: string | null
      }
    },
    org,
  }
}

/**
 * F5.2.3 — Category action guard (permission-based, org-scoped).
 *
 * Kategorije delijo izdelki in storitve, zato je dovolj KATERIKOLI ključ
 * (`products.manage` ali `services.manage`). Za razliko od ADMIN-only
 * akcij ta guard dovoli tudi STAFF, ČE njegova efektivna dovoljenja v
 * aktivni organizaciji vsebujejo kataloški ključ (ADMIN in osnovni STAFF
 * imata vse ključe; custom-rola ga lahko omeji). Pomaga z `permissions`,
 * da lahko akcije izvedejo categoryType-check (PRODUCTS/SERVICES/BOTH).
 */
export async function requireCatalogPermission(): Promise<{
  session: Awaited<ReturnType<typeof requireSession>>
  org: Organization
  permissions: PermissionKey[]
}> {
  const session = await requireSession()
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const permissions = await getEffectivePermissions(session.user.id, org.id)
  const hasCatalogKey = permissions.some(
    (k) => k === "products.manage" || k === "services.manage"
  )
  if (!hasCatalogKey) {
    throw new UnauthorizedError(
      "You do not have permission to manage categories"
    )
  }
  return { session, org, permissions }
}

/**
 * F5.5.3.1 — Customer-management action guard (permission-based, org-scoped).
 *
 * Same convention as `requireCatalogPermission`: unlike ADMIN-only actions
 * it permits STAFF too, PROVIDED the caller's effective permissions in the
 * active organization include `customers.manage`. ADMIN and plain STAFF
 * hold every key (see `effectivePermissionKeys`); a custom role may grant
 * or withhold `customers.manage`. This aligns the action surface with
 * `requirePagePermission` (which already lets a STAFF with the key see the
 * customers UI) so a STAFF member who views the page can actually act on it.
 * A custom role that withholds `customers.manage` denies both page and
 * actions — fail-closed. Never leaks across organizations: org resolved
 * from the caller's own ACTIVE membership only.
 */
export async function requireCustomerPermission(): Promise<{
  session: Awaited<ReturnType<typeof requireSession>>
  org: Organization
  permissions: PermissionKey[]
}> {
  const session = await requireSession()
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const permissions = await getEffectivePermissions(session.user.id, org.id)
  if (!permissions.includes("customers.manage")) {
    throw new UnauthorizedError(
      "You do not have permission to manage customers"
    )
  }
  return { session, org, permissions }
}

/**
 * F5.5.4.1/.2 — guard za dostop do dokumentov (org-scoped, permission-based).
 * Dovoljuje ADMIN in STAFF, ki ima v aktivni org ustrezni ključ:
 *   "finances.view"                → branje/pregled
 *   "finances.documents.manage"    → izdaja/urejanje
 *   "finances.documents.pay"       → knjižba plačil
 *   "finances.documents.credit"    → dobropisi
 * Custom-rola brez ključa — zavrnjen (fail-closed); IDOR je pokrit s
 * `where { id, organizationId }` v samih akcijah.
 */
export async function requireDocumentPermission(
  key: "finances.view" | "finances.documents.manage" | "finances.documents.pay" | "finances.documents.credit"
): Promise<{
  session: Awaited<ReturnType<typeof requireSession>>
  org: Organization
  permissions: PermissionKey[]
}> {
  const session = await requireSession()
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const permissions = await getEffectivePermissions(session.user.id, org.id)
  if (!permissions.includes(key)) {
    throw new UnauthorizedError("You do not have permission to manage documents")
  }
  return { session, org, permissions }
}

/**
 * Guard za privilegij-je povišana administracija (E4-6b): ustvarjanje
 * ADMIN računov in upravljanje kataloga custom-rol. Samo admin brez
 * omejene role lahko to — omejeni admin ("admin brez financ") ne sme
 * podeliti pravic, ki jih sam nima.
 */
export async function requireUnrestrictedAdmin(): Promise<{
  session: {
    user: {
      id: string
      role: string
      email?: string | null
      name?: string | null
    }
  }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  // F0: org-scoped permissions — escalate-only when the member holds ALL
  // keys in the ACTIVE organization specifically (not another workspace).
  const org = await resolveSessionOrg(session)
  if (!org)
    throw new UnauthorizedError("No organization found for this account")
  const perms = await getEffectivePermissions(session.user.id, org.id)
  if (!hasAllPermissions(perms)) {
    throw new UnauthorizedError(
      "Only an admin without a restricted role can perform this action"
    )
  }
  return {
    session: session as unknown as {
      user: {
        id: string
        role: string
        email?: string | null
        name?: string | null
      }
    },
    org,
  }
}
