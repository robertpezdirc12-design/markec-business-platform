// F5.5.1.1 — verifikacija migracije na markec_f5511_mig (po migration.sql).
import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()
  const cols = await p.$queryRawUnsafe<{ column_name: string }[]>(
    `select column_name from information_schema.columns where table_name='OrderItem' and column_name in ('variantId','variantName','variantSku','variantPrice') order by column_name`
  )
  console.log("STOLPCI:", cols.map((c) => c.column_name).join(", ") || "NONE")

  const idx = await p.$queryRawUnsafe<{ indexname: string }[]>(
    `select indexname from pg_indexes where tablename='OrderItem' and indexname like '%variantId%'`
  )
  console.log("INDEKS:", idx.map((i) => i.indexname).join(", ") || "NONE")

  const fk = await p.$queryRawUnsafe<{ "ON DELETE": string; "ON UPDATE": string }[]>(
    `select rc.delete_rule as "ON DELETE", rc.update_rule as "ON UPDATE"
     from information_schema.referential_constraints rc
     join information_schema.key_column_usage kcu
       on rc.constraint_name = kcu.constraint_name
     where rc.constraint_name = 'OrderItem_variantId_fkey'`
  )
  console.log("FK:", fk.length ? `deleteRule=${fk[0]["ON DELETE"]} updateRule=${fk[0]["ON UPDATE"]}` : "NONE")

  const item = await p.orderItem.findUnique({ where: { id: "mig-check-item" } })
  console.log(
    "ORDERITEM ohranjen:",
    item ? `quantity=${item.quantity} price=${item.price.toNumber()} variantId=${item.variantId}` : "MANJKA"
  )

  const mig = await p.$queryRawUnsafe<{ name: string }[]>(`select name from "_prisma_migrations"`).catch(() => [])
  console.log("(_prisma_migrations vrste:", mig.length, ")")

  await p.$disconnect()
}
void main()