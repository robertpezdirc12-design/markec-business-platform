// GENERATOR for docs/SKD-2025-COMPLETE-COVERAGE.md
//
// Edini ukaz, ki je dejansko preizkušen in velja:
//   pnpm exec tsx scripts/f51-generate-coverage-doc.ts
//
// Vir resnice = src/lib/skd/activity-coverage.ts (ki sam izhaja iz
// skd2025.ts + profiles.ts + registry.ts). Ta skript samo oblikuje;
// NIKOLI ne ureja izvornih podatkov in ne vsebuje ročnih številk.
import {
  activityCoverage,
  coverageSummary,
} from "../src/lib/skd/activity-coverage"
import { SKD_SECTIONS } from "../src/lib/skd/catalog"
import { writeFileSync } from "node:fs"

const rows = activityCoverage()
const s = coverageSummary()

// Uradni nazivi sekcij IZ ISTEGA vira kot preostala aplikacija
// (catalog.ts → SKD_SECTIONS), ne iz ročne tabele v tej skripti.
const sectionNames: Record<string, string> = {}
for (const sec of SKD_SECTIONS) sectionNames[sec.code] = sec.name

const LV = {
  A: "Specializirana in preverjena",
  B: "Preverjena prek podrazredno-specifičnega arhetipa",
  C: "Preverjena osnovna konfiguracija",
  D: "Nepopolna",
  E: "Nepokrita",
  NA: "Ni ocenjeno",
}

const COV = {
  "specialized-validated": "A",
  "validated-archetype": "B",
  "validated-base": "C",
  partial: "D",
  uncovered: "E",
}

const out: string[] = []
out.push("# SKD 2025 — REGISTER POKRITOSTI DEJAVNOSTI")
out.push("")
out.push(`**Generirano:** ${new Date().toISOString()} — iz registerja \`src/lib/skd/activity-coverage.ts\`.`)
out.push(`**Vir:** ${s.classification} ${s.version} (SURS KLASJE). **Podrazredov:** ${s.total}.`)
out.push("")
out.push("> **Verodostojni vir:** ta dokument je *generiran* in se ne ureja ročno.")
out.push("> Vsaka vrstica izhaja iz resolverja (`src/lib/skd/profiles.ts`) in profilov (`src/lib/profiles/registry.ts`).")
out.push("> Nazivi sekcij prihajajo iz `src/lib/skd/catalog.ts` → `SKD_SECTIONS`.")
out.push("")
out.push("## Pregled pokritosti")
out.push("")
out.push("| Nivo | Oznaka | Št. dejavnosti |")
out.push("|---|---|---|")
out.push(`| ${LV.A} | A | ${s.byLevel.specializedValidated} |`)
out.push(`| ${LV.B} | B | ${s.byLevel.validatedArchetype} |`)
out.push(`| ${LV.C} | C | ${s.byLevel.validatedBase} |`)
out.push(`| ${LV.D} | D | ${s.byLevel.partial} |`)
out.push(`| ${LV.E} | E | ${s.byLevel.uncovered} |`)
out.push(`| ${LV.NA} | — | ${s.byLevel.notAssessed} |`)
out.push("")
out.push(`**Ocenjeno:** ${s.assessed} · **Ni ocenjeno (not-assessed):** ${s.notAssessed} · **Skupaj:** ${s.total}`)
out.push("")
out.push("## Preslikava (viri preslikave)")
out.push("")
out.push("| Vir | Št. podrazredov |")
out.push("|---|---:|")
for (const [k, n] of Object.entries(s.byMapping)) out.push(`| \`${k}\` | ${n} |`)
out.push("")
out.push("## Po SKD-sekcijah (A–V)")
out.push("")
out.push("| Sekcija | Naziv | Skupaj | A | B | C | D | E | Ni ocenjeno |")
out.push("|---|---|---:|---:|---:|---:|---:|---:|---:|")
for (const sec of SKD_SECTIONS) {
  const d = s.bySection[sec.code]
  if (!d) continue
  out.push(`| ${sec.code} | ${sec.name} | ${d.total} | ${d.byLevel.specializedValidated} | ${d.byLevel.validatedArchetype} | ${d.byLevel.validatedBase} | ${d.byLevel.partial} | ${d.byLevel.uncovered} | ${d.byLevel.notAssessed} |`)
}
out.push("")
out.push(`**Skupaj (po sekcijah):** ${SKD_SECTIONS.reduce((acc, sec) => acc + (s.bySection[sec.code]?.total ?? 0), 0)}`)
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
out.push("| SKD | Slovensko | Sek | Oddelek | Profil | Vir preslikave | Oznaka | Forme | Procesi | Razširitve | Runtime eviden. | Status |")
out.push("|---|---|---|---|---|---|---|---|---|---|---|---|")
for (const r of rows) {
  const code: string = r.coverageLevel ? (COV[r.coverageLevel] ?? "NA") : "NA"
  out.push(`| ${r.code} | ${r.sl} | ${r.section} | ${r.division} | ${r.profileId} | ${r.mappingSource} | **${code}** | ${r.declared.forms} | ${r.declared.workflows} | ${r.declared.extensions} | ${r.runtimeEvidence ? "da" : "—"} | ${r.assessmentStatus} |`)
}
out.push("")
out.push("---")
out.push("")
out.push("## Metodologija (pošteno, brez izmišljanja dokazil)")
out.push("")
out.push("- **A (specializirana):** izrecna preslikava podrazreda/oddelka (subclass-override/division-override) na profil z DOKAZANIM, PROFIL-SPECIFIČNIM runtime-evidence (strežniške akcije + test, ki poganja prav ta profil skozi materializacijo). Dokaz iz DRUGEGA profila (npr. `seamstress` → `apparel`) NI zadosten.")
out.push("- **B (arhetip):** podrazredna, koda-po-kodi preslikava na profil, katerega poslovno jedro res služi prav ta podrazred. NIKAKRŠNA samodejna promocija celotne sekcije za obstoj obrazca (ovaleno v PR #142).")
  out.push("- **C (osnovna konfiguracija):** dokumentirano, da osnovna konfiguracija zadostuje (npr. `workOrders: required` krije splošno izvedbo). NIKOLI samodejno za `forms==0`.")
  out.push("- **D (nepopolna):** preslikava obstaja, a zahtevana zmožnost (iz nabora `appointments, workOrders, shop, services, inventory, customers, staff, analytics, forms, workflows, documents, delivery, cashRegister`) ni dokazana (npr. forms/workflows `required` s 0 predlog, ali `documents/delivery/cashRegister` zahtevan zunaj univerzalnega jedra), ali je zapisana izjema (npr. S92).")
  out.push("- **E (nepokrita):** resolver je padel na generični fallback (neobstoječa ali oblikovno-varljiva koda ni predstavljena kot veljavna).")
  out.push("- **Not assessed (ni ocenjeno):** preslikava obstaja (sekcijski privzetek), a le z runtime-evidence iz DRUGEGA profila ali brez profil-specifičnega dokaza, da prav ta podrazred res pokriva; cele sekcija (npr. gradbeništvo) se NE dvigne na nivo samo zato, ker en obrazec obstaja. To NI nivo — to je odkrito »preveri«.")
out.push("")
out.push("> **Deklaracija ≠ runtime.** Stolpci Forme/Procesi/Razširitve prikazujejo **deklarirano konfiguracijo** (`declaredConfiguration`),")
out.push("> ne delujočega procesa. \`extensions\` se NUJNO obravnavajo kot deklaracija (niso materializirane — var. `materialize.ts`).")
out.push("> Stolpec **Runtime eviden.** je \`da\` le, kadar register nosi reference na strežniške akcije + test datoteke.")
out.push("")
writeFileSync("docs/SKD-2025-COMPLETE-COVERAGE.md", out.join("\n"), "utf8")
console.log(`Wrote docs/SKD-2025-COMPLETE-COVERAGE.md (${rows.length} rows)`)