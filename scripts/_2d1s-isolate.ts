import { PrismaClient } from "@prisma/client"
// 2D-1S isolacija: preveri, da sta čebelar in vulkanizer LOČENA user+org.
const p = new PrismaClient()
async function main() {
  const users = await p.user.findMany({ where: { email: { in: ["cebeler.fresh@markec.test", "cebeler.tire@markec.test"] } }, select: { id: true, email: true, organizationId: true, role: true } })
  console.log("USERS", JSON.stringify(users))

  const memberships = await p.organizationMember.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, organizationId: true, role: true, isDefault: true } })
  console.log("MEMBERSHIPS", JSON.stringify(memberships))

  const orgs = await p.organization.findMany({ where: { slug: { in: ["svezi-cebeler-2d1l", "svezi-vulkanizer-2d1s"] } }, select: { id: true, slug: true, name: true, vertical: true, publishState: true } })
  console.log("ORGS", JSON.stringify(orgs))

  // Števec podatkov po org (čebela vs vulkanizer).
  for (const o of orgs) {
    const products = await p.product.count({ where: { organizationId: o.id } })
    const orders = await p.order.count({ where: { organizationId: o.id } })
    const vehicles = await p.extensionRecord.count({ where: { organizationId: o.id, entityKey: "vehicle" } })
    const tires = await p.extensionRecord.count({ where: { organizationId: o.id, entityKey: "tire_set" } })
    const harvests = await p.extensionRecord.count({ where: { organizationId: o.id, entityKey: "harvest" } })
    const workOrders = await p.workOrder.count({ where: { organizationId: o.id } })
    console.log(`ORG ${o.slug}: products=${products} orders=${orders} vehicles=${vehicles} tires=${tires} harvests=${harvests} workOrders=${workOrders}`)
  }
  await p.$disconnect()
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1) })