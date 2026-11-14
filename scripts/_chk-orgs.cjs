const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const orgs = await p.organization.findMany({
    select: {
      id: true, slug: true, name: true, vertical: true,
      publishState: true, publishedAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log(JSON.stringify(orgs, null, 2))
}
main().catch((e) => { console.error(e.message); process.exit(1) }).finally(() => p.$disconnect())