# F2.3 — ARHITEKTURNA ANALIZA (F2.3.0)

**Namen:** arhitekturna podlaga pred implementacijo F2.3 — večorganizacijski Staff
(Del A) in dejavnostno specifični workspacei (Del B). V fazi F2.3.0 NE spreminjamo
Prisma sheme, rezervacijskih funkcij ali drugih produkcijskih poti.

**Status:** ARHITEKTURNO PREGLEDANO (analiza; implementacija sledi po potrditvi).

> Produkcijski blokator (ločen, NI predmet F2.3): `prisma migrate deploy` od sveže
> baze pade na prvi migraciji — glej `docs/F2-2-2-ZAKLJUCNI-PREGLED.md` §11.7 in
> `docs/F2-2-ZAKLJUCNI-PREGLED.md` §1.4. Vse shemske spremembe F2.3 je treba
> testirati na LOČENI testni bazi (ne `markec_dev`, ne produkcija); `db push` ne
> prikriva tega blokatorja.

---

## 1. Povzetek in cilji

### Del A — Staff multi-organization
**Cilj:** isti uporabnik (User) je lahko zaposleni v VEČ organizacijah; v vsaki
ima ločen Staff zapis in neodvisne poslovne podatke (storitve, urnik, termini,
provizije).

**Predlagana ciljna shema:** `@@unique([userId, organizationId])` na `Staff`
(če poslovne potrebe dovoljujejo; podrobno spodaj). S tem se prelomi trenutna
one-to-one `Staff.userId @unique` → one-to-org (steady, mnogo zapisov po uporabniku,
vendar največ eden na (user, org)).

### Del B — dejavnostno specifični workspacei
**Cilj:** izbira dejavnosti (vertical/activity profil) določa celoten workspace:
nadzorno ploščo, navigacijo, podatkovne modele, obrazce, delovne procese,
poslovne funkcije in dovoljene module — ne samo teme in besedil.

**Ugotovitev F2.3.0:** del B je **že v veliki meri zgrajen** skozi motor
`src/lib/profiles/*` (CapabilityMatrix, dashboardWidgets, forms, workflows,
extensions, terminology). F2.3 mora ta motor **dopolniti v kohezivno celoto**
(npr. večorg Staff in izolacija po org), ne začeti od nič.

---

## 2. DEL A — DIAGOZA

### 2.1 Trenutna shema Staff

```prisma
model Staff {
  id               String  @id @default(cuid())
  name, email, phone, bio, image, isActive
  defaultTipPercent/commissionType/commissionValue/commissionBasis  // #79 payroll
  userId           String  @unique        // ← OMEJITEV: en Staff na uporabnika GLOBALNO
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId   String?                // ← org je SAMO nullable slika, ni enoličen
  organization     Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  services     StaffService[]     // staffId
  appointments Appointment[]      // staffId
  workingHours WorkingHours[]     // staffId
  @@index([userId]) @@index([organizationId]) @@index([isActive]) @@index([email])
}
```

**Ključna težava:** `userId @unique` prepoveduje dve vrstici Staff za isti
uporabnik, četudi v različnih orgah. `organizationId` obstaja, a:
- ni del konzistentnega unikata (par (userId, organizationId) ni enkraten),
- je nullable — legacy/med-migracijski zapisi so lahko brez org,
- `createStaffMember` pri (user, org) preverja samo `findUnique({where:{userId}})`
  in **zavrne** dodajanje istega uporabnika v drugo org.

### 2.2 Zemljevid odvisnosti Staff (vse relacije)

| Relacija | Smer | Vpliv pri spremembi na multi-org |
|----------|------|----------------------------------|
| `Staff.user` → `User` | 1:1 (staff→user) | `userId` naredi kompozit umesto @unique |
| `Staff.organization` → `Organization` | n:1 | org izolacija ostaja |
| `Staff.services` → `StaffService` | 1:n | zapisi ključani po `staffId`; safe |
| `Staff.appointments` → `Appointment` | 1:n | `Appointment.staffId`; safe — KP-termin ostaja povezan z določenim Staff.id |
| `Staff.workingHours` → `WorkingHours` | 1:n | ključani po `staffId`; safe |
| `Appointment.staffId` (+ `Appointment.organizationId`) | n:1 | KP: termin mora vedno ciljati na določen Staff (ID) in org |
| `StaffService.serviceId` → `Service` | n:1 | service scoped po org; safe |
| `WorkingHours.staffId`, `Appointment.staffId` | n:1 | vse ključano po Staff.id (EDINI stabilen PK, neuserId) |

> **Zaključek:** relacije (services/appointments/workingHours) so vse ključano po
> **`Staff.id`**, ne po userId. Zato menjava `userId @unique` → `@@unique([userId, organizationId])`
> **NE prelomi nobene relacije** — vse FK ostanejo na `Staff.id`. Prelomi se le
> vsak **PK-style lookup po userId** (funkcije za "trenutni Staff seje"), ki jih je
> treba razločiti s trenutno org (glej 2.4).

### 2.3 Vsi znani `findUnique({where:{userId}})` / `findFirst`-brez-org klici (14+)

Sistemska analiza (vsi šteti z `file:line`). Robustna oznaka "BREAKS" = klic se bo
pod multi-org obnašal napačno (vrne poljubno/pravo vrstico brez org konteksta ali
vrže P2025).

| # | file:line | Funkcija | `where` | Org-scoped? | Vpliv multi-org |
|---|-----------|----------|---------|-------------|-----------------|
| 1 | `actions/staff.ts:266` | `createStaffMember` (duplicate-guard) | `{userId}` | ❌ | **ZLOMI** — "že obstaja" za drugo org |
| 2 | `actions/staff.ts:506` | `getCurrentStaffMember` | `{userId}` | ❌ | **ZLOMI** — poljuben Staff |
| 3 | `actions/staff.ts:574` | `getStaffPortalStats` | `{userId}` | ❌ | **ZLOMI** |
| 4 | `actions/staff.ts:647` | `getStaffTodaysAppointments` | `{userId}` | ❌ | **ZLOMI** |
| 5 | `actions/staff.ts:757` | `getStaffAppointments` | `{userId}` | ❌ | **ZLOMI** |
| 6 | `actions/staff.ts:844` | `getStaffProfile` | `{userId}` | ❌ | **ZLOMI** |
| 7 | `actions/staff.ts:907` | `getStaffAssignedServices` | `{userId}` | ❌ | **ZLOMI** |
| 8 | `actions/staff.ts:975` | `updateStaffSelfProfile` (branje) | `{userId}` | ⚠️ (guard :980) | **ZLOMI** — branje pred guardom |
| 9 | `actions/staff.ts:987` | `updateStaffSelfProfile` (pisanje) | `update where:{userId}` | ❌ | **ZLOMI** — update po neunikatnem ključu |
| 10 | `actions/staff.ts:1023` | `getStaffWorkingHours` | `{userId}` | ❌ | **ZLOMI** |
| 11 | `actions/appointments.ts:147` | `getCurrentUserStaffId` | `{userId}` | ❌ | **ZLOMI** — self-booking |
| 12 | `actions/appointments.ts:615` | self-booking prevention | `{userId}` | ❌ | **ZLOMI** |
| 13 | `actions/appointments.ts:1568` | `updateAppointmentStatus` (ownership) | `{userId}` | ❌ | **ZLOMI** |
| 14 | `actions/appointments.ts:1969` | `recordAppointmentTip` | `{userId}` | ❌ | **ZLOMI** |

**Varne (že org-scoped ali po Staff.id):** `staff.ts:209/358/428/470` (`findFirst {id, organizationId}`),
`appointments.ts:199/226/828/1586` (`{id, organizationId}` ali `{serviceId, staff:{organizationId}}`),
`stripe.ts:551`, `api/webhooks/stripe/route.ts:416`, `api/media/[id]/route.ts:50`
(`{userId, organizationId: media.org, isActive}` — ŽE scoped).

> **Opomba kvalitete:** "14 znanih klicov" iz naročila = 14 zgoraj + morebitni
> nadaljnji. Tabela šteje 14 prelomljivih mest (8 v staff.ts, 4 v appointments.ts,
> plus 2 v isti updateStaffSelfProfile–branje/pisanje). Vsa tri "varna" nestaff
> mesta so že pokrita. **Noben varen klic ne potrebuje spremembe.**

### 2.4 Del A — načrt Prisma migracije

**Ciljna shema:**
```prisma
model Staff {
  id String @id @default(cuid())
  // …ostalo nespremenjeno…
  userId           String      // odstrani @unique
  organizationId   String      // (že obstaja kot nullable; predlog: napolnimo in naredimo NOT NULL po backfillu)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])   // cilj
  @@index([userId]) @@index([organizationId]) @@index([isActive]) @@index([email])
}
```
Sprememba `organizationId` iz `String?` → `String` + NOT NULL je opcijska in jo
je treba ločiti v LASTNO migracijo (po backfillu), da preprečimo kršitev enoličnosti
na obstoječih zapisih.

**Koraki migracije (na ločeni testni bazi):**
1. **Backfill:** pred odpravo unikata `userId @unique` naredi `organizationId NOT NULL`
   za vse obstoječe Staff vrstice (deduciraj iz `User.organizationId` / `OrganizationMember`
   z `role=STAFF` / `Appointment.organizationId`). Kakršen koli Staff brez org → preskoči
   ali zabeleži; ne ustvarjaj podvojenih (user, org).
2. **Migracija A:** `ALTER TABLE "Staff" DROP CONSTRAINT Staff_userId_key`; dodaj
   `@@unique([userId, organizationId])` (kopija: najprej `ALTER` za polja, nato
   CREATE UNIQUE INDEX `Staff_userId_organizationId_key`; poskrbi za obstoječe
   napake P2002/P2003 — ni dvojnikov (user, org) za isti org).
3. **Migracija B (ločeno):** `organizationId` → `NOT NULL`; po želji `DROP`
   starega samostojnega indexa `Staff_userId_idx` (ostane samo kompozitni).
4. Usklajevanje z generatorjem: `prisma generate` (OPOMBA: trenutno `prisma generate`
   na Windows občasno odpira EPERM na query-engine .dll, ko teče dev server; ustaviti
   dev server pred generiranjem).

> **Ni produkcijske migracije v tej fazi.** Vse na `markec_f21_test` ali novo
> `markec_f23_test`. `db push` je dovoljen za razhroščevanje, NE kot dokaz migracijskega
> postopka (blokator §1).

### 2.5 Del A — načrt backfill

Deduplikacija "kateri user je Staff v kateri org" za obstoječe podatke:

```
Vir resnice za Staff→org:
- primarno: Staff.organizationId (če je nastavljen in != null)
- sicer od User: User.organizationId (legacy iz F2.0/F2.1 — organizacija, v kateri je bil zaposlen)
- sicer iz OrganizationMember(role=STAFF, userId=user.id) → organizationId
- sicer iz najstarejšega Appointment.organizationId po staffId (če obstaja drug zapis)
```

Pravilo: **en (user, org) par = en Staff**. Če bi konsekventna politika
(zgoraj) dala enako (user, org) za dve Staff vrstici -> P2002 pri aplikaciji; tak
primer se v obstoječi bazi ne pričakuje (prej `userId @unique`), a ga zapisovati v
drugem koraku preverjanja: `SELECT userId, organizationId, count(*) FROM Staff GROUP BY 1,2 HAVING count(*)>1`.

### 2.6 Del A — načrt sprememb klicev (vsi prelomljeni)

Vzorec: namesto `staff.findUnique({where:{userId}})` uporabi **org-scoped** obliko.
Kje je org na voljo: `requireSessionOrg()` (Staff portal), `requirePermissionOrg(...)`
(admin Staff), `resolveRequestOrg()` (javni).
- **Enoten pomočni resolver (nov modul `src/lib/staff/current.ts`):**
  ```
  getCurrentStaffForOrg(userId, orgId) = prisma.staff.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } }  // ali findFirst (user,org)
  })
  ```
- Vse 14 prelomljenih mest preklopi na ta resolver:
  - `staff.ts` fje (`getCurrentStaffMember`, `getStaffPortalStats`, `getStaffTodaysAppointments`,
    `getStaffAppointments`, `getStaffProfile`, `getStaffAssignedServices`, `updateStaffSelfProfile`
    (tako branje kot update — `update where:{ id: currentStaff.id, organizationId: orgId }`),
    `getStaffWorkingHours`, `createStaffMember` duplicate-guard → `findUnique({userId_organizationId})`).
  - `appointments.ts` (`getCurrentUserStaffId`, self-booking, `updateAppointmentStatus` ownership,
    `recordAppointmentTip`).
- `updateStaffSelfProfile` (pisanje) NE sme več `update({where:{userId}})` —
  postane `update({where:{id: current.id}, data:…})` (after org-scoped branje).
- `createStaffMember`: duplicate-guard postane per-org; pri user, ki že ima Staff v
  DRUGO org, se novi Staff ustvari normalno (brez "že obstaja").

### 2.7 Del A — varnostna tveganja

1. **IDOR / ORG-cross controller:** vsak Staff lookup, ki ga uporabnik kliče z lastnim
   userId, mora biti omejen na TRENUTNO org (session/request org). Poljuben `{userId}`
   bi pod multi-org izpostavil pravilen Staff iz napačne org (npr. nivo self-booking,
   ownership, tip, nastavitve profila). → obvezen `getCurrentStaffForOrg(userId, orgId)`.
2. **Update po userId (P2025/P2002):** `updateStaffSelfProfile` po nekompozitnem ključu
   bi po spremembi sheme vrgli/modeliral P2002/P2025 → obvezna zamenjava na `id`.
3. **Duplicate (user,org) vnos:** novi unikat preprečuje podvojen Staff za isti (user, org);
   `createStaffMember` mora zagnati per-org preverjanje PRED `prisma.staff.create`, da
   uporabnik dobi čitljivo napako, ne DB constraint.
4. **Org izolacija podatkov (KP):** `Appointment.staffId` mora vedno ciljati na Staff
   z isto `organizationId` kot termin. V drive `createAppointment` (in `getAvailableStaff`,
   `getStaffForBooking`) je že `{staffId, organizationId: org.id}` — po refaktorju OSTANE,
   ker gre za ID lookup, ne userId lookup. Test matrika to jamči (§2.9).
5. **Role escalation prek Staff:** Staff zapis v drug org ne sme dati pravic v trenutno org.
   Membership (OrganizationMember) ostaja avtoritativni vir vlog; Staff je le poslovni profil.
6. **Backfill napake:** organizacija brez Staff org ali surove spremembe ob spremembi
   unikata — vse zapisi preverjanja `GROUP BY (userId, organizationId) HAVING count>1`.

### 2.8 Del A — testna matrika

| Test | Vrsta | Dokaže |
|------|-------|--------|
| `itest`: isti user je Staff v orgA in orgB | integracijski | dve STAFF vrstici, različni org |
| `itest`: v vsaki org različne storitve (StaffService) in urnik (WorkingHours) | integracijski | neodvisni poslovni podatki |
| `itest`: termin v orgA = StaffA; termin v orgB = StaffB | integracijski | pravilna povezava termin↔Staff↔org |
| `itest`: getCurrentStaffForOrg(user, orgA) ne vrača Staff iz orgB | integracijski | izolacija |
| `unit`: updateStaffSelfProfile uporablja `where:{id}` (ne userId) | source-test | nobe regres |
| `itest`: duplicate (user,org) zavrnjen; (user,orgA)+(user,orgB) dovoljen | integracijski | novi unikat |
| `security`: uporabnik STAFF v orgA ne sme spreminjati/upravljati Staff iz orgB | itest/varnostni | fail-closed |
| `integration`: `Appointment.organizationId === Staff.organizationId` invariant | itest | KP termin↔Staff↔org |
| browser (Chromium): login isti user, switch org → staff-portal pokaže pravilne podatke te org | browser | preklop org |

---

## 3. DEL B — DIAGOZA dejavnostno specifičnih workspaceov

### 3.1 Trenutni model (že obstoječ, koherenten)

| Vhod | Mesto v kodu |
|------|--------------|
| `ActivityProfile` (id, label, capabilities, terminology, forms, workflows, dashboardWidgets, extensions, catalog, ctaMode, schemaType, palette) | `src/lib/profiles/types.ts` (interface), `registry.ts` |
| `CapabilityMatrix` 14 ključev (`appointments, workOrders, shop, services, inventory, customers, staff, analytics, reviews, forms, workflows, documents, delivery, walkIn`), stanje `required/optional/disabled` | `types.ts:10-45` |
| Vzhod efektivnega profila (registry + owner overrides + moduleStates + secondaryVertical union) | `resolve.ts`, `overrides.ts`, `secondary.ts`, `modules/catalog.ts` |
| ExtensionEntity (declarativna "data model" polja): `vehicle, tire_set, measurement_set, batch, project, project_task, workspace…` | `extensions.ts` |
| Per-profil `forms` in `workflows` (pr. seamstress: order-details/measurements formi; production-order 9-stopenjski workflow) | `registry.ts` seamstress/tire-service |
| Nadzorna plošča (widget-driven): `dashboardWidgets` → `hasWidget(k)` v `dashboard/page.tsx` sklopi po profile | `dashboard/page.tsx:129-150` |
| Navigacija: `sidebar.tsx` filtrira 20 NavItem po capability/extension/anyCapabilities/requiresExtensions | `sidebar.tsx:46-131` |
| Website CTA+terminology: `ctaMode`, `terms({businessSingular…})` | `registry.ts` vsak profil |

### 3.2 Primeri per-vertical (dejansko obstajajo)

| Dejavnost | appointments | workOrders | shop | forms/workflows | dashboardWidgets | extensions |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **beauty** | required | (odvisno) | optional | — | todayAppointments, revenue, customers, topServices, recentOrders | workspace-resources |
| **seamstress** | disabled | required | optional | order-details/measurements, production-order (9 stage) | activeOrders, deadlines, pendingApprovals, readyForDelivery, revenue, customers, projects | body-measurements, projects |
| **tire-service** | optional | required | (deli) | vehicle/work-order formi + workflow | delovni nalogi + vozila | vehicle, tire_set |
| **mehanik** | optional/disabled | required | deli | delovni nalogi | work-orders + vozila | vehicle |
| **beekeeping** | (ni appointment) | — | izdelki | žetev/batch | batch→products | batch |

→ **F2.3 DEL B ni potreben od nič:** že obstoječi profilni motor že določa
nadzorno ploščo, navigacijo, data-model (extensions), obrazce, workflow, module in
besedila **per vertical**. F2.3 mora predvsem:
  - zagotoviti, da en račun upravlja VEČ org z RAZLIČNIMI dejavnostmi hkrati (Del A: workspace switcher že obstaja; Staff multi-org je odvisen),
  - preveriti, da vsaka novoaddana dejavnost izpolni del B kriterije (dashboard/navigation/data-model/forms/workflows/features/modules) — to je del regresijske/YAGNI izpolnitve,
  - izolaciji po org (OrganizationMember, staff, termin).

### 3.3 Vrzeli / delovni sklopi (če ni že bazirano)

1. **Večorg Staff je PREREQUISITE** — dejavnostno specifični workspace v vsaki org zahteva
   isti uporabnik-Staff v vsaki org.
2. **Per-vertical podatkovni modeli**: `ExtensionEntity` je že generična "entity"
   plast (npr. `vehicle` za avtoservis, `body-measurements` za šiv, `batch` za
   čebelarstvo; beauty nima teh extensionov). To je že mapirano per-vertical —
   potrebno je le potrditi, da so **vsi** Del B primeri pokriti in nekritičnih
   ni.
3. **Preverjanje, da ni "generičnega vse-enega dashboards"**: `dashboard/page.tsx`
   že gate preko `profile.dashboardWidgets` — a velja preveriti, da nobena nova
   dejavnost ne pade na prazno/neustrezno board.

> Zaključek Del B: arhitektura je na pravem mestu; F2.3 dopolni Del A (multi-org
> Staff) kot PREDPOGOJ in nato preveri koherentnost Del B (per-vertical workspace)
> z testno matriko ter dokumentira morebitna odstopanja.

---

## 4. Varnost (obeh delov)

- **Izolacija po org za vse branje/pisanje Staff** — `getCurrentStaffForOrg(userId, orgId)`.
- **Fail-closed** kadar org ni mogoče razrešiti (povzeto po F2.0/F2.1 `requireSessionOrg`).
- **Noben podatek ne uhaja med orgama** — vse podatkovne funkcije (termini, storitve,
  urniki, naročila, projekti) so že org-scoped preko `organizationId: org.id`.
- **Ni produkcijske migracije/baze** (ločena testna baza).
- **Brez commit/pusha.**

## 5. Testna matrika (skupno)

| Področje | Test |
|----------|------|
| Večorg Staff | itest (istotni user v orgA+orgB, ločeni storitve/urnik, termin↔Staff↔org) |
| Dejavnostno specifični board | source/itest — per-profil `dashboardWidgets`, capability gate, sidebar filter |
| Org izolacija | itest/varnostni — Staff orgA ne vidi Staff orgB; termin invariant |
| regresija beauty | browser/login ADMIN/STAFF/CLIENTE, P0.2 gostova rezervacija, assortment |

---

## 6. Sklep priporočeno izvedbeno zaporedje

1. **F2.3.1 — Staff refaktor (multi-org)**: schema `@@unique([userId, organizationId])`
   + `getCurrentStaffForOrg` + preklop 14 mest + backfill preverka (`GROUP BY`).
2. **Testne baza** nova `markec_f23_test` (izolirana), `prisma migrate` na njej,
   itest matrike, nato browser.
3. **F2.3.2 — Dejavnostno specifični workspacei**: verifikacija per-vertical
   koherence (dashboard/navigation/data-model/forms/workflows/features/modules)
   + regresija beauty + polnjenje testov za vse dejavnosti.
4. Dokumentirati vsako odstopanje od tega načrta.