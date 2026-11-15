#!/usr/bin/env node
/**
 * Preveri, ali se shema Neon `preview` veje razlikuje od `main`.
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
 * Uporaba:
 *   NEON_API_KEY=... node scripts/check-preview-schema-drift.mjs
 *
 * Okoljske spremenljivke (neobvezne):
 *   DRIFT_PROJECT_ID      privzeto bold-cell-76839441
 *   DRIFT_DB_NAME         privzeto neondb
 *   DRIFT_PREVIEW_BRANCH  privzeto preview
 *
 * Izhodne kode: 0 = ni odmika, 1 = odmik (sinhroniziraj vejo), 2 = napaka API/konfiguracije.
 */

const API = "https://console.neon.tech/api/v2"
const KEY = process.env.NEON_API_KEY
const PROJECT_ID = process.env.DRIFT_PROJECT_ID || "bold-cell-76839441"
const DB_NAME = process.env.DRIFT_DB_NAME || "neondb"
const PREVIEW_NAME = process.env.DRIFT_PREVIEW_BRANCH || "preview"

if (!KEY) {
  console.error(
    "[schema-drift] Manjka NEON_API_KEY. Skript je berljiv, a zahteva Neon API ključ z dostopom do projekta.",
  )
  process.exit(2)
}

async function get(path) {
  const res = await fetch(API + path, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
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
  const { branches = [] } = await get(`/projects/${PROJECT_ID}/branches`)
  const main = branches.find((b) => b.primary) || branches.find((b) => b.name === "main")
  const preview = branches.find((b) => b.name === PREVIEW_NAME)

  if (!main || !preview) {
    console.error(
      `[schema-drift] Projekt ${PROJECT_ID}: manjka veja main ali ${PREVIEW_NAME}. Najdene: ${branches
        .map((b) => b.name)
        .join(", ") || "(nobena)"}.`,
    )
    return 2
  }

  const query = new URLSearchParams({
    base_branch_id: main.id,
    db_name: DB_NAME,
  })
  const result = await get(
    `/projects/${PROJECT_ID}/branches/${preview.id}/compare_schema?${query}`,
  )
  const diff =
    typeof result.diff === "string" ? result.diff : JSON.stringify(result.diff ?? "")

  if (diff.trim() === "" || diff.trim() === '""') {
    console.log(
      `[schema-drift] OK — shema veje ${PREVIEW_NAME} (${preview.id}) se ujema z main (${main.id}), db=${DB_NAME}.`,
    )
    return 0
  }

  console.error(
    `[schema-drift] ODMIK — ${PREVIEW_NAME} zaostaja za main. Pred uporabo Preview deploya sinhroniziraj vejo (docs/DEPLOYMENT-DB-ISOLATION.md, §4).`,
  )
  console.error(diff.slice(0, 8000))
  if (diff.length > 8000) console.error(`... (odrezano, skupno ${diff.length} znakov)`)
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[schema-drift] Napaka: ${err.message}`)
    process.exit(2)
  })
