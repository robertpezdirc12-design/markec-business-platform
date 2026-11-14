# MARKEC — FAZA 2C-2: STREŽNIŠKA ZGODOVINA SELITEV ČEBELJIH DRUŽIN (KONČNO POROČILO)

> Po `docs/REFERENCE-ACTIVITY-BEEKEEPER-PHASE-2C-ARCHITECTURE.md` (+ dopolnitvi). Samo strežniška logika
> in minimalne povezave; **nikakršen UI zgodovine ni narejen (2C-3)**. Ni spremembe sheme/migracij/produkcije/
> `markec_dev`/Vercela; ni git add/commit/push; `einvoices.ts` + tuji WIP nedotaknjeni.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED.

---

## 1. Spremenjene datoteke
| Datoteka | Sprememba |
|---|---|
| `src/lib/profiles/extensions.ts` | `ExtensionEntity.appendOnly?: boolean` + zod (`z.boolean().optional()`); nova append-only **`colony_move`** entiteta v `bee-apiary` (entityReference polja `colony_ref`/`from_hive_ref`/`to_hive_ref` + `moved_at`/`recorded_at`/`reason`/`performed_by`/`baseline`/`origin_unknown`/`is_correction`/`corrects_ref`/`correction_reason`). Keys so lowercase-podčrtani (skladno z zod regex polja). |
| `src/app/actions/records.ts` | **Append-only fail-closed**: `createExtensionRecord`, `updateExtensionRecord` in `deleteExtensionRecord` preverjajo `owning.entity.appendOnly` → vrnejo `{ ok:false, error:"APPEND_ONLY" }`. `findEntityOwner` sedaj vrača `appendOnly`. |
| `src/app/actions/colony-moves.ts` | **NOV** — namenske akcije + helperji: `createColonyMove`, `correctColonyMove`, `colonyLocationAt`, `listColonyMoveHistory`. |
| `tests/integration/f2-3/colony-move-2c2.itest.ts` | **NOV** — 15 itest testov (prava baza, 2 org). |

## 2. Podatkovni model dogodka (`colony_move`, ExtensionRecord/JSON, brez sheme)
```
colony_ref        → entityReference explicit → ExtensionRecord(bee-apiary, colony) org-scoped
from_hive_ref     → hive (ali null pri neznanem izvoru)
to_hive_ref       → hive (obvezno)
moved_at          → dejanski datum selitve ali null (baseline)
recorded_at       → sistemski čas (zanesljivo, strežnik) — ločeno od moved_at
reason            → razlog (opcionalen)
performed_by      → session.user.id (strežnik, nikoli iz browserja)
baseline          → boolean (začetni zapis stanja)
origin_unknown    → boolean (neznan izvor)
is_correction / corrects_ref / correction_reason → korekcijski dogodki
```
- `colony.hive_ref` ostane **edini vir trenutne lokacije** (colony_move je zgodovina). `colony.hive` (legacy text) NI vir resnice.
- Reference uporabljajo obstoječi univerzalni `entityReference` in org-scoped validacijo.

## 3. Baseline logika
- **Primer A (znana lokacija, `hive_ref=A`)**: prva selitev → v eni transakciji: (1) preberi A, (2) preveri da družina nima dogodkov, (3) ustvari **baseline** `{to_hive_ref:A, moved_at:null, recorded_at:now, baseline:true}`, (4) ustvari event A→B, (5) posodobi `hive_ref=B`. Rollback ob napaki. Baseline nastane **samo enkrat**.
- **Primer B (neznana lokacija)**: NO baseline se ne ustvari z izmišljeno lokacijo; event dobi `from_hive_ref:null` + `origin_unknown:true`; `hive_ref=B`. Prikaz "izvor pred začetkom evidence ni znan".
- **Primer C (baseline/zgodovina že obstaja)**: ne ustvarja novega baseline; preverja **skladnost** `hive_ref` z zadnjim dogodkom → pri neskladju `STATE_MISMATCH` (ne popravi samodejno).

## 4. Časovna logika
- Trije ločeni časi: `moved_at` (kdaj se je zgodilo), `recorded_at` (sistemski, iz `new Date()` na strežniku), `createdAt` (Prisma). `recorded_at` ni nikoli iz browserja.
- Baseline `moved_at=null`; ne prikazuje izmišljenega datuma.
- **Naknadni vnos s starejšim `moved_at`**: zavrnjen z `STALE_MOVED_AT` (če je mlajši od zadnjega datiranega dogodka družine) — deterministično pravilo, določeno za §6; ne nastane nelogična zgodovina in `hive_ref` se ne prepisuje nazaj.
- Rekonstrukcija na datum: zadnji dogodek z `moved_at <= D`; če ga ni, baseline (`baselineOnly`/`known`), sicer **ni zanesljivo** (`known:false`).

## 5. Izvajalec (`performed_by`)
- Pridobljen iz seje prek **`requirePermissionOrg("workorders.manage").session.user.id`** (fail-closed: rola+org+perm), **ne** iz browserja. V `createColonyMove` input ni takega polja, zato ga uporabnik ne more predati; če kdo potisne `performed_by` v polje, strežnik `clean`-normalizira in shrani sejskega.
- Neprijavljen / brez pravic → `requirePermissionOrg` throw (test C3, D).

## 6. Append-only zaščita (fail-closed, strežnik)
- Deklarativni `appendOnly: true` na entiteti `colony_move`.
- Generic `create`/`update`/`deleteExtensionRecord` → `{ ok:false, error:"APPEND_ONLY" }` (test D).
- Edina pot: namenska `createColonyMove` (in `correctColonyMove` za popravke). Ni druge strežniške poti (vse akcije gredo skozi `findEntityOwner` + `appendOnly` guard).

## 7. Transakcijska varnost in sočasnost
- Vse (baseline + event + `hive_ref` update) v **eni `prisma.$transaction`**; vsak return-rollback ni commit → delno stanje ni mogoče (test E: `STALE_MOVED_AT` → `hive_ref` nespremenjen).
- **Sočasnost**: `$queryRaw SELECT … FOR UPDATE` na vrstici družine na začetku transakcije serializira dve hkratni zahtevi; druga vidi konsistentno stanje, ne more ustvariti dveh protislovnih trenutnih lokacij (`hive_ref` je ena, zadnji-commit), podvajanje po formuli (colony+od+do+datum) → `DUPLICATE`.

## 8. Korekcijski dogodki
- `correctColonyMove(originalId, { toHiveId, reason })` ustvari **nov** dogodek `is_correction:true`, `corrects_ref:<original.id>`, `correction_reason`, `moved_at/recorded_at` (strežniški), `performed_by` (sejski); `hive_ref` se posodobi na novi cilj. Originalni dogodek ostane **nespremenjen** (generic update se zavrne `APPEND_ONLY`). Rekonstrukcija trenutne lokacije upošteva korekcijo kot zadnji veljavni dogodek.

## 9. Rezultati testov
| Test | Rezultat | Dokaz |
|---|---|---|
| itest **2C-2** `colony-move-2c2.itest.ts` | **15/15 PASS** | A1-A4 (baseline/prva selitev), B1-B5 (veljavna, neveljaven cilj, SAME_HIVE ×2, tuj panj IDOR, tuja družina), C1-C3 (performed_by iz seje, browser ignoriran, neprijavljen reject), D (append-only create/update/delete + dedicated deluje), E (STALE_MOVED_AT, rollback), E2 (sočasni selitvi), F (korekcija: nov dogodek, original nespremenjen, rekonstrukcija), G (history+locationAt) |
| itest 2B + 2C-1 + f635 | **7+10+7 PASS** | regresija nedotaknjena |
| **itest skupno** | **39/39 PASS** | f635+2b+2c1+2c2 |
| Enote (field-validation/extensions/registry) | **63/63 PASS** | — |
| **Vitest celota** | **91 files / 1331 PASS** | — (2c2 testi so itest) |
| **tsc --noEmit** | čist | ni TS napak |

## 10. Omejitve
- **Build**: `npm run build` **NOT VERIFIED** — existing tuji WIP (`src/app/actions/einvoices.ts` + `(admin)/dashboard/einvoices`) ga še vedno ruši; ga nisem smel/nisem popravil (presega obseg 2C-2).
- **Korekcija** je omejena na popravo cilja (ne omogoča urejanja preteklih datumov/razlogov v izvirnem dogodku — to bi kršilo append-only; to je sprejeto kot varno).
- **UI zgodovine**: NI narejen (2C-3).
- **Sočasnost** ščitena z row-lock (ne optimistično verzijo); FOR UPDATE znotraj transakcije je zanesljiv na PostgreSQL.
- `colony_location` rekonstrukcija za datum pred baseline: `known:false` (iskano pravilno).

## 11. Diff / varovala
Na koncu preverjen diff: tuje spremembe (`prisma/schema.prisma`, `einvoices.*`, itd.) **niso bile dotaknjene**; spremembe so le v `extensions.ts`, `records.ts`, novem `colony-moves.ts`, novem `colony-move-2c2.itest.ts`. Brez git add/commit/push.

**Faza 2C-2 je izvedena in dokazana (PASS). Faza 2C-3 (UI zgodovine) se NE začne brez nove izrecne odobritve.**

---

# CILJNA REVIZIJA 2C-2 (pred 2C-3)

## A. Rollback transakcij — odpravljen in dokazan
- **Sprememba:** v `createColonyMove` in `correctColonyMove` so vsi `return { ok:false, … }` v transakcijskih
  callbackih zamenjani z **`throw new ColonyMoveError(code, message)`**; zunanji `try/catch` ujame `ColonyMoveError`
  in vrne `{ ok:false, error, message }`. Tako nobena napaka (tudi fail po delnem zapisu) ne more biti `return`, ki bi
  po Prisma `$transaction` **potrdil** transakcijo — vsaka sprememba ob napaki rollback-a.
- **Vse poti callbackov** (create + correct) pregledane: vsaka validacijska napaka je throw; edini `return` v callbacku
  je uspešen (commit). Napravi Zr.
- **Negativni integracijski testi (prava baza, f631) — novo dodani, izvedeni:**
  - **R1** — throw PO baseline+event+`hive_ref` write → noben od 3 ne ostane, `hive_ref` se vrne na izvorno lokacijo (A). **PASS**
  - **R2** — throw PO baseline create → baseline NE ostane. **PASS**
  - **R3** — throw PO event create (pred `hive_ref` update) → eventa ne ostaneta, `hive_ref` nespremenjen. **PASS**
  - **R4** (regresija) — `createColonyMove` ob `STALE_MOVED_AT` (throw path) → napačni dogodek se ne doda; zgodovina ostane baseline+en event; `hive_ref` nespremenjen. **PASS**
  - itest 2C-2 sedaj **19/19 PASS**; skupni itest **43/43 PASS**; vitest 1331/1331; tsc čist.

## B. Časovna semantika `recorded_at` vs `createdAt` — skladna, brez spremembe
- `recorded_at` — `new Date().toISOString()` **na strežniku** v vsaki akciji (nikoli iz browserja).
- `createdAt` — Prisma `ExtensionRecord.createdAt @default(now())` → PostgreSQL `now()`.
- Razlika: `recorded_at` je aplikacijski strežniški čas evidentiranja; `createdAt` je datetime v fazi zapisa v bazo.
  V normalnem delovanju se razlikujeta za red nekaj ms–s (strežnik → DB `now()` v trenutku zaloge). **Skladno z
  arhitekturo** (dva ločena časa ena jasno ločena; `recorded_at` ni iz browserja).
- **Rekonstrukcija** uporablja: (a) **`createdAt`** za vrstni red nastanka dogodkov (append order — baseline razlog
  pred eventom v isti transakciji, `createdAt` monotono narašča) — to preverja `lastMoveForColony`/`listColonyMoveHistory`;
  (b) **`moved_at`** za "kje na datum D" (`colonyLocationAt`). Ker vrstni red temelji na `createdAt` (zanesljiv,
  ironi v eni transakciji) in izbor-na-datum na `moved_at`, je rekonstrukcija pravilna tudi ob časovni razliki med
  `recorded_at` in `createdAt`. Trenutna lokacija (`hive_ref`) se ne izpelje iz `createdAt` reda, ampak se posodobi
  atomarno ob belem dogodku.
- **Zaključek:** časovna semantika je skladna z arhitekturnim dokumentom; ni potrebna sprememba sheme ali kode.

## C. Končna ocena revizije
Rollback **PASS** (odpravljeno + dokazano R1–R4), časovna semantika **PASS** (skladna, brez spremembe).
Upoštevano: varovala (noben tuj WIP ni dotaknjen, ni sheme/migracije/produkcije/Git). **Ne začenjam Faze 2C-3.**