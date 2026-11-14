# F5.5.0 — Celovita analiza funkcionalnosti poslovnih modulov

> **Samo analiza obstoječe kode — nobena koda ali Prisma shema ni bila spremenjena.**
> Namen: dokazati, da vsak aktiviran modul predstavlja dejansko delujočo poslovno
> funkcionalnost (ne le navigacijo / prazen dashboard / demo), in določiti prednost
> nadaljnjega razvoja. Brez novih migracij, brez commit/push, WIP drugih nespremenjen.

---

## 1. Seznam modulov iz `src/lib/modules/catalog.ts` (14) + status

Viri: Prisma `prisma/schema.prisma`, strežniške akcije `src/app/actions/*.ts`, UI
`src/app/(admin)/dashboard/*`, javni/staff deli, testi `tests/*.test.ts`.

| # | Modul (id) | Ocena | Povzetek dokazov |
|---|---|---|---|
| 1 | `appointments` — Rezervacije in koledar | **A** | Poln CRUD v `appointments.ts` (create/cancel/reschedule/markNoShow/tip/addons/intake), UI povezan, persist v DB, vezave staff/services/customers, 6+ test datotek. |
| 2 | `services` — Storitve in cenik | **B** | Osnovni CRUD + addons + kategorije + intake delujejo. **Manjka admin CRUD galerije (`ServiceGallery`) in FAQ (`ServiceFAQ`)** — modela obstajata, a ni action/UI upravljanja. |
| 3 | `workOrders` — Delovna naročila | **A** | Poln CRUD; delovni nalog **dejansko napreduje po `WorkflowDefinition` stages** (advanceWorkOrder, adjacent-only, audit event); per-org sequential number; UI + testi. |
| 4 | `shop` — Spletna trgovina | **A−** | Celoten nakupovalni tok: izdelek → košara (Zustand persisted) → Stripe checkout (`createProductCheckoutSession`) → webhook/`verifyProductOrder` → Order PAID + zaloga → StockMovement. Naročila/popusti/darilne kartice. **Vrzel:** `ProductVariant` so v admin/inventory, a NISO v checkoutu (checkout operira le na baznem Product). |
| 5 | `inventory` — Zaloge | **B+** | `StockMovement` (IN/OUT, source MANUAL|ORDER|DELIVERY|STOCKTAKE|RETURN), inventura (`submitStockTake`), prejem dobave (`recordDelivery`), povezava z orderji ob plačilu. Solidno; same-storefront preprocessing delno. |
| 6 | `customers` — Stranke | **B** | Upravljanje živi v `users.ts` kot `customers.manage` (getAdminUsers, tags, notes, birthday, delete z zaščito pri termini/naročilih). **Ni eksplicitnega `createCustomer`** — stranke nastanejo iz rezervacij/registracij/javnih obrazcev. |
| 7 | `staff` — Zaposleni in urniki | **A** | Poln CRUD (create/update/delete/toggle) + staff portal: STAFF vidi lastne termine in jih označi COMPLETED/NO_SHOW. Brez dedicated staff test datoteke. |
| 8 | `analytics` — Statistika in poročila | **A** | Read-only reporting, realni DB KPI-i (`appointment.aggregate`, `order.aggregate`, spremembe ob odstotku), 7 naborov, 2 test datoteki. |
| 9 | `reviews` — Ocene strank | **A** | Poln CRUD; customer mora dejansko imeti COMPLETED termin/naročilo; javna objava na storitvi/portfelju; auto-approve; brez dedicated test. |
| 10 | `forms` — Obrazci in povpraševanja | **B** | Javne obrazce (submit) + admin (list, status, toggle, `createWorkOrderFromSubmission`). **Manjka ekspliciten `createFormDefinition`** — definicije pridejo iz profila (materializacija). |
| 11 | `workflows` — Poslovni procesi | **A−** | Ni lastnega UI zaslona; **v živo** znotraj work-orders (stage editor `updateWorkflowStages` + `createWorkOrder`/`advanceWorkOrder` + `createWorkOrderFromSubmission`). |
| 12 | `documents` — Ponudbe, računi | **A** | Poln CRUD (quote DRAFT→SENT→ACCEPTED/REJECTED, invoice DRAFT→ISSUED→PAID/CANCELLED), per-org **sekvenčno številčenje**, `convertQuoteToInvoice`, print layout. Manjka update/delete; postavke free-form (ne iz OrderItem). |
| 13 | `delivery` — Dostava | **B** | `recordDelivery` (prejem dobave od dobavitelja, source DELIVERY) je del inventory. **Ni samostojnega toka "dostava naročil strankam"** (naslov je le opomba ob checkoutu). Katalog predpostavlja runtime shop širitev, ki na tej podlagi ni polna. |
| 14 | `walkIn` — Walk-in vrsta | **A** | Javna prijava brez računa (ticketCode, brez PII), živi status (WAITING→SERVING→SERVED/LEFT), staff kliči naprej; `src/app/(public)/vrsta/page.tsx`. |

**Zaključek §1:** Od 14 modulov noben ni čist **D (placeholder)** — vsi imajo realno akcijo + persist. **A** = 7, **B** = 6 (delivery najšiblejši). Manjše dopolnitve (B→A) potrebujejo 4 moduli: `shop` (variante v checkout), `services` (galerija/FAQ), `delivery` (dostava kupcu), `customers` (createCustomer).

---

## 2. Podrobnejši dokazi (per modul, iz kode)

### appointments (A)
- Akcije: `createAppointment` (L587), `cancelAppointment` (L1307), `rescheduleAppointment` (L1820), `markNoShowAppointments` (L1575), `updateAppointmentStatus` (L1605), `recordAppointmentTip` (L2030), `getAvailableStaff`/`getAvailableTimeSlots`/`getServiceAddons`, intake (L2108).
- UI: `dashboard/appointments/{page,new,[id]}` v klic ± z ugotovjenimi akcijami; `WaitlistClient`.
- Persist: **realno** (`prisma.appointment.create`, transakcije, validacija org-scoped storitev + pologov/promocij). Ni demo.
- Vezave: Staff, AppointmentService (unique `[appointmentId, serviceId]`), Customer.
- Testi: `booking-addons-92`, `booking-integrity-93`, `booking-resources-e27`, `waitlist-90`, `deposit-rules-79`, `no-show-97`, `i18n/public-booking` + e2e.

### services (B)
- CRUD: `createService`/`updateService`/`deleteService`(zavrne če termini)/`toggleServiceStatus`, **addons** `upsertServiceAddons`, **intake** `setServiceIntakeForm`, kategorije `categories.ts`.
- **Manjkajoča**: `ServiceGallery` in `ServiceFAQ` modela sta v shemi, ampak **ni action/UI** za njuno urejanje (edina uporaba je branje pri migraciji slik `default-media-migration.ts`). Podjetnik ne more dodati galerije del niti FAQ k storitvi.
- Testi: `booking-addons-92`, `integration/f52/categories`, `skd-catalog-f1`.

### workOrders (A)
- `createWorkOrder` postavi v prvo stopnjo aktivnega "order" workflowa (L413-414); `advanceWorkOrder` preverja **sosednje stopnje** (`Math.abs(target.order-current.order) !== 1`→reject), zahtevk mora biti OPEN, v finalno stopnjo → COMPLETED; vsak prehod append `WorkOrderEvent`. `updateWorkflowStages` omogoča urejanje stopenj (remove→fallback z audit).
- UI: `dashboard/work-orders/page` (guard `workorders.manage`) + `[id]/page` + `process-editor-dialog`.
- Testi: `config-history-e25`, `schema-tenancy`, `module-policy-f54`, `modules-f2`.

### workflows (A−)
- Ni samostojnega ekrana; živi v work-orders. `createWorkOrderFromSubmission` (forms.ts L426-507) pretvori javni obrazec → delovni nalog v prvi stopnji + označi PROCESSED. Še vedno poln in povezan.

### shop (A−)
- Tok: košara (Zustand persisted cart-store) → `createProductCheckoutSession` (re-price iz DB, promocije + VAT, guest/logged-in, ustvari PENDING Order) → Stripe session → webhook ali `verifyProductOrder` (PAID, stock decrement + StockMovement v eni transakciji). Offline fallback + gift-card. UI: customer `/shop`, `/cart`, `/checkout/*`, `/my-orders`; admin `/orders`, `/products`, `/promotions`.
- **Vrzel:** `ProductVariant` v checkoutu ni izpostavljen (verifyProductOrder/cart operirata na baznem produktu).
- Testi: `shop/org-hrefs-45`, `shop-deactivated-product-105`, `entry-checkout-65-69`, `retail-inventory-78`, `golden-batch-70-73`, e2e `f-golden-order`.

### inventory (B+)
- `StockMovement` (5 source-ov: MANUAL|ORDER|DELIVERY|STOCKTAKE|RETURN), `createStockMovement` (manual), `listStockMovements` (joins), `submitStockTake` (inventura), `recordDelivery`. Ob plačilu zaloga decrement + StockMovement OUT/ORDER v isti transakciji. UI na `/products` (stock filteri, `stockTone`, `DeliveryDialogButton`).

### customers (B)
- `users.ts` v vlogi customers.manage: read (getAdminUsers, getCustomerLeads, getUserById, getCustomerTotalSpent, tag options), update (tags, birthday, notes, role), delete (org-scoped, z zaščito). **Ni eksplicitnega createCustomer** — stranke nastajajo prek rezervacij/obrazcev. To je namerno (CRM iz podatkov), vendar lastnik ne more ročno dodati stranke brez drugih procesov.

### staff (A)
- CRUD in portal: `getStaffTodaysAppointments` (L651), staff-appointments-list kliče `updateAppointmentStatus(id,"COMPLETED")` in `"NO_SHOW"`. Ni dedicated staff test datoteke.

### analytics (A)
- `getKPIData` (L78) `appointment.aggregate(_sum: depositAmount)`, `order.aggregate(_sum: total)`, counts, distinct customers, `*Change` → UI `Promise.all` v 7 naborov. Read-only (reporting). Testi `analytics-e42`, `analytics-e42b`.

### reviews (A)
- `createReview` (L11): zahteva login, preveri **dejansko opravljen nakup** (COMPLETED appointment/order, L71-95), auto-approve (`isActive:true`), objava na javni storitvi. `getServiceReviews` vrača samo `isActive:true`. Ni dedicated test datoteke.

### forms (B)
- Public `submitPublicForm`, admin `listFormDefinitions`/`listFormSubmissions`/`setSubmissionStatus`/`toggleFormDefinition`/`updateFormDefinition`/`createWorkOrderFromSubmission`. Definicije so materializirane iz profila (ni UI createFormDefinition). Testi `intake-forms-96`, `field-validation`.

### documents (A)
- `createDocument` (DRAFT, per-org sekvenčno številčenje po tipu v transakciji), `changeDocumentStatus` (veljavni, validirani prehodi), `convertQuoteToInvoice`. UI `dashboard/documents` (+ `documents-client`). Izbranje/izbris obstoječih dokumentov ni (le status). Postavke free-form.

### delivery (B)
- `recordDelivery` (inventory) = **prejem dobave od dobavitelja**; ni samostojne logistične "dostave naročil strankam". Naslov ob checkoutu je opomba. Katalog (`dependsOn:["shop"]`, "Dostava naročil (runtime razširitev trgovine)") opisuje več, kot trenutna implementacija ponuja.

### walkIn (A)
- Public join (ticketCode, no PII), živi status, staff `callNextWalkIn` (WAITING→SERVING), `transitionWalkIn`. Javni `/vrsta/page.tsx`. Test `walk-in-98`.

---

## 3. Preslikava dejavnosti (§4) — 34 profilov → delujoči moduli

Princip: vsak od **678 SKD podrazredov** → determinističen profil (`src/lib/skd/profiles.ts`
sekcija/podrazred → sekcijski `skd-*` ali specifičen) → `CapabilityMatrix` → moduli. Ne pregledujemo
678 aplikacij; delamo s 34 profili.

Poudarek na fokusnih dejavnostih (vse iz fokusnih profilov so **A-statusni** moduli):

| Dejavnost | Profil(id) | Required moduli | Optional/fleksibilni | Kvaliteta (statusi) |
|---|---|---|---|---|
| **Frizerstvo** | `frizer` | appointments, services, shop, customers, staff, analytics | reviews, forms, inventory, walkIn | odlična (A) |
| **Kozmetika** | `cosmetica` (in `nails`, `barber`) | enako kot frizer (`salonCapabilities()`: appointments/shop/services/customers/staff/analytics required) | reviews, forms, inventory, walkIn | odlična (A) |
| **Avtoservis** | `mehanik`, `tire-service` | workOrders(+workflows), services, shop, customers, staff, analytics, forms, inventory | appointments (optional), reviews, walkIn, documents | odlična; workOrders A |
| **Šiviljstvo** | `seamstress` | workOrders(+workflows), services, forms, staff, analytics, customers | documents, shop, inventory, walkIn | odlična |
| **Tetoviranje** | SKD **T96.991 → `generic`** (ni lastnega profila; `SKD_PROFILE_EXCEPTIONS`) | customers, analytics (generic) | appointments, shop, forms, reviews | vmesna: generic je "univerzalno" — manjkajo tattoo-specifični termini/workflows (dokumentirano v exceptionu) |
| **Generični SKD** | `generic` | customers, analytics | appointments, workOrders, shop, services, inventory, staff, reviews, forms, workflows | dobra; je fleksibilen |

Opombi pri preslikavi:
- Vsi profile z appointment boolean delijo isti `salonCapabilities()` → **istih A-statusnih modulov**; ni tveganja, da bi profil dobil placeholder modul.
- `tire-service` (vulkanizer) → workOrders/shop/forms — avtoservisna matrika.
- `skd-*` (22 sekcijskih) → ti usmerjajo na generično sestavo (retail → shop, construction → documents/workOrders itd.) — vse zmoduli A/B.

**Zaključek §4:** vsak profil dobi kombinacijo **resnično delujočih modulov** (nobeden ni placeholder).
Edina šibka točka v preslikavi so specifični profili brez lastnega profila (tetoviranje), a dobijo
delujoč generični sistem + evidentirano izjemo (`SKD_PROFILE_EXCEPTIONS`).

---

## 4. Uporabniški procesi (§5) — primeri

### a) Rezervacije (appointments, frizer/kozmetika)
1. **Podjetnik vidi:** koledar terminov, stats, čakalno listo v dashboardu.
2. **Doda:** storitve z dodatski + intake obrazci, termine (administrativno), čakalno listo.
3. **Spremeni:** termin (reschedule), status (CONFIRMED/COMPLETED/NO_SHOW), polog, tip.
4. **Shrani:** `createAppointment` v DB (org-scoped, transakcijsko s pologi/promocijami).
5. **Uporablja pozneje:** zgodovina terminov, stats, revizija, vezi na customer/staff.
6. **Sklop:** AppointmentService ↔ services, staff urniki (WorkingHours), customer.
7. **Stranka:** javna rezervacija terminov (booking), izbira staffa/termina, dodatki, opomniki.

### b) Spletna trgovina (shop)
1. Podjetnik vidi naročila, izdelke, popuste v dashboardu.
2. Doda izdelke (cene, VAT, zaloge, darilne kartice), popuste, offline fallback.
3. Spremeni status naročila, zabeleži plačilo (online/offline).
4. Shrani: Order PAID skozi Stripe/webhook ali `verifyProductOrder`.
5. Uporablja: zgodovina, prihodki (analytics), inventory OUT.
6. Sklop: produkti↔promocije↔zaloga; order↔customer.
7. Stranka: košara + checkout + nakup + `my-orders` pregled.

### c) Delovna naročila (workOrders + workflows, avtoservis/šiviljstvo)
1. Podjetnik vidi delovne naloge s fazami procesa.
2. Doda nalog (iz ročnega ali javnega obrazca → `createWorkOrderFromSubmission`).
3. Napreduje skozi faze (`advanceWorkOrder`, le sosednje stopnje), doda opombe, klice vrsto, zaključi.
4. Shrani: WorkOrder + WorkOrderEvent (audit), per-org zaporedno številčenje.
5. Pozneje: dokumenti iz naloga (quote/invoice), zgodovina.
6. Sklop: WorkflowDefinition stage, customer, events.
7. Stranka/kupec: javni obrazec → povpraševanje → nalog; ni pa javna sledilost posameznega naloga.

### d) Dokumenti (documents)
1. Podjetnik vidi ponudbe/račune s števci.
2. Doda quote (DRAFT), prevede na SENT, odjemalec potrdi → ACCEPTED → convert to INVOICE.
3. Spremeni status (veljavni prehodi). Ne more urediti obstoječega dokumenta (le nov).
4. Shrani s per-org sekvenčnim številom.
5. Uporablja za fakturiranje in zgodovino.
6. Sklop na WorkOrder/customer; postavke free-form.
7. (Ni javnega gledanja dokumenta s strani kupca.)

### e) Staff portal
1. STAFF vidi svoje termine (današnje in prihodnje) neposredno v portal.
2. Označi opravljeno (COMPLETED) ali "se ni oglasil" (NO_SHOW).
3. Urejuje lastni profil in urnike.
4. Vse povezano z realnimi appointmenti (isToContact), ni demo.

---

## 5. Večorganizacijska varnost (§6)

Preverjeno (integracijska suita iz F5.4.2 na `markec_f54_test`, 16/16, ter enotski testi):
- **Ločeni podatki:** vsi modeli org-scoped (`organizationId`), `OrganizationModuleState`
  `@@unique([organizationId, moduleId])`.
- **Permisije ADMIN/STAFF:** modulne akcije so **permission-based in org-scoped**
  (`requireModuleManageOrg` → `getEffectivePermissions(userId, org.id)`, `settings.manage`);
  STAFF z dovoljenjem upravlja svojo org, brez → `UnauthorizedError`.
- **Neposredni strežniški klici:** varnost preverjena v akcijah, ne UI (testi neposredno kličejo
  `setModuleState` in preverjajo required/disabled zavrnitev).
- **Manipulacija organizationId:** resolver veže na lasten org; cross-org dostop nemogoč.
- **Deaktivirani moduli:** `effectiveCapabilities` jih izključi (javni 404 / skritje), podatki
  ostanejo; `reconcileModuleStates` razreši legacy brez brisanja.
- **Ohranitev po izklopu:** izklop ne briše poslovnih podatkov (samo kapabilnostni vhod ugasne).

---

## 6. Manjkajoče funkcije / odprte vrzeli (zbrane)

| Modul | Vrzel | Vpliv |
|---|---|---|
| `services` | Galerija (ServiceGallery) in FAQ (ServiceFAQ) brez admin CRUD | Podjetnik ne more urediti galerije/FAQ |
| `shop` | `ProductVariant` niso izpostavljeni v checkoutu | Stranka ne more kupiti variante (velikost/barva) |
| `delivery` | Ni logistične "dostave naročil strankam" (le prejem zaloge) | Opis kataloga presega implementacijo |
| `customers` | Ni eksplicitnega `createCustomer` (le nastajanje iz procesov) | Lastnik ne more ročno vnesti stranke |
| `documents` | Ni update/delete obstoječega dokumenta; postavke free-form (ne iz OrderItem) | Manj priročna fakturizacija |
| `forms` | Ni eksplicitnega `createFormDefinition` v UI (samo materializacija) | Omejena filtracija obrazcev |

---

## 7. Prednostna razvrstitev (§7)

### Pripravljeni (A) — dobra podlaga
appointments, workOrders(+workflows), staff, analytics, reviews, documents, walkIn, shop (core)

### Manjše dopolnitve (B → A)
1. **shop** — izpostavi ProductVariant v checkoutu (velik vpliv, majhen napor).
2. **services** — admin CRUD za galerijo `ServiceGallery` in FAQ `ServiceFAQ`.
3. **customers** — dodaj `createCustomer` (with duplicate-screening). 
4. **documents** — omogoči edit dok. + import postavk iz OrderItem/WorkOrder.

### Večji razvoj
5. **delivery** — poveži "dostava naročil strankam" (naslov + status + sledljivost) s shop
   ukupno, ali pa jasno razmeji (prejem dobave je inventory; dostava kupcu je ločen tok).

### Placeholderji — ni (noben modul ni D); najnižja nujnost
- Vsi drugi so funkcionalni; placeholderji niso identificirani.

### Predlagan vrstni red (po dejanski koristnosti podjetniku)
1. **variants→checkout** (`shop`) — takoj dvigne uporabnost trgovine.
2. **gallery/FAQ admin** (`services`) — podjetniki lepotnih panog najbolj cenijo galerijo del.
3. **createCustomer** — osnova CRM.
4. **documents edit+items** — fakturizacija.
5. **delivery (dostava kupcu)** — za panoge z blagovnim tokom (retail); sicer nebistveno.

---

## 8. Sprejemni kriteriji (za naslednjo fazo — pred odobritvijo)

- [ ] Vsak od 14 modulov ima poln glavni poslovni tok, UI povezan s strežniško akcijo, podatki
      persistirani prek Prisma.
- [ ] services galerija/FAQ uredljiva; shop variants v checkoutu; customers create; documents
      edit; delivery pojasnjen.
- [ ] Brez novih podatkovnih migracij, če je mogoče (ali z označeno, odobreno fazo).
- [ ] Org-scoped + permission-based varnost ohranjena; audit log vsake modulne spremembe.
- [ ] Enotski in integracijski testi za novo dodano funkcionalnost.

---

## 9. Zaključek

F5.5.0 dokaže, da je **osrednje jedro modulov dejansko funkcionalno** (A in A− za večino
pomembnih modulov), noben modul ni placeholder. Vse, kar podjetnik aktivira, pokriva realen
poslovni proces s persistenzijo, UI-jem in org-scopingom. Naslednja faza naj se osredotoči na
najširšo koristnost za podjetnika: variants→checkout, galerija/FAQ, createCustomer in documents
izboljšave. Pričakam odobritev F5.5.1 za implementacijo.