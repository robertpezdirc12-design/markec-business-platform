// ============================================================
// P4 (audit 2026-11) — per-uporabniška kvota nalaganj (M17).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("P4 (M17): per-uporabniška kvota nalaganj", () => {
  it("rate-limit ima scope upload:user", () => {
    const src = read("src/lib/rate-limit.ts")
    expect(src).toContain('"upload:user"')
  })

  it("/api/upload uporablja kvoto (429)", () => {
    const src = read("src/app/api/upload/route.ts")
    expect(src).toContain('scope: "upload:user"')
    expect(src).toContain("status: 429")
  })

  it("/api/upload/r2 uporablja kvoto (429)", () => {
    const src = read("src/app/api/upload/r2/route.ts")
    expect(src).toContain('scope: "upload:user"')
    expect(src).toContain("status: 429")
  })
})
