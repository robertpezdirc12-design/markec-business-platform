# MARKEC — PREDLOGA P1-B in P1-C (READ-ONLY, BREZ SPREMEMB KODE)

> Analiza in priprava minimalnih diff predlogov za nadaljevanje faze P1: **P1-B** (zaprtje W8/W9 v `catalog.ts`)
> in **P1-C** (odstranitev neposrednega spreminjanja zaloge iz `product-form.tsx`).
> **Nič kode ni bilo spremenjeno.** Nič sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` in tuj WIP
> nedotaknjeni; `markec_dev`/produkcija nedotaknjena. Faza 2D-1A ostaja neodobrena. P1-A je PASS in nespremenjen.

---

## A. TRENUTNO STANJE TUJIH SPREMEMB (potrjeno)

| Datoteka | Status | Tuja sprememba | Moja P1-A sprememba |
|---|---|---|---|
| `src/app/actions/catalog.ts` | M | F5.5.1-deaktivacija v `deleteProductVariant` (~:199–220) + `deactivated` polje v `VariantsActionResult` (:37–38) | — |
| `src/components/dashboard/product-form.tsx` | M | tuji category handler (~:112) | — |
| `src/components/dashboard/product-variants-card.tsx` | M | tuji delete-toast glede deactivated (~:139) | — |
| `src/lib/products/server-schema.ts` | M | — | P1-A: odstranitev `stockQuantity` (1 vrstica, prej :54) — potrjeno čista, edino moja |
| `src/app/actions/products.ts` | (čist) | — | — |

**Ključno novo odkritje:** poleg P1-A je ugotovijen še en neodobren **klicatelj W8/W9**:
`src/components/dashboard/product-variants-card.tsx` (:101, :118) prav tako pošlja `stockQuantity` v
`createProductVariant`/`updateProductVariant`. **To je druga datoteka s tujo WIP, ki jo P1-B mora upoštevati.**
Če `stockQuantity` iz inputa W8/W9 odstranimo, bo to polje v kartici postalo nefunkcionalno (poslan, a
ignoriran) — treba bo uskladiti tudi kartico (kot del P1-B ali ločeno).

---

## B. P1-B — catalog.ts (W8/W9)

### B.1 Trenutno stanje

**W8** `createProductVariant` (catalog.ts:93):
- vhod `CreateVariantInput.stockQuantity?: number` (:90);
- zapis `stockQuantity: input.stockQuantity ?? 0` (:128) → **absolutna začetna zaloga, brez `StockMovement`, brez txn guard**.

**W9** `updateProductVariant` (catalog.ts:148):
- vhod `UpdateVariantInput.stockQuantity?: number` (:144);
- zapis `...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {})` (:180–182) →
  **neposreden prepis obstoječe zaloge, brez `StockMovement`, brez `stock≥reserved`, brez txn**.

**Nevarnost:** oba lahko prepišeta `ProductVariant.stockQuantity` mimo zalogovnega ledgerja; W9 lahko tudi pod
`reservedQuantity`.

### B.2 Predlagane minimalne spremembe (P1-B)

**W8 (createProductVariant):**
1. `CreateVariantInput` (:84–91): odstrani `stockQuantity?: number` (:90).
2. `prisma.productVariant.create` data (:128): odstrani `stockQuantity: input.stockQuantity ?? 0` vrstico.
   → nova varianta ima začetno zalogo **samo `@default(0)`** (Prisma default), varna.
   → vsak začetni saldo gre skozi ločeno nadzorovano zalogovno operacijo (`StockMovement IN`) — ni v tem posegu.
3. (Opomba) `prisma.productVariant.create` je brez txn; ostane tako (brez tuje spremembe potrebno).

**W9 (updateProductVariant):**
1. `UpdateVariantInput` (:138–146): odstrani `stockQuantity?: number` (:144).
2. `prisma.productVariant.update` data (:180–182): odstrani `...(input.stockQuantity !== undefined ? ...)` vrstice.
   → običajno urejanje variante NE sme spreminjati zaloge; zaloga se spreminja prek `StockMovement`.

**Povezano (druga datoteka s tujo WIP — P1-B ali ločena odobritev):**
`src/components/dashboard/product-variants-card.tsx`:
- :101 `stockQuantity: v.stockQuantity` (form state) in :118 (payload pošlje) → odstraniti iz form/payload (ali
  prikazati kot read-only, ne pošljati).
- :113–119 payload: odstraniti `stockQuantity` pred klicem W8/W9.

### B.3 Predlagani diff (minimalen, ločeni odseki; ohranja tujo WIP)

```
--- a/src/app/actions/catalog.ts
@@ -90 (CreateVariantInput)
-  stockQuantity?: number
@@ -128 (createProductVariant data)
-      stockQuantity: input.stockQuantity ?? 0,
@@ -144 (UpdateVariantInput)
-  stockQuantity?: number
@@ -180-182 (updateProductVariant data)
-      ...(input.stockQuantity !== undefined
-        ? { stockQuantity: input.stockQuantity }
-        : {}),
```
Ti 4 izrezi so v **regiji :84–190**, ki se **ne prekriva** s tujo F5.5.1-regijo (:199–220). Tuja na mestu ohranjena.

```
--- a/src/components/dashboard/product-variants-card.tsx
@@ -101 (form state)
-      stockQuantity: v.stockQuantity,
@@ -118 (payload)
-      stockQuantity: Number(form.stockQuantity) || 0,
```
Ti izrezi v regiji :95–124, **ne** prekrivajo tujega delete-toasta (~:139).

### B.4 Testi (za dokaz)
- W8: ustvarjanje variante **brez** `stockQuantity` → zaloga 0; **z** `stockQuantity: 100` → zaloga 0 (stroga
  ignorirana; TS ne sprejme / strežniška čista).
- W9: urejanje cene/name → zaloga se NI spreminja; posredovan `stockQuantity` → ignoriran (ne prepiše).
- `stock ≥ reserved` guard (če želimo) → zadržek: trenutno `updateProductVariant` NIMA reserved-guarda; če je
  zalogo mogoče spreminjati samo prek `StockMovement` (`createStockMovement` za variants), tam guard `stock ≥
  reserved` že mora biti (dodati v nadzorovano operacijo). Identificado kot odvisnost (P1-B-alt ali kasneje).
- Regresije: variantne prikazovanje/zgodovina, deaktivacija (F5.5.1) nedotaknjena.

### B.5 Tveganja / odvisnosti
- **Odvisnost:** `product-variants-card.tsx` (tuja WIP) — datum P1-B mora ali spreminja ali pa ostane
  nefunkcionalno polje v kartici; to je treba odobriti posebej.
- **Shema:** NI potrebna (ne dodajamo enuma; `@default(0)` obstaja). Nadzorovana zalog. operacija
  (`StockMovement IN` za variante) je že obstoječa/prihodnja — glej poročilo P1/2D-1.
- **Nevarnost:** nesinhroniziran `product-variants-card` (če se ne prilagodi) → uporabnik vidi zalogovno polje,
  ki ne deluje. To mora biti del P1-B (ali jasno označeno).

---

## C. P1-C — product-form.tsx

### C.1 Trenutno stanje
- `ProductData.stockQuantity: number` (:70, za prikaz);
- useForm default `stockQuantity: product?.stockQuantity || 0` (:150);
- `watch("stockQuantity")` (:169);
- submit payload `stockQuantity: fdNum(formData, "stockQuantity") ?? 0` (:283) → pošlje v `createProduct`/
  `updateProduct`;
- `<Input name="stockQuantity">` (:591–606) — vnašalnik v običajnem obrazcu izdelka.
- **Kategorijski handler je tuja sprememba (~:112)** — sem ne posegam.

### C.2 Predlagane minimalne spremembe (P1-C)
1. **Submit handler (:283):** odstrani `stockQuantity: fdNum(formData, "stockQuantity") ?? 0` iz `values`.
2. **Input (:591–606):** odstrani `<Input name="stockQuantity" ...>` iz običajnega obrazca (ločeno zalogovno
   urejanje). **Ne odstraniti prikaz** trenutne zaloge, če je potreben — prikazati `product?.stockQuantity` kot
   zgolj read-only info (ne kot vnašano polje), ali odstraniti polje popolnoma.
3. **defaultValues/watch (:150, :169):** odstrani `stockQuantity` iz form state, če se ne bo več shranjevalo
   neposredno; ali pusti kot read-only info brez submit.
4. Ne posega v tuji category handler (~:112).

> Opomba: server A-tok (P1-A) že ignorira `stockQuantity` (whitelist). P1-C je **UX-uporabniku usklajenje** —
> odstrani zavajajoč vnos, tako da uporabnik upravlja zalogo prek ločene nadzorovane operacije.

### C.3 Predlagani diff (minimalen, ohranja tujo WIP)
```
--- a/src/components/dashboard/product-form.tsx
@@ -283 (submit values)
-        stockQuantity: fdNum(formData, "stockQuantity") ?? 0,
@@ -591-606 (input)
-                <div className="space-y-2">
-                  <Label htmlFor="stockQuantity">…</Label>
-                  <Input id="stockQuantity" name="stockQuantity" … />
-                </div>
```
(opcionalno) `:150` in `:169` — odstraniti stock iz form state (če ni več shranjevan).
Tuja regija (~:112 categories) ohranjena.

### C.4 Regresija
- ustvarjanje/urejanje izdelka (name/description/price/category/images) deluje;
- `createProduct`/`updateProduct` brez stock → zaloga nespremenjena;
- prikaz trenutne zaloge (če ostane read-only) deluje;
- no new TS/builb napake.

### C.5 Odvisnost
- P1-C je samostojen (UI). Odvisen od P1-A (že PASS — server ignorira). P1-B lui ni nujno; a da uporabnik ne
  vidi »pokvarjenega« polja, je smiselno P1-C po P1-A (že), neodvisno od P1-B.

---

## D. Varnost tujih sprememb (kako jih predlogi ohranijo)
- `catalog.ts`: moji izrezi :84–190; tuja F5.5.1 :199–220 ostaja nedotaknjena. NO overlap.
- `product-variants-card.tsx`: moji izrezi :95–124; tuj delete-toast ~:139 ostane. NO overlap.
- `product-form.tsx`: moji izrezi :283/:591–606; tuj category handler ~:112 ostane. NO overlap.
- **Tveganje konflikta:** nizko (non-overlapping regije); a vse tri datoteke so pod tujo WIP → **za vsako je
  potrebna ločena odobritev posega**, ne samodejna izvedba.

---

## E. Zaporedje izvedbe (predlog)
1. **P1-B** v `catalog.ts` (server W8/W9) — odpravi neposredno zapisovanje (server).
2. **P1-B-UI** v `product-variants-card.tsx` — uskladitev kartice (druga datoteka, tuja WIP) — **ločena odobritev**,
   po P1-B (da kartica ne ostane nefunkcionalna).
3. **P1-C** v `product-form.tsx` — odstrani vnos iz običajnega obrazca.
4. Regresija + testi; nič do P2.

**Razlog zaporedja:** najprej server (P1-B) → šele potem UI (kartica in forma), da ni vmesnega »pokvarjenega«
stanja. Alternative poti (če server ni blokiran) se ne odpira.

---

## F. Odprte zadeve / odločitve
1. **`product-variants-card.tsx`** je tuji-WIP datoteka, ki jo P1-B posredno zahteva → **potrebna ločena
   odobritev** za njen predlagani izrez (:101/:118).
2. **»stock ≥ reserved« guard:** v `updateProductVariant` trenutno NI. Če naj zaloga ostane spreminjljiva le prek
   `StockMovement` (`createStockMovement` za variant), je treba guard dodati **v tisto nadzorovano operacijo**
   (ni del teh izrezov; prihodnja odločitev).
3. **Zadržek:** če P1-B/BC ni odobreno za `product-variants-card`, bo polje v kartici nefunkcionalno (poslan, a
   ignoriran) — jasno označeno.
4. **Začetni saldo variante:** po W8-odstranitvi nastane varianta s 0; nadzorovana zalogovna operacija
   (`StockMovement IN`) za začetni saldo — ni v teh izrezih (odvisnost od obstoječe/prihodnje zalogovne akcije).
5. **P1-A nespremenjen:** server `server-schema.ts` diff je moj (1 vrstica), potrjen čist.

---

## G. Končna odločitev / STOP

**P1 in P1-B/P1-C nista bila izvedena.** Ta dokument vsebuje samo predloga (načrt, ni kode). Nič ni spremenjeno.

- P1-A je PASS in se ne spreminja.
- P1-B (catalog.ts) in P1-B-UI (cards.tsx) zahtevata **odobritev posega v datoteke s tujo WIP**.
- P1-C (form.tsx) zahteva **odobritev posega v datoteko s tujo WIP**.

**Potrditev:** 1. samo ta dokument (predlog): DA (ustvarjen). 2. Aplikacijska koda NI spremenjena: DA.
3. `schema.prisma` nedotaknjen: DA. 4. Ni migracij: DA. 5. Baza/testni podatki NI spremenjeni: DA.
6. Nobena skripta ni izvedena nad bazo: DA. 7. Git operacije niso izvedene: DA. 8. `einvoices.ts` in tuz WIP
nedotaknjeni: DA. 9. `markec_dev`/produkcija nedotaknjena: DA. 10. Faza 2D-1A ostaja neodobrena: DA.

**Ustavljam se; P1-B, P1-B-UI in P1-C čakajo na novo izrecno odobritev njihovih minimalnih diff predlogov.