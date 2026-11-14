// F5.4.2 — seed browser-flow masa na markec_f54_test.
// ADMIN: obe org. STAFF: obe org (orgA z settings.manage, orgB brez).
// Org A: frizer. Org B: avtoservis.
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const O_A = "f54web-org-a"
const O_B = "f54web-org-b"
const ADMIN = "f54web-admin"
const STAFF = "f54web-staff"
const ROLE_A = "f54web-role-a"
const ROLE_B = "f54web-role-b"

async function main() {
  // Cleanup
  await prisma.organizationModuleState.deleteMany({ where: { organizationId: { in: [O_A, O_B] } } })
  await prisma.organizationMember.deleteMany({ where: { userId: { in: [ADMIN, STAFF] } } })
  await prisma.customRole.deleteMany({ where: { id: { in: [ROLE_A, ROLE_B] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN, STAFF] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [O_A, O_B] } } })

  const hash = await bcrypt.hash("F54Pass!2025", 10)

  await prisma.organization.create({ data: { id: O_A, slug: "f54web-frizer", name: "Frizer Web A", status: "ACTIVE", publishState: "PUBLISHED", vertical: "frizer", plan: "scale", verticalChosenAt: new Date() } })
  await prisma.organization.create({ data: { id: O_B, slug: "f54web-avto", name: "Avtoservis Web B", status: "ACTIVE", publishState: "PUBLISHED", vertical: "mehanik", plan: "scale", verticalChosenAt: new Date() } })

  await prisma.user.create({ data: { id: ADMIN, email: "f54admin@web.test", name: "F54 Admin", role: "ADMIN", password: hash, emailVerified: new Date() } })
  await prisma.user.create({ data: { id: STAFF, email: "f54staff@web.test", name: "F54 Staff", role: "STAFF", password: hash, emailVerified: new Date() } })

  await prisma.organizationMember.create({ data: { organizationId: O_A, userId: ADMIN, role: "ADMIN", isDefault: true } })
  await prisma.organizationMember.create({ data: { organizationId: O_B, userId: ADMIN, role: "ADMIN" } })
  await prisma.organizationMember.create({ data: { organizationId: O_A, userId: STAFF, role: "STAFF" } })
  await prisma.organizationMember.create({ data: { organizationId: O_B, userId: STAFF, role: "STAFF" } })

  await prisma.customRole.create({ data: { id: ROLE_A, organizationId: O_A, name: "Modul manager", permissions: ["settings.manage", "appointments.view"] as never } })
  await prisma.customRole.create({ data: { id: ROLE_B, organizationId: O_B, name: "Omejen", permissions: ["appointments.view"] as never } })
  await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: O_A, userId: STAFF } }, data: { customRoleId: ROLE_A } })
  await prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: O_B, userId: STAFF } }, data: { customRoleId: ROLE_B } })

  console.log("OK f54 browser masa")
}

main().finally(() => prisma.$disconnect())