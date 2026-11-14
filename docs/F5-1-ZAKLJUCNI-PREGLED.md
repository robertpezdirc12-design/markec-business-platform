# F5.1 — ZAKLJUČNI PREGLED: Popusti in promocije

**Datum:** končna revizija po implementaciji.
**Mandat:** podjetnik mora samostojno ustvarjati in upravljati popuste ter promocijske akcije v svojem workspaceu. Brez commita/pusha, brez posegov v produkcijsko bazo, brez prepisovanja nedokončanega dela drugih agentov, brez Staff refaktoria. Obstoječe funkcije trgovine in rezervacij morajo ostati delujoče.

> **Sklep:** F5.1 je **implementacijsko in testno potrjen** na podlagi dejanskih, strežniško avtoritativnih cenovnih izračunov in unovčenja promocij, dokazanih z **14 integracijskimi testi na resnični testni bazi `markec_f51_test`** + **26 enotnimi testi** engine/schema. Formalno sprejetje potrdi človek (spodaj §11).

---

## 1. Predhodna analiza (kaj je že obstajalo)

Pregledal sem obstoječo bazo in kodo:

| Področje | Obstoječe stanje | Uporabljeno za F5.1 |
|----------|------------------|---------------------|
| `compareAtPrice` | Prikazna primerjalna cena na izdelkih | **Nedotaknjeno** (ostaja informativni prikaz, ni promocijski mehanizem) |
| Izdelki/storitve/kategorije | Org-scoped CRUD, `Prisma.Decimal` | Deljeni vir entitet za scope promocij |
| Košarica/naročila | `createProductCheckoutSession` (offline/online/giftcard), cene izključno iz baze | Razširjeno: avtoritativni izračun popusta + redemptions + posnetek |
| Rezervacije/pologi | `createAppointment`, deposit kot pravilo (`src/lib/booking/deposit.ts`), Stripe webhook/verify | Razširjeno: popust na storitve + posnetek + redemptions |
| Decimal zaokroževanje | `round2()`, `Prisma.Decimal(10,2)`, bruto cene z vključenim DDV | Ponovno uporabljeno (`engine.ts` re-export `round2`) |
| Izolacija podjetij | `requirePermissionOrg`, resolveSessionOrg, `x-org-slug` + HMAC | Ponovno uporabljeno — vse akcije org-scoped |

**Nisem izdelal vzporednega sistema** — obstoječe cenovne poti (product checkout + appointments) sem razširil z enim skupnim čistim engine-om (`src/lib/promotions/engine.ts`) in enim atomskim unovčevalcem (`redeem.ts`).

---

## 2. Vrste popustov — podprto

- **Odstotni popust** (npr. 20 %), normaliziran na ≥0 in ≤100 %.
- **Fiksni popust** (npr. 10 €), omejen na osnovo (končna cena nikoli negativna).
- **Časovno omejena promocija** (`startsAt`/`endsAt`, vključujoče).
- **Promocijska koda** (org-unikatna, normalizirana na velike črke; zahteva vnos ob unovčenju).
- **Izbrani izdelki** (scope `PRODUCTS`, prazna lista = vsi izdelki).
- **Izbrane storitve** (scope `SERVICES`, prazna lista = vse storitve).
- **Kategorije** (scope `CATEGORIES`, pokrije izdelke+storitve izbranih kategorij).
- **Celotna ponudba** (scope `WHOLE_AMOUNT` — enako za dejavnosti brez klasične trgovine, ki popuste dobijo na svoje storitve).

**Prekrivanje (§4)** — jasno, deterministično pravilo: **največ ena promocija na transakcijo**. Če stranka vnese kodo → natanko ta (če velja). Sicer med vsemi aktivnimi avtomatskimi promocijami zmaga **največji popust**. Zaposleni 20 % popust ne kombinira s promocijami (ostane samo 20 %).

---

## 3. Nastavitve promocije — podprto

Ime, opis, vrsta + višina popusta, scope + ciljne entitete, začetni/končni datum, promocijska koda, omejitev skupnih uporab, omejitev na stranko, minimalna vrednost naročila, status (osnutek/aktivna/neaktivna). Vmesnik je urejeni obrazec z belo-listično strežniško Zod validacijo (`src/lib/promotions/server-schema.ts`) — enako načelo kot produkti (#106), varuje masovno pripisovanje.

---

## 4. Cenovni izračun — avtoritativen na strežniku

- **Cene in popusti se nikoli ne zaupajo brskalniku** — brskalnik pošlje le izbiro (izdelki/storitve) in morebitno kodo; engine preračuna vse iz baze.
- **Decimalna natančnost** z `round2` (centi) in `Prisma.Decimal(10,2)` skozi celotno verigo.
- **Negativna cena nemogoča**: `discountedTotal = max(0, total − discount)` in `computeDiscountAmount` omeji fiksni popust na osnovo.
- **Rok veljavnosti, omejitve uporabe, minimalna vrednost** preverjeni v engine (`isEligible`) in atomsko ob unovčenju (`redeemPromotion`).
- **Zaščita pred sočasno večkratno uporabo**: `SELECT … FOR UPDATE` na vrstici Promocije + `@@unique([promotionId, orderId])` / `@@unique([promotionId, appointmentId])`. Dokazano z integracijskim testom (istočasno unovčenje iste kode → natanko ena unovčitev, druga `LIMIT_REACHED`).
- **Posnetek dejansko uporabljene promocije** (immutabilni JSON `promotionSnapshot` + `promotionDiscount` + `promotionId`) se zapiše na **Order in Appointment**. Poznejša sprememba promocije **ne spremeni** starih transakcij (dokazano v integracijskem testu).
- **Obstoječi davčni/računovodski izračuni ohranjeni**: `subtotal`/`tax` ostaneta bruto; popust se odšteje pri `total`. (Za izdelke z različnimi DDV stopnjami ostaja obravnava naprej kot prej.)

---

## 5. Izolacija podjetij — org-scoped

- Vsaka promocija/redemption ima `organizationId` (izbrisljivo) in `@@index`.
- Vse admin akcije gredo skozi `requirePermissionOrg("promotions.manage")` + `resolveSessionOrg` → delujejo **samo na lastni organizaciji** prijavljenega člana.
- Pridobljene ciljne entitete (produkti/storitve/kategorije) so org-validirane pred shranbo.
- Koda je **org-unikatna** (`@@unique([organizationId, code])`); tuja koda je zavrnjena / se ne uporabi (dokazano v integracijskem testu).
- **Vloge/dovoljenja**: dodan nov `PERMISSION_KEYS` vnos `promotions.manage` v katalog dovoljenj (v jeziku role editorja). Dynamic custom roles (G8) ga spoštujejo; ADMIN/STAFF brez custom role imajo poln dostop (nespremenjeno).

---

## 6. Uporabniški vmesnik

V `/dashboard/promotions` (seznam + statistika:
- Seznam promocij z vrsto/višino, obsegom, veljavnostjo, štetjem uporab in izpeljanim stanjem življenjskega cikla (aktivna/razporejena/pretekla/osnutek/neaktivna).
- 4 statistične kartice: vse promocije, aktivne zdaj, skupaj uporab, skupaj odšteto.
- Ustvarjanje `/promotions/new`, urejanje `/promotions/[id]/edit`, podrobnosti `/promotions/[id]`.
- Preklapljanje statusa (aktiviraj/deaktiviraj), brisanje (zgodovina uporab ostane na naročilih/terminih).
- Predogled popusta (labela `-20 %`/`-10,00 €` + obseg) v seznamu in podrobnostih.
- Pregled uporabljenih promocij (redemptions) skozi dialog v seznamu in na strani podrobnosti.
- Vnašanje promocijske kode v **košarico** (`cart-content.tsx`) in v **rezervacijo** (`booking-form.tsx`).
- Prilagojena terminologija: dejavnosti brez klasične trgovine vidijo storitvene popuste (sidebar prikaz gated na `anyCapabilities: ["shop","services"]`).

---

## 7. Testiranje — matrika

### 7.1 Enotni testi (brez DB)
| Datoteka | Rezultat |
|----------|----------|
| `tests/promotions-engine.test.ts` | **20/20 PASS** (percent/fixed, scope, okno, koda, minimum, prekrivanje, snapshot immutability) |
| `tests/promotions-server-schema.test.ts` | **6/6 PASS** (bela lista, koda regex, normalizacija, update brez statusa) |
| `tests/schema-tenancy.test.ts` | **41/41 PASS** (novi modeli `Promotion`, `PromotionRedemption` nosijo `organizationId` + indeks) |

### 7.2 Integracijski testi (§9 — odločilni dokaz)
`markec_f51_test`, resnična baza, `vitest.f51.config.ts` (VARNOSTNA ZAPORA na ime baze), seed `tests/integration/f51/seed.mjs`.
**`tests/integration/f51/promotions.itest.ts` — 10/10 PASS:**
1. odstotni popust na naročilo (total, snapshot, redemption),
2. fiksni popust omejen na osnovo (ne-negativna cena),
3. največji avtomatski popust zmaga,
4. org izolacija v `getAdminPromotions` (A ne vidi B),
5. tuja koda se v lastni trgovini ne uporabi,
6. `maxRedemptions` omejitev,
7. **istočasno unovčenje iste kode → ena zmagovalka** (row-lock + unique),
8. storitveni termin s popustom (snapshot),
9. immutabilnost posnetka po urejanju promocije,
10. obstoječe naročilo brez promocije ostane brez popusta.

### 7.3 Migracija / DDL verifikacija
`scripts/f51-migrate-verify.mjs` na `markec_f51_test`: potrjene tabele `Promotion`/`PromotionRedemption`, trije enum tipi, Order/Appointment snapshot stolpci in oba unique indeksa; vstavi realno vrstico in dokaže, da ponovno unovčenje iste promocije na istem naročilu pade. **PASS.**

### 7.4 Regresija obstoječih funkcij
| Suite | Rezultat |
|-------|----------|
| `deposit-rules-79` | **38/38 PASS** |
| `golden-batch-70-73` | **18/18 PASS** |
| `retail-inventory-78` | **37/37 PASS** |
| `tsc --noEmit` (moje datoteke) | **0 napak** |
| ESLint (moje datoteke) | **0 error, 0 warning** |

---

## 8. Omejitve / zaščita drugih agentov

- **Ni produkcijskih sprememb baze.** (`.env` kaže na `markec_dev`; edina baza, ki sem jo spremenil, je ločena testna `markec_f51_test`. `markec_dev` sem pustil nedotaknjen — njegov schema odstopa od trenutne sheme zaradi neapliciranih vnaprejšnjih sprememb drugih agentov in `db push --accept-data-loss` bi lahko kalil podatke, zato sem se mu izognil.)
- **Nisem prepisal WIP-a drugih agentov.** `src/app/actions/appointments.ts`, `stripe.ts`, `webhooks/stripe/route.ts`, `schema.prisma` so nekam spremenjene od drugih agentov; dotaknil sem se jih le s surgical-additive dodatki (promocija brez spreminjanja obstoječe logike). Pre-obstoječe TS napake v `profile.ts`, `custom-profile-builder.tsx`, `prisma/seed.ts` in `e2e/f0s-media-removed-staff.spec.ts` so **ostale** (niso F5.1).
- **Brez commita in pusha.**
- **Brez Staff refaktoria.**
- **Obstoječe funkcije delujejo** (regresijska matrika §7.4 + prejšnje suita zelene).

---

## 9. Odprte težave / NOT VERIFIED

| Težava | Stanje |
|--------|--------|
| Interaktivna brskalniška click-flow verifikacija admin obrazca | **NOT VERIFIED** — Skales token-proxy ne prepusti `view_page`/`open_preview` na localhost (ista zabeležena omejitev kot v F5.0.2 §E). Server-side: `/dashboard/promotions`, `/new`, `/[id]` in `/[id]/edit` **kompilirajo in vmejo HTTP 307** (redirect na login za neprijavljeno — pričakovano) ob zagonu dev strežnika na bazi s shemo. |
| Mesto vnosov promocije v košarici in rezervaciji (UI) | Koda vnašanje je dodano v `cart-content.tsx` in `booking-form.tsx`; interaktivni flow ni brskalniško kliknjen (proxy) — logiko unovčenja dokazujejo integracijski testi. |
| `prisma migrate deploy` od **sveže prazne** baze | **PRE-EXISTING blokator** (ni F5.1): prva migracija `20251030000000_*` teče po imenu pred `init` (20251116) → na sveži bazi pade (§ F2-2-2 · §11.7). Testna baza je postavljena z `prisma db push` (projektna konvencija, glej EPIC-2 §/F2.3.1); F5.1 migration DDL je izolirano verificiran (§7.3). |
| `markec_dev` brez sheme promocij | **NOT APPLIED** (namerno) — bi zahtevalo `db push --accept-data-loss` na bazi z neapliciranimi tujimi spremembami; UI deluje proti bazam s shemo (dokazano proti `markec_f51_test`). |

---

## 10. Spremenjeni/dodani artefakti (povzetek)

**Shema/migracija:**
- `prisma/schema.prisma`: modela `Promotion`, `PromotionRedemption` + 3 enum tipa + `promotionDiscount/promotionId/promotionSnapshot` na `Order` in `Appointment` + relacije na `Organization`.
- `prisma/migrations/20261201000000_f5_1_promotions/migration.sql` (nova, aditivna).

**Logika (novo):**
- `src/lib/promotions/engine.ts` — čisti avtoritativni izračun (scope/eval/best-pick/snapshot).
- `src/lib/promotions/redeem.ts` — atomsko unovčenje (row-lock + unique + limits).
- `src/lib/promotions/redeem-order.ts` — unovčenje naročila **ob plačilu** (idempotentno; preklicano plačilo NE porabi promocije).
- `src/lib/promotions/map.ts` — Prisma→rule mapper + org-scoped loader.
- `src/lib/promotions/server-schema.ts` — belo-listična Zod validacija.

**Akcije (novo):**
- `src/app/actions/promotions.ts` — CRUD + statistika + redemptions (org-scoped, gated).

**Integracija v obstoječe poti:**
- `product-checkout.ts`, `appointments.ts` (createAppointment), `stripe.ts` (verify + checkout metadata), `webhooks/stripe/route.ts` (Stripe-paid termin).

**UI:**
- `src/app/(admin)/dashboard/promotions/**` (seznam, novo, uredi, podrobnosti).
- `promotion-form.tsx`, `promotion-actions.tsx`, `promotion-redemptions-dialog.tsx`.
- Vnos kode v `cart-content.tsx` in `booking-form.tsx`.
- i18n imenski prostor `promotions` (sl/en), nav label, `TagIcon`, sidebar vnos.

**Dovoljenja:**
- `src/lib/permissions/roles.ts` — `promotions.manage` v katalogu + role editor.

**Testi:**
- `tests/promotions-engine.test.ts`, `tests/promotions-server-schema.test.ts` (enotni).
- `vitest.f51.config.ts`, `tests/integration/f51/seed.mjs`, `tests/integration/f51/promotions.itest.ts` (integracijski).
- `scripts/f51-migrate-verify.mjs`.

---

## Sklep

F5.1 je **implementacijsko dovršen**: vse vrste popustov, časovna okna, kode, omejitve, izolacija podjetij, immutabilnost zgodovine, zaščita pred sočasno uporabo in **odlog unovčenja do plačila** so pokrite. **Dejanski cenovni izračuni in unovčenje promocij so dokazani z 14 integracijskimi testi na resnični bazi** (ne le enotnimi). Regresija obstoječih funkcij trgovine/rezervacij: **zelena** (full Vitest 1230/1230 + F2.1/F2.2 58/58 + F2.3 18/18). Pre-obstoječi podatki in tuji WIP: nedotaknjeni.

**Sprejetje (Accept) formalno prepuščeno človeku** — ta revizija ne razglaša sprejetja; zabeležila je stanje, popravke in preostale NOT VERIFIED točke (§11).

---

## 11. F5.1 FINAL ACCEPTANCE AUDIT — matrika PASS / FAIL / NOT VERIFIED

Neodvisna revizija pred formalnim sprejemom. Dodane funkcije v tej reviziji: **nobene**; opravljeni so samo popravki, ki so bili potrebni za skladnost z zahtevami (odlog unovčenja, preimenovanje migracije, poravnava dovoljenj, omemba belih-box testov).

### 1. Pregled sprememb — **PASS**
- `prisma/schema.prisma`: moje dodatke (Promotion/PromotionRedemption + snapshot stolpci) sem razlikoval od drugih agentovih (OrganizationInvitation F2.2, Staff multi-org F2.3.1). **Tuji WIP je ohranjen** — nobena od sprememb drugih agentov ni bila prepisana, preurejena ali formatirana.
- `appointments.ts` / `stripe.ts` / `webhooks/route.ts`: moje spremembe so izključno aditivni hunk-i (promotion engine + redeem) brez dotika obstoječe logike; spremembe drugih agentov (npr. `bookingReturnBase` F2.2.2, org-scoped `userId_organizationId` F2.3.1) so ostale nedotaknjene.
- **Webhook indentation napaka iz prejšnje implementacije je popravljena** (NESkladno zavit redemption blok v `route.ts`) — čisto formatiranje moje lastne kode, brez funkcionalne spremembe.

### 2. Cenovni izračun — **PASS**
- Pregledani vsi poti: offline naročilo ✅, online naročilo ✅, darilna kartica (full + partial coverage) ✅, rezervacija (`createAppointment`) ✅, Stripe checkout (`createCheckoutSession`/`verify`) ✅, Stripe webhook ✅.
- Percent/fixed (z normalizacijo 0–100 in omejitvijo na osnovo), minOrderValue, scope (produkti/storitve/kategorije/celotna ponudba), datumske omejitve, prekrivanje (največja avtomatska zmaga; koda zmaga nad avtomatsko) in `round2` zaokroževanje — **dokazano z enotnimi in integracijskimi testi**.

### 3. Sočasna uporaba / sprostitev — **PASS** (s popravkom)
- Omejeno število uporab (`maxRedemptions`) ✅; omejitev na stranko (`maxPerCustomer`) ✅.
- Sočasno unovčenje iste kode → natanko ena zmagovalka, druga `LIMIT_REACHED` (row-lock + unique) ✅.
- Ponovljene zahteve / podvojeni Stripe webhook → **idempotentno** (`redeemOrderPromotion`, unikat `[promotionId, orderId]`) ✅.
- **PREKLICANO/OPUŠČENO plačilo**: v tej reviziji **odpravljeno** — pri online naročilu se promocija unovči **ŠELE ob potrjenem plačilu** (nov helper `redeem-order.ts` v `verifyProductOrder` + webhook); prej je unovčitev tekla ob kreaciji seje in bi jo preklicano plačilo zapravilo. Dokazano z 4 novimi integracijskimi testi §3.

### 4. Varnost — **PASS** (s popravkom)
- Organizacijska izolacija: `getAdminPromotions` vrne samo lastne; tuja koda se ne uporabi; vse akcije org-scoped (integracijski testi) ✅.
- `promotions.manage`: akcije so gated na to pravico. **Popravek v tej reviziji**: strani (list/new/edit/detail) in sidebar vnos so bili gated na `products.manage` — zdaj usklajeno na `promotions.manage`, da vloga z `promotions.manage` dejansko vidi in upravlja promo UI.
- Ponarejanje cene iz brskalnika: engine prevede vse iz baze; brskalnik pošlje le izbiro + kodo (ni poslane cene) ✅.
- Negativne cene: `Math.max(0, …)` + omejitev fiksnega popusta na osnovo ✅.
- Popust samo na dovoljenih entitetah: `affectedLines` ujema scope + ciljne ID-je (validirane org-scoped v akciji) ✅.

### 5. Nespremenljivost transakcij — **PASS**
- `promotionSnapshot` vsebuje `promotionId`, `name`, `discountType`, `discountValue`, `scope`, `targetEntityIds`, `code`, `baseAmount`, `discountAmount`, `affectedLines`, `appliedAt` — dovolj za rekonstrukcijo dejansko uporabljenega popusta.
- Ureditev ali deaktivacija promocije po naročilu NE spremeni starega naročila (integracijski test §4 immutabilnost) ✅.

### 6. Migracija — **PASS** (s popravkom)
- **Popravek v tej reviziji**: ime mape `20260115000000_f5_1_promotions` je preurejeno na **`20261201000000_f5_1_promotions`** — prejšnje ime je sortiralo PRED zadnjimi migracijami (Nov 2026, npr. `20261130…_f22`), kar je zameglilo odvisnostni vrstni red.
- **Migration.sql je izveden čisto na bazi s predhodno shemo**: na `markec_f51_test` sem spustil F5.1 objekte in ponovno izvedel `migration.sql` z `ON_ERROR_STOP=1` → vseh `CREATE TABLE/INDEX/ALTER` uspelo (vključno z unikatnima ograjama `PromotionRedemption_promotionId_orderId_key` in `..._appointmentId_key`).
- Po ponovni kreaciji sheme preko migracije **celotna F5.1 integracijska suita spet 14/14 zelena**.
- `markec_f23_test` sem dopolnil z aditivno shemo F5.1 (db push) → **F2.3 suita 18/18 zelena** (dokaz, da aditivna shema ne zlomi skupne booking kode).
- Znani blokator `migrate deploy` od prazne baze (init-vrstni red) ostaja **ločen pre-existing dolg** (§9).

### 7. Browser — **NOT VERIFIED**
- Skales token-proxy (ista omejitev kot F5.0.2 §E) prepreči `view_page` dostop do localhost (navigacija timeout). Te interaktivne omejitve **nisem obhajal**.
- Server-side: dev strežnik proti `markec_f51_test` → `/dashboard/promotions`, `/new`, `/[id]`, `/[id]/edit`, `/login` **kompilirajo in vmejo HTTP 307/200** (redirect za neprijavljeno = pričakovana avtorizacijska vrata). Vnos kode v košarici/rezervaciji je v kodi prisoten (white-box testi); interaktivni klik-flow je NOT VERIFIED.

### 8. Ponovna validacija — **PASS**
| Preverjanje | Rezultat |
|-------------|----------|
| Celotni Vitest (`vitest run`) | **1230/1230 PASS (85 datotek)** |
| F5.1 integracija (`markec_f51_test`) | **14/14 PASS** |
| F2.1 + F2.2 integracija (`markec_f21_test`) | **58/58 PASS** |
| F2.3 integracija (`markec_f23_test`, z aditivno shemo) | **18/18 PASS** |
| TypeScript (`tsc --noEmit`) — moje datoteke | **0 napak** (pre-existing napake v `profile.ts`, `custom-profile-builder.tsx`, `seed.ts`, `e2e/…` so tuji WIP, nedotaknjeni) |
| ESLint — moje datoteke | **0 error, 0 warning** |
| Migration SQL na predhodni shemi (ON_ERROR_STOP) | **PASS** |

### 9. Zabeležene spremembe V TEJ reviziji
1. **`redeem-order.ts` (novo)** — odlog unovčenja online naročil do potrjenega plačila.
2. **`product-checkout.ts` / `webhooks/route.ts` / `verifyProductOrder`** — online naročilo NE unovči ob seji; unovči ob PAID (idempotentno).
3. **Migracija preimenovana** v `20261201000000_f5_1_promotions` (vrstni red).
4. **Strani + sidebar** gated na `promotions.manage` (prej `products.manage`).
5. **Webhook indentation** popravljena; white-box testa `booking-addons-92` in `prepaid-value-80` usklajena z namensko spremenjeno promo-aware ceno.

### 10. Preostale / odprte točke
- Interaktivni brskalniški slag: **NOT VERIFIED** (proxy, ni obiden).
- `markec_dev` nima sheme promocij (namerno — bi zahtevalo `db push --accept-data-loss` na bazi s tujimi neapliciranimi spremembami). UI deluje proti bazam s shemo.
- Tuji WIP (profile/custom-profile/seed) ima pre-existing TS napake — **niso F5.1** in jih nisem spreminjal.

---

## 12. F5.1.1 — CILJNA PREVERJANJA (STRIPE CONCURRENCY + PRISMA MIGRATION)

Osrednji pregled po F5.1. Izvedeni sta SAMO dve ciljni preverjanji; funkcionalnosti nisem dodajal (razen 2 fokusiranih integracijskih testov, potrebnih za dokaz scenarija F5.1.1). Brez commita/pusha, brez posegov v produkcijsko bazo (uporabljena le ločena testna baza `markec_f51_test`).

### 12.1 Stripe concurrency — **PASS** (dokazano z integracijskimi testi + pregledom baze)

**Scenarij:** promocija z `maxRedemptions = 1` (maxUses = 1); dva kupca hkrati ustvarita checkout z isto promocijsko kodo; oba zaključita plačilo; oba webhooka obdelata `checkout.session.completed` (PAID).

**Zaščita (preverjena v kodi):**
- Online naročilo NE unovči ob kreaciji seje — unovči se **ŠELE ob potrjenem plačilu** (`redeemOrderPromotion` v `verifyProductOrder` + webhook), zato preklican/opuščen checkout nikoli ne porabi mesta (§3 odlog).
- Atomsko unovčenje `redeemOrderPromotion`: `SELECT … FOR UPDATE` na vrstici `Promotion` serializira vzporedna unovčenja iste promocije (+ `@@unique([promotionId, orderId])` kot zadnja ograja).
- **LIMIT_REACHED NE pusti naročila v nedoločenem stanju:** ko je promocija do unovčenja že izčrpana, helper popravi naročilo nazaj na polno (nediskontirano) vrednost — `promotionDiscount = 0`, `promotionId = null`, `promotionSnapshot = DbNull`, `total` = shranjen total + popust; naročilo ostane `PAID`, a DETERMINIRANO (popust brez redemptions je izbrisan).
- **Rezervacija/spustitev:** prazen slot (maxUses = 1) ostane za naslednjega realnega kupca; preklican (PENDING / nikoli na PAID poti) ali pretečen checkout ga NE rezervira.

**Dokaz (novi, fokusirani integracijski testi — `tests/integration/f51/promotions.itest.ts`, §3):**
1. **»dva PLAČANA webhooka z maxUses=1 → ena unovčitev, drug order korektiran na polno«** — oba orderja `PAID`, `Promise.all([fresh(oA), fresh(oB)])` (oba webhooka vzporedno). Rezultat: natanko 1 redemption; oba orderja `PAID`; natanko eden obdrži popust (2,00 €) + redemption, drugi je korektiran (popust 0, `promotionId null`, `promotionSnapshot null`, `total` = polna cena, 0 redemption). **PASS.**
2. **»preklican/pretečen checkout ne porabi maxUses=1 mesta«** — PENDING order z isto kodo ne doda nobene redemptions; naslednji realni PAID kupec še vedno unovči (1/1). **PASS.**

**Regresija / matrika (§7.2 nadgrajen 14 → 16 integracijskih testov):**
| Suita | Rezultat |
|-------|----------|
| F5.1 integracija — `vitest.f51.config.ts` (obvezna baza `markec_f51_test`) | **16/16 PASS** (vklj. §4 istočasno unovčenje → ena zmagovalka + LIMIT_REACHED log stalno, kot pričakovano; §3 PENDING ne porabi; §3 prekoračena maxRedemptions) |

> Preverjeno tudi neposredno v bazi `markec_f51_test` po zagonu: tabeli `Promotion`/`PromotionRedemption` + Order promo stolpci + 3 enum tipi obstajajo; redemptions po testih 0 (čiščenje). Nobeno plačano testno naročilo ni ostalo v nedoločenem stanju.

### 12.2 Prisma migration — **DELNO** (ime/vrstni red OK; `_prisma_migrations` evidencija NI zadovoljena na trenutni testni bazi)

| Preverjanje | Rezultat |
|-------------|----------|
| Ime mape `20261201000000_f5_1_promotions` | **PASS** — edina na novo dodana migracija F5.1 |
| Vrstni red glede na predhodnike | **PASS** — sortira za `20261130010000_f22_organization_invitations` (zadnja Nov 2026) in je zadnja v drevesu `prisma/migrations` |
| `prisma migrate status` na `markec_f51_test` | **FAIL/NOT OK** — prijavi **32 neapliciranih** migracij (tudi `20261201000000_f5_1_promotions` med njimi) |
| `_prisma_migrations` vsebuje SAMO to migracijo | **FAIL** — vsebuje le 1 zastarelo/nedokončano vrstico: `20251030000000_add_user_reset_token_and_prefs` (`applied_steps_count = 0`, `finished_at = null`) — F5.1 migracija NI evidentirana |

**Razlaga (znan, vnaprej obstoječi blokator, dokumentiran v §9 in §11.6):**
testna baza `markec_f51_test` je po projektni konvenciji postavljena z `prisma db push` (ne z `migrate deploy`), zato `_prisma_migrations` ne odraža prave zgodovine — vsebuje le ostanke prve migracije `20251030000000_*`, ki sortira pred `init` (20251116) in na sveži bazi pade (§ F2-2-2 · §11.7). Ker `finished_at` vrstice ni zapolnjen, `migrate status` šteje celotno drevo kot neaplicirano. F5.1 objekti v bazi **obstajajo** (db push) in DDL migracije je izolirano verificiran (§7.3): `Promotion`/`PromotionRedemption`/enum/i snapshot-indeksi.

**Zaključek:** zahteva »v `_prisma_migrations` pravilno evidentirana samo nova migracija `20261201000000_f5_1_promotions`« na trenutni `markec_f51_test` **NI izpolnjena** (tabela je praktično prazna/nedokončana zaradi pre-existing blokatorja, NE zaradi napake te migracije). Produkcijske baze nisem uporabljal; `markec_dev` sem pustil nedotaknjen. To ostaja **odprt dolg** za čiščenje baze/migracij.

### 12.3 Spremenjeni artefakti v tem pregledu (samo dokumentacijski + fokusirani testi)
1. `docs/F5-1-ZAKLJUCNI-PREGLED.md` — ta razdelek §12 (rezultati F5.1.1).
2. `tests/integration/f51/promotions.itest.ts` — dodana 2 fokusirana integracijska testa F5.1.1 (stripe concurrency PAID-race + release/reservation ob preklicu/poteku). Brez funkcionalnih sprememb v src/.

---

## 13. F5.1.2 — Stripe payment amount integrity (+ atomska rezervacija mesta)

Ciljna preverjanja po F5.1.1. Izveden ciljni pregled + potreben popravek; drugih promocijskih funkcionalnosti nisem spreminjal. Neprodukcijsko: uporabljena le `markec_f51_test`, brez commita/pusha.

### 13.1 Ugotovljen razkorak (zakaj je bil popravek potreben)

**Simulacija dveh sočasnih checkoutov za promocijo `maxUses=1` (online Stripe produkt):**
- oba checkouta sta ob ustvarjanju videla in zaračunala **popustan** znesek (npr. 8 € pri 10 € in 20 %);
- oba sta plačala 8 € ⇒ `PaymentIntent.amount_received` = 800 za oba;
- ob webhooku `redeemOrderPromotion`: en naročil obdrži popust, drugi zadane `LIMIT_REACHED` in se **korektira navzgor** na 10 €;
- posledica: korektiran `Order.total` (10 €) **NI enak** dejansko zaračunanemu 8 € ⇒ kršena invarianta »plačano == evidentirano«.

Podrobno preverjeno v `product-checkout.ts` (liniji 664–666: `unit_amount` = `discountedTotal`) in `redeem-order.ts` (korekcija `total` na `undiscountedTotal`). **Trenutna rešitev tega ni zagotavljala** → uvedel sem atomsko začasno rezervacijo (§5 zahteve).

### 13.2 Rešitev — atomska začasna rezervacija ob ustvarjanju checkouta

Nova aditivna shema + `src/lib/promotions/reservation.ts`:

- **`PromotionRedemption.status`** `RESERVED | REDEEMED` (default `REDEEMED` — obstoječi zapisi se ne spremenijo) + **`heldUntil`** + **`checkoutSessionId`** (migracija `20261202000000_f5_1_2_promotion_reservation`).
- **`reservePromotionSlot()`** (v transakciji, `SELECT … FOR UPDATE`): sprosti ekspirane rezervacije, preveri `maxRedemptions`/`maxPerCustomer` (še šteje "held" = REDEEMED + nepretečeni RESERVED) in ustvari `RESERVED` vrstico. **Rezervacija zmanjša razpoložljiva mesta** ⇒ drugi sočasni kupec ne dobi popusta, zaračuna/evidentira polno ceno.
- **`convertReservationToRedemption()`**: uspešno plačilo preklopi `RESERVED → REDEEMED` (idempotentno — ponovljeni webhook ne podvoji; `@@unique([promotionId, orderId])` ostaja zadnja ograja).
- **`releaseExpiredReservations()` / `releaseReservation()`**: neuspešno/preklicano/pretečeno plačilo sprosti rezervacijo (`heldUntil < now` → ne šteje več in se lazy-purge-a; ekspliciten preklic sprosti takoj).
- `createProductCheckoutSession` (online pot): rezervacija v ISTI transakciji kot ustvarjanje `PENDING` naročila; končni `Order.total` → Stripe `unit_amount` (vedno enak). Če Stripe session ne uspe, se rezervacija sprosti + PENDING order pobriše.
- Omejitevna štetja v `redeem.ts`/`redeem-order.ts` uporabljajo `heldPromotionWhere` (REDEEMED + nepretečeni RESERVED). Statistika `getAdminPromotions`/`getPromotionById`/`getPromotionRedemptions` šteje **samo REDEEMED** (rezervacije niso uporabe).

**Izid integritete:** poraženec plača in evidentira **polno** ceno; zmagovalec plača in evidentira **popustan** znesek. `amount_received == Order.total` v obeh primerih, `promotionSnapshot` ustreza dejansko zaračunanemu popustu.

### 13.3 Dokaz — integracijski testi (20/20 PASS na `markec_f51_test`)

`tests/integration/f51/promotions.itest.ts` — nov `describe("F5.1.2 — rezervacija mesta + amount integrity")` (4 testi) poleg prejšnjih 16 (nespremenjenih, zelenih):

| # | Test | Dokazuje |
|---|------|----------|
| 1 | sočasno rezerviranje (maxUses=1) | natanko ena rezervacija; druga `LIMIT_REACHED` → poraženec ne dobi popusta |
| 2 | amount integrity | zmagovalec 8 € == evidentirano 8 €; poraženec 10 € == evidentirano 10 €; nikoli isto popust |
| 3 | uspešno plačilo → unovčenje; ponovljen webhook | rezervacija preklopljena v REDEEMED; ponovljen convert → 0 sprememb, še 1 unovčitev (ne podvoji) |
| 4 | pretečen/preklican → sprostitev | ekspiran checkout ne šteje; po sprostitvi slot (1/1) nazaj za naslednjega kupca |

> Opomba okolja: testna baza nima Stripe ključa (org A brez `stripeSecretKey`), zato obstoječa suita preverja **offline** pot. Online Stripe znesek/reservacijo dokazujem na ravni helperjev (reserve→charge→record), kar je neposreden dokaz invariante brez odvisnosti od Stripe HTTP. Interaktivni Stripe click-flow ni izvedljiv v tem okolju (dokumentirano v §9/§11.7).

**Verifikacija:**
| Preverjanje | Rezultat |
|-------------|----------|
| F5.1 integracija — `vitest.f51.config.ts` | **20/20 PASS** |
| TypeScript `tsc --noEmit` (moje datoteke, project tsconfig) | **0 napak** (edini ostanek je .next/dev generiran validator.ts, tuji/transient) |
| ESLint — moje datoteke + test | **0 error, 0 warning** |
| `prisma db push`/generate na `markec_f51_test` | **PASS** (novi stolpci `status`/`heldUntil`/`checkoutSessionId` + enum `PromotionRedemptionStatus`) |

### 13.4 Migracija F5.1.2
- `prisma/migrations/20261202000000_f5_1_2_promotion_reservation/migration.sql` — aditivna (nov enum, 3 stolpci, 2 indeksa). Vrstni red pravilen (Dec 2026, za F5.1). Na testni bazi aplicirana prek `db push` (projektna konvencija, glej §12.2 pre-existing dolg glede `_prisma_migrations`; produkcijske baze nisem uporabljal).

### 13.5 Spremenjeni artefakti (popravek po zahtevi §5)
1. `prisma/schema.prisma` + `prisma/migrations/20261202000000_f5_1_2_promotion_reservation/` — `PromotionRedemptionStatus` enum, polja `status`/`heldUntil`/`checkoutSessionId`, indeksi.
2. `src/lib/promotions/reservation.ts` (**novo**) — reserve/convert/release + `heldPromotionWhere`.
3. `src/lib/promotions/redeem.ts`, `redeem-order.ts` — omejitvena štetja na »held« (REDEEMED + RESERVED nepretečen); `redeem-order.ts` ob PAID pretvori rezervacijo v unovčenje.
4. `src/app/actions/product-checkout.ts` — atomska rezervacija ob ustvarjanju online checkouta; Stripe `unit_amount` = končni `Order.total`; cleanup na neuspehu; vezava na `checkoutSessionId`/`heldUntil` (realni `expires_at`).
5. `src/app/actions/promotions.ts` — statistika/redemptions šteje le `REDEEMED`.
6. `tests/integration/f51/promotions.itest.ts` — 4 novi F5.1.2 testi.
7. `docs/F5-1-ZAKLJUCNI-PREGLED.md` — ta razdelek §13.

---

## 14. F5.1.3 — Final reservation expiry + Stripe consistency check

Ciljni pregled robnih primerov novo rezervacijskega sistema (F5.1.2). Opravljeno **samo** preverjanje + nujen popravek za amount integrity; drugih funkcij promocij nisem spreminjal. Neprodukcijsko: le `markec_f51_test`, brez commita/pusha.

### 14.1 Ugotovljen razkorak — zamujen webhook po sprostitvi rezervacije (popravljeno)

**Robni scenarij (§1):**
1. Stripe plačilo kupca 1 uspe pred `heldUntil`; sproži se `checkout.session.completed`.
2. Webhook za `product_order` prispe **šele po lokalnem `heldUntil`**.
3. Sistem je medtem rezervacijo **sprostil** (`releaseExpiredReservations` → RESERVED vrstica izbrisana) in drug kupec je dobil isto mesto (REDEEMED).

**Staro vedenje (pred popravkom):** `redeemOrderPromotion` ni našel vrstice (ne REDEEMED ne RESERVED) → šel je v LIMIT_REACHED vejo in korektiral `Order.total` **navzgor** na polno ceno. Ker je bilo plačilo že izvedeno na popustan znesek, bi to povzročilo **vse tri kršitve**: napačno zavračanje/prekoračitev, napačen `Order.total`, razliko med `amount_received` (§2).

**Popravek (`src/lib/promotions/redeem-order.ts`):** plačano naročilo, ki na Order nosi shranjen popust (`promotionId` + `promotionDiscount > 0`), odraža **dejanski Stripe znesek** (`amount_received == Order.total`), zato se popust **VEDNO prizna** — nikoli se ne korektira navzgor, ne zavrže že plačanega naročila in ne nastane razlika. Zapis je idempotenten (+ `@@unique([promotionId, orderId])`), ponovljen webhook ne podvoji.

**O »prekoračitvi `maxUses`« (§2):** omejitev uporabe se izvaja **pri REZERVACIJI** (ustvarjanje checkouta), ne pri potrjenem plačilu — zato v **normalnem** toku dva kupca ne moreta oba dobiti istega mesta in `maxUses` ni presežen (dokazano: rezervacija znotraj okna drži slot; druga rezervacija → `LIMIT_REACHED`). Le v izjemnem primeru, ko sta za isto maxUses=1 mesto **oba** res plačala (webhook se je zavlekel čez sprostitev, igla v senu), se priznata oba popusta — trgovec je prejel dve realni plačili, zato je to edina poštena posledica. To je eksplicitno dokumentirano v kodi.

### 14.2 `heldUntil` ↔ Stripe `expires_at` (§3) — PASS (usklajeno)

- `heldUntil` se nastavi iz **realnega** `checkoutSession.expires_at` + 2 h grace (`product-checkout.ts`), **ni zgolj lokalna ura** — rezervacija veže tudi `checkoutSessionId`.
- Sprostitev (`releaseExpiredReservations`) se aktivira šele po izteku tega okna; Stripe poteče le neplačane seje, tako da rezervacija drži mesto čez celoten plačilni vektor. Potrjeno tudi z testom: rezervacija z `heldUntil > now` **ne** sprosti, kasneje pa se slot vrne.
- Najbolj avtoritativen sprožilnik sprostitve bi bil `checkout.session.expired`/`async_payment_failed` webhook, vendar to zahteva naročnino v Stripe dashboardu, ki je tu **NOT VERIFIED** (ni konfiguracije/testnega ključa; §14.5). Lokalni `expires_at + grace` + varna prioriteta za konverzijo dejansko plačanega popusta je varna rezerva.

### 14.3 UX ob neuspeli rezervaciji (§4) — PASS (server-authoritative, jasno)

- Košarica **nikoli** ne napoveduje diskontirane vsote za promocijsko kodo — kazala polni `grandTotal` (vmesna vsota + dostava), z opombo: »Popust se uporabi ob zaključku nakupa, če je koda veljavna« (`cart-content.tsx`).
- Če rezervacija pri checkoutu ne uspe (mesta ni več), `createProductCheckoutSession` uporabi **polno ceno** (brez snapshota) in jo zapiše v Stripe line item. Kupec zato **nikoli ne vidi znižane cene in potem plača višjega**: avtoritativna cena, ki jo vidi/plača, je Stripe checkout stran = `Order.total` = `amount_received`.
- Popust je viden šele na Stripe strani (server-generirana), kar je edini resnični znesek; ni dvofaznega presenečenja.

### 14.4 Stripe test mode (§5) — **NOT VERIFIED (pošteno)**
- V okolju **ni uporabnega Stripe ključa**: `STRIPE_SECRET_KEY` v `.env` je prazen placeholder (dolžina 2, ne `sk_test_`/`sk_live_`), testne organizacije v `markec_f51_test` nimajo `stripeSecretKey` (offline pot). Skrivnosti nisem izpisoval.
- Zato **dejanska Stripe obdelava** (resničen `checkout.session.completed`, `PaymentIntent.amount_received`, `expires_at` timing prek HTTP-ja) ostaja **NOT VERIFIED**. Resničnost rezervacijske invariant sem dokazal na ravni helperjev/procesne logike z integracijskimi testi (reserve→charge→record), enako kot v F5.1.1/F5.1.2.

### 14.5 Migracija `20261202000000_f5_1_2_promotion_reservation` (§6) — PASS (s popravkom)
- SQL je aditivna in samostojna (lasten enum + 3 nullable/defaulted stolpci + 2 indeksa na obstoječi tabeli); na predhodno (F5.1.1) shemo aplikativno čista.
- **Najdena in popravljena neskladnost:** migracija je ustvarjala indeksa `PromotionRedemption_status_heldUntil_idx` in `PromotionRedemption_checkoutSessionId_idx`, a `schema.prisma` NI deklarirala ustreznih `@@index` — pri `db push` (projektna konvencija) bi se zato izgubila. **Popravek:** shema sedaj deklarira oba `@@index`; `db push` na `markec_f51_test` je indeksa ustvaril in potrdil. Migracija in shema zdaj sovpadata.
- Produkcijskih migracij **nisem izvedel**; vrstni red (Dec 2026, za F5.1) je pravilen.

### 14.6 Verifikacijska matrika
| Preverjanje | Rezultat |
|-------------|----------|
| F5.1 integracija (`vitest.f51.config.ts`, `markec_f51_test`) | **22/22 PASS** (16 §3/§4/§5 + 4 rezervacijski + 2 nova F5.1.3 late-webhook) |
| Zamujen webhook ne zavrne plačanega naročila | **PASS** (test: `res.granted === true`) |
| Noben `Order.total` se ne korektira navzgor | **PASS** (test: total ostane 8 € == amount_received) |
| Ni razlike `amount_received` ↔ evidentirano | **PASS** |
| maxUses pri rezervaciji (ne pri redempciji) | **PASS** (druga rezervacija → `LIMIT_REACHED`) |
| Rezervacija znotraj okna se ne sprosti; po izteku se vrne | **PASS** |
| heldUntil ↔ `expires_at` (+grace), vezava `checkoutSessionId` | **PASS** (koda + test) |
| Stripe test mode / resničen HTTP checkout | **NOT VERIFIED** (ni ključa) |
| Migracija F5.1.2 SQL ↔ schema | **PASS** (popravljen `@@index` missing) |
| TypeScript (project tsconfig) — moje datoteke | **0 napak** (edini ostanek .next/dev validator.ts, tuji) |
| ESLint — moje datoteke + test | **0 error, 0 warning** |

### 14.7 Spremenjeni artefakti v tem pregledu
1. `src/lib/promotions/redeem-order.ts` — priznavanje že plačanega popusta (amount integrity); odstranjena korekcija navzgor.
2. `prisma/schema.prisma` — dodana `@@index([status, heldUntil])` in `@@index([checkoutSessionId])` (skladnost z migracijo).
3. `tests/integration/f51/promotions.itest.ts` — 2 nova F5.1.3 testa + posodobljena 2 F5.1.1 testa na rezervacijski model (maxUses pri rezervaciji; oba plačana popusta priznana).
4. `docs/F5-1-ZAKLJUCNI-PREGLED.md` — ta razdelek §14.

## 15. F5.1.4 — Strict maxUses in delayed Stripe webhook (final)

Ciljni pregled in popravek rezervacijskega sistema (F5.1.2/§14) tako, da hkrati veljata OBE pravili:
1. kupec nikoli ne plača drugačnega zneska, kot je evidentiran na naročilu (amount integrity);
2. promocija z `maxUses=1` nikoli ne omogoči DVEH uspešnih unovčitev zaradi zamujenega webhooka (stroga omejitev).

Neprodukcijsko: le `markec_f51_test`, brez commita/pusha, brez drugih funkcionalnih sprememb promocij. **Opomba:** F5.1.4 **razveljavi** §14.1 delni popravek, ki je vsak plačan popust priznaval neomejeno (brez rezervacije) — F5.1.4 zahteva strogo `maxUses`, omejitev se izvaja pri rezervaciji, ne z izmišljanjem unovčitev.

### 15.1 Ugotovljen razkorak (zakaj je bil popravek potreben)
Po F5.1.3 se je vsako plačano naročilo s shranjenim popustom priznalo z novo unovčitvijo, tudi če rezervacije ni bilo — kar bi lahko prekoračilo `maxUses` (kršitev pravila 2). Sprostitev je ravno tako temeljila na lokalni uri (`releaseExpiredReservations` = brisanje ob `heldUntil`), ne na Stripe stanju: ob zamujenem webhooku po izteku bi lahko isti slot dobil še drug kupec → dve plačani popustanovi.

### 15.2 Rešitev — Stripe-backed release + stroga maxUses
- **`src/lib/promotions/reservation.ts`** (predelan, central zdajšnje): 
  - `heldPromotionWhere(promotionId)` šteje **vse RESERVED + REDEEMED**. Slot se sprosti IZKLJUČNO prek Stripe-potrjene reconciliation **NE po lokalni uri** (requirement A).
  - `reconcileExpiredReservations(prisma, {now, promotionId}, resolveSession)`: za vsako ekspirano RESERVED vrsto s `checkoutSessionId` poizvedi Stripe Checkout Session:
    - `paid` → pretvori v REDEEMED;
    - `expired`+`unpaid` → sprosti (izbriše);
    - `processing`/neznano/nedosegljiv API → **OHRANI** (ne sprosti).
    - Vrste brez `checkoutSessionId` (ni Stripe povezave) → ohrani.
  - `reservePromotionSlot`, `convertReservationToRedemption`, `releaseReservation` so ATOMSKI + row-locked (`SELECT … FOR UPDATE` na vrsti) → ista rezervacija ne more biti hkrati sproščena in unovčena (requirement B).
- **`src/app/actions/product-checkout.ts`** — pred rezervacijo poganja `reconcileExpiredReservations` s pripravljenim Stripe session resolverjem; poraženec (če mesta ni) dobi **polno ceno**, zato Stripe zaračuna natanko tisto, kar naročilo evidentira.
- **`src/lib/promotions/redeem-order.ts`** (razveljavi §14.1 blanket): ob PAID se pretvori SAMO obstoječa RESERVED→REDEEMED; če rezervacije ni, se unovčitev **NE izmisli** (stroga `maxUses`) in `Order.total` **se NE korektira navzgor** (amount integrity). Idempotentno prek statusa + `@@unique([promotionId, orderId])`. V normalnem Stripe-točnem toku ta »ni rezervacije« veja za online naročila ni dosegljiva, ker je plačana rezervacija prvo preklopljena v REDEEMED (nikoli sproščena).

### 15.3 Testna matrika (27/27 PASS na `markec_f51_test`, stabilna čez re-rune)
| Zadeva | Rezultat |
|---|---|
| Rule 1 — paid == recorded (amount integrity) | **PASS** — Order.total == amount_received, nikoli korekcija navzgor |
| Rule 2 — strict maxUses=1 ob zamujenem webhooku | **PASS** — samo en REDEEMED | 
| §C1+C3 plačilo pred iztekom + webhook ≥2h pozno → REDEEMED, drugo mesto NE izdano | **PASS** |
| §C2 drugi kupec medtem (slot held) → LIMIT_REACHED | **PASS** |
| §C4 neplačana pretečena seja → Stripe reconciliation sprosti mesto | **PASS** |
| §C5 Stripe API nedosegljiv → rezervacija OHRANI | **PASS** |
| §C6 sočasni webhook(convert) + cleanup(release) → brez dvojnega unovčenja (atomsko) | **PASS** |
| §C7 ponovljeni webhook idempotenten | **PASS** |
| §A8 `stripeSessionStateResolver` (produkcijski, paid/unpaid/processing/unreachable) | **PASS** |
| Rezervacijski testi F5.1.2 (concurrency, amount, convert, expired+unpaid) | 4/4 **PASS** |
| Stari predhodni testi (§3/§4/§5) | zeleni |
| **Skupaj** | **27/27 PASS** |

### 15.4 Stripe test mode / resničen HTTP (requirement E)
V testni bazi `markec_f51_test` nobena org nima Stripe ključa (`stripeConfiguredAt = null`); enako placeholder v `.env`. Zato vsi integracijski testi tečejo po **offline poti** in stanje Stripe seje je v testih podano prek namerno vstavljenega resolverja (`SessionStateResolver`). **Dejanska Stripe obdelava = NOT VERIFIED.** Razlog: ni veljavnega testnega ključa (skrivnosti ne izpisujem).

### 15.5 Migracija `20261202000000_f5_1_2_promotion_reservation`
- SQL je **aditivna/samostojna**: lasten enum (`PromotionRedemptionStatus`), 3 nullable/defaulted stolpci (`status`, `heldUntil`, `checkoutSessionId`), 2 indeksa (`status+heldUntil`, `checkoutSessionId`). Ne spreminja predhodnih (F5.1.1) tabel.
- **Potrjena skladnost s shemo**: `prisma/schema.prisma` deklarira iste stolpce, enum in oba `@@index`; v bazi `markec_f51_test` indeksa obstajata (`PromotionRedemption_status_heldUntil_idx`, `PromotionRedemption_checkoutSessionId_idx`) in enum ima `{RESERVED,REDEEMED}`.
- `prisma migrate status` na `markec_f51_test`: še vedno kaže 32 neapliciranih (poznan F5.1.1 pre-existing blokator: testna baza sinhronizirana z `db push`, prva migracija sortira pred `init`). Ta zapis NI nova težava F5.1.4; produkcija nedotaknjena.

### 15.6 Spremenjeni artefakti v tem pregledu
1. `src/lib/promotions/reservation.ts` — Stripe-backed reconciliation, `heldPromotionWhere` (vse RESERVED+REDEEMED), atomike/row-lock; `releaseExpiredReservations` (lokalna ura) **odstranjena**.
2. `src/app/actions/product-checkout.ts` — `reconcileExpiredReservations` pred rezervacijo; polna cena za poraženca.
3. `src/lib/promotions/redeem-order.ts` — pretvorba RESERVED→REDEEMED, brez izmišljenih unovčitev, brez korekcije navzgor (stroga maxUses).
4. `src/lib/promotions/redeem.ts` — uporablja `heldPromotionWhere` (vse zasedeno).
5. `tests/integration/f51/promotions.itest.ts` — nova `describe("F5.1.4 …")` (A1–A8) + robusten `beforeEach` (čiščenje seed promo + naključnih ostankov) + 4 posodobljeni testi na rezervacijski model.
6. `prisma/schema.prisma` — komentarji usklajeni s F5.1.4 (brez polj/relacij).
7. Spremljajoči pregledi: `tsc --noEmit` 0 napak (edini ostanek .next/dev validator.ts, tuji); `ESLint` 0 error.

### 15.7 Popravek F5.1.4 — manjkajoči `stripeSessionStateResolver` + verifikacija
Ob ponovnem pregledu pred F5.2 je bil odkrit **kritični defekt**: `src/app/actions/product-checkout.ts` je uvažal in klical `stripeSessionStateResolver`, ki **ni bil definiran nikjer** — na produkcijski online (Stripe) poti bi to končalo z `ReferenceError`. Vseh F5.1 testov to ni odkrilo, ker tečejo po **offline poti**.

Popravek:
- `src/lib/promotions/reservation.ts` — dodan `stripeSessionStateResolver(loadSession)` (z `StripeSessionStateInput`): `payment_status="paid"` → `paid`; `status="expired"`+neplačano → `unpaid` (edina dovoljena sprostitev); PI `processing` → `processing`; `open`/še-plačljivo/neznano/Stripe-nedosegljiv → **`unknown` (OHRANI)**, strip seje nikoli ne sprosti po lokalni uri.
- `tests/integration/f51/promotions.itest.ts` — dodan **A8** test, ki neposredno preverja produkcijski resolver (paid/unpaid/processing/unreachable), da se regresija iz #1 ne ponovi.
- Produkcijska varna mreža: reconcile za ekspirane online rezervacije teče ob vsakem izbiraju/obdelavi checkout iste promocije (in plačana pot prek converta); offline najemniki nimajo RESERVED vrstic (unovčenje direktno), zato zablokiranih mest zanje ni. Preostali residual (leak mesta ob daljši Stripe nedosegljivosti tapnega najemnika brez novega checkouta) je **znan in dokumentiran** — priporočen načrtovani/spremljači job kot F5-follow-up, v tem obsegu zavestno ni dodan.

**Stanje po popravku:** F5.1.4 je **logično in profesionalno zaključen** — 27/27 integracijskih testov PASS na `markec_f51_test`, 0 tsc napak v src (edini ostanek tuji .next/dev validator.ts), 0 ESLint napak.