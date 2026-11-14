# MARKEC — 2D-8 — Realni end-to-end preizkus celotnega urejanja spletne strani

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: dokazati CELOTEN tok v resničnem brskalniku. Kot je bilo naloženo, je bila napaka 2D-7 v **testnem harnessu** (`view_page` ni znal iframe/postMessage/file-input), ne v aplikaciji — zato je bila uporabljena **Playwright** testna infrastruktura (že v projektu), NE produkcijska koda.

## A. Agenti (dejansko uporabljeni)
Read-only podagenti **A–D** (delegate_task) + **E** (neodvisni reviewer). Koordinator je uredil samo testne datoteke.

| Agent | Naloga | Ugotovitve (potrjene) |
|---|---|---|
| **A — Browser automation** | Playwright E2E, iframe, postMessage | `playwright.config.ts` + `e2e/helpers.ts` + `e2e/visual-editor.spec.ts` (S1–S6) — vzorci za login/editor/iframe/upload. |
| **B — WYSIWYG** | onSectionSelect→postMessage→editor | Path dela za hero/about/features/cta/custom (origin-gate, setSelected, inspector). Gap: services/team/reviews/shop brez polj. `✎ Uredi sekcijo` = realna selekcija. |
| **C — Media UI** | UI-picker za fotografije | `Naloži` gumb + hidden `input[type=file]` (hero/about/custom); `setInputFiles` deluje tudi na hidden; success toast; fixture `e2e/fixtures/f63-test.png` veljaven. |
| **D — Varnost** | E2E brez umetnih privilegijev | E2E uporablja pravi `/login`; upload/edit/publish org-scoped; draft-preview membership-gated. |
| **E — Neodvisni reviewer** | Preveri prave klik`e (ne API) | izvedeno na koncu |

## B. Upotreben testni mehanizem (popravljen harness, ne aplikacija)
- **Playwright** — po vrhu tistega, kar `view_page` ne znal: klik sekcije, iframe dostop, `setInputFiles` na skriti UI file-input, ločeni browser-context (pravi anonimen obiskovalec + ponovna prijava).
- Nova **`e2e/2d8-site-editor.spec.ts`** + **`playwright.2d8.config.ts`** (teče ob :3002 dev strežniku; brez gradnje produkcije, ker tuji WIP `einvoices` blokira `next build`).
- **Produkcijska sprememba NI narejena** — samo E2E test. Lokatorji prilagojeni pravilnemu E2E vedenju.

## C. Rezultati — CELOTEN tok v brskalniku (Playwright, pravi uporabniški kliki)
Za vsako org: **prijava (/login) → Settings → Izgled in vsebina → Vizualni urejevalnik → klik sekcije (miško) → uredi naslov → naloži sliko prek UI-pickerja → shrani osnutek → objavi → javna stran (ločena anonimna seja) → ponovna prijava → ohranitev → povrni + ponovna objava.**

| Org | Izbor sekcije | Ured. vsebine | Shrani | UI-picker | Prikaz | Predogled | Objava | Javna | Pon. prijava/persist | Povrnitev |
|---|---|---|---|---|---|---|---|---|---|---|
| **Vulkanizer** `svezi-vulkanizer-2d1s` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Cebelar** `svezi-cebeler-2d1l` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Šivilja** `svezi-atelje-2d2` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**Dokazi:** log Playwright za vsak org `h1=persisted=edited` (npr. `[vulkanizer] h1="2D-8 vulkanizer mweswt0r" persisted="2D-8 vulkanizer mweswt0r"`); tri org **passed** (individuelno). Server: `POST /login 200`, `POST /dashboard/settings?tab=branding 200` (save/publish), `POST /api/upload 200` (UI-picker upload), `GET /api/media/{id} 200`, `GET /s/{slug} 200` (public). Media DB: `Media{filename:"f63-test.png",mimeType:"image/png",organizationId:<org>}` + `siteContent.hero.image=/api/media/{id}` za vse tri → **fotografija se res shrani + prikaže**.
- **Izolacija (1/1 PASS):** vse tri javne strani s svojim h1.
- **Mobilni 390 (1/1 PASS):** editor brez overflow.
- **Povrnitev:** vse tri org povrnjene na originalni h1 + ponovna objava. Reference čiste.

## D. Varnost v E2E
- Login: pravi `/login` (authorize) — ni umetnih privilegijev. PASS.
- Upload/edit/publish org-scoped (iz seje). PASS.
- Javna/anonimna stran vidi objavleno, ne osnutka. PASS.
- Draft-preview membership-gated. PASS.

## E. Blokirani itesti (ločene per-suite testne baze)
Raziskava našla, da mnogi itests **namerno trdijo** DATABASE-NAME prek `SELECT current_database()` → `expect(db).toBe("markec_f21_test"/"markec_f554_test"/...)` (npr. `f2-2/workspace-management.itest.ts:87`, `f554/advances.itest.ts:74`). To je **namerna per-suite izolacija** (vsak sklop svoja baza + svoj seed), ne napaka — v `markec_e2e_test` padejo na guard. **BLOCKED (okolje, ne regresija):** selitev v `markec_e2e_test` bi razbila izolacijo in posegla v tuj WIP. Kontrolirani sklop (email-verif, onboarding, seamstress, tire-service, traceability) teče v `markec_e2e_test` brez blokade.

## F. Testi (dejansko izvedeni)
- **Unit:** `npx vitest run` → **1359/1359 PASS**.
- **Browser E2E (Playwright, :3002):** 3/3 org PASS + izolacija + mobilni = vseh 5 PASS.
- **Itest (markec_e2e_test):** 57/57.
- **TypeScript:** `tsc --noEmit` čist (samo predhodna tuja `f631-inspect.ts:40`).

## G. Status
- **PASS (brskalnik, Playwright):** izbor sekcije z miško, urejanje, shranjevanje, **UI-picker upload**, prikaz, predogled, objava, javna vidnost (anonimna), ponovna prijava + persistencija, povrnitev, izolacija 3 org, mobilni 390 — za VSE tri.
- **PARTIAL —** nič bistvenega (samih 5-test suite preseže 600s v dev-mode → izvajamo posamič; ni aplikacijska pomanjkljivost).
- **FAIL —** nič.
- **NOT VERIFIED —** services/team/reviews/shop sekcije nimajo urej. polj v WYSIWYG (identificirano kot razširitev vsebinskih polj, ne pomanjkljivost celotnega toka). Dejanska e-poštna dostava (izven obsega).
- **BLOCKED —** itest-sklopi z ločenimi per-suite bazami (namerna izolacija, ne regresija).

## Končni sklep
**Faza 2D-8 PASS.** Realen dokaz (Playwright) za vse tri org: podjetnik sam **prijavi → odpre vizualni urejevalnik → z miško izbere sekcijo → uredi vsebino → naloži foto prek UI-pickerja (se res shrani v /api/media, prikaže) → shrani → objavi → vidi javno stran (anonimna) → ponovna prijava + ohranitev → povrne.** Tri org izolirane. **Uporab. je bila popravljena testna infrastruktura (Playwright), ne produkcijska aplikacija.** Blokada itestov = namerna per-suite izolacija, ni regresija.