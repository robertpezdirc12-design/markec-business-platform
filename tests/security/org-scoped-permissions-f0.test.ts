// ============================================================
// F0 — org-scoped effective permissions
// Preprečuje cross-workspace proudler: uporabnik, ki je ADMIN
// v workspace A in STAFF v workspace B, ne sme imeti v B
// ADMIN pravic, izpeljanih iz globalnega User.role.
//
// getEffectivePermissions(userId, organizationId?) je DB-bazirana
// (prisma), zato ta test sodi ob strani memberships-100a.test.ts:
// strukturna jamstva izvora + enote preko čistih pravil iz
// roles.ts (effectivePermissionKeys), ki jih ta funkcija kliče.
// ============================================================
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  effectivePermissionKeys,
  hasPermission,
  ALL_PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/permissions/roles"

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

describe("effectivePermissionKeys — osnova (org neodvisna, G8)", () => {
  it("custom role RESTRICTS (zmanjšuje), brez nje ADMIN/STAFF imata vse", () => {
    const restricted = effectivePermissionKeys({
      role: "ADMIN",
      customRolePermissions: ["appointments.view"],
    })
    expect(restricted).toEqual(["appointments.view"])
    expect(
      hasPermission(
        effectivePermissionKeys({
          role: "ADMIN",
          customRolePermissions: null,
        }),
        "settings.manage" as PermissionKey
      )
    ).toBe(true)
    expect(ALL_PERMISSION_KEYS.length).toBeGreaterThan(1)
  })

  it("CLIENTE brez custom role nima administratorskih pravic", () => {
    expect(
      effectivePermissionKeys({ role: "CLIENTE", customRolePermissions: null })
    ).toEqual([])
  })
})

describe("F0 — getEffectivePermissions je org-scoped (strukturna jamstva)", () => {
  it("sprejme organizationId in bere OrganizationMember (role per org)", () => {
    const eff = read("src/lib/permissions/effective.ts")
    expect(eff).toContain("organizationId?: string | null")
    expect(eff).toContain("prisma.organizationMember.findUnique")
    expect(eff).toContain("organizationId_userId: { organizationId, userId }")
    expect(eff).toContain("role: member.role")
  })

  it("org-scoped custom role bere iz OrganizationMember.customRoleId in je OMEJEN na lastno organizacijo (#130)", () => {
    const eff = read("src/lib/permissions/effective.ts")
    expect(eff).toContain("customRoleId: true")
    expect(eff).toContain("prisma.customRole.findFirst")
    // #130 (P0): lookup mora biti org-scoped (+ organizationId), da prepreči
    // cross-tenant branje CustomRole iz druge organizacije ob poškodovani referenci.
    expect(eff).toContain("where: { id: member.customRoleId, organizationId }")
    expect(eff).not.toContain('where: { id: member.customRoleId },')
  })

  it("legacy member (brez OrganizationMember) dobi pravice SAMO če je dejansko vezan na org", () => {
    const eff = read("src/lib/permissions/effective.ts")
    expect(eff).toContain("user.organizationId === organizationId")
    // F2.3.1: org belonging je dokazan z aktivnim Staff zapisom v tem orgu
    // (množina `staffs`, ne enojni `staff`).
    expect(eff).toContain("user.staffs.some")
    expect(eff).toContain("s.organizationId === organizationId")
    expect(eff).toContain("s.isActive")
    expect(eff).not.toContain("genericStaff")
  })

  it("fail-closed: nepripadnik org → prazne pravice; brez tihega fallbacka na globalno vlogo", () => {
    const eff = read("src/lib/permissions/effective.ts")
    expect(eff).toContain("if (!belongsToOrg) return []")
  })

  it("guards resolve org PRED preverjanjem dovoljenj (org-scoped, ne globalni User.role)", () => {
    const guards = read("src/lib/auth/guards.ts")
    expect(guards).toContain("getEffectivePermissions(session.user.id, org.id)")
    expect(guards).toContain(
      "getEffectivePermissions(session.user.id, org?.id)"
    )
  })

  it("dashboard + admin layout prenašata aktivni org v permissions", () => {
    const layout = read("src/app/(admin)/layout.tsx")
    expect(layout).toContain(
      "getEffectivePermissions(session.user.id, org?.id)"
    )
    const dashboard = read("src/app/(admin)/dashboard/page.tsx")
    expect(dashboard).toContain(
      "getEffectivePermissions(session.user.id, activeOrg?.id)"
    )
  })

  it("users + appointments actions scoped na resolviran org", () => {
    const users = read("src/app/actions/users.ts")
    expect(users).toContain("getEffectivePermissions(session.user.id, org.id)")
    const appts = read("src/app/actions/appointments.ts")
    expect(appts).toContain("getEffectivePermissions(session.user.id, org.id)")
  })
})
