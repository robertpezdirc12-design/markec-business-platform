# MARKEC — TIRE-SERVICE (VULKANIZERSTVO) — IMPLEMENTATION FINAL (2D-1S)

> Druga referenčna dejavnost MARKEC, zgrajena na preverjeni čebelarski arhitekturi (extension records + workflow +
> dashboard + sledljivost + pametni predlogi + org-scope), a z LASTNIM poslovnim znanjem (vozila, pnevmatike,
> delovni nalogi, poraba delov). **Brez spremembe sheme/migracij; tuj WIP in zaščitene datoteke NEDOTAKNJENI.**
>
> **KONČNA OCENA: FINAL PASS — ZAKLJUČENA REFERENČNA DEJAVNOST.**

---

## 1. Kaj je bilo zgrajeno (na obstoječi shemi)

| Področje | Funkcionalnost | Uporabljeni obstoječi modeli |
|---|---|---|
| **A. Vozila** | evidenca vozil + tehnični podatki + povezava s stranko | `ExtensionRecord` (vehicle-workshop/vehicle) + `customerId` + `WorkOrder.linkedRecordId` |
| **A. Zgodovina posegov** | vsi delovni nalogi vozila (vklj. ponovni obiski) | `vehicle.data.__workOrderIds` (append-only) + `linkedRecordId` |
| **B. Pnevmatike/kompleti** | evidenca kompletov + dimenzije/season/tread | `ExtensionRecord` (vehicle-workshop/tire_set) |
| **B. Zgodovina montaže** | montaža/demontaža/selitev/shranjevanje/stanje | `tire_set.data.__tire_events` (append-only, vehicleId/workOrderId/tread/performedBy) |
| **C. Delovni nalogi** | obstoječi 7-stopenjski workflow (checkin→…→closed) + linkedRecordId → vozilo | `WorkOrder`, `WorkOrderEvent`, `WorkflowDefinition` |
| **D. Poraba/prodaja delov** | Order + OrderItem + StockMovement OUT + DRAFT Document{workOrderId, orderId} | `Order`, `OrderItem`, `StockMovement`, `Document`, `nextDocumentNumber` |
| **D. Sledljivost porabe** | work-order → vozilo → deli → zaloga → knjižbe → akter | `resolveWorkOrderProvenance` (Document↔Order↔StockMovement) |
| **E. Dashboard** | Pregled delavnice (kazalniki, vozila, nalogi, zaloga, poraba, montaža) | `getTireServiceOverview` + `listWorkshopOptions` + UI dialogs |
| **Pametni predlogi** | veriga: vozilo → kompleti → delovni nalog → poraba delov | `smart-suggestions.ts` (`ws.vehicle/tireSet/workOrder/parts`), čebelarstvo NESpremenjeno |
| **Navigacija** | "Delavnica vozil" v sidebarju (gated na vehicle-workshop) | `sidebar.tsx` + i18n |

## 2. Sledljivost (osrednja zahteva §5)

Za vsak delovni nalog (`resolveWorkOrderProvenance`):
- **Kateremu vozilu pripada**: `WorkOrder.linkedRecordId` → `ExtensionRecord(vehicle)` (+ `__workOrderIds` za ponovne obiske).
- **Kateri komplet pnevmatik**: `tire_set.__vehicleId` + `__tire_events` (append-only).
- **Katera dela opravljena**: `WorkOrderEvent` (stopenjska zgodovina CREATED/STAGE_CHANGED/STATUS_CHANGED/NOTE).
- **Kateri deli/material**: `Document{workOrderId, orderId}` → `OrderItem`.
- **Kateri zalogovni knjižbe**: `StockMovement OUT (source ORDER, orderId)`.
- **Kdo je delo opravil**: `WorkOrderEvent.actorEmail`.

**Ni vzporednih evidenc** — poraba je realno naročilo (StockMovement je edini vir resnice o zalogi), povezava
nalog↔naročilo prek prave Document povezave (workOrderId+orderId), dokument pa z uporabo obstoječe številčne serije
(`nextDocumentNumber`) — skladno z dokumentnim modulom, **ne** vzporedno številčenje.

## 3. Uporabljene obstoječe povezave (brez novih migracij)

- `WorkOrder.linkedRecordId` (+`@unique`) — prvi nalog na vozilo; ponovni obiski prek `vehicle.data.__workOrderIds` (container zapis — zaradi `@unique` shemske omejitve).
- `Document.workOrderId + orderId` — most nalog↔naročilo.
- `StockMovement.orderId + source ORDER` — knjižbe porabe.
- `nextDocumentNumber` (`src/lib/documents/numbering.ts`) — varna, zaklenjena številka dokumenta.
- `ExtensionRecord.data` JSON (`__tire_events`, `__workOrderIds`, `__vehicleId`) — append-only, `mergeDataPreserveLegacy` varuje.

## 4. Spremenjene/dodane datoteke

**Nove:**
- `src/app/actions/vehicle-workshop.ts` — strežniške akcije (overview, sellPartsOnWorkOrder, resolveWorkOrderProvenance, getVehicleDetail, recordTireSetEvent, createWorkshopWorkOrder, listWorkshopOptions).
- `src/components/dashboard/workshop-parts-dialog.tsx` — poraba delov + montaža gum (client).
- `src/app/(admin)/dashboard/tire-service/page.tsx` — dashboard.
- `tests/integration/tire-service.itest.ts` — 15 itestov.

**Spremenjene (razširitve, ne prepisi tujega):**
- `src/lib/profiles/smart-suggestions.ts` — dodana `ws.*` veriga (čebelarstvo NESpremenjeno).
- `tests/smart-suggestions.test.ts` — +6 testov tire-service verige.
- `src/components/admin/sidebar.tsx` — nav item "Delavnica vozil".
- `src/lib/i18n/dict/common.ts` — `tireService` Slovenščina/Angleščina.

**Nedotaknjeno:** `prisma/schema.prisma`, migracije, `product-checkout.ts`, `stripe.ts`, webhooks.

## 5. Testni rezultati

### Unit
- **1356/1356 PASS** (93 files) — vseh 1356 (tudi čebelarski smart-suggestions 16/16, novi tire-service 6).

### Integracijski (izolirana `markec_e2e_test`)
| Suite | Testov | Rezultat |
|---|---|---|
| `traceability.itest.ts` (čebelarstvo) | 14 | PASS |
| `direct-sale.itest.ts` | 7 | PASS |
| `stock-integrity.itest.ts` | 23 | PASS |
| `onboarding-membership.itest.ts` | 5 | PASS |
| `beekeeping-final-validation.itest.ts` | 11 | PASS |
| `tire-service.itest.ts` (novo) | 15 | PASS |
| **Skupaj** | **75** | **PASS** |

### Tire-service itest scenariji (§7) — vseh 15 PASS
1. stranka + vozilo (linked) · 2. komplet pnevmatik (MOUNT) · 3. delovni nalog ↔ vozilo · 4. stopenjska izvedba +
zgodovina (WorkOrderEvent) · 5. poraba iz zaloge (Order+Document, −4) · 6. prodaja izdelka · 7. provenance
(work-order→vozilo→deli→knjižbe) · 8. zgodovina vozila (getVehicleDetail) · 9. ponovni obisk (append-only) ·
10. sočasna poraba (1 od 2, 10−6) · 11. nedovoljena poraba (INSUFFICIENT_STOCK) · 12. dvojna oddaja (rollback) ·
13. tuji ID-ji (IDOR) · 14. rollback brez delnih · overview org-scoped.

### TypeScript
- `tsc --noEmit` čist (edina napaka tuja `scripts/f631-inspect.ts:40`).

## 6. Browser E2E (port 3002, izolirana baza, org "Svezi Vulkanizer Test")

Dejansko izvedeno v brskalniku:
1. Registracija/prijava vulkanizerja → workspace "Vulkanizer & avtoservis".
2. Sidebar pokaže "Delavnica vozil" → `/dashboard/tire-service` (nov dashboard).
3. Dashboard: kazalniki (Vozila 1, Kompleti 1, Nalogi 0), pametni predlogi (`ws.workOrder` → "Ustvarite prvi delovni nalog").
4. Montaža pnevmatik → MOUNT na vozilo (db: `__vehicleId` + `__tire_events` append-only, performedBy od seje).
5. Delovni nalog #1 obdelan (work-order workflow, linkedRecordId → vozilo).
6. Dashboard nato: "Delovni nalogi 1", predlog naprej (`ws.parts` → "Evidentirajte porabo delov").
7. Poraba 4× Pnevmatika → zaloga **30 → 26** (Order + StockMovement OUT + Document + WorkOrderEvent v db).
8. Provenance v db: WorkOrder#1 → vozilo Škoda → Document{workOrderId,orderId} → Order(4×85) → StockMovement OUT → WorkOrderEvent "Poraba delov: 4 kos → naročilo / dokument 1".
9. **Mobilni 390×844**: dashboard + dialogs + tabele brez preliva.
10. `audit_page`: vsa vnesena polja označena (labelements + selects), 46 pravil PASS; ostaja le že obstoječi
    amber-badge kontrast (app-shell, ne-ta feature).

## 7. Organizacijska izolacija (§6)

Vse akcije `requirePermissionOrg` + org-scope `where`; tuji ID-ji (delovni nalog, pnevmatika, izdelek iz druge
org) → `WORKORDER_NOT_FOUND` / `TIRE_SET_NOT_FOUND` / `NOT_FOUND`. Transakcije (Order+/Document+/StockMovement CF-0),
CAS `stock − reserved >= qty`, rollback ob napaki (brez delnih). Preverjeno v itest #12–14.

## 8. Preostale omejitve / NOT VERIFIED

1. **`WorkOrder.linkedRecordId @unique`** — prvi nalog vozila ga uporabi; ponovni obiski gredo prek
   `vehicle.data.__workOrderIds` (append-only). To ni blokada — zgodovina je polna in trajna. Popolnejša rešitev
   (odstranitev `@unique`) bi zahtevala shemo — **izbrisano kot opcija**, ni potrebna za FINAL PASS.
2. **Poškodovana zaloga / odpis** — ni ločenega `WASTE` vira (kot pri čebelarstvu); odpis gre kot generic OUT MANUAL
   ali inventura. **NOT VERIFIED** kot posebna revizijska sled.
3. Prijava: za E2E sem geslo v testni org hashiral neposredno (bcrypt) in se prijavil skozi brskalniški obrazec;
   "registracija novega podjetja" v celotnem vodenem čarovniku ni bila ponovljena skozi browser v tej fazi (obstaja
   v predhodnih fazah 2D-1H/I), a izbira dejavnosti in workspace sta delovala.

## 9. Merila za FINAL PASS — povzetek

| Kriterij | Status |
|---|---|
| Vozila + pnevmatike + delovni nalogi povezani | **PASS** |
| Poraba/prodaja delov zniža zalogo atomarno, brez dvojnega | **PASS** |
| Sledljivost izvora (nalog → vozilo → deli → zaloga → akter) | **PASS** |
| Dashboard + pametni predlogi (dejansko iz baze) | **PASS** |
| Org izolacija (IDOR fail-closed) | **PASS** |
| Sočasnost, rollback, dvojna oddaja | **PASS** |
| Browser desktop + mobilni 390×844 | **PASS** |
| Čebelarstvo NESpremenjeno, testi še zeleni | **PASS** |
| Brez sheme/migracij/zaščitenih datotek | **DA** |

**KONČNO: FINAL PASS — ZAKLJUČENA REFERENČNA DEJAVNOST (2. v platformi).**

---

# 2D-1V — KONČNA E2E VALIDACIJA: SPLETNE STRANI, OBJAVA, REZERVACIJE, IZOLACIJA

> Dejansko izvedeno v brskalniku (view_page) na testnem strežniku `:3002`, testna baza
> `markec_e2e_test` (localhost:5433). Model »ena platforma, veliko neodvisnih podjetij«.
> **Nič sheme/migracij/produkcije; `markec_dev` nedotaknjen; tuji WIP zaščiten.**
> Stanje po sejanju org (glej `scripts/seed-vulkanizer-complete.ts`) in objavi obeh strani.

## Okolje in preverjene entitete

| | Čebelar | Vulkanizer |
|---|---|---|
| Uporabnik | `cebeler.fresh@markec.test` / `demo1234` (ADMIN) | `cebeler.tire@markec.test` / `demo1234` (ADMIN) |
| Org | `svezi-cebeler-2d1l` (beekeeping) | `svezi-vulkanizer-2d1s` (tire-service) |
| Javna stran | `/s/svezi-cebeler-2d1l` | `/s/svezi-vulkanizer-2d1s` |
| Stanje objave | PUBLISHED | PUBLISHED |

## 1. Javni spletni strani

| Kriterij | Vulkanizer | Čebelar | Opomba |
|---|---|---|---|
| Javni URL + vsebina | **PASS** | **PASS** | Vulkanizer: »Vaše vozilo v najboljših rokah«; čebelar: »Med, kot ga daje narava«. |
| Logotip/fotografije | **PARTIAL** | **PARTIAL** | Obe uporabljata vzorčne (preset) slike dejavnosti (garaza / apiar); lastniške še niso naložene. Objava sproži opozorilo (ne blokada). |
| Opis | **PASS** | **PASS** | Vulkanizer: delavnica/nalog; čebelar: družinsko čebelarstvo + sledljivost. |
| Kontakt | **PASS** | **PARTIAL** | Vulkanizer ima e-pošto+telefon+kraj; čebelar samo e-pošto (`cebeler.fresh@markec.test`) — brez telefona/kraja. |
| Delovni čas | **PASS** | **PASS** | Oba Pon–Pet 9–18, Sob 9–13, Ned zaprto. |
| Lastne storitve/izdelki | **PASS** | **PASS** | Vulkanizer: 6 storitev (javno + cenik); čebelar: 6 izdelkov (trgovina). |
| Rezervacijske možnosti | **PASS** | **N/A (pravilno)** | Vulkanizer ima `/booking`; čebelarski profil ima module terminov **izklopljene** — CTA je »Naroči izdelke« (trgovina). Brez umetnih rezervacij. |
| Dashboard povezava (samo lastnik) | **PASS** | **PASS** | Objavljena stran za neprijavljenega prikaže samo »Prijava« (login?org=…); noben javni dashboard link. |
| Mobilni prikaz (390×800) | **PASS** | **PASS** | UV razporeditev + hamburger brez preliva. |

**Sprememba vsebine ene strani ne vpliva na drugo — PASS.** Dokazano:
- Vsaka org ima **ločen `SalonConfig`** (različen `id`), scoped po `organizationId`.
- Simuliran urejanje vulkanizerjevega `hero.title` je spremenilo samo njegovo vrstico; čebelarjeva live in published vsebina ostaneta nespremenjeni.
- `saveSiteContent`/`publishSite` delujejo prek `requirePermissionOrg("settings.manage")` + `where: { organizationId: org.id }` — org izpeljan iz seje, pisanje org-scoped.
- `publishSite` zamrzne `publishedSiteContent` (snapshot); live spremembe do ponovne objave ostanejo v `siteContent` (prikaz preverjen).

## 2. Rezervacije — vulkanizer (dejanska rezervacija)

Izvedeno skozi javno stran `/s/svezi-vulkanizer-2d1s/booking`:

1. → izbrana storitev **Menjava gum (komplet)** (40 €, 60 min) ✓
2. → specialist **Marko Vulkanizer** ✓
3. → datum **16. november 2026, 09:00** (prosti termini samo znotraj delovnega časa) ✓
4. → podatki stranke: Janez Novak / janez.novak.2d1v@example.com / 041123456 ✓
5. → Oddaja brez spletnega plačila (»potrjena bo po pregledu«) ✓
6. **V pravi organizaciji (DB)**: `Appointment` z `organizationId = vulkanizer`, `startTime = 2026-11-16T08:00:00Z` (=09:00 EU/Lj), status PENDING, 40 €, `customerId` → stranka **Janez Novak** v vulkanizerjevi org. Čebelarjeva org: **0 terminov** (brez puščanja). ✓
7. **Dashboard vulkanizerja**: `Termini: 1`, `Nova rezervacija: Janez Novak`; seznam terminov prikaže termin (16. nov 09:00, V čakanju, 40 €). ✓
8. **Status**: »Potrdi« → **CONFIRMED** (DB + UI); na voljo še Označi kot zaključeno / Ni se pojavil / Prekliči. ✓

### Robni primeri rezervacij

| Primer | Rezultat | Dokaz |
|---|---|---|
| Dvojna rezervacija istega termina | **PASS** | Po potrjenem terminu 09:00 se **09:00 in 09:30** ne prikažeta več (prekrivanje 60-min). Poleg UI se server v `createAppointment` ponovno preveri v `$transaction` pod advisory ključavnico (IDOR-safe). |
| Termini zunaj delovnega časa | **PASS** | Nedelja (15.11.) → »Za ta dan ni prostih terminov« (`slots=[]`); zadnji slot sobotnega kratkega dne omejen na 12:00. |
| Napačni/manjkajoči podatki | **PASS** | Zod validacija (15 `field-validation` testov); gumb »Oddaj« onemogočen, dokler manjkajo Osebje/Datum-stranka. |
| Preprečevanje podvojenega oddaja | **PASS** | `booking-integrity-93` (14 testov): `$transaction` + advisory lock, brez delnih zapisov; tire-service #12 rollback. |
| Rezervacija ne odšteje zaloge | **PASS** | Po rezervaciji Pnevmatika ostane **26** (nespremenjeno); zaloga se zniža samo prek porabe delov na delovnem nalogu (`sellPartsOnWorkOrder`). |

### 3.9 Povezava potrjene rezervacije z vozilom/delovnim nalogom

**PARTIAL / NOT VERIFIED (iz rezervacije).** Sistem podpira:
- delovni nalog ↔ vozilo prek `WorkOrder.linkedRecordId` → `ExtensionRecord(vehicle)` (delavnica vozil),
- dokument `Document{workOrderId, appointmentId}` kot most nalog↔termin,
- **ni pa avtomatske povezave** iz samega javnega rezervacijskega toka: `Appointment` nima `vehicleId`/`workOrderId`, `WorkOrder` nima `appointmentId`. Ustvarjena rezervacija ostane samostojna (vezana na stranko in storitev); mehanik bi delovni nalog za vozilo ustvaril ročno v delavnici. Preverjeno na UI (work order #001 »Brez stranke«, vozilo »Škoda Octavia — LJ-123-AB«).

## 3. Rezervacije — čebelar

**PASS (skladno s profilom).** Čebelarski profil ima module **»Termini in rezervacije, Delovna naročila, Katalog storitev, Zaposleni, Poslovni procesi · izklopljeno«** (poeti iz settings). Njegove rezervacije so zato **korektno odsotne**; uporablja skupno infrastrukturo **trgovine/zaloge** (6 izdelkov, 2 naročili). Ta sklop preverja izolacijo: čebelarjeva org ima 0 terminov in 0 vozil/nalogov. Umetne rezervacijske storitve NISO uvedene.

## 4. Izolacija med podjetjema

- **Čebelar ne vidi vulkanizerjevih podatkov — PASS.** Dashboard čebelarja nima »Delavnica vozil/Delovni nalogi«; direktni `/dashboard/tire-service` → gated: »Aktiviran profil nima razširitve delavnice vozil (vehicle-workshop).«
- **Vulkanizer ne vidi čebelarjevih podatkov — PASS.** Dashboard vulkanizerja nima »Pregled čebelarstva/Sledljivost pridelka«; direktni `/dashboard/apiculture` → gated: »Aktiviran profil nima razširitve čebelarstva (bee-apiary).«
- **Neposredni dostop do tujih ID-jev — PASS.** `verify-dejavi-isolation.ts` (realna baza): branje tujega WorkOrder/ExtensionRecord z org-scope `findFirst` vrne `null` (IDOR fail-closed); članstvo vsakega lastnika samo v lastni org.
- **Spremembe nastavitev/vsebine/delovnega časa ostanejo v lastni org — PASS.** Vse akcije org-scoped (`requirePermissionOrg` + `where: { organizationId }`); ločen `SalonConfig`, `WorkingHours` (staff→org), katalog, stranke.

## 5. Objavljanje

- **PASS** za oba. `publishSite()` (server action) preveri `settings.manage`, zabarje pogoje (kontakt/storitve-osebje za dejavnost), zamrzne snapshot in postavi `publishState=PUBLISHED` + `publishedAt`.
- UI: objava vulkanizerja (»Objavi stran« → DRAFT→PUBLISHED) in čebelarja (DRAFT→PUBLISHED) potrjeni v dashboardu + `Organization.publishState` v DB.
- Po objavi: javni prikaz obeh strani (200, brez »Predogled« nalepke), ločenost vsebin potrjena.
- Opozorilo »Uporabljate vzorčne slike« je **warning**, ne blokada.

## 6. Testi

- **Unit `npx vitest run`: 1356/1356 PASS** (93 datotek) — vključno booking-integrity-93 (14), field-validation (15), publication (12), tenant-proof (40), schema-tenancy (41), guard-rules (19), org-scoped-permissions-f0 (9), site-layout-f63 (10).
- **Itest (izolirana baza `markec_e2e_test`): tire-service 15/15 PASS**, traceability 14/14, onboarding-membership 5/5, beekeeping-final-validation 11/11 → **45 PASS**.
- **Preostali itest-sklopi BLOCKED (okolje)**: `npx vitest run --config vitest.itest.config.ts` ob polni vožnji → 27 datotek FAIL zaradi **manjkajočih fixtures** (`cb@f631.test`, frizer/mehanik tenanti), ki so sejane v drugi bazi `markec_f631_test`, ne v `markec_e2e_test`. To je **nedoslednost testnega okolja, ne regresija produkta** (vsi samostojni, relevantni sklopi PASS). Dokumentirano kot NOT VERIFIED v tej fazi.

## 7. URL-ji in uporabniški tokovi (dejansko preverjeni)

- Javni: `/s/svezi-vulkanizer-2d1s`, `/s/svezi-cebeler-2d1l`, `/…/services`, `/…/booking`, `/…/shop`, `/…/vrsta`.
- Dashboard: `/dashboard`, `/dashboard/appointments`, `/dashboard/work-orders`, `/dashboard/tire-service`, `/dashboard/apiculture` (gated), `/dashboard/settings`.
- Prijava = `cebeler.tire@markec.test` in `cebeler.fresh@markec.test` (geslo `demo1234`).

## 8. Napake/opozorila

- Console: `upgrade-insecure-requests` CSP report-only (neškodljivo, obstoječe), Decimal→Client `Server÷ only plain objects` warning na appointments page, hydration-warning (date) — vse kozmetične, ne vplivajo na delovanje.
- Rezervacija je brez spletnega plačila (Stripe ni konfiguriran) → termin se ustvari PENDING in se potrdi ročno (po zasnovi F5.5.4.5/no-show garancija).

## 9. Preostale omejitve / NOT VERIFIED

1. **booking → work-order vezava**: ni avtomatska (PARTIAL / NOT VERIFIED iz rezervacije).
2. **Mobilni E2E celotnega rezervacijskega toka**: javna stran preverjena mobilno 390×800, a sam *rezervacijski wizard* ni bil izveden do konca na 390 (view_page okolje); označeno NOT VERIFIED.
3. **Vzorčne slike / kontakt čebelarja**: čebelar nima telefona/kraja; obe strani uporabljata preset slike (pred produkcijo zamenjati).
4. **itest-sklopi proti `markec_f631_test`**: fixture-odvisne vožnje NISO pognane v tej fazi (napačna baza) — NOT VERIFIED, ne FAIL.

## Sklep

- **PASS**: obe javni strani (desktop+mobilni), objava obeh, rezervacijski potek vulkanizerja (vklj. DB + dashboard + status), dvojna rezervacija, delovni čas, validacija, brez odštevanja zaloge, izolacija (IDOR + module gate), enako-varovana vsebina, 1356 unit + 45 relevantnih itest.
- **PARTIAL**: logotip/fotografije (vzorčne), rezervacija↔vozilo/delovni nalog (vezava obstaja v delavnici, ni avtomatska), kontakt čebelarja.
- **FAIL**: nič.
- **NOT VERIFIED**: prodaja/plačilo (Stripe off), mobilni rezervacijski wizard do konca, itest-sklopi proti `markec_f631_test`, objava na produkcijskih domenah (prepovedano).
- **BLOCKED**: polna itest vožnja (fixtures na `markec_f631_test`, ne `markec_e2e_test`); direktna `db push` na `markec_dev` ne velja (drift).

**Končni kriterij IZPOLNJEN**: čebelar in vulkanizer na isti platformi samostojno upravljata vsak svoje podjetje (stran, katalog, rezervacije/trgovina, stranke, vozila, delovni nalogi), brez kakršnegakoli prehajanja podatkov med organizacijama.

---

# 2D-1W — REZERVACIJA → VOZILO → DELOVNI NALOG

> **Odgovor na prejšnjo omejitev (2D-1V §9.1):** vezava rezervacije z vozilom in
> delovnim nalogom je zdaj IZVEDENA izrecno (akcija »Ustvari delovni nalog iz
> rezervacije«) — BREZ spremembe sheme, org-scoped, na obstoječi infrastrukturi.

## Arhitektura (schema-free, na obstoječih modelih)

Rezervacija (Appointment), delavnica vozil (2D-1S, vehicle-workshop) in delovni nalogi
(WorkOrder) so povezani **brez novih migracij**, po vzorcu `__workOrderIds` (že uporabljen
v 2D-1S):

- **Vozilo = `ExtensionRecord` (vehicle-workshop/vehicle)**; nosi v `data.__appointments`
  append-only seznam `{ appointmentId, workOrderId?, serviceNames, at }`.
- Rezervacija → vozilo: `linkVehicleToAppointment` poišče po registrski oznaki (org-scoped)
  ali ustvari vozilo, ga poveže s stranko in append-a rezervacijo v `__appointments`.
- Delovni nalog → izvor: `createWorkOrderFromAppointment` ustvari `WorkOrder` (obstoječi
  `WorkOrder` + `linkingRecordId` → vozilo + `customerId` → stranka + `workflow`) in v
  vozilov `__appointments[appointmentId].workOrderId` shrani povezavo nazaj.
- Večkratno ustvarjanje naloga iz iste rezervacije preprečeno: če `WorkOrder` že
  obstaja za ta appointmentId → `ALREADY_CREATED`.
- Rezervacija **nikoli ne odšteva zaloge** — to dela le delovni nalog
  (`sellPartsOnWorkOrder` → Order + OrderItem + StockMovement OUT + Document).

Nove datoteke:
- `src/app/actions/workshop-booking.ts` — server akcije (linkVehicleToAppointment,
  getAppointmentWorkshopInfo, createWorkOrderFromAppointment).
- `src/components/dashboard/workshop-work-order-card.tsx` — kartica »Delavnica vozil«
  na podrobnostih rezervacije (vozila + gumb »Ustvari delovni nalog iz rezervacije«).
- `tests/integration/workshop-booking.itest.ts` — 9 itestov.

Spremenjene (razširjene, ne prepisane):
- `src/components/booking/booking-form.tsx`, `src/app/(customer)/booking/page.tsx` —
  neobvezni podatki o vozilu (`showVehicle` za tire-service/mehanik) → `createAppointment`.
- `src/app/actions/appointments.ts` — po nastanku rezervacije poveže vozilo (org-scoped).
- `src/app/(admin)/dashboard/appointments/[id]/page.tsx` — prikaz karte delavnice vozil.
- `src/lib/interfaces.ts` — `CreateAppointmentData.vehiclePlate/vehicleName`,
  `BookingFormValues.vehiclePlate/vehicleName`, `BookingFormBaseProps.showVehicle`.

## Sledljivost (dokazana v DB)

Pri delovnem nalogu #2 (ustvarjen iz rezervacije #j360ycd9):
- **katera stranka**: `WorkOrder.customerId` → Janez Novak,
- **katero vozilo**: `WorkOrder.linkedRecordId` → VW Golf VII (LJ-123-CDE),
- **iz katere rezervacije**: `vehicle.data.__appointments[].workOrderId` = WO id + dogodek
  `WorkOrderEvent` »Ustvarjen iz rezervacije #j360ycd9 — Menjava gum (komplet)«,
- **katere storitve**: `AppointmentService` (Menjava gum komplet),
- **kateri deli/material**: `OrderItem` na Document(workOrderId, orderId),
- **premiki zaloge**: `StockMovement OUT` (source ORDER, orderId),
- **rezervacija ne odšteva zaloge**: Pnevmatika ostane nespremenjena ob rezervaciji;
  pade le ob porabi delov na nalogu (26 → 24).

## Testiranje (dejansko izvedeno)

### Unit (npx vitest run) — **1356/1356 PASS** (93 datotek, vklj. featur-kode 2D-1W).
### Itest (markec_e2e_test) — **84 PASS**
- `workshop-booking.itest.ts` **9/9 PASS**: vozilo↔stranka↔rezervacija; ni podvajanja vozila
  (ista tablica); PENDING → NOT_CONFIRMED; potrjena → WO + povezava nazaj; podvojen WO →
  ALREADY_CREATED; rezervacija ne odšteje zaloge; poraba delov zniža zalogo (+Order/Document/
  StockMovement); provenance (stranka+vozilo+zlaga+izvor); IDOR (beekeeper org nima nič).
- tire-service 15, traceability 14, onboarding-membership 5, beekeeping-final 11, stock-integrity 23,
  direct-sale 7 → 75 PASS (brez regresije čebelarstva).

### Browser E2E (strežnik :3002)
1. Rezervacija shranjena v vulkanizer org (16.11. 09:00, Menjava gum komplet) ✓
2. Vulkanizer jo potrdi (status CONFIRMED) ✓
3. Stranka + vozilo preverjeno (Janez Novak → VW Golf VII LJ-123-CDE) ✓
4. »Ustvari delovni nalog iz rezervacije« → WO #2 ustvarjen ✓
5. Povezava nazaj (vozilov `__appointments[].workOrderId` + dogodek + kartica v dashboardu) ✓
6. Poraba materiala (2× Pnevmatika) → **zaloga 26 → 24** ✓
7. Zaloga + provenance (Document/Order/StockMovement + izvor) ✓
8. Drugi WO iz iste rezervacije → preprečen (gumb nadomeščen z »Delovni nalog« + ALREADY_CREATED) ✓
9. Izolacija: čebelarska org **0 vozil / 0 nalogov / 0 terminov / 0 strank** ✓
10. Mobilni prikaz 390×800 (dashboard + kartica) ✓

## Izolacija (org-scoped)

Vse akcije `requirePermissionOrg` + `where: { organizationId }`. Vehila in nalogi tudi
pri neposrednih ID-jih iz druge org vmejo null/`APPOINTMENT_NOT_FOUND` (IDOR). Čebelar nikoli
ne dobi zapisa iz vulkanizerjevega sistema.

## Sklep — PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED

- **PASS**: cela sled rezervacija → stranka → vozilo → potrjen termin → delovni nalog →
  deli → zaloga → izvor; izrecna akcija; prepoved podvajanja naloga; rezervacija ne odšteva
  zaloge; org izolacija; mobilni prikaz; 1356 unit + 84 itest.
- **FAIL**: nič.
- **PARTIAL**: avtomatizacija ob potrditvi ni vgrajena — po dogovoru z nalogo je izrecna
  akcija (»Če je mogoče varno avtomatizirati ... Sicer uporabi izrecno akcijo«); vozilo iz
  javne rezervacije se veže le na ne-Stripe poti (`createAppointment` fallback), Stripe
  checkout pot ni razširjena (zaščiten Stripe/webhook) — za vulkanizerja (brez Stripe) ni ovira.
- **NOT VERIFIED**: plačilo prek Stripe (off), Stripe-checkout vozilo-vezava.
- **BLOCKED**: vzporedni itest-sklopi z fixtures na `markec_f631_test` (okolje, ne regresija).

**Ključno**: priporočen najmanjši shemski poseg za trajno, indeksno povezavo
`WorkOrder.sourceAppointmentId` (nullable) ostaja opcija za prihodnost; trenutna
`__appointments` JSON vezava je polna, append-only in zadostuje za sledljivost ter
podvajanje-preprečitev.