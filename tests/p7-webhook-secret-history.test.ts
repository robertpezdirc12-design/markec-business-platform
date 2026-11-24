// ============================================================
// P7 (audit 2026-11) — M20: webhook rotacija ključev (grace okno).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P7 (M20): zgodovina webhook skrivnosti", () => {
  it("shema vsebuje WebhookSecretHistory", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("model WebhookSecretHistory")
    expect(schema).toContain("encryptedSecret")
    expect(schema).toContain("@@index([organizationId, createdAt])")
  })

  it("saveStripeSettings arhivira prejšnjo skrivnost ob rotaciji", () => {
    const src = read("src/app/actions/payments.ts")
    expect(src).toContain("webhookSecretHistory.create")
    expect(src).toContain("decryptSecret(org.stripeWebhookSecret)")
  })

  it("verifyStripeEvent sprejema tudi arhivirane skrivnosti (7 dni)", () => {
    const src = read("src/app/api/webhooks/stripe/route.ts")
    expect(src).toContain("webhookSecretHistory.findMany")
    expect(src).toContain("7 * 24 * 60 * 60 * 1000")
    expect(src).toContain("historyByOrg")
  })
})
