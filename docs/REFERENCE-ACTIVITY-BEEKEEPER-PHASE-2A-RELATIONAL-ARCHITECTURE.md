# MARKEC — ČEBELARSTVO, FAZA 2A: RELACIJSKA ARHITEKTURA (NAČRT, READ-ONLY)

> Povzetek: študija relacijskega podatkovnega modela za čebelarske evidence in za povezavo
> pridelek→serija→izdelek→zaloga→naročilo→plačilo, PLUS univerzalni mehanizem relacij za vse
> dejavnosti. **Ta faza je samo analiza + načrt; nič ni bilo spremenjeno (koda/shema/baza).**
> Vse ugotovitve so podprte z datotekami/modeli/funkcijami/testi.

---

## 1. Pregled sedanje arhitekture (kako delujejo evidence)

- **Shranjevanje:** vse evidence dejavnosti so v eni org-scoped tabeli **`ExtensionRecord`**
  (`prisma/schema.prisma:1533`) — `id, organizationId, extensionId, entityKey, title, data(Json), customerId?`.
  Vrednosti polj so v `data` JSON; **ni relacije med samimi entitye za evidenčne zapise**.
- **Definicija entitet:** deklarativno v `src/lib/profiles/extensions.ts` (`ExtensionDefinition{id,capabilities,entities[]}`;
  vsaka `ExtensionEntity{key,name,description,fields[]}`, `ProfileFieldDef` v `src/lib/profiles/types.ts:89`).
  Tipi polj so omejeni na `text|textarea|number|date|select|checkbox` (types.ts:81-88), validirani v
  `src/lib/field-validation.ts` (`validateFieldValues` — en sam vir resnice, ki ga deli javni obrazec + records registry).
- **CRUD:** `src/app/actions/records.ts` — univerzalni org-scoped CRUD. Vsaka akcija gre skozi
  `requirePermissionOrg("workorders.manage")`; `entityKey` mora pripadati profil-omogočenemu extensionu
  (`findEntityOwner`); `customerId` preverja isti org (`findFirst where organizationId: org.id`);
  `validateFieldValues` zavrže unknown polja (client ne more injectati).
- **UI:** `src/components/admin/records/records-client.tsx` — popolnoma data-driven (tabs per entity,
  fields v dialog, tabla kolone = 4. non-textarea/checkbox fields). **Zero industry-specific logic.**
- **Kovke (čebelar):** beekeeping profil (`src/lib/profiles/registry.ts:752-812`) omogoča alternative
  `extensions: ["batch-production", "suppliers", "bee-apiary"]` (Phase 1 dodal `bee-apiary` z 9 entitetami).
- **Zaloga/serija/sledljivost:** `StockMovement` (schema:2130) ima `batchRecordId?`→ExtensionRecord
  (SetNull, E2-2), `supplierRecordId?`, `orderId?`. `batch-production` extension vede batch entiteto s
  polji (`batch_code, production_date, quantity_kg, product_type, apiary(text), notes`).
- **Product:** `prisma/product` (schema:1177) — `unit`(default "kos"), `stockQuantity/reservedQuantity`,
  `vatRate` (gross, Slovensko DDV), `forSale/reorderPoint`. **Nima** relacije na serijo/pridelek.
- **Naročila:** `Order` + `OrderItem` (schema:1303). `OrderItem.productId` (Restrict), `variantId?`(SetNull +
  snapshot fields variantName/SKU/price). **Nima** batchId/provenance na vrstici — sledljivost
  prodanega izdelka nazaj do serije po shemi **ne obstaja**.

## 2. Dejanski obstoječi podatkovni modeli (vključeni)

- `Organization`, `OrganizationMember`, `User`, `Customer`,
- `ExtensionRecord` (org-scoped JSON evidence; relacije: `customerId→Customer SetNull`, `linkedWorkOrders`, `stockMovementsAsBatch`, `resourceAppointments`),
- `Product`/`ProductVariant` (org-scoped, zaloga/reserved, single source),
- `StockMovement` (ledger; supplier/batch/order traceability soft-links),
- `Order`/`OrderItem` (status enum PENDING/PAID/COMPLETED/CANCELLED/REFUNDED; item snapshot variant),
- `WorkOrder` (+`linkedRecordId` prek delovnih nalogov).

## 3. Dejanske obstoječe povezave (DOKAZANO — iz sheme/kode)

- ExtensionRecord→Customer: **1:N**, `customerId?`, org-scoped, `onDelete:SetNull`.
- ExtensionRecord→StockMovement(batch supplier): **N:N prek StockMovement** (`batchRecordId?`/`supplierRecordId?`, SetNull soft link).
- StockMovement→Product (Cascade), →Order (SetNull, ko source=ORDER), →ProductVariant (Cascade).
- WorkOrder→linkedRecord: `linkedWorkOrders` (delovni nalog veže record).
- OrderItem→Product(Restrict), →Variant(SetNull + snapshot).
- **NI:** med samimi čebelarskimi evidence entity (apiary→hive→colony→inspection→…) — trenutno le `text` labeli.
- **NI:** Product→batch/harvest; OrderItem→batch/harvest; Customer→družina; zaloga "kozarci medu" ↔ serija kg.

## 4. Manjkajoče povezave (ključne za Faza 2)

| Vz$ | Manjka relacija |
|---|---|
| Panjska postaja → Panj | Panj ima free-text "Panjska postaja", ne ID → ni stabilne navezave |
| Panj → Družina | družina free-text "Panj"; ni enoznačnega (družina se preseli v drug panj — zgodovina ni shranjena) |
| Družina → Pregled/Zdravljenje/Hranjenje/Matica-Rojenje/Opravilo | vse free-text oznake, ne ID reference |
| Pridelek → Panjska postaja / panji / družine | free-text "apiary", ne relacija+nepovezan po panju/družini |
| Pridelek → Serija → Izdelek → Zaloga | nobena direktna relacija (le posredna prek StockMovement batch soft-link); Product nima serije; kg vs. kozarci nerešen |
| OrderItem → Serija | ni (le productId/variantId snapshot) → sledljivost nazaj do serije ni možna |
| Zgodovina premikov družine med panji | ni mehanizma (prev stalin record ali audit) |

## 5. Predlagani relacijski model (deklarativno, brez novih tabel)

### 5.1 Univerzalni `entityReference` field type (najmanj invazivno)
- **Dodati `"entityReference"` v `ProfileFieldType`** (`types.ts`) in `fieldDefSchema` (`extensions.ts`),
  s poljem `referenceTo?: { extensionId: string; entityKey: string }` (ali `entityKey`) → polje v JSON `data`
  shrani **string id univerzalnega `ExtensionRecord`** (isti mehanizem kot `customerId`).
- **Org-scope validacija univerzalno v `records.ts`:** pri shranjevanju reference se `findFirst({ where: { id, organizationId: org.id, entityKey: ref.entityKey } })`;
  če ne obstaja/ni iste org → `INVALID_REFERENCE` (IDOR-onemogoč). `field-validation.ts` samo potrjuje da je string (čisti, client-safe);
  org-check-a je server-side (kot `customerId`).
- **UI:** `records-client.tsx` renderi `entityReference` kot select iz `listExtensionRecordOptions({ entityKey })`
  (org-scoped picker — mehanizem že obstaja); prikaže title + (dodatno) kratek "kdo/kje" (glej §7).
- **Brisanje:** privzeto `SetNull` jezik: če je povezani record izbrisan, naj se referenca razreši (UI pokaže
  "(izbrisano)" in ponudi ponovno izbiro); ali **Restrict opinion** — čebelar ne sme izbrisati panja s povezanimi
  družinami brez odobritve. Priporočilo §8 načrta: **Restrict za podrejene evidence (družina→panj), SetNull za
  produktne sledi** (kot OrderItem.variant) — da se ohrani poslovna zgodovina.

### 5.2 Konkretni čebelarski referenčni graf (predlog)
```
PanjskaPostaja(apiary) 1─N Panj(hive) 1─N Družina(colony)
Družina(colony) 1─N { Pregled(inspection), Zdravljenje(treatment),
                      Hranjenje(feeding), MaticeRojenje(queen_management),
                      Opravilo(task, lahko tudi postaja/panj nastapljivo) }
ZapisPridelek(harvest) ─(apiary id)─ PanjskaPostaja
                       └─(po panjih/družinah) N:M prek harvest_hive (lahko tudi text name za v1)
```
- Polje vrste: vsak entitetni tip dobi id-referenco na "višjo" entiteto (npr. `hive.apiaryId` ref→apiary,
  `colony.hiveId` ref→hive, `inspection.colonyId` ref→colony …). **Referenca je vezana na `ExtensionRecord`**
  → UI picker omejen na records prave (extensionId, entityKey) in org.

### 5.3 Zgodovina selitve družine med panji (rešitev)
- Ohrana **ni** treba mutiramo trenutnega `colony.hiveId` izgubo — doda se **event-record** (npr. nov
  entitetni tip `colony_move` v `bee-apiary`, z `colonyId` ref + `fromHiveId` + `toHiveId` + datum), ali
  append-only v `data`. UI history prikaže zapise `colony_move` kjer `colonyId`=izbrani. Brez nove tabele.
  (Opcija v prihodnosti: audit tabela `EntityEventLog`.)

## 6. Diagram povezav (ASCII)
```
  PanjskaPostaja ─┬─ Panj ─┬─ Družina ─┬─ Pregled
                  │        │           ├─ Zdravljenje
                  │        │           ├─ Hranjenje
                  │        │           └─ Matice/Rojenje
                  │        └─ Opravilo (ali postaja/družina)
                  └─ Pridelek(harvest) ─┬─ (kg/vrsta/datum/postaja)
                                        └─ (N:M panji/družine, opc.)
   Pridelek ──Serija(batch)──>Product──>StockMovement(ledger)──>OrderItem──>Order──>Payment(Stripe)
        (kg)          (lot id)      (single source)   (batchRecordId soft link)  (batchId na item? predlog)
```

## 7. Povezava pridelave, serij, izdelkov in zaloge (podrobno)

Ciljna veriga (univerzalno, verodostojno v obstoječem jedru):
1. **Pridelek** `harvest` (ExtensionRecord) → kg, vrsta medu (select), datum, postaja (ref).
2. **Serija** `batch` (ExtensionRecord) — `batch_code` unikaten v org; veže na harvest/preidel avtom. ali ročno;
   `quantity_kg`. (Obstoja `batch-production` — ohraniti, le dodati `harvestId` ref.)
3. **Polnjenje v pakiranja:** serija (kg) se "polni" v trgovski izdelek (kozarec 250g/450g/…). Predlog:
   polnjenje se zabeleži kot **StockMovement (IN) na Product** z `batchRecordId` → izbere serija; količina v
   **unit izdelka** (kozarec) — pretvorbo kg→kos zaokroži/označi čebelar (ekonomija: 720g → 2×?, zračna omejitve).
   ni vzporednega sistema zaloge — uporabi obstoječi `Product.stockQuantity` + `StockMovement`.
4. **Spremljanje/prodaja:** `Product.stockQuantity/reservedQuantity` se upravljata s stronal bug sistema (atomarna
   rezervacija `reserveStock`, potrditev ob plačilu, SKU/neg-zaloga nemogoča). Prodaja odšteje (kozarec).
5. **Sledljivost prodanega nazaj do serije:** predlog — dodati **`batchRecordId?` (SetNull) na `OrderItem`**
   (mehka ref + snapshot `batchCode`), polnil/stock. To je **eno polje + snapshot** v shemi (kers Faze 2A je
   načrt — v izvedbi zahteva majhno nadgradnjo sheme, potrebno odobritev).
   Alternativno minimalno: sled skozi `StockMovement(orderId,batchRecordId)` — že obstaja za `source:ORDER`;
   OrderItem→serija direkt pa še ne.
6. **Več serij istega izdelka + delne serije + vračila/preklici:** StockMovement je per-item/ledger, kar
   podpira več serij (več IN z različnimi batchRecordId) in vračila (OUT RETURN); preklici naročil sprostijo
   rezervacijo (`checkout.session.expired` → CANCELLED, `releaseStockReservation`). **Kg vs. kozarci** —
   pretvorba ni avtomatska (zaprto moteno), potrebuje uporabniško potrditev ko se izdelka „polni iz serije".

## 8. Univerzalna arhitektura za prihodnje dejavnosti (mehanizem, ne kopije)

**Univerzalno (jedro):** `entityReference` field type + org-scope ref validacija + picker
+ zgodovina (event-entity) — en postopek za:
- Mehanik: `vehicle`→`workOrder.item` (parti) s `entityReference` na `vehicle`; obrazec→račun ohrani kernel.
- Frizer: `customer`→`appointment`→`serviceOccurrence`→`payment`.
- Šivilja: `customer`→`order`→`garment` + `measurement_set` ref.
- Čebelar: ta graf (§5.2).
Ker je vse v `ExtensionRecord` + declarativne entity + isti CRUD/UI — **med dejavnostmi ni podvojitve
sistema**, le drug nabor `extensionId/entityKey` in njihove ref sheme v registryju. Nov `field type` +
`referenceTo` je enkrat v jedru, uporabijo ga vse dejavnosti.

**Specifično ostane dejavnost-specifično:** samo definicije (katera entiteta referira katero), terminologija,
workflows/obrazci — vendar v declarativnem registryju, ne per-org kode.

## 9. Predlagane spremembe uporabniškega vmesnika

- Pri ustvarjanju **panja** → dropdown "Panjska postaja" (picker `entityReference apiary`), ne prosto besedilo.
- Pri **družini** → dropdown "Panj" (+ prikaz trentene postaje iz povezanega panja).
- Pri **pregledu/zdravljenju/hranjenju/matici/opravilu** → dropdown "Čebelja družina"; prikaže "Panj / Postaja"
  trenutnega (iz ref verige).
- **Premik družine:** dialog "Premakni družino v drug panj" — shrani `colony.hiveId` + ustvari `colony_move` event.
- **Pridelek** → dropdown "Panjska postaja" (ref) + prikaže število pridelanih kg, per postaja/datum/vrsta
  (v nadaljevanju agregatni povzetek — Faza 2B).
- **Hitri dostop:** v tabeli recorda link "↗" na povezane zapise (npr. panj → družine ¬ pregledi);
  **zgodovina** gumba (colony → seznam `colony_move` + vse evidence te družine).
- Nekorektno izbrisano ref: UI oznaka "(izbrisano)" + prompt za ponovno izbiro.
- Prazna stanja usmerjajo na naslednji korak (glej Faza 3).

## 10. Varnostne zahteve (IZOLACIJA)

- Vsaka `entityReference` vrednost se POSLOVNO validira v `records.ts` (server) — `findFirst id+organizationId+entityKey`,
  tuj org → `INVALID_REFERENCE`; nobeno ID-ogriljeno neci pom sprejme tuje org (isti vzorec kot `customerId`).
- `requirePermissionOrg` na začetku vsake akcije (fail-closed). Picker (listExtensionRecordOptions) je
  org-scoped.
- Brisanje: Restrict/SetNull politika po načrtu; zgodovina `colony_move` se ohrani (append-only).
- Transakcijsko za zalogo/serijo — obstoječi `tx.order.create` + atomarni SQL (reserve/convert) se ohrani.
- OrderItem→serija ref: soft `SetNull` + snapshot batchCode (kot variant) — izbris serije ne zbriše zgodovine naročila.

## 11. Načrt migracije obstoječih podatkov (Phase 1 besedilne→relacije)

Predlog (v izvedbo šele z odobritvijo):
1. `data` snapshot varnostna kopija (export) pred kakršnim koli transformom + možnost rollback (idempotent,
   re-transforme).
2. **Nobena podatka se ne spremeni samodejno zločesko:** pri prvem odprtem urejanju zapisa, kjer free-text ime
   ujema title obstoječega recorda iste (extensionId,entityKey), se uporabniku ponudi "poveži → izberi iz seznama";
   vnosi, ki NE obvisijo enolično (podvojena ali prazna imena) se **ne povežejo samodejno** — ostanejo razrešiva
   ročno (Seznam dvoumnih).
3. Števec kandidate: primeren je `title` (že znan iz vrst 1/2) + večno oddly.
4. **Stari zapisi** imajo ref null → UI razloži "nepovezano" in ponudi izbiro; ni tihega uničenja.
5. Batch↔Product pretvorba kg: ni avtomatska; čebelar potrdi polnjenje per izdelka (kg→kos), šele nato IN.
6. Test: determinističen E2E — izpiši število nepovezanih, ujemanja; rollback vrača stanje.

## 12. Predvidene spremembe datotek in sheme

- **koda (jedro, enkratno):**
  - `src/lib/profiles/types.ts` — dodati `"entityReference"` v `ProfileFieldType` + `referenceTo?` v `ProfileFieldDef`.
  - `src/lib/profiles/extensions.ts` — `fieldDefSchema` accept `entityReference` + validate `referenceTo`; dodati
    (če še ni) v `bee-apiary` entitet reference polja (`hive.apiaryId`, `colony.hiveId`, `inspection.colonyId`, …)
    in event entiteto `colony_move`.
  - `src/lib/field-validation.ts` — `validateFieldValues` za `entityReference`: potrdi da je string (type-clean).
  - `src/app/actions/records.ts` — v `create/update` server: org-scope check vsake `entityReference` vrednosti
    (pomožna `validateRecordReferences(fields, clean, org.id)`); razširiti `listExtensionRecordOptions({entityKey?})`.
  - `src/components/admin/records/records-client.tsx` — render `entityReference` kot picker (iz `listExtensionRecordOptions`),
    prikaz naslova po reference + "(izbrisano)"; "premakni družino" dialog; history/`↗` gumbi.
  - i18n (`src/lib/i18n/dict/records.ts`) — labeli za ref.
- **shema (majhna nadgradnja, potrebna odobritev — NI izvedeno v 2A):**
  - `OrderItem.batchRecordId String?` + `@relation` (SetNull) + `batchCode String?` snapshot (sledljivost nazaj do serije),
  - `Order`/`OrderItem` — ni potrebno dodatno za trace skozi StockMovement (že obstaja) ampak direktna sled je čistejša.
- brez brisanja/obnove tujih sprememb; `einvoices.ts` nedotaknjen.

## 13. Testni načrt

- **Enote:** `field-validation` (new type) enote (string/invalid), `extensions-e21` nadgradi node z reference (valid schema),
  `records` org-scope ref (valid → save; tuj org ID → INVALID_REFERENCE; neobstoječi ID → INVALID_REFERENCE).
- **Integration (itest):** 2-organizacijska — uporabnik org A dodaja panj ref na postajo org B → zavrnjeno (IDOR).
  ExtensionRecord org B se ne prikaže v pickerju org A.
- **E2E (Playwright, f631):** Faza 4 celovit scenarij — ustvari postajo→panj→družino→pregled→pridelek→izdelek→pakenje→zaloga→naročilo; premik družine → zgodovina; naročilna sled nazaj do serije; drugi org ne vidi.
- **Regresija:** vitest (1325+novi), itest f635 (7/7), tsc.

## 14. Tveganja in odprava

| Tveganje | Odprava |
|---|---|
| Reference z ID zaradi malformiranih/ne-org nbij — IDOR | server-side org-scope check (kot customerId); picker org-scoped; test 2 org |
| Zgodovina selitve izgubljena | `colony_move` append-only event entiteta, ne mutacija |
| Brisanje povezanega zbrisa podatke | Restrict za nadrejene, SetNull+snapshot za produktno sled |
| kg↔kozarec pretvorba kerga nepravilno | ni avtomatska — uporabniška potrditev; dokumentirano (Faza 2B) |
| Vec serij vračila zapleteno | ledger je per-item -> support; testira |
| shema nadgradnja OrderItem — migracija | faza ločena, zahteva odobritev; SetNull + snapshot, rollback export |
| production build blocker (einvoices) | tuji WIP — koordinacija lastnika, zunaj 2A |

## 15. Predlagani vrstni red implementacije (za ločeno odobritev)

1. **Faza 2B — Jedro reference mehanizma** (types/extensions/field-validation/records/records-client + i18n) —
   čebelarske reference v `bee-apiary` (brez sheme). Testi enote+itest 2-org. → čebelar ima prave relacije med evidence.
2. **Faza 2C — Zgodovina selitve + UI** (`colony_move` event entiteta + premik dialog + history). 
3. **Faza 2D — Sledljivost prodaje** (`OrderItem.batchRecordId` + snapshot + shema migracija, z odobritvijo).
4. **Faza 2E — Povzetek pridelka/zaloge** (dashboard agregat + nizka zaloga + prazna stanja).
5. **Faza 3 — deterministični onboarding + kupni E2E**, nato **Faza 4** paketni E2E 20-korakov (izolacija 2 org).

> **Ta faza (2A) ni spremenila nič.** Implementacija (2B naprej) zahteva ločeno izrecno odobritev, ki bo
> obsegala tudi morebitno majhno nadgradnjo sheme (OrderItem.batchRecordId) s predlogom migracije in odobritvijo.
> Priporočam, da naslednja odobrena faza = **2B** (univerzalni `entityReference` mehanizem).