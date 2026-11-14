// ============================================================
// F2.3.1 — MIGRATION DDL VERIFICATION on the dedicated test DB
// (markec_f23_test). Read the header of f231-migrate-verify notes:
// this PROVES the actual migration SQL transforms the OLD one-to-one
// Staff schema into the multi-org composite unique without data loss.
//
// Uses Prisma (already a dependency) and the isolated markec_f23_test
// DB. Recreates only the Staff-related objects.
// ============================================================
import { PrismaClient } from "@prisma/client"

const url = process.env.DATABASE_URL || ""
if (!/markec_f23_test(\?|$)/.test(url)) {
  console.error("REFUSED: DATABASE_URL must target markec_f23_test")
  process.exit(1)
}
const prisma = new PrismaClient()
const run = async (sql) => prisma.$executeRawUnsafe(sql)
const rows = async (sql) => prisma.$queryRawUnsafe(sql)

console.log("target:", JSON.stringify(await rows("select current_database() as db")))

// 1) Reset Staff-related tables (children first) for the f23 test DB.
console.log("\n→ resetting staff tables")
await run(`DROP TABLE IF EXISTS "StaffService" CASCADE`)
await run(`DROP TABLE IF EXISTS "WorkingHours" CASCADE`)
await run(`DROP TABLE IF EXISTS "Staff" CASCADE`)

// 2) Build the OLD Staff schema (pre-F2.3.1: userId @unique, org nullable).
//    Replicates EXACTLY what the real Prisma migration chain produces
//    (see 20251129050000_p100_f1_full_schema_sync): "Staff_userId_key" is a
//    standalone UNIQUE INDEX (NOT a column constraint) + a separate FK.
//    This matters: a column-level UNIQUE would make `DROP INDEX` fail (2BP01),
//    but Prisma emits a standalone index, so the migration's DROP INDEX is valid.
console.log("→ building OLD Staff schema (standalone unique index, as Prisma emits)")
await run(`
  CREATE TABLE "Staff" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bio TEXT,
    image TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultTipPercent" DECIMAL,
    "commissionType" TEXT NOT NULL DEFAULT 'NONE',
    "commissionValue" DECIMAL,
    "commissionBasis" TEXT NOT NULL DEFAULT 'service',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  )`)
await run(`CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId")`)
await run(`CREATE INDEX "Staff_userId_idx" ON "Staff"("userId")`)

// 3) Representative data — staff already carrying their org (the backed-up state
// proven by f231-backfill-check.mjs on markec_dev: all rows already scoped).
console.log("→ inserting representative staff (all with an org, no dupes)")
await run(`
  INSERT INTO "Staff" (id, name, "userId", "organizationId") VALUES
    ('staff-a1', 'Ana A', 'user-1', 'org-a'),
    ('staff-a2', 'Boštjan A', 'user-2', 'org-a'),
    ('staff-a3', 'Cvetka A', 'user-3', 'org-a'),
    ('staff-b1', 'Davor B', 'user-4', 'org-b')`)

// 4) Apply the ACTUAL migration DDL (copied verbatim from migration.sql).
console.log("→ applying F2.3.1 migration.sql")
await run(`DROP INDEX IF EXISTS "Staff_userId_key"`)
await run(`CREATE INDEX IF NOT EXISTS "Staff_userId_idx" ON "Staff"("userId")`)
await run(`CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_organizationId_key" ON "Staff"("userId", "organizationId")`)

// 5) Verify indexes + data + no dupes.
const idx = await rows(`SELECT indexname FROM pg_indexes WHERE tablename='Staff' ORDER BY indexname`)
const staff = await rows(`SELECT id, "userId", "organizationId" FROM "Staff" ORDER BY id`)
const dupes = await rows(`SELECT "userId","organizationId",count(*)::int AS n FROM "Staff" GROUP BY 1,2 HAVING count(*)>1`)
console.log("\n→ indexes:", idx.map((r) => r.indexname).join(", "))
console.log("→ staff rows (must be 4 intact):")
console.log(staff)
console.log("→ duplicates (MUST be 0):", JSON.stringify(dupes))

// 6) Prove multi-org: same user becomes staff in a SECOND org.
console.log("\n→ same user (user-1) as staff in org-b (multi-org, ENABLED by migration):")
await run(`INSERT INTO "Staff" (id, name, "userId", "organizationId") VALUES ('staff-a1-b', 'Ana A (B)', 'user-1', 'org-b')`)
console.log(await rows(`SELECT id, "userId", "organizationId" FROM "Staff" ORDER BY "userId", "organizationId"`))
const dupes2 = await rows(`SELECT "userId","organizationId",count(*)::int AS n FROM "Staff" GROUP BY 1,2 HAVING count(*)>1`)
console.log("→ duplicates after multi-org insert (MUST be 0):", JSON.stringify(dupes2))

// 7) Prove duplicate (user, org) is still rejected.
console.log("\n→ duplicate (user-1, org-a) — must FAIL:")
try {
  await run(`INSERT INTO "Staff" (id, name, "userId", "organizationId") VALUES ('dup', 'Dup', 'user-1', 'org-a')`)
  console.log("UNEXPECTED: duplicate accepted!")
} catch (e) {
  console.log("correctly rejected:", e.message.split("\n")[0])
}

await prisma.$disconnect()
console.log("\nMigration verification COMPLETE.")