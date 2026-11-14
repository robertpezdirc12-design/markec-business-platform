// F2.2.2 TEMP — demo membership probe. Delete after run.
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()
;(async () => {
  const org = await p.organization.findUnique({ where: { slug: "demo-salon" }, select: { id: true, name: true, status: true } })
  const admin = await p.user.findUnique({ where: { email: "admin@rcbeautysalon.org" }, select: { id: true, role: true } })
  const mem = await p.organizationMember.findMany({
    where: { organizationId: org.id },
    select: { userId: true, role: true, isDefault: true },
  })
  const adminMems = await p.organizationMember.count({ where: { userId: admin.id } })
  const staffUsers = await p.user.count({ where: { email: { in: ["laura@rcbeautysalon.org", "maria@rcbeautysalon.org", "sofia@rcbeautysalon.org", "ana@rcbeautysalon.org"] } } })
  console.log(JSON.stringify({ org, adminRole: admin.role, memberships: mem.length, adminTotalMems: adminMems, staffUsers }, null, 1))
  await p.$disconnect()
})().catch((e) => {
  console.error("ERR:", e.message)
  process.exit(1)
})
