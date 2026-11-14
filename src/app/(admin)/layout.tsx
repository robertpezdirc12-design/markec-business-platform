import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { PermissionsProvider } from "@/components/admin/permissions-provider"
import { PushSetup } from "@/components/dashboard/push-setup"
import { AdminI18nProvider } from "@/lib/i18n/provider"
import { NoOrgGate } from "@/components/admin/no-org-gate"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { verticalLabelFor } from "@/lib/profiles/vertical-label"
import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // AUTH-GUARD (2D-1E): neprijavljen uporabnik, ki pride na admin območje
  // (/dashboard/*), naj dobi pravilno preusmeritev na prijavo, ne HTTP 500.
  // Stran 2D-1E: pred tem je bilo admin območje (dashboard, apiculture,
  // records, izdelki, zaloga, naročila) dosegljivo le prek seje; neprijavljen
  // obiskovalec je dobil UnauthorizedError namesto redirecta.
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const locale = await getLocaleFromCookies()
  // Activity profile of the tenant — drives capability-gated navigation
  // and industry terminology across the dashboard (EPIC #1).
  // Owner overrides (Phase 5) are applied on top of the shared profile.
  const org = await getSessionOrg()
  const profileId = org?.vertical

  // 2D-1E — Stanje B: prijavljen uporabnik, ki ŠE NIMA aktivnega poslovnega
  // prostora, gre na izbor prostorov (/workspaces) — ne sme dobiti
  // HTTP 500, ne sme iti na /login in ne ustvarjamo organizacije. Client gate
  // prepreči zanko izbora samega sebe. Za vse org-scoped akcije ostane
  // fail-closed requirePermissionOrg (leden ko vara).
  if (session?.user?.id && !org) {
    return <NoOrgGate>{children}</NoOrgGate>
  }

  // Effective permissions for the signed-in member (G8). Computed fresh
  // server-side so the sidebar chrome reflects role edits immediately.
  // (session je že od auth-guarda zgoraj.)
  const permissions = session?.user?.id
    ? await getEffectivePermissions(session.user.id, org?.id)
    : []

  // #100 8.A (M3): podjetja na računu (članstva) — preklop v sidebarju
  // se pokaže samo ko jih je več kot eno (aktivna org izolirano).
  const memberOrgs = session?.user?.id
    ? await prisma.organizationMember.findMany({
        where: { userId: session.user.id, organization: { status: "ACTIVE" } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { organization: { select: { id: true, name: true } } },
      })
    : []
  const organizations = memberOrgs.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
  }))

  // F2.0: admin chrome must reflect the member's role IN THE ACTIVE
  // WORKSPACE, not the global JWT role (a user can be ADMIN in workspace A
  // and STAFF in workspace B). Legacy accounts with no OrganizationMember
  // row keep the global role, so their existing access is not broken.
  // This only gates chrome: every server action re-checks permissions with
  // getEffectivePermissions(session.user.id, org.id).
  const activeMembership =
    org?.id && session?.user?.id
      ? await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: org.id,
              userId: session.user.id,
            },
          },
          select: { role: true },
        })
      : null
  const isAdmin = activeMembership
    ? activeMembership.role === "ADMIN"
    : session?.user?.role === "ADMIN"

  // F7.1 K2: stalna identiteta okolja — ime podjetja in naziv dejavnosti
  // (iz aktivne org, iz seje; nikoli iz clienta).
  const currentOrgName = org?.name ?? null
  const currentVerticalLabel = verticalLabelFor(org?.vertical ?? null)

  return (
    <AdminI18nProvider
      initialLocale={locale}
      profileId={profileId}
      secondaryVertical={org?.secondaryVertical}
      profileOverrides={org?.profileOverrides}
    >
      <PermissionsProvider
        value={{
          permissions,
          isAdmin,
        }}
      >
        <div className="admin-sans-headings bg-background flex h-screen overflow-hidden">
          {/* #99: registracija service workerja (push kanal, tiha napaka) */}
          <PushSetup />
          {/* Desktop Sidebar */}
          <AdminSidebar
            organizations={organizations}
            currentOrganizationId={org?.id ?? null}
            currentOrgName={currentOrgName}
            currentVerticalLabel={currentVerticalLabel}
          />

          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <AdminHeader
              orgSlug={org?.slug}
              organizations={organizations}
              currentOrganizationId={org?.id ?? null}
              currentOrgName={currentOrgName}
              currentVerticalLabel={currentVerticalLabel}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </PermissionsProvider>
    </AdminI18nProvider>
  )
}
