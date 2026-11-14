// ============================================================
// F5.5.3 — ENRICHED BROWSER SEED (moje stranke) za markec_f553_test.
// Dodamo stranke v org A (frizer) + org B (avtoservis), vključno z
// ISTO osebo v obeh org, gostom brez emaila, gostom z emailom ter
// zgodovino (termin/naročilo/delovni nalog) za prikaz v brskalniku.
// ============================================================

const { PrismaClient } = require("@prisma/client")

const url = process.env.DATABASE_URL || ""
const safe = /^postgresql:\/\/[^@]*@[^/]+\/markec_f553_test(\?|$)/.test(url)
if (!safe) {
  console.error("REFUSED: DATABASE_URL must point to markec_f553_test.")
  process.exit(1)
}

const prisma = new PrismaClient()
const ORGA = "f553-org-a"
const ORGB = "f553-org-b"
const SVC = "f553-svc-a1"
const PROD = "f553-prod-a1"
const STAFF = "f553-staff-a1"

async function seed() {
  // Poisono počisti podatke, ki jih bo ta skripta napolnila.
  await prisma.walkInEntry.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.workOrder.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.appointment.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.order.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })

  const now = new Date()

  // --- Org A (frizer) stranke ---
  // Registrirana stranka (povezana na userClient).
  const karla = await prisma.customer.create({
    data: {
      organizationId: ORGA, name: "Karla Stranka", email: "stranka@f553.test", phone: "040 111 222",
      tags: ["VIP"], dateOfBirth: new Date("1990-05-14"), notes: "Redna stranka, raje zvečer.",
      userId: "f553-client-user",
    },
  })
  // Gost z emailom.
  const ana = await prisma.customer.create({
    data: { organizationId: ORGA, name: "Ana Novak", email: "ana.novak@primer.si", phone: "041 333 444", tags: ["new"] },
  })
  // Gost brez emaila (le telefon) — preveri identity politiko.
  await prisma.customer.create({
    data: { organizationId: ORGA, name: "Bojan Zajc", email: null, phone: "051 555 666", notes: "Prišel brez naročila." },
  })
  // Ista oseba v org B (avtoservis).
  const karlaB = await prisma.customer.create({
    data: { organizationId: ORGB, name: "Karla Stranka", email: "stranka@f553.test", phone: "040 111 222" },
  })
  // Avtoservis stranka Beta.
  const beta = await prisma.customer.create({
    data: { organizationId: ORGB, name: "Marko Kovač", email: "marko@beta.si", phone: "031 777 888" },
  })

  // --- Zgodovina za Karlo (org A) ---
  await prisma.appointment.create({
    data: { staffId: STAFF, customerId: karla.id, organizationId: ORGA, startTime: new Date(Date.now() - 3 * 864e5), endTime: new Date(Date.now() - 3 * 864e5 + 45 * 60e3), totalPrice: 25, status: "COMPLETED" },
  })
  await prisma.appointment.create({
    data: { staffId: STAFF, customerId: karla.id, organizationId: ORGA, startTime: now, endTime: new Date(Date.now() + 45 * 60e3), totalPrice: 28, status: "PENDING" },
  })
  await prisma.order.create({
    data: { organizationId: ORGA, customerId: karla.id, subtotal: 12, tax: 0, total: 12, status: "PAID", createdAt: new Date(Date.now() - 2 * 864e5) },
  })
  await prisma.document.create({
    data: { organizationId: ORGA, customerId: karla.id, type: "INVOICE", number: 1, status: "PAID", total: 40, issueDate: now, dueDate: new Date(Date.now() + 30 * 864e5) },
  })

  // --- Zgodovina za Marko (org B, avtoservis) ---
  await prisma.workOrder.create({
    data: { organizationId: ORGB, customerId: beta.id, number: 1, title: "Veliki servis", status: "COMPLETED" },
  })

  console.log("Enriched browser dataset for", ORGA, "+", ORGB)
  await prisma.$disconnect()
}

seed().catch((e) => { console.error(e); process.exit(1) })