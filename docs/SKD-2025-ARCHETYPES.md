# MARKEC — Poslovni arhetipi: PREDLOG za analizo (Faza 1)

> **To je PREDLOG, ne končna preslikava. NI strokovno potrjeno dejstvo.**
> Vsak arhetip spodaj je **`needs-specialist-review`**, dokler ne dobi:
> (1) izrecne poslovne utemeljitve, (2) dejanske funkcionalne implementacije in
> (3) preverljivih testov. Ta dokument **ne trdi**, da je vseh 678 podrazredov
> že razvrščenih v arhetipe — opiše možne ponovno uporabne kombinacije.
>
> **Stanje:** analitični predlog na veji `feat/skd-678-coverage-register`, nad `main` = `d8bcba6`.
> **Metoda:** vsaka arhetipska skupina je izpeljana iz **dejanskih imen podrazredov** v SKD 2025 V1
> (`src/lib/skd/data/skd2025.ts`) in **dejanske globine** obstoječih profilov
> (`src/lib/profiles/registry.ts`, izmerjeno v `docs/SKD-2025-GAP-ANALYSIS.md`).
> **Ni izmišljanja:** tam, kjer dejavnost nima jasne univerzalne oblike ali je regulirana, je to
> označeno kot »segment-groups« ali »needs-specialist-review« — NE dobiva izmišljenega arhetipa.
>
> **Uradni nazivi sekcij** prihajajo iz `src/lib/skd/catalog.ts` → `SKD_SECTIONS`
> (22 sekcij A–V), enako kot v registerju. Ĺ tevila podrazredov so izračunana iz kataloga,
> ne ročno.
>
> **Usklajenost z registerjem (po reviziji PR #142):** v register `/docs/SKD-2025-COMPLETE-COVERAGE.md`
> so **vsi** ti predlogi trenutno **not-assessed** (A=0, B=0, D=382, E=0, not-assessed=296) —
> ker noben profil-specifičen runtime-dokaz še ne obstaja za konkretno konfiguracijo profila.
> Ta dokument zato opisuje **potencialne** arhetipe za prihodnjo implementacijo (EPIC-2 ponovna
> uporaba), **ne** potrjenih pokritosti. Nič tukaj ni v nasprotju z registerjem; register je
> avtoritativni vir o pokritosti, ta dokument o nameri.

---

## 1. Načelo dodeljevanja arhetipov

Arhetip = **ponovno uporabna deklarativna kombinacija** (zmožnosti + terminologija + en realen
workflow-predlog + resolvable dashboard widgeti). En arhetip pokriva več podrazredov, katerih
poslovni tok je resnično primerljiv — ne le »zveni podobno«.

- **Skupno jedro** (customer, order, documents, payments) se ponovno uporablja — NE skalira.
- **Specializacija** se doda le tam, kjer je resnična razlika (npr. vozila v vulkanizerskem,
  mere v šiviljstvu, panji v čebelarstvu).
- **Regulirane** dejavnosti (finance, zdravstvo, šolstvo, veterinarstvo, javna uprava) se NE
  »ugibajo« — so segment-groups, kjer je bila posebna strokovna presoja sprotena (Agent G vlog).

---

## 2. Predlog arhetipov (po sekcijah)

Oznake: **REUSE** = obstoječi profil/runtime zadošča za ta arhetip (le povezava čez podrazrede);
**NEW-DECL** = potrebna nova *deklarativna* specializacija (profil-specifična terminologija ali
1 workflow-predlog), brez novega podatkovnega modela; **NEW-RUNTIME** = potreben nov runtime
(modul/entiteta) — obravnava ga EPIC-2, ta register zabeleži kje.

### Sekcija A — kmetijstvo (39) → `archetype: agri-production | livestock | forestry`
| Oddelek | Podrazredov | Arhetip | Označevalec | Utemeljitev |
|---|---|---|---|---|
| A01 kmetijska pridelava | 30 | `agri-crops` (pridelava) | NEW-DECL | žetev/serije obstajajo `batch-production`; terminologija rastlin; CTA=order (že `skd-a-agriculture`) |
| A01 seanje/živinoreja (A01.41+) | (v A01) | `agri-livestock` | NEW-DECL | živina → matični pregledi, evidence živali (regulirani podsistem) |
| A02 gozdarstvo | 4 | `forestry` | NEW-DECL | sečnja, prevoz, kubični meter; ni rezervacij |
| A03 ribištvo | 5 | `agri-aquatic` | NEW-DECL | kvote, dovoljenja; ni v knjigah |

### Sekcija B — rudarstvo (15) → `archetype: extraction | quarry`
`skd-b-mining` nič runtime (GAP. shows). To je **regulirana težka industrija**: velika
večina (B05–B09) so B2B dobavitelji surovin → `extraction-quota` (NEW-DECL, minimalno) ali
`segment-groups` za vojaške/strateške (B06, B07). Ne izumljamo evidenčnih pravil.

### Sekcija C — predelovalne dejavnosti (233) → `archetype: manufacturing | batch | repair-making`
To je **največja vrzel**. `skd-c-manufacturing` (227 podrazredov — 233 minus 6 C14→apparel) ima nič form/procesov.

| Podskupina | Primeri (realna imena) | Arhetip | Označevalec |
|---|---|---|---|
| Živilstvo C10–C11 | meso, sokovi, pivo, vino | `food-batch` | NEW-DECL (serije + sledljivost; `batch-production`) |
| Tekstil C13–C15/obutve | predilnica, oblačila (C14), obutev | `apparel-sewing` | REUSE `apparel` (že 6 C14) + NEW-DECL za C13/C15 |
| Les C16 | žaganje, mizarstvo, parket | `woodworking` | NEW-DECL (mogoče prilepiti na construction-ish proces) |
| Papir/tisk C17–C18 | kartonska embalaža, tisk | `print-packaging` | NEW-DECL |
| Kovina C24–C25 | jeklo, kovinske konstrukcije | `metal-fabrication` | NEW-DECL (delovni nalog + kosovnica) |
| Malo/množično C10–C33 ostalo | pohištvo C31, igrače C32 | `manufacturing-general` | REUSE `skd-c-manufacturing` + 1 generičen proces (NEW-DECL) |
| Popravila C33 | servis strojev, elektronickih naprav | `repair-service` | REUSE `mehanik`-vzorec (NEW-DECL za nelora vozila) |

Skupno: **233 podrazredov → 7 arhetipov (kot v tabeli zgoraj)**, NE 233 profilov. (Pojmi so
trije reuse-vzorci — `apparel`, `skd-c-manufacturing`, `mehanik` — plus posamezni NEW-DECL
procesi za hrano, les, tisk in kovino.)

### Sekcija D — energetika (12) → `archetype: energy-utility`
Regulirana infra (elektrarna, omrežje, trgovanje). `skd-d-energy` nič runtime → **segment-groups**
ali minimalen `energy-delivery` (NEW-DECL). Ne izmišljujemo meritev.

### Sekcija E — voda/odpadki (11) → `archetype: waste-water`
`skd-e-water-waste` nič runtime. Zbiranje/čiščenje → `waste-collection` (NEW-DECL); ima routes,
dobavitelje, tehtne liste. Regulirano.

### Sekcija F — gradbeništvo (27) → `archetype: construction-project` (REUSE)
**NOT-assessed (ne „že potrjeno”):** `skd-f-construction` *deklarativno* ima 10-fazni
workflow-predlog + 2 formi + `documents`, a ta ni profil-specifično potrjen (testi ne
kličejo materializeProfileAssets; materializedWorkflows=false). Zato je vseh 27 podrazredov
F trenutno **not-assessed** (A=0, B=0) in ne smejo biti prikazani kot pokriti. Arhetip ostaja
PREDLOG za prihodnjo implementacijo; za F43 instalacije bi se dodala kosovnica (NEW-DECL).

### Sekcija G — trgovina (86) → `archetype: trade | retail-service`
`skd-g-retail` (86) ima nič form/procesov, a deklarirane zmožnosti (`forms`/`workflows`) so
**`optional`**, zato so podrazredi G **not-assessed** (brez dokazane poslovne ustreznosti), ne
»mankajoče-zahtevano«. Predlog arhetipa: *(needs-specialist-review)*.

| Podskupina | Podrazredov | Arhetip | Označevalec |
|---|---|---|---|
| G46 veleprodaja/posredništvo | 48 | `trade-wholesale` | NEW-DECL (nabava, dobavitelji, količine) — G4 suppliers |
| G47 maloprodaja | 38 | `trade-retail` | NEW-DECL (POS, zaloga, serije; `cashRegister`, `inventory`) |
| G47.30 + G47.81–83 (gorivo, motorna vozila) — danes `trade-retail` | (del G47) | `trade-retail-special` | NEW-DECL |

86 podrazredov → 2 arhetipa.

### Sekcija H — transport (30) → `archetype: transport-passenger | transport-freight | logistics`
`skd-h-transport` nič runtime.

| Oddelek | Arhetip | Označevalec |
|---|---|---|
| H49 cestni/železniški | `transport-passenger` (linijski/eskortni) | NEW-DECL |
| H49 tovor + H50/H51 | `transport-freight` | NEW-DECL |
| H52 skladišča/logistika | `logistics-warehouse` | NEW-DECL (zaloga + dobava + dostavne poti) |
| H53 pošta/kurir | `courier` | NEW-DECL |

30 → 4 arhetipe.

### Sekcija I — gostinstvo (18) → `archetype: hospitality-accommodation | hospitality-fnb`
`skd-i-hospitality` nič runtime. I55 nastanitve (9) + I56 hrana/pijača (9).
- nastanitve → `accommodation` (NEW-DECL: termin "Nočitev", rezervacije so ali `appointments`)
- restavracije → `restaurant` (NEW-DECL: miz, nabava, blagajna)
18 → 2 arhetipa.

### Sekcija J — Založništvo, radiodifuzija ter produkcija in distribucija vsebin (15) → `archetype: media-creation | publishing`
J58 založništvo, J59 produkcija, J60 radij/TV → `media-project` (NEW-DECL) + `publishing`.
Danes `skd-j-media` 0 runtime (le 1 deklarirana razširitev). *(needs-specialist-review)*

### Sekcija K — Dejavnosti v zvezi s telekomunikacijami, računalniškim programiranjem, svetovanjem, računalniško infrastrukturo in drugimi informacijskimi storitvami → `archetype: tech-professional`
K = telekom/IT (K61–K63 telekom, programiranje, podatki). `skd-k-digital` 0 runtime;
projekti (`projects` je EPIC-2 G3) → `tech-project` (NEW-DECL + EPIC-2 G3 projects).
*(needs-specialist-review)*

### Sekcija L — finančne in zavarovalniške (20) → `archetype: finance-regulated`
**Regulirana** — banke, zavarovalnice, trgi (L64–L66). `skd-l-finance` 0 runtime.
→ `segment-groups` / samo `customer+documents` (NEW-DECL minimalno). NE izmišljujemo evidenc.

### Sekcija M — Poslovanje z nepremičninami (5) → `archetype: professional-consulting`
M avtoritativni naziv je **Poslovanje z nepremičninami** (SKD L IS finančna; M je nepremičnine),
zato popravlja poimenovanje (prej »strokovne«, kar je bilo N). M68 (5) → upravljanje najemov
(`property-management`, NEW-DECL — pogodbe, najemnine; znotraj `documents` razširitve).
*(needs-specialist-review)*

### Sekcija N — Strokovne, znanstvene in tehnične dejavnosti (27) → `archetype: legal-accounting | design-agency | office-services`
`skd-n-professional` 0 runtime; `forms`/`workflows` sta **`optional`** → podrazredi so
**not-assessed**. *(needs-specialist-review)* Predlog:
- N69 pravne + računovodstvo → `legal-accounting` (NEW-DECL; dokumenti, arhiv, po urah)
- N71 inženiring + N74 oblikovanje + fotografija → `project-services` (NEW-DECL + EPIC-2 G3)
- N73 oglaševanje → `agency`
- N75 veterinarstvo → **regulirano** (segment-groups; ni izmišljanja)
27 → 3–4 arhetipe.

### Sekcija O — druge poslovne (34) → `archetype: rental | facilities | event-services`
`skd-o-other-business` (skd-o tabela) + 0 runtime.
- O77 najem → `rental` (NEW-DECL: inventar, pogodbe, depoziti)
- O78 – O80 varovanje/zaposlovanje → `segment-groups`
- O81 čiščenje/vzdrževanje → `facility-maintenance` (NEW-DECL, delovni nalogi)
- O82 pisarniške/organizacija dogodkov → `event-office` (NEW-DECL)
34 → 3–4 arhetipe.

### Sekcija P — javna uprava (9) / Q — izobraževanje (13) / R — zdravstvo (22)
**Vsi trije so regulirani / javni sektor.** `skd-p-public-admin`, `skd-r-health`, `skd-q-education`
0 runtime. → **segment-groups** z obveznim sklicevanjem na pristojne regulatorne zahteve
(Agent G). Izjeme: privatne izobraževalne (tečaji) so lahko `education-course` (NEW-DECL) —
vendar posebej, ne v istem arhetipu kot javne šole.

### Sekcija S — kultura in šport (23) → `archetype: creative | events | sport-club`
`skd-s-culture-sport` 0 runtime; izjemi S92 (igre na srečo) = D (znane vrzeli, zabeležene).
- S90/S91 umetnost + muzeji → `creative-cultural` (NEW-DECL)
- S93 športni klubi/fitness → `sport-fitness` (NEW-DECL: članstva → EPIC-2 G1 memberships)
23 → 2 arhetipa + 2 D-izjemi.

### Sekcija T — druge storitve (26) → `archetype: personal-services | funeral | laundry`
`skd-t-other` 0 runtime, a ravno tu so **posebni** frizer/beauty/mehanik/tire (že ročno dodeljeni).
- T95 popravila (računalniki, čevlji) → `repair-service` (kot C33)
- T96 osebne storitve (pralnice, savne, pogreb) → `personal-service` (NEW-DECL); pogreb je
  regulirano (segment-groups)
- T96.21+.22+.23+.991 že → `beauty-polar` REUSE (frizer/massage/tattoo)
26 → 3 arhetipe (veliko je ŽE REUSE beauty + repair).

### Sekcija U (gospodinjstva, 3) / V (eksteritorialne, 1)
→ **segment-groups** (niso tržne dejavnosti; no-code/evidence ne obstajajo — popolnoma
zunaj poslovne platforme). To je poštena oznaka, ne napaka.

---

## 3. Skupno število arhetipov (predlog, ni fiksno)

Konceptualno: **~24 arhetipov, ki pokrijejo 678 podrazredov** (brez ~30 segment-groups
reguliranih/trgiških, ki ostanejo evidentirani posebej). To je NEStokrat manj od 678 podrazredov —
register jih pokriva z le **36 industrijskimi profili** (14 specializiranih + 22 SKD-sekcijskih),
ne z enim profilom na podrazred.

Čeprav število ni vnaprej določeno, ta analiza kaže, da je poslovno primerljivih tokov veliko
manj od števila SKD-kod — to je argument za vzpostavitev **archetype sloja** kot deklarativne
nadgradnje obstoječih profilov (ne novega profila za vsak podrazred).

---

## 4. Kje je treba SPREMENITI kodo (skladno z EPIC-2)

| Id | Sprememba | Tip | Sklic |
|---|---|---|---|
| A1 | `archetype` polje na `ActivityProfile` ali na `ActivityCoverageDefinition` (SKD-nivo) | NEW-DECL | ta register |
| A2 | `archetypes/` deklarativna mapa (24 vnosov) — capabilities + terminology + 1 workflow + dashboard | NEW-DECL | EPIC-2 konfig. motor |
| A3 | `projects`, `memberships`, `suppliers`, `delivery` runtime (za arhetipe tech/agency/sport/trade) | NEW-RUNTIME | EPIC-2 G1–G3 |
| A4 | `skd-c-manufacturing`, `skd-g-retail`, `skd-h-transport` … — ni protiv. procesov; dodeliti arhetipskim workflow-im | NEW-DECL | GAP 2a |
| A5 | anti-deklarirajoči test: profil z `workflows:"required"` brez predloge → napaka | TEST | GAP 2a |
| A6 | README profili (14+22) uskladiti z registrom | DOC | GAP 3 |

---

## 5. Priporočena implementacijska prioriteta (če se odloči za fazo 2+)

1. **Po meri gostinstvo + trgovina** (I18 + G86 + C-frizer) — največ uporabnosti, jasen proces.
2. **Processing / manufacturing** (sekcija C = 233; od tega 6 C14→apparel, torej `skd-c-manufacturing` drži 227) — največja masa, 7 arhetipov, REUSE/DECL mešano.
3. **Transport/energija/voda** (H/D/E) — višja regulatorna zahtevnost → pozneje.
4. Regulirani sektorji (finance, zdravstvo, šolstvo) — samo evidenčni, nikoli izmišljeni.

---

## 6. Označevanje statusa v registerju

Register (doc 2) ima polje `coverageLevel` (`A/B/C/D/E`) **le za `assessed` vrstice**; za
`not-assessed` je `null`. Uporablja tudi `mappingSource`, `assessmentStatus`,
`declaredConfiguration` in `runtimeEvidence`. Arhetip (`archetypeId`) se doda kot nov ključ
v `ActivityCoverageDefinition`, kadar se ta register sprejme za implementacijo.
Do takrat ostaja ta dokument analitski predlog — **brez spremembe kode**.
