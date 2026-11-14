# MARKEC — FAZA 2D-1E — CELOVITO BROWSER PREVERJANJE, POSLOVNI TOK IN DOKONČANJE ČEBELARJA

> E2E operativno preverjanje in dokončanje referenčne dejavnosti Čebelar. **Nič sheme/migracij/baze/Git; tuj WIP in
> `einvoices.ts` nedotaknjeni; `markec_dev`/produkcija nedotaknjena.**
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Predhodna revizija (EXISTING-VERIFIED)
- Stanje predhodnih faz: P1-D-1A (zaščita `S−RES>=qty`), P1-D-1B (variant inventura), P1-D-1C (zaklepanje),
  Z1 (nadzorna plošča `/dashboard/apiculture`), N1 (nav item) — vse **implementirano in tsc/unit sprejeto** v
  prejšnjih fazah (poročila P1-D-1A/B/C, Z1, N1).
- Nadaljnja tsc+unit v tej fazi: **tsc čist (le tuja `scripts/f631-inspect.ts:40`); 46/46 unit PASS.**
- Dev strežnik (`next dev`, port 3000) je zagnan; javna stran dosegljiva.

---

## 2. Browser preverjanje

### 2.1 Javna stran (PASS)
- `GET /` → **HTTP 200**, brez runtime napak; landing vsebuje **Čebelarstvo** (`/start?vertical=beekeeping`),
  vse dejavnosti med drugim. → **PASS**.

### 2.2 Admin območje — KRITIČNA UGOTOVITEV (FAIL / BLOCKED)
- `GET /dashboard` in `GET /dashboard/apiculture` → **HTTP 500**:
  `UnauthorizedError: No organization found for this account` (v `requirePermissionOrg`, prek `listProjects`→`AdminDashboard`).
- **Korenski vzrok:** `src/app/(admin)/layout.tsx` **ne preveri `session` pred izrisom**; ko ni prijavljene seje/
  aktivne org, podrejene strani (dashboard itd.) **vržejo `UnauthorizedError`, ki ni ujet → 500** namesto
  preusmeritve na `/login`.
- **Blokada popravka:** `(admin)/layout.tsx` je **tuj neodobren WIP (M)** → dodajanje preusmeritve bi bilo poseg v
  tuje spremembe (prepoved). Zato **ne popravljam**; to je odprta točka, ki zahteva ločeno odobritev.
- **Posledica (BLOCKED):** čebelarske nadzorne plošče Z1, N1 navigacije ter vseh admin/records/izdelkov/naročil
  **ni mogoče browser-preveriti** v trenutnem stanju, ker celotno admin območje požge 500 ob pomanjkljivi seji.

### 2.3 Poslovni tok / mobilno (BLOCKED)
- Celoten 13-korak browser E2E in mobilno (390×844) **ne izvedljivo** zaradi 500 na admin območju; razen tega
  pisni poslovni tok (ustvarjanje postaj/panjev/prodaj) **zapiše v DB, katere izolacije ne morem potrditi** — kar
  je prepovedano brez znanega test okolja. → **BLOCKED / NOT VERIFIED**.

---

## 3. P1-D-1C — DB-integracijski testi (NOT VERIFIED / BLOCKED)
- **Retry P2034:** NI dodan (ni omejenega determinističnega retryja v kodi; to je kot PARTIAL v poročilu 1C).
- **DB-integration concurrency testi** (sočasne prodaje, dobava+prodaja, dve inventuri, variant-race, rezervirana
  zaloga, rollback, org izolacija): **NOT VERIFIED** — ni potrjenega izoliranega test DB; `DATABASE_URL` kaže na
  bazo, katere izolacije ne morem preveriti (ne smem pisati vanjo). Priporočen izoliran test DB + test zagon.

---

## 4. P1-D-1D in G7 — predlog za nadaljevanje (PROPOSED, brez sprememb)

### P1-D-1D — Idempotentnost
- Potreben **PROPSED model `StockOperation`** (ali `idempotencyKey`+`payloadHash` na StockMovement):
  `id, organizationId, operation, idempotencyKey, payloadHash?, createdById, createdAt` +
  **`@@unique(organizationId, idempotencyKey)`**; indeks `(org, operation)`.
- Idempotency zapis strogo v isti transakciji kot zaloga+StockMovement (ni točka razlike).
- Vpliv na stare zapise: additive (NULL), migracija varna; preveriti uniq; rollback → revert.
- Prizadete datoteke: `src/lib/prisma/...` nov model; akcije `inventory.ts`, `product-checkout.ts`; stranišče UI neuveljavljen.
- Tuj WIP: `product-checkout.ts` (tuj), `schema.prisma` (tuj) → **blokada pri migraciji**, potrebna odobritev.

### G7 — Sledljivost pridelka→serija→izdelek→prodaja
- Potreben **PROPSED** modeli `ProductionContribution` in `OrderItemBatchAllocation` (+ povezave na
  `StockMovement.batchRecordId`/`reservationEventId`, `ExtensionRecord` harvest/batch).
- Vpliv: obstoječi ExtensionRecord harvest/batch **ostanejo ne-povezani** (ne izmišljati izvora); nova odnosna
  alokacija le za nove.
- Migracija: additive; nič starejših naročil se ne dotika.
- Prizadete: `schema.prisma`, `records.ts`, `inventory.ts`, `product-checkout.ts`, novi modeli.
- Blokada: shema/migracija → **zahteva ločeno odobritev**; tuj WIP v product-checkout/schema.

---

## 5. Regresijsko preverjanje
- **TypeScript:** čist za vse moje datoteke (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **Unit:** 46/46 PASS (stock, server-schema, entry-checkout 65-69).
- **Browser:** landing PASS; admin območje **FAIL (500)** — prekinja Z1/N1/business/mobilni.
- **DB-integration / concurrency / P2034-retry:** NOT VERIFIED (ni izoliranega DB).
- Čebelarski testi 2B/2C: nisem jih ponovno zagnal (zahteva izolirano test okolje z DB); **NOT VERIFIED**.

---

## 6. Odkrita napaka (vredna prednostne obravnave)
**Admin območje (vključno z Z1 dashboard) požge HTTP 500 namesto preusmeritve na prijavo, ko ni akt inkorg/seje.**
Koren v `(admin)/layout.tsx` (visoke zaščenost — tuj WIP). Popravek = dodati `auth()` + `redirect("/login")` (ali
ustrezen guard) na začetek layouta. **To je prednostni kandidat za odobritev posega / prednostno rešitev**, ker
odkleni celotni admin tok (Z1, evidence, izdelki, naročila, prodaja).

---

## 7. Končni status po področjih

| Področje | Status |
|---|---|
| Javna stran / landing | PASS |
| Z1 dashboard (implementacija) | PASS (impl+tsc+unit); browser BLOCKED zaradi 500 |
| N1 navigacija (implementacija) | PASS (impl+tsc+unit); browser BLOCKED zaradi 500 |
| P1-D-1A/B/C (implementacija) | PASS (impl+tsc+unit); DB concurrency NOT VERIFIED |
| Browser poslovni tok (13-koz akov) | **BLOCKED** (admin 500 + neznana DB izolacija) |
| Mobilno (390×844) | **BLOCKED** (admin 500) |
| Retry P2034 (1C) | NOT VERIFIED / PARTIAL (ni v kodi) |
| P1-D-1D, G7 | PROPOSED (shema; čaka odobritev) |
| Tuj WIP / `einvoices.ts` / schema / migracija | Nedotaknjeno |

**Zaključno: čebelar NI popolnoma dokončan/referenčen, dokler:**
(a) admin območje 500 ni odpravljeno (auth-guard v layoutu — zahteva odobritev posega v tuj WIP);
(b) Z1/N1 nista browser-prek signals prek prijavljene seje;
(c) poslovni tok E2E in mobilno E2E se ne izvedeta v izoliranem test okolju;
(d) P1-D-1D/G7 nista po odobritvi sheme.

**Naslednja konkretna naloga:** odobritev posega v `(admin)/layout.tsx` (dodati unauthenticated-auth redirect), nato
browser preverjanje Z1/N1 in poslovnega toka.

---

## Potrditve
1. Spremenjena samo dokumentacija (ta poročilo): DA (nobena izvorna koda v tej fazi NI spremenjena).
2. Nič sheme/migracij/baze: DA.
3. Git operacije niso izvedene: DA.
4. Tuj WIP in `einvoices.ts` nedotaknjeni: DA.
5. `markec_dev`/produkcija nedotaknjena: DA.
6. Faza 2D-1A ostaja neodobrena: DA.

**Status: PARTIAL (implementacijske enote PASS; E2E/browser/mobilni BLOCKED/FAIL zaradi auth-500; DB-integration
NOT VERIFIED; shema predloga odprta). Ne razglašam čebelarja za dokončanega.**