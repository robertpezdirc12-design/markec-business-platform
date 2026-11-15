#!/usr/bin/env node
/**
 * Preveri, ali se APLIKACIJSKA shema Neon `preview` veje razlikuje od `main`.
 *
 * ZAKAJ: Vercel Preview buildi namerno preskakujejo `prisma migrate deploy`
 * (glej `shouldRunMigrations` v scripts/migrate-with-retry.mjs). Produkcijski
 * deploy zato sčasoma aplicira migracije, ki jih `preview` veja ne dobi, in
 * PR z novo migracijo sicer uspešno zgradi, a v času izvajanja pade.
 *
 * Skript je IZKLJUČNO berljiv (GET). Ne piše v bazo, ne spreminja vej in
 * ne potrebuje Vercel žetona. Uporabi ga pred odpiranjem PR-ja z migracijo
 * in po vsakem produkcijskem deployu.
 *
 * Neon sam spreminja interno shemo `neon_auth` (npr. doda stolpec v
 * `neon_auth.project_config`). Ta shema ni del Prisma modela in aplikacija
 * je ne bere, zato takšna razlika NI odmik aplikacijske sheme. Ko je surovi
 * `compare_schema` diff neprazen, skript primerja podpisa celotnih
 * pg_dump shem po izločitvi vseh `neon_auth` objektov. Če se podpisa
 * ujemata, razliko ignorira. Z `--strict` se obnaša po starem: vsak diff
 * pomeni odmik.
 *
 * Uporaba:
 *   NEON_API_KEY=... node scripts/check-preview-schema-drift.mjs
 *   NEON_API_KEY=... node scripts/check-preview-schema-drift.mjs --strict
 *
 * Okoljske spremenljivke (neobvezne):
 *   DRIFT_PROJECT_ID      privzeto bold-cell-76839441
 *   DRIFT_DB_NAME         privzeto neondb
 *   DRIFT_PREVIEW_BRANCH  privzeto preview
 *   DRIFT_STRICT=1        enako kot --strict
 *
 * Izhodne kode: 0 = aplikacijski shemi se ujemata, 1 = odmik, 2 = napaka API/konfiguracije.
 */

import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"

const API = "https://console.neon.tech/api/v2"
const IGNORED_SCHEMAS = ["neon_auth"]

/**
 * Odstrani vse pg_dump bloke, katerih glava pravi `Schema: <ignorirana shema>`.
 * Neonov pg_dump vsak objekt uvaja z vrstico
 * `-- Name: X; Type: TABLE; Schema: public; Owner: ...`.
 * Čisti (izvozljivi) funkciji — uporablja jo tudi testna suite.
 */
export function stripIgnoredSchemas(sql, ignored = IGNORED_SCHEMAS) {
  const lines = String(sql ?? "").split("\n")
  const kept = []
  let skipping = false
  for (const line of lines) {
    if (/^-- Name: .*; Type: .*; Schema: /.test(line)) {
      skipping = ignored.some((schema) => line.includes(`Schema: ${schema};`))
    }
    if (!skipping) kept.push(line)
  }
  return kept.join("\n")
}

/** Zgoščevina aplikacijske sheme; primerjava dveh vej je primerjava teh podpisov. */
export function appSchemaSignature(sql, ignored = IGNORED_SCHEMAS) {
  const normalized = stripIgnoredSchemas(sql, ignored)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
  return createHash("sha256").update(normalized).digest("hex")
}

/** Ali je surovi `compare_schema` odziv sploh kaj razlike. */
export function hasSchemaDiff(diff) {
  const text = typeof diff === "string" ? diff : JSON.stringify(diff ?? "")
  return text.trim() !== "" && text.trim() !== '""'
}

/**
 * Čista odločitev: ali naj skript javi odmik.
 * `appSchemaEqual` je `undefined`, če podpisov ni bilo mogoče izračunati —
 * takrat odpovemo varno (fail-closed) in javimo odmik.
 */
export function shouldFlagDrift({ diff, appSchemaEqual, strict = false }) {
  if (!hasSchemaDiff(diff)) return false
  if (strict) return true
  return appSchemaEqual !== true
}

async function get(path, key) {
  const res = await fetch(API + path, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(40_000),
  })
  const text = await res.text()
  let body = {}
  try {
    body = JSON.parse(text)
  } catch {
    // Neon lahko vrže ne-JSON odgovor ob napaki prehoda; sporočilo obravnavamo spodaj.
  }
  if (!res.ok) {
    const reason = body.message || body.code || text.slice(0, 200) || res.statusText
    throw new Error(`HTTP ${res.status}: ${reason}`)
  }
  return body
}

async function main() {
  const key = process.env.NEON_API_KEY
  if (!key) {
    console.error(
      "[schema-drift] Manjka NEON_API_KEY. Skript je berljiv, a zahteva Neon API ključ z dostopom do projekta.",
    )
    return 2
  }

  const projectId = process.env.DRIFT_PROJECT_ID || "bold-cell-76839441"
  const dbName = process.env.DRIFT_DB_NAME || "neondb"
  const previewName = process.env.DRIFT_PREVIEW_BRANCH || "preview"
  const strict =
    process.argv.includes("--strict") || process.env.DRIFT_STRICT === "1"

  const { branches = [] } = await get(`/projects/${projectId}/branches`, key)
  const mainBranch =
    branches.find((b) => b.primary) || branches.find((b) => b.name === "main")
  const preview = branches.find((b) => b.name === previewName)

  if (!mainBranch || !preview) {
    console.error(
      `[schema-drift] Projekt ${projectId}: manjka veja main ali ${previewName}. Najdene: ${branches
        .map((b) => b.name)
        .join(", ") || "(nobena)"}.`,
    )
    return 2
  }

  const compareQuery = new URLSearchParams({
    base_branch_id: mainBranch.id,
    db_name: dbName,
  })
  const result = await get(
    `/projects/${projectId}/branches/${preview.id}/compare_schema?${compareQuery}`,
    key,
  )
  const diff =
    typeof result.diff === "string" ? result.diff : JSON.stringify(result.diff ?? "")

  if (!hasSchemaDiff(diff)) {
    console.log(
      `[schema-drift] OK — shema veje ${previewName} (${preview.id}) se ujema z main (${mainBranch.id}), db=${dbName}.`,
    )
    return 0
  }

  if (strict) {
    console.error("[schema-drift] ODMIK (--strict): surovi diff je neprazen.")
    console.error(diff.slice(0, 8000))
    return 1
  }

  let appSchemaEqual
  try {
    const [mainDump, previewDump] = await Promise.all([
      get(
        `/projects/${projectId}/branches/${mainBranch.id}/schema?db_name=${encodeURIComponent(dbName)}`,
        key,
      ),
      get(
        `/projects/${projectId}/branches/${preview.id}/schema?db_name=${encodeURIComponent(dbName)}`,
        key,
      ),
    ])
    appSchemaEqual =
      appSchemaSignature(mainDump.sql ?? "") ===
      appSchemaSignature(previewDump.sql ?? "")
  } catch (err) {
    console.error(
      `[schema-drift] Surovi diff je neprazen, aplikacijske sheme pa ni mogoče preveriti (${err.message}). Ne domnevam ujemanja — preveri ročno ali ponovi.`,
    )
    return 2
  }

  if (!shouldFlagDrift({ diff, appSchemaEqual, strict: false })) {
    const ignored = IGNORED_SCHEMAS.join(", ")
    console.log(
      `[schema-drift] OK — aplikacijska shema (public) veje ${previewName} se ujema z main.`,
    )
    console.log(
      `[schema-drift] Surovi ${diff.length}-znakovni diff je izključno v interni shemi ${ignored} in je ignoriran (aplikacija je ne bere).`,
    )
    console.log(
      `[schema-drift] Prve vrstice ignoriranega diffa: ${diff
        .split("\n")
        .slice(0, 3)
        .join(" | ")
        .slice(0, 220)}`,
    )
    console.log("[schema-drift] Za celoten surovi diff uporabi --strict.")
    return 0
  }

  console.error(
    `[schema-drift] ODMIK — aplikacijska shema veje ${previewName} se razlikuje od main. Pred uporabo Preview deploya sinhroniziraj vejo (docs/DEPLOYMENT-DB-ISOLATION.md, §4).`,
  )
  console.error(diff.slice(0, 8000))
  if (diff.length > 8000)
    console.error(`... (odrezano, skupno ${diff.length} znakov)`)
  return 1
}

// Ob uvozu iz testov se CLI ne sme zagnati (in ne sme zahtevati NEON_API_KEY).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`[schema-drift] Napaka: ${err.message}`)
      process.exit(2)
    })
}
