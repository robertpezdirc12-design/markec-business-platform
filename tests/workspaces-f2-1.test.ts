// ============================================================
// F2.1 — VARNOSTNA IZOLACIJA IN INTEGRACIJSKA VALIDACIJA
//
// Strukturna jamstva za spremembe, ki so bile v F2.1 dokazano
// potrebne. Vedenjske dokaze (prava baza, prijava, preklop,
// vizualni pregled) izvajajo:
//   tests/integration/f2-1/org-isolation.itest.ts
//   tests/integration/f2-1/browser-flow.cjs
//   tests/integration/f2-1/visual-regression.cjs
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

// ------------------------------------------------------------
// 1. Enoten, fail-closed razreševalnik organizacije
// ------------------------------------------------------------

describe("F2.1 — enoten fail-closed razreševalnik", () => {
  const guards = read("src/lib/auth/guards.ts")
  const tenant = read("src/lib/tenant.ts")

  it("izvozi resolveSessionOrganization() in requireSessionOrg()", () => {
    expect(guards).toContain("export async function resolveSessionOrganization(")
    expect(guards).toContain("export async function requireSessionOrg()")
  })

  it("zahteva dejansko ACTIVE članstvo, ne le JWT organizationId", () => {
    expect(guards).toContain("organizationId_userId")
    expect(guards).toContain('membership.organization.status !== "ACTIVE"')
    expect(guards).toContain("if (!userId) return null")
  })

  it("requireSessionOrg() zavrne sejo brez varne organizacije", () => {
    expect(guards).toMatch(
      /if \(!org\)[\s\S]{0,200}throw new UnauthorizedError\(/
    )
  })

  it("sejne poti v tenant.ts ne uporabljajo več legacy/global fallbacka", () => {
    expect(tenant).toContain("resolveSessionOrganization(session)")
    expect(tenant).toContain("requireSessionOrg()")
    expect(tenant).not.toContain("mayUseLegacyDefaultOrg(")
    expect(tenant).not.toContain("legacyDefaultAllowed")
  })

  it("lastniški predogled DRAFT/UNPUBLISHED zahteva dokazano članstvo", () => {
    expect(tenant).toContain("hasActiveMembershipInOrg(")
    expect(guards).toContain(
      "export async function hasActiveMembershipInOrg("
    )
    expect(tenant).not.toContain(
      "session.user.organizationId === org.id"
    )
  })

  it("anonimni javni fallback ostane nedotaknjen", () => {
    expect(tenant).toContain('publishState: "PUBLISHED"')
    expect(tenant).toContain('orderBy: { createdAt: "asc" }')
  })
})

// ------------------------------------------------------------
// 2. Prijava z več prostori: server action ne sme biti preusmerjen
// ------------------------------------------------------------

describe("F2.1 — prava prijava pride na vstopno tablo", () => {
  const proxy = read("src/proxy.ts")
  const login = read("src/components/auth/login-form.tsx")

  it("prijavni obrazec še vedno preverja število aktivnih članstev", () => {
    expect(login).toContain("getActiveWorkspaceCount()")
    expect(login).toContain('"/workspaces"')
  })

  it("prijavni obrazec po router.push NE kliče router.refresh()", () => {
    // router.refresh() takoj za router.push() prekliče še nezaključeno
    // navigacijo — uporabnik obtiči na /login kljub uspešni prijavi in
    // uspešnem getActiveWorkspaceCount(). update() že sinhronizira
    // SessionProvider, pusnjena pot pa ponovno prebere piškotek na strežniku.
    // Preverjamo DEJANSKI klic (vrstica, ki je sama router.refresh()),
    // ne komentarjev.
    expect(login).not.toMatch(/^\s*router\.refresh\(\)$/m)
  })

  it("preklop poslovnega prostora po router.push NE kliče router.refresh()", () => {
    // Enak vzorec kot zgoraj: router.refresh() takoj za router.push()
    // v WorkspacePicker.enter() prekliče navigacijo na /dashboard.
    const picker = read("src/components/admin/workspace-picker.tsx")
    expect(picker).not.toMatch(/^\s*router\.refresh\(\)$/m)
  })

  it("proxy ne preusmeri Next.js Server Action POST-a z /login", () => {
    expect(proxy).toContain('req.headers.has("next-action")')
    expect(proxy).toContain("isLoggedIn && isAuthPage && !isServerAction")
  })

  it("GET obisk /login s sejo je še vedno preusmerjen (ni globalne odprave)", () => {
    expect(proxy).toContain("const isAuthPage =")
    expect(proxy).toContain('return NextResponse.redirect(new URL("/dashboard", req.url))')
  })

  it("anonimni /workspaces ostane zaščiten", () => {
    expect(proxy).toContain(
      "if (isWorkspacesPage && !isLoggedIn)"
    )
  })
})

// ------------------------------------------------------------
// 3. Ločena TESTNA baza — nikoli produkcijska / dev baza
// ------------------------------------------------------------

describe("F2.1 — varnostne zapore testne baze", () => {
  const config = read("vitest.integration.config.ts")
  const seed = read("tests/integration/f2-1/seed.mjs")
  const suite = read("tests/integration/f2-1/org-isolation.itest.ts")

  it("integracijski config prisili markec_f21_test in zavrne napačno ime", () => {
    expect(config).toContain("markec_f21_test")
    expect(config).toContain("REFUSED")
    // F5.0.2: f21 suita teče SAMO na f2-1/f2-2 (f2-3 testi so na markec_f23_test
    // prek vitest.f23.config.ts); nikoli ne zajame f2-3, ki bi na f21 padla DB-check.
    expect(config).toContain('include: ["tests/integration/f2-1/**/*.itest.ts"')
    expect(config).toContain('tests/integration/f2-2/**/*.itest.ts"]')
  })

  it("seed zavrne vsako bazo, ki ni markec_f21_test / markec_e2e_test", () => {
    expect(seed).toContain("REFUSED")
    // Guard mora ostati fail-closed in vezan na imenski prostor testnih baz.
    expect(seed).toContain("(markec_e2e_test|markec_f21_test)(\\?|$)")
  })

  it("integracijski test preveri ime baze pred izvajanjem", () => {
    expect(suite).toContain("select current_database() as db")
    expect(suite).toContain('["markec_f21_test", "markec_e2e_test"]')
  })
})
