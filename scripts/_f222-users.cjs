// F2.2.2 TEMP — markec_dev user/membership probe (no secrets printed). Delete after run.
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()
;(async () => {
  const users = await p.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@rcbeautysalon.org" } },
        { email: { in: ["admin@f21.test"] } },
      ],
    },
    select: { id: true, email: true, role: true, emailVerified: true },
  })
  const org = await p.organization.findUnique({ where: { slug: "demo-salon" }, select: { id: true } })
  const members = await p.organizationMember.findMany({
    where: { organizationId: org.id },
    select: { userId: true, role: true, isDefault: true },
  })
  const customer = await p.customer.findFirst({
    where: { userId: users.find((u) => u.email?.startsWith("cliente"))?.id },
    select: { id: true, phone: true, organizationId: true },
  })
  // Staff.userId mapping (untouchable invariant — just read)
  const staffMap = await p.staff.findMany({
    where: { organizationId: org.id },
    select: { name: true, userId: true },
    take: 5,
  })
  console.log(JSON.stringify({ users, memberships: members, customer, staffUserLinks: staffMap }, null, 1))
  await p.$disconnect()
})().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
