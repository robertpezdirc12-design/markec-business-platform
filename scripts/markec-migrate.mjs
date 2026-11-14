// ============================================================
// MARKEC — varni migracijski orchestrator (F5.5.4.4.2y).
//
// Zagon je IZRECEN, ločen korak-tip: NI del `npm run build`.
// Pred vsakim posegom na obstoječi bazi najprej PREVERI celotno šemo
// (`prisma migrate diff --from-url → --to-schema-datamodel` mora biti
// prazen), nato posebej še Prisma-nevidne objekte (delni indeks
// DocumentPayment), ki jih ta diff NE pokriva.
//
// Načini:
//   FRESH     — popolnoma prazna baza → `prisma migrate deploy`
//               (aktivna mapa vsebuje izključno 00000000000000_baseline).
//   UPGRADE-A — baza zgrajena z `prisma db push`, brez _prisma_migrations.
//   UPGRADE-B — baza z obstoječo (delno) migracijsko zgodovino.
//
// Ne sme samodejno popravljati FAILED migracij: pri UPGRADE-B se
// pokaže `prisma migrate status` in se USTAVI, če ni čisto.
// Ne zaupamo zgolj tabeli "User" pri odločanju o stanju: upoštevamo
// število vseh baznih tabel + prisotnost _prisma_migrations + manifest
// pričakovanih jedrnih tabel; nejasno stanje = STOP (fail-closed).
//
// Uporaba:
//   node scripts/markec-migrate.mjs --database-url "<URL>" --mode fresh|upgrade
// Brez --mode skripta poskuša avtomatsko določiti mode, a vedno fail-closed.
// ============================================================

import { execFileSync, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma")
const PRISMA_BIN = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma")
const BASELINE_NAME = "00000000000000_baseline"
const DP_INDEX = "DocumentPayment_org_doc_ref_key"

const CORE_TABLES = ["Organization", "User", "Customer", "Service", "Product", "Appointment", "Order", "Document", "DocumentPayment"]

function prismaCmd(args, env = {}) {
  // .cmd shim requires shell:true on Windows; on POSIX execSync via shell is fine too.
  const cmd = `"${PRISMA_BIN}" ${args.map((a) => (a.includes(" ") || a.includes('"') ? `"${a.replace(/"/g, '\\"')}"` : a)).join(" ")}`
  return execSync(cmd, { encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], shell: true })
}

function parseUrl(argv) {
  const i = argv.findIndex((a) => a === "--database-url")
  if (i >= 0 && argv[i + 1]) return argv[i + 1]
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL ni podan (--database-url ali env)")
}
function dbName(url) {
  try {
    return new URL(url).pathname.replace(/^\//, "").split("?")[0]
  } catch {
    return "(unknown)"
  }
}

async function client(url) {
  const { PrismaClient } = await import("@prisma/client")
  return new PrismaClient({ datasources: { db: { url } } })
}

async function detectState(url) {
  const c = await client(url)
  try {
    const tbl = await c.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`)
    const total = tbl[0].n
    const rLedger = await c.$queryRawUnsafe(`SELECT to_regclass('public."_prisma_migrations"')::text AS t`)
    const hasLedger = !!rLedger[0].t
    const missing = []
    for (const t of CORE_TABLES) {
      const r = await c.$queryRawUnsafe(`SELECT to_regclass('public."${t}"')::text AS t`)
      if (!r[0].t) missing.push(t)
    }
    const idx = await c.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE tablename='DocumentPayment' AND indexname='${DP_INDEX}'`)
    return { total, hasLedger, missingCore: missing, dpIndex: idx.length > 0 }
  } finally {
    await c.$disconnect()
  }
}

function driftStatements(text) {
  return text.split(/\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("--") && !l.startsWith("/") && !l.startsWith("*")) .join("\n").trim()
}
function requireNoDrift(url) {
  const diff = prismaCmd(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", SCHEMA, "--script"], { DATABASE_URL: url })
  const d = driftStatements(diff)
  if (d) throw new Error("STOP: Prisma-vidni drift pred posegom:\n" + d.split("\n").slice(0, 25).join("\n"))
}

function log(...a) { console.log("[markec-migrate]", ...a) }

async function ensureDpIndex(url) {
  const c = await client(url)
  try {
    await c.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${DP_INDEX}" ON "DocumentPayment"("organizationId","documentId","reference") WHERE "reference" IS NOT NULL`
    )
  } finally {
    await c.$disconnect()
  }
}

async function baselineIsApplied(url) {
  const c = await client(url)
  try {
    const r = await c.$queryRawUnsafe(`SELECT count(*)::int n FROM "_prisma_migrations" WHERE migration_name=$1`, BASELINE_NAME)
    return r[0].n > 0
  } catch {
    return false
  } finally {
    await c.$disconnect()
  }
}

async function doFresh(url) {
  log("FRESH: prisma migrate deploy (baseline) …")
  prismaCmd(["migrate", "deploy", "--schema", SCHEMA], { DATABASE_URL: url })
  requireNoDrift(url)
  const s = await detectState(url)
  if (!s.dpIndex) throw new Error("FRESH verifikacija: manjka delni indeks DocumentPayment.")
  log("FRESH OK: shema + delni indeks, brez drifta.")
}

async function doUpgrade(url) {
  const state = await detectState(url)
  log("STATE tables=" + state.total + " ledger=" + state.hasLedger + " dpIndex=" + state.dpIndex)

  if (state.total > 0 && state.missingCore.length > 0) {
    throw new Error("STOP: baza ni prazna, manjkajo jedrne tabele: " + state.missingCore.join(", ") + ". Stanje ni enoznačno.")
  }

  // 1) fail-on-drift: celotna Prisma-vidna shema mora sovpadati.
  requireNoDrift(url)

  // 2) Prisma-nevidni delni indeks — preveri izrecno (diff ne zajame).
  if (!state.dpIndex) {
    log("DocumentPayment delni indeks manjka — ustvarjam (IF NOT EXISTS).")
    await ensureDpIndex(url)
  }

  // 3) UPGRADE-A vs B
  if (!state.hasLedger) {
    // bez _prisma_migrations (db push) — inicializiraj z resolve --applied
    log("UPGRADE-A: initializacija _prisma_migrations prek resolve --applied " + BASELINE_NAME)
    prismaCmd(["migrate", "resolve", "--applied", BASELINE_NAME, "--schema", SCHEMA], { DATABASE_URL: url })
  } else {
    // UPGRADE-B — ne samodejno popravljaj FAILED.
    log("UPGRADE-B: preverjam prisma migrate status …")
    let status = ""
    try { status = prismaCmd(["migrate", "status", "--schema", SCHEMA], { DATABASE_URL: url }) } catch (e) { status = (e.stdout || "") + (e.stderr || "") }
    const bad = !/up to date|no migrations|database schema is up to date/i.test(status)
    if (bad) {
      throw new Error(
        "STOP (UPGRADE-B): migrate status ni čist. FAILED/neuporabljene migracije popravite ročno (preglejte SQL in podatkovne učinke), nato ponovite.\n--- migrate status:\n" +
        status.split("\n").slice(0, 30).join("\n")
      )
    }
    if (!(await baselineIsApplied(url))) {
      log("UPGRADE-B: apply baseline marker (resolve --applied).")
      prismaCmd(["migrate", "resolve", "--applied", BASELINE_NAME, "--schema", SCHEMA], { DATABASE_URL: url })
    }
  }

  // 4) deploy — no-op/up-to-date ali pa le dodaj nove aditivne korake.
  log("UPGRADE: prisma migrate deploy …")
  prismaCmd(["migrate", "deploy", "--schema", SCHEMA], { DATABASE_URL: url })

  // 5) končna preverba
  requireNoDrift(url)
  const fin = await detectState(url)
  if (!fin.dpIndex) throw new Error("UPGRADE verifikacija: manjka delni indeks DocumentPayment.")
  log("UPGRADE OK: shema + delni indeks, brez drifta, podatki ohranjeni.")
}

async function main(argv) {
  const url = parseUrl(argv)
  const mi = argv.findIndex((a) => a === "--mode")
  const explicitMode = mi >= 0 ? argv[mi + 1] : null
  log("DB=" + dbName(url) + " mode=" + (explicitMode || "auto"))

  if (explicitMode === "fresh") { await doFresh(url); return }
  if (explicitMode === "upgrade") { await doUpgrade(url); return }
  if (explicitMode) throw new Error("Neznan --mode: " + explicitMode)

  const state = await detectState(url)
  if (state.total === 0 && !state.hasLedger) { await doFresh(url); return }
  if (state.total > 0) { await doUpgrade(url); return }
  if (state.total === 0 && state.hasLedger) {
    throw new Error("STOP (AMBIGUOUS): 0 tabel, a _prisma_migrations obstaja.")
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error("[markec-migrate] FAIL:", e.message)
  process.exit(1)
})