# MARKEC — P1-D — ARHITEKTURA UNIVERZALNEGA NADZOROVANEGA KNJIŽENJA ZALOGE

> READ-ONLY arhitekturna priprava. **Nič kode/sheme/migracij ni spremenjeno.** Git operacij nobenih;
> `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/produkcija nedotaknjena. Implementacija P1-D **Ni
> odobrena**. Statusi: EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED.

---

## 1. Povzetek trenutnega stanja

P1-A/B/B-UI/C so zaključeni: neposredno vpisovanje `stockQuantity` iz običajnih obrazcev izdelkov in variant je
odstranjeno (server-bele liste + UI). Ostaja **en nadzorovan strežniški zalogovni tok** `createStockMovement`
(inventory.ts:81), ki posodobi stanje in zapiše append-only `StockMovement` v eni transakciji. Ta tok je temelj
univerzalnega knjiženja. Manjkata pa eksplicitni **začetni saldo** (ni enum vrednosti `OPENING_BALANCE`) in
**razdelana politika korekcij/inventure/rezervacij**.

---

## 2. Dejanski pregled Prisma modelov in enumov (EXISTING-VERIFIED)

### 2.1 Enum
- `StockDirection` (prisma:2115) = `IN, OUT`.
- `StockMovementSource` (prisma:2120) = `MANUAL, ORDER, DELIVERY, STOCKTAKE, RETURN`.
  **`OPENING_BALANCE`/`PRODUCTION`/`REPAIR` NE obstajajo** → PROPOSED (če bodo potrebni).

### 2.2 `Product` (org-scoped)
- `stockQuantity Int @default(0)` (:1189), `reservedQuantity Int @default(0)` (:1195).

### 2.3 `ProductVariant` (org-scoped, 1:N pod izdelkom)
- `stockQuantity` (:1580), `reservedQuantity` (:1582). Variant-aware.

### 2.4 `StockMovement` (ledger, append-only; :2130)
- `organizationId, productId, productVariantId?, direction(IN/OUT), quantity(Int>0), source(default MANUAL),
  note?, orderId?, supplierRecordId?, batchRecordId?, createdById?, createdAt`.
- Povezave na `Organization`, `Product`, `ProductVariant`, `Order`, `ExtensionRecord(supplier/batch)`, `User`.
- **Ni** `reservationEventId`, `openingBalanceId`, `reason enum`, `correctsMovementId` → PROPOSED (G3/2D-1).

### 2.5 Zaloge
- Eno stanje namesto podvajanja: `Product` in `ProductVariant` imata vsak svoj `stockQuantity` (state); `StockMovement`
  je knjiga premikov. Čebelsko sledljenje prek `supplierRecordId`/`batchRecordId` (ExtensionRecord).

---

## 3. Pregled zalogovnih zapisovalnih poti (EXISTING-VERIFIED / PARTIAL)

### 3.1 Kontrolirani strežniški tok (ZELO ponovno uporabljiv)
- `createStockMovement` (inventory.ts:81): org-scope, product pripada org, variant pripada product+org, traceabil,
  `computeStockDelta` (NEGATIVE_STOCK guard), `$transaction` posodobi stock + zapiše StockMovement append-only
  (:163–188). **Dvigne IN/OUT prek `source` (MANUAL/DELIVERY/STOCKTAKE/RETURN).**
- `recordDelivery` (inventory.ts:371): prejem → `source=DELIVERY`, IN (+ledger).
- `submitStockTake` (inventory.ts:513): inventura → zapis DELTA v StockMovement (`source=STOCKTAKE`).

### 3.2 Checkout / rezervacije / prodaja (PARTIAL)
- `reserveStock` (:166 reserved+), `releaseStockReservation` (:187 reserved−),
  `convertReservationToSale` (:208 reserved−, stock−, StockMovement ORDER OUT),
  `applyOrderStockDecrement` (:91 stock−, StockMovement ORDER OUT). — rezervacijski agregat `reservedQuantity`,
  NI novega `StockReservationEvent` (PROPOSED, ločene faze).

### 3.3 Opustitve
- `createProductVariant`/`createProduct`/`updateProduct(uri)` v skladu s P1-A/B ne nastavljajo več stockQuantity.

### 3.4 Vse pisalne poti (stržene, z vrsticami)
| Pot | Vrsta | StockMovement | txn | org | Status |
|---|---|---|---|---|---|
| createStockMovement | IN/OUT (MANUAL/DELIVERY/STOCKTAKE/RETURN) | DA | DA | DA | EXIST-VER |
| recordDelivery | IN DELIVERY | DA | DA | DA | EXIST-VER |
| submitStockTake | DELTA | DA | DA | DA | EXIST-VER |
| applyOrderStockDecrement | OUT ORDER | DA | DA | DA | EXIST-VER |
| convertReservationToSale | OUT ORDER + reserved | DA | DA | DA | EXIST-VER |
| reserveStock | reserved+ | NE | DA | DA | EXIST-VER |
| releaseStockReservation | reserved− | NE | DA | DA | EXIST-PART (ownership) |
| (P1-B/C) create/update | (blokirano) | — | — | DA | PASS |

---

## 4. Ciljna arhitektura (PROPOSED)

**Eno univerzalno jedro, vsaka operacija prek `createStockMovement`-poti (ali njenega razširjenja):**

```
Operation(initial-balance / receipt / increase / decrease / issue / stock-take)
  → validate(org, product/variant, unit, qty>0, stock≥reserved, reason, permission)
  → $transaction {
       SELECT FOR UPDATE (Product|ProductVariant agregat)
       check: prev + delta ≥ 0, next ≥ reservedQuantity
       update Product|ProductVariant.stockQuantity = next
       create StockMovement { source, note/reason, createdById }
     }
  → (po potrebi) Reservation/ISSUE/ledger vez (G3 v okviri korekcij/izdaj)
```
- **Nobeno** novo vzporedno stanje; `StockMovement` ostane edina knjiga premikov.
- Začetno stanje, prejem, povečanje/zmanjšanje, izdaja se formalizirajo kot **tipizirane operacije** nad tem tokom
  (delijo helper + guard), ne kot ločene vzporedne baze.

---

## 5. Model začetnega knjiženja (PROPOSED)

- **Začetni saldo = `StockMovement IN`** s posebnim virorom. Ker `OPENING_BALANCE` ne obstaja v enumu (GAP), PREDLOG:
  - **Možnost A (zaželena):** dodati `OPENING_BALANCE` v `StockMovementSource` (+ NOVA enum vrednost je PROPOSED,
    Ni urejanje obstoječega — dodatek), s poljem `openingBalanceId` (migracijski marker) na `StockMovement`.
  - **Alternativa (če A ni odobreno):** uporabiti `MANUAL` + obvezen `note`/`reason` tip `OPENING` — slabše za
    verifikacijo/bilanco. Priporočen A.
- **Preprečitev večkratnega začetnega knjiženja:** `@@unique(org, productId|variantId|openingBalanceId)` ali
  aplikativna preverba »za določen product/variant obstaja ≤1 opening-balance v txn` + retry P2034).
- **Ločeno od prejema nove zaloge:** prejem = `StockMovement IN source=DELIVERY`, medtem ko opening-balance =
  `source=OPENING_BALANCE` (posebej označeno).
- Primer iz §1: izdelek A, 100 → `StockMovement IN(OPENING_BALANCE, qty=100)` → stanje 100.

---

## 6. Model prejema in drugih operacij (PROPOSED — preko obstoječega toka)

| Operacija | source | Polja (ex. obstoječe sheme) | Guardi |
|---|---|---|---|
| Prejem | `DELIVERY` (ex.) | product/variant, qty, supplierRecord?, note | org, qty>0 |
| Povečanje | `MANUAL` (ali NEW `ADJUST_IN`) | qty, reason/note | org, qty>0 |
| Zmanjšanje | `MANUAL` (ali NEW `ADJUST_OUT`) | qty, reason | org, qty>0, next≥0, next≥reserved |
| Izdaja / poraba | `ORDER` (ex.) ali `ISSUE` | qty, orderId? | org, next≥reserved, vez |
| Inventura | `STOCKTAKE` (ex.) | prešteto qty, razlika | zapis DELTA, next≥reserved, ne tiho prepis |
| Začetno stanje | `OPENING_BALANCE` (PROPOSED) | 100 | anti-dup |
- **Ne podvajamo oblika dobav:** prejem uporablja `source=DELIVERY` (že obstaja), ne nova tabela.
- **Zmanjšanje/izdaja vedno ščiti rezervacije:** `nextStock = prev − qty ≥ reservedQuantity` (guard v toku).

---

## 7. Pravila rezervacij in prodaje (skladno z 2D-1)

- **Rezervacija ne spremeni fizične zaloge** (`reserveStock`; `reservedQuantity+`, stock nespremenjen). — EXISTENT.
- **Izdaja spremeni fizično** (`convertReservationToSale`, `applyOrderStockDecrement` → StockMovement OUT + stock−). — EXISTENT.
- **Sprostitev ne spremeni fizične zaloge** (`releaseStockReservation`; reserved−). — EXISTENT, ampak **ownership
  (per-order) vrzel** (W4/G2).
- **Preprečiti dvojno izrabo:** urejanju same rezervacije → PROPOSED `StockReservationEvent` (G3/2D-1 P1): vsaka
  RESERVE↔ISSUE↔RELEASE vezena, `reservationEventId`, `@@unique`. V trenutni kodi **NI** (agregat v
  `reservedQuantity`).
- **Podvojeni webhooki:** `applyOrderStockDecrement`/`verifyProductOrder` uporabljajo status-CAS + guard → ne
  dvakrat (EXIST-PARTIAL: potrebna idempotency key za popoln).
- **Sprostitev prve ne sme sprostiti druge:** ownership vez je nedosegljiva v trenutnem agregatu → **GAP**; rešitev
  `StockReservationEvent` (P2).

---

## 8. Pravila izdelkov in variant (PROPOSED)

- **Avtoritativni nosilec zaloge:** če izdelek ima variante → variant (ProductVariant) je nosilec; če Dn → product.
- **Preprečiti dvojno štetje:** `Product.stockQuantity` za izdelek z variantami se NE sme dodatno šteti (bodisi
  product brez variant, bodisi variant upravlja; ne oboje). Določiti pravilo: zaloga izdelka = sin (Σ variant) ali
  neodvisen product-level (potrebna odločitev; GAP/NOT VERIFIED).
- **Variant-aware guard:** `createStockMovement` že preveri variant pripada product+org (:103–115).
- **Organizacija:** vsi zapisi org-scoped; `requirePermissionOrg` v vsaki akciji; prepreči IDOR.

---

## 9. Transakcije, sočasnost in idempotentnost (PROPOSED)

Za vsako operacijo: zaklen ignitiono agregatno vrstico (Product/Variant — **variant row** pri variantah), enoten
red (agregat→rezervacijski dogodek→orderItem), updata stock, zapis StockMovement, pogoji (qty≥0, next≥reserved),
na konfliktu retry P2034 (idempotentne). 
- EXISTENT: `createStockMovement` `$transaction` + `computeStockDelta` (NEGATIVE_STOCK).
- PROPOSED: `SELECT FOR UPDATE` ekspliciten (Prisma `$queryRaw`/`FOR UPDATE`), idempotency key per operacija,
  `stock≥reserved` v isti txn. **Ni površinske UI validacije — vse na serverju.**

---

## 10. Univerzalni user-interface (PROPOSED)

### A. Pregled zaloge
Izdelek/varianta, f = stockQuantity (state), R = reservedQuantity, A = stock−reserved, low-stock opozorilo
(ex. isLowStock helper).

### B. Nova operacija
Izbira vrste: začetno stanje / prejem / povečanje / zmanjšanje / izdaja / inventura → dinamična polja (qty, enota,
reason/note, dokumenta via supplierRecord/batchRecord, user). Vsaka akcija na serverju kliče kontrolirani tok.

### C. Zgodovina
Prikaži iz `StockMovement`: datum, vir (source), izdelek/varianto, qty, direction, predhodno/novo stanje (iz
zaporedja), uporabnika, dokument/razlog.

### D. Podrobnosti / korekcija
Popravljive: samo zapisi pred knjiženjem; že knjiženo → **nov korekcijski dogodek** (`reason`/nov StockMovement
OUT/IN), **NIKOLI brisanje zgodovine**.

---

## 11. Univerzalnost za vse dejavnosti MARKEC (PROPOSED)

- **Univerzalno jedro:** `Product`/`ProductVariant` + `StockMovement` + kontrolirane operacije + enote mere
  (`unit`) + `source`/`reason` — uporabno za čebelarja (med/koz/embalaža), frizerja (šamponi), mehanika (delin),
  šiviljo (blago), trgovino (product/variant), itd.
- **Ločitev:** čebelarska logika (harvest/batch/production, `supplierRecordId`/`batchRecordId`, ExtensionRecord) je
  **posebna razširitev**; spada v čebelarske dele (P/G7), NE v univerzalni zalogovni modul.
- **Noben poseben čebelarski workflow NI v tem modulu.**

---

## 12. Migracijski načrt (PROPOSED, brez izvedbe)

- Obstoječa fizična zaloga (stanje) → en **`StockMovement IN(OPENING_BALANCE)` per product/variant** =
  **začetna bilančna vrstica** (dokumentirano kot baseline, ne trditev o izvoru). NIkoli ne izmisli izvora/harvest
  povezave.
- Pri obstoječih `StockMovement` — ohranjeni (že ledger); `supplierRecordId`/`batchRecordId` — ohranjeni.
- `reservedQuantity` → `RES_legacy_unknown` izključeno iz A (ali dokazljivo povezan); **ne ugibati** naročilo.
- Preverjanje: `Σ IN − Σ OUT == stockQuantity`; dvojno knjiženje → idempotentna migr. + `openingBalanceId`; rollback
  → kopija. Smešno **ročno uskladitev** za legacy (ni rekonstrukcije zgodovine za nazaj).

---

## 13. Testna strategija (PROPOSED)

| Scenarij | Tip |
|---|---|
| začetno knjiženje, anti-dup | unit + integration |
| prejem / povečanje / zmanjšanje | integration |
| inventura (DELTA, next≥reserved) | integration |
| rezervacija ne gre v stanje; sprost. ne gre | unit |
| izdaja → stock− + StockMovement OUT | integration |
| prodaja/vračilo | integration |
| sočasna knjiženja (race) | integration (izolirano) |
| idempotentnost / rollback | integration (izolirano) |
| napačna org / napačna varianta | unit + negative test |
| negativna zaloga / stock<reserved | unit + integration |
| UI E2E (pregled/hist., operacija) | browser E2E |

Vsi testi samo na izoliranem test DB (ne `markec_dev`/prod). Če okolja ni → NOT VERIFIED.

---

## 14. Zaporedje implementacijskih faz (PROPOSED, ločeno odobrive č.draw)
- **P1-D-1:** formalizacija kontroliranega toka (operacija-tipi nad `createStockMovement`), guard `stock≥reserved`,
  `SELECT FOR UPDATE`, idempotency — brez sheme (ali le razširitev).
- **P1-D-2:** začetno knjiženje (`OPENING_BALANCE` enum → **PROPOSED shema** + `openingBalanceId`).
- **P1-D-3:** UI (pregled/hist., nova operacija po tip, korekcija kot nov dogodek).
- **P1-D-4:** `StockReservationEvent` (v sklopu stop/nadgradnja rezervacij — G3/P2).
- Vsaka faza majhna, samostojno testabilna, rollback-varna. **P1-D-1 pred P1-D-2** (tok prej kot enum).

---

## 15. Tveganja in odprta vprašanja

1. **Enum `OPENING_BALANCE` (in po možnosti `PRODUCTION`/`REPAIR`) je PROPOSED** — potrebna odločitev, ali dodati
   novo enum vrednost (priporočeno) ali `MANUAL`+tag.
2. **Avtoritativni nosilec zaloge za izdelek z variantami** — odločitev: product=Σvariant ali variant-level-break;
   trenutno se pomaga z `createStockMovement` po izbiri. **NOT VERIFIED.**
3. **`StockReservationEvent` (P2/G3)** — ownership/rezervacijska vez med RESERVE↔ISSUE↔RELEASE še ni v kodi; GAP.
4. **Idempotency za webhook/ISSUE** — EXIST-PARTIAL (status-CAS; polna idempotency key PROPOSED).
5. **Migr. legacy-rezervacij** — ročna uskladitev; nikoli izmišljeno naročilo.
6. **Sočasnost za product-z-variantami** — zaklepanje na variant row (ne samo product).

---

## 16. PASS / PARTIAL / FAIL / NOT VERIFIED (za vsako pomembno ugotovitev)

| Ugotovitev | Status | Dokaz |
|---|---|---|
| StockMovement je append-only ledger z org/product/variant/source/order/supplier/batch | PASS (EXIST-VER) | prisma:2130 |
| StockMovementSource = 5 vrednosti; OPENING_BALANCE NE obstaja | PASS (EXIST-VER) | prisma:2120 |
| createStockMovement = org-scope + txn + NEGATIVE_STOCK + ledger | PASS (EXIST-VER) | inventory:81–188 |
| recordDelivery/submitStockTake = ledger IN/STOCKTAKE | PASS (EXIST-VER) | inventory:371,513 |
| rezervacije NE spreminjajo fiz. (reserveStock), sprostitev NE | PASS (EXIST-VER) | checkout:166,187 |
| izdaja/prodaja → StockMovement OUT + stock− | PASS (EXIST-VER) | checkout:91,208 |
| reservation ownership (RESERVE↔ISSUE↔RELEASE) | PARTIAL/OPEN | način P2/G3 |
| idempotency (polna) | PARTIAL | status-CAS; key PROPOSED |
| SELECT FOR UPDATE / lock variant-row | PARTIAL/PROPOSED | ni v kodi target |
| `stock ≥ reserved` guard v SPREMEMBE | PARTIAL | guard le NEGATIVE, ne reserved |
| univerzalnost (Product+Variant+StockMovement+unit) | PASS (arhitekt ur.) | shema |
| migr. brez izmišljanja (OPENING_BALANCE baseline) | PROPOSED | ni izvedeno |
| `OPENING_BALANCE` / `PRODUCTION` / `REPAIR` enum | PROPOSED/GAP | ni v shemi |

**Sklepna statusna: PARTIAL** — jedro kontroliranega toka obstaja (PASS EXIST), vendar zaök vs: enum
`OPENING_BALANCE` (PROPOSED), `stock≥reserved` guard v vsaki spremembi (PARTIAL), reservation-ownership (GAP),
SELECT FOR UPDATE (PROPOSED) in univerzalna UI še ni gradjena.

---

## 17. Končna zaustavitev / poročilo

- **Pregledano:** Prisma `StockMovement`/`StockMovementSource`/`Product`/`ProductVariant`; akcije `createStockMovement`,
  `recordDelivery`, `submitStockTake`, `reserveStock`, `releaseStockReservation`, `convertReservationToSale`,
  `applyOrderStockDecrement`; P1-A/B/C rezultati.
- **Dokazano:** StockMovement je append-only ledger; kontrolirani tok obstaja in je org-scoped + transaction + delna
  zaščita (NEGATIVE_STOCK); rezervacija ne gre v stanje; izdaja gre.
- **Predlagano:** univerzalno jedro tipiziranih operacij nad tem tokom; `OPENING_BALANCE` enum + `openingBalanceId`;
  guard `stock≥reserved` v vsaki spremembi; umava lock (variant-row); UI; migracija ko baseline.
- **Odpτto:** rezervacijska ownership (G3/P2), idempotency polna, nosilec zaloge za product-z-variantami, migr.
  legacy rezervacij (ročno).
- **Bi zahtevalo Prisma migracijo:** dodatek enum `OPENING_BALANCE` (+ po možnosti `PRODUCTION`/`REPAIR`) in polje
  `openingBalanceId` na `StockMovement` — **PROPOSED**, ni izvedeno.
- **Pripravljenost:** Arhitektura je **priprava za ločeno odločanje o implementaciji**; P1-D NI implementiran in
  ni odobren. Implementacija zahteva ločeno izrecno odobritev (po fazah P1-D-1..4).

**Potrditev:** 1. spremenjen samo ta dokument: DA (ustvarjen). 2. Koda NI spremenjena: DA. 3. `schema.prisma`
nedotaknjen: DA. 4. Ni migracij: DA. 5. Baza/testni podatki nedotaknjeni: DA. 6. Nobena skripta ni izvedena nad
bazo: DA. 7. Git operacije niso izvedene: DA. 8. `einvoices.ts` in tuj WIP nedotaknjeni: DA. 9. `markec_dev`/prod
nedotaknjena: DA. 10. Faza 2D-1A ostaja neodobrena: DA.

**Čakam izrecno odobritev za implementacijo P1-D (po fazah); ne začnem P2/G3/G7.**

---

# P1-D-ARCHITECTURE-REVIEW — KONČNA TEHNIČNA USKLADITEV

> READ-ONLY pregled in uskladitev P1-D. **Nič kode/sheme/migracij ni spremenjeno.** Statusi: EXISTING-VERIFIED /
> EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED. Trenutna koda izvaja; predlogi ločeni.

---

## 1. Izdelek in variante — enoten vir zaloge

### 1.1 Dejansko stanje (EXISTING-VERIFIED)
- `Product.stockQuantity` (:1189) in `ProductVariant.stockQuantity` (:1580) sta **neodvisni stolpci stanja**, ne
  izračunana vsota. `createStockMovement` (:165–175) posodobi SAMO enega (variant ALI product), ne obeh.
- V `src/**` **ni agregacije** `Σ variant → product` (iskanje `_sum`/`groupBy` variant stock prazno). Prikaz v
  kartici variant (:200) prikazuje vsako varianto posebej, ne skupne vsote.
- torej: ali se `Product.stockQuantity` pri izdelku z variantami šteje kot vsota? **NE avtomatsko** → GAP.

### 1.2 Odgovori
1. **`Product.stockQuantity` pri izdelku z variantami = izračunana vsota?** NE (trenutno neodvisen stolpec; ni
   samodejne vsote) — **GAP/NOT VERIFIED** do implementacije.
2. **Sme se spreminjati neposredno?** Pri izdelku z variantami NE — samo skozi kontrolirano operacijo; in ne sme
   dvojno šteti (zahteva pravilo) — **PROPOSED**.
3. **Izdelek z variantami, brez zaloge:** Product.stockQuantity=0 in vsaka varianta=0; A=0 — **PASS (deluje)**.
4. **Prehod izdelek-brez → izdelek-z-variantami:** treba določiti prenos stanja; brez samodejnega → **GAP**.
5. **Odstranitev variante z zalogo/rezerw:** F5.5.1-deactivation pri že kupljenih (EXIST-VER), stalna vrstica obdrži
   stanje; če fizično izbrišeš z zalogo → podatkovna izguba → **blokada/PROPOSED**.
6. **Preprečiti dvojno štetje:** klar pravilo product-ali-variant (ne oboje) → **PROPOSED**.
7. **Avtoritativni nosilec:** če ima variante → ProductVariant (variant-level); če ne → Product. → **PROPOSED**.

### 1.3 Končno pravilo (PROPOSED)
- Izdelek **brez variant**: nosilec = Product.
- Izdelek **z variantami**: nosilec = posamezna ProductVariant; `Product.stockQuantity` za prikaz skupaj = Σ
  (računalno na request ali prikazano kot sin), **vendar pri izdelku z variantami Product.stockQuantity ne toči
  dejanskih zalogovnih operacij** (ali variant vodijo; ali za prikaz pool; eno ali drugo — NOT VERIFIED/odločitev).
- dodajanje variante: izdelek preidene na variant-led (ni samodejnega prenos; uporabnik izbere).
- odstranjevanje variante: če ima zalogo/rezerw → deaktivacija (F5.5.1), ne fizična izbris; ali preverjanje.
- sprememba strukture: predhodna uskladitev.

---

## 2. Rezervacije — pravilna bilanca (EXISTING-VERIFIED)

**A = S − RES.** Potrjena matematika v kodi:
| Operacija | S | RES | A | Dokaz |
|---|---|---|---|---|
| reserveStock (:166) | nesprem. | +qty | −qty | `UPDATE ... AVAIL` |
| releaseStockReservation (:187) | nesprem. | −qty | +qty | `WHERE reservedQuantity>=qty` |
| convertReservationToSale (:208) | −qty | −qty | nesprem. | S−, RES− atomočno + OUT ORDER |
| applyOrderStockDecrement (:91) | −qty | nesprem. | −qty | direktna izdaja + OUT ORDER |

**Primeri (preračunano, skladno z navodilom):**
- **A**: S20/RES5/A15, nova rez→3 → S20/RES8/A12 ✓ (PASS).
- **B**: S20/RES8/A12, izdaja 3 rez → S17/RES5/A12 ✓ (PASS; convert :218-220).
- **C**: S20/RES8/A12, zmanjš 5 ne-rez (applyOrderStockDecrement) → S15/RES8/A7 ✓ (PASS).
- **D**: S20/res8/A12, poskus zmanjš 13 → več kot A? A=12, zmanjš 13 → stock bi −5, nedovoljeno; `applyOrderStockDecrement`
  `stockQuantity>=qty` (:99) ni izpolnjen (20≥13 da? 20−13=7≥0, res=8>7=S−RES) → zavržen. Tako da poskus 13 (ne nad
  A=12, ampak 13 > A 12?) — 13 dejansko je iz A=12 → **zavrnjeno** (S−RES zahteva, ali stock-qty pade pod RES).
  Odgovor: operacija zavrnjena, stanje nespremenjeno ✓ (**PASS**: NEGATIVE/`gte` guard).
- **E — sprostitev napačne rezervacije (naročilo A vs B):** `releaseStockReservation` (:187) deluje na **samo
  agregatni vrstici** (Product/Variant + količina), **Brez povezave na naročilo** → **ne more ločiti** rez. naročila
  A od B. **GAP.** Rešitev: `StockReservationEvent` (RESERVE↔ISSUE↔RELEASE z `orderId/orderItemId/reservationEventId`)
  — **PROPOSED (P2/G3)**, ovira prihodnje implementacije.

---

## 3. Sočasnost — zaklepanje in transakcije (PROPOSED, delno EXISTENT)

- **A (product brez variant):** `applyOrderStockDecrement` uporabi pogojni `updateMany stockQuantity>=qty` — atomski
  CAS guard (EXIST-VER). `createStockMovement` uporablja `$transaction` + `computeStockDelta` na prebranem stanju
  (NEGATIVE＿STOCK) — **ni ekspliciten SELECT FOR UPDATE** → potencialno lost-update v dveh sočasnih
  `createStockMovement` (Oba prebereS=20, oba zapiše) → **PARTIAL**. PROPOSED: `SELECT FOR UPDATE` na variatneuj/vrstico.
- **B (varianta M):** zakleniti `ProductVariant` vrstico (ne samo Product); lock ob začetku operacije, preverba A,
  dodaj stanju, zapis StockMovement v isti txn.
- **C (različni varianti istega izdelka):** zaklepanje **pere-variant** (vsaka svoja vrstica) → vzporedno SIGURNO,
  ni nepotrebnega locka celotnega izdelka → **PASS-proposed**.
- **D (rezervacija+izdaja istége časa):** rezervacija z AVAIL (S−RES>=qty atomočno), izdaja-rezerv z
  `reservedQuantity>=qty` → oba ne moreta porabiti iste A (CAS) → **varno**; a zahteva soglasno stanje v txn.
- **E pravila:** vrstni red (agregat→dogodek→orderItem), txn-meja, deadlock manj verjetno z iz enemu zaklepanjem,
  **P2034 → idempotentni retry** (brez duplikata), zavrni ko guard ne dosežen.

---

## 4. Idempotentnost in dvojno knjiženje (PROPOSED, delno EXISTENT)

Trenutno: del x-pot uporablja status-CAS in preverja (EXIST-PARTIAL); **ni** univerzalnega `idempotencyKey` na
`StockMovement` ali operacijah. Predlog:
1. vsak poslovni zahtevek ima svoj `idempotencyKey` (org-unique);
2. preveri obstoječ ključ → vrni obstoječi rezultat;
3. isti ključ + različen payload → `IDEMPOTENCY_CONFLICT`;
4. ponovljen zahtevek ne sme ustvariti novega `StockMovement` (razrešeno prek unique key + vez);
5. fiz. premik ↔ rezervacijski dogodek povezan skozi `reservationEventId` (G3);
6. ISSUE ne ustvari 2 OUT → `@@unique(org, reservationEventId)` na StockMovement (PROPOSED).
Vzgojno: ponovitev iste op. → idempotentna; nova legitimna op. → nov key; popravek → **nov korekcijski dogodek**,
ne brisanje. Koda napake: `IDEMPOTENCY_CONFLICT` (PROPOSED).

---

## 5. Začetno knjiženje (PROPOSED)

- Identifikacija: `source=OPENING_BALANCE` (nova enum — PROPOSED) + `openingBalanceId` na StockMovement.
- Preprečiti dvojno: `@@unique(org, productId|variantId|openingBalanceId)` ali aplikativna »≤1 opening per
  product/variant« + retry P2034.
- Začetna vrednost 0: **Dovoljeno** (ne-opening; a brez kreativnega stanja). Bolje: če ni vnosa, ne uness opening.
- Popravljanje začetnega: ni tiho prepis — nov `CORRECTION`/korekcijski premik, zgodovina ostane.
- **Ali je `openingBalanceId` potreben?</b> Priporočeno kot migracijski marker razloči »opening-balance« od
  drugega `IN`; možno tudi z datumskim/dokumentnim markerjem, a `openingBalanceId` je najčistejši → **PROPOSED**.
- NIkoli ne izmisli izvora/harvest povezave (baseline, ne provenance).

---

## 6. Inventura in korekcije (PROPOSED, delno EXISTENT)

- `submitStockTake` (:513) zapiše DELTA v `StockMovement` STOCKTAKE (EXIST-VER) — **vendar** pri sočasni prodaji
  obstaja tveganje zastarelega stanja (PRODUCTION/orderisc/migr) → **varna inventura zahteva**: prebrati stanje +
  izračunati razliko v eni txn z `SELECT FOR UPDATE`; če vmes pride do prodaje/prejema → rečun na novem stanju ali
  zavrni (CONFLICT).
- Razlikovati: prejem (IN DELIVERY), ročno poveč (IN), ročno zmanjš (OUT), inventura (DELTA), korekcija (nov
  sledljiv dogodek, ne brisanje). **Propu: red popravljanja prek novih dogodkov, nikoli brisanje zgodovine.**
- Če med inventuro prodaja/prejem → konsistenten snapshot ali zavrnitev (proposed txn+lock).

---

## 7. Univerzalnost MARKEC (PROPOSED)

- Common core: `Product`/`ProductVariant` + `StockMovement` + kontrolirane operacije + `unit` → za čebelarja
  (med/koz), frizerjo (šamponi), mehanika (del), šiviljo (blago), trgovino (product/variant). Eno zalogovno jedro.
- Posebna dejavnost DODA svoje evidence (npr. čebelarsk harvest/batch via `supplierRecordId`/`batchRecordId`/Extension),
  NE ustvari vplatform a sistema. Čebelarska sledljivost = ločena razširitev G7.

---

## 8. Testna strategija (PROPOSED)

Pripraviti unit/integration/E2E (navedeno v P1-D §13 in z dodanimi scenariji iz tega REVIEW): product brez/vs.
variant, skupni prikaz (Σ), dvojno opening, ponovna idem, isti key drug payload, rez, sprost., izdaja rez, zmanjš
ne-rez, zavrnitev posega v rez, dva prejema, prejem+izdaja, rez+izdaja, inventura+prodaja, napačna org/variant,
rollback. **Vsak test s pričakovanim stanjem in pričakovanim številom novih StockMovement** (npr. ena operacija = 1
`StockMovement`, ponovljena = 0 dodatnih, inventura = 1 DELTA idr.). Ne izvajaj testov nad nepreverjeno bazo.

---

## 9. Končna ocena

1. Arhitektura zaloge tehnično konsistentna? **PARTIAL** (ledger+tok PASS; sočasnost/lock/idem/ownership GAP/Proposed).
2. Izdelki in variante pravilno razrešeni? **PARTIAL** (ni enotnega product-vs-sum pravila; GAP).
3. Rezervacijska bilanca (A=S−RES)? **PASS** (EXIST, preverjeno; primeri A–D pravilni).
4. Sočasnost varno rešena? **PARTIAL** (CAS na izdajo; createStockMovement nima FOR UPDATE; PROPOSED).
5. Idempotentnost dovolj natančna? **PARTIAL** (status-CAS; univerzalni key PROPOSED).
6. Začetno knjiženje varno? **PROPOSED** (tid etim: OPENING_BALANCE + anti-dup; ni v kodi).
7. Inventura varna? **PARTIAL** (submitStockTake obstaja; sočasna varnost PROPOSED).
8. Univerzalnost MARKEC? **PASS (načrt)** — eno jedro, dejavniške razširitve ločeno.
9. **Spremembe, ki zahtevajo Prisma migracijo:** (a) enuma `StockMovementSource` + `OPENING_BALANCE` (možno
   `PRODUCTION`/`REPAIR`); (b) `openingBalanceId` na StockMovement; (c) (G3) `reservationEventId` + `@@unique`
   na StockMovement + `StockReservationEvent` model; vse **PROPOSED**.
10. **Implementacijske faze (vrstni red):**
    - P1-D-1: formalizacija kontroliranega toka + `stock≥reserved` guard + `SELECT FOR UPDATE` + idempotency
      (brez sheme);
    - P1-D-2: `OPENING_BALANCE` enum + `openingBalanceId` (migr. PROPOSED);
    - P1-D-3: UI (pregled/hist/korekcija);
    - P1-D-4: `StockReservationEvent` + ISSUE↔StockMovement vez (G3/P2);
    - G7: serijska sledljivost (ločena, po P1).

**Splošna ocena: PARTIAL** (temelji PASS/EXIST, vendar za ∥: product-vs-hd verske pravilo, sočasnost (FOR UPDATE),
idempotentnost, začetno knjiženje, ownership rezervacij — vse PROPOSED/GAP, ne v kodi). **Niti PASS niti FAIL —
konzisten načrt, ki NI implementiran. Implementacija NI odobrena.**

---

## 10. Končna zaustavitev / potrditev
- Spremenjen je bil samo arhitekturni dokument (dodano to poglavje): DA.
- Aplikacijska koda NI spremenjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze in testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuji WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Končna arhitektura je podlaga za tvojo odločitev. Nobena implementacija ni dovoljena brez nove izrecne
odobritve P1-D (po fazah). Ustavljam se; ne začnem P1-D-1..4, P2, G3 ali G7.**

---

# P1-D-ARCHITECTURE-REVIEW 2 — KONČNI MODEL PRODUCT / PRODUCTVARIANT

> READ-ONLY: dokončna določitev enotnega modela fizične zaloge (variant-led ali ne) z dejansko kodo.
> **Nič kode/sheme/migracij ni spremenjeno.** Statusi nižje.

---

## 1. Dejansko stanje (EXISTING-VERIFIED)

- **`Product.stockQuantity` (:1189), `reservedQuantity` (:1195)** — neodvisna stolpca stanja.
- **`ProductVariant.stockQuantity` (:1580), `reservedQuantity` (:1582)** — neodvisni stolpci.
- **`StockMovement` (:2130)** — append-only ledger (direction/source/orderId/supplierRecordId/batchRecordId).
- **`AVAIL` makro (product-checkout:146)** = `"stockQuantity" - "reservedQuantity" >= qty`, tabela se izbere per
  liniji: variant če `variantId`, drugače product (:171–176). → checkout/rezervacijske poti že **per-level**.
- **`createStockMovement` (inventory:165–175)** — posodobi produkt ali varianto **ne obe** (ni samodejnega sin).
- **`OrderItem` (:1303–1324)**: `productId` (Restrict), `variantId?` (SetNull) + snapshots `variantName/variantSku/
  variantPrice` → zgodovina se obdrži tudi če varianta izbrisana (a izgubi `variantId` vez ob fizičnem izbrisu).
- **Ni agregacije** `Σ variant → product` nikjer v `src/**` (iskanje prazno).

---

## 2. Preslikava poslovnih operacij na nivo zaloge (dejanske vrstice)

| Operacija | Brez variant | Z variantami | Dejanska funkcija / lokacija | Status |
|---|---|---|---|---|
| Začetna zaloga | Product | ProductVariant (mora) | `createStockMovement` (inventory:81,165) | PASS (level izbran) / PROPOSED-pravilo |
| Prejem | Product | ProductVariant | `recordDelivery` (inventory:371→createStockMovement IN) | PASS |
| Ročno poveč | Product | ProductVariant | `createStockMovement` IN (inventory) | PASS |
| Ročno zmanjš | Product | ProductVariant | `createStockMovement` OUT (inventory; NEGATIVE guard) | PASS |
| Rezervacija | Product | ProductVariant | `reserveStock` (checkout:166, AVAIL) | PASS |
| Sprostitev | Product | ProductVariant | `releaseStockReservation` (checkout:187) | PASS / GAP-ownership |
| Prodaja | Product | ProductVariant | `convertReservationToSale` (checkout:208) + OUT ORDER | PASS |
| Izdaja | Product | ProductVariant | `applyOrderStockDecrement` (checkout:91) + OUT ORDER | PASS |
| Vračilo | (Product) | (ProductVariant) | Stock `IN RETURN` (source RETURN) | PASS (shema podpira) |
| Inventura | Product | ProductVariant | `submitStockTake` (inventory:513, DELTA) | PASS |
| Prikaz | Product.stock | **SUM variant** | **NI implementiran** — kartica prikazuje per-variant only | **GAP** |

**Vsi fiz. zal. operration že delujejo na izbranem nivoju** (variant če obstaja, drugače product) prek `createStockMovement`
in checkout (row-resolucija). **Edini GAP je prikaz skupne vsote variant v UI** (§8) in **pravilo za transitions**.

---

## 3. Prehodi med modeli (analiza)

**Primer A — izdelek dobi prvo varianto pri stock 100/res 10:**
- `createProductVariant` (po P1-B) ne dotakne `Product.stockQuantity` → Product ostane 100, varianta nastane 0.
- Pod variant-led modelom: 100 bi bilo »nedokumentirano« pri izdelku z variantami → **GAP**. **Zahteva ekspliciten
  prehodni postopek** (prenos 100 na varianto prek kontroliranega premika / `OPENING_BALANCE` na varianto), nikoli
  tiha izguba/podvojitev. Zgodovina StockMovement se ohrani (že knjiženo).

**Primer B — odstranitev variante M (S10/M20/L15):**
- Če M nima rezervacij/naročil → fizični izbris mogoč (F5.5.1), a StockMovement haba `productVariantId` → po izbrisu
  vez nastavi SetNull? StockMovement.productVariantId ima onDelete:Cascade — izguba premikov te variante! → **GAP/
  tveganje**. **Priporočeno (kot moje pričakovanje): uporabljena/zalogovana varianta se NE briše, temveč deaktivira**
  (F5.5.1 `isActive=false` — že implementirano za kupljene :196–211) → ohrani StockMovement in OrderItem vez.

**Primer C — izdelek z variantami → brez variant:**
- Prenos Σ variant na Product:treba kontrolirano (skupni saldo v eno vrstico); obstoječa naročila (OrderItem.variantId)
  ostanejo nespremenjena; StockMovement zgodovina ostane (variant level); novi vnosi na product-level. Zahteva
  prehodni postopek in **ne izgubi sledljivosti** (OrderItem snapshots + StockMovement ostanejo).

**Primer D — nova varianta:**
- Po P1-B se varianta ustvari s **0** (`@default(0)`); začetni saldo/prejem prek kontrolirane zalogovne operacije
  (P1-D-2 `OPENING_BALANCE`). → **PASS/ProposBro** (ne začne s poljubno zalogo).

---

## 4. Prodaja in stare povezave

- `OrderItem` z `productId` + `variantId?` + snapshots → zgodovina naročil ostane ob prehodu modela nespremenjena
  (stares naročila se ne dotaknejo). **PASS** (EXIST).
- Star izdelek-s-variantami, kjer je Product.stockQuantity ≠ 0 (C-skupina) → **treba uskladiti** (ne tiho).
- Star izdelek-brez-variant → ostane product-led, ni spremembe.
- Ne predpostavljaj čistih podatkov: ne-Konsistentne (E-skupina) → ročni pregled.

---

## 5. Tabela varnostnih robnih primerov (rezervacije), potrditev z zgledom
- Varianta M: S20, RES5, A15; izdaja 3 rez → `convertReservationToSale` (:218–220) S17/RES2/A15 → **PASS** (skladno
  s prezeto bilancjo A=S−RES).
- Vsiljena robnik (D nevilo): zmanjšanje ne-rez iz 20/8/12 za 13 → `applyOrderStockDecrement` `stockQuantity>=13`
  (20→7) in `reserved>=?`… 7 < RES8 → guard, zahteva S−RES≥12 (A=12) → 13>12 → zavrnjeno. **PASS**.
- **Ownership (E): GAP** — `releaseStockReservation` na samo agregatni vrstici (no orderId) → ne loči rez. naročila
  A od B. **`StockReservationEvent` ostaja ločena PROPOSED faza (P2/G3)**; ne prikrivam.

---

## 6. Skupni prikaz zaloge (PROPOSED)

Enoten izračun (npr. helper `getStockSummary`/read): če `hasVariants` → `SUM(ProductVariant.stockQuantity)` in
`SUM(reserved)` za prikaz; drugače `Product.stockQuantity/reserved`. Vpliv: dashboard/seznam/podrobnosti/trgovina/
cart/checkout/poročila/inventura → kamorkoli se prikazuje skupaj. **Ključno: skupna vsota se NE prikazuje kot
dodatna zaloga poleg variant** (samo agregat, ne nov stolpec fiz. zaloge). Trenutno **ni implementiran** → **GAP**
(P1-D-3 UI).

---

## 7. Migracijska strategija (PROPOSED, brez izvedbe)

- A (izdelki brez variant): ohrani Product-led. Ni spremembe.
- B (izdelki z variantami, pravilna variantna zaloga): ohrani; prikaz = sin.
- C (z dodatno Product zalogo): **uskladiti** — Product.stockQuantity >0 pri izdelku z variantami: prenesti ali
  odpraviti (ročno, ne tiho); preprečiti dvojno štetje.
- D (rezervacije): ohrani kot je; P2 dodaja ownership.
- E (neujemajoča se): **ročni pregled**, ne avtomatsko.
- F (zgod. naročila/premiki): ohrani (OrderItem snapshots + StockMovement); ne spreminjaj starih.
- Ne izmišljaj podatkov/zgodovine. Migr. ni izvedena.

---

## 8. Testna strategija (PROPOSED)

Testi 1–22 (iz navodila): product brez/vs. variante, Σ prikaz, Σ rezerv, začetna/prejem/prodaja variante,
rez/sprost/izdaja rez/vračilo/inventura variante, dodajanje prve variante ob stock, odstranitev var s stock/rez,
deaktivacija uporabljene, prehod var↔nevar, stara naročila, sočasne (razl/sam), napačna org, dvojno knjiženje.
Vsak s pričakovanim stanjem Product/Variant/StockMovement (npr. izdaja 3 rez variant M → S17/RES2, +1 StockMovement
OUT ORDER; ponovljena op → +0). Ne izvajaj nad nepreverjeno bazo.

---

## 9. Sklepno priporočilo

**Ali naj MARKEC sprejme variant-led model kot univerzalno pravilo?**

**DA — sprejeti variant-led kot univerzalno pravilo, PRI tem:**
- **pravilo:** če izdelek ima »aktivne« variante → nosilec zaloge/rezervacij = **ProductVariant**; `Product.stockQuantity`
  pri izdelku z variantami se uporablja **samo za prikaz vsote** (Σ), ne kot dodatna fiz. zaloga in ne kot vir
  operacij. Izdelek brez variant → Product-led.
- **utemelitev (dejanska koda):** checkout/rezerw vse poti že resulvirajo **per-line level** (AVAIL + tabela po
  variantId, checkout:146/:171–176); `createStockMovement` že deluje na izbranem nivoju (inventory:165–175);
  `OrderItem` ohranja zgodovino (variantId+snapshots). Torej variant-led je **združljiv z obstoječo kodo** in
  odpravlja dvojno štetje.
- **posledice / predpogoji (PROPOSED/GAP):** (1) UI prikaz Σ variant (ni — GAP); (2) **prehodni postopki** za
  obstoječe izdelke s Product.zaloga =100 (+rez 10) ko dobe varianto — ekspliciten prenos, ne tiha izguba;
  (3) deaktivacija namesto brisanja uporabljenih variant (že za kupljene F5.5.1, razširiti za zalogo);
  (4) `StockReservationEvent` (ownership rezervacij, P2/G3) — ločeno, ne prikrivati.

**Zaključna ocena: PARTIAL → A-priprava.** Model je tehnično skladen z obstoječo kodo (per-level operacije PASS);
implementacija zahteva dodatne PROPOSED/GAP zaključke (UI Σ, prehodne migr., deakt. politika, ownership). TO NI
dovoljenje za implementacijo.

---

## 10. Končna zaustavitev / potrditev
- Spremenjen samo arhitekturni dokument: DA (dodano to poglavje).
- Aplikacijska koda NI spremenjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze in testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuji WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Noben predlog ni dovoljenje za implementacijo. Ustavljam se; P1-D-1..4, P2, G3/G7 niso izvedeni. Čakam novo
izrecno odobritev.**

---

# P1-D FINAL — UNIVERZALNA PRAVILA ZALOGE, PREHODI IN AGREGACIJA

> Zadnja arhitekturna uskladitev variant-led modela. READ-ONLY; **nič kode/sheme/migracij ni spremenjeno.**
> Statusi: EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED.

---

## 1. Potrjeni univerzalni variant-led model (PROPOSED — konsistentno z kodo)

- **Izdelek brez variant:** avtoritativna zaloga = `Product.stockQuantity`/`reservedQuantity`; `A = S − RES`.
- **Izdelek z variantami:** avtoritativna = `ProductVariant.stockQuantity`/`reservedQuantity` na **vsako varianto**;
  `ProductTotalStock = SUM(variant.stockQuantity)`; `ProductTotalReserved = SUM(variant.reservedQuantity)`;
  `ProductAvailable = ProductTotalStock − ProductTotalReserved`.
- **Strogo pravilo:** pri izdelku z variantami se zaloga/rezervacije/prodaja/izdaja/inventura vodijo **na varianti**;
  `Product.stockQuantity` se NE prišteva; skupna = izračunana vsota variant.
- **Združljivost z dejansko kodo (EXISTING-VERIFIED):** checkout `AVAIL` (product-checkout:146) + per-line tabela
  (`variantId ? ProductVariant : Product`, :171–176); `createStockMovement` posodobi izbrani nivo (inventory:165–175);
  `OrderItem` ohrani `variantId?`+snapshots (:1315–1318). **Ni poslovne izjeme** → enotno pravilo brez dodatnih
  izjem. — **PARTIAL** (pravilo ni implementirano; združljivo s kodo).

---

## 2. Prehod brez variant → z variantami (PROPOSED/GAP)

Predprehod: Product 100 / RES 10 / A 90.

**Varen postopek (zahteva):**
1. Preveri trenutno stanje/rezervacije izdelka.
2. Preveri aktivna naročila/rezervacije (OrderItem z tem productId, `reservedQuantity>0`).
3. Preveri obstoječe `StockMovement` (product-level).
4. **Eksplicitna odločitev uporabnika o prenosu zaloge.**
5. Transakcijski prenos (v eni txn, z lock).
6. Zaloga nikoli hkrati na Product in ProductVariant (prepreči dvojno štetje).
7. Rezervacije se ne izgubijo/nepravilno preselijo.
8. `StockMovement` zgodovina ostane (dodati prenosni zapis, ne brisati).
9. Če ni mogoče varno prenesti → **blokada** + ročna uskladitev.

**Primer A (ena nova varianta):** samodejni prenos celotne zaloge+rezervacij na edino varianto je **dovoljen pod
pogoji** (Ena varianta, ni aktivnih ne-rešenih naročil/rezervacij, znotraj txn, s prenosnim `StockMovement` +
`reason`). — **PROPOSED** (priporočeno, ko ni podatkov za večkratno vrednost).

**Primer B (več variant):** sistem **NE sme sam ugibati** razdelitev 100 med S/M/L. **Uporabnik eksplicitno
razporedi** (100, rezervacije, razlike). Če obstajajo aktivna ne-rešena naročila/rezervacije za izdelek → **blokiraj
prehod** do njihove rešitve. — **PROPOSED/GAP** (ni v kodi).

---

## 3. Prehod z variantami → brez variant (PROPOSED/GAP)

S10/M20/L15 (45):
1. Seštej Σ variant fiz. zalogo → želeno Product.
2. Seštej Σ rezervacij.
3. Ohrani `StockMovement` zgodovino (variant-level zapisi OSTANEJO; prenosni zapis dodan).
4. Aktivna naročila: če varianta še ni izdana in ima aktivno rezervacijo/ORDER → povezava; prehod **blokirati**
   dokler ni izdano/razrešeno, ali prenesti s prenosnim zapisom.
5. Variante z zgodovino prodaje za ne sme izginiti iz sledljivosti (OrderItem snapshots+naročila ohranimo).
6. Po prehodu **ni dvojnega štetja** (Product.stock prevzame, variant stolpci se "resetirajo" s prenosnim zapisom).
→ **PROPOSED/GAP** (ni v kodi; zahteva txn prehodni postopek). Ne tiha združitev, ki bi izbrisala izvor prodanih.

---

## 4. Deaktivacija in arhiviranje variant (EXISTING-VERIFIED + PROPOSED)

**F5.5.1 dejanska:** `deleteProductVariant` (catalog:186/196–211) — če je varianta že v OrderItem, se **deaktivira**
(`isActive=false`); sicer fizično izbriše (catalog:213).

| Kategorija | Priporočilo | Dejansko | Status |
|---|---|---|---|
| A (brez zaloge/hist.) | deaktiv. ali izbris (izbris v redu) | fizični izbris | OK/PASS |
| B (z zalogo) | **blokiraj izbris**; razreši zalogo pred deakt. | ni blokade za zalogo; le za OrderItem | **GAP** |
| C (zgodovina/OrderItem/StockMovement) | **deaktivacija**; ohrani zgodovino; ne ponujati | deakt. za OrderItem (F5.5.1) | PASS za OrderItem / **GAP** za StockMovement |

- **`StockMovement.productVariantId` ima `onDelete: Cascade` (prisma:2153)** → fizični izbris variante **casCade-odstrani
  njene premike**. Pri uporabljeni/histoMik varianti je to **nevarno**.
- **Predlog (PROPOSED):** spremeni relacijo na `onDelete: SetNull` (da izgleda kot OrderItem) ALI uporabi vedno
  **deaktivacijo** namesto izbrisa za variante z zgodovino/zalogo — **odločitev, PROPOSED; sheme ne spreminjam.**

---

## 5. Agregacija skupne zaloge (PROPOSED — enoten izračun)

- **Priporočena rešitev:** namenski **strežniški servis/helper** (npr. `lib/inventory/aggregate.ts`, ena mestna
  `getStockView`) ki za dani product: če `hasVariants` → `SUM(variant.stock)`, `SUM(variant.reserved)`,
  `A = ΣS − ΣRES`; sicer product fields. Vsi UI (dashboard/seznam/podrobnosti/trgovina/cart/checkout/poročila/
  inventura/mobilni) in API/strežniški odgovori kličejo **isti** servis.
- **NE uvajati trajno shranjenega števca** (drug stolpec), ki bi podvajal vsoto variant — razen če bi
  potreboval zanesljivo sinhrono vzdrževanje (sproste odločitev; privzeto računsko Σ).
- **Ključno:** pri izdelku z variantami se skupna zaloga prikaže samo kot vsota variant, **ne kot dodatna
  fizična** za zalogo. — **PROPOSED/GAP** (trenutna UI prikazuje per-variant, brez Σ).

---

## 6. Sočasnost in transakcijska varnost (PARTIAL / PROPOSED)

- **`SELECT FOR UPDATE` v kodi obstaja, VENDAR NI na stock vrsticah:** `colony-moves.ts` (ExtensionRecord),
  `documents.ts`, `numbering.ts` (DocumentSequence). — **NOT na Product/ProductVariant** v nobeni zalogovni akciji.
- `createStockMovement` = `$transaction` + `computeStockDelta` na prebranem stanju (**brez FOR UPDATE**) → potrebno
  `SELECT FOR UPDATE` na agregat (variant/product) → **PROPOSED** (izogniti se lost-update).
- checkout = atomični pogojni `UPDATE ... WHERE` (CAS status, AVAIL) → **delno varno** (per-linija).
- **Prehod (dod. prve variante / deaktivacija / prehod modelov):** zakleniti product+relevant variant vrstice v
  **enotnem vrstnem redu** (npr. product → pa variant, po id), preveriti A/rezerve, izvesti prenos z zapisom.
  Ob konfliktu (P2034) → idempotentni retry; kadar ni mogoče → zavrniti **os** **blokada prehoda.** — PROPOSED.

---

## 7. Rezervacije in zgodovina (GAP, ločeno vprašanje)

`releaseStockReservation` (checkout:187) deluje na agregatni vrstici, **brez povezave na naročilo** → lahko
agregatno sproščanje zadane napačno naročilo. **Ločeno od agregacije**:
- povezava rez→order/orderItem; povezava rez→product/variant; izdaja↔rez; idempotentnost; sočasnost; popravki
  brez brisanja. Rešitev = **`StockReservationEvent`** (RESERVE↔ISSUE↔RELEASE z `orderId/orderItemId/
  reservationEventId`) — **PROPOSED (P2/G3)**, NI del te naloge. Načelno združljivo z variant-led modelom.

---

## 8. Migracijski / prehodni načrt (PROPOSED, brez izvedbe)

| Skupina | Samodejno | Ročna odločitev | Blokada | Zaloga | Reze | Zgodovina | Preverjanje |
|---|---|---|---|---|---|---|---|
| A (brez variant) | ohrani Product | — | — | Product | Same | ohrani | Σ vs count |
| B (variante, pravilna) | ohrani; prikaz=Σ | — | — | Vr. | Vr. | ohrani | Σ variant |
| C (product-z-variantma + Product.zaloga) | — | **uskladiti** (prenos/odprava) | da, dokler | enotna | enotna | dodati prenosni zapis | ne dvojno |
| D (aktivne rezerve) | — | P2 reši ownership | prehod-block do P2 | — | ohrani | — | — |
| E (neujemajoča) | — | **ročni pregled** | da | — | — | — | — |
| F (zgod. naročila/premiki) | ohrani (snapshots+StockMovement) | — | — | — | — | Ohrani | — |

Nič se ne sme tiho zavreči/deliti brez poslovne odločitve. Migracija **ni izvedena.**

---

## 9. Testna matrika (PROPOSED)

Testi 1–24 (iz navodila): product brez/vs/več variant; izračun Σ zaloge/rez/avail; prehodi (→1 var, →več, z akt
rezerv/naročil, var→nevar); deaktivacija (brez zgod., z zalogo, z zgod.); blokada izbrisa uporabljene (F5.5.1 +
razširitev); prodaja/rezerv med prehodom (blokada); sočasne spremembe; vračilo; inventura; org izolacija;
ohranitev zgodovine naročil/StockMovement; prepoved dvojnega štetja. Vsak s pričakovanimi stanji Product/Variant
in pričakovano številom `StockMovement` (npr. prehod ta → +1 prenosni IN/OUT; ponovljena → +0). Ne izvajaj nad
nepreverjeno bazo.

---

## 10. Končno poročilo (odgovori)

1. **Variant-led skladen z obstoječo arhitekturo? PARTIAL** — združljiv (per-level operacije/OrderItem snapshots
   PASS EXIST); pravilo samega ni implementirano in koda še omogoča product-stock pri variantah.
2. **Prehodi varno določeni? PARTIAL/PROPOSED** — postopki opredeljeni (ena varianta=A samodejno z pogoji; več=B
   blocirano/ročno; vz-var→nevar blokirano) — NI v kodi.
3. **Skupna agregacija enotna? PROPOSED** — priporočena isti strežniški servis; trenutna UI per-variant (GAP).
4. **Zgodovina zaščitena pred fizičnim brisanjem? PARTIAL** — OrderItem SetNull+snapshots PASS; **StockMovement
   `onDelete:Cascade` je ranljiv** → potrebna deaktiv. ali SetNull (PROPOSED).
5. **Transakcijska pravila? PARTIAL** — CAS na checkout; `FOR UPDATE` na stock NI (le colony/documents/numbering);
   PROPOSED: FOR UPDATE + lock-red + retry.
6. **Blokada pred implementacijo:** (a) odločitev o deaktivaciji vs SetNull za variantne premike; (b) prehodni
   postopki za obstoječe product→variant; (c) agrega servis; (d) ownership rezervacij (P2/G3). **Vse PROPOSED,
   zahteva ločeno odobritev.**
7. **Vrstni red implementacije:** P1-D-1 (kontr. tok + FOR UPDATE na stock + `stock≥reserved` + idem) → P1-D-2
   (`OPENING_BALANCE` enum + anti-dup) → P1-D-3 (agregacijski servis + UI) → prehodni program (se meja po org)
   → P1-D-4 (`StockReservationEvent`, G3) → G7.

**Končna ocena: PARTIAL → A-priprava.** Arsihitektura variant-led je **skladna z obstoječo kodo in predlogom
finalizirana**, vendar **NI implementirana**; obstajajo jasne blokade (deaktiv./SetNull, prehodi, agrega servis,
ownership). To **NI dovoljenje za implementacijo** — čaka na izrecno odobritev po fazah.

---

## 11. Končna zaustavitev / potrditev
- Spremenjen samo arhitekturni dokument: DA (dodano to poglavje).
- Aplikacijska koda NI spremenjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze in testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuji WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Noben rezultat tega pregleda ni dovoljenje za implementacijo. Ustavljam se; P1-D-1..4, P2, G3/G7 niso izvedeni.
Čakam izrecno odobritev za implementacijo po fazah.**