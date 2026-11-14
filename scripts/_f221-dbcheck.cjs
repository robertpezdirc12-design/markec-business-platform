// F2.2.1 TEMP — check target DB (name, tables, seed rows). Delete after run.
// Usage: node scripts/_f221-dbcheck.cjs [list]
//   (no arg): probe DATABASE_URL (current DB, tables, org/user/invitation rows)
//   "list":   list all databases on the server
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()

;(async () => {
  if (process.argv[2] === "list") {
    const rows = await p.$queryRawUnsafe(
      "select datname from pg_database where datistemplate=false order by datname"
    )
    console.log(JSON.stringify(rows))
    return
  }
  const db = await p.$queryRawUnsafe("select current_database() as db")
  const tables = await p.$queryRawUnsafe(
    "select count(*)::int as n from information_schema.tables where table_schema='public'"
  )
  let orgs = null
  let f21users = null
  let invs = null
  try {
    orgs = await p.$queryRawUnsafe('select count(*)::int as n from "Organization"')
    f21users = await p.$queryRawUnsafe(
      "select count(*)::int as n from \"User\" where email like '%@f21.test'"
    )
    invs = await p.$queryRawUnsafe(
      "select count(*)::int as n, count(*) filter (where token !~ '^[a-f0-9]{64}$')::int as plaintext from \"OrganizationInvitation\""
    )
  } catch (e) {
    console.log("schema probe (expected if empty DB):", e.message.slice(0, 140))
  }
  console.log(
    JSON.stringify({ db, tables, orgs, f21users, invs }, null, 1)
  )
  await p.$disconnect()
})().catch((e) => {
  console.error("ERR:", e.message)
  process.exit(1)
})
