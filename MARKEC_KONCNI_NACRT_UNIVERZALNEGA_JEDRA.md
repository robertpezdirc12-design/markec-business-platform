# KONČNI NAČRT UNIVERZALNEGA POSLOVNEGA JEDRA MARKEC

**Datum:** 14. november 2026  
**Verzija:** 1.0  
**Osnova:** Sinteza treh analiz (šiviljstvo, čebelarstvo, vulkanizer/mehanik) + pregled dejanskega stanja v kodi

---

## 1. POVZETEK OBSTOJEČEGA STANJA (Z DEJANSKIMI DOKAZI IZ KODE)

### 1.1 Arhitektura sistema

MARKEC je zasnovan kot **multi-tenant SaaS platforma** (Next.js 16 + React 19 + TypeScript + Tailwind + Prisma + PostgreSQL), kjer vsak najemnik = `Organization`.

**Ključna lastnost:** Vsi profili delijo **isto univerzalno jedro** in se prilagajajo prek:
- `Organization.vertical` – primarni profil dejavnosti
- `Organization.secondaryVertical` – dodatni profil
- `Organization.profileOverrides` (JSON) – prekinitve definicije profila
- `Organization.moduleStates` – stanja modulov (vklop/izklop)
- **`ExtensionRecord`** – generični model za profil-specifične entitete (brez spremembe sheme!)
- `SalonConfig` – splošna konfiguracija (napačno poimenovano, uporablja se za vse profile)

**Dokaz:** `prisma/schema.prisma` – 76 modelov, nobenega ni izoliranega za posamezen profil. Vsi specializirani podatki gredo v `ExtensionRecord`.

### 1.2 Že implementirano in delujoče (potrjeno s testi)

#### 🧵 Šiviljstvo (`seamstress`)
**Datoteke:** `src/app/actions/seamstress.ts`, `src/lib/profiles/registry.ts` (vrstice 514–600)  
**Testi:** `tests/integration/seamstress.itest.ts` – 10 scenarijev, vsi uspešni

✅ Meritve strank so **append-only zgodovina** (`saveMeasurement()`)  
✅ Delovno naročilo se veže na merilni list, rok, ceno  
✅ Poraba materiala zniža zalogo CAS, ni negativne zaloge  
✅ Sledljivost: naročilo → mere → materiali → zaloga → izdelano → predaja → plačilo  
✅ 9-stopenjski proizvodni workflow: `Povpraševanje → Meritve → Predračun → Potrditev stranke → Izdelava → Priblon → Predaja → Plačilo → Zaključeno`  
✅ IDOR zaščita – čebelar ne vidi šiviljskih meritev

#### 🔧 Vulkanizer (`tire-service`)
**Datoteke:** `src/app/actions/vehicle-workshop.ts`, `src/app/actions/workshop-booking.ts`, `registry.ts` (vrstice 604–675)  
**Testi:** `tests/integration/tire-service.itest.ts` (14 scenarijev), `workshop-booking.itest.ts` (7 scenarijev)

✅ Vozilo se veže na stranko in delovni nalog  
✅ Dogodki na kompletu guma so **append-only** (MOUNT, DEMOUNT, MOVE, STORAGE, STATUS)  
✅ 7-stopenjski workflow: `Sprejem vozila → Pregled/ponudba → Potrjeno → Delo v teku → Zaključeno delo → Prevzem in plačilo → Oddano`  
✅ Poraba delov zniža zalogo, ustvari `Order + OrderItem + StockMovement OUT + DRAFT Document + WorkOrderEvent`  
✅ Sledljivost: delovni nalog → vozilo → deli → zaloga → zgodovina  
✅ Ponovni obisk istega vozila → nov nalog, zgodovina raste (`__workOrderIds`)  
✅ Rezervacija se lahko pretvori v delovni nalog (`createWorkOrderFromAppointment()`)

#### 🔧 Avtomehanik (`mehanik`)
**Datoteke:** `registry.ts` (vrstice 680–750)  
**Testi:** Deli testni paket z `tire-service`

✅ Uporablja **isto akcijsko logiko** kot vulkanizer (`vehicle-workshop.ts`, `workshop-booking.ts`)  
✅ Ista razširitev `vehicle-workshop`  
✅ **Razlike:** `reviews: "optional"` (vulkanizer jih nima), druga terminologija, drugačen CTA, sekcija `reviews` vključena v stran

#### 🐝 Čebelarstvo (`beekeeping`)
**Datoteke:** `src/app/actions/apiculture.ts`, `traceability.ts`, `colony-moves.ts`, `direct-sale.ts`, `registry.ts` (vrstice 754–813)  
**Testi:** `traceability.itest.ts` (14 scenarijev), `beekeeping-final-validation.itest.ts` (11 scenarijev), `direct-sale.itest.ts` (7 scenarijev)

✅ Žetev → serije → polnjenje zaloge (`createFillBatch()`, append-only `__fills`)  
✅ Prodaja iz serij, sledljivost izvorov: naročilo → serija → pridelek  
✅ Selitve družin s korekcijskimi dogodki (`createColonyMove()`, `correctColonyMove()`)  
✅ Rekonstrukcija lokacije na izbran datum (`colonyLocationAt()`)  
✅ Kompleksna čebelarska evidenca prek `bee-apiary` razširitve (10 entitet)  
✅ Pravilo: ne mešanje različnih vrst medu v enem polnjenju (`HONEY_TYPE_MISMATCH`)

### 1.3 Že v univerzalnem jedru (deluje za vse profile)

**Dokaz:** `prisma/schema.prisma`, `src/lib/profiles/`

| Komponenta | Modeli / Datoteke | Stanje |
|---|---|---|
| Multi-tenant sistem | `Organization`, `OrganizationMember`, `User`, `CustomRole` | ✅ Popolnoma delujoče |
| Stranke | `Customer` (40 polj, vključno za e-račune) | ✅ Popolnoma delujoče |
| Izdelki in zaloge | `Product`, `ProductVariant`, `StockMovement` | ✅ Popolnoma delujoče |
| Naročila in prodaja | `Order`, `OrderItem`, `PrepaidProduct`, `Promotion` | ✅ Popolnoma delujoče |
| Delovni nalogi in procesi | `WorkOrder`, `WorkOrderEvent`, `WorkflowDefinition`, `WorkflowStage`, `FormDefinition`, `FormSubmission` | ✅ Osnova deluje |
| Generične specializirane entitete | `ExtensionRecord` | ✅ Ključna komponenta |
| Dokumenti in plačila | `Document`, `DocumentItem`, `DocumentPayment`, `CreditNote`, `DocumentSequence`, `DocumentAdvanceAllocation` | ✅ Model obstaja, številčenje deluje |
| E-računi | `EInvoiceSettings`, `EInvoiceChannelConfig`, `EInvoice`, `EInvoiceReceipt`, `EInvoiceDeliveryEvent` | ✅ Modeli obstajajo |
| Sledljivost in zgodovina | `ConfigChangeLog`, `PublicationHistory`, `WorkOrderEvent`, `DocumentEvent` | ✅ Append-only dnevniki |
| Sistem profilov | `registry.ts`, `extensions.ts`, `types.ts`, `modules.ts` | ✅ Deklarativni sistem |
| Transakcijska varnost | `prisma.$transaction` + CAS za zalogo | ✅ V vseh akcijah |
| Org-scoped varnost | `requirePermissionOrg` v vseh akcijah | ✅ IDOR preprečena |

### 1.4 Deklarirano, vendar še ni popolnoma implementirano

| Funkcionalnost | Stanje | Dokaz |
|---|---|---|
| Dobavitelji | ⚠️ Deklarirano v `extensions.ts`, uporabljeno pri 3 profilih, ni `suppliers.ts` akcijske datoteke | `extensions.ts` (vrstica 424): "suppliers/inventory runtime še ni izpeljan" |
| Več poslovnih prostorov | ⚠️ Razširitev `multi-location` deklarirana, ni uporabljena | `extensions.ts`, noben profil je ne omogoča |
| Dokumenti (UI) | ⚠️ Modeli obstajajo, številčenje deluje, vendar ni polne UI podporne za ponudbe/račune | Komentarji v kodi: "Phase 4+ UI" |
| Dostava | ⚠️ `delivery-runtime` deklarirana, ni uporabljena | `extensions.ts` |
| Članstva | ⚠️ `memberships` deklarirana, ni uporabljena | `extensions.ts` |
| Delovni prostor in viri | ⚠️ `workspace-resources` deklarirana, ni uporabljena | `extensions.ts` |
| Dinamične forme (polna UI podpora) | ⚠️ Definicije obstajajo, UI za izpolnjevanje je delno | `FormDefinition`, `FormSubmission` |
| Ocene strank | ⚠️ Akcija `reviews.ts` obstaja, ni integrirana v vse profile | `mehanik` in `beekeeping` imajo `optional` |

---

## 2. UNIVERZALNO POSLOVNO JEDRO – PODATKOVNI MODEL IN FUNKCIONALNOSTI

Na podlagi uporabnikovih arhitekturnih pripomb (A, B, C, D) in dejanskega stanja v kodi.

### 2.1 Načela oblikovanja

**A. Univerzalni sistem sestave in izvedbe (ne samo BOM)**  
BOM je samo ena oblika uporabe. Potreben je sistem, ki podpira:
- Materiale in količine
- Delovne operacije in čas
- Rezervacijo in porabo zaloge
- Odstopanja in dodatno porabo
- Dejanske stroške
- Povezavo z naročilom/delovnim nalogom

**B. Življenjski cikel ≠ vse append-only**  
Razlikujemo:
- **Trenutno stanje** – lahko se spremeni (npr. trenutni lastnik vozila)
- **Zgodovina sprememb** – zaporedje sprememb stanj
- **Poslovni dogodki** – nepovratni dogodki (poraba, izdaja računa)
- **Dokumentirana opravila** – izvedena dela z dokazi
- **Neizbrisljivi revizijski zapisi** – trajni dnevniki za revizijo

**C. Jasna ločitev med delom, prodajo in računovodstvom**  
Celoten tok:  
`Delovni nalog → Ponudba → Potrditev stranke → Izvedba → Obračun → Račun → Plačilo`

- Poraba materiala ≠ izdan račun ≠ plačilo
- Vsaka stopnja je ločena entiteta z lastnim statusom

**D. Ločene funkcionalnosti za podobne profile**  
Skupno jedro je smiselno, vendar ne generični servis za vse. Vulkanizer in mehanik delijo vozilno jedro, imajo pa specifične procese.

### 2.2 Struktura univerzalnega jedra (11 modulov)

```
┌─────────────────────────────────────────────────────────┐
│                  MARKEC UNIVERZALNA PLATFORMA           │
│  Organizacije · Uporabniki · Dovoljenja · Več prostorov │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              UNIVERZALNO POSLOVNO JEDRO                 │
│                                                         │
│  1. Stranke in dobavitelji                              │
│  2. Izdelki in storitve                                 │
│  3. Naročila in prodaja                                 │
│  4. Nabava in zaloge                                    │
│  5. Sestava in poraba                                   │
│  6. Delovni procesi                                     │
│  7. Dokumenti in plačila                                │
│  8. Stroški in analitika                                │
│  9. Zgodovina in sledljivost                            │
│ 10. Obvestila in opravila                               │
│ 11. Več poslovnih prostorov in viri                     │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  🧵 Šiviljstvo │  │  🐝 Čebelarstvo│  │  🔧 Servis    │
│  Specializirani│  │  Specializirani│  │  Specializirani│
│  profil        │  │  profil        │  │  profil        │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 2.3 Podrobnosti posameznih modulov

#### Modul 1: Stranke in dobavitelji
**Že obstaja:** `Customer` model (40 polj)  
**Manjka:** Ekspliciten `Supplier` model (trenutno `ExtensionRecord`)  
**Predlog:** Ustvariti `Supplier` model ali vsaj standardizirati `ExtensionRecord` za dobavitelje s polji: naziv, davčna številka, kontakt, naslov, bančni račun, pogoji plačila.

#### Modul 2: Izdelki in storitve
**Že obstaja:** `Product`, `ProductVariant`, `Category`, `Service`, `ServiceAddon`  
**Manjka:** Koncept "predloge storitve/izdelka" s sestavo (BOM/receptura/paket storitve)  
**Predlog:** Dodati `ProductTemplate` ali razširiti `Product` z možnostjo definicije sestave.

#### Modul 3: Naročila in prodaja
**Že obstaja:** `Order`, `OrderItem`, `PrepaidProduct`, `Promotion`  
**Manjka:** Eksplicitna povezava med delovnim nalogom in naročilom (trenutno implicitno)  
**Predlog:** Očistiti ločitev: `WorkOrder` = naročilo na delo, `Order` = prodajno naročilo izdelkov/storitev.

#### Modul 4: Nabava in zaloge
**Že obstaja:** `StockMovement` (IN/OUT, source, supplierRecordId, batchRecordId)  
**Manjka:** Ekspliciten `PurchaseOrder` (naročilo dobaviteljem), prejem blaga, vračila  
**Predlog:** Dodati `PurchaseOrder` + `PurchaseOrderItem` modele ali standardizirati prek `ExtensionRecord`.

#### Modul 5: Sestava in poraba ⭐ NOVO
**Trenutno:** Dve identični funkciji:
- `consumeMaterialOnWorkOrder()` v `seamstress.ts`
- `sellPartsOnWorkOrder()` v `vehicle-workshop.ts`

**Predlog:** **Univerzalna funkcija** `consumeOnWorkOrder(workOrderId, items, options)` v novi datoteki `src/app/actions/work-order-consumption.ts`:
- Podpira materiale, delovne operacije, čas
- Podpira rezervacijo in dejansko porabo
- Podpira odstopanja in dodatno porabo
- Izračun dejanskih stroškov
- Povezava z delovnim nalogom

**Podatkovni model:** Uporabiti obstoječe `OrderItem` + `StockMovement`, dodati `WorkOrderConsumption` ali uporabiti `ExtensionRecord` za podrobnosti operacij.

#### Modul 6: Delovni procesi
**Že obstaja:** `WorkOrder`, `WorkOrderEvent`, `WorkflowDefinition`, `WorkflowStage`  
**Manjka:** Jasna ločitev med statusom procesa in dejansko izvedbo dela; sledjenje delovnega časa; zgodovina kilometrov; garancije  
**Predlog:**
- Dodati `WorkOrderLabor` za sledenje delovnega časa po zaposlenem
- `WorkOrder.linkedRecordId` že omogoča povezavo na vozilo/čebelnjak/projekt
- Standardizirati `WorkOrderEvent` za vse tipe dogodkov

#### Modul 7: Dokumenti in plačila
**Že obstaja:** `Document` (QUOTE/INVOICE/ADVANCE/CREDIT), `DocumentPayment`, `CreditNote`, `DocumentSequence`, `DocumentAdvanceAllocation`, celoten e-računski sklop  
**Manjka:** Polna UI podpora; jasna povezava v verigi: `WorkOrder → QUOTE → INVOICE → Payment`  
**Predlog:** Implementirati verigo dokumentov:
1. `WorkOrder` → ustvari `Document` tipa `QUOTE`
2. Po potrditvi → `QUOTE` postane osnova za `INVOICE`
3. `DocumentPayment` beleži plačila ločeno od izdaje računa

#### Modul 8: Stroški in analitika
**Že obstaja:** Osnovna analitika v vsakem profilu (`get*Overview()`)  
**Manjka:** Univerzalni izračun stroškov po delovnem nalogu (material + delo + dodatki)  
**Predlog:** Univerzalna funkcija `calculateWorkOrderCosts()` na podlagi porabe in delovnega časa.

#### Modul 9: Zgodovina in sledljivost
**Že obstaja:** `WorkOrderEvent`, `DocumentEvent`, `ConfigChangeLog`, `PublicationHistory`, sledljivost v `traceability.ts`  
**Manjka:** Standardizirani načelni razlikovanja med tremi nivoji zgodovine:
- **Trenutno stanje** – na glavnih modelih (lahko se posodobi)
- **Zgodovina sprememb** – na `*Event` modelih (append-only)
- **Revizijski zapisi** – na `PlatformAuditLog`, `DocumentArchive` (neizbrisljivi)

**Predlog:** Dokumentirati in standardizirati ta tri nivoja v vseh profilih.

#### Modul 10: Obvestila in opravila
**Že obstaja:** `NotificationPreferences`, `PushSubscription`  
**Manjka:** Generični sistem opravil, ki bi ga lahko uporabljali vsi profili  
**Predlog:** Uporabiti obstoječ `ProjectTask` ali ustvariti lažji `Task` model.

#### Modul 11: Več poslovnih prostorov in viri
**Že obstaja:** `ExtensionRecord` z `extensionId: "workspace-resources"` (deklarirano)  
**Manjka:** Celotna runtime podpora  
**Predlog:** Implementirati `Location` model ali standardizirati `ExtensionRecord` za poslovne prostore.

---

## 3. SPECIALIZIRANI PROFILI – KAJ OSTANE V VSAKEM

### 3.1 Načela ločitve

**V jedro gre:**
- Vse, kar je ponovljivo vsaj v dveh panogah
- Vsi poslovni mehanizmi (poraba, dokumenti, plačila, zaloge)
- Vsi generični podatkovni modeli

**V specializirani profil ostane:**
- Specifične entitete (vozilo, čebelja družina, merilni list)
- Specifični poslovni procesi in pravila
- Specifične obrazce in terminologija
- Specifični uporabniški vmesniki

### 3.2 🧵 Šiviljstvo – specializirani del

**Razširitev:** `seamstress-measurements`, `projects`  
**Specifične entitete (v `ExtensionRecord`):**
- `measurement` – merilni list stranke (chest_cm, waist_cm, hips_cm, shoulder_cm, sleeve_cm, inseam_cm, height_cm)
- `sewing-project` – podrobnosti šivanskega projekta
- `fabric` – snov z lastnostmi
- `pattern` – vzorec

**Specifični procesi:**
- 9-stopenjski proizvodni workflow s "Priblonom"
- Meritve kot append-only zgodovina vsakega merjenja
- Povezava med merilnim listom in delovnim nalogom (preprečeno podvajanje)

**Specifične funkcionalnosti:**
- `saveMeasurement()`, `listMeasurements()`
- `createOrderFromInquiry()`
- `resolveSeamstressProvenance()`
- `getOrderProgress()`

**Datoteke:** `src/app/actions/seamstress.ts`, `registry.ts` (vrstice 514–600)

### 3.3 🐝 Čebelarstvo – specializirani del

**Razširitve:** `bee-apiary`, `batch-production`, `suppliers`  
**Specifične entitete (v `ExtensionRecord`):**
- `apiary` – panjska postaja
- `hive` – panj
- `colony` – čebelja družina
- `inspection` – pregled družine
- `treatment` – zdravljenje
- `feeding` – hranjenje
- `queen_management` – upravljanje z maticami
- `task` – opravilo na panjski postaji
- `harvest` – pridelek medu
- `colony_move` – selitev družine
- `batch` – proizvodna serija

**Specifični procesi:**
- Žetev → serija → polnjenje zaloge
- Selitve družin s korekcijskimi dogodki (original ostane nespremenjen)
- Pravilo: ne mešanje vrst medu v enem polnjenju
- Rekonstrukcija lokacije družine na izbran datum

**Specifične funkcionalnosti:**
- `createFillBatch()`, `getHarvestProduction()`, `getBatchAvailabilityForLine()`
- `createColonyMove()`, `correctColonyMove()`, `colonyLocationAt()`
- `resolveOrderProvenance()`
- `createDirectOrder()` z `batchAllocations`

**Datoteke:** `src/app/actions/apiculture.ts`, `traceability.ts`, `colony-moves.ts`, `direct-sale.ts`, `registry.ts` (vrstice 754–813)

### 3.4 🔧 Servis – specializirani del (dva pod-profila)

**Skupna razširitev:** `vehicle-workshop`  
**Skupne entitete (v `ExtensionRecord`):**
- `vehicle` – vozilo (registrska oznaka, VIN, znamka, model, kilometri)
- `tire_set` – komplet gum z dogodki (MOUNT, DEMOUNT, MOVE, STORAGE, STATUS)

**Skupni procesi:**
- 7-stopenjski delovni nalog
- Sprejem vozila (rezervacija ali neposredni prihod)
- Povezava vozila z delovnim nalogom
- Zgodovina vseh posegov na vozilu
- Ponovni obiski istega vozila

---

#### 🔴 Vulkanizer – specifično
**Fokus:** Pnevmatike, skladiščenje, sezonske menjave  
**Specifične funkcionalnosti:**
- Kompleti pnevmatik z dogodki (`recordTireSetEvent()`)
- Dimenzije in globina profila gum
- Sezonska shranjevanje gum
- Menjava, balansiranje, popravilo punkture

**Razlike od mehanika:**
- `reviews: "disabled"`
- CTA: "Rezerviraj menjavo gum"
- Preset storitev: bolj vulkanizerski

---

#### 🔵 Avtomehanik – specifično
**Fokus:** Diagnostika, popravila, servisni intervali, garancije  
**Specifične funkcionalnosti (potrebno dodati):**
- Diagnostika napak in meritve
- Servisni intervali in opomniki
- Kompatibilnost rezervnih delov
- Garancije popravil
- Ocene strank (`reviews: "optional"`)

**Razlike od vulkanizerja:**
- `reviews: "optional"` ✅ ŽE V KODI
- CTA: "Rezerviraj servis" ✅ ŽE V KODI
- Sekcija `reviews` vključena v stran ✅ ŽE V KODI
- Preset storitev: bolj servisno-popravilni ✅ ŽE V KODI

**Manjka:** Specifični modeli za diagnostiko, servisne intervale, garancije.

---

## 4. PRESLIKAVA OBSTOJEČEGA V NOVI MODEL

### 4.1 Tabela preslikave

| Obstoječe | V novi model | Sprememba |
|---|---|---|
| `Customer` | Jedro: Stranke | Ostane, dodati polja za dobavitelje ali ločen `Supplier` |
| `Product`, `ProductVariant` | Jedro: Izdelki in storitve | Ostane, dodati koncept predloge s sestavo |
| `Service`, `ServiceAddon` | Jedro + specializirano | Osnova ostane v jedru, specifične lastnosti v profil |
| `Order`, `OrderItem` | Jedro: Naročila in prodaja | Ostane, ojačati ločitev od delovnih nalogov |
| `StockMovement` | Jedro: Nabava in zaloge | Ostane, dodati `PurchaseOrder` |
| `WorkOrder`, `WorkOrderEvent` | Jedro: Delovni procesi | Ostane, dodati `WorkOrderLabor` za delovni čas |
| `WorkflowDefinition`, `WorkflowStage` | Jedro: Delovni procesi | Ostane |
| `FormDefinition`, `FormSubmission` | Jedro: Delovni procesi | Ostane, izboljšati UI |
| `ExtensionRecord` | Vsi specializirani profili | Ostane kot ključna komponenta, standardizirati sheme |
| `Document`, `DocumentPayment`, itd. | Jedro: Dokumenti in plačila | Ostane, implementirati polno UI in verigo |
| `Project`, `ProjectTask` | Jedro: Obvestila in opravila ali specializirano | Ponovno oceniti, ali naj bo univerzalno |
| `SalonConfig` | Jedro: Konfiguracija | **Preimenovati v `OrganizationConfig`** |
| `consumeMaterialOnWorkOrder()` | Jedro: Sestava in poraba | Refaktorirati v univerzalno `consumeOnWorkOrder()` |
| `sellPartsOnWorkOrder()` | Jedro: Sestava in poraba | Refaktorirati v univerzalno `consumeOnWorkOrder()` |
| `resolveSeamstressProvenance()` | Jedro + profil | Univerzalni del v jedro, profilni del ostane |
| `resolveWorkOrderProvenance()` | Jedro + profil | Univerzalni del v jedro, profilni del ostane |
| `resolveOrderProvenance()` | Jedro: Zgodovina in sledljivost | Že univerzalna, ostane |
| `vehicle-workshop` razširitev | Profil: Servis | Ostane, ločiti vulkanizer/mehanik pod-procese |
| `bee-apiary` razširitev | Profil: Čebelarstvo | Ostane nespremenjeno |
| `seamstress-measurements` razširitev | Profil: Šiviljstvo | Ostane nespremenjeno |
| `suppliers` razširitev | Jedro: Stranke in dobavitelji | Premakniti v jedro ali standardizirati |

### 4.2 Ključne refaktoringske točke

1. **`sellPartsOnWorkOrder()` + `consumeMaterialOnWorkOrder()` → `consumeOnWorkOrder()`**
   - Izvor: `vehicle-workshop.ts`, `seamstress.ts`
   - Cilj: Nova datoteka `src/app/actions/work-order-consumption.ts`
   - Zakaj: Dve funkciji delujeta po istem vzorcu, razlika je le v specifičnih opombah

2. **`SalonConfig` → `OrganizationConfig`**
   - Izvor: `prisma/schema.prisma`, vse reference v kodi
   - Zakaj: Ime je zavajajoče, gre za splošno konfiguracijo vseh profilov

3. **Standardizacija `ExtensionRecord` shem**
   - Vsaka razširitev naj ima jasno definiran JSON shemo v `extensions.ts`
   - Dokumentirana polja za vsak tip entitete

4. **Jasna ločitev WorkOrder → Order → Document → Payment**
   - Vsaka stopnja ima svoj status in ne pomeni avtomatično naslednje
   - Poraba materiala ≠ izdan račun ≠ plačilo

---

## 5. IDENTIFICIRANE VRZELI

### 5.1 V univerzalnem jedru

| Vrzel | Učinek | Prioriteta |
|---|---|---|
| **Ni eksplicitnega nabavnega poslovanja** (PurchaseOrder) | Zaloga se lahko poveča samo ročno ali prek polnjenja serij; ni sledenja naročilom dobaviteljem | P0 |
| **Ni univerzalnega sistema sestave in porabe** | Dve kopiji iste funkcije; težje vzdrževanje; vsak profil implementira zase | P0 |
| **Ni sledenja delovnega časa na delovnem nalogu** | Ni možno izračunati dejanskih stroškov dela; ni evidenca kdo kaj je opravil | P0 |
| **Dokumenti nimajo polne UI podporne** | Uporabnik more ustvarjati račune/ponudbe ročno prek API; ni prijaznega vmesnika | P1 |
| **Ni standardizirane zgodovine po nivojih** | Nekateri podatki so append-only, drugi se pišejo prek; nedoslednost | P1 |
| **Ni podpore za več poslovnih prostorov** | Organizacija z več lokacijami jih ne more ločeno voditi | P1 |
| **Ni univerzalnega sistema opravil** | Vsak profil implementira svoje opravila; ni skupnega pogleda | P2 |
| **Ni jasne verige WorkOrder → Quote → Invoice → Payment** | Povezave obstajajo, vendar niso vsiljene; lahko se izusti koraki | P0 |
| **Ni izračuna dejanskih stroškov po delovnem nalogu** | Ni analize donosnosti posameznega dela | P1 |

### 5.2 V specializiranih profilih

| Profil | Vrzel | Prioriteta |
|---|---|---|
| **Vsi** | Dobavitelji so samo deklarirani, ni runtime | P0 |
| **Servis (mehanik)** | Ni diagnostike napak in meritev | P1 |
| **Servis (mehanik)** | Ni servisnih intervalov in opomnikov | P1 |
| **Servis (mehanik)** | Ni kompatibilnosti rezervnih delov | P2 |
| **Servis (mehanik)** | Ni garancij popravil | P1 |
| **Servis (vulkanizer)** | Ni zgodovine kilometrov vozila | P1 |
| **Vsi z delovnimi nalogi** | Ni zgodovine sprememb statusov z razlogom | P1 |
| **Čebelarstvo** | Workflows so disabled, čeprav bi bile koristne za opravila | P2 |
| **Šiviljstvo** | `projects` razširitev je deklarirana, ni polne runtime podporne | P2 |

---

## 6. VRSTNI RED RAZVOJA (FAZE)

### FAZA 1: OJACANJE JEDRA – OSNOVNI POSLOVNI MEHANIZMI
**Cilj:** Popraviti ključne pomanjkljivosti, ki se pojavljajo v vseh treh analizah. Ne dodajati novih profilov, temveč ojačati skupno jedro.

**Trajanje ocena:** 2–3 tedni  
**Prioriteta:** P0

**Kaj narediti:**

1. ✅ **Univerzalna poraba na delovnem nalogu**
   - Refaktorirati `sellPartsOnWorkOrder()` in `consumeMaterialOnWorkOrder()` v eno univerzalno funkcijo
   - Nova datoteka: `src/app/actions/work-order-consumption.ts`
   - Podpira materiale, delovne operacije, čas, odstopanja, stroške

2. ✅ **Jasna ločitev delov, prodaje in računovodstva**
   - Določiti in dokumentirati verigo: `WorkOrder → QUOTE → INVOICE → Payment`
   - Vsaka stopnja ima svoj status; ni avtomatičnih prehodov brez korisnikove dejanja
   - Popraviti `sellPartsOnWorkOrder()`, da ne ustvarja računa avtomatično (le osnutek ali ponudbo)

3. ✅ **Nabavno poslovanje – osnova**
   - Standardizirati `ExtensionRecord` za dobavitelje (jasna JSON shema)
   - Dodati `PurchaseOrder` koncept (lahko prek `ExtensionRecord` ali nov model)
   - Povezati `StockMovement IN` z dobaviteljem in nabavnim naročilom

4. ✅ **Sledenje delovnemu času**
   - Dodati `WorkOrderLabor` (ali prek `ExtensionRecord`) za beleženje časa po zaposlenem
   - Univerzalna funkcija za dodajanje delovnega časa na delovni nalog

5. ✅ **Standardizirana zgodovina po nivojih**
   - Dokumentirati tri nivoje: trenutno stanje / zgodovina sprememb / revizijski zapisi
   - Popraviti, kjer je trenutno napačno (npr. da se trenutni lastnik vozila ne piše preko zgodovine)

---

### FAZA 2: DOKUMENTI, PLAČILA IN ANALITIKA
**Cilj:** Dokončati dokumentni sistem in dodati stroškovno analitiko.

**Trajanje ocena:** 2 tedni  
**Prioriteta:** P1

**Kaj narediti:**

1. ✅ **Polna UI podpora za dokumente**
   - Ustvarjanje ponudb in računov iz delovnega naloga
   - Pregled, urejanje, pošiljanje dokumentov
   - E-računi že imajo modele, potrebujemo UI

2. ✅ **Veriga dokumentov – implementacija**
   - `WorkOrder` → ponudba → potrditev → račun → plačilo
   - Vsak prehod beleži kdo in kdaj

3. ✅ **Izračun dejanskih stroškov**
   - Univerzalna funkcija `calculateWorkOrderCosts()`
   - Material + delovni čas + dodatki = skupni strošek
   - Osnova za analitiko donosnosti

4. ✅ **Garancije – osnovni model**
   - Univerzalni koncept garancije, ki ga lahko uporabljajo vsi profili
   - Posebna implementacija za mehanika

---

### FAZA 3: SPECIALIZIRANE FUNKCIONALNOSTI SERVISA
**Cilj:** Ločiti vulkanizerja in mehanika ter dodati manjkajoče specifične funkcionalnosti.

**Trajanje ocena:** 2–3 tedni  
**Prioriteta:** P1–P2

**Kaj narediti:**

1. ✅ **Mehanik: Diagnostika in meritve**
   - Novi tip `ExtensionRecord` za diagnostične zapise
   - Obrazec za vnos napak, meritev, rezultatov

2. ✅ **Mehanik: Servisni intervali**
   - Beleženje zadnjega servisa in kilometrov
   - Opomniki za naslednji servis

3. ✅ **Mehanik: Garancije popravil**
   - Povezava med delovnim nalogom in garancijskim rokom
   - Obvestila o potekanju garancije

4. ✅ **Vulkanizer: Zgodovina kilometrov**
   - Beleženje kilometrov ob vsakem obisku
   - Prikaz zgodovine kilometrov na vozilu

5. ✅ **Oba: Kompatibilnost delov** (osnovno)
   - Povezava med tipom vozila in primernimi deli

---

### FAZA 4: NAPREDNE FUNKCIONALNOSTI
**Cilj:** Dokončati manj nujne funkcionalnosti in izboljšati uporabniško izkušnjo.

**Trajanje ocena:** Po potrebi  
**Prioriteta:** P2–P3

**Kaj narediti:**

1. Več poslovnih prostorov (`multi-location`)
2. Univerzalni sistem opravil
3. Dostava in sleditev dostave
4. Članstva in paketi
5. Polna UI podpora za dinamične forme
6. Integrirani sistemi ocen v vse profile, ki jih podpirajo
7. Napredna analitika in poročila

---

## 7. KONKRETNE DATOTEKE IN MODELI ZA VSAKO FAZO

### FAZA 1 – OJACANJE JEDRA

| Sprememba | Datoteke / Modeli | Tip spremembe |
|---|---|---|
| Univerzalna poraba | Nova: `src/app/actions/work-order-consumption.ts`<br>Sprememba: `seamstress.ts` – uporabi novo funkcijo<br>Sprememba: `vehicle-workshop.ts` – uporabi novo funkcijo | Refaktor + nova funkcija |
| Ločitev delov/prodaja/računi | Sprememba: `vehicle-workshop.ts` – `sellPartsOnWorkOrder()` naj ne ustvarja INVOICE ampak QUOTE ali DRAFT<br>Sprememba: `Document` model – očistiti povezave | Popravek obstoječe logike |
| Dobavitelji – standardizacija | Sprememba: `src/lib/profiles/extensions.ts` – jasna JSON shema za `supplier`<br>Nova ali sprememba: akcijska datoteka za dobavitelje | Standardizacija |
| Nabavno poslovanje | Nova: `src/app/actions/purchasing.ts` (ali prek `ExtensionRecord`)<br>Sprememba: `StockMovement` – dodati povezavo na nabavni nalog | Nova funkcionalnost |
| Delovni čas | Nova ali sprememba: `WorkOrderLabor` model ali `ExtensionRecord` shema<br>Nova: `src/app/actions/work-order-labor.ts` | Nova funkcionalnost |
| Standardizirana zgodovina | Sprememba: dokumentacija v `SKILL.md` ali README<br>Sprememba: koda, kjer se trenutno stanje piše preko zgodovine | Popravek + dokumentacija |

### FAZA 2 – DOKUMENTI IN ANALITIKA

| Sprememba | Datoteke / Modeli | Tip spremembe |
|---|---|---|
| UI za dokumente | Nove komponente v `src/app/(dashboard)/documents/`<br>Sprememba: `src/app/actions/documents.ts` – dodati akcije za UI | Nova funkcionalnost |
| Veriga dokumentov | Sprememba: `Document` model – dodati `relatedDocumentId` ali `parentDocumentId`<br>Sprememba: akcije za prehode med statusi | Razširitev obstoječega |
| Izračun stroškov | Nova: `src/lib/work-order-costs.ts`<br>Uporaba: v nadzornih ploščah vseh profilov | Nova funkcija |
| Osnova za garancije | Nova: `Guarantee` model ali `ExtensionRecord` shema<br>Nova: `src/app/actions/guarantees.ts` | Nova funkcionalnost |

### FAZA 3 – SPECIALIZIRANE SERVISNE FUNKCIONALNOSTI

| Sprememba | Datoteke / Modeli | Tip spremembe |
|---|---|---|
| Diagnostika mehanika | Sprememba: `extensions.ts` – dodati shemo za `diagnostic_record`<br>Nova ali sprememba: `vehicle-workshop.ts` – akcije za diagnostiko | Razširitev profila |
| Servisni intervali | Sprememba: `extensions.ts` – dodati shemo za `service_interval`<br>Sprememba: `vehicle-workshop.ts` – beleženje kilometrov in opomniki | Razširitev profila |
| Garancije mehanika | Sprememba: `vehicle-workshop.ts` – uporaba univerzalnega garancijskega sistema | Integracija |
| Zgodovina kilometrov | Sprememba: `vehicle-workshop.ts` – `recordKilometers()` funkcija<br>Sprememba: `getVehicleDetail()` – prikaz zgodovine | Razširitev obstoječe |
| Kompatibilnost delov | Sprememba: `Product` model – dodati `compatibilityRules` (JSON)<br>Sprememba: UI za izbiro delov glede na vozilo | Razširitev |

### FAZA 4 – NAPREDNE FUNKCIONALNOSTI

| Sprememba | Datoteke / Modeli | Tip spremembe |
|---|---|---|
| Več prostorov | Nova: `Location` model ali standardizacija `ExtensionRecord`<br>Sprememba: vsi modeli z lokacijo | Nova funkcionalnost |
| Univerzalna opravila | Sprememba: `ProjectTask` ali nov `Task` model<br>Nova: `src/app/actions/tasks.ts` | Razširitev ali novo |
| Dostava | Nova: `src/app/actions/delivery.ts`<br>Sprememba: `Order` model – dodati dostavne podatke | Nova funkcionalnost |
| Članstva | Nova: `src/app/actions/memberships.ts`<br>Sprememba: `Customer` – dodati članstvo | Nova funkcionalnost |
| Dinamične forme – UI | Nove komponente za izpolnjevanje `FormDefinition`<br>Sprememba: `FormSubmission` – boljša podpora | Izboljšava UI |

---

## 8. ZAKLJUČEK

MARKEC že ima **zelo dobro tehnično osnovo**:
- Multi-tenant arhitektura z izolacijo organizacij
- Generični `ExtensionRecord` omogoča dodajanje novih profilov brez spremembe sheme
- Ključni poslovni modeli že obstajajo (stranke, izdelki, naročila, delovni nalogi, dokumenti, zaloge)
- Transakcijska varnost in IDOR zaščita sta že implementirani
- Trije profili so že delujoče in testirane

**Glavni izziv ni v novih razširitev, temveč v ojačanju univerzalnega jedra:**
- Refaktoriranje podvojenih funkcij v eno univerzalno
- Očistitev ločitve med delom, prodajo in računovodstvom
- Dokončanje dokumentnega sistema
- Dodajanje manjkajočih univerzalnih mehanizmov (nabava, delovni čas, stroški)

**Predlagani vrstni red** izvede isto funkcionalnost samo enkrat v jedru, nato pa jo vsi profili uporabljajo na svoj način. To je ključ do tega, da MARKEC postane res univerzalna poslovna platforma, ne pa zbirka treh ločenih sistemov v eni kodi.

---

**Konec dokumenta – verzija 1.0**
