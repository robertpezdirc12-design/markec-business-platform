# MARKEC — FAZA 2D-1E — IZOLIRANO TESTNO OKOLJE IN ČEBELARSKI E2E

> Ugotovitev **glede izolacije testne baze** in priprava varnega načrta. **Brez zapisov brez potrjene izolacije;
> nič sheme/migracij/baze/Git; tuj WIP in `einvoices.ts` nedotaknjeni; `markec_dev`/produkcija nedotaknjena.**
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Izolacija testne baze — NIJE POTRJENA (BLOCKED)

Pregled konfiguracije (brez izpisa skrivnosti):
- Prisotne okoljske datoteke: **le `.env`** (in `.env.example`). **Ni `.env.test`, `.env.test.local`, `.env.development`.**
- `DATABASE_URL` (maskirano) → **`localhost:5432/markec_dev`** — to je **`markec_dev`, ki je izrecno prepovedana**
  ("Brez posegov v markec_dev"). Ni ločene testne baze.
- `vitest.config.ts` = pure enota brez DB; **`vitest.itest.config.ts` zahteva ročno `DATABASE_URL` na izolirani
  bazi** (komentar `markec_f631_test`) — a **to ni nastavljeno** v okolju.
- Zato **ni resnično izolirane testne baze** v tem okolju.

**Pravilo (iz navodila):** "Samo ime ali oznaka `test` ne dokazuje izolacije." — ni ti izolacije; zato **ne
izvajam nobenih zapisov, ne ustvarjam testne organizacije/workspace-a, ne izvajam DB-integration koncy-lock testov.**

## 2. Predlog za vzpostavitev izolirane testne baze (PROPOSED)

Potrebno za varno izvedbo čeblarskega E2E in P1-D-1C concurrency testov:
1. Ustvariti ločeno Postgres bazo, npr. `markec_e2e_test` (ni `markec_dev`, ni produkcija) za izključno testiranje.
2. Nastaviti `.env.test` (ali eksplicitno `DATABASE_URL` v ukazu zagonu) na ta test naslov (maska gesla).
3. Zagnati `prisma migrate deploy`/`db push` na TEST bazo (posebej, ne na `markec_dev`/prod).
4. Preveriti izolacijo: drugačen host/dbname/user od `markec_dev` in produkcije.
5. Prek **aplikacijskih poti** (registracija/onboarding) ustvariti testni račun + čebelarski workspace
   (`/start?vertical=beekeeping`), ne neposrednih DB-vstavkov.
6. Nato izvesti:
   - auth states A/B/C (prijavljeni/no-org/org-beekeeper);
   - celoten 13-korak browser E2E (postaja→panj→družina→pregled→zdravljenje→hranjenje→opravilo→pridelek→
     serija→izdelek→zaloga→naročilo→prodaja) z ponovnim odprtjem;
   - mobilno 390×844;
   - P1-D-1C concurrency DB-integration (sočasne prodaje/dobava/inventura/rollback/P2034 retry).

Brez tega koraka → **E2E in DB-integration sta BLOCKED.**

## 3. Auth stanja (browser, read-only)

| Stanje | Vhod | Rezultat | Status |
|---|---|---|---|
| A — neprijavljen | (brez seje na /dashboard) | preusmeritev na `/login` | PASS (guard `!session.user`; prej HTTP 500) |
| B — prijavljen, brez org | trenutna seja (račun brez workspace-a) | **200 na `/workspaces`** "ni aktivnih poslovnih prostorov" | **PASS** (dejansko potrjen) |
| C — prijavljen + org | (ni org v tej seji/DB) | layout normalen; org-scope guardi fail-closed | NOT VERIFIED (ni org v okolju) |
| Multi-workspace / dostop do tuje org | (ni podatkov v `markec_dev`) | ni mogoče preveriti brez izolacije | NOT VERIFIED |

## 4. Čeblarski browser E2E
- **BLOCKED** — zahteva izolirano test bazo z delujočo čebelarsko org (ni je v ta okolju); ne zapišem v
  `markec_dev`.

## 5. Mobilni E2E (390×844)
- **BLOCKED** (isti razlog; Z1/evidence/izdelki/naročila so pod org-scoped admin z no-org).

## 6. Poslovni tok
- **BLOCKED** dokler ni izolirane test baze.

## 7. Regresijski testi
- **tsc:** čist za admin-layout/no-org-gate (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 46/46 PASS (stock, server-schema, entry-checkout 65-69).
- **browser:** landing 200; /dashboard 500→200 (izbor prostorov) — auth-fix potrjen.

## 8. Odprte blokade
1. **Izolirana test baza** (ne obstaja) → blok za E2E/mobilni/P1-D-1C DB-integration.
2. **P1-D-1C P2034-retry:** ni v kodi (PARTIAL); dodati omejen deterministični retry (max 3), test iran na izolirani bazi.
3. **P1-D-1D / G7:** tehnična predloga ohranjena (idempotency `StockOperation`; `ProductionContribution`/
   `OrderItemBatchAllocation`) — **brez sprememb sheme/migracij** (potrebna odobritev).

## 9. Potrditve
1. Nič zapisov ni izvedeno (izolacija ni potrjena): DA.
2. Nič sheme/migracij/baze: DA.
3. Git operacije niso izvedene: DA.
4. `einvoices.ts` in tuj WIP nedotaknjeni: DA.
5. `markec_dev`/produkcija nedotaknjeni: DA.
6. Skrivnosti niso izpisane: DA.
7. Auth-fix (Stanje B) potrjen v browserju: DA.
8. Faza 2D-1A ostaja neodobrena: DA.

**Končni status:**
- Izolacija testne baze: **NOT CONFIRMED → ustavljeno pri predlogu varne test baze** (brez zapisov).
- Auth stanja: **A=B potrjeno (B dejansko browser), C in multi-org NOT VERIFIED**.
- Čeblarski E2E / mobilni / P1-D-1C DB-integration: **BLOCKED** (ni izolirane baze).
- P1-D-1D / G7: PROPSED predloga, brez sprememb.
- Regresija: **PASS** (tsc/unit).

**Čebelarja ne razglašam za dokončanega. Naslednji nujen korak: vzpostaviti izolirano test bazo (predlog §2),**
nato E2E/mobilni/P1-D-1C varnostni pregledi.