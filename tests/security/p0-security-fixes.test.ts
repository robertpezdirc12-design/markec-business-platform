// ============================================================
// P0 (audit 2026-11) — regresijski varovali za varnostne popravke.
//
// Večina varoval je vir-nivojskih (read + expect), enako kot drugi
// security testi v repozitoriju: preverjajo, da se ključni vzorci ne
// izgubijo tiho ob prihodnjih refaktorjih. Vedenjske preverbe z bazo
// so v tests/integration/p0-*.itest.ts.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P0-1 (S1): upravljanje članov — omejen ADMIN ne sme eskaliirati", () => {
  const src = read("src/app/actions/workspace-management.ts")

  it("updateMemberRole zahteva staff.manage (dovoljenje, ne le vlogo)", () => {
    expect(src).toContain(
      'userHasPermission(session.user.id, "staff.manage", input.organizationId)'
    )
  })

  it("povišanje v ADMIN samo z vsemi pravicami (hasAllPermissions)", () => {
    expect(src).toContain("hasAllPermissions(perms)")
  })

  it("validacija vloge in blok lastne vloge", () => {
    expect(src).toContain('input.role !== "ADMIN" && input.role !== "STAFF"')
    expect(src).toContain("input.userId === session.user.id")
  })

  it("removeMember prav tako zahteva staff.manage in neoomejenega ADMIN za odstranitev ADMIN", () => {
    const removeBlock = src.slice(src.indexOf("export async function removeMember"))
    expect(removeBlock).toContain(
      'userHasPermission(session.user.id, "staff.manage", input.organizationId)'
    )
    expect(removeBlock).toContain("hasAllPermissions(perms)")
  })
})

describe("P0-2 (S2): deleteUser — brez kaskadnega brisanja v drugih org", () => {
  const src = read("src/app/actions/users.ts")

  it("pred prisma.user.delete preveri tuje vezi (member/staff/review)", () => {
    // Zadnja pojavitev = dejanski klic (prejšnje so v komentarjih).
    const idx = src.lastIndexOf("await prisma.user.delete")
    expect(idx).toBeGreaterThan(-1)
    const before = src.slice(0, idx)
    expect(before).toContain("organizationId: { not: org.id }")
    expect(before).toContain("foreignTies")
  })
})

describe("P0-3 (S3): webhook — avtoritativna preverba plačila", () => {
  const src = read("src/app/api/webhooks/stripe/route.ts")

  it("payload ni dokaz plačila — retrieve seje + znesek", () => {
    expect(src).toContain("verifyPaidSessionMatches(")
    expect(src).toContain("checkout.sessions.retrieve")
    expect(src).toContain("amount-mismatch")
  })

  it("uporabljeno na poti naročil in terminov (400 → ponovitev)", () => {
    expect(src).toContain("paid-session verification failed (order")
    expect(src).toContain("existing-appointment paid-session verification failed")
    expect(src).toContain("{ status: 400 }")
  })
})

describe("P0-4 (S4): NO_SHOW samo ročno — brez samodejne bremenitve", () => {
  it("cron job ne vsebuje več chargeNoShowFee / samodejne pretvorbe", () => {
    const job = read("src/lib/jobs/expire-stale-pending.ts")
    expect(job).not.toContain("chargeNoShowFee")
    expect(job).not.toContain('noShowSetupStatus: "SAVED"')
    expect(job).toContain("P0 (S4")
  })

  it("dashboard GET ne pretvarja več CONFIRMED → NO_SHOW", () => {
    const appt = read("src/app/actions/appointments.ts")
    expect(appt).not.toContain(
      "// 2. Handle CONFIRMED (paid) appointments - mark as NO_SHOW"
    )
    expect(appt).toContain("P0 (S4")
  })
})

describe("P0-5 (M1): requireOwner — vloga OWNER ne obstaja", () => {
  for (const f of ["sms.ts", "minimax.ts", "webhooks.ts"]) {
    it(`${f}: ni več mrtev check role === OWNER`, () => {
      const src = read(`src/app/actions/${f}`)
      // Komentarje odstranimo — ti lahko omenjajo star vzorec.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      expect(code).not.toContain('role !== "OWNER"')
      expect(code).toContain('requirePermissionOrg("settings.manage")')
    })
  }
})
