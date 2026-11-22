# MARKEC â€” Poslovni arhetipi: PREDLOG za analizo (Faza 1)

> **To je PREDLOG, ne konÄŤna preslikava. NI strokovno potrjeno dejstvo.**
> Vsak arhetip spodaj je **`needs-specialist-review`**, dokler ne dobi:
> (1) izrecne poslovne utemeljitve, (2) dejanske funkcionalne implementacije in
> (3) preverljivih testov. Ta dokument **ne trdi**, da je vseh 678 podrazredov
> Ĺľe razvrĹˇÄŤenih v arhetipe â€” opiĹˇe moĹľne ponovno uporabne kombinacije.
>
> **Stanje:** analitiÄŤni predlog na veji `feat/skd-678-coverage-register`, nad `main` = `d8bcba6`.
> **Metoda:** vsaka arhetipska skupina je izpeljana iz **dejanskih imen podrazredov** v SKD 2025 V1
> (`src/lib/skd/data/skd2025.ts`) in **dejanske globine** obstojeÄŤih profilov
> (`src/lib/profiles/registry.ts`, izmerjeno v `docs/SKD-2025-GAP-ANALYSIS.md`).
> **Ni izmiĹˇljanja:** tam, kjer dejavnost nima jasne univerzalne oblike ali je regulirana, je to
> oznaÄŤeno kot Â»segment-groupsÂ« ali Â»needs-specialist-reviewÂ« â€” NE dobiva izmiĹˇljenega arhetipa.
>
> **Uradni nazivi sekcij** prihajajo iz `src/lib/skd/catalog.ts` â†’ `SKD_SECTIONS`
> (22 sekcij Aâ€“V), enako kot v registerju. Ĺ tevila podrazredov so izraÄŤunana iz kataloga,
> ne roÄŤno.
>
> **Usklajenost z registerjem (po reviziji PR #142):** v register `/docs/SKD-2025-COMPLETE-COVERAGE.md`
> so **vsi** ti predlogi trenutno **not-assessed** (A=0, B=0, D=382, E=0, not-assessed=296) â€”
> ker noben profil-specifiÄŤen runtime-dokaz Ĺˇe ne obstaja za konkretno konfiguracijo profila.
> Ta dokument zato opisuje **potencialne** arhetipe za prihodnjo implementacijo (EPIC-2 ponovna
> uporaba), **ne** potrjenih pokritosti. NiÄŤ tukaj ni v nasprotju z registerjem; register je
> avtoritativni vir o pokritosti, ta dokument o nameri.

---

## 1. NaÄŤelo dodeljevanja arhetipov

Arhetip = **ponovno uporabna deklarativna kombinacija** (zmoĹľnosti + terminologija + en realen
workflow-predlog + resolvable dashboard widgeti). En arhetip pokriva veÄŤ podrazredov, katerih
poslovni tok je resniÄŤno primerljiv â€” ne le Â»zveni podobnoÂ«.

- **Skupno jedro** (customer, order, documents, payments) se ponovno uporablja â€” NE skalira.
- **Specializacija** se doda le tam, kjer je resniÄŤna razlika (npr. vozila v vulkanizerskem,
  mere v Ĺˇiviljstvu, panji v ÄŤebelarstvu).
- **Regulirane** dejavnosti (finance, zdravstvo, Ĺˇolstvo, veterinarstvo, javna uprava) se NE
  Â»ugibajoÂ« â€” so segment-groups, kjer je bila posebna strokovna presoja sprotena (Agent G vlog).

---

## 2. Predlog arhetipov (po sekcijah)

Oznake: **REUSE** = obstojeÄŤi profil/runtime zadoĹˇÄŤa za ta arhetip (le povezava ÄŤez podrazrede);
**NEW-DECL** = potrebna nova *deklarativna* specializacija (profil-specifiÄŤna terminologija ali
1 workflow-predlog), brez novega podatkovnega modela; **NEW-RUNTIME** = potreben nov runtime
(modul/entiteta) â€” obravnava ga EPIC-2, ta register zabeleĹľi kje.

### Sekcija A â€” kmetijstvo (39) â†’ `archetype: agri-production | livestock | forestry`
| Oddelek | Podrazredov | Arhetip | OznaÄŤevalec | Utemeljitev |
|---|---|---|---|---|
| A01 kmetijska pridelava | 30 | `agri-crops` (pridelava) | NEW-DECL | Ĺľetev/serije obstajajo `batch-production`; terminologija rastlin; CTA=order (Ĺľe `skd-a-agriculture`) |
| A01 seanje/Ĺľivinoreja (A01.41+) | (v A01) | `agri-livestock` | NEW-DECL | Ĺľivina â†’ matiÄŤni pregledi, evidence Ĺľivali (regulirani podsistem) |
| A02 gozdarstvo | 4 | `forestry` | NEW-DECL | seÄŤnja, prevoz, kubiÄŤni meter; ni rezervacij |
| A03 ribiĹˇtvo | 5 | `agri-aquatic` | NEW-DECL | kvote, dovoljenja; ni v knjigah |

### Sekcija B â€” rudarstvo (15) â†’ `archetype: extraction | quarry`
`skd-b-mining` niÄŤ runtime (GAP. shows). To je **regulirana teĹľka industrija**: velika
veÄŤina (B05â€“B09) so B2B dobavitelji surovin â†’ `extraction-quota` (NEW-DECL, minimalno) ali
`segment-groups` za vojaĹˇke/strateĹˇke (B06, B07). Ne izumljamo evidenÄŤnih pravil.

### Sekcija C â€” predelovalne dejavnosti (233) â†’ `archetype: manufacturing | batch | repair-making`
To je **najveÄŤja vrzel**. `skd-c-manufacturing` (227 podrazredov â€” 233 minus 6 C14â†’apparel) ima niÄŤ form/procesov.

| Podskupina | Primeri (realna imena) | Arhetip | OznaÄŤevalec |
|---|---|---|---|
| Ĺ˝ivilstvo C10â€“C11 | meso, sokovi, pivo, vino | `food-batch` | NEW-DECL (serije + sledljivost; `batch-production`) |
| Tekstil C13â€“C15/obutve | predilnica, oblaÄŤila (C14), obutev | `apparel-sewing` | REUSE `apparel` (Ĺľe 6 C14) + NEW-DECL za C13/C15 |
| Les C16 | Ĺľaganje, mizarstvo, parket | `woodworking` | NEW-DECL (mogoÄŤe prilepiti na construction-ish proces) |
| Papir/tisk C17â€“C18 | kartonska embalaĹľa, tisk | `print-packaging` | NEW-DECL |
| Kovina C24â€“C25 | jeklo, kovinske konstrukcije | `metal-fabrication` | NEW-DECL (delovni nalog + kosovnica) |
| Malo/mnoĹľiÄŤno C10â€“C33 ostalo | pohiĹˇtvo C31, igraÄŤe C32 | `manufacturing-general` | REUSE `skd-c-manufacturing` + 1 generiÄŤen proces (NEW-DECL) |
| Popravila C33 | servis strojev, elektronickih naprav | `repair-service` | REUSE `mehanik`-vzorec (NEW-DECL za nelora vozila) |

Skupno: **233 podrazredov â†’ 6 arhetipov** (5 NEW-DECL + 1 REUSE), NE 233 profilov.

### Sekcija D â€” energetika (12) â†’ `archetype: energy-utility`
Regulirana infra (elektrarna, omreĹľje, trgovanje). `skd-d-energy` niÄŤ runtime â†’ **segment-groups**
ali minimalen `energy-delivery` (NEW-DECL). Ne izmiĹˇljujemo meritev.

### Sekcija E â€” voda/odpadki (11) â†’ `archetype: waste-water`
`skd-e-water-waste` niÄŤ runtime. Zbiranje/ÄŤiĹˇÄŤenje â†’ `waste-collection` (NEW-DECL); ima routes,
dobavitelje, tehtne liste. Regulirano.

### Sekcija F â€” gradbeniĹˇtvo (27) â†’ `archetype: construction-project` (REUSE)
**NOT-assessed (ne â€žĹľe potrjenoâ€ť):** `skd-f-construction` *deklarativno* ima 10-fazni
workflow-predlog + 2 formi + `documents`, a ta ni profil-specifiÄŤno potrjen (testi ne
kliÄŤejo materializeProfileAssets; materializedWorkflows=false). Zato je vseh 27 podrazredov
F trenutno **not-assessed** (A=0, B=0) in ne smejo biti prikazani kot pokriti. Arhetip ostaja
PREDLOG za prihodnjo implementacijo; za F43 instalacije bi se dodala kosovnica (NEW-DECL).

### Sekcija G â€” trgovina (86) â†’ `archetype: trade | retail-service`
`skd-g-retail` (86) ima niÄŤ form/procesov, a deklarirane zmoĹľnosti (`forms`/`workflows`) so
**`optional`**, zato so podrazredi G **not-assessed** (brez dokazane poslovne ustreznosti), ne
Â»mankajoÄŤe-zahtevanoÂ«. Predlog arhetipa: *(needs-specialist-review)*.

| Podskupina | Podrazredov | Arhetip | OznaÄŤevalec |
|---|---|---|---|
| G46 veleprodaja/posredniĹˇtvo | 48 | `trade-wholesale` | NEW-DECL (nabava, dobavitelji, koliÄŤine) â€” G4 suppliers |
| G47 maloprodaja | 38 | `trade-retail` | NEW-DECL (POS, zaloga, serije; `cashRegister`, `inventory`) |
| G47.7 posebni (avtomobili, gorivo) | (del G47) | `trade-retail-special` | NEW-DECL |

86 podrazredov â†’ 2 arhetipa.

### Sekcija H â€” transport (30) â†’ `archetype: transport-passenger | transport-freight | logistics`
`skd-h-transport` niÄŤ runtime.

| Oddelek | Arhetip | OznaÄŤevalec |
|---|---|---|
| H49 cestni/ĹľelezniĹˇki | `transport-passenger` (linijski/eskortni) | NEW-DECL |
| H49 tovor + H50/H51 | `transport-freight` | NEW-DECL |
| H52 skladiĹˇÄŤa/logistika | `logistics-warehouse` | NEW-DECL (zaloga + dobava + dostavne poti) |
| H53 poĹˇta/kurir | `courier` | NEW-DECL |

30 â†’ 4 arhetipe.

### Sekcija I â€” gostinstvo (18) â†’ `archetype: hospitality-accommodation | hospitality-fnb`
`skd-i-hospitality` niÄŤ runtime. I55 nastanitve (9) + I56 hrana/pijaÄŤa (9).
- nastanitve â†’ `accommodation` (NEW-DECL: termin "NoÄŤitev", rezervacije so ali `appointments`)
- restavracije â†’ `restaurant` (NEW-DECL: miz, nabava, blagajna)
18 â†’ 2 arhetipa.

### Sekcija J â€” ZaloĹľniĹˇtvo, radiodifuzija ter produkcija in distribucija vsebin (15) â†’ `archetype: media-creation | publishing`
J58 zaloĹľniĹˇtvo, J59 produkcija, J60 radij/TV â†’ `media-project` (NEW-DECL) + `publishing`.
Danes `skd-j-media` 0 runtime (le 1 deklarirana razĹˇiritev). *(needs-specialist-review)*

### Sekcija K â€” Dejavnosti v zvezi s telekomunikacijami, raÄŤunalniĹˇkim programiranjem, svetovanjem, raÄŤunalniĹˇko infrastrukturo in drugimi informacijskimi storitvami â†’ `archetype: tech-professional`
K = telekom/IT (K61â€“K63 telekom, programiranje, podatki). `skd-k-digital` 0 runtime;
projekti (`projects` je EPIC-2 G3) â†’ `tech-project` (NEW-DECL + EPIC-2 G3 projects).
*(needs-specialist-review)*

### Sekcija L â€” finanÄŤne in zavarovalniĹˇke (20) â†’ `archetype: finance-regulated`
**Regulirana** â€” banke, zavarovalnice, trgi (L64â€“L66). `skd-l-finance` 0 runtime.
â†’ `segment-groups` / samo `customer+documents` (NEW-DECL minimalno). NE izmiĹˇljujemo evidenc.

### Sekcija M â€” Poslovanje z nepremiÄŤninami (5) â†’ `archetype: professional-consulting`
M avtoritativni naziv je **Poslovanje z nepremiÄŤninami** (SKD L IS finanÄŤna; M je nepremiÄŤnine),
zato popravlja poimenovanje (prej Â»strokovneÂ«, kar je bilo N). M68 (5) â†’ upravljanje najemov
(`property-management`, NEW-DECL â€” pogodbe, najemnine; znotraj `documents` razĹˇiritve).
*(needs-specialist-review)*

### Sekcija N â€” Strokovne, znanstvene in tehniÄŤne dejavnosti (27) â†’ `archetype: legal-accounting | design-agency | office-services`
`skd-n-professional` 0 runtime; `forms`/`workflows` sta **`optional`** â†’ podrazredi so
**not-assessed**. *(needs-specialist-review)* Predlog:
- N69 pravne + raÄŤunovodstvo â†’ `legal-accounting` (NEW-DECL; dokumenti, arhiv, po urah)
- N71 inĹľeniring + N74 oblikovanje + fotografija â†’ `project-services` (NEW-DECL + EPIC-2 G3)
- N73 oglaĹˇevanje â†’ `agency`
- N75 veterinarstvo â†’ **regulirano** (segment-groups; ni izmiĹˇljanja)
27 â†’ 3â€“4 arhetipe.

### Sekcija O â€” druge poslovne (34) â†’ `archetype: rental | facilities | event-services`
`skd-o-other-business` (skd-o tabela) + 0 runtime.
- O77 najem â†’ `rental` (NEW-DECL: inventar, pogodbe, depoziti)
- O78 â€“ O80 varovanje/zaposlovanje â†’ `segment-groups`
- O81 ÄŤiĹˇÄŤenje/vzdrĹľevanje â†’ `facility-maintenance` (NEW-DECL, delovni nalogi)
- O82 pisarniĹˇke/organizacija dogodkov â†’ `event-office` (NEW-DECL)
34 â†’ 3â€“4 arhetipe.

### Sekcija P â€” javna uprava (9) / Q â€” izobraĹľevanje (13) / R â€” zdravstvo (22)
**Vsi trije so regulirani / javni sektor.** `skd-p-public-admin`, `skd-r-health`, `skd-q-education`
0 runtime. â†’ **segment-groups** z obveznim sklicevanjem na pristojne regulatorne zahteve
(Agent G). Izjeme: privatne izobraĹľevalne (teÄŤaji) so lahko `education-course` (NEW-DECL) â€”
vendar posebej, ne v istem arhetipu kot javne Ĺˇole.

### Sekcija S â€” kultura in Ĺˇport (23) â†’ `archetype: creative | events | sport-club`
`skd-s-culture-sport` 0 runtime; izjemi S92 (igre na sreÄŤo) = D (znane vrzeli, zabeleĹľene).
- S90/S91 umetnost + muzeji â†’ `creative-cultural` (NEW-DECL)
- S93 Ĺˇportni klubi/fitness â†’ `sport-fitness` (NEW-DECL: ÄŤlanstva â†’ EPIC-2 G1 memberships)
23 â†’ 2 arhetipa + 2 D-izjemi.

### Sekcija T â€” druge storitve (26) â†’ `archetype: personal-services | funeral | laundry`
`skd-t-other` 0 runtime, a ravno tu so **posebni** frizer/beauty/mehanik/tire (Ĺľe roÄŤno dodeljeni).
- T95 popravila (raÄŤunalniki, ÄŤevlji) â†’ `repair-service` (kot C33)
- T96 osebne storitve (pralnice, savne, pogreb) â†’ `personal-service` (NEW-DECL); pogreb je
  regulirano (segment-groups)
- T96.21+.22+.23+.991 Ĺľe â†’ `beauty-polar` REUSE (frizer/massage/tattoo)
26 â†’ 3 arhetipe (veliko je Ĺ˝E REUSE beauty + repair).

### Sekcija U (gospodinjstva, 3) / V (eksteritorialne, 1)
â†’ **segment-groups** (niso trĹľne dejavnosti; no-code/evidence ne obstajajo â€” popolnoma
zunaj poslovne platforme). To je poĹˇtena oznaka, ne napaka.

---

## 3. Skupno Ĺˇtevilo arhetipov (predlog, ni fiksno)

Konceptualno: **~24 arhetipov, ki pokrijejo 678 podrazredov** (brez ~30 segment-groups
reguliranih/trgiĹˇkih, ki ostanejo evidentirani posebej). To je NEStokrat manj od 678 profilov.

ÄŚeprav Ĺˇtevilo ni vnaprej doloÄŤeno, ta analiza kaĹľe, da je poslovno primerljivih tokov veliko
manj od Ĺˇtevila SKD-kod â€” to je argument za vzpostavitev **archetype sloja** kot deklarativne
nadgradnje obstojeÄŤih profilov (ne novega profila za vsak podrazred).

---

## 4. Kje je treba SPREMENITI kodo (skladno z EPIC-2)

| Id | Sprememba | Tip | Sklic |
|---|---|---|---|
| A1 | `archetype` polje na `ActivityProfile` ali na `ActivityCoverageDefinition` (SKD-nivo) | NEW-DECL | ta register |
| A2 | `archetypes/` deklarativna mapa (24 vnosov) â€” capabilities + terminology + 1 workflow + dashboard | NEW-DECL | EPIC-2 konfig. motor |
| A3 | `projects`, `memberships`, `suppliers`, `delivery` runtime (za arhetipe tech/agency/sport/trade) | NEW-RUNTIME | EPIC-2 G1â€“G3 |
| A4 | `skd-c-manufacturing`, `skd-g-retail`, `skd-h-transport` â€¦ â€” ni protiv. procesov; dodeliti arhetipskim workflow-im | NEW-DECL | GAP 2a |
| A5 | anti-deklarirajoÄŤi test: profil z `workflows:"required"` brez predloge â†’ napaka | TEST | GAP 2a |
| A6 | README profili (14+22) uskladiti z registrom | DOC | GAP 3 |

---

## 5. PriporoÄŤena implementacijska prioriteta (ÄŤe se odloÄŤi za fazo 2+)

1. **Po meri gostinstvo + trgovina** (I18 + G86 + C-frizer) â€” najveÄŤ uporabnosti, jasen proces.
2. **Processing / manufacturing** (sekcija C = 233; od tega 6 C14â†’apparel, torej `skd-c-manufacturing` drĹľi 227) â€” najveÄŤja masa, 6 arhetipov, vse REUSE/DECL.
3. **Transport/energija/voda** (H/D/E) â€” viĹˇja regulatorna zahtevnost â†’ pozneje.
4. Regulirani sektorji (finance, zdravstvo, Ĺˇolstvo) â€” samo evidenÄŤni, nikoli izmiĹˇljeni.

---

## 6. OznaÄŤevanje statusa v registerju

Register (doc 2) ima polje `coverageLevel` (`A/B/C/D/E`) **le za `assessed` vrstice**; za
`not-assessed` je `null`. Uporablja tudi `mappingSource`, `assessmentStatus`,
`declaredConfiguration` in `runtimeEvidence`. Arhetip (`archetypeId`) se doda kot nov kljuÄŤ
v `ActivityCoverageDefinition`, kadar se ta register sprejme za implementacijo.
Do takrat ostaja ta dokument analitski predlog â€” **brez spremembe kode**.
