# MARKEC — FAZA 2D-1G — TESTNI PODATKI, TESTNA APLIKACIJA IN ČEBELARSKI E2E

> Na izolirani bazi `markec_e2e_test` (Docker 5433). Utrjen guard; testna app se požene; registracija čebelarja
> naleti na cross-environment sejo. **Nič `markec_dev`/produkcije; nič sheme/migracij; Git operacij nobenih;
> tuj WIP in `einvoices.ts` nedotaknjeni; skrivnosti ne izpisane.**
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Utrditev guarda (PASS)

`scripts/test-db-guard.mjs` sedaj **strogo** zahteva za ta projekt:
- host `localhost`, **port `5433`**, baza **`markec_e2e_test`**, uporabnik **`markec_e2e`**; razčlenjeno s
  **WHATWG URL** (ne regex); preverja tudi **`DIRECT_URL`** (če je prisoten).

Preverjeno (6 scenarijev):
| Scenarij | Rezultat |
|---|---|
| 1. pravilna testna povezava | **OK (PASS)** |
| 2. `markec_dev` | **ZAVRNJENO** |
| 3. produkcijski host | **ZAVRNJENO** |
| 4. druga baza na portu 5433 | **ZAVRNJENO** |
| 5. drug uporabnik (5433, prava baza) | **ZAVRNJENO** |
| 6. nepričakovan `DIRECT_URL` | **ZAVRNJENO** |

`scripts/run-with-test-db.mjs` uporablja `shell:false`, preveri `DIRECT_URL`, ne prepisuje `.env`; prek
`run-app-test.mjs` požene Next na testni bazi (port 3002) in nastavi `NEXTAUTH_URL` na testni port.

## 2. Testne fixtures (PARTIAL / BLOCKED)

- Pregled vseh integration itest datotek: vsaka suite zahteva **svojo predhodno seedano bazo** (npr. `markec_f21_test`,
  `markec_f631_test`) ter **obstoj določenih uporabnikov/organizacij po e-pošti/id-jih** — ne samostojno seedanje znotraj
  `beforeAll` (preverja `current_database()` na določeno ime in šteje pričakovane org).
- Zato **izvajanje vseh 27 itest datotek proti enemu `markec_e2e_test` ni združljivo brez prilagoditve / ločenih
  seedanih baz**; in večina (advances/dokumenti/einvoices/promotions...) ni čebelarski obseg, nekateri gredo na
  tuj WIP (einvoice). **Seeding vseh zunaj tega obsega → NOT izvedeno (BLOCKED za celoten itest suite).**
- Beekeeper-relevantne itest (f2-3 colony/moves, f54 variant-checkout): zahtevajo seedane uporabnike/org za svojo
  določeno testno bazo — **niso izvedeni** (NOT VERIFIED), razen če se pripravi per-feature seed, kar je
  prihodnji korak.

## 3. Testna aplikacija na testni bazi (PASS — bootstrap)

- `scripts/run-app-test.mjs` požene Next dev na **portu 3002** z `DATABASE_URL` = `markec_e2e_test` (guard OK,
  `NEXTAUTH_URL` = `http://localhost:3002`). **Aplikacija se boota in povezuje na izolirano testno bazo.**
- `markec_dev` dev strežnik (port 3000, ki sem ga prej uporabljal) je bil ustavljen zaradi Next-lock; nastavljiv
  ponovno.
- `.env`/dev ukazi nespremenjeni.

## 4. Ustvarjanje testnega čebelarja (FAIL / BLOCKED — cross-environment session)

- `/start?vertical=beekeeping` na portu 3002 je **funkcionalen do 3. koraka**: dejavnost Čebelarstvo ✓, podjetje
  (ime "Testni Cebelar E2E", URL `test-cebeler-e2e` **"Prosto"** ✓), lastnik ✓.
- Ob ustvarjanju podjetja aplikacija vrne **"Seja ni več veljavna. Prijavite se znova in poskusite še enkrat."**
  **Vzrok (dejansko ugotovljeno):** NextAuth sea sejo iz aplikacije `markec_dev` (port 3000) — uporabnik
  `vizija@markec.test` **ne obstaja v izolirani testni bazi**, zato "poveži z obstoječim računom" odpade in
  vaMest stop. **To ni napaka aplikacije, temveč nedoslednost med okoljema.**
- **Za pravilno izolacijo je treba registrirati svežega uporabnika NA 3002** (izbris session/cookies + register),
  kar v trenutnem skupnem brskalniku ni zanesljivo izvedljivo za popoln čebelarski poslovni tok.

## 5. Auth stanja, poslovni tok, mobilno

- **Auth stanja A/B** (iz prejšnje faze, na dev/live): A→/login, B→/workspaces **PASS** (auth-fix). **C** in
  čebelarski workspace: **BLOCKED** (potrebna sveža registracija na 3002).
- **Poslovni tok (postaja→panj→...→prodaja): BLOCKED** dokler ni funkcionalnega testnega workspace-a.
- **Mobilno 390×844: BLOCKED** (isti razlog).

## 6. P1-D-1C — concurrency

- **NOT VERIFIED** — zahteva seedane fixtures + delujoč testni workspace na izolirani bazi; ni izvedeno zaradi
  blokade iz §4/§2.
- **P2034-retry** ni v kodi (PARTIAL); dodati omejen deterministični retry, testiran na izolirani bazi.

## 7. Odprte blokade in naslednji koraki

1. **Sveža registracija na testni instanci (3002)** — izbris NextAuth cookies/localStorage v izoliranem brskalniku,
   nato `/start?vertical=beekeeping` z NOVIM računom; s tem nastane testni čebelar + workspace v izolirani bazi.
2. **Per-feature seed** za beekeeper-relevant itest (colony/moves, variant-checkout) na svojo testno bazo.
3. Nato: auth C, celoten čebelarski browser E2E, mobilno, P1-D-1C concurrency.
4. **P1-D-1D / G7** predloga (idempotency / sledljivost) — brez sprememb sheme, čakajo odobritev.

## 8. Potrditve
1. Uporabljena samo izolirana testna baza (5433, `.env.test` + guard): DA.
2. `markec_dev`/produkcija nedotaknjena: DA.
3. Nič sheme/migracij brez odobritve: DA (samo obstoj prvih migracij na testni bazi, iz 2D-1F).
4. Git operacije niso izvedene: DA.
5. Tuj WIP in `einvoices.ts` nedotaknjeni: DA.
6. Skrivnosti niso izpisane: DA (guard maskira).
7. Faza 2D-1A ostaja neodobrena: DA.

**Končni status:**
- Guard (strict): **PASS** (6/6).
- Testna app na izolirani bazi: **PASS** (bootstrap + delujejo prvi koraki).
- Ustvarjanje testnega čebelarja na izolirani bazi: **FAIL/BLOCKED** (cross-environment sea — potrebna sveža
  registracija na 3002).
- Čebelarski E2E / mobilno / P1-D-1C concurrency: **BLOCKED** (dokler ni svežega testnega workspace-a + per-feature seed).
- P1-D-1D / G7: PROPSED, brez izvedbe.

**Čebelarja ne razglašam za dokončanega.** Naslednji konkretni korak: sveža registracija testnega uporabnika
direktno na portu 3002 (izoliran brskalnik/brez markec_dev seje) → nastane testni čebelarski workspace v izolirani
bazi → nato celoten E2E + P1-D-1C.