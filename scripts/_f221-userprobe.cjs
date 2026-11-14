// F2.2.1 TEMP — DB user probe for browser-login debug. Delete after run.
const { PrismaClient } = require("@prisma/client")
const password = require("bcryptjs")
const p = new PrismaClient()
;(async () => {
  const u = await p.user.findUnique({
    where: { email: "admin@f21.test" },
    select: { id: true, email: true, role: true, password: true, organizationId: true },
  })
  console.log("USER:", JSON.stringify(u))
  if (u && u.password) {
    console.log("PWD_CHECK:", password.compareSync("F21test!2026", u.password))
  }
  const mem = await p.organizationMember.findMany({
    where: { userId: u ? u.id : "" },
    select: { organizationId: true, role: true, isDefault: true },
  })
  console.log("MEMBERS:", JSON.stringify(mem))
  await p.$disconnect()
})().catch((e) => {
  console.error("ERR:", e.message)
  process.exit(1)
})
