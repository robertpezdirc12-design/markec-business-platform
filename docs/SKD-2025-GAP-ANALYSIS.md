# MARKEC — SKD 678 pokritost: Gap analiza (Faza 0/1, izvedljiva)

> **Stanje:** read-only analiza na veji `feat/skd-678-coverage-register`, nad `main` = `d8bcba6`.
> **Vir podatkov:** register `src/lib/skd/activity-coverage.ts` + stvarni resolver/profili (SURS KLASJE SKD 2025 V1).
> **Datum generiranja:** 2026-11-22.

## 0. Uvod

Ta dokument izhaja iz **istega verodostojnega vira** kot `docs/SKD-2025-COMPLETE-COVERAGE.md`
(tj. `activity-coverage.ts`). Ne vsebuje ročnega štetja — vsa števila so izračunana iz aktualne kode.

## 1. Izmerjena pokritost (poverno z merjenjem, ne z obljubo)

| Nivo | Oznaka | Št. | Pomen |
|---|---:|---|---|
| A specializirana | A | **11** | ročna preslikava podrazreda + dejanski runtime (procesi/forme) |
| B arhetip | B | **27** | funkcionalen arhetip (skd-f-construction), a ni podrazredno ročno dodeljen |
| C osnovna | C | **638** | sekcijski profil **brez** posebnih form/procesov |
| D nepopolna | D | **2** | evidentirani izjemi (S92 igre na srečo) |
| E nepokrita | E | **0** | resolver vedno pade na sekcijski profil |

**Skupaj:** 678 podrazredov. Od tega je **638 (94 %)** samo na osnovni (C) ravni —
nimajo poslovne specializacije v runtime.

### Ključno opozorilo

**674 od 678 dejavnosti (99 %) se preslika prek sekcijskega privzetka.** Samo 4 podrazredi
imajo točno ročno preslikavo na specializiran profil (frizer, mehanik×2, massage, tattoo)
poleg C14→apparel (6) in S92 izjeme. **Preslikava ≠ specializacija:** 638 dejavnosti je v profilih,
ki »izgledajo« kot panoga (npr. `skd-c-manufacturing` za 233 proizvodnje) a dejansko nosijo
nič form in nič procesov.

## 2. Deklaracija vs. runtime (glavni arhitekturni vrzel)

Merjenje: za vsak profil primerjamo **deklarirane zmožnosti** (`capabilities.workflows ===
"required"`, `capabilities.forms === "required"`) z **dejanskim številom** workflow/forma predlog.

### 2a. Profili, ki deklarirajo `workflows: required` in/ali `forms: required`, a imago runtime=0

| Profil | Podrazredov na njem | Deklarira workflows | Deklarira forms | Dejanskih procesov | Dejanskih form |
|---|---:|---|---|---:|---:|
| `skd-c-manufacturing` | **233** | ✓ | ✓ | 0 | 0 |
| `skd-g-retail` | **86** | ✓ | ✓ | 0 | 0 |
| `skd-h-transport` | 30 | ✓ | ✓ | 0 | 0 |
| `skd-n-professional` | 27 | ✓ | ✓ | 0 | 0 |
| `skd-l-finance` | 20 | ✓ | ✓ | 0 | 0 |
| `skd-r-health` | 22 | ✓ | ✓ | 0 | 0 |
| `skd-b-mining` | 15 | ✓ | ✓ | 0 | 0 |
| `skd-d-energy` | 12 | ✓ | ✓ | 0 | 0 |
| `skd-e-water-waste` | 11 | ✓ | ✓ | 0 | 0 |
| `skd-p-public-admin` | 9 | ✓ | ✓ | 0 | 0 |
| `skd-v-international` | 1 | ✓ | ✓ | 0 | 0 |
| `skd-q-education` | 13 | – | ✓ | 0 | 0 |
| `skd-m-real-estate` | 5 | – | ✓ | 0 | 0 |
| `skd-j-media` | 15 | – | ✓ | 0 | 0 |

**Skupaj:** vsaj **347 od 678 dejavnosti (51 %)** pade na profile, ki deklarirajo
`workflows: required` z **nič** dejanskega procesnega predloga (še 33 dodatnih deklarira
`forms: required` z nič formami → 380/678 = 56 %). To krši načelo
»ne deklarirati runtime-a, ki ne obstaja«.

> Merjenje (iz aktualnega registra, ne ročnega seznama):
> `node tests/activity-coverage` + za vsak profil primerjava `capabilities.workflows`
> z `workflows.length`, npr. `skd-c-manufacturing` vrstice 1016–1017 `forms: []`, `workflows: []`.
> Številke 347/380 so izpeljane iz dejanskih vrednosti v `src/lib/profiles/registry.ts`.

### 2b. Profili z realnim runtime (referenčno, za ponovno uporabo)

| Profil | Forme | Procesi | Razšir. | Podrazredov | Opomba |
|---|---:|---:|---:|---|---|
| `skd-f-construction` | 2 | 1 (10-fazni) | documents | 27 | **B** — edini funkcionalni sekcijski arhetip |
| `apparel` | 2 | 1 | 3 | 6 (C14) | A |
| `mehanik` | 1 | 1 | 2 | 2 | A |
| `frizer` | 1 | 0 | 1 | 1 | A (forme, ni ločenega procesa) |
| `tattoo-studio` | 2 | 0 | 1 | 1 | A |
| `seamstress` | 2 | 1 | 2 | 0* | specializirana (ni SKD-ročno dodeljena) |

*`seamstress` danes ni v SKD preslikavi; uporablja jo onboarding ročno.

## 3. Terminološki premozki

- README (vrstica 39) je **zastarel**: piše »12 poimenovanih + 24 SKD-sekcij, ~500 SKD«,
  medtem ko register vsebuje **14 specializiranih + 22 SKD** sekcijskih profilov in pokriva **678**.
  To je treba uskladiti.
- Profili z ničelnim runtime-om nimajo terminoloških podrobnosti; greanjei kot `businessSingular`
  se pojavljajo nekonsistentno (npr. napačnopis `Izdelok`) redko.
- `TerminologySet` pokriva jedro (appointment/order/service/product/customer/bookingCta)
  — ne pokriva pa terminov za **workflow stopnje, proxy evidence, javne CTA po korakih**, kar
  pomeni, da so obsežni panogi (proizvodnja, trgovina) terminološko prazne.

## 4. Največje priložnosti (kjer je 1 arhetip = mnogo dejavnosti)

| Arhetip | Št. SKD podrazredov | Področje | Obstaja že |
|---|---:|---|---|
| Proizvodni proces (proizvodni nalog + serije + zaloge) | 233 | sekcija C | delno (extensions: batch-production) |
| Trgovina/vzdrževanje (maloprodaja + servis) | 86 | sekcija G | skd-g-retail nima procesa |
| Kmetijsko-živinorejska pridelava | 39 | sekcija A | beekeeping katalog (ni pogoja) |
| Transport in logistika | 30 | sekcija H | ni |
| Gostinstvo (HORECA) | 18 | sekcija I | skd-i-hospitality nima procesa |

## 5. Ocena izvedbe (predlog — ne spreminjamo še)

> **Razmerje do EPIC-2 (`docs/EPIC-2/PLAN.md`):** EPIC-2 obravnava univerzalni poslovni
> konfiguracijski motor (vrzeli G1–G8), vključno z »deklarirano, a brez runtime-a« zmožnostmi
> (G1: `delivery`, `projects`, `suppliers` …) in »ena organizacija = en profil« (G4). Ta analiza
> je komplementarna: kvantificira **SKD-pokritost na nivoju vseh 678 podrazredov** in razkriva,
> kateri *obstoječi* profili deklarirajo procese, ki jih runtime ne nosi. Ne ponavljava programa,
> ampak natančno razporedi, *kje* v EPIC-2 sprinterje spadajo (npr. skd-c-manufacturing runtime je
> del EPIC-2 G1–G2; SKD-razporeditev je novo).

1. **Register** (`activity-coverage.ts`) + testi (dodano v tem PR-ju). **To je osnova vseh faz.**
2. **Validacija registrov** (že v testih) — dodati pravilo ANTI-deklaracije:
   profil, ki deklarira `workflows: required`, MORA imeti vsaj 1 `workflows: [...]` predlog.
   To bi vrglo napako za 12 profilov → zamehani stvar (D/E), ki jo je treba nujno implementirati.
3. **Arhetipi:** za 3–5 največjih skupin (C, G, A, H, I) pripraviti ločene poslovne procese +
   terminologijo, ki se deklarativno prilepijo na obstoječe profile (specjalizacije), ne da bi
   jih skaliral 678×.
4. **Vsak korak** = majhen PR; testi pokritosti ob vsakem (A/B/C/D/E tik-tak).

## 6. Status / odprta vprašanja

- SKLADNO z EPIC-2 G1/G2/G4 (`docs/EPIC-2/PLAN.md`); ta dokument doda SKD-nivo.
- ODPRTO: ali `batch-production`, `bee-apiary`, `vehicle-workshop` razširitve že pokrivajo
  serije/žetev/vozila v runtime — preverjeno v codebase (extensions.ts) so **deklarirane**, a
  runtime UI/akcije za večino niso oprijemljivo povezane z vsemi SKD-ji (glej EPIC-2 G1/G2).
- ODPRTO: razmejitev z EPIC-2 — to delo sledi istemu aditivnemu, malo-koračnemu principu.
- ODPRTO: README opis (vrstica 39) — potrditi, da register (14 + 22 = 36) postane kanoničen.