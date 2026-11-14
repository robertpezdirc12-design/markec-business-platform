# MARKEC — P1-D-1A — POROČILO (BLOKIRANO NA ZAŠČITI TUJEGA DELA)

> **Status: NOT IMPLEMENTED — USTAVLJENO NA §2/§6 (poseg v tuje neoddane spremembe).**
> Ciljna funkcija `applyOrderStockDecrement` v `src/app/actions/product-checkout.ts` je **v celoti del tujih
> neoddanih sprememb (added block `+`)**. Po navodilu (§2: »Če bi bilo treba spreminjati tuje neoddane spremembe…
> se ustavi in poročaj. Ne rešuj tega z obvozom«) **nisem implementiral popravka** in nisem spreminjal datoteke.
> Nič kode/sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` in tuj WIP nedotaknjeni; `markec_dev`/prod
> nedotaknjena.

---

## 1. Kaj je bilo pregledano (EXISTING-VERIFIED)

### 1.1 Git stanje
- `product-checkout.ts` je pod oznako **M** (neoddane spremembe) — velik tuj diff.
- `git diff --stat src/app/actions/product-checkout.ts` = **+572 / −81** (obsežne tuje neoddane spremembe).

### 1.2 Dejanska koda `applyOrderStockDecrement` (product-checkout.ts:91–135)
- Variant (:98–104): `tx.productVariant.updateMany` s pogojem
  `where: { id: item.variantId, stockQuantity: { gte: item.quantity } }`, data `stockQuantity { decrement }`;
  ob count≠1 → throw `STOCK_CONFLICT_VARIANT`; nato `tx.stockMovement.create` OUT ORDER.
- Product (:117–123): enako, `where: { id: item.productId, stockQuantity: { gte: item.quantity } }`,
  throw `STOCK_CONFLICT_PRODUCT`; nato OUT ORDER StockMovement.
- **Guard je `stockQuantity >= quantity` (NE `stockQuantity − reservedQuantity >= quantity`)** → potrjena P0 hiba
  iz načrta P1-D-1A.

### 1.3 Ključna ugotovitev (blokator)
- Celoten blok `applyOrderStockDecrement` (skupaj z `AVAIL`, `reserveStock`, `releaseStockReservation`,
  `convertReservationToSale`, del `createProductCheckoutSession`) se v `git diff` pojavi kot **dodani vrstice (`+`)** —
  torej so **tuje neoddane spremembe** (neodobren WIP), ne moje P1-A/B/C spremembe.
- Zato bi popravek pogoja v tem bloku = **poseg v tuje neoddane spremembe**, kar je v §2/§6 **izrecno prepovedano**
  in zahteva **ustavitev + poročilo** (ne obvoz).

---

## 2. Natančen predlagani popravek (ZA ODLOČITEV / NI IZVEDEN)

Popravek pogoja na **atomski raw-SQL način** (skladno z obstoječimi `reserveStock`/`convertReservationToSale`,
ki že uporabljajo `$executeRawUnsafe`):
- Variant: `UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - $2::int
  WHERE "id" = $1::text AND "stockQuantity" - "reservedQuantity" >= $2::int` → count≠1 → `STOCK_CONFLICT_VARIANT`.
- Product: `UPDATE "Product" ... same ...` → `STOCK_CONFLICT_PRODUCT`.
- ob uspehu: `StockMovement` OUT ORDER (nespremenjena).
- Rezervirana zaloga se ne zmanjša (guard namesto decrementa RES); org-scope = kot ostali (skupna, via kupljeni
  cart context).

**To je predlog, ker funkcija pripada tujemu WIP — ni izvedeno.**

---

## 3. Rezultati obveznih testov (NI IZVEDENO)

Ker popravek ni izveden, ob izsledku besedila testi A–E niso bili izvedeni:
- Test A (prodaja > razpol.) → **NOT VERIFIED** (popravek ni bil naložen).
- Test B (prodaja = razpol.) → **NOT VERIFIED**.
- Test C (ProductVariant) → **NOT VERIFIED**.
- Test D (sočasne prodaje) → **NOT VERIFIED** (obstoječi `updateMany stockQuantity>=qty` je atomičen v smislu cas,
  vendar ne varuje `S−RES`; in tako se ne da preveriti varnega rezultata dokler ni popravka).
- Test E (regresija) → **NOT VERIFIED** (ni spremembe).

TypeScript preverjanje in diff-review: **NI bilo spremembe → brezpredmeta**; `product-checkout.ts` je ostal
nedotaknjen (tuji diff intact).

---

## 4. Potrditev omejitev

- Nisem posega v tuje neoddane spremembe (datoteka je ostala nespremenjena).
- Nisem uporabil obvoza / ni rešitve prek druge funkcije (prepovedano §2).
- `prisma/schema.prisma` nedotaknjen; ni migracij; baza/testni podatki nespremenjeni; Git operacij nobenih;
  `einvoices.ts` nedotaknjen; `markec_dev`/produkcija nedotaknjena; Faza 2D-1A odprašena (ni del tega).

---

## 5. Končna odločitev P1-D-1A

**NOT IMPLEMENTED — USTAVLJENO (blokada na tujem WIP).**

P1-D-1A **NI PASS** : predlog je tehnično določen (atomski `S−RES` guard), a **ni bil mogoč zaradi posega v
tuje neoddane spremembe v `product-checkout.ts`**, kar navodilo izrecno prepoveduje.

**Kaj je potrebno za nadaljevanje (odločitev uporabnika):**
1. **Potrditi/odobriti poseg v `product-checkout.ts`** (ali vrstico `applyOrderStockDecrement` — katero bo treba
   spremeniti), — ali
2. Počakati, da tuji WIP v `product-checkout.ts` postane zelen (committed), nato P1-D-1A (če se več ne prekriva).

**Potrditve:** 1. Nisem spremenil kode (samo to poročilo): DA. 2. `schema.prisma` nedotaknjen: DA. 3. Ni migracij:
DA. 4. Baze/testni podatki nespremenjeni: DA. 5. Git operacije niso izvedene: DA. 6. `einvoices.ts` in tuj WIP
nedotaknjeni: DA. 7. `markec_dev`/produkcija nedotaknjena: DA. 8. P1-D-1A predlog čaka odločitev; nič
implementirano: DA.

**Ustavljam se; ne nadaljujem na P1-D-1B.** Predlog popravka čaka na novo izrecno odobritev (glede posega v tuj
WIP). Faza 2D-1A ostaja neodobrena.