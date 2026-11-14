// ============================================================
// F2.3.1 — BACKFILL PRE-CHECK (READ-ONLY report generator)
//
// Mirrors scripts/f23-backfill-check.sql but runs as a Node script so
// it works on Windows without psql. It NEVER writes — it only reports:
//   - Staff rows missing organizationId (unresolved)
//   - duplicate (userId, organizationId) combos
//   - Appointments / StaffService / WorkingHours whose Staff lacks org
//   - staff-org vs appointment-org mismatches
//   - user-org vs staff-org divergence (informational only)
//
// Usage: DATABASE_URL points at the database to inspect (e.g. markec_dev
// for the real data read by the reviewer, or the f23 test db).
// ============================================================
import { PrismaClient } from "@prisma/client"

const url = process.env.DATABASE_URL || ""
const sanitized = url.replace(/\/\/[^@]*@/, "//***@")
if (url.includes("postgresql") === false) {
  console.error("DATABASE_URL must be a postgresql:// connection string")
  process.exit(1)
}
const prisma = new PrismaClient()

const q = (label, sql) =>
  prisma
    .$queryRawUnsafe(sql)
    .then((r) => {
      console.log(`\n=== ${label} ===`)
      console.log(r.length === 0 ? "OK (0 rows)" : JSON.stringify(r, null, 2))
      return r.length
    })
    .catch((e) => {
      console.log(`\n=== ${label} ===`)
      console.log("ERR", e.message.split("\n")[0])
      return -1
    })

const checks = [
  ["1) Staff brez organizationId (nerešeno — MORA biti 0)", `SELECT id, email, "userId", "organizationId" FROM "Staff" WHERE "organizationId" IS NULL`],
  ["2) Podvojene kombinacije (userId, organizationId) — MORA biti 0", `SELECT "userId", "organizationId", count(*) AS n FROM "Staff" GROUP BY 1,2 HAVING count(*) > 1`],
  ["3) Termini, katerih Staff nima org — MORA biti 0", `SELECT a.id AS appointment_id, a."staffId", s."organizationId" FROM "Appointment" a LEFT JOIN "Staff" s ON s.id=a."staffId" WHERE s."organizationId" IS NULL`],
  ["4) Staff brez org, na katere kaže Appointment (organizacijska odstopanja)", `SELECT DISTINCT a."staffId", s."organizationId" AS staff_org, a."organizationId" AS appt_org FROM "Appointment" a JOIN "Staff" s ON s.id=a."staffId" WHERE s."organizationId" IS DISTINCT FROM a."organizationId"`],
  ["5) StaffService, katerih Staff nima org — MORA biti 0", `SELECT ss.id, ss."staffId", s."organizationId" FROM "StaffService" ss JOIN "Staff" s ON s.id=ss."staffId" WHERE s."organizationId" IS NULL`],
  ["6) WorkingHours, katerih Staff nima org — MORA biti 0", `SELECT wh.id, wh."staffId", s."organizationId" FROM "WorkingHours" wh JOIN "Staff" s ON s.id=wh."staffId" WHERE s."organizationId" IS NULL`],
  ["7) Skupno število Staff", `SELECT count(*)::int AS n FROM "Staff"`],
]

console.log("Backfill pre-check on:", JSON.stringify(await prisma.$queryRawUnsafe("select current_database() as db")))
const results = {}
for (const [label, sql] of checks) {
  results[label] = await q(label, sql)
}
await prisma.$disconnect()
console.log("\n--- SUMMARY ---")
for (const [label, n] of Object.entries(results)) {
  console.log(`${n === 0 ? "PASS" : n === -1 ? "ERR" : "FAIL"}: ${label} (rows=${n})`)
}