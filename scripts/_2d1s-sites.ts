import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function main() {
  const orgs = await p.organization.findMany({ where: { vertical: { in: ["beekeeping", "tire-service"] } }, select: { slug: true, name: true, vertical: true, publishState: true } })
  console.log("ORGS", JSON.stringify(orgs))
  await p.$disconnect()
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1) })