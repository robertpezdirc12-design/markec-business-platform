// GENERATOR for docs/SKD-2025-COMPLETE-COVERAGE.md
//
// Edini ukaz, ki je dejansko preizkušen in velja:
//   pnpm exec tsx scripts/f51-generate-coverage-doc.ts
//
// Vir resnice = src/lib/skd/activity-coverage.ts (ki sam izhaja iz
// skd2025.ts + profiles.ts + registry.ts). Ta skript samo oblikuje;
// NIKOLI ne ureja izvornih podatkov in ne vsebuje ročnih številk.
//
// `buildCoverageDocMarkdown` je čista funkcija (deterministična pri
// danem žigu), zato jo testi (tests/activity-coverage.test.ts, §9)
// uporabijo za uskladitev dokumenta z registerjem in preverjanje
// števila stolpcev v tabelah.
import {
  activityCoverage,
  coverageSummary,
} from "../src/lib/skd/activity-coverage"
import { SKD_SECTIONS } from "../src/lib/skd/catalog"
import { writeFileSync } from "node:fs"

/**
 * Zgradi celotno Markdown vsebino registra.
 * `nowIso` je parameter (ne `new Date()` znotraj), da je funkcija
 * deterministična in testirčna; klic iz CLI uporabi trenutni čas.
 */
export function buildCoverageDocMarkdown(nowIso: string = new Date().toISOString()): string {
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
  out.push(`**Generirano:** ${nowIso} — iz registerja \`src/lib/skd/activity-coverage.ts\`.`)
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
  out.push("### Poslovna ustreznost (fit), ločena od pokritosti zmožnosti")
  out.push("")
  out.push("| Fit | Št. dejavnosti |")
  out.push("|---|---:|")
  out.push(`| Preverjena (profil-specifičen test dokazuje, da profil res služi to dejavnost) | ${s.byFit.verified} |`)
  out.push(`| Ni preverjena (not-assessed — section-default/deklaracija NI dokaz fitness) | ${s.byFit.notAssessed} |`)
  out.push("")
  out.push("> **Fit ≠ pokritost zmožnosti.** Vrstica lahko ima `Status=assessed`, `Oznaka=D`, vendar `Fit=not-assessed`: ocena pokritosti zmožnosti je preverila evidence-gap, NI pa profil-specifične skladnosti dejavnosti. `Fit=verified` le za A/B (runtime+dokaz, ki poganja prav ta profil).")
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
  out.push(`## Celoten register (${rows.length} podrazredov)`)
  out.push("")
  out.push("> **Status = »assessed« pomeni: opravljena je bila ocena POKRITOSTI ZMOŽNOSTI (razred A–E), ki je za `section-default` vrstice pokazala vrzel (D).**")
  out.push("> Ne pomeni, da je bila preverjena SKLADNOST dejavnosti (fit) — `section-default` podrazredi so `fit` **not-assessed** in imajo lahko 0 obrazcev, 0 procesov, 0 razširitev, kljub oznaki D.")
  out.push("")
  const registerHeader =
    "| SKD | Slovensko | Sek | Oddelek | Profil | Vir preslikave | Oznaka | Forme | Procesi | Razširitve | Runtime eviden. | Status | Fit |"
  out.push(registerHeader)
  // Razdalčnica mora imeti TOČNO toliko celic kot glava (13).
  // Revija PR #142: prej je imela 12 → Markdown tabele niso pravilno renderirane.
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
  for (const r of rows) {
    const code: string = r.coverageLevel ? (COV[r.coverageLevel] ?? "NA") : "NA"
    out.push(`| ${r.code} | ${r.sl} | ${r.section} | ${r.division} | ${r.profileId} | ${r.mappingSource} | **${code}** | ${r.declared.forms} | ${r.declared.workflows} | ${r.declared.extensions} | ${r.runtimeEvidence ? "da" : "—"} | ${r.assessmentStatus} | ${r.fitStatus} |`)
  }
  out.push("")
  out.push("---")
  out.push("")
  out.push("## Metodologija (pošteno, brez izmišljanja dokazil)")
  out.push("")
  out.push("- **A (specializirana):** izrecna preslikava podrazreda/oddelka (subclass-override/division-override) na profil z DOKAZANIM, PROFIL-SPECIFIČNIM runtime-evidence (strežniške akcije + test, ki poganja prav ta profil skozi materializacijo). Dokaz iz DRUGEGA profila (npr. `seamstress` → `apparel`) NI zadosten.")
  out.push("- **B (arhetip):** podrazredna, koda-po-kodi preslikava na profil, katerega poslovno jedro res služi prav ta podrazred. Nikakršna samodejna promocija celotne sekcije za obstoj obrazca (odstranjeno v PR #142).")
  out.push("- **C (osnovna konfiguracija):** dokumentirano, da osnovna konfiguracija zadostuje (npr. `workOrders: required` krije splošno izvedbo). NIKOLI samodejno za `forms==0`.")
  out.push("- **D (nepopolna):** preslikava obstaja, a ocena pokritosti zmožnosti (`missingRequiredCapabilities`) najde vrzel. Razvrstitev po dejanskih vrednostih polja `reason`: (1) `not-delivered` — `required` `context-limited` zmožnost (`appointments`, `services`, `analytics`, `cashRegister`) ali `delivery`, za katero NI univerzalnega strežniškega modula; to je skupen platformni evidence-gap, ponovljen čez vse preslikave profila, NE podrazredno dokazana nepopolnost; (2) `no-template` — profil deklarira `forms` kot `required`, a ima **0 obrazčnih predlog** (to se danes zgodi izključno za `forms`; `workflows`/`workOrders` `required` brez predlogov se razvrsti kot `not-delivered`, ker `createWorkOrder` vrne `NO_WORKFLOW`, ko ni materializiranega tenant `workflowDefinition`); (3) izrecna izjema (npr. S92 igre na srečo). `documents` je `universal` → nikoli vrzel. Vsota: 380 vrstic ima `no-template` (in hkrati `not-delivered`), 298 samo `not-delivered` → 678, izjemi S92 sta všteti v 298 in se NE seštevata drugič.")
  out.push("- **D = ocenjena VRZEL zmožnosti, NE preverjena SKLADNOST dejavnosti.** `section-default` vrstice (npr. G46.110 pri `skd-g-retail`) so »assessed« izključno v pomenu *izvedena je bila ocena pokritosti zmožnosti, ki je pokazala vrzel* — to NI potrditev, da platforma služi prav ta SKD podrazred. Za podrazrede z `section-default` vir ostaja `fit` **not-assessed** (skladnost dejavnosti ni bila preverjena). Stolpec Status razlikuje: `assessed` = opravljena ocena pokritosti zmožnosti (A–E), ne more biti prebran kot »fit verificiran«.")
  out.push("- **E (nepokrita):** resolver je padel na generični fallback (neobstoječa ali oblikovno-varljiva koda ni predstavljena kot veljavna).")
  out.push("- **Not assessed (ni ocenjeno):** preslikava obstaja (sekcijski privzetek), a le z runtime-evidence iz DRUGEGA profila ali brez profil-specifičnega dokaza, da prav ta podrazred res pokriva; cela sekcija (npr. gradbeništvo) se NE dvigne na nivo samo zato, ker en obrazec obstaja. To NI nivo — to je odkrito »preveri«.")
  out.push("")
  out.push(
    "> **Deklaracija ≠ runtime.** Stolpci Forme/Procesi/Razširitve prikazujejo **deklarirano konfiguracijo** (`declaredConfiguration`), ne delujočega procesa.",
  )
  out.push(
    "> `extensions` se NUJNO obravnavajo kot deklaracija (niso materializirane — glej `src/lib/profiles/materialize.ts`).",
  )
  out.push(
    "> Stolpec **Runtime eviden.** je »da« le, kadar register nosi reference na strežniške akcije + test datoteke.",
  )
  return out.join("\n")
}

// Stranski učinek (pisanje datoteke) teče le, ko se skript zaganja neposredno
// (`pnpm exec tsx scripts/f51-generate-coverage-doc.ts`), ne ob importu v testih.
const isDirectRun = process.argv[1]?.endsWith("f51-generate-coverage-doc.ts") ?? false
if (isDirectRun) {
  writeFileSync("docs/SKD-2025-COMPLETE-COVERAGE.md", buildCoverageDocMarkdown(), "utf8")
  console.log(`Wrote docs/SKD-2025-COMPLETE-COVERAGE.md (${activityCoverage().length} rows)`)
}
