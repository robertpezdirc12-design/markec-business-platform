# MARKEC — FAZA 2D-1O — DOKONČANJE TESTNI VZRELI ZALOG + NEPOSREDNA PRODAJA (brez Stripe)

> Dejansko izvedeno: (1) popravki vrzeli v 2D-1N itest, (2) nova server action `createDirectOrder` + admin UI za
> neposredno prodajo brez Stripe, (3) integracijski testi + browser E2E, vse na izolirani bazi `markec_e2e_test`.
> **Nič sheme/migracij; Git operacij nobenih; tuj WIP (`product-checkout.ts`, Stripe/checkout, itd.) NEDOTAKNJEN;
> skrivnosti ne izpisane.** Statusi: PASS/PARTIAL/FAIL/BLOCKED/NOT VERIFIED.

---

## 1. Popravki vrzeli v 2D-1N itest (tests/integration/stock-integrity.itest.ts)
| Test | Popravek | Rezultat |
|---|---|---|
| P2 | eksaktno končno stanje (ne `expected-1`); dobava vedno uspe; končno = `before+25−(OUT réussie?15:0)`; ob m.ok=true končno 20 | PASS |
| P5 | preverita se OBE operaciji (release=true, convert=true) in eksaktno končno stanje `stock=7, reserved=0` (ni delnih) | PASS |
| E0/E1/E2 | shranjena product-level zaloga pred variant OUT → dokazano nespremenjena (ni dvojnega odštevanja) | PASS |
| I2 | NOV: tuja varianta (druga org) ni uporabna za premike, ne spremeni tujega stanja | PASS |
| P3/P6 | NI testov → NE so označeni kot testirani | (niso prisotni) |

**Itest 2D-1N sedaj: 23/23 PASS** (odstranjeno `expected-1`; dodan I2; E2 dokazan z shranjenim pred-state).

## 2. Neposredna prodaja brez Stripe — implementacija (PASS)
Preverjeno: v `product-checkout.ts` obstaja le Strobscenarij checkout z `paymentMethod:"offline"` (neposredna
prodaja v checkout-u), a **ni administrativne/mualne poti** — `orders.ts` ima le list/get/status. → Implementirano:

### Nova server action: `src/app/actions/direct-sale.ts` (NOVA)
`createDirectOrder(input)`:
- org-scoped (`requirePermissionOrg("orders.manage")`);
- linije `[{productId, productVariantId?, quantity}]`; veljavne količine;
- org-scoped validacija produktov + variant (varianta mora pripadati izdelku IN tej org);
- opcijska stranka (org-scoped);
- **transakcija** `prisma.$transaction`: (a) za vsako linijo atomarno `UPDATE "P"/"PV" SET stock = stock - q WHERE
  stock - reserved >= q` (CAS, P1-D-1C — ne prodajam rezervirano, ne negativno), (b) `Order` + `OrderItem` (snapshot
  variantName/sku/price), (c) `StockMovement`(OUT, source ORDER, orderId).
- paymentMethod `offline|cash|transfer|online`; status `PAID` (neposredna prodaja je takoj plačana);
- napaka → **rollback celotne transakcije** (INSUFFICIENT_STOCK / NOT_FOUND / VARIANT_MISMATCH / TRANSACTION_FAILED).

### UI: `src/components/dashboard/direct-sale-dialog.tsx` (NOVA) + priključek v `(admin)/dashboard/orders/page.tsx`
- gumb "+ Neposredna prodaja" na `/dashboard/orders`; dialog: izdelek/različico, količino, kupca (org-scoped), način
  plačila; kliče `createDirectOrder`; ob uspehu navigira na order detail.

## 3. Integracijski testi (tests/integration/direct-sale.itest.ts — 7/7 PASS)
| # | Scenarij | Rezultat |
|---|---|---|
| 1 | uspeh: stock−q, reserved nespremenjen, Order+Items(1)+StockMovement(OUT/ORDER) | PASS |
| 2 | nezadostna zaloga → INSUFFICIENT_STOCK, brez delnih sprememb | PASS |
| 3 | prodaja variant: zniža samo varianto (ne produkt), OrderItem variant snapshot | PASS |
| 4 | dve sočasni prodaji iste zaloge (8+8 na 10) → samo ena uspe, stock 2 | PASS (serializacija) |
| 5 | napačen productId (druga org) → NOT_FOUND | PASS |
| 6 | napačna varianta → zavrnjena | PASS |
| 7 | napaka v eni liniji → rollback celotnega (veljavna linija se ne shrani) | PASS |

## 4. Regresija
- **tsc:** čist (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 65 passed.
- **itest:** `stock-integrity` 23/23 + `direct-sale` 7/7 = **30/30** na izolirani bazi.

## 5. Browser E2E (dejansko, izolirana baza, port 3002)
- **Prijava + workspace:** `cebeler.fresh@markec.test` → `/dashboard` → čebelarski workspace.
- **Izdelki:** `/dashboard/orders` prikaže 6 izdelkov (org-scoped) v dialogu.
- **Neposredna prodaja:** dialog → Akačijski med 500 g ×3, gotovina → "Neposredna prodaja zabeležena.".
- **Zaloga:** DB — Akačijski med stock 40 → **37** (znižano za 3).
- **StockMovement:** DB — `OUT/3/source ORDER`.
- **Naročilo:** `/dashboard/orders` seznam → 1 naročilo, **39,00 €**, status **Plačano**; detail → 1 izdelek,
  Akačijski med 500 g ×3 @13 € = 39 €, notes "Neposredna prodaja (brez spletnega plačila).".
- **Mobilno (390×844):** `/dashboard/orders` + dialog delujeta, ni preliva.

## 6. Opomba (ni blokirajoča)
- Konzola prikaže warning "Only plain objects can be passed to Client Components... Decimal" na `/dashboard/orders`
  — to prihaja iz **predhodnega** prenosa Order z Decimal v klient komponento (ExportOrdersButton/search), NI iz
  moje spremembe; seznam/detail deluje, a je to malo preiskano (NOT VERIFIED / obstoječe).

## 7. Potrditve
1. Uporabljeno izključno `markec_e2e_test` (guard): DA.
2. Nič sheme/migracij; Git operacij nobenih: DA.
3. Tuj WIP (`product-checkout.ts`, Stripe/checkout/webhook) NEDOTAKNJEN: DA.
4. Skrivnosti ne izpisane: DA.
5. Noben sistem naročil ni podvojen — neposredna prodaja je samostojen nov action ob obstoječem `Order`:
   DA.

**Končni status 2D-1O: PASS**
- 2D-1N vrzeli popravljene (P2/P5/E2/I2, P3/P6 ne trdim) — 23/23.
- Neposredna prodaja brez Stripe: **uspešna od začetka do konca** (create → seznam → detail → zaloga → StockMovement,
  mobilno) — 7/7 itest + browser E2E + DB verifikacija.
- Konsistentnost transakcije (Order+Items+StockMovement+stock), vzporedna serializacija, org-izolacija: PASS.

**Preostalo / blokade:** Decimel-warning na orders seznamu (obstoječe, NOT VERIFIED); sicer ni odprtih blokad v tem
obsegu.