# MARKEC — FAZA P1: BLOKADA NEPOSREDNEGA PREPISOVANJA FIZIČNE ZALOGE — POROČILO

> **Stanje: USTAVLJENO NA ZAŠČITI TUJEGA DELA — predlog posega pripravljen, čaka na odobritev.**
> P1 NI bilo implementirano. ŽeP nočene datoteke imajo **tuje neoddane spremembe** → po navodilih (§3, §13, §14)
> je bila pripravljena natančna rešitev, nato se je P1 **ustavil in počaka na izrecno odobritev**. Nič
> kode/sheme/migracij/baze ni spremenjeno; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni;
> `markec_dev`/produkcija nedotaknjena.

---

## 1. Začetno stanje (EXISTING-VERIFIED)

### 1.1 Git status / diff
- `git status` ≈ 387 vnosov; `git diff --stat` = 137 datotek, 11739 vložkov.
- **Tuje neoddane spremembe v ciljnih datotekah P1 (potrjeno):**
  | Datoteka | Status | Tuja sprememba |
  |---|---|---|
  | `prisma/schema.prisma` | M | F5.x/F2.x/einvoicing (nedotakljiva) |
  | `src/app/actions/catalog.ts` | M | F5.5.1 ‑ `deleteProductVariant` deaktivir. + `deactivated` polje v `VariantsActionResult` (vrstice ~34–38, ~199–220) |
  | `src/components/dashboard/product-form.tsx` | M | kategorijski handler (~vrstica 112) |
  | `src/app/actions/product-checkout.ts` | M | (ni P1 tarča) |
- **Čiste (brez tujih sprememb):** `src/app/actions/products.ts`, `src/lib/products/server-schema.ts`.

### 1.2 Shema (EXISTING-VERIFIED)
- `StockMovementSource` (prisma:2120–2128) = `MANUAL, ORDER, DELIVERY, STOCKTAKE, RETURN`. **`OPENING_BALANCE`
  NE obstaja** (PROPOSED, 2D-1X); `PRODUCTION` prav tako ne.
- `ProductVariant.stockQuantity` :1580, `reservedQuantity` :1582 — variant-aware.

### 1.3 Štirje absolutni zapisovalci (ciljne točke)
| ID | Funkcija | Vrstice (trenutno) | Napiše absolutno zalogo | Datoteka ima tujo WIP? |
|---|---|---|---|---|
| W8 | `createProductVariant` | catalog.ts:93 (write :128 `stockQuantity: input.stockQuantity ?? 0`) | DA | **DA** |
| W9 | `updateProductVariant` | catalog.ts:148 (write :180–181 abs.set) | DA | **DA** |
| W14 | `createProduct` | products.ts:299 (write :332 prek `...productData`) | DA | **NE** (čista) |
| W15 | `updateProduct` | products.ts:375 (write :408 prek `...productData`) | DA | **NE** (čista) |

---

## 2. Ugotovljen blokator (GATE) — poseg v tuje delo

Za **varno in POPOLNO** zaprtje P1 je nujno spremeniti:
1. **`src/app/actions/catalog.ts`** — iz `createProductVariant` (W8) in `updateProductVariant` (W9) odstraniti
   `stockQuantity` → **ta datoteka ima tujo neoddano spremembo** (F5.5.1-deactivation);
2. **`src/components/dashboard/product-form.tsx`** — odstraniti/omiliti stock field + submit → **ta datoteka ima
   tujo neoddano spremembo** (kategorijski handler).

Po §3/§13/§14: **ČE je za P1 nujna sprememba datoteke s tujimi neoddanimi spremembami, je treba pripraviti natančen
predlog posega in počakati na odobritev.** Zato je **P1 USTAVLJENO** in **ni izvedeno nobeno spreminjanje kode.** 
Noben test ni bil izveden (ni spremembe, ki bi jo testoVAL; in testi bi zahtevali pisanje v bazo, kar je
prepovedano/omejeno).

---

## 3. Natančen predlog posega (za odobritev)

### 3.1 A — `src/lib/products/server-schema.ts` (čista datoteka — predlagan poseg, kot del P1)
- Odstrani `stockQuantity: z.number().int().min(0).max(1_000_000).optional()` (trenutno :54) iz
  `productServerSchema`. `` (ne spremeni obveznih polj). 
- Učinek: `parseProductServerInput` (whitelist) ne vrne `stockQuantity` → `createProduct`/`updateProduct`
  **strukturno ne moreta** dobiti `stockQuantity` → blokada W14/W15 na **strežniški**, ne UI ravni.
- **Ne posega v tujo spremembo** (datoteka čista).

### 3.2 B — `src/app/actions/catalog.ts` (tuja WIP — PREDLOG, ne izvedba)
- `createProductVariant` (input `CreateVariantInput`, :84+): odstraniti `stockQuantity?: number` iz inputa in
  `` iz `prisma.productVariant.create` data (:128). Nova varianta nastane **brez zaloge** (0), vsak začetni
  saldo skozi **`StockMovement IN`** (controlirano).
- `updateProductVariant` (input `UpdateVariantInput`, :144): odstraniti `stockQuantity?: number` in abs.-set (:180–181)
  iz update data. Zaloge se tu NE sme spreminjati.
- **Lokacije posega se ne prekrivajo** s tujo F5.5.1-regijo (deleteProductVariant ~:199–220), vendar je poseg v
  datoteko s tujo WIP → **predlagano, zahteva odobritev**.

### 3.3 C — `src/components/dashboard/product-form.tsx` (tuja WIP — PREDLOG)
- Submit handler (:283): odstraniti `stockQuantity: fdNum(...)` iz poslanega payload-a.
- Input (:591–606): odstraniti `<Input name="stockQuantity">` iz običajnega urejanja izdelka (naredi ga ločen,
  kontroliran, skozi StockMovement operacijo). Ne briši upravljanja zaloge iz aplikacije — premakni v ločeno
  zalogovno operacijo.
- **Regija posega se ne prekriva** s tujo (kategorijski handler ~:112), ampak je v datoteki s tujo WIP →
  **zahteva odobritev**.

### 3.4 D — `src/app/actions/products.ts` (čista datoteka — predlagan poseg)
- Po spremembi server-schema (A) ni potreben dodatni »block«; morebiti dodati komentar/gard. Lahko izostane.

---

## 4. Obseg in zahteve P1 (potrjeno — kaj se bo naredilo PO odobritvi)

**Obvezna pravila (samo-P1):** organizacija, product/variant pripadnost, količina>0, `stock ≥ reserved`,
StockMovement v isti transakciji, rollback ob napakah, sočasnost (lock/retry P2034), org izolacija, variant-aware
(guard na `ProductVariant` ni samo Product). Začetni saldo → `StockMovement IN` (strateška: ne uporabiti
`MANUAL` kot `OPENING_BALANCE`; če bo potreben nov enum → **predlog, ne samodejno**). Ne predstavljaj
`MANUAL` kot `OPENING_BALANCE`. Brez lažnih povezav s stari pridelki.

**Testi (ob izvedbi):** pozitivni (brez zaloge, korak inicialne, cena se ohrani, prejem→StockMovement) in negativni
(neposredni `stockQuantity`, pod reserved, tuja org, 0/neg, rollback, concurrent). Isolirano test okolje, ne
`markec_dev`/prod.

---

## 5. Končna odločitev P1 (zdaj)

**NE IZVEDENO — USTAVLJENO NA ZAŠČITI TUJEGA DELA.**

- P1 **NI PASS/PARTIAL/FAIL** v smislu zaključene implementacije — **NOT STARTED / BLOCKED ON APPROVAL**.
- Vzrok: potrebuje poseg v `catalog.ts` in `product-form.tsx`, ki imata **tuje neoddane spremembe** (§3/§13/§14 –
  predlog pred posegom). 
- **Nič kode ni spremenjeno**; nič sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` in tuj WIP
  nedotaknjeni.
- **P2 ni odobreno** in se ne začne. Po odobritvi predloga (3.1–3.4) se P1 izvede, preveri (testi/regresija) in
  ponovno poroča PASS/PARTIAL/FAIL.

**Potrditev:** 1. Samo navedeni dokument: DA (ustvarjen). 2. Aplikacijska koda nespremenjena: DA. 3. `schema.prisma`
nedotaknjen: DA. 4. Ni migracij: DA. 5. Baza/testni podatki nespremenjeni: DA. 6. Nobena skripta nad bazo: DA.
7. Git neizvedene: DA. 8. `einvoices.ts` in tuje nedotaknjene: DA. 9. `markec_dev`/prod nedotaknjena: DA.
10. Faza 2D-1A ostaja neodobrena: DA.

**Čakam izrecno odobritev predloga posega (3.1–3.4), nato bom P1 izvedel.**

---

## P1-A — STREŽNIŠKA BLOKADA W14/W15

> Izrecno odobren poseg A. **Status: PASS** (omejena odobritev; ne pomeni celotnega P1).

### Spremenjena datoteka
- **`src/lib/products/server-schema.ts`** (eno odobreno datoteko, čista — brez tuje WIP; potrjeno `git status` pred
  spremembo).
- **Samo poseg:** iz `productServerSchema` je bila odstranjena vrstica
  `stockQuantity: z.number().int().min(0).max(1_000_000).optional(),` (prej :54). Nobena drugih
  validacijskih polj ni bila spremenjena (name/description/price/compareAtPrice/sku/barcode/brand/unit/vatRate/
  forSale/reorderPoint/trackInventory/images/categoryId/isActive/isFeatured ostaja).

### Dokaz blokade W14/W15 (EXISTING-VERIFIED)
- `parseProductServerInput` (`server-schema.ts`) uporablja `schema.safeParse(data)` in vrne `parsed.data`;
  Zod po privzetku **odstrani neznane ključe** → `stockQuantity` (ni več v shemi) se **ne pojavi** v `parsed.data`.
- `createProduct` (products.ts:313 → :319 → :332–334) in `updateProduct` (:380 → :386 → :408–411) razširjta
  `...productData` iz `parsed.data` → **`stockQuantity` ne more doseči Prisma prek te poti**.
- **Alternativne poti:** iskanje `createProduct`/`updateProduct`/`product.create`/`product.update` v `src/**` ne
  najde druge poti mimo `parseProductServerInput` (edini preostali `product.update` :507 je `toggleProductStatus`
  — samo `isActive`). → **ni alternative** (znotraj pregleda `src/**`).

### Testi (izvedeno, brez baze)
- Novi testni file **`tests/products/server-schema.test.ts`** (pure unit, čista Zod validacija, brez DB):
  - **A1** (`stockQuantity:100`) → rezultat nima `stockQuantity` ✓
  - **A2** (`stockQuantity:0`) → rezultat nima `stockQuantity` (zaloga se ne postavi 0) ✓
  - **A3** (brez stockQuantity) → običajna validacija uspe, ostala polja ohranjena ✓
  - **A4** (popoln + stockQuantity) → v rezultatu ni stockQuantity ✓
  - + whitelist preverbi (obe shemi nimata ključa) in `schema.parse` strip ✓
  - **Rezultat:** `Tests 9 passed (9)`, test file passed (vitest; Vite native-load warning je benign).
- **Typecheck:** `tsc --noEmit` — v `server-schema.ts`/`products.ts` ni napake; edina napaka v tujem
  `scripts/f631-inspect.ts` (pre-obstoječa, foreign tree) — **ni posledica P1-A**.

### Status
- **W14 (`createProduct`): BLOCKED** (ne more prejeti `stockQuantity` via server-schema path) — PASS.
- **W15 (`updateProduct`): BLOCKED** (enako) — PASS.
- **Alternative:** NOT VERIFIED vseh možnih dinamičnih (ven `src/**` nisem pregledoval; scripts ne uvažajo
  create/updateProduct). Posledice dokumentirane.
- **Preostale odprte nevarnosti:** W8/W9 (catalog) in UI (product-form) še niso blokirani — **niso del P1-A**,
  na njih se čaka ločena odobritev (P1-B/P1-C).

### Potrditve
1. Samo poseg A izveden (server-schema.ts + novi testni file). **DA.**
2. `catalog.ts` NESpremenjen. **DA.**
3. `product-form.tsx` NESpremenjen. **DA.**
4. `schema.prisma` NESpremenjen. **DA.**
5. `einvoices.ts` in tuz WIP nedotaknjeni. **DA.**
6. Git operacije niso izvedene. **DA.**
7. Produkcija in `markec_dev` nedotaknjena. **DA.**
8. P1-B/P1-C/P1-D/P2 niso izvedeni. **DA.**

**P1-A = PASS. Ustavljam se; P1-B (catalog), P1-C (form) in P2 čakajo na novo izrecno odobritev.**

---

## P1-B — strežniška zaščita W8/W9 (`catalog.ts`)

> Izrecno odobren poseg. **Status: PASS.**

### Spremenjena datoteka
- **`src/app/actions/catalog.ts`** — iz `CreateVariantInput` (:90) in `UpdateVariantInput` (:144) je bil odstranjen
  `stockQuantity?: number`; iz `prisma.productVariant.create` data je bila odstranjena vrstica
  `stockQuantity: input.stockQuantity ?? 0` (prej :128); iz `prisma.productVariant.update` data je bila odstranjena
  pogojevna širitev `...(input.stockQuantity !== undefined ? { stockQuantity: ... } : {})` (prej :180–182).

### Rezultat
- **W8** `createProductVariant`: nova varianta nastane z varno začetno zalogo 0 (Prisma `@default(0)`); noben
  neposredni `stockQuantity` se ne prejme. **PASS.**
- **W9** `updateProductVariant`: običajno urejanje variante NE more več neposredno spremeniti zaloge; ostala polja
  (name/sku/price/trackInventory/isActive) se shranjujejo nespremenjeno; org-scoped preverba nedotaknjena
  (`requirePermissionOrg` :148). **PASS.**
- Tuja F5.5.1-regija (`deleteProductVariant`, `deactivated`, `VariantsActionResult`) je **NESpremenjena** — potrjeno.

---

## P1-B-UI — odstranitev `stockQuantity` iz `product-variants-card.tsx`

> Izrecno odobren poseg. **Status: PASS.**

### Spremenjena datoteka
- **`src/components/dashboard/product-variants-card.tsx`**:
  - `emptyForm` (:56): odstranjen `stockQuantity: 0`;
  - `openEdit` setForm (:101): odstranjen `stockQuantity: v.stockQuantity`;
  - `payload` (:118): odstranjen `stockQuantity: Number(form.stockQuantity) || 0` (pošiljanje obeh, create in
    update variante);
  - JSX vnos (`<Input name="var-stock">`, :272–285): odstranjen (prejšnje ne-funkcionalno/nevarno polje).
- **Prikaz zaloge v seznamu OHRAJEN** read-only (:200 `{labels.stock}: {v.stockQuantity}`) kot informativni podatek.
- Tuj delete-toast (~:140 `result.deactivated ? ...`) je **NESpremenjen**.

---

## P1-C — odstranitev neposrednega vnosa zaloge iz `product-form.tsx`

> Izrecno odobren poseg. **Status: PASS.**

### Spremenjena datoteka
- **`src/components/dashboard/product-form.tsx`**:
  - useForm defaultValues (:150): odstranjen `stockQuantity: product?.stockQuantity || 0`;
  - `watch("stockQuantity")` (:169): odstranjen;
  - submit payload (:283): odstranjen `stockQuantity: fdNum(formData, "stockQuantity") ?? 0` → `createProduct`/
    `updateProduct` ne dobita več `stockQuantity`;
  - vnosno polje `<Input name="stockQuantity" ...>` (:591–606): odstranjeno, **nadomeščeno z read-only prikazom**
    `<p>{product?.stockQuantity ?? 0}</p>` (:589) — trenutna zaloga je vidna, ni spremenljiva.
- `ProductData.stockQuantity` (:70) ostaja (za read-only prikaz).
- Tuj category handler (~:112) je **NESpremenjen**.
- Preostale funkcije obrazca (name/description/price/category/images/sku/...) nespremenjene.

---

## Skupni rezultati P1-B/P1-B-UI/P1-C

### Testi / preverbe
- **Pure unit testi (brez DB):** `tests/products/server-schema.test.ts` (9) + `tests/inventory/stock.test.ts` (15)
  → **24 passed**, z dokazom, da ne-odobreni `stockQuantity` ne pride v `createProduct`/`updateProduct`.
- **TypeScript (`tsc --noEmit`):** v `catalog.ts`/`product-form.tsx`/`product-variants-card.tsx` **ni napake**;
  edina napaka je tuja `scripts/f631-inspect.ts:40` (pre-obstoječa, srečanje foreign), **nepovezana**.
- **Integration/DB testi (`f551-variant-checkout.itest.ts` ipd.):** **NOT VERIFIED** — pisajo v testno DB prek
  Prisma; ni zagotovljen izoliran / varsno dostopen test DB v tem okolju; po navodilu niso izvedeni (brez
  varnega okolja → NOT VERIFIED). (Ti testi semejo neposredno v Prisma, ne prek W8/W9 server action — zato jih
  removal inputa ne bi zlagal; a izvedba ni bila varna.)

### Open funkcionalnost (ni predmet te odobritve)
- **Nadzorovana začetna zalogovna operacija NI implementirana** v tej fazi (torela ni začetni saldo skozi
  `StockMovement`). Obstojeta UI-odstrani vnos in server-blokada; začetni saldo za nove variante = 0, dokler ne bo
  odobrena ločena nadzorovana zalogovna operacija. — **dokumentirano kot odprto.**

### Ohranitev tuje WIP (potrjeno)
- `catalog.ts` F5.5.1 (delete/deactivate/`deactivated` field) — ohranjeno.
- `product-variants-card.tsx` delete-toast (~:140) — ohranjen.
- `product-form.tsx` category handler (~:112) — ohranjen.
- Vsi izrezi v neprekrivajočih se regijah.

### Končne potrditve
1. Spremenjene so bile le 3 odobrene datoteke + dokumentacija: **DA** (`catalog.ts`, `product-variants-card.tsx`,
   `product-form.tsx`; `server-schema.ts` je bila P1-A, NI spremenjena v tej fazi).
2. Tuje spremembe ohranjene: **DA**.
3. `schema.prisma` nedotaknjen: **DA**.
4. Baze in migracije nedotaknjene: **DA**.
5. Produkcija in `markec_dev` nedotaknjeni: **DA**.
6. Git operacije niso izvedene: **DA** (tudi `server-schema.ts` diff je iz P1-A, nespremenjen).

### Statusna tabela
| Področje | Status |
|---|---|
| P1-B W8 | PASS |
| P1-B W9 | PASS |
| P1-B-UI | PASS |
| P1-C | PASS |
| Regresijski testi | PARTIAL (unit+tsc PASS; integration/DB NOT VERIFIED) |
| Tuji WIP | Nedotaknjen |
| P1-A | Nespremenjen |

**Ustavljam se. P1-D, nova nadzorovana zalogovna operacija, P2, G3 in G7 niso izvedeni; čakam na novo izrecno
odobritev.**

---

# P1-D-1A in P1-D-1B — operativna implementacija (izvedeno)

> Ta odsek dokumentira dejansko izvedene podfaze v okviru operativnega prevzema čebelarja (P1-D-1A in P1-D-1B).

## P1-D-1A — Zaščita razpoložljive zaloge (PASS, implementirano)

**Datoteka:** `src/app/actions/product-checkout.ts` — `applyOrderStockDecrement`.

**Sprememba:** oba guarda (ProductVariant in Product) sta bila zamenjana iz `updateMany ... stockQuantity >= qty`
na **atomsko raw-SQL** `UPDATE ... WHERE id AND "stockQuantity" - "reservedQuantity" >= qty`, s čimer se:
- direktna prodaja ne posega več v rezervirano količino;
- ob count≠1 → `STOCK_CONFLICT_VARIANT`/`STOCK_CONFLICT_PRODUCT` (zavrnitev, brez spremembe zaloge, brez
  StockMovement);
- ob uspehu `StockMovement OUT ORDER` ostaja; `reservedQuantity` nespremenjeno;
- org-scope in transakcijski kontekst ohranjena.

**Preverjanje:** `tsc` čist za file; unit testi PASS (46/46: stock 15, server-schema 9, entry-checkout 22).
DB-integration testi (prodaja nad/ob razp., varianta, sočasne): **NOT VERIFIED** (ni izoliranega test DB; guard je
stan ok, a ni bilo DB-pisa izvedenega).

## P1-D-1B — Variant-aware inventura (PASS, implementirano)

**Datoteke:** `src/app/actions/inventory.ts`, `src/app/(admin)/dashboard/products/stocktake/page.tsx`,
`src/components/dashboard/stocktake-client.tsx`.

**Sprememba:**
- `stocktakeLineSchema` (+ `productVariantId?`), `StockTakeResult` (+ `VARIANT_MISMATCH`, `adjusted.variantId`);
- `submitStockTake`: preveri varianta pripada izdelku+org, inventrira na **variantnem** nivoju (nikoli tudi na
  izdelku), delta = counted − variant.stockQuantity, update variant, STOCKTAKE StockMovement s `productVariantId`;
- UI: stran prenese aktivne variante, klient izriše eno vrstico **na varianto** (za variant-led izdelek), submit
  pošlje `productVariantId`.

**Preverjanje:** `tsc` čist; unit PASS (brez regresije). DB-integration inventure: **NOT VERIFIED** (izoliran DB ni
izveden).

## Stanje
- P1-D-1A: **PASS** (implementirano, tsc/unit čisto; DB-integration NOT VERIFIED).
- P1-D-1B: **PASS** (implementirano, tsc/unit čisto; DB-integration NOT VERIFIED).
- Preostale podfaze (1C/1D/1E), G7, nadzorna plošča, navigacija, poslovni tok, mobilni, E2E: **NI izvedene** —
  nadaljevanje v okviru operativnega prevzema, z upoštevanjem shema/migr blokad (vsaka potrebuje ločeno obravnavo
  ali odobritev).