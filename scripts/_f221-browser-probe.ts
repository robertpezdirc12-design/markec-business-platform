process.env.DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/markec_f21_test?schema=public"
import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()
  const users = await p.user.findMany({
    where: { email: { contains: "test" } },
    select: { id: true, email: true, role: true, organizationId: true, password: true },
    take: 20,
  })
  console.log(JSON.stringify(users, null, 1))
  await p.$disconnect()
}
main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})