# MARKEC — IZBIRA NASLEDNJE REFERENČNE DEJAVNOSTI (2D-1R)

> Pregledno in read-only poročilo: nič kode, sheme, migracij, baze ali Git operacij ni spremenjeno.
> Tuj WIP (schema.prisma, product-checkout.ts, Stripe, webhooks, migracije) NEDOTAKNJEN.
> Vse ugotovitve podprte z dejanskimi datotekami/funkcijami. Oznake: PASS / PARTIAL / FAIL / NOT VERIFIED.
>
> **Priporočilo: AVTOSERVIS / VULKANIZER (`tire-service`/`mehanik`)** kot naslednja referenčna dejavnost.
> **Ne začenjamo implementacije — to je izbor + načrt, ki čaka odobritev.**

---

## 1. Metodologija

Čebelarstvo je referenčni standard (FINAL PASS). Za vsako dejavnost sem preveril DEJANSKO stanje v kodi —
profile (`src/lib/profiles/registry.ts`, 34 profilov), extension entitete (`src/lib/profiles/extensions.ts`,
11 extensionov), strežniške akcije (`src/app/actions/`), dashboards/navigacijo (`src/components/admin/sidebar.tsx`,
`src/app/(admin)/dashboard/`), generične module in povezavo na izdelke/zalog/naročila. Razlikujem **funkcionalno**
od **samo deklariranega** (v profile registru) in **samo UI-jskega**.

### Ključna strukturna ugotovitev

V platformi je **točno 1 dejavnostsko-dedicated UI in strežniške akcije: ČEBELARSTVO**
(`dashboard/apiculture`, `actions/{apiculture,colony-moves,traceability,direct-sale}.ts`, `dashboard/traceability`).
Vse ostale dejavnosti uporabljajo **univerzalne module**:
- `work-orders.ts` + `work-orders/` (multi-stage workflow engine — **funkcionalen**),
- `projects.ts` + `projects/` (multi-day jobs + tasks — **funkcionalen**, E2-3),
- `records.ts` + `records/` (generic, data-driven CRUD kateregakoli extension entity — **funkcionalen**,
  `entityReference` + append-only guarde),
- `walk-in.ts` + `walk-in/`, `services/customers/appointments/shop` (universal, **funkcionalni**),
- `custom-profile.ts` (lastnik si definira lastne forme/workflowe v generičnem runtimu).

→ **Nobena ne-čebelarska dejavnost nima lastnega PAS-pojma.** Vse so PARTIAL: functional universal + deklarirani
extensioni/forme/workflowi, a brez lastnega dashboarda, pametnih predlogov ali dejavnosti-ločenih akcij.

### Pametni predlogi (2D-1M)

`src/lib/profiles/smart-suggestions.ts` ima **samo čebelarsko verigo** (`apiary→hive→colony→inspection→harvest`).
Vse ostale dejavnosti padejo na generične predloge (`publish`/`firstProduct`/`firstOrder`). To je jasen signal,
kje je naslednja priložnost.

---

## 2. Trije najbolj obetavni kandidati (primerjava po referenčnem standardu)

| Kriterij (čebelarski standard) | **A. Avtoservis/Vulkanizer** | **B. Šiviljstvo** | **C. Fotograf / Projekti** |
|---|---|---|---|
| Profile | `tire-service` (registry:603), `mehanik` (registry:679) | `seamstress` (registry:514) | nima lastnega profila → `generic` / SKD |
| 1. Lastne evidence/model | **vehicle + tire_set** (`vehicle-workshop` ext, extensions:127) | **measurement_set** (`body-measurements` ext, extensions:164) | nobenih lastnih (le generični `project`/`project_task`) |
| 2. Posebni workflowi | **7-stopenjski `work-order`** (checkin→diagnostics→approved→in_progress→done→handover→closed) + `vehicle-intake` forma | **9-stopenjski `production-order`** (inquiry→measurements→quote→approval→production→fitting→delivery→payment→done) + `order-details`/`measurements` formi | samo generični projekti/tasks (E2-3 runtime) |
| 3. Dashboard iz baze | **FAIL — MANJKA** (ni lastnega dashboarda) | **FAIL — MANJKA** | **FAIL — MANJKA** |
| 4. CRUD + povezane evidence | vehicle/tire prek generic records (**PASS** funkcionalno) | measurement prek generic records (**PASS**) | project/task prek projects (**PASS**) |
| 5. Izdelki/zaloga | **shop+inventory OBVEZNO** (gume, deli) — močna povezava | shop **optional** (inkapsulacije materiali) | brez |
| 6. Naročila/prodaja/stranke | **workOrders+customers OBVEZNO**, `WorkOrder.linkedRecordId` (schema:1476) že obstaja → povezava work-order ↔ vehicle BREZ sheme | work-orders + customers (required), `projects` ext | šibko |
| 7. Org izolacija | **PASS** (univerzalno org-scoped) | **PASS** | **PASS** |
| 8. Mobilna uporabnost | **PASS** (univerzalni responsivni modulo) | **PASS** | **PASS** |
| 9. Dokončljiv brez sheme/migracij | **DA** — `linkedRecordId`+`linkedWorkOrders` (schema:1476, 1545) kot čebelarski `batchRecordId` | **DA** | **DA** |

### Podrobnosti po kandidatih

#### A. Avtoservis / Vulkanizer (`tire-service`, `mehanik`) — NAJMOČNEJŠI
- **Obstaja (funkcionalno):** `vehicle-workshop` extension (entiteta `vehicle`: registrska/znamka/leto/km/VIN;
  entiteta `tire_set`: širina/profil/premer/sezona/tekalna plast); 7-stopenjski work-order workflow; `vehicle-intake`
  forma; `suppliers` extension; univerzalni `work-orders` + `records` moduli.
- **Manjka (referenčni preskok):** lasten dashboard (`vehicle-workshop` pregled kot `apiculture`); pametna veriga
  predlogov (vehicle → tire_set → work-order → predaja); dejavnosti-dedicated akcija, ki poveže `vehicle`+`tire_set`+
  delovni nalog + prodane dele/zalogo v eno sledljivo pot; cross-entity pregled (vozilo ↔ gume ↔ nalog ↔ prodaja).
- **Lahko ponovno uporabimo:** extension sistem + records CRUD (kot bee-apiary); workflow engine (že 7-stopnje);
  product/stock/order infra (shop+inventory required); `WorkOrder.linkedRecordId` za sledljivost (kot `batchRecordId`);
  smart-suggestions vzorec; `suppliers` (kot batch-production serije).
- **Pričakovane blokade:** nobena hard — vse na obstoječi shemi; `linkedRecordId` že obstaja. Edina pozornost:
  `mehanik` in `tire-service` sta dva profila z isto extension — izberemo en ali združimo pogled (kot čebelarstvo
  uporablja `bee-apiary`+`batch-production`).

#### B. Šiviljstvo (`seamstress`)
- **Obstaja (funkcionalno):** `body-measurements` (measurement_set); 9-stopenjski `production-order` workflow;
  `order-details` + `measurements` formi; `projects` ext.
- **Manjka:** lasten dashboard; pametna veriga; cross-entity povezava (meritve ↔ naročilo ↔ projekt); sledljivost
  v zalogi materiala. Manj močna povezava na product/stock (shop optional).
- **Blokade:** ni hard; a temelj je ožji (meritve + 9-stopnje) in manj naravno veže na zalogo/izdelke.

#### C. Fotograf / Projekti
- **Obstaja (funkcionalno):** `projects` runtime (project + tasks), sposoben multi-dnevni del (fotoike).
- **Manjka:** lasten profil, lastne entitete, workflow, dashboard, povezava na product/stock. Najšibkejši temelj.

---

## 3. Priporočilo: **AVTOSERVIS / VULKANIZER**

**Zakaj je najboljša izbira (preskok na reference standard):**
1. **Že ima najboljši osnovni človeški model**: `vehicle` + `tire_set` ExtensionRecord entiteti, kot čebelarstvo
   ima `apiary`+`hive`+`colony`. Modul `records` ju že zna CRUD-at.
2. **Že ima pravi dejavnostni workflow**: 7-stopenjski `work-order` (vehicle intake → diagnostics → approved →
   in_progress → done → handover → closed) + `vehicle-intake` forma.
3. **Močna povezava na izdelke/zalogo**: `shop`+`inventory` sta OBVEZNA (gume, deli, potrošni material) — kot
   čebelarstvo prek `batch-production`.
4. **Sledljivost je arhitekturno pripravljena brez sheme**: `WorkOrder.linkedRecordId` (+ `ExtensionRecord.linkedWorkOrders`,
   + `WorkOrderEvent` audit) omogoča, da delovni nalog sledi vozilu → gumam → prodanim delom → zalogi — popoln
   analog čebelarske verige `serija → pridelek → izdelki → zaloga → prodaja → izvor`.
5. **Portal proizvaja poslovno vrednost** (ni le spletna stran): delovni nalogi, evidence vozil, izbor gum,
   prodaja delov, inventura.
6. **Dva realna obstoječa profila** (`tire-service`, `mehanik`) — širša uporabnost kot enostranski krojač.
7. **Org izolacija, mobilni, generični infrastruktura** že PASS — dodati je treba dejavnostno plast.

MARKEC ni samo sistem za spletne strani — avtoservis ima najbolj naravno razširitev v operativni del (nalogi +
vozila + deli), ki jo referenčni vzorec (tako kot čebelarstvo) dvigne iz "generične evidence" v pravi poslovni tok.

---

## 4. Predlog izvedbe (za odobritev v naslednji fazi)

> Ne kopiramo čebelarskih evidenc. Prenesemo ARHITEKTURO (extension records + workflow + dashboard + sledljivost
> + pametni predlogi + org-scope + testi), ne poslovne logike.

### 4.1 Funkcionalnosti od prve prijave do vsakodnevne uporabe
1. **Prvi vstop:** čebelarski dashboard → **avtoservis dashboard** (posnetek kot apiculture), s pametnimi predlogi.
2. **Dnevno delo:** sprejem vozila (vehicle record) → izbor gum (tire_set) → delovni nalog (workflow) → prodaja
   delov/materiala (shop/direct-sale) → inventura → izročitev.
3. **Evidence:** vehicle (registrska, znamka/model, letnik, km, VIN), tire_set (dimenzije, sezona, globina),
   servisna zgodovina vozila (entityReference zgodovine kot colony_move vzorec).

### 4.2 Potrebne evidence in povezave (kandidatno)
- **vehicle** (že obstaja) + **tire_set** (že obstaja) — morda dodati `vehicle` ↔ `tire_set` (entityReference ali
  nabor), `vehicle` ↔ `work-order` (že `linkedRecordId`).
- Nova entiteta: servisna zgodovina vozila (append-only, kot `colony_move`).
- Povezava s `suppliers`, `shop`, `inventory`, `customers`.

### 4.3 Dashboard in navigacija
- Nova stran `dashboard/vehicle-workshop` (kot `dashboard/apiculture`): števci vozil/gum/nalogov/opravljenih,
  aktivni delovni nalogi, roki, nizka zaloga delov, nedavne izdaje, prodaja.
- Navigacija: sidebar item gated na `vehicle-workshop` extension (kot `apiculture` gated na `bee-apiary`).

### 4.4 Glavni poslovni tokovi
1. Sprejem vozila → ustvari vehicle record + work-order (workflow start).
2. Evidentiranje gum → tire_set → povezava z vozilom.
3. Diagnostika → ponudba → potrditev → delo → kontrola → predaja (workflow stages).
4. Sledljivost: work-order → vehicle → (prodani deli / zaloga) → izvor (kot `resolveOrderProvenance` → npr.
   `resolveWorkOrderVehicleOrigin`).
5. Inventura/zaloga delov (že) + rezervacije (že, stock-integrity).

### 4.5 Uporaba skupnih MARKEC funkcij
`records` (extension CRUD), `work-orders` (workflow), `shop`/`inventory`/`orders`, `customers`, `suppliers`,
`smart-suggestions` vzorec, org-guards, mobilni univerzalni moduli.

### 4.6 Testni scenariji in merila za FINAL PASS
- Enotni itest na izolirani `markec_e2e_test`:
  1. sprejem vozila → work-order s `linkedRecordId` → napredovanje stopenj → predaja;
  2. izbor gum (tire_set) → poveča zalogo delov;
  3. prodaja dela materiala iz zaloge → zaloga se zniža, delovni nalog zapre;
  4. sledljivost: work-order → vehicle → prodani deli → zaloga (brez dvojnega odštevanja);
  5. org izolacija (A ne vidi B-jevega vozila/naloga);
  6. sočasnost: dva naloga na isto vozilo / dve izdaji istega dela;
  7. rollback: neuspešna predaja ne pusti delnega stanja.
- Browser E2E (izolirana baza): poln tok sprejem → gum → nalog → prodaja → izvor, desktop + mobilni 390×844.
- Merila **FINAL PASS**: vsi ključni tokovi dejansko povezani in delujoči (tako kot 2D-1Q za čebelarstvo).

### 4.7 Varovalke
- Brez sheme/migracij/`product-checkout.ts`/Stripe/webhookov/Git; DB-akcije izključno prek `test-db-guard.mjs`.

---

## 5. Ali obstajajo blokade, ki zahtevajo odločitev lastnika?

**Ni tehničnih blokad priporočila** (vse na obstoječi shemi). Potrebujemo pa **poslovno odločitev**:

1. **Kateri profil** naj postane referenca: **`tire-service` (vulkanizer) ali `mehanik` (avtomehanik)?** Oba imata
   isti `vehicle-workshop` extension + work-order workflow. Za ta faza je naravneje izbrati **enega** (ali oba
   delita iste akcije/dashboard). **Predlog: `tire-service`** (gume + menjava so najbolj standardiziran delovni tok),
   a lahko pokrijemo tudi `mehanik`.
2. **Obseg sledljivosti:** naj `resolveWorkOrderVehicleOrigin` zajema samo vehicle, ali tudi povezane `tire_set` +
   prodane dele iz zaloge? **Predlog: vse tri** (kot čebelarstvo zajame serija → pridelek → izdelki).

Druge podrobnosti (obseg delov, terminologija) so izvedbene, ne blokirne.

---

## 6. Povzetek priporočila

1. **Tri najbolj pripravljene dejavnosti:** (A) **Avtoservis/Vulkanizer**, (B) **Šiviljstvo**, (C) **Projekti/Fotograf**.
2. **Priporočena naslednja dejavnost:** **AVTOSERVIS / VULKANIZER (`tire-service`/`mehanik`)**.
3. **Zakaj:** najboljši obstoječi temelj — lastni vehicle+tire entiteti, 7-stopenjski work-order workflow,
   shop+inventory required, `WorkOrder.linkedRecordId` trace-hook brez sheme; največji preskok iz "generične
   evidence" v pravi operativni poslovni tok ob uporabi preverjene čebelarske arhitekture.
4. **Kaj bomo implementirali:** avtoservis dashboard, pametna veriga, cross-entity povezava vozilo↔gume↔nalog↔prodaja,
   zgodovina vozila, sledljivost izvora, testi + browser E2E (glej §4).
5. **Blokade:** ni tehničnih; **lastnik naj izbere profil (`tire-service` ali `mehanik`) in obseg sledljivosti**.