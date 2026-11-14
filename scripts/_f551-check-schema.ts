import { PrismaClient } from "@prisma/client"
async function main() {
  const p = new PrismaClient()
  const row = await p.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  console.log("DB:", row[0].db)
  const cols = await p.$queryRawUnsafe<{ column_name: string }[]>(
    `select column_name from information_schema.columns where table_name='OrderItem' and column_name in ('variantId','variantName','variantSku','variantPrice') order by column_name`
  )
  console.log("OrderItem variant cols:", cols.map((c) => c.column_name).join(", ") || "NONE")
  const idx = await p.$queryRawUnsafe<{ indexname: string }[]>(
    `select indexname from pg_indexes where tablename='OrderItem' and indexname like '%variantId%'`
  )
  console.log("variant index:", idx.map((i) => i.indexname).join(", ") || "NONE")
  await p.$disconnect()
}
void main()