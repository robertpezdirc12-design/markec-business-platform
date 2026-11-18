// ============================================================
// P0 (audit 2026-11) — VEZAVA NAJEMNIKA NA STRIPE WEBHOOK + IDEMPOTENCA
//
// Regresijski varoval za najdbo, kjer je webhook najemnika bral iz
// `session.metadata.orgId` (podatek pošiljatelja) namesto iz podpisa.
// Posledica: najemnik, ki pozna SVOJO whsec_, lahko podpiše poljuben payload
// in poseže v tuje podatke.
//
// Testira čisto logiko (brez DB) + strukturo pisalnih poti na vir-nivoju
// (repo vzorec: `read(...)` + expect), da se org-scoping ne izgubi tiho.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  checkTenantBinding,
  extractClaimedOrgId,
} from "../../src/lib/stripe/webhook-tenant"

const read = (p: string) =>
  readFileSync(__dirname + "/../../" + p, "utf8").replace(/\r\n/g, "\n")

describe("checkTenantBinding — podpis je vir resnice o najemniku", () => {
  it("brez trditve (stare seje) → dostava je dovoljena", () => {
    expect(checkTenantBinding(null, "orgA")).toEqual({ ok: true, claimed: null })
  })

  it("trditev se ujema s podpisom → dovoljeno", () => {
    expect(checkTenantBinding("orgA", "orgA")).toEqual({
      ok: true,
      claimed: "orgA",
    })
  })

  it("trditev druge organizacije → ZAVRNJENO (poskus preskoka najemnika)", () => {
    const result = checkTenantBinding("orgZrtve", "orgNapadalca")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("org_mismatch")
      expect(result.claimed).toBe("orgZrtve")
    }
  })

  it("prazen niz se ne šteje kot trditev (ne blokira legalnih dostav)", () => {
    expect(checkTenantBinding("", "orgA").ok).toBe(true)
  })
})

describe("extractClaimedOrgId — branje metadata.orgId iz objekta dogodka", () => {
  it("prebere orgId iz metadata", () => {
    expect(extractClaimedOrgId({ metadata: { orgId: "orgA" } })).toBe("orgA")
  })

  it("vrne null brez metadata / z nepravilnim tipom", () => {
    expect(extractClaimedOrgId(null)).toBeNull()
    expect(extractClaimedOrgId(undefined)).toBeNull()
    expect(extractClaimedOrgId({})).toBeNull()
    expect(extractClaimedOrgId({ metadata: null })).toBeNull()
    expect(extractClaimedOrgId({ metadata: { orgId: 42 } })).toBeNull()
    expect(extractClaimedOrgId({ metadata: { orgId: "" } })).toBeNull()
  })

  it("ne vrže, kadar metadata ni objekt (okvarjen payload)", () => {
    expect(extractClaimedOrgId({ metadata: "orgA" })).toBeNull()
    expect(extractClaimedOrgId("orgA")).toBeNull()
  })
})

describe("route.ts — struktura popravka (vir-nivoj)", () => {
  const source = read("src/app/api/webhooks/stripe/route.ts")
  // Komentarji opisujejo PREJŠNJO (napacno) kodo — strukturne trditve
  // preverjamo samo na izvorni kodi, sicer bi komentar "getOrgById(metadata
  // .orgId)" zadal lažno napako.
  const route = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

  it("verifikacija vrne organizacijo, ki je podpisala dostavo", () => {
    expect(route).toContain("type VerifiedStripeEvent = {")
    expect(route).toContain("return { event, org: { id: org.id, slug: org.slug } }")
    expect(route).toContain("let signedOrg")
  })

  it("najemnik se NE določa več iz metadata.orgId", () => {
    // Prepovedan vzorec iz najdbe: getOrgById(metadata.orgId)
    expect(route).not.toContain("getOrgById(metadata.orgId)")
    // Najemnik pride iz podpisa
    expect(route).toContain("const org = await getOrgById(signedOrg.id)")
  })

  it("idempotenca po event.id je prisotna (claim + processed/failed)", () => {
    expect(route).toContain("claimTenantEvent(event, signedOrg.id)")
    expect(route).toContain("markTenantEventProcessed(event.id)")
    expect(route).toContain("markTenantEventFailed(")
  })

  it("pregled naročil in terminov je org-scoped", () => {
    // Nobeno iskanje po ID-ju brez organizationId (najdba L94, L271, L384)
    expect(route).not.toMatch(/where: \{ id: orderId \}/)
    expect(route).not.toMatch(/where: \{ id: metadata\.orderId \}/)
    expect(route).not.toMatch(/where: \{ id: metadata\.appointmentId \}/)
    expect(route).toContain("where: { id: orderId, organizationId: signedOrg.id }")
    expect(route).toContain(
      "where: { id: metadata.orderId, organizationId: signedOrg.id }"
    )
    expect(route).toContain(
      "where: { id: metadata.appointmentId, organizationId: org.id }"
    )
  })
})

describe("schema — idempotenca najemniškega webhooka", () => {
  const schema = read("prisma/schema.prisma")

  it("model TenantStripeEvent ima unikaten stripeEventId", () => {
    // Meta-guard (tests/golden-batch-70-73): razrez po markerju z literalnim
    // "\\n" ni dovoljen (krhko), zato model izluščimo z regexom.
    const body =
      schema.match(/model TenantStripeEvent \{[\s\S]*?\n\}/)?.[0] ?? ""
    expect(body).not.toBe("")
    expect(body).toContain("stripeEventId  String   @unique")
    expect(body).toContain("organizationId String")
    expect(body).toContain("outcome")
  })
})
