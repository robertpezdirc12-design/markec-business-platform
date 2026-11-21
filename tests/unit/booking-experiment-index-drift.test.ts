import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// ============================================================
// #129 (P0): Odprava Prisma migration drift BookingExperimentEvent
// indeksa. Ime indeksa je bilo >63 bytes (Prisma limit) — nova
// migracija ga nedestruktivno preimenuje, model ima map.
// ============================================================

const ROOT = join(__dirname, "..", "..")
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n")

const PREDELUKA = "BookingExperimentEvent_organizationId_variant_kind_createdAt_idx"
const KRATKO = "BookingExperimentEvent_variant_kind_date_idx"

describe("#129 — BookingExperimentEvent index drift", () => {
  it("NOVA migracija dropa dolgo ime in create kratko (≤63)", () => {
    const m = read("prisma/migrations/20261202000000_fix_booking_experiment_index_name/migration.sql")
    expect(m).toContain(`DROP INDEX "${PREDELUKA}"`)
    expect(m).toContain(`CREATE INDEX "${KRATKO}"`)
  })

  it("model map podpisuje točno ti dve imeni indeksov", () => {
    const s = read("prisma/schema.prisma")
    expect(s).toContain(`map: "${KRATKO}"`)
  })

  it("vsa map imena indeksov so ≤63 bytes (Prisma/Postgres limit)", () => {
    const s = read("prisma/schema.prisma")
    const maps = [...s.matchAll(/map: "([^"]+)"\)/g)].map((x) => x[1])
    expect(maps.length).toBeGreaterThanOrEqual(2)
    for (const name of maps) {
      expect(Buffer.byteLength(name, "utf8")).toBeLessThanOrEqual(63)
    }
  })
})