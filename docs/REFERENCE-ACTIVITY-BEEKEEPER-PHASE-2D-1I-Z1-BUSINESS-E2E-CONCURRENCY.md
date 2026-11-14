# MARKEC — FAZA 2D-1I — Z1, CELOTEN ČEBELARSKI POSLOVNI TOK IN TESTI ZALOG

> Dejansko izvedeno na izolirani bazi `markec_e2e_test` (port 3002, strogi guard, user `markec_e2e`).
> **Nič sheme/migracij; Git operacij nobenih; tuj WIP (`onboarding.ts`, `einvoices.ts`, schema) nedotaknjen;
> skrivnosti ne izpisane.** Statusi: PASS/PARTIAL/FAIL/NOT VERIFIED/BLOCKED.

---

## 1. Odprava nedoslednosti Z1 (PASS — vzrok dokazan in odpravljen)

**Simptom:** `/dashboard/apiculture` prikazuje 0 števcev, čeprav `ExtensionRecord` v izolirani bazi vsebuje 4+ zapise.

**Diagnoza (dokazana, ne domnana):**
- DIAG v `getApicultureOverview` je pokazal, da `requirePermissionOrg` razreši **pravi `org.id`** (`cmwe1372y0000wgqocviz9834`).
- A **`prisma.$transaction(async () => {...})` je v server-action runtime vrnil objekt z vsemi polji `undefined`**
  (`cfg.counts = undefined`, `cfg.products` len 0), čeprav enake poizvedbe direktno na isti bazi vrnejo podatke
  (preverjeno z loč. diag: `groupBy` → apiary/hive/colony/task, skupaj 4).
- **Vzrok:** `prisma.$transaction` ob več read-ins v Next server-action kontekstu ni vračal podatkov (nedefinirani
  rezultati), kar je bila pravi vir "0 števcev".

**Popravek (v `src/app/actions/apiculture.ts`, lastna koda):** odstranjen `prisma.$transaction`; branja (org-scoped)
izvedena s **`Promise.all`** (vzporedno, nič transakcije — za samo reads ni bila potrebna). Odstranjeni DIAG logovi.
Ostal defenziven `?? []`/`?.` za prazna stanja (brez umetnih vrednosti — prikazuje dejanske številke).

**Merilo PASS:** po popravku dashboard prikazuje dejanska števila, ujemajoč z bazo:
**Panjske postaje 1, Panji 1, Čebelje družine 1, Pregledi 1, Zdravljenja 1, Opravila 1** (+ izdelki 6 z
zaloga/rezervirano/razpoložljivo). **PASS.**

## 2. Poslovni tok (PARTIAL — rezultati po korakih)

Uporabljen app tok `/dashboard/records` (aplikacijske akcije), v izolirani bazi:

| # | Korak | Status | Dokaz |
|---|---|---|---|
| 1 | Panjska postaja "Testni cebeljnjak A" | PASS | vnos shranjen; št. 1 |
| 2 | Panj "Panj L-01" ↔ postaja A | PASS | povezava prikazana; Langstroth |
| 3 | Čebelja družina "Druzina K-1" ↔ panj | PASS | povezava prikazana; starost matice 2 |
| 4 | Pregled družine (2026-11-14, V redu, matica) | PASS | vnos shranjen; povezava na družino |
| 5 | Zdravljenje (2026-11-10, Preventiva) | PASS | vnos shranjen; razlog |
| 6 | Hranjenje/oskrba | — | isti mehanizem kot (5) (ni ustvarjeno v tem run; mehanizem dokazan) |
| 7 | Opravilo (2026-11-15, Pregled, rok) | PASS | vnos shranjen; tarča družina |
| 8 | Pridelek medu | NOT VERIFIED | isti mehanizem; ni ustvarjen v tem run |
| 9 | Proizvodna serija | NOT VERIFIED | serija/lot tab obstaja; ni ustvarjeno |
| 10 | Izdelek | PASS (prikaz) | 6 izdelkov s stockQuantity/reservedQuantity v dashboardu |
| 11 | Preverjanje zaloge | PASS (prikaz) | tabletka zaloga/rezervirano/razpoložljivo (Akačijski 40/0/40 …) |
| 12 | Naročilo | BLOCKED/NOT VERIFIED | checkout (Stripe+webhook) = zaščiten tuj WIP; brez njega ni varno napraviti testnega naročila |
| 13 | Prodaja / izdaja zaloge | BLOCKED/NOT VERIFIED | odvisno od checkout; ni izvedeno |

- **Trajnost (PASS):** po ponovnem odprtju so vse evidence ohranjene (št. bar-line za vsak tab), pravilne povezave
  (apiary→hive→colony→inspection→treatment→task).
- **Neizvedeno izdelek/naročilo/prodaja do konca:** zahteva Stripe checkout (tuj WIP) — označeno BLOCKED, brez
  nadomestnega toka (kot zahteva navodilo).

## 3. P1-D-1C — integracijski / concurrency testi (NOT VERIFIED)
- **Sočasne prodaje / dobava+prodaja / sočasni inventur / delno rezervirano / variante / rollback / org izolacija:**
  zahtevajo **per-feature seedano izolirano bazo + beekeeper/inventurne itest fixtures** (colony-move, variant-checkout),
  ki v tem okolju še niso pripravljeni. **NOT VERIFIED.** Ne izmišljenih rezultatov.
- **P2034-retry:** ni v izvorni kodi (PARTIAL). Omejen deterministični retry (maks. 3 poskusi, brez podvajanja
  StockMovement/dogodkov) je tehnično priporočen, a **ni vnesen** — predlagan kot ločen odobren poseg, da ne
  spremenimo poslovnih pravil brez potrebe in testa.

## 4. Mobilno preverjanje (PASS — dejanska uporabnost)
- 390×844: dashboard čebelarstva, `/dashboard/records` (evidence) in **obrazec "Dodaj vnos — Panj"** preverjeno:
  **HTTP 200, brez horizontalnega preliva; vsa polja (Oznaka panja, Panjska postaja izberi, Vrsta panja, Moč, Datum,
  Opombe) in Shrani/Prekliči dostopni in uporabni; povezava panja s postajo izbirna na telefonu.** **PASS.**

## 5. Membership v onboarding.ts (BLOCKED na odobritev; tehnična ugotovitev pripravljena)
- `docs/REFERENCE-ACTIVITY-BEEKEEPER-2D-1I-ONBOARDING-MEMBERSHIP-TECHNICAL-NOTE.md`
- Točno mesto: `onboarding.ts:298-342` (anonimna veja) ne kliče `organizationMember.create` (za razliko od
  linking veje :250-260). Minimalni predlog: `createMany({ ..., skipDuplicates:true })` po `createdUserId =
  user.id`; idempotentnost; regresijski testi (nova registracija, več podjetij, org izolacija, cleanup). `onboarding.ts`
  je tuj WIP → **ne spreminjam; čakam izrecno odobritev.**

## 6. Regresija
- **tsc:** čist (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 46/46 PASS.
- **Browser:** /dashboard, /dashboard/apiculture (žive številke), /dashboard/records, mobilno — vse 200 in deluje.

## 7. Odprte blokade
1. **Naročilo/prodaja** (checkout Stripe = tuj WIP) — BLOCKED za poslovni E2E; potreben varno-presipleal test na
   izolirani bazi ali odobritev.
2. **P1-D-1C concurrency** — NOT VERIFIED (per-feature seed za beekeeper/inventurne itest).
3. **onboarding.ts članstvo** — čaka odobritev za popravek (tehnični predlog pripravljen).
4. **Pridelek/serija/hranjenje/matica** — mehanizem dokazan, a niso v celoti ustvarjeni/verificirani (NOT VERIFIED).
5. **P1-D-1D / G7** — PROPSED shema, čaka odobritev.

## 8. Potrditve
1. Uporabljeno samo `markec_e2e_test` (guard): DA.
2. Nič `markec_dev`/produkcije; nič sheme/migracij: DA.
3. Git operacije niso izvedene: DA.
4. Tuj WIP in `einvoices.ts` nedotaknjeni: DA.
5. Skrivnosti ne izpisane: DA.
6. Nobena funkcionalnost ni označena PASS brez dejanskega preverjanja (Z1 stevci=DB; vrstice v bazi; browser 200):
   DA. Faza 2D-1A ostaja neodobrena.

**Končni status:**
- Z1 nedoslednost: **PASS** (vzrok dokazan, popravljen; stevci = baza).
- Poslovni tok: **PARTIAL** — 6/9 evidenc (postaja, panj, družina, pregled, zdravljenje, opravilo) uspešno
  ustvarjenih, povezanih in trajnih; pridelek/serija/hranjenje/matica niso v celoti; **naročilo/prodaja BLOCKED**
  (Stripe tuj WIP).
- Z1 dashboard (izdelki/zaloga): **PASS** (prikaz, org-scoped).
- Mobilno (390×844): **PASS** (uporabni obrazci).
- P1-D-1C concurrency: **NOT VERIFIED**; P2034-retry: PARTIAL (ni v kodi).
- on-boarding članstvo: tehnična ugotovitev PASS; izvedba BLOCKED.

**Čebelarja NE razglašam za dokončanega** — za to je potrebno še: odobritev popravka `onboarding.ts` članstva,
uspešno testno naročilo+prodaja (na varni poti izven Stripe tujega WIP ali odobritev), P1-D-1C concurrency na
seedani izolirani bazi in dopolnjeni zapisi predelka/serija.