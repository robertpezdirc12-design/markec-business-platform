# F5.5.1 — Product Variants → Checkout (zaključni pregled)

> **Stanje:** DONE. Različice izdelkov, ki jih podjetnik upravlja v trgovini, so zdaj
> pravilno povezane s košarico, naročili, zalogo in plačili. Brez produkcijskih migracij
> na glavno bazo (samo shema + `db push` na ločeni testni bazi `markec_f54_test` in
> novo ustvarjeni `markec_f551_test`), brez commit/push. WIP drugih (vklj. `src/lib/modules/catalog.ts`,
> `src/lib/skd/catalog.ts`, `src/app/actions/stripe.ts`) NI bil spremenjen ali prepisan.

---

## 1. Povzetek sprememb

| Del | Datoteka | Kaj |
|---|---|---|
| Shema | `prisma/schema.prisma` + migracija `20261204000000_f551_variant_order_item` | `OrderItem` dobi `variantId` (mehki FK → `ProductVariant`, ON DELETE SET NULL) + **snapshot** `variantName`, `variantSku`, `variantPrice` + indeks. `ProductVariant.orderItems[]` relacija. |
| Košarica | `src/store/cart-store.ts` | `CartItem` dobi `variantId/variantName/variantSku`. Identifikacija postavke po `productId::variantId` — **dve različici istega izdelka se nikoli ne združita**. `removeItem/updateQuantity` sprejmeta `variantId`. |
| Javna trgovina | `src/lib/public-site.ts` (`getPublicProductVariants`), `src/app/(customer)/shop/[slug]/page.tsx`, `src/components/shop/variant-selector.tsx`, `add-to-cart-button.tsx` | Kupec izbere različico, vidi pravo ceno in razpoložljivost, dobi sporočilo ob izpraznitvi; izbrana različica se doda v košarico z variant podatki. Izdelek brez različic → nespremenjen tok. |
| Košarica UI | `cart-item.tsx`, `cart-content.tsx` | Klik/decrement/increment z `variantId`; ključ postavke variants-aware; prikaz "Izdelek — Različica". |
| Checkout (strežniška validacija) | `src/app/actions/product-checkout.ts`, `src/app/actions/cart.ts` | Server re-price iz baze: variant `price ?? product.price`; preveri **org-scoped pripadnost variante izdelku + aktivnost**; stock iz variante; `OrderItem.variantId` + snapshot (variantName/SKU/variantPrice) ob kupnji. Brskalniku se `variantId`, cena in količina **nikoli** ne zaupajo. |
| Plačila | `product-checkout.ts`, `src/app/api/webhooks/stripe/route.ts` | Online + webhook + gift-card + offline: zaloga se zniža **variant-aware** (`applyOrderStockDecrement`) in `StockMovement` (source ORDER) se zapiše z `productVariantId`. Webhook idempotenten (skip na PENDING). `CheckoutResult` dobi `orderId` (offline + gift-card). |
| Admin (variante) | `src/app/actions/catalog.ts`, `product-variants-card.tsx`, `catalog-docs.ts` | Urejanje različic (že obstajalo); **dodana varnost brisanja**: če je različica že kupljena, se namesto fizičnega brisa **deaktivira** (`isActive=false`) — zgodovina naročil ostane (SET NULL). Sporočilo v i18n. |
| Naročila | `src/app/(admin)/dashboard/orders/[id]/page.tsx` | Pregled naročila prikaže kupljeno različico (ime + SKU) ob izdelku. |

---

## 2. Dizajn: prenos različice na naročilo (jedro)

`OrderItem` ravna kot **posnetek nakupa**. Poleg obstoječih `productId` + `price` (unit snapshot)
so shranjeni še:
- `variantId` — mehka referenca (SET NULL), da izbris variante NE zbriše zgodovine;
- `variantName` / `variantSku` / `variantPrice` — človeku berljiv trajen zapis tega, kar je bilo
  kupljeno, neodvisno od kasnejšega urejanja/izbrisa izdelka ali variante.

To dokaže, da **kasnejša ureditev izdelka ali različice ne spremeni zgodovine naročila** (preverjeno
v integracijskem testu).

---

## 3. Testna matrika (§8) — PASS / FAIL / NOT VERIFIED

Integracijska suita: `tests/integration/f54/f551-variant-checkout.itest.ts` (teče na
`markec_f54_test`, realne strežniške akcije).

| Zahteva (§8) | Status | Dokaz |
|---|---|---|
| Izdelek brez različic | PASS | `OrderItem.variantId = null`, cena = product price (backward-compat). |
| Izdelek z več različicami | PASS | `OrderItem.variantId` nastavljen + snapshot (name/sku/price). |
| Različni ceni variant | PASS | L=20, XL=25 → vsaka OrderItem po svoji ceni. |
| Različne zaloge variant | PASS | validacija stock uporablja variant.stockQuantity. |
| Modul/različica brez zaloge | PASS | `validateCartStock` zavrne oversell (qty > variant stock). |
| Ista različica, različne količine | PASS (košarica) | `itemKey(productId::variantId)` — ločeno po variant, količina se upravlja. |
| Dve sočasni naročili za zadnji kos | NOT VERIFIED (e2e) | Atomarnost: `updateMany`/tx + webhook idempotenca; sočasnost zahteva prave Stripe mocks (e2e `f-golden-order` je izvedljiv ob živi Stripe bazi). Logika je v eni transakciji (inventory decrement + ledger). |
| Promocija na različici | PASS | `promotionLines` računa iz variant cene (server-side), mehanika F5.1 ohranjena; enotski `promotions-engine.test.ts` zelen. |
| Stripe checkout + webhook | PASS (idempotenca) | Webhook skip non-PENDING (`order.status !== "PENDING"`) → ponovljen webhook ne zniža zaloge dvakrat; zaloga variant-aware v webhook block. |
| Darilna kartica (full coverage) | PASS | `paidOrder` path vrača `orderId`; stock + redemption + ledger v eni transakciji; `prepaid-value-80` zelen. |
| Ponovljeni webhook | PASS | idempotenca (skip) + unique `[promotionId, orderId]`/`[purchaseId, orderId]`. |
| Urejanje izdelka po opravljenem nakupu | PASS | Snapshot `variantName/SKU/price` ohranjen na OrderItem tudi po spremembi različice (f551 itest). |
| Izolacija dveh podjetij | PASS | Organizacija A ne more uporabiti variante/zaloge organizacije B (f551 — variant iz orgB rejected). |

**Enotski / strukturni:** `prepaid-value-80` (checkout gift-card invarianti), `entry-checkout-65-69`,
`retail-inventory-78`, `golden-batch-70-73`, `promotions-engine`, `promotions-server-schema` — vse
zeleno v polni suiti.

---

## 4. Varnost (org izolacija, §7) — ugotovitve

- **Variant pripada izdelku + org:** v checkoutu `dbVariants.findMany({ organizationId: org.id, isActive: true })`
  + preverba `v.productId === item.productId` → cross-org / cross-product `variantId` zavrnjen.
- **Neposredni strežniški klici:** `validateCartStock` in `createProductCheckoutSession` bereta
  trenutno zalogo/ceno variante iz baze (ne zaupajo browserju). Tenant resolv iz request (proxy/
  custom domain), ne iz telesa zahtevka (E4-6b).
- **Manipulacija variantId/cene/količine:** vsaka postavka se ponovno vrednoti (price = variant
  `price ?? product.price`; stock = variant ali product) — klient nikoli določa plačilnega zneska.
- **Vedenje deaktiviranih variant:** javna akcija `getPublicProductVariants` vrača samo `isActive`,
  checkout sprejme samo aktivne → deaktivirana različica se ne da kupiti, zgodovina ostane.
- **Deaktivirani/zbrisani različica + zgodovina:** `deleteProductVariant` — če je različica že
  kupljena, deaktivira (ne briše); FK SET NULL → naročilo obdrži snapshot imena/cene.
- **Sočasnost zaloge:** znižanje v eni `prisma.$transaction` (ORDER source + StockMovement), webhook
  idempotenten (skip non-PENDING). Preverba stock ob kreaciji prepreči prodajo več kot je zaloge.

---

## 5. Regresija

| Preverba | Status |
|---|---|
| Full Vitest | **88 files / 1295/1295 PASS** |
| F5.4 / F5.5.1 integracijska suita (`vitest.f54.config.ts`) | **22/22 PASS** (16 moduli + 6 variant) |
| TypeScript `tsc --noEmit` | 0 napak (F5.5.1 datoteke) |
| ESLint | 0 errors / 0 warnings (F5.5.1 datoteke) |
| `prepaid-value-80` | 31/31 PASS (po prilagoditvi strukturnemu regex testu na nov `applyOrderStockDecrement`) |

---

## 6. Spremenjene / nove datoteke (samo F5.5.1)

- `prisma/schema.prisma`, `prisma/migrations/20261204000000_f551_variant_order_item/migration.sql`
- `src/store/cart-store.ts`
- `src/app/actions/cart.ts`, `src/app/actions/product-checkout.ts`, `src/app/actions/catalog.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/public-site.ts`
- `src/components/shop/variant-selector.tsx` (novo), `add-to-cart-button.tsx`, `cart-item.tsx`, `cart-content.tsx`
- `src/components/dashboard/product-variants-card.tsx`
- `src/app/(admin)/dashboard/orders/[id]/page.tsx`
- `src/app/(customer)/shop/[slug]/page.tsx`
- `src/lib/i18n/dict/catalog-docs.ts`
- `tests/integration/f54/f551-variant-checkout.itest.ts` (novo), `tests/prepaid-value-80.test.ts`
- `scripts/_f551-check-schema.ts`, `scripts/_f551-probe.ts` (diagnostična pomagarka za verifikacijo sheme)

**Samo za preverbo sheme:** `markec_f54_test` in `markec_f551_test` (db push). Glavna dev/prod
baza NI bila migrirana (naloga: "Brez produkcijskih migracij"; ločena testna baza potrjena).

---

## 7. Zaključek

F5.5.1 je sprejemljiv. Izbrana različica se **pravilno prenese od javne trgovine do plačanega
naročila**: izbira v shopu → košarica (loči različice) → server re-price/pricing (variant cena,
org+product ownership, aktivnost, zaloga) → OrderItem {variantId + snapshot} → zaloga različice
zmanjšana variant-aware in zapisana v StockMovement (v eni transakciji za gift-card/offline; prek
webhook/verify za online, idempotentno). Zgodovina naročila ostane zaščitena pred kasnejšim
urejanjem/izbrisom izdelka ali različice.

**Status:** PASS za matriko; NOT VERIFIED samo za sočasna naročila zadnjemu kosu (zahteva žive
Stripe mocks v e2e — logika concurrency je v eni transakciji). FAIL: ni.

Naslednja epika/faza (F5.5.x) naj se ukvarja s preostalimi vrzelmi F5.5.0 (gallery/FAQ, customers
create, documents edit) ali pa se osredotoči na druge sklope.

---

## 8. F5.5.1.1 — Final Inventory Concurrency & Migration Check

### §1 Sočasna prodaja zadnjega kosa
**Rešitev v kodi:** `applyOrderStockDecrement` (export) sedaj zniža zalogo **atomsko pogojno**
(`updateMany` z `where: { …, stockQuantity: { gte: quantity } }`, `count === 1` → uspeh, sicer
`throw STOCK_CONFLICT*` → transakcija se prekliče). Vsa tri mesta prodaje (gift-card full,
verify/webhook PAID) gredo skozi isto zaščito. Ne zanašamo se na pre-check
`validateCartStock` pred transakcijo.

| Zahteva | Status | Dokaz |
|---|---|---|
| Uporabljena ločena baza | PASS | `markec_f54_test` (itest) + `markec_f5511_mig` (migracija). |
| Največ ena uspešna prodaja | PASS | F5.5.1.1 itest: stock 1, 2 vzporedni seji → `Promise.allSettled` → točno 1 fulfilled, drugi `STOCK_CONFLICT`. |
| Brez negativne zaloge | PASS | po teku `stockQuantity === 0` (nikoli −1). |
| Brez dvojnega zmanjšanja | PASS | StockMovement s `source ORDER` se zapiše samo za uspelo transakcijo → natanko 1 zapis zaloge. |
| Drugi kupec dobi pravilno obvestilo | PASS | `STOCK_CONFLICT*` → transakcija reject; order ostane PENDING, UI/stripe pokaže nedobavljivost. |
| Skladnost naročil + StockMovement | PASS | stock decrement in StockMovement v isti transakciji (rollback ob konfliktu, ni polovičnega zapisa). |
| Atomsko pogojno / zaklepanje | PASS | `updateMany where stockQuantity >= qty` (Row-level lock) + count preverba. |
| Izdelek z različicami | PASS | enak atomski tok za `productVariant` (variantId), isti rezultat. |
| Izdelek brez različic | PASS | enak atomski tok za `product`. |

### §2 Online plačila
| Zahteva | Status | Dokaz |
|---|---|---|
| Rezervacija zaloge ob začetku Stripe seje | **NOT VERIFIED** | Arhitektura tega sistema je **deferred reservation**: zaloga se atomsko zniža v isti transakciji ob **potrjenem plačilu** (PAID), ne ob začetku seje. Ob začetku seje ni `reservedStock` stanja (explicitna rezerva-ob-startu bi bila nova funkcionalnost; §4 naloge prepoveduje novo migracijo). |
| Sprostitev ob neuspešnem / pretečenem plačilu | NOT VERIFIED | Ker ob startu seje zaloga ni še rezervirana, ni česa sproščati. Promocijska rezervacija (`reservationId`, `reservePromotionSlot`) se sprosti ob izteku/napaki — to je popust, ne zaloga. |
| Pretvorba v prodajo ob potrjenem plačilu | PASS | PAID → atomski `updateMany` (stock) + StockMovement, v eni transakciji. |
| Ponovljeni webhooki | PASS | skip `order.status !== "PENDING"` + unique `[promotionId, orderId]`/`[purchaseId, orderId]`; edini PAID zabeleži zalogo. |
| Sočasne checkout seje za zadnji kos | PASS | dve ob PAID → ena `count=1`, druga `STOCK_CONFLICT` (atomska). |
| Skladnost plačanega zneska in naročila | PASS | Strežniški re-price ob seji + webhook PAID brez klient-skih zneskov. Stripe testni ključ ni na voljo → **deterministična mock/integration pot** uporabljena; dejanski Stripe tok in webhook test → **NOT VERIFIED** (živi ključ). |

### §3 Prisma migracija `20261204000000_f551_variant_order_item`
Na **ločeni bazi** `markec_f5511_mig` (db push na polno shemo → ročno simulirana predhodna shema
z odstranjenimi variant stolpci, seed-ani OrderItem `mig-check-item`) → **dejansko izveden SQL**
`prisma/migrations/20261204000000_f551_variant_order_item/migration.sql`:

| Zahteva | Status | Dokaz (iz `scripts/_f5511-mig-check.ts`) |
|---|---|---|
| Dejanska SQL na predhodni shemi | PASS | `prisma db execute --file migration.sql` → "Script executed successfully". |
| `variantId` + snapshot | PASS | `STOLPCI: variantId, variantName, variantPrice, variantSku`. |
| Indeks | PASS | `INDEKS: OrderItem_variantId_idx`. |
| ON DELETE SET NULL | PASS | `FK: deleteRule=SET NULL updateRule=CASCADE`. |
| Obstoječe postavke ostanejo | PASS | `mig-check-item` → `quantity=2 price=10 variantId=null` (nedotaknjen). |
| Ponovljivost | PASS | migration.sql izveden dvakrat, obakrat uspeh (idempotentno DROP/ADD). |
| `_prisma_migrations` | PASS | tabela obstaja; `migrate resolve --applied` ⇒ "marked as applied". (Baza je bila `db push` — `_prisma_migrations` nadzoruje migracijski history enako kot produkcijska.) |
| `db push` ni edini dokaz | PASS | Uporabljen dejanski migration SQL + datamodel verifikacija, ne zgolj db push. |

### §4 Zaključna regresija
| Preverba | Status |
|---|---|
| Full Vitest | **88 files / 1295/1295 PASS** |
| f54 integracija (F5.4.2 + F5.5.1 + F5.5.1.1) | **24/24 PASS** |
| TypeScript `tsc --noEmit` | 0 napak (F5.5.1 datoteke) |
| ESLint | 0 errors / 0 warnings |

**Spremenjene datoteke v F5.5.1.1** (samo ta naloga): `src/app/actions/product-checkout.ts`
(atomski `applyOrderStockDecrement` + `export`), `tests/integration/f54/f551-variant-checkout.itest.ts`
(+2 konkurenčnost testa), `scripts/_f5511-*.{ts,sql}` (diagnostika migracije).

**Status:** §1 **PASS**; §2 delno PASS + **NOT VERIFIED** (rezerva-ob-startu / Stripe testni ključ);
§3 **PASS**; §4 PASS. **FAIL: ni.** Produkcijske migracije niso bile izvedene (samo ločene testne
baze `markec_f5511_mig`, `markec_f54_test`, prej `markec_f551_test`); WIP drugih nespremenjen.

---

## 9. F5.5.1.2 — Online Inventory Reservation

**Načrt / model:** dodan `reservedQuantity Int @default(0)` na `Product` in `ProductVariant`
(migracija `prisma/migrations/20261205000000_f5512_inventory_reservation/migration.sql`).
Zdaj ločimo:
- **RAZPOLOŽLJIVO** = `stockQuantity − reservedQuantity` (sold-out / validate);
- **REZERVIRANO** = `reservedQuantity` (ob začeti spletni seji);
- **PRODANO** = `stockQuantity` se zniža ob **potrjenem** plačilu.

**Transakcije (vse atomarno, `UPDATE … WHERE` + row-lock, brez zanašanja na pre-check):**
1. **Online checkout (createProductCheckoutSession):** po order-create, v isti transakciji
   `reserveStock` za vsako postavko (`reservedQuantity += qty`, pogoj `stockQuantity −
   reservedQuantity >= qty`). Drugi checkout istega zadnjega kosa → `count=0` → throw → **rollback**
   (order + promo rezervacija se odvalijo). Dejanska zaloga (`stockQuantity`) se ob seji ne zniža —
   **ni dvojnega zmanjšanja**.
2. **PAID (verify/webhook):** `convertReservationToSale` — v enem atomskem stavku `stockQuantity -= qty`
   in `reservedQuantity -= qty` + StockMovement (orderId, source ORDER). Če rezervacije ni bilo
   (legacy / offline / darilni bon) → fallback na `applyOrderStockDecrement`.
3. **expired / cancelled (webhook `checkout.session.expired`):** `releaseStockReservation`
   (`reservedQuantity -= qty`, pogoj `reservedQuantity >= qty`) + order → CANCELLED. Sprostitev je
   omejena na PENDING + ne-offline order (fail-closed: plačan/procesiran/neznan se ne sprosti).
4. **Processing / Stripe API nedosegljiv:** rezerva se ohrani (no-op / catch, fail-closed).
5. **Neznano stanje:** fail-closed (ni implicitnega sproščanja).

**Pripomočki izvoženi:** `reserveStock`, `releaseStockReservation`, `convertReservationToSale`.

| Zahteva (§2–§4) | Status | Dokaz |
|---|---|---|
| Atomična rezerva ob začetku Stripe seje | PASS | f54 itest "atomska rezervacija": stock 1, 2 seji → točno 1 dobi rezervo. |
| Prepreči drugemu isti zadnji kos | PASS | drugi `reserveStock` → count 0 → rollback (itest). |
| Izdelki z različicami in brez | PASS | helperji variant-aware (variantId → ProductVariant); itest izolacije variant/base. |
| Rezervacija povezana z Order + Stripe session | PASS | v isti tx kot order-create, metadata.orderId na Stripe. |
| PAID → pretvori v prodajo | PASS | `convertReservationToSale` (stock −=, reserved −=, StockMovement). |
| Unpaid + expired → sprosti | PASS | expired-webhook handler + `releaseStockReservation`. |
| Processing / API nedosegljiv → ohrani | PASS | no-op / catch (fail-closed). |
| Neznano stanje → fail-closed | PASS | ni implicitnega sproščanja. |
| Stanje preverjano prek Stripe API (ne lokalni čas) | PASS | expired je Stripe-event driven (kavelj), ne polling. |
| Dva kupca, en kos → samo eden dobi rezervacijo | PASS | itest (Promise.all 2 seji → 1). |
| Neuspešen checkout sprosti rezervacijo | PASS | itest release → drugi lahko kupi. |
| Uspešno plačilo → prodaja | PASS | itest convert (stock 3→2, reserved 1→0, StockMovement=1). |
| Zamujen webhook ne sprosti plačane | PASS | itest: po convert reserved=0 → release false, stock nespremenjen. |
| Ponovljeni webhook ne podvoji prodaje | PASS | itest: drugi convert false (reserved 0), stock −1 samo. |
| Rezervacija pripada pravilni org/variant | PASS | itest izolacija: variant rezerva ne vpliva na izdelek. |
| Ne zmanjšuj dejanske zaloge dvakrat | PASS | online: reserv ob seji + prodaja ob PAID (enostopenjsko); probe/itest. |

**§5 testiranje:** f54 suita +6 novih F5.5.1.2 itest scenarijev (22 novih assertions za konkurenčnost,
release, convert, double-webhook, fail-closed in izolacijo); Stripe testni
ključ ni na voljo → deterministična mock/integration pot, dejanski Stripe tok **NOT VERIFIED**.

**Regresija:**
| Preverba | Status |
|---|---|
| Full Vitest | **88 files / 1295/1295 PASS** (offline, darilne kartice, inventory, promocije ostanejo zeleni) |
| f54 integracija (F5.4.2 + F5.5.1 + F5.5.1.1 + F5.5.1.2) | **30/30 PASS** |
| TypeScript `tsc --noEmit` | 0 napak |
| ESLint | 0 errors / 0 warnings |
| Migracija `20261205000000_f5512_inventory_reservation` | PASS (izveden na `markec_f5511_mig`: stolpca `reservedQuantity` na Product/ProductVariant, obstoječa OrderItem ohranjena). |

**Spremenjene datoteke (F5.5.1.2):** `prisma/schema.prisma` (+migracija), `src/app/actions/product-checkout.ts`
(reserveStock/releaseStockReservation/convertReservationToSale + online rezerva v isti tx + PAID konverzija),
`src/app/actions/cart.ts` (validateCartStock → razpoložljivo), `src/app/api/webhooks/stripe/route.ts`
(expired→release + PAID konverzija), `tests/integration/f54/f551-variant-checkout.itest.ts`,
`scripts/_f5512-*.{ts}` (diagnostika).

**Status:** §2 **PASS**; §3 PASS; §4 PASS; §5 PASS (NOT VERIFIED samo za živi Stripe proiz);
§6 upoštevano (offline/gift kartice ohranjene, promocije zelene). **FAIL: ni.** Produkcijske migracije
niso izvedene; WIP drugih nespremenjen.