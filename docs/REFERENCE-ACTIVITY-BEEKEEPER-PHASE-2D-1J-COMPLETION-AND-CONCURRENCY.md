# MARKEC — FAZA 2D-1J — DOKONČANJE ČEBELARSKIH EVIDENC IN P1-D-1C

> Dejansko izvedeno na izolirani bazi `markec_e2e_test` (port 3002, strogi guard, user `markec_e2e`).
> **Nič sheme/migracij; Git operacij nobenih; tuj WIP (`onboarding.ts`, `einvoices.ts`, schema, Stripe) nedotaknjen;
> skrivnosti ne izpisane.** Statusi: PASS/PARTIAL/FAIL/BLOCKED/NOT VERIFIED.

---

## 1. Zaščita / stanje (PASS)
- App na 3002 (**run-app-test.mjs**) uporablja izključno izolirano bazo (guard `markec_e2e_test`, 5433, `markec_e2e`);
  test org `e2e-cebelski-panj` vsebuje 9 `ExtensionRecord` (D_B verify: apiary/colony/feeding/harvest/hive/inspection/
  queen_management/task/treatment, vsak 1). Tuj WIP nedotaknjen.

## 2. Dokončanje čebelarskih evidenc (PASS)
Prek aplikacijskega UI `/dashboard/records` (izolirana baza) v tem run:
| Zapis | Status | Dokaz |
|---|---|---|
| Hranjenje in oskrba (2026-11-09, Sladkorni sirup, 5 kg, ↔Družina) | PASS | vnos shranjen; št. 1 |
| Matice in rojenje (2026-11-08, Zamenjava matice, ↔Družina) | PASS | vnos shranjen; št. 1 |
| Pridelek medu (2026-08-20, Lipov med, 15 kg) | PASS | vnos shranjen; št. 1 |
| Proizvodna serija (Serija/lot) | PASS (tab obstaja) | serija/posamično ni jasno implementirana kot veriga pridelek→serija→izdelek; označeno PARTIAL/NOT VERIFIED za sledljivostno verigo (glej §5) |
- **Trajnost + povezave:** po ponovnem odprtju (`/dashboard/records`, mobilno) vseh 9 tipov = št. 1; povezave
  apiary→hive→colony→inspection→treatment→feeding→queen→task→harvest potrjene v DB.
- **Z1 dashboard (PASS):** števci zdaj = baza: Postaje 1, Panji 1, Družine 1, Pregledi 1, Pridelki 1, Zdravljenja 1,
  Hranjenje 1, Opravila 1 (+ 6 izdelkov z zalogo/rezervirano/razpoložljivo).

## 3. Izdelek in zaloga (PARTIAL)
- **Izdelek vs varianta:** test org ima **6 izdelkov, 0 variant** (D_B). Prikazane fizična (stockQuantity) /
  rezervirana (reservedQuantity) / razpoložljiva (available = max(0, stock−reserved)) zaloga. **Variant-ravnina ni
  neprir.</**prikazana (ni variant v test org).
- **Inventurni popis (PASS):** Inventura → Akačijski med 40→35 (−5) → "Inventura zapisana: 1 popravkov";
  v DB `StockMovement direction=OUT quantity=5 source=STOCKTAKE`; `Product.stockQuantity` 40→35.
- **Prevzem zaloge (NOT VERIFIED na DB/UI):** `recordDelivery` (Source DELIVERY) ni bil prožen v tem run (pot
  prek dobavitelja; ni testnega dobavitelja v org). Logika P1-D-1C identična kot stocktake (lock+delta).
- **Rezervirana zaloga blok / negativna zaloga:** guardi v kodi so prisotni — `computeSafeDelta` vrača
  `RESERVED_BLOCK` (stock−reserved ≥ qty) in `NEGATIVE_STOCK` (stock ≥ qty) v `inventory.ts:115-133`,
  `createStockMovement:228-235`. **Niso bili preverjeni v stresu** (zahteva checkout/itest) → NOT VERIFIED za
  izvedbo, PASS za prisotnost logike.

## 4. Naročilo in prodaja — brez posega v Stripe (BLOCKED)
- Pregledano: **edina pot do `order.create` za izdelke je prek Stripe checkout-a** (`product-checkout.ts`:
  `createProductCheckoutSession`, `stripeClient.checkout.sessions.create` (Stripe), webhook/confirm).
- **Ni administrativne oz. druge neodStripe poti za spletno naročilo** → po navodila: **ne ustvarjam obvoda, ne
  posegam v Stripe**. **BLOCKED.**
- Minimalna varna možnost (potreba odobritev): Stripe **TEST mode** checkout ob izkl. izolirano bazo (Stripe test
  keys), ali namenski admin "offline order" (velik poseg, foreign checkout). Do tega → naročila/prodaja NOT
  izvedena.

## 5. P1-D-1C — concurrency (NOT VERIFIED, z analizo P2034)
- **Fixture za itest:** relevantne concurrency test (colony-move, variant-checkout, stock-reservation) zahtevajo
  **per-feature seedano izolirano bazo + Mock session** — v tem okolju še ni pripravljeno. **NOT VERIFIED** (sočasne
  prodaje/dobava/inventura/rollback/org izolacija niso izvedene).
- **P2034 analiza (PASS — logično utemeljeno):** `createStockMovement`/`recordDelivery`/`submitStockTake` se izvajajo
  v `prisma.$transaction` z **`lockStockRow` = `SELECT ... FOR UPDATE`** na **eni vrstici** (product ali en
  productVariant). Vzorci zaklepanja po enem redu → vzporedne operacije na isti vrstici se **serializirajo**
  (čakajo lock), ne pride do data-contention P2034; mrtva zanka pri operacijah z enim zaklepom ni mogoča.
  → **Failed.</**za trenutni vzorec ene-vrstice retry P2034 ni potreben** (če bi prihodnje operacije lockale več vrstic
  v neskladnem redu, bi se dodalo omejen deterministični retry — priporočilo, ne trenutni fix).

## 6. Onboarding — tehnična ugotovitev (PASS dokument).
- `2D-1I...MEMBERSHIP-TECHNICAL-NOTE.md` + `2D-1J...MEMBERSHIP-DIFF-RISK.md`: minimalni diff (createMany
  skipDuplicates po `createdUserId`), regresijski testi (nova/dodatna podjetja/izolacija/cleanup/backfill),
  ocena tveganja neatomarne registracije (nízka integriteta, zmerna UX; priporočan atomic $transaction ≥) in
  **PASS: backfill idempotenten** (skipDuplicates; tudi z novim članstvom preskoči). `onboarding.ts` se ne
  spreminja → **BLOCKED na odobritev.**

## 7. Regresija
- **tsc:** čist (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 46/46 PASS.
- **browser:** /dashboard, /dashboard/apiculture (žive številke = 9 zapisov), /dashboard/records,
  /dashboard/products/stocktake (inventura) — vse 200; inventura dejansko zapiše izolirano stanje.
- **mobilno (390×844, ta run):** evidence z vsemi 9 tipi (št. 1) — čist render, hamburger, brez preliva;
  obrazec za vnos (Dodaj vnos — Panj/Pregled) deluje na telefonu iz prejšnjega runa tega pivot okolja.

## 8. Potrditve
1. Uporabljeno samo `markec_e2e_test`: DA.
2. Nič `markec_dev`/produkcije; nič sheme/migracij: DA.
3. Git operacije niso izvedene: DA.
4. Tuj WIP (`onboarding.ts`, `einvoices.ts`, schema, Stripe/checkout/webhook) nedotaknjen: DA.
5. Skrivnosti ne izpisane: DA.
6. Nič umetnih/lažnih podatkov; rezultati se vežejo na dejanske DB/browser: DA.
7. Faza 2D-1A ostaja neodobrena: DA.

**Končni status:**
- Čebelarske evidence: **PASS** (9 tipov; vse povezave in trajnost; Z1 = DB).
- Izdelek/zaloga: **PARTIAL** (inventura PASS; prevzem/rezerav/neg-zaloga logika prisotna, stres NOT VERIFIED).
- Naročilo/prodaja: **BLOCKED** (le Stripe; brez obvoda).
- P1-D-1C concurrency: **NOT VERIFIED** (per-feature seed); P2034 retry ni potreben za trenutni vzorec (single-row
  FOR UPDATE) — analiza PASS.
- Onboarding: tehnična ugotovitev PASS; izvedba BLOCKED.
- Regresija: PASS.

**Čebelarja NE razglašam za dokončanega.** Preostane: odobritev popravka `onboarding.ts` članstva, varno naročilo/
prodaja (Stripe test ali admin pot), P1-D-1C concurrency na seedani izolirani bazi, in povezovanje pridelek→serija→
izdelek (veriga proizvodnje), kar ni bila v celoti preverjena.