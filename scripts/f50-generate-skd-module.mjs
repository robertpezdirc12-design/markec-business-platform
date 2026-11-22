// F5.0 — generate the canonical SKD 2025 data module from the OFFICIAL
// SURS KLASJE XLSX (src/lib/skd/official/SKD_2025_V1.xlsx). This is a
// build-time import (not a runtime dependency on xlsx). Re-run after a
// SURS update to regenerate.
//
// Output: src/lib/skd/data/skd2025.ts   (full 5-level hierarchy, 1725 records)
//         src/lib/skd/data/skd-codes.ts   (codes-only, same 1725 codes — client-safe)
import { writeFileSync, mkdirSync } from "node:fs"
import ExcelJS from "exceljs"

const SRC = "src/lib/skd/official/SKD_2025_V1.xlsx"
const OUT = "src/lib/skd/data/skd2025.ts"
const OUT_CODES = "src/lib/skd/data/skd-codes.ts"
const CLASSIFICATION_ID = "SKD_2025"
const VERSION = "V1"
const SOURCE = "SURS KLASJE, Standardna klasifikacija dejavnosti 2025, V1 (Uradni list RS št. 27/2024)"

function levelOf(code) {
  if (!code.includes(".")) return code.length === 1 ? 1 : 2
  const groups = code.split(".")
  return 2 + groups[1].length
}

// P1 (audit 2026-11): `xlsx` (SheetJS CE) ima dve visoki ranljivosti brez
// popravka na npm-u (prototype pollution + ReDoS pri branju tujih datotek).
// Zamenjan z `exceljs`. Tveganje je bilo majhno (bere se datoteka iz repoja,
// ne od uporabnika), a odvisnost brez popravka ne sme ostati v projektu.
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(SRC)
const ws = wb.worksheets[0]
if (!ws) throw new Error(`Prazna delovna knjiga: ${SRC}`)
const rows = []
ws.eachRow({ includeEmpty: false }, (row) => {
  // Enako kot prej `sheet_to_json({ header: 1 })`: 1-D tabela celic po stolpcih.
  rows.push(row.values.slice(1).map((v) => (v == null ? null : v)))
})

const records = []
const codeSet = new Set()
for (const r of rows) {
  if (!Array.isArray(r)) continue
  const [code, , nameSL, nameEN] = r
  if (!code || typeof code !== "string" || code === "Šifra Kategorije") continue
  const c = code.trim()
  if (codeSet.has(c)) throw new Error(`duplicate code ${c}`)
  codeSet.add(c)
  records.push({
    c, // code
    l: levelOf(c), // level 1..5
    sl: String(nameSL ?? "").trim(), // official Slovenian name
    en: String(nameEN ?? "").trim(), // official English name
    p: (() => {
      const lev = levelOf(c)
      const i = c.lastIndexOf(".")
      if (i === -1) return lev === 2 ? c[0] : null // level 2 -> its section letter; level 1 -> null
      const prefix = c.slice(0, i)
      const suffix = c.slice(i + 1)
      const trimmed = suffix.length > 1 ? `${prefix}.${suffix.slice(0, suffix.length - 1)}` : prefix
      return trimmed
    })(),
  })
}

// Compact write: group by level into arrays for O(1) by-level listing; keep a
// flat full list too. Codes are unique; emit as nested literal.
function esc(s) {
  return JSON.stringify(s)
}
const lines = []
lines.push(`// ============================================================`)
lines.push(`// OFFICIAL SKD 2025 classification — generated file.`)
lines.push(`// Classification: ${CLASSIFICATION_ID} ${VERSION} (${SOURCE}).`)
lines.push(`// Records: ${records.length} (22 sections / 87 divisions / 287 groups /`)
lines.push(`//           651 classes / 678 subclasses).`)
lines.push(`//`)
lines.push(`// DO NOT EDIT BY HAND — regenerate with:`)
lines.push(`//   node scripts/f50-generate-skd-module.mjs`)
lines.push(`// ============================================================`)
lines.push(``)
lines.push(`export const SKD_CLASSIFICATION = ${esc(CLASSIFICATION_ID)}`)
lines.push(`export const SKD_VERSION = ${esc(VERSION)}`)
lines.push(`export const SKD_SOURCE = ${esc(SOURCE)}`)
lines.push(``)
lines.push(`export interface SkdRecord {`)
lines.push(`  /** classification code, e.g. "A", "A01", "A01.1", "A01.11", "A01.110" */`)
lines.push(`  c: string`)
lines.push(`  /** level 1=section .. 5=subclass */`)
lines.push(`  l: 1 | 2 | 3 | 4 | 5`)
lines.push(`  /** official Slovenian name */`)
lines.push(`  sl: string`)
lines.push(`  /** official English name */`)
lines.push(`  en: string`)
lines.push(`  /** parent code (null for sections) */`)
lines.push(`  p: string | null`)
lines.push(`}`)
lines.push(``)
lines.push(`/** All 1725 records, in official hierarchy order. */`)
lines.push(`export const SKD_RECORDS: SkdRecord[] = ${JSON.stringify(records, null, 1)}`)
lines.push(``)
// index helpers
lines.push(`const byCode = new Map<string, SkdRecord>(SKD_RECORDS.map((r) => [r.c, r]))`)
lines.push(`export const skdByCode = (code: string): SkdRecord | undefined => byCode.get(code)`)
lines.push(`export const SKD_TRUSTED = true`)
lines.push(``)
lines.push(`/** Fast level lists (each is a stable array of records). */`)
lines.push(`export const SKD_BY_LEVEL: Record<1|2|3|4|5, SkdRecord[]> = {`)
lines.push(`  1: SKD_RECORDS.filter((r) => r.l === 1),`)
lines.push(`  2: SKD_RECORDS.filter((r) => r.l === 2),`)
lines.push(`  3: SKD_RECORDS.filter((r) => r.l === 3),`)
lines.push(`  4: SKD_RECORDS.filter((r) => r.l === 4),`)
lines.push(`  5: SKD_RECORDS.filter((r) => r.l === 5),`)
lines.push(`}`)

mkdirSync("src/lib/skd/data", { recursive: true })
writeFileSync(OUT, lines.join("\n") + "\n")

// ============================================================
// Codes-only module — tiny, no names, for the CLIENT bundle.
//
// `profiles.ts` (and therefore the /start picker) only needs to know
// WHICH codes are authoritative in the official SKD 2025 catalog to gate
// resolver validity. It must NOT carry the full 1725-record dataset
// (~268 KB with official Slovenian/English names) into the initial client
// bundle. This module is a separate, compact array of the same official
// codes (same source XLSX, no descriptions) so it stays authoritative and
// tree-shakes fully away from SKD_RECORDS.
// ============================================================
const codesOut = []
codesOut.push(`// ============================================================`)
codesOut.push(`// OFFICIAL SKD 2025 classification -- CODES ONLY (generated file).`)
codesOut.push(`// Same source/determinism as skd2025.ts, but only the codes --`)
codesOut.push(`// no official names, no levels, no parents. Purpose: let client-safe`)
codesOut.push(`// modules (src/lib/skd/profiles.ts, catalog.ts) validate/catalog codes`)
codesOut.push(`// WITHOUT pulling the full 1725-record dataset (the official SURS XLSX)`)
codesOut.push(`// into the initial browser bundle.`)
codesOut.push(`//`)
codesOut.push(`// DO NOT EDIT BY HAND -- regenerate with:`)
codesOut.push(`//   node scripts/f50-generate-skd-module.mjs`)
codesOut.push(`// ============================================================`)
codesOut.push(``)
codesOut.push(`/** Every official SKD 2025 code (all 1725 codes, levels 1-5), in hierarchy order. */`)
codesOut.push(`export const SKD_CODES: ReadonlyArray<string> = ${JSON.stringify(records.map((r) => r.c))}`)
codesOut.push(``)
codesOut.push(`/** O(1) membership gate for resolver validity. */`)
codesOut.push(`const codesSet = new Set<string>(SKD_CODES)`)
codesOut.push(`export const isSkdCatalogCode = (code: string): boolean => codesSet.has(code)`)
writeFileSync(OUT_CODES, codesOut.join("\n") + "\n")

console.log(`wrote ${OUT} (${records.length} records): by level`,
  [1,2,3,4,5].map((l) => `${l}:${records.filter((r) => r.l === l).length}`).join(", "))
console.log(`wrote ${OUT_CODES} (codes-only, ${records.length} codes)`)