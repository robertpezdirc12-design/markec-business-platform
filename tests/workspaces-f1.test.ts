// ============================================================
// F1 #100 — VSTOPNA TABLA: izbira poslovnega prostora
// Server action (getWorkspacePicker / count + vertical label),
// preusmeritev po prijavi pri 2+ workspaceih, vstop v meniju in
// ikone. Sledi strukturnemu slogu sklopa #100-članstva.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { verticalLabelFor } from "../src/lib/profiles/vertical-label"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("F1 vstopna tabla — čisto jedro (vertical label)", () => {
  it("znana vertikala → label iz profile registra", () => {
    expect(verticalLabelFor("beauty")).toBeTruthy()
    expect(verticalLabelFor(null)).toBeNull()
    expect(verticalLabelFor("neobstajajoča")).toBeNull()
  })
})

describe("F1 vstopna tabla — action + vrata", () => {
  it("getWorkspacePicker: samo ACTIVE org, sort default→createdAt, varnost iz članstev", () => {
    const action = read("src/app/actions/workspaces.ts")
    expect(action).toContain("organizationMember.findMany")
    expect(action).toContain('organization: { status: "ACTIVE" }')
    expect(action).toContain(
      'orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]'
    )
    expect(action).toContain("resolveActiveOrganizationId(")
    expect(action).toContain("session.user.organizationId")
  })

  it("stevec za preusmeritev: šteje samo ACTIVE članstva", () => {
    const action = read("src/app/actions/workspaces.ts")
    expect(action).toContain("getActiveWorkspaceCount")
    expect(action).toContain("organizationMember.count")
    expect(action).toContain('organization: { status: "ACTIVE" }')
  })
})

describe("F1 vstopna tabla — UI", () => {
  it("preusmeritev po prijavi: >1 workspace → /workspaces (ob množičnem uporabniku)", () => {
    const login = read("src/components/auth/login-form.tsx")
    expect(login).toContain("getActiveWorkspaceCount")
    expect(login).toContain('"/workspaces"')
  })

  it("vstop v meniju uporabnika (zamenjaj poslovni prostor)", () => {
    const header = read("src/components/admin/header.tsx")
    expect(header).toContain('"/workspaces"')
    expect(header).toContain("Zamenjaj poslovni prostor")
  })

  it("karte na /workspaces uporabljajo varni switchActiveOrganization", () => {
    const page = read("src/app/(admin)/workspaces/page.tsx")
    expect(page).toContain("WorkspacePicker")
    const picker = read("src/components/admin/workspace-picker.tsx")
    expect(picker).toContain("switchActiveOrganization")
    expect(picker).toContain("router.push")
  })
})
