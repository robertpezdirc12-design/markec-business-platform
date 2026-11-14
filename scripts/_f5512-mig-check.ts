// F5.5.1.2 — verifikacija reservedQuantity migracije na markec_f5511_mig.
import { PrismaClient } from "@prisma/client"
async function main() {
  const p = new PrismaClient()
  const c = await p.$queryRawUnsafe<{ table_name: string; column_name: string; default: string }[]>(
    `select table_name, column_name, column_default from information_schema.columns
     where (table_name='Product' or table_name='ProductVariant') and column_name='reservedQuantity'`
  )
  for (const x of c) console.log(`STOLPEC: ${x.table_name}.${x.column_name} default=${x.default}`)
  const item = await p.orderItem.findUnique({ where: { id: "mig-check-item" } })
  console.log("ORDERITEM ohranjen:", item ? `qty=${item.quantity} price=${item.price.toNumber()}` : "MANJKA")
  await p.$disconnect()
}
void main()