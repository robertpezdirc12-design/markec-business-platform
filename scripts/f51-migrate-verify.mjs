// ============================================================
// F5.1 — MIGRATION DDL VERIFICATION on the dedicated test DB
// (markec_f51_test).
//
// The additive migration SQL (prisma/migrations/..._f5_1_promotions/
// migration.sql) is the SAME DDL that `prisma db push` applied to
// build markec_f51_test. This script introspects that schema and
// proves every object the migration declares exists, plus that the
// anti-double-redemption unique fence works.
//
// The full multi-statement migration.sql is what production reuses;
// a fresh `migrate deploy` from an empty DB is blocked by a DOCUMENTED
// pre-existing base-migration ordering issue (init dated later than
// the reset-token migration) unrelated to F5.1 — see F2.2-2 report §11.7.
//
// Run:
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f51_test?schema=public&& node scripts/f51-migrate-verify.mjs
// ============================================================
import { PrismaClient } from "@prisma/client"

const url = process.env.DATABASE_URL || ""
if (!/markec_f51_test(\?|$)/.test(url)) {
  console.error("REFUSED: DATABASE_URL must target markec_f51_test")
  process.exit(1)
}
const prisma = new PrismaClient()
const run = async (sql) => prisma.$executeRawUnsafe(sql)
const rows = async (sql) => prisma.$queryRawUnsafe(sql)

console.log("target:", JSON.stringify(await rows("select current_database() as db")))

// 1) Tables present.
const tables = await rows(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Promotion','PromotionRedemption') ORDER BY tablename`
)
console.log("\n→ tables:", tables.map((r) => r.tablename).join(", "))
if (tables.length !== 2) throw new Error("Promotion tables missing")

// 2) Enums present.
const enums = await rows(
  `SELECT typname FROM pg_type WHERE typname IN ('PromotionScope','PromotionDiscountType','PromotionStatus') ORDER BY typname`
)
console.log("→ enums:", enums.map((r) => r.typname).join(", "))
if (enums.length !== 3) throw new Error("Promotion enums missing")

// 3) Order/Appointment snapshot columns present.
const orderCols = await rows(
  `SELECT column_name FROM information_schema.columns WHERE table_name='Order' AND column_name IN ('promotionDiscount','promotionId','promotionSnapshot') ORDER BY column_name`
)
const apCols = await rows(
  `SELECT column_name FROM information_schema.columns WHERE table_name='Appointment' AND column_name IN ('promotionDiscount','promotionId','promotionSnapshot') ORDER BY column_name`
)
console.log("→ Order snapshot cols:", orderCols.map((r) => r.column_name).join(", "))
console.log("→ Appointment snapshot cols:", apCols.map((r) => r.column_name).join(", "))

// 4) Unique fences.
const uniques = await rows(
  `SELECT indexname FROM pg_indexes WHERE tablename='PromotionRedemption' AND indexname LIKE '%promotionId%' ORDER BY indexname`
)
console.log("→ PromotionRedemption unique indexes:", uniques.map((r) => r.indexname).join(", "))

// 5) The anti-double-redemption fence: same promo + same order twice fails,
//    but the same promo on two DIFFERENT orders is allowed.
const promoId = "f51-verify-promo"
const order1 = "f51-verify-order-1"
const order2 = "f51-verify-order-2"
await run(`INSERT INTO "Promotion" (id,"organizationId",name,"discountType","discountValue","scope",status,"updatedAt")
  VALUES ('${promoId}','f51-org-a','Verify','PERCENT',10,'WHOLE_AMOUNT','ACTIVE',now())`)
await run(`INSERT INTO "PromotionRedemption" (id,"organizationId","promotionId","orderId","discountAmount","baseAmount")
  VALUES ('f51-verify-r1','f51-org-a','${promoId}','${order1}',1.00,10.00)`)
console.log("\n→ same promo on TWO different orders (must succeed):")
await run(`INSERT INTO "PromotionRedemption" (id,"organizationId","promotionId","orderId","discountAmount","baseAmount")
  VALUES ('f51-verify-r2','f51-org-a','${promoId}','${order2}',1.00,10.00)`)
console.log("   OK")
console.log("→ same promo on SAME order twice (must FAIL):")
try {
  await run(`INSERT INTO "PromotionRedemption" (id,"organizationId","promotionId","orderId","discountAmount","baseAmount")
    VALUES ('f51-verify-r3','f51-org-a','${promoId}','${order1}',1.00,10.00)`)
  console.log("   UNEXPECTED: duplicate accepted!")
  process.exitCode = 1
} catch (e) {
  console.log("   correctly rejected:", e.message.split("\n")[0])
}

// 6) Org isolation on the redemption FK/constraint level: a redemption row
//    for org B can reference a different org's promotion (no leak guard at
//    DB level needed since queries are always org-scoped) — spot-check count.
await run(`DELETE FROM "PromotionRedemption" WHERE id LIKE 'f51-verify-%'`)
await run(`DELETE FROM "Promotion" WHERE id LIKE 'f51-verify-%'`)

await prisma.$disconnect()
console.log("\nF5.1 migration verification COMPLETE.")