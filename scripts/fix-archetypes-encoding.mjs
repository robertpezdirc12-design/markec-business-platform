// Repair docs/SKD-2025-ARCHETYPES.md: it was saved with a broken
// double-encoded UTF-8 (UTF-8 bytes re-decoded as legacy code page and stored
// back), producing mojibake like "â€”" / "ÄŤ" / "Ĺˇ" plus a leading BOM.
// Fix = apply the exact byte-sequence substitution to the correct characters,
// strip the BOM, and write back as clean UTF-8. Also correct the G47.7 row
// mislabelling (motor vehicles are G47.81–83 and fuel G47.301/302, not G47.7).
//
// Run: npx tsx scripts/fix-archetypes-encoding.mjs
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const file = resolve("docs/SKD-2025-ARCHETYPES.md")
let text = readFileSync(file, "utf8")

// Mojibake → correct UTF-8 (longest tokens first so sub-strings don't clobber).
const REPAIRS = [
  ["â€”", "—"], // em dash
  ["â€“", "–"], // en dash
  ["â€ž", "„"], // low quote
  ["â€ť", "”"], // right double quote
  ["â€¦", "…"], // ellipsis
  ["â†’", "→"], // right arrow
  ["Â»", "»"],
  ["Â«", "«"],
  ["ÄŚ", "Č"],
  ["ÄŤ", "č"],
  ["Ĺ\u00A0", "Š"], // Ĺ + U+00A0 (non-breaking space) — the actual byte pattern in the doc
  ["Ĺ ", "Š"], // capital S with caron (followed by ordinary space)
  ["Ĺˇ", "š"],
  ["Ĺ˝", "Ž"],
  ["Ĺľ", "ž"],
]

for (const [from, to] of REPAIRS) text = text.split(from).join(to)
// strip any leading BOM (U+FEFF)
text = text.replace(/^\uFEFF/, "")

// G47.7 row fix (audit finding): buses/cars are G47.81–83, fuel G47.301/302,
// NOT G47.7 (which is clothing/shoes/pharma). Correct the label so it doesn't
// borrow the wrong SKD code, and note it resolves to generic retail today.
text = text.replace(
  /G47\.7 (posebni\s*)?\(.*avtomobili.*gorivo.*\)/i,
  "G47.30 + G47.81–83 (gorivo, motorna vozila) — danes `trade-retail`",
)

writeFileSync(file, text, "utf8")
console.log(`Repaired ${file}`)

// Verify: no mojibake signatures left, BOM gone, no stray U+00A0, key phrases correct.
const leftovers = [
  ...text.matchAll(/â€|Ä[\u010dŚŤ\u010c]|Ĺ[\u0139ˇľ\u017d\u017d]|\u00A0|^\uFEFF/g),
]
if (leftovers.length > 0) {
  console.error("FAIL: mojibake/nbsp/BOM still present:", leftovers.length, JSON.stringify(leftovers[0][0]))
  process.exitCode = 1
}
for (const phrase of ["Poslovni arhetipi", "že razvrščenih", "opiše možne", "označeno"]) {
  if (!text.includes(phrase)) console.log("WARN missing phrase:", phrase)
}
console.log("G47 label now:", /G47\.30 \+ G47\.81/.test(text) ? "OK" : "FIX-MISSING")