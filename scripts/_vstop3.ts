import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function main() {
  const o = await p.organization.findUnique({ where: { slug: "atelje-ivana-2d3" }, select: { id: true, vertical: true, name: true, publishState: true } })
  const u = await p.user.findUnique({ where: { email: "ivana.atelje@markec.test" }, select: { id: true, role: true, emailVerified: true, organizationId: true } })
  const m = u && o ? await p.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: o.id, userId: u.id } }, select: { role: true, isDefault: true } }) : null
  console.log(JSON.stringify({ org: o ? { name: o.name, vertical: o.vertical, publish: o.publishState } : null, user: u ? { role: u.role, verified: !!u.emailVerified, orgId: u.organizationId === o?.id } : null, member: m }))
  await p.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })