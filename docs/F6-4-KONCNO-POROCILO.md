# MARKEC — F6.4 KONČNO POROČILO (Vizualni urejevalnik + galerije/FAQ + E2E)

> Faza F6.4 po načrtu `docs/F6-4-PLAN.md`. Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED.
> Browser E2E v pravem browserju (Playwright chromium + Chrome DevTools MCP) na izolirani
> `markec_f631_test` (dev) in `markec_f501_test` (materializacija). Niti produkcije, `markec_dev`
> ni niti sezelenih migracij/sheme ni spreminjal; brez `git add/commit/push`.

---

## 1. Cilj in obseg (iz PLAN)

Vizualni urejevalnik: klikni-sekcijo-uredi, sekcije (dodaj/premakni/skrij/odstrani), vsebina,
fotografije, mobile/desktop predogled, shrani osnutek, objava → javna. Posebej galerije/FAQ
vklop/izklop + E2E; f501 materializacija profilov; S7/S8 diagnostika trgovine/rezervacij.

## 2. Git status / WIP drugih (pred in med)

- `git diff --stat` ob začetku: **130 datotek WIP drugih agentov** (velik obseg; `proxy.ts`,
  `site-editor/`, `einvoices.ts`, `categories.ts`, `customers.ts`, …). Ni bil prepisan.
- **OVIRA (v bistvu za proizvodni build in dev log):** `src/app/actions/einvoices.ts:51`
  `export function formatLabel` v server-action datoteki → Next vyhod "Server Actions must be async".
  Ta tuji WIP je padel tako `next build` (P3005 → build fail) kot delno `/dashboard/einvoices` in
  včasih dev overlay na drugih straneh. **Nisem ga popravil** (§8: poseg v tuji WIP → ustaviti se in
  predlagati). Presledek: Playwright + browser E2E izvedeni na **dev serverju** (ne production build),
  ker build je blokiran s tujim WIP. `vitest` regresija ni na njega odvisna.

## 3. Galerije in FAQ — ugotovitev o "modulu"

- Galerije/FAQ **NISO moduli v `OrganizationModuleState`** (dokaz: `src/lib/modules/catalog.ts` nima
  id-jev `gallery`/`faq`). Vidnost zanje določata **`isPublic` + `isPublished` (+ objava)** na
  entitetah (Gallery/FaqItem). Javni renderer vrne sekcijo le, če `getPublicGalleries/Faq` vrne podatke
  (`GalleriesSection`/`FaqSection` return null pri 0) → **ni mrtvih CTA, nobene prazne sekcije**.
- Preverjeno browserjeno (S5): aktivna (isPublic+isPublished) → sekciji prikazani; izklop (isPublic=false)
  → izginela; ponovni vklop → vrnjeni, podatki ohranjani; izolacija (cebelar brez podatkov → brez sekcij).

## 4. Playwright E2E — dejanski rezultati (S1–S6)

Datoteka: **`e2e/visual-editor.spec.ts`** (novo) + `playwright.visual.config.ts` (dev/f631).
Poganja: `PROJECT_URL=http://localhost:3012 npx playwright test e2e/visual-editor.spec.ts
--config playwright.visual.config.ts` (realni chromium).

| Test | Rezultat | Čas |
|---|---|---|
| S1 klikni-sekcijo-uredi → shrani osnutek → objavi → javna | **PASS** | 27.6 s |
| S2 DeviceId 390/768/1440 brez overflow | **PASS** | 19.8 s |
| S3 skrij sekcijo (Vidnost) | **FAIL** (dev-overlay zaradi tuji WIP einvoices) — glej §7; dejansko skrivanje browser-MCP potrjeno | vzrok tuji WIP |
| S4 naloži fotografijo (hero) → predogled/objava | **PASS** | 13.5 s |
| S5 galerija+FAQ aktivna → izklop → skrita → data ohranjena | **PASS** | 4.6 s |
| S1b cebelar izolacija (ne kaže frizerjeve galerije/FAQ) | **PASS** | 9.9 s |

Skupaj: **5 PASS / 1 FAIL(S3)** — S3 je sel ovira NEPOMAN execute zaradi dev-overlay (Next.js dev
overlay zaradi tujega WIP einvoices), ne aplikacijske funkcionalnosti. (Videno v dev log:
`/dashboard/einvoices 500` + `Server Actions must be async` + `data-nextjs-dev-overlay` intercepts.)

## 5. Browser dokazi (Chrome DevTools MCP, f631 dev 3012) — dopolnilo/neodvisno potrditev

- **S1 (ob java)**: odprt Vizualni urejevalnik → klikni "Uredi sekcijo hero" → fields (Naslov/
  Podnaslov/Glavni gumb/Slika+Naloži) odprti. Spremenjen naslov → iframe predogled TAKOJ (postMessage)
  prikazal nov naslov; "Shrani osnutek" → draft v DB (`contentVersion` 3); "Objavi" → javna h1 =
  "Med iz lastnih panjev — F6.4" → **PASS**.
- **S2**: klik 390 → iframe širina 390, `scrollW 380 ≤ clientW 380` (no overflow) → **PASS**.
- **S3**: klik 🙈 na "Ocene" → predogled sekcije reviews izginil (`hasReviewSec:false`); "Dodaj" →
  panel z "Lastna sekcija", dodano custom se pojavi → **PASS (MCP)**.
- **S5 (node+DB)**: frizer galerija+FAQ prikazani (id=galerija/pogosta-vprasanja); isPublic=false →
  izginili (ni CTA); isPublic=true → vrnjeni, Gallery(1)+Faq(2) ohranjena → **PASS**.
- **S6 izolacija**: čebelar nikjer ne kaže frizerjeve galerije/FAQ → **PASS**.

## 6. Materializacija profilov (§6) — prej NOT RUN, zdaj dejanska

- Prejšnji `tests/integration/f2-3/f501-materialization.itest.ts` je bil NOT RUN in (na `markec_f23_test`)
  je fail: baza ni migrirana na trenutno shemo (P3005, `parentId` column missing).
- Ustvaril **`markec_f501_test`** (sveža, `prisma migrate deploy` z uradnimi migracijami), dopolnil itest
  DB-check na `["markec_f23_test","markec_f501_test"]` (testna sprememba, dovoljena).
- Rezultat: **3/3 PASS** — izjeme T96.991→generic, C14→skd-c-manufacturing in repr. podrazredi
  materializirajo uporaben, ne-prazen workspace (katalog+form). **§6 → PASS (nov dejanski dokaz).**

## 7. Ovira / omejitve

- **Tuji WIP blocker:** `src/app/actions/einvoices.ts:51` (non-async export v server-action file).
  Blokira production build in včasih dev overlay. **Ni odpravljeno (prepoved §8).** Predlog: avtor
  einvoices naj `formatLabel` prenese iz server-action datoteke v npr. `src/lib/einvoice/labels.ts`
  ali naredi `export async function`. To mora potrditi lastnik WIP-ja.
- **S3 (Playwright)** nisem mogel potrditi kot zelen zaradi tega dev-overlay; funkcionalno je PASS
  prek MCP (§5). Prepoznano kot sel/okoljska ovira, ne funkcionalna.
- **S7/S8 (trgovina/rezervacije)** — diagnostika (ne razvoj) iz obstoječih dokazov F6.3:
  trgovina (košarica dodaj, zaloga `computeAvailableStock`, checkout server-authoritativno) PASS;
  booking (frizer)/inquiry (šivilja/cebelar, merilni list; `/booking`→307 `/inquiry`) PASS. Polna
  checkout/rezervacijame E2E implementacija je F6.5/F6.6 (ni v F6.4). 
- **S4 fotografija**: dejanski upload prek `POST /api/upload` → Path B (DB media, `/api/media/{id}` —
  brez Cloudinary ključev) je delovalo v Playwright (S4 PASS). To ni mock — self-host media route.
  (Cloudinary Path A je le kadar je konfiguriran; v tem okolju Neo → DB-backed, valid produkcija.)

## 8. Regresija / testi

- **Vitest:** `npx vitest run` → **91 datotek / 1325 testov PASS**.
- **itest f635** (varnost F6.3.5): **7/7 PASS**.
- **itest f501** (materializacija): **3/3 PASS** (nova markec_f501_test).
- Novi datoteki: `e2e/visual-editor.spec.ts`, `playwright.visual.config.ts`, `e2e/fixtures/f63-test.png`.
- Test podatki v f631: frizer galerija(1)+FAQ(2) dodani kot demo/test (izolirana baza, dovoljeno).

## 9. Opazke / preostale omejitve

- Vizualni editor za vse 4 dejavnosti ni bil individualno odprt (S1 potrjen na cebelarju + frizer —
  Playwright), ker je dev-overlay občasno blokiral vračanje; pri pozitivi UI (enak Editor) predvidevam
  enako za vse. Celostno (vse 4 ročno) ostaja F6.7/regresija. Pošteno: **S1 za cebelarja in frizerja
  PASS; ostali iz kode/istega editoria PARTIAL**.
- Nisem dal id za S3 (skrij) avtomatizirano zelen — le MCP. Za popoln green spec je potreben
  clean production build (odpravljen tuji WIP), nato spec S3 deluje.

## 10. Statusni pregled

| Področje | Status |
|---|---|
| S1 klikni-sekcijo-uredi → shrani → objavi → javna | **PASS** (Playwright + MCP) |
| S2 mobile/desktop toggle 390/768/1440, no overflow | **PASS** (Playwright + MCP) |
| S3 sekcije dodaj/skrij/odstrani | **PARTIAL** — MCP PASS skrij+dodaj; Playwright S3 sel ovira (dev WIP) |
| S4 fotografije (upload/predogled/s hran/objava) | **PASS** (Path B self-host media) |
| S5 galerije + FAQ vklop/izklop, podatki ohranjeni, izolacija | **PASS** (Playwright + node/DB) |
| S6 izolacija org | **PASS** |
| f501 materializacija profilov (prej NOT RUN) | **PASS** (3/3, nova markec_f501_test) |
| Regresija vitest | **PASS** (1325/1325) |
| Trgovina / rezervacije / inquiry (diagnostika F6.5/F6.6 vhod) | **PARTIAL** (existing F6.3 dokazi; poln tok je F6.5/F6.6) |
| **Produkcijski build** | **NOT RUN** — blokira tuji WIP `einvoices.ts` (predlog §7) |

## 11. Priporočilo pred F6.5

1. Lastnik WIP naj odpravi `einvoices.ts:51` (non-async export), da se production build vrne na zelen.
2. Nato pognati `e2e/visual-editor.spec.ts` v production mode (deterministično) za S3 apple-green.
3. F6.5 (trgovina) lahko nato nadgradi existing PASS osnovo (checkout E2E, zaloga, dostava).

**F6.5 se ne začne brez nove odobritve.** Ustavljam se ob koncu tega poročila.