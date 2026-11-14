# MARKEC — 2D-2A — RAZISKAVA TRETJE REFERENČNE DEJAVNOSTI: ŠIVILJSTVO

> Read-only raziskava obstoječe platforme. **Nič ni bilo implementirano, spremenjeno,
> posejano ali migrirano.** Šiviljstvo mora biti TRETJI neodvisni uporabnik in TRETJA
> organizacija — ne dopolnitev čebelarja ali vulkanizerja. Vse org-scoped, na skupni
> infrastrukturi.
> Zgrajeno na dejanskem stanju repozitorija (branje modelov, profilov, akcij, testov),
> ne na predpostavkah.

---

## 0. Povzetek

Platforma MARKEC **že ima** celoten profil `seamstress` (Šiviljstvo) — vključno s
statusnimi zmogljivostmi, terminologijo, formami, delovnim procesom, spletnim mestom
(inquiry CTA), katalogom in razširitvama `body-measurements` + `projects`. **Ni pa**:
nobenega dejanskega šiviljskega najemnika v testni bazi, šiviljski specifične nadzorne
plošče (Dashboard), verige pametnih predlogov, dodelanega merilno-zgodovinskega ali
materialno-sledljivostnega modula nad univerzalnimi zapisi. To poročilo točno določi
stanje, ponovno uporabljivo, manjkajoče in predlaga poslovni model + faze + testni načrt.

---

## 1. Dejansko stanje obstoječega sistema

### 1.1 Profil šiviljstva — `src/lib/profiles/registry.ts` (SEAMSTRESS, linija 512)

| Značilnost | Vrednost |
|---|---|
| `id` | `seamstress`, `label` »Šiviljstvo«, `palette` teal, `version 1` |
| `schemaType` | `ProfessionalService` (Social proof/SEO) |
| Zmogljivosti | `appointments: disabled` · `workOrders: required` · `shop: optional` · `services: required` · `inventory: optional` · `customers: required` · `staff: required` · `analytics: required` · `forms: required` · `workflows: required` · `documents: optional` · `delivery: optional` · `walkIn: optional` |
| Terminologija | atelje · **Srečanje** (namesto termin) · **Delovno naročilo** · CTA **„Oddaj povpraševanje“** |
| Forme | `order-details` (vrsta oblačila, material, želene spremembe, rok) + `measurements` (merilni list: prsi/pas/boki/rokav/n.t. hlač) |
| Workflow | `production-order` — 9 stopenj: Povpraševanje → Meritve → Predračun → Potrditev → Izdelava → Priblon → Predaja → Plačilo → **Zaključeno** |
| Dashboard widgeti | activeOrders, deadlines, pendingApprovals, readyForDelivery, revenue, customers, projects |
| Splet | `website: { ctaMode: "inquiry" }` |
| Razširitve | `["body-measurements", "projects"]` |
| Katalog | `seedVerticalId: "seamstress"` |

**Poslovni pomen**: šiviljstvo je **proizvodni, večdnevni potek dela** — NI terminov
(rezervacij); katalog je **obvezen** (`services: required`), trgovina / inventory
**izbirni** (`optional`) — spremembe/popravila so storitve, šivanje po meri je vprašnik.

### 1.2 Razširitveni register — `src/lib/profiles/extensions.ts`

- **`body-measurements`** (linija 163): entiteta `measurement_set` (Merilni list, `capabilities: ["customers","workOrders"]`) s polji `chest_cm, waist_cm, hips_cm, shoulder_cm, sleeve_cm, inseam_cm, height_cm` (vse `number`, `unit: "cm"`, neobvezna). **Ni `appendOnly`** → generični CRUD (create/update/delete) prek `ExtensionRecord`.
- **`projects`** (linija 393): entiteti `project` (Projekt: naziv, začetek, rok, status, proračun, opombe) in `project_task` (Naloga: naslov, status, rok, odgovorna osoba, predvidene ure, opombe), `capabilities: ["workOrders","customers"]`.
- Skupni mehanizem `entityReference` (še iz 2B/2C): polje `type: "entityReference"` z `referenceTo: { extensionId, entityKey }` — org-scoped validacija pri shranjevanju.

### 1.3 Univerzalne evidence in CRUD — `src/app/actions/records.ts`

- `listExtensionRecords(entityKey)` — org-scoped, **guard na `entityKey`** proti poljubnim ključem (mora pripadati omogočeni razširitvi profila).
- `createExtensionRecord / updateExtensionRecord / deleteExtensionRecord` — generični CRUD na `ExtensionRecord` (`organizationId + extensionId + entityKey + title + data JSON + customerId`), z valjadacijo polj po definiciji entitete in `entityReference`.
- `mergeDataPreserveLegacy` — pri update ohrani predhodne/legacy ključe JSON.
- `listExtensionRecordOptions` — opcije za pickerje (npr. vezava vozila pri vulkanizerju).
- Vnos strank: `ExtensionRecord.customerId` → `Customer` (unaliverzalno).

### 1.4 Stranke, naročila, izdelki, zaloga

- **Stranke**: univerzalni `Customer` (org-scoped), `customers.ts` CRUD + identity resolver (`customers/identity.ts` F5.5.3.1), prevzem od gosta.
- **Naročila**: `Order` + `OrderItem` + `ProductVariant` (org-scoped); `orders.ts` usmerja prodajo.
- **Izdelki/materiali**: `Product` (+variante, `trackInventory`), `product-checkout.ts`, `products.ts`.
- **Zaloga**: `StockMovement` (IN/OUT, `source`, `orderId`, `batchRecordId`), `inventory/stock.ts` (`computeAvailableStock`), `stock-integrity` itesti, `direct-sale.ts` (beekeeperjev direktni prevzem).
- **Prevzem materiala na delovnem nalogu**: vzorec `sellPartsOnWorkOrder` (vulkanizer, 2D-1S) — `Order + OrderItem + StockMovement OUT + Document{workOrderId, orderId}` (avtoritativno, NIKOLI vzporedno številčenje).

### 1.5 Delovni nalogi in projekti

- **`WorkOrder`**: org-scoped, `+ WorkOrderEvent` (append-only), `linkedRecordId` → `ExtensionRecord`, `customerId`, `workflowDefinition/currentStageKey`. Univerzalno v `work-orders.ts` (vsi org-scoped).
- **`Project` + `ProjectTask`** (`schema.prisma` 2190/2227): `Project` ima `customerId`, `workOrderId` (»povezava na delovno naročilo« — predračun/prevzem ostanejo dosegljivi prek naloga), `ProjectTask`. Univerzalno v `projects.ts` (list/detail/create/update/status/task CRUD, `requireProjectsEnabled`).
- **Provenance**: `resolveWorkOrderProvenance` (vehicle-workshop) + traceability (beekeeper) + `linkedRecord` vzorci — za šiviljstvo se lahko naredi `resolveOrderProvenance` po istem vzorcu.

### 1.6 Spletna stran, katalog, splet/profil

- `verticals.ts` `seamstress` — katalog seed: **Spremembe oblačil** (krajšanje hlač, prižemanje v pasu, krajšanje rokavov), **Popravila** (zamenjava zadrgle, popravilo prekinitve), **Šivanje po meri** (posvet+snemanje mer, obleka po meri). Slike `IMG.heroAtelier/sewing/customDress/zipper`. `siteContent: defaultSiteContent("seamstress")`.
- `site-layout.ts`: hero **minimal**, `primary: workflow`, brez statistik. `site-content.ts`: `seamstress: ["hero","features","services","about","reviews","cta"]`.
- SEO: `schemaTypeForVertical("seamstress")` → `ProfessionalService` (ne ClothingStore).
- Setup-checklist: `publishInquiry` (»pripravljena na povpraševanja«), `growthTestInquiry`.

### 1.7 Povezovanje zapisov in provenance (vzorec 2D-1S/2D-1P)

- `EntityReference` (body-measurements nima; projects nima; a mehanizem je univerzalen).
- `__appointments` / `__workOrderIds` JSON append-only na `ExtensionRecord.data` (2D-1S/1W).
- `StockMovement.batchRecordId` + `Document{workOrderId,orderId}` — sledljivost brez sheme (`traceability.ts`, 2D-1P).

### 1.8 Obstoječi testni računi in organizacije

- `markec_e2e_test` (localhost:5433, ima 109 org): **0 seamstress org**; vertikale `beekeeping`, `generic`, `tire-service`.
- Referenčni lastniki: `cebeler.fresh@markec.test` → `svezi-cebeler-2d1l` (beekeeping); `cebeler.tire@markec.test` → `svezi-vulkanizer-2d1s` (tire-service). **Tretjega šiviljskega uporabnika/organizacije NI**.
- `markec_f631_test`: `f631-e2e-setup.ts` seeda `sivilja-test` (seamstress, `si@f631.test`) — **NI v tej bazi** (fixtures so v drugi bazi). Torej za šiviljstvo velja ISTI postopek kot za čebelarja/vulkanizerja: ustvariti **nov** uporabnik + org.

---

## 2. Kaj lahko ponovno uporabimo (že obstaja)

1. **Profil `seamstress`** (capabilities, terminologija, forme, workflow, CTA, dashboard-widgets).
2. **Extersiona `body-measurements`** (merilni list — omejena, glej §3) in **`projects`**.
3. **Univerzalni CRUD evidence** (`records.ts`) + `ExtensionRecord` + `entityReference`.
4. **Univerzalne stranke** (`Customer`, identity, org-scoped).
5. **Delovni nalogi + workflow** (`work-orders.ts`, 9-stopenjski proizvodni proces že definiran).
6. **Projekti + naloge** (`projects.ts`, `Project` ↔ `WorkOrder` ↔ `Customer`).
7. **Naročila / izdelki / zaloga / prevzem materiala** (Order/OrderItem/StockMovement/Document, `sellPartsOnWorkOrder` vzorec).
8. **Spletna stran + katalog + inquiry CTA** (minimal hero, workflow primary, objava).
9. **Sledljivost brez sheme** (`__workOrderIds`, `StockMovement.batchRecordId`, `Document`).
10. **Smart-suggestions** ogrodje (dodati verigo `seamstress.*`), **sidebar** (honorira `projects`, `records`), **dashboard-widgeti**.
11. **Sejanje org** (`scripts/seed-vulkanizer-complete.ts` / `seed-orgs.ts` vzorec) + **izolacijska preverba** (`verify-dejavi-isolation.ts`).

---

## 3. Kaj manjka (za polni poslovni model šiviljstva)

1. **Dejanski šiviljski najemnik** v testni bazi (`markec_e2e_test`): nov uporabnik (`svelja…@markec.test`) + org (`seamstress`, npr. `svezi-atelje-2d2`), objavljena stran.
2. **Šiviljska nadzorna plošča** (`/dashboard/seamstress`) — pregled aktivnih povpraševanj, meril, rokov, v produkciji, pripravljenih za prevzem (analogno `apiculture`/`tire-service`).
3. **Pametni predlogi** za `seamstress` (veriga: prvi merilni list → prvo delovno naročilo → meritev pri stranki → v produkciji → prevzem → objava).
4. **Merilna zgodovina / per-meritev** — trenutni `measurement_set` je **eden za vse** (7 polj, enkratna vrednost). Za polni model potrebujemo **več meritev skozi čas** (datum, levo/desno, oznaka, opomba, kdo je meril) — kot append-only `__measurement_history` na stranki/`measurement_set`, ali več `measurement_set` zapisov s `date` + `entityReference` na stranko; **ter zgodovina meritev** (sprememba telesa med projekti).
5. **Naročilo po meri** — zdaj CTA »Oddaj povpraševanje«. Manjka **strukturiran `custom_order` ali razširitev `order-details` forme**: merilni list (iz `body-measurements`), fotografije/spec, material(i), rok. To se veže na `WorkOrder` (proizvodni proces) in `Project` (večdnevno).
6. **Materiali in zaloga** — `Product` + `StockMovement` obstajata, a šiviljsko specifično **porabo blaga** (npr. `m² blaga`, vrvice, zadrge) na delovnem nalogu ni ločene akcije; lahko uporabim `sellPartsOnWorkOrder` vzorec ali dodam `consumeMaterialOnWorkOrder`.
7. **Sestavni material izdelka** (Bill of Materials za obleko po meri) — ni sheme/modela; možnost: `ExtensionRecord` entiteta `material_spec` ali uporaba `OrderItem` normalizirano.
8. **Prevzem izdelka / rok izdelave** — `Project.deadline` + `ProjectTask.dueDate` obstajata; manjka mejnik za **pripravljeno za prevzem** na WorkOrder (stage `predaja` že obstaja).
9. **Plačilo in sledljivost** — `Document` (račun/ponudba/predračun) + `payment` stage obstaja; sledljivost izvora (naročilo → meritve → material → zaloga → prevzem) ni izgrajena za šiviljstvo (vzorec `resolveWorkOrderProvenance` se ponovno uporabi).
10. **Izolacija + third-user** — dokaže se šele z dejansko org.

---

## 4. Predlog poslovnega modela šiviljstva

### 4.1 Entitete (vse org-scoped, na obstoječi infrastrukturi)

```
Stranka (Customer)
  └─ Merilni list(i)   → ExtensionRecord(seamstress/body-measurements: measurement_set)
       { datum, chest/waist/hips/shoulder/sleeve/inseam/height, left/right?, note, taken_by }
       + append-only __measurement_history na stranki (datum-algebra, posebno meritve)
  └─ Delovno naročilo  → WorkOrder (proizvodni workflow production-order, 9 stopenj)
       • naročilo po meri: vrsta oblačila, specifikacije, fotografije, merilni list (ref)
       • sprememba/poprava: opis, material, želeni rok
       • linkedRecordId → merilni list  (kot vozilo pri vulkanizerju)
       • customerId → stranka
       • Project (Project.customerId + Project.workOrderId) za večdnevne/kompleksne posle
  └─ Materiali in poraba → Order + OrderItem + StockMovement OUT + Document{workOrderId,orderId}
       (m² blaga, vrvice, zadrge, gumbi — kot `sellPartsOnWorkOrder` pri vulkanizerju)
  └─ Prejem/plačilo     → WorkOrder stage 'predaja' + 'payment' + Document (predračun/račun)
  └─ Sledljivost        → resolveSeamstressProvenance(workOrderId):
       naročilo → merilni list → materiali → premiki zaloge → prevzem → akter
```

### 4.2 Potek (konkreten primer: »Obleka po meri«)

1. Stranka na javni strani (CTA „Oddaj povpraševanje“) odda `order-details` + `measurements` → nastane **WorkOrder (stage: Povpraševanje)** + **Customer** (ali se poveže z obstoječo).
2. Šivilja snema merilni list → `measurement_set` povezan na stranko (append-only zgodovina).
3. `quote` → predračun (`Document` predračun) z rokom izdelave → `approval` (stranka potrdi).
4. `production` — na delovnem nalogu se odšteva blago/materiali iz zaloge (`OrderItem` ima
   svet: `sedm` mer materialov) → zaloga se zniža.
5. `fitting` (priblon) → korekcije → `predaja` (prevzem) → `payment` → **Zaključeno**.
6. Vsak korak = `WorkOrderEvent` (append-only); izvor (stranka, moderne, materiali, premiki,
   akter) razviden iz `resolveSeamstressProvenance`.

### 4.3 Ponovna uporaba proti novemu

| Poslovni del | Ponovna uporaba | Novo |
|---|---|---|
| Stranka | `Customer` + identity | — |
| Osebne mere + zgodovina | `body-measurements/measurement_set` + `ExtensionRecord.customerId` | `__measurement_history` (append-only) + datum/levo/desno/opombe; ločena akcija snemanja |
| Izdelek/naročilo po meri | `WorkOrder` (production-order workflow) | spec-podatki forme vežejo na WorkOrder; fotografije prek `Media` |
| Opis/fotografije/spec | `WorkOrder.title/notes` + `Media` | formirane v `order-details` |
| Materiali in zaloga | `Product` + `StockMovement` + `buyPartsOnWorkOrder` vzorec | `consumeMaterialOnWorkOrder` (blago v m²) + BOM opcija |
| Delovni proces | `work-orders.ts` (9 stopenj) | — (že piše za seamstress) |
| Poraba materiala | `Order+OrderItem+StockMovement+Document` | — |
| Rok izdelave | `Project.deadline` + `ProjectTask.dueDate` | povezava Project↔WorkOrder |
| Končni izdelek/prevzem | `WorkOrder` stage `predaja` + `Document` račun | — |
| Plačilo | `Document`/`payments` + `DocumentPayment` | stage `payment` |
| Sledljivost | `resolveWorkOrderProvenance` vzorec | `resolveSeamstressProvenance` |

---

## 5. Predlog arhitekture

1. **Brez spremembe sheme** (kot 2D-1S/1W/1P): vse na `ExtensionRecord` + `WorkOrder` +
   `Project` + `Order/StockMovement/Document`.
2. **Nova akcijska plast** `src/app/actions/seamstress.ts`:
   - `getSeamstressOverview` (aktivni povpraševanji, merilni listi, v produkciji, za prevzem, roki, prihodki) — analogno `getTireServiceOverview`.
   - `saveMeasurementSet(customerId, measurement, date?)` — org-scoped, append-only zgodovina.
   - `createWorkOrderFromInquiry` / `convertInquiryToWorkOrder` (povpraševanje → delovni nalog).
   - `consumeMaterialOnWorkOrder(workOrderId, lines, meterQty?)` — odštej blago/materiale (z `m²` enotami prek `ProductVariant` ali `quantity`), ustvari Order/StockMovement/Document.
   - `resolveSeamstressProvenance(workOrderId)` — sled naročilo→mere→material→zaloga→prevzem→akter.
   - `markReadyForDelivery(workOrderId)` (stage `predaja`) + `completeOrderWithPayment`.
3. **Nadzorna plošča** `/dashboard/seamstress` (sidebar item `seamstress`, gated na razširitev
   `body-measurements` ali profil ela), ki zbere zgoraj.
4. **Pametni predlogi**: veriga `seamstress.measurements → seamstress.inquiry → seamstress.production → seamstress.delivery → publish` v `smart-suggestions.ts`.
5. **Provenance**: razširi prikaz na `WorkOrder` (kartica »Izvor«: merilni list, materiali, zgodovina) — analogno kartici »Delavnica vozil« iz 2D-1W.
6. **Izolacija/test**: nov org + uporabnik; vse akcije org-scoped; `verify-seamstress-isolation.ts` (enako `verify-dejavi-isolation.ts`).

---

## 6. Faze implementacije

- **Faza 1 — Infrastruktura & najemnik**: nov uporabnik + org (`seamstress`, objavljeno) v
  `markec_e2e_test`; `seedOrganizationCatalog("seamstress")`; materializacija profilnih
  (forme + workflow `production-order`) prek `materializeProfileAssets`; izolacijska preverba.
- **Faza 2 — Merilni listi**: akcija `saveMeasurementSet` + `getMeasurementHistory`; UI
  (merilni list na stranki + zgodovina); append-only `__measurement_history`.
- **Faza 3 — Naročilo/prevzem**: `createWorkOrderFromInquiry` + prikaz meritve na
  WorkOrder; karta »Izvor«; rok izdelave (Project↔WorkOrder).
- **Faza 4 — Materijali/poraba**: `consumeMaterialOnWorkOrder` (blago m²/vrvice/zadrge) +
  zaloga + `Document`; pregled porabe in zgodovina (z `StockMovement`).
- **Faza 5 — Dashboard + predlogi**: `/dashboard/seamstress`, paneli (povpraševanja, roki,
  produkcija, prevzem, prihodki, stranke); `seamstress.*` pametni predlogi.
- **Faza 6 — Sledljivost & testiranje**: `resolveSeamstressProvenance`; itest
  `seamstress.itest.ts`; browser E2E (povpraševanje → mere → predračun → produkcija →
  poraba → prevzem → plačilo → izvor); regresija čebelarja/vulkanizerja; dokumentacija.

---

## 7. Testni načrt za tretjega neodvisnega uporabnika in organizacijo

### Enote / integracijske (izolirana baza)
`seamstress.itest.ts`:
1. Stranka + merilni list (`saveMeasurementSet`) — org-scoped, historija (2 meritvi s časom).
2. Povpraševanje → `WorkOrder` (stage Povpraševanje) — povezava merilni list (linkedRecordId) + stranka.
3. `approval` → predračun `Document` + rok izdelave (Project deadline).
4. `production` → `consumeMaterialOnWorkOrder` → **zaloga znižana** + Order/StockMovement OUT + Document; **rezervacija/prevzem sama ne odšteje zaloge**.
5. `fitting` → `predaja` → `payment` → **Zaključeno**; `WorkOrderEvent` v celotni zgodovini.
6. `resolveSeamstressProvenance` — izvor (naročilo→mere→material→zaloga→prevzem→akter).
7. Podvojen nalog iz istega povpraševanja → zavrnjeno.
8. **IDOR**: čebelar/vulkanizer ne doseže šiviljskega; šivilja ne doseže njunega (WorkOrder/measurement/Product/Document iz druge org → null / NOT_FOUND).
9. Izolacija: čebelarska in vulkanizerska org **0 meril / 0 delovnih nalogov z mere / 0 materialnih porab**.

### Unit
- `seamstress` pametni predlogi veriga; provenance; izolacijski guardi; `tsc`.

### Browser E2E (strežnik :3002, `markec_e2e_test`; tretji uporabnik ločen)
1. Prijava tretjega uporabnika → šiviljski workspace (»Delovna naročila«, »Projekti«, »Evidence«, »Merilni listi«).
2. Stranka odda javno povpraševanje (inquiry) → viden tretjim.
3. Snemanje merilnega lista + zgodovina meritev.
4. Predračun + potrditev + rok (Projekt).
5. Uporaba blaga/materialov → zaloga znižana.
6. Priblon → prevzem → plačilo → zaključeno; izvor (provenance) viden.
7. Poskus drugičnje naloga iz istega povpraševanja → preprečeno.
8. Mobili 390×800 (dashboard + merilni list + WorkOrder).
9. Izolacija: čebelar/vulkanizer **ne vidita** šiviljskih (in obratno).
10. Regresija: čebelarjeve in vulkanizerjeve strani/podatki nedotaknjeni (1356 unit + obstoječi itest).

---

## 8. Sklep

Platforma že pokriva ~70 % šiviljstva (profil, forme, workflow, `body-measurements`,
`projects`, katalog, inquiry stran, delovni nalogi, zaloga, prevzem). Manjkata dejanski
tretji najemnik in **šiviljsko-specifična plast**: merilna zgodovina, naročilo-po-meri s
povezavo na merilni list, poraba tkanine/materialov, šiviljska nadzorna plošča, pametni
predlogi in provenance. Vse se da narediti **brez spremembe sheme** na obstoječi
infrastrukturi, org-scoped — po natančnem vzorcu, ki ga že dokazujeta čebelar in vulkanizer.