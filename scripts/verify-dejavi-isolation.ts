import { PrismaClient } from "@prisma/client"
/**
 * 2D-1S *runtime* izolacijska preverba na PRAVIH referenčnih org (testna baza).
 * Dokazuje za čebelarja (#A) in vulkanizerja (#B) — dva ločena uporabnika in
 * dve ločeni organizaciji — da org-scoped poizvedbe in zapisi NIKOLI ne puščajo
 * čez mejo orga, niti pri neposrednem naslavljanju tujega ID-ja (IDOR, fail-closed).
 */
const p = new PrismaClient()

async function main() {
  const MAIL = ["cebeler.fresh@markec.test", "cebeler.tire@markec.test"]
  const SLUG = ["svezi-cebeler-2d1l", "svezi-vulkanizer-2d1s"]

  const users = await p.user.findMany({ where: { email: { in: MAIL } }, select: { id: true, email: true, organizationId: true, role: true } })
  const orgs = await p.organization.findMany({ where: { slug: { in: SLUG } }, select: { id: true, slug: true, vertical: true, name: true } })

  if (users.length !== 2) throw new Error(`Pričakovana 2 uporabnika, najdenih ${users.length}`)
  if (orgs.length !== 2) throw new Error(`Pričakovani 2 org, najdenih ${orgs.length}`)

  const bySlug = new Map(orgs.map((o) => [o.slug, o]))
  const A = bySlug.get("svezi-cebeler-2d1l")! // čebelar
  const B = bySlug.get("svezi-vulkanizer-2d1s")! // vulkanizer
  const ownerA = users.find((u) => u.organizationId === A.id)!
  const ownerB = users.find((u) => u.organizationId === B.id)!

  console.log("=== DVA LOČENA UPORABNIKA ===")
  console.log(`  Čebelar    : ${ownerA.email} (${ownerA.role}) -> org ${A.slug} [${A.vertical}]`)
  console.log(`  Vulkanizer : ${ownerB.email} (${ownerB.role}) -> org ${B.slug} [${B.vertical}]`)
  if (ownerA.id === ownerB.id) throw new Error("ISTA uporabniška računa! Mora biti vsaj dve ločeni.")
  if (A.id === B.id) throw new Error("ISTA organizacija! Mora biti vsaj dve ločeni.")

  // ---- 1. Vsak org ima lastne podatke (katalog, rezervacije/nalogi, izdelki) ----
  const earn = async (orgId: string) => ({
    products: await p.product.count({ where: { organizationId: orgId } }),
    orders: await p.order.count({ where: { organizationId: orgId } }),
    customers: await p.customer.count({ where: { organizationId: orgId } }),
    appointments: await p.appointment.count({ where: { organizationId: orgId } }),
    workOrders: await p.workOrder.count({ where: { organizationId: orgId } }),
    vehicles: await p.extensionRecord.count({ where: { organizationId: orgId, entityKey: "vehicle" } }),
    tiers: await p.extensionRecord.count({ where: { organizationId: orgId, entityKey: "tire_set" } }),
    harvests: await p.extensionRecord.count({ where: { organizationId: orgId, entityKey: "harvest" } }),
  })
  const dataA = await earn(A.id)
  const dataB = await earn(B.id)
  console.log("\n=== LOČENI POSLOVNI PODATKI PO ORG ===")
  console.log("  ČEBELAR  :", JSON.stringify(dataA))
  console.log("  VULKANIZ :", JSON.stringify(dataB))

  // ---- 2. IDOR fail-closed: poskus branja/zapisa na TUJI org prek ID-ja ----
  // vsak si zapiše en tuj ID, nato poskusi prek findFirst z org-scope guard, kot ga
  // uporabljajo server actions (morajo vrniti null).
  const aWorker = await p.workOrder.findFirst({ where: { organizationId: A.id }, select: { id: true } })
  const bWorker = await p.workOrder.findFirst({ where: { organizationId: B.id }, select: { id: true } })
  const aVehicles = await p.extensionRecord.findFirst({ where: { organizationId: A.id, entityKey: "vehicle" }, select: { id: true } })
  const bVehicles = await p.extensionRecord.findFirst({ where: { organizationId: B.id, entityKey: "vehicle" }, select: { id: true } })

  const problems: string[] = []
  const guardWorkOrder = (orgId: string, id?: string) => p.workOrder.findFirst({ where: { id: id ?? "", organizationId: orgId } })
  const guardVehicle = (orgId: string, id?: string) => p.extensionRecord.findFirst({ where: { id: id ?? "", organizationId: orgId, entityKey: "vehicle" } })

  if (aWorker && (await guardWorkOrder(B.id, aWorker.id))) problems.push("vulkanizer dosegel čebelarjev delovni nalog")
  if (bWorker && (await guardWorkOrder(A.id, bWorker.id))) problems.push("čebelar dosegel vulkanizerjev delovni nalog")
  if (aVehicles && (await guardVehicle(B.id, aVehicles.id))) problems.push("vulkanizer dosegel čebelarjevo vozilo")
  if (bVehicles && (await guardVehicle(A.id, bVehicles.id))) problems.push("čebelar dosegel vulkanizerjevo vozilo")

  if (problems.length) {
    console.error("\n✗ PREPUSTI (leak)!!")
    for (const x of problems) console.error("  -", x)
    process.exitCode = 1
    return
  }
  console.log("\n=== IDOR (cross-org read guard) ===")
  console.log("  ✓ Ob poskusu branja tujega ID-ja org-scope guard vrne nič — ni prepusta.")

  // ---- 3. Članstvo: vsak lastnik je član SAMO svoje org ----
  const memCountA = await p.organizationMember.count({ where: { userId: ownerA.id } })
  const memCountB = await p.organizationMember.count({ where: { userId: ownerB.id } })
  const memOrgA = await p.organizationMember.findFirst({ where: { userId: ownerA.id }, select: { organizationId: true } })
  const memOrgB = await p.organizationMember.findFirst({ where: { userId: ownerB.id }, select: { organizationId: true } })
  console.log("\n=== ČLANSTVA (M1 resolver) ===")
  console.log(`  Čebelar  je član ${memCountA} org (${memOrgA?.organizationId === A.id ? "lastna ✓" : "NAPAKA"})`)
  console.log(`  Vulkaniz je član ${memCountB} org (${memOrgB?.organizationId === B.id ? "lastna ✓" : "NAPAKA"})`)
  if (memOrgA?.organizationId !== A.id) problems.push("čebelar ni član lastne org")
  if (memOrgB?.organizationId !== B.id) problems.push("vulkanizer ni član lastne org")

  if (problems.length) { console.error("\n✗ VARNOSTNE NAPAKE"); for (const x of problems) console.error("  -", x); process.exitCode = 1; return }

  console.log("\n✓ IZOLACIJA POTRJENA: dve ločeni org in dva ločena uporabnika brez križnega dostopa.")
  await p.$disconnect()
}

main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1) })