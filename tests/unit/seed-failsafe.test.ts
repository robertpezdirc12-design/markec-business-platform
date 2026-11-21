import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// Seed fail-safe (#110): prisma/seed.ts ne sme na produkciji
// znova vstaviti šibkih javnih gesel, če SEED_*_PASSWORD niso
// eksplicitno nastavljeni v env.
// ============================================================

const read = (p: string) =>
  readFileSync(join(__dirname, "..", "..", p), "utf8").replace(/\r\n/g, "\n")

describe("prisma/seed.ts fail-safe (#110)", () => {
  const seed = () => read("prisma/seed.ts")

  it("na produkcijskih okoljih prekine, ko manjkajo gesla (SEED_FAILSAFE)", () => {
    const s = seed()
    // detekcija produkcije
    expect(s).toContain("process.env.NODE_ENV === 'production' || process.env.VERCEL")
    // branje treh gesel iz env + preverba manjkajočih
    expect(s).toContain("'SEED_ADMIN_PASSWORD'")
    expect(s).toContain("'SEED_STAFF_PASSWORD'")
    expect(s).toContain("'SEED_CLIENTE_PASSWORD'")
    expect(s).toContain(".filter(([, v]) => !v)")
    // throw pred kakršnim koli DB zapisom
    expect(s).toContain("SEED_FAILSAFE")
    expect(s).toContain("throw new Error(")
    // guard je pred prvim upsert (demo org), torej pred DB prepreka
    const guardPos = s.indexOf("prodLike")
    const firstOrg = s.indexOf("prisma.organization.upsert")
    expect(guardPos).toBeGreaterThan(-1)
    expect(firstOrg).toBeGreaterThan(guardPos)
  })

  it("javna defaults (admin123/staff123/cliente123) ostanejo samo za lokalni razvoj", () => {
    const s = seed()
    expect(s).toContain("?? 'admin123'")
    expect(s).toContain("?? 'staff123'")
    expect(s).toContain("?? 'cliente123'")
  })
})