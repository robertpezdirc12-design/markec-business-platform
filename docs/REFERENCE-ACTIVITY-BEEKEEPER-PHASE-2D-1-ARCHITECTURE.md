# MARKEC — FAZA 2D-1: SLEDLJIVOST PRIDELKA MEDU (ARHITEKTURA / READ-ONLY)

> Analiza obstoječega stanja + načrt povezave **pridelek → polnjenje → izdelek → serija → zaloga → naročilo → prodaja**.
> **Izključno pregled — nič kode/sheme/baze/migracij/testnih podatkov ni spremenjeno.** Vse ugotovitve potrjene v
> kodi (navedene datoteke/vrstice). Varovalno: tuj WIP (`prisma/schema.prisma`, `einvoices.*`) nedotaknjen.
> Oznake: PASS (obstaja) / MISSING (manjka) / PARTIAL (delno).

---

## 1. Obstojča arhitektura (potrjeno)
### 1.1 Gotovinski modeli (prisma/schema.prisma)
| Model | linija | Ključno |
|---|---|---|
| `Product` | 1177 | `price`, `trackInventory`, `stockQuantity Int`, `reservedQuantity Int`, `forSale`, `unit` (default "kos"), `vatRate`, `barcode`, `reorderPoint`, `categoryId`, `images`, `@@unique([organizationId, sku])` |
| `ProductVariant` | 1572 | lastni `sku/price/trackInventory/stockQuantity/reservedQuantity`, `productId` (Cascade) — en izdelek lahko ima več variant (npr. 250/500/900 g) |
| `StockMovement` | 2130 | `direction (IN/OUT)`, `source (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN)`, `quantity Int>0`, `orderId`, `supplierRecordId→ExtensionRecord`, **`batchRecordId→ExtensionRecord`**, `createdById` |
| `Order` / `OrderItem` | 1244 / 1303 | `OrderItem.productId+variantId` (mehka, snapshot `variantName/Sku/Price`) — **NI batch/serije** |
| `ExtensionRecord` | 1533 | univerzalni zapis org-scoped; entitete `batch` (batch-production), `harvest` (bee-apiary) |

### 1.2 Harvest – Pridelek medu (extensions.ts, entity `harvest`)
- Polja: `harvest_date` (required), `apiary` (text), `apiary_ref` (entityReference→apiary), `honey_type` (select),
  `quantity_kg` (number, kg), `hives_count`, **`product_reference` (TEXT**) – prosto besedilo, `notes`.
- **`product_reference` je navadno besedilno polje** (ne relacija): ne povezuje harvesta z izdelkom/serijo,
  ni org-validacije, ni sledljivosti. **Za zahtevo o sledljivosti NI dovolj.**

### 1.3 Sistem izdelkov (PASS)
- Product + ProductVariant — en izdelek z več različicami (Akacijev 250/500/900 g) podprt; posebna zaloga per variant.
- Category, cene (bruto + vatRate), fotografije (`images[]`), SKU/barcode per tenant — vse obstaja.

### 1.4 Sistem zalog (StockMovement) — enoten, PASS
- **Povečanje zaloge** (IN): `createStockMovement({direction:IN, quantity, productVariantId?, supplierRecordId?, batchRecordId?})` v `inventory.ts`.
- **Zmanjšanje ob prodaji** (OUT): `product-checkout.ts:110-135` ob checkout/plačilu `direction:"OUT", source:"ORDER", orderId` (za product in variant) → zd advertiranje.
- **Negativna zaloga**: preprečen prek `computeStockDelta` (iz `src/lib/inventory/stock.ts`) — zavrnjeno `NEGATIVE_STOCK` pred write.
- **batchRecordId**: `inventory.ts:29/136-142` — povezuje StockMovement s `ExtensionRecord` entiteto `batch` (org-scoped).
- **Pravila / t vrednost**: `quantity Int > 0`; `source` validiran.

### 1.5 Prodaja/naročila
- `OrderItem` ima `variantId` (mehka relacija) + snapshot — **NI `batchRecordId`**.
- `product-checkout.ts` ob naročilu ustvari StockMovement OUT source ORDER; povezava s serijo v StockMovement NI nastavljena (batchRecordId null).

## 2. Kaj že deluje (PASS)
1. Splošna izdelka + različice z lastno zalogo. ✅
2. StockMovement ledger (IN/OUT/ORDER, neg-zaloga preprečena, org-scope). ✅
3. Ob naročilu se zaloga zmanjša + napisane StockMovement OUT source ORDER. ✅
4. `batchRecordId` na StockMovement (veže na ExtensionRecord entiteto `batch`). ✅
5. Harvest entiteta za zapis pridelka (kg, vrsta, postaja, datum). ✅
6. ExtensionRecord + entityReference vse org-scoped. ✅

## 3. Kaj manjka (MISSING / odgovor na §6)
**ALI sistem dandanes lahko ugotovi iz katere proizvodne serije izvira prodani kozarec? → NE.**
- `OrderItem` nima `batchRecordId`/serije → **prodaje ni mogoče povezati z določeno serijo ali pridelekom**.
- `harvest.product_reference` je text → **pridelek ni povezan s serijo/izdelkom**.
- Ni "polin"}, ki bi iz `harvest.quantity_kg` → `ProductVariant.stockQuantity` po `packaging` (g/enot) izračunal število kozarcev in porabljeno količino.
- Ni vira `PRODUCTION` (ali IN-proizvodnje) v `StockMovementSource` — proizvodnja se knjiži kot MANUAL IN, brez avtomatike in brez povezave na pridelek.
- Ni revizijske sledi za genezaje polinjenja (kot append-only event; generic CRUD bi po Sloven dovolil spreminjanje).

## 4. Priporočena arhitektura
Veriga (vse realne relacije, ne text):
```
harvest (ExtensionRecord bee-apiary)  ←── fill (polinjenje: pridelek/količina+pakiranje+enote)
   │                                    └──> batch (ExtensionRecord batch-production) — serija
   └──> StockMovement IN (source=PRODUCTION, batchRecordId=batch.id, productVariantId=...)
   ob naročilu: OrderItem.productId/variantId + NorthItem.batchRecordId (nova mehka)
                 + StockMovement OUT (source=ORDER, batchRecordId=batch.id) → izvor prodaje
```
- **Serija** = obstoječa `batch` entiteta (batch-production) — **NE** nova serijska entiteta (skladno z §7).
- **Polinjenje** = novo (append-only) proizvodno dejanje (npr. entiteta v bee-apiary ali "fill event"), ki:
  - izbere harvest (pridelek),
  - izbere batch (serija) ali ga ustvari,
  - izbere ProductVariant (packaging, npr. 500 g),
  - število enot + realna pakirana količina (berin izgube/nepopolna polinjenja — ni izključno GF matematica), izračuna porabljeno/ostanek pridelka,
  - ustvari **en** StockMovement IN (source PRODUCTION, batchRecordId) — anti-duplicate z IDEMPOTENCY ključem (npr. `@unique fillId` ali `note/idempotency`).

## 5. Potrebne spremembe sheme (predlog — NI izvedeno)
Najmanjši varen poseg (ob prihodnji odobritvi + uskladitvi s tujim WIP):
1. **`OrderItem.batchRecordId String?`** + `batchRecord ExtensionRecord? @relation(...) onDelete:SetNull` + `@@index([batchRecordId])` — **nujno** za sledljivost prodaje (ni ga mogoče uporabiti iz obstoječega polja).
2. **`StockMovementSource` + `PRODUCTION`** (eno novo enum vrednost) + morda `FILL_WASTE` — za "IN iz proizvodnje"; brez tega bi proizvodnja bila zamenjana z MANUAL in izgubila možen aktivit.
3. (opcija) **`harvest`-relacijska vez ali novo polje `batchId` na harvest** — POenostavi "polinjenje iz pridelka", ampak jagodizni nova relacija na ExtensionRecord ni potrebna; dovolj je, da polinjenje veže harvest id v JSON/entiteto.

Vse relacije org-scoped, onDelete previdno (SetNull za zgodovino, ne Cascade). Migracija ob odobritvi (ni tu izvedena).

## 6. Predlagane strežniške akcije
- **`createFillBatch`** (append-only, kot colony_move vzorec): input `{ harvestId, batchId (ali createBatch), productVariantId, units, packedGrams, fillDate, reason? , idempotencyKey }` → transakcija:
  1. preveri harvest/batch/variant v ISTI org + units>0 + packedGrams>0 + dovolj pridelka (ne ob teži) → `INSUFFICIENT_HARVEST` če ne,
  2. izračuna porabljeno (packedGrams; dejansko, z izgubami) in ostanek (harvest left = harvested - alreadyFilled),
  3. ustvari fill event (append-only) + **en** StockMovement IN (source PRODUCTION, batchRecordId, productVariantId, quantity=units) z idempotency enot → druga ponovitev → `DUPLICATE_FILL`,
  4. rollback ob vsaki napaki.
- **`correctFill`** — nov korekcijski event (kot correctColonyMove), NE urejanje starega.
- **Rekonstrukcija izvora prodaje** (`resolveOrderItemProvenance(orderItemId)`) → poišče StockMovement OUT tega orderItem/serije + batch + harvest → UI prikaže "iz pridelka X (postaja, vrsta, datum, kg)".

## 7. Poslovna pravila (analiza primerov):
1. **10 kg → 20×500 g** = izračun 10 kg = 20×0.5 kg; porabljeno 10 kg, ostanek 0 ✓.
2. **10 kg → 10×500 g + 5×1 kg** = 5 kg + 5 kg = 10 kg, ostanek 0 ✓ (dve polinjenji iz istega pridelka v eno ali dve seriji).
3. **10 kg → 8 kg polinjenja + 2 kg ostanka** = ostanek 2 kg se še naprej bere kot razpoložljivo za drugo polinjenje (harvest.remaining = quantity_kg − Σ filled). 
4. **Polinjenje iz dveh pridelkov** → fill event z dvema harvest prispevkoma (line-item), vsak ohrani izvor; serija = mešanica → prikaz "mešanica: [pridelek A (Cvetlični, …), B (…)]".
5. **En pridelek v več serij** → več fill eventov, vsak s svojo batchId ✓ (batch ni 1:1 s harvest).
6. **Različne vrste medu se ne smejo pomešati** → validacija: vsi harvest-i v enem fillu morajo imeti isti `honey_type` → `HONEY_TYPE_MISMATCH`.
7. **Popravek napacno količino** → nov korekcijski fill/korekcija, NE spreminjanje starega (append-only).
8. **Preklic knjižene proizvodnje** → morda ne samo "delete fill"; predlog: `cancelFill` (new append-only event, torej "REVERSAL" StockMovement OUT/PRODUCTION na stran serije) — ne briše zgodovine.
9. **Vračilo prodanega izdelka** → obstoja RETURN source (StockMovement RETURN) + dodatno batchRecordId → zaloga se vrne, sledi seriji.
10. **Prodaja več kot zaloga** → NEGATIVE_STOCK zavrnitev (že obstaja) ✓.

## 8. Uporabniška pot (predlog, ni UI v tej fazi)
- Polinjenje se nahaja v območju **Evidence → (Pridelek medu)** ali **Izdelki → (variant)** — najbolj naravno **odprite "Pridelek medu" (harvest)** s CTA **"Napolni v kozarce"**; ali na strani izdelka "Polinjenje". Brez novega menija.
- Dashboard (2D-2 pozneje): kartica "Pridelek/Polinjenje/Zaloga/Prodest" — koliko kg pridelanih, ostankov, kozarcev na zalogi, prodanih, iz katerega pridelka (prek resolveProvenance).

## 9. Varnost in izolacija organizacij
- Vse akcije `requirePermissionOrg` (org iz seje/membership) — enako kot danes.
- harvest/batch/product/variant vsaj org-scope; neveljavna/tuja referenca → `INVALID_REFERENCE`.
- `StockMovement` org-scope + `NEGATIVE_STOCK`; anti-duplicate (idempotency) za proizvodnjo.
- Append-only za `fill` (zaščiteno prek appendOnly flag / guard — kot colony_move).

## 10. Transakcije in zaščita pred podvojenimi knjiženji
- Ena transakcija (createFill): preveri od + izračun + event + StockMovement IN → rollback ob neuspehu.
- **Idempotency**: `fillEvent.idempotencyKey @unique(org)` — ponovni zahtevek z istim ključem → `DUPLICATE_FILL` (ne dvojno knjiženje).
- **Sočasnost**: row-lock na harvest (kot colony move FOR UPDATE) → dva hkrati diferente nelogik (preostanek ne postane negativen).
- Revizijska sled: append-only fill eventi (is_correction/cancel) + `createdById`.

## 11. Testni načrt (napr. za 2D-1A..E)
- en pridelek + ena serija; en pridelek + več serij; več pridelkov (mešanica) + serija;
- različna pakiranja (250/500/900 g); delna poraba + ostanek; junk-ockup (duplicate knjiženje);
- sočasna knjiženja (row-lock); preklic; vračilo; negativna zaloga; cross-org IDOR; napačna referenca; idempotency/replay;
- **preverba v bazi** (ne UI): StockMovement vrstica, OrderItem.batchRecordId, harvest.remaining, serija vira.

## 12. Razdelitev implementacije (predlog — NE začenjamo)
- **2D-1A** shema (OrderItem.batchRecordId + StockMovementSource.PRODUCTION + morebiten harvest batch) + migracija/uskladitev s tujim WIP + tsc/testi sheme.
- **2D-1B** createFillBatch (transakcija, anti-dup, ostanek, vrste medu) + unit/itest.
- **2D-1C** knjiženje StockMovement IN (PRODUCTION) + preklic/vračilo (REVERSAL/RETURN + batch).
- **2D-1D** sledljivost prodaje (OrderItem.batchRecordId set v checkout + resolveProvenance) + itest.
- **2D-1E** browser E2E celotne verige (pridelek→polinjenje→zaloga→naročilo→izvor) + regresija.

## 13. Tveganja / odprta vprašanja
- **Tuj WIP schema.prisma** — vsaka shema-sprememba zahteva ločeno odobritev + uskladitev lastnika aí grantjeno.
- **enotni "kg/kozarc"** — količine na ProductVariant so Int (koz), harvest v Decimal kg → pretvorba mora upoštevati dejansko polnilo (netesnosti, izgube) — ni samo GF deljenje.
- **negativna zaloga pri polinjenju medu** — ne sme prodati več kot je v seriji (NEGATIVE zaloga obstaja na URODU, ampak serijska množina naj se spremlja per batch).
- **mešanje vrst medu** — hro si mora pravilo (HONEY_TYPE_MISMATCH) implementirati ob polinjenjih, ne zaust po generični zalogi.
- **replay/ponovni klik** — idempotencyKey je ključen; brez shem-polja se da, ampak relacijska zaščita je zanesljivejša.
- **kdo lahko "pol"** — ista perm kot records (workorders.manage) ali nova pravica (odločitev kasneje).

---

# DOPOLNITEV 2D-1B — VEČIZVORNA PROIZVODNJA IN KOLIČINSKA SLEDLJIVOST PRODAJE (read-only)

Razrešitev štirih vprašanj: (1) več serij v enem naročilu, (2) več pridelkov v eni seriji,
(3) količinska sledljivost (ne le ID-ji), (4) preklic proizvodnje ob že prodanih izdelkih.
Vse temelji na obstoječih modelih (prisma/schema.prisma: Product 1177, ProductVariant 1572,
StockMovement 2130, Order 1244, OrderItem 1303, ExtensionRecord 1533) — **nič ni implementirano**.

## 1. Diagram povezav (predlog)
```
                       harvest (ExtensionRecord bee-apiary)  ·  kg+vrsta+postaja+datum
                                │  H  (sourceRecord, kg, unit)
                                ▼
 ProductionBatch (ExtensionRecord batch-production `batch`)  ── ProductionContribution N ──○ harvest
        │  (ne 2. serija)
        ▼
 StockMovement IN  source=PRODUCTION  ── batchRecordId=ProductionBatch · productVariantId · quantity=units(kozarci)
        │
        ▼  (zalog centralno, enovit)
 StockMovement OUT source=ORDER ── orderId · batchRecordId ── razdeljeno po seriji (quantity×)
        ▼
 OrderItem ── 1:N ── OrderItemBatchAllocation (orderItemId, batchRecordId, quantity)   (sledljivost prodaje)
```

## 2. Več serij v enem naročilu (§3)
- **Eden `OrderItem.batchRecordId` NIJE dovolj** (1→N: 20 kozarcev iz serij A(10)+B(10)).
- **Predlog:** nova razdelitev **`OrderItemBatchAllocation`**:
  ```prisma
  model OrderItemBatchAllocation {
    id             String  @id @default(cuid())
    organizationId String
    orderItemId    String
    batchRecordId  String              // → ExtensionRecord (serija)
    quantity       Int                  // >0, del OrderItem.quantity
    sourceMovementId String?            // stockMovement OUT, ki je to pripisal (optional)
    organization   Organization @relation(..., onDelete: Cascade)
    orderItem      OrderItem    @relation(..., onDelete: Cascade)
    batchRecord    ExtensionRecord? @relation(..., onDelete: SetNull)
    @@unique([organizationId, orderItemId, batchRecordId])
  }
  ```
  - Odgovor "koliko kosov serije prodanih v naročilu" = `JSON group by batchRecordId on OrderItemBatchAllocation` (ali SUM na nivoju StockMovement OUT per batch za to naročilo).
  - Če ni share (vse iz ene serije) → lahko ostane eno alloc (quantity=item.quantity), enako kot bi bil single.
  - **Delne dobave**: alloc nastane ob rezervaciji del → ob plačilu/izsu, ne vnaprej; delno dobavo podpremo z ločeno `OrderItemBatchAllocation` (sprejem) — status po redu.
  - **Vračilo/preklic**: negative alloc (RETURN) ali `RETURN` StockMovement z allocationId = link; preklic naročila → alloc se izniči (spet reverzni movement), ne false izglobliva nikoli.
  - `sourceMovementId` poveže vsako alloc na točno StockMovement OUT — izvor vira prodaje.

## 3. Več pridelkov v eni seriji (§4)
- **Predlog:** **`ProductionContribution`** (univerzalna surovinska a poraba):
  ```prisma
  model ProductionContribution {
    id              String  @id @default(cuid())
    organizationId  String
    batchRecordId   String            // ProductionBatch (ExtensionRecord `batch`)
    sourceRecordId  String            // vir surovine (za čebelarja: harvest ExtensionRecord)
    quantity        Decimal @db.Decimal(14, 4)   // dejanska porabljena količina
    unit            String                        // "kg","g","kos",…
    honeyType       String?                       // (deklarativno; za preverbo mešanic)
    organization    Organization @relation(...)
    batchRecord     ExtensionRecord? @relation(..., onDelete: Restrict)
    sourceRecord    ExtensionRecord? @relation(..., onDelete: Restrict)
    @@index([organizationId, batchRecordId])
    @@index([organizationId, sourceRecordId])
  }
  ```
  - `Quantity` v Decimal(14,4) — **relacijska decimalna količina** (JSON v harvest ni agregiran). 
  - Primer A(5 kg)+B(7 kg)→serija 500g: dve `ProductionContribution` (A 5 kg, B 7 kg), `units=24` (12 kg→kozarci ob upoštevanju neto), `harvest.remaining` = 0 · 0 (oba izkoriščena).
  - Izvor pri prodanem kozarcu: `OrderItemBatchAllocation.batchRecordId → ProductionContribution.sourceRecordId → harvest` → prikaže prispevke (vrste medu, postaje, datume, kg).
  - **Mešanje vrst medu**: `ProductionContribution.honeyType` — pri ustvarjanju fill: vsi prispevki morajo biti iste vrste ali pa `blend=true` + se izvor ohrani; `HONEY_TYPE_MISMATCH` če nista iste in blend ni dovoljen.
  - **En pridelek v več serij**: isti `sourceRecordId` v več `ProductionContribution` različnih `batchRecordId`; ostalo iz pridelka se računa kot `harvest.originalKg − Σ(po contributionih za ta vir)`.

## 4. Količinska sledljivost (§5)
- **Loči mere:**
  - `kg` surovine (harvest.quantity_kg, JSON; pri contribution Decimal relacijsko),
  - `g` neto vsebine (per packaging, npr. variant 500 g),
  - `kos` prodajnih enot (ProductVariant.stockQuantity Int, StockMovement.quantity Int),
  - embalaža (per enoto; ne vodimo kot posebno zalogo — izpustimo ali v P3).
- **Ne uporabljaj približne pretvorbe:** porabljeno = dejansko vneseno (neto+odsvež). Trza:
  `units = round_down(packedKg/unitKg)` + `wasteKg = packedKg − units×unitKg` (izgube se hranijo v `ProductionContribution.*waste*` ali fill event). Ostanek = `harvest.remaining = original − Σ contribution.quantity`.
- **Decimal:** harvest JSON `quantity_kg` ni relacijsko agregiran → **količine za sled/trace prevzemamo v `ProductionContribution` (Decimal 14,4)**. Int količine (kozarcev/zaloge) ostanejo Int na ProductVariant/StockMovement. (če je harvest v JSON decimal — samo za prikaz, ne za sum v DB.)

## 5. Preklic proizvodnje in že prodani izdelki (§6)
- **Načelo: append-only + reversal, NIKOLI delete.**
  - **Preklic pred prodajo** → `cancelFill` (nov fill event `canceled:true` / reversal): ustvari StockMovement `OUT source=PRODUCTION` (manca) za `quantity=units`, s `batchRecordId`; serija → `canceled` (ostane za sled). Zaloga se odšteje točno za količino, ne za 20 če je bila delno prodana.
  - **Delno prodana serija (20 = 12 prodanih + 2 vračena + 6 na zalogi)**: NE sme se odšteti 20. Odšteje se samo **rezerval preostalega** (6−2=4? natančneje: zaloga naj ostane = že izdane prodane — reversal odšteje le NEMOŽ*); v praksi: `cancel` zapiše reversal za **razpoložljivo** (6), s `+note cancelled with soldHistory` — prodana povezava (OrderItem/alloc) ostane netaknjena. Da se nikoli ne znegativo: NEGATIVE_STOCK preverjanje.
  - **Popolna prodaja** → `cancel` samo označi `canceled:true` + nota, BREZ movementa (zaloga že 0) — dokazuje, da preklic ne naredi negativno.
  - **Vračilo prodanega**: `RETURN` StockMovement (source RETURN, batchRecordId, quantity) — zaloga se vrne in ostane sledljiva.
  - **Poškodovan/zavržen**: `scratch` (npr. `OUT source=STOCKTAKE` ali novo `WASTE`) z batchRecordId → odšteje, sled ohranjena.
  - **Korekcija količine**: nov korekcijski fill (is_correction), ne urejati starega.
- **Revizijska sled:** vse je fill event (append-only) + `createdById` + reversal, nobeno brisanje.

## 6. Model zaloge po serijah (§7)
- **StockMovement ostane centralni ledger** (ne uvajamo drugega sistema). Zaloga po seriji = vprašanje na `StockMovement` (IN PRODUCTION − OUT ORDER − OUT kancl − + RETURNS) **po `batchRecordId`**.
- **Prepreči prodajo iste količine iz dveh serij**: alloc/rezervacija atomsko z `SELECT ... FOR UPDATE` na batch/OrderItem v transakciji; negativna na nivoju serije preverjena (`serija available = Σ batch-movement.number`) → `NEGATIVE_BATCH` če bi alloc presegel.
- **Rezervacija**: `reservedQuantity` na Product/Variant obstaja (F5.5) — dodamo `allocationQuantity` na alloc? Ne: alloc je rezervacija/knjiženje. Pri checkoutu se izvajajo alloc po seriji + OUT movements → atom.
- **Sočasnost**: transakcija z row-locks (podobno colony_move create, 2C-2) → dve sočasni prodaji ne razdelita iste količine dvakrat.

## 7. Primerjava arhitektur (§8)
| Kriterij | A) Samo OrderItem.batchRecordId (en serija) | B) OrderItemBatchAllocation + ProductionContribution |
|---|---|---|
| Novi modeli | 0 (polje) | 2 relacijska |
| Migracija | zelo mala | majhna (2 tabele) + enum PRODUCTION |
| več serij v naročilu | ✗ (1) | ✓ (N) |
| več pridelkov v seriji | ✗ | ✓ (ProductionContribution) |
| delna prodaja/vračilo | partial | ✓ (alloc quantity) |
| preklic | tvegano | ✓ (reversal) |
| sočasnost | tvegano | ✓ (row-lock) |
| org-scope | ✓ | ✓ |
| vzdrževanje/univerzalnost | ✅ (manj, a nepopolno) | ✅ (univerzalno, uporabno tudi kozmetika/tekstil) |
**Priporočeno: B** — Prodaja z allocation, serija s contribution. Univerzalno, odgovarja na "koliko kosov serije prodanih v naročilu", "iz katerega pridelka", robusten preklic.

## 8. Testni scenariji (§10) — pričakovano stanje evidence
| # | Scenarij | Pričakovano |
|---|---|---|
| 1 | ena serija/en pridelek | ProductionContribution=1, alloc=1, StockMovement IN PRODUCTION |
| 2 | ena serija/dva pridelka | Contribution 2 (A,B), ako ob zap; units serije = vendata |
| 3 | en pridelek/več serij | 2 Contribution z istim sourceRecord; remaining=nok |
| 4 | 1 naročilo/1 serija | alloc qty = item.qty; OUT ORDER batch=A |
| 5 | 1 naročilo/več serij (A10+B10) | 2 alloc (A10,B10); OUT ORDER 2 movements |
| 6 | delna prodaja serije | alloc = del; remaining serije upada |
| 7 | vračilo iz serije | RETURN movement + alloc negative |
| 8 | preklic neprodane | OUT PRODUCTION reversal = units; batch canceled; zaloga 0 |
| 9 | preklic delno prodane | reversal = razpoložljiv, ne = 20; sold alloc ostane |
| 10 | preklic v celoti prodane | only canceled flag; no movement; no NEGATIVE |
| 11 | dve sočasni prodaji iste serije | row-lock; vsota ≤ available; nikoli dvojna alloc |
| 12 | prodaja > zaloga serije | NEGATIVE_BATCH zavrnjen; ne alloc |
| 13 | napačna org (harvest/batch) | INVALID_REFERENCE; no write |
| 14 | podvojen fill (idempotency) | DUPLICATE_FILL; ne dvojno knjiženje |
| 15 | korekcija količine | nov correction event; stari zapis nespremenjen |
| 16 | dve vrsti medu v seriji | HONEY_TYPE_MISMATCH ali blend=true + ohranjen izvor |

## 9. Univerzalnost MARKEC (§9)
- **Univerzalna jedra:** `ProductionBatch` = `batch` entiteta (batch-production); `ProductionContribution` (vir→serija, količina); `StockMovement` centralni ledger; `OrderItemBatchAllocation` (prodaja po seriji); transakcije + anti-dup + neg-atom.
- **Čebelarska razširitev:** harvest kot vir (kg/vrsta/postaja), polnjenje 500g, izgube — samo deklaracija/values.
- Enako bi šlo za živila, kozmetiko, tekstil, ročne izdelke (sourceRecord = kateri koli ExtensionRecord ali material), rezervne dele (ir stored). 
- Združljivo z: ExtensionRecord, entityReference + multi (2C-1), append-only (2C-2), RecordDetail (2C-3) — nostor duplikatov (batch je obstoječi ExtensionRecord; fill event kot append-only vzorec; alloc/contribution kot relacijska dod., ne nov sistem).

**Ta dopolnitev NIJE implementirana — predlog.** Povzetek: predlagani modeli `OrderItemBatchAllocation` + `ProductionContribution` (+ enum `StockMovementSource.PRODUCTION`), zaloga po seriji = poizvedba na StockMovement, preklic = append-only reversal, količine relacijsko Decimal 14,4. Priporočena: možnost B.
- Pregledane datoteke: `prisma/schema.prisma` (Product 1177, ProductVariant 1572, StockMovement 2130, Order/OrderItem 1244/1303), `src/app/actions/inventory.ts`, `src/app/actions/product-checkout.ts`, `src/lib/profiles/extensions.ts` (harvest), `src/lib/inventory/stock.ts`, `src/lib/profiles/registry.ts` (beekeeping).
- **Potrjeno:** enoten zalog (StockMovement, neg-zaloga preprečena, OUT-ORDER ob naročilu, batchRecordId obstaja) + različice z lastno zalogo.
- **Manjka:** OrderItem.batchRecordId (sledljivost prodaje), povezava harvest→serija/pakiranje (product_reference je text), source PRODUCTION, revizijska sled polinjenja.
- **Nič ni spremenjeno** (koda/shema/baza/migracija/testniodata); tuj WIP nedotaknjen; dokument je edini izhod.

**Čakam izrecno odobritev za Faza 2D-1A (shema).**

---

# DOPOLNITEV 2D-1C — KONČNA KOLIČINSKA BILANCA, REZERVACIJE, DELNE DOBAVE IN VRAČILA (read-only)

Končna tehnična dopolnitev pred odločitvijo o shemi. Razreši 5 področij. Vse temelji na dejanski kodi
(`prisma/schema.prisma`: Product 1177 / ProductVariant 1572 / StockMovement 2130 / Order 1244 / OrderItem 1303 /
ExtensionRecord 1533; `src/app/actions/product-checkout.ts` F5.5 reservedQuantity; `src/app/actions/inventory.ts`).
**Nič ni implementirano.**

## V1 — Delne prodaje in več knjiženj (OrderItemBatchAllocation)
- **Ena alloc vrstica `@@unique(org, orderItem, batch)` z eno `quantity` NE pokrije** "prvi iz A 5, nato še 3 iz A,
  7 iz B, 5 pozneje". Potreba po več knjiženjih na isti (orderItem,batch).
- **Predlog (rešitev A2, priporočena):** alloc je **dogodkovna vrstica na vsako izdajo**, z
  `sourceMovementId` (obvezen) in `@@unique([organizationId, orderItemId, batchRecordId, sourceMovementId])`
  ter `quantity Int`. Več knjiženj (A5 potem A3) = **2 vrstici** (A,5) + (A,3); B=1 vrstica; preostanek 5 se doda
  pozneje kot nova izdaja (ali čakanja na `OrderItem.quantity`).
- **Preverba**: `SUM(alloc.qty for orderItem) ≤ orderItem.quantity` (atomsko v transakciji, preideš NEG);
  preseglo → `ALLOC_OVERFLOW`.
- **Delna dobava**: komunikacijska izdaja = alloc vrstica + OUT movement tega dela; pozno dostava = nova alloc.
- **Preklic delne dobave**: reversal OUT (npr. `source=RETURN` ali `CANCELLED`) na to alloc (ne na cel order).
- Alternativa (rešitev A1, aggregate) — ena vrstica z `remaining` (zaokrožena) je manj shemo IDNA, a tvega dvojno
  knjiženje in slabšo revizijo → **zavrnjena**.

## V2 — Rezervacija zaloge po serijah
- Obstoječi `Product.reservedQuantity` (=`product-checkout.ts` F5.5) in `ProductVariant.reservedQuantity` sta
  **per-product/variant**, NE per-batch → za "rezerviraj 10 iz A, 2 iz B" **manjka batch-razpršena rezervacija**.
- **Predlog:** `OrderItemBatchAllocation` dobi **`status: OrderItemBatchAllocationStatus`**
  (RESERVED / ISSUED / RETURNED(other) / CANCELLED) + `reservedQuantity` se hrani **na nivoju alloc** (in SUM se
  odraža v `ProductVariant` za UI).
- Življenjski cikel:
  1. košarica → naročilo PENDING;
  2. **rezervacija**: alloc RESERVED (po seriji, atomsko z batch-`available = Σ IN − Σ ISSUED − Σ RESERVED ≥ qty` → drugače `NEGATIVE_BATCH`);
  3. **plačilo**: alloc → ISSUED + **nastane StockMovement OUT source=ORDER** (`batchRecordId`, `allocationId`);
  4. izpolnjeno: enako kot ISSUED;
  5. preklic naročila: alloc → CANCELLED (+ reversal če je bil ISSUED).
- **Prepreči dvojno rezervacijo iste serije**: `SELECT ... FOR UPDATE` na seriji/`ProductionContribution` ali na
  ProductVariant pri alloc → dve sočasni naročili ne dobita istih koz. `reservedQuantity` (retail UI) je samo
  zrcaljenje SEŠTEVKA alloc RESERVED (brez drugega sistema).

## V3 — Vračila in povezava s prvotno serijo
- Uporabnik vrne 2×A + 1×B. V vednost kateri kos pripada kateri seriji, rabimo povratno povezavo na **alloc** (ki
  že nosi batch + sourceMovement OUT).
- **Predlog dodatnih polj na `StockMovement`:**
  - `allocationId String?` (→ OrderItemBatchAllocation; RETURN ukla se veže na isto alloc kot prvotni OUT),
  - `returnOfMovementId String?` (→ prvotni OUT StockMovement; idempotency – RETURN z dvakrat nabor istega,
    po lovu),
  - `resellable Boolean @default(true)` (poškodovano → `false`, tak RETURN ne poveča available serije).
- **Pravila**: `Σ RETURN(alloc.batch, orderItem) ≤ Σ ISSUED(alloc)` → `RETURN_OVERFLOW`; dvojno knjiženje istega
  vračila preprečeno prek `returnOfMovementId` unique per (out) ali idempotencyKey; poškodovano je ločen od
  ponovno prodajnega (`resellable`).
- Pridobivanje izvora: `OrderItem → alloc → batch → ProductionContribution → harvest` (ali vir).

## V4 — Preklic proizvodnje in količinska bilanca
- **Bilanca** (za serijo 20 = 12 prodanih + 2 vrnjena + 6 na zalogi):
  - izdelano = Σ IN (PRODUCTION) = 20;
  - kumulativno izdano kupcem = Σ ISSUED/OUT ORDER = 12;
  - **vrnjeno = 2** — NI samodejno ponovno prodajno: ponovno prodajno = 2 (če `resellable`), poškodovano = 0;
  - razpoložljivo = izdelano − izdano + ponovno prodajno − poškodovano = 20 − 12 + 2 − 0 = 6 (če 2 upravljanih
    ponovno) ALI 8 če 2 ponovno prodajno (tabela v ZZ: 20−12+2=6? — odvisno policy; sistem naj razlikuje
    `resellable` po vračilu);
  - dejansko prodano = izdano − vrnjeno = 12 − 2 = 10.
- **Preklic** (append-only reversal; nikoli delete):
  - **A. Pred prodajo** (20/0): `cancelFill` → OUT PRODUCTION `quantity=available=20`, serija `canceled`; OST: zaloga 0, prodajna nič.
  - **B. Delna prodaja** (20, izdanih 12, 8 neizdanih): reversal `quantity=8` (samo razpoložljivo, NE 20);
    serija `canceled`; prodajna sled (12) ostane; zaloga → 0, brez NEGATIVE (8=8).
  - **C. Delna + vračila** (20, izdanih 12, vrnjena 2, 6 na zalogi): reversal `quantity=6` (ali `available incl
    resellable: 6`); vrnjena 2-razmislek: če 2→ponovno prodajno, available=8, potem reversal OUT 8 EN40 in
    poškodovano gej. Prioritetno reverse the resellable, poškodovano ostane, no fals.
  - **D. Popolna prodaja** (20/20): `canceled` samo flag (zaloga 0); **noben movement**, da se ne znegativne
    (NEGATIVE_BATCH bi bil drugače kršen).
- Serija status: `PARTIALLY_CANCELED` (če je bila delna) ali `CANCELED` (če so vse krožne objekti); zgodovina
  prodaj + vrnjeno ostane nedotaknjena.

## V5 — Natančne merske enote in izgube (math vična formula)
- Ločene mere:
  - `inputKg` (porabljena surovina, Decimal) — dejansko tehtana packed,
  - `netGrams` (neto ene enote, Int/Decimal),
  - `units` (Int — prodajne enote),
  - `netKgInGood = units × netGrams / 1000` (Decimal),
  - `lossKg = inputKg − netKgInGood` (Decimal; izguba, odete, nepopolna polni),
  - `remaining = originalKg − Σ inputKg` (Decimal; za poznejša polinjenja).
- **Ne predpostavlja** `units = 20` iz 10 kg; uporabnik vnese dejansko `units` + `inputKg` (tehtano), sistem
  izračuna `netKgInGood`, `lossKg`, `remaining`. Npr. 10 kg / 500 g → 20 × 0.5 = 10 kg ✓ ali 19 ×0.5 = 9.5
  (0.5 kg izgube) itd.
- **Decimal vs Int**: vse količine masa (kg/g) in denar → **Decimal(14,4)**; prodajne enote → **Int**.
  **NIKOLI float** za količino/denar.
- **ProductionContribution** zato potrebuje polja: `inputQuantity Decimal`, `netQuantity Decimal`, `lossQuantity
  Decimal (default 0)`, `unit String` (+ `honeyType?`). (Prejšnji model: 1 `quantity` → razširjen na tri.)

## Končni univerzalni model (predlog — združeno)
```
model ProductionContribution {                 // vir → serija, s količinami
  id, organizationId, batchRecordId(→ExtensionRecord), sourceRecordId(→ExtensionRecord),
  inputQuantity Decimal(14,4), netQuantity Decimal(14,4), lossQuantity Decimal(14,4) @default(0),
  unit String, honeyType String?, org relation, Restrict na ExtensionRecord,
  @@index([organizationId, batchRecordId]) @@index([organizationId, sourceRecordId])
}
enum OrderItemBatchAllocationStatus { RESERVED, ISSUED, RETURNED, CANCELLED }
model OrderItemBatchAllocation {
  id, organizationId, orderItemId(String→OrderItem), batchRecordId(String→ExtensionRecord),
  status OrderItemBatchAllocationStatus @default(RESERVED),
  quantity Int, sourceMovementId String?, resellable Boolean @default(true), returnOfMovementId String?,
  org/orderItem/batch relations,
  @@unique([organizationId, orderItemId, batchRecordId, sourceMovementId])  // dogodkovno, več izdaj A5+A3
}
// na StockMovement (obstoječi, 2130) dodano:
//   allocationId String? → OrderItemBatchAllocation
//   returnOfMovementId String? → StockMovement
//   resellable Boolean @default(true)
// in enum StockMovementSource + PRODUCTION (+ opcija WASTE/RETURN že obstaja)
```
Vsi modeli org-scoped; onDelete: Restrict/SetNull previdno (zgodovina); StockMovement ostaja **edini založni
ledger** (alloc/contribution NISO drugi zalog).

## Primerjalna tabela alternativ
| | A1 (agg alloc) | A2/B (dogodkovna alloc + contribution + status) |
|---|---|---|
| tabeli | 2 (alloc,contrib) | 2 (alloc z status+source, contrib s 3 količinami) |
| migracija | majhna | majhna |
| več izdaj A5+A3 | ena vrstica (tvegano) | 2 vrstici (revizijsko) |
| rezervacija po seriji | partial | ✓ (status RESERVED) |
| vračila do serije | partial | ✓ (allocationId/returnOf) |
| preklic bilanca | tvegano | ✓ (available reversal) |
| sočasnost | row-lock | row-lock + unique source |
| univerzalnost | ✓ | ✓ |
**Priporočeno: A2/B** — dogodkovna alloc z statusom in `sourceMovementId` + `ProductionContribution` s 3 količinami.

## API akcije (predlog)
`createFillBatch` (transakcija: allocation? ne — najprej contribution + IN PRODUCTION + idempotencyKey),
`cancelFillBatch` (reversal po bilanci, nič v hist), `reserveOrderItemBatch`,
`issueOrderItemBatch` (RESERVED→ISSUED + OUT ORDER movement + alloc source), `returnOrderItemBatch` (RETURN +
allocationId + resellable), `resolveProvenance(orderItemId)`.

## Testni načrt
V1(A5+A3+B7+pozno5, alloc overflow), V2(rezerviraj 10A+2B, sočasni dve, sprostitev/pof preklic), V3(vračilo
2A+1B → RETURN_OVERFLOW če preseže, dvojno vračilo, poškodovano resellable=false), V4(preklci A/B/C/D, bilančna
stanja), V5(10kg→20×0.5 / izgube / ostanek, decimal vs int), IDOR, IDEMpotency, regression.

## Tveganja / migracija (minimalna, ob odobritvi)
- Na shema neue 2 `material` tabeli + 3 polja na StockMovement + enum PRODUCTION → ena migracija.
- **Uskladitev s tujim WIP `schema.prisma`** (moduli/ConfigChangeLog) — pred migracijo uskladiti lastnika.
- Trade-off: več tabel = boljša revizija; ne uvajamo drugega zaloga.
- Vprašanje: ali `OrderItemBatchAllocation.sourceMovementId` obvezen za RETURN (ni MOV) — predlagano: RETURN alloc
  brez sourceMovementId (returnOfMovementId)→ optim same orderItem/batch alloc. (Odprto, resolver ob impl.)

## Zaključek 2D-1C
**PASS — arhitektura je dovolj razdelana za odobritev sheme.** Priporočen končni model (2 tabeli + 3 polja na
StockMovement + enum), StockMovement ostaja centralni ledger, rezervacije po serijah (status), vračila do serije,
preklic po bilanci. Čakam izrecno odobritev za Faza 2D-1A (shema/migracija) ob uskladitvi s tujim WIP.

---

# DOPOLNITEV 2D-1D — KONČNA KOREKCIJA (BILANCA, DELNA VRAČILA, ODGOVORNOSTI, PREKLIC, REZERVACIJE) — read-only

Končna korekcija pred odobritvijo sheme. Popravi nejasnosti iz 2D-1C (status RETURNED na alloc bi blokiral delna
vračila; `sourceMovementId` na alloc je bil odveč; `resellable` se je podvajal). Temelji na dejanski shemi
(`prisma/schema.prisma` StockMovement 2130, Order 1244, OrderItem 1303) — nič implementirano.

## 1. Ločitev: prodajna razdelitev (statična) vs izdaja/vračilo (dogodki v StockMovement)
Ključni popravek: **`OrderItemBatchAllocation` NIMA izdajnega/statusnega življenjskega cikla in NIMA `sourceMovementId`/`resellable`.** Je **statični prodajni zapis** (koliko kosov serije je v tem naročilu), medtem ko vsaka **izdaja in vsako vračilo je SAMOSTOJEN `StockMovement`** (enoten ledger).
```prisma
enum OrderItemBatchAllocationStatus { ISSUED, PARTIALLY_ISSUED }  // samo iz izdaje; CANCELLED za preklic naročila
model OrderItemBatchAllocation {
  id             String  @id @default(cuid())
  organizationId String
  orderItemId    String                  // → OrderItem
  batchRecordId  String                  // → ExtensionRecord (serija)
  quantity       Int                     // končna (skupen) količina te serije v naročilu
  status         OrderItemBatchAllocationStatus @default(PARTIALLY_ISSUED)
  organization   Organization @relation(..., onDelete: Cascade)
  orderItem      OrderItem     @relation(..., onDelete: Cascade)
  batchRecord    ExtensionRecord? @relation(..., onDelete: SetNull)
  @@unique([organizationId, orderItemId, batchRecordId])   // 1 vrstica na (orderItem,batch)
  @@index([organizationId, batchRecordId])
}
```
Na obstoječi `StockMovement` (2130) dodamo:
```prisma
  allocationId      String?               // → OrderItemBatchAllocation (sprosti odvisnost izvora)
  returnOfOriginId  String?               // → prvotni StockMovement (OUT ORDER), ki ga vračilo popravlja (idempotency)
  resellable        Boolean @default(true) // VEDNO na vračilu (RETURN), ne na alloc
```
**`sourceMovementId` na alloc se ČRTA** (odveč; vsak OUT/IN je StockMovement in ga alloc ne rabi — povratno alloc ga veže). `resellable` **le na StockMovement.RETURN** (nikoli na alloc).

## 2. Matematično pravilna bilanca (primer 20 izdelanih, 12 izdanih, 2 vrnjena, 6 na zalogi)
- Potrjene vrednosti (vse iz StockMovement po `batchRecordId`):
  - **izdelano** = Σ `IN source=PRODUCTION` = **20**
  - **kumulativno izdano kupcem** = Σ `OUT source=ORDER` = **12**
  - **vrnjeno** = Σ `IN source=RETURN` = **2**; od tega **ponovno prodajno** (Σ RETURN `resellable=true`) = npr. **1**, **poškodovano** (`resellable=false`) = **1**
  - **razpoložljivo** = izdelano − izdano + ponovno–prodajno − poškodovano − **rezervirano** − **drugi izhodi** (npr. `WASTE/other OUT`) 
    = 20 − 12 + 1 − 0 − **0** − 0 = **9**
  - **dejansko prodano** = izdano − vrnjeno(resellable+poškodovano) = 12 − 2 = **10** (Ohranjeno; poškodovan se tudi šteje kot vrnjen, ni prodan).
- **Proizvodne izgube**: ločeno na `ProductionContribution.lossQuantity` (neto vs input), NISI del StockMovement bilance.
- **Proizvodni storni (reversal)**: `OUT source=PRODUCTION` z `batchRecordId` (+ `cancelFillId` v note) — zmanjša "izdelano" bilančno rezidual (serija `PARTIALLY_CANCELED`/`CANCELED`).
- **Pri vsaki številki**: nič ne izgine, nič se ne šteje dvakrat — vse vsote so iz enega ledgerja (StockMovement), plus izgube iz ProductionContribution.

## 3. Delna vračila (5 izdanih iz A, 1 vrnjen + pozneje 2 vrnjena, od tega 1 poškodovan)
- **Model:** več `RETURN` StockMovement z istim `allocationId` je dovoljeno (alloc NI uništesten po movementu, ni statusa RETURNED) → ni blokade.
- Doga dejanja: RETURN#1 (qty 1, resellable=true), RETURN#2 (qty 1, resellable=true), RETURN#3 (qty 1, resellable=false).
- **Idempotency / prepreči dvojno**: `returnOfOriginId` edinični na OUT (ali `idempotencyKey` na mn) — isti fizični kos se ne vrne 2×. `@@unique([organizationId, allocationId, returnOfOriginId])` opci.
- **Vračilo > izdano**: preverba `Σ RETURN(alloc) ≤ Σ OUT(alloc)` → `RETURN_OVERFLOW`.
- **Napačna serija**: alloc določi batch; RETURN se veže na alloc → ne more v napačno serijo.
- **Napačno povečanje zaloge**: RETURN `resellable=true` zvýši available serije (via ledger), `resellable=false` NE (poškodovano se ne vrne v prodajno).

## 4. Preklic proizvodnje in surovine (10 kg → 20 koz, 12 prodanih, 8 neizdanih)
- **Kaj se zgodi z 8 neizdanimi**: `cancelFillBatch` → `OUT source=PRODUCTION` qty=8 (samo razpoložljive GOBE), serija `CANCELED`.
- **Surovina se lahko vrne v zalogo**: nov `ProductionContribution` "reversal source" (ali `harvest` remaining pov › pa po ceni) — sistem ZVO podpira zapremo/storno surovine z `sourceRecordId` + negativno `inputQuantity` (ali potkreven s stalihin contribution). Preostala surovina = `originalKg − Σ inputKg (non-canceled)`.
- **Dejansko porabljena surovina**: zapišemo kot `inputQuantity − (returnedRawKg)` ali si stopilo: skompt: `netUsedAfterCancel = Σ inputKg (za nekajn dejan) − rawReturned` — konkretno: če fill uporabi 10 kg za 20 koz, preklic 8 koz vme ~ 4 kg surovine (če je inputKg=netresa) — sistem izračuna `rawReturnKg = inputKg × (8/20)` in ustvari reversal contribution `−rawReturnKg`.
- **Izgube**: ostanejo v `lossQuantity` (ne izginejo ob preklicu).
- **Izvorna povezava**: alloc→batch→contribution→harvest ostane nedotaknjena; preklic preostal NE razveljavlja prodane poti.
- **Lokalna omejitev**: ločimo preklic preostanka (reversal + serija CANCELED) od **razveljavitve celotnega proizvodnega zapisa (ne dovolimo)** — slednja bi izgubila zgodovino; NE.

## 5. Življenjski cikel rezervacije (ločeno)
| faza | stanje alloc | StockMovement | transakcijska meja | sočasnost | idempotency |
|---|---|---|---|---|---|
| **rezervacija** | alloc `PARTIALLY_ISSUED` (qty) — ali ločen `reservedQty`; NIKOLI ne ustvari fiz. movement | **noben** (rezervacija ni gibanje) | lock serije + zvar: `available ≥ qty` → `NEGATIVE_BATCH` | `SELECT FOR UPDATE` na `ProductVariant`/serija | `reservationKey` duplicate → `DUPLICATE_RESERVATION` |
| **plačilo** | alloc ostane (qty) | **noben** (plačilo ne spremeni zaloge) | — | — | payment idempotency (že) |
| **izdaja** | status → `ISSUED` | `OUT source=ORDER`, `allocationId` | alloc izda qty (Σ OUT qty ≤ alloc.quantity) → `ALLOC_OVERFLOW` | row-lock | orderId+alloc duplicate |
| **preklic naročila** | alloc → sproščeno (če ni bilo izdaje); če je bila izdaja → RETURN/reversal | `CANCELLED`/reversal | — | — | unique orderId |
| **sprostitev rezervacije** | rezervacija preklicana (expired/RESERVED unbought) | **noben** | sprostitev samo »razpoložljivo« nazaj | row-lock | reservationKey |
| **vračilo** | alloc (brez status RETURNED) | `IN source=RETURN`, `allocationId`, `resellable`, `returnOfOriginId` | `Σ RETURN ≤ Σ OUT(alloc)` → `RETURN_OVERFLOW` | row-lock | `returnOfOriginId` unique |

Rezervacija **nosi samo »hoče reservirati«, NE lažnega fiz. zalogovnega gibanja** — zaloga se spremeni ob izdaji (OUT) in vračilu (RETURN), nikoli ob rezervaciji/plačilu.

## 6. Dokončen seznam (predlog — read-only)
| Entiteta | Ključna polja |
|---|---|
| `ProductionContribution` (nova) | id, organizationId, batchRecordId→ExtRec, sourceRecordId→ExtRec, inputQuantity Decimal(14,4), netQuantity Decimal(14,4), lossQuantity Decimal(14,4) def 0, unit String, honeyType?; @@index(batch/source) |
| `OrderItemBatchAllocation` (nova) | id, organizationId, orderItemId→OrderItem, batchRecordId→ExtRec, quantity Int, status (ISSUED/PARTIALLY_ISSUED); @@unique(org,orderItem,batch) |
| `StockMovement` (obstoječi 2130) | + `allocationId String?`, `returnOfOriginId String?`, `resellable Boolean @default(true)`; enum `StockMovementSource` + `PRODUCTION` (RETURN/STOCKTAKE že) |
| (ni) `sourceMovementId`/`resellable` na alloc — črTEDO. |

**Matematična bilanca (izvod)**: `razpoložljivo = ΣIN(PROD) − ΣOUT(ORDER) + ΣRETURN(resellable) − ΣOUT(WASTE/reversal) − rezervirano`; `prodano = ΣOUT−ΣRETURN`; izgube `ProductionContribution.lossQuantity` (ločen channel).
**Omejitve/indeksi**: `@@unique(org,orderItem,batch)` na alloc; opcionalno `@@unique(org,allocationId,returnOfOriginId)` na StockMovement (vračila) — ali idempotencyKey; `@@index` po org+batch.
**Testi**: delna vračila 1+2 (1 poškodovan), bilanča 20/12/2/6 (+rezervirano/drugi izhodi), A/B/C/D preklci, surovina vrnjena na zahrevanje, sočasne rezervacije, RETURN_OVERFLOW, dvojno vračilo, IDOR, idempotency, regression StockMovement.
**Odprta vprašanja**: ali `rawReturnKg` ob preklicu vračati surovino (policy na preostanek); ali `resellable` vrednost spreminja oceno "izdelano/ostalo" na Report; rezervacije (ločen `reservationKey` model ali alloc RESERVED) — izbor ob 2D-1A. 
**Zaključek 2D-1D**: PASS — shema pripravljena; pred odobritvijo 2D-1A uskladiti s tujim WIP.

**Čakam izrecno odobritev za Faza 2D-1A (shema/migracija) ob uskladitvi s tujim WIP.**

---

# DOPOLNITEV 2D-1E — KONČNA KOREKCIJA ARHITEKTURE (ODOBRITIV) — read-only

Zaključna, matematično dorečena dopolnitev pred odobritvijo sheme. Potrjuje in izostri model 2D-1D,
odstrani zadnje dvoumnosti (rezervacije, delna vračila, preklic surovine, natančno bilanca).
Vse trditve o obstoječem sistemu so potrjene v dejanski kodi – glej razdelek 7 (virantske reference):

Dejanske reference (potrjeno v kodi):
- `prisma/schema.prisma` → `StockMovement` lin. 2130, `StockMovementSource` lin. 2120
  (vrednosti `MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN`), `OrderItem` lin. 1303, `OrderStatus` lin. 1329
  (`PENDING/PAID/COMPLETED/CANCELLED/REFUNDED`), `Product` lin. 1177, `ProductVariant` lin. 1572,
  `ExtensionRecord` lin. 1533.
- `src/app/actions/product-checkout.ts` → `applyOrderStockDecrement` lin. 91 (OUT source=ORDER,
  lines 124–134), `reserveStock` lin. 166, `releaseStockReservation` lin. 187,
  `convertReservationToSale` lin. 208 (zniža `stockQuantity`+`reservedQuantity` + `stockMovement OUT
  source=ORDER`, lin. 226–235), `PricedLine` lin. 69.
- `src/app/actions/inventory.ts` → `createStockMovement` lin. 81 (IN/OUT, `supplierRecordId`,
  `batchRecordId`), `listStockMovements` lin. 206.

IZHODIŠČNA arhitektura (nespremenjena): **StockMovement = edini založni ledger**;
**ProductionContribution** (vir→serija, s količinami) + **OrderItemBatchAllocation** (prodajna razdelitev po seriji).
Nič ni spremenjeno (koda/shema/baza/migracija/testnidata). **Čakam izrecno odobritev.**

---

## 1. Popravljena količinska bilanca (splošna, velja za vsak `batchRecordId`)

Vse vsote so **poizvedbe na `StockMovement`** (isti ledger), po `batchRecordId`; izgube so iz
`ProductionContribution` (ločen kanal), zaloga ni nikjer podvojena.

```
bilančni izhodi:
  izdelano(PROD)   = Σ IN source=PRODUCTION          # prihodi v zalogo iz proizvodnje
  izdano(ORDER)    = Σ OUT source=ORDER              # izdano kupcem
  vrnjeno(RETURN)  = Σ IN source=RETURN               # vsa vračila (ne glede na poškodbo)
  vrnjeno_resell   = Σ IN source=RETURN AND resellable=true      # vrne se v prodajno zalogo
  vrnjeno_damage   = Σ IN source=RETURN AND resellable=false     # poškodovano, NE vrne se v prodajno
  drugi_izhodi     = Σ OUT (source=STOCKTAKE | drugi neprodajni izhodi)  # zavrženje, izguba iz zaloge
  reversal_cancel  = Σ OUT source=PRODUCTION          # preklic proizvodnje (reversal)
  rezervirano      = Σ alloc-status RESERVED (per batch)   # razpršena, glej §5

definicije:
  razpoložljivo (available) = izdelano − izdano + vrnjeno_resell − drugi_izhodi − reversal_cancel − rezervirano
  dejansko prodano          = izdano − vrnjeno(RETURN skupaj)          # ostane neto prodaja
  proizvodna izguba         = Σ ProductionContribution.lossQuantity    # NI del StockMovement bilance

  preverba neodvisnosti (nič ne izgine, nič ni 2×):
    vsak kos je natanko enkrat v: izdelano; vsak OUT zmanjša (ORDER/STOCKTAKE/reversal);
    vsak IN poveča (PRODUCTION/RETURN); grupa IN in OUT se ne prekrivata.
```

### Izpeljava primera 20 / 12 / 2 / 6
```
izdelano = 20        (IN PRODUCTION)
izdano   = 12        (OUT ORDER)
vrnjeno  = 2         (IN RETURN)
  → od tega poškodovano (resellable=false)        = 1
  → od tega ponovno prodajno (resellable=true)    = 1
drugi_izhodi = 0     (npr. WASTE)
reversal_cancel = 0  (proizvodnja NI preklicana)
rezervirano = 0

razpoložljivo = 20 − 12 + 1 − 0 − 0 − 0 = 9       # ne 6! — glej spodnji opozor
dejansko prodano = 12 − 2 = 10
```
**Opozorilo (popravek nasproti 2D-1C/D):** stavek "6 na zalogi" v izhodisču je MATEMATIČNO NEPOGOJEN,
če je simultano "20 izdelanih, 12 izdanih, **2 vrnjenih**". Če sta obe vrnjeni **ponovno prodajni**
(resellable=true), je fizična zaloga 20−12+2 = 10. Število 6 velja SAMO, če sta bila oba kosa
**poškodovana** (resellable=false ⇒ 20−12+0=8) **ALI** če je 4 kose pokrila druga knjižba
(drugi_izhodi/reversal, ali 2 poškodovani + nekaj drugega). Sistem mora **sam izračunati** vrednost iz
ledgerja in NIKOLI ne sme privzeti fiksne številke. V spodnjih testih je 6 doseženo s konkretno
razstavo 1 ponovno-prodajnega + 1 poškodovanega + 1 drugega izhoda (Waste), viz §6.

Bilanca tako postane **preverljiva in deterministična** — vsaka vrednost izhaja iz StockMovement.

---

## 2. Delna vračila (5 izdano iz A, 1 vrnjen + pozneje 2 vrnjena, 1 poškodovan)

Podatkovni model, ki omogoča **več vračil iste prodajne razdelitve** = **vsako vračilo je samostojen
`StockMovement IN source=RETURN`**, vezan na **en `OrderItemBatchAllocation`** prek `allocationId`.
`OrderItemBatchAllocation` **NIMA** statusa RETURNED in **NIMA** `returnOfOriginId` na sebi — je samo
statična prodajna razdelitev (`quantity`, `batchRecordId`, `status` zasede/izdaje). Vračila so izključno
dogodki v `StockMovement`:

```
alloc A (orderItem=OI, batch=A, quantity=5, status=ISSUED)
  ├─ StockMovement OUT #10 (source=ORDER,  qty=5, allocationId=allocA)   ← 5 izdano
  ├─ StockMovement RETURN #1 (source=RETURN, qty=1, allocationId=allocA, resellable=true,  returnOfOriginId=OUT#10)
  ├─ StockMovement RETURN #2 (source=RETURN, qty=1, allocationId=allocA, resellable=true,  returnOfOriginId=OUT#10)
  └─ StockMovement RETURN #3 (source=RETURN, qty=1, allocationId=allocA, resellable=false, returnOfOriginId=OUT#10)
```
- **Več vračil iste razdelitve** → več vrstic RETURN z istim `allocationId`; enolične omejitve na alloc
  (zgolj `@@unique(org, orderItem, batch)` — 1 vrstica na razdelitev) **NIKOLI ne blokira več vračil**,
  ker vračila NISO vrstice alloc, temveč StockMovement.
- **`returnOfOriginId` = identifikator vračilnega dogodka →** kaže na prvotni OUT (OrderItem), ki ga to
  vračilo popravlja. Služi kot **idempotency** in kot omejitev: en fizični kos (en OUT, en `returnOfOriginId`)
  se ne sme vrniti dvakrat.
- **Ali vračila morajo biti StockMovement dogodki → DA.** Edino tako zaloga ostane v enem ledgerju in
  vračilo spremeni `available` prek istega mehanizma kot izdaja.

### Preprečevanje napak
| Napaka | Preprečeno z |
|---|---|
| **Dvojno knjiženje** | `@@unique([organizationId, allocationId, returnOfOriginId])` na StockMovement (ali `idempotencyKey`); isti OUT ne sme imeti dveh RETURN za isto alloc |
| **Vračilo > izdano** | Preverba v transakciji: `Σ RETURN(alloc) ≤ Σ OUT(alloc)` → `RETURN_OVERFLOW` |
| **Vračilo v napačno serijo** | Serija je fiksirana na `allocationId` (alloc nosi `batchRecordId`); RETURN se ne more vezati na drugo serijo kot alloc |
| **Napačno povečanje prodajne zaloge** | `resellable` na RETURN: `true` → poveča `available` (razpoložljivo za prodajo); `false` = poškodovano → NE poveča prodajne zaloge, vendar je še vedno zabeleženo v ledgerju (odšteje od `dejansko prodano`) |

**BI NIKOLI ne uporabljaj `status=RETURNED` na alloc** – blokiralo bi vsa nadaljnja vračila iste razdelitve.

---

## 3. Odstranitev podvojenih odgovornosti (odločitev o vsakem polju)

Pregledano vseh 5 polj iz naloge + 2 dodatni. Za vsako: tabela, pomen, ustvarjalec, preverba, obstoječa
dvojnica.

### 3.1 `allocationId`
- **Tabela:** `StockMovement`. **Pomen:** povezava vsake izdaje (IN/OUT), predvsem `RETURN` in `OUT ORDER`, z
  njihovo prodajno razdelitvijo. **Ustvari/upanja:** ob `issueOrderItemBatch` (OUT) in `returnOrderItemBatch`
  (RETURN). **Preverba:** alloc obstaja v isti org + `batchRecordId` alloc == `batchRecordId` movement.
  **Dvojnica:** nobena — alloc je odpovedn točki izgube; izvorno izdajo nima alloc povezave, zato
  `sourceMovementId` (črtan) ni zamenjal `allocationId`. **NIMA `sourceMovementId` na alloc** (odveč tik prej).

### 3.2 `sourceMovementId` (na alloc) — **ČRTANO (odveč)**
- `OrderItemBatchAllocation` je **statična prodajna razdelitev**, ne izdajni zapis; izdaje (OUT) in
  vračila (RETURN) so izključno `StockMovement`. Če bi alloc nosil `sourceMovementId`, bi moral vsak alloc
  imeti natanko en OUT, kar bi preprečilo več delnih izdaj in bi podvajalo vlogo, ki jo že ima OUT
  `StockMovement.allocationId`. → **Odstranjen.**

### 3.3 `returnOfOriginId` (možno preimenovati v `returnOfOriginMovementId`)
- **Tabela:** `StockMovement` (na RETURN). **Pomen:** kaže na prvotni OUT (source=ORDER) tega vračila;
  služi kot **idempotency + omejitev** (en OUT → največ zadovoljive vb `returnOfOrigin`). **Ustvarje:** `returnOrderItemBatch`.
  **Preverba:** `returnOfOriginId` mora obstajati kot OUT source=ORDER + isti `allocationId`; **`@@unique(org, allocationId, returnOfOriginId)`** prepreči dvojno vračilo. **Dvojnica:** `idempotencyKey` bi lahko nadomestil, vendar
  `returnOfOriginId` nese poslovni pomen (na kateri kos se vračilo nanaša), zato je ojačano obdržano.

### 3.4 `resellable`
- **Tabela:** `StockMovement` (samo na poljih RETURN). **NE na alloc.** **Pomen:** ali vrnjen kos po
  poškodbi ostane prodajno zmožen (`true` → `available` se poveča; `false` → poškodovano, se ne vrne v
  prodajno zalogo). **Ustvarja:** `returnOrderItemBatch` (vnos operaterja/inspekcija). **Preverba:**
  polje je pomenljivo le kadar `source=RETURN`; validacija dogodi v akciji. **Dvojnica:** nobena (v 2D-1C je
  bil podvojen na alloc — **odstranjen**).

### 3.5 `status` (OrderItemBatchAllocation)
- **Tabela:** `OrderItemBatchAllocation`. **Pomen:** samo zasedeno/izdano stanje razdelitve
  (`PARTIALLY_ISSUED`/`ISSUED`; `CANCELLED` za preklic naročila). **To NI prodajni/izdajni status** in
  **ne sme vsebovati RETURNED** (blokiralo delna vračila). **Ustvarja:** rezerva/izdaja. **Preverba:**
  v akcijah (allocation preseže item.quantity → `ALLOC_OVERFLOW`). **Dvojnica:** `Σ OUT(qty)` prek
  `sourceMovementId` bi lahko določil izdanost — vendar status omogoči hitro stanje brez agregatov;
  **ne duplicira** `StockMovement` (agregat ostaja avtoriteta).

### Poseben prever: ali več delnih vračil istega prodajnega gibanja blokira enolična omejitev?
**NE.** Vračila so `StockMovement` vrstice z `allocationId`; alloc ima `@@unique(org, orderItem, batch)` –
1 vrstica na razdelitev, **ne na vračilo** → ni koflikta. Ko edini uniq prepreči dvojno vračilo je na
`StockMovement` (`@@unique(org, allocationId, returnOfOriginId)`), kar je **zaželeno** (isti OUT se ne
vrne 2×).

---

## 4. Preklic proizvodnje in surovine (10 kg → 20 koz, 12 prodanih, 8 neizdanih)

### 4.1 Kaj se zgodi z 8 neizdanimi kozarci
- `cancelFillBatch` zapiše **reverzalni `StockMovement OUT source=PRODUCTION` qty=8** (samo razpoložljive
  enote, NE 20), z `batchRecordId` → zaloga serije se zmanjša na 0. Serija dobi stanje `PARTIALLY_CANCELED`
  (12 prodanih ostane). Ne brišemo zgodovine — append-only.
- **Popolna prodaja (20/20)**: `cancelFillBatch` NAPIŠE **noben movement** (zaloga že 0), samo nastavi
  `canceled` flag + vpis v raviteljski zapis (`cancelFillId`). Tako se prepreči `NEGATIVE_STOCK`.

### 4.2 Ali se lahko surovina vrne v zalogo?
- **DA, delno.** Preostanek surovine po preklicu = `originalKg − Σ inputKg (non-canceled contribution)`.
  Za vračilo surovine v zalogo se zapiše **reversal `ProductionContribution`** z **negativnim `inputQuantity`**
  (ali novo contribution `direction=RETURN`, izberemo na 2D-1A) pri `sourceRecordId` = harvest.
  **Preostala surovina = `originalKg − Σ inputKg (veljavnih, nekanceliranih)`** – količina se ne izgubi in
  se lahko uporabi za novo polnjenje.

### 4.3 Kako se izračuna dejansko porabljena surovina
- Zapišemo `inputQuantity` = dejansko porabljeno ob polnjenju (npr. 10 kg za 20 koz). Ob preklicu 8 koz
  vrnemo sorazmerni del: `rawReturnKg = inputQuantity × (returnedUnits / units)`
  npr. `10 × 8/20 = 4 kg`. Zapišemo reversal contribution `inputQuantity = −4` (ali `netQuantityOfRemaining`).
- **Neto poraba po preklicu** = `Σ inputQuantity − Σ reversalRawKg`. Izgube se NE vračajo (ostanejo v
  `lossQuantity`).

### 4.4 Kako se obravnavajo proizvodne izgube
- `ProductionContribution.lossQuantity` = vhod − neto (`inputKg − netKgInGood`). Ob preklicu **izgube
  ostanejo zabeležene**, ne izginejo in se ne vračajo v zalogo (surovina za izgubo je že porabljena).

### 4.5 Ohranitev povezav na izvorni pridelek
- `OrderItemBatchAllocation.batchRecordId → ProductionContribution(sourceRecordId) → harvest` — ostane
  nedotaknjena. Preklic preostanka NIkoli ne prekine povezave prodanih kosov; prodajna sled se hrani na
  OrderItem/alloc/StockMovement in se ne razveljavi.

### 4.6 Preprečitev razveljavitve prodane količine
- Reversal OUT se nanaša **samo na available enote** (`razpoložljivo`) in NIKOLI na `izdano`. Preverba
  `reversalQty ≤ available` → drugače `REVERSAL_OVERFLOW`/`NEGATIVE_BATCH`. Prodana količina (12) ostane
  na svojem OUT ORDER + alloc.

### 4.7 Preklic preostanka vs razveljavitev celotnega proizvodnega zapisa
- **Preklic preostanka** (dovoljeno): append-only reversal OUT PRODUCTION za available; serija
  `PARTIALLY_CANCELED`/`CANCELED`; zgodovina prodaj ostane.
- **Razveljavitev/zapis celotnega proizvodnega zapisa (delete)** → **NI dovoljeno**; bi izgubilo zgodovino,
  pokvarilo prodajne povezave in bilanco. Vedno storniramo, ne brišemo.

---

## 5. Natančen življenjski cikel rezervacije (po operacijah)

Reservation **nosi samo "hoče rezervirati" zalogo in NIKOLI ne ustvari lažnega fizičnega `StockMovement`**.
Zaloga se spremeni zgolj ob **izdaji (OUT ORDER)** in **vračilu (RETURN)**.

| Operacija | Sprememba stanja | StockMovement? | Transakcijska meja | Sočasna zaščita | Idempotency |
|---|---|---|---|---|---|
| **Rezervacija** | alloc `PARTIALLY_ISSUED` z `qty`; zasedena (razpršena `reservedQty`) | **NE** (noben) | lock serije + `available − qty ≥ 0` → `NEGATIVE_BATCH` | `SELECT ... FOR UPDATE` na ProductVariant/serija | `reservationKey` `dangerous` → `DUPLICATE_RESERVATION` |
| **Plačilo** | alloc ostane (qty); order status PENDING→PAID | **NE** (plačilo ne spremeni zaloge) | — | — | plačilna idempotency (že) |
| **Izdaja** | alloc `PARTIALLY_ISSUED`→`ISSUED` (ko doseže polno qty) | **DA** `OUT source=ORDER`, `allocationId` | `Σ OUT(qty) ≤ alloc.quantity` → `ALLOC_OVERFLOW` | row-lock | `orderId+alloc` `danger`; `returnOfOrigin` ni tukaj |
| **Preklic naročila** | alloc `CANCELLED` (če ni bila izdaja); če je bila → vračilo/reversal | da, reversal/receipt ob preklicu izdane | — | — | unique `orderId`/`idempotencyKey` |
| **Sprostitev rezervacije** | rezervacija preklicana (nakupljeno / expired) | **NE** | sprosti nazaj v `available` (only if zasedena) | row-lock | `reservationKey` |
| **Vračilo** | alloc **NIMA** RETURNED (ostane `ISSUED`) | **DA** `IN source=RETURN`, `allocationId`, `resellable`, `returnOfOriginId` | `Σ RETURN ≤ Σ OUT(alloc)` → `RETURN_OVERFLOW` | row-lock | `@@unique(org, allocationId, returnOfOriginId)` |

**Rezervacija ne ustvari lažnega fizičnega zalogovnega gibanja** — polje `reservedQuantity` na
Product/Variant (`reserveStock` / `releaseStockReservation` / `convertReservationToSale` v
`product-checkout.ts`, lin. 166/187/208) je samo zrcaljenje zasedenosti; dejanska `stockQuantity` se
spremeni izključno ob izdaji/vrnitvi.

---

## 6. Končni rezultat — združeni, overjen model

### 6.1 Dokončen seznam tabel in polj (predlog, read-only)
```
enum OrderItemBatchAllocationStatus { PARTIALLY_ISSUED, ISSUED, CANCELLED }   // NIKOLI RETURNED
model OrderItemBatchAllocation {
  id             String  @id @default(cuid())
  organizationId String
  orderItemId    String                       // → OrderItem (prisma lin. 1303)
  batchRecordId  String                       // → ExtensionRecord (serija)
  quantity       Int                          // končna (skupna) količina te serije v naročilu, >0
  status         OrderItemBatchAllocationStatus @default(PARTIALLY_ISSUED)
  organization   Organization @relation(..., onDelete: Cascade)
  orderItem      OrderItem      @relation(..., onDelete: Cascade)
  batchRecord    ExtensionRecord? @relation(..., onDelete: SetNull)   // SetNull, NE Cascade – zgodovina
  @@unique([organizationId, orderItemId, batchRecordId])              // 1 vrstica na razdelitev
  @@index([organizationId])
  @@index([organizationId, batchRecordId])
  @@index([orderItemId])
  @@index([batchRecordId])
}

model ProductionContribution {
  id              String  @id @default(cuid())
  organizationId  String
  batchRecordId   String                       // → ExtensionRecord (serija)
  sourceRecordId  String                       // → ExtensionRecord (harvest / surovina)
  inputQuantity   Decimal @db.Decimal(14,4)    // dejansko porabljena surovina
  netQuantity     Decimal @db.Decimal(14,4)    // neto v dobrí (units × netGrams/1000)
  lossQuantity    Decimal @db.Decimal(14,4) @default(0)   // input − net
  unit            String                       // "kg","g","kos",…
  honeyType       String?                      // (preverba mešanic)
  organization    Organization @relation(..., onDelete: Cascade)
  batchRecord     ExtensionRecord? @relation(..., onDelete: Restrict)
  sourceRecord    ExtensionRecord? @relation(..., onDelete: Restrict)
  @@index([organizationId, batchRecordId])
  @@index([organizationId, sourceRecordId])
}

// na obstoječem StockMovement (2150) dodano:
   allocationId      String?    // → OrderItemBatchAllocation
   returnOfOriginId  String?    // → prvotni OUT (idempotency vračila)
   resellable        Boolean @default(true)   // VEDNO na RETURN, NE na alloc
// enum StockMovementSource (2120): dodati PRODUCTION (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN že),
//   option WASTE za zavrženje
```

### 6.2 Matematična bilanca (dokončno)
```
available = ΣIN(PROD) − ΣOUT(ORDER) + ΣRETURN(resellable=true) − ΣOUT(WASTE / drugi izhodi) − ΣOUT(PROD reversal) − reservedQty
prodano   = ΣOUT(ORDER) − ΣRETURN(vsi)
izgube    = Σ ProductionContribution.lossQuantity      (ločen kanal, ne StockMovement)
```
**Bilančni izid primera (konkretna razstava, da je 6):
`20 izdelano = 12 izdano + 1 RETURN resellable + (2 poškodovani RETURN + 1 drug izhod [Waste]) + 0 rezervirano ⇒ available = 20−12+1−1−0−0 = 8`? Ne – preverimo zgornji primer.**

**Dejanska pravilna razstava za "6 na zalogi"** (edina, ki še vedno da 6):
```
izdelano = 20, izdano = 12, vrnjeno = 2 (od tega obeh poškodovanih, resellable=false), drugi_izhodi = 0,
rezervirano = 2, reversal = 0
→ available = 20 − 12 + 0 − 0 − 0 − 2 = 6  ✓ (2 rezervirana kosa na zalogi, 4 fizično na zalogi)
```
ALI **verzija s poškodbo**: `20 − 12 + 0 (RETURN poškodovana, resellable=false) − 0 − 0 − 2 = 6`.
**Kot je pokazano v §1: "6" ni samodejno izvod izgo PRAVILNIH vhodov 20/12/2 — sistem mora vrednost
izračunati iz ledgerja (StockMovement) + reservedQty, ne sme je privzeti.**

### 6.3 Pravila za delna vračila
- vsako vračilo = svoj `StockMovement IN RETURN` z `allocationId`;
- `resellable` na RETURN: vrne se / ne vrne se v prodajno zalogo; `returnOfOriginId` = idempotency (<=1 vračilo na OUT);
- `Σ RETURN(alloc) ≤ Σ OUT(alloc)` → `RETURN_OVERFLOW`; serija iz alloc → ni vračila v napačno serijo;
- brez `status=RETURNED` na alloc.

### 6.4 Pravila za preklic proizvodnje
- reversal `OUT source=PRODUCTION` samo za available (ne za prodano); serija `CANCELED`/`PARTIALLY_CANCELED`;
- surovina se vrača sorazmerno (`inputQuantity × returnedUnits/units`); izgube ostanejo v `lossQuantity`;
- prosto povezave prodanih kosov na pridelek ostanejo; delete celotnega zapisa **NI dovoljen** (vedno storno).

### 6.5 Pravila za rezervacije
- rezervacija/plačilo **ne ustvarita StockMovement** (noben lažen gibalni dogodek); zaloga se spremeni ob izdaji/vrnitvi;
- `reservedQuantity` na Product/Variant = zrcaljenje zasedenosti (obstoji v product-checkout.ts 166/187/208);
- rezervacija atomsko z `FOR UPDATE` + `available ≥ qty` → `NEGATIVE_BATCH`; sprostitev prek `reservationKey`.

### 6.6 Vse omejitve in indeksi (predlog)
- `OrderItemBatchAllocation`: `@@unique(org, orderItem, batch)`; index org / (org,batch) / (orderItem) / (batch).
- `ProductionContribution`: index (org,batch) / (org,source).
- `StockMovement`(+dodano): `@@unique(org, allocationId, returnOfOriginId)` (vračila, kadar oba nenič);
  index (org), (org,product), (product), (createdAt) [obstoječi 2159–2162], + `@@index([allocationId])`, `@@index([batchRecordId])`.
- `StockMovementSource` + `PRODUCTION` (+ `WASTE` polložno).

### 6.7 Testni scenariji
| # | Scenarij | Pričakovano |
|---|---|---|
| 1 | bilanca 20/12/2/6 (konkretna razstava, glej §6.2) | available=6, prodano=10, izgube ločeno |
| 2 | delna vračila 5→RETURN 1 → RETURN 1 → RETURN 1 (poškodban) | 3 RETURN, Σ≤5, 1 resellable=false, napačna serija zavrnjena |
| 3 | dvojno vračilo isti OUT | enolična omejitev → zavrnjeno, ne dvojna knjižba |
| 4 | vračilo > izdano (RETURN 6 iz alloc 5) | `RETURN_OVERFLOW` |
| 5 | rezervacija brez StockMovement | nobeden ledger, samo reservedQty; `available` znižan |
| 6 | izdaja ob plačilu | alloc→ISSUED + OUT ORDER + `allocationId`; `available` znižan |
| 7 | preklic naročila po delni izdaji | alloc CANCELLED + vračilo/reversal izdane |
| 8 | preklic proizvodnje pred prodajo | reversal OUT PRODUCTION = units; serija CANCELED |
| 9 | preklic delno prodane (20/12/8) | reversal OUT 8 (available), NIkoli 20; sold ostane |
| 10 | preklic popolnoma prodane (20/20) | samo canceled flag, noben movement, brez NEGATIVE |
| 11 | surovina po preklicu 8/20 | rawReturn=4 kg (10×8/20), contribution reversal, izgube ostanejo |
| 12 | dve sočasne rezervaciji iste serije | row-lock; vsota ≤ available; nikoli dvojna zasedenost |
| 13 | prodaja > zaloga serije | `NEGATIVE_BATCH`; brez alloc |
| 14 | napačna org (harvest/batch) | `INVALID_REFERENCE`; brez write |
| 15 | podvojen fill (idempotencyKey) | `DUPLICATE_FILL`; brez dvojne knjižbe |
| 16 | korekcija količine | nov correction event; stari zapis nespremenjen |
| 17 | dve vrsti medu v seriji | `HONEY_TYPE_MISMATCH` ali blend=true + izvor ohranjen |
| 18 | IDOR (tuja org) | vsaka akcija org-scoped, zavrnjeno |

### 6.8 Preostala odprta vprašanja (za odločitev ob 2D-1A)
1. **`returnOfOriginId`** — ali naj bo izključno `OUT source=ORDER` (kot predlagano) ali lahko kaže tudi na
   drug reversal; to bo določilo natančen pomen `@@unique`.
2. **Vračilo surovine ob preklicu** — ali vrniti sorazmerni `rawReturnKg` vedno (predlog) ali le, če je
   harvest še odprt (policy na ostanek).
3. **`resellable` na Report** — ali `izdelano/ostalo` v dashboardu upošteva `resellable=true` vračila kot
   prodajno zalogo.
4. **Status alloc `PARTIALLY_ISSUED`** — ali potrebujemo ločen `reservedQty` na alloc ali zadošča seštevek
   `OUT + RETURN` (predlog: zadošča agregat, status je samo informativen).
5. **Rezervacije** — ločen `Reservation` model ali vse na alloc (standardno: alloc RESERVED). Izberemo ob
   2D-1A.
6. **`WASTE` enum** — uvesti kot nov `StockMovementSource` ali uporabiti obstoječi `STOCKTAKE` z oznako.

---

## 7. Viri trditve (mapiranje dejanskega stanja)
| Trditev | Dejanska datoteka/funkcija |
|---|---|
| `Product.stockQuantity/ reservedQuantity/ trackInventory/ forSale` | `prisma/schema.prisma` lin. 1177 (Product) |
| `ProductVariant` lastne količine | `prisma/schema.prisma` lin. 1572 |
| `StockMovement` (ledger) | `prisma/schema.prisma` lin. 2130 |
| `StockMovementSource` (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN) | `prisma/schema.prisma` lin. 2120 |
| `Order` / `OrderItem` (variantId, NE batch) | `prisma/schema.prisma` lin. 1244 / 1303 |
| `OrderStatus` (PENDING/PAID/COMPLETED/CANCELLED/REFUNDED) | `prisma/schema.prisma` lin. 1329 |
| `ExtensionRecord` (batch/harvest entiteta) | `prisma/schema.prisma` lin. 1533 |
| OB prodaji zaloga zniža + OUT ORDER | `src/app/actions/product-checkout.ts` lin. 91 (`applyOrderStockDecrement`), še posebej lin. 124–134 |
| Rezervacija zaloge | `src/app/actions/product-checkout.ts` lin. 166 (`reserveStock`) |
| Sprostitev rezervacije | `src/app/actions/product-checkout.ts` lin. 187 (`releaseStockReservation`) |
| Plačilo → zaloga + OUT | `src/app/actions/product-checkout.ts` lin. 208 (`convertReservationToSale`, lin. 226–235) |
| StockMovement IN/OUT možnost batch | `src/app/actions/inventory.ts` lin. 81 (`createStockMovement`) |

**Ta dopolnitev 2D-1E NIJE implementirana — predlog (read-only).** Shema/izvirni model 2D-1D ostaja;
dopolnilne so: natančna bilančna formula, delna vračila (kot StockMovement RETURN z returnOfOriginId),
natančna kartoteksna odločitev o vsakem polju, rezervacije (brez lažnega gibanja), preklic surovine z
vračilom sorazmernega deleža. **Čakam izrecno odobritev za Faza 2D-1A (shema/migracija) ob uskladitvi s
tujim WIP.**

---

# DOPOLNITEV 2D-1F — ZADNJA VALIDACIJA MODELA (IDENTIFIKACIJA VRAČIL, REZERVACIJE, PREKLIC SUROVINE, KOREKCIJE, INTEGRIRANI DOKAZ) — read-only

Končna validacija pred odobritvijo sheme. Razreši 5 nedorečenosti iz 2D-1E in zaključi s sklepnim
PASS/PARTIAL odgovorom. Vse trditve o obstoječem sistemu so potrjene v working tree (dejanske
datoteke/funkcije). **Git preverjen (read-only):** na delu so velike neoddane spremembe (`git status`),
tudi `prisma/schema.prisma` in `src/app/actions/product-checkout.ts`; vendar so vse potrjene linije
(StockMovement 2130, StockMovementSource 2120, OrderItem 1303, OrderStatus 1329, Product 1177,
ProductVariant 1572, ExtensionRecord 1533; `applyOrderStockDecrement` 91, `reserveStock` 166,
`releaseStockReservation` 187, `convertReservationToSale` 208) **v working tree identične kot v HEAD**
(diff kaže le dodajanje `reservedQuantity` na Product/Variant, drugače struktura nespremenjena). Tujega
WIP-a nisem spreminjal. **Nič ni implementirano — čakam izrecno odobritev.**

---

## 1. Pravilna identifikacija delnih vračil (popravek 2D-1E §2)

### 1.1 Napaka v 2D-1E
- Omejitev `@@unique([organizationId, allocationId, returnOfOriginId])` (StockMovement, predlagano v 2D-1E)
  je **prestroga**: dovolila bi največ **eno** vračilo na isti prvotni OUT, kar onemogoča RETURN 1(potreben
  so trije RETURNi na isti OUT). Pravilno je treba ločiti tri pojme.

### 1.2 Trije ločeni pojmi
| Pojem | Polje | Tabela | Pomen | Enoličnost |
|---|---|---|---|---|
| Prvotno prodajno gibanje | `returnOfMovementId` | StockMovement (na RETURN) | kateri `OUT source=ORDER` to vračilo popravlja | **NI enoličen** — več RETURNov lahko kaže na isti OUT (dokler `Σ RETURN ≤ izdano`) |
| Posamezen vračil nad dogodek | `idempotencyKey` | StockMovement (na RETURN) | unikatni ključ **tega vračila** — prepreči podvojitev ob ponovnem zahtevku (replay/retry) | **enoličen** — `@@unique([organizationId, idempotencyKey])` (org-scoped) |
| Prodajna razdelitev | `allocationId` | StockMovement (na RETURN) | povezava na `OrderItemBatchAllocation` (batch/serija + prodajni kontekst) | ni enoličen per movement |

### 1.3 Model vračila (pravilen)
```
StockMovement (RETURN):
  id                String @id
  organizationId    String
  allocationId      String?                 // → OrderItemBatchAllocation (serija fiksirana skozi alloc)
  returnOfMovementId String?                // → prvotni OUT (source=ORDER), lahko N-krat za isti OUT
  idempotencyKey    String?                 // unikatni ključ tega vračila (org-scoped)
  resellable        Boolean @default(true)  // true→vrne se v prodajno zalogo
  quantity          Int   // vrnjeno število kosov (>0)
  direction IN, source RETURN
  @@unique([organizationId, idempotencyKey])          // enoličnost dogodka – NIKOLI alloc/returnOf
  @@index([organizationId, allocationId])
  @@index([organizationId, returnOfMovementId])
```
- **`@@unique` na vračilo je izključno `(organizationId, idempotencyKey)`** — NE `(alloc, returnOf)`. To
  dovoljuje **več delnih vračil istega OUT** (RETURN 1/2/3 → isti `returnOfMovementId`, različni
  `idempotencyKey`).
- **Dvojno knjiženje istega logičnega vračila** → ponovisljeni `idempotencyKey` → `DUPLICATE_RETURN`
  (brez druge vrstice).
- **Dvojno vračilo istega fizičnega kosa brez idempotency** → ni tehniknični, ampak **poslovni** prever
  z `Σ RETURN(alloc) ≤ Σ OUT(alloc)`, atomično v transakciji: `RETURN_OVERFLOW`.
- **`returnOfMovementId` služi odgovoru "koliko je bilo vrnjeno tega prvotnega gibanja, do kdaj"** in
  porezavi z prvotnim OUT za revizijsko sled (ne kot idempotency).

### 1.4 Primer OUT 5 → RETURN×3 (vsak na isti OUT)
```
OUT #10 (source=ORDER, qty=5, allocationId=allocA)
  RETURN #1 (returnOfMovementId=OUT#10, idempotencyKey=slovenija-r1, qty=1, resellable=true)
  RETURN #2 (returnOfMovementId=OUT#10, idempotencyKey=slovenija-r2, qty=1, resellable=true)
  RETURN #3 (returnOfMovementId=OUT#10, idempotencyKey=slovenija-r3, qty=1, resellable=false)
Preverba ob vsakem: Σ RETURN(allocA) = 1+1+1 = 3 ≤ Σ OUT(allocA) = 5 ✓ → NULL odpor.
Ponovi RETURN#1 z istim ključem slovenija-r1 → DUPLICATE_RETURN (ne +3).
```

---

## 2. Ločeno: rezervirano / izdano / neizdano (popravek 2D-1E §2, §5)

### 2.1 `PARTIALLY_ISSUED` NA NI rezervacija
- `OrderItemBatchAllocation.status` iz 2D-1D/E (PARTIALLY_ISSUED/ISSUED/CANCELLED) **sme označevati samo
  izdajno napredovanje**, nikoli rezervacijo. Rezervacija je **samostojna količina**, ki mora biti
  ločena od statusa, sicer pride do protislovij (npr. 10 rezervirano, 4 izdano: status bi bil hkrati
  "rezerviran" in "delno izdan").
- **Skupna naročena / rezervirana / izdana / vrnjena / preostala** za vsako razdelitev:
```
ordered      = alloc.quantity                        # skupna naročena količina te serije
reserved     = Σ reservation.reservedQty (ločena evidenca, §2.2)      # REZERVACIJA
issued       = Σ OUT(alloc).quantity                 # vse izdaje (source=ORDER)
returned     = Σ RETURN(alloc).quantity              # vse izdaje vračil
preostala    = alloc.quantity − issued               # še neizdano iz SERIJE (neodvisno od rezervacije)

preverbe:
  reserved ≤ available (serija)
  issued   ≤ ordered
  returned ≤ issued
```
- **Statusi NIKOLI ne smejo biti v nasprotju z količinami**: status izpeljemo iz količin (aggresiven:
  `issued=0 → PARTIALLY_ISSUED` je samo informativno; izdajno stanje = `issued` ≥ `ordered` ? no more),
  količine so vedno avtoriteta (ledger + reservation).

### 2.2 Rezervacije v ločeni tabeli (priporočeno — najmanjši in revizijsko pravilen model)
- **Ločena tabela `StockReservation`** (org-scoped), NE status na alloc in NE številsko polje na alloc:
```prisma
model StockReservation {
  id             String  @id @default(cuid())
  organizationId String
  allocationId   String              // → OrderItemBatchAllocation
  reservedQty    Int                 // >0, rezervirano število kosov
  status         ReservationStatus   // RESERVED | RELEASED | EXPIRED | CONVERTED
  idempotencyKey String?             // enolični ključ rezervacije – anti-dup
  createdAt  DateTime @default(now())
  releasedAt DateTime?
  organization Organization @relation(..., onDelete: Cascade)
  allocation  OrderItemBatchAllocation @relation(...)
  @@unique([organizationId, idempotencyKey])   // enoličnost rezervacijskega dogodka
  @@index([organizationId, allocationId])
  @@index([organizationId, status])
}
```
- **Zakaj ločeno:** (a) več rezervacij iste razdelitve je revizijsko ločeno sledljivih; (b) `status` alloc
  ni več dvoumen; (c) sprostitev/expire se zapiše kot sprememba `StockReservation.status`, ne kot
  spreminjanje alloc; (d) `reservedQty` se da atomično preveriti.
- **Razpršena zasedenost** → `Σ stockReservation.reservedQty (status=RESERVED) for alloc` (ali po
  batch prek alloc). Zrcaljenje v `Product/Variant.reservedQuantity` (obstoječe, `reserveStock`/
  `releaseStockReservation` v `product-checkout.ts`) ostaja samo za UI.
- **Alternativa zavrnjena:** števićno polje na alloc (`reservedQty` + status) — ne razlikuje več
  RELEASED/EXPIRED/CONVERTED in bi zahtevalo mute existing alloc (proti append-only). → **ločena tabela**
  je najmanjši model, ki daje pravilno revizijo.

### 2.3 Matematični primeri
```
A) 10 rezerviranih, 0 izdanih:
   ordered=10, reserved=10 (StockReservation RESERVED Σ=10), issued=0, returned=0,
   preostala=10; available se zniža za 10 (rezervacija), StockMovement nič.

B) 10 rezerviranih, 4 izdani:
   reserved=10, issued=4 (Σ OUT alloc), preostala=10−4=6, available znižan za 10;
   ob izdaji se sprostita REZERVACIJA (status CONVERTED) + OUT zniža produkcijo:
      po izdaji 4: reserved=10−4=6 rezervirano, issued=4, preostala=6.

C) 10 izdanih, 2 vrnjena:
   issued=10, returned=2, preostala=0; prodano neto=8; available = +2 (če resellable=true) ali +0 (če poškod.).
   Rezervacija: 0 (že vsa konverted).

D) 10 naročenih, 4 rezervirani, 3 izdani:
   ordered=10, reserved=4, issued=3, returned=0, preostala=10−3=7;
   available znižan za (4 rezervirano + 3 izdano); 3 izdani kosov izhaja iz rezervacije (CONVERTED, reserved→1? Ne:
   po izdaji 3 → reserved=4−3=1, issued=3).
```

---

## 3. Popravljeno vračilo surovine ob preklicu (10 kg → 19×0.5 kg, 0.5 kg izguba)

### 3.1 Kritika 2D-1E
- 2D-1E je predlagal **sorazmeren** return: `rawReturnKg = inputQuantity × (returnedUnits/units)` in s tem
  **vrniti tudi del izgube** ali ga prenesti na popolnoma sintetično vrednost. To je **napačno**: izguba
  (0.5 kg) NIKOLI ni fizično obnovljiva in se ne sme vračati kot obnovljiva surovina.

### 3.2 Ločimo 4 pojme
1. **Računovodska količinska korekcija** — popravek zabeležene input/neto količine (korekcijski dogodek,
   §4), ne fizično vračilo.
2. **Fizično vračilo materiala v zalogo** — le toliko, kolikor je **fizično** ostalo neporabljenega
   (izmerjeno/tehtano), NIKOLI izgube.
3. **Proizvodna izguba** — `ProductionContribution.lossQuantity`, ostane zabeležena, ni obnovljiva.
4. **Neto količina v izdelkih** — neto v že izdelanih in **prodanih** kozarcih; NI več prosto dostopna
   surovina (povezana skozi alloc/batch na prodane kosine).

### 3.3 Primer
```
input = 10 kg, neto izdelkov = 19 × 0.5 = 9.5 kg, loss = 10 − 9.5 = 0.5 kg, units = 19 koz 500g.
```
- Prekličeš **preostanek proizvodnje** (še neizdane kozarce). Edina fizično obnovljiva količina = surovina,
  ki **še ni bila vlita v izdelke** in je fizično ostala. Če so vsi 19 kozarCEV že izdelani, ni obnovljive
  surovine (vsa je v izdelkih ali izgubljena).
- **Koliko je obnovljive:** = tehtano/izmerjeno ostalo, **NE sorazmeren izračun**. Sistem MORA ob preklicu
  zahtevati **dejansko tehtanje ali uporabniški vnos** `actualReturnedKg` (ali `zero`), NIKOLI samodejno
  izpeljati iz units. Če količine ni mogoče zanesljivo določiti → `REQUIRES_MEASUREMENT` (preklic se ne
  izvede, dokler operater ne vnese dejanske vrednosti ali izrecno `measuredKg`).
- **Izguba (0.5 kg)**: ostane kot `lossQuantity`; ob preklicu se ne vrača in ne briše (`lossQuantity`
  se ne spreminja navzdol).
- **Surovina v prodanih izdelkih**: ostane vezana na alloc/batch → ni dostopna. Prodaneko neto kg =
  `(št. prodanih koz) × netGrams`, vzdržano le za prikaz, ne kot prosto zalogo.
- **Prepreči dvojno vračilo iste surovine:** vsako fizično vračilo surovine = svoj `ProductionContribution`
  **reversal** z enoličnim `idempotencyKey`; `Σ returnedRaw(contribution) ≤ nesporabljena` → `RAW_RETURN_OVERFLOW`;
  nikoli ista surovina ne vrne 2× (po `sourceRecordId` + batch + idempotencyKey).

### 3.4 Pravilo
> Fizično vračilo surovine = **dejansko tehtano** (uporabniški vnos), nikoli sorazmeren popravek;
> izgube se nikoli ne vračajo; prodano ostaneta vezano na prodajno sled; vsako vračilo ima `idempotencyKey`
> in se preverja `Σ returnedRaw ≤ nesporabljena`.

---

## 4. Append-only korekcije (enoten mehanizem, najmanjši model)

### 4.1 Načelo
- **NIČ naknadnega tihega prepisovanja zgodovinskih količin.** Vsaka sprememba (korekcija prispevka,
  proizvodne količine, prodajne razdelitve, vračila, preklica) = **nov append-only dogodek** (nov StockMovement,
  nov StockReservation, nov ProductionContribution "reversal"), nikoli `UPDATE` obstoječe vrstice s
  prepisom količine.
- **Trenutno veljavno stanje je vedno AGRGAT (suma) vesv še-veljavnih dogodkov** = `Σ IN − Σ OUT` (veljavni
  StockMovement) ali `Σ contribution (nekancelirani)`; zgodovinski vpisi ostanejo, njihov vpliv se ukinja
  z nasprotnim (reverznim) dogodkom, ne z brisanjem.

### 4.2 Kateri entitete se koreigirajo in kako
| Entiteta | Korekcija = | Nov dogodek |
|---|---|---|
| ProductionContribution (proizvodni prispevek) | nov contribution `inputQuantity` = (+/−), `netQuantity`, `lossQuantity`, z `idempotencyKey` + referenca na prvotni (`sourceRecordId`+`batchRecordId`) | nov contribution vrstica (reversal/korekcija) |
| proizvodna količina (units/stock) | reversal/IN `StockMovement` (PRODUCTION), nikoli `UPDATE` IN | nov StockMovement |
| prodajna razdelitev (alloc) | **ne spreminjamo alloc; korekcija = nov izdajni/rezervacijski/vračil dogodek** (OUT/RETURN/StockReservation); alloc.quantity se v normalnem znosu NE »popravi« | nov StockMovement / StockReservation |
| vračilo | popravek vračila = **nov** StockMovement (npr. ponovna knjižba / reversal vračila), NIKOLI sprememba vrstice RETURN | nov StockMovement |
| preklic | reversal dogodek (OUT PRODUCTION ali contribution reversal) | nov StockMovement / contribution |

### 4.3 Pozitivne in negativne količine?
- **Na StockMovement** je `quantity Int > 0` (Prisma, lin. 2136); smer podaja `direction` IN/OUT, **ne
  predznak**. Torej **ne uporabljamo negativnih količin** na StockMovement — vzvodna korekcija je ločen
  OUT (reversal). Enako `StockReservation.status` (RESERVED/RELEASED/CONVERTED/EXPIRED) — ne negativni.
- **Edini model, kjer so negativne decimalne vrednosti delovne** je `ProductionContribution.inputQuantity`
  (Decimal 14,4) za surovinske korekcije/reversal (npr. `−actualReturnedKg`). Tu je predznak smiseln
  (količina snovi, ne enote kosov).

### 4.4 Trenutno veljavno stanje (idempotentno)
```
available(batch)       = ΣIN(PROD) − ΣOUT(ORDER) − ΣOUT(WASTE/reversal) + ΣRETURN(resellable) − Σotten reserved
issued(item)           = Σ OUT(alloc)
returned(item)         = Σ RETURN(alloc)
used raw (contribution)= Σ inputQuantity (non-canceled)     # reversal z negativnim zmanjša
remaining raw          = originalKg − Σ inputQuantity (non-canceled)
```
- **Idempotentnost:** vsak korekcijski/reversal dogodek nosi `idempotencyKey` `@@unique(org, idempotencyKey)`
  ali uniq per konkretno kombinacijo; ponovljeni zahtevek → `DUPLICATE` brez dvojne knjižbe.
- **Negativna zaloga:** vsaka akcija atomično preveri `available ≥ qty` → `NEGATIVE_BATCH/NEGATIVE_STOCK`
  pred write (enako kot obstoječi `product-checkout.ts` OUT z `stockQuantity ≥ quantity`, lin. 117, in
  `applyOrderStockDecrement`).

### 4.5 Najmanjši model (brez dodanih nad- tabel)
- **Ne uvajamo** ločene tabelæ "correction events" — korekcije so **že obstoječa vrsta dogodkov**
  (nov StockMovement, nov StockReservation, nova/korekcijska contribution vrstica). To je najmanjši model,
  ki zagotavlja revizijsko sled: vsaka sprememba je samostojna vrstica v že obstoječem/načrtovanem ledgerju.
- Dodatne omejitve so samo `idempotencyKey` uniq (na StockMovement z RETURN/PRODUCTION, na StockReservation,
  na ProductionContribution), ne nova tabela.

---

## 5. Končni integrirani preizkus (pridelek 10 kg … )

### Predpostavke (izrecno)
1. Surovina = 10 kg harvest; vnos `inputQuantity=10`, `netQuantity=9.5` (=19×0.5), `lossQuantity=0.5`, `units=19`.
2. Vseh **19 kozarcev je fizično izdelanih** (Input v zalogo: `IN PRODUCTION qty=19`).
3. Preklic preostanka se nanaša na **še neizdane kozarce**, pri čemer **ni fizično ostale surovine**
   (vsa je v 19 izdelanih kozarcih oz. 0.5 kg izgube); vračilo surovine = 0 → operater potrdi
   `measuredKg=0` (dejansko tehtanje). To je **eksplicitna predpostavka** – ni samodejno sorazmerno vračilo.
4. Prodanih 7 kozarcev iz rezervacije; od vrnjenih 2 je **1 poškodovan** (resellable=false), 1 ponovno
   prodajen (resellable=true).

### 5.1 Količine po korakih (dokaz – vsa stanja)
```
Korak0  pridelek:            original=10 kg, reservedRaw=10 kg, loss=0, contribution → (input10, net9.5, loss0.5)

Korak1  proizvodnja 19 koz:  StockMovement IN PRODUCTION qty=19  → zaloga serije = 19 (fizična)
        contribution: input=10, net=9.5, loss=0.5   (inputDecimal)
        Ostanek surovine = 10 − 10 = 0 kg           (vsa porabljena v 19 koz + izgubo)

Korak2  rezervacija 10 koz:  StockReservation (RESERVED) reservedQty=10, idempotencyKey=r1
        available(batch) = ΣIN 19 − ΣOUT 0 + ΣRET 0 − ΣWASTE 0 − 10 = 9
        (zasedeno 10 koz, fizično 19)

Korak3  izdaja 7 koz:        StockMovement OUT ORDER ×7 (allocationId, returnOf —), source=ORDER
        ΣOUT = 7; reserved se sprosti (7 CONVERTED → reserved=10−7=3); issued=7
        available = 19 − 7 + 0 − 0 − 3 = 9   (3 rezervirano + 9 neizdano-nezasedeno)
        Zasedeno (reserved) = 3, fizično na zalogi = 19 − 7 = 12

Korak4  vračilo 2 koz:        RETURN#1 qty=1, resellable=true  → vrnjeno ponovno prodajno 1
                             RETURN#2 qty=1, resellable=false → vrnjeno poškodovano 1
        returned = 2; ΣRETURN ≤ ΣOUT(7) ✓
        available = 19 − 7 + 1(resell) − 0 − 3 = 10   (poškodovan 1 NE vrne v prodajno)
        fizično na zalogi = 19 − 7 + 2 = 14 (12 + 2 vrnjena), od tega 1 poškodovanega neprosjejno.
        prodano neto = 7 − 2 = 5  (fizični odhod: vračila odštejemo)
        prodano(blagovno) = 7; poškodovano = 1; ponovno prodajni vračila = 1.

Korak5  preklic preostanka proizvodnje:
        Neizdani kozarci po vračilih: 19 − 7 = 12 fizično (od katerih 1 poškodovano neprosjejno, 10 neizdano
        + 1 resell. vračilo = 11 za prodajo).
        Preklic: reversal OUT PRODUCTION qty = razpoložljivo NEIZDANO (brez rezerviranih in poškodovanih):
        da ne znegativne in da ne razveljavi rezervacije → reversal= (ΣIN − ΣOUT − ΣRETURN resell − Σreserved
        − poškodovan) = 19 − 7 − 1 − 3 − 1 = 7? BANLAČNO preverimo:
          zaloga serije po korakih: ΣIN=19, ΣOUT(ORDER)=7, ΣRET(resell)=+1, ΣWASTE=0, reversal_neizdano=x,
          reserved=3, poškodovan nakazan v ZALOGI (ne izda, je OUT WASTE ne? – poškodovan a vrže iz zaloge).
        Poškodovan (resellable=false) se NIKOLI ne vrača v prodajno zalogo; fizično ostane/odpiše → knjiži se
        OUT source=STOCKTAKE (ali WASTE) qty=1. REVERSAL preklica = razpoložljivo = ΣIN − ΣOUT − ΣRETresell − ΣWaste − Σreserved
          = 19 − 7 − 1 − 1 − 3 = 7.  Potem available po preklicu = 19 − 7 +1 − 1 − 7 − 3 = 2 (2 = poškodovan? Ne:
          poškodovan je ŽE odštet z WASTE; po preklicu available = 0 razpoložljivo, neizdani izšel preko reversal).
        Končno: neizdani kozarci, ki niso rezervirani in niso poškodovani = 19 − 7 (prodanih) − 1 (rez. preostala? ) 
        Po obravanju: kot ispošča available POST preklic = 0 novo proizvodno razpoložljivo; kozarci, ki ostanejo
        v zalogi = samo poškodovan (1) + rezervirana (3) = 4; vse ostalo (neizdani, neprodano) je preklicano.

Podrobna verifikacija z ledgerjem (točno, nedvoumno):
  IN  PRODUCTION qty19 (izdano v zalogo)
  OUT ORDER       qty7  (prodanih)
  IN  RETURN      qty1 resellable (ponovno prodajen)
  IN  RETURN      qty1 resellable=false (poškodovan → spada BILANČNO na izmeje, odhaja z WASTE)
  OUT STOCKTAKE/WASTE qty1 (poškodovan odpisan, NI prodajnega)
  OUT PRODUCTION reversal qty = 19−7−1(resell)−1(waste)−3(reserved) = 7   (neizdano, neprodano)
  (rezervirano 3: v končni izvedbi ali vzdrži [ostane zasedeno] ali se sprosti; za dokaz vzamemo da ostane)
  ΣIN  = 19 + 2 = 21
  ΣOUT = 7 + 1 + 7 = 15
  available = (ΣIN − ΣOUT) − poškodovan ? = (21−15) = 6 – ampak from returned lost 1 poškod: available = 21−15 =6,
    a poškodovan je potechled (OUT WASTE), tako da available (ostat.resell + reserved) = ? 
    Natančno po PRAVILIH §1: razpoložljivo = ΣIN(PROD) − ΣOUT(ORDER) + ΣRETURN(resell) − ΣOUT(WASTE) − ΣOUT(PROD reversal) − rezervirano
      = 19 − 7 + 1 − 1 − 7 − 3 = 2
    Ta 2 = 2 »poškodovani vrnjeni kos … čakanju« ? Ne: poškodovan je ŽE v WASTE (−1). Torej »2« = še vedno ? 
    Rešitev: formula »razpoložljivo« NIKOLI ne vključuje poškodovanih vračil (resellable=false :) se sploh NE
      prištejejo. Ker smo WASTE qty1 odšteli kot posebej vzvod (na src poš.), je output po formuli pravilen,
      če WASTE odpise točno tisti poškodovan kos: available = 19−7+1(resell)−1(waste [poškodovan])−7(reversal)−3(reserved) = 2.
    Kam gre 2? poškodovan restek ni vračan; 2 = še vedno prisotni KOSI (npr. 2 neizdana, ki niso bila pode v
      reversal, če rezervacija ne pokriva vsega). OPOZORILO: s tem je formulčno »2« mogoče – vendar odvisno od
      tega, kako se poškodovan vodi (Waste) in ali rezervacija. S tem dokazom potrjujemo, da je BILANCA
      DETERMINISTIČNA in se da razbrati, NIKOLI ni predpostavljenih vrednosti.
```
### 5.2 Stanja po korakih (končno, tabela – zahteva)
| Predmet stanja | Vrednost | Vir |
|---|---|---|
| Stanje surovine | porabljeno 10 kg (input), neto 9.5, izguba 0.5; obračovno ostalo 0; fizično vračilo surovine = **0** (predpostavka merjenja) | ProductionContribution |
| Stanje proizvodne serije | IN 19 (PROD) − OUT 7 (ORDER) − OUT 1 (WASTE–poškod) − OUT 7 (reversal) − rezervirano 3 = **19−7−1−7−3 = 1** fizično (rezervirano) ; serija `PARTIALLY_CANCELED` | StockMovement + alloc/reserved |
| Stanje rezervacij | rezervirano = 3 (iz 10, 7 CONVERTED/izdano) | StockReservation (RESERVED=3) |
| Stanje končnih izdelkov | 19 izdelanih; prodanih 7; vrnjenih 2 (1 ponovno prodajen, 1 poškodovan); v zalogi = rezervirano 3 + (obdržani), neprodano neizdano preklicano | StockMovement |
| Neto prodaja | 7 − 2 = **5** (fizični) / 7 bruto | StockMovement OUT/RETURN |
| Poškodovano blago | 1 kos (RETURN resellable=false → OUT WASTE qty1) | StockMovement RETURN + OUT WASTE |
| Razpoložljiva zaloga | `19 − 7 + 1 − 1 − 7 − 3 = **2**` (glej opozorilo: odvisno od obravnave poškodovanega/reversal; barvno determinizem iz ledgerja) | StockMovement form. §1 |
| Zgodovina StockMovement | IN PROD 19; OUT ORDER 7; RETURN 2 (1 resell + 1 poškodn); OUT WASTE 1; OUT PROD reversal 7 | StockMovement |

**Sklep (integriran dokaz):** model razumljivo vedenje vseh količin iz enega ledgerja, dodano
`StockReservation` (3), izgube v `ProductionContribution` (0.5), poškodovanje kot OUT WASTE. Vse številke
izhajajo iz podatkov; nič inherentno ne izgine in nič ni 2×. Za preostali »2« po formuli je izrecno
predpostavljena obravnava poškodovanega (že odšteje prek WASTE) in da rezervacija ostane zasedena –
**prepoznano kot odprto** (glej §7).

---

## 6. Končna odločitev in dokumentacija za odobritev

### 6.1 Dokončen seznam tabel in polj (predlog, read-only)
```
enum OrderItemBatchAllocationStatus { PARTIALLY_ISSUED, ISSUED, CANCELLED }
model OrderItemBatchAllocation {
  id, organizationId, orderItemId, batchRecordId, quantity Int(@unique(org,orderItem,batch)),
  status OrderItemBatchAllocationStatus default(PARTIALLY_ISSUED)   // SAMO izdajno (ne rezervacijsko)
  @@unique([organizationId, orderItemId, batchRecordId])
  @@index([organizationId]) @@index([organizationId,batchRecordId]) @@index([orderItemId]) @@index([batchRecordId])
}
enum ReservationStatus { RESERVED, RELEASED, EXPIRED, CONVERTED }
model StockReservation {
  id, organizationId, allocationId, reservedQty Int>0, status ReservationStatus,
  idempotencyKey String?, createdAt, releasedAt?
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, allocationId]) @@index([organizationId, status])
}
model ProductionContribution {
  id, organizationId, batchRecordId, sourceRecordId, inputQuantity Decimal(14,4),
  netQuantity Decimal(14,4), lossQuantity Decimal(14,4) def 0, unit String, honeyType?
  @@index([organizationId,batchRecordId]) @@index([organizationId,sourceRecordId])
}
// StockMovement (2120/2130) dodano (na RETURN/PRODUCTION):
//   allocationId String?
//   returnOfMovementId String?
//   idempotencyKey String?   @@unique([organizationId, idempotencyKey])
//   resellable Boolean default(true)
//   enum StockMovementSource + PRODUCTION (+ WASTE po izboru; RETURN/STOCKTAKE že obstaja)
// rezervirano se NE hrani na alloc – ločena StockReservation (glej §2)
```

### 6.2 Dokončne unikatne omejitve in indeksi (predlog)
| Omejitev/Indeks | Tabela | Namen |
|---|---|---|
| `@@unique(org, orderItem, batch)` | OrderItemBatchAllocation | en razdelekna razdelitev na (orderItem,serija) |
| `@@unique(org, idempotencyKey)` | StockMovement (RETURN/PRODUCTION) | prepreči dvojno vračilo/reversal, idempotency |
| `@@unique(org, idempotencyKey)` | StockReservation | prepreči dvojno rezervacijo |
| `@@unique(org, idempotencyKey)` | ProductionContribution | prepreči dvojno korekcijo surovine |
| index (org), (org,batch), (orderItem), (batch) | OrderItemBatchAllocation | poizvedbe |
| index (org,alloc),(org,status) | StockReservation | agregati rezervacij |
| index (org,batch),(org,source) | ProductionContribution | proizvodne/surovinske poizvedbe |
| index (org), (org,product), (product), (createdAt) [obstoječi 2159–2162] + (allocationId),(batchRecordId),(returnOfMovementId) | StockMovement | izvor/bilančni agregati |

### 6.3 Transakcijske meje
- Rezervacija: atomično `available(batch) ≥ reservedQty` → `NEGATIVE_BATCH`; ena transakcija (
  StockReservation + zrcaljeni `Product.reservedQuantity`), `idempotencyKey` prevent.
- Izdaja: ena transakcija: preverba `issued ≤ ordered` + `available ≥ qty`; bivanje OUT `StockMovement`
  + StockReservation→CONVERTED, `ALLOC_OVERFLOW/NEGATIVE_STOCK` na napaki.
- Vračilo: ena transakcija: `ΣRETURN ≤ ΣOUT` (`RETURN_OVERFLOW`) + RETURN StockMovement + (poškodovan)
  opcijski OUT WASTE; `idempotencyKey` prevent.
- Preklic proizvodnje: ena transakcija: `reversalQty = available (iz ledgerja)` + reversal OUT PRODUCTION
  + contribution reversal (surovino `measuredKg`, `REQUIRES_MEASUREMENT` če ni), NIkoli negativ.
- Korekcija: ena transakcija (nov dogodek), nikoli UPDATE starih.

### 6.4 Poslovna pravila (strnjena)
- Razpoložljivo = ledger formula §1 (StockMovement + reserved).
- Delna vračila: več RETURN isti OUT dovoljena, `ΣRETURN ≤ ΣOUT`, `idempotencyKey` uniq.
- Rezervacije: ločena `StockReservation`; rezervacija/plačilo NIKOLI ne ustvari StockMovement.
- Rezervacija NIKOLI status na alloc; `allocation.status` je izdajno samo.
- Preklic surovine: vrača se SAMO fizično merjeno ostalo, izgube nikoli; `measuredKg` zahtevano.
- Korekcije append-only (negativne decimalne le za contribution surovinske reversal; StockMovement vedno >0 z smerjo).
- Prodane/rezervirano/poškodovano nikoli ne je v reversal; negativna zaloga zavrnjeno.

### 6.5 Celotna matematična bilanca (§1 iz 2D-1E, potrjeno)
```
available  = ΣIN(PROD) − ΣOUT(ORDER) + ΣRETURN(resell) − ΣOUT(WASTE) − ΣOUT(PROD reversal) − reserved
issued     = Σ OUT(alloc)
returned   = Σ RETURN(alloc)
prodano neto = issued − returned
izgube     = Σ lossQuantity (ProductionContribution)
remaining raw = originalKg − Σ inputQuantity (non-canceled)
```

### 6.6 Testni scenariji (§5 razširjen)
1–18 §5 2D-1D/E + dodano:
- RETURN 1/2/3 istega OUT (additional) → 3 RETURN vrstice, isti returnOfMovementId, različni idempotencyKey, group claim.
- return>issued (RETURN 6 iz alloc 5) → `RETURN_OVERFLOW`.
- duplicate return istega idempotencyKey → `DUPLICATE_RETURN`, ne +qty.
- StockReservation: 10 res → 4 izdano → reserved 6; 10 naročeno/4 res/3 izdano → invalid (issued>reserved) and valid (issued≤reserved) resi.
- Preklic surovine: measuredKg več, measuredKg=0, requiresMeasurement (brez vnosa).
- Integriran primer §5 (19 koz, 10 res, 7 izd, 2 vrnj.Poškodovan, preklic) — all states as §5.2.
- korekcija alloc/contribution → nov dogodek, stari nespremenjen (append-only assert).

### 6.7 Preostala tveganja
- **Obravnava poškodovanega** (`WASTE` kot zasebni OUT ali samo `resellable=false` brez OUT) — vpliva na
  bilanco (še v §5.2 nit). Odločiti ob 2D-1A: enoten "poškodovan kos = OUT WASTE" ali "ostane v zalogi
  kot neprodajno"; predlagano: OUT WASTE.
- **Logika "razpoložljiv/neizdano ob preklicu"** z rezervacijo + poškodovanem — odvisno od pravilnega
  izračuna reversal; predlagana formula §6.5, a vezana na odločitev iz prejšnje točke.
- **`returnOfMovementId` kadar je OUT zaprt/zgodovinski** — mora biti referenca na še-veljavni OUT ali je
  dovoljeno tudi na že preklican? (predlagano: vedno veljaven).
- **Uskladitev s tujim WIP schema.prisma** (mnogo neoddanih sprememb) — vsaka shema-sprememba zahteva
  uskladitev pred migracijo.
- **Pakiranje/neto g** (`netGrams`) — vnos realnega neta, decimal, ne izključno pretvorba.

---

## 7. Odprta vprašanja (za dokončno odločitev ob 2D-1A)
1. Poškodovan kos: OUT WASTE vs samo `resellable=false` (determinizem bilanci).
2. Sprostitev rezervacijo ob preklicu: ali se `StockReservation` preostali (RESERVED) po preklicu SPROSTI
   ali ostane vezana (odvisno od naročila statusa).
3. `returnOfMovementId` — ali dovoli vezavo na preklican/zaprt OUT.
4. Ali rezervacija povzroči zmanjšanje `available` za več serij hkrati (multi-batch alloc) — vedno per
   StockReservation→alloc.
5. `measuredKg` — operater vnese dejansko surovinsko stanje; format (decimal + enota).

## 8. SKLEP (odgovor na vprašanje naloge)

> **Ali je model zdaj dovolj natančen, da se lahko varno odobri Prisma shema in migracija?**

**PASS (z opombami)** — jedro modela (StockMovement kot edini založni ledger + `OrderItemBatchAllocation` +
`ProductionContribution` + ločena `StockReservation` + idempotencyKey za vračila/reverzale/rezervacije) je
dovolj natančno in matematično konsistentno, da lahko pride v shemo.

**PARTIAL preostal na dveh (majhnih) odgovornostih, ki jih je treba dokončno skleniti OB 2D-1A (ne blokirata
sheme, vplivata na bilančno podrobnost):**
1. **Obravnava poškodovanega vračila** (`resellable=false`): ali zapišemo ločen `OUT WASTE` (predlagano) ali
   samo označimo RETURN in ga pustimo v zalogi kot neprodajnega — to določa natančno obliko `available` (§5.2).
2. **Usoda rezervacij ob preklicu proizvodnje** (`StockReservation` RESERVED po preklicu: sprosti se ali
   ostane) — vpliva na končno zalogo in pravila sprostitve.

Vse ostalo (identifikacija delnih vračil prek `idempotencyKey`, ločena `StockReservation`, fizično merjena
obnovljiva surovina brez sorazmernega vračila, append-only korekcije, integrirana bilanca) je dorečeno.

**Čakam izrecno odobritev za Faza 2D-1A (shema/migracija) ob uskladitvi s tujim WIP.**

---

# DOPOLNITEV 2D-1G — DOKONČNA MATEMATIČNA VALIDACIJA ZALOGE, REZERVACIJ IN PREKLICA PROIZVODNJE — read-only

Zaključna matematična validacija. **Odpravlja protislovje iz 2D-1F §5** (nerazloženi »2«) z ločenimi
formulami za fizično/prodajno/poškodovano/rezervirano/izdano/vrnjeno/razpoložljivo/preklicano količino,
izbere strogo append-only rezervacijski model, dokončno določi 4 stanja poškodovanega vračila in preveri
obstoječi checkout. **Read-only — nič implementirano.**

**Potrjene reference (working tree):** `reserveStock` product-checkout.ts:166, `releaseStockReservation`:187,
`convertReservationToSale`:208 (skupaj z OUT ORDER movement lin. 226–235), `applyOrderStockDecrement`:91;
`StockMovement` prisma:2130, `StockMovementSource`:2120 (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN), `Order`/`OrderItem`:1244/1303, `OrderStatus`:1329, `Product`/`ProductVariant`:1177/1572, `ExtensionRecord`:1533.

---

## 1. Odprava protislovja v integriranem primeru (natančen izračun vsakega koraka)

### 1.1 Vzrok napake v 2D-1F §5
- 2D-1F je uporabil **eno mešano formulo** `available = ΣIN − ΣOUT + RETURN(resell) − WASTE − reversal − reserved`
  in **vnaprej določil** `OUT PRODUCTION reversal = 7`, nato dobil nerazložen preostanek »2«. Dve napaki:
  1. **Dvojno štetje poškodovanega kosa**: poskusil ga je hkrati prišteti kot vračilo `IN RETURN` in posebej
     odpisati kot `OUT WASTE 1`, v istem trenutku ko je fizično še v skladišču (v nasprotju z §4 tega
     dokumenta, ki prepoveduje OUT WASTE, če kos še obstaja).
  2. **Reversal ni bil matematično izpeljan** (`7` je bilo predpostavljeno, ne izvedeno iz bilance).
- **Pravilen pristop:** ločene, neodmešane formule (§2) in `reversal` izpeligi iz njih, NIKOLI vnaprej.

### 1.2 Fiksni vhodi (+ eksplicitne predpostavke)
1. Privzetek: `contribution inputQuantity=10, netQuantity=9.5 (19×0.5), lossQuantity=0.5, units=19` → zgodovina iz `ProductionContribution`.
2. Vseh 19 koz je fizično izdelanih in knjiženo `IN PRODUCTION 19`.
3. Rezervacija 10, izdaja 7 → **ostalo rezervirano 3** (rezervacija konvertirana le za izdani del).
4. Vračila 2 → 1 ponovno prodajen (`resellable=true`), 1 poškodovan (`resellable=false`).
5. **Poškodovan kos ostane fizično v skladišču** (`disposition=DAMAGED_AWAITING`), še NI odpisan → **brez OUT WASTE** v tem primeru.
6. »Preklic preostanka proizvodnje« = preklic **neizdane, neprodane, nerezervirane prodajne količine** = `available`.
   Ker je vseh 19 fizično izdelanih, izraz »preproizvod izdelanih« napako — glej §5 (natančno branje).

### 1.3 Ledger dogodkov (v celoti, edina avtoriteta)
```
Korak0  (pridelek)   ProductionContribution: {input=10, net=9.5, loss=0.5}   (kg)
Korak1  (proizvodnja)StockMovement IN PRODUCTION  qty=19 (batchRecordId)
Korak2  (rezervacija)StockReservationEvent RESERVE qty=10 (orderId, allocationId, batchRecordId)
Korak3  (izdaja)    StockMovement OUT ORDER        qty=7  (allocationId)
                   +StockReservationEvent CONVERT  qty=−7
Korak4  (vračilo)   StockMovement IN RETURN qty=1  resellable=true
                   StockMovement IN RETURN qty=1  resellable=false (disposition=DAMAGED_AWAITING)
Korak5  (preklic)   StockMovement OUT PRODUCTION   qty = reversal (izpeljano §1.4)
```

### 1.4 Izpeljava reversal (matematični dokaz, NIKOLI vnaprej)
Po koraku 4 (pred preklicem):
```
S = prodajno uporabna = IN_prod(19) + IN_ret_resell(1) − OUT_order(7) = 13
RES = 3
A = available = S − RES = 13 − 3 = 10      # neprodano, nerezervirano, prodajno uporabno
```
Preklic lahko odstrani le `available` (ne sme odstraniti: prodanih, rezerviranih, ponovno prodajno vrnjenih, fizično poškodovanih — §5):
```
reversal = A = 10
```
Po koraku 5:
```
S  = 13 − 10 = 3
RES = 3
A  = S − RES = 3 − 3 = 0        # nič več prosto za prodajo
P  = fizična = IN(19) + IN_ret_resell(1) + IN_ret_damage(1) − OUT_order(7) − reversal(10) = 4
D  = poškodovana (fizično prisotna) = 1
```
**Preverba brez dvojnega štetja:** `P(4) = sellable(3) + damaged(1) = 4` ✓. Ni nerazloženega »2«.
Rezervirana (3) ostane fizično v skladišču in še vedno zasedena (ni preklicana, ker bi to razveljavilo rezervacijo).

### 1.5 Tabela vseh stanj po vsakem koraku
| Korak | IN_prod | OUT_order | RET_resell | RET_damage | reversal | Δ fizično | P (fizična) | S (prodajna) | D (poškod.) | RES | Izdano | Vrnjeno | A (available) | Preklicano |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 19 | 0 | 0 | 0 | 0 | +19 | 19 | 19 | 0 | 0 | 0 | 0 | 19 | 0 |
| 2 | 19 | 0 | 0 | 0 | 0 | 0 | 19 | 19 | 0 | 10 | 0 | 0 | **9** | 0 |
| 3 | 19 | 7 | 0 | 0 | 0 | −7 | 12 | 12 | 0 | 3 | 7 | 0 | **9** | 0 |
| 4 | 19 | 7 | 1 | 1 | 0 | +2 | 14 | 13 | 1 | 3 | 7 | 2 | **10** | 0 |
| 5 | 19 | 7 | 1 | 1 | 10 | −10 | 4 | 3 | 1 | 3 | 7 | 2 | **0** | 10 |

**Skladnost vsakega stolpca (invarianti):**
- `P = S + D` (fizična = prodajno uporabna + poškodovana) → vsak korak velja: 19=19+0, 19=19+0, 12=12+0, 14=13+1, 4=3+1 ✓
- `S = IN_prod + RET_resell − OUT_order − reversal` (poškodovana vračila NISO v S) → 19,19,12,13,3 ✓
- `A = S − RES` → 19,9,9,10,0 ✓


## 2. Ločene formule (nikoli ena mešana)

Opredelimo **ločene, neodmešane** količine (vse so agregati po `batchRecordId` in, kjer je ustrezno, po `allocationId`):

```
Fizična količina P   = ΣIN_prod + ΣIN_ret_resell + ΣIN_ret_damage + ΣIN_ret_repair_return
                       − ΣOUT_order − ΣOUT_waste − ΣOUT_cancel − ΣOUT_repair_out
Prodajno uporabna S  = ΣIN_prod + ΣIN_ret_resell − ΣOUT_order − ΣOUT_cancel − ΣOUT_waste
                       (poškodovana vračila in kosi v popravilu NISO del S)
Poškodovana D        = ΣIN_ret_damage + ΣIN_ret_repair_return − ΣOUT_waste(kot odpisan)   # kosi, še fizično prisotni ali v obravnavi
Rezervirana RES      = Σ reservation.qty (aktivni, »neto +« dogodki, §3)
Izdana I             = ΣOUT_order
Vrnjena R            = ΣRETURN (vsi, resellable ali poškodovani)
Razpoložljiva A      = S − RES                                                             # prodajna, nerezervirana
Preklicana C         = ΣOUT_cancel
Neto prodana         = I − R                                                               # fizični odhodi, ki ostanejo prodani
```

### 2.1 Dokaz: noben kos ni dvakrat odštet / vrnjen / hkrati prodan in razpoložljiv / hkrati preklican in rezerviran
- **Noben kos ni dvakrat odštet:** vsaka kategorija je IN ali OUT z natanko eno vlogo. IN_prod/IN_ret so
  disjunktni vhodi; OUT_order/OUT_waste/OUT_cancel disjunktni izhodi. `P` je vsota neodvisnih komponent
  (`S` + `D`), noben kos ni hkrati v `S` in `D`.
- **Noben kos ni dvakrat vrnjen:** vsako vračilo ima `idempotencyKey` (enoličen) in `ΣRETURN(alloc) ≤ ΣOUT(alloc)`
  → isti kos se ne vrne 2×.
- **Hkrati prodan in razpoložljiv:** `A = S − RES`, `I = ΣOUT_order`, `S = IN − OUT`; ven iz `S` je izdani
  kos že izločen (`−OUT_order`) in ne more biti v `A`.
- **Hkrati preklican in rezerviran:** preklic = `A` (nerezerviran del); `RES` ni nikoli del `A`.
  Preverjeno: `reversal = A`, ohranja `RES` nedotaknjeno.

### 2.2 Posledica
- 2D-1F formula (§1 in 6.5) **je zamenjala poškodovano z `OUT_waste` v istem trenutku** (dvojno štetje) in
  tako dala »2«. **Ta dokument popravlja: poškodovan kos ostane v fiz. zalogi (`D`), dokler ni spremenjen v
  `OUT_waste` (§4); `OUT_cancel` se izpelje iz `A`, ne nastavi vnaprej.** → model v 2D-1F §5.2 je **POPRAVLJEN
  (PARTIAL pojasnjen), ne PASS poPOSTO nič spremenjeno**.


## 3. Strugo append-only model rezervacij (izbira med tremi)

### 3.1 Primerjava treh alternativ
| # | Model | Append-only? | Trenutno aktivna rezervacija | Ocena |
|---|---|---|---|---|
| 1 | ena vrstica `StockReservation` + mutable `status` (2D-1F) | ❌ **NE** (RELEASE/CONVERT prepisujeta status) | status polje | **Zavrnjen** — krši append-only |
| 2 | ločeni **dogodkovni** vrstici `RESERVE` / `RELEASE` / `EXPIRE` / `CONVERT(ISSUE)` | ✅ DA | `Σ qty (pozitivni) − Σ qty (negativni)` | **Izbran/priporočen** |
| 3 | en minimalni `StockReservationEvent` z `type` diskriminatorjem + predznačeno `qty` | ✅ DA | enako kot #2 | Enak #2; lahko tudi ta oblika |

**Izbira: #2/#3** (minimalni model, ki ohranja zgodovino) — ena tabela `StockReservationEvent` (ali
`StockReservationLog`), **ni mutable statusa**, vsaka sprememba je nov dogodek.

### 3.2 Model (predlog, read-only)
```prisma
enum ResEventType { RESERVE, ISSUE /*=CONVERT*/, RELEASE, EXPIRE }
model StockReservationEvent {
  id              String   @id @default(cuid())
  organizationId  String
  orderId         String                          // povezava z naročilom
  allocationId    String?                          // prodajna razdelitev (→ serija/batch)
  batchRecordId   String?                          // neposredna serija (za dostop)
  type            ResEventType
  qty             Int                              // RESERVE:+n ; ISSUE/RELEASE/EXPIRE:−n  (ali izpolnjevanje smer)
  idempotencyKey  String?                          // enoličen ključ dogodka
  createdAt       DateTime @default(now())
  organization    Organization @relation(..., onDelete: Cascade)
  @@unique([organizationId, idempotencyKey])       // enoličnost vsakega dogodka
  @@index([organizationId, allocationId])
  @@index([organizationId, orderId])
  @@index([organizationId, batchRecordId])
}
```
- **Trenutno aktivna rezervacija** za razdelitev `X` = `Σ qty WHERE type=RESERVE` − `Σ |qty| WHERE
  type IN (ISSUE, RELEASE, EXPIRE)` za `allocationId=X`. (ali `Σ qty` z znakom). **Nič se ne prepisuje.**

### 3.3 Kako deluje vsaka operacija (append-only)
| Operacija | Dogodka (nova vrsta) | Učinek na aktivno rezervacijo |
|---|---|---|
| Rezervacija | `RESERVE +q` (če `available ≥ q`, atomično) | +q |
| Delna pretvorba v izdajo | `ISSUE −m` (ob vsakem `OUT_order` m) | −m |
| Sprostitev preostanka | `RELEASE −n` (ob preklicu sprostiti) | −n |
| Potečena (expire) | `EXPIRE −k` (scheduler) | −k |
| Preklic naročila | `RELEASE −(še aktivno od tega naročila)` | →0 |

### 3.4 Preprečevanje napak
- **Delna pretvorba** (`ISSUE −4` iz `RESERVE +10`): aktivna rezervacija 6. Konverzija je vedno dogodek `ISSUE`
  z `idempotencyKey` → ponovitev isto → `DUPLICATE`, nikoli dvojni odbitek.
- **Sprostitev preostanka** (`RELEASE`): vedno `−n` z znakom; omejitev `ISSUE/RELEASE/EXPIRE vsota ≤ RESERVE vsota`
  → `RESERVATION_OVERFLOW`.
- **Dvojna sprostitev:** isti `idempotencyKey` `RELEASE` → uniq, zavrnjeno (`DUPLICATE_RELEASE`).
- **Negativna razpoložljiva zaloga:** vsak `RESERVE` atomično `S − aktivna ≥ q` → `NEGATIVE_BATCH`.
- **Povezava z naročilom in serijo:** `orderId` + `allocationId` (+ `batchRecordId`), vse org-scoped.
- **Preklic naročila:** en oz `RELEASE` dogodek za preostalo aktivno rezervacijo (append-only).
- **Nikoli se ista rezervacija ne šteje hkrati RESERVED in CONVERTED:** ker je vse niz dogodkov z enoličnimi
  idempotencyKey, je aktivna rezervacija vedno neto (RESERVE vsota − CONVERT/RELEASE/EXPIRE vsota); enKOS je
  convergent ali rezervu, ne oboje hkrati.


## 4. Dokončna obravnava poškodovanega vračila (4 stanja)

Razlikujejo **4 stanja** vrnjenega kosa, vsako z lastnim obravnavanjem v ledgerju.

| Stanje | V StockMovement | `resellable` | Prodajno uporabna (S) | Fizična (P) |
|---|---|---|---|---|
| **vrnjen, prodajno uporaben** | `IN RETURN` | `true` | +1 | +1 |
| **vrnjen, poškodovan, še fizično v skladišču** | `IN RETURN` | `false` (brez OUT) | **+0** | +1 |
| **vrnjen, odpisan (odstranjen iz skladišča)** | `IN RETURN` + **`OUT WASTE/STOCKTAKE`** | `false` | +0 | +0 (odpisano) |
| **vrnjen, poslan v popravilo/čakanje pregled** | `IN RETURN` + **`OUT REPAIR/INSPECTION`** | `false` | +0 | +0 (odhaja iz skladišča) |

### 4.1 Ključno pravilo (§4 naloge)
> **NE knjiži `OUT WASTE`, če je izdelek fizično še v skladišču.** `OUT_waste` (ali `OUT REPAIR`) se zapiše
> **šele takrat, ko kos fizično zapusti skladišče** (odpis/uničenje) oziroma gre v popravilo. Do takrat je
> `IN RETURN resellable=false` in kos ostane v `P` (fizična), ne v `S` (prodajna).

### 4.2 Pravila po stanju
- **Prodajno uporaben:** vsaka vrednost `S +=1` (takoj po vračilu).
- **Poškodovan, v skladišču:** `S` se NE poveča, `P +=1`; nič se ne odpisuje, dokler ne pride do pisne odločitve
  (odpis/popravilo). `resellable=false` na `IN RETURN`.
- **Odpišen:** ločen `OUT source=WASTE/STOCKTAKE` z referenco na `IN RETURN` (ali `idempotencyKey`) → `P −1`;
  `S` se ni spremenil (že 0), torej `P = S + D` naprej drži (`D` se zmanjša za odpisan).
- **Popravilo:** `OUT source=REPAIR` (ali poseben dogodek) → `P −1`; ob vrnitvi iz popravila nazaj v prodajno
  `IN RETURN resellable=true` (ali `IN REPAIR_RETURN`), `S +=1` ob ponovni oceni.
- **Vsi dogodki append-only**, `idempotencyKey` edinstven; `ΣRETURN ≤ ΣOUT` še vedno velja.



## 5. Preverba pomena »preklic proizvodnje«

Ključno vprašanje §5 naloge.

### 5.1 Kadar je vseh 19 fizično izdelanih
- Če je proizvodnja **že končana in je vseh 19 kozarCEV fizično v skladišču**, NI več »neizdelane« količine,
  ki bi jo preklic odstranil iz nečesa nezdelanega. Edina smiselna stornacija je **preklic NEIZDANE,
  NEPRODANE, NEREZERVIRANE prodajne razpoložljivosti** — to NI »preklic proizvodnje« v fizičnem smislu,
  ampak **preklic prodajne razpoložljivosti** (zapiranje odprtih količin, ki niso naročene/rezervirane).
- **Sistem ne sme uporabljati izraza »preklic proizvodnje« za to Δ, če se v resnici preklicuje samo prodajna
  razpoložljivost.** Terminološko ločimo:
  - `cancelProduction` (reversal), ki **ne nastane**, če so vsi kosi fizično izdelani;
  - `cancelSellableAvailability` (zapiranje razpoložljivosti) — to je tisto, kar v zgornjem primeru naredimo
    (`reversal = A = 10`).
- **Pravilnejše**: preklicati je treba le **nerezerviran, neizdan, neprodan** del. Rezervirano (3), prodano (7),
  vrnjeno ponovno prodajno (1) in fizično poškodovano (1) se **ne dotakne**.

### 5.2 Kako se prekliče samo neizdelano/neuporabljeno
- Če res obstaja **še neizdelana količina** (npr. proizvodnja v teku, `units_planned > units_actual`), se
  kljub temu preklic nanaša na **izven-zalogo količino**, ki je še ni v `IN_prod`; reversal bi bil omejen na
  še-neknjiženi del in ne bi vplival na že knjiženo zalogo (`P`).
- V našem primeru (vsi izdelani) je edini legalen preklic `cancelSellableAvailability = A`, ki **pusti
  `P` = prodajno(3, vse rezervirane) + poškodovano(1) = 4** in ne razveljavi ničesar prodanega/rezerviranega/poškodovanega.

### 5.3 Preklic ne sme odstraniti (št. preverba)
- prodani: `I=7` → ni v `A` (že izstopili iz `S`), `P` jih ne vsebuje → osebn. ✓
- aktivno rezervirani (3): `RES` nikoli del `A`; preklic = `A` → `RES` nedotaknjeno ✓
- ponovno prodajni vrnjeni (1): `S` ga vključi; vendar rezervacija ni na njem in `A` ga lahko vključi,
  a če ga rezerviramo (ni v primeru), `A` ga ne korključi. V primeru je to del `A`, ki ga prekličemo — PREVERNO.
- fizično obstoječi poškodovani (1): `D`, ni v `A` → se NE prekliče ✓


## 6. Preverba obstoječega checkouta (natančno)

### 6.1 Kako zdaj (working tree) sistem deluje
| Funkcija | Kdaj in kaj naredi | StockMovement? |
|---|---|---|
| `reserveStock` (product-checkout.ts:166) | ob košarici/če pre-check: `UPDATE ProductVariant/Product SET reservedQuantity += q` kjer `available ≥ q` | **NE** — samo rezervira `reservedQuantity` polje |
| `releaseStockReservation` (:187) | košarica neplačana/expired: `reservedQuantity −= q` | **NE** |
| `convertReservationToSale` (:208) | ob plačilu: `stockQuantity −= q` in `reservedQuantity −= q` + **ustvari `StockMovement OUT ORDER`** (lin. 226–235) | **DA** (samo tukaj) |
| `applyOrderStockDecrement` (:91) | ob plačilu (če ni bila rezervacija): `stockQuantity −= q` + `StockMovement OUT ORDER` | **DA** |

### 6.2 Ugotovitev
- **Rezervacija** (parameter `reservedQuantity`) nastopi v `reserveStock` — **brez** StockMovement (pravilo
  »rezervacija ni gibanje« velja že danes).
- **`stockQuantity` se zmanjša** izključno ob **potrjenem plačilu** (`convertReservationToSale` ali
  `applyOrderStockDecrement`), skupaj z **OUT ORDER StockMovement** — nikoli ob rezervaciji.
- **StockMovement OUT nastane samo ob izdaji/plačilu**, ne ob rezervaciji. To se ujema z modelom 2D-1G.

### 6.3 Kaj predlagani model ne sme podvojiti
- Predlagana `StockReservationEvent` (RESERVE/ISSUE/RELEASE/EXPIRE) mora **delovati namesto**
  `reserveStock`/`releaseStockReservation` increment/decrement na **ProductVariant `reservedQuantity`**,
  NE poleg njega kot še en mehanizem. V prihodnji implementaciji:
  - `RESERVE` dogodek → (namesto samo `++reservedQuantity` na variant) še en `StockReservationEvent RESERVE`
    in zrcaljena `reservedQuantity` **na variant se posodobi iz agregata** (NI drugo knjižbeno mesto).
  - `ISSUE`/`CONVERT` → obstoječi OUT ORDER StockMovement (lin. 226–235) + dodan `StockReservationEvent ISSUE`.
  - **Ne smemo imeti** `reservedQuantity` update na variant **in** posebej drugi `available` števec, ki bi se
    hkrati spreminjal — to bi podvojilo knjiženje. `reservedQuantity` na ProductVariant je **zrcaljenje**
    `Σ StockReservationEvent`, ena avtoriteta.
- Torej: **uvajamo `StockReservationEvent` kot edini vir resnice za rezervacije; `ProductVariant.reservedQuantity`
  je materializiran prikaz (možno računan iz agregata), ne ločena knjižba.** S tem ni podvajanja z obstoječim
  checkoutom.


## 7. Končni dokaz, testni scenariji, robni primeri, negativni testi

### 7.1 Končna tabela vseh stanj (povzetek — del §1.5)
`P = S + D`, `S = IN_prod + RET_resell − OUT_order − reversal`, `A = S − RES`, `R ≤ I`; vrednosti iz §1.5.
**Formule na enem mestu:**
```
P = ΣIN_prod + ΣIN_ret_resell + ΣIN_ret_damage + ΣIN_ret_repair_return − ΣOUT_order − ΣOUT_waste − ΣOUT_cancel − ΣOUT_repair_out
S = ΣIN_prod + ΣIN_ret_resell − ΣOUT_order − ΣOUT_cancel − ΣOUT_waste
D = ΣIN_ret_damage + ΣIN_ret_repair_return − ΣOUT_waste
RES = Σ(StockReservationEvent RESERVE+) − Σ(ISSUE/RELEASE/EXPIRE−)
A = S − RES
I = ΣOUT_order ; R = ΣRETURN ; C = ΣOUT_cancel
neto prodano = I − R
```
### 7.2 Končni seznam dogodkov v ledgerju (iz §1.3)
`ProductionContribution` (input10/net9.5/loss0.5), `IN PRODUCTION 19`, `RESERVE +10`,
`OUT ORDER 7` + `ISSUE −7`, `IN RETURN 1 (resellable)`, `IN RETURN 1 (resellable=false)`,
`OUT PRODUCTION reversal 10`. Skupaj = skladen (P=4, S=3, D=1, RES=3, A=0, I=7, R=2, C=10).

### 7.3 Matematični dokaz ujemanja (invariante)
- `P = S + D` (v vsakem koraku) — ni izgubljenega/nedodeljenega kosa.
- `A = S − RES ≥ 0` (nikoli negativna razpoložljiva).
- `R ≤ I` (nikoli več vrnjenih kot izdanih).
- `RES ≤ S` (nikoli več rezerviranih kot prodajno uporabnih).
- `reversal ≤ A` (preklic nikoli ne razveljavi rezerviranega/prodanega). Vse dokazano v §1.5.

### 7.4 Negativni testni primeri (≥10)
1. `RESERVE 30` iz `S=19` → `NEGATIVE_BATCH` (available 19 < 30).
2. `ISSUE −8` (več kot `RESERVE 10` aktivno) → `RESERVATION_OVERFLOW`.
3. `RETURN qty 6` iz `OUT 5` → `RETURN_OVERFLOW`.
4. ponovljen `RETURN` z istim `returnOfMovementId`+`idempotencyKey` → `DUPLICATE_RETURN` (brez 2×).
5. `RELEASE −6` ko je aktivno le 4 → `RESERVATION_OVERFLOW`.
6. duplikat `RELEASE` isti `idempotencyKey` → `DUPLICATE_RELEASE`.
7. `cancel` z `reversal` 11 > `A=10` → `REVERSAL_OVERFLOW` (ne sme razveljaviti rezerviranega).
8. `OUT WASTE` za poškodovan kos, ki je še fizično v skladišču → zavrnjeno (`DAMAGED_NOT_WRITTEN`), dokler ni odločeno.
9. `RETURN resellable=true` za kos iz druge serije (`allocationId` se ne ujema z `OUT`) → `BATCH_MISMATCH`.
10. `RESERVE` brez veljavnega `orderId`/`allocationId` → napaka pri preverjanju (INVALID_REFERENCE).
11. poskušen `UPDATE` zgodovinskega `StockReservationEvent.RESERVE` (spreminjanje qty) → zavrnjeno (append-only).
12. korekcijska sprememba `ProductionContribution` input pod — odstranjen pri preverjanju → `STALE_EDIT` (append-only).

### 7.5 Robni primeri
- **Deli vračil** (5 izdano → RETURN 1, 1, 1) → veljavno (3 vrstice, `Σ1+1+1 ≤ 5`), `idempotencyKey` različni.
- **Več serij v enem naročilu** → ena `StockReservationEvent RESERVE` per (order,alloc,batch); `A` per batch.
- **Več rezervacij iste razdelitve** → več `RESERVE` dogodkov, agregat neto.
- **Preklic delno izdane razdelitve** → reversal samo za `A` (neizdano→nerezervirano), prodano/rezervirano ostane.

### 7.6 Preostale odločitve (levi, če so)
- (a) Ali naj bo `reversal` »preklic razpoložljivosti« ločen status od pravega fizičnega preklica (terminologija §5). — **odločitev ob implementaciji.**
- (b) Kdaj točno zapišemo `OUT_waste`/`OUT_repair` za poškodovan kos (policy «takoj ob odločitvi» ali čakalni vnos). — odprto.
- (c) Ali `ProductVariant.reservedQuantity` materializiramo iz agregata ali pustimo update + agregatni `available` ločeno (videti v §6.3: predlagano iz agregata, da ni podvajanja).


## 8. Sklep (odgovor na nalogo)

**Ali je model zdaj dovolj natančen za varno odobritev Prisma sheme in migracije?**

**PASS** — po odpravi protislovja iz 2D-1F (ločene formule, poškodovan kos NI takoj odpisan, `reversal`
izačunan iz bilance) je model matematično konsistenten in pripravljen za shemo. Kot dokaz: integriran primer
konvergira v `P=4, S=3, D=1, RES=3, A=0, I=7, R=2, C=10` brez nerazloženih količin.

**PARTIAL — dve terminološki/odločitveni pasti, ki NI blokirata sheme (definirajo se ob implementaciji, ne v shemi):**
1. **»Preklic preostanka proizvodnje« vs preklic prodajne razpoložljivosti** (§5): kadar so vsi kosi fizično
   izdelani, gre dejansko za `cancelSellableAvailability`, ne fizični preklic proizvodnje. Shema to podpira,
   terminološko je treba razlikovati v API-ju.
2. **Trenutek `OUT_waste`/`OUT_repair`** za poškodovan kos (§4): sheme omogočajo oboje (OUT ali INRETURN
   resellable=false + ostane v P); točno kdaj se zapiše odpis je poslovna odločitev, ne shem-depth.

Ostalo je PASS. **Ta dokument je zadnja arhitekturna validacija, ne odobritev implementacije — nič ni
implementirano. Čakam tvojo izrecno odločitev za Faza 2D-1A (shema/migracija), ob uskladitvi s tujim WIP.**

---

# DOPOLNITEV 2D-1H — KONČNA USKLADITEV FIZIČNE IN PRODAJNE BILANCE — read-only

Zaključna arhitekturna validacija, ki **odpravi 3 napake iz 2D-1G**, ponovno izračuna integrirani primer na
podlagi dogodkov (brez vnaprej določenih količin), potrdi append-only model dogodkov, preveri povezavo z
dejanskim checkoutom in poda dokončen predlog sheme + sklep PASS/PARTIAL/FAIL.

**Št. dela: IZKLJUČNO READ-ONLY.** Nič kode/sheme/baze/migracij/testnih podatkov ni spremenjeno; ni Git
operacij; tuje neoddane spremembe (`prisma/schema.prisma`, `einvoices.ts`) nedotaknjene. Faza 2D-1A ostaja
**neodobrena**; po tej dopolnitvi se USTAVIM in počakam na tvojo odločitev.

**Potrjene reference (working tree):** `reserveStock` product-checkout.ts:166, `releaseStockReservation`:187,
`convertReservationToSale`:208 (+ OUT ORDER StockMovement lin. 226–235), `applyOrderStockDecrement`:91;
`StockMovement` prisma:2130, `StockMovementSource`:2120 (MANUAL/ORDER/DELIVERY/STOCKTAKE/RETURN),
`Order`/`OrderItem`:1244/1303, `OrderStatus`:1329, `Product`/`ProductVariant`:1177/1572 (oba imata
`reservedQuantity`), `ExtensionRecord`:1533.

---

## 1. Popravljene napake iz 2D-1G + nov katalog kategorij kosa

### 1.0 Kategorije, v katerih je vsak kos (disjunktne, vsak v natanko eni)
| Kratko | Kategorija | Fizično prisotna v skladišču? | Prodajno uporabna? | Opomba |
|---|---|---|---|---|
| `S` | Prodajno uporabna | DA | DA | lahko nadd. del — rezerviran/umaknjen = podkategoriji |
| `D` | Poškodovana | DA | NE | čaka na odločitev (odpis/popravilo/ponovni pregled) |
| `Rep` | V popravilu / na pregledu | NE (odšla) | (trdnja ob vrnitvi) | začasno odsotna, vrne se |
| `W` | Odpisana | NE | NE | fizično ni več; NI del P |
| `Sold` | Prodan (izdan) | NE | — | izven zaloge |
| (sub-`S`) `RES` | Rezervirana | DA | DA (zasedena) | zahtevana naročilu |
| (sub-`S`) `B` | Umaknjena iz prodaje / blokirana | DA | DA (vendar ne ponujena) | sama fizično ostane |

```
Fizična zaloga P = S + D + Rep                  (fizično prisotni kosi; W in Sold sta IZVEN zaloge)
```
`RES` in `B` sta **podmnožici** `S` (nista ločeni kategoriji fizične prisotnosti) — preprečuje dvojno štetje.

### 1.1 Napaka 1: »umik iz prodaje« ni fizični OUT (popravljeno)
- 2D-1G je zapisal `OUT PRODUCTION reversal = 10` in z njim znižal fiz. zalogo s 14 na 4, čeprav 10 kosov
  fizično ostane. **Napačno.**
- **Pravilo:** `cancelSellableAvailability`/umik iz prodaje je **ločen nefizični dogodek ali stanje** (`B`),
  ki **NE ustvarja `StockMovement OUT`** in NE spremeni `P`. Fizična zaloga se zmanjša **samo**, ko kos
  dejansko zapusti skladišče (izdaja, odpis z odstranitvijo, pravi razveljavljen proizvodni odstavek).
- **Ločimo torej tri stvari:**
  1. **Umik iz prodaje** (`B`, nefizično) — kos je še v skladišču, a ni ponujen. **Nobeden `StockMovement`.**
  2. **Dejansko razveljavljanje proizvodnje** (fizični `OUT PRODUCTION`) — samo za kose, ki fizično **niso**
     prisotni (še niso bili izdelani) ali se fizično odstranijo. Spremeni `P`.
  3. **Fizični izhodi** (izdaja/odpis/popravilo) — vsak s svojim `StockMovement OUT`.
- **Priporočen append-only model za umik iz prodaje:** **ločena `StockAvailabilityEvent` tabela** (nov
  nefizični dogodkovni tok, vzporeden `StockReservationEvent`), ker `StockMovement` pokriva **le fizične**
  tokove in NI samosobno primeren za vse poslovne statusne dogodke (načelo 1.1). Alternativo »statusni
  dogodek na vrsti StockMovement« **zavrnem** (bi podsploščalo fizični ledger). Podrobnosti v §3.

### 1.2 Napaka 2: dvojno odštevanje poškodovanega (popravljeno)
- 2D-1G je: (a) poškodovan kos izključil iz `S` ob vračilu (`resellable=false`), nato (b) dodatno odštel
  `OUT WASTE 1` iz prodajne zaloge. **Dvojno.**
- **Pravilo:** ker poškodovan kos **nikoli ne vstopi v `S`**, poznejši odpis (`OUT WASTE`) spremeni **le
  `P` in `D`** (physical), **NE `S`**:
  - vračilo poškodovanega: `S` nespremenjen, `P+1`, `D+1`;
  - poznejši odpis: `P−1`, `D−1`, `S` **nespremenjen** → **1 vpliv na fiz., 0 na prodajno** (ni dvojno).
- **Formule zato ločijo fiz. in prodajno; `OUT_waste` je samo v `P` formuli, nikoli v `S` formuli** (glej §2).

### 1.3 Napaka 3: protislovje pri vrnjenem prodajno uporabnem kosu (popravljeno)
- 2D-1G je hkrati trdil »preklic ne sme odstraniti ponovno prodajnega vrnjenega kosa« in »reversal = A«, kjer
  je `A` vseboval tudi ta vrnitveni kos. **Protislovno.**
- **Razrešitev:** umik/prodaja umika **ni avtomatski pometek vsega `A`**, temveč **ekspliciten dogodek
  `WITHDRAW` s `reason` in `qty`**. V integriranem primeru (1.4) se po pravilu umaknejo **samo** kosovi,
  ki so **(i) prodajni, (ii) nerezervirani, (iii) ne iz ponovno-prodajnega vračila** — tj. negotovi
  kosi iz proizvodnje. Ponovno prodajni vrnjeni kos (1) se **NE umakne**, rezervirani (3) ostanejo.
- **Ravnanje posameznih kategorij v primeru umika (skladno z 1.3):**
  | kategorija | se lahko umakne iz prodaje? | razlog izposija |
  |---|---|---|
  | vrnjeni prodajno uporaben | **NE** (tekoči, še ponujen) | praviloma ostane = prodajna |
  | rezervirani | NE (zaseden naročilu) | preklic naročila bi sprostil prek RELEASE |
  | poškodovani | NE (že izven S) | ni v S, nič za umik |
  | v popravilu | NE | ni fizično v S (odšel) |
  | umaknjen (že B) | (že) | ponovna aktivacija ga vrne v S |
  | odpisani | NE | ni več |
- **Noben JEDNO kos ni hkrati `RES` in `B`** (disjunktni podmnožici `S`).

### 1.4 Ponovno izračunan integrirani primer (po dogodkih, vse izpeljano)
**Vhodi (fiksirani):** 10 kg pridelek, `contribution input10/net9.5/loss0.5`, units=19 koz. `IN PRODUCTION 19`.
Rezervacija 10 → izdaja 7 → vračilo 2 (1 prodajno uporaben, 1 poškodovan-fizično prisoten) → 3 rezervirani
ostanejo → nato umik preostale prodajne razpoložljivosti.

| # | Dogodek | Ledger/zapis | P | S | D | Rep | RES | B | A=S−RES−B | I (izdano) | R (vrnjeno) | neto prodano=I−R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | proizvodnja | `IN PRODUCTION 19` | 19 | 19 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | 0 |
| 2 | rezervacija | `ReservationEvent RESERVE +10` | 19 | 19 | 0 | 0 | 10 | 0 | **9** | 0 | 0 | 0 |
| 3 | izdaja 7 | `OUT ORDER 7` + `RESRVE` → `ISSUE −7` | 12 | 12 | 0 | 0 | 3 | 0 | 9 | 7 | 0 | 7 |
| 4a | vračilo prodajno uporabnega | `IN RETURN 1 resellable=true` | 13 | 13 | 0 | 0 | 3 | 0 | 10 | 7 | 1 | 6 |
| 4b | vračilo poškodovanega | `IN RETURN 1 resellable=false` | 14 | 13 | 1 | 0 | 3 | 0 | 10 | 7 | 2 | **5** |
| 5 | umik iz prodaje | `AvailabilityEvent WITHDRAW −9` | 14 | 13 | 1 | 0 | 3 | **9** | **1** | 7 | 2 | 5 |

**Komentar koraka 5 (preverbe):**
- `WITHDRAW 9` = negotovi kosi iz proizvodnje, ki so prodajni, nerezervirani in ne ponovno-prodajni vrnjeni:
  `(S − resellable-return) − RES = (13 − 1) − 3 = 9`. **To je izpeljano iz dogodkov, ne vnaprej.**
- **Fizična zaloga P NI spremenjena** (ostane 14) — umik je `B` (stanje), ne `OUT`. ✓ **Dokaz 1.1.**
- Ponovno prodajni vrnjeni (1) ostane v `S` in `A=1` (ni umaknjen). ✓ **Dokaz 1.3.**
- Rezervirani (3) ostanejo: so del `S`, zasedeni, niso v `B`; A=1 je od vrnjenega. ✓
- Poškodovan (1) je v `D` (fizično), ni v `S`. ✓ **P = S + D + Rep = 13 + 1 + 0 = 14.**
- Neto prodano = 7 − 2 = 5; izdano 7, vrnjeno 2.

*(Nikjer ni bilo `OUT PRODUCTION reversal` — njega ni, ker so vsi kosi fizično izdelani; korespondira z
1.1: pravi reversal proizvodnje bi bil ločen, fizičen dogodek, a ni izveden.)*

---

## 2. Končne formule (ločene, neodmešane)

```
Fizična           P = S + D + Rep
Prodajno          S = ΣIN_prod + ΣRETURN(resellable=true) − ΣOUT_order − ΣOUT_production_reversal − ΣOUT_sold
                      (poškodovana vračila in kosi v popravilu NISO del S; kosi v S ostanejo, dokler niso
                       izdani/odpisani/razveljavljeni – umik B je podzmožica, ne izločitev iz S)
Poškodovana       D = ΣIN_RETURN(resellable=false) + ΣIN_repair_return(ocenjen poškodovan) − ΣOUT_waste(kot odpisan) − ΣOUT_repair(iz D)
V popravilu       Rep = ΣOUT_repair − ΣIN_repair_return
Odpisana          W = ΣOUT_waste_phys          (zunaj P; sledljivo)
Rezervirana       RES = Σ REV+ − Σ (ISSUE+RELEASE+EXPIRE)     (neto iz StockReservationEvent)
Blokirana/umaknjena B = Σ WITHDRAW − Σ REACTIVATE              (neto iz StockAvailabilityEvent; B ⊆ S)
Razpoložljiva     A = S − RES − B
Izdana            I = Σ OUT_order
Vrnjena           R = Σ RETURN
Dejansko prodano  Neto = I − R
Preklicana (fiz.) C = Σ OUT_production_reversal                (samo kosi fizično odsotni/odstranjeni)
```
Prehodi med kategorijami:
- `IN RETURN resellable=true` → v `S` (in `P`). `resellable=false` → v `D` (in `P`), NE v `S`.
- `OUT_waste` → iz `P`/`D`, **nikdar** spremeni `S`.
- `OUT_repair` / `IN_repair_return` → gnezde samo `P`→`Rep` (in `S`→`Rep` če je bil prodajen; če je bil `D`, só v `D`→`Rep`).
- rezervacija → `RES` (podmnožica `S`, ne `P`); sprostitev → prek `RELEASE`/`EXPIRE`.
- umik `WITHDRAW` → v `B` (podmnožica `S`), **ne spremeni `P`**; ponovna aktivacija `REACTIVATE` → v `S`(odstrani iz `B`).

---

## 3. Append-only model dogodkov (definitivno)

### 3.1 Dva nefizična dogodkovna toka + StockMovement (fizika)
| Identita | Tip | Fizič. zaloga | Prodaj. zaloga | Rezervacija | Blok/mik | Glavne reference | Anti-dup | Korekcija |
|---|---|---|---|---|---|---|---|---|
| `StockMovement` | IN/OUT, `direction`, `source` (ORDER/PRODUCTION/RETURN/STOCKTAKE/drugi) | spremeni | spremeni (odvisno) | ne | ne | product/variant, batchRecord, allocationId, orderId, source | `idempotencyKey` | nov reversal, nikoli UPDATE |
| `StockReservationEvent` | `RESERVE / ISSUE / RELEASE / EXPIRE` (predznačena qty) | **ne** | ne (le iz dan substr. S) | **da** (`RES`) | ne | orderId, allocationId, batchRecordId | `idempotencyKey @@unique(org,key)` | nov dogodek, nikoli UPDATE |
| `StockAvailabilityEvent` | `WITHDRAW / REACTIVATE` (predznačena qty) | **ne** | ne → `B` (podzmožica) | ne | **da** (`B`) | batchRecordId, productVariantId?, reason | `idempotencyKey @@unique(org,key)` | nov dogodek |

`StockMovement` ostane **edini fizični ledger**; `StockReservationEvent` in `StockAvailabilityEvent` sta
**nefizična statusna toka** (dogodki, ne vrstice z mutabilnim statusom). Noben korekcijski dogodek ne
spreminja zgodovine — vsaka korekcija je nov dogodek z inverzno predznačeno količino ali `REACTIVATE`.

### 3.2 Definitivni seznam poslovnih dogodkov
| Dogodek | V | Spremeni P? | Spremeni S? | Spremeni RES? | Spremeni B? | Reference (obvezne) | Anti-dup preprečevanje |
|---|---|---|---|---|---|---|---|
| rezervacija | StockReservationEvent `RESERVE` | ne | ne | + | — | orderId, allocationId, batchRecordId | idempotencyKey |
| delna izdaja | StockMovement `OUT ORDER` + ReservationEvent `ISSUE` | − | − | − | — | allocationId, orderId, source=ORDER | idempotencyKey + `ΣISSUE≤RESERVE` |
| sprostitev rezervacije | ReservationEvent `RELEASE` | ne | ne | − | — | idempotencyKey | uniq + `Σ(ISSUE+RELEASE+EXPIRE)≤RESERVE` |
| potek rezervacije | ReservationEvent `EXPIRE` | ne | ne | − | — | scheduler token | idempotencyKey |
| vračilo (prodajno) | StockMovement `IN RETURN resellable=true` | + | + | — | — | allocationId, returnOfMovementId | idempotencyKey + `ΣRETURN≤ΣOUT` |
| vračilo poškodovano | StockMovement `IN RETURN resellable=false` | + | 0 | — | — | allocationId, returnOfMovementId | idempotencyKey + `ΣRETURN≤ΣOUT` |
| premik v popravilo | StockMovement `OUT source=REPAIR` | − | − (0 če je bil D) | — | — | batchRecordId, note | idempotencyKey |
| vrnitev iz popravila | StockMovement `IN source=REPAIR_RETURN` + avt. pregled | + | (odvisno: S ali D) | — | — | batchRecordId | idempotencyKey |
| odpis (fiz. odstranitev) | StockMovement `OUT source=WASTE/STOCKTAKE` nad jar v D | − (P) | 0 (S nespremenjen) | — | — | batchRecordId, reference na IN RETURN | idempotencyKey + stanje kos=D |
| umik iz prodaje | StockAvailabilityEvent `WITHDRAW` | ne | ne (→B) | — | + | batchRecordId, reason | idempotencyKey |
| ponovna aktivacija | StockAvailabilityEvent `REACTIVATE` | ne | ne | — | − | batchRecordId, reason | idempotencyKey |
| preklic naročila | ReservationEvent `RELEASE` (prostoročna) + (če izdano → vračilo/razveljavljeno) | ob izdaji − | ob izdaji − | uds sa | — | orderId | idempotencyKey |
| dejanska razveljavitev proizvodnje | StockMovement `OUT PRODUCTION` (za kose fizično odsotne) | − | − | — | — | batchRecordId, cancelId | idempotencyKey + `reversal≤A` fiz. |

Vsak dogodek ima **jasno poslovno/računovodsko funkcijo** in je bodisi fizični (StockMovement) bodisi
nefizični (Reservation/Availability). **Ne uvajamo dodatnih »dogodkov za lepši izgled«.**

### 3.3 Preprečevanje dvojnega štetja / negativnih
- Rezervacija: `ΣRESERVE − Σ(ISSUE+RELEASE+EXPIRE) ≥ 0` → `RESERVATION_OVERFLOW`.
- Umik: `B = ΣWITHDRAW − ΣREACTIVATE`, `0 ≤ B ≤ S − RES` → `WITHDRAW_OVERFLOW` / `REACTIVATE_OVERFLOW`.
- Odpis: samo za kos v `D`; ne spremeni `S` (1.2).
- `A = S−RES−B ≥ 0`; kakršnokoli dejanje nad `A` preverja `A ≥ qty` → `NEGATIVE_AVAILABLE`.

---

## 4. Povezava z obstoječim checkoutom (preverjeno)

### 4.1 Dejansko, danes (working tree)
| Funkcija | Kdaj | `reservedQuantity` | `stockQuantity` | StockMovement |
|---|---|---|---|---|
| `reserveStock` (:166) | košarica/pre-check | `+=` (če `available≥q`) | ne | **NE** |
| `releaseStockReservation` (:187) | unpaid/expired | `−=` (če `reservedQuantity≥q`) | ne | NE |
| `convertReservationToSale` (:208) | potrjeno plačilo | `−=` | `−=` | **DA** `OUT ORDER` (lin. 226–235) |
| `applyOrderStockDecrement` (:91) | potrjeno plačilo | ne | `−=` (če `stockQuantity≥q`) | **DA** `OUT ORDER` |

### 4.2 Skladnost in nadomestitev (brez vzporedne evidence)
- **Rezervacija danes** upravlja `ProductVariant.reservedQuantity` **brez** StockMovement; izdaja
  (`convertReservationToSale`) zmanjša `stockQuantity`+`reservedQuantity` in zapiše `OUT ORDER`. To se
  popolnoma ujema z našo arhitekturo (rezervacija ni fizično gibanje; izdaja je).
- **Načrt (prihodnja implementacija, NE sedeja sedaj):** `StockReservationEvent` postane **edini vir resnice**
  za rezervacije; `ProductVariant.reservedQuantity` je materializiran prikaz **iz agregata `Σ StockReservationEvent`**
  (RESERVE − ISSUE/RELEASE/EXPIRE), ne ločeno knjižbeno mesto. Izdaja → `OUT ORDER` (kot danes) + nov
  `ISSUE` dogodek namesto ročnega `reservedQuantity -=`.
- **Ne smemo imeti** dvojnega mehanizma (update `reservedQuantity` na variant **in** št. v `StockReservationEvent`
  ki bi se hkrati spreminjali). Ena avtoriteta (dogodek), zrcalo (kolona) računanega iz agregata.
- **Dosledno s sedanjim checkoutom** (ni protislovja): `convertReservationToSale` že ob izdaji odšteje
  rezervacijo (→ `ISSUE` dogodek), `releaseStockReservation` → `RELEASE`/`EXPIRE`, `reserveStock` → `RESERVE`.
  **Te funkcije ne spreminjamo;** nov dogodkovni model se vpelje kot nadomestek notranjega štera ob prihodnji
  implementaciji, ne kot vzporedna eokuji. **Zato predlagana arhitektura NI v nasprotju z obstoječim checkoutom.**

---

## 5. Končna matematična validacija (formule + dokazi + integrirana tabela)

### 5.1 Integrirana tabela (povzetek iz §1.4)
(0)→(1) `IN PROD 19` → (2) `RES +10` → (3) `OUT ORDER 7 + ISSUE −7` → (4a) `RETURN 1 resellable` →
(4b) `RETURN 1 damaged` → (5) `WITHDRAW 9`:
```
#   P   S    D   Rep  RES  B   A   I   R  Neto
0   0   0    0    0   0   0   0   0   0   0
1  19  19    0    0   0   0  19   0   0   0
2  19  19    0    0  10   0   9   0   0   0
3  12  12    0    0   3   0   9   7   0   7
4a 13  13    0    0   3   0  10   7   1   6
4b 14  13    1    0   3   0  10   7   2   5
5  14  13    1    0   3   9   1   7   2   5
```

### 5.2 Dokazi ohranjanja in medsebojne skladnosti
- **Ohranjanje fizične količine:** `P = S + D + Rep` velja v vsakem koraku (19=19, 12=12, 13=13, 14=13+1,
  14=13+1). **Umik (B) NIkoli ne spremeni P** → P po koraku 5 ostane 14 (fiz. kosi niso odšli).
- **Ohranjanje prodajne zaloge:** `S` se spremeni le ob `IN_prod`, `RETURN resellable`, `OUT_order`,
  `reversal`, `out_sold`; nikoli ob `WITHDRAW` (B = podzmožica, ne izločitev).
- **Rezervacija ≠ izdaja:** `RES` (zasedena S) je neodvisna od `I` (izdano); `I` raste ob `OUT_order`
  (in `RES` se tedaj zmanjša prek `ISSUE`), `RES` sama od sebe ne znižuje `P`.
- **Poškodovan kos ni prodajno uporaben:** `resellable=false` ga nikoli ne vstavi v `S`; D in S disjunktna
  (P=S+D+Rep brez presežka).
- **Umik ne odstrani fizičnega izdelka:** `WITHDRAW` ⟶ `B`, `P` neznano (1.1).
- **Vračilo ≤ izdano:** `ΣRETURN ≤ ΣOUT_order` (RETURN_OVERFLOW preprečeno).
- **Odpis ne zmanjša prodajne zaloge dvakrat:** `OUT_waste` iz `D`/`P`, `S` nespremenjen (1.2).
- **Preklic ne odstrani rezerviranih/izdanih:** `reversal ≤ A` (A = S − RES − B); RES in B nista del A;
  `OUT_order` že izven S.

### 5.3 Negativni testni primeri (≥12)
1. `RESERVE 30` iz S=19 → `NEGATIVE_AVAILABLE` / `NEGATIVE_BATCH`.
2. `ISSUE −8` iz akt. rezervacije 10 (preseg) → `RESERVATION_OVERFLOW`.
3. `RETURN 6` iz `OUT 5` → `RETURN_OVERFLOW`.
4. `RETURN 1` isti `returnOfMovementId`+`idempotencyKey` → `DUPLICATE_RETURN`.
5. `RELEASE 6` iz akt. rezervacije 4 → `RESERVATION_OVERFLOW`.
6. `RELEASE` duplikat (isti `idempotencyKey`) → `DUPLICATE_RELEASE`.
7. `WITHDRAW 11` (A=10) → `WITHDRAW_OVERFLOW`.
8. `REACTIVATE 6` (B=5) → `REACTIVATE_OVERFLOW` (ne sme → neg. umik).
9. `OUT WASTE` za kos, ki **ni** v `D` (še prodajen) → `DAMAGED_NOT_WRITTEN` / stanje kos.
10. `OUT WASTE` za poškodovan kos fizično v skladišču brez odločitve → lev pas (dokler ni odločeno).
11. `RETURN resellable=true` za kos iz druge serije (`allocationId`≠`OUT`) → `BATCH_MISMATCH`.
12. `RESERVE` brez veljavnega `orderId`/`allocationId` → `INVALID_REFERENCE`.
13. `UPDATE` zgodovinskega `StockReservationEvent`/`StockAvailabilityEvent` (spreminjanje qty) → zavrnjen (append-only).
14. `OUT PRODUCTION reversal 11` (A fiz.=0) → `REVERSAL_OVERFLOW` (nikoli ne razveljavi prodan/rezervirano).

### 5.4 Robni primeri
- **Delna vračila** iste izdaje (RETURN 1,1,1 od OUT 5) → velja, `Σ≤5`, `idempotencyKey` različni.
- **več vračil istega naročila** → več RETURN, `ΣRETURN(orderItem) ≤ ΣOUT`, vse naprej na `allocationId`.
- **več proizvodnih serij** → po `batchRecordId`; A per batch; izdaja lahko iz več alloc.
- **več rezervacij iste serije** → več `RESERVE` dogodkov; neto; `A≥0`.
- **delna izdaja in preklic naročila** → `ISSUE` za izdano + `RELEASE` za preostalo rezervacijo.
- **poškodovan → pozneje odpis** → `OUT WASTE` iz `D`; S nespremenjen (1.2).
- **izdelek po popravilu → v prodaj** → `IN_repair_return` → (ocena) → `S` ali `D`.
- **ponovna aktivacija umaknjene zaloge** → `REACTIVATE`, `B−`, `A+`, `P`/`S` nespremenjena (iz S se ne izloči).

---

## 6. Končni predlog sheme (read-only, predlog)

```prisma
model ProductionContribution {
  id, organizationId, batchRecordId, sourceRecordId,
  inputQuantity Decimal(14,4), netQuantity Decimal(14,4), lossQuantity Decimal(14,4) @default(0),
  unit String, honeyType String?
  org relation (onDelete: Cascade); batchRecord→ExtRec (Restrict); sourceRecord→ExtRec (Restrict)
  @@index([organizationId,batchRecordId]) @@index([organizationId,sourceRecordId])
}

model OrderItemBatchAllocation {
  id, organizationId, orderItemId, batchRecordId, quantity Int /*>0*/,
  status OrderItemBatchAllocationStatus /* PARTIALLY_ISSUED / ISSUED / CANCELLED; NIKOLI RETURNED */
  @@unique([organizationId, orderItemId, batchRecordId])   // 1 razdelitev na (orderItem,serija)
  @@index([organizationId,batchRecordId]) @@index([orderItemId]) @@index([batchRecordId])
}

enum ResEventType { RESERVE, ISSUE, RELEASE, EXPIRE }
model StockReservationEvent {           // nefizični tok
  id, organizationId, orderId, allocationId?, batchRecordId?, type ResEventType,
  qty Int /* RESERVE:+n; ISSUE/RELEASE/EXPIRE:−n */, idempotencyKey String?,
  createdAt, // rel org (Cascade)
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, allocationId]) @@index([organizationId, orderId]) @@index([organizationId, batchRecordId])
}

enum AvailabilityEventType { WITHDRAW, REACTIVATE }
model StockAvailabilityEvent {          // nefizični tok (umik/aktivacija)
  id, organizationId, batchRecordId, productVariantId?, type AvailabilityEventType,
  qty Int /* WITHDRAW:+n → B; REACTIVATE:−n */, reason String?, idempotencyKey String?, createdAt,
  // rel org (Cascade)
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, batchRecordId]) @@index([organizationId, productVariantId])
}

// StockMovement (obstoječi) dodano za fizične tokove / vračila / preklic:
enum StockMovementSource + PRODUCTION, REPAIR, REPAIR_RETURN   // RETURN/ORDER/STOCKTAKE že
// na StockMovement: allocationId String?, returnOfMovementId String?, idempotencyKey String?,
//   resellable Boolean @default(true)  (RETURN), returnDisposition String? (DAMAGED_AWAITING/…)
//   @@index([allocationId]) @@index([returnOfMovementId])
```
**Org izolacija:** vsi modeli org-scoped, vse relacije preverijo `organizationId` seje; na ExtensionRecord
(=batch/harvest) `Restrict`/`SetNull` (nikoli Cascade za zgodovino). **Več delnih vračil iste izdaje** —
omogočeno (več RETURN na isti returnOfMovementId, različni idempotencyKey). **idempotency ključi** —
`@@unique(org, idempotencyKey)` per event-model. **Ravnovesci:** preprečeno prek poslovnih preverb
(RETURN≤OUT, RESERVATION, WITHDRAW, WASTE-only-od-D), NE z unikatnimi omejitvami, ki bi blokirale legitimne
delne dogodke. **Unikatnost ne blokira delnih dogodkov** (enolični so le idempotencyKey; razdelitev
`@@unique(org,orderItem,batch)` je ena vrstica na razdelitev, ne na dogodek).

---

## 7. Sklep (odgovor na nalogo)

**PASS** — po odpravi treh napak iz 2D-1G so formule, dogodki, fizična zaloga, prodajna zaloga, rezervacije in
vračila medsebojno **matematično in poslovno skladni**. Jedro: `StockMovement` = edini **fizični** ledger;
`StockReservationEvent` + `StockAvailabilityEvent` = **nefizična** statusna ločena tokova (rezervacija +
umik/aktivacija). Umik iz prodaje **ne** spremeni `P`; odpis poškodovanega spremeni le `P`/`D`, **ne** `S`;
umik selektivno pusti ponovno-prodajne vrnitve in rezervirane kose nedotaknjene. Integriran primer konvergira
v `P=14, S=13, D=1, Rep=0, RES=3, B=9, A=1, I=7, R=2, Neto=5` — brez nerazloženih količin.

**PARTIAL (ne blokira, definira se ob implementaciji v API-ju, ne v shemi):**
1. **Tremotek `OUT_waste` / `OUT_repair`** za poškodovan / kos v popravilu (»takoj ob odločitvi« vs
  »čakalni vnos«) — oboje shema podpira; odločivena je poslovna, ne shemapolna.
2. **Terminologija**: `WITHDRAW`/`REACTIVATE` so ločeni od fizičnih `OUT`; kakšen `reason` se uporabi za
  umeke je poslovna politika, ne shema odvisnost.

**Blokada: ni.** Preostale točke so odločitve ob implementaciji, ne kontradikcije bilance. Faza 2D-1A ostaja
**neodobrena**; ta dokument je samo arhitekturna validacija. **Nič ni implementirano; čakam tvojo odločitev.**

---

# DOPOLNITEV 2D-1I — NEODVISNA KONČNA REVIZIJA — read-only

Neodvisna revizija poglavij 2D-1A..2D-1H. Nisem prevzel trditev 2D-1H (PASS) kot samodejno veljavnih — čisto
večino izračunov sem ponovno izpeljal iz dogodkov in jih primerjal s kodo. Ugotovljene so **3 zahteve za
popravek** (vse manjše, a resnične), opisane spodaj. **Nič ni spremenjeno — samo dokument.**

**Reference (potrjeno v working tree):** `applyOrderStockDecrement` product-checkout.ts:91, `convertReservationToSale`:208,
`reserveStock`:166, `releaseStockReservation`:187, `AVAIL`(=«stockQuantity − reservedQuantity ≥ qty») :146,
`verifyProductOrder`:1097 (PAID-guard :1216–1220, branch convert→fallback :1257–1270), prepaid path :705–707;
`createStockMovement` inventory.ts:81 (transakcija :163, NEGATIVE_STOCK via `computeStockDelta` :150–160),
`StockMovement` prisma:2130, `StockMovementSource`:2120, `OrderItem`:1303, `OrderStatus`:1329.

---

## 1. Neodvisno preverjanje definicij spremenljivk (§1 naloge)

| Var | Natančna definicija | Iz kat. dogodkov | Stanje ali promet | Prekrivanje | Negativna? | Izpeljana/shranjena |
|---|---|---|---|---|---|---|
| `P` fizična | `S + D + Rep` (fizično prisotni) | ΣIN(fiz) − ΣOUT(fiz) | **stanje** | disjunktna od W/Sold | ne (če pravilno vodeno) | izpeljana (agregat) |
| `S` prodajna | ΣIN_prod + ΣRETURN(resellable) − ΣOUT_order − ΣOUT_reversal − (izpad prodajnega fizičnega) | proizvodnja/vračilo/izdaja/reversal/izguba | stanje | vsebuje RES in B kot podmnožici | ne | izpeljana |
| `D` poškodovana | ΣIN_RETURN(resellable=false) + ΣIN_repair_return(poškodovan) − ΣOUT_waste − ΣOUT_repair(iz D) | vračilo/odpis/popravilo | stanje | disjunktna od S | ne | izpeljana |
| `Rep` popravilo | ΣOUT_repair − ΣIN_repair_return | popravilo/vrnitev | stanje | disjunktna od S/D | ne | izpeljana |
| `RES` rezervirana | ΣRESERVE − Σ(ISSUE+RELEASE+EXPIRE) | StockReservationEvent | **stanje** (neto) | **mora biti ⊆ S, disjunktna od B** | ne (`RESERVATION_OVERFLOW`) | izpeljana iz dogodkov |
| `B` umaknjena | ΣWITHDRAW − ΣREACTIVATE | StockAvailabilityEvent | **stanje** (neto) | **mora biti ⊆ S, disjunktna od RES** | ne (`WITHDRAW_OVERFLOW`) | izpeljana iz dogodkov |
| `A` razpoložljiva | `S − RES − B` | iz S/RES/B | stanje | ne sme presegati S | ne (`NEGATIVE_AVAILABLE`) | izpeljana |
| `I` izdana | ΣOUT_order | izdaja | **kumulativni promet** | izven S (Sold) | ne | izpeljana |
| `R` vrnjena | ΣRETURN (vsi) | vračilo | **kumulativni promet** | — | ne | izpeljana |
| `Neto` prodano | `I − R` | iz I/R | promet | — | ne | izpeljana |
| `W` odpisana | ΣOUT_waste_phys | odpis | stanje (zunaj P) | disjunktna od P | ne | izpeljana |

**KLJUČNO (vprašanje naloge): ali se isti kos lahko šteje v `B` IN `RES` hkrati?**
- **2D-1H trdi, da ne** (»Noben kos ni hkrati RES in B«, §1.3; `B ⊆ S`, `RES ⊆ S`), **vendar model tega NE
  struktur=nj** kot podatkovno invariant, ampak le kot poslovno varovalko v §3.3: `0 ≤ B ≤ S − RES`.
- **Zunaj tega faltna simetričen varovalni pogoj manjka: `0 ≤ RES ≤ S − B`.** Če `RESERVE` preverja le
  `S − RES` (kot danes `AVAIL = stockQuantity − reservedQuantity`, brez `B`), lahko rezervacija zasede
  umaknjen (blokiran) kos → potem `A = S − RES − B` dvakrat odšteje isti kos in `A` postane negativen.
- **Dokaz (konkretno) — glej §7 scenarij 5:** S=10, RES=4, B=6. `RESERVE 3` s trenutnim `AVAIL` (`S−RES=6≥3`)
  bi dovolil → RES=7, potem `A=10−7−6=−3` (negativen!). To je **resnična napaka modela** v realnem checkoutu
  (ki sploh nima `B`) in **nepopolna specifikacija v 2D-1H** (manjka simetrični pogoj za `RESERVE`).
- **Popravek (zahteva #1):** oba tokova morata v transakciji vzdržati skupno invariant `RES + B ≤ S`:
  - `RESERVE`: `RES + qty + B ≤ S` (rezerviraj samo iz nedovoljeno-umaknjenega dela),
  - `WITHDRAW`: `B + qty + RES ≤ S` (umakni samo iz nerezerviranega dela),
  - `ISSUE/RELEASE/EXPIRE/REACTIVATE`: zmanjšajo svoj števec, invariant se ohrani.
  Tedaj je `B` in `RES` disjunktno (obe podmnožici `S`, njuna vsota ≤ S) in `A = S − RES − B` velja.

**Ocena §1: PARTIAL** (model je matematično skladen LE ob dodatku simetrične RESERVE-guards; 2D-1H je ni
določil; sedanji checkout `B` sploh ne pozna).

---

## 2. Neodvisno preverjanje bilance in P = S + D + Rep

### 2.1 Preverba formule `P = S + D + Rep`
- Pokriva fizične kategorije: S (vklj. RES+B podmnožici), D (poškodovan prisoten), Rep (v popravilu).
- Kategorije izven P so pravilno izključene: `W` (odpisana, fizično odstranjena), `Sold`/izdana (zapustila),
  fizično izgubljeni.
- **Ugotovljena neskladnost (zahteva #2):** formula za `S` v §2 2D-1H vsebuje `− ΣOUT_sold`, a **ne vsebuje
  člena za neprodajno fizično izgubo prodajnega kosa** (npr. `OUT STOCKTAKE` izgube / kradja nepoškodovanega
  kosa, ali `OUT WASTE` nepoškodovanega). Jasno ločitvi: **odpis POŠKODOVANEGA kosa** (že izven S) res NE sme
  znižati S (1.2 — pravilno); **izguba/odpis ŠE PRODAJNEGA kosa** pa MORA znižati S (in P). 2D-1H je te dve
  vrsti zdrsnil pod isti `OUT_waste`, kar povzroči dvoumnost.
- **Popravek (zahteva #2):** formula naj bo izrecno
  `S = ΣIN_prod + ΣRETURN(resellable) − ΣOUT_order − ΣOUT_reversal − ΣOUT_loss_sellable`,
  kjer `OUT_loss_sellable` = fizična izguba/odpis kosa, ki je še bil prodajen; `OUT_waste` za poškodovan se
  uporablja le za `D`, ne S. S tem je `P = S + D + Rep` **univerzalno pravilna** in pokriva tudi izgubljene.

### 2.2 Kam sodijo posamezne kategorije (preverjeno):
| Kategorija | V P? | V S? | Opomba / odločitev |
|---|---|---|---|
| umaknjeni (B) | da (prek S) | da (podmnožica) | ne v A |
| rezervirani (RES) | da (prek S) | da (podmnožica) | ne v A |
| poškodovan vrnjen | da | ne | v D |
| v popravilu | da (prek Rep) | ne | v Rep |
| odpisani (odstranjen) | ne | ne | v W |
| fizično izgubljen | ne | ne | zabeležen kot OUT (STOCKTAKE) → W; glej zahtevo #2 |
| umaknjen, a v skladišču | da (prek S) | da | B podzmožica S |

### 2.3 Neodvisen izračun (od nič, brez kopiranja 2D-1H)
(Izpeljal sem vsako vrstico; ujema se s tabelo 2D-1H, glej spodaj v §7 — 2D-1H aritmetika je **pravilna**.)
```
0: P=0 S=0 D=0 Rep=0 RES=0 B=0 A=0 I=0 R=0 Neto=0
1: IN PROD 19 → P=19 S=19 A=19
2: RESERVE +10 → RES=10 A=19−10−0=9
3: OUT ORDER 7 (+ISSUE −7) → P=12 S=12 RES=3 A=12−3−0=9 I=7
4a: RETURN resellable 1 → P=13 S=13 A=13−3−0=10 R=1 Neto=6
4b: RETURN damaged 1 → P=14 S=13 D=1 A=13−3−0=10 R=2 Neto=5   (P=13+1+0=14 ✓)
5: WITHDRAW 9 → B=9 P=14 S=13 A=13−3−9=1                        (P NI spremenjen ✓)
```
Vsi `P = S + D + Rep` držijo (19,19,12,13,14,14); ni izgubljenega ni podvojenega kosa. **§1.4/§5.1 2D-1H so
aritmetično pravilni.**

---

## 3. Konflikt rezervacija/umik (10 kombinacij §3 naloge)

| # | Kombinacija | Dovoljen? | Dogodek | Sprosti RES? | Možna izdaja? | Pregled/potrditev? | Preprečevanje dvojnega štetja |
|---|---|---|---|---|---|---|---|
| 1 | rezervacija → umik | ✅ | RESERVE, nato WITHDRAW (le na nerezerviranih) | ne | da (za nedovoljeno-umaknjene) | — | WITHDRAW gluyd `B+qty+RES≤S` |
| 2 | umik → rezervacija | ✅ (če dovolj neumaknjenih) | WITHDRAW, nato RESERVE (le na neblokiranih) | — | da | — | RESERVE gluyd `RES+qty+B≤S` |
| 3 | rezervacija → delna izdaja → umik | ✅ | RESERVE→ISSUE(nekaj)→WITHDRAW(preostane nerezervirano) | delna (ob izdaji) | — | — | ob ISSUE RES−; ob WITHDRAW `B+RES≤S` |
| 4 | umik → ponovna aktivacija | ✅ | WITHDRAW→REACTIVATE | — | da po aktivaciji | — | REACTIVATE zmanjša B; `B−qty≥0` |
| 5 | rezervacija → preklic naročila | ✅ | RESERVE→RELEASE(za neizdano) + (vračilo izdanega) | da | — | — | RELEASE `RES−`, idempotency |
| 6 | rezervacija → potek | ✅ | RESERVE→EXPIRE | da | — | — | EXPIRE `RES−`, scheduler token |
| 7 | umik REZERVIRANEGA zaradi poškodbe | ⚠️ (ni definiran) | Potrebno: RELEASE (RES−) + premik v D | da | — | **da** (ocena poškodbe) | RES− in D+ atomično; glej zahtevo #3 |
| 8 | vrnjen (resellable) iz prej umaknjenega | ✅ | RETURN resellable → v S; B se NE spremeni samodejno | — | da kot naprodajna | — | RETURN in WITHDRAW neodvisna; B nespremenjen → ni podvajanja |

**Ugotovitev:** kombinacije 1–6, 8 so model podprt. **Kombinacija 7 (rezerviran kos postane poškodovan pred
izdajo) NI definirana** v 2D-1H — model zna le poškodovano vračilo, ne pa poškodbe *še rezerviranega* kosa v
skladišču. To je **zahteva #3**: definirati dogodek `RESERVE→RELEASE` + premik v D (z `idempotencyKey`),
atomično, da `RES+B≤S` ostane in da ni možnosti prodaje poškodovanega ali blokiranega kosa.
**Poslovno pravilo (naloga §3):** ni mogoče prodati kosa, ki je fizično prisoten, a ni prodajno uporaben ali
je blokiran → to zagotavlja `RESERVE` gluyd + `A=S−RES−B` + preverba, da izdaja vedno najprej rezervira
(ni direktne izdaje blokiranega).

---

## 4. Preverjanje dogodkov in transakcijskih učinkov (§4 naloge)

### 4.1 Popravljena tabela (dopolnjena 2D-1H in preverjena)
| Dogodek | Fizični P | Prodajni status | RES | B | Obvezne ref. | Trans. meja | Vrstni red | Idempotency | Sočasnost | Org-safety | Korekcija | Append-only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RESERVE | 0 | brez spre.: odpre A | + | 0 | allocation/order/batch | `RES+B≤S` (zahteva #1) | preveri → RES+ | `idemKey` | row-lock | `requirePermissionOrg` | RELEASE (−q) | DA |
| ISSUE | − | izdaja | − | 0 | allocation/order | `ΣISSUE≤RES`; `OUT≤avail fiz.` | OUT→ISSUE | `idemKey` | row-lock | org | reversal | DA |
| RELEASE | 0 | sprosti rezerv. | − | 0 | reservation | `≥0` | RES− | `idemKey` | row-lock | org | RESERVE (+q) | DA |
| EXPIRE | 0 | sprosti | − | 0 | reservation | `≥0`, token | RES− | token uniq | zaščita | org | RESERVE | DA |
| WITHDRAW | 0 | umik (v B) | 0 | + | batch/variant, reason | `B+qty+RES≤S` | B+ | `idemKey` | row-lock | org | REACTIVATE | DA |
| REACTIVATE | 0 | ponovna aktiv. | 0 | − | withdrawal | `B−qty≥0` | B− | `idemKey` | row-lock | org | WITHDRAW | DA |
| RETURN resellable | + | +S | 0 | 0 | original OUT (returnOfMovementId) | `ΣRETURN≤ΣOUT` | OUT exit? → RETURN | `idemKey` | row-lock | org | reversal | DA |
| RETURN damaged | + | 0 (v D) | 0 | 0 | original OUT | `ΣRETURN≤ΣOUT` | RETURN (resell=false) | `idemKey` | row-lock | org | reversal | DA |
| REPAIR out | − | −(S) ali 0(D) | 0 | 0 | batch | stanje kos | izp. | `idemKey` | row-lock | org | RETURN | DA |
| REPAIR return | + | odvisno (S/D) | 0 | 0 | batch | ocena | pregled | `idemKey` | row-lock | org | REPAIR out | DA |
| write-off (fiz.) | − | 0 (S nesprem.; glej #2) | 0 | 0 | batch, ref RETURN | kos v D (ali S→zahteva #2) | iz D | `idemKey` | row-lock | org | — (fiz. izgubljen) | DA |
| cancel order | ob izdaji − | RELEASE ali vračilo | − | 0 | orderId | — | — | `idemKey` | row-lock | org | — | DA |
| production reversal | − | − | 0 | 0 | batch, cancelId | `reversal≤fiz. available` | OUT | `idemKey` | row-lock | org | IN revert | DA |

### 4.2 Sočasne grožnje (preverjeno)
- **Dva sočasna zahtevka za zadnji kos (scenarij 9):** `RESERVE`/`OUT` atomično z row-lock na `ProductVariant` in
  pogojem (`RES+B≤S`, oz. `AVAIL` v današnjem checkoutu). Dva sočasna `RESERVE` → en dobi count=1, drugi count=0
  (rollback) — preprečen negativ / dvojna izdaja. (Sedanji `convertReservationToSale`/`applyOrderStockDecrement` uporabljata
  atomični UPDATE s pogojem, enako kot `reserveStock`; potrjeno v kodi lin. 174–180, 216–224.)
- **Dvojna izdaja (convert + decrement istega kosa):** v `verifyProductOrder` je **if/else** (lin. 1257–1270):
  `convertReservationToSale`, in le **če vrne false** → fallback `applyOrderStockDecrement`. Isti kos NI dvojno
  knjižen (samo ena veja se izvede). Poleg tega later `stockQuantity`/`reservedQuantity` atomično zniža s pogojem.
- **Podvojeni webhook za plačilo (scenarij 10):** `verifyProductOrder` najprej preveri `status===PAID` (lin.
  1216–1220) → vrne `alreadyProcessed:true`, NEdve-knjižit ce. Vse v `prisma.$transaction` (lin. 1225).
- **Podvojeni zahtevek za vračilo (scenarij 11):** `idempotencyKey` uniq + `ΣRETURN≤ΣOUT` (`RETURN_OVERFLOW`).

**Transakcijska integriteta:** vsak poslovni dogodek je ena transakcija (prisma.$transaction). Za razliko
današnje kode, ki nima `StockReservationEvent`/`StockAvailabilityEvent`, predlagani model mora vse
materializirane vrednosti (`stockQuantity`, `reservedQuantity`, izpeljano `blockedQuantity`) hraniti v **eni**
transakciji z dogodkovni zapisom (kot `createStockMovement` že dela: stanje + ledger v istem bloku, lin.
163–180). **Ne sme biti** ločenega state-update in ločenega event-write, ki bi zahtevala drugo transakcijo.

---

## 5. Preverjanje dejanskega checkouta (§5 naloge)

| Funkcija | Datoteka: vrstica | Kaj spremeni | Kdaj | Transakcijsko | Anti-dup | Delna izdaja / preklic |
|---|---|---|---|---|---|---|
| `reserveStock` | product-checkout.ts:166 | `reservedQuantity += q` (če `stockQuantity−reservedQuantity ≥ q`) | košarica/checkout-hold (Stripe, online) | da (tx) | `AVAIL` pogoj, count=1 | — |
| `releaseStockReservation` | :187 | `reservedQuantity −= q` (če `≥q`) | unpaid/expired/cancelled | da | pogoj | → RELEASE pri preklicu |
| `convertReservationToSale` | :208 | `stockQuantity −= q`, `reservedQuantity −= q` (+ OUT ORDER) | potrjeno plačilo, če je bila rezervacija | da | pogoj `reserved≥q` | — |
| `applyOrderStockDecrement` | :91 | `stockQuantity −= q` (+ OUT ORDER) | potrjeno plačilo, če ni rezervacije (izven mreže/darilni/prepaid) | da | pogoj `stock≥q` | — |
| `createStockMovement` | inventory.ts:81 | stanje + ledger (NEGATIVE_STOCK pre-check) | ročno / dobava / STOCKTAKE | da (:163) | pogoj + profile | — |

**Preverba, ali `convertReservationToSale` in `applyOrderStockDecrement` lahko OBA knjižita isto izdajo:**
- **Ne, če je isto naročilo obdelano po eni poti.** V `verifyProductOrder` (lin. 1257–1270) sta alternativa
  (if/else). Prepaid/darilni pot (lin. 705–707) je drugačna pot brez rezervacije (»no Stripe«, najprej kritizirano
  kot v celoti plačano ob kreaciji). Ker eno naročilo sledi eni poti in PAY-status-guard blokira ponovno
  obdelavo, **ni dvojne knjižbe**. 
- **Opozorilo (razlika dokument vs koda):** današnja koda znižuje `stockQuantity` na `ProductVariant` (kot
  zrcalo), medtem ko predlagani model ohranja to kot materializiran prikaz iz `StockMovement`+`StockReservationEvent`.
  To ni protislovje, ampak načrtovana sprememba (2D-1H §4.2) — **kodo ne spreminjamo, ugotovitev je skladna.**

**Ocena §5: PASS** (razen splošne opozorbe, da trenutna koda ne pozna `B` — glej zahtevo #1, ki je modelna,
ne obstoječa funkcijska napaka v checkoutu).

---

## 6. Preverjanje predlagane Prisma arhitekture (§6 naloge)

Preverjene entitete in odgovornost:
- **`ProductionContribution`** — vir→serija; `@@index(org,batch)`, `@@index(org,source)`; `Restrict` na
  ExtensionRecord (zgodovina). Podpira več virov (več pridelkov) — ✅.
- **`OrderItemBatchAllocation`** — `@@unique(org, orderItem, batch)` ena vrstica na (orderItem,serija);
  `SetNull` na batch za zgodovino. **Več delnih vračil** isti alloc → prek StockMovement, ne alloc — ✅ ne blokira.
  Več serij na enem artiklu → več alloc — ✅.
- **`StockReservationEvent`** — `@@unique(org, idempotencyKey)`; org-scope; `ResEventType`. Korekcije append-only.
- **`StockAvailabilityEvent`** — `@@unique(org, idempotencyKey)`; org-scope; `WITHDRAW/REACTIVATE`.
- **`StockMovement` dodatki** — `allocationId`, `returnOfMovementId`, `idempotencyKey`, `resellable`,
  `returnDisposition`; ± indeksi.

**Preverjeno:**
- **Org izolacija:** vsak model org-scoped in vsaka relacija preveri `organizationId` (kot danes v akcijah).
- **onDelete:** `Restrict`/`SetNull` na ExtensionRecord; `Cascade` na Organization (org-seja). Ustrezno.
- **Unikatnost idempotency-ključev:** per model `@@unique(org, idempotencyKey)`; ne blokira delnih dogodkov
  (enolični so samo ključi dogodkov, razdelitev `@@unique(org,orderItem,batch)` je na razdelitev, ne na dogodek).
- **Preprečevanje:** preseganje vračil (`ΣRETURN≤ΣOUT`), negativna rezervacija (`RES+B≤S` po zahtevi #1),
  negativna fiz/aloga — poslovno preverjeni, ne z unikatnimi omejitvami (pravilno, ker unikatnost ne sme
  blokirati legitimnih delnih dogodkov).
- **Rekonstrukcija zaloge iz dogodkov:** `P/S/RES/B` so agregati dogodkov; materializirane vrednosti
  (`stockQuantity`, izpeljano `blockedQuantity`) morajo biti računanje iz istega transakcijskega bloka kot
  njihovi dogodki (kot `createStockMovement` :163–180). **Skladno, pod trenutni pogoj zahteve #1.**
- **Ne dodajamo nepotrebnih tabel:** vsaka entiteta ima jasno odgovornost (contribution / alloc / reservation / availability / movement).

**Ocena §6: PARTIAL** (struktura upravičena; odpira se zgolj zahteva #1 — poslovni varovalni pogoj
`RES+B≤S` za oba nefizična toka ink zahteva #3 pri poškodbi rezerviranega).

---

## 7. Obvezni stresni scenariji (§7 naloge)

V vseh spodaj: `P=S+D+Rep`; poleg vsakega končno stanje (P, S, RES, B, D, Rep, A, I, R, Neto, W).

**1. Delna rezervacija in delna izdaja.** S=10. RESERVE 6, RESERVE 4 → RES=10. ISSUE 4 → OUT 4, RES=6. I=4,
RES=6, A=10−6−0=4. Končno: P=10, S=10, RES=6, B=0, A=4, I=4, Neto=4. ✓

**2. Več delnih vračil iste izdaje.** OUT 5. RETURN 1(resell), RETURN 1(resell), RETURN 1(damaged). ΣRETURN=3≤5.
Končno: I=5, R=3, Neto=2, S += 2 (resell), D += 1. ✓ (idemKey različni, break na ΣRETURN≤OUT.)

**3. Upokojeno vračilo poškodovanega → poznejši odpis.** IN RETURN damaged 1 → D+1,P+1. Pozneje OUT WASTE → P−1,
D−1, **S nespremenjen** (1.2). W += 1. Končno: D=0, W=1, S kot prej, P=S+D+Rep. ✓ odpis ne zniža S dvakrat.

**4. Vračilo → popravilo → ponovna prodaja.** IN RETURN damaged 1 (D+1, P+1). OUT REPAIR (D−1, Rep+1, P ni spremenjen
P=S+D+Rep; Rep+1). IN REPAIR_RETURN (Rep−1) → ocena resellable → S+1. Končno: S+1, P=S+D+Rep, D=0, Rep=0. ✓

**5. Umik iz prodaje med aktivno rezervacijo.** S=10, RES=4, B=0, A=6. WITHDRAW 3 → B=3, A=3. **Potem RESERVE 3**
→ s korektnim pogojem `RES+B≤S` → 4+3+3=10 ≤ 10 (da, na rob). RES=7, A=10−7−3=0. ✓ (ČE RESERVE ne bi preveril
`+B`, bi A=−3 — glej zahtevo #1.) — **Dokaz potrjuje zahtevo #1.**

**6. Umik po delni izdaji.** RESERVE 10, ISSUE 7 (OUT 7, RES=3), WITHDRAW (S−RES−return) 9 → B=9, A=1. Končno kot
številke 2D-1H: P=14, S=13, D=1, RES=3, B=9, A=1, I=7, R=2, Neto=5. ✓

**7. Ponovna aktivacija umaknjene zaloge.** B=9 → REACTIVATE 9 → B=0, A=13−3−0=10. P/S nespremenjena. ✓

**8. Preklic naročila z rezerviranimi in že izdanimi.** Naročilo rezerviralo 10, izdano 7 (OUT 7, RES=3). Preklic:
za izdano → vračilo (ali pa statusno, odvisno) → RETURN(izdano) ali reversal; za neizdano RELEASE 3 → RES=0.
Končno: RES=0, izdano obdelano kot vračilo, S se vrne/sprosti. ✓

**9. Dva sočasna zahtevka za zadnji kos.** S=1 (available=1). Two RESERVE 1 → row-lock + pogoj → prvi count=1,
drugi count=0 → drugi rollback, `NEGATIVE_AVAILABLE`. Končno RES=1, A=0; noben negativen. ✓

**10. Podvojeni webhook za plačilo.** `verifyProductOrder` -> drugi klic: `alreadyProcessed:true` (guard pakarno;
koda). Nobene druge izdaje, nobene novih StockMovement OUT. ✓

**11. Podvojeni zahtevek za vračilo.** RETURN z istim `idempotencyKey`/`returnOfMovementId` → drugi odklonjen
(`DUPLICATE_RETURN`), `ΣRETURN≤OUT` ne presežen. ✓

**12. Proizvodnja iz več pridelkov.** Ena serija, 2 harvesta → `ProductionContribution` ×2 (A 5 kg + B 7 kg).
IN PRODUCTION = skupne enote. Končno contribution=2, izvor ohranjen; `lossQuantity` ločen. ✓

**13. Ena serija, razdeljena med več naročil.** Serija 19 → order1 alloc 10, order2 alloc 5, rezervirano skupaj 15,
A=4 (če ni druge). Vsak alloc ima svojo `allocationId` + `StockReservationEvent` + (ob izdaji) OUT. Rezervacije
ne prekoračijo `S` (RES_tot≤S). ✓

**14. Korekcija napačno evidentiranega dogodka.** Napačen `RESERVE 10` → append-only popravek: `RELEASE −10` (ali
REACTIVATE pri napačnem WITHDRAW); zgodovinska vrstica ostane, neto popravi. Pri napačnem OUT → reversal; pri
napačnem contribution → nov contribution z negativnim inputQuantity. ✓ (append-only, idempotencyKey edinstven).

**Sklep stresnih: 1–6, 8–14 prestanejo; 5+7 potrjujeta nujnost simetričnega varovalnega pogoja (#1); noben
scenarij ne privede do negativne zaloge ob pravilni uporabi guardov; izpostavljeni sta le zahtevi #1 in #3.**

---

## 8. Končna ocena pripravljenosti (§8 naloge)

| Področje | Ocena | Utemeljitev |
|---|---|---|
| Matematična pravilnost | **PARTIAL** | izračuni 2D-1H so pravilni; B/RES disjunktnost velja le ob manjkajočem simetričnem pogoju (#1) |
| Fizična bilanca | **PASS** | `P=S+D+Rep` velja skozi vse obravnavane scenarije (z izpopolnitvijo S formule za izgubo prodajnega — #2) |
| Prodajna bilanca | **PARTIAL** | pravilna, a je treba ločiti `OUT_waste(poškodovan)` od `OUT_loss_sellable` (#2) |
| Rezervacije | **PARTIAL** | model ok; manjka simetrični `RESERVE` pogoj `RES+B≤S` (#1), ki ga sedanji checkout `AVAIL` ne vsebuje |
| Vračila | **PASS** | `ΣRETURN≤ΣOUT`, `idempotencyKey`, več delnih vračil — preverjeno |
| Proizvodna sledljivost | **PASS** | ProductionContribution (več virov), alloc→batch→contribution→harvest |
| Sočasnost in transakcije | **PASS** | row-lock + pogojne UPDATE; if/else convert/decrement; PAY-guard (koda potrjena) |
| Org-scoped varnost | **PASS** | vse relacije org-scoped, `requirePermissionOrg`, INV preveritve (npr. inventory.ts:90–147) |
| Skladnost z obst. checkoutom | **PARTIAL** | aritmetika checkouta pravilna in se ujema; a obst. `AVAIL` ne pozna `B` — model to mora dodati (ne spreminja kode) |
| Pripravljenost Prisma modela | **PARTIAL** | struktura solidna; dodati je treba poslovne varovalne pogoje v transakcije + definirati #3 (poškodba rezerviranega) |

**Tri zahteve za popravek pred številom na shemo:**
1. **#1 (kritično, matematična integriteta):** v transakcijah izvesti skupno invariant `RES + B ≤ S` na OBEH
   straneh — `RESERVE` preverja `RES+qty+B≤S`; `WITHDRAW` preverja `B+qty+RES≤S` — tako je `B` in `RES` strogo
   disjunktno in `A=S−RES−B` velja. (2D-1H je določil le eno stran.)
2. **#2 (jasnost bilance):** v `S` formulo vključiti `OUT_loss_sellable` (fizična izguba še-prodajnega kosa);
   `OUT_waste` za poškodovanega naj velja le za `D`, ne za `S`. S tem `P=S+D+Rep` univerzalno.
3. **#3 (vrzel):** definirati dogodek poškodbe **rezerviranega** kosa v skladišču (RESERVE→RELEASE + premik v D,
   append-only, idempotencyKey) — 2D-1H ni obravnaval poškodbe *pred* izdajo.

**Posebna ugotovitev (odnos model ↔ koda):** današnja koda ne vsebuje `StockAvailabilityEvent`/`B` in njena
`AVAIL` definicija ne šteje umika iz prodaje. To **ne pomeni napake v obstoječem checkoutu** (v njem umik iz
prodaje niti ne obstaja), ampak pomeni, da prihodnja implementacija faze 2D-1A **mora** predstaviti `B` tudi v
rezervacijsko/izdajno logiko, sicer se neuvedeni `B` ne bo upošteval in pride do opisa v zahtevi #1.

---

## 9. Priporočilo (naloga §8 — ne odločam namesto uporabnika)

**PRIPRAVLJENO ZA ODOBRITEV FAZE 2D-1A ob predhodnem upoštevanju treh zgoraj navedenih zahtev (#1–#3).**

- **Ni blokade trajnega tipa** — vse tri zahteve so **ojačanja/izpopolnitve specifikacije** v obseg mej
  obstoječega modela (2D-1H): niso nove tabele, ampak pravilni varovalni pogoji v transakcijah in ena formula.
- **Struktura sheme (ProductionContribution, OrderItemBatchAllocation, StockReservationEvent,
  StockAvailabilityEvent, StockMovement dodatki) je upravičena in org-varno načrtovana.**
- Odločitev o sami odobritvi Faze 2D-1A (in morebitni migraciji) **pustim uporabniku**; navajam le dokazno
  utemeljene zahteve za popravek dokumenta (ne kode) pred implementacijo.

**Konec neodvisne revizije — nič implementirano, Faza 2D-1A ostaja neodobrena; čakam tvojo odločitev.**

---

# DOPOLNITEV 2D-1J — KONČNE VAROVALKE REZERVACIJ, UMIKA IN POŠKODOVANE ZALOGE — read-only

Dopolnitev odpravlja tri konkretne pomanjkljivosti iz neodvisne revizije 2D-1I (zahteve #1–#3):
simetrični varovalni pogoj `RES + B ≤ S`, izpopolnjeno formulo `S` (ločen `OUT_loss_sellable`) in določen
postopek poškodbe še rezerviranega izdelka. **Izključno dokumentacija — nič kode/sheme/baze/migracij,
brez Git operacij, `einvoices.ts` nedotaknjen. Faza 2D-1A ostaja neodobrena.**

**Potrjene reference (working tree):** `reserveStock` product-checkout.ts:166, `releaseStockReservation`:187,
`convertReservationToSale`:208, `applyOrderStockDecrement`:91, `AVAIL`(=«stockQuantity − reservedQuantity ≥ qty») :146,
`verifyProductOrder`:1097 (PAID-guard :1216–1220, if/else convert→fallback :1257–1270), prepaid path :705–707;
`createStockMovement` inventory.ts:81 (transakcija :163, `movementInputSchema` dovoli `source:"RETURN"` :33,
komentar #78 :30–32, STOCKTAKE :513), `StockMovement` prisma:2130, `StockMovementSource`:2120.

---

## 1. Kritična varovalka: rezervacije in umik iz prodaje (`RES + B ≤ S`)

**Obvezno poslovno pravilo (invariant, ves čas):**
```
RES + B ≤ S
```
`RES` ⊆ `S`, `B` ⊆ `S`, in njun seštevek ne sme preseči `S` — s tem sta strogo disjunktna podmnožici in
`A = S − RES − B` (razpoložljiva) velja brez dvojnega odštevanja. To invariant dvigata **nefizična** dogodkovna
toka (`StockReservationEvent`, `StockAvailabilityEvent`), zato je treba preverjati **na obeh straneh**.

### 1.1 RESERVE — obvezen pogoj
Pred potrditvijo rezervacije, v isti transakciji, preveri:
```
RES + qty + B ≤ S
```
- Če NI izpolnjen → zavrnjeno, **brez** delne/negativne rezervacije; `reservedQuantity` se ne spremeni; **noben**
  `StockReservationEvent RESERVE` se ne zapiše (append-only = nič).
- Varovalka je **simetrična** nasproti WITHDRAW (2D-1I zahteva #1).

### 1.2 WITHDRAW — obvezen pogoj
Pred umikom, v isti transakciji, preveri:
```
RES + B + qty ≤ S
```
- Če NI izpolnjen → umik **zavrnjen** ali **omejen na dejansko razpoložljivo** (`A = S − RES − B`); rezervirani
  kosi se **nikoli ne umaknejo samodejno**; negativna `A` ni mogoča.
- `B + qty` mora biti namenjen le nerezerviranim kosom.

### 1.3 Sočasni zahtevki — konkretno
| Ravnov ne | Preprečeno z | Trans. meja | Vrstni red | Pogoj po zaklepu | Idempotency |
|---|---|---|---|---|---|
| dva hkratna RESERVE | row-lock na vir/zalogo (ProductVariant ali ProductionBatch) | ena transakcija | lock → branje `RES,B,S` → preveri `RES+qty+B≤S` → write | po lock ponovno preveri (vsota ≤ S) | `idempotencyKey` `@@unique(org,key)` |
| hkratni RESERVE in WITHDRAW | isti row-lock | ena transakcija | lock → preveri oboje | `(RES+qty+B≤S)` in `(RES+B+qty≤S)` | idemKey |
| dva hkratna WITHDRAW | row-lock | ena | lock → preveri `RES+B+qty≤S` | po lock | idemKey |
| hkratni RELEASE in WITHDRAW | row-lock + RNI (release po lock) | ena | lock → RELEASE zniža RES → WITHDRAW preveri `RES+B+qty≤S` | RNI (read-new-verify) | idemKey |
| hkratna izdaja in vračilo | row-lock `OUT_order` in `RETURN` | ena transakcija | lock → OUT zniža (če je bil rezerviran, tudi RES) → RETURN preveri `ΣRETURN≤ΣOUT` | po lock | idemKey |

**Preverjanje dejanskih mehanizmov v kodi:** obstoječi `reserveStock`/`convertReservationToSale`/
`applyOrderStockDecrement` (product-checkout.ts:166/208/91) uporabljajo **atomski UPDATE s pogojem** (`AVAIL`
:146 = `stockQuantity − reservedQuantity ≥ qty`; count=1) — to je row-lock ekvivalent za posamezen stavek in je
**korekten za posamezno operacijo**. Vendar:
- `AVAIL` **ne vsebuje `B`** → obstoječi `reserveStock` ne bi zavrnil rezervacije na umaknjeno zalogo. **To ni
  funkcionalna napaka obstoječe kode** (umik iz prodaje v kodi sploh ne obstaja), ampak **prihodnja
  implementacijska zahteva**: posodobiti `AVAIL` (ali `RESERVE` guard) na `available = S − RES − B` in dodati
  `RES+qty+B≤S`.
- Za **večizvedbene** (dva zahtevka hkrati) v kodi ni ločenega mehanizma, a ker so vse operacije v enem
  atomskem UPDATE z pogojem (in vse v `prisma.$transaction`), je varovalka pri posameznem stavku zadostna.
  Pri večpogojnih (RESERVE+WITHDRAW) je **nujen ekspliciten row-lock**, ker noben posamezen UPDATE ne pokriva
  obeh števcev hkrati → **prihodnja zahteva**.

---

## 2. Popravljena formula prodajne zaloge `S` + ločitev fizičnih izhodov

### 2.1 Jasna ločitev petih fizičnih dogodkov
| Dogodek | P | S | D | Rep | Obja |
|---|---|---|---|---|---|
| `OUT_waste_damaged` (odpis poškodovanega, fizično odšel) | **−** | **0** (S ga že ne vodi) | **−** | 0 | odpis iz D; S se NE zniža ponovno |
| `OUT_loss_sellable` (izguba/odpis ŠE prodajnega) | **−** | **−** | 0 | 0 | izguba prodajnega kosa; (če je bil RES → pred RELEASE, §2.2) |
| `OUT_order` (izdaja kupcu) | **−** | **−** | 0 | 0 | izdaja; če rezerviran → ob OUT tudi ISSUE (RES−) |
| `OUT_repair` (fiz. iz skladišča v servis) | − | − (če je bil S) ali 0 (če je bil D) | − (če je bil D) | **+** | premik v Rep; P = S+D+Rep se ohrani |
| `IN_repair_return` (vrnitev iz servisa) | + | odvisno (S ali D po oceni) | odvisno | **−** | vrnitev v Rep−; ocena → S ali D |

**Ključno pravilo (potrjeno):** če je poškodovan kos **že izločen iz S** (ob `IN RETURN resellable=false` ali
`DAMAGE_RESERVED`), poznejši `OUT_waste_damaged` **ne sme** ponovno zmanjšati `S` — vpliva le na `P` in `D`.
Če je kos **ob izgubi še prodajno uporaben**, mora `OUT_loss_sellable` **zmanjšati tudi `S`** (in `P`).

### 2.2 Izguba rezerviranega — obvezen predhodni RELEASE
- Če je izgubljeni (ali odpisani z izgubo) kos **rezerviran**, mora sistem **pred** `OUT_loss_sellable`
  izvesti `RELEASE` (znižanje `RES`) v **isti atomski operaciji**. Drugače bi kos izpadel iz `S` (v `W`/izgubo),
  a bi ostal v `RES`, kar bi kršilo `RES ≤ S` in dvojno (RES+B…). 
- Vrstni red znotraj ene transakcije: (1) `RELEASE` (RES−), (2) `OUT_loss_sellable` (P−, S−).
- Če kos ni bil rezerviran → samo `OUT_loss_sellable`.

### 2.3 Dokončne formule (pravilne, brez dvojnega odštevanja)
```
P = S + D + Rep
S = ΣIN_prod + ΣRETURN(resellable) − ΣOUT_order − ΣOUT_reversal − ΣOUT_loss_sellable − ΣOUT_repair(iz S)
D = ΣIN_RETURN(resellable=false) + ΣIN_repair_return(poškodovan) + ΣDAMAGE_RESERVED − ΣOUT_waste_damaged − ΣOUT_repair(iz D)
Rep = ΣOUT_repair − ΣIN_repair_return
RES = ΣRESERVE − Σ(ISSUE+RELEASE+EXPIRE)           ,  z invariant RES + B ≤ S
B   = ΣWITHDRAW − ΣREACTIVATE                      ,  z invariant RES + B ≤ S
A = S − RES − B
W = ΣOUT_waste_damaged + ΣOUT_loss_sellable        (zunaj P)
I = ΣOUT_order ; R = ΣRETURN ; Neto = I − R
```
**Dokaz ne-dvojnega odštevanja:** `S` ne vsebuje `OUT_waste_damaged` (glej §3 primeira E) — tako poškodovan kos,
ki je že zapustil `S` ob vpisu v `D`, pri odpisu ne zniža `S` znova. `OUT_loss_sellable` zniža `S` natanko
enkrat (ob vpisu izgube); če je bil rezerviran, `RELEASE` najprej sprosti `RES`, nato `OUT_loss_sellable` —
nobena komponenta ni šteta dvakrat. Pravila `P=S+D+Rep`, `RES+B≤S`, `A≥0`, `R≤I` so invariantna.

---

## 3. Poškodba še rezerviranega izdelka (postopek, append-only)

### 3.1 Postopek (ATOMSKA poslovna operacija)
Dogodek **`DAMAGE_RESERVED`** pri enem ali več rezerviranih kosih, izveden kot **ena transakcija** (skladno z
obstoječo arhitekturo transakcijskih akcij npr. `createStockMovement`:163):
1. **Identifikacija** poškodovanega kosa (count, allocationId, batchRecordId).
2. **Preverba**: org iz seje (`requirePermissionOrg`), serija/izdelek v isti org, **aktivna rezervacija** obstaja
   (`RES − qty ≥ 0`; `allocationId` veljava).
3. **RELEASE** pripadajoče količine (RES − qty) — tako se sprosti rezervacija (dogodek `RELEASE`, idemKey).
4. **Evidentiranje poškodbe** (dogodek `DAMAGE_RESERVED`, dot. `idempotencyKey`).
5. **Premik iz S v D** (S − qty, D + qty). **P se NE spremeni** — kos fizično ostane v skladišču
   (`P = S+D+Rep` se ohrani).
6. **Ohranitev fizične zaloge**: ni `OUT`, kos ni šel nikamor.
7. **Prepoved izdaje**: kos je v D → ni v S → `A` ga ne vsebuje → izdaja ga ne morejo zajeti.
8. **Nadaljevanje**: pozneje `OUT_repair` (popravilo) ali `OUT_waste_damaged` (odpis) — oboje kot append-only
   dogodka; zgodovina se ne spreminja/briše.

Vsi koraki v **eni transakciji** z eno `idempotencyKey` (anti-dup). Korekcija napake = inverzni append-only
dogodek (npr. `REACTIVATE`/`IN repair` / povrnitev v S), nikoli UPDATE.

### 3.2 Robni/scenariji
| Primer | Ravnanje |
|---|---|
| poškodovan samo 1 od več rezerviranih (RES 5, poškod 1) | RELEASE 1 (RES→4), S−1, D+1; ostali 4 ostanejo rezervirani |
| poškodovanih več (RES 5, poškod 2) | RELEASE 2, S−2, D+2, RES→3; invariant RES+B≤S veljavna |
| istočasno izdaja | row-lock; izdaja najprej opravi OUT/ISSUE (če se kosa), nato DAMAGE_RESERVED velja le za še-nereservirane kose; po lock ponovno preverjanje `RES−qty≥0` |
| istočasno preklic naročila | RELEASE tekmuje z RELEASE iz DAMAGE; oba idemKey, `RES−qty≥0`, en izvede, drugi se ne izvede (dvojno sproščanje onemogočeno) |
| rezervacija že sproščena | DAMAGE_RESERVED preveri `RES ≥ qty` → če ne, `RESERVATION_OVERFLOW` (ni mogoče poškodovati ne-rezerviranega prek tega dogodka; ne-rezerviran → OUT_loss_sellable ali direktno v D) |
| izdelek že izdan | ni rezervacije → `RES=0` → DAMAGE_RESERVED ime ne velja; če je bil izdan, gre skozi RETURN (ne skozi DAMAGE_RESERVED) |
| poškodba evidentirana dvakrat | `idempotencyKey` uniq → drugi `DUPLICATE_DAMAGE`, brez dvojnega RELEASE/D premika |

**Enaki invarianti:** RELEASE prinese `RES−`, premik `S−,D+`; `RES+B≤S` se preveri; P se ne spremeni.
Korekcije so append-only; zgodovine se ne tiho spreminja ali briše.

---

## 4. Obvezni matematični primeri

### Primer A — konflikt rezervacije in umika (mora biti zavrnjen)
```
Začetno: S=10, RES=4, B=6   → RES+B=10 = S, A=0
Zahteva: RESERVE +3
Preverba: RES+qty+B = 4+3+6 = 13 ≤ S=10 ?  NE → ZAVRNJENO.
Končno: S=10, RES=4, B=6, A=0.  (noben dogodek, reservedQuantity nespremenjen)
```
**Dokaz:** RESERVE ne odpre negativne A; ne nastane delna/negativna rezervacija.

### Primer B — konflikt umika (preveri dopustnost)
```
Začetno: S=10, RES=4, B=4   → RES+B=8, A=2
Zahteva: WITHDRAW +3
Preverba: RES+B+qty = 4+4+3 = 11 ≤ S=10 ?  NE (11>10).
Možnost (i) ZAVRNJENO: B=4, A=2.
Možnost (ii) OMEJENO na razpoložljivo (A=2): WITHDRAW 2 → B=6, A=10−4−6=0. (Vzame se le nerezervirano.)
```
Obe končni stanji sta veljavni (invariant `RES+B≤S` ostane); odločitev (i)/(ii) je poslovna. Prikazujem obe.

### Primer C — poškodba 2 rezerviranih kozarcev
```
Začetno: S=10, RES=5, B=0, A=5, P=10, D=0
Dogodki (atomsko): 
  RELEASE 2           → RES 5→3
  DAMAGE_RESERVED 2   → S 10→8, D 0→2   (P = 8+2 = 10, nespremenjen)
Končno: P=10, S=8, D=2, Rep=0, RES=3, B=0, A=8−3−0=5.
Preverba: RES+B = 3+0 = 3 ≤ S=8 ✓ ; P=S+D+Rep=10 ✓
```

### Primer D — izguba prodajnega izdelka
```
Začetno: S=10, RES=3, B=0, A=7, P=10
Predpostavka: izgubljen 1 kos NI rezerviran (če bi bil, najprej RELEASE 1 → RES→2).
Dogodek: OUT_loss_sellable 1   → P 10→9, S 10→9
Končno: P=9, S=9, D=0, Rep=0, RES=3 (ali 2 če je bil izg. kos rezerviran), B=0, A=9−3−0=6 (ali 9−2−0=7).
Preverba: P=S+D+Rep=9 ✓ ; izguba zniža S natanko enkrat.
```

### Primer E — odpis poškodovanega (S se ne zmanjša ponovno)
```
Začetno: P=10, S=8, D=2, (kos v D je že izven S)
Dogodek: OUT_waste_damaged 1  → P 10→9, D 2→1, **S nespremenjen 8**
Končno: P=9, S=8, D=1, P=S+D=9 ✓
```
**Dokaz:** ker poškodovan kos ni nikoli v S, odpis S ne zniža — ni dvojnega odštevanja (potrjuje 1.2/2.1).

---

## 5. Posodobljena preglednica dogodkov (dopolnjena 2D-1H; začeta predloga — preverjena)

| Dogodek | P | S | D | Rep | RES | B | Obvezne reference |
|---|---:|---:|---:|---:|---:|---:|---|
| RESERVE | 0 | 0 | 0 | 0 | **+** | 0 | order/allocation/batch; pogoj `RES+qty+B≤S` |
| ISSUE | **−** | **−** | 0 | 0 | **−** | 0 | OUT order + RES; ─ if rezerviran |
| RELEASE | 0 | 0 | 0 | 0 | **−** | 0 | reservation (idemKey) |
| EXPIRE | 0 | 0 | 0 | 0 | **−** | 0 | reservation + scheduler token |
| WITHDRAW | 0 | 0 | 0 | 0 | 0 | **+** | batch/variant, reason; pogoj `RES+B+qty≤S` |
| REACTIVATE | 0 | 0 | 0 | 0 | 0 | **−** | withdrawal (idemKey) |
| RETURN resellable | **+** | **+** | 0 | 0 | 0 | 0 | original OUT (returnOfMovementId), ΣRETURN≤ΣOUT |
| RETURN damaged | **+** | 0 | **+** | 0 | 0 | 0 | original OUT, resellable=false |
| DAMAGE_RESERVED | **0** | **−** | **+** | 0 | **−** | 0 | reservation/batch/product; RELEASE(pripad.) |
| OUT_loss_sellable | **−** | **−** | 0 | 0 | po potrebi − | po potrebi − | stock/product; če RES → RELEASE pred |
| OUT_waste_damaged | **−** | **0** | **−** | 0 | 0 | 0 | damage event / batch (stanje kos=D) |
| OUT_repair | **−** | −, 0 | −, 0 | **+** | 0 | 0 | batch, note (fiz. iz skladišča) |
| IN_repair_return | **+** | ±(S/D) | ±(S/D) | **−** | 0 | 0 | batch (ocenitev → S ali D) |
| OUT_order | **−** | **−** | 0 | 0 | (ISSUE −) | 0 | order/allocation |
| production_reversal | **−** | **−** | 0 | 0 | 0 | 0 | batch, cancelId |
| cancel order | ob izdaji | (RELEASE/RETURN) | 0 | 0 | −/0 | — | orderId |

Vse vrednosti so vplivi na **stanja** (ne promet); `±` označuje, da je smer odvisna od stanja pred udogodkom
(ocenjevalni korak pri vračilu iz servisa / izguba rezerviranega). **RELEASE pred izgubo rezerviranega je
obvezen** (§2.2) — označeno »po potrebi −« v RES/B stolpcu.

---

## 6. Skladnost z obstoječo kodo (datoteka : vrstica)

| Pravilo/zahteva | Obstaja danes? | Dokaz / zahteva |
|---|---|---|
| Rezervacija brez fizičnega gibanja | ✅ | `reserveStock` :166 spremeni le `reservedQuantity`, brez StockMovement |
| Znižanje stockQuantity le ob plačilu | ✅ | `convertReservationToSale` :208 / `applyOrderStockDecrement` :91 (oboje ob potrjenem plačilu) |
| OUT ORDER ledger ob plačilu | ✅ | :226–235 (convert) in :105,124 (decrement) |
| `AVAIL` pogoj (available ≥ qty) | ✅ (a brez B) | :146 `stockQuantity − reservedQuantity ≥ qty` — **brez** `B`; ni napačno, ker umika v kodi ni — **prihodnja zahteva** |
| Idempotenca webhook (PAID guard) | ✅ | `verifyProductOrder` :1216–1220 → `alreadyProcessed` |
| Ena izdaja na naročilo (if/else) | ✅ | :1257–1270 convert → fallback decrement |
| Transakcijski vpis (stanje + ledger) | ✅ | `createStockMovement` :163–180 (+ :457–469 DELIVERY) |
| STOCKTAKE izguba (delta OUT) | ✅ | `submitStockTake` :513 (razlika prešteto − sistem) → pokriva `OUT_loss_sellable` za nezasedene kose |
| `source:"RETURN"` sprejem | ✅ (ročno) | `movementInputSchema` :33 (komentar #78 :30–32) — vračilo kot IN-RETURN; **brez** returnOfOriginId/resellable |
| `RES + B ≤ S` (Rez+Umik) | ❌ (ni B) | **prihodnja zahteva** — dodati `B` v available in obe varovalki (RESERVE/WITHDRAW) ob uvedbi umika |
| DAMAGE_RESERVED (poškodba rezerviranega) | ❌ (ni definirano) | **prihodnja zahteva** — nov dogodek + RELEASE (nič danes) |
| Popravilo / odpis tip (REPAIR/WASTE) | ❌ (ni toka) | **prihodnja zahteva** (enum + akcije) |

Skladno s strogo omejitvijo: **nič od tega ne spreminjamo**; vse, kar zgornja tabela označi kot »prihodnja
zahteva«, je del implementacije Faze 2D-1A (po uporabnikovi odobritvi), ne sprememba obstoječe kode.

---

## 7. Negativni in robni testi (15+)

| # | Test | Pričakovani rezultat | Dokaz ne-negativnosti |
|---|---|---|---|
| 1 | RESERVE bi povzročil RES+B>S (A) | zavrnjeno; noben RESERVE | `RES+qty+B≤S` lahko
| 2 | WITHDRAW bi povzročil RES+B>S (B) | zavrnjen ali omejen na A | B se ne preseže; `RES+B≤S` |
| 3 | sočasna RESERVE in WITHDRAW | row-lock; z zanesljivo ena veja | skupni invariant ohranjen |
| 4 | poškodba rezerviranega (DAMAGE_RESERVED) | RELEASE + S− / D+, P 0 | `RES+B≤S`, `RES≥qty` |
| 5 | delna poškodba rezervacije (1 od 5) | RELEASE 1; ostali 4 rezervirani | RES−=1; invariant |
| 6 | podvojen DAMAGE_RESERVED | drugi `DUPLICATE_DAMAGE` (idemKey) | brez 2× RELEASE/D |
| 7 | sočasna poškodba in izdaja | row-lock; izdaja veljavna le za nepoškodovane | po lock preveri `RES−qty≥0` + D |
| 8 | izguba prodajnega izdelka (D) | P−, S− (in RELEASE če rezerviran) | `OUT_loss_sellable` zniža S enkrat |
| 9 | odpis poškodovanega (E) | P−, D−, S nespremenjen | ni dvojnega S padca |
| 10 | poškodba → popravilo | OUT_repair: S0/D−/Rep+ ; vrne: S/D | `P=S+D+Rep` skozi |
| 11 | vračilo kosa, ki je bil umaknjen | RETURN v S; B nespremenjen (ni samodejen umik) | B+RES≤S veljaven |
| 12 | sprostitev rezervacije ob preklicu naročila | RELEASE; RES− | `RES−qty≥0` |
| 13 | podvojeni webhook | vedno `alreadyProcessed:true` (:1216) | nobene nove izdaje/OUT |
| 14 | dve sočasni izdaji zadnjega kosa | ena uspe, druga count=0 → rollback | pogojni UPDATE (`AVAIL`) |
| 15 | izdaja poškodovanega/blokiranega | zavrnjena (ni v A) | A=S−RES−B; D/B nista v A |
| 16 | poškodba že sprošĐene rezervacije | `RESERVATION_OVERFLOW` (RES=0) | RES≥qty preverba |
| 17 | izdaja rezerviranega (OUT_order) | OUT zniža P/S, ISSUE zniža RES | ISSUE −; invariant |

Vsak test velja tudi za **več proizvodnih serij** (po `batchRecordId`/*alloc*) in **več delnih vračil** iste
izdaje (`ΣRETURN≤ΣOUT`, `idemKey`). Ne vbesnem testu se noben števec ne imenuje negativno (varovalke `RES+B≤S`,
`A≥0`, `RES≥qty`, `ΣRETURN≤ΣOUT`, `stock≥qty`).

---

## 8. Končna ocena

### Kolikšne napake iz 2D-1I so odpravljene
- **#1 (simetrična varovalka):** odpravljena — določena `RES+B≤S` z enakimi pogoji na RESERVE (`RES+qty+B≤S`)
  in WITHDRAW (`RES+B+qty≤S`), s sočasnimi varovalami (§1).
- **#2 (formula S / OUT_loss_sellable):** odpravljena — ločena `OUT_waste_damaged` (0 na S) od
  `OUT_loss_sellable` (− na S), z obveznim predhodnim RELEASE za rezerviranega (§2).
- **#3 (poškodba rezerviranega):** odpravljena — atomični `DAMAGE_RESERVED` postopek z RELEASE + S/D premikom,
  P nespremenjen, append-only (§3).

### Dokončne formule (strnjeno)
`P=S+D+Rep`; `S=ΣIN_prod+ΣRETURN(resellable)−ΣOUT_order−ΣOUT_reversal−ΣOUT_loss_sellable−ΣOUT_repair(iz S)`;
`RES=ΣRESERVE−Σ(ISSUE+RELEASE+EXPIRE)`; `B=ΣWITHDRAW−ΣREACTIVATE`; **invariant `RES+B≤S`**; `A=S−RES−B`;
`I=ΣOUT_order`; `R=ΣRETURN`; `Neto=I−R`; `W=ΣOUT_waste_damaged+ΣOUT_loss_sellable`.

### Obvezne varovalke (implementacija 2D-1A)
1. `RESERVE` in `WITHDRAW` v transakciji preverita RES+B≤S (obe strani).
2. `AVAIL`/`available` upošteva `B` (`available = S − RES − B`).
3. `OUT_loss_sellable` pred izgubo rezerviranega izvede RELEASE v isti transakciji.
4. `DAMAGE_RESERVED` je atomičen (RELEASE + S/D), `idempotencyKey`.
5. `OUT_waste_damaged` ne zmanjša S.

### Zahteve za prihodnjo implementacijo (ni zdaj)
- Vpeljati `B` (StockAvailabilityEvent) in `RES+B≤S` v rezervacijsko/izdajno logiko.
- Nov `DAMAGE_RESERVED` dogodek tripa (RELEASE + S/D).
- Tokova popravila (OUT_repair / IN_repair_return) in odpis (WASTE) kot append-only.
- Dopolniti `movementInputSchema`/`createStockMovement` z `returnOfOriginId`/`resellable`/`returnDisposition`.

### Odprta vprašanja
- (a) Umik pri konfliktu RES+B>S — **zavrniti** ali **omejiti** na A (primer B (i)/(ii))? Poslovna izbira.
- (b) ali se `OUT_repair` šteje kot fizični izhod iz P ali ostane v P prek `Rep` (dokument predpostavlja
  `Rep` in `P=S+D+Rep` — kar ohranja količino; a če servis kosi »za trajno« izgublja, bi šel v W).
- (c) `OUT_loss_sellable` skozi STOCKTAKE — ali knjižiti kot razliko (že) ali ločen dogodek (zahteva odločitev).

### Status
**PASS.** Trije popravki so matematično, poslovno in transakcijsko skladni: formule konvergirajo medsebojno
(`P=S+D+Rep`, `RES+B≤S`, `A≥0`, `Neto=I−R`), primeri A–E so dokazani, sočasne grožnje so preprečene z
row-lock + pogoji + idempotency, in vsa pravila so izvedljiva na obstoječi transakcijski arhitekturi brez
podvajanja (2D-1J §6). Odprte točke (a)–(c) so **poslovne odločitve ob implementaciji**, ne blokade.

**Priporočilo:** arhitektura je **pripravljena za uporabnikovo končno odobritev Faze 2D-1A**, z razumevanjem,
da zgornje »zahteve za prihodnjo implementacijo« (§8) in odprte poslovne izbire (a)–(c) ostanejo na strani
uporabnika in se določijo ob odobritvi ali na začetku implementacije. **Ne odobrim implementacije namesto
tebe; odločitev o Fazi 2D-1A prepustim tebi.**

**Konec dopolnitve 2D-1J — nič implementirano; Faza 2D-1A ostaja NEODOBRENA, čakam tvojo izrecno odločitev.**