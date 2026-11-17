#!/usr/bin/env node
/**
 * P1 #107 — POVRATNA ZAPOLNITEV `Customer.organizationId` (vzorec/popravek).
 *
 * Ozadje: samostojno registrirana stranka dobi Customer z organizationId
 * = NULL (registracija ne ve, v kateri salon bo šla). Pred popravkom
 * createAppointment take stranke ni nikoli pripisal salonu, zato jih
 * "Moje stranke" (org-scoped CRM) niso prikazovale, čeprav so imele
 * termine in naročila pri tem salonu.
 *
 * Popravek v kodi (claim-on-booking) velja za NOVE rezervacije. Ta skript
 * poravna ŠE OBSTOJEČE podatke — vendar samo tam, kjer je odgovor
 * nedvoumen:
 *   - Customer.organizationId je NULL, IN
 *   - ima vsaj en termin ALI naročilo, IN
 *   - VSI njegovi termini IN naročila pripadajo ISTI organizaciji.
 * Če se pojavi več organizacij (stranka več salonov), se vrstica PRESKOČI —
 * nikoli ne ugibamo in ne krademo CRM podatkov med najemniki.
 *
 * Telefon se dopolni samo, če je prazen (nikoli ne prepišemo obstoječega).
 *
 * Uporaba:
 *   node scripts/backfill-customer-org.mjs            # samo prikaz (dry-run)
 *   node scripts/backfill-customer-org.mjs --apply    # zapiši spremembe
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

async function main() {
  const orphans = await prisma.customer.findMany({
    where: { organizationId: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      appointments: {
        select: { organizationId: true, guestPhone: true },
      },
      orders: { select: { organizationId: true } },
    },
  })

  const claimable = []
  const skipped = []

  for (const c of orphans) {
    const orgIds = new Set(
      [
        ...c.appointments.map((a) => a.organizationId),
        ...c.orders.map((o) => o.organizationId),
      ].filter(Boolean)
    )

    if (orgIds.size === 0) {
      skipped.push({ c, reason: "brez zgodovine (brez termina/naročila)" })
      continue
    }
    if (orgIds.size > 1) {
      skipped.push({
        c,
        reason: `zgodovina pri ${orgIds.size} organizacijah — ne ugibamo`,
      })
      continue
    }

    const organizationId = [...orgIds][0]
    const phoneFromHistory =
      c.phone ??
      c.appointments.map((a) => a.guestPhone).find((p) => p && p.trim()) ??
      null

    claimable.push({ c, organizationId, phone: phoneFromHistory })
  }

  console.log(
    `Najdenih ${orphans.length} strank brez organizacije; prevzemljivih: ${claimable.length}, preskočenih: ${skipped.length}`
  )

  for (const { c, organizationId, phone } of claimable) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    })
    console.log(
      `→ ${c.name} <${c.email ?? "-"}> ⇒ ${org?.name ?? organizationId} (${org?.slug ?? "?"})${phone && !c.phone ? `, telefon: ${phone}` : ""}`
    )
    if (APPLY) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          organizationId,
          ...(phone && !c.phone ? { phone } : {}),
        },
      })
    }
  }

  for (const { c, reason } of skipped) {
    console.log(`· preskočeno: ${c.name} <${c.email ?? "-"}> — ${reason}`)
  }

  console.log(
    APPLY
      ? "Zapisano."
      : "Dry-run — za zapis zaženite: node scripts/backfill-customer-org.mjs --apply"
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
