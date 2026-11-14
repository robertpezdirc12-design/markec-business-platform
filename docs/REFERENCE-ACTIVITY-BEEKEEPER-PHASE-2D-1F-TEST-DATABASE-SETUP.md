# MARKEC — FAZA 2D-1F — VZPOSTAVITEV IZOLIRANE TESTNE BAZE

> **Izvedena vzpostavitev popolnoma ločene testne PostgreSQL baze.** Nič `markec_dev`/produkcije; nič
> sheme/migracij brez odobritve (uporabljene so obstoječe commitane migracije na testni bazi); Git operacij
> nobenih; tuj WIP in `einvoices.ts` nedotaknjeni.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Uporabljena infrastruktura (PASS)

- **Docker** deluje (Server 29.9.2). Obstoječi dev DB kontejner `beauty-salon-db` (postgres:16) ima port 5432.
- **Nov, ločen kontejner:** `markec-e2e-test-db` (postgres:16-alpine) na **host portu 5433**, ločena instance
  (drugačen kontejner, drugačen port), podatkovna baza `markec_e2e_test`, uporabnik `markec_e2e`.
- Ni `psql` na PATH hosta — uporabljen `docker exec psql` v kontejnerju (read-only preverbe).

## 2. Dokaz izolacije (PASS)

| Lastnost | Dev baza | Testna baza |
|---|---|---|
| Kontejner | `beauty-salon-db` (5432) | `markec-e2e-test-db` (5433) |
| Ime baze | `markec_dev` | `markec_e2e_test` |
| Uporabnik | (dev) | `markec_e2e` (samostojen) |
| DB v bazi (pg_database) | (niso pregledani) | `markec_e2e_test` + sistemski (postgres/template) — **NI `markec_dev`** |
| Dostop testnega uporabnika do markec_dev | — | **fizično nemogoč** (markec_dev je v drugem kontejnerju, druga instance) |

- `docker exec ... psql -tc "SELECT datname FROM pg_database"` → samo `markec_e2e_test` (ne `markec_dev`). **PASS.**
- Testni URL je na portu **5433** (ne 5432/5432 prod), baza `markec_e2e_test`.

## 3. Konfiguracija in varnostna vrata (PASS)

- **`.env.test`** — testni `DATABASE_URL` na portu 5433 (svet se ne izpisuje; drugačno zaradi guarda).
- **`scripts/test-db-guard.mjs`** — fail-closed: preveri ime testne baze (morajo končati na `_test` ali biti
  `markec_e2e_test`). Preverjeno: `markec_e2e_test` → **OK**; `markec_dev` → **ZAVRNJENO (exit 2)**. **PASS.**
- **`scripts/run-with-test-db.mjs`** — naloži `.env.test`, strže guard, nastavi `DATABASE_URL` v podizvajalcu in
  izvede ukaz (prisma/vitest prek ich vstopnih točk node, brez .cmd/shell-tveganja).
- **package.json** — novi ukazi (dev/prod ukazi nespremenjeni):
  `test:db:migrate`, `test:db:push`, `test:itest`, `test:check-db`.
- `.env` in dev/prod produkcijskih ukazov **niso spremenjeni** (testni ukazi potekajo izključno preko
  run-with-test-db), tako da običajni razvoj še naprej kaže na obstoječo konfiguracijo.

## 4. Rezultati migracij (PASS)

- Namenjena baza: po guardu na `markec_e2e_test`; izvedeno **`prisma migrate deploy`**:
  `00000000000000_baseline`, `20261111100528_f5545_advances`, `20261111142202_einvoice`,
  `20261112000000_f55452_advance_alloc_audit` — **vse uspešno uporabljene** na testni bazi.
- `_prisma_migrations` = 4; tabele (Account, Appointment, Category, …) ustvarjene. **PASS.**
- Uporabljene so bile **obstoječe commitane migracije** (ne nov/diferencial v schema.prisma), zato ni bilo posega
  v tujo shemo; migracije na `markec_dev`-ju niso izvedene.

## 5. E2E priprava (PARTIAL)

- Migracije na testni bazi so izvedene; guard deluje; izolacija dokazana.
- **`test:itest` (vitest.itest.config.ts proti testni bazi) je bil izveden**: 27 testn. datotek **vse fail**
  (33 failed / 305 skipped) — ker je **prazna testna baza brez pričakovanih fixtures** (primer: `createExtensionRecord`
  ne najde org/auth fixture). To je **varen neuspeh** (guard je držal — testi so se povezali na `markec_e2e_test`,
  ne na dev), a E2E še ni pripravljen.
- **Ni bilo pripravljenega testnega uporabniškega računa in čebelarskega workspace-a** — to zahteva, da se
  aplikacija požene z `DATABASE_URL` na testno bazo in registracijo skozi `/start?vertical=beekeeping`, kar je
  naslednji korak (ni izvedeno v tej fazi, ker se dev strežnik trenutno veže na `.env`→`markec_dev`).

## 6. Varnostno preverjanje (PASS)

- Testni uporabnik/baza sta v ločeni Docker instanci port 5433; guard zavrne vsako ne-testno bazo.
- Ni izpisa skrivnosti (vsa izpisa maskirana / brez vsebine).
- Nič zapisov na `markec_dev`/produkcijo; migracije izvedene le na testni bazi.

## 7. Pripravljenost za E2E (PARTIAL / BLOCKED)

- **Pripravljeno:** izolirana baza **`,ven` + guard + migracije + testni ukazi** → E2E okolje je infrastrukturno
  vzpostavljeno.
- **Bločka presuda E2E:** (1) seed fixtures za itest suite še ni; (2) požene app z `DATABASE_URL` na testno bazo
  + registracija testnega čebelarskega workspace-a (naslednja faza); (3) poglobljeno browser/mobilno E2E šele
  nato.

## 8. Odprte blokade

1. **Seed testnih podatkov** za itest suite (`tests/integration/**/*.itest.ts`) — prazna test baza nima fixtures.
2. **Zagotoviti app na testno bazo** (datoteka/dev strežnik z `.env.test`; ne sme spremeniti `.env`).
3. **Testni uporabniški račun + čebelarski workspace** prek aplikacijskih poti (`/start?vertical=beekeeping`).
4. **P1-D-1C concurrency / P2034-retry:** ni v kodi; potrebno DB-integration na tej izolirani bazi (ko je seed net).
5. **P1-D-1D / G7:** tehnična predloga ohranjena (brez sprememb sheme; potrebna odobritev migracije).

## 9. Potrditve

1. Uporabljena le nova, ločena testna infrastruktura (Docker kontejner 5433): DA.
2. `markec_dev` in produkcija nedotaknjena: DA (testni ukazi guard-varjev).
3. Nič sheme brez odobritve: DA (uporabljene obstoječe migracije).
4. Git operacije niso izvedene: DA.
5. Tuj WIP in `einvoices.ts` nedotaknjeni: DA.
6. Skrivnosti niso izpisane: DA.
7. Faza 2D-1A ostaja neodobrena: DA.

**Končni status:**
- Izolacija testne baze: **PASS** (ločen kontejner/port/uporabnik; `markec_dev` ni dosegljiv).
- Guard (fail-closed): **PASS**.
- Migracije na testni bazi: **PASS** (4/4).
- Testni ukazi in `.env.test`: **PASS**.
- E2E priprava (seed + testni workspace + app na testni bazi): **PARTIAL / NOT YET** (BLOCKED na seed/workspace).
- itest suite obratovanje na testni bazi: **failira zaradi neomaljenih fixtures** (varno, ni dev/prod).

**Čebelar ni razglašen za dokončanega.** Naslednji korak: seed testnih podatkov za itest + testni uporabniški
račun + čebelarski workspace preko aplikacije z DATABASE_URL na testno bazo, nato browser/mobilni E2E in
P1-D-1C concurrency na tej izolirani bazi.