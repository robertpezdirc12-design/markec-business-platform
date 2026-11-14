/**
 * MARKEC — ustvari referenčno org: ČEBELARSTVO (beekeeping) — ŽIVI DEMO
 * PROSTOR, ne samo prazen proxy. Namenjeno podjetniku/obrtniku, ki na
 * izložbi klikne "primer čebelar" in dobí pravi, vnaprej napolnjen
 * delovni prostor, kjer sam raziskuje, kaj vse program zna.
 *
 * Za razliko od seed-seamstress-complete (ki pripravi samo ogrodje pred
 * objavo) ta skripta napolni CELE ČEBELARSKE EVIDENCE po shemi bee-apiary
 * (extensions.ts): panjske postaje → panji → družine → pregledi → zdravljenja
 * → hranjenja → selitve (append-only) → pridelek medu, plus zaloge s
 * sledljivostjo (harvest → batch → StockMovement → prodaja) in eno naročilo.
 *
 * Idempotentno; test-baza-only ('markec_e2e_test'). Ne dotika se drugih
 * org (cebeler/vulkanizer/atelje …) ali podatkov.
 *
 * Run: DATABASE_URL=…test… npx tsx scripts/seed-beekeeping-complete.ts
 */
import { prisma } from "../src/lib/prisma"
import bcrypt from "bcryptjs"
import { seedOrganizationCatalog } from "../src/lib/verticals"
import { defaultSiteContent } from "../src/lib/site-content"
import { materializeProfileAssets } from "../src/lib/profiles/materialize"
import { getProfile } from "../src/lib/profiles/registry"
import { getExtension } from "../src/lib/profiles/extensions"
import { deriveRecordTitle } from "../src/lib/field-validation"

const SLUG = "svezi-cebeler-demo"
const OWNER_EMAIL = "demo.cebeler@markec.test"
const OWNER_NAME = "Janez Čebelar"
const ORG_NAME = "Čebelarstvo medeni panj"
const DEMO_CUSTOMER_EMAIL = "anja.kupka@markec.test"

const BEE_EXT = "bee-apiary"

function assertTarget(dbUrl: string) {
  if (!/markec_e2e_test/.test(dbUrl)) {
    throw new Error(`REFUSED: seed-beekeeping-complete sme teči le na markec_e2e_test (trenutno: ${dbUrl})`)
  }
}

/** Ustvari ExtensionRecord (org-scoped), če taka entiteta še ne obstaja. */
async function ensureRecord(args: {
  orgId: string
  entityKey: string
  data: Record<string, unknown>
}) {
  const { orgId, entityKey, data } = args
  // Enak izpeljani naslov kot univerzalni UI (deriveRecordTitle): prvo
  // obvezno text/select polje, sicer prvo nenaslovljeno kratko vrednost.
  const ext = getExtension(BEE_EXT)
  const entity = ext?.entities.find((e) => e.key === entityKey)
  const title =
    (data.title as string) ??
    (data.label as string) ??
    (data.name as string) ??
    (entity
      ? deriveRecordTitle(entity.fields as Parameters<typeof deriveRecordTitle>[0], data, entity.name)
      : entityKey)
  const exists = await prisma.extensionRecord.findFirst({
    where: { organizationId: orgId, extensionId: BEE_EXT, entityKey, title },
  })
  if (exists) return exists
  return prisma.extensionRecord.create({
    data: {
      organizationId: orgId,
      extensionId: BEE_EXT,
      entityKey,
      title,
      data: data as unknown as object,
    },
  })
}

async function main() {
  assertTarget(process.env.DATABASE_URL ?? "")

  // --- 1) Uporabnik (lastnik) + organizacija + članstvo ---
  let owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })
  if (!owner) {
    const hash = await bcrypt.hash("demo1234", 10)
    owner = await prisma.user.create({
      data: { email: OWNER_EMAIL, name: OWNER_NAME, role: "ADMIN", password: hash, emailVerified: new Date() },
    })
    console.log("✔ Ustvarjen lastnik (nov uporabniški račun).")
  } else {
    console.log("• Lastnik že obstaja.")
  }

  let org = await prisma.organization.findUnique({ where: { slug: SLUG } })
  if (!org) {
    org = await prisma.organization.create({
      data: { slug: SLUG, name: ORG_NAME, vertical: "beekeeping", palette: "amber", publishState: "PUBLISHED" },
    })
    console.log(`✔ Ustvarjena nova org (${SLUG}, beekeeping).`)
  } else {
    console.log("• Org že obstaja.")
  }

  const existingMember = await prisma.organizationMember.findFirst({ where: { organizationId: org.id, userId: owner.id } })
  if (!existingMember) {
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId: owner.id, role: "ADMIN", isDefault: true } })
    await prisma.user.update({ where: { id: owner.id }, data: { organizationId: org.id } })
    console.log("✔ Članstvo ustvarjeno (ADMIN, default).")
  }

  // --- 2) Katalog (6 medenih izdelkov) + voden vstop dodelan (verticalChosenAt) ---
  const report = await seedOrganizationCatalog(org.id, org.vertical)
  console.log(`✔ Katalog: +${report.added.categories} kategorij, +${report.added.services} storitev, +${report.added.products} izdelkov.`)
  if (!org.verticalChosenAt) {
    await prisma.organization.update({ where: { id: org.id }, data: { verticalChosenAt: new Date() } })
  }

  // --- 3) Osebje (lastnik) + delovni čas ---
  let staff = await prisma.staff.findFirst({ where: { userId: owner.id } })
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        bio: "Lastnik in čebelar z dolgoletnimi izkušnjami z medonosnimi čebelami Kranjske sivke.",
        isActive: true,
        userId: owner.id,
        organizationId: org.id,
      },
    })
    console.log("✔ Ustvarjeno osebje (lastnik).")
  }

  // --- 4) SalonConfig z lastno javno vsebino dejavnosti + objavljen snapshot ---
  let cfg = await prisma.salonConfig.findFirst({ where: { organizationId: org.id } })
  if (!cfg) {
    const content = defaultSiteContent(org.vertical)
    await prisma.salonConfig.create({
      data: {
        organizationId: org.id,
        name: ORG_NAME,
        email: "info@medeni-panj.si",
        phone: "+386 40 222 333",
        city: "Radovljica",
        country: "SI",
        currency: "EUR",
        locale: "sl",
        timezone: "Europe/Ljubljana",
        bookingDeposit: 0,
        cancellationPolicy: "",
        siteContent: content as unknown as object,
        publishedSiteContent: content as unknown as object,
        publishedContentVersion: 1,
      },
    })
    console.log("✔ SalonConfig (lastna javna vsebina čebelarstva) + objavljen snapshot.")
  }

  // --- 5) Forme/workflow-i profila (idempotentno) ---
  await materializeProfileAssets(org.id, org.vertical)
  console.log(`✔ Profilni elementi (${getProfile(org.vertical).label}).`)

  // --- 6) ČEBELARSKE EVIDENCE (bee-apiary) — živi demo podatki ---
  // Vrsto parnih/rojenstvenih zvez med entitetami vodimo prek `*_ref` objektov
  // ({id, extensionId, entityKey}) — isti format, ki ga univerzalni UI izriše.
  console.log("• Čebelarske evidence (bee-apiary):")

  // 6a) Panjske postaje (apiary)
  const postajaA = await ensureRecord({
    orgId: org.id, entityKey: "apiary",
    data: { name: "Panjska postaja Lipa", location: "Radovljica, ob robu gozda", coordinates: "46.3421, 14.1736", hive_count: "24", notes: "Glavni čebelnjak, sončna lega." },
  })
  const postajaB = await ensureRecord({
    orgId: org.id, entityKey: "apiary",
    data: { name: "Panjska postaja Vrh", location: "Bled, travnik pri Vrhu", coordinates: "46.3695, 14.1050", hive_count: "12", notes: "Selitvena postaja — lipa in gozdne rastline." },
  })
  console.log(`  ✔ ${postajaA.title}, ${postajaB.title}`)

  // 6b) Panji (hive) — vezani na postajo prek apiary_ref
  const hiveDefs = [
    { label: "Panj A1", postaja: postajaA, hiveType: "AŽ", strength: "Močna" },
    { label: "Panj A2", postaja: postajaA, hiveType: "AŽ", strength: "Močna" },
    { label: "Panj A3", postaja: postajaA, hiveType: "Langstroth", strength: "Srednja" },
    { label: "Panj B1", postaja: postajaB, hiveType: "Langstroth", strength: "Močna" },
    { label: "Panj B2", postaja: postajaB, hiveType: "AŽ", strength: "Šibka" },
  ]
  const hives: Record<string, { id: string }> = {}
  for (const h of hiveDefs) {
    const rec = await ensureRecord({
      orgId: org.id, entityKey: "hive",
      data: {
        label: h.label,
        apiary: h.postaja.title,
        apiary_ref: { id: h.postaja.id, extensionId: BEE_EXT, entityKey: "apiary" },
        hive_type: h.hiveType,
        strength: h.strength,
        installed_date: "2024-04-15",
      },
    })
    hives[h.label] = rec
  }
  console.log(`  ✔ ${Object.keys(hives).length} panjev (AŽ + Langstroth)`)

  // 6c) Čebelje družine (colony) — vezane na panj prek hive_ref
  const colonyDefs = [
    { label: "Družina A1", hive: "Panj A1", queenAge: 1, health: "Zdrava" },
    { label: "Družina A2", hive: "Panj A2", queenAge: 2, health: "Zdrava" },
    { label: "Družina A3", hive: "Panj A3", queenAge: 3, health: "Pod nadzorom" },
    { label: "Družina B1", hive: "Panj B1", queenAge: 1, health: "Zdrava" },
    { label: "Družina B2", hive: "Panj B2", queenAge: 4, health: "Oslabljena" },
  ]
  const colonies: Record<string, { id: string }> = {}
  for (const c of colonyDefs) {
    const rec = await ensureRecord({
      orgId: org.id, entityKey: "colony",
      data: {
        label: c.label,
        hive: c.hive,
        hive_ref: { id: hives[c.hive].id, extensionId: BEE_EXT, entityKey: "hive" },
        queen_age_years: c.queenAge,
        health_status: c.health,
      },
    })
    colonies[c.label] = rec
  }
  console.log(`  ✔ ${Object.keys(colonies).length} čebeljih družin`)

  // 6d) Pregledi (inspection) — realni časovni odtisi za zadnjih par tednov
  const inspections = [
    { date: "2026-06-02", colony: "Družina A1", findings: "V redu", feeding: true, queen: true },
    { date: "2026-06-02", colony: "Družina A2", findings: "V redu", feeding: true, queen: true },
    { date: "2026-06-09", colony: "Družina A3", findings: "Potrebno hranjenje", feeding: false, queen: true },
    { date: "2026-06-12", colony: "Družina B1", findings: "V redu", feeding: true, queen: false },
    { date: "2026-06-16", colony: "Družina B2", findings: "Znaki rojenja", feeding: false, queen: false, notes: "Preveriti matico." },
  ]
  for (const i of inspections) {
    await ensureRecord({
      orgId: org.id, entityKey: "inspection",
      data: {
        inspection_date: i.date,
        colony: i.colony,
        colony_ref: { id: colonies[i.colony].id, extensionId: BEE_EXT, entityKey: "colony" },
        findings: i.findings,
        feeding: i.feeding,
        queen_seen: i.queen,
        ...(i.notes ? { notes: i.notes } : {}),
      },
    })
  }
  console.log(`  ✔ ${inspections.length} pregledov družin`)

  // 6e) Zdravljenja (treatment) — varnostni intervali
  const treatments = [
    { date: "2026-05-20", colony: "Družina A3", reason: "Varooza", substance: "Amitraz (obilica)", notes: "Čilska zdravila po posegi." },
    { date: "2026-05-20", colony: "Družina B2", reason: "Preventiva", substance: "Oksalna kislina", notes: "Jesenska preventiva." },
  ]
  for (const t of treatments) {
    await ensureRecord({
      orgId: org.id, entityKey: "treatment",
      data: {
        treatment_date: t.date,
        colony: t.colony,
        colony_ref: { id: colonies[t.colony].id, extensionId: BEE_EXT, entityKey: "colony" },
        reason: t.reason,
        substance: t.substance,
        notes: t.notes,
      },
    })
  }
  console.log(`  ✔ ${treatments.length} zdravljenj`)

  // 6f) Hranjenja (feeding)
  const feedings = [
    { date: "2026-05-25", colony: "Družina A1", type: "Sladkorni sirup", amount: 2 },
    { date: "2026-05-25", colony: "Družina A2", type: "Sladkorni sirup", amount: 2 },
    { date: "2026-06-10", colony: "Družina A3", type: "Pogača", amount: 1 },
  ]
  for (const f of feedings) {
    await ensureRecord({
      orgId: org.id, entityKey: "feeding",
      data: {
        feed_date: f.date,
        colony: f.colony,
        colony_ref: { id: colonies[f.colony].id, extensionId: BEE_EXT, entityKey: "colony" },
        feed_type: f.type,
        amount_kg: f.amount,
      },
    })
  }
  console.log(`  ✔ ${feedings.length} hranjenj in oskrb`)

  // 6g) Selitve družin (colony_move) — append-only zgodovina
  // B1 selimo iz Panj B1 v A3 (odtegovanje) — spremeni hive_ref družine.
  await ensureRecord({
    orgId: org.id, entityKey: "colony_move",
    data: {
      colony_ref: { id: colonies["Družina B1"].id, extensionId: BEE_EXT, entityKey: "colony" },
      from_hive_ref: { id: hives["Panj B1"].id, extensionId: BEE_EXT, entityKey: "hive" },
      to_hive_ref: { id: hives["Panj A3"].id, extensionId: BEE_EXT, entityKey: "hive" },
    },
  })
  // Uskladimo trenutno lokacijo (vir resnice = colony.hive_ref)
  await prisma.extensionRecord.update({
    where: { id: colonies["Družina B1"].id },
    data: {
      data: {
        label: "Družina B1",
        hive: "Panj A3",
        hive_ref: { id: hives["Panj A3"].id, extensionId: BEE_EXT, entityKey: "hive" },
        queen_age_years: 1,
        health_status: "Zdrava",
      } as unknown as object,
    },
  })
  console.log(`  ✔ Selitev družine B1 → Panj A3 (zgodovina)`)

  // 6h) Pridelek medu (harvest) — vir za sledljivost
  const harvest1 = await ensureRecord({
    orgId: org.id, entityKey: "harvest",
    data: {
      harvest_date: "2026-06-20",
      apiary: postajaA.title,
      apiary_ref: { id: postajaA.id, extensionId: BEE_EXT, entityKey: "apiary" },
      honey_type: "Cvetlični med",
      quantity_kg: 18,
      hives_count: 12,
      notes: "Prvi oddteg junija — cvetlični med.",
    },
  })
  console.log(`  ✔ Pridelek: ${harvest1.title} (${harvest1.data && (harvest1.data as Record<string, unknown>).quantity_kg} kg)`)

  // --- 7) Zaloga + sledljivost: meden izdelek povežemo s serijo pridelka ---
  // Poiščemo "Cvetlični med 500 g" (seedOrganizationCatalog je ustvaril) in
  // zabeležimo StockMovement z batchRecordId → harvest ExtensionRecord.
  const honeyProduct = await prisma.product.findFirst({
    where: { organizationId: org.id, name: { contains: "Cvetlični med" } },
    orderBy: { createdAt: "asc" },
  })
  if (honeyProduct) {
    const existing = await prisma.stockMovement.count({
      where: { organizationId: org.id, batchRecordId: harvest1.id },
    })
    if (existing === 0) {
      // Nagrade iz pridelka v zalogo izdelka: 18 kg → 36 kozarcev × 500 g.
      await prisma.stockMovement.create({
        data: {
          organizationId: org.id,
          productId: honeyProduct.id,
          direction: "IN",
          quantity: 36,
          source: "MANUAL",
          batchRecordId: harvest1.id,
          note: `Serija iz pridelka ${harvest1.title} (18 kg cvetličnega medu).`,
        },
      })
      const old = honeyProduct.stockQuantity
      await prisma.product.update({
        where: { id: honeyProduct.id },
        data: { stockQuantity: old + 36 },
      })
      console.log(`✔ Sledljivost: +36 kozarcev "Cvetlični med 500 g" iz serije (batch) pridelka.`)
    } else {
      console.log("• Zaloga pridelka je že zabeležena.")
    }
  } else {
    console.log("⚠ Kataloški izdelek Cvetlični med ni najden — sledljivost preskočena.")
  }

  // --- 8) Vzorčna stranka + eno naročilo (spet z batch sledljivostjo) ---
  let demoCustomer = await prisma.customer.findFirst({ where: { organizationId: org.id, email: DEMO_CUSTOMER_EMAIL } })
  if (!demoCustomer) {
    demoCustomer = await prisma.customer.create({
      data: { organizationId: org.id, name: "Anja Kupka", email: DEMO_CUSTOMER_EMAIL, phone: "+386 31 222 111" },
    })
    console.log("✔ Vzorčna stranka.")
  }

  let order = await prisma.order.findFirst({ where: { organizationId: org.id, customerId: demoCustomer.id } })
  if (!order) {
    const lipov = await prisma.product.findFirst({
      where: { organizationId: org.id, name: { contains: "Lipov med" } },
      orderBy: { createdAt: "asc" },
    })
    if (lipov) {
      const price = Number(lipov.price)
      const total = price * 2
      order = await prisma.order.create({
        data: {
          organizationId: org.id,
          customerId: demoCustomer.id,
          status: "PAID",
          subtotal: total,
          tax: 0,
          total,
          items: {
            create: {
              productId: lipov.id,
              quantity: 2,
              price,
            },
          },
        },
      })
      console.log(`✔ Naročilo 2× ${lipov.name} (${total} €) — zaključeno.`)
    } else {
      console.log("⚠ Izdelek Lipov med ni najden — naročilo preskočeno.")
    }
  }

  console.log("")
  console.log("KONEC — čebelarski ŽIVI DEMO PROSTOR pripravljen:")
  console.log(`  • Prijava kot lastnik: ${OWNER_EMAIL} / demo1234`)
  console.log(`  • Število entitet: 2 postaji, ${Object.keys(hives).length} panjev, ${Object.keys(colonies).length} družin, ${inspections.length} pregledov, ${treatments.length} zdravljenj, ${feedings.length} hranjenj, 1 selitev, 1 pridelek.`)
  console.log("  • Sledljivost: cvetlični med povezan s serijo pridelka; 1 naročilo.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())