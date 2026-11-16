// ============================================================
// F2.0 — ZAKLJUČEK F1 (6 zahtev).
//
// Nov testni datoteki: obstoječih testov ne spreminjamo (mandat:
// ne posegaj v nedokončane spremembe drugih agentov). Kombinacija
// strukturnih jamstev izvorne kode + čistih enot (brez baze).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  legacyDefaultOrgAllowed,
  normalizeActiveMembership,
  type MembershipRef,
} from "../src/lib/auth/memberships"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

// ------------------------------------------------------------
// 1. Vstop tudi v TRENUTNO AKTIVNI workspace
// ------------------------------------------------------------

describe("F2.0 #1 — aktivna kartica je vstopna, ne slepa ulica", () => {
  const picker = read("src/components/admin/workspace-picker.tsx")

  it("ws.isActive ne onemogoča gumba", () => {
    expect(picker).toContain("const disabled = isPending")
    expect(picker).not.toContain("isPending || ws.isActive")
  })

  it("klik na aktivno kartico gre naravnost na ciljno površino brez DB zapisa", () => {
    expect(picker).toContain("enter(ws.id, ws.isActive)")
    expect(picker).toContain("if (!isActive)")
    // F2.1: the picker opens the ROLE-CORRECT surface (ADMIN -> /dashboard,
    // STAFF -> /staff-portal). The active card still skips the DB write
    // (switchActiveOrganization) and navigates via router.push(targetPath).
    expect(picker).toContain("router.push(targetPath)")
  })

  it("preklop na DRUG workspace še vedno uporablja varno strežniško akcijo", () => {
    expect(picker).toContain("switchActiveOrganization(id)")
    expect(picker).toContain("if (!res.success)")
  })
})

// ------------------------------------------------------------
// 2. Strežniška zaščita + preusmeritev neprijavljenih
// ------------------------------------------------------------

describe("F2.0 #2 — /workspaces je zaščiten", () => {
  const page = read("src/app/(admin)/workspaces/page.tsx")
  const proxy = read("src/middleware.ts")

  it("stran sama preveri sejo in preusmeri na /login", () => {
    expect(page).toContain("await auth()")
    expect(page).toContain("if (!session?.user?.id)")
    expect(page).toContain('redirect("/login?callbackUrl=%2Fworkspaces")')
  })

  it("proxy pokrije /workspaces kot defense-in-depth, brez vlogovnega pogoja", () => {
    expect(proxy).toContain("isWorkspacesPage")
    expect(proxy).toMatch(/if \(isWorkspacesPage && !isLoggedIn\)/)
    expect(proxy).toMatch(/isWorkspacesPage[\s\S]{0,500}callbackUrl/)
  })

  it("vlogovna pravila za druge površine ostanejo nespremenjena", () => {
    expect(proxy).toContain('if (userRole !== "ADMIN")')
    expect(proxy).toContain(
      'if (userRole !== "STAFF" && userRole !== "ADMIN")'
    )
  })

  it("F2.1: vstopna tabla odpre vloge-pravilno površino (ADMIN→/dashboard, STAFF→/staff-portal)", () => {
    // The board now navigates each role to its own surface instead of
    // always pushing /dashboard and relying on a proxy redirect.
    expect(page).toContain("targetPath={targetPath}")
    expect(page).toContain('session.user.role === "STAFF"')
    expect(page).toContain('? "/staff-portal"')
    expect(page).toContain('? "/my-account"')
    expect(page).toContain(': "/dashboard"')
  })

  it("akciji ostaneta fail-closed brez seje", () => {
    const action = read("src/app/actions/workspaces.ts")
    expect(action).toContain("if (!session?.user?.id)")
    const sw = read("src/app/actions/organization-switch.ts")
    expect(sw).toContain("if (!session?.user?.id)")
  })
})

// ------------------------------------------------------------
// 3. Dolga imena + 390 px
// ------------------------------------------------------------

describe("F2.0 #3 — kartice se ne razširijo čez zaslon", () => {
  const picker = read("src/components/admin/workspace-picker.tsx")
  const page = read("src/app/(admin)/workspaces/page.tsx")

  it("min-w-0 na vseh flex prednikih, shrink-0 na ikoni in znački", () => {
    expect(picker).toContain(
      'className="flex min-w-0 items-start justify-between gap-3"'
    )
    expect(picker).toContain(
      'className="flex min-w-0 flex-1 items-center gap-3"'
    )
    expect(picker).toContain("flex min-w-0 flex-1 flex-col")
    expect(picker).toContain("shrink-0")
    expect(picker).toContain("truncate")
  })

  it("grid ima ekspliciten minmax(0,1fr) stolpec tudi na mobilnem", () => {
    expect(page).toContain("grid-cols-1")
    expect(page).toContain("min-w-0")
    expect(page).toContain("sm:grid-cols-2")
  })
})

// ------------------------------------------------------------
// 4. Preklop v mobilnem meniju za vse ustrezne vloge
// ------------------------------------------------------------

describe("F2.0 #4 — mobilni preklopnik, brez ADMIN-only gatinga", () => {
  const sidebar = read("src/components/admin/sidebar.tsx")
  const header = read("src/components/admin/header.tsx")
  const layout = read("src/app/(admin)/layout.tsx")

  it("MobileSidebar (ne le desktop aside) renderira OrgSwitcher", () => {
    const mobile = sidebar.slice(
      sidebar.indexOf("export function MobileSidebar")
    )
    expect(mobile).toContain("OrgSwitcher")
    expect(mobile).toContain("organizations.length > 1")
    expect(mobile).toContain("onPicked")
    expect(mobile).toContain('className="flex w-72 flex-col p-0"')
  })

  it("header prenese lastna ACTIVE članstva v mobilni meni", () => {
    expect(header).toContain("<MobileSidebar")
    expect(header).toContain("organizations={organizations}")
    expect(header).toContain(
      "currentOrganizationId={currentOrganizationId}"
    )
  })

  it("menijski vnos je izven ADMIN-only bloka in pogojen s članstvi", () => {
    expect(header).toContain(
      "const canSwitchWorkspaces = organizations.length > 1"
    )
    const switchBlock = header.slice(
      header.indexOf("{canSwitchWorkspaces && ("),
      header.indexOf("{isAdmin && (")
    )
    expect(switchBlock).toContain('href="/workspaces"')
    const adminBlock = header
      .slice(header.indexOf("{isAdmin && ("))
      .split("<DropdownMenuSeparator />")[0]
    expect(adminBlock).not.toContain('href="/workspaces"')
  })

  it("layout posreduje samo ACTIVE članstva", () => {
    expect(layout).toContain('organization: { status: "ACTIVE" }')
    expect(layout).toContain("organizations={organizations}")
    const adminHeaderCall = layout.slice(layout.indexOf("<AdminHeader"))
    expect(adminHeaderCall.split("</AdminHeader>")[0] ?? adminHeaderCall).toContain(
      "organizations={organizations}"
    )
  })
})

// ------------------------------------------------------------
// 5. Globalni JWT role / requireRole / isAdmin / legacy fallbacki
// ------------------------------------------------------------

describe("F2.0 #5 — popravljeni SAMO dokazano napačni konteksti", () => {
  const memberships = read("src/lib/auth/memberships.ts")
  const layout = read("src/app/(admin)/layout.tsx")
  const guards = read("src/lib/auth/guards.ts")
  const tenant = read("src/lib/tenant.ts")

  it("razreševalnik aktivnega org filtrira ACTIVE; članstva brez aktivnega org → null", () => {
    expect(memberships).toContain("getActiveMembershipsForUser")
    expect(memberships).toContain('organization: { status: "ACTIVE" }')
    expect(memberships).toContain(
      "if (await hasAnyMembership(userId)) return null"
    )
  })

  it("preklopni dokaz članstva ostane nefiltriran (memberships-100a invariant)", () => {
    expect(read("src/app/actions/organization-switch.ts")).toContain(
      "getMembershipsForUser(session.user.id)"
    )
  })

  it("čisto pravilo: legacy rezerva SAMO brez članstev IN brez orgId", () => {
    expect(
      legacyDefaultOrgAllowed({
        hasMemberships: false,
        legacyOrganizationId: null,
      })
    ).toBe(true)
    expect(
      legacyDefaultOrgAllowed({
        hasMemberships: true,
        legacyOrganizationId: null,
      })
    ).toBe(false)
    expect(
      legacyDefaultOrgAllowed({
        hasMemberships: false,
        legacyOrganizationId: "org_a",
      })
    ).toBe(false)
    expect(
      legacyDefaultOrgAllowed({
        hasMemberships: true,
        legacyOrganizationId: "org_a",
      })
    ).toBe(false)
  })

  it("stale JWT na neaktivni org pade na privzeti AKTIVNI org", () => {
    const active: MembershipRef[] = [
      { organizationId: "org_default", role: "ADMIN", isDefault: true },
      { organizationId: "org_other", role: "STAFF", isDefault: false },
    ]
    expect(
      normalizeActiveMembership(active, "org_suspended")?.organizationId
    ).toBe("org_default")
  })

  // AMENDED BY F2.1 (supersedes the F2.0 "gated legacy fallback" design):
  // F2.1 removed all session-side "first ACTIVE org" fallbacks and unified
  // every authenticated resolver on requireSessionOrg(). The pure rule
  // legacyDefaultOrgAllowed() still exists in memberships.ts and is still
  // asserted above (behaviour preserved), but no session path calls it.
  it("F2.1: sejni razreševalniki so fail-closed brez globalnega fallbacka", () => {
    expect(guards).toContain("resolveSessionOrganization")
    expect(guards).toContain("requireSessionOrg()")
    expect(guards).toContain("organizationId_userId")
    expect(tenant).toContain("resolveSessionOrganization(session)")
    expect(tenant).toContain("requireSessionOrg()")
    // The three session-side legacy fallbacks are gone.
    expect(guards).not.toContain("mayUseLegacyDefaultOrg(")
    expect(tenant).not.toContain("mayUseLegacyDefaultOrg(")
    expect(tenant).not.toContain("legacyDefaultAllowed")
    // signed-in ADMIN/STAFF brez razrešenega org ne pade na javni default
    expect(tenant).toContain("if (sessionOrg) return sessionOrg")
    expect(tenant).toMatch(
      /if \(sessionOrg\) return sessionOrg[\s\S]{0,300}return null/
    )
  })

  it("anonimni javni platformni fallback ostane nedotaknjen", () => {
    expect(tenant).toContain(
      'where: { status: "ACTIVE", publishState: "PUBLISHED" }'
    )
    expect(tenant).toContain("getPublicOrg")
  })

  it("PermissionsProvider.isAdmin izhaja iz vloge v AKTIVNEM workspaceu", () => {
    expect(layout).toContain("organizationId_userId")
    expect(layout).toContain('activeMembership.role === "ADMIN"')
    expect(layout).toContain("isAdmin,")
    expect(layout).not.toContain(
      'isAdmin: session?.user?.role === "ADMIN"'
    )
  })

  it("org-scoped pravice v akcijah ostanejo (F0 ni porušeno)", () => {
    expect(guards).toContain(
      "getEffectivePermissions(session.user.id, org.id)"
    )
    expect(read("src/lib/permissions/effective.ts")).toContain(
      "if (!belongsToOrg) return []"
    )
  })
})

// ------------------------------------------------------------
// 6. Privzeti proti zadnjemu uporabljenemu
// ------------------------------------------------------------

describe("F2.0 #6 — dva pojma, dve oznaki", () => {
  const picker = read("src/components/admin/workspace-picker.tsx")
  const page = read("src/app/(admin)/workspaces/page.tsx")

  it("aktivni = 'Zadnji uporabljeni', rezerva = 'Privzeti prostor'", () => {
    expect(picker).toContain("Zadnji uporabljeni")
    expect(picker).toContain("Privzeti prostor")
    expect(picker).not.toContain(">Aktiven<")
  })

  it("tabla razloži razliko", () => {
    expect(page).toContain("Zadnji uporabljeni")
    expect(page).toContain("Privzeti prostor")
    expect(page).toContain("je rezerva")
  })

  it("isDefault se ne prepisuje ob preklopu — ne zlijemo pojmov", () => {
    expect(read("src/app/actions/organization-switch.ts")).not.toContain(
      "isDefault:"
    )
  })
})
