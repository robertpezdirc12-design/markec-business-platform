// F2.2.2 TEMP — markec_dev data-shape probe (services/products/org members). Delete after run.
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient()
;(async () => {
  const org = await p.organization.findUnique({ where: { slug: "demo-salon" }, select: { id: true, status: true, publishState: true } })
  const [svcNull, svcOrg, svcTotal] = await Promise.all([
    p.service.count({ where: { organizationId: null } }),
    p.service.count({ where: { organizationId: org.id } }),
    p.service.count(),
  ])
  const cfg = await p.salonConfig.findUnique({ where: { organizationId: org.id }, select: { organizationId: true, timezone: true, bookingDeposit: true } })
  const st = await p.staff.findMany({ where: { organizationId: org.id }, select: { id: true, name: true, isActive: true }, take: 5 })
  const staffSvc = await p.staffService.count({ where: { staff: { organizationId: org.id } } })
  const wh = await p.workingHours.count({ where: { staff: { organizationId: org.id } } })
  const cd = await p.customDomain.count({ where: { organizationId: org.id } })
  console.log(JSON.stringify({ org, services: { null: svcNull, demo: svcOrg, total: svcTotal }, salonConfig: cfg, staff: st, staffService: staffSvc, workingHours: wh, customDomains: cd }, null, 1))
  await p.$disconnect()
})().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
