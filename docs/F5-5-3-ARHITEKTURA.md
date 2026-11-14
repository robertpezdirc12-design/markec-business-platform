# F5.5.3.0 — Arhitekturna analiza upravljanja strank

> **Samo analiza obstoječe kode — nobena koda ali Prisma shema ni bila spremenjena.**
> Namen: ugotoviti, kaj CRM/manage customer že imamo, kaj manjka, ter pripraviti
> podatkovni model in uporabniški tok za enoten zaslon »Moje stranke«. Brez
> implementacije, brez produkcijskih migracij, brez commit/push, WIP drugih
> nespremenjen.

---

## 1. Povzetek: kaj ŽE obstaja

Obstaja **org-scoped, relacijski model strank** nad `Customer` + povezanimi
poslovnimi entitetami. Ni pa **enotnega CRM-vmesnika** za podjetnika: stranke so
razpršene po ločenih modulih (users/leads, workorders, records, documents),
manjka ročni `createCustomer`, manjka straniški pogled »stranka« s povezano
zgodovino.

### 1.1 Model `Customer` (org-scoped)
```prisma
model Customer {
  id             String   @id @default(cuid())
  name           String
  email          String?
  phone          String?
  notes          String?  @db.Text          // poslovne opombe
  tags           String[] @default([])      // #91 proste oznake (segmenti)
  dateOfBirth    DateTime?                  // #95 rojstni dan (datum)
  userId         String?  @unique           // 1:1 na User (če registriran)
  organizationId String?                    // ORG-SCOPED (Cascade brisanje)
  // relacije: appointments[], orders[], prepaidPurchases[],
  //           formSubmissions[], workOrders[], documents[], projects[],
  //           extensionRecords[]
  @@index([userId]) @@index([organizationId]) @@index([email]) @@index([phone])
}
```
- Vsaka stranka pripada **natanko eni organizaciji** (`organizationId`) — to že
  zagotavlja §4 (ločevanje iste osebe med podjetji): podjetje A in B imata svoji
  vrstici, ni globalnega profila.
- Ista oseba ima **ločeni `Customer` v vsakem podjetju** (ali je povezana na
  isti `User` prek `userId`, a vsak `Customer` ima svoj `organizationId`). To je
  pravilna zasnova — ni prečnega CRM profila, podatki podjetja A niso vidni B.

### 1.2 Model `User` (račun) — CLIENTE in zaposleni
- `User` (globalni račun) ima 1:1 `customer?: Customer?` (če je vlogo CLIENTE).
- `User.role`: ADMIN / STAFF / CLIENTE.
- Ista oseba je lahko **stranka v več podjetjih** — vsako podjetje ima svoj
  `Customer` (org-scoped); `User` povezuje njihove račune, ne pa prečnega profila.
- `User` je lahko tudi **zaposlen v več org** (`staffs[]`), ali član več org
  (`memberships[]`) — F2.3.1 multi-org.

### 1.3 Permissions — dovoljenja za stranke
- Samo en ključ: **`customers.manage`** (»Urejanje strank«), v skupini »Stranke
  in osebje«.
- Privzeto: **ADMIN in STAFF dobita VSE ključe** (`ALL_PERMISSION_KEYS`), razen
  če jih lastnik omeji s **custom role** (G8) — takrat samo ekspliciten set.
- `requirePermissionOrg("customers.manage")` je org-scoped (IDOR varno).

### 1.4 Obstoječe customer actions
- `src/app/actions/customers.ts`: samo `getCustomers()` (read-only seznam).
- `src/app/actions/users.ts`:
  - `getCustomerLeads(search?, tag?)` — stranke brez računa, iskanje po ime/
    e-pošta/telefon, števci terminov/naročil/obrazcev.
  - `getCustomerTagOptions()` — unikat oznak za filtre.
  - `updateCustomerTags(customerId, tags)` — org-scoped, whitelist sanitizacija.
  - `updateCustomerBirthday(customerId, dateOfBirth)`.
  - `updateCustomerNotes(userId, notes)` — opombe prek **userId** (ne customerId).
  - `getCustomerTotalSpent(customerId)` — vsota COMPLETED terminov + PAID/COMPLETED naročil.
- **NI `createCustomer`** (klic iz F5.5.0) — ni ročnega dodajanja strank v UI.

### 1.5 Kako se stranke ustvarjajo danes (§3)
| Vir | Danes | Dedup |
|---|---|---|
| **Rezervacija gosta** (appointments.ts) | Registered user → `User.customer`; guest z email → poišči po email; guest z imenom → ustvari novo stranko | Dedup **samo po e-pošti**; gost **brez emaila** ustvari novo stranko vsakič |
| **Spletno naročilo** (product-checkout.ts) | session+user → `User.customer`; gost → `resolveGuestCustomerId` | **E-pošta** (case-insensitive) = nedvomna identiteta; **telefon SAMO če se ujema ime**; sicer čisto gost (customerId=null), kontakt ostane na gostovih poljih |
| **Registracija** (auth.ts registerUser) | ustvari User+C ustvari Customer; poveže obstoječi Customer brez userId (po email) | Poveže po e-pošti (globalno, brez org filtra) — ohrani zgodovino |
| **Ročni vnos** | **NI** | — |
| **Povpraševanje/obrazec** (forms.ts findOrCreateCustomer) | ustvari Customer (email/phone) | Dedup po **email OR phone** (natančno ujemanje, ne po imenu) |
| **Walk-in** | ustvari le `WalkInEntry` (name+phone, **brez customerId**) | NI povezave na Customer |

**Ključno za §3:** checkout in forms imata že PRAVILNO, varno politiko dedup
(email = identiteta; telefon sam ni dovolj; ni združevanja po podobnem imenu).
Rezervacija gosta in walk-in pa lahko ustvarita ali podvojena imena (gost brez
emaila), ali sploh ne povežeta (walk-in). To je treba uskladiti proti skupnemu
»identity resolverju«.

### 1.6 Zgodovina/opombe/dokumenti — obstoječe povezave
- **Termini**: `Appointment.customerId` (COMPLETED = zgodovina obiska).
- **Naročila**: `Order.customerId` + `guestName/Email/Phone` (gost). `OrderItem`.
- **Dokumenti**: `Document.customerId` (QUOTE/INVOICE, SET NULL), `DocumentItem`.
- **Delovna naročila**: `WorkOrder.customerId` (avtoservis).
- **Projekti**: `Project.customerId` (tetoviranje/šiviljstvo).
- **Obrazci**: `FormSubmission.customerId`.
- **Prepaid**: `PrepaidPurchase.customerId` (darilni boni/paketi).
- **Records/extensions**: `ExtensionRecord.customerId` (vozila, mere — del F5.x
  extension sistema).

---

## 2. Manjkajoče funkcije (F5.5.3)

| Funkcija | Stanje | Opomba |
|---|---|---|
| Enoten zaslon »Moje stranke« | **MANJKA** | Zdaj: `users` page (leads+users) ločeno od workorders/records/documents |
| Ročno dodajanje stranke | **MANJKA** | ni `createCustomer` + ni UI |
| Urejanje kontaktov (ime/e-pošta/telefon) | **MANJKA** | ni updateCustomer (le tags/birthday/notes) |
| Iskanje + filtriranje | DELNO | `getCustomerLeads(search, tag)`; ni filtriranja po statusu/segmentu/obisku |
| Zgodovina rezervacij na stranko | DELNO | števec obstaja; ni seznama terminov na strani stranke |
| Naročila in nakupi | DELNO | `getCustomerTotalSpent`; ni seznama naročil na strani stranke |
| Povezani dokumenti | **MANJKA** | ni vpogleda documentov na strani stranke |
| Poslovne opombe | DELNO | `notes` polje, a urejanje prek `userId` (ne deluje za leads) |
| Povezovanje s storitvami | DELNO | `AppointmentService`/`appointments`; ni agregiranega pogleda |
| Arhiviranje stranke | **MANJKA** | ni `isArchived`; brisanje ni definirano |
| Varen izvoz podatkov + zahteve za zasebnost | **MANJKA** | ni GDPR izvoz/izbris oblike |
| Dedup / identity resolver | DELNO | checkout+forms imata varno politiko; rezervacija/walk-in ne |
| Walk-in → stranka | **MANJKA** | WalkInEntry nima customerId |
| Preventid dvojnike | DELNO | email-varna; gost brez emaila → dvojniki |
| Delegirani ADMIN/STAFF dostop s granularnimi pravicami | DELNO | samo `customers.manage` (vse-v-nič) |

---

## 3. Predlagani podatkovni model (za F5.5.3.1)

Ne uvajamo globalnega CRM profila — ostanemo na **org-scoped `Customer`** in le
**razširimo** obstoječi model. Minimalne spremembe:

### 3.1 `Customer` razširitev (neobvezno, samo nove potrebe)
```prisma
model Customer {
  // obstoječe ...
  isArchived   Boolean @default(false)   // arhiviranje (ne brisanje)
  archivedAt   DateTime?
  // (izvoz/zahteve gredo skozi akcije, ne nove tabele)
}
```
- Arhivirane stranke izginejo iz glavnega seznama (filter), a zgodovina (ni
  brisana) ostane nedotaknjena.
- Brez globalnega merge-a: spajanje strank se izvede le prek uporabnika z IDOR-varano
  akcijo, ko potrdi ujemanje (ne samodejno po imenu).

### 3.2 Enotni »customer identity« resolver (skupna logika)
Vzorec že obstaja v `lib/checkout/guest-identity.ts` (`resolveGuestCustomerId` +
`guestIdentityMatches`). Predlog: izločiti v skupno jedro `lib/customers/identity.ts`
(PURE, brez server-only) in ga uporabiti v **vseh** virih:
1. **E-pošta** (case-insensitive) = nedvomna presodba identitete.
2. **Telefon** SAMO ob ujemanju imena (ali če stranka nima emaila) — NI samostojen.
3. Sicer brez tihoge združitve — ni pisanja v obstoječi zapis.
To popravi: rezervacija gosta (danes po email samo), walk-in (nima customerId),
in prepreči dvojnike brez vsiljenega spajanja ljudi po podobnosti (§3).

### 3.3 Walk-in → Customer (opcijska povezava)
```prisma
model WalkInEntry {
  // ... obstoječe ...
  customerId String?   // ko se poistoveti; NE avtomatsko
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
}
```
Walk-in gost se NE poveže samodejno (zasebnost) — lastnik lahko stranko ročno
ustvari/poveže iz vstopa.

### 3.4 Opombe: uskladiti `notes` na customerId (ne userId)
`updateCustomerNotes` danes uporablja `userId` (ne deluje za leads brez računa).
Predlog: preusmeriti na `customerId` + org-scoped, da velja za vse stranke
(tako leads kot registrirane).

---

## 4. Uporabniški tok (§2 — enoten zaslon »Moje stranke«)

1. **Podjetnik odpre »Stranke«** v dashboardu → celoten seznam stranke (leads +
   registrirani) s iskalnikom (ime/e-pošta/telefon), filtri (segment/oznaka,
   arhiv, zadnji obisk), števci terminov/naročil, skupna poraba.
2. **Ročno dodaj stranko** (`createCustomer`) → dialog z ime/e-pošta/telefon/
   opombe/rojsni dan/oznake (org-scoped, IDOR).
3. **Odpira podrobnosti stranke** → nova stran `/dashboard/customers/[id]`:
   - kontakt + oznake + rojstni dan;
   - **zgodovina rezervacij** (seznam terminov s statusom; COMPLETED = obiski);
   - **naročila in nakupi** (seznam Order + OrderItem, zneski);
   - **povezani dokumenti** (QUOTE/INVOICE) in delovna naročila/projekti;
   - **opombe** (uredljive, org-scoped);
   - **gumbe**: arhiviraj, izvozi podatke (GDPR), poveži z User računom.
4. **Arhiviraj/odarhiviraj** — ne briše; zgodovina ostane.
5. **Izvoz podatkov** → podjetnik prenese JSON/CSV strankinih podatkov ob
   zahtevi stranke (GDPR); **brisanje/anonimizacija** ob zahtevi za zasebnost —
   označi deletedAt / anonimizira kontakt, ohrani zgodovino.
6. Vse občutljivo (opombe, zgodovina, izvoz) gredo skozi **customers.manage**
   (+ po želji podrobnejši custom role).

---

## 5. Dejavnostne razširitve (§5) — ena osnova, pogledi po dejavnosti

Uporabimo **skupni `Customer`** + obstoječe povezane entitete; profilno
specifične podatke (vozila, mere, tretmani…) hranimo prek obstoječega
`ExtensionRecord` sistema in le prikažemo glede na dejavnost. Ne gradimo petih
CRM sistemov.

| Dejavnost | Zgodovina/obiski | Opombe | Posebni podatki (prek ExtensionRecord) |
|---|---|---|---|
| Frizerstvo | `Appointment[COMPLETED]` + `AppointmentService` | `notes` | (brez posebnih) |
| Kozmetika | termin skupaj s `AppointmentService` | `notes` | lično beleženje tretmanov / kože |
| Avtoservis | `WorkOrder` + servisna zgodovina | `notes` | **vozila** (`ExtensionRecord` entity »vehicle«) |
| Šiviljstvo | `Order` + dobavni roki | `notes` | **mere** (`ExtensionRecord` »measurement«) |
| Tetoviranje | `Project` + termin skupaj (postopki) | `notes` | projekti, faze |

Ključno: `Customer` + standardne relacije = **skupna osnova**; profili z dodatnimi
podatki uporabijo že obstoječi **`ExtensionRecord`** sistem (org-scoped,
entity-key hramba), ne novih tabel za vsako panogo.

---

## 6. Organizacijska izolacija in zasebnost (§4)

- **Ista oseba v dveh podjetjih**: dva `Customer` (vsak s svojim `organizationId`);
  `User` lahko povezuje račune, a `getCustomerLeads`/`getCustomers`/notes zgodovina
  gredo SAMO skozi `where organizationId = org.id`. Podatki A niso dostopni B.
- **Ni globalnega CRM profila** — to je zavestna odločitev: ne razkrivamo prečno.
- **STAFF**: privzeto vidi vse strank (ALL_PERMISSION_KEYS). Za omejitev (opombe,
  izvoz, dokumenti) naj lastnik uporabi **custom role** z eksplicitnim setom.
  Predlagamo (za F5.5.3.1) granularnejše ključe, npr.:
  - `customers.manage` (ročni CRUD, oznake),
  - `customers.view` (pogled/natančen pregled — brez opomb/izvoza),
  - `customers.export` (GDPR izvoz),
  - `customers.notes` (branje/pisanje opomb).
- **Brisanje**: arhiviranje je privzeto; popolno brisanje samo ob jasni GDPR
  zahtevi, z omejenimi pravicami in z ohranitvijo vezane zgodovine (SetNull ali
  anonimizacija), nikoli samodejno.
- **IDOR**: vse akcije `requirePermissionOrg` + `where { id, organizationId }`;
  tuji `customerId` → NOT_FOUND (fail-closed). To ŽE velja za tags/birthday/total.

---

## 7. Migracije in obstoječi podatki (§6)

- **Brez produkcijskih migracij v F5.5.3.0** (analiza). Za F5.5.3.1:
  - nova migracija: `Customer.isArchived`, `archivedAt`; `WalkInEntry.customerId`
    (opcijsko, SET NULL).
  - **Izbirno**: tabela `CustomerMerge` (sled spajanja strank) — ni nujna v 1. valu.
- **Obstoječi zapisi**: `Customer` ostanejo nespremenjeni; njihove relacije
  (appointments/orders/documents/workOrders/projects/formSubmissions/prepaid)
  že obstajajo — ni podatkovne selitve, le novi pogledi/akcije.
- **Ne združujemo obstoječih strank samodejno** — vse spajanje prek ročne,
  IDOR-varane akcije po potrditvi identitete (email ali email+telefon+ime).
- **Več računov iste osebe**: ne brišemo, ne spreminjamo relacij globalno.

---

## 8. Varnostna matrika (F5.5.3.1 sprejemni testi)

| Test | Pričakovanje |
|---|---|
| Prijava kot ADMIN ustvari stranko ročno | PASS (createCustomer, org-scoped) |
| IDOR: B zahteva stranko A | 404 / NOT_FOUND |
| STAFF brez custom role vidi/upravlja stranke | odvisno od permission-ključa (privzeto DA) |
| STAFF z omejeno vlogo ne vidi opomb/izvoza | odvisno od granularnih ključev (F5.5.3.1) |
| Ista oseba v A in B — sprememba v A ne spremeni B | PASS (dva Customer) |
| Dedup: checkout brez tihoge merge po imenu | PASS (obstoječe guest-identity.ts) |
| Rezervacija gosta brez emaila ne ustvari dvojnika vsakič | FAIL danes → FIX v identity resolverju |
| Walk-in se ne poveže samodejno, a lastnik lahko poveže | FIX F5.5.3.1 |
| Arhiv ne izbriše zgodovine | PASS po implementaciji |
| GDPR izvoz + zahteva za izbris | PASS po implementaciji |

---

## 9. Priporočeni vrstni red implementacije (F5.5.3.1)

1. **Skupni identity resolver** (`lib/customers/identity.ts`) — PURE; popraviti
   rezervacijo gosta in omogočiti walk-in povezavo; nadomestiti ad-hoc email/OR
   v appointments/walk-in. (Popravi dvojnike, ne razkrije podatkov.)
2. **`createCustomer` + `updateCustomer` + `archiveCustomer` akcije** (org-scoped,
   IDOR, sanitizacija) + uskladiti `updateCustomerNotes` na customerId.
3. **Enoten »Moje stranke« seznam** (`getCustomers` razširjeno z iskanjem,
   filtri, števci, porabo) + UI stranke (list).
4. **Podrobnosti stranke** (`/dashboard/customers/[id]`): kontakt, oznake,
   opombe, zgodovina terminov, naročil, dokumentov, workorders/projekti.
5. **GDPR izvoz** (JSON/CSV) in **arhiviranje/odarhiviranje**.
6. (Izbirno) granularni permission ključi (`customers.view/export/notes`) +
   vztrajnost custom role v UI role editorju.
7. Integracijski testi (f553 suita na ločeni bazi) + brskalniška kontrola.

---

## 10. Zaključek

Obstaja trden **org-scoped `Customer` + relacije** (termini, naročila, dokumenti,
delovna naročila, projekti, obrazci, prepaid) in **varna identity-politika** v
checkoutu/forms. Manjkata pa: **enoten »Moje stranke« UI, ročno dodajanje
(`createCustomer`), stranka-detail z zgodovino, arhiviranje, GDPR izvoz, walk-in
povezava in granularna dovoljenja**. Predlagana implementacija razširi obstoječega
(ni novega CRM), brez globalnega profila in brez samodejnega spajanja. Najprej
skupni identity resolver, nato akcije, nato UI, nato GDPR + testi.

Pričakam odobritev **F5.5.3.1** za implementacijo.