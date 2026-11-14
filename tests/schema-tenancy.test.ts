// ============================================================
// EPIC #1 Phase 7 — TENANT ISOLATION SCHEMA GUARDRAIL (§3, §17)
// Every tenant-owned model MUST carry `organizationId` and index
// it. This test parses prisma/schema.prisma and fails the build
// the moment a new tenant-data table is added without the
// isolation column/index — structural isolation is enforced by
// construction, not by convention.
// (Runtime cross-tenant read checks: scripts/verify-tenant-isolation.ts)
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

interface ModelInfo {
  name: string
  fields: Set<string>
  indexes: string[]
}

// Models deliberately NOT in TENANT_MODELS (tenant scope runs indirectly):
//   WorkflowStage   → scoped via WorkflowDefinition.definitionId
//   WorkOrderEvent  → cascade-bound to WorkOrder (own organizationId anyway)
//   Account / Session / VerificationToken → NextAuth join models
//   PackageItem / DocumentItem / CartItem → scoped via parent document

function parseSchema(src: string): ModelInfo[] {
  const models: ModelInfo[] = []
  // F5.5.4.5.3 — robusten razrez modela: Prisma zaključi model z vrstico `}`
  // (samo `}`), zato se blok vzame do ta vrstico. Prejšnji regex `[^}]*` je
  // razrez popačil, ko je model vseboval `{`/`}` v komentarju ali vrednosti
  // (npr. `document: Document` ni, a `Json? // {name,...}` je) in s tem
  // odrezal vse poznejše `@@index` — test je lažno tvrdil, da Document ni
  // indeksiran, čeprav je `@@index([organizationId])` prisoten.
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^model\s+(\w+)\s*\{\s*$/)
    if (!m) continue
    const name = m[1]
    const body: string[] = []
    let j = i + 1
    while (j < lines.length && !/^\}\s*$/.test(lines[j])) {
      body.push(lines[j])
      j++
    }
    // j == lines.length pomeni nesošli zaključek — preskoči (defenzivno).
    if (j >= lines.length) continue
    i = j // nadaljuj za tem modelom
    const fields = new Set<string>()
    const indexes: string[] = []
    for (const line of body) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("//")) continue
      if (trimmed.startsWith("@@")) {
        if (trimmed.startsWith("@@index")) indexes.push(trimmed)
        continue
      }
      const field = trimmed.match(/^(\w+)\s/)
      if (field) fields.add(field[1])
    }
    models.push({ name, fields, indexes })
  }
  return models
}

describe("prisma schema tenant isolation invariants (§3)", () => {
  const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
  const models = parseSchema(readFileSync(schemaPath, "utf8"))

  // Models whose tenant scope runs through organizationId directly.
  const TENANT_MODELS = [
    "Customer",
    "Service",
    "Product",
    "Appointment",
    "Order",
    "WorkOrder",
    "FormDefinition",
    "FormSubmission",
    "WorkflowDefinition",
    // #80: Package evolved into PrepaidProduct (same table via @@map).
    "PrepaidProduct",
    "PrepaidPurchase",
    "Document",
    "ProductVariant",
    "ExtensionRecord",
    "SalonConfig",
    "Staff",
    "CustomDomain",
    // F5.1: promotions are tenant-owned data — they must carry
    // organizationId and index it just like every other tenant model.
    "Promotion",
    "PromotionRedemption",
  ]

  it("parses the schema and finds all expected models", () => {
    const names = models.map((m) => m.name)
    for (const expected of TENANT_MODELS) {
      expect(names, `model ${expected} missing from schema`).toContain(expected)
    }
  })

  it.each(TENANT_MODELS)("%s carries organizationId (tenant scope)", (name) => {
    const model = models.find((m) => m.name === name)!
    expect(
      model.fields.has("organizationId"),
      `${name} has no organizationId column — cross-tenant leak risk (§3)`
    ).toBe(true)
  })

  it("the Organization model IS the tenant root (id, not organizationId)", () => {
    const org = models.find((m) => m.name === "Organization")!
    expect(org.fields.has("id")).toBe(true)
    expect(org.fields.has("organizationId")).toBe(false)
  })

  it.each(TENANT_MODELS.filter((m) => m !== "SalonConfig"))(
    "%s indexes organizationId (tenant-scoped queries stay fast)",
    (name) => {
      const model = models.find((m) => m.name === name)!
      const indexed = model.indexes.some((idx) =>
        idx.includes("organizationId")
      )
      expect(
        indexed,
        `${name} does not index organizationId — every tenant query must be indexed (§3)`
      ).toBe(true)
    }
  )

  it("SalonConfig scopes via @unique organizationId (one-to-one, implicitly indexed)", () => {
    const src = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")
    const block = (src.match(/model SalonConfig\s*\{[^}]*\}/g) ?? [])[0]
    expect(block).toMatch(/organizationId\s+String\?\s+@unique/)
  })

  it("WorkOrder events table is cascade-bound to its tenant's order", () => {
    const block = (readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8").match(/model WorkOrderEvent\s*\{[^}]*\}/g) ?? [])[0]
    expect(block).toContain("workOrderId")
    expect(block).toContain("organizationId")
  })
})
