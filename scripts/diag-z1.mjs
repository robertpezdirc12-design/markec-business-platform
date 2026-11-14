import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const orgId = "cmwe1372y0000wgqocviz9834"
const rows = await p.extensionRecord.groupBy({
  by: ["entityKey"],
  where: { organizationId: orgId, extensionId: "bee-apiary" },
  _count: { _all: true },
})
console.log("groupBy result:", JSON.stringify(rows))
const all = await p.extensionRecord.count({ where: { organizationId: orgId } })
console.log("total ext records for org:", all)
await p.$disconnect()