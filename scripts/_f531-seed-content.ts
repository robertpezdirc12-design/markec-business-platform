// ============================================================
// F5.3.1.1 — Priprava namenske testne baze markec_f531_test za browser
// acceptance urejevalnika. Deterministično: aktivno osebje (objava), pristine
// siteContent + OBJAVLJEN basni snapshot, geslo za CLIENTE, org-b + adminB
// za cross-org test.
//
// VARNOSTNA ZAPORA: deluje LE na /markec_f531_test (nikoli dev/prod).
//
// Run:
//   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
//   pnpm exec tsx scripts/_f531-seed-content.ts
// ============================================================
import { PrismaClient } from "@prisma/client"
import { verticalSiteContent } from "@/lib/verticals"
import bcrypt from "bcryptjs"

const url = process.env.DATABASE_URL || ""
if (!/markec_f531_test(\?|$)/.test(url)) {
  console.error("REFUSED: DATABASE_URL must point to markec_f531_test")
  process.exit(1)
}
const db = new PrismaClient()

async function ensureStaff(orgId: string) {
  const existing = await db.staff.count({ where: { organizationId: orgId, isActive: true } })
  if (existing > 0) return
  let su = await db.user.findUnique({ where: { email: "staff@rcbeautysalon.org" } })
  let userId = su?.id
  if (!userId) {
    const u = await db.user.create({ data: { email: "staff@rcbeautysalon.org", name: "Testna Frizerka", role: "STAFF" } })
    userId = u.id
  }
  const m = await db.organizationMember.findFirst({ where: { userId, organizationId: orgId } })
  if (!m) await db.organizationMember.create({ data: { userId, organizationId: orgId, role: "STAFF" } })
  const s = await db.staff.findFirst({ where: { organizationId: orgId } })
  if (!s) await db.staff.create({ data: { organizationId: orgId, name: "Testna Frizerka", email: "staff@rcbeautysalon.org", isActive: true, userId } })
}

async function main() {
  const org = await db.organization.findFirst({ where: { slug: "demo-salon" }, select: { id: true, vertical: true } })
  if (org) {
    await ensureStaff(org.id)
    const content = verticalSiteContent(org.vertical || "beauty") as unknown as object
    await db.salonConfig.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, name: "Salon harmonija (demo)", siteContent: content, publishedSiteContent: content, publishedContentVersion: 1 },
      update: { siteContent: content, publishedSiteContent: content, publishedContentVersion: 1 },
    })
    await db.organization.update({
      where: { id: org.id },
      data: { contentVersion: 1, publishedAt: new Date(), publishState: "PUBLISHED" },
    })
    console.log("demo-salon pripravljen (baseline snapshot objavljen)")
  }

  const cliente = await db.user.findUnique({ where: { email: "cliente@rcbeautysalon.org" } })
  if (cliente) {
    const hash = await bcrypt.hash("cliente123", 12)
    await db.user.update({ where: { id: cliente.id }, data: { password: hash, emailVerified: new Date() } })
    console.log("cliente geslo nastavljeno")
  }

  let orgB = await db.organization.findFirst({ where: { slug: "org-b-f531" } })
  if (!orgB) {
    orgB = await db.organization.create({ data: { slug: "org-b-f531", name: "Organizacija B (test)", publishState: "DRAFT" } })
  }
  let adminB = await db.user.findUnique({ where: { email: "adminB@rcbeautysalon.org" } })
  if (!adminB) {
    const hash = await bcrypt.hash("adminB123", 12)
    adminB = await db.user.create({ data: { email: "adminB@rcbeautysalon.org", name: "Admin B", role: "ADMIN", password: hash, emailVerified: new Date() } })
  } else if (!adminB.emailVerified) {
    await db.user.update({ where: { id: adminB.id }, data: { emailVerified: new Date() } })
  }
  const mB = await db.organizationMember.findFirst({ where: { userId: adminB.id, organizationId: orgB.id } })
  if (!mB) await db.organizationMember.create({ data: { userId: adminB.id, organizationId: orgB.id, role: "ADMIN", isDefault: true } })
  console.log("org-b + adminB pripravljen")
  await db.$disconnect()
}
main()