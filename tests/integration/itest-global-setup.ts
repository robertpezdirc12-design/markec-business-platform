// ============================================================
// globalSetup za vitest.itest.config.ts — IDEMPOTENTNI FIXTUREJI.
//
// Nekateri integracijski testi (f2-3 entity-reference / colony-move,
// f635 READ IDOR) pričakujejo f631 fixture: 4 testne organizacije
// z lastniki (mk/fr/si/cb @f631.test). Ta setup jih pred zagonom
// testov ZAGOTOVI (manjkajoče ustvari, obstoječih NE briše in NE
// spreminja) — testi so zato deterministični ne glede na stanje baze.
//
// Prav tako požene suite-seed fixturje:
//   - f2-1/org-isolation → org + uporabniki `f21-*` (tests/integration/f2-1/seed.mjs)
//   - f51/promotions     → org/izdelki/promocije `f51-*` (tests/integration/f51/seed.mjs)
// Oba seeda sta idempotentna in brišeta LE lastne `f21-*`/`f51-*` vrstice.
//
// Varnostno (fail-closed): sme teči LE na izolirani testni bazi —
// host localhost in ime baze s končnico `_test`. markec_dev in
// produkcija sta nedotakljiva. Pred zagonom testov ga požene že
// scripts/run-with-test-db.mjs (lasten guard), to je druga plast.
// ============================================================

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { prisma } from "../../src/lib/prisma"

const FIXTURES = [
  {
    slug: "mehanik-test",
    name: "Avtomehanika Test",
    vertical: "mehanik",
    ownerName: "Marko Mehanik",
    ownerEmail: "mk@f631.test",
  },
  {
    slug: "frizer-test",
    name: "Frizerski salon Test",
    vertical: "frizer",
    ownerName: "Ana Frizerka",
    ownerEmail: "fr@f631.test",
  },
  {
    slug: "sivilja-test",
    name: "Šiviljski atelje Test",
    vertical: "seamstress",
    ownerName: "Maja Šivilja",
    ownerEmail: "si@f631.test",
  },
  {
    slug: "cebelar-test",
    name: "Čebelarstvo Test",
    vertical: "beekeeping",
    ownerName: "Tone Čebelar",
    ownerEmail: "cb@f631.test",
  },
] as const

function assertTestDb() {
  const raw = process.env.DATABASE_URL ?? ""
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error("[itest-fixtures] ZAVRNJENO: DATABASE_URL ni veljaven URL.")
  }
  const db = decodeURIComponent(u.pathname.replace(/^\//, ""))
  const allowedDb = db.endsWith("_test") || db.endsWith("_it")
  if (u.hostname !== "localhost" || !allowedDb) {
    throw new Error(
      `[itest-fixtures] ZAVRNJENO: dovoljena le izolirana testna baza (localhost, *_test/*_it), povezan na ${u.hostname}/${db}.`
    )
  }
}

export default async function setup() {
  assertTestDb()

  // Suite-seedi (f2-1, f51) — vsak zavarovan z lastnim guardom.
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (const seed of ["../integration/f2-1/seed.mjs", "../integration/f51/seed.mjs"]) {
    const r = spawnSync(process.execPath, [path.resolve(here, seed)], {
      stdio: "inherit",
      env: process.env,
    })
    if (r.status !== 0) throw new Error(`[itest-fixtures] seed ${seed} ni uspel (exit ${r.status})`)
  }

  for (const spec of FIXTURES) {
    const org = await prisma.organization.upsert({
      where: { slug: spec.slug },
      create: {
        slug: spec.slug,
        name: spec.name,
        vertical: spec.vertical,
        status: "ACTIVE",
        publishState: "PUBLISHED",
      },
      update: {}, // obstoječe org ne spreminjamo
    })

    const user = await prisma.user.upsert({
      where: { email: spec.ownerEmail },
      create: {
        name: spec.ownerName,
        email: spec.ownerEmail,
        // Ni za prijavo (f631 konvencija) — obstoj lastnika zadostuje za org.
        password: "itest-fixture-password",
        role: "ADMIN",
        emailVerified: new Date(),
        organizationId: org.id,
      },
      update: {}, // obstoječih uporabnikov ne spreminjamo
    })

    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id, role: "ADMIN", isDefault: true },
      update: {},
    })

    await prisma.staff.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      create: {
        name: spec.ownerName,
        email: spec.ownerEmail,
        bio: `Lastnik in izvajalec storitev (itest fixture).`,
        isActive: true,
        userId: user.id,
        organizationId: org.id,
      },
      update: {},
    })
  }

  await prisma.$disconnect()
}
