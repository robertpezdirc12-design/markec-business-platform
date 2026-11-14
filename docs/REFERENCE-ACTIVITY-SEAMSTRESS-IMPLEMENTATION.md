# MARKEC — 2D-2B — IMPLEMENTACIJA TRETJE REFERENČNE DEJAVNOSTI: ŠIVILJSTVO

> Tretja samostojna dejavnost platforme MARKEC. Nova, LOČENA org in nov uporabniški
> račun — ne dopolnitev čebelarja ali vulkanizerja. Vse org-scoped, na obstoječi skupni
> infrastrukturi, **brez spremembe sheme/migracij**. Preverjeno v testni bazi
> `markec_e2e_test` + brskalniku (:3002). Brez commit/push/deploy; `markec_dev`/
> produkcija/Stripe/webhooki nedotaknjeni.

## 1. Varnost in stanje

- `git status/diff`: obsežen predhodni WIP (nedotaknjen). **Nič nisem prepisal, samo dodal**
  nove datoteke in naredil ciljne, ozke edite na obstoječih.
- Baza: izključno `markec_e2e_test` (localhost:5433); `markec_dev`/produkcija **nedotaknjeni**.
- Brez commit/push/deploy; brez spremembe sheme in migracij.

## 2. Tri ločene organizacije

| Org | Slug | Vertical | Uporabnik |
|---|---|---|---|
| Čebelarstvo | `svezi-cebeler-2d1l` | beekeeping | `cebeler.fresh@markec.test` |
| Vulkanizer | `svezi-vulkanizer-2d1s` | tire-service | `cebeler.tire@markec.test` |
| **Šiviljstvo** | **`svezi-atelje-2d2`** | seamstress | **`atelje.fresh@markec.test`** (nov) |

- Nova šiviljska org + uporabnik (ADMIN, članstvo, default) **ustvarjena ločeno**;
  štviljske vsebine/podatki NISO v čebelarski/vulkanizerski org (in obratno).
- Stran **objavljena** prek pravega `publishSite()` (UI).

## 3. Šiviljski poslovni proces (obstoječi 9-stopenjski workflow)

`production-order` (že v profilu seamstress):
**Povpraševanje → Meritve → Predračun → Potrditev → Izdelava → Priblon → Predaja → Plačilo → Zaključeno.**

Materializirano prek `materializeProfileAssets`. Napredovanje samo na sosednje stopnje
(validirano) in append-only `WorkOrderEvent` → popolna revizijska sled.

## 4. Meritve strank (append-only zgodovina)

- Nova razširitev **`seamstress-measurements`** (v `extensions.ts`) z entiteto
  `measurement` (`appendOnly: true`). Profile seamstress jo je dobil namesto `body-measurements`.
- Vsaka meritev = **NOV zapis** (create-only; update/delete blokirano generičnim CRUD) z
  `measured_at` (datum), vsemi merami (prsi/pas/boki/ramena/rokav/notr.dolž.hlač/višina),
  `by_staff`, `notes`, `order_ref`, vezan na **stranko** (`ExtensionRecord.customerId`).
- Zgodovina je po definiciji nedotakljiva neprepisana.
- `saveMeasurement` (org-scoped) + `listMeasurements` (zgodovina, org-scoped) +
  `listAllMeasurements` (preglednica).

## 5. Naročila po meri

- `createOrderFromInquiry` → `WorkOrder` v stopnji **Povpraševanje**, povezan na:
  merilni list (`linkedRecordId`), stranko (`customerId`), rok (`dueDate`),
  dogovorjeno ceno (`total`), specifikacijo (`notes`).
- **Podvajanje preprečeno**: en merilni list → največ eno ODPRTO delovno naročilo
  (`ALREADY_CREATED`); tudi brez merilnega lista se naročilo da ustvariti (sprememba/poprava).
- Pregled napredka: `getOrderProgress` (trenutna stopnja + `WorkOrderEvent`).

## 6. Materiali in zaloga

- Evidenca blaga/materialov = obstoječi `Product` (m², vrvica, zadrga, gumbi…).
- `consumeMaterialOnWorkOrder` — poraba na delovnem nalogu: CAS `UPDATE` (nikoli pod
  razpoložljivo), `Order + OrderItem + StockMovement OUT (ORDER) + Document{workOrderId,
  orderId}` + `WorkOrderEvent`. Napaka → **rollback**; **ni negativne zaloge**; **ni dvojnega
  odštevanja**.
- Sledljivost material → delovni nalog → končni izdelek → stranka prek `resolveSeamstressProvenance`.

## 7. Nadzorna plošča `/dashboard/seamstress`

Nov route + sidebar item (gated na `seamstress-measurements`) + i18n label.
Kartice/števci: **Povpraševanja, Naročila po meri, Meritve strank, Roki izdelave, Za predajo,
Aktivna dela, Poraba materiala, Nizka zaloga materialov** + panela meritev in naročil +
hitre akcije („Snemaj meritev", „Novo naročilo"). Pametni predlogi veriga `seamstress.*`.
Terminologija **šiviljska** (Delovna naročila, merilni listi) — NE vulkanizerska/mehanična
(preverjeno, glej §9).

## 8. Spletna stran in katalog

- Ločena javna stran `/s/svezi-atelje-2d2` (objavljena) — šiviljskega CTA **„Oddaj povpraševanje"**,
  predstavitev ateljeja, storitve (Spremembe oblačil / Popravila / Šivanje po meri), ekipa,
  kontakt, delovni čas. **Brez klasičnih rezervacijskih terminov** (profil nima appointments).
- Forme: „Podrobnosti naročila" + „Merilni list" → javno `inquiry`.
- Katalog: `seedOrganizationCatalog("seamstress")` (7 storitev, 3 kategorije) + materiali (5).

## 9. Sledljivost – `resolveSeamstressProvenance`

Vrne: stranko, uporabljene mere, naročilo (naziv/spec/cena/rok), materiale (Order/StockMovement/
Document), izdelano/predano (`deliveredAt`), plačilo (`paidAt`), status/zgodovino (`WorkOrderEvent`).

## 10. Testiranje (dejansko izvedeno)

### Integracijske (markec_e2e_test) — `tests/integration/seamstress.itest.ts` **10/10 PASS**
1. meritve append-only (2 meritvi, zgodovina nedotaknjena),
2. IDOR na tuji stranki → CUSTOMER_NOT_FOUND,
3. naročilo po meri (WorkOrder + merilni list + rok + cena + povezava),
4. podvojen nalog iz merilnega lista → ALREADY_CREATED,
5. naročilo brez merilnega lista — dovoljeno,
6. poraba materiala (zaloga znižana; INSUFFICIENT_STOCK; brez dvojnega),
7. provenance (stranka + mere + material + premiki),
8. napredovanje → predaja → plačilo → zaključeno,
9. izolacija/IDOR (čebelar nima šiviljskih; tuj nalog → WORKORDER_NOT_FOUND),
10. naročilo samo ne odšteje zaloge.

### Enote — `npx vitest run`: **1356/1356 PASS** (93 datotek). Posodobil `registry.test.ts`
(šivilja omogoča `seamstress-measurements` + `projects`). `smart-suggestions.test.ts` PASS.

### Browser E2E (:3002, `markec_e2e_test`)
1. Prijava `atelje.fresh@markec.test` → šiviljski workspace („Šiviljstvo" sidebar, Delovna naročila, Projekti).
2. `/dashboard/seamstress` — šiviljska nadzorna plošča (šiviljska terminologija, pametni predlogi).
3. Javna stran objavljena („Oddaj povpraševanje", storitve, ekipa, delovni čas).
4. Javno povpraševanje + merilni list (obrazca materializirana).
5. Dialoga „Snemaj meritev" / „Novo naročilo" v dashboardu.
6. **Mobilni 390×800**: javna stran šiviljstva + dashboard (brez overflow).
7. **Izolacija**: vseh treh org pregled — vsaka ima le svoje podatke (DB).
8. **Regresija**: vulkanizer + čebelar dashboarda delujeta; terminologija nedotaknjena.

## 11. PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED

- **PASS**: tretja org + uporabnik; ločena spletna stran (objavljena); inquiry + naročilo po
  meri (WorkOrder); append-only zgodovina meritev (datum + order link, neprepisana, org-scoped);
  poraba materiala (zaloga se zniža, ni negativna, ni dvojna); preprečevanje podvajanja naloga;
  sledljivost (provenance: stranka → mere → naročilo → materiali → izdelano → predaja → plačilo);
  šiviljska nadzorna plošča; izolacija (IDOR + org-scoped); mobilni prikaz; regresija čebelarja
  in vulkanizerja; 10 itest + 1356 unit.
- **PARTIAL**: indeksno strukturiran `WorkOrder.sourceAppointment/-OrderId` stil ni dodan —
  povezava je na obstoječem `linkedRecordId` + `data.__workOrderIds` (shema-free kot 2D-1S/1W).
  Vizualne galerije/fotografije izdelka v naročilu uporabljajo presete (realne slike so za
  produkcijo); `photoIds` param v akciji šele rezerviran (UI galerije ni prilagojen šiv.).
- **FAIL**: nič.
- **NOT VERIFIED**: plačilo prek Stripe (off); konkretne meritve/porabo skozi dialog v celoti
  v browserju (jest + dialog prikazan; celoten click-flow se lahko razlikuje zaradi SPA state
  reseta ob vsakem view_page) — logično pokrito z itest (10).
- **BLOCKED**: vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje, ne regresija);
  samostojni prikaz `measurement` v splošni Evidence/CRUD — razširitev `appendOnly` je
  materializirana, a samostojni UI CRUD cases testiran prek generičnega records sistema.

## 12. Sklep

Trije neodvisni podjetniki na isti platformi MARKEC — **čebelar, vulkanizer in šivilja** —
vsak s svojo javno stranjo, katalogom, strankami, meritvami/naročili/nalogi, materiali/zalogo
in poslovnimi procesi, **brez kakršnegakoli prehajanja podatkov med organizacijami**. Šiviljstvo
uporablja izključno obstoječo skupno infrastrukturo (profili, extensions, WorkOrder, Product/
StockMovement, Document, PublicSite, sidebar, dashboard, smart-suggestions) — **brez spremembe
sheme**. Implementirano, testirano in preverjeno v browserju + testni bazi.