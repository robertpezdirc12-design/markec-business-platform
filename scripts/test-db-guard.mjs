// ============================================================
// MARKEC — test-DB varnostna vrata (2D-1F, utrjeno v 2D-1G).
//
// Za ta projekt dovoli zagon operacij izključno na pričakovanem
// izoliranem testnem okolju:
//   sch exaktno:
//     host     = localhost
//     port     = 5433
//     database = markec_e2e_test
//     user     = markec_e2e
//
// Uporablja pravilno razčlenjevanje URL-ja (WHATWG URL), ne regex.
// Preverja tudi DIRECT_URL (če je prisoten) in zavrne, če ni testni.
// NIkoli ne prepisuje .env; samo branje in fail-closed zavrnitev.
// ============================================================

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

// Edina dovoljena kombinacija za to okolje.
const EXPECTED = {
  protocol: "postgresql:",
  host: "localhost",
  port: "5433",
  database: "markec_e2e_test",
  user: "markec_e2e",
}

function fail(msg) {
  console.error(`[test-db-guard] ZAVRNJENO: ${msg}`)
  process.exit(2)
}

function checkSingleURL(kind, raw) {
  if (!raw) return // DIRECT_URL ni nujno nastavljen; če je, mora biti testni.
  let u
  try {
    u = new URL(raw)
  } catch {
    fail(`${kind} ni veljaven URL (ne izpisujem vsebine).`)
  }
  const port = u.port || (u.protocol === "postgresql:" ? "5432" : "")
  // Kriterij: vsi 4 elementi morajo točno sovpadati (fail-closed).
  const ok =
    u.protocol === EXPECTED.protocol &&
    u.hostname === EXPECTED.host &&
    port === EXPECTED.port &&
    decodeURIComponent(u.pathname.replace(/^\//, "")) === EXPECTED.database &&
    decodeURIComponent(u.username) === EXPECTED.user
  if (!ok) {
    fail(
      `${kind} ne kaže na pričakovano izolirano testno bazo ` +
        `(host=${EXPECTED.host}, port=${EXPECTED.port}, db=${EXPECTED.database}, user=${EXPECTED.user}). ` +
        "markec_dev in produkcija sta nedotakljiva."
    )
  }
  return u
}

function loadUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const env = readFileSync(resolve(root, ".env.test"), "utf8")
    const m = env.match(/^DATABASE_URL\s*=\s*"([^"]+)"/m) || env.match(/^DATABASE_URL\s*=\s*'([^']+)'/m)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return null
}

const dbUrl = loadUrl()
if (!dbUrl) {
  fail("DATABASE_URL ni nastavljen (niti v .env.test).")
}

const u = checkSingleURL("DATABASE_URL", dbUrl)
// MORE: preveri še neposredno geslo v URL (ne izpiši) — zgolj zato, da se
// ne poveže z napačno bazo, če je geslo napačno (nismo ga preverjali).
// (Gesla ne izpisujemo.)

// Preveri DIRECT_URL, če je podan (recimo za Prisma `directUrl`/shadow baze).
if (process.env.DIRECT_URL) {
  checkSingleURL("DIRECT_URL", process.env.DIRECT_URL)
}

console.log(
  `[test-db-guard] OK — testno okolje: host=${EXPECTED.host} port=${EXPECTED.port} db=${EXPECTED.database} user=${EXPECTED.user} (geslo izpuščeno).`
)
process.exit(0)