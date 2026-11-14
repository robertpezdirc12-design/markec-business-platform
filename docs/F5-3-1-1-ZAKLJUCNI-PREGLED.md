# F5.3.1.1 — Zaključni pregled: Recovery razvojnega okolja + Browser Acceptance

> F5.3.1 (vizualni urejevalnik) je implementiran v prejšnjem ciklu. Ta epika je:
> (1) odpravila pred-obstoječo Next.js/Turbopack okvaro, ki je preprečevala lokalni zagon,
> (2) izvedla dejanski **Chromium browser acceptance** na namenski migrirani testni bazi,
> (3) zaključna validacija (Vitest / TypeScript / ESLint).
>
> **Brez produkcijskih migracij, brez commita in pusha. Nepovezane funkcionalnosti nespremenjene.**

---

## 1. Pregled sprememb (kontrola)

Zahtevano preverjanje pred delom je bilo opravljeno:

- **`git status`** — potrjeno; velik del delovnega drevesa so že prejšnje (drugi agenti) nedokončane
  spremembe, ki jih ta epika **ni dotaknila** (seed, categories, profile, promotions,
  custom-profile-builder, reservation, F51 integration — vse izven obsega).
- **Celoten `git diff`** — pregledan; skupaj 5190 vstavljenih / 1020 odstranjenih vrstic glede na HEAD.
- **Datoteka z »1.076 odstranjenimi vrsticami«** — **konkretne datoteke s 1076 odstranjenimi vrsticami
  v sledljivem diff-u** ni bilo mogoče najti: največja samostojna odstranitev je `dashboard/page.tsx`
  (251 vrstic), ostale so manjše. Število se ne ujema z nobeno posamezno datoteko niti s celoto
  (1020). Vsa odstranjevanja prihajajo iz drugih agentov (nedotaknjena). **Nobena funkcionalnost tega
  urejevalnika ni bila izgubljena** — `src/components/site-editor/` je intakten in se poglavje 3
  urbanje preverjeno deluje.
- **Sprememba `next.config.ts`** — aditivna: `turbopack.root` + preview-only izjema CSP/XFO
  (podrobno §2 in §5). Nima vpliva na produkcijsko vsebino/objavo.
- **Potrditev, da WIP drugega agenta ni prepisan** — dotaknili smo se samo F5.3.1 datotek
  (`site-editor/*`, `branding-tabs.tsx`, `icons/*`, `branding-editor|publication-card|settings`),
  vse ostalo nedotaknjeno.

---

## 2. Odprava napake Next.js/Turbopack (dokazan vzrok)

### 2.1 Raziskava
- **Dejanski root projekta:** `C:\Users\admin\Documents\Qoder\markec-app`.
- **Package/lock datoteke:** uradni `package.json` + `pnpm-lock.yaml` sta v `markec-app`;
  vse ostalo pod `node_modules`/`.next` je nameščeno/generirano. Na poti navzgor obstaja še
  **zapuščen `C:\Users\admin\package-lock.json`** (npm, 23 paketov: `@heyputer/puter.js`,
  `socket.io`, `bundle-name` … — nepovezano s projektom; **brez `package.json` v tisti mapi**;
  mtime 2026-11-09, starejši od projekta).
- **Uradni package manager:** `pnpm@10.34.9` (`packageManager` v `markec-app/package.json`).
- **Vzrok napačnega workspace-root (dokazan iz Next izvora):** `next/dist/lib/find-root.js`
  → `findRootLockFile(cwd)` najde najbližji lockfile, nato hodi po nadrejenih mapah in zbira
  vse `pnpm-lock.yaml`/`package-lock.json` … Nadrejeni lockfile (`C:\Users\admin\package-lock.json`)
  potisne `rootDir = dirname(lastLockFile)` = `C:\Users\admin`. Zato je Turbopack izbral
  **`C:\Users\admin`** za workspace root.
- **Zakaj išče tailwindcss na napačni lokaciji:** iz `C:\Users\admin` se PostCSS `@tailwindcss/postcss`
  razrešuje v `C:\Users\admin\node_modules` (ni / ne vsebuje `tailwindcss`); pravi paket je v
  `markec-app\node_modules\.pnpm`, do katerega zaresni root ni segel → `Can't resolve 'tailwindcss'`.

### 2.2 Najmanjši popravek (brez vpliva na produkcijsko konfiguracijo)
V `next.config.ts` dodano:
```
turbopack: { root: __dirname }
```
To zavestno določi koren projekta in prepreči, da bi Turbopack-ova auto-detekcija izbrala
`C:\Users\admin`. **Ni bila izbrisana `C:\Users\admin\package-lock.json`** (ni v workspace; lastništvo/
uporaba nista dokumentirana). Z **čistim `.next`** je `next dev --turbopack` stekel in `GET /` vrne
**HTTP 200** (prej: resolver napaka na vsaki strani). Stari `.next/turbopack` z napačnim root-om je
prevladoval – po čiščenju je popravek delujvč.

> **Nadaljnja opomba:** če bi hoteli varno odstraniti tudi vzrok (namesto overrida), je treba
> prej potrditi lastnika `C:\Users\admin\package-lock.json`; to smo namerno pustili odprto.

---

## 3. Browser acceptance (Chromium, namenska testna baza)

### 3.1 Priprava testnega okolja
- **Namenska testna baza:** `markec_f531_test` (dedicated; `prisma db push` iz aktualne sheme —
  tako kot ugibljene prejšnje testne baze zaradi dokumentirane base-migration težave; brez
  produkcijskih migracij).
- **Pooblaščena testna seja:** iz seeda `admin@rcbeautysalon.org / admin123` (ADMIN demo-salon);
  dodano aktivno osebje (drugače `publishSite` blokira objava brez osebja), `cliente`,
  `org-b` + `adminB` za cross-org.
- **Skripti (v workspace):**
  - `scripts/_f531-seed-content.ts` — deterministična priprava (reset baseline, snapshot, uporabniki).
  - `scripts/f531-browser-flow.cjs` — Playwright acceptance (16 korakov, DATABASE_URL hard-guard
    na `markec_f531_test`).
- Dev server je tekel z `DATABASE_URL=...markec_f531_test`.

### 3.2 Rezultati (16/16 PASS, dvakrat zapored reproducirano)
| # | Test | Rezultat | Dokaz |
|---|------|----------|-------|
| A | prijava podjetnika | PASS | admin → /dashboard |
| B1 | odprt vizualni urejevalnik + basni snapshot | PASS | iframe=true sections=true pubVer=1 |
| C | izbor sekcije (O nas) | PASS | inspector prikazan |
| D | urejanje naslova → predogled takoj posodobljen | PASS | iframe h1 = "F5.3.1 Testni Naslov Edita" |
| P | sprememba fotografije (obstoječi upload) | PASS | `/api/media/{id}` → heartbeat hero.imageUrl po shranitvi osnutka |
| E | naprave 1440 / 768 / 390 | PASS | width {1440,768,390} = natanko |
| F | drag-and-drop razvrščanje sekcij | PASS | hero premaknjen v seznamu |
| G | premik sekcije s puščicami | PASS | Storitve premaknjene |
| H | dodajanje lastne sekcije | PASS | Nova sekcija v seznamu |
| I | shranjevanje + ponovno nalaganje osnutka | PASS | draftAfter="F5.3.1 Testni…" se ohrani, javni nespremenjen |
| M | anonim NE vidi osnutka na draft-preview ruti | PASS | `/preview` → 200 na `/s/demo-salon` (javna), draftLeak=false |
| Q | hkratno urejanje NE tiho prepiše (stale zavrnjen) | PASS | staleToast=1, draft ne vsebuje "STALE TEST" |
| J | javna stran pred objavo NESpremenjena | PASS | javni="Vaša lepota, naša strast" (snapshot), draft="F5.3.1…" |
| K | objava → javna stran nove verzije | PASS | snapshot & javni = "F5.3.1 Testni…" |
| L | povratek na objavljeno | PASS | povržen osnutek, javni ostane objavljen |
| N | uporabnik druge org NE uredi demo-salon | PASS | adminB → svoja org (org-b), nikoli demo-salon vsebina |

Posnetki so shranjeni v začasni mapi (`os.tmpdir()/markec-f5311/shots`) — skripta jih piše za vsak korak
(`b-editor`, `d-hero-edited`, `e-390`, `f-reordered`, `p-photo`, `m-anon`, `n-other-org`, …).

### 3.3 Predogled in naprave
- Vgrajeni iframe na **390 px, 768 px, 1440 px** prikazuje **isti** `/s/demo-salon/preview?edit=1`
  (isti `HomeContent` renderer kot javna stran), NE približne kopije. Širina iframe = natanko izbrana
  naprava (izmerjeno v E).
- Ista vsebina/dizajn potrjena prek postMessage (`preview-content`) → urejanje v inspectorju se
  takoj odrazi v iframe predogledu (test D).

### 3.4 Varnost (potrjeno)
- **Anonymous ne more videti draft predogleda:** `GET /s/demo-salon/preview` → 307 → javna stran;
  na `/preview` ne pride nič osnutka (M).
- **Org izolacija:** uporabnik druge organizacije (adminB) ne vidi/ne uredi demo-salon urejevalnika;
  vsebina je omejena na njihovo lastno org (N; resolve-tenant na `org-b-f531`).
- **Objava zahteva `settings.manage`:** vse akcije (getOrgBranding/updateSiteContent/publishSite) gredo
  skozi `requirePermissionOrg("settings.manage")`; adminB (ni član demo-salon) jih nima.
- **Iframe dovoljen SAMO na preview poti:**
  - `/s/demo-salon/preview` → `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`
  - `/s/demo-salon` (ostalo) → `X-Frame-Options: DENY` + `frame-ancestors 'none'`
- **postMessage preverja origin + tip:** v `src/lib/site-editor-bridge.ts` (`isTrustedOrigin` +
  `isEditorMessage`/`isPreviewMessage`); obe strani uporabljata skupne konstante. Delujoče dokazano s
  testi D/F (predogled sprejema editorjevo vsebino; predogled pošilja `section-select`).

> Varnostnih kontrol nismo izklapjali in proxyja nismo obhajali — uporabili smo lokalni Playwright
> Chromium proti lokalnemu testnemu strežniku z namensko testno bazo (enak pristop kot obstoječi
> `scripts/f222-browser-flow.cjs`).

---

## 4. Zaključna validacija

- **Vitest:** 85 datotek, **1230/1230 testov PASS** (vklj. `publication`, `site-content-versioning`,
  `site-sections-101`, `schema-tenancy`, `org-scoped-permissions`, `guard-rules`).
- **TypeScript `tsc --noEmit`:** **0 napak v vseh F5.3.1 datotekah.** Preostali izpis vsebuje samo
  napake v datotekah drugih agentov (seed, categories, profile, promotions, custom-profile-builder,
  promotions/reservation, f51 integration, e2e staff) — nedotaknjene, izven obsega.
- **ESLint:** **0 errors / 0 warnings** na F5.3.1 datotekah.
- Opomba: `.next/dev/types/validator.ts` je generirana datoteka, ki se ob menjavi dev procesa
  pokvari; s started preverjanjem je bil odstranjen (same-generates).

---

## 5. Dokazila / posnetki
- Rezultati browser toka: `os.tmpdir()/markec-f5311/results.json` (PASS/FAIL per korak).
- Posnetki: `os.tmpdir()/markec-f5311/shots/*.png`.
- Ponovljiv zagon:
  ```
  set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
  pnpm exec tsx scripts/_f531-seed-content.ts     # reset baselina
  pnpm dev                                        # zgoraj z DATABASE_URL na markec_f531_test
  node scripts/f531-browser-flow.cjs              # 16/16
  ```

---

## 6. Odprti predlogi / omejitve
- `C:\Users\admin\package-lock.json` ni bil izbrisan (ni v workspace; lastnik neznan). Če želimo
  odstraniti vzrok (ne le override), naj lastnik potrdi brisanje šele po preverbi.
- Slike v testnem toku nalagajo prek DB-fallback medijskega skladiščenja (`/api/media/{id}`), ker
  Cloudinary v dev ni konfiguriran; produkcijski upload pot je nedotaknjena.
- Browser acceptance je **potrjen** (16/16); F5.3.1 velja za sprejetega šele po zeleni brskalniški
  verifikaciji, kar je zdaj izpolnjeno. **F5.3.2 naj se začne šele po tem pregledu.**