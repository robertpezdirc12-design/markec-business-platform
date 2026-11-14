import { PrismaClient } from "@prisma/client"
async function main() {
  const p = new PrismaClient()
  const rows = await p.configChangeLog.findMany({
    where: { entityKey: { startsWith: "module:" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { entityKey: true, action: true, summary: true, actorEmail: true, version: true, createdAt: true },
  })
  console.log("AUDIT MODULE LOG (%d):", rows.length)
  for (const r of rows) {
    console.log(`  [${r.createdAt.toISOString()}] ${r.entityKey} v${r.version} ${r.action} "${r.summary}" actor=${r.actorEmail}`)
  }
  await p.$disconnect()
}
void main()