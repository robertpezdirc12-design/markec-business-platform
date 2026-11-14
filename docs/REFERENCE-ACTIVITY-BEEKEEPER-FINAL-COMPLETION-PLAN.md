# MARKEC — REFERENČNA DEJAVNOST ČEBELAR — KONČNI NAČRT DOKONČANJA IN PRODUKCIJSKE PRIPRAVLJENOSTI

> READ-ONLY revizija in zaključni načrt. **Nič kode/sheme/migracij/baze ni spremenjeno; Git operacij nobenih;
> tuj WIP in `einvoices.ts` nedotaknjeni; `markec_dev`/produkcija nedotaknjena.** Vse faze čakajo na ločeno
> izrecno odobritev. Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Povzetek dejanskega stanja

Čebelar v MARKEC je **pretežno implementiran prek generičnih podsistemov (ExtensionRecord, univerzalni records UI,
StockMovement, checkout), a še NI popolnoma dokončan**: obstajajo skupine ce-živih podatkov (nadzorna plošča,
dejavnostna navigacija, serijska sledljivost, zalogovna zaščita) in **ena kritična blokada na tujem WIP**
(`applyOrderStockDecrement`). Ni "popolnoma delujoč" po merilih iz navodila.

---

## 2. Že dokončano in preverjeno (EXISTING-VERIFIED / PARTIAL)

| Področje | Status | Dokaz |
|---|---|---|
| 9 čebelarskih evidenc (apiary, hive, colony, inspection, treatment, feeding, queen_management, task, harvest) | EXIST-VER (kot ExtensionRecord `bee-apiary`) | `src/lib/profiles/extensions.ts:224-381` |
| Premiki družin (colony_move append-only, hive_ref kot trenutna lokacija, performed_by iz seje, txn) | EXIST-VER | `src/app/actions/colony-moves.ts` (org-scope `requirePermissionOrg("workorders.manage")`, `$transaction`) |
| Generični org-scoped CRUD za ExtensionRecord (z appendOnly guard) | EXIST-VER | `src/app/actions/records.ts` :239/:290/:346 |
| UI za evidence (univerzalni `RecordsClient` po entityKey; edina čebel. specifika `ColonyDetailSection`) | EXIST-VER/PARTIAL | `records-client.tsx`, `record-detail.tsx:111/:125` |
| Izdelki & varianta (P1-A/B/B-UI/C: abs. set blokiran) | EXIST-VER (delno) | products.ts, catalog.ts, server-schema.ts |
| StockMovement ledger (IN/OUT source ORDER/DELIVERY/STOCKTAKE/RETURN) | EXIST-VER | `src/app/actions/inventory.ts` :81/:371/:513 |
| Checkout, naročila, rezervacije (reserve/release/convert/applyOrder) | EXIST-VER (delno) | `src/app/actions/product-checkout.ts`, Order:1244, OrderItem:1303 |
| Stripe webhook & e-računi (einvoices.ts, Document) | EXIST-VER (tuj) | `src/app/api/webhooks/stripe`, `einvoices.ts` (untracked) |
| Testi (vitest: stock.test.ts, server-schema.test.ts idr.) | EXIST-VER (delno) | `tests/**` |

---

## 3. Manjkajoče funkcionalnosti (GAP / FAIL)

1. **Čebelarska nadzorna plošča (FAIL/GAP):** dashboard je generična; čebelarski kazalniki (št. postaj/panjev/
   družin, zadnji pregledi, opravila, roki, pridelki, serije) **NAJDIO**, niso na plošči. Widgeti beekeeping =
   `["revenue","recentOrders","lowStock","customers"]` (registry.ts:808) — vse generično, brez čebelarskih.
2. **Dejavnostna navigacija (GAP):** čebelar je pod generičnim `records` nav itemom (sidebar.tsx:96), ni lastnega
   menija/terminologije razen omejene (termKey; ColonyDetailSection). Generična imena brez čebelarskega konteksta.
3. **Serijska sledljivost pridelka→prodaje (GAP, 2D-1 G7/PROPSED):** Povezava Harvest→ProductionContribution→
   ProductionBatch→Product→StockMovement IN→OrderItemBatchAllocation→ISSUE→OUT zahtevana (2D-1W/P1-D), a **ni
   implementirana v kodi**; pridelek v ExtensionRecord JSON je ločen od product stock. `OrderItemBatchAllocation`/
   `ProductionContribution` modela **ni**.
4. **Zalogovna zaščita direktne prodaje (BLOCKED/P1-D-1A):** `applyOrderStockDecrement` (tuja WIP) preverja le
   `stock>=qty`, ne `S−RES>=qty`; popravek znan, a **blokiran na tujem WIP**.
5. **Variant-aware inventura (GAP/P1-D-1B):** `stocktakeLineSchema` nima `productVariantId` (inventory:491).
6. **Agregacija zaloge variant (GAP/P1-D-3):** prikaz Product z variantami ne sešteva variant (product-level
   `computeAvailableStock`, ne Σ variant).
7. **OpenDeletion—Transfer modelov (prehod product↔variant)** — PROPOSED.
8. **Rezervacijska ownership (GAP/P2-G3):** `releaseStockReservation` agregat brez orderId.
9. **E2E browser test ni dokazan** (Playwright/Cypress — NOT VERIFIED).

---

## 4. Znane napake in tveganja

- **P0:** direktna prodaja lahko poseže v rezervirano zalogo (applyOrderStockDecrement).
- **P1:** zaloga+StockMovement sočasna varnost (ni FOR UPDATE na stock), inventura ne-variant, brak agregacije
  variant.
- **P1:** rezervacijska ownership (sprostitev lahko zadeva napačno naročilo).
- **P1:** čebelarska nadzorna plošča/nav so GAP → uporabniško nedokončano.
- **NOT VERIFIED:** E2E, mobilni (390/768/1366) nisem preverjal z dejanskim browser naskakovanjem.

---

## 5. Blokade zaradi tujega WIP (BLOCKED)

1. **`src/app/actions/product-checkout.ts`** (M, tuj diff +572/−81): celoten `applyOrderStockDecrement` je tuj
   added-block → **P1-D-1A NOT IMPLEMENTED (BLOCKED)**. (Navodilo piše `src/lib/actions/product-checkout.ts` —
   to je **tipkografska**; dejanska pot je `src/app/actions/product-checkout.ts`.)
2. **`prisma/schema.prisma`** (M, tuj): vse sheme (P1-D-1D StockOperation, P1-D-2 OPENING_BALANCE, G7) blokirane,
   dokler tuj WIP ni pregledan/committed ali odobren poseg.
3. **`src/app/actions/einvoices.ts`** (untracked, tuj): ne dotikati.

---

## 6. Celoten načrt dokončanja (faze, po vrstnem redu)

| Faza | Cilj | Datoteke (predvid.) | Shema | Merilo PASS | Odvisnost |
|---|---|---|---|---|---|
| **R1** | Konsolidacija rezultatov (ta dok.) | dok | NE | — | — |
| **R2** | Razrešitev tujega WIP blokade (product-checkout / odobritev posega) | product-checkout.ts (po odobr.) | NE | P1-D-1A mogoče | odločitev |
| **1A** | Zaščita razp. zaloge `S−RES>=qty` | product-checkout.ts | NE | direktna prodaja ne seže v RES | R2 |
| **1B/1C/1D/1E** | Variant inventura / zaklepanje / idempotency / validacija | inventory, nov model | 1D PROPSED | vsaka posebej | 1A |
| **D1** | `OPENING_BALANCE` + začetni saldo | inventory, schema | PROPSED | ne-dvojno knjiženje | 1A/D |
| **G7** | Sledljivost pridelek→serija→izdelek→prodaja (`ProductionContribution`,`OrderItemBatchAllocation`) | novi modeli + records | PROPSED | izvor vsakega prodanega izdelka | 1A,D |
| **Z1** | Čebelarska nadzorna plošča (št. postaj/panjev/družin, pregledi, roki, pridelki, serije) | dashboard, widgeti, registry | NE | live DB vrednosti | — |
| **N1** | Dejavnostna navigacija/terminologija (meni čebelar, podstrani, prazna stanja) | sidebar/layout/i18n | NE | uporabnik vidi čebelarske izraze | — |
| **T1** | Dokončanje trgovine/naročil + računovodska vez (vat, račun, e-računi) | orders, invoice | NE | cena/DDV/status naročil | 1A |
| **M1** | Mobilno preverjanje 390/768/1366 | (sprejet) | NE | brez horizontalnega/odrezanih | vse |
| **E1** | Končni 21-koraki E2E + varnost (IDOR, multi-tenant) | (e2e testi) | NE | celotna pot z živimi vrednostmi | vse |

Vrstni red lahko spreminjamo le z utemeljenim dokazom odvisnosti/blokade.

---

## 7. Odvisnosti med fazami

- **1A ⟵ R2** (R2 odgovarja tuj WIP pred popravkom).
- **1B/1C/1D ⟵ 1A** (najprej A, zato sočasnost/idem na pravem guard).
- **G7/D1 ⟵ StockMovement ureditev (1A-D)** (serijska sledljivost potrebuje zrelo stanje/ledger + začetni saldo).
- **Z1/N1/T1** so neodvisni od zalogovnih; lahko vzporedno (po ločenem odobritvi).

---

## 8. Predlagane spremembe datotek (po fazah, PROPOSED)

- **Faza 1A (blokirana):** `src/app/actions/product-checkout.ts:98-99/:117-118` → `S−RES>=qty` (atomsko, kot
  `$executeRawUnsafe` + AVAIL).
- **Faza 1B:** `src/app/actions/inventory.ts` `stocktakeLineSchema` (:491) dodati `productVariantId`; posodobiti
  `submitStockTake` (variant-aware).
- **Faza 1C:** `inventory.ts` in `product-checkout.ts` → `SELECT FOR UPDATE` na agregat v txn; order lock; retry.
- **Faza 1D:** nov model `StockOperation` (+ `@@unique(org,key)`) — PROPSED shema.
- **Faza G7:** novi modeli `ProductionContribution`/`OrderItemBatchAllocation` + records/UI — PROPSED shema.
- **Faza Z1/N1:** dashboard stran + widgeti + registry (registry.ts:800-811), sidebar (sidebar.tsx:96), i18n
  termKey.
- Vse v OBSTOJEČIH tujih datotekah (product-checkout, schema) → najprej R2 (odločitev).

---

## 9. Testni načrt (proposal)

Unit (guards/bilance/agregacija), integration (org izolacija, concurrency, rollback, rezervacije) na **izolirani
test DB** (ne markec_dev/prod), migration-test (A–F skupine), browser E2E (21-koraka) za žive poti,
mobilni E2E (390/768/1366). Vsak rezultat PASS/FAIL z dejanskim izhodom; NOT VERIFIED če ne izvedeno.

---

## 10. Končna merila produkcijske pripravljenosti čebelarja

PASS samo, če ZA dea deleže, da:
1. Vseh 9 evidenc + premiki delujejo (org-scoped, referenčne izbire, mobilno).
2. Serijska sledljivost pridelek→serija→izdelek→zaloga→naročilo→izdaja→prodaja je preverljiva (G7).
3. Zalogovne operacije so transakcijsko varne, brez neg. zaloge/izgubljenih spr. (1A–1E).
4. Nadzorna plošča čebelarja prikazuje žive DB vrednosti (Z1).
5. Navigacija/terminologija je čebelarska (N1).
6. Trgovina/naročila/plačila/računi/e-računi delujejo, cenе/DDV pravilni (T1).
7. Multi-tenant izolacija + IDOR preprečen (E1).
8. Mobilno 390/768/1366 brez odreza/odrezanih (M1).
9. E2E končni scenarij PASS z dejanskimi vrednostmi (E1).

Če katerokoli merilo ni dokazano → čebelar **NI produkcijsko pripravljen**.

---

## 11. Pripravljenost odobritev

- **Že odobreno/zaključeno:** P1-A/B/B-UI/C (PASS), 2D-1 analiza (P1-D-1..E načrt), arhitektura P1-D.
- **Čaka na ločeno odobritev vsaka faza:** R2, 1A, 1B, 1C, 1D, 1E, D1, G7, Z1, N1, T1, M1, E1.
- **Nič ni samodejno implementirano** v tem dokumentu.

---

## 12. Povzetek za odločanje

**Kaj že deluje:** ExtensionRecord ce-živo pre-met CCB evidence + premiki (append-only), StockMovement ledger,
checkout/naročila/rezervacije (delno), izdelki&varianta (P1-A/B blokada), generični records UI, einvoices (tuj).

**Kaj manjka:** čebelarska nadzorna plošča, dejavnostna navigacija, serijska sledljivost (G7), zalogovna zaščita
direkt (1A), variant inventura (1B), zaklepanje/idempotency (1C/1D), agregacija variant (1D), E2E/mobilni dokaz.

**Kaj je blokirano:** P1-D-1A (tuj WIP v product-checkout.ts), vsa sprememba sheme (tuj WIP v schema.prisma),
einvoices (tuj).

**Naslednja najmanjša varna implementacijska faza:** **R2** → odločitev o tujem WIP (product-checkout.ts), nato
**P1-D-1A** (popravek `S−RES>=qty`) — pred vsemi ostalimi.

---

## 13. Končni status po področjih (PASS/PARTIAL/FAIL/NOT VERIFIED/BLOCKED)

| Področje | Status |
|---|---|
| 9 evidenc + premiki | PASS/EXIST-VER |
| Zalogovni ledger (IN/OUT/stocktake/delivery) | PASS/EXIST-VER |
| P1-A/B/UI/C (blok abs. set) | PASS |
| Checkout/naročila/rezervacije | PARTIAL (ownership, direktna zaloga GAP) |
| P1-D-1A (zaščita razp. zaloge) | **BLOCKED** (tuj WIP) |
| P1-D-1B/1C/1D/1E | NOT VERIFIED/BLOCKED (čaka) |
| Serijska sledljivost G7 | GAP/PROPSED |
| Čebelarska nadzorna plošča + navigacija | **FAIL/GAP** |
| Mobilno / E2E | NOT VERIFIED |
| Tuji WIP / einvoices / schema | Nedotaknjeno (blokade) |

**Čebelar NI produkcijsko pripravljen do izpolnitve meril iz §10.**

---

## Končna zaustavitev / potrditev
- Ustvarjen samo zaključni načrt: DA.
- Koda nespremenjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze/testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuj WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjeni: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Ustavljam se. Nobena faza ni samodejno odobrena; vsaka (zlasti najprej R2/1A) čaka na ločeno izrecno odobritev.
Ne razglašam čebelarja za dokončanega.**