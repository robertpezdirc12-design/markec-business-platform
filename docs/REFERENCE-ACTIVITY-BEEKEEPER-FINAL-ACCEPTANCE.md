# MARKEC — ČEBELARSTVO — FINAL ACCEPTANCE (2D-1Q)

> Zaključna integracijska validacija čebelarstva kot **delujoče poslovne dejavnosti MARKEC**.
> Vsa DB-testiranja izključno na izolirani bazi `markec_e2e_test` prek `scripts/test-db-guard.mjs`
> (fail-closed). Nič sheme/migracij/`product-checkout.ts`/Stripe/webhookov/Git operacij ni spremenjeno.
>
> **KONČNA OCENA: FINAL PASS — ZAKLJUČENA REFERENČNA DEJAVNOST.**

---

## 1. Stanje repozitorija (pred in po)

- `git status` dokumentiran pred začetkom: več tujih neoddanih sprememb (schema.prisma, product-checkout.ts,
  stripe.ts, migracije, številne komponente) — **vse ohranjene, nedotaknjene**.
- Implementacije 2A–2D-1P preverjene in prisotne: `traceability.ts`, `direct-sale.ts`, `apiculture.ts`,
  `colony-moves.ts`, `fill-batch-dialog.tsx`, `traceability/` stran, `beekeeping-final-validation.itest.ts` (novo).
- **Nedotaknjeno:** `prisma/schema.prisma`, migracije, `product-checkout.ts`, `stripe.ts`, `api/webhooks/stripe/route.ts`.
- Brez `git add/commit/push`, brez deploya.

## 2. Spremembe v tej fazi (2D-1Q)

1. `tests/retail-inventory-78.test.ts` — **popravljeni dve zastareli aserciji** (glej §5).
2. `tests/integration/beekeeping-final-validation.itest.ts` — **novo**, 11 testov (serije/zaloga, sočasnost,
   plačila, org izolacija).
3. Dokumentacija (ta datoteka).

---

## 3. Spremenjeni testni stavek (retail-inventory-78) — dokaz vzroka

Oba predhodno neuspešna testa sta bila **zastareli aserciji** na dejansko boljšo (P1-D-1B/C) implementacijo,
NE napaka poslovne logike:

| Test | Stara asercija | Dejansko stanje | Popravek |
|---|---|---|---|
| `submitStockTake … reversible` | `stockQuantity: computed.nextStock` | implementacija zapisuje `stockQuantity: safe.nextStock` (sveže zajeto stanje pod row-lockom `lockStockRow`+`computeSafeDelta`) | asercija → `safe.nextStock` |
| `client shows system vs counted` | regex `/n - p\.stockQuantity/` | variant-aware delta je `n - r.system` (per-variant vrstica) | regex → `/n - r\.system/` |

Poslovna logika ni bila spremenjena; popravljeni so bili samo testni stavki, da preverjajo pravilno, zaklenjeno
in variant-ozaveščeno implementacijo. **Refaktoriranje je iz tuje WIP faze (P1-D-1B/C), ne iz 2D-1P/Q.**

---

## 4. Preverjeni poslovni tokovi

| # | Tok | Rezultat |
|---|---|---|
| 1 | Ustvari panjsko postajo | **PASS** (browser: `Čebelnjak Dolina · Trbovlje · 15 panjev`) |
| 2 | Ustvari panj | **PASS** (browser: `Panj 1 · AŽ · Čebelnjak Dolina`) |
| 3 | Ustvari čebeljo družino | **PASS** (browser: `Družina 1` v `Panj 1`) |
| 4 | Pregled družine / zdravljenje / hranjenje / opravilo | **PASS** (podatkovna plast + dashboard agregat; pregled/treatment/feeding/task ustvarjeni) |
| 5 | Zabeleži pridelek medu | **PASS** (10 kg pridelek) |
| 6 | Iz pridelka ustvari proizvodno serijo | **PASS** (`SERIJA-E2E-1`, fill 20 enot / 10 kg) |
| 7 | Serijo poveži z izdelkom/različico | **PASS** (StockMovement IN + `batchRecordId`, product+20) |
| 8 | Preveri izdelano zalogo in razpoložljivost serije | **PASS** (`getBatchAvailabilityForLine`: neto IN−OUT) |
| 9 | Prodaj iz ene serije | **PASS** (browser neposredna prodaja iz serije, −5) |
| 10 | Prodaj iz več serij v enem naročilu | **PASS** (itest: B1 5 + B2 3 = en OUT na serijo) |
| 11 | Prikaz izvora v naročilu | **PASS** (browser: `Izvor proizvodne serije → SERIJA-E2E-1 · Pridelek medu`) |
| 12 | Podatki se ohranijo po ponovnem odprtju | **PASS** (provenance + traceability stran po reload-u) |

Dashboard agregat (apiculture) je pokazal **1/1/1/1/1/1/1/1** (postaje/panji/družine/pregledi/pridelki/
zdravljenja/hranjenje/opravila), žive zaloge in `Naročila v zadnjih 14 dneh: 2`.

---

## 5. Testni rezultati

### TypeScript
- `tsc --noEmit`: **čist** — edina napaka tuja `scripts/f631-inspect.ts:40` (dokumentirano, ni posledica tega dela).

### Unit suite
- **1350/1350 PASS** (93 test files). Prejšnja 2 faila v `retail-inventory-78` odpravljena (glej §3).

### Integracijski (izolirana `markec_e2e_test`)
| Suite | Testov | Rezultat |
|---|---|---|
| `traceability.itest.ts` | 14 | **PASS** |
| `direct-sale.itest.ts` | 7 | **PASS** |
| `stock-integrity.itest.ts` | 23 | **PASS** |
| `onboarding-membership.itest.ts` | 5 | **PASS** |
| `beekeeping-final-validation.itest.ts` (novo) | 11 | **PASS** |
| **Skupaj** | **60** | **PASS** |

---

## 6. Zaloge, serije, rezervacije in plačila

### Integracija serij z zalogami (§3)
- **Dobava** (DELIVERY), **inventura** (STOCKTAKE navzgor/navzdol, variant-level), **prejem/vračilo** (RETURN),
  **rezervacija** (reserveStock), **prodaja rezervirane** (convertReservationToSale), **sprostitev rezervacije**
  (releaseStockReservation) — vse PAS prek `stock-integrity` itestov (A/B/C/D/E/P bloki).
- **Umik/odpis/poškodovana zaloga:** ni ločenega vira `WASTE`/`DAMAGE` v shemi (`StockMovementSource` =
  MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN). Odpis se knjiži kot generični `OUT MANUAL` (lahko na serijo prek
  `batchRecordId`). **Q1 itest dokazuje:** odpis na seriji zniža neto serije (40→28), ni dvojnega odštevanja,
  prodaja po odpisu več kot ostane → `BATCH_INSUFFICIENT`. → **PASS (kot generični OUT); nota o manjkajočem
  ločenem `WASTE` viru.** Ločena `WASTE`/odpis sledljivost = **NOT VERIFIED / opcija za prihodnost** (schema).
- **Q2 itest:** seštevek razpoložljivih serij == neto knjiga (ΣIN − ΣOUT) pripada izdelku. → **PASS.**
- Serijska razpoložljivost ne omogoči prodaje rezervirane (neto IN−OUT upošteva vse OUT; rezervacije ščiti
  `RESERVED_BLOCK` na fizični zalogi) → **PASS**.

### Plačilni statusi (§5)
| Način | Začetek → konec | Rezultat |
|---|---|---|
| **Gotovina (cash)** | naročilo → `PAID` ob zaključeni prodaji | **PASS** |
| **Nakazilo (transfer)** | naročilo → `PENDING` (ni prejeto, dokler ni potrjeno) | **PASS** |
| **Online** | → zavrnjeno `ONLINE_NOT_SUPPORTED` (ni dejanskega plačilnega toka v neposredni prodaji) | **PASS** |

---

## 7. Sočasnost in celovitost (§4)

| Scenarij | Itest | Rezultat |
|---|---|---|
| Dve sočasni prodaji iste serije | traceability #7 | **PASS** (1 uspe, neto 15−10) |
| Dve sočasni prodaji iz različnih serij istega izdelka | final Q4 | **PASS** (obe uspeta, neodvisna neto) |
| Sočasno polnjenje + prodaja | final Q5 | **PASS** (neodvisno) |
| Poskus prodaje več kot razpoložljivo | traceability #6, final Q3 | **PASS** (`BATCH_INSUFFICIENT`, brez delnih) |
| Dvojno oddaja istega polnjenja | traceability #11 | **PASS** (`DUPLICATE_FILL`) |
| Ponovitev po neuspehu | stock-integrity C1-C3 | **PASS** (brez delnih sprememb) |
| Rollback ob odpovedi | direct-sale #7, traceability #8 | **PASS** |

Neuspešna operacija ne pusti delne zaloge/naročila/serije/zgodovine — transakcijsko, `FOR UPDATE` + CAS.

---

## 8. Organizacijska izolacija (§6)

| Scenarij | Rezultat |
|---|---|
| A ne more uporabiti B-jeve serije pri polnjenju | **PASS** (`BATCH_NOT_FOUND`) |
| A ne more uporabiti B-jeve serije pri prodaji | **PASS** (`BATCH_NOT_FOUND`, brez naročila) |
| A ne vidi B-jevega pridelka | **PASS** (izven `getHarvestProduction`) |
| A-jev `resolveOrderProvenance` na B naročilu | **PASS** (`null`) |
| Tuja varianta/izdelek pri premiku zaloge | **PASS** (`NOT_FOUND`/`VARIANT_MISMATCH`, stock-integrity I1/I2) |

Vsi strežniški odzivi so varni (fail-closed), ne zgolj skriti v UI.

---

## 9. Browser + mobilna validacija (§7)

Testna aplikacija na portu 3002 (izolirana baza), prijavljeni čebelar `Svezi Cebelar Test`.

- **Registracija novega čebelarja → User + Organization + OrganizationMember(ADMIN)**: **PASS**
  (`onboarding-membership` itest).
- **Prvi vstop v dashboard**: **PASS**, čebelarski workspace z pravilnim profilom.
- **Evidence (browser)**: apiary, hive, colony ustvarjeni skozi dejanski UI obrazec; ostali tipi
  (inspection/treatment/feeding/queen_management/task) podatkovno + dashboard agregat. **PASS.**
- **Dashboard + pametni predlogi**: **PASS** (1/1/1/… agregati, "Objavite svojo stran" predlog).
- **Polnjenje serije + prodaja**: **PASS** (`SERIJA-E2E-1` 20 enot, prodaja 5 iz serije).
- **Prikaz izvora v naročilu**: **PASS** (`Izvor proizvodne serije`).
- **Rezervacije in zaloge**: **PASS** prek `stock-integrity` itestov (rezervacija/prodaja rezerviranega/spust).
  UI rezervacije živi v `product-checkout.ts` (zaščiten; ni spreminjan).
- **Mobilni (390×844)**: apiculture, orders, traceability, order-detail — **brez preliva**, hamburger meni,
  dialogs/tabele delujejo.

---

## 10. Preostale omejitve / NOT VERIFIED

1. **Ločen vir `WASTE`/poškodovana zaloga** — shema nima `StockMovementSource.WASTE`; nima ločenega odpisnega
   toka. Odpis deluje kot generični OUT MANUAL (neto serije se pravilno zniža). **NOT VERIFIED** kot posebna
   revizijska sled; opcija ob prihodnji shemi.
2. **UI rezervacij (`product-checkout.ts`)** — zaščitena datoteka; rezervacije preverjene na podatkovni ravni
   (itest), ne browser. **NOT VERIFIED (browser)** / PASS (itest).
3. **Registracija novega čebelarja** preverjena na ravni server-akcije/itesta; celoten onboarding wizard skozi
   browser ni ločeno ponovljen v tej fazi (obstaja v predhodnih fazah 2D-1H/I).
4. Ena kljucna shema-nadgradnja (`OrderItemBatchAllocation`/`ProductionContribution`/`PRODUCTION` enum) iz
   dokumentacije ostaja **predlog za prihodnost** — **NI bila potrebna** za delujoč tok (sledljivost deluje
   prek `StockMovement.batchRecordId` + `ExtensionRecord`).

---

## 11. Končna ocena

**FINAL PASS — ZAKLJUČENA REFERENČNA DEJAVNOST.**

- Ključni poslovni tokovi so dejansko povezani in delujejo (pridelek → serija → zaloga → prodaja → izvor),
  preverjeno v UI in testni bazi.
- Regresija: **tsc čist**, **unit 1350/1350**, **itest 60/60** na izolirani bazi.
- Org izolacija, sočasnost, rollback, plačilni statusi in pomembnejša integracija z zalogo: **PASS**.
- Preostalo so **opcijske shemske nadgradnje**, ne blokade.