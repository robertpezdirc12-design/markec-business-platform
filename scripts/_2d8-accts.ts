// 2D-8 — preveri referenčne račune (email/org/slug) + status objave. Read-only.
// Uporaba: node scripts/run-with-test-db.mjs tsx scripts/_2d8-accts.ts
import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function main() {
  const emails = ["cebeler.tire@markec.test", "cebeler.fresh@markec.test", "atelje.fresh@markec.test"]
  for (const email of emails) {
    const u = await p.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, emailVerified: true, password: true } })
    if (!u) { console.log(email, "NE OBSTAJA"); continue }
    const member = await p.organizationMember.findFirst({ where: { userId: u.id } })
    const orgId = member?.organizationId ?? ""
    const org = await p.organization.findUnique({ where: { id: orgId }, select: { slug: true, vertical: true, publishState: true } })
    console.log(email, "role=", u.role, "verified=", !!u.emailVerified, "| org=", org?.slug, org?.vertical, org?.publishState, "| hasPassword=", !!u.password)
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => p.$disconnect())