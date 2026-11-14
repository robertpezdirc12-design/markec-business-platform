# MARKEC — F6.3.1 ZAKLJUČNO POROČILO (E2E preverjanje)

> **POSODOBITEV PO F6.3.2 (dopolnitev zaključka):** blokada `/s/*` je bila razrešena — pravi vzrok
> ni bil shared-tunnel, temveč **napačna zaupanja-vredna env URL-ja** (`NEXT_PUBLIC_APP_URL` /
> `NEXTAUTH_URL` privzeto na 3000 = tuj projekt). S prijavo MARKEC na portu 3008 z
> `NEXT_PUBLIC_APP_URL=http://localhost:3008` in `NEXTAUTH_URL=http://localhost:3008` je bil
> **dejanski E2E za vse 4 dejavnosti izveden uspešno** (podrobno v `docs/F6-3-2-DIAGNOSTIKA-DOSTOPA.md`):
> mehanik (SPLIT hero, booking), frizer (minimal/centered hero, booking), šivilja (povpraševanje +
> merilni list), čebelar (trgovina s košarico + ocene). Strukture se dejansko razlikujejo. Status
> E2E iz tega dokumenta (prej NOT VERIFIED) se **posodablja na PASS** za prikaz 4 dejavnosti.

> Verifikacijska naloga (odobrena 2026-11-11, možnost 1): vzpostaviti varno izolirano bazo
> `markec_f631_test`, 4 testne tenante (mehanik/frizer/šivilja/čebelar), zagnati MARKEC na
> prostem portu in izvesti dejanski E2E prikaz. Statusi: **PASS / PARTIAL / FAIL / NOT VERIFIED /
> NOT IMPLEMENTED**. Ločeni: dejansko preverjeno (kodo/vs test) vs sklep na podlagi kode.

---

## 1. Začetno stanje repozitorija

- Veja `main`, repo `C:/Users/admin/Documents/Qoder/markec-app`.
- `git status`: **101 M / 193 ?? / 30 D** (necommitten WIP — moje F6.1–F6.3 + drugi agenti;
  v tej fazi nič spremenjeno/commutano).
- Moji nove datoteke te faze: `scripts/f631-e2e-setup.ts`, `scripts/f631-e2e-fetch.ts`
  (izolirani, izključno za testno bazo).

## 2. Razlog, zakaj je prej tekel napačen projekt (»Discover Slovenia AI«)

Port **3000 posluša tuj Next.js projekt** (PID 19264):
`C:\Users\admin\Cortex Home\My Workspace\.cortex\discover-slovenia-ai\...start-server.js`.
`view_page`/`fetch_url`/`node` na `/s/*` poti v tem sandboxu gredo preko **shared
HTTP-tunnel/proxy**, ki servira tuj »Discover Slovenia« — ne MARKEC. To je potrjeno: MARKEC next
na prostem portu v lastnem logu **nikoli ne zabeleži `/s/mehanik-test`** (cross-check pod §4).

## 3. Vzpostavitev varnega testnega okolja (PASS)

1. **Nova baza** `markec_f631_test` (docker Postgres, `beauty-salon-db`) — `CREATE DATABASE`.
2. **Migracije** iz uradne zgodovine aplicirane (brez spreminjanja migracijskih datotek):
   `00000000000000_baseline`, `20261111100528_f5545_advances`, `20261114142202_einvoice`,
   `20261112...advance_alloc_audit` (vse uspešno; prisma migrate deploy).
3. **4 testna tenanta** (izmišljeni; `scripts/f631-e2e-setup.ts`):
   - `mehanik-test` (lag). profile → org vertical `mehanik` → `_templateId=modern-bold`(split)
   - `frizer-test` → `frizer` → `_templateId=classic-elegant`(centered)
   - `sivilja-test` → `seamstress` → `_templateId=minimal-light`(minimal)
   - `cebelar-test` → `beekeeping` → `_templateId=minimal-light`(minimal+products)
   Vsaka ima `publishState=PUBLISHED`, `publishedSiteContent` snapshot + `publishedContentVersion=1`,
   catalog (seedOrganizationCatalog) + forms/workflows (materializeProfileAssets) + staff.
   Preverjeno v bazi: `_templateId` = modern-bold/classic-elegant/minimal-light (4 različne po
   dejavnosti). **PASS** — podatki so izolirani (samo v `markec_f631_test`).
4. **Zagon MARKEC** na prostem portu **3007** (port 3007 posluša izključno naš next, PID 61388):
   ```
   cd C:\Users\admin\Documents\Qoder\markec-app
   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f631_test?schema=public&& npm run dev -- -p 3007
   ```
   Dokaz da je MARKEC: naš next v lastnem logu (Proxy) logira `GET / 200 … proxy.ts` in
   `GET /api/auth/session 200`; `GET /mehanik-test` → **MARKEC-ev slovenski 404** (»Nazaj na
   domačo stran / Storitve«). Ne logira `/s/*` tujega. **PASS** da je to MARKEC (ne tuj).

## 4. Zagon in dejanski fanföPre prikaz (BLOCK — NOT VERIFIED)

- Javna pot MARKEC tenanta je `/s/{slug}` (npr. `/s/mehanik-test`).
- V tem sandboxu grejo vsi requests na `/s/*` stret skozi shared tunnel → **prikažejo tujega
  "Discover Slovenia AI"** (ne glede na port; chunki `%5Bturbopack%5D...`, `discover-slovenia-ai`).
- **Dokaz:** naš next (cmd) posluša 3007; `node` fetch `/s/mehanik-test` vrne tujega (sti`Discover
  Slovenia`) in **ni zabeležen v logu našega next** — request ne pride do našega strežnika.
- Zato **javni prikaz 4 različnih MARKEC javnih strani v browserju/fetch ni bil mogoče zanesljivo
  izvesti** v tem okolju. Po §8: **NOT VERIFIED** (ne nadomeščamo z unit testi).

Ampak: `_templateId` in layout manifest sta **v bazi pravilno dodeljena** (mehanik→modern-bold,
frizer→classic, šivilja/čebelar→minimal) — konfiguracijski del **PASS** (iz baze), a **NI
dokazano v prikazu** (browser).

## 5–8. E2E po dejavnostih in primerjava struktur — NOT VERIFIED (prikaz)

| Dejavnost | Prikaz javne strani | Struktura | CTA | Mobile |
|---|---|---|---|---|
| Avtomehanik | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Frizer | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Šivilja | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Čebelar | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |

Razlog: `/s/*` blokiran (shared tunnel), glej §4. Dejanska *vsebinska* razlika med dejavnostmi je
potrjen na podatkovnem nivoju (`_templateId`, materializiran catalog/forms/workflows per-tenant) in
v unit testu `tests/site-layout-f63.test.ts` (10/10: mehanik→split/workflow, frizer→centered/
services, šivilja→minimal/workflow, čebelar→minimal/products) — ampak to NOPE je nadomestek za
E2E prikaz.

## 9–10. Urejevalnik, predogled, org izolacija, CTA, mobile

Ni bilo izvedljivo kot browser (zaradi §4). Ne morem potrditi v prikazu → **NOT VERIFIED**.
(Logika urejevalnika/predogleda — templates-panel→applyTemplate + editable-site-preview posreduje
profileId — je na podlagi kode skladna, ampak ni vizualno dokazano.)

## 11. Dejansko izvedeni testi / preverbe in rezultati

| Postopek | Rezultat |
|---|---|
| Diagnoza porta 3000 (tuj process) | **PASS** — PID 19264 = discover-slovenia-ai (Cortex Home) |
| Nova baza `markec_f631_test` + migracije (uradne) | **PASS** |
| 4 tenanti (mehanik/frizer/šivilja/čebelar), PUBLISHED, catalog+forms+snapshot | **PASS** |
| `_templateId` per dejavnost v bazi (modern/classic/minimal) | **PASS** |
| Zagon MARKEC na 3007 (z DATABASE_URL=f631) — odgovori MARKEC (200/404, proxy log) | **PASS** |
| Prikaz `/s/{slug}` (node/view_page) — blokirano shared tunnel | **FAIL/Blok** → E2E prikaz **NOT VERIFIED** |
| Unit test `site-layout-f63` (razlike v konfiguraciji) | 10/10 PASS (le dopolnilo, NE nadomestilo E2E) |
| E2E browser 4 dejavnosti (struktura/CTA/mobile/izolacija) | **NOT VERIFIED** |

## 12. Odkrite napake / omejitve / za nadaljevanje

- **Ključna omejitev:** v tem sandbox okolju `view_page` in celo `node fetch` na `/s/*` poti ne
  dosežeta lokalnega MARKEC-next — shared HTTP-tunnel servira tuj projekt. To ni povezano s port
  zasedenostjo (3007 je prost, PID naš); je omejitev predstavitvenega sloja.
- **Za dejanski prikaz potrebujem eno od:**
  - (a) browser/HTTP dostop do `/s/{slug}` ki gre NEPOSREDNO na lokalni MARKEC port (brez shared
    tunnel / s pravilnim host-headerjem), ali
  - (b) vire za public-hostname/domain test (kar je /vercel deploy — ni dovoljeno),
  - (c) oz. dovoljenje za predstavitev javne strani prek alternative (npr. `open_preview` z
    drugim routingom), če obstaja.
- Ni poškodbe: `markec_dev`/produkcija/ostale testne baze niso spremenjene; `git add/commit/push`
  niso bili izvedeni; WIP drugih ni dotaknjen; migracijske datoteke nespremenjene.

## Status po področjih

| Področje | Status |
|---|---|
| Diagnoza tujega projekta / portov | **PASS** |
| Vzpostavitev varne baze + migracij (uradne) | **PASS** |
| 4 izolirani objavljeni tenanti + `_templateId` | **PASS** |
| Zagon MARKEC na prostem portu (3007, DATABASE_URL=f631) | **PASS** |
| Dejanski E2E prikaz 4 javnih strani (struktura/CTA/mobile) | **NOT VERIFIED** (blokada `/s/*` v okolju) |
| Urejevalnik / predogled / org izolacija (v prikazu) | **NOT VERIFIED** |
| Ne nadomeščanje E2E z unit testi | **PASS** (spoštovano) |

---

**Zaključek:** varno testno okolje je **vzpostavljeno in delujoče** (nova baza + 4 objavljeni
tenanti + zagnan MARKEC na 3007; `_templateId` po dejavnosti pravilen). Dejanski **browser E2E
prikaz 4 različnih MARKEC javnih strani ni bilo mogoče izvesti** zaradi `/s/*` shared-tunnel blokade
v tem sandboxu — oznaka **NOT VERIFIED** (po §8). Konfiguracijski del (dodelitev predloge/strukture)
je potrjen iz baze in unit testov; vizualno potrdilo ostaja odvisno od vzpostavitve neposrednega
dostopa do lokalnega MARKEC strežnika po `/s/*` (glej §12).