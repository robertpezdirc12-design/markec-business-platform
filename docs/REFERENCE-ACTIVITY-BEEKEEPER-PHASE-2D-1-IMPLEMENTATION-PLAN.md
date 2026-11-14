# MARKEC — FAZA 2D-1A: IZVEDBENI NAČRT ZA SLEDLJIVOST PRIDELKA, PROIZVODNJE IN PRODAJE

> **Vrsta: IZKLJUČNO READ-ONLY — izvedbeni načrt, NE implementacija.**
> Temelji na `docs/REFERENCE-ACTIVITY-BEEKEEPER-PHASE-2D-1-ARCHITECTURE.md` (vsa poglavja 2D-1A..2D-1J;
> **2D-1J je zadnja potrjena arhitekturna podlaga**).
> Ta načrt opisuje, KAJ in KAKO bi se implementiralo ob prihodnji odobritvi Faze 2D-1A. **Nič ni implementirano.**
> Oznake: **PASS** (dejansko preverjeno v working tree) / **PARTIAL** / **FAIL** / **NOT VERIFIED** (ni
> mogoče dokazati) — loči dejansko stanje od predvidenih sprememb.

---

## 1. Povzetek arhitekture (povzeto iz 2D-1A..2D-1J)

Sledljivost pridelek → serija → izdelek → izdaja → vračilo, s **količinsko bilanco**, ki jo je mogoče
rekonstruirati iz dogodkov. Jedro:

- **`StockMovement` = edini fizični ledger** (IN/OUT, source ORDER/PRODUCTION/RETURN/STOCKTAKE/`REPAIR`/`REPAIR_RETURN`).
- **`ProductionContribution`** — povezava vir (harvest/surovina) → serija, s količinami:
  `inputQuantity`, `netQuantity`, `lossQuantity`.
- **`OrderItemBatchAllocation`** — prodajna razdelitev (orderItem + serija + količina) — ena vrstica na
  (orderItem, serija); izdaje/vračila so ločeni dogodki.
- **`StockReservationEvent`** (RESERVE/ISSUE/RELEASE/EXPIRE) in **`StockAvailabilityEvent`**
  (WITHDRAW/REACTIVATE) — **nefizična** nefizična tokova (rezervacija + umik), ki ne pripadata `StockMovement`.
- **Kategorije kosa** (disjunktne): `S` prodajna, `D` poškodovana, `Rep` v popravilu, `W` odpisana;
  `P = S + D + Rep`; znotraj `S` sta podmnožici `RES` (rezervirana) in `B` (umaknjena).
- **Invariant:** `RES + B ≤ S`; `A = S − RES − B ≥ 0`.
- **Append-only:** vsaka sprememba je nov dogodek; zgodovina se nikoli ne prepiše ali briše; korekcije so
  novi/reverzni dogodki z `idempotencyKey`.

### Končne formule (iz 2D-1J, vključene v implementacijo)
```
P = S + D + Rep
S = ΣIN_prod + ΣRETURN(resellable) − ΣOUT_order − ΣOUT_reversal − ΣOUT_loss_sellable − ΣOUT_repair(iz S)
D = ΣIN_RETURN(resellable=false) + ΣIN_repair_return(poškodovan) + ΣDAMAGE_RESERVED − ΣOUT_waste_damaged − ΣOUT_repair(iz D)
Rep = ΣOUT_repair − ΣIN_repair_return
RES = ΣRESERVE − Σ(ISSUE+RELEASE+EXPIRE)     , z invariant RES + B ≤ S
B   = ΣWITHDRAW − ΣREACTIVATE                , z invariant RES + B ≤ S
A = S − RES − B
I = ΣOUT_order ; R = ΣRETURN ; Neto = I − R ; W = ΣOUT_waste_damaged + ΣOUT_loss_sellable
```

---

## 2. Trenutno stanje repozitorija (dejansko preverjeno)

### 2.1 Git status / diff — PASS (verificirano)
- `git status --short` prikazuje **137 spremenjenih/novih datotek** (`git diff --stat`: **11739 vložkov,
  6789 črt**). To so **tuje neoddane spremembe** iz več agentov in oddelkih (F5.x, F2.x, einvoicing, kategorije …).
- Del teh sprememb je v datotekah, ki jih 2D-1A **ne sme spreminjati** ali med katerimi mora uskladiti:
  - `prisma/schema.prisma` — vsebuje F5.1 (promocije), F5.2 (kategorije), F5.5.2 (galerije/FAQ),
    F5.5.4.6 (e-računi/EInvoiceSettings), F2.3.1 (Staff.userId multi-org) itn.
  - `src/app/actions/einvoices.ts` — **untracked (??)** nov tuji zapis; ne obstaja v HEAD (`git ls-files` prazno).
  - `prisma/seed.ts`, `src/lib/profiles/registry.ts`, `src/app/actions/records.ts`, `src/app/actions/product-checkout.ts`
    idr. — modificantizirani.

### 2.2 Prisma shema (working tree) — PASS (verificirano)
| Model | Vrsta | Linija | Ključno |
|---|---|---|---|
| `Product` | 1177 | `stockQuantity Int`, `reservedQuantity Int @default(0)` (+ F5.5.1.2), `forSale`, `unit`, `@@unique(org,sku)` |
| `ProductVariant` | 1572 | lastni `stockQuantity`/`reservedQuantity`, `productId` |
| `StockMovement` | 2130 | `direction IN/OUT`, `source` (Enum), `quantity Int>0`, `orderId`, `supplierRecordId`, `batchRecordId`, `createdById` |
| `StockMovementSource` | 2120 | `MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN` (NI PRODUCTION/REPAIR) |
| `OrderItem` | 1303 | `productId`, `variantId` (mehka), snapshot; **NI batch/serije** |
| `OrderStatus` | 1329 | `PENDING/PAID/COMPLETED/CANCELLED/REFUNDED` |
| `ExtensionRecord` | 1533 | univerzalni org-scoped zapis; entity `batch` (batch-production), `harvest` (bee-apiary) |

### 2.3 Funkcije (working tree) — PASS
| Funkcija | File:line | Vedenje (verificirano) |
|---|---|---|
| `reserveStock` | product-checkout.ts:166 | `reservedQuantity += q` ob `AVAIL`(:146 = `stockQuantity−reservedQuantity ≥ q`), brez StockMovement |
| `releaseStockReservation` | :187 | `reservedQuantity −= q` (če `≥q`) |
| `convertReservationToSale` | :208 | `stockQuantity−=q`, `reservedQuantity−=q` + OUT ORDER (:226–235) |
| `applyOrderStockDecrement` | :91 | `stockQuantity−=q` + OUT ORDER (fallback; :124) |
| `verifyProductOrder` | :1097 | PAY-guard :1216–1220; if/else convert→fallback :1257–1270 (ena izdaja) |
| `createStockMovement` | inventory.ts:81 | transakcija :163; NEGATIVE_STOCK preverb; `movementInputSchema` dovoli `source:"RETURN"` :33 |
| `recordDelivery` | :371 | IN DELIVERY |
| `submitStockTake` | :513 | razlika prešteto−sistem → IN/OUT (STOCKTAKE) |
| `computeStockDelta` | lib/inventory/stock.ts:25 | pure; zavrne NEGATIVE_STOCK |
| `computeAvailableStock` | :52 | `max(0, floor(stock)−floor(reserved))` — **brez B** |

### 2.4 Testi (working tree) — PASS (datoteke obstajajo)
- `tests/inventory/stock.test.ts` (computeStockDelta/computeAvailableStock).
- `tests/entry-checkout-65-69.test.ts`, `tests/integration/f54/f551-variant-checkout.itest.ts`.
- Paket skript: `test`=vitest, `test:e2e`=playwright, `build`=prisma generate && migrate-retry && next build.

### 2.5 Migracije
- Obstoječe mape: `00000000000000_baseline`, `20261111100528_f5545_advances`, `20261111142202_einvoice`,
  `20261112000000_f55452_advance_alloc_audit` (+ mnoge druge označene kot izbrisane/arhivirane v git).
- **Vsaka nova migracija 2D-1A mora biti NOVA mapa, ne sme posegati v tuje razdeljevalnike** (baseline,
  einvoice, advances, alloc_audit).

### 2.6 Zaščita tujih sprememb — PASS (pravila)
- **`prisma/schema.prisma`**: NE spreminjati tujih delov; novo dodajati le kot eksplicitne nove modele/Enum
  vrednosti, po predhodni uskladitvi lastnikov (glej §11 tveganja). **Ne preoblikovati obstoječih relacij.**
- **`src/app/actions/einvoices.ts`**: **nedotaknjen** (untracked tuj zapis). NE urejati.
- **`prisma/migrations/**`**: NE prepisovati obstoječih; nova migracija ločena.
- **`markec_dev` in produkcijska baza**: **nedotaknjeni** — migracija/dry-run se izvede na **testni bazi**.

---

## 3. Obseg faze 2D-1A (2D-1J + logična ločitev)

| # | Funkcionalnost | Obseg | Utemeljitev |
|---|---|---|---|
| 1 | Pridelek → ena/več serij (`ProductionContribution`) | **2D-1A** | jedro sledljivosti |
| 2 | Serija → vhodna količina pridelka | **2D-1A** | `inputQuantity` |
| 3 | Neto proizvodnja + izguba | **2D-1A** | `netQuantity`, `lossQuantity` |
| 4 | Pretvorba neto → kozarci | **2D-1A** | IN PRODUCTION / units |
| 5 | Serija → izdelek/različica | **2D-1A** | prek StockMovement.batchRecordId + productVariantId |
| 6 | Prodajni artikli → ena/več serij | **2D-1A** | `OrderItemBatchAllocation` |
| 7 | Sledljivost izdaje in vračila do serije | **2D-1A** | `allocationId`/`returnOfMovementId`/`batchRecordId` na StockMovement |
| 8 | Delne rezervacije in izdaje | **2D-1A** | `StockReservationEvent` |
| 9 | Delna vračila in poškodovani | **2D-1A** | RETURN + `resellable` + `returnDisposition` |
| 10 | Umik/ponovna aktivacija | **2D-1A** | `StockAvailabilityEvent` |
| 11 | Fizični odpis in izguba | **2D-1A** | OUT STOCKTAKE / `OUT_loss_sellable` |
| 12 | Poškodba še rezerviranega | **2D-1A** | `DAMAGE_RESERVED` |
| 13 | Rekonstrukcija bilance | **2D-1A** (pogledi/akcije) | sledenje nad dogodki |

**Izven 2D-1A (poznejše faze):** UI/dashboard napredni prikaz (2D-1B/C…), e-račun povezave sledljivosti,
polnjenje UI (če ni v 2D-1A akcijah), napredne korekcije/revizija UI. **Ne širimo obsega brez utemeljitve.**

> **Opredelitev:** "2D-1A" tukaj = **podatkovni sloj + akcije/varovalke + rekonstrukcija** (torej jedro iz
> celotnega načrta 2D-1A..2D-1J). Če uporabnik želi UI v isti fazi, ga je treba izrecno razširiti.

---

## 4. Končni predlog podatkovnega modela (2D-1J, kot nova shema)

> Vsi modeli org-scoped; vse relacije na `ExtensionRecord` (`batch`/`harvest`) z `Restrict`/`SetNull` —
> **nikoli Cascade** za zgodovino. `onDelete` na `organizationId` = `Cascade` (org-seja briše vse).

```prisma
// (vsi so NOVE entitete — dodati stran v schema.prisma, NE posegati v obstoječe)

enum OrderItemBatchAllocationStatus { PARTIALLY_ISSUED, ISSUED, CANCELLED } // NIKOLI RETURNED
model OrderItemBatchAllocation {
  id              String   @id @default(cuid())
  organizationId  String
  orderItemId     String
  batchRecordId   String                            // → ExtensionRecord (serija)
  quantity        Int                               // skupna naročena količina te serije (>0)
  status          OrderItemBatchAllocationStatus @default(PARTIALLY_ISSUED)
  organization    Organization @relation(..., onDelete: Cascade)
  orderItem       OrderItem     @relation(..., onDelete: Cascade)
  batchRecord     ExtensionRecord? @relation("OibaBatch", ..., onDelete: SetNull)
  @@unique([organizationId, orderItemId, batchRecordId])  // 1 razdelitev na (orderItem, serija)
  @@index([organizationId, batchRecordId])
  @@index([orderItemId])
  @@index([batchRecordId])
}

model ProductionContribution {
  id              String   @id @default(cuid())
  organizationId  String
  batchRecordId   String                            // → ExtensionRecord (serija)
  sourceRecordId  String                            // → ExtensionRecord (harvest / surovina)
  inputQuantity   Decimal  @db.Decimal(14,4)        // dejanska porabljena
  netQuantity     Decimal  @db.Decimal(14,4)        // neto v dobrih
  lossQuantity    Decimal  @db.Decimal(14,4) @default(0) // input − net
  unit            String                            // kg | g | kos | …
  honeyType       String?                           // preverba mešanic
  organization    Organization @relation(..., onDelete: Cascade)
  batchRecord     ExtensionRecord? @relation("PCBatch", ..., onDelete: Restrict)
  sourceRecord    ExtensionRecord? @relation("PCSource", ..., onDelete: Restrict)
  @@index([organizationId, batchRecordId])
  @@index([organizationId, sourceRecordId])
}

enum ResEventType { RESERVE, ISSUE, RELEASE, EXPIRE }
model StockReservationEvent {                        // nefizični tok
  id              String   @id @default(cuid())
  organizationId  String
  orderId         String
  allocationId    String?
  batchRecordId   String?
  type            ResEventType
  qty             Int                                // RESERVE:+n ; ISSUE/RELEASE/EXPIRE:−n (>0)
  idempotencyKey  String?
  createdAt       DateTime @default(now())
  organization    Organization @relation(..., onDelete: Cascade)
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, allocationId])
  @@index([organizationId, orderId])
  @@index([organizationId, batchRecordId])
}

enum AvailabilityEventType { WITHDRAW, REACTIVATE }
model StockAvailabilityEvent {                       // nefizični tok
  id              String   @id @default(cuid())
  organizationId  String
  batchRecordId   String?                            // ali productVariantId — vsaj ena
  productVariantId String?
  type            AvailabilityEventType
  qty             Int                                // WITHDRAW:+n ; REACTIVATE:−n (>0)
  reason          String?
  idempotencyKey  String?
  createdAt       DateTime @default(now())
  organization    Organization @relation(..., onDelete: Cascade)
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, batchRecordId])
  @@index([organizationId, productVariantId])
}
```

### Aditivi na obstoječi `StockMovement` (2130) — **kot NOVA polja, ne spreminjati obstoječih**
```prisma
enum StockMovementSource { MANUAL ORDER DELIVERY STOCKTAKE RETURN PRODUCTION REPAIR REPAIR_RETURN }
// (dodati PRODUCTION, REPAIR, REPAIR_RETURN kot nove vrednosti enum-a)

// Nova polja:
//   allocationId String?            → OrderItemBatchAllocation
//   returnOfMovementId String?      → prvotni OUT (idempotency vračila)
//   idempotencyKey String?          @@index / (org) 
//   resellable Boolean @default(true)          // velja le za RETURN
//   returnDisposition String?        // DAMAGED_AWAITING | WRITTEN_OFF | IN_REPAIR
//   @@index([allocationId]) @@index([returnOfMovementId]) @@index([idempotencyKey])
```

**Preverba relacijskih omejitev na organizacijo:** vsi novi modeli imajo `organizationId` in relacijo na
`ExtensionRecord`/`OrderItem` s preverjanjem org v delayh (kot danes npr. v `createStockMovement`). Relacija
`batchRecord→ExtensionRecord` mora omogočiti zgolj isto-org zapise (aplikativno preverjanje; Prisma sama ne zna
»org preko relacije referenčnega« brez dodatka). **Org izolacija se zagotovi v ACKEDNO akcijah (requirePermissionOrg),
ne samo v shemi.** — **PARTIAL** (celoten org-only prek relacij v Prisminu ni mogoč enostavno; odvisen od
aplikativne varovalke).

**Posebno — izogib nepotrebnim tabelam:** `OrderItemBatchAllocation`, `ProductionContribution`,
`StockReservationEvent`, `StockAvailabilityEvent` so edini novi modeli (poleg Enum/kolone na StockMovement).
Noben dodatni „correction" model ni potreben (korekcije so reverzni dogodki — 2D-1J).

---

## 5. Poslovne in matematične varovalke (2D-1J → implementacija)

### 5.1 Obvezna invariant `RES + B ≤ S`
- **RESERVE** (v transakciji, po lock): preveri `RES + qty + B ≤ S` → drugače `NEGATIVE_AVAILABLE` /
  `RESERVATION_OVERFLOW`; noben dogodek, `reservedQuantity` nespremenjen.
- **WITHDRAW**: preveri `RES + B + qty ≤ S` → drugače `WITHDRAW_OVERFLOW` ali omeji na `A`.
- **Avtoriteta:** `StockReservationEvent` + `StockAvailabilityEvent` (agregat); materializirana
  `reservedQuantity`/`blockedQuantity` na Product/Variant = zrcalo iz agregata, v isti transakciji.

`S` se izračuna iz `StockMovement` + contribution; v transakciji se šteje po seriji (`batchRecordId`) ali po
`productVariantId`. **Kanonični vir `S`:** agregat `IN_prod + RETURN(resellable) − OUT_order − OUT_reversal −
OUT_loss_sellable − OUT_repair(iz S)` per enota (variant ali batch).

### 5.2 Ostale obvezne zapreke (prenesene iz 2D-1J §8)
1. negativna fizična zaloga → `computeStockDelta` (`NEGATIVE_STOCK`) ali pogoj `stock ≥ qty` (obstoječi vzorec);
2. negativna prodajna zaloga → `A = S − RES − B ≥ 0` → `NEGATIVE_AVAILABLE`;
3. negativna rezervacija → `RES = ΣRESERVE − Σ(ISSUE+RELEASE+EXPIRE) ≥ 0` → `RESERVATION_OVERFLOW`;
4. presežna vračila → `ΣRETURN ≤ ΣOUT` → `RETURN_OVERFLOW`;
5. dvojna izdaja → if/else convert/decrement (koda :1257–1270) + `idempotencyKey`;
6. dvojno knjiženje → `idempotencyKey @@unique` per tok;
7. ločevanje poškod. vs prod. → `OUT_waste_damaged` (0 na S) / `OUT_loss_sellable` (− na S);
8. ločevanje fizičnih/nefizičnih → StockMovement (fiz.) vs ReservationEvent/AvailabilityEvent (nefiz.);
9. append-only korekcije → nov/reverzni dogodek, nikoli UPDATE.

### 5.3 Kako bo implementacije to uveljavlja
- **Vse v eni transakciji** (vzorec `createStockMovement`:163), z row-lock na ciljno entiteto (variant/batch/
  alloc) pred preverjanjem `RES+B≤S` in `A≥0`.
- **Pure funkcije** (npr. razširjen `computeAvailableStock(stock, reserved, blocked)`), ki jih pokrivajo
  unit testi (analogno obstoječemu `tests/inventory/stock.test.ts`).

---

## 6. Integracija z obstoječim checkoutom (analiza + predlogi)

| Funkcija | Trenutno vedenje (PASS) | Predlagana sprememba (2D-1A) | Tveganje | Test |
|---|---|---|---|---|
| `reserveStock` :166 | `reservedQuantity += q` ob `AVAIL` (brez B, brez StockMovement) | dodati `B` v `available` (`S−RES−B`) in `idempotencyKey`; ob rezervaciji tudi `StockReservationEvent RESERVE` | večji pogoj, idempotency | unit + itest |
| `releaseStockReservation` :187 | `reservedQuantity −= q` | ob RELEASE še `StockReservationEvent RELEASE` (ali EXPIRE) | idempotency | unit + itest |
| `convertReservationToSale` :208 | `stock−=q`, `reserved−=q` + OUT ORDER | dodati `StockReservationEvent ISSUE`; OUT z `allocationId`/`batchRecordId` | dvojna izdaja (že if/else) | itest dvojni webhook |
| `applyOrderStockDecrement` :91 | `stock−=q` + OUT ORDER (fallback export) | dodati `batchRecordId`/`allocation` na OUT; izdaja je alternativa (ne vzporedna) | uskladitev alloc | itest |
| `createStockMovement` :81 | transakcija + NEGATIVE za product/variant | omogočiti `source:PRODUCTION`; dodati `allocationId`/`returnOfMovementId`/`resellable`; `computeStockDelta` (S) | novi viri/fieldi | itest |

**Dokazi (zahtevani od naloge):**
- **Izdaja le enkrat:** if/else :1257–1270 + PAY-guard :1216 — **PASS** (koda preverjeno ne dvojno knjiži).
- **Rezervacija ne ustvarja fizičnega premika:** `reserveStock` ne piše StockMovement — **PASS**.
- **Delna izdaja → rezervacija:** `convertReservationToSale` zniža `reservedQuantity`; v novem modelu `ISSUE −m`
  (`ΣISSUE ≤ RESERVE`) — **v načrtu**, implementiralo.
- **Sprostitev preostanka:** `releaseStockReservation` / `RELEASE` / `EXPIRE` — **v načrtu**.
- **Podvojeni webhook ne dvojne izdaje:** PAY-guard — **PASS** (dejansko v kodi).
- **Vračilo ≤ izdano:** `ΣRETURN ≤ ΣOUT` (v novih akcijah vračil) — **v načrtu**.

**Sprememba checkouta:** predlagana sprememba je **razširitev obstoječih funkcij**, ne nov vzporedni
mehanizem. Edina strukturna sprememba je vpeljava `StockReservationEvent` kot vira resnice za rezervacije
(obstoječa `reservedQuantity` postane zrcalo). **Ne ustvarjamo vzporedne akcije;** napredki na obstoječem viru.

---

## 7. Migracijski načrt in varnost

### 7.1 Načela
- **Nova migracija, ločena od tujih.** Nikar na obstoječa imena (baseline/einvoice/advances). Nova mapa
  `prisma/migrations/<ts>_phase_2d1a_harvest_batch_traceability/`.
- **Podatki se ohranijo:** vsa obstoječa tabela `StockMovement`, `Product`, `OrderItem` ostanejo nespremenjene;
  nova polja imajo privzete/null vrednosti.
- **Stare proizvodne serije:** obstoječi `batch` (ExtensionRecord) ostanejo; `ProductionContribution` se
  ne izpolnujuje samodejno z izmišlenjem — **če stari pridelek ni zanesljivo povezan s serijo, ostane neznan**
  (brez namišljene zgodovine). — **PRINCIP (2D-1J §7).**
- **Stari StockMovement:** ohranjeni; `batchRecordId`, ki že obstaja, ostane; `allocationId`/
  `returnOfMovementId`/`resellable` → NULL (zgodovini se ne dodaja umišljenih navezav).
- **Obstoječe rezervacije:** v obstoječi shemi so le na `Product.reservedQuantity`; **ne prepisujemo** stare
  rezervacije v `StockReservationEvent` brez zveze z naročilom — nova rezervacijska evidence se vodi za nove
  operacije; stari `reservedQuantity` se upošteva pri začetni uskladitvi. — **PARTIAL** (odločitev: ali seed
  prenese trenutne reserved quantity v StockReservationEvent za odprta naročila; predlog: `NOT VERIFIED`,
  odvisno od tega, ali lahko zvežemo naročilo↔rezervacija).
- **Preprečiti napačno pripisovanje stare zaloge serijam:** `IN PRODUCTION` brez `batchRecordId` (star zapis)
  se **ne** pripiše nobeni seriji; rekonstrukcija ga šteje kot nezasedljiv podatkovni kos brez izvora.
- **Začetna uskladitev:** izračuna se trenutni `S/RES` za varovalko; `B` → začenja z 0 (umik ni zgodovinsko).

### 7.2 Postopek migracije (na TESTNI bazi)
1. **Testna baza** (ločen PostgreSQL, `DATABASE_URL_TEST`).
2. **Mirgration dry-run:** `prisma migrate diff --from-url <prod/copy> --to-schema-datamodel` (samo razlika,
   brez izpisa v production).
3. **Varnostna kopija** pred migracijo (pg_dump testne baze).
4. **Preverjanje pred migracijo:** shema veljavna (`prisma validate`), testi unit zeleni, `einvoices.ts`/
   `schema.prisma` tuje spremembe nedotaknjene.
5. **Izvedba na test:** `prisma migrate dev --name phase_2d1a...` (test only).
6. **Preverjanje po migraciji:** `prisma migrate status`, seed/backfill logika, unit + itest.
7. **Rollback:** ob napaki — restore varnostne kopije ali `migrate diff --from` na prejšnje stanje (test).

### 7.3 Pogoji, pri katerih se NI izvaja
- Če `schema.prisma` vsebuje nesporazumljive tuje spremembe (FAIL datoteka), ali če `prisma validate` ne gre,
  ali če testna baza ni pripravljena. **`markec_dev` / produkcijska baza se ne dotikajo**, razen če uporabnik
  izrecno pozneje odobri.

---

## 8. Predlagani vrstni red implementacije (podfaze)

> Posamezne podfaze so **logične** in se lahko dokončajo/proverijo neodvisno. **Ne začenjam nobene — zgolj načrt.**

| Podfaza | Cilj | Datoteke (predlagane) | Spremembe | Odvisnost | Test | Merilo PASS | Pogoj ustav. | Povrnitev |
|---|---|---|---|---|---|---|---|---|
| 1. Podatkovni model + migracija | nova entiteta/enum/polja | `prisma/schema.prisma` (+nova migracija) | ProductionContribution, OrderItemBatchAllocation, StockReservationEvent, StockAvailabilityEvent, add-on StockMovement, Enum+PRODUCTION/REPAIR | — | `prisma validate`, migracija dry-run/test | validate PASS; tuje spremembe nedotaknjene | če tuji konflikt | restore dump |
| 2. Proizvodne povezave | pridelek→serija→količine | `src/app/actions/` (nov `production.ts`), `src/lib/inventory/stock.ts` | ProductionContribution akcije, `IN PRODUCTION`, INSUFFICIENT_HARVEST, idempotencyKey | 1 | unit + itest | contribution IN, loss/net korektno | napačna org | branch revert |
| 3. Naročil arts ↔ serije | `OrderItemBatchAllocation` | `src/app/actions/order-alloc.ts` | alloc ob rezerviranju izdaje, OUT z allocationId/batchRecordId | 1 | itest | OUT se veže na batch | IDs neveljavni | revert |
| 4. Dogodkovni tok rezervacij | `StockReservationEvent` | `src/app/actions/reservation.ts` + checkout | RESERVE/ISSUE/RELEASE/EXPIRE; resled RES+B≤S | 1 | unit itest | invariant drži | neg. rezervacija | revert |
| 5. Dogodkovni tok razpoložljivosti | `StockAvailabilityEvent` | `src/app/actions/availability.ts` | WITHDRAW/REACTIVATE; invariant | 1 | unit itest | B≤S−RES | preseg | revert |
| 6. Vračila/poškodbe/odpis | RETURN/REPAIR/WASTE/DAMAGE_RESERVED | `src/app/actions/returns.ts` | RETURN `resellable`/`returnDisposition`; OUT_loss_sellable; write-off; DAMAGE_RESERVED | 1 | itest | ΣRETURN≤ΣOUT; S/D ločena | preseg vračila | revert |
| 7. Integracija checkouta | extend reserve/release/convert/decrement | `src/app/actions/product-checkout.ts` (+ lib/stock) | `computeAvailableStock(stock,reserved,blocked)`; idempotency; alloc | 1,4,5 | itest + E2E | ena izdaja; webhook dup≈ne dvojno | neg. A | delay + revert |
| 8. Poročila/rekonstrukcija | active količine iz dogodkov | `src/lib/inventory/` nov rekonstruktor | `P,S,D,Rep,RES,B,A,I,R` iz dogodkov; invariant preverba | 2-7 | unit (pure) | bilanca konvergentna | neskladje → FAIL | revert |
| 9. E2E | celotna pot z brskalnikom | `e2e/...` | Playwright pot §9 | vse | Playwright | vseh 13 korakov zeleno | mobilni/broken | — |

**Obrazložitev razdelitve:** logična ter tesno povezana z odvisnostmi (upiramo na podatkovni sloj v 1, nato
ločeno proizvodni/rezervacijski/razpoložljiv/način vračanja nato integracija). To omogoča, da se vsak del
preveri samostojno in da se morebitna težava vrne brez zgodnje kompliciranosti. Ne začenjam nobene.

---

## 9. Testni načrt

### 9.1 Unit testi (pure logika + formule)
- `RES+B≤S` (RESERVE/WITHDRAW oba primera), `A=S−RES−B`, `P=S+D+Rep`, `Neto=I−R`.
- Razširjen `computeAvailableStock(stock, reserved, blocked)`.
- Validacija referenc (org/batch/variant/allocation), `idempotencyKey`, dovoljene prehode stanj.

### 9.2 Integration testi (itest, ki uporabljajo testno bazo)
- Org izolacija (2 org ne delita), povezave pridelek→serija→izdelek, delne rezervacije/izdaje, delna vračila,
  poškodbe in odpisi, sočasni zahtevki (row-lock), transakcijski rollback (invalide mid-way → ni liste).

### 9.3 Browser E2E (Playwright) — 13 korakov iz naloge
1. ustvari pridelek; 2. ustvari serijo; 3. poveži serijo↔pridelek; 4. količine/izgube; 5. izdelek/različica;
6. serija↔izdelek; 7. rezervacija; 8. delna izdaja; 9. delno vračilo; 10. poškodba; 11. odpis/popravilo;
12. fizična+prodajna bilanca; 13. sledljivost do pridelka. + negativni testi + mobilni prikaz (390px).

### 9.4 Načelo
- **NEDS testa označimo PASS, če ni bila dejansko izvedena.** (to načrt izpostavlja; rezultat se zabeleži le
  po izvedbi — v tej fazi ni izvedbenih, vse je načrt.)

---

## 10. Tveganja in zaščita tujih sprememb

### 10.1 Zaščita (obvezno)
- `prisma/schema.prisma` — **ne prepisovati**; dodajati samo nove definicije, po uskladitvi z lastniki (F5.x/F2.x/einvoicing).
- `src/app/actions/einvoices.ts` — **nedotaknjen** (untracked tuj zapis).
- `prisma/migrations/**` — obstoječih **ne** spreminjati; nova migracija ločena.
- `markec_dev` in produkcijska baza — **ne dotikati**.

### 10.2 Zaznane kolizije (točka 2.6)
- **Modernizatio:** `schema.prisma` ima velike tuje spremembe (F5.x …). Nova polja/enumi se morajo dodati
  tako, da ne spremenijo obstoječih relacij. **Ni znane trde kolizije z navedenimi modeli (Product/StockMovement/
  OrderItem) — PARTIAL** (spremembe niso preprečene, a zahtevajo koordinacijo tekočih lastnikov).
- **Migracije:** obstoječi mape/baseline — nova mapna imena; **PASS** (ni konflikta, če dodamo novo).

---

## 11. Dokumentacija in poročilo o pripravljenosti

### 11.1 Kaj je bilo dodano
- `docs/REFERENCE-ACTIVITY-BEEKEEPER-PHASE-2D-1-IMPLEMENTATION-PLAN.md` (ta dokument). **Nič kode/sheme.

### 11.2 Pregledane datoteke (working tree)
- `git status`/`git diff --stat`; `prisma/schema.prisma` (Product:1177, StockMovement:2130, OrderItem:1303,
  ExtensionRecord:1533, StockMovementSource:2120);
- `src/app/actions/product-checkout.ts` (:91,:146,:166,:187,:208,:1097,:1216,:1257),
  `src/app/actions/inventory.ts` (:81,:163,:371,:513), `src/lib/inventory/stock.ts` (:25,:52);
- `tests/inventory/stock.test.ts`, `tests/entry-checkout-65-69.test.ts`, `tests/integration/f54/f551-variant-checkout.itest.ts`;
- `package.json` (skripte), prisma/migrations seznam.

### 11.3 Kolizije s tujimi
- Ni znanih **trdih** kolizij z navedenimi tujimi modeli; a `schema.prisma` in `product-checkout.ts` sta
  intenzivno spreminjani s strani drugih — **uskladitev ob implementaciji obvezna, predložena kot tveganje.**
  `einvoices.ts` ostaja nedotaknjen.

### 11.4 Izvedljivost — PASS
- Načrt je tehnično izvedljiv z obstoječo Next.js/Prisma/PostgreSQL arhitekturo: vsi varovalni mehanizmi
  (transakcije + pogojni UPDATE + idempotency) že obstajajo v vzorcu (`createStockMovement`, checkout).
- Dodane entitete so nove, ne posegajo v tuje.

### 11.5 Preostala tveganja / odločitve uporabnika
1. Ali se **startne rezervacije** (obstoječi `reservedQuantity`) prenesejo v `StockReservationEvent` za odprta
   naročila ali samo nova? → odločitev (predlog: nova; stare kot legacy).
2. Umik pri `RES+B>S` — **zavrniti** ali **omejiti** na `A`? (primer B iz 2D-1J) → odločitev.
3. Ali `OUT_repair` šteje kot trajni izhod (→ W) ali ostane v `Rep` (→ P)? → odločitev.
4. `OUT_loss_sellable` skozi STOCKTAKE — enotno ali ločen dogodek? → odločitev.
5. UI obseg — ali je UI del 2D-1A ali kasneje? (načrt predvideva slojno 2D-1A.)

---

## 12. Pogoji za začetek implementacije

- [ ] uporabnik izrecno odobri **Fazo 2D-1A** (implementacija/šema/migracija);
- [ ] usklajenost `schema.prisma` s tekočimi lastniki tujih sprememb (F5.x/F2.x/einvoicing);
- [ ] testna baza pripravljena (ne `markec_dev`/prod);
- [ ] migracijski dry-run + varnostna kopija izvedena;
- [ ] odločene poslovne izbire (§11.5 1–5);
- [ ] unit/itest podlage zelene.

**Ta načrt je pripravljen; NIČ ni implementirano. Faza 2D-1A ostaja NEODOBRENA. Čakam izrecno odločitev.**

---

# DOPOLNITEV 2D-1K — KONČNE POSLOVNE ODLOČITVE, MIGRACIJA IN IMPLEMENTACIJSKE PODFAZE — read-only

> **Izključno read-only dopolnitev izvedbenega načrta (2D-1 -> plan).** Nič kode/sheme/migracij; Git operacij
> nobenih; `einvoices.ts` in tuje neoddane spremembe nedotaknjene; `markec_dev`/prod nedotaknjena.
> **Faza 2D-1A še NI odobrena za implementacijo.**

## 1. Zaščita repozitorija (ponovno preverjeno)
- `git status --short` → **387 vnosov**; `git diff --stat` → **137 datotek, 11739 vložkov / 6789 črt**.
  **Stanje je nespremenjeno** od zadnjega pregleda — ni dokumentirane spremembe.
- `src/app/actions/einvoices.ts` → **nedotaknjen, untracked (`??`)**; `git ls-files` prazno (ni v HEAD).
- `prisma/schema.prisma` → vsebuje tuje spremembe (F5.x/F2.x/einvoicing). **Ne spreminjam, ne formatiram,
  ne vključujem.**
- Ne izvajam Git add/commit/push/deploy/migracij/sprememb baze/testnih podatkov.

---

## 2. ODLOČITEV 1 — prenos obstoječih rezervacij

### 2.1 Dejansko stanje (verificirano)
- `reserveStock` (product-checkout.ts:166) poveča `reservedQuantity` na **Product/ProductVariant**
  (ne per-order, ne per-order-item). Rezervacija se izvede **ob kreaciji naročila** (checkout-hold,
  :932–943), v **isti transakciji** kot `order.create`.
- V podatkovnem modelu **NI ločene povezave** med rezervacijo (querant količine na Product) in konkretnim
  order-item/order (za zalogo; le promocijske rezervacije imajo `promotionRedemption.orderId`). Rezervacijo je
  zato mogoče pripisati naročilu **le posredno**: `Σ reservedQuantity(product) ≡ Σ quantity PENDING order-items
  (iste product/variant)`.
- `reservedQuantity` se zniža ob plačilu (`convertReservationToSale`:208) ali sprosti (`releaseStockReservation`:187).

### 2.2 Sklep
- **Rezervacije se prenesejo v `StockReservationEvent` le, če jih je mogoče varno pripisati naročilu** (prek
  PENDING order-itemov). Če atribucija ni zanesljiva (stanje `reservedQuantity` ni enako vsoti PENDING
  order-itemov zaradi legacy/nekonsistentnosti), se **tisti zapis označi kot nepripisano/blokiran in se NI
  izmišlja** (načelo 2D-1K §2 / načelo 2D-1J: neznana zgodovina → neznana).
- **Idempotenten prenos** (backfill) z `migrationId` markerjem; preskok, če že izveden.

### 2.3 Postopek
1. **Identifikacija aktivne rezervacije:** vsota `reservedQuantity` per (product/variant) > 0, kjer obstaja
   vsaj eno PENDING naročilo istega artikla. `active = stockQuantity>0 && reservedQuantity>0` (po vzorcu `AVAIL`).
2. **Pripis naročilom:** `Σ_qty(PENDING order-items, product/variant)`. Če `Σ reservedQuantity == Σ PENDING items`
   → pripiši; sicer **blokiraj nepripisane** (ni vnosa).
3. **Preprečitev dvojnega prenosa:** `migration.migrationId`/`StockReservationEvent` z `idempotencyKey` uniq
   (org). Ponovni backfill pri istem ključu → ne podvoji.
4. **Preverba vsote:** po migraciji `Σ StockReservationEvent(RESERVE aktivni) == Σ reservedQuantity (strari)`
   (za uspešno pripisane). 
5. **Neskladje rezeracij vs reservedQuantity:** če `Σ prenesenih ≠ Σ starih reservedQuantity` → preostanek se
   **ne** izumi; označi `MISMATCH_PENDING_REVIEW` (ne blokira migracije ostalega).
6. **Rollback:** migracija se izvede v **varnostni kopiji/testni bazi**; ob napaki restore predhodnega stanja.

### 2.4 Matematični primer
```
Pred migracijo:  product A: stockQuantity=10, reservedQuantity=4
                 PENDING order #1 (item A qty=2), #2 (item A qty=2)  → Σ PENDING items = 4
Atribucija 4 == reservedQuantity 4 ✓
Po migraciji:  StockReservationEvent RESERVE +2 → order#1 (idK r1)
               StockReservationEvent RESERVE +2 → order#2 (idK r2)
               RES(aktivni) = 4 == stari reservedQuantity 4 ✓
```
Če bi bil `reservedQuantity=5` (ni PENDING doup), preostanek 1 → **ni izmišljen**, označen za pregled.

**Status: PASS** (obstaja determinističen postopek; enoznačnost velja samo za PENDING-attributable zapise;
neatributabilni → blokada posamičnega zapisa, ne izmišljanje).

---

## 3. ODLOČITEV 2 — umik iz prodaje pri konfliktu RES+B>S

### 3.1 Izbira: **možnost B — delni umik** (predlagano)
`withdrawQty = min(requestedQty, available)` kjer je `available = S − RES − B ≥ 0`.

### 3.2 Preverba vseh robnih primerov
| Primer | available | request | Izid | `RES+B≤S` po? |
|---|---|---|---|---|
| request < avail | 10 | 5 | večji umik 5 | da (spisek) |
| request == avail | 10 | 10 | večji umik 10 | da (B+RES=S) |
| request > avail (delno mogoče) | 10 | 12 | delni umik 10, `PARTIAL` vračilo | da |
| avail == 0 | 0 | n | zavrnjeno (ni mogoče niti delno) | da |
| obstaja aktivna rezervacija | 10 | 5 | umik le nerezerviranega (5≤10) | da |
| hkratna rezervacija + umik | row-lock | — | po lock velja eno; drugi vidi posodobljeno | da |
| podvojeni zahtevek za umik | — | — | `idempotencyKey` uniq → `DUPLICATE_WITHDRAW` (ni 2×) | da |
| ponovna aktivacija (REACTIVATE) | — | — | `B−=qty`, `A+=qty` | da |

### 3.3 Povratno sporočilo uporabniku
- `request ≤ avail` → **popolna uspešna izvedba**.
- `request > avail` in `avail>0` → **delna izvedba** z jasno vrnjenim `actualWithdrawnQty` + `PARTIAL` (sistem
  **nikoli ne umakne manj tiho** — vrne dejansko).
- `avail == 0` (ali nepralno) → **zavrnitev** (`WITHDRAW_UNAVAILABLE`) — ni delnega.

V vsakem primeru velja `RES + B ≤ S`; delni umik je eksplicitno evidentiran z dejansko količino.

**Status: PASS** (vsi robni primeri pokriti; delni umik ni tih — vrača dejansko količino).

---

## 4. ODLOČITEV 3 — fizični premik v popravilo

### 4.1 Končna razrešitev: dogodkovni model, **brez** nove lokacijske tabele
Zadošča **obstoječ predlagani dogodkovni model** (`StockMovement OUT source=REPAIR` + `IN source=REPAIR_RETURN`
+ `Rep` kategorija), ker loči **lastniško** in **skladiščno** fiz. zalogo brez nove entitete:
- `P = S + D + Rep` je **fiz. zaloga v lasti podjetja** (tako v skladišču kot pri servisu).
- `P_skladisce = S + D` (fizično v našem skladišču) — `Rep` je odšli v servis.
- **Nista zamenjanje kategoriji:** `P` (lastniška) in `P_skladisce` (vnašim) sta ločeni izpeljani vrednosti;
  noben kos ni dvojno štet.

### 4.2 Pet primerov
1. **Popravilo v lastnem skladišču:** ni `OUT_repair` (kos ne zapusti skladišča) — ostane v `D`, `P` se ne
   spremeni; ob uspehu → `IN` kot `S`/`D` iz `D`.
2. **Popravilo pri zunanjem servisu:** `OUT_repair` (P−, Rep+, S/D đi ven), nato `IN_repair_return` (P+, Rep−,
   ocena → S ali D).
3. **Neuspešno popravilo:** `IN_repair_return` kot **poškodovan** (`D`), ali ostane pri servisu (Rep).
4. **Dokončni odpis:** `OUT_waste_damaged` nad kosom v `D` (P−, D−, **S nespremenjen**).
5. **Vrnitev kot poškodovan:** `IN_repair_return` → `D` (ni `S`).

### 4.3 Matematični primer
```
Začetno:  S=8, D=2, Rep=0, P=10
Premik v servis (OUT_repair 1, kos bil v D):  P 10→9, D 2→1, Rep 0→1   (P=S+D+Rep=8+1+1=10 ✓)
Vrnitev iz servisa (IN_repair_return 1, ocena → S): P 9→10, Rep 1→0, S 8→9
Končno:  S=9, D=1, Rep=0, P=10.  P (lastn.)=10, P_skladišče=S+D=10 (ni več v servisu).
```
**Dokaz:** `P` (lastniška) se med servisom ohrani (10→→10); `Rep` odšteje od `P_skladisce` (med servisom 9),
a ostane v `P`. Kategoriji (lastniška vs skladiščna) se ne mešata — v vsakem trenutku je `P = S + D + Rep` in
`P_skladisce = S + D`.

**Status: PASS** (dogodkovni model je dovolj; ni potrebe po novi lokacijski tabeli).

---

## 5. ODLOČITEV 4 — OUT_loss_sellable in STOCKTAKE

### 5.1 Izbira: **enoten `StockMovement` OUT z razlogom**, **brez** nove tabele
Najboljša rešitev glede na obstoječo kodo (`createStockMovement`:81, `submitStockTake`:513, enum
`StockMovementSource`) je:
- Uporaba **obstoječega `OUT` z `source=STOCKTAKE`** za fizično izgubo **prodajnega** kosa (kot danes
  inventura), a z **dodatkom `reason`/`lossType`** (ali `note`) za sledljivost — **NE** novo `OUT_loss_sellable`
  kot ločen tok.
- **`OUT source=STOCKTAKE` na prodajnega kosa → zniža S in P** (`OUT_loss_sellable` po definiciji), ker kos
  je bil v `S`.
- **`OUT source=WASTE` na poškodovanega → zniža le P/D, ne S** (že priprava v D).
- Predlagan **`reason` polje** na StockMovement (Release) za razlog (ízguba/kradja/poškodba), ki skupaj s
  `source` omogoči sledljivost; **ni nova tabela**.

### 5.2 Primerjava
| Rešitev | SZniža? | Sledljivost | Dodatna tabela | Sklep |
|---|---|---|---|---|
| ločen `OUT_loss_sellable` | da | da | ne (dogodek) | možno, a podvaja STOCKTAKE |
| `OUT source=STOCKTAKE` + `reason` | da (za prodajnega) | da (reason+user) | ne | **izbrano** — najmanjši, skladen s kodo |
| ločen inventurni korekcijski dogodek | da | da | **da** | odvečno (kode ima STOCKTAKE) |

### 5.3 Posledice
- Dvojno zmanjšanje `S` preprečeno: `STOCKTAKE` OUT vpliva na S **samo** če je kos bil v S; če je bil v D
  (poškodovan) → ne vpliva na S (kot `OUT_waste_damaged`).
- Org izolacija in sledljivost razloga/uporabnika (kot danes v `createStockMovement`, ki ima `createdById`).
- Korekcija napačnega inventurnega dogodka: nov `IN`/`OUT` STOCKTAKE (reverzni) v isti mehanizem — **ne brišem
  zgodovine** (append-only).
- Vpliv na `StockMovementSource`: `PRODUCTION`/`REPAIR`/`REPAIR_RETURN` so edine dodane vrednosti
  (`STOCKTAKE`/`RETURN`/`ORDER` že obstajajo); `OUT_loss_sellable` je **izpeljana oznown** iz `STOCKTAKE` +
  stanje (ne nova vrednost enum-a ali nov tok).

**Status: PASS** (en dvaj? manjša zahteva — dodati `reason` polje; ni nove tabele; skladno s kodo).

---

## 6. ODLOČITEV 5 — obseg uporabniškega vmesnika

### 6.1 Meja (predlog, skladen z MARKEC)
V fazo 2D-1A (če je UI v njej):
- **Minimalni, delujoči UI za čebelarja**, vedno vezan na strežniške akcije in podatke:
  - pridelek → serija (vnos `inputQuantity/netQuantity/lossQuantity`),
  - prikaz izgube, povezava serije↔izdelek,
  - sledljivost (izvor prodanega kosa → pridelek),
  - izbira serije pri prodaji (kjer je potrebna),
  - pregled zaloge (P/S/D/Rep/RES/B/A) in zgodovine dogodkov (append-only).
- Vse prek obstoječih vzorcev (actions + `revalidatePath`), org-scope (`requirePermissionOrg`).

Poznejša podfaza (NE 2D-1A):
- Napredni grafi, analitična poročila, oblikovanje, napredni filtri, dashboardi.

### 6.2 Realističnost glede na MARKEC
- MARKEC ima že **profile/extension gated UI** (primer: `batch-production`, `bee-apiary` v `registry.ts`/
  `extensions.ts`, `createStockMovement` preverja `profile.extensions` za batch — inventory.ts:122). Zato se
  čebelarske funkcije lahko **pojavi zgolj pri dejavnosti, ki ima omogočeno ekstenzijo** (čebelar), **ne** pri
  mehaniku/frizerju, ki je ne uporablja.
- **Preverba:** UI mora biti ograjeno z enako profile/extension guard kot podatkovni sloj. Če bi se UI prikazal
  brez tega, bi šlo za napako (ne sklanji). Za prikaz trajanja: **PARTIAL** — UI obseg je realen, a mora biti
  izrecno zasnovano profile-gated (drugače se pojavi povsod).

**Status: PASS** (minimalni UI realen; profile-guard je must za isolacijo dejavnosti).

---

## 7. Končni podatkovni in migracijski načrt (po odločitvah)

### 7.1 Model (posodobljen — izhaja iz 2D-1J, upošteva spodnje odločitve)
- `ProductionContribution` (input/net/loss/honeyType; indeksi org/batch/source) — kot 2D-1J.
- `OrderItemBatchAllocation` (org, orderItem, batch, qty, status; `@@unique(org,orderItem,batch)`) — kot 2D-1J.
- `StockReservationEvent` (`RESERVE/ISSUE/RELEASE/EXPIRE`, `idempotencyKey @@unique(org)`, org/alloc/order/batch
  indeksi) — kot 2D-1J.
- `StockAvailabilityEvent` (`WITHDRAW/REACTIVATE`, `reason`, `idempotencyKey @@unique(org)`, indeksi
  org/batch/variant) — kot 2D-1J.
- `StockMovement` dodatki: `allocationId`, `returnOfMovementId`, `idempotencyKey`, `resellable`,
  **`reason String?`** (odločitev 4), `returnDisposition`; enum + `PRODUCTION, REPAIR, REPAIR_RETURN`.
- **Brez nove lokacijske tabele** (odločitev 3). **Brez nove inventurne tabele** (odločitev 4).

### 7.2 Invariante (obvezne, 2D-1J)
- `RES + B ≤ S` (RESERVE: RES+qty+B≤S; WITHDRAW: RES+B+qty≤S).
- `A = S − RES − B ≥ 0`; `P = S + D + Rep`; `ΣRETURN ≤ ΣOUT`; `Neto = I − R`; negativne zaloge prepovedane.

### 7.3 Migracija (odločitve 1 in 4)
- Izhodna rezervacijska evidenco (backfill) sezona 2D-1K §2 (samo PENDING-attributable; idempotentno).
- Inventurna izguba ohranja ostanek: `OUT STOCKTAKE` = fiz. izguba prodajnega (S−), `reason` loči od poškod.
- Nova migracija ločena (novo ime, ne baseline/einvoice).
- Rollback: restore varnostne kopije / dry-run na testni (ne prod).

---

## 8. Končna razdelitev implementacije (dokončno)

| # | Podfaza | Cilj | Datoteke (predlog) | Odvisnost | Migr. | Unit | Itest | E2E | Merilo PASS | Ustavitev | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Model + migracija | nova entiteta/enum/polja | schema.prisma + nova migr. | — | da (test) | validate | — | — | validate PASS, tuje nedotaknjene | tuji konflikt | restore |
| 2 | Proizvodne povezave | pridelek→serija→količ./izguba | `actions/production.ts`, lib/stock | 1 | — | + | + | — | contribution IN, loss korektno | nap. org | revert |
| 3 | Naročil razdelitev↔serija | `OrderItemBatchAllocation` | `actions/order-alloc.ts` | 1 | — | + | + | — | OUT veže se na batch | neveljavni ID | revert |
| 4 | Tok rezervacij | `StockReservationEvent` (+ preselitev §2) | `actions/reservation.ts`, checkout | 1 | backfill §2 | + | + | — | RES+B≤S; vsota == reservedQuantity | neg. | restore |
| 5 | Tok razpoložljivosti | `StockAvailabilityEvent` (delni umik §3) | `actions/availability.ts` | 1 | — | + | + | — | withdrawQty=min(req,avail); delni auto | preseg | revert |
| 6 | Popravilo/odpis/poškodba | OUT_repair/WASTE/DAMAGE_RESERVED, `reason` (§4/§5) | `actions/returns.ts`, `actions/disposal.ts` | 1 | — | + | + | — | P=S+D+Rep; S/D ločena | dvojno vračilo | revert |
| 7 | Checkout integracija | rxnd reserve/release/convert/decrement | product-checkout.ts, lib/stock | 1,4,5 | — | + | + | + | ena izdaja; dup webhook ne-dvojno | neg. A | delay+revert |
| 8 | RKON + poročila | rekonstrukcija P/S/D/Rep/RES/B/A | lib/inventory (reconstructor) | 2–7 | — | + (pure) | + | — | bilanca konvergentna | neskladj | revert |
| 9 | UI (minimalni) | čebelarski UI (profile-gated) | components/actions gated | 2–8 | — | — | + | **+** | vseh 13 korakov E2E | mobilni/broken | — |
| 10 | E2E + regresija | polna pot + negativni + mobilni | e2e/ | 1–9 | — | — | — | + | PASS le po izvedbi | napaka | — |

**Vrstni red zagotavlja:** UI (9) pride **za** backendom (2–8) → UI ne uporablja nedokončanega backend-a;
checkout integracija (7) pride **po** dogodkovnih tokovih (4,5) → ni vzporedne/zgodnje dvojne evidence.
**Ne začenjam nobene podfaze.**

---

## 9. Zaključek — preglednica odločitev

| Odločitev | Končna rešitev | Matematično preverjen | Skladno z obstoječo kodo | Odprta tveganja |
|---|---|---|---|---|
| **1. Prenos rezervacij** | prenos le PENDING-attributable v `StockReservationEvent`; idempotentno; ne-atributabilni ostanejo blokirani (ni izmišljanja) | **PASS** (primer §2.4) | **PASS** (rezero na `reserveStock`/`reservedQuantity`) | ne-atributabilni `reservedQuantity` (legacy) |
| **2. Delni umik** | `withdrawQty = min(req, S−RES−B)`; delni vrnjen eksplicitno; ob nepralno zavrnjeno | **PASS** (vsi robni) | **PASS** (row-lock + pogoji) | odločitev »zavrni vs delni«? — rešena (delni) |
| **3. Popravilo** | dogodkovni model OUT_repair/IN_repair_return, `Rep`, brez nove lokacijske tabele | **PASS** (P=S+D+Rep primer §4.3) | **PASS** (ni nove tabele) | `OUT_repair` trajni izhod? (rešena: ne) |
| **4. Inventurna izguba** | enoten `OUT STOCKTAKE` + `reason` za izgubo prodajnega; `OUT WASTE` za poškodovanega (S nespremenjen) | **PASS** | **PASS** (createStockMovement/STOCKTAKE obstaja) | potreben `reason` polje na StockMovement |
| **5. UI** | minimalni čebelarski UI, **profile-gated**, vezan na strežniške akcije | **PASS** | **PARTIAL** (profile-guard je must za isolacijo dejavnosti) | UI zahtevnost/obseg za 2D-1A |

---

## 10. Priporočilo

**PRIPRAVLJENO ZA KONČNO ODOBRITEV IMPLEMENTACIJE** (ob pogojih):
- Ugotovljene rešitve za 5 odločitev so matematično in kodo-skladne (PASS/PARTIAL);
- dva **PARTIAL** vira: (a) ne-atributabilni legacy `reservedQuantity` (odločitev 1) — obravnavan kot blokada
  posamičnega zapisa, ne riziko; (b) `reason` polje na StockMovement (odločitev 4) + profile-guard za UI
  (odločitev 5) — prihodnje zahteve.
- **Odobritev Faze 2D-1A (implementacije) prepustim uporabniku.** Ne odobrim namesto njega. Za presojanje
  (1–10) so ti pogoji izpolnjeni; izbira in morebitna izvedba sta na uporabniku.

**NIČ ni implementirano.** Faza 2D-1A ostaja **NEODOBRENA**. Ustavim se in čakam izrecno končno dovoljenje.

---

# DOPOLNITEV 2D-1L — KONČNA MATEMATIČNA IN PODATKOVNA USKLADITEV — read-only

> Odpravi tri neskladja iz neodvisnega pregleda 2D-1K: (1) fizična zaloga vs zaloga v popravilu, (2) prenos
> obstoječih rezervacij (vsote ≠ zgodovina), (3) WASTE/STOCKTAKE enum (WASTE ne obstaja). **Samo dokument —**
> nič kode/sheme/migracij/baze, brez Git operacij, `einvoices.ts` in tujo WIP nedotaknjena, `markec_dev`/prod
> nedotaknjena. **Faza 2D-1A ostaja neodobrena.**

## 0. Stanje repozitorija (preverjeno)
- `git status --short` ≈ 387 vnosov; `git diff --stat` 137 datotek / 11739 vložkov / 6789 črt (nespremenjeno).
- `einvoices.ts` untracked (`??`), `schema.prisma` s tujim WIP — **nič ni spreminjano.**

---

## 1. POPRAVEK ŠT. 1 — fizična bilanca in zaloga v popravilu

### 1.1 Odprava protislovja 2D-1K
2D-1K je `P` označil kot »sku. zaloga v lasti podjetja«, a pri premiku v servis znižal `P` in dviga `Rep`.
To je protislovno: **premik v servis ne spreminja lastništva**, torej `P_owned` mora ostati.

### 1.2 Nedvoumne, medsebojno izključujoče kategorije
| Kategorija | Pomen | V skladišču? | V lasti? | Prodajno uporabna? |
|---|---|---|---|---|
| `S` | prodajno uporabna, V našem skladišču (offerable) | DA | DA | DA |
| `B` | umaknjena iz prodaje, še fizično V skladišču | DA | DA | NE pryjena (a material veljaven) |
| `D` | poškodovana, V našem skladišču | DA | DA | NE |
| `Rep` | pri zunanjem servisu (v lasti, ni v skladišču) | NE | DA | NE (odšla) |
| `W` | odpisana / izguba lastništva (fizično ni več) | NE | NE | NE |
| `Sold` | prodana kupcu (ni več v lasti) | NE | NE | — |

**Vsak kos je natanko v eni kategoriji.** `B` **NI podmnožica** `S`, ampak **samostojna fizična kategorija**
(velja materialno v skladišču, ni ponujen). `RES` (rezervacija) je **zlasti zahteva na `S`** (only offerable), ne
fizična kategorija in **ne povečuje fizične zaloge**.

### 1.3 Končne formule
```
P_warehouse = S + B + D              // fizično v našem skladišču
P_owned     = S + B + D + Rep        // v lasti podjetja, vklj. pri servisu
Rep = ΣOUT_repair − ΣIN_repair_return
W   = ΣOUT_waste_damaged + ΣOUT_loss_sellable + ΣOUT_repair_loss(neuspešno popravilo)
A   = S − RES                        // razpoložljiva (S offerable, brez B/D)
```
- **Invariant fiz. bilance:** kos ne izgine, dokler ni dogodek z izgubo lastništva (`OUT_loss_sellable`,
  `OUT_waste_damaged`, `OUT_repair_loss`, `OUT_order`). **Premik med lokacijami** (skladišče↔servis) **ne**
  spremeni `P_owned` — samo prestavlja med `S/D` in `Rep`.
- **Izguba lastništva (kraja/izguba/odpis) je ločena od premika lokacije:** zniža `P_owned` (in `P_warehouse`
  le, če je bil kos v skladišču).

### 1.4 Scenariji A–G (izračunano; P_owned se zmanjša le ob resnični izgubi)
**A. Začetno:** `S=8 D=2 B=0 Rep=0` → `P_wh = 8+0+2 = 10`, `P_owned = 10`.
**B. Umik 1 iz prodaje** (fiz. ostane): `S=7 B=1 D=2 Rep=0` → `P_wh=7+1+2=10` **(nespremenjena)**, `P_owned=10`.
**C. Premik 1 poškodovanega v servis** (iz `D`): `D=1 Rep=1`, `S=7 B=1` → `P_wh=7+1+1=9` (zapustil skladišče),
`P_owned=7+1+1+1=10` **(nespremenjena)**.
**D. Vrnitev iz servisa kot prodajna** (iz `Rep`): `Rep=0 S=8`, `B=1 D=1` → `P_wh=8+1+1=10`, `P_owned=10`.
**E. Vrnitev iz servisa kot poškodovana** (iz `Rep`, iz C): `Rep=0 D=2`, `S=7 B=1` → `P_wh=7+1+2=10`, `P_owned=10`.
**F. Dokončni odpis poškodovanega** (OUT_waste_damaged 1 iz D): `D=1` → `P_wh=7+1+1=9`, `P_owned=9` (**izguba**).
**G. Neuspešno popravilo, izdelka izgubljen pri servisu** (iz C, `Rep=1`): `OUT_repair_loss` → `Rep=0`,
`P_wh` nespremenjena (9), `P_owned=9` (**lastniška izguba** — NIni premik, je izguba).

**Dokaz:** `P_owned` se zmanjša le v F in G (izguba lastništva). B/C/D/E ohranijo `P_owned=10`.

### 1.5 Obvezna končna tabela (§2.4)
| Dogodek | S | D | B | Rep | P_warehouse | P_owned |
|---|---:|---:|---:|---:|---:|---:|
| Začetno stanje | 8 | 2 | 0 | 0 | 10 | 10 |
| Umik iz prodaje (B) | 7 | 2 | 1 | 0 | 10 | 10 |
| Premik v servis (C) | 7 | 1 | 1 | 1 | 9 | 10 |
| Vrnitev kot prodajno uporabno (D) | 8 | 1 | 1 | 0 | 10 | 10 |
| (Vrnitev kot poškodovano — E, altern.) | 7 | 2 | 1 | 0 | 10 | 10 |
| Dokončni odpis (F) | 8 | 0 | 1 | 0 | 9 | 9 |

- `P_warehouse = S+B+D` in `P_owned = P_warehouse + Rep` velja v vsaki vrstici (preverljivo).
- Vrstica »Vrnitev kot poškodovano« je **alternativna veja** od stanja C; ne stoji v isti vrsti kot D.

---

## 2. POPRAVEK ŠT. 2 — prenos obstoječih rezervacij

### 2.1 Dejansko stanje (ločim vir)
| Trditev | Vir | Vrsta |
|---|---|---|
| `reserveStock` (:166) poveča `reservedQuantity` na Product/ProductVariant, brez povezave na order | neposredno videno | neposredno dokazano |
| Rezervacija se zgodi ob kreaciji naročila v isti transakciji (checkout-hold :932–943) | neposredno videno | neposredno dokazano |
| Ni ločene povezave rezeracija↔order/orderItem v shemi (za zalogo) | pregledano | neposredno dokazano |
| `reservedQuantity == Σ PENDING order-items` | domnevno, NI dokazano (enakost vsot ≠ zgodovina) | **sklepanje / nepreverjeno** |
| Vsaka PENDING ni nujno aktivna rezervacija (legacy/brez atribucije) | sklepanje | nepreverjeno |

### 2.2 Tri možnosti
- **A — pripis posameznemu naročilu:** **dovoljena LE, če obstaja direktna dokazljiva povezava** (v praksi
  danes NI; `reservedQuantity` ni povezan z order → A v osnovi **NOT AVAILABLE za obstoječe zapise**).
- **B — skupno začetno stanje rezervacije** za `(organization, product/variant)`: dovoljeno, če je **skupna
  količina zanesljivo dokazana**. **Ne izmišljamo `orderId`/`orderItemId`** — uporabi se poseben »legacy«
  zapis (`orderId=NULL`, `source=LEGACY`, `allocationId=NULL`).
- **C — blokada zapisa:** če skupne količine ni mogoče dokazati ali obstaja neskladje → **označi za pregled,
  ne prenese samodejno.**

### 2.3 Priporočilo
- **Uporabi B, kadar je skupna količina zanesljiva** (dokazana poleg backfill-a);
- **Uporabi A samo, kadar obstaja neposredna povezava** (npr. ko nova operacija že pozna orderId);
- **Uporabi C pri neskladjih.**
- **Povezava z novim sistemom:** legacy agregat se vnese kot `StockReservationEvent RESERVE` s
  `orderId=NULL/source=LEGACY` (skupna količina). Ko pozneje realno naročilo izda/spusti, se legacy agregat
  zmanjša prek `ISSUE`/`RELEASE` — **brez izmišljanja starih naročil**. (Isto kot 2D-1K §z, tokrat brez
  napačnega sklepa, da `reservedQuantity == PENDING` pomeni zgodovino.)

### 2.4 matematični primeri (§3.4)
**1. reservedQuantity=4, PENDING=4, brez povezave posameznih:** → **B**: agregat `RESERVE 4` (orderId=NULL,
legacy, idK `legacy:{org}:{prod}:m2d1a`). Prenese se 4 (skupno, zanesljivo). Ni posameznih order-ev.
**2. reservedQuantity=5, PENDING=4:** neskladje 1. → prenese se **4** (proven floor = PENDING); **blokira se 1**
(C), ne izmišlja. Zabeleži `MISMATCH`.
**3. reservedQuantity=4, PENDING=4, a del PENDING ni več veljaven/aktiven (npr. rezervacija ni aktivna):**
→ prenese se **skupna aktivna količina** (dokazana, npr. 3); **blokira se (4−3)=1** ali neskladje (C).
**Preprečitev dvojnega štetja:** idempotencyKey edinstven; prenos je `ON CONFLICT DO NOTHING`-ekvivalent;
ponovni backfill se ne ponovi.
**Idempotency:** `migrationId`+`key`; preverjanje po: `Σ RESERVE(legacy aktivni) == prenesena vsota` (samo za
B-B dodane). 
**Stanje po migraciji:** per (org,product/variant) agregat; naročila se ne pripisujejo (A ni uporabljeno — ni
dokazane povezave).

**Pomembno:** `reservedQuantity == Σ PENDING` (**enakost vsot NE dokazuje individualne zgodovine**) — zato je
samo B/C, ne A.

---

## 3. POPRAVEK ŠT. 3 — WASTE / STOCKTAKE / razlog

### 3.1 Dejanski enum (preverjeno)
`StockMovementSource` (prisma:2120–2128) = **MANUAL, ORDER, DELIVERY, STOCKTAKE, RETURN**. **`WASTE` NE
obstaja.** 2D-1K je `OUT source=WASTE` uporabil **brez dokaza** — dokumentacijska napaka, popravljena.

### 3.2 Ločnica `source` (fizična pot) vs `reason` (poslovni razlog)
Najboljša rešitev: **NE dodajam `WASTE` kot novo enum vrednost**, ampak:
- `source` = **fizična pot/mehanizem** (dinamična): `ORDER`(izdaja), `RETURN`(vračilo),
  `PRODUCTION`(proizvodnja), `REPAIR`/`REPAIR_RETURN`(servis), `STOCKTAKE`(inventurna izguba/razlika).
- `reason` (novo polje na StockMovement) = **poslovni razlog**: `LOSS_SELLABLE`(izguba prodajnega),
  `WRITE_OFF_DAMAGED`(odpis poškodovanega), `REPAIR_LOSS`(neuspešno popravilo/izguba v servisu),
  `RETURN`. 
- **Vpliv na S z določa STANJE kosa (D vs S), ne `source`:** `OUT source=STOCKTAKE reason=LOSS_SELLABLE` na
  kos v `S` → S−, D nespremenjen; `OUT reason=WRITE_OFF_DAMAGED` na kos v `D` → D−, S nespremenjen.

### 3.3 Preglednica (§4.2)
| Poslovni dogodek | Fiz. vpliv (P) | Prodajni vpliv (S) | RES | S/D/B/Rep | source | reason | dodatni dogodek? |
|---|---|---|---|---|---|---|---|
| izguba prodajnega izdelka | `−P_owned` | `−S` | (RELEASE če rezerv. pred) | S− | `STOCKTAKE` | `LOSS_SELLABLE` | ni |
| odpis že poškodovanega | `−P_owned` | 0 (S nesprem.) | 0 | D− | `STOCKTAKE` (ali `DISPOSAL`) | `WRITE_OFF_DAMAGED` | ni (S vi ne) |
| premik v zunanji servis | `P_owned` ne; `P_wh`− (Rep+) | 0 (iz S/D) | — | S/D→Rep | `REPAIR` | — | ni |
| vrnitev iz servisa | `P_wh`+ (Rep−), `P_owned` ne | ±(ocena) | — | Rep→S/D | `REPAIR_RETURN` | — | ni |
| poškodba REZERVIRANEGA | `P` ne (ostane) | 0 (iz S v D) | `RELEASE` pred | S−,D+ | (nov `DAMAGE_RESERVED` event) | `DAMAGE` | `RELEASE` + `DAMAGE_RESERVED` |
| korekcija napačne inventure | `P` ↕ | po stanju | — | aprez | `STOCKTAKE` (reverzni IN/OUT) | `CORRECTION` | nov zapis (append-only) |

### 3.4 Izbor rešitve
**En jasen izbor:** **`source` = fizična pot** (enum brez `WASTE`; dodati le `PRODUCTION/REPAIR/REPAIR_RETURN`)
+ **`reason` = poslovni razlog** (novo polje). `WASTE` se **ne** uvaja kot enum; `WRITE_OFF_DAMAGED` je **razlog**,
`STOCKTAKE` je **source**. To zadosti ločbi, ne dodaja nepotrebnih enum vrednosti.

### 3.5 (posebni primer) poškodba rezerviranega — atomično (append-only)
1. preveri aktivno rezervacijo (`RES ≥ qty`);
2. `RELEASE −qty` (StockReservationEvent RELEASE, idem);
3. odstrani iz `S` (`S−qty`);
4. premakni v `D` (`D+qty`); (P ostane)
5. zabeleži `reason`+`createdById` (user), `DAMAGE_RESERVED` event (idem);
6. odslej kos v `D` → ni v `S` → **ni ga mogoče izdati**.
**Vse v ENI transakciji** (same-org, `requirePermissionOrg`), `idempotencyKey` edinstven; ponovitev → duplicate.

---

## 4. Integrirani matematični test

### 4.1 Vhod in dogodki (koherentna različica — številke so izvedene, ne vnaprej)
- `IN PRODUCTION 19` (pridelek 10 kg, neto 9,5, izguba 0,5; 19 koz).
- `RESERVE 10`; potem `OUT_order 7` (+`ISSUE −7`, rez. ostane 3).
- `RETURN 1 resellable` (→S), `RETURN 1 damaged` (→D, obdržan v skladišču).
- `WITHDRAW 1` (iz S → B).
- `OUT_repair 1` (iz **S**, poslana v servis za manjšo napako) → Rep+1.
- `OUT STOCKTAKE reason=LOSS_SELLABLE 1` (iz S) → odpis 1 (W+1).

### 4.2 Ledger tabele (vse kategorije)
| # | Dogodek | S | D | B | Rep | RES | P_wh | P_owned | A=S−RES | I | R | W |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | IN PROD 19 | 19 | 0 | 0 | 0 | 0 | 19 | 19 | 19 | 0 | 0 | 0 |
| 2 | RESERVE 10 | 19 | 0 | 0 | 0 | 10 | 19 | 19 | 9 | 0 | 0 | 0 |
| 3 | OUT ORDER 7 | 12 | 0 | 0 | 0 | 3 | 12 | 12 | 9 | 7 | 0 | 0 |
| 4 | RETURN sellable 1 | 13 | 0 | 0 | 0 | 3 | 13 | 13 | 10 | 7 | 1 | 0 |
| 5 | RETURN damaged 1 | 13 | 1 | 0 | 0 | 3 | 14 | 14 | 10 | 7 | 2 | 0 |
| 6 | WITHDRAW 1 | 12 | 1 | 1 | 0 | 3 | 14 | 14 | 9 | 7 | 2 | 0 |
| 7 | OUT_repair 1 (iz S) | 11 | 1 | 1 | 1 | 3 | 13 | 14 | 8 | 7 | 2 | 0 |
| 8 | OUT STOCKTAKE loss 1 | 10 | 1 | 1 | 1 | 3 | 12 | 13 | 7 | 7 | 2 | 1 |

### 4.3 Končno stanje (§5 zahteve)
- **fizična zaloga:** `P_warehouse = S+B+D = 10+1+1 = 12`; `P_owned = 12+Rep1 = 13`.
- **prodajno uporabna:** `S = 10`.
- **poškodovana:** `D = 1`.
- **umaknjena:** `B = 1`.
- **pri servisu:** `Rep = 1`.
- **aktivne rezervacije:** `RES = 3`.
- **razpoložljiva:** `A = S − RES = 10 − 3 = 7`.
- **prodana:** `I = 7`; **dejansko prodana:** `Neto = I − R = 7 − 2 = 5`.
- **vrnjena:** `R = 2`.
- **odpisana:** `W = 1`.

### 4.4 Dokazi (vse zahteve)
- **Noben izdelek ni štet dvakrat:** vsaka od 19 enot je natanko v eni kategoriji: 5 prodanih(kupcu) + 1
  odpisana + 10 prodajnih + 1 B + 1 D + 1 Rep = 19 ✓.
- **Nobena ni izginila brez dogodka:** vsak prehod ima dogodek (IN/RETURN/OUT_repair/STOCKTAKE/RETURN).
- **Rezervacije ne povečajo fizične zaloge:** `RES` (zahteva na `S`) ne spremeni `P_wh`/`P_owned`.
- **Umaknjena zaloga ostane fizično evidentirana:** `B=1` je v `P_wh` (=S+B+D) ✓.
- **Popravilo ≠ odpis:** `Rep` ohranja `P_owned` (14 pri `Rep=1`); odpis (`STOCKTAKE loss`) zniža `P_owned` na 13 ✓.
- **Vračilo ne povzroči dvojnega povečanja:** vsak `RETURN` je en dogodek, `ΣRETURN ≤ ΣOUT`; vračilo sellable→S+1,
  damaged→D+1 (ločeno) — ni podvajanja.
- **Prodaja se ne knjiži dvakrat:** `OUT_order 7` enkrat (z `ISSUE −7`); if/else convert/decrement + PAY-guard.

---

## 5. Končna podatkovna in transakcijska uskladitev (popravljeni model)

Vsakega od obstoječih modelov (2D-1J) posodobim v skladu s popravki:

| Model | Namen | Ključna polja | Org izol. | Unikat | Idempotency | Append-only | Trans. meja | Korekcija |
|---|---|---|---|---|---|---|---|---|
| `ProductionContribution` | vir→serija | org, batchRecordId, sourceRecordId, input/net/loss (Decimal14,4), unit, honeyType | yes | — | (idK po želji) | DA | ena txn | nov contribution | 
| `OrderItemBatchAllocation` | orderItem+serija+qty | org, orderItemId, batchRecordId, qty, status | yes | `@@unique(org,orderItem,batch)` | — | DA (status append) | ena | nov dogodek |
| `StockReservationEvent` | rezervacije | org, orderId **NULLABLE**, allocationId?, batchRecordId?, type, qty, idempotencyKey | yes | `@@unique(org,idempotencyKey)` | `idemKey` | DA | ena (RESERVE/ISSUE/RELEASE/EXPIRE) | RELEASE/REVERSE |
| `StockAvailabilityEvent` | umik | org, batchRecordId/variantId?, type (WITHDRAW/REACTIVATE), qty, reason, idem | yes | `@@unique(org,idempotencyKey)` | idem | DA | ena | REACTIVATE |
| `StockMovement` | fizični ledger | + `allocationId`, `returnOfMovementId`, `idempotencyKey`, **`reason String?`**, `resellable`, `returnDisposition`; enum + `PRODUCTION/REPAIR/REPAIR_RETURN` (**NE WASTE**) + indeksi | yes | `@@unique(org,idempotencyKey)` (opc.) | idem | DA | ena txn | reversal/OUT | 

**Preverbe (zahtevane):**
- **Več delnih vračil iste izdaje:** `@@unique(org, idempotencyKey)` ne blokira; `returnOfMovementId` veže
  na isti OUT, `idempotencyKey` različen → več RETURN dovoljeno z `ΣRETURN≤ΣOUT` — **PASS**.
- **Več vračil → isti original OUT:** `returnOfMovementId` NI unik (sam), uniq je le `idempotencyKey` → moženih
  N vračil na en OUT (idempotencyKey različen) — **PASS**.
- **Delnje rezervacije:** `ISSUE` delno in `RELEASE` preostalo; `RES` neto — **PASS**.
- **Webhook večkrat brez dvojnega:** PAY-guard + if/else + idemKey — **PASS**.
- **Korekcije zgodovine:** novi dogodki, nikoli UPDATE — **PASS** (append-only).

---

## 6. Popravljeno zaporedje implementacijskih podfaz (§7)

> Enako kot 2D-1K, z upoštevanjem popravkov (B prenos rezervacij, `reason` polje, P_warehouse/P_owned, ne WASTE).

| # | Podfaza | Cilj | Odvisnost | Datoteke | Shema-spre. | Migracija | Unit | Itest | E2E | PASS | Ustavitev | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Model + migracija | novi modeli + `reason`; **NE WASTE** | — | schema.prisma + nova migr. | DA | test-only | validate | — | — | validate PASS; tuje čist | tuji konflikt | restore |
| 2 | Proizvodne povezave | contribution, IN PRODUCTION | 1 | actions/production, lib/stock | — | — | + | + | — | contribution korekt | nap. ORG | revert |
| 3 | Naročil razdelitev↔serija | OrderItemBatchAllocation | 1 | actions/order-alloc | — | — | + | + | — | OUT→batch | neveljaven ID | revert |
| 4 | Tok rezervacij + **migr. legacy (B)** | StockReservationEvent; backfill po §2 | 1 | actions/reservation, checkout | — | backfill(B) | + | + | — | RES+B leg; vsota==preneseno | neskladje → C | restore |
| 5 | Tok razpoložljivosti | StockAvailabilityEvent (delni umik) | 1 | actions/availability | — | — | + | + | — | withdrawQty=min(req,avail) | preseg | revert |
| 6 | Servis/odpis/poškodba | `REPAIR`, `REPAIR_RETURN`, STOCKTAKE+reason; DAMAGE_RESERVED | 1 | actions/returns, disposal | — | — | + | + | — | P_owned izgube točne | dvojno | revert |
| 7 | Checkout integracija | rxnd reserve/release/convert/decrement + RES | 1,4,5 | product-checkout, lib/stock | — | — | + | + | + | ena izdaja; dup webhook | neg. A | delay/revert |
| 8 | RKON + poročila | P_warehouse/P_owned rekonstrukcija | 2–7 | lib/inventory | — | — | + pure | + | — | bilanca konvergira | neskladj | revert |
| 9 | UI (minimalni, **profile-gated**) | čebelarski UI | 2–8 | components/actions gated | — | — | — | + | **+** | 13 korakov E2E | mobil/broken | — |
| 10 | E2E + regresija | polna pot + negativni + mobilni | 1–9 | e2e | — | — | — | — | + | PASS le po izvedbi | napaka | — |

**Zaporedje:** model (1) → dogodkovni tokovi (2–6) → checkout (7) → RKON (8) → UI (9) → E2E (10). UI nikoli
pred dokončanim backend-om; checkout po stabilnih tokovih; profile-guard (2D-1J §6) obvezno za čebelarske
funkcije. **Nobena podfaza se ne začne brez izrecne odobritve.**

---

## 7. Končno poročilo (§8)

| Ugotovitev | Popravek | Matematično dokazano | Preverjeno v kodi | Status |
|---|---|---|---|---|
| Fizična bilanca (P vs Rep) | `P_warehouse=S+B+D`, `P_owned=P_wh+Rep`; premik↔lok. ne spreminja `P_owned` | DA (§1.4–1.5, §4) | DA (formule konsistentne) | **PASS** |
| Prenos rezervacij | B (agregat, orderId=NULL/legacy) + C (blokiranje neskladno) — **brez izmišljanja** | DA (§2.4) | DA (`reserveStock` dokazano per-product) | **PASS** |
| WASTE/STOCKTAKE | `source=STOCKTAKE` + `reason`; **`WASTE` ne obstaja v enum** — ne dodajati | DA | DA (enum :2120 = MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN) | **PASS** |
| Poškodovana rezervacija | `RELEASE` + `DAMAGE_RESERVED` atomicno, append-only | DA | DA (vzorec transakcij) | **PASS** |
| Integrirani primer | koherentna različica, 19 joger, konservacija dokazana | DA (§4.3–4.4) | DA | **PASS** |

**Priporočilo:**

**1. PRIPRAVLJENO ZA KONČNO ODOBRITEV IMPLEMENTACIJE** (pod pogoji)
- Vsi trije popravki so matematično, podatkovno in poslovno skladni; `P_owned` se zmanjša le ob dejanski izgubi
  lastništva; umik (B) ostaja v ftiz. bilanci; `A=S−RES` je konsistentna; rezervacijski prenos uporabi B/C
  (ne izmišlja order-ev); `WASTE` se ne uvaja kot enum.
- **PARTIAL / odprta tveganja (ne blokade):**
  1. `reason` polje na StockMovement je **novo** — prihodnja zahteva (treba dodati kolono Enum/string);
  2. ne-atributabilni legacy `reservedQuantity` → blokiran (C), ni izmišljen;
  3. `source=STOCKTAKE` za `WRITE_OFF_DAMAGED` zahteva dosledno stanje kosa (mora biti `D`), da se `S` ne zniža
     dvakrat (aplikatty bat preverjanje, ne shema);
  4. profile-guard za UI ostaja obvezen.

**Zaključek:** dokument dodatno usklajen; **nič ni implementirano**. Faza 2D-1A **ostaja NEODOBRENA**; ustavim
se in čakam izrecno končno odločitev.

---

# DOPOLNITEV 2D-1M — KONČNA VALIDACIJA LEGACY REZERVACIJ IN TRANSAKCIJSKE CELOVITOSTI — read-only

> Odpravi zadnje nejasnosti pred morebitno odobritvijo: (1) pravilen prenos legacy rezervacij (PENDING NI
> dokaz rezervacije), (2) transakcijska celovitost in idempotenca, (3) uskladitev podatkovnega modela z
> append-only pravilom, (4) matematična kontrola `P_warehouse/P_owned/A`. **Izključno dokument — nič kode**
> sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` in tuji WIP nedotaknjeni; `markec_dev`/prod
> nedotaknjeni. **Faza 2D-1A ostaja neodobrena.**

## 0. Stanje repozitorija (preverjeno, nespremenjeno)
- `git status --short` ≈ 387 vnosov; `git diff --stat` 137 datotek / 11739 vložkov / 6789 črt.
- `einvoices.ts` untracked; `schema.prisma` s tujim WIP — nič ni spreminjano.

---

## 1. Popravek prenosa legacy rezervacij

### 1.1 Dejanska implementacija (neposredno dokazano)
- Edini zapisovalci `reservedQuantity` v kodi so **tri funkcije v `product-checkout.ts`**:
  - `reserveStock` :175 (`reservedQuantity = reservedQuantity + q`; pogoj `AVAIL` = `stockQuantity − reservedQuantity ≥ q`),
  - `releaseStockReservation` :194 (`−= q`; pogoj `reservedQuantity ≥ q`),
  - `convertReservationToSale` :219 (`stockQuantity −= q` in `reservedQuantity −= q`; pogoj `reservedQuantity ≥ q`).
  **Nobena druga pot (actions/lib/api/seed) ne spreminja `reservedQuantity`** (checked `src/app/actions`, `src/lib`,
  `src/app/api`; `src/lib/inventory/stock.ts:48` je le komentar, ne pisec).
- `reservedQuantity` je **živi agregat v povezavi z življenjskim ciklom naročila**: + ob kreaciji (PENDING),
  − ob izdaji (PAID) ali − sprostitev ob izteku (webhook `expired` :100–119 sprosti + order→CANCELLED).
- **`PENDING` order-items NE dokazujejo rezervacije:** rezervacija lahko bila že sproščena (webhook je sprostil
  in order sočasno CANCELLED), ali obstaja legacy brez rezero. **PENDING štetje ni nadomestni dokaz.**

### 1.2 Končno pravilo (skladno z navodilom)
1. **Če je trenutni agregat `reservedQuantity` zanesljiv vir skupnega stanja (per product/variant)** → preneseš
   **njegovo natančno vrednost** v skupni `StockReservationEvent RESERVE` z `orderId=NULL`, `source=LEGACY`,
   `allocationId=NULL`, edinstvenim `idempotencyKey = legacy:{org}:{productVariant}:mig2d1a`. **Ni izmišljanja
   order-ev.**
2. **Če zanesljivost ni dokazana** (negativen, neskladen, stanje se je med migracijo spremenilo, obstaja suma
   legacy poškodbe) → **blokiraj prenos konkretnega izdelka/variante** in zahtevaj ročni pregled (`migrationBlock`).
3. **Ne izmišljaj zgodovine naročil.**
4. **Ne uporabljaj PENDING kot nadomestnega dokaza.**
5. **Ne ustvarjaj dvojnih rezervacij** (`idempotencyKey` uniq + `migrationId` marker).

**Kdaj je `reservedQuantity` zanesljiv:** ko je nenegativen in je `Σ` (po vseh product/variant) mogoče
uskladiti z aktivnimi rezervacijami brez znanega iztekajočega se procesa. **Preverljivost iz dejanskih podatkov:**
`Σ reservedQuantity` (per product) == aktivne rezervacije (npr. po PENDING-ost, ki imajo dejansko rezeracijo,
nego PENDING sam po sebi). — **PARTIAL** (za obstoječe podatke ni mogoče trditi 100 %, da ni legacy poškodbe;
zato se zanesljivost preveri, ne predpostavlja).

### 1.3 Matematična primera
**A. Zanesljiv agregat**
```
Zaporedje (izvedljivo v kodi):
  OB order#1 (PENDING)  → reserveStock +2   (reservedQuantity=2)
  OB order#2 (PENDING)  → reserveStock +3   → reservedQuantity=5
  Order#1 plačan        → convertReservationToSale −2  → reservedQuantity=3
  Order#3 (PENDING)     → reserveStock +1   → reservedQuantity=4
Stanje pred migracijo: reservedQuantity=4 (proven: 3 akt.iz order#2+#3, 1 novo order#3)
Migracija (pravilo 1): RESERVE legacy +4 (orderId=NULL, source=LEGACY, idK=legacy:{org}:{variant}:m2d1a)
  Ponovni zagon migracije → `ON CONFLICT`/marker → ne podvoji.
Po: Σ legacy RESERVE(aktivni)=4 == reservedQuantity(zaprti)=4 ✓
```
**B. Neskladen / nezanesljiv agregat**
```
reservedQuantity = -2 (negativen — legacy korupcija)  →  blokiraj; ni prenosa.
Σ reservedQuantity = 4, a aktivne rezero (preverene) = 3 → neskladje 1 → blokiraj (ali preneseš dokazanih 3,
  preostanek v review). (C iz 2D-1L.)
```
**Brez izmišljanja, brez PENDING kot dokaza, brez dvojnega prenosa** — v obeh primerih (idemKey + validacija).

---

## 2. Transakcijska celovitost (preverjeno na dejanski kodi)

### 2.1 Tabela operacij
| Operacija | Preveri pred | Zaklenje | Ustvari | Aggre. | Ob napaki | Prepreči dvojno |
|---|---|---|---|---|---|---|
| RESERVE | `AVAIL` (`stock−reserved≥q`) + ORG | row (ProductVariant) via pogojni UPDATE | `StockReservationEvent RESERVE` | `reservedQuantity` | rollback celotna tx | `idemKey` uniq (+ CAS) |
| ISSUE + OUT_ORDER | `reserved≥q` / `ΣISSUE≤RES` | row via pogojni UPDATE | OUT StockMovement + `ISSUE` | `reservedQuantity`, `stockQuantity`, `S` | rollback | `idemKey` + order-status CAS |
| RELEASE | `reserved≥q` | row | `RELEASE` | `reservedQuantity` | rollback | `idemKey` |
| EXPIRE | scheduler token | row | `EXPIRE` | `reservedQuantity` | rollback | token uniq |
| RETURN + link on OUT | `ΣRETURN≤ΣOUT`, ORG, alloc | row (alloc/OUT) | IN RETURN + ref | `S`/`D` | rollback | `idemKey` + `ΣRETURN≤ΣOUT` |
| DAMAGE_RESERVED + RELEASE | `RES≥qty`, stanje kos=S | row (RES) | `RELEASE` + `DAMAGE_RESERVED` | `S`,`D` | rollback | `idemKey` |
| WITHDRAW | `RES+B+qty≤S` | row | `WITHDRAW` | `B` | rollback | `idemKey` |
| REACTIVATE | `B−qty≥0` | row | `REACTIVATE` | `B` | rollback | `idemKey` |
| REPAIR (OUT) | kos je v S ali D, ORG | row | OUT REPAIR | `S/D→Rep` | rollback | `idemKey` |
| REPAIR_RETURN | skup. | row | IN REPAIR_RETURN | `Rep→S/D` | rollback | `idemKey` |
| STOCKTAKE izguba | kos v S (LOSS) ali D (WRITE_OFF) | row | OUT STOCKTAKE + `reason` | `S/D, P_owned` | rollback | `idemKey` |
| Korekcija | reverzni dogodek | row | nov dogodek | — | rollback | `idemKey` |

**Skupni vzorec:** vsaka = ena `prisma.$transaction`; stanja se posodabljajo atomično z **pogojnim UPDATE** in
**idempotencyKey**; pri napaki rollback → noben agregat ni delno spremenjen.

### 2.2 Checkout proti dvojni izdaji (preverjeno v kodi)
- **Webhook `checkout.session.completed`:** vstopna vrata `if (order.status !== "PENDING") return` (:212–214); nato
  **atomični `order.updateMany({ where:{id,status:"PENDING"}, data:{status:"PAID"} })`** (:224–229) = **CAS na
  status** — če dva (dva webhook-a / webhook+verify) tečeta sočasno, prvi spremeni (count=1), drugi vidí count=0
  → ne podvoji.
- **`verifyProductOrder`:** `alreadyProcessed` guard (:1216, `status===PAID` → return) + PAY-status-gate.
- **V transakciji** if/else `convertReservationToSale` → fallback `applyOrderStockDecrement` (:1257–1270) — le ena
  veja se izvede.
- **Zaključek:** dvojna izdaja pri ponovljenih webhookih in sočasnih zahtevah je preprečena z **dvojno varovalko**
  (status-CAS + PAY-guard + if/else). **PASS** (neposredno dokazano v kodi :212,:224,:1216,:1257).

**Neizrečena opomba (idempotencyKey ni edina varovalka):** pri checkoutu primarni mehanizem ni `idempotencyKey`
(ki je sugeriran za novi model), ampak **kontekstni CAS na `order.status`** — to je potrjena in dejanska pot.

---

## 3. Podatkovni model — uskladitev z append-only

### 3.1 Append-only ↔ `status` polja
- **`StockReservationEvent`** in **`StockAvailabilityEvent`** = **dogodkovne vrstice** (type RESERVE/ISSUE/… in
  WITHDRAW/REACTIVATE) — **no mutable status**; stanje je agregat (Σ pozitivnih − Σ negativnih). ✓ append-only.
- **`OrderItemBatchAllocation.status`** (sočasna PARTIALLY_ISSUED/ISSUED/CANCELLED) je **izpeljan** kratek status,
  ki **se sme izračunati iz dogodkov**, ne shranjevati kot UPDATE-polje, če želimo strog append-only. **Priporočilo:**
  **ne hraniti `status` kot mutabilnega polja**; izračunavati iz `ΣOUT/ISSUE` (ISSUED ⇔ `issued==qty`). S tem se
  izognemo nasprotju med append-only in spreminjanjem `status` z UPDATE. → **popravek modela (predlog)**
- Noben drug model nima status polja.

### 3.2 Preverbe medsebojne skladnosti (§4 naloge)
- **Več delnih izdaj iste rezervacije:** `ΣISSUE ≤ RES` (RES neto); več `ISSUE −m` dovoljeno, `RES−=m` — **PASS**.
- **Več delnih vračil iste izdaje:** `returnOfMovementId` ni unik; `idempotencyKey` vsakega vračila unik;
  `ΣRETURN ≤ ΣOUT` — **PASS**.
- **Več serij pri enem OrderItem:** več `OrderItemBatchAllocation` (različni batchRecordId) na isti orderItem —
  **PASS**.
- **Vračilo poškodovanega:** `IN RETURN resellable=false` → `D+1`, `S` nespremenjen — **PASS**.
- **Poškodba rezerviranega:** `DAMAGE_RESERVED` atomicno (RELEASE + S/D) — **PASS** (2D-1L §3.5).
- **Popravilo/vrnitev:** `REPAIR`/`REPAIR_RETURN`, `P_owned` se ne spremeni, `P_warehouse` ob odhodu − — **PASS**.
- **Odpis:** `STOCKTAKE`+`reason`, `P_owned` −; `S` le če kos v S — **PASS**.
- **Korekcija:** nov (reverzni) dogodek — append-only — **PASS**.
- **Ponovljeni/sočasni:** idemKey + status-CAS — **PASS**.

---

## 4. Matematična kontrola formule (§5)

### 4.1 Potrditev invariant
- **`P_warehouse = S + B + D`**, **`P_owned = P_warehouse + Rep`**, **`A = S − RES`**.
- **Rezervacija NE poveča fizične zaloge:** `RESERVE` spreminja le `RES` (zahteva na S), ne `P_wh`/`P_owned`.
- **Umik iz prodaje NE zmanjša fizične zaloge:** `WITHDRAW` prestavi `S→B`, oba v `P_wh`. (Preverjeno v tabeli
  2D-1L §1.5: umik S=8→7, B=0→1, P_wh ostane 10.)
- **Premik v servis NE zmanjša lastništva:** `REPAIR` `S/D→Rep`, `P_owned` ostane. (Tabela: premik v servis
  `P_owned=10` nespremenjen.)
- **Prodaja zmanjša lastništvo:** `OUT_order` → `P_owned` − (izstopi kupljeno). 
- **Vračilo ponovno poveča ustrezno kategorijo:** `RETURN resellable` → `S+`; `RETURN damaged` → `D+` — vsak
  enkrat (ΣRETURN≤ΣOUT).
- **Odpis zmanjša lastništvo:** `OUT ... reason=WRITE_OFF/LOSS` → `P_owned` −.
- **Noben kos ni štet dvakrat:** disjunktne Gategor (S/B/D/Rep/W/Sold); vsaka enota natanko v eni.

### 4.2 Dodatno neskladje? 
Nobeno novo ni bilo odkrito; vse formule iz 2D-1L so v smeri zgoraj skladne. Edina opomba je iz **§3.1** (status
polje alloc) — ni matematična, ampak append-only/fronta — že podana.

---

## 5. Končno poročilo (§6)

| Področje | Status | Dokaz |
|---|---|---|
| Legacy rezervacije | **PASS** | `reservedQuantity` = edini zapisvalec agregat (le 3 funkcije v :175/194/219); pravilo A (zanesljiv) / C (blokiraj); PENDING ni nadomestek |
| Idempotency | **PASS** | idemKey uniq (model), mig marker; + checkout CAS |
| Transakcijska celovitost | **PASS** | vsaka operacija ena $transaction; rollback; pogojni UPDATE |
| Sočasne zahteve | **PASS** | webhook case (status-PENDING → PAID, :224), verify (:1216), if/else (:1257) |
| Delne izdaje | **PARTIAL** | `ΣISSUE≤RES` dokazan; status-polje alloc (iz sod.) je predlog za izognitev UPDATE (načrt, ni kod) |
| Delna vračila | **PASS** | `ΣRETURN≤ΣOUT`, idemKey (ne blokira več RETURN) |
| Append-only zgodovina | **PARTIAL** | dogodkovni tokovi append-only; `OrderItemBatchAllocation.status` naj se izračunava (priporočilo), da ni UPDATE-polja |
| Fizična bilanca | **PASS** | `P_wh=S+B+D`, `P_owned=P_wh+Rep`, `A=S−RES`; dokazano (2D-1L §4) |
| Prodajna bilanca | **PASS** | `A=S−RES`; `B` izven `A`; konsistentno |
| Integracija checkouta | **PASS** | if/else convert/decrement + status-CAS + PAY-guard (preveriti :212/:224/:1216/:1257) |

**Legenda:** PASS = neposredno dokazano v kodi/formuli; PARTIAL = matematično/predlog, ni izvedeno v shemi;
FAIL/NOT VERIFIED = ni uporabljeno.

---

## Priporočilo

**PRIPRAVLJENO ZA KONČNO ODOBRITEV IMPLEMENTACIJE** (pod pogoji iz 2D-1L/2D-1J):
- Legacy rezervacije se prenesejo iz **natančnega `reservedQuantity` agregata** (edini pisec), ne iz PENDING;
  blokiranje pri neskladjih; brez izmišljanja; idempotentno (idK + mig marker).
- Transakcijska celovitost je dokazana v kodi (status-CAS, if/else, rollback); vsi dogodkovni tokovi so
  append-only; `OrderItemBatchAllocation.status` naj se računa (priporočilo), da ni nasprotja z append-only.
- Fizična/prodajna bilanca dokazana; nobeno novo neskladje ni najdeno.
- **PARTIAL opazki (ne blokirata):** `OrderItemBatchAllocation.status` izpeljan (predlog); simulacija legacy
  zanesljivosti med migracijo (zahtevan prag preverjanja). 

**NIČ ni implementirano.** Faza 2D-1A **ostaja NEODOBRENA**; ustavim se in čakam izrecno končno odločitev.

---

# DOPOLNITEV 2D-1N — KONČNA VALIDACIJA MIGRACIJE IN TRANSAKCIJ — read-only

> Odpravi zadnje vprašanje: (1) legacy agregat `reservedQuantity` in dokaz zanesljivosti, (2) kritično vprašanje
> skupne legacy rezervacije brez `orderId` in kako pozneje vedeti, koliko pripada kateremu naročilu,
> (3) ločitev obstoječe kode (EXISTING CODE PASS) od prihodnje arhitekture (ARCHITECTURE). **Izključno dokument —
> nič kode/sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` in tuji WIP nedotaknjeni; `markec_dev`/prod
> nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 0. Preverjene datoteke in dokazne lokacije
- `src/app/actions/product-checkout.ts` :91 (`applyOrderStockDecrement`), :146 (`AVAIL` = `stockQuantity − reservedQuantity ≥ q`),
  :166 (`reserveStock`), :187 (`releaseStockReservation`), :208 (`convertReservationToSale`), :1216 (`alreadyProcessed`),
  :1257–1270 (if/else convert→fallback).
- `src/app/api/webhooks/stripe/route.ts` :100 (order PENDING gate), :212–214 (webhook PENDING gate),
  :224–229 (status-CAS `updateMany { where:{status:"PENDING"}, data:{status:"PAID"} }`), :101–119 (expired → release).
- `prisma/schema.prisma`: `Product.reservedQuantity` :1195, `ProductVariant.reservedQuantity` :1572+,
  `StockMovementSource` :2120 (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN — **brez WASTE**).
- `src/lib/inventory/stock.ts` :52 (`computeAvailableStock` = max(0, stock−reserved)), :25 (`computeStockDelta`).
- Preluk: `Select-String` čez `src/app/actions`, `src/app/api`, `src/lib`, `scripts`, `prisma`, `tests` → **edini
  zapisovalci `reservedQuantity` so tri funkcije v `product-checkout.ts`.** (Preostale omembe :48, tests/:67 so
  komentarji, ne pisce.)

---

## 1. Legacy agregat `reservedQuantity` – dokaz zanesljivosti

### 1.1 Trije zapisovalci (verificirano)
| Fn | Lokacija | V transakciji? | Preverba rozpoložljivo | Zaščita sočasno | Napake | Vez na order |
|---|---|---|---|---|---|---|
| `reserveStock` | product-checkout.ts:166 | da (klic iz $transaction ob kreaciji :932) | `AVAIL`(:146 `stock−reserved≥q`) | atomični `UPDATE ... WHERE id AND AVAIL`, `r===1` | `return false` → klicatelj rollback | ob order-create; brez order-polje na rezeracijo |
| `releaseStockReservation` | :187 | da | `reservedQuantity ≥ q` (:195) | atomični `UPDATE ... WHERE id AND reserved≥q` | `return false` | kliče se z order items (webhook :114) |
| `convertReservationToSale` | :208 | da | `reservedQuantity ≥ q` (:220) | atomični `UPDATE ... WHERE id AND reserved≥q` | `return false` (fallback decrement) | OUT ORDER z orderId (:233) |

Vsi trije uporabljajo **atomski pogojni UPDATE**; nobeden ne more sam pognati `reservedQuantity` v negativno
skupaj ohranjene invariante `0 ≤ reserved ≤ stock` (guard: `reserved≥q` in `stock−reserved≥q`).

### 1.2 Ali 3 pisce dokazujejo zgodovinsko pravilnost? — **NE**
Omejeno število piscev je **potreben, ne zadosten** pogoj za pravilnost:
- pravilnost **runtime invariant** (0≤reserved≤stock, nikoli negativ preko kode) je **neposredno dokazano** iz
  guardov;
- **zgodovinska** pravilnost (da vsaka enota še vedno ustreza resnični aktivni rezeraciji) **NI dokazana** —
  legacy korupcija, prekinjena transakcija pred novim sistemom, ročni popravki baze ali napačen backfill bi jo
  oslabili. Zato: **potreben pre-migracijski postopek preverjanja; drugače BLOKADA.**

### 1.3 Postopek preverjanja pred migracijo
1. **Nenegativnost:** za vsak (org, product/variant) `reservedQuantity ≥ 0` in `reservedQuantity ≤ stockQuantity`;
   sicer → `migrationBlock`.
2. **Usklajenost z dejanskimi aktivnimi rezervacijami:** uskladi `Σ reservedQuantity` z ustreznim naborom PENDING
   **naročil**, ki *dejansko* držijo rezervacijo. **PENDING sam ni dokaz** (rezervacija lahko že sproščena →
   order bi bil CANCELLED). Koristi se nabor PENDING-ov, ki nimajo sproščenega znaka. Usklajevanje je *sklepanje*
   (ne 100 % dokaz) — **NOT VERIFIED** na nivoju individualne zgodovine.
3. **Nepopolne / podvojene / že sproščene:** preveri vsak PENDING ali ima veljaven `orderId`, odsotno `CANCELLED`/
   `REFUNDED`, in odsotnost že-izdane/že-sproščene oznake. Dvoumne → `migrationBlock`.
4. **Preprečitev spremembe med preverjanjem in migracijo:** migracija se izvede **v eni transakciji z zaklepom
   (SELECT ... FOR UPDATE) na podlago (Product/Variant)**, ali pa se **zamrzne spremembe** (checkout → krivda) —
   da se `reservedQuantity` ne spremeni med preverjanjem in prenosom.
5. **`migrationBlock`:** ko nenegativnost ali uskladitev ni dokazana, ali obstaja neskladje → oznaka
   `migrationBlock` za **konkreten izdelek/varianto**; ni avtomatskega popravka številk.

**Sklep:** dokazljiv je le **runtime-invariant**; zgodovinska pravilnost je **sklepanje** in zahteva prag;
brez potrditve → blokada. — **PARTIAL** (potreben je prag preverjanja, ne 100 % dokaz).

---

## 2. Kritično vprašanje – skupna legacy rezervacija brez `orderId`

### 2.1 Težava
Skupni legacy `RESERVE 4 (orderId=NULL)` ne nosi **per-order razporeditve**. Kadar se naročila po migraciji
prekličejo/plačajo/potečejo, sistem mora vedeti, koliko od teh 4 pripada kateremu naročilu. **Skupno odštevanje
brez razporeditve bi bilo izmišljanje.**

### 2.2 Ključno dejstvo, ki rešuje: order-items so vir per-order atribucije
**`OrderItem.quantity` (per order × product/variant) obstaja vedno in nosi natančno količino tega naročila za ta
izdelek.** Obstoječi checkout že uporablja order-items tudi brez ločene rezero-polja: webhook expired (:101–114)
iterira `order.items` in za vsak item kliče `releaseStockReservation`. Torej **per-order količina za operacije
IZHAJA IZ order.items, ne iz legacy rezervacije.**

### 2.3 Operatorji po migraciji (kako sistem ve, koliko)
| Operacija | Vir količine | Postopek (varna strategija) |
|---|---|---|
| `RELEASE` | order.items | kadar je naročilo preklicano → release za vsak item njegove `quantity`; legacy bucket se zmanjša za to qty |
| `EXPIRE` | order.items | potek → enako; legacy bucket − qty |
| `ISSUE` | order.items | plačilo → OUT (qty) + legacy bucket − qty |
| delna izdaja | order.items | izda se del → legacy bucket − izdani del, preostanek ostane v bucket |
| ponovljen webhook | order.items + status-CAS | status-PENDING→PAID CAS; PAY-guard; idemKey; ni dvojnega |
| korekcija napake | order.items | reverzni dogodek (ISSUE/RELEASE), ne UPDATE |

**Odgovor na vprašanje:** sistem ve, koliko pripada kateremu naročilu **iz `order.items`** (količina per order
je v naročilu), ne iz legacy agregata. Legacy `orderId=NULL` je **samo začetna vsota (bucketa)**, ki se zmanjšuje
kot naročila, ki so bila pokrita z njim, napredujejo. **Brez izmišljanja per-order zgodovine** — per-order
količina je realna (v `OrderItem.quantity`), ne izmišljena.

### 2.4 Varna strategija (predlog, skladen z §3 navodila)
- **Legacy bucketa se uporabi SAMO za začetno uskladitev agregata** (stanje `RES` po migraciji = legacy vsota).
- **Nadaljnje operacije tečejo na dejanskih povezavah z naročili** (order.items → RELEASE/ISSUE/EXPIRE z realnim
  `orderId`), **in zmanjšujejo legacy bucket** za ustrezno količino (ker so bile te enote del bucket-a).
- **Brez dvojnega štetja:** vsak order je označen z `migratedReservationBucket` (ali je pokrit z bucket-alo);
  noben order ni hkrati v fresh-liniji in v bucket-u.
- **Če ni mogoče zanesljivo uskladiti** med legacy bucket in naborom PENDING naročil (neskladje) → **BLOKADA
  migracije za tisti razdelek** (ne izmišljaj).

---

## 3. Ločitev obstoječe kode od prihodnje arhitekture (§4)

> Pravilo: prihodnjo operacijo prepoveduje označiti PASS v obstoječi kodi zgolj zato, ker načrt predvideva
> `$transaction`/pogojni UPDATE/`idempotencyKey`.

| Operacija / področje | Označba | Dokaz |
|---|---|---|
| obstoječi checkout | **EXISTING CODE PASS** | `convertReservationToSale` :208 + fallback :1257; status-CAS webhook :224; PAY-guard :1216 |
| obstoječe rezervacije | **EXISTING CODE PASS** | `reserveStock` :166 (atom. pogojni UPDATE, AVAIL) — samo `reservedQuantity` |
| obstoječe sproščanje rezervacij | **EXISTING CODE PASS** | `releaseStockReservation` :187 (pogoj `reserved≥q`); webhook expired :101–119 |
| obstoječa izdaja zaloge | **EXISTING CODE PASS** | `convertReservationToSale` + `applyOrderStockDecrement` ; OUT ORDER ledger |
| prihodnji `StockReservationEvent` | **ARCHITECTURE** | ni v kodi; nov model + operacije (ni PASS v obstoječem) |
| prihodnji `StockAvailabilityEvent` | **ARCHITECTURE** | ni v kodi |
| prihodnje vračanje izdelkov | **ARCHITECTURE** | `RETURN` source v enum obstaja, a ni akcija vračila (movementInputSchema :33) — ni implementirano |
| prihodnje poškodbe/odpis/popravilo | **ARCHITECTURE** | `DAMAGE_RESERVED`, `REPAIR`, STOCKTAKE+`reason` — niso v kodi (le enum STOCKTAKE :2126) |
| prihodnje korekcijske | **ARCHITECTURE** | append-only korekcije — niso v kodi |

**Pojasnilo:** obstaja le `source:RETURN` v enum (prisma:2126) in `movementInputSchema` dovoli ročni `RETURN`
(inventory.ts:33) — vendar **ni** akcij vračanja s per-order linkom, poškodb, popravil ali WASTE. Zato so vse te
**ARCHITECTURE**, ne EXISTING. **Nobene od prihodnjih operacij ne označujem PASS samo zaradi načrta.**

---

## 4. Sočasnost, idempotenca in transakcije (§5)

Za vsako **prihodnjo** operacijo:
1. **Vir resnice:** dogodkovni agregat (`StockReservationEvent`/`StockAvailabilityEvent`/`StockMovement`) — NIKOLI
   samo materializirano polje.
2. **Zaklep/pogojno posodobi:** row na (ProductVariant/batch/allocation) z `SELECT ... FOR UPDATE` ali atomičnim
   pogojnim UPDATE, odvisno od operacije.
3. **Org/lastništvo:** `requirePermissionOrg` + isti `organizationId` (kot v `createStockMovement`).
4. **Zaščita dvojno izvedbe:** `idempotencyKey @@unique(org)` + (kjer ustreza) status-CAS.
5. **Dva sočasna zahtevka:** row-lock + pogojni UPDATE → eden count=1, drugi count=0 (rollback) ali serijska
   izvedba; nikoli oba.
6. **Ponovljen webhook:** status-CAS (PENDING→PAID) + PAY-guard + idemKey (kot :212/:224/:1216).
7. **Rollback vseh povezanih:** ena `$transaction`; dani napaki → noben agregat ni delno spremenjen.
8. **Preprečitev negativnih:** `RES+B≤S`, `A≥0`, `ΣRETURN≤ΣOUT`, `reserved≥q`, `B≥0` — prever Nov.
9. **idempotencyKey ponovna uporaba z drugo vsebino:** `@@unique(org, idempotencyKey)` → konflikt; aplikacija
   vrne `DUPLICATE_*`, ne izvede nove operacije. **Potrebna je tudi vsebinska validacija** (da se isti ključ ne
   uporabi z drugačnimi podatki) — ne samo uniq.

**Opomba:** `$transaction`/pogojni UPDATE **sama po sebi niso dovolj** za vse sočasne scenarije — zlasti multi-row
vsote (RES+B≤S) zahtevajo **eksplicitni row-lock + serializacijo** (npr. vrstni red zaklepov na eno entiteto),
ker noben posamezen UPDATE ne pokriva obeh števcev. **To je prihodnja implementacijska zahteva, ne obstoječe.**
— **ARCHITECTURE / PARTIAL.**

---

## 5. Append-only zgodovina in korekcije (§6)

- **Dogodkovni in nespremenljivi modeli:** `StockReservationEvent`, `StockAvailabilityEvent`,
  `StockMovement` (ledger), `ProductionContribution` — append-only.
- **Mutabilno status polje:** `OrderItemBatchAllocation.status` je edini kandidat; **priporočilo: izračunavati iz
  dogodkov** (`issued==qty → ISSUED`) in ne shranjevati z UPDATE → izognitev nasprotja z append-only.
- **Korekcija napačnega dogodka:** nov **korekcijski dogodek** (npr. `RELEASE` za napake rezero, `REACTIVATE` za
  napake umika, reverzni `IN`/`OUT` pri zalogi, negativen `inputQuantity` pri contribution). **NIKOLI UPDATE/DELETE
  zgodovinske vrstice.**
- **Vpliv korekcije na agregate:** nov dogodek posodoblja agregat (RES/B/S/P_owned), stara vrstica ostane nespremenjena.
- **Preprečevanje dvojne korekcije:** `idempotencyKey` — 2-kratni isti korekcijski dogodek → `DUPLICATE_CORRECTION`.
- **Rekonstrukcija iz dogodkov:** celotna zgodovina (stanja) se lahko ponovi iz agregata dogodkov; materializirana
  polja so le predpomnilnik.

---

## 6. Matematična kontrola (§7)

**Formule skladne (iz 2D-1L §4/§5, ponovno potrjeno):**
`P_warehouse = S+B+D`, `P_owned = P_warehouse + Rep`, `A = S − RES`. Nobeno novo neskladje.

Matematični primer (dokaz konservacije in da legacy bucket ne podvoji):
```
IN PROD 19 → S=19; RESERVE 10 (order#1:4, order#2:6);
OUT ORDER 7 (order#1 vseh 4 + order#2 3) → S=12, RES=3;
RETURN resellable 1 → S=13; RETURN damaged 1 → D=1; (I=7,R=2,Neto=5);
WITHDRAW 1 → S=12,B=1; OUT_repair 1 (iz S) → S=11,Rep=1; STOCKTAKE loss 1 → S=10,W=1.
P_owned = P_wh+Rep = (10+1+1)+1 = 13 ✓ ; A = S−RES = 10−3=7 ✓.
Po migraciji legacy bucket: RES_legacy=3 (od 4, ki so iz order#2 preostalih, order#1 izčrpan ob izdaji),
  RELEASE/ISSUE per order-items zmanjšajo bucket: order#2 → po ISSUE od 6 ostane 3 → bucket 3. ✓
```

---

## 7. Končno poročilo (§8)

| Področje | PASS/PARTIAL/FAIL/NOT VERIFIED | Dokaz |
|---|---|---|
| Legacy rezervacije (zanesljivost) | **PARTIAL** | 3 pisce (runtime invariant dokazan) kot **ne-enako** zgodovinski; pre-migracijski prag potreben; drugače BLOKADA |
| Idempotency | **EXISTING ⇒ PASS** (checkout: idemKey ni glavni; CAS na status). **Prihodnje:** `@@unique(org,idemKey)` + vsebinska validacija — ARCHITECTURE | :224 CAS, :1216 PAY-guard |
| Transakcijska celovitost | **PASS** (checkout status-CAS); **ARCHITECTURE** za prihodnje (row-lock + serializacija RES+B≤S) | :212/:224/:1257 |
| Sočasne zahteve | **PASS** (checkout); prihodnje s pravilnimi locki (ni samo txn) | :224 (count=1) |
| Delne izdaje | **PARTIAL** | `ΣISSUE≤RES` modelno; status alloc iz račun (ni koda) |
| Delna vračila | **ARCHITECTURE** | `ΣRETURN≤ΣOUT` prihodnje; RETURN source obstaja :2126, a ni akcija |
| Append-only zgodovina | **PARTIAL** | dogodkovni modeli; `OrderItemBatchAllocation.status` naj se izračunava (predlog) |
| Fizična bilanca | **PASS** | `P_wh=S+B+D`, `P_owned=P_wh+Rep`, `A=S−RES` dokazano (§6) |
| Prodajna bilanca | **PASS** | S/B/D disjunktne; A=S−RES |
| Integracija checkouta | **PASS** (obstoječi); prihodnji dogodki -- ARCHITECTURE | if/else, status-CAS |

**Statusi se NE enačijo:** vsa prihodnja področja (vračila, poškodbe, WITHDRAW, REPAIR, korekcije) so
**ARCHITECTURE** (niso v obstoječi kodi), ne PASS.

---

## Priporočilo

**NI PRIPRAVLJENO ZA ODOBRITEV IMPLEMENTACIJE** (hkrati ustrezen pred odobritvijo, ker še ni mogoče dokazati):

Da bi bilo pripravljeno, manjka še:
1. **Prag preverjanja legacy `reservedQuantity`** (konkretna pravila, kdaj je zanesljiv → prenos, kdaj `migrationBlock`),
   izvedljiv v dejanski bazi (test), ne le v načrtu — še ni preizkušen na realnih podatkih (**NOT VERIFIED**).
2. **Atribucija per-order:** potrjena varna strategija (order.items kot vir + legacy bucket + `migratedReservationBucket`
   oznaka), brez izmišljanja, brez dvojnega — še ni implementirana/preizkušena.
3. **Serializacija transakcij za multi-row invariante** (RES+B≤S) — ni samo `$transaction`, zahteva row-lock +
   vrstni red; ni v kodi in ni dokazano.
4. **Vsebinska validacija `idempotencyKey`** (isti ključ, druga vsebina) — potrebna, ni implementirana.

Zato: **NI PRIPRAVLJENO ZA ODBOMOČENJE** do izpolnitve zgornjih točk na dejanskih podatkih/testih. **Faza 2D-1A
ostaja NEODOBRENA.**

---

## Zaključek (§9)
- **Preverjene datoteke:** `product-checkout.ts`, `api/webhooks/stripe/route.ts`, `lib/inventory/stock.ts`,
  `schema.prisma` (Product/Variant/StockMovement/Source), `tests/inventory/stock.test.ts`; globalno iskanje
  `reservedQuantity` po actions/api/lib/scripts/prisma/tests.
- **Dokazne lokacije v kodi:** :146,:166,:187,:194,:208,:212–214,:224–229,:116–119,:1216,:1257–1270.
- **Ni spremenjena:** nobena koda, shema, baza, testni podatek.
- **Ni izvedeno:** nobena Git operacija.
- **Nedotaknjeno:** `einvoices.ts`, tuji WIP, `markec_dev`, produkcija.

**Ne implementiram ničesar. Ne začnem faze 2D-1A. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1O — DOKAZLJIVA POVEZAVA LEGACY REZERVACIJ S POSAMEZNIMI NAROČILI — read-only

> Odpravi ključno nepreverjeno predpostavko 2D-1N: `OrderItem.quantity` **NI** samostojen dokaz rezervacije.
> Analizirano na dejanski kodi — ali obstaja dokazljiva, dolgotrajna povezava med rezervacijo in konkretnim
> naročilom. **Izključno dokument; nič kode/sheme/migracij; Git operacij nobenih; `einvoices.ts` in tuji WIP
> nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 1. Popravek predpostavke iz 2D-1N
- **`OrderItem.quantity`** = količina naročenih izdelkov; **NI dokaz, da je bilo rezervirano**.
- **`reservedQuantity`** = trenutni skupni agregat (per product/variant), **brez porazdelitve na naročila**.
- **`reserveStock` uspeh** = dokaz, da je bila rezervacija izvedena (količino poznamo iz `item.quantity`).
- **`convertReservationToSale` true** = dokaz pretvorbe; **false** = ni bilo rezervacije (fallback direktna izdaja).
- **`applyOrderStockDecrement`** = neposredna izdaja (brez rezervacije) — **različno** od pretvorbe rezervacije.

## 2. Življenjski cikel naročila v dejanski kodi (verificirano)

| Pot | Lokacija | Rezervacija? | Količina? | Povezava rez↔orderId? | Rekonstruktivno? | Večkrat? |
|---|---|---|---|---|---|---|
| Ustvarjanje (online Stripe) | `createProductCheckoutSession` :748+ | `reserveStock` v isti tx (:939) | per item | **NE** (ni order-polja na rezero) | delno (inference) | — |
| Uspešna rezervacija | :939 ok | • `reservedQuantity += q` | da | ne | da (agregat) | enkrat |
| Neuspešna rezervacija | :940–942 `throw STOCK_CONFLICT` | **rollback** → naročilo NI ustvarjeno | — | — | — | — |
| Prepaid/gift-card (brez Stripe) | :642–721 | **NI** rezero; `applyOrderStockDecrement` :705 | ne | — | da (OUT) | — |
| Plačilo → pretvorba | `verifyProductOrder` :1257 convert :208 | izda (stock−, reserved−) | da | OUT ima orderId (:233) | da | ok |
| Fallback neposredna izdaja | :1263–1269 `applyOrderStockDecrement` | če convert false | da | OUT orderId | da | ok |
| Preklic / potek | webhook expired :100–119 | `releaseStockReservation` −q per item | da (item) | ne | da (agregat) | enkrat (status→CANCELLED) |
| Ponovljeni webhook | status gate :100/:212 + :224 CAS | ne podvoji | — | — | da | PASS |
| Delni neuspeh | :940 rollback whole tx | — | — | — | — | — |

**Ključno (neposredno dokazano):**
1. **Online checkout je all-or-nothing glede rezervacije** — `reserveStock` napaka na KATKEM izdelku → `throw` → celotna
   transakcija rollback (naročilo NI ustvarjeno). **Zato delno rezervirano naročilo (Scenarij D) PREK TE POTI NI mogoče.**
2. **Ni trajne povezave rezero↔orderId**: `reservedQuantity` je per-product/variant; `reserveStock` NE ustvari
   order-linked vrstice. Edina povezava je POSREDNA (ob plačilu `convertReservationToSale` z `orderId` za OUT).
3. **Ni markerja, ki bi v podatkih razločil:** naročilo z uspešno rezervacijo / brez rezervacije / že sproščeno /
   direktno izdano. Diskriminator (PENDING+`reservedQuantity`) je dinamski, ne shranjen.

- **Razločevanja med štirimi vrstami naročil (§2 naloge) NI mogoče zgolj iz podatkovnega modela** — ni vrstice/markerja.
  → **NOT VERIFIED.**

## 3. Analiza scenarijev (§4)

**Scenarij A — naročilo brez rezervacije.** Če bi order A obstajal BREZ rezervacije (npr. napaka), `reservedQuantity`
ne bi vseboval jeho enot. Preklic A → kliče `releaseStockReservation` le, če obstaja call na order.items; vendar
`releaseStockReservation` zniža `reservedQuantity` za item qty **čeprav ni bil rezeriran** (guard je le `reserved≥q`).
→ Če je A = 4 (ni rez.) in B = 4 (rez.), preklic A bi `releaseStockReservation(4)` znižal `reservedQuantity` za 4,
čeprav teh 4 ne pripada A — **napačno sprostitev rezervacije B**. → **POTENCIALNA NAPAKA**; preprečena kl chemistry
Ker A prek online poti ne more obstati brez rezervacije (rollback), je ta scena @ online možen le ob legacy/ročnih
poteh. → **FAIL (teslajo riziko)** zaraadi manjkajoče per-order povezave.

**Scenarij B — rezervacija že sproščena.** Webhook expired sprosti −4 in takoj order→CANCELLED (:114–119, isti tx).
Status gate (≠PENDING) prepreči ponovno sprostitev. Novo naročilo +4 ne vpliva na staro. → **PASS** (status-gate).

**Scenarij C — neposredna izdaja brez rezero.** Prepaid: order→PAID + `applyOrderStockDecrement` (−4) v isti tx.
Poznejši recommit: `convertReservationToSale` (=4 reserved ne obstaja) → false → fallback `applyOrderStockDecrement`
bi znižal še enkrat? Ne — if/else + PAY-guard (:1216) prepreči ponovno obdelavo. → **PASS** (PAY-guard + if/else).

**Scenarij D — mešana rezero v isti naročili.** Online pot je all-or-nothing → **ni delne rezero** pri kreaciji
(rollback). A če bi legacy/rok, delna rezero obstajala: ni markerja → ni mogoče varno ločiti rezerviranega in
direktno izdanega dela. → **NOT VERIFIED / tvegano.**

**Scenarij E — več naročil + legacy agregat.** A(4)+B(3)+C(5), `reservedQuantity=6`. **NI mogoče dokazati, katerim
za katere naročilo pripada 6 enot**, ker ni per-order rezero vrstice. **Sorazmerna razdelitev bi bila izmišljanje.**
→ **NOT VERIFIED → BLOKADA** (per 2D-1O §4).

## 4. Varna migracijska strategija (§5)

| Možnost | Opis | Ocena |
|---|---|---|
| **A. Individualni prenos** | prenos le tam, kjer je povezava rezero↔naročilo↔količina **dokazljiva** | **primerno za prihodnost/nove** — zakaj legacy ni dokazljiv (ni vrstice). Za obstoječe: le če obstaja dokaz (Scenarij E ne) |
| **B. Skupni legacy bucket** | skupni začetni dogodek agregata | **nevaren**, če ga poznejši postopki ne morejo zanesljivo zmanjšati per-order; derezervationnega postopka brez attributiona → riziko napačne sprostitve (Scenarij A). **Ni varno** za produkcijo brez dodatne mechanism. |
| **C. Blokada nerazrešenih** | če povezava ni dokazljiva: ne pripisuj, ne sproščaj, ne izdaj; označi `migrationBlock`; varen ročni | **najvarnejša** za legacy, kjer atribucija ni možna |

**Priporočilo:** kombinacija — **A za dokazljive nove/znam vezane; C (blokada) za legacy** brez dokaza. **B (sam
skupni bucket brez per-order) se NE uporablja kot dokaz** za posamezno naročilo (ne izdaja/ne sprošča na podlagi
bucket-a), razen kot zgolj za agregatno uskladitev ob izrecnem označevanju kot »legacy, nerazrešeno«.

## 5. Zahteve za prihodnji model (§6)

Najmanjši model, ki daje polno sledljivost (brez dodajanja nepotrebnih, uporabimo kombinacijo):
- **`StockReservationEvent`** (RESERVE/ISSUE/RELEASE/EXPIRE) z **obveznim `orderItemId`/`orderId`** (+ `allocationId`,
  `batchRecordId`, `qty`, `idempotencyKey`, `sourceOfClaim`).
- **Rezervacija je bila izvedena ⇔ obstaja `StockReservationEvent RESERVE` z `orderItemId`** — to je **dokazljiva
  trajna povezava** rezero↔orderItem↔izdelek.
- **Izdaja iz rezervacije vs direktna:** izdaja se veže na `RESERVE` prek `ISSUE` (če je bil rezerviran) ALI naredi
  `OUT` brez `RESERVE` (direktna). **Neposredno ločenože s poljem** (`issueFromReservation` ali odsotnost RESERVE).
- **Razmerje dogodkov:** `RESERVE(orderItem) → ISSUE(→ StockMovement OUT)` / `RELEASE` / `EXPIRE`. Vse povezave, ki
  omogočajo rekonstrukcijo: `Σ ISSUE ≤ Σ RESERVE`, `RELEASE/EXPIRE` na isto `orderItem`.
- **Določi `OrderItemId` kot ključen del** — drugače ni dokaza, kateremu orderItem pripada rezervacija.

**Najmanjši model:** `StockReservationEvent` (append-only) + `StockAvailabilityEvent` + `StockMovement` z
`allocationId`/`returnOfMovementId`. `OrderItemBatchAllocation` poveže orderItem↔serijo. **[To je model 2D-1J], a z
obveznim `orderItemId`/`orderId` na RESERVE** (za prihodnost). **Priporočeno: kombinacija** (rezervacijski zapis +
append-only dogodki).

## 6. Invariante, ki jih mora rešitev zagotavljati (§7)

1. `OrderItem.quantity` NI dokaz rezervacije — **dokaz = obstoj `StockReservationEvent RESERVE(orderItemId)`**.
2. Sprostitev samo, če obstaja dokaz povezave (RESERVE orderItemId) — **dokaz**.
3. Rezervacija se izda le enkrat — `ΣISSUE ≤ ΣRESERVE` + idemKey.
4. Direktna izdaja (brez rez.) NE zmanjša rezervacijskega agregata — ločena `OUT` without `RESERVE`.
5. Sproščena/izdana rezervacija ni ponovno sproščena — `Σ(ISSUE+RELEASE+EXPIRE) ≤ RESERVE` + idemKey.
6. Delna rezervacija ločljiva od nerezerviranega dela — per `orderItemId` vsote.
7. Ponovljeni webhook — status-CAS + PAY-guard + idemKey.
8. Sočasne — row-lock + serializacija (RES+B≤S), ne samo txn.
9. **Legacy bucket brez individualne povezave NI dokaz rezervacije** — ne izdaja/sprošča se na bucket.
10. Korekcija sledljiva append-only.

Vse je dosegljivo s `StockReservationEvent(orderItemId)` modelom; **legacy brez povezave NI podprt za A/B samostojno.**

## 7. Končna primerjalna tabela (§8)

| Merilo | A. Individualni | B. Skupni bucket | C. Blokada |
|---|---|---|---|
| Dokazljivost | **DA** (le če povezava obstaja) | **NE** (brez per-order) | **DA** (nepravilnost blokirana) |
| Sledljivost po naročilu | DA | NE | (blokirano) |
| Varno sproščanje | DA | **NE** | DA (ne sprosti) |
| Varna izdaja | DA | NE | DA |
| Delne operacije | DA | NE | DA (z ročnim vnosom) |
| Sočasnost | (lock+serializ.) | tvegano | (lock+serializ.) |
| Tveganje dvojnega štetja | nizko | **visoko** (na bucket) | nizko |
| Primernost za produkcijo | **da (za dokazljive)** | **ne** | **da (varen)** |

**Priporočilo:** za legacy uporabi **A kjer je dokazljivo + C (blokada) kjer ni**; **B (samostojni bucket) se NE
sme uporabljati** kot vir za per-order sproščevanje/izdajanje (ri ztis zaradi napačne sprostitve — Scenarij A).

## 8. Zaključno poročilo (§9)

**Statusi:**
- Rezervacija/izdaja/release v kod: **EXISTING CODE PASS** (guard / status-CAS / if-else — vereciran).
- Prihodnja povezava rezero↔orderItem: **ARCHITECTURE PASS** (v 2D-1J model) — **ni v obstoječi kodi / shemi**.
- Dokazljivost legacy povezave: **NOT VERIFIED** (ni shranjene povezave; Scenarij E → BLOKADA).
- Scenarij A riziko: **FAIL-potencialni** (legacy brez povezave → napačna sprostitev možna, če bucket). 
- Scenarij B/C: PASS (status-gate / PAY-guard).
- Scenarij D: NOT VERIFIED za legacy; prihodnje per-item reši.
- Scenarij E: **NOT VERIFIED → BLOKADA** (ni mogoče razporediti).

**Končna odločitev:**

**NI PRIPRAVLJENO ZA ODBORITEV IMPLEMENTACIJE.**

Razlog (kritično): **ni mogoče dokazati povezave legacy rezervacij (agregat `reservedQuantity`) s posameznimi
naročili**(ni per-order rezero vrstice; `OrderItem.quantity` ni dokaz). Zato obstaja teoretična možnost, da sistem
sprosti/izda rezervacijo napačnega naročila (Scenarij A/E) — kar je po pravilih §9 razlog za NII PRIPRAVLJENO. 
**Ne predlagam samodejne razporeditve** (sorazmerno/ugibanje je prepovedano).

**Pogoji za odobritev** (mora biti izpolnjeno):
1. Prihodnji model določi **`StockReservationEvent` z obveznim `orderItemId`/`orderId`** (dokazljiva povezava).
2. **Legacy brez dokaza → `migrationBlock`** (ne prenaša se kot bucket, ki bi jih sproščal/izdajal).
3. Morebitni skupni agregat legacy je samo **slepa začetna bilanca** (noben per-order postopek se nanj ne naslanja),
   ali pa se **ročno razreši** pred migracijo.

## 9. Zaključek in varnostna potrditev (§10)
- **Pregledane datoteke:** `product-checkout.ts` (:91,:146,:166,:187,:208,:705,:932–943,:1216,:1257–1270),
  `api/webhooks/stripe/route.ts` (:100,:114–119,:212–214,:224–229), `lib/inventory/stock.ts` (:25,:52),
  `schema.prisma` (Product:1195, ProductVariant, StockMovementSource:2120), `tests/inventory/stock.test.ts`.
- **Dokazne lokacije:** zgoraj navedene; globalno iskanje `reservedQuantity` po actions/api/lib/scripts/prisma/tests.
- **Nedokazane predpostavke:** (a) PENDING ⇒ rezervirano (ni shranjenega markerja), (b) `reservedQuantity` zgodovinsko
  pravilno.
- **Preostala tveganja:** napačna sprostitev/izdaja legacy agregata brez per-order povezave; delne legacy rezero.
- **Spremenjena bila samo navedena dokumentacija:** da.
- **Ni spremenjena:** koda, shema, baza, testni podatki.
- **Ni Git operacij:** da.
- **Nedotaknjeno:** `einvoices.ts`, tuji WIP, `markec_dev`, produkcija.

**Ne implementiram ničesar. Ne začnem faze 2D-1A. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1P — TRANSAKCIJSKA POVEZLJIVOST REZERVACIJSKIH DOGODKOV IN ZAŠČITA LEGACY AGREGATA — read-only

> Dokončno določi: (1) minimalni `StockReservationEvent` model z vezavo na izvorni `RESERVE`, (2) matematično
> invariant `RESERVE ≥ ISSUE+RELEASE+EXPIRE`, (3) rešitve sočasnosti, (4) **kritično: zaščita obstoječih poti pred
> legacy agregatom in `migrationBlock`**. **Izključno dokument; nič kode/sheme/migracij/baze, brez Git operacij,
> `einvoices.ts` in tuji WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 0. Izhodišče (verificirano v 2D-1N/2D-1O)
- `reservedQuantity` (per product/variant) je **skupni agregat brez per-order atribucije**; samo 3 pisce
  (`reserveStock`:166, `releaseStockReservation`:187, `convertReservationToSale`:208).
- Ni trajne, dokazljive povezave legacy rezero↔order; `OrderItem.quantity` ni dokaz rezervacije.

---

## 1. Povezava rezervacijskih dogodkov (minimalni model)

### 1.1 Minimalni obvezni model `StockReservationEvent`
```prisma
model StockReservationEvent {
  id                  String   @id @default(cuid())        // ID dogodka
  organizationId      String                               // org-scope (varnost)
  orderId             String                               // OBVEZNO: atribucija na naročilo
  orderItemId         String                               // OBVEZNO: dokazljiva atr. na postavko (2D-1O)
  productId           String                               // izdelek
  variantId           String?                              // varianta, če obstaja
  reservationEventId  String?                              // povezava na izvorni RESERVE (ISSUE/RELEASE/EXPIRE/CORRECTION)
  quantity            Int                                  // količina dogodka (>0)
  eventType           ResEventType                         // RESERVE/ISSUE/RELEASE/EXPIRE/CORRECTION
  idempotencyKey      String                               // zaščita ponovitev (org-unique, obvezen)
  createdAt           DateTime @default(now())             // strežniški čas
  createdById         String?                              // izvajalec / sistemski proces
  @@unique([organizationId, idempotencyKey])               // org-unique, ne globalno (org izolacija)
  @@index([organizationId, orderItemId])
  @@index([organizationId, reservationEventId])
}
```
- `orderId` + `orderItemId` OBVEZNA za dokazljivo atribucijo (2D-1O).
- `reservationEventId` veže `ISSUE/RELEASE/EXPIRE/CORRECTION` na izvorni `RESERVE` (jedro dokazljive verige).
- `idempotencyKey` org-unique, nadomešča per-product `reservedQuantity` kot vir resnice.
- `createdById` za revizijo.

### 1.2 Kaj NE dodamo
- Nobena »correction«-tabela — `CORRECTION` je vrednost `eventType`.
- `OrderItemBatchAllocation`, `StockAvailabilityEvent` ostajata kot v 2D-1J.
- `StockMovement` dodatki (`allocationId`, `returnOfMovementId`) ostajajo.

---

## 2. Matematične invariante (§3)
```
RESERVE ≥ ISSUE + RELEASE + EXPIRE
ACTIVE = RESERVE − (ISSUE + RELEASE + EXPIRE) ≥ 0
```
1. ACTIVE nikoli negativen -> varovalka Σ ≤ RESERVE (na transakcijo).
2. vsota ne preseže izvornega RESERVE.
3. ISSUE na obstoječ RESERVE (FK reservationEventId).
4. RELEASE na obstoječ RESERVE.
5. isti del ne 2× (Σ + idemKey).
6. delni dogodki dovoljeni ≤ RESERVE.
7. korekcija: nov CORRECTION, ne UPDATE/DELETE.
8. neposredna izdaja ločena: `OUT` brez `reservationEventId`; ni `ISSUE`.

Več rezero za isti OrderItem: vsaka svoj `RESERVE`; ACTIVE per rezervacijo; ISSUE/RELEASE vezani na določeno — 
izdaja iz A ne vpliva na B.

---

## 3. Konkretni matematični testi (§4)
| Primer | Dogodki | ACTIVE | Izdano | Sproščeno | Rezultat |
|---|---|---|---|---|---|
| A | RESERVE 10, ISSUE 7, RELEASE 3 | 0 | 7 | 3 | ✓ |
| B | RESERVE 10, ISSUE 4, ISSUE 2, RELEASE 3 | 1 | 6 | 3 | ✓ |
| C | RESERVE 5, ISSUE 4, ISSUE 4 | po 1. ACTIVE=1; 2. >1 | — | — | zavrnjeno |
| D | RESERVE 5, RELEASE 5, webhook znova | 2. blokiran (ACTIVE=0) | — | 5 | zavrnjen; ACTIVE=0 |
| E | RESERVE A=4,B=6; ISSUE iz A=4; RELEASE iz B=3 | A=0,B=3 | 4(A) | 3(B) | A ne vpliva na B |
| F | naročilo br. rez.; direktna 5; ISSUE brez RESERVE | — | 5(direkt.) | — | direktna OK; ISSUE zavrnjen |

---

## 4. Idempotency in ponovitve (§5)
- Unika: `@@unique(org, idempotencyKey)` — org-scoped.
- Vez na tip: ključ mora odražati eventType+entity+qty.
- **Vsebinska validacija:** pri ponovnem ključu preveriti payload — isti ključ z drugo qty/orderItemId →
  `IDEMPOTENCY_CONFLICT` (nikoli tiho vrniti starega). Shraniti `payloadHash`.
- Webhook: determinističen ključ (`stripe:{sessionId}`) — isti webhook ne ustvari dveh različnih dogodkov.

---

## 5. Sočasne transakcije (§6)
ACTIVE=5; dva sočasna `ISSUE 4`:
- txn brez lock → FAIL (oba prebereta 5 → ACTIVE=−3).
- pogojni UPDATE → druga spremeni 0 → OK (CAS single-row).
- `SELECT FOR UPDATE` → serijsko, druga po lock vidi ACTIVE=1 → zavrnjen — OK.
- serijska izolacija → OK (težko).
- optimistično (version) → OK.
**Priporočilo:** `SELECT FOR UPDATE` na en agregatni row (ProductVariant/batch) v doslednem vrstnem redu +
pogojne preverbe; **deadlock-preprečitev: vedno agregat → RESERVE**; zakleni izvorni RESERVE + agregat.

---

## 6. KRITIČNO — zaščita obstoječih poti pred legacy agregatom (§7)

### 6.1 Pregled obstoječih poti
| Pot | Legacy agregat? | RESERVE? | orderItemId? | Pomotoma drug order? | Dvojna izd.? |
|---|---|---|---|---|---|
| `reserveStock` :166 | da (+=) | ne | ne | — | — |
| `releaseStockReservation` :187 | da (−=) | ne | ne | **DA** | — |
| `convertReservationToSale` :208 | da | ne | ne | riziko | if/else+guard |
| `applyOrderStockDecrement` :91 | da (stock−) | ne | ne | — | if/else |
| webhook expired :100–119 | da (release/item) | ne | ne | **DA** | status→CANCELLED |
| webhook paid :212/:224 | convert | ne | ne | riziko | status-CAS |
| `verifyProductOrder` :1216/:1257 | da | ne | ne | riziko | PAY-guard |
| prepaid/gift-card :642–721 | ne (direkt.) | — | — | — | direct |
| drugi (cart) | read-only | ne | ne | — | — |

### 6.2 `migrationBlock` mora zaščititi tudi obstoječe poti
Pri `migrationBlock` NIČ (stara/nova) ne sme samodejno sproščati legacy agregata, pretvarjati v prodajo,
pripisovati naročilu, izdajati kot rezervirano brez dokaza, ali zmanjševati agregat na podlagi `OrderItem.quantity`.
→ **Zahteva prihodnjo obvezno spremembo obstoječih funkcij** (block v `reserveStock`/`release`/`convert`/webhook).
— **NOT VERIFIED / prihodnja zahteva.**

### 6.3 Varno obnašanje
- nov checkout → prek `StockReservationEvent`; pri migrationBlock nikoli legacy agregat.
- PENDING legacy (ni link) → migrationBlock/rочно; ne per-order sproščanje.
- preklic/potek → ročno; ne sklepaj order-id.
- uspešno plačilo → če legacy link neznan → ne convert iz agregata.
- neposredna izdaja → `applyOrderStockDecrement` OK.
- ročna admin korekcija → dovoljena, CORRECTION append-only.

---

## 7. Migracijska strategija (§8)
| Razred | Opis | Prenos |
|---|---|---|
| A dokazljive | dokaz RESERVE↔order↔qty | individualni RESERVE z orderItemId |
| B nerazrešene | samo reservedQuantity | migrationBlock; agregat kot slepa bilanca; brez per-order |
| C neskladne/neg | agregat <. dogodki | blokada do ročne uskladitve |

Dod.: dvojni prenos → migrationId+idemKey; zamrznitev med migracijo → SELECT FOR UPDATE; aktivna naročila → ročno;
**stara koda med migracijo onemogočena/flag**; rollback → kopija+restore na testni.

---

## 8. Prihodnji podatkovni model (§9) — najmanjši, usklajen
`StockReservationEvent` (zgoraj) + `StockAvailabilityEvent` + `StockMovement`(dodatki) +
`OrderItemBatchAllocation` + `ProductionContribution`. Nobene nove tabele. Prihodnji dodatki: orderItemId/
reservationEventId, CORRECTION, payloadHash.

---

## 9. Končna tabela preverjanja (§10)
| Področje | Status | Dokaz | Preostalo tveganje |
|---|---|---|---|
| Povezava ISSUE → RESERVE | **ARCHITECTURE** | prihodnji model | legacy brez FN |
| Povezava RELEASE → RESERVE | **ARCHITECTURE** | prihodnji model | legacy release ne preverja |
| Več delnih dogodkov | **PARTIAL** | model omogoča | legacy mije dod. |
| Idempotency payload | **ARCHITECTURE** | treba payloadHash | ni v kodi |
| Sočasna izdaja | **ARCHITECTURE** | SELECT FOR UPDATE predlog | ni serij v kodi |
| Legacy migrationBlock | **PARTIAL** | označba, a ne zaščiti starih | stari pisce |
| Zaščita stare kode | **NOT VERIFIED** | funkcije ne prilag. | migr. med prihodom |
| Prepaid/gift-card | **EXISTING PASS** | :642–721 | — |
| Stripe webhook | **PASS** | :212/:224 | legacy riziko |
| Rollback | **PASS** | $transaction + CAS | — |
| Org-scoped izolacija | **PASS** | requirePermissionOrg | — |

---

## 10. Končna odločitev (§11)
**NI PRIPRAVLJENO ZA ODOBRITEV IMPLEMENTACIJE.**
1. Izdaja/sprostitev ni vezana na izvorni RESERVE v obstoječi kodi; `releaseStockReservation` :187 ne preverja
   per-order — lahko sprosti napačno naročilo.
2. Dvojna izdaja le if/else+status-CAS, ne strukturna vez.
3. `migrationBlock` ne ščiti vseh obstoječih poti.
4. Sočasne RES+B≤S zahtevajo SELECT FOR UPDATE+serializ., ni v kodi.
5. Legacy agregat lahko vpliva na napačno naročilo (dokazano).
6. Idempotency dopušča isti ključ z drugačnim payloadom.

---

## 11. Zaključna varnostna potrditev (§12)
- **Pregledane datoteke:** `product-checkout.ts` (:91,:146,:166,:187,:208,:642–721,:932–943,:1216,:1257–1270),
  `api/webhooks/stripe/route.ts` (:100,:114–119,:212–214,:224–229), `lib/inventory/stock.ts` (:25,:52),
  `schema.prisma` (Product:1195, ProductVariant, StockMovementSource:2120), `tests/inventory/stock.test.ts`.
- **Dokazane:** 3 pisce, status-CAS, if/else, PAY-guard, prepaid, release brez per-order.
- **Nedokazane:** PENDING⇒rezervirano; legacy `reservedQuantity` zgodovinsko pravilno.
- **Obvezne prihodnje spremembe kode:** vez ISSUE/RELEASE→RESERVE; migrationBlock blokira legacy; payloadHash;
  SELECT FOR UPDATE+order; flag stare funkcije za migracijo.
- **Spremenjena samo navedena dokumentacija:** da.
- **Koda/schema.prisma nespremenjena:** da.
- **Ni migracij/sprememb baze/testnih podatkov:** da.
- **Ni Git operacij:** da.
- **`einvoices.ts`, tuji WIP, `markec_dev`, produkcija nedotaknjeni:** da.

**Ne implementiram ničesar. Ne začnem faze 2D-1A. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1Q — KONČNA USKLADITEV KOREKCIJ, FIZIČNIH GIBANJ, IDEMPOTENCY, ZAKLEPANJA IN LEGACY ZALOGE — read-only

> Dokončna uskladitev: korekcije rezervacij (matematična semantika), povezava `ISSUE↔StockMovement`, polna
> specifikacija idempotency, sočasnost več izdelkov, obravnava nerazrešenega legacy agregata, zaščita vseh
> obstoječih poti, končni podatkovni model, integrirani test. **Samo dokument; nič kode/sheme/migracij, brez Git
> operacij; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 0. Preverjena stanja (working tree) in novi zaključki
- Novi zaključek iz pregleda: **poleg znanih treh piscev `reservedQuantity` obstaja tudi pisec `stockQuantity` v
  `src/app/actions/catalog.ts:180–182` (`updateProductVariant`) — nastavi ABSOLUTNO `stockQuantity` z običajnim
  `update`, brez StockMovement, brez transakcije.** To je **obstoječa vrzel**: admin catalog lahko desinke ledg.
  (žE pri kodi za 2D-1Q; zabeleženo ločeno od prejšnjih vrst števil.) Enako `createProductVariant` :128.
- Potrjeni pisce `stockQuantity`: `applyOrderStockDecrement` :91/:99-100/:118-119, `convertReservationToSale` :208,
  `createStockMovement` :168/:173 (ink txn), `recordDelivery` :448/:453, `submitStockTake` :549, `catalog.ts` :128/:180.
- Potrjeni pisce `reservedQuantity` (edini): :175/:194/:219 (checkout).

---

## 1. Korekcija rezervacije — matematična semantika in izbira

### 1.1 Dve možnosti
- **A — CORRECTION kot samostojen dogodek** (predznačena količina ±): 
  - prednost: enostavno; 
  - **tveganje:** korigirajoč over-issue (−ISSUE) bi predstavljal, da je zaloga prišla nazaj, čeprav fizično
    vračilo ni; korekcija ni vezana na izvorni dogodek → revizijsko šibka; lahko nevedoč ustvari negativen ACTIVE.
- **B — CORRECTION kot sklic na nasprotni dogodek** (referenca `correctsEventId` na dogodek, ki ga popravlja, +
  učinek):
  - prednost: sledljiva veriga, korekcija ne more obstoja-ustvariti fizične zaloge brez nasprotnega fizičnega
    IN; nastavi `ACTIVE≥0`.
- **Izbira: B (varnejša).**

### 1.2 Model CORRECTION (B)
```prisma
// v StockReservationEvent dodano:
//   eventType=CORRECTION
//   correctsEventId String?          // sklic na originalni RESERVE/ISSUE/RELEASE/EXPIRE, ni brisanja
//   reason String                     // obvezen razlog (validator + revizija)
//   (quantity = INKREMENT/DEKREMENT aktivne rezervacije, pr sun tek)
```
Korekcija **nikoli** ne spreminja/brišeh originalnega; vpiše se **nov** dogodek z `correctsEventId` in
`idempotencyKey`. `ACTIVE` se preračuna kot `RESERVE − Σ(ISSUE+RELEASE+EXPIRE) + Σ CORRECTION(učinek)`.

### 1.3 Pravila (§2 naloge)
1. zgodovinski dogodek se ne spreminja/briše — DA (nov CORRECTION).
2. korekcija ima `reason` + `createdById` — revizija.
3. korekcija ne sme ustvariti negativnega ACTIVE (varovalka `ACTIVE≥0`).
4. **korekcija izdaje NE sme samodejno vrniti fizične zaloge** — če se `ISSUE` popravlja navzven, mora paralelno
   obstajati `StockMovement IN RETURN` (fizično vračilo); sicer gre za **izgubo prodajnega** (`OUT_loss_sellable`),
   ne korekcijo.
5. korekcija povezana na izvirni dogodek (`correctsEventId`).
6. korekcija idempotentna (`idemKey`).
7. **razlikuj računovodsko korekcijo** (vpliv na `RES/S`, brez fizičnega premika) **od fizičnega premika**
   (`StockMovement IN/OUT`).

### 1.4 Primeri
- **Prava (z fizičnim vračilom):** RESERVE 10, ISSUE 4 (OUT 4) → ACTIVE 6. Napaka: moralo biti ISSUE 3,
  enota fizično vrnjena. → CORRECTION(ISSUE −1, correctsEventId=ISSUE_a4, reason="over-issue"), + StockMovement
  IN RETURN 1. ACTIVE = 10 − (4−1) = 7; issued=3; P se vrne za 1. ✓
- **Brez fizičnega vračila (izguba):** enota izgubljena → **ne** CORRECTION; `OUT_loss_sellable` (S−, P−). 
  **Nobena korekcija ne ustvari zaloge brez fizičnega IN.**
- **Prikaz napake pri RESERVE (še ne izdan):** RESERVE 4, a pravilno 3 → CORRECTION(−1, corrects→RESERVE).
  ACTIVE = 4−1 = 3 (≥0). ✓ brez fizičnega premika (računovodska).

---

## 2. Povezava `ISSUE ↔ StockMovement` (kritično)

### 2.1 Izbira: **enostranski link `StockMovement.reservationEventId String?`**
- Na fizičnem `StockMovement OUT` dodamo `reservationEventId` (sklic na `StockReservationEvent ISSUE`, ki ga
  izpolnjuje). (Alternativa `StockReservationEvent.stockMovementId` je prav tako možna; izberemo rezervo na
  StockMovement, ker je ledger že imel `allocationId` in novo lažje.)
- **Neposredna izdaja:** `reservationEventId=NULL` + `source=ORDER` (REVIZ. dokaz neposrednosti).

### 2.2 Dokazljivost (zahteve)
1. en `ISSUE` → natanko en `OUT`: v isti transakciji `ISSUE` zniža ACTIVE in `OUT` (z `reservationEventId`) se
   zapiše; 1:1.
2. isti `OUT` ne more biti povezan z dvema različnima ISSUE: en `reservationEventId` na OUT.
3. fizični OUT ne nastane brez ustreznega postopka (ISSUE ali direktna `source=ORDER` — po enem od teh).
4. rezervacijski event ne potrjen brez fizičnega gibanja: `ISSUE` in `OUT` v isti txn ali s preverbo, da OUT obstaja.
5. rollback razveljavi oba.
6. ponovitev (ist idemKey) ne ustvari novega OUT (idemKey + 1:1).
7. neposredna izdaja ločena (`reservationEventId=NULL`).

### 2.3 Obvezni scenariji (§3)
| Sc | Rezultat |
|---|---|
| A uspešna izdaja | RESERVE 10 → ISSUE 4 → OUT 4 (reservationEventId=ISSUE), ACTIVE 6 ✓ |
| B OUT uspe, ISSUE ne | **rollback obeh** (ena txn; če ISSUE pade, OUT se ne zapiše) |
| C ISSUE uspe, OUT ne | **rollback obeh** (ena txn) |
| D ponovljena izdaja | ist idemKey → `DUPLICATE`, bez novega OUT |
| E neposredna izdaja | OUT 4, `reservationEventId=NULL`, `source=ORDER`, brez lažnega ISSUE |
| F vračilo | `StockMovement IN RETURN` (ločen fizični premik); **ne spreminja** zgodovinskega ISSUE; veže prek
  `allocationId`/`returnOfMovementId`; vračilo ne vpliva na ISSUE-ACTIVE (rezervacija se ne vrne ipso facto) |

---

## 3. Idempotency — končna specifikacija (§4)
- **Hash iz kanonično normaliziranega payload-a** (stabilen JSON; sortiranje ključev, brez `createdAt`).
- **Vključena polja:** `organizationId, eventType, orderId, orderItemId, reservationEventId, productId,
  variantId, quantity, source` + payload fizičnega premika (OUT/IN podatki) + poslovni dodatek (`reason` itd.).
- **Časovni žigi NE v hash** (niso vsebina).
- **`null`:** normalizacija — `variantId:null` → izpuščeno (po dogovoru), da je stabilno.
- **Isti ključ + isti payload =** varna ponovitev → vrnjen stari rezultat.
- **Isti ključ + drug payload =** `IDEMPOTENCY_CONFLICT`.
- **Vzporedne zahteve:** uniq baza (`@@unique(org,idempotencyKey)`) + `ON CONFLICT DO NOTHING` + preverba; uspe
  le en.
- **Stripe webhook:** determinističen ključ `webhook:{sessionId}:type` (loči `expired`/`paid`). Ponovljen isti
  webhook → ist ključ → ni novega.
- **Različni tipi iste seje:** `checkout.session.completed`, `.expired` imajo različne `sessionId:type` → ne
  trčijo.
- **Preprečiti, da isti webhook z različnima ključema ustvari dva poslovna dogodka:** potrebna je tudi
  **poslovna unikatnost** (npr. `UNIQUE(orderId, eventType)` na rezervacijskem/movement zapisu) — **ne zanašaj
  se le na idemKey.**

**Zelo pomembno:** ne zanašaj le na `idempotencyKey`; dopolnimo s poslovnimi unikatnimi omejitvami in vezjo na
izvorni dogodek (`reservationEventId`, `correctsEventId`, enoten `orderId+eventType`).

---

## 4. Sočasnost — več izdelkov in variant (§5)
- **Primarni vir zaklepanja:** **vrstica agregatne zaloge** = `ProductVariant` (ali `Product`, če brez variante)
  — ali `ProductionBatch`/`batch` za serijsko zalogo. **Zaklepanje po agregatni vrstici** (single row).
- **Brez variante:** lock na `Product` row; **z varianto:** lock na `ProductVariant` row.
- **Izvorni RESERVE:** po redkuod agregata zaklenemo `RESERVE` (ko je izdrano).
- **Več batch alloc:** zaklepanje **vesch `StockReservationEvent`/`BatchAllocation` tega order-item-a** po
  `reservationEventId`.
- **Enoten vrstni red:** **vedno najprej agregatni row, nato vse po relacijah** (npr. po `reservationEventId`
  naraščajoče) — prepreči deadlock ABBA (X,Y vs Y,X naprimer: order#2 X→Y, order#3 Y→X bi zaklenila v različnem
  redosledu → deadlock; z enotnim vrstnim redom po `orderItemId`/`reservationEventId` rešimo).
- **Deadlock:** DB zazna (`prisma` → `P2034`); **dovoljen varen ponovni poskus transakcije** z preverbo, da
  ponovitev ne podvoji (idemKey/vez).
- **Primerjava:**
  | Način | Večizdelkov? | Ocena |
  |---|---|---|
  | SELECT FOR UPDATE (agregatni row) | ✓ (per row, enoten red) | **izbrano** |
  | pogojni UPDATE | le single-row | delno |
  | optimistično | ✓ (version), bank rollback | možno |
  | serijska izolacija | ✓, a težko | ni primerno |
- **Izbira: `SELECT FOR UPDATE` na agregatni vrstici** (per product/variant/batch) s **doslednim vrstnim redom**
  in **idempotentnim ponovnim poskusom ob P2034**. Za MARKEC primerno (zaloga je per izdelek; multi-item redški,
  a pokrit z dogovorjenim vrstnim redom).

---

## 5. KRITIČNO — nerazrešeni legacy in varno poslovanje (§6)

### 5.1 Formula
```
A = S − RES_documented − RES_legacy_unknown          (RES_total = RES_documented + RES_legacy_unknown)
RES_legacy_unknown prikazan LOČENO (ni pripisan naročilom).
P_wh = S+B+D ; P_owned = P_wh + Rep ; A = S − RES_total
```
- Nerazrešeni legacy **MORA biti odštet od razpoložljive prodajne zaloge** (ne mora fizikalno storiti, a mora
  blokirati prosto prodajo NUI, ker te enote so lahko obljubljene). 
- **Prikaz:** `RES_LEGACY_UNKNOWN` kot ločena vrstica (revizijsko).
- **Nove rezervacije:** dovoljene do `A` (torej ne na legacy del).
- **Neposredna prodaja:** dovoljena do `A`, **ne** na legacy del (`reservationEventId=NULL` OUT zahteva
  `qty ≤ A`).
- **Preprečiti, da neposredna izdaja porabi legacy:** del z `RES_legacy` je izvzet iz `A` → OUT na ta del bi bil
  `NEGATIVE_AVAILABLE`.
- **Preklic starega PENDING:** če legacy ni vezan na naročilo → **ročno** (ne samodejno sproščanje, ker ne vemo
  koliko); zmanjša `RES_legacy` le ob ročni uskladitvi.
- **Uspešno plačilo starega naročila:** ročno pregled; kadar je legacy del, preverimo atribucijo; brez je → ne
  pretvarjaj samodejno.
- **Ročna uskladitev:** administrator določi dejansko pripadnost (ali odpiše); zapiše `CORRECTION` (razumni razlog,
  revizija) — **brez izmišljanja zgodovine.**

### 5.2 Konkretni scenarij (fiz. 20, legacy 6, dokazanih novih 3)
```
S=20, D=B=Rep=0, RES_doc=3, RES_legacy=6, RES_total=9, A = 20 − 9 = 11.
- Razpoložljiva za prodajo = 11 (ne 20−6=14, ne 20−3=17). 
- Nove rezervacije: dovoljene do 11 (ne v legacy del).
- Neposredna izdaja: dovoljena do 11 (ne more porabiti legacy 6).
- Po ročni uskladitvi (npr. 3 od 6 pripisanih, 3 odpisani): RES_legacy → 0, S → 17 (3 pripisanih izdanih/spor).
  Nato A = S − RES_doc − 0.
```
**Če varno poslovanje brez ročne uskladitve ni mogoče:** delno je mogoče — **zamrznemo 6 kot RES_legacy
(izvzeto iz A), dovolimo novo poslovanje na preostalih 11**. Popolna (razpoložljivost 14) pa zahteva ročno
uskladitev 6. Torej: **lahko poslujemo, a z zmanjšano razpoložljivostjo, dokler ne uskladimo legacy 6.** To je
varnot in izrecno zapisano.

---

## 6. Zaščita vseh obstoječih funkcij (§7)

### 6.1 Tabela (vključno s ponovno preverjeno celo kodo)
| Funkcija | Up. legacy stanje | Preveri migrationBlock? | Preveri RESERVE pripadnost? | Varna ob migrationBlock? |
|---|---|---|---|---|
| `reserveStock` :166 | `reservedQuantity +=` | ne | ne | **ne** (bi povečal legacy) |
| `releaseStockReservation` :187 | `−=` | ne | ne | **ne** (lahko sprosti napač) |
| `convertReservationToSale` :208 | `stock−`,`reserved−` | ne | ne | ne |
| `applyOrderStockDecrement` :91 | `stock−` | ne | ne | ne (če na legacy del) |
| webhook expired :100–119 | release/item | ne | ne | ne |
| webhook paid :212–229 | convert | ne | ne | ne |
| `verifyProductOrder` :1216/:1257 | da | ne | ne | ne |
| prepaid/gift-card :642–721 | direktna | ne | — | ne (direkten, a ne rezero) |
| **`catalog.updateProductVariant` :148–185** | **piše `stockQuantity` abs., brez ledger** | ne | — | **ne** (direktna, brez txn) |
| `createStockMovement` :81 | stock± (ledger) | ne | ne | ne (odvisno) |
| `recordDelivery` :371 | IN | ne | — | — |
| `submitStockTake` :513 | delta | ne | — | — |

Vse **EXISTING**; NOBEN od njih ne preverja `migrationBlock` / pripadnost RESERVE.

### 6.2 Prihodnje obvezno vedenje (block-pointi)
- **nov checkout:** prek `StockReservationEvent`; pri migrationBlock ne legacy.
- **obstoječe PENDING (legacy):** migrationBlock → ročno.
- **preklic / potek:** če legacy → ročno; nikoli samodejno sproščanje na podlagi `OrderItem.quantity`.
- **uspešno plačilo:** če legacy neznano → pregled, ne convert.
- **neposredna izdaja:** `applyOrderStockDecrement` mora ob migrationBlock/legacy → zavrniti OUT, ki bi zadel legacy.
- **ročna admin korekcija:** CORRECTION + revizija (ne UPDATE).
**Block-točke:** `reserveStock`/`releaseStockReservation`/`convertReservationToSale`/`applyOrderStockDecrement`/
webhook `expired`/`paid` — vsi morajo **v zgodnji fazi** (pred spremembo) preveriti migrationBlock; sicer zavrnejo.

---

## 7. Usklajen končni podatkovni model (§8)
| Model | Odgovornost | Obvezna polja | Relacije | Unikat | Indeksi | Append-only | Org | Trans. |
|---|---|---|---|---|---|---|---|---|
| `StockReservationEvent` | rezervacije | id, org, orderId, orderItemId, productId, variantId?, reservationEventId?, correctsEventId?, type, quantity, reason?, idempotencyKey, createdById | OrderItem, ExtensionRecord(batch) | `@@unique(org,idemKey)`; `@@unique(org,orderId,eventType)` (msg. proznivel.) | org/orderItem/reservationEvent | DA | yes | ena (RESERVE/ISSUE/RELEASE/EXPIRE/CORRECTION, z lock) |
| `StockAvailabilityEvent` | umik/aktivacija | id, org, batchId?, variantId?, type, qty, reason, idemKey | product/variant | `@@unique(org,idemKey)` | org/batch | DA | yes | ena |
| `StockMovement` (+ `reservationEventId?`, `allocationId`, `returnOfMovementId`, `reason?`) | fizični ledger | id, org, productId, variantId?, direction, qty, source, +navedena | Product/Variant, Order, ExtRec | (idemKey org-unique za OUTPUT) | org,product,createdAt | DA | yes | ena |
| `OrderItemBatchAllocation` | orderItem↔serija | id, org, orderItemId, batchRecordId, qty | OrderItem, batch | `@@unique(org,orderItem,batch)` | org,batch,orderItem | status izračunan | yes | ena |
| `ProductionContribution` | vir→serija | id, org, batchRecordId, sourceRecordId, input/net/loss | ExtRec | — | org,batch,source | DA | yes | ena |

- **Odvečno/neskladno polje?** `eventType` v predlaganih prejšnjih (2D-1J) `StockReservationEvent` je bilo
  `type`; **usklajeno na `eventType`** (konsistentno z 2D-1P/2D-1Q). Nobeno polje ni odvečno: `reason`/`correctsEventId`/
  `reservationEventId` so nujni za korekcijo/sledljivost.
- `organizationId` na vsakem — org-scope.

---

## 8. Celovit integrirani test (§9)

**Predpostavke (izrecno):** en produkt X (z variantami X-A, X-B se obravnava identično; tu prikažemo X-A).
Začetek: `P_wh=20, S=20, D=B=Rep=W=0`, legacy `RES_legacy=6`, `RES_doc` začne 0.

| # | Dogodek | P_wh | S | D | W | RES_doc | RES_leg | RES_tot | A=S−RES | I | R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | začetek | 20 | 20 | 0 | 0 | 0 | 6 | 6 | 14 | 0 | 0 |
| 1 | RESERVE 3 (order#1, doc) | 20 | 20 | 0 | 0 | 3 | 6 | 9 | 11 | 0 | 0 |
| 2 | order#2 RESERVE 4 (X-A) | 20 | 20 | 0 | 0 | 7 | 6 | 13 | 7 | 0 | 0 |
| 3 | CORRECTION −1 (order#2 RESERVE 4→3; corrects, razlog) | 20 | 20 | 0 | 0 | 6 | 6 | 12 | 8 | 0 | 0 |
| 4 | order#2 ISSUE 3 + OUT 3 | 17 | 17 | 0 | 0 | 3 | 6 | 9 | 8 | 3 | 0 |
| 5 | order#3 RESERVE 2 | 17 | 17 | 0 | 0 | 5 | 6 | 11 | 6 | 3 | 0 |
| 6 | order#3 ISSUE 2 + OUT 2 | 15 | 15 | 0 | 0 | 3 | 6 | 9 | 6 | 5 | 0 |
| 7 | order#1 partial ISSUE 1 + OUT 1 | 14 | 14 | 0 | 0 | 2 | 6 | 8 | 6 | 6 | 0 |
| 8 | order#1 partial RELEASE 2 | 14 | 14 | 0 | 0 | 0 | 6 | 6 | 8 | 6 | 0 |
| 9 | neposredna izdaja 3 (order#4, reservationEventId=NULL) | 11 | 11 | 0 | 0 | 0 | 6 | 6 | 5 | 9 | 0 |
| 10 | RETURN sellable 1 (order#2) | 12 | 12 | 0 | 0 | 0 | 6 | 6 | 6 | 9 | 1 |
| 11 | RETURN damaged 1 (order#3) | 13 | 12 | 1 | 0 | 0 | 6 | 6 | 6 | 9 | 2 |
| 12 | odpis damaged 1 (OUT STOCKTAKE reason=WRITE_OFF) | 12 | 12 | 0 | 1 | 0 | 6 | 6 | 6 | 9 | 2 |
| 13 | ponovljen webhook (paid order#2) | — sprememb ni (CAS+idemKey) |
| 14 | neuspela tx (poskus direktne izdaje A=6+ → rollback) | stanje ostane kot #12 |

**Preverbe:**
- Konservacija: 20 = 12(P_wh) + 7(prodano neto: I9−R2) + 1(W) = 20 ✓. Nič izgubljeno, nič 2×.
- `A=S−RES≥0`: v vsakem koraku (14,11,8,6,5,6,8,5,6,6,6) ✓.
- `RES_legacy=6` ves čas izvzeto iz A (zaklenjeno za prodajo) ✓.
- Neposredna izdaja (#9) na A=8→bes 3 ≤ A ✓ (ne na legacy).
- Rollback (#14) ohrani stanje.

---

## 9. Končna primerjalna tabela (§10)
| Področje | Končna rešitev | Dokaz iz kode | Status | Preostalo tveganje |
|---|---|---|---|---|
| Korekcije rezervacij | CORRECTION (sklic B), append-only, `correctsEventId` | ni v kodi | **ARCHITECTURE** | implementacija |
| ISSUE → RESERVE | `reservationEventId` na ISSUE | ni v kodi | **ARCHITECTURE** | legacy brez f-nje |
| ISSUE → StockMovement | `StockMovement.reservationEventId?` | ni v kodi | **ARCHITECTURE** | — |
| Vračilo | IN RETURN, ne spreminja ISSUE | enum RETURN :2126 | **PARTIAL** | ni akcije s per-order linkom |
| Idempotency | kanonični hash + org-unique + poslovna uniq | ni (samo checklist prej) | **ARCHITECTURE** | — |
| Stripe webhook | status-CAS + PAY-guard | :212/:224/:1216 | **EXISTING PASS** | legacy convert |
| Sočasnost več izdelkov | SELECT FOR UPDATE agregat, enoten red, retry ob P2034 | ni v kodi | **ARCHITECTURE** | — |
| Legacy unknown | RES_legacy izvzet iz A, ločen prikaz | ni | **ARCHITECTURE** | ročna uskladitev |
| Neposredna izdaja | `reservationEventId=NULL`, qty≤A | :91 | **EXISTING (l. ag.)** | mora spoštovati A/legacy |
| migrationBlock | blokira vse obstoječe poti | **ni implementirano** | **NOT VERIFIED** | kritično |
| Org-scoped izolacija | requirePermissionOrg | več vrstic | **EXISTING PASS** | — |
| Rollback | ena $transaction, CAS | več | **EXISTING PASS** | multi-row RES+B≤S |

---

## 10. Končna odločitev (§11)

**NI PRIPRAVLJENO ZA ODBORITEV IMPLEMENTACIJE.**

Vseh devet pogojev iz §11 ni izpolnjeno v obstoječi kodi:
1. rezervacijski dogodek NI povezan na izvorni RESERVE v obstoječi kodi (ni `reservationEventId`/`orderItemId`);
2. ISSUE NI povezan s fizičnim OUT v obstoječi kodi;
3. korekcija ni implementirana (pravila so arh. predlog);
4. idempotency štrité (ni payload-hash, ni poslovnega uniq);
5. sočasne RES+B≤S zahtevajo SELECT FOR UPDATE/n-tangle — ni sedaj;
6. neposredna izdaja (in `catalog.updateProductVariant` :180) lahko zadosleti legacy — ni omejena na A/legacy;
7. `migrationBlock` NE ščiti vseh starih funkcij (releaseStockReservation :187 itd. samodejno legacy);
8. rollback v multi-row (RES+B≤S) ni dokazano;
9. org izolacija EXISTING PASS, a za nove modele arh. — za obstoječo je PASS.

Ker ni **nobenega** od ključnih ARCHITECTURE garancij implementiranega v obstoječi kodi (in je vsaj ena točka
vsak: legacy izdaja / migrationBlock), odločba je **NI PRIPRAVLJENO** — **Faza 2D-1A ni odobrujena za
implementacijo**, dokler se zgoraj (mapirano v §12) ne implementira in testira.

---

## 11. Zaključna varnostna potrditev (§12)
1. **Pregledane datoteke in lokacije:** `product-checkout.ts` (:91,:146,:166,:187,:208,:642–721,:932–943,:1216,:1257–1270),
   `api/webhooks/stripe/route.ts` (:100,:114–119,:212–214,:224–229), `lib/inventory/stock.ts` (:25,:52),
   **`src/app/actions/catalog.ts` (:128,:148–185 — NOVI ugotovljen pisec `stockQuantity`)**, `src/app/actions/inventory.ts`
   (:81,:168,:173,:371,:448,:453,:513,:549), `schema.prisma` (Product:1195, ProductVariant, StockMovementSource:2120),
   `tests/inventory/stock.test.ts`.
2. **Dejansko dokazane:** 3 pisce rezero, več piscev stockQuantity (checkout/inventory/catalog), status-CAS, if/else,
   PAY-guard, prepaid brez rezero, `releaseStockReservation` brez per-order, `catalog` abs. zapis brez ledger.
3. **Nedokazane predpostavke:** PENDING⇒rezervirano; legacy `reservedQuantity` zgodovinsko pravilno; reserveracija
   pripadnost.
4. **Obvezne prihodnje spremembe kode:** (a) `StockReservationEvent` z `orderItemId`+`reservationEventId`+
   `correctsEventId`+CORRECTION; (b) `StockMovement.reservationEventId`; (c) bloc migrationBlock v vseh starih
   funkcijah; (d) SELECT FOR UPDATE + enoten lock red; (e) payload-hash + poslovne uniq; (f) `catalog.updateProductVariant`
   naj pisanje stockQuantity prenese v ledger/legacy logiko (ni samostojni abs. set brez sledi); (g) RES_legacy
   izvzet iz A.
5. **Spremenjena samo navedena dokumentacija:** da.
6. **Koda in `schema.prisma` nista spremenjena:** da.
7. **Ni migracij/sprememb baze/testnih podatkov:** da.
8. **Ni Git operacij:** da.
9. **`einvoices.ts`, tuji WIP, `markec_dev`, produkcija nedotaknjeni:** da.

**Ne implementiram ničesar. Ne začnem faze 2D-1A. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1R — KONČNA INVENTURA VSEH ZAPISOVALCEV ZALOGE IN PREVERJANJE CELOVITOSTI — read-only

> Popoln in dokazljiv zemljevid vseh mest, ki spreminjajo `Product.stockQuantity`/`reservedQuantity`,
> `ProductVariant.stockQuantity`/`reservedQuantity`, fizično zalogo in sorodne količine, z razvrstijo tveganj,
> preverjanjem enotnosti ledg. in vstopnih poti. **Samo dokument; nič kode/sheme/migracij; Git operacij nobenih;
> `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 1. Obseg iskanja (preverjeno)
- Celoten `src/**` (`src/app/actions/**`, `src/lib/**`, `src/app/api/**`), `scripts/**`, `prisma/**`,
  `tests/**` (helperji) — iskanje `stockQuantity`, `reservedQuantity`, `stockMovement`, `update/updateMany/
  upsert/increment/decrement/create/delete`, `executeRaw`, JSON quantity fields.
- **Preverjena dejstva (2D-1R):** vsi `stockMovement.create` v `src/app/actions` so na 5 mest (inventory.ts:178/
  :457/:551, product-checkout.ts:105/:124/:226). `$executeRawUnsafe` v scripts je večinoma DB-create/verify
  (ne stock). **Ta inventura je širša od 2D-1Q — poleg znanih piscev najde tudi scripts/seed pisce.**
- Tuj WIP: `schema.prisma` in `einvoices.ts` nedotaknjena.

---

## 2. Tabela vseh zapisovalcev

| ID | Datoteka: vrstice | Funkcija | Model | Polje | Vrsta spremembe | Klicatelji | Txn | StockMovement | Org-scope | Idem pot. | migrationBlock |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W1 | product-checkout.ts:91,99–100,105,118–119,124 | `applyOrderStockDecrement` | Product/Variant | stockQuantity | DECREMENT | checkout/paid & prepaid | txn | **DA** (105/124) | YES | guard(count) | NO |
| W2 | product-checkout.ts:208,218–220,226 | `convertReservationToSale` | Product/Variant | stockQuantity,reserved | ISSUE | verifyProductOrder | txn | **DA** (226) | YES | guard | NO |
| W3 | product-checkout.ts:166,174–177,175 | `reserveStock` | Product/Variant | reservedQuantity | RESERVE | checkout-hold | txn | NE (by design) | YES | AVAIL-guard | NO |
| W4 | product-checkout.ts:187,193–195 | `releaseStockReservation` | Product/Variant | reservedQuantity | RELEASE | webhook expired | txn | NE (by design) | YES | guard(reserved≥q) | **NO** |
| W5 | inventory.ts:81,168,173,178 | `createStockMovement` | Product/Variant | stockQuantity | IN/OUT (general) | admin/mov. | **DA** | **DA** (178) | YES | NEGATIVE | NO |
| W6 | inventory.ts:371,448,453,457 | `recordDelivery` | Product/Variant | stockQuantity | IN (RECEIVE) | admin/delivery | **DA** | **DA** (457) | YES | delta | NO |
| W7 | inventory.ts:513,536,549,551 | `submitStockTake` | Product/Variant | stockQuantity | STOCKTAKE | admin | **DA** | **DA** (551) | YES | prech | NO |
| W8 | catalog.ts:128 | `createProductVariant` | ProductVariant | stockQuantity | ABSOLUTE_SET (on create) | admin | NO | **NO** | YES | — | NO |
| W9 | catalog.ts:148–185, :180–181 | `updateProductVariant` | ProductVariant | stockQuantity | **ABSOLUTE_SET** | admin | **NO** | **NO** | YES | NO | **NO** |
| W10 | scripts/_f5511-race-probe.ts:5,12,15 | race-probe | Product | stockQuantity | ABS/INCR-DECR | mant/stest | NO | NO | NO | NO | NO |
| W11 | scripts/_f5511-mig-setup.ts:14–15; f553-seed.cjs:77; f552-seed.cjs:98; repro-p80-queries.ts:17,28 | seed/repro | Product | stockQuantity | ABSOLUTE_SET | mant | NO | NO | NO | NO | NO |
| W12 | src/lib/verticals.ts:887–892, :386 | demo registry | Product | stockQuantity | ABSOLUTE_SET (seed) | seed | NO | NO | NO | NO | NO |
| W13 | records.ts (harvest/batch JSON) | records CRUD | ExtensionRecord data.quantity_kg | **ni Product.stock** | OTHER (proiz. vhod) | UI/records | (txn) | NO | YES | — | NO |

`public-site.ts:407` in `lib/inventory/low-stock.ts` = **bralci** (no writer); `cart.ts:70` bralec.

---

## 3. Posebna analiza `catalog.updateProductVariant` (W9)
1. **Sprejema absolutno količino?** DA (`input.stockQuantity` :144, `data:{stockQuantity}` :180–181).
2. **Lahko prepiše obstoječo?** **DA** (absolutno).
3. **Transakcija?** **NE** (:171 navaden update).
4. **StockMovement?** **NE**.
5. **organizationId?** DA (:153–155).
6. **Pravice?** DA (`requirePermissionOrg("products.manage")` :151).
7. **Upošteva reservedQuantity?** **NE**.
8. **Lahko < reserved?** **DA**.
9. **Obide migrationBlock?** **DA**.
10. **Drugi klicatelji bez UI?** možen admin/import — **NOT VERIFIED**.

**Primer desynk:** admin nastavi `stockQuantity=5` brez giba; pred tem `IN PRODUCTION 10` (=ledger). Rezultat:
fizična (=5) ≠ ledger (=10). Rekonstrukcija iz ledg. = 10, ne 5 → **neskladje.** (Tipičen P0.)

---

## 4. Razvrstitev tveganja
| ID | Risk | Dokaz | Scenarij | Posledica | Prihodnja zaščita |
|---|---|---|---|---|---|
| W9 | **P0** | :180–181 abs.set, brez ledger/txn | admin set | desynk; migrationBlock obid | catalog skozi ledger/migrationBlock |
| W4 | **P0** | :193–195 release brez per-order | legacy spill | nap. sprostitev | RELEASE→RESERVE + migrationBlock |
| W10–W12 | **P1** | scripts/seed direct | maintenance | nepop. zgodovina | scripts/test-data |
| W1/W2 | **P1** | decrement brez RESERVE vez | legacy mešica | nap. convert | ISSUE→RESERVE + block |
| W3 | **P1** | reserve+= agr. | legacy | nap. RES | StockReservationEvent |
| W5–W7 | **P2** | ledger v txn | — | — | — |
| W8 | **P2** | create set brez ledger | init | vrzel | init prek ledger |
| W13 | **P2** | JSON količino | harvest | (ni stock) | ProductionContribution |

---

## 5. Enotni ledger — ali `StockMovement` vir resnice?
**NI.** Delno uporabljen. Pokriva W5–W7 + checkout OUT (W1/W2). **Ne pokriva W3/W4** (rezerv., po zasnovi),
**W8/W9** (catalog abs.set — P0 desynk), **W10–W12** (seed/test), W13 (ni stock).

Per-write:
| Pisec | GMov? | Trajna? | Isti txn? | Zapis brez giba? | Ponovlivo bez dup? |
|---|---|---|---|---|---|
| W1/W2 | DA | DA (orderId) | DA | ne | da (guard) |
| W3/W4 | NE | — | ne | da (reserved — ok) | guard |
| W5–W7 | DA | DA | DA | ne | — |
| W8/W9 | NE | — | ne | **da (P0)** | ne |
| W10–W12 | NE | — | ne | **da (seed)** | ne |

**Zaključek:** neposredni zapisi (catalog W9, scripts W10–W12) **niso pokriti v 2D-1Q** → **nova ugotovitev.**

---

## 6. Vstopne poti
```
UI (products) ──► catalog.updateProductVariant ──► W9 (stockQuantity) ──► (brez StockMovement)
UI ──► createStockMovement/recordDelivery/submitStockTake ──► StockMovement + Product.stockQuantity [ledger]
Checkout ──► reserveStock (W3) / convertReservationToSale (W2, OUT)
Webhook Stripe ──► paid (convert) / expired (release W4)
Prepaid ──► applyOrderStockDecrement (W1, OUT)
Records ──► records.ts ──► E.record JSON (W13, ni stock)
Seed ──► scripts/* ──► Product.stockQuantity direct (W10–W12)
```
**Poti, ki obidejo ledger:** catalog W9, scripts W10–W12. **Posebno označeno.**

---

## 7. Primerjava z 2D-1Q + 8. skupina
1. Pokrivajo vse pisce? **DELNO** — scripts/seed (W10–W12), catalog.create (W8) nepopolno.
2. Manka? **DA** — scripts/seed.
3. Dodatna zaščita? **DA** — migrationBlock tudi za scripts/seed in catalog.create.
4. Vrstni red? Catalog/scripts zgodaj.
5. Nova odvisnost? **DA** — W9/W10 desynk.

**Predlagana 8. skupina (ni implementirano):** »Block vsi ne-ledger pisci« — catalog update/create + scripts/seed →
skozi `StockMovement` ali test-data.

---

## 8. Končni seznam obveznih prihodnjih sprememb
| ID | Zajema | Namen | Tveganje | Odvis | Shema | Migr. | Preverba | Test |
|---|---|---|---|---|---|---|---|---|
| F1 | StockReservationEvent (orderItemId, reservationEventId, correctsEventId, CORRECTION) | dokazlj. rez. | P0 | — | DA | DA | unit/itest | T2 |
| F2 | StockMovement.reservationEventId | ISSUE↔OUT | P1 | F1 | DA | DA | itest | T6 |
| F3 | migrationBlock v W3,W4,W1,W2,webhook | blok legacy | P0 | — | NE | — | itest | T2 |
| F4 | **catalog update/create skozi ledger/blok** | W9/W8 | P0 | — | NE | — | itest | T3 |
| F5 | **scripts/seed skozi ledger ali test-data** | W10–W12 | P1 | — | NE | — | script | T10 |
| F6 | catalog→vez + W13 ProductionContribution | P2 | NE | DA | — | itest | T11 |
| F7 | SELECT FOR UPDATE + red | RES+B≤S | P1 | — | NE | — | itest | T6 |
| F8 | payload-hash + poslovna uniq | idempot. | P1 | F1 | DA | DA | unit | T8 |
| F9 | RES_legacy izvzet iz A | legacy | P0 | — | NE | DA | itest | T2 |

---

## 9. Testna matrika
| # | Predp. | Operacija | Prič. | Dokaz |
|---|---|---|---|---|
| T1 | vsak pisec | zapis | sprememba+sled | mov/event |
| T2 | migrationBlock | vsaka stara | zavrnjeno | block err |
| T3 | abs.set | catalog | ne prepiše reserved | guard |
| T4 | brez permiss | poskus | zavrnjeno | require |
| T5 | napač org | poskus | zavrnjeno | org |
| T6 | ponovitev ISSUE/OUT | retry | brez dod. giba | idem+1:1 |
| T7 | napaka | rollback | ohranjeno | tx |
| T8 | dub webhook | 2× | en izdaja | CAS+idem |
| T9 | admin korekcija | CORRECTION | sled | event |
| T10 | uvoz/seed | script | ne obide | mov |
| T11 | Prod↔Var | sprememba | usklajeno | invariant |
| T12 | vse stare | zaščita | pokrite | matrix |

---

## 10. Končna odločitev (§12)

**INVENTURA NI POPOLNA — IMPLEMENTACIJA ŠE NI DOVOLJENA.**

Razlogi:
- P0 pisec (`catalog.updateProductVariant` W9) — abs.set brez StockMovement, brez migrationBlock;
- scripts/seed pisci (W10–W12), `catalog.createProductVariant` (W8) brez ledgerja;
- `reservedQuantity` pisci (W3/W4) niso per-order/migrationBlock in niso izpeljivi iz StockMovement;
- desynk (W9/W10) ni pojasnjen/uporabljen.

⚠ Četudi bi bila inventura popolna, to **ni samodejna odobritev 2D-1A** — le dokazna podlaga.

---

## 11. Zaključna varnostna potrditev (§13)
1. Spremenjen samo navedeni dokument: DA.
2. Vse spremembe kode izključene: DA.
3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij/sprememb baze/testnih podatkov: DA.
5. Ni Git operacij: DA.
6. `einvoices.ts` in tuje spremembe nedotaknjene: DA.
7. `markec_dev` in produkcija nedotaknjena: DA.
8. Faza 2D-1A ostaja neodobrena: DA.

**Ne popravljam najdenih težav. Ne implementiram ničesar. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1S — KONČNA RAZVRSTITEV ZAPISOVALCEV IN DOKAZ PRODUKCIJSKIH POTI — read-only

> Zaključna razvrstitev 13 zapisovalcev iz 2D-1R **+ nova odkrita pisca W14/W15**, dokaz produkcijske
> dosegljivosti po dejanskih klicateljih/uvozih, in uskladitev F1–F9. **Samo dokument; nič kode/sheme/migracij;
> Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja
> neodobrena.**

## 1. Stanje repo
- Git status ≈ 387 vnosov (nespremenjeno). `einvoices.ts` untracked. `schema.prisma` s tujim WIP. **Ta analiza
  nič ne spreminja.**

---

## 2. Končna razvrstitev zapisovalcev (§3)

> Dokaz dosegljivosti: vsi `src/app/actions/*.ts` imajo `"use server"`; kličejo jih klient komponente. Preverjeni
> uvozni klicatelji za vsakega.

| ID | Funkcija/Datoteka | Kategorija | Piše DB | Dosegljiv iz prod. app | Spremeni dejansko zalogo | StockMovement | Tveganje |
|---|---|---|---|---|---|---|---|
| W1 | `applyOrderStockDecrement` product-checkout.ts:91 | PRODUCTION_APPLICATION | da | da (checkout/verify/webhook) | da (stock−) | **da** | P1 |
| W2 | `convertReservationToSale` :208 | PRODUCTION_APPLICATION | da | da (verifyProductOrder) | da (stock−, reserved−) | da | P1 |
| W3 | `reserveStock` :166 | PRODUCTION_APPLICATION | da | da (checkout-hold) | reserved+ | ne (by design) | P1 |
| W4 | `releaseStockReservation` :187 | PRODUCTION_APPLICATION | da | da (webhook expired, cancel) | reserved− | ne (by design) | P0 |
| W5 | `createStockMovement` inventory.ts:81 | PRODUCTION_APPLICATION | da | **da** (stock-movements-card.tsx:121) | stock | **da** | P2 |
| W6 | `recordDelivery` :371 | PRODUCTION_APPLICATION | da | **da** (delivery-dialog.tsx:84) | stock (+) | **da** | P2 |
| W7 | `submitStockTake` :513 | PRODUCTION_APPLICATION | da | **da** (stocktake-client.tsx:75) | stock | **da** | P2 |
| W8 | `createProductVariant` catalog.ts:128 | PRODUCTION_APPLICATION | da | **da** (product-variants-card.tsx:123) | stock (abs) | **ne** | P2 |
| W9 | `updateProductVariant` catalog.ts:148,180 | PRODUCTION_APPLICATION | da | **da** (product-variants-card.tsx:122) | stock (abs) | **ne** | **P0** |
| **W14** | `createProduct` products.ts:299,332 | PRODUCTION_APPLICATION | da | **da** (product-form.tsx:38) | stock (abs) prek `...productData` | **ne** | **P0** |
| **W15** | `updateProduct` products.ts:377,408 | PRODUCTION_APPLICATION | da | **da** (product-form.tsx:38) | stock (abs) prek `...productData` | **ne** | **P0** |
| W10 | scripts/_f5511-race-probe.ts | TEST_ONLY | (test DB name) | ne (ni v pkg scripts) | test | ne | P3 |
| W11 | scripts/f553-seed.cjs, f552-seed.cjs, _f5511-mig-setup.ts, repro-p80-queries.ts | SEED_ONLY / MAINTENANCE_ONLY / REPRO | (ločene) | ne (ni v pkg scripts) | seed/repro | ne | P1 |
| — | `prisma/seed.ts` (:1067–1138) | SEED_ONLY | da (prek `pnpm db:seed`) | ne (ročni) | seed stock | ne | P1 |
| W12 | src/lib/verticals.ts:887–892,1094 | DEMO_STATIC_DATA | prek seed (createMany :1094) | ne (seed) | demo vrednosti | ne | P3 |
| W13 | records.ts (harvest/batch JSON) | EXTENSION_RECORD_DATA | da (JSON E.record) | da (UI records) | **ni Product.stock** | ne | P2 |

Skupaj: **W1–W9 + W14 + W15 = 11 produkcijskih piscev stock/zaloge**; W10–W12 + `prisma/seed.ts` = test/seed/demo;
W13 = proizvodna evidenca (ni Product.stock). `cart.ts:70`, `public-site.ts:407`, `low-stock.ts` = bralci.

---

## 3. Nova odkritja (2D-1S) — W14/W15 in popravek 2D-1R
- **2D-1R je spregledal pisca `Product.stockQuantity` v `products.ts`** (`createProduct` :299/:332, `updateProduct`
  :377/:408). Oba uporabljata `...productData` iz `parseProductServerInput` (`server-schema.ts:54` dovoli
  `stockQuantity`). — **W14/W15 sta P0** (abs. set brez StockMovement, prek admin `product-form.tsx:38`).
- Sem ju dodal W14/W15 in vključil v tabelo in F-zapiske.

---

## 4. Posebna analiza W8/W9 (ProductVariant) — prednost
### W8 createProductVariant
- nastavi začetno absolutno zalogo (catalog.ts:128), **brez StockMovement**; produkcijska (UI variante).
- Začetna zaloga je **sistemska inicializacija** ali dejanski fizični prejem — trenutno ni ločeno.
- **Predlog:** kombinacija A+C — ob ustvarjanju variante nastavi le atribute; **fizično začetno stanje** se
  evidentira prek **`StockMovement IN`** (revizijsko, sledljivo), ne kot abs. set brez sledi.
### W9 updateProductVariant
- **absolutni zapis stockQuantity** (catalog.ts:180–181), brez transakcije, brez `StockMovement`, brez preverbe
  `reservedQuantity` (lahko < reserved), lahko prepiše ledger, **obide migrationBlock**.
- **Predlog prihodnjega vedenja (W9):**
  1. sprememba cene/opisa NE vpliva na zalogo (ločen path — abs. set prepovedan);
  2. fizična sprememba zaloge mora imeti `StockMovement` (oz. prisiljen txn);
  3. admin korekcija ima `reason` + revizijska sled;
  4. zaloge ne more pod aktivnimi rezervacijami (`stock ≥ reserved`);
  5. txn-varno;
  6. upošteva `migrationBlock`.
- **Ne popravljam W9** (read-only).

### W15 updateProduct — enako kot W9, le za Product
- Enak P0: `...productData` z `stockQuantity`, brez ledgerja, brez reserved-guarda, obide migrationBlock.
- Prihodnje: enaka pravila kot W9.

---

## 5. Skripte/seed/demo (W10–W12, prisma/seed.ts) — ločen namen
- **W10 race-probe** (`scripts/_f5511-race-probe.ts`): TEST_ONLY — test org (`f551-org-a`), izolirano, ne v
  package.json (ne avto-run).
- **W11 skripte** — različne:
  - `_f5511-mig-setup.ts` — MAINTENANCE_ONLY (migracijski setup test);
  - `f553-seed.cjs` / `f552-seed.cjs` — SEED_ONLY (test seed, izven pkg scripts);
  - `repro-p80-queries.ts` — MAINTENANCE_ONLY (repro);
  - **`prisma/seed.ts`** — SEED_ONLY, **v package.json (`db:seed`)** → izvedljiv z `pnpm db:seed` nad **kdorkoli
    DATABASE_URL** (potencialno prod) — **riziko** (P1), a ni del build/CI (build le `migrate-with-retry`).
- **W12 verticals.ts** — DEMO_STATIC_DATA (registry vrednosti); seed jih materializira v DB (prek :1094); ni
  runtime fizične zaloge. UI mora ločiti demo od prave zaloge uporabnikove org (izven tega dokumenta).

---

## 6. ExtensionRecord (W13) — kje se konča proizvodnja, kje se začne zaloga
- `records.ts` piše **JSON `ExtensionRecord.data`** (harvest, batch — `quantity_kg` idr.); **NE piše
  `Product.stockQuantity`**.
- **Ločnica:** ExtensionRecord ≈ **proizvodna evidenca** (input/net/loss); fizična zaloga se (v prihodnje) oblikuje
  šele z `IN PRODUCTION` (StockMovement) povezanim prek **`ProductionContribution` → `ProductionBatch` →
  `Product`/`ProductVariant`**. Ta povezava **danes NE obstaja** → **prihodnja arhitekturna zahteva, ne obstoječa
  funkcionalnost.**
- **Dvojno štetje:** ista količina (npr. 10 kg → 20 koz) se NE sme šteti hkrati v production (kg) in v stock
  (kos) brez `ProductionContribution` ločnice. Trenutno production JSON in Product.stock sta **ločena domačna,
  nepovezana** → ne dvojno šteto, a tudi ne sled. Povezava (2D-1A) mora to razrešiti (contribution loči vhod/neto/izgubo).

---

## 7. Iskanje dodatnih zapisovalcev (dokaz popolnosti)
- Preskanjeno: `src/**` (vse `product.create/update/updateMany/upsert`, `productVariant.*`, `stockMovement.create`,
  `increment/decrement`, `$executeRaw`), `scripts/**`, `prisma/seed.ts`, `lib/**`.
- **Najdeno: W14/W15 (products.ts) kot dodatna pisca Product.stockQuantity.** 
- `lib/lib/default-media-migration.ts:192` pise le `images` (ne stock).
- `verticals.ts:1094` `prisma.product.createMany` — DEMO (prek seed).
- **Nobeni** drugi neposredni pisci `stockQuantity`/`reservedQuantity` niso bili najdeni po teh metodah (ni
  `$executeRaw` na Product/Variant v src; scripts rabitah DB-create/verify, ne stock).

---

## 8. Dokaz produkcijske dosegljivosti (§9)
```
Admin UI product-form.tsx ──► createProduct/updateProduct (W14/W15) ──► product.create/update (stockQuantity) ──► (brez StockMovement)
Admin UI product-variants-card.tsx ──► createProductVariant(123)/updateProductVariant(122) (W8/W9) ──► (brez StockMovement)
Admin UI stock-movements-card.tsx(121) ──► createStockMovement (W5) ──► StockMovement + Product.stock  [ledger]
Admin UI delivery-dialog.tsx(84) ──► recordDelivery (W6) ──► StockMovement + stock  [ledger]
Admin UI stocktake-client.tsx(75) ──► submitStockTake (W7) ──► StockMovement + stock  [ledger]
Checkout ──► reserveStock(W3)/convertReservationToSale(W2, OUT ledger)/applyOrderStockDecrement(W1,OUT ledger)
Webhook Stripe → expired: releaseStockReservation(W4); paid: convert (W2)
Prepaid → applyOrderStockDecrement (W1)
Seed ──► prisma/seed.ts / scripts ──► Product.stockQuantity direct (W11/W12, ni ledger; ročno/seed)
```
- **Produkcijski zapisovalci so dokazljivo dosegljivi** (server actions + UI uvoz ni zaradi `"use server"`).
- **Neprodukcijski (W10–W12, prisma/seed.ts):** kot dokaz, da NISO običajni produkcijski pot — niso vključeni v
  noben UI uvoz; le `prisma/seed.ts` prek `pnpm db:seed` (ročno); scripts niso v pkg scripts/CI.

---

## 9. Uskladitev F1–F9 + razširitev (F10–F11)
| ID | Namen | Zajeti pisca | Pokritost | Shema | Migr. | Manjk. zaščita |
|---|---|---|---|---|---|---|
| F1 | StockReservationEvent vez | W3,W4 | da | da | da | — |
| F2 | StockMovement.reservationEventId | W1,W2 | da | da | da | — |
| F3 | migrationBlock v starih | W1,W2,W3,W4,webhook | da | ne | — | — |
| F4 | catalog skozi ledger/blok | W8,W9 | da | ne | — | — |
| F5 | scripts/seed test-data | W10,W11,prisma.seed | da | ne | — | — |
| F6 | ProductionContribution | W13 | da | da | da | — |
| F7 | SELECT FOR UPDATE | (RES+B≤S) | — | ne | — | — |
| F8 | payload-hash | (idem) | — | da | da | — |
| F9 | RES_legacy izvzet | (A) | — | ne | da | — |
| **F10** | **products.ts (W14) updateProduct/createProduct skozi ledger ali blok** | **W14,W15** | **ni pokr.** | ne | — | **P0 novi pisca** |
| **F11** | **Reserved-guard za catalog & product abs. set** (`stock≥reserved`) | W8,W9,W14,W15 | ni pokr. | ne | — | **Lahko < reserved** |

➡ **F1–F9 NE pokrivajo W14/W15.** Dodana **F10** (products.ts skozi ledger/blok) in **F11** (reserved-guard za
abs. set). Skupine so različno obravnavane (ne združujem različnih tveganj).

---

## 10. Končni model upravljanja zaloge (§11)
- **OBSTOJEČE:** fizična zaloga = `Product/Variant.stockQuantity` (stanje), **delno** pokrito s `StockMovement`;
  `reservedQuantity` = per-product agregat (ni ledger); production v `ExtensionRecord` JSON (ločeno od stock).
- **PREDLAGANO PRIHODNJE:**
  1. vir fizične zaloge = **`StockMovement`** (enkraten ledger);
  2. vir aktivnih rezervacij = **`StockReservationEvent`** (RESERVE−ISSUE−RELEASE−EXPIRE);
  3. vir razpoložljive = `A = S − RES − RES_legacy` (izračun iz ledgerja + dogodkov);
  4. vir proizvodnih količin = **`ProductionContribution`** (+ ExtensionRecord);
  5. vir prodajnih izdaj = `StockMovement OUT` + `OrderItemBatchAllocation`;
  6. Product/ProductVariant/batch povezano prek `OrderItemBatchAllocation`(orderItem↔batch) in `StockMovement.batchRecordId`;
  7. začetna zaloga → skozi `StockMovement IN` (ali revizijsko začetni saldo);
  8. ročna korekcija → `CORRECTION`/`StockMovement` + `reason`, append-only;
  9. vračilo → `StockMovement IN RETURN` + vez na OUT;
  10. odpis → `StockMovement OUT (STOCKTAKE/WASTE)` + `reason`, S-le če kos v S;
  11. dvojno štetje proizvodnje/zaloge → `ProductionContribution` loči vhod/neto/izgubo, `IN PRODUCTION` je edini
      prehod v stock;
  12. neposredna sprememba mimo ledgerja → **migrationBlock + F4/F10** blokirajo vse abs. set (catalog/products), ki
      niso skozi ledger.
- **NEPREVERJENO:** products.ts W14/W15 abs-set dejansko uporabljan v produktni formi? — code spread sprejema
  stockQuantity (server-schema:54); ali UI pošlje ga ni preverjeno (front form). — **PARTIAL/NOT VERIFIED**.

---

## 11. Končna odločitev (§12)

**POPOLNOST ZAPISOVALCEV NI DOKAZANA — IMPLEMENTACIJA NI DOVOLJENA.**

- Novi P0 pisci W14/W15 (`products.ts` base-Product abs. set, dosegljivo v UI `product-form.tsx:38`) **niso bili**
  v 2D-1R; F1–F9 jih ne pokrivajo → **dodani F10/F11** (niso implementirani).
- Produkcijski poti za W14/W15 niso popolnoma dokazane (ali form pošlje stockQuantity), a koda omogoča;
  doslej ni uporabljeno migracijo → **NOT VERIFIED**.
- P0 (W4/W9/W14/W15) brez celovite zaščite.
- Zato: **ni izpolnjen** pogoj »nepojasnjenih neposrednih sprememb zaloge ni«.

⚠ Tudi če bi bila popolnost dokazana, to **NI odobritev implementacije 2D-1A** — za implementacijo je potrebna
ločena izrecna odobritev.

---

## 12. Zaključna varnostna potrditev (§13)
1. Spremenjen samo navedeni dokument: DA.
2. Koda nespremenjena: DA.
3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA.
5. Ni sprememb baze/testnih podatkov: DA.
6. Ni Git operacij: DA.
7. `einvoices.ts` in tuje spremembe nedotaknjene: DA.
8. `markec_dev` in produkcija nedotaknjena: DA.
9. Nobena skripta ni izvedena nad bazo: DA (statična analiza).
10. Faza 2D-1A ostaja neodobrena: DA.

**Ne popravljam najdenih težav. Ne implementiram ničesar. Ustavim se in počakam na izrecno odločitev.**

---

# DOPOLNITEV 2D-1T — DOKAZ DEJANSKEGA PRENOSA IN SHRANJEVANJA STOCKQUANTITY — read-only

> Dokaz celotne podatkovne poti `stockQuantity` od uporabniškega vnosa (obrazec) do dejanskega Prisma zapisa za
> W14 (`createProduct`) in W15 (`updateProduct`) v `src/app/actions/products.ts`. Vsaka povezava dokazana z
> dejansko kodo, brez sklepanja na podlagi obstoja polja. **Samo dokument; nič kode/sheme/migracij; Git operacij
> nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

## 1. Dejansko stanje obraza (popravljeno: pot ni bila v 2D-1S)
- Obrazec je **`src/components/dashboard/product-form.tsx`** (ne `src/components/admin/...`).
- `import { createProduct, updateProduct } from "@/app/actions/products"` :38 — produkcijski server action.

---

## 2. Analiza obrazca `product-form.tsx`

| # | Ugotovitev | Vrstice | Dokaz |
|---|---|---|---|
| 1 | Form vsebuje polje za zalogo | :591–606 | `<Input id=stockQuantity name=stockQuantity type=number …>` |
| 2 | Polje vidno uporabniku | :591–606 | vedno na koncu obrazca (brez type/permiss pogoj) |
| 3 | Obvezno/neobvezno | :283 | `fdNum(formData,"stockQuantity") ?? 0` — prazno → 0 |
| 4 | Začetna vrednost | :150 | `stockQuantity: product?.stockQuantity || 0` |
| 5 | Prenese v form state | :169 | `watch("stockQuantity")` |
| 6 | Vključeno v submit payload | :283 | `stockQuantity: fdNum(formData,"stockQuantity") ?? 0` |
| 7 | Create vs edit | — | v obeh (ist input; default 0 pri create, trenutna pri edit) |
| 8 | Edit prepis privzete | :150 | `product?.stockQuantity || 0` |
| 9 | Poslana polja | :276–295 | name, description, price, compareAtPrice, sku, **stockQuantity**, trackInventory, images, categoryId, isActive, isFeatured, barcode, brand, unit, vatRate, forSale, reorderPoint |
| 10 | Pogoji | — | **ni** — polje vedno poslano (ni type/permission pogoj) |

---

## 3. Celotna podatkovna pot W14/W15 (§4)

```
product-form.tsx:591–606  <input name="stockQuantity">
   ↓ (FormData → useActionState :274)
product-form.tsx:283  stockQuantity = fdNum(formData,"stockQuantity") ?? 0
   ↓ (values :276–295)
product-form.tsx:297–298  schema.safeParse(values)  [client create/update schema]
   ↓ (parsed.data)
product-form.tsx:314/:322  updateProduct(id,{...parsed.data,…}) / createProduct({...parsed.data,…})
   ↓ (server action "use server", products.ts:1)
products.ts:313/:386  parseProductServerInput(data)  [server whitelist]
   ↓ (parsed.data → productData, :319/:386 categoryId izločen)
products.ts:332/:408  prisma.product.create/update({ data: { ...productData } })
   ↓ (DB)
Product.stockQuantity = absolute value  (NO StockMovement)
```
- **Transformacije:** `fdNum` → number (ali 0); server `int().min(0).max(1_000_000).optional()`; ne preimenovano.
- **Nastane prisma absolutna.** **NE nastane StockMovement** (:332/:408). **Ni transakcije. Ni reserved-guarda.**

---

## 4. `server-schema.ts` (§5) — `src/lib/products/server-schema.ts`
1. Vsebuje `stockQuantity`? **DA** :54 `z.number().int().min(0).max(1_000_000).optional()`.
2. Dovoljeno pri create/update? **DA** (`productServerUpdateSchema = productServerSchema.partial()` :64).
3. Pretvorba? server number; ni clamp – le min/max preverba.
4. Privzete? ne serverju (optional); obrazec default 0.
5. Min/max: 0..1_000_000, **integer**, **`null` NI dovoljen** (ni `.nullable()`).
6. ReservedQuantity preverjen? **NE** (ni cross-check).
7. Org? — ne shema; v akciji (`requirePermissionOrg` :301/:377).
8. Neznana polja? **Zavrnjena** (bela lista).
9. Input/output: update = partial.

---

## 5. W14 `createProduct` (§6)
- Sprejme `CreateProductInput`, stockQuantity dovoljen.
- Validacija `parseProductServerInput(data,"create")` :313 (server-schema:54).
- Privzeta zaloga? obrazec default 0 (`?? 0`); server optional + Prisma @default(0).
- Ustvari absolutno zalogo? **DA**.
- StockMovement? **NE**. transakcija? **NE** (:332).
- orgId :301/:335; pravice :301; začetne rezero: NI; migrationBlock: **NE**.
- A (brez zaloge): mogoče (0). B (z zalogo): mogoče (10, brez ledgerja — P0). C (demo): mogoče. D (alt. klicatelj):
  **samo product-form.tsx** (preverjeno v src/**).

---

## 6. W15 `updateProduct` (§7)
- Sprejme `stockQuantity`? **DA** (partial :64/:54).
- Prepise obstoječo? **DA** (`...productData` :411).
- Sprememba brez uporabniškeega polja? UI vedno vključi stock=trenutno → ob običajnem urejanju ohrani; a če bi
  payload bil drugače sestavljen / trenutna `|| 0` proces → bi prepisal na 0. — **PARTIAL**.
- reserved? NE → **lahko < reserved** (F11). StockMovement? NE. txn? NE. orgId/pravice? DA. migrationBlock? NE.

---

## 7. Alternativni klicatelji (§8)
- Pregledano `src/**`: **edini klicatelja W14/W15 = `product-form.tsx`** (:38/:314/:322). Ostali uvoz
  (`getAdminProducts`/`getProductById`/`deleteProduct`) ne pišejo stock. **API/webhook/bg/job/import: nobenega**
  (search scope src/**). — **NOT VERIFIED** (omejeno na src/**).

| Klicatelj | Pošilja stock | Validacija | DB zapis | Status |
|---|---|---|---|---|
| product-form create | da (:283) | client+server | `product.create` :332 | dokazano |
| product-form edit | da | client+server | `product.update` :408 | dokazano |
| API/webhook/bg | — | — | — | NOT VERIFIED |

---

## 8. Negativni / robni scenariji (§9)
| Sc | Rezultat | Status |
|---|---|---|
| A create brez zaloge | shranj 0 | PASS |
| B create z zalogo 10 | shranj 10, **brez StockMovement** | **FAIL** |
| C edit cene | form pošlje stock=trenutno → ohrani (če form ok) | **PARTIAL** |
| D edit opisa | enako | PARTIAL |
| E neposredni payload 100 | sprejeto (:54) + shranj | **FAIL** (ni ledger) |
| F stock=10,res=7,payload 5 | **dovoljeno** (ni reserved-guard) | **FAIL** |
| G neg/dec/veliko/`null`/manjk. | neg/dec/veliko→reject; `null`→reject; manjk→0/optional | PARTIAL |
| H tuja org | zavrnjeno (org pogoj) | PASS |
| I ponovljen submit | create = nova entiteta, ni idem | PARTIAL |

---

## 9. Uskladitev F10/F11 (§10)
- **F10** (W14/W15): pokriva products.ts + product-form; **ne pokriva** W8/W9 skupaj; naj bodo združeni pod eno
  »abs-set blok skozi ledger«. Ne zahteva sheme.
- **F11** (reserved-guard `stock≥reserved`): pokriva W8/W9/W14/W15; **manjka v products/catalog** (trenutno ne).
  Ne zahteva sheme.
- **Preverba:** F10/F11 **na strežniku** (v akcijah pred Prisma write), testi: create/update stock=100; reserved=7→5;
  tuja org.

---

## 10. Končna arhitekturna priporočila (§11)
**Pravilo:** izdelka variante NI dovoljeno ustvariti/urediti z neposrednim prepisom fiz. zaloge mimo ledgerja.
| Operacija | OBSTOJEČA | PREDLAGANA | Verif. |
|---|---|---|---|
| create brez zaloge | set 0 | varianta brez zaloge | —
| create z fiz. zalogo | abs.set (FAIL) | `StockMovement IN` / začetni saldo | —
| update cene/opisa | form pošlje stock,trenutno | ne sme vplivati | —
| admin korekcija | abs.set | CORRECTION+reason,txn | —
| fizični prejem | delivery | StockMovement IN | —
| vračilo | — | StockMovement IN RETURN | —
| odpis | stocktake | StockMovement OUT+reason | —
| sprememba reserved | — | StockReservationEvent | —

---

## 11. Končna odločitev (§12)

**W14/W15 PODATKOVNA POT NI DOKAZANA — IMPLEMENTACIJA NI DOVOLJENA.**

Čeprav je pot obrazec→Prisma dokazana (in shranjevanje možno), pogoji niso izpolnjeni:
- F10/F11 ne pokrivata vseh abs. set piscev (reserved-guard manjka v products/catalog);
- edit z manjkajočim/`0` payload možno prepiše na 0 (odvisno od sestave), ni varno;
- **StockMovement tedaj NI ustvarjen**, obstaja možnost neskladja — krši pravilo »ne prepisuj mimo ledgerja«;
- storjen reserved-guard (F11) ni implementiran — scenarij F → FAIL.

⚠ Tudi popolna pot ni odobritev 2D-1A.

---

## 12. Zaključna varnostna potrditev (§13)
1. Spremenjen samo navedeni dokument: DA.
2. Nobena koda nespremenjena: DA.
3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA.
5. Ni sprememb baze/testnih podatkov: DA.
6. Ni Git operacij: DA.
7. `einvoices.ts` in tuje spremembe nedotaknjene: DA.
8. `markec_dev` in produkcija nedotaknjena: DA.
9. Nobena produkcijska/testna skripta ni izvedena nad bazo: DA (statična analiza).
10. Faza 2D-1A ostaja neodobrena: DA.

**Ne popravljam W14/W15, ne spreminjam obraza, ne implementiram ničesar. Ustavim se in počakam na izrecno
odločitev.**

---

# DOPOLNITEV 2D-1U — ENOTNA KONČNA MATRICA VSEH PRODUKCIJSKIH ZAPISOVALCEV ZALOGE — read-only

> Konsolidacija 2D-1A..2D-1T v eno usklajeno arhitekturo zalogovnega sistema MARKEC, z enotno matrico W1–W15
> (preverjeno v trenutni kodi), enotnim modelom fiz. zaloge/rezervacij/StockMovement, zaščito pred neposrednim
> prepisom, konkurenčnostjo, migracijo legacy-ja, čebelarsko sledljivostjo, fazami in testi. **Samo dokument —
> nič kode/sheme/migracij; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod
> nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

> **Pravilo dosegljivosti:** vsaki trditvi dodan status — EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP /
> NOT VERIFIED. Trenutna koda ima prednost pred starejšimi poglavji; razlike zabeležene.

## 0. Stanje in preverjene vrstice (trenutna koda)
- `src/app/actions/products.ts`: `createProduct` :299 (write :332), `updateProduct` :375 (write :408),
  `deleteProduct` :453, `toggleProductStatus` :494; server-schema `src/lib/products/server-schema.ts:54`.
- `src/app/actions/catalog.ts`: `createProductVariant` :93 (:120), `updateProductVariant` :148 (:171),
  `deleteProductVariant` :192, `getProductVariants` :66.
- `src/app/actions/inventory.ts`: `createStockMovement` :81 (:168/:173/:178), `recordDelivery` :371,
  `submitStockTake` :513.
- `src/app/actions/product-checkout.ts`: `applyOrderStockDecrement` :91, `reserveStock` :166,
  `releaseStockReservation` :187, `convertReservationToSale` :208, `verifyProductOrder` :1097, `AVAIL` :146.
- `src/app/api/webhooks/stripe/route.ts`: expired :100–119, paid :212–229.
- `src/components/dashboard/product-form.tsx`: input :591–606, submit :274–328 (TI 2D-1T).
- `product-variants-card.tsx` :122/:123; `delivery-dialog.tsx` :84; `stock-movements-card.tsx` :121;
  `stocktake-client.tsx` :75.

---

## 1. Enotna matrica W1–W15 (§3)

| ID | Fn | Datoteka | Prod. | Klicatelj | Prod.stock | Var.stock | reserved | StockMov | txn | reserved-check | org | idempot | migrBlock | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W1 | applyOrderStockDecrement | product-checkout:91 | da | checkout/paid/prepaid | da(−) | da(−) | da(−,convert) | **da** | da | ne | da | guard | NO | P1 | EXIST-VER |
| W2 | convertReservationToSale | :208 | da | verifyProductOrder | da(−) | da(−) | da(−) | **da** | da | guard(reserved≥q) | da | guard | NO | P1 | EXIST-VER |
| W3 | reserveStock | :166 | da | checkout-hold | ne | ne | da(+) | ne | da | AVAIL-guard | da | guard | NO | P1 | EXIST-VER |
| W4 | releaseStockReservation | :187 | da | webhook expired | ne | ne | da(−) | ne | da | ne (per-order) | da | guard | NO | **P0** | EXIST-PART |
| W5 | createStockMovement | inventory:81 | da | stock-mov-card:121 | da(±) | da(±) | ne | da | da | ne | da | NEG | NO | P2 | EXIST-VER |
| W6 | recordDelivery | :371 | da | delivery-dialog:84 | da(+) | da(+) | ne | **da** | da | ne | da | delta | NO | P2 | EXIST-VER |
| W7 | submitStockTake | :513 | da | stocktake-client:75 | da(±) | da(±) | ne | **da** | da | ne | da | delta | NO | P2 | EXIST-VER |
| W8 | createProductVariant | catalog:93/:120 | da | var-card:123 | ne | da(abs) | ne | **no** | no | ne | da | no | NO | P2 | EXIST-VER |
| W9 | updateProductVariant | catalog:148/:171 | da | var-card:122 | ne | da(abs) | ne | **no** | **no** | **no** | da | no | NO | **P0** | EXIST-VER |
| W14 | createProduct | products:299/:332 | da | product-form:322 | da(abs) | ne | ne | **no** | **no** | no | da | no | NO | **P0** | EXIST-VER |
| W15 | updateProduct | products:375/:408 | da | product-form:314 | da(abs) | ne | ne | **no** | no | **no** | da | no | NO | **P0** | EXIST-VER |
| W10 | race-probe | scripts/_f5511 | test | ročno | da | — | — | no | — | ne | no | no | NO | P1 | EXIST-VER |
| W11 | seed/repro | scripts/* + prisma/seed.ts | seed | ročno db:seed | da(abs) | — | — | no | — | ne | no | no | NO | P1 | EXIST-VER |
| W12 | verticals.ts | src/lib/verticals:887 | demo | seed | da(demo) | — | — | no | — | ne | no | no | NO | P3 | EXIST-VER |
| W13 | records.ts | actions/records (E.rec) | da(UI) | records UI | **ne** (JSON) | — | — | no | — | ne | da | — | NO | P2 | EXIST-VER |

**Dodatni pisci (W14/W15 odkriti v 2D-1S/2D-1T; noben W16+)** — noben nov zapisovalec v tem pregledu (iskanje src+scripts).

---

## 2. Popolnost iskanja (§4)
- Neodvisno preverjeno: iskanje `stockQuantity`, `reservedQuantity`, `StockMovement`, `stockMovement.create`,
  `update/updateMany/upsert/create`, `increment/decrement`, `$executeRaw` čez `src/**`, `scripts/**`, `prisma/seed.ts`.
- Vsi `stockMovement.create` v actions = 5 mest (inventory:178/457/551, product-checkout:105/124/226).
- Produkcijski pisci stock/zaloge = **W1–W9 + W14 + W15 = 11**; test/seed/demo = W10–W12 + `prisma/seed.ts`;
  proizvodnja-vhod = W13 (ni Product.stock).
- **NOT VERIFIED:** dinamični objekti, ki bi lahko posredno pisali stock mimo teh (npr. `...productData` pokrito
  pri W14/W15; drugih dynamic-stock neposrednih ni najdeno).

---

## 3. Enotni model fizične zaloge (§5)
**Definicije (usklajene iz 2D-1L/1Q/1R):**
```
S  = prodajna v skladišču   ; B = umaknjena, v skladišču ; D = poškodovana, v skladišču
Rep = pri zunanjem servisu  ; W = izguba/odpis ; Sold = prodana
P_warehouse = S + B + D ; P_owned = P_warehouse + Rep ; A = S − RES
```
**Preverba skladnosti z vsemi primeri:** iz 2D-1L §1.4–1.5, 2D-1Q §8, 2D-1R §8 — **vsi konvergirajo** (npr.
`P_owned` se zmanjša le ob izgubi lastništva; umik B v skladišču ne zmanjša `P_warehouse`; `RES` ni fizična).
Nobeno matematično/semantično neskladje ni najdeno med naštetimi primeri.

---

## 4. Enotni model rezervacij (§6)
Predlog `StockReservationEvent` (2D-1P/1Q): `organizationId, orderId, orderItemId, productId, variantId?,
reservationEventId?, correctsEventId?, eventType (RESERVE/ISSUE/RELEASE/EXPIRE/CORRECTION), quantity,
idempotencyKey, payloadHash?, createdById`. Invarianti: `ACTIVE = RESERVE − Σ(ISSUE+RELEASE+EXPIRE) − CORRECTION ≥ 0`;
`Σ(ISSUE+RELEASE+EXPIRE) ≤ RESERVE`; **ISSUE/RELEASE z `reservationEventId` na izvorni RESERVE** → nedvoumno ve,
kateri ISSUE pripada kateri RESERVE. Append-only; CORRECTION je sklic na napako (`correctsEventId`) + reason, NIkoli
UPDATE. Neposredna izdaja (brez rez.) = `StockMovement OUT` brez `reservationEventId`, ločeno od `ISSUE`.
**Razlikovanje:** računovodska korekcija (RES/S) vs fizično vračilo (`StockMovement IN RETURN`) vs odpis (`OUT`)
vs sprememba razpoložljivosti (WITHDRAW/REACTIVATE) — **ne pomešano**.
- **GAP:** delna rezervacija enega orderItem (več RESERVE na isti item) → podpruto (vsaka svoj RESERVE).
- **GAP:** vprašanje »kateri RESERVE pripada kateremu ISSUE« za LEGACY ni odgovarjalno (ni EV-a) → legacy `RES_legacy`.

---

## 5. Enotni model StockMovement (§7)
**Pravilo:** StockMovement = evidenca **fizičnega** premika, NE evidenca rezervacije.
- IN (dobava-IN, delivery, stocktake, PRODUCTION, RETURN, repair-return).
- OUT (izvod, STOCKTAKE izguba/odpis, repair, PRODUCTION-reversal).
- Povezava `StockMovement.reservationEventId → StockReservationEvent.ISSUE` za izdaje iz rezervacije; neposredna
  izdaja = `reservationEventId=NULL` + `source=ORDER`.
- Zagotovi:
  1. en ISSUE → največ en OUT (v txn 1:1);
  2. en OUT ne pripisan dvema ISSUE (en `reservationEventId`);
  3. ponovljen webhook ne ustvari novega OUT (status-CAS + idemKey);
  4. neposredna izdaja ima jasen `source=ORDER`, `reservationEventId=NULL`;
  5. vračilo ustvari nov `IN RETURN`, ne spremeni zgodovine ISSUE;
  6. korekcija rezervacije ne povzroči fiz. premika (CORRECTION ≠ OUT);
  7. ISSUE+OUT se ustvarijo/razveljavijo skupaj (ena txn).
- **GAP (splošno):** v trenutni shemi NO `reservationEventId`; ni zagotovljena 1:1 vez. → PROPOSED (shema-sprememba).

---

## 6. Zaščita pred neposrednim prepisom (§8)
**Pravilo:** noben produkcijski endpoint/helper ne sme neposredno nastaviti absolutne fiz. zaloge brez nadzorovane
operacije.
- V trenutni kodi to **KRŠI** 4 abs. set pisce: `updateProductVariant` (W9), `createProductVariant` (W8),
  `createProduct` (W14), `updateProduct` (W15). Vsi pisanjo abs. brez StockMovement, brez txn, brez reserved-guard,
  brez migrationBlock.
- Prihodnja operacija:
  - create brez zaloge → varianta/izdelek nastane brez stock;
  - začetno fizično stanje → **`StockMovement IN`** (obvladovano), ne abs. set;
  - cena/opis → ne sme vplivati na zalogo (ločen path);
  - admin korekcija → CORRECTION+reason, txn;
  - prejem/vračilo/odpis/inventura → StockMovement IN/OUT;
  - sprememba variante → kot create/update izdelek;
  - uvoz → skozi ledger.
- **Zahteva:** podatkovni obrazci (products/catalog) **polno ločeni** od zalogovnih operacij (no stockQuantity v običajnem
  create/edit).

---

## 7. Konkurenčnost in transakcije (§9)
Predlog: `SELECT FOR UPDATE` na **agregatno vrstico** (Product/Variant/batch) v **enotnem vrstnem redu**
(agregat → RESERVE → OrderItem) + pogojne UPDATE + idempotentni retry ob P2034. Prepreči izgubljeno posodobitev in
deadlock ABBA. Sočasna rezervacija/izdaja → CAS; webhook → status-CAS+idemKey. Rollback → ena txn.
- **EXISTING-PARTIAL:** checkout uporablja CAS/status-CAS (dokazano); multi-row RES+B≤S in serializacija za več
  izdelkov **niso** v trenutni kodi (PROPOSED). **Sočasna varnost za nove modele NI PASS** (ni dokazana v kodi).

---

## 8. Migracija legacy-ja (§10)
Razredi: A (dokazljivi → individualni RESERVE), B (stari agregat brez povezave → `RES_legacy_unknown` + blokada
per-order operacij), C (neskladj/negativ → blokada do ročne uskladitve). Pravilo `A = S − RES_documented −
RES_legacy_unknown`. Ne uporabljaj PENDING/`OrderItem.quantity` kot dokaz rezervacije (EXISTING-PARTIAL: PENDING je
nepreverjen dokaz). Preverjanje/rollback/retry po org, zamrznitev piscev med migracijo. **Vse predlog.**

---

## 9. Čebelarska sledljivost (§11)
Pot `harvest → ProductionContribution → ProductionBatch → Product/Variant → StockMovement(IN PRODUCTION) →
StockReservationEvent → OrderItemBatchAllocation → StockMovement OUT → (vračilo/odpis)`.
- Ti podpira: več pridelkov v seriji (contribution×N), en pridelek v več serij, več serij v izdelku
  (St movement.batchRecordId), več serij v enem order-item (OrderItemBatchAllocation×N), delno prodajo, vračila,
  poškodbe, odpis, korekcijo. 
- **GAP:** v trenutni kodi **vsa ta povezava NI obstoječa** — `Product`/`OrderItem` nimata vezi na serijo;
  harvest/batch v ExtensionRecord JSON (W13) nepovezan. **Rekonstrukcija izvora vsake prodane enote je GAP, ne
  obstoječa funkcija.**

---

## 10. Enotna matrica prihodnjih faz (§12) — majhne, po redu
| F | Cilj | W pokr. | Datoteke | Schema | Migr. | Predpogoj | Tveganje | Test | PASS | Rollback | Odvis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | Blokiraj vse ne-ledger pisce (W8/W9/W14/W15) | W8,W9,W14,W15 | products.ts, catalog.ts, server-schema | NE | NE | — | P0 | unit/itest | None bypass ledger | revert | — |
| P2 | StockReservationEvent (orderItemId, reservationEventId, CORRECTION, payloadHash) | W3,W4 | actions/new + checkout | DA | DA | P1 | P0 | itest | ACTIVE≥0 | restore | P1 |
| P3 | StockMovement.reservationEventId | W1,W2 | checkout | DA | DA | P2 | P1 | itest | ISSUE↔OUT 1:1 | restore | P2 |
| P4 | Legacy migrationBlock + RES_legacy izvzet | W3,W4 ... | migration/actions | NE | DA | P2 | P0 | itest | A=S−RES−legacy | restore | P2 |
| P5 | Idempotency (payloadHash + poslovna uniq) | W1–W4 | checkout/actions | DA | DA | P2,P3 | P1 | unit | no double | revert | P3 |
| P6 | Konkurenčnost (SELECT FOR UPDATE, order red) | W1–W7 | checkout/inventory | NE | NE | P2 | P1 | race | no deadlock/lost | revert | P5 |
| P7 | Fizični premiki (IN/OUT/RETURN/REPAIR/STOCKTAKE+reason, DAMAGE_RESERVED) | W5–W7 | inventory/actions | DA | DA | P2 | P1 | itest | P_owned/wh skladen | restore | P3 |
| P8 | Sledljivost serij (ProductionContribution, OrderItemBatchAllocation) | W13 | production/alloc/records | DA | DA | P1 | P1 | itest | harvest→sale trace | restore | P2 |
| P9 | Migracija (A/B/C, RES_legacy, kontrolne vsote) | (legacy) | migration | NE | DA | P2 | P0 | migr | kontrolne vsote | restore | P4 |
| P10 | E2E (full harvest→sale + mobilni) | vse | e2e | NE | NE | vse | — | E2E | POT celotna | — | P1–P9 |

---

## 11. Končni testni načrt (§13)
Unit (formule/invariante/validacija), integration (org izolacija, W-matrix, legacy, concurrency, rollback),
negativni (org, dynamic abs.set), idempotency (webhook/retry), race/concurrency, migration (A/B/C, vsote), browser
E2E (13-korakovna pot), mobilni E2E. Posebno: **noben produkcijski zapisovalec ne sme spremeniti fiz. zaloge mimo
sistema** (preverjeno vsako od W1..W15). **Ne izvajam jih — le načrt.**

---

## 12. Ločitev dokazov (§14)
Vse zgornje trditve označeno EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED. Trenutna koda
ima prednost; vse razlike proti starejšim poglavjem (W14/W15) zabeležene. Noben PROPOSED ni predstavljen kot
obstoječa funkcija.

---

## 13. Končna odločitev (§15)

Odgovori:
1. Vsi produkcijski pisci identificirani? **DA** (11: W1–W9+W14+W15; +W13 ni Product.stock). — EXIST-VER
2. Dokazano, da nobeden ne obide sistema? **NE** — W8/W9/W14/W15 abs. set mimo StockMovement, brez reserved-guard,
   brez migrationBlock (P0). — FAIL
3. Model rezervacij dovolj natančen za vez na naročila? **PROPOSED/GAP** — za legacy ni; za nove da (proposed). — PARTIAL
4. Fizična ločena od rezervacij? **DA** konceptualno (StockMovement vs StockReservationEvent), a v kodi W3/W4
   mešajo (reservedQuantity agregat); za nove da. — PARTIAL
5. Idempotency in sočasnost rešen? **PARTIAL** (CAS/status-CAS v checkoutu; multi-row/serializacija PROPOSED). — PARTIAL
6. Migracija varna brez izmišljanja? **DA (pravilo)** — legacy=B → RES_legacy, blokada; ne izmišljuj. — PASS (pravilo)
7. Sledljivost čev do prodaje arhitekturno zaključena? **PROPOSED/GAP** — model zastavljen, koda nima. — PARTIAL
8. Podprto na majhne faze? **DA** (P1–P10). — PASS

**Končna odločitev:**
**B — ARHITEKTURA ŠE NI USKLAJENA, POTREBNA JE DODATNA READ-ONLY ANALIZA.**

Razlog: obstaja 4 P0 ne-ledger abs. set piscev (W8/W9/W14/W15) brez reserved-guard/migrationBlock (FAIL pri točki 2);
rezervacijski model za legacy ni odgovorljiv (PARTIAL); StockMovement 1:1 vez RESERVE je PROPOSED, ne obstaja.
→ po pravilu §15 ni mogoča odločitev A. (Odločitev B ne preprečuje nadaljnjih read-only analiz; A zahteva vse točke.)

---

## 14. Zaključna potrditev (§16)
1. Spremenjen samo navedeni dokument: DA. 2. Koda nespremenjena: DA. 3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA. 5. Baza/testni podatki nespremenjeni: DA. 6. Nobena testna/seed skripta ni izvedena nad bazo: DA.
7. Git operacije niso izvedene: DA. 8. `einvoices.ts` in tuje spremembe nedotaknjene: DA. 9. `markec_dev`/prod
nedotaknjena: DA. 10. Faza 2D-1A ostaja neodobrena: DA.

**Povzetek statusov:** EXISTING-VERIFIED → checkout CAS/status-CAS, W1–W7 writers, pomikanje; EXISTING-PARTIAL →
W4/per-order in abs. set; PROPOSED → StockReservationEvent, StockMovement-reservationEventId, splošni model fizične
zaloge, P1–P10 faze; GAP → sledljivost serij (harvest→sale) v kodi; NOT VERIFIED → dinamični posredni pisci.
**Končni status (povzetek): PARTIAL** (ni usklajena; potrebna dodatna analiza / blokade). **Ne implementiram ničesar;
Faza 2D-1A ostaja NEODOBRENA. Čakam izrecno odločitev.**

---

# DOPOLNITEV 2D-1V — ZAKLJUČNA ANALIZA ODPRTIH ARHITEKTURNIH VRZELI ZALOGOVNEGA SISTEMA — read-only

> Zaprtje osmih odprtih vrzeli iz 2D-1U (odločitev B), brez ponovitve celotnega pregleda W1–W15. Izključno
> uskladitev odprtih problemov, enotna tehnična specifikacija in končna mtr. vrzeli. **Samo dokument; nič
> kode/sheme/migracij; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod
> nedotaknjeni. Faza 2D-1A ostaja neodobrena.**

> **Status vsake trditve:** EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED. Trenutna koda
> ima prednost. Git status ≈ 387 (nespremenjeno), diff 137 datotek (eneg.)

---

## 1. Popravljena razvrstitev P0/P1/P2 (§3)

### A. Absolutni zapisovalci fizične zaloge (ločeno od rezervacij)
| ID | Fn | abs.stock | StockMov | txn | reserved-check | desynk ledger | Risk |
|---|---|---|---|---|---|---|---|
| W9 | `updateProductVariant` catalog:148 (:171) | **DA** | **ne** | **ne** | **ne** | da | **P0** |
| W14 | `createProduct` products:299 (:332) | DA | ne | ne | ne | da | **P0** |
| W15 | `updateProduct` products:375 (:408) | DA | ne | ne | ne | da | **P0** |
| W8 | `createProductVariant` catalog:93 (:120) | DA | **ne** | ne | ne | da (na create) | **P2** |

**Klasifikacija:** P0 = lahko prepis fizične zaloge mimo StockMovement in rezervacij; W8 P2 (abs. set zgolj ob
ustvarjanju variante, ni prepis obstoječega — a prav tako brez ledgerja → prihodnje skozi zah. IN).

### B. Zapisovalci rezervacij (ločeno — NISO absolutni fiz. zapisovalci)
| ID | Fn | Tip | Fiz. zaloga? | reserved | StockMov? | Risk |
|---|---|---|---|---|---|---|
| W3 | `reserveStock` :166 | RESERVE | **ne** (samo reserved+) | da(+) | ne | P1 |
| W2 | `convertReservationToSale` :208 | ISSUE | da(−) + reserved(−) | da(−) | **da** | P1 |
| W4 | `releaseStockReservation` :187 | RELEASE | **ne** | da(−) | ne | **P0** (sproščanje brez povr.) |

- **W4 je P0 zaradi ownership-vrzeli** (sproščanje brez dokaza pripadnosti naročilu, Scenarij A iz 2D-1O), **ne**
  zato ker bi pisal fizično zalogo (ne spremeni `stockQuantity` → NI absolutni pisatelj fiz. zaloge). — izrecno.

**Popravljena matrica P0/P1/P2:**
- **P0:** W9, W14, W15 (abs. prepis fiz. zaloge), W4 (rezervacijska ownership-vrzel).
- **P1:** W1, W2, W3 (checkout reverz/izdaja brez RESERVE vezi).
- **P2:** W5–W7 (ledger), W8 (create-variante), W13 (E-record, ni stock). 
- Test/seed/demo (W10–W12) zunaj produkcijske matrike.

---

## 2. REZERVACIJA → NAROČILO → ORDER ITEM (§4)

Predlagani `StockReservationEvent` obvezna polja (po določil iz 2D-1P, z izpolnjeno povezavo na naročilo):
`organizationId, orderId, orderItemId, productId, variantId?(nullable), eventType, quantity, reservationEventId?,
correctsEventId?, idempotencyKey, payloadHash?, createdById, createdAt`.

Odgovori:
1. **Vsak RESERVE pripada enemu OrderItem?** DA (obvezen `orderItemId`) — vsaka rezervacija je vezana na
   točno en orderItem.
2. **En OrderItem več RESERVE?** DA — dovoljen, vsak s svojim RESERVE (npr. različne variante/serije).
3. **Več variant/skladišč na en OrderItem?** DA — več RESERVE na iste orderItem, vsak z lastnim `variantId`/
   `batchRecordId`; `productId`+`variantId` razločita.
4. **Delna rezervacija?** Podprta: RESERVE z manj kot orderItem.quantity; ali več RESERVE-lov (delno), z
   `Σ RESERVE(orderItem) ≤ orderItem.quantity` pri vsaki.
5. **Preklic naročila:** `RELEASE` za vse še-aktivne RESERVE tega orderItem (per RESERVE), `idempotencyKey`.
6. **Plačilo po poteku:** rezervacija je bila `EXPIRE` → `ACTIVE=0`; plačilo takrat nima več zaloge → obravnavano
   kot direkt isolacja (če sledijo razpoložljive) ali zavrnjeno; **ne pripisujejo izpotečene**.
7. **Sprememba količine naročila:** nov `RESERVE` (povečanje) ali `RELEASE` (zmanjšanje) —
   `Σ RESERVE ≤ nov orderItem.quantity`.
8. **Preprečiti sproščanje drugega naročila:** `RELEASE` z `reservationEventId` vedno referencira **isti order/
   orderItem** kot izvorni RESERVE; cross-check `orderId/orderItemId` → `MISMATCH`.
9. **Org izolacija:** vsi povezani zapisi v isti `organizationId`; preveri `requirePermissionOrg` + isti `org` na
   RESERVE/orderItem/order.

**Nedvoumna rekonstrukcija aktivne rezervacije per OrderItem:** `ACTIVE(orderItem) = Σ RESERVE(productId/variantId)
− Σ(ISSUE+RELEASE+EXPIRE)`. **Zadostno** za nove modele. — **PROPOSED** (ni v kodi). **Za legacy ni** (GAP).

---

## 3. RESERVE → ISSUE → StockMovement OUT (§5)

Povezava: `StockReservationEvent.RESERVE → ISSUE → StockMovement.OUT`; `StockMovement.reservationEventId` sklic na
`StockReservationEvent.ISSUE`. **Ta eno-stranska povezava zadostuje za 1:1** (vsak OUT ima en `reservationEventId`).
Dodaten PROPOSED: `@@unique(reservationEventId)` na fiz. OUT (zagotovi, da en ISSUE ne ustvari Ǐveč OUT).

Scenariji:
| Sc | Res. eventi | Fiz. premik | txn meja | idemKey | Stanje zaloge | Ponovitev | Rollback |
|---|---|---|---|---|---|---|---|
| A obič na | RESERVE 10 → ISSUE 10 | OUT 10 (reservationEventId=ISSUE) | ena | op123 | RES 0, S−10 | idemKey → brez | oba rev |
| B delna | RESERVE 10 → ISSUE 4, ISSUE 6 | OUT 4, OUT 6 | vsak svoja txn | opA/opB | RES 0, S−10 | idemKey per | vsak rev |
| C delno sprost. | RESERVE 10 → RELEASE 3 | (ni fiz) | ena | opC | RES 7, S brez | idemKey | rev |
| D ponovljen ISSUE | ISSUE 4 2× | OUT 4 samo 1× | ena | isti opA | RES 6 | `DUPLICATE` | — |
| E ponovn. webhook | (ISSUE) | OUT 1× (status-CAS+idem) | ena | stripe:{sid} | — | ni nov | — |
| F vračilo | (ISSUE ostane) | **IN RETURN 2** (ločen) | ena | ret1 | S+2 | idem | — |
| G izguba pred izdajo | RELEASE 2 (RES−2) | OUT loss 2 (STOCKTAKE) | ena | loss | S−2, RES−2 | idem | — |
| H direkt isolaja | (ni RESERVE) | OUT 4 (`reservationEventId=NULL`, source=ORDER) | ena | dir1 | S−4 | idem | — |

**Zahtevano (PROPOSED, shema):** `StockMovement.reservationEventId?` + `@@unique(reservationEventId)` (kjer ni null);
`StockMovement.source` vključi PRODUCTION/REPAIR/REPAIR_RETURN in `reason`.

---

## 4. Idempotency politika (§6)

- Ključ **org-unique** (`@@unique(organizationId, idempotencyKey)`) + `payloadHash` (kanonični, brez createdAt).
- **Isti ključ + ist payload** → vrnjen obstoječi rezultat; **ist ključ + drug payload** → `IDEMPOTENCY_CONFLICT`.
- Generirano po **izvorni poslovni operaciji**, ne naključnim request-id:
  - RESERVE → `reserve:{orderId}:{orderItemId}:{productVariantId}:{qty}:{nonce}`
  - ISSUE → `issue:{reservationEventId}:{qty}`
  - RELEASE → `release:{reservationEventId}:{qty}`
  - EXPIRE → `expire:{reservationEventId}`
  - CORRECTION → `corr:{originalEventId}:{nonce}`
  - StockMovement IN/OUT → linkan na ISSUE/RETURN dogodek (isti key kot vir, ali `{movId}`)
  - Stripe webhook → `stripe:{sessionId}:{eventType}` (loči completed/expired iste seje)
  - direkt isolduja → `direct:{orderId}:{orderItemId}:{qty}`
  - vračilo → `return:{outMovementId}:{qty}:{nonce}`
- Idempotency **potreben ločeno** na rezervacijskem dogodku (za ISSUE/RELEASE) in na fizičnem premiku (za OUT),
  ker sta lahko v različnih txn (npr. G). Ampak kadar sta v isti txn (A/B), skupen ključ + vez `reservationEventId`
  zadostujeta (1 kliеč = 1 mes.).

---

## 5. Konkurenčnost in zaklepanje (§7)

- **Avtoritativni vir zaklepanja:** **`ProductVariant` row** (če varianta obstaja) ali **`Product` row** (če brez).
  Pri serijah → `ProductionBatch`/`batch` ExtensionRecord. **Za artikel z varianto zaklepanje samo Product NI dovolj
  (variant ima lastno `stockQuantity`)** → zakleniti moramo **variant row**, ne product.
- **Enoten vrstni red zaklepanja:** 1) agregatni row (ProductVariant/Product/batch), 2) izvorni `RESERVE`, 3) 
  orderItem/order. V **večizdelkovem naročilu**: vedno najprej po **urejenem nizu** `(productId, variantId)` — 
  izgne deadlock ABBA. 
- Analize: lost update/double reserve/double issue/double release/overselling → preprečeno z `SELECT FOR UPDATE`
  + pogojnimi preverbami znotraj txn; deadlock → enoten red + retry ob **P2034** (idempotentne ponovitve, brez
  duplikatov prek server-uniq); delno uspešno naročilo → celotna txn rollback (ena meja naročila, vse alloc/fiz. skupaj).
- **Trans. meja:** fiz. premik + izvorni dogodek (ISSUE ali RETURN) v **ist ik sav txn** → ne moreta biti shranjena
  samo delno. Kadar (G) ločena, se uporabi vez/reservationEventId + idemKey.

---

## 6. Legacy migracija (§8)

Pravilo `A = S − RES_documented − RES_legacy_unknown`. 
1. Samodejno (A): samo dokazljivi — RESERVE z orderItemId (kjer je pripadnost dokazana).
2. Ročno (B): agregat `reservedQuantity` brez pripadnosti → `RES_legacy_unknown`, **brez** per-order operacij.
3. `RES_legacy_unknown`: ostane izvzeto iz `A` (zaklenjeno), dokler ročna uskladitev ga ne pripiše ali odpiše.
4. Blokirane operacije: RELEASE/ISSUE na RES_legacy brez atribucije; neposredna izdaja, ki bi zadel RES_legacy.
5. **Star `releaseStockReservation` ne sme poseči v novo rezervacijo:** v prehodu se legacy-pisci (W3/W4/webhook)
   **zavrnejo za migrationBlock produkte** (F3) in usmerijo na nov tok.
6. **Legacy agregat le enkrat:** idempotentna migracija + kontrolne vsote; `ON CONFLICT`/marker. Ne ugibati
   pripadnosti.

---

## 7. Celovita sledljivost (§9)

Pot + odgovori:
- **Za vsak prodan artikel:** iz katere serije (via `OrderItemBatchAllocation.batchRecordId` + `StockMovement
  batchRecordId/reservationEventId`), kateri pridelki (via `ProductionContribution.sourceRecordId`), vhod kg,
  izguba (`lossQuantity`), enote izdelanih/prodanih/ostalo/vrnjeno/poškod./odpisanih (via bilanca in dogodki).
- Podpira več pridelkov v seriji (contribution×N), en pridelek več serij, več serij v izdelku/artiklih
  (alloc×N), prodajo dela serije (alloc), delno vračilo, poškodbo, odpis, izgubo, korekcijo.
- **GAP:** trenutna koda NIMA te povezave (Product/OrderItem ni vezen na serijo; harvest/batch v E-record JSON
  nepovezan). — **PROPOSED/GAP** (ne obstoječe).

---

## 8. Enotna tehnična specifikacija (§10)
| Skladna pravila |
|---|
| Avtoritativni vir fiz. zaloge = `StockMovement` + materializiran Product/Variant |
| Avtoritativni vir rezervacij = `StockReservationEvent` (ACTIVE) |
| `A = S − RES_documented − RES_legacy_unknown` |
| Fiz. IN/OUT: vedno `StockMovement` (source+reason), txn |
| ISSUE: `StockReservationEvent.ISSUE` (+ vezi na RESERVE) + `StockMovement OUT reservationEventId` |
| RELEASE/EXPIRE: na izvorni RESERVE, `ACTIVE≥0` |
| CORRECTION: nov dogodek (correctsEventId+reason), append-only |
| Naročila: RESERVE↔orderItemId; sledljivost serij via alloc+batch |
| Idempotency: org-unique + payloadHash + poslovni ključ |
| Sočasnost: lock agregatne vrstice, enoten red, retry P2034 |
| Org: vsa rel. v isti org; requirePermissionOrg |
| Migr: A/B/C, RES_legacy, kontrolne vsote, imei |
| Audit: append-only, createdById, reason |
| Prepreči abs. set: blokiraj W8/W9/W14/W15 |

Notranje: **brez protislovja** med pravili (preverjeno; edino načelo »fiz. SPREMEMBA im vedo StockMovement« je
skladno z »CORRECTION rezervacije ne povzroči fiz. premika« — CORRECTION je računovodska, ne fiz., zato NI StockMovement).

---

## 9. Končni načrt faz (po specifikaciji) (§11)
- **P1 (pred gradnjo novega rezervacijskega sistema): BLOKIRA/PRESMERI VSE nevarne abs. pisce** (W8/W9/W14/W15)
  — strežniško (v akcijah/server-schema), NE le UI. To je **obvezna prva faza**, da se prepreči nov desynk.
- Potrjene P1–P10 (iz 2D-1U): P1 blok-abs, P2 StockReservationEvent, P3 StockMovement.reservationEventId,
  P4 legacy block+RES_legacy, P5 idempotency, P6 konkurrenc. (SELECT FOR UPDATE/enoten red), P7 fiz. premiki
  (IN/OUT/RETURN/REPAIR/STOCKTAKE+reason, DAMAGE_RESERVED), P8 sledljivost serij, P9 migracija A/B/C, P10 E2E.
- **Vsaka faza samostoCno preverljiva, ločeno odobrjivana** (ne združuj). **P1 pred P2** (prepreči nove abs. set).

---

## 10. Končna matrica odprtih vrzeli (§12)
| ID | Vrzel | Trenutno | Rešitev | Shema | Migr. | Status |
|---|---|---|---|---|---|---|
| G1 | Abs. set (W8/W9/W14/W15) | EXISTING (KRŠI) | P1 blok, skozi ledger | ne | ne | **OPEN** |
| G2 | Rezero↔OrderItem | ni (agregat) | StockReservationEvent orderItemId | da | da | **PARTIAL** (novo zadostno; legacy ne) |
| G3 | ISSUE↔StockMovement OUT | ni | StockMovement.reservationEventId + unique | da | da | **OPEN** |
| G4 | Idempotency | CAS/status delno | org-unique+payloadHash+poslovni ključ | da | da | **PARTIAL** |
| G5 | Sočasnost (variant) | CAS/status-CAS | SELECT FOR UPDATE + enoten red + retry | ne | ne | **PARTIAL** |
| G6 | Legacy | agregat neattrib. | RES_legacy, blok, idem migr. | da | da | **PARTIAL** |
| G7 | Sledljivost serij | GAP | ProductionContribution+OrderItemBatchAllocation | da | da | **OPEN** |
| G8 | Enotna spec. | — | §8 | — | — | **CLOSED** (spec. skladna) |

---

## 11. Končna odločitev (§13)

1. Razvrstitev P0/P1/P2 pravilna? **DA** (P0=W9/W14/W15/W4; P1=W1/W2/W3; P2=W5–W8/W13) — izpolnjeno.
2. Rezervacijski model nedvoumen per OrderItem? **PROPOSED-zadovoljiv za nove; legacy GAP.** — NOT fully.
3. ISSUE↔StockMovement dovolj strog? **PROPOSED** (ni sheme) → **OPEN**.
4. Idempotency dovolj opredeljen? **DA** (§6) — PROPOSED, ni v kodi.
5. Sočasnost na level Product/Variant? **PROPOSED** (variant row) → v kodi le delno.
6. Legacy varno? **DA** (pravilo RES_legacy) — a zahteva blokado.
7. Sledljivost popolnoma določena? **PROPOSED/GAP** (nis evidentano).
8. Enotna spec notranje skladna? **DA** (§8).
9. Načrt P1–P10 dovolj natančen za ločeno odobr.? **DA** (z P1 pred P2).

**Končna odločitev:**
**B — ARHITEKTURA ŠE NI USKLAJENA; POTREBNA JE DODATNA READ-ONLY ANALIZA.**

Ker vsaj tri kritične vrzeli (G1 abs. set, G3 ISSUE↔OUT vez v shemi, G7 sledljivost serij) ostajata **OPEN** in
niso implementirane, po pravilu §13 preide z B. (Odločitev A bi zahtevala, da so vse te vrzeli CLOSED oz.
dokazljivo razrešene arhitekturno, kar **niso**.)

---

## 12. Zaključna varnostna potrditev (§14/§15)
1. Spremenjen samo navedeni dokument: DA. 2. Koda nespremenjena: DA. 3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA. 5. Baza/testni podatki nespremenjeni: DA. 6. Nobena skripta ni izvedena nad bazo: DA.
7. Git operacije neizvedene: DA. 8. `einvoices.ts` in tuje nedotaknjene: DA. 9. `markec_dev`/prod nedotaknjena: DA.
10. Faza 2D-1A ostaja neodobrena: DA.

**Povzetek statusov:** PARTIAL. Kritične vrzeli G1/G3/G7 OPEN; G2/G4/G5/G6 PARTIAL/PROPOSED; G8 CLOSED (spec).
Specifikacija naj skladnosti; faze P1–P10 z obvezno P1 (blok abs. set) pred P2. **Ne implementiram ničesar; Faza
2D-1A ostaja NEODOBRENA. Čakam izrecno odločitev.**

---

# DOPOLNITEV 2D-1W — KONČNA TEHNIČNA REŠITEV G1, G3 IN G7 TER ENOTNA ARHITEKTURA ZALOGE — read-only

> Dokončna tehnična rešitev treh kritičnih vrzeli G1 (abs. prepis), G3 (ISSUE↔StockMovement OUT), G7 (sledljivost
> pridelka→prodaje), preskus medsebojne skladnosti s tremi numeričnimi primeri, migracija, specifikacija in odločitev.
> **Samo dokument; nič kode/sheme/migracij; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni;
> `markec_dev`/prod nedotaknjeni. Faza 2D-1A ostaja neodobrena. Vse prihodnje sheme PROPOSED.**

> Statusi: EXISTING-VERIFIED / EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED. Trenutna koda: `schema.prisma`
> ProductVariant (:1580 stockQuantity, :1582 reservedQuantity — variant-aware), Product.reservedQuantity :1195;
> `server-schema.ts:54` stockQuantity v whitelist; `catalog.ts:120/171`, `products.ts:332/408`.

---

## 1. G1 — Enotna zaščita vseh absolutnih zapisovalcev (W8/W9/W14/W15)

### 1.1 Tehnična rešitev (strežniška, ne UI)
**Glavni ukrep: odstranitev `stockQuantity` iz strežniške white-list (`server-schema.ts`) in iz input-handlinga
`catalog.ts`.** Ker `parseProductServerInput` vrne le whitelist polja in mass-assign strukturno odreže vse ostalo
(EXISTING-VERIFIED :6–8), bo odstranitev `stockQuantity` iz sheme zagotovila, da **nobena** produkcijska
funkcija `createProduct`/`updateProduct` še **nikoli ne prejme** `stockQuantity` do Prisme. Enako
`createProductVariant`/`updateProductVariant`.

**Zalogovne operacije se izločijo iz create/update v ločene nadzorovane akcije (vse skozi ledger):**
| Operacija | Nova/dostopna akcija | StockMovement | txn | Opomba |
|---|---|---|---|---|
| create brez zaloge | `createProduct`/`createVariant` **brez** stockQuantity | ne (zaloga 0) | da | stockQuantity ni v payloadu |
| začetna fizična zaloga | **`createStockMovement(IN, reason=OPENING_BALANCE)`** | **da** | da | ekspliciten IN, sledljiv |
| create variante | create brez stock | ne (0) | da | stock preko IN |
| cena/opis/slika | updateProduct (brez stockQuantity) | ne | da | ne vpliva na zalogo |
| admin korekcija | `createStockMovement`/`submitStockTake` s `reason` | da | da | `stock ≥ reserved` guard |
| fizični prejem | `recordDelivery` (IN) | da | da | — |
| vračilo | Stock `IN RETURN` | da | da | — |
| odpis | Stock `OUT` (STOCKTAKE/WASTE) `reason` | da | da | S-/D/- pravilno |
| inventura | `submitStockTake` | da | da | delta |
| uvoz | skozi `StockMovement` (bulk) ali blokiran | da | da | nikoli abs. set |

### 1.2 Varovalke
- **`stockQuantity` NI več v payloadu** create/update (G1-1: št.5.1);
- **`stock ≥ reserved` guard** v vseh kontrolnih op. (ne sme pod aktivne rezero);
- **variant-aware**: guard na `ProductVariant.stockQuantity/reservedQuantity` (ne le Product; :1580/:1582);
- **migrationBlock**: vse abs. set funkcije (če bi kdaj bile) preverjajo in zavrnejo;
- **transakcija**: vsaka kontrolirana op. ena txn; **ledger**: vsaka fiz. sprememba ima StockMovement;
- **sočasnost**: lock agregatne vrstice (variant) + enoten red + retry P2034.

**Specifikacija spremembe:** `server-schema.ts` — odstrani `stockQuantity` (PROPOSED); `catalog.ts:120/171`,
`products.ts:332/408` — odstrani stockQuantity iz data; produktivna forma `product-form.tsx:283` NM ne pošlje.
Validacija v strežniški shemi (whitelist). Transakcija v kontrol. akcijah. **Ne implementiram.**

---

## 2. G3 — Dokazljiva povezava ISSUE ↔ StockMovement OUT

### 2.1 Model povezave (PROPOSED, shema)
```
StockReservationEvent.ISSUE  (element RESERVE, quantity, orderItemId, reservationEventId=izvorni RESERVE)
StockMovement OUT  + reservationEventId String?  → StockReservationEvent.ISSUE
En. omejitev:  @@unique([organizationId, reservationEventId])   // ISSUE → največ 1 OUT
Indeks:        @@index([organizationId, reservationEventId])
```
- `reservationEventId` **unikaten** (kjer ni null) → en ISSUE ne more ustvariti dveh OUT; en OUT ne pripada dvema
  ISSUE (en stolpec).
- **ISSUE → StockMovement OBVEZNA** (lahko ena txn).
- **Neposredna izdaja:** `reservationEventId=NULL` + `source=ORDER` → jasno označena, izvzeta iz `@@unique`
  (partial unique samo ko ni null).

### 2.2 Primeri in stanja
| Primer | RESERVE→ISSUE→[...]→OUT | Stanje | Idempotency | rollback |
|---|---|---|---|---|
| A obič isol | RESERVE 10 → ISSUE 10 → OUT 10 | RES 0, S−10 | op123 (ena txn) | oba |
| B delna izdaja | RESERVE 10 → ISSUE 4→OUT 4; ISSUE 6→OUT 6 | RES 0, S−10 | opA/opB | vsak |
| C delno sprost | RESERVE 10 → RELEASE 3 | RES 7 | opC | — |
| D ponovlj. ISSUE | isti ISSUE 4 ×2 | OUT 4 samo 1× | `@@unique(reservationEventId)` → 2. FAIL | — |
| E ponovl. webhook | (ISSUE+OUT) | 1× | status-CAS+idem | — |
| F vračilo | OUT 4; RETURN (IN RETURN 2) | S+2; ISSUE nesprem. | ret1 | — |
| G izguba pred izdajo | RELEASE 2 (RES−2); OUT STOCKTAKE loss 2 | S−2, RES−2 | loss | — |
| H direkt isol | (ni RESERVE) → OUT 4 (reservationEventId=NULL) | S−4; ni ISSUE | dir1 | — |

**Trans. pravila:** ISSUE + OUT v **eni txn** (oba ali n.) — ni delnega shranjevanja. Pri G ločena, s
`reservationEventId`+imes jo vodi. **Idempotency:** ločen ključ za rezervacijski dogodek (RESERVE/ISSUE/RELEASE)
in za fiz. premik (OUT) — razen kadar sta v isti txn (skupen op-idem pokriva). Webhook/direkt/vračilo → sposoben.

---

## 3. G7 — Popolna sledljivost čebelarstva (harvest → sale)

### 3.1 Model (PROPOSED)
```
Harvest (ExtensionRecord bee-apiary, JSON) ── ProductionContribution (batch, source, inputKg/netKg/lossKg)
ProductionBatch (ExtensionRecord batch) ── StockMovement IN (source=PRODUCTION, batchRecordId, qty=enote)
Product/Variant ── OrderItemBatchAllocation (orderItem↔batch, qty)
StockReservationEvent (RESERVE/ISSUE/RELEASE + orderItemId) 
StockMovement OUT (source=ORDER, reservationEventId) ── Sale
```

### 3.2 Povezava kg → enote (decimalna natančnost)
- `ProductionContribution`: `inputQuantity`/`netQuantity`/`lossQuantity` **Decimal(14,4)** (kg) — ne izračun
  samodejno; **vnos realnega tehtanja** (kot 2D-1E/1F). 
- `units`: `StockMovement.batchRecordId` IN PRODUCTION quantity (Int kosov).
- Neto kg na enoto = `netQuantity / units` (Decimal). Količina v prodanih enotah → kg zopet skozi to razmerje.
- **Nobena pretvorba ni namišljena samodejno** (uporabnik vnese dejansko units+inputKg).

### 3.3 Odgovori za vsako prodano enoto
1. serija → `OrderItemBatchAllocation.batchRecordId` / `StockMovement OUT batchRecordId`;
2. pridelki → `ProductionContribution.sourceRecordId`;
3. vhod kg → `contribution.inputQuantity`;
4. izguba → `contribution.lossQuantity`;
5. enote izdelanih → IN PRODUCTION;
6. enote prodanih → OUT ORDER (per batch);
7. ostalo → `S_batch` (IN−OUT−return) ledger;
8. vrnjeno/poškod./odpisano → RETURN/D in bilanca.

---

## 4. Preskus medsebojne skladnosti G1+G3+G7 (§6)

**Verig:** Harvest → ProductionBatch → Product → StockMovement IN → Reservation → Alloc → ISSUE → StockMovement
OUT → Sale. Dokazi:
- začetna zaloga NE more obiti ledgerja (G1: abs. set blokiran; samo IN skozi ledger);
- IN poveča zalogo enkrat (tranz. 1:1);
- rezervacija NE spremeni fiz. zaloge (RESERVE ni StockMovement);
- ISSUE zmanjša fiz. samo enkrat (ISSUE+OUT 1:1, `@@unique(reservationEventId)`);
- StockMovement OUT ni podvojeno (idem + unique + status-CAS);
- prodaja ≤ serijska zaloga (`alloc.qty ≤ S_batch`; `Σ alloc ≤ IN PROD `), `NEGATIVE_BATCH`);
- vračilo ne spremeni ISSUE (IN RETURN ločen);
- popravek serije ne prepiše (CORRECTION, append-only);
- kg↔enote usklajeno (Decimal; tehtanje);
- rezervacije ≤ razpoložljivo (`RES ≤ S`, `A≥0`);
- org izolacija (vsi org-scoped, requirePermissionOrg).

### 4.1 Primer A — obična proizvodnja in prodaja
```
Harvest H1: 10 kg. Contribution B1: input 10, net 9.5, loss 0.5, units 19.
IN PRODUCTION 19 → S_B1=19.
RESERVE 10 (order#1, alloc B1 10) → RES=10, A=9.
ISSUE 7 + OUT 7 → S_B1=12, RES=3, A=9, I=7.
Konč: S=12, RES=3, A=9, I=7. [Trace: 7 → B1 → H1 (7×0.5=3.5 kg net).]
```

### 4.2 Primer B — več pridelkov in več serij
```
H1: 10 kg → B1 (19 koz, 0.5 izguba); H2: 7 kg → B2 (13 koz, net 6.5, loss 0.5).
Order#1 item X: 10 kosov iz B1(6)+B2(4) → alloc B1:6, B2:4.
Reserve B1 6 (RES_B1=6), B2 4 (RES_B2=4).
Issue 6 from B1 (OUT 6), 4 from B2 (OUT 4) → S_B1=13, S_B2=9, RES_B1=0, RES_B2=0, I=10.
Trace: 6→B1(H1 10kg, 3kg net), 4→B2(H2 7kg, 2kg net). 
Konč: S_total=22 (13+9), RES=0, A=22, I=10.
```

### 4.3 Primer C — vračilo in poškodba
```
Začetek kot A: S_B1=12, RES=3, I=7.
RETURN resellable 1 → S_B1=13 (fiz.IN RETURN; ISSUE nespremenjen). R=1.
RETURN damaged 1 → D_B1=1, P_wh=14 (S13+B1... ), S ostane 13. R=2, damage=1.
Konč: S=13, D=1, RES=3, A=13−3=10, I=7, R=2, Neto=5, damage=1. P_wh=S+B+D=14.
Trace: 7 net-sold → B1; 1 vrnjen prodajno; 1 poškodovan → D.
```
**Vsi trije primeri konvergirajo (P=S+D+Rep, A=S−RES, Neto=I−R) in konservacija drži — nič 2×, nič izgubljeno.**
Ni bilo potrebno popravljati modela (vse skladno).

---

## 5. Migracija in združljivost (§7)
| Predmet | Auto-bilago | Ročno/Ročno | Legacy | Blokiraj med migr. |
|---|---|---|---|---|
| obst. izdelki/variant z zalogo | **baz. StockMovement IN (OPENING_BALANCE)** — zabeleži stanje (ni izvirna provenance) | — | stockQuantity zap. | abs. set |
| stare reserve brez povezave | — | — | `RES_legacy_unknown` streže A | RELEASE/ISSUE |
| obst. StockMovement | ohranjeni (že ledger) | — | — | — |
| obst. harvest/batch (E.record JSON) | ohranjeni kot proizvodnja | — | niso povezani na stock (GAP provenance) | — |
| legacy reservedQuantity | kontrolne vsote | ročni pregled | RES_legacy | abs. op. |
| naročila brez alokacije | — | — | ne-traceable (ni namišljena serija) | — |

Migracija: NIkoli ne izmisli povezave; `StockMovement IN OPENING_BALANCE` je **kontroliran zapis trenutne fiz.
zaloge** (ne trditev o izvoru). Preverba začetne bilance (`Σ IN − Σ OUT == stockQuantity`), dvojno knjiženje →
idempotentna migr. + vsote; rollback → kopija. **Franky: popolna migracija (serijska sled za obstoječe) NI mogoča
brez ročnega pregleda — nove povezave nastanejo le za novo, ne za staro.**

---

## 6. Enotna tehnična specifikacija (§8) — povzetek
Podatkovni modeli/relacije/uniq/indeks: `StockReservationEvent` (org, orderId, orderItemId, productId, variantId?,
reservationEventId?, correctsEventId?, type, quantity, idemKey, payloadHash?, createdById; `@@unique(org,idemKey)`;
indeks org/orderItem/reservationEvent), `StockMovement` (+reservationEventId, `@@unique(org,reservationEventId)`
partial, `@@index(allocationId/batchRecordId/returnOfMovementId)`), `ProductionContribution`
(`@@index(org,batch/source)`), `OrderItemBatchAllocation` (`@@unique(org,orderItem,batch)`). Trans. meje, fiz.
pravila, ISSUE/RELEASE/EXPIRE/CORRECTION, idempotency, sočasnost (lock agregat=variant, enoten red, retry P2034),
org-scope, sledljivost serij, migr. pravila, audit (append-only). — **PROPOSED** (vse sheme prihodnje).

---

## 7. Končni vrstni red (§9)
**P1 (prva): BLOKIRA vse abs. set (W8/W9/W14/W15)** — strežniško, pred gradnjo novega sistema; nato P2
(StockReservationEvent), P3 (StockMovement.reservationEventId), P4 (legacy+RES_legacy), P5 (idempotency), P6
(sočasnost SELECT FOR UPDATE), P7 (fiz. premiki RETURN/REPAIR/STOCKTAKE+reason/DAMAGE_RESERVED), P8 (sledljivost
serij: ProductionContribution+OrderItemBatchAllocation), P9 (migracija A/B/C), P10 (E2E). Vsaka faza majhna,
samostojno preverljiva, zasnovana za rollback. **P1 obvezno pred P2.**

---

## 8. Končna odločitev (§10)

1. G1 rešen arhitekt? **DA** (odstranitev stockQuantity iz server whitelist + kontrolirane ledger op., `stock≥reserved`,
   variant-aware, txn, migrationBlock). — PROPOSED.
2. G3 rešen arhitekt? **DA** (`StockMovement.reservationEventId` + `@@unique(org,reservationEventId)`; 1:1;
   neposredna izdaja ločena; 8 primerov). — PROPOSED.
3. G7 rešen arhitekt? **DA** (ProductionContribution + OrderItemBatchAllocation; kg↔enote via Decimal+tehtanje; 8
   odgovorov sledljivo). — PROPOSED.
4. Medsebojna skladnost? **DA** (primeri A/B/C konvergirajo; nobena količina ni podvojena/izgubljena).
5. Migracija varno določena? **DA** (A/B/C, RES_legacy, OPENING_BALANCE brez izmišljanja provenance; blokada abs. set).
6. Čebelarja mogoče dokončati brez ponovnega oblikovanja jedra? **DA** (specifikacija zaključuje G1+G3+G7).
7. Načrt razdeljen na majhne faze? **DA** (P1–P10, P1 pred P2).

**Končna odločitev:**
**A — G1, G3 IN G7 SO ARHITEKTURNO REŠENI. SPECIFIKACIJA JE PRIPRAVLJENA ZA LOČENO ODLOČANJE O IMPLEMENTACIJI.**

- To NI dovoljenje za implementacijo. Vse shema-spremembe so PROPOSED; vsaka faza (P1–P10) zahteva ločeno izrecno
  odobritev. Čebelarsko dejavnost je po tej specifikaciji mogoče dokončati brez ponovnega oblikovanja zalogovnega
  jedra.

---

## 9. Zaključna potrditev (§11)
1. Spremenjen samo navedeni dokument: DA. 2. Koda nespremenjena: DA. 3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA. 5. Baza/testni podatki nespremenjeni: DA. 6. Nobena skripta ni izvedena nad bazo: DA.
7. Git operacije neizvedene: DA. 8. `einvoices.ts` in tuje spremembe nedotaknjene: DA. 9. `markec_dev`/prod
nedotaknjena: DA. 10. Faza 2D-1A ostaja neodobrena: DA.

**Povzetek statusov:** PROPOSED (vse tri rešitve arhitekturno razrešene, numerično in logično skladne, cCakajo
ločeno odobritev podfaz). **Končni povzetek: PARTIAL→A-ready** (arhitektura usklajena, implementacija NI
odobrena). **Ne implementiram ničesar; Faza 2D-1A ostaja NEODOBRENA; čakam izrecno odločitev o vsaki fazi
posebej.**

---

# DOPOLNITEV 2D-1X — POPRAVEK FIZIČNE BILANCE B IN VALIDACIJA OPENING_BALANCE — read-only

> Dve ciljni preverbi: (A) ali fizična bilanca vključuje kategorijo B, (B) ali `OPENING_BALANCE` obstaja v
> `StockMovementSource`. Preverjeno na dejanskem repozitoriju; samo dopolnitev dokumenta. **Nič kode/sheme/
> migracij; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod nedotaknjeni. Faza
> 2D-1A ostaja neodobrena. Statusi EXISTING-VERIFIED / PROPOSED / GAP / NOT VERIFIED.**

## 0. Stanje
- Git status ≈ 387 vnosov (nespremenjeno), diff 137 datotek.
- `prisma/schema.prisma`: `StockMovementSource` (:2120–2128) = `MANUAL, ORDER, DELIVERY, STOCKTAKE, RETURN`.
  **`OPENING_BALANCE` NE obstaja** (prav tako ne `PRODUCTION` — potrebno za G7, a izven te faze).
- `StockMovement` (:2130): `source` default `MANUAL` (:2137), `note` (:2138), `quantity Int`, `direction`.

---

## 1. PREVERBA A — kategorija B v fizični bilanci

### 1.1 Kanonske enačbe (potrjeno, da B že vključena)
```
S  = prodajna v skladišču      ; B = umaknjena, fizično v skladišču
D  = poškodovana v skladišču   ; Rep = pri zunanjem popravilu
W  = dokončna izguba/odpis     ; Sold = prodana
P_warehouse = S + B + D
P_owned     = S + B + D + Rep
A           = S − RES
```
**Potrditev:** kanonske formule (2D-1L §1.3, 2D-1Q §5.1, 2D-1R §3, 2D-1W §4) **že vključujejo B** v
`P_warehouse` in `P_owned`. **Noben prejšnji numerični primer ni izpustil B** (primeri v 2D-1W so imeli B=0;
kjer B>0, je v bilanci). → **Nobena prejšnja enačba ni bila napačna**; ta dopolnitev to le nedvoumno zapisuje.

### 1.2 Razlikovanje štirih tipov sprememb
| Sprememba | Fiz. količina (P) | Prodajna razp. (A) | Lastniš. | RES |
|---|---|---|---|---|
| prodaja (OUT ORDER) | − | − | − | (ISSUE −) |
| vračilo prodajnega (IN RETURN resellable) | + | + | + | 0 |
| poškodovano vračilo (IN RETURN false) | + (D) | 0 | + | 0 |
| umik S→B | **0** (P_wh nesprem.) | − | 0 | 0 |
| ponovna aktiv. B→S | 0 (P_wh nesprem.) | + | 0 | 0 |
| popravilo ven S→Rep | P_wh −, P_owned 0 | 0 | 0 | 0 |
| vrnitev s popravila | P_wh + | odvisno | 0 | 0 |
| dokončna izguba | P_wh −, P_owned − | (S−) | − | (RELEASE) |
| fizični odpis | P_wh − | odvisno (D/S) | − | 0 |
| rezervacija/sprostitev | **0** (ni fiz.) | −/+ | 0 | +/− |

**Ključno:** umik iz prodaje (S→B) **NE zmanjša fizične zaloge** (P_wh enaka); rezervacija **ni fizični premik**.

### 1.3 Numerični dokaz (20 enot)
```
#  Dogodek                       S   B   D   Rep  W  Sold RES  P_wh   P_owned  A=S−RES  I
0  (20 IN PRODUCTION)           20  0   0   0   0  0    0    20    20       20      0
1  (3 rezervirane)              20  0   0   0   0  0    3    20    20       17      0
2  (5 prodanih)                 15  0   0   0   0  5    3    15    15       12      5
3  (2 umaknjeni S→B)            13  2   0   0   0  5    3    15    15       10      5
4  (1 poškodovana S→D)          12  2   1   0   0  5    3    15    15        9      5
5  (1 popravilo S→Rep)          11  2   1   1   0  5    3    14    15        8      5
6  (1 izguba S→W)               10  2   1   1   1  5    3    13    14        7      5
```
**Končno:** P_wh=13, P_owned=14, S=10, B=2, D=1, Rep=1, W=1, Sold=5, RES=3, A=7, I=5, R=0, poškodovano=1.
**Ohranitev:** 20 = 5(Sold)+10(S)+2(B)+1(D)+1(Rep)+1(W) ✓. P_owned = P_wh+Rep = 13+1 = 14 = 20−5−1 ✓.
**Umik (kor.3) ne zmanjša P_wh (15)**; **popravilo (kor.5) ne zmanjša P_owned (15)**; **izguba (kor.6) zmanjša
last (15→14)**.

**Razlika odpis vs izguba:** »dokončna izguba« = izguba lastnišva (enota zapusti skladišče+last) →
`OUT_loss_sellable` (S−, P_wh−, P_owned−, W+). Fizični odpis poškodovanega (druga op.) bi zmanjšal le `D`+`P_wh`,
S bi ostal. Stojita ločeno.

---

## 2. PREVERBA B — `OPENING_BALANCE`

### 2.1 Dejansko stanje (EXISTING-VERIFIED)
- `StockMovementSource` (prisma:2120–2128) = `MANUAL, ORDER, DELIVERY, STOCKTAKE, RETURN`.
- **`OPENING_BALANCE` NE obstaja** → **PROPOSED.**

### 2.2 Primerjava
| Možnost | Prednost | Slabost |
|---|---|---|
| A) nova enum `OPENING_BALANCE` | audit ločen, filtriranje/verifikacija začetne bilančne vrstice | +1 enum; migr. |
| B) MANUAL + reason | brez nov. enum | ni ločen tip v enumu → težje verifikacija |

**Priporočilo: A — nova enum vrednost `OPENING_BALANCE`** (poleg PRODUCTION/REPAIR/REPAIR_RETURN za G7). Razlog:
audit ločuje začetni saldo od običajnih prilagoditev; omogoča »ne več kot ena opening balance per product/variant«
in kontrolne vsote ob migraciji.

### 2.3 Obvezna polja (PROPOSED)
`organizationId`, `productId` ali `productVariantId`, `direction=IN`, `quantity`, `unit`, `source=OPENING_BALANCE`,
`createdById`, `reason`, `createdAt`, **`openingBalanceId` (migracijski marker)**, **`idempotencyKey`**.
**Preprečitev dvojnega knjiženja:** `@@unique(org, openingBalanceId)` ali `@@unique(org, idempotencyKey)` +
aplikativna preverba »ena opening balance per (org,product/variant)« (txn + retry P2034).

### 2.4 Pomembna razlika
Začetni saldo **dokazuje začetno količino ob uvedbi sistema — NE dokazuje izvora/serije/pridelka.** Ne sme
samodejno ustvariti povezave na stari harvest/batch (G7: opening balance = baseline, ne lažna provenance).

---

## 3. Skladnost z 2D-1W
- **G1:** `OPENING_BALANCE` = kontroliran `StockMovement IN` (skozi ledger) → ni konflikt; začetno stanje gre
  vedno skozi ledger, ne abs. set.
- **G3:** opening balance je IN (ni ISSUE) → nima `reservationEventId` → ne vpliva na `@@unique`.
- **G7:** opening balance = baseline brez lažne povezave na serijo/pridelek; PRODUCTION nosi dejansko proizvodnjo.
- **Migracija starih rezervacij:** `RES_legacy_unknown` nespremenjeno; opening balance ne vpliva.
- **Serijska sledljivost / primeri A,B,C:** kanonska formula že vključuje B; **nobena enačba v 2D-1W ni bila
  napačna** (v 2D-1W primerih je B=0; pravil je tu nedvoumno zapisan).

---

## 4. Končna odločitev (§6)
1. S,B,D,Rep v bilanci? **DA** (B v P_wh/P_owned; dokaz §1.3).
2. Fiz/last/razpolož. ločene? **DA**.
3. Enačbe skladne? **DA** (20 enot konservacija).
4. `OPENING_BALANCE` obstoječ? **NE — PROPOSED**.
5. Priporočena rešitev? **nova enum vrednost `OPENING_BALANCE`**.
6. Dvojno knjiženje preprečeno? **DA** (openingBalanceId + idemKey + »ne več kot ena«).
7. G1/G3/G7 skladni? **DA**.
8. Dodatna analiza? **NE**.

**Končna odločitev:**
**A — OBE TOČKI STA RAZREŠENI. DOPOLNITEV 2D-1W JE MATEMATIČNO IN TEHNIČNO USKLAJENA. PRIPRAVLJENA ZA LOČENO
ODLOČANJE O IMPLEMENTACIJI.** (To NI dovoljenje za implementacijo; `OPENING_BALANCE` je PROPOSED.)

---

## 5. Zaključno poročilo (§7)
- **Spremenjen dokument:** `docs/...-IMPLEMENTATION-PLAN.md` (dodano poglavje 2D-1X). Novo število vrstic: več kot
  3340 (dokument se poveča za to poglavje).
- **Ugotovitve A:** B kanonsko v bilanci; numerični dokaz 20 enot skladen; umik ne zmanjša P_wh, popravilo ne
  zmanjša P_owned, izguba zmanjša last.
- **Ugotovitve B:** `OPENING_BALANCE` NE obstaja; priporočena nova enum vrednost (ne MANUAL+reason); baseline brez
  lažne provenance.
- **Popravljene enačbe:** nobena (vse pravilne od prej, potrjene).
- **Numerični dokaz:** §1.3.
- **Priporočena rešitev OPENING_BALANCE:** nova enum + `openingBalanceId`/`idempotencyKey`.
- **Končna odločitev A.**
- **Status:** PASS (obe točki); splošno PARTIAL→A-ready (`OPENING_BALANCE` PROPOSED).

**Potrditev:** 1. Samo navedeni dokument: DA. 2. Koda nespremenjena: DA. 3. `schema.prisma` nedotaknjen: DA.
4. Ni migracij: DA. 5. Baza/testni podatki nespremenjeni: DA. 6. Nobena skripta nad bazo: DA. 7. Git neizvedene: DA.
8. `einvoices.ts` in tuje nedotaknjene: DA. 9. `markec_dev`/prod nedotaknjena: DA. 10. Faza 2D-1A ostaja neodobrena: DA.

**Ne implementiram ničesar. Faza 2D-1A ostaja NEODOBRENA. Čakam izrecno odločitev.**