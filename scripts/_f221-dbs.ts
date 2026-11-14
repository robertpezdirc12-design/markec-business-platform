import { PrismaClient } from "@prisma/client"

async function check(db: string) {
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/${db}?schema=public`
  const p = new PrismaClient()
  const rows = await p.$queryRawUnsafe<{ name: string }[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  )
  console.log(db, "->", rows.map((r) => r.name).slice(0, 15).join(", "))
  await p.$disconnect()
}
(async () => {
  await check("beauty_salon")
  await check("rcbeautysalon")
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})