# MARKEC — FAZA 2D-1H — SVEŽA REGISTRACIJA IN TESTNI ČEBELARSKI WORKSPACE

> Dejansko izvedena sveža registracija na izolirani bazi `markec_e2e_test` (port 3002), ustvarjen testni čebelarski
> workspace, verifikacija vstopa in del poslovnega toka. **Nič `markec_dev`/produkcije; nič sheme/migracij; Git
> operacij nobenih; tuj WIP in `einvoices.ts` nedotaknjeni; skrivnosti ne izpisane.**
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Stanje pred začetkom
- App na portu 3002 (`run-app-test.mjs`) se povezuje izključno na izolirano bazo (strogi guard `markec_e2e_test`,
  port 5433, user `markec_e2e`, WHATWG URL); `.env` in dev ukazi nespremenjeni. (Dokazi v 2D-1F/2D-1G.)
- Sprememba tokena: strani vseh phase dokumentirane; 413 sprememb v git (nedotaknjen tuj WIP).

## 2. Sveža registracija (PASS)
- **Izbrišen stari session cookie (NextAuth signout prek `/api/auth/signout`) + "Začni na novo" v čarovniku**, tako da
  step 3 ni več ponudil "poveži z obstoječim računom", ampak **obrazec za novo registracijo** (Ime/E-pošta/Geslo).
- Ustvarjen testni račun **`cebeler.e2e@markec.test`/“E2E Cebelar`** (ni vezan na `markec_dev` uporabnike).
- Čebelarski workspace **`e2e-cebelski-panj`** (vertical **beekeeping**, ACTIVE), URL `/s/e2e-cebelski-panj`.
- UI: "Podjetje je ustvarjeno! Vaša stran je na voljo na /s/e2e-cebelski-panj".
- **Baza (izolirana, preverjeno):** `User` (cebeler.e2e@markec.test, role ADMIN), `Organization`
  (slug `e2e-cebelski-panj`, vertical `beekeeping`, status ACTIVE). **PASS.**

## 3. Članstvo + vstop (PASS, z opravljeno opombo)
- **Bug odkrit:** sveža registracija je ustvarila `Organization` + `User.organizationId`, a **NI ustvarila
  `OrganizationMember`** (v `onboarding.ts` je članstvo pod `if (linkUserId)` — v anonimni/sveži veji manjka).
  Simptom: `/dashboard` → `/workspaces` "Na tem računu ni aktivnih poslovnih prostorov".
- **Rešitev (brez tujega WIP posega):** `onboarding.ts` je tuj WIP (M) → ne spreminjam. Z izvajanjem uveljavljenega
  **`scripts/backfill-organization-members.ts`** na testni bazi (idempotentno, `createMany skipDuplicates`,
  nobeno brisanje) se je ustvarila članstvo **ADMIN, isDefault=true** za lastnika. **PASS** (S rešitvijo del: v
  izolirani bazi, ne na shemi).
- Vstop po backfill: `/dashboard` → **200**, `Čebelarstvo`, sidebar vsebuje **"Pregled čebelarstva"**
  (`/dashboard/apiculture`). **Auth C potrjen.**

## 4. Auth stanja
- **A (neprijavljen → /login): PASS** (iz predhodne faze, auth-fix).
- **B (prijavljen brez org → /workspaces): PASS.**
- **C (prijavljen čebelar → /dashboard + /dashboard/apiculture): PASS** (dejansko, port 3002, izolirana baza).
- **Multi-workspace + tuja-org zaščita: NOT VERIFIED** (samo en workspace; org-scoped guardi fail-closed nepočeni —
  `requirePermissionOrg` ni obraze omejen).

## 5. Poslovni tok (PARTIAL — prvi 4 koraki PASS, ostalo NI opravljeno/verify)
Prek `/dashboard/records` (CRUD thick, aplikacijski tok) v izolirani bazi:
| # | Korak | Rezultat |
|---|---|---|
| 1 | Panjska postaja ("Testni cebeljnjak A") | **PASS** — vnos shranjen, št. 1 |
| 2 | Panj ("Panj L-01", povezan z postajo A) | **PASS** — povezava prikazana |
| 3 | Čebelja družina ("Druzina K-1", povezana s panjem L-01) | **PASS** — povezava prikazana |
| 4 | Pregled/zablad | (ni ustvarjen) |
| 5 | Zdravljenje | (ni ustvarjen) |
| 6 | Hranjenje | (ni ustvarjen) |
| 7 | Opravilo ("2026-11-15 Pregled", tarča družina) | **PASS** — vnos shranjen, št. 1 |
| 8 | Pridelek medu | (ni ustvarjen) |
| 9 | Proizvodna serija | — |
| 10 | Izdelek | (ni ustvarjen; zaloga na gl.osness dashboard 6) |
| 11 | Zaloga | ni izvedeno |
| 12 | Naročilo | ni izvedeno |
| 13 | Prodaja/stanje zalog | ni izvedeno |
- **Persistence (PASS):** po ponoven odprti `/dashboard/records` → št. Panjska postaja 1, Panj 1, Družina 1,
  Opravilo 1; podatki trajni v izolirani bazi.
- **Organizacijska izolacija:** vsi zapisi pod org `cmwe1372y...` (samo ta org vidna; tuje org niste testirano
  obstajajo — NOT VERIFIED za cross-org, guardi fail-closed ostanejo).

## 6. Mobilno preverjanje (PASS — render, del tok)
- `390×844`: `/dashboard/apiculture` in `/dashboard/records` **HTTP 200**, hamburger meni, vsebina brez
  horizontalnega drsenja, kartice/tabele `overflow-x-auto`, glavni gumbi (Evidence, Izdelki, Inventura) dostopni.
- Obrazci za vnos na telefonu: **niso bili posebej odprti/testirani** (NOT VERIFIED).

## 7. Z1 nadzorna plošča — opozorilo o nedoslednosti (FAIL/PARTIAL)
- `/dashboard/apiculture` po ustvarjanju zapisov **še vedno prikazuje vse števce 0** in "Ni objavljenih
  izdelkov", ČEPRAV `/dashboard/records` in `ExtensionRecord` v bazi vsebujejo 4 zapise (apiary/hive/colony/task,
  `extensionId=bee-apiary`). Preverjeno v izolirani bazi: `SELECT ... GROUP BY entityKey` → 4 vrstice.
- **Kandidat vzrok:** `getApicultureOverview` (server action) ne šteje pravilno v tej instanci (možna org/session/
  data-source razlika med server action in records server component). **Dokumentirano; ni razglašeno za PASS.**
- **Popravek 500:** `cfg.products` je pri praznem org vračal `undefined` → dodan `?? []`/`?.` (robustno za prazna
  stanja); stran se sedaj izriše 200. Prejšnji 500 na `/dashboard/apiculture` **odpravljen**.

## 8. P1-D-1C — concurrency (NOT VERIFIED / BLOCKED)
- DB-integration concurrency testi zahtevajo **per-feature seedano bazo + beekeeper-relevant itest fixtures**
  (colony-move, variant-checkout), kar v tej izolirani bazi še ni pripravljeno (seedoida fixtures manjka). **NOT
  VERIFIED.** P2034-retry ni v kodi (PARTIAL); predlog omejenega determinističnega retryja.

## 9. Integracijske/regresija
- **tsc:** čist za spremenjene (apiculture.ts defenzivno; no-org-gate/layout iz prejšnje); edina napaka tuja
  `scripts/f631-inspect.ts:40`.
- **unit:** 46/46 PASS (prejšnje).
- **itest suite:** NOT VERIFIED na tem run (per-feature seed baza manjka).

## 10. Odprte blokade
1. **`OrganizationMember` v sveži registraciji ni (bug v `onboarding.ts`, tuj WIP)** — za produkcijsko pravilnost
  potrebna odobritev posega v `onboarding.ts` ali trajni backfill; trenutno rešeno z backfill na test bazi.
2. **Z1 apiculture števci ne sovpadajo z zapisi** — nedoslednost v `getApicultureOverview` (treba raziskati
  org/session/data-source); dokumentirano.
3. **Per-feature seed za itest (colony/moves, variant-checkout)** + testni naročilo/prodaja/Zaloga še ni —
   za celotni 13-korak potek need še izdelek+naročilo+prodaja.
4. **P1-D-1C concurrency**: NOT VERIFIED (seed fixtures).
5. **P1-D-1D / G7**: PROPSED shema — čaka odobritev.

## 11. Potrditve
1. Uporabljeno samo `markec_e2e_test`: DA.
2. Nič `markec_dev`/produkcije; nič sheme/migracij: DA.
3. Git operacije niso izvedene: DA.
4. Tuj WIP (`onboarding.ts`, `einvoices.ts`, schema) nedotaknjen: DA.
5. Skrivnosti niso izpisane: DA.
6. Registracija NI s prejšnjo `markec_dev` sejo (svež account): DA.
7. Faza 2D-1A ostaja neodobrena: DA.

**Končni status:**
- Sveža registracija + testni workspace: **PASS** (izolirano).
- Članstvo/vstop v workspace: **PASS** (po backfill; bugs v onboarding.ts = tuj WIP, odprto).
- Auth A/B/C: **PASS** (A/B prej, C zdaj dejansko).
- Poslovni tok (4 koraki): **PASS**; ostali (pregled/zdravljenje/hranjenje/pridelek/izdelek/zaloga/naročilo/prodaja):
  **NOT VERIFIED** (niso bili izvedeni v tem run).
- **Mobilno:** PASS (render); obrazci NOT VERIFIED.
- **Z1 števci:** FAIL/PARTIAL (nedoslednost zapisov ✓, dashboard 0).
- **P1-D-1C concurrency:** NOT VERIFIED / BLOCKED.
- **P1-D-1D/G7:** PROPSED.

**Čebelarja NE razglašam za dokončanega.** Preostalo za dokončanje: popravek `onboarding.ts` članstva (odobritev),
razčlene vs nedoslednost Z1 števcev, izvedba preostalih korakov poslovnega toka (pridelek/serija/izdelek/zaloga/
naročilo/prodaja) + P1-D-1C concurrency na seeded izolirani bazi.