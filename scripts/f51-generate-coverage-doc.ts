// TEMPORARY generator for docs/SKD-2025-COMPLETE-COVERAGE.md
// Run: npx tsx scripts/f51-generate-coverage-doc.mjs
// Single source of truth = src/lib/skd/activity-coverage.ts (which itself
// derives from skd2025.ts + profiles.ts + registry.ts). This script only
// formats; it never edits source data.
import { activityCoverage, coverageSummary, type ProfileRuntime } from "../src/lib/skd/activity-coverage"
import { writeFileSync } from "node:fs"

const rows = activityCoverage()
const s = coverageSummary()

const LV = {
  "specialized-validated": { code: "A", label: "Specializirana in preverjena" },
  "validated-archetype": { code: "B", label: "Preverjena prek poslovnega arhetipa" },
  "validated-base": { code: "C", label: "Preverjena osnovna konfiguracija" },
  partial: { code: "D", label: "Nepopolna" },
  uncovered: { code: "E", label: "Nepokrita" },
}

const sectionNames: Record<string, string> = {
  A: "Kmetijstvo, lov, gozdarstvo, ribištvo", B: "Rudarstvo", C: "Predelovalne dejavnosti",
  D: "Oskrba z elektriko, plinom, paro", E: "Oskrba z vodo, ravnanje z odpadki",
  F: "Gradbeništvo", G: "Trgovina, vzdrževanje", H: "Promet in skladiščenje",
  I: "Gostinstvo", J: "Informacijske in komunikacijske dejavnosti", K: "Finančne in zavarovalniške",
  L: "Poslovanje z nepremičninami", M: "Strokovne, znanstvene in tehnične", N: "Druge poslovne",
  O: "Dejavnosti javne uprave", P: "Izobraževanje", Q: "Zdravstvo in socialno varstvo",
  R: "Kulturne, razvedrilne in rekreacijske", S: "Druge dejavnosti", T: "Dejavnosti gospodinjstev",
  U: "Dejavnosti organizacij", V: "Dejavnosti ekstrateritorialnih organizacij",
}
const sectionLetter = { A: true, B: true, C: true, D: true, E: true, F: true, G: true, H: true, I: true, J: true, K: true, L: true, M: true, N: true, O: true, P: true, Q: true, R: true, S: true, T: true, U: true, V: true }

const out = []
out.push("# SKD 2025 — POPOLNA POKRITOST DEJAVNOSTI (V1)")
out.push("")
out.push(`**Generirano:** ${new Date().toISOString()} — iz registerja \`src/lib/skd/activity-coverage.ts\`.`)
out.push(`**Vir:** ${s.classification} ${s.version} (SURS KLASJE). **Podrazredov:** ${s.total}.`)
out.push("")
out.push("> **Verodostojni vir:** ta dokument je *generiran* iz `agent_coverage` registerja in se ne ureja ročno.")
out.push("> Vsaka vrstica izhaja iz aktualnega resolverja (`src/lib/skd/profiles.ts`) in profilov (`src/lib/profiles/registry.ts`).")
out.push("")
out.push("## Pregled pokritosti")
out.push("")
out.push("| Nivo | Oznaka | Št. dejavnosti |")
out.push("|---|---|---|")
out.push(`| Specializirana in preverjena | A | ${s.byLevel["specialized-validated"]} |`)
out.push(`| Preverjena prek poslovnega arhetipa | B | ${s.byLevel["validated-archetype"]} |`)
out.push(`| Preverjena osnovna konfiguracija | C | ${s.byLevel["validated-base"]} |`)
out.push(`| Nepopolna | D | ${s.byLevel.partial} |`)
out.push(`| Nepokrita | E | ${s.byLevel.uncovered} |`)
out.push("")
out.push("## Po SKD-sekcijah (A–V)")
out.push("")
out.push("| Sekcija | Naziv | Skupaj | A | B | C | D | E |")
out.push("|---|---|---:|---:|---:|---:|---:|---:|")
for (const [letter, data] of Object.entries(s.bySection)) {
  out.push(`| ${letter} | ${sectionNames[letter] ?? ""} | ${data.total} | ${data.byLevel["specialized-validated"] ?? 0} | ${data.byLevel["validated-archetype"] ?? 0} | ${data.byLevel["validated-base"] ?? 0} | ${data.byLevel.partial ?? 0} | ${data.byLevel.uncovered ?? 0} |`)
}
out.push("")
out.push("## Po profilu (efektivna preslikava)")
out.push("")
out.push("| Profil | Št. dejavnosti | Tip |")
out.push("|---|---|---|")
for (const [pid, n] of Object.entries(s.byProfile).sort((a, b) => b[1] - a[1])) {
  out.push(`| ${pid} | ${n} | ${pid.startsWith("skd-") ? "sekcija" : "specializiran"} |`)
}
out.push("")
out.push("## Celoten register (678 podrazredov)")
out.push("")
out.push("| SKD | Slovensko | Angleško | Sek | Oddelek | Profil | Nivo | Forme | Procesi | Razšir. |")
out.push("|---|---|---|---|---|---|---:|---:|---:|---:|")
for (const r of rows) {
  const lv = LV[r.coverageLevel]
  const rt: ProfileRuntime = r.runtime ?? { forms: 0, workflows: 0, extensions: 0, dashboardWidgets: 0 }
  out.push(`| ${r.code} | ${r.sl} | ${r.en} | ${r.section} | ${r.division} | ${r.profileId} | **${lv.code}** | ${rt.forms ?? 0} | ${rt.workflows ?? 0} | ${rt.extensions ?? 0} |`)
}
out.push("")
out.push("---")
out.push("")
out.push("## Metodologija")
out.push("")
out.push("- **A (specializirana):** podrazred ima eksplicitno ročno preslikavo (SUBCLASS_PROFILE/DIVISION_PROFILE) na profil z dejanskim runtime (≥1 forma + ≥1 workflow ali razširitev).")
out.push("- **B (arhetip):** podrazred se razreši na profil, ki ima realne procese/form, a ni ročno dodeljen po podrazredih (npr. skd-f-construction).")
out.push("- **C (osnovna):** podrazred se razreši na sekcijski profiltod a profil nima posebnih form/procesov (danes: 638 dejavnosti).")
out.push("- **D (nepopolna):** evidentirana izjema/krožna vrzel (npr. S92 igre na srečo).")
out.push("- **E (nepokrita):** okvara resolverja — pri ACTUAL nemu stanju 0.")
out.push("")
out.push("> **Stanje D in E nista sprejemljiv končni cilj.** Stanje C je dovoljeno samo z dokumentirano poslovno")
out.push("> utemeljitvijo (vsak tak podrazred ima v registerju `runtime` = nič, kar je samo meritev — ne odobritev).")
writeFileSync("docs/SKD-2025-COMPLETE-COVERAGE.md", out.join("\n"), "utf8")
console.log(`Wrote docs/SKD-2025-COMPLETE-COVERAGE.md (${rows.length} rows)`)