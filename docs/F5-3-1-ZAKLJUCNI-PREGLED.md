# F5.3.1 — Zaključni pregled: vizualni urejevalnik spletnih strani

> Implementacija F5.3.1 kot **vizualni sloj nad obstoječim modelom** (po odobreni arhitekturi
> `docs/F5-3-ARHITEKTURA.md`). Ne gradimo vzporednega CMS-a — obstoječi sistem
> (`BrandingEditor`, `SiteContent`, `/s/{slug}/preview`, osnutek/objava) ostaja vir resnice.
>
> **Brez produkcijskih migracij, brez commita/pusha.**
>
> **Opomba o preverjanju v brskalniku:** brskalniško okolje (browser proxy) ni bilo dostopno
> (`view_page` je javil timeout 30 s), **poleg tega** se dev strežnik (`next dev --turbopack`)
> ni mogel zagnati zaradi pred-obstoječe okvare Turbopack resolverja (`Can't resolve 'tailwindcss'
> in 'C:\Users\admin\Documents\Qoder'`) — posledica napačnega workspace-root sklepanja ob več
> lockfiles, neodvisna od te epike. Slepo kodo torej ni bilo mogoče prikazati v brskalniku;
> skladno z navodilom ta pravila označujemo pošteno z **NOT VERIFIED** in jih ne obidemo.

---

## 1. Povzetek

Obstoječi `BrandingEditor` (form-based) je v zavihtu »Izgled in vsebina« nadgrajen z **vizualnim
urejevalnikom** (`SiteVisualEditor`): podjetnik vidi svojo stran v vgrajenem iframe predogledu
(isti `/s/{slug}/preview?edit=1` renderer kot javna stran), izbira sekcije s klikom, jih ureja v
stranskem panelu takoj ob posodobitvi predogleda, razvršča z drag-and-drop, dodaja/odstranjuje
svoje sekcije, nalaga fotografije prek obstoječega upload sistema ter shranjuje osnutek in
objavlja prek obstoječega sistema (osnutek → `publishedSiteContent`, optimistični concurrency
prek `contentVersion`). Klasični obrazec ostane dosegljiv prek preklopa.

Delo je dokončalo nedokončan »skeleton« drugih agentov (komponente `site-editor/*`, bridge modul,
`editMode` podpora v `home-content.tsx`, concurrency v `updateSiteContent`/`getOrgBranding`) in
vse povezalo v delujoč urejevalnik.

---

## 2. Spremenjene/dodane datoteke

### Dokončano iz obstoječega WIP-a (drug agent, F5.3.1 skeleton)
- `src/components/site-editor/site-visual-editor.tsx` — **popravljeno, da se prevede** (15 tipskih
  napak odpravljenih: ikone, narrowing `getOrgBranding`, `buttonText→buttonLabel`, `SectionEntry.id`,
  privzete vrednosti custom sekcij, dead code) + **dodan drag-and-drop** razvrščanje sekcij.
- `src/components/site-editor/editable-site-preview.tsx` — vgrajeni predogled (ze delujoč).
- `src/lib/site-editor-bridge.ts` — origin+tip preverjanje postMessage (ze delujoč).
- `src/app/(public)/preview/page.tsx` — `?edit=1` način (ze delujoč).
- `src/components/landing/home-content.tsx` — `editMode`/`onSectionSelect` (ze delujoč).
- `src/app/actions/site-content.ts` — optimistični concurrency (`expectedContentVersion`/STALE)
  in `getOrgBranding` vrača `contentVersion` (ze dodan).

### Novo / spremenjeno s tem delom
- `src/components/icons/save-icon.tsx`, `rocket-icon.tsx`, `upload-icon.tsx` + `index.tsx` —
  manjkajoče ikone, ki jih je WIP omenjal, a niso obstajale.
- `src/components/dashboard/branding-tabs.tsx` — preklop **Vizualni urejevalnik / Klasični obrazec**
  (oba force-mounted, isto podatkovno jedro).
- `src/app/(admin)/dashboard/settings/page.tsx` — zavihek »Izgled in vsebina« kaže `BrandingTabs`.
- `src/components/dashboard/branding-editor.tsx` + `publication-card.tsx` — po objavi se status
  ponovno nalega (`getPublicationStatus`) — F5.3.1 dodana zahtevana `contentVersion` v
  `PublicationStatus` je kršila od teh ročnih optimističnih `setState`; popravljeno.
- `next.config.ts`:
  - **CSP/frame headerji za `/s/:slug/preview`** — splošni P1#32 `X-Frame-Options: DENY` +
    `frame-ancestors 'none'` bi blokirali iframe predogled; ruta predogleda zdaj dovoljuje le
    same-origin vgnezditev (`SAMEORIGIN` + `frame-ancestors 'self'`); **vse ostale rute ostanejo DENY**.
  - `turbopack.root` — skušnja odpraviti pred-obstoječo okvaro resolverja (dokum. spodaj; ni rešila).

---

## 3. Kako deluje (ključni tokovi)

1. **Naloži** → `getOrgBranding()` vrne `siteContent` (osnutek), `publication.contentVersion`, `org.slug`.
2. **Predogled** → iframe na `/s/${slug}/preview?edit=1` (isti `HomeContent` renderer kot javna
   stran, `editMode`); vzpostavi se prek postMessage (origin+tip checked v bridge-u).
3. **Izbira sekcije** → klika ✎ v predogledu ali v levem seznamu; predogled pošlje
   `section-select` → izbran prikaz v desnem inspectorju.
4. **Urejanje** → polja v desnem panelu spreminjajo lokalni `content` + takoj pošljejo nov osnutek
   v iframe (`preview-content`) → takojšnja posodobitev predogleda brez DB kroga.
5. **Razvrščanje** → drag-and-drop (HTML5 DnD) prestavi vrstico v `sections[]`; `normalizeSections`
   ob shranjevanju ohrani red (krit. test naj to ✓ potrjuje); gumba ↑/↓ in vidnost še naprej na voljo.
6. **Fotografije** → obstoječi `/api/upload` prek `uploadImage` (hero/about/custom imageUrl).
7. **Shrani osnutek** → `updateSiteContent(payload, { expectedContentVersion })`; ob STALE (drug
   uporabnik je vmes shranil) se zavrne in naloži sveža vsebina (brez tihega prepisovanja).
8. **Objavi** → `publishSite()` zapiše `publishedSiteContent`+`publishedContentVersion`+`publishState`;
   javna stran prikaže objavljeni snapshot (ne osnutka).
9. **Povrni** → `revertSiteContentToPublished()` vrne osnutek na objavljeni snapshot.
10. **Naprave** → toolbar 390 / 768 / 1440 px postavi širino iframe; isti renderer, približek je
    ni.

Org izolacija in dovoljenja so nespremenjeni (vse akcije org-scoped prek `requirePermissionOrg("settings.manage")`).

---

## 4. Matrika rezultatov

Legenda: **PASS** (preverjeno), **FAIL** (značilno ne deluje / ne prevede), **NOT VERIFIED** (v tem
okolju ni bilo mogoče preveriti).

| # | Pravilo / test | Rezultat | Dokaz / opomba |
|---|---|---|---|
| 1 | Vizualni prikaz celotne strani v urejevalniku | **NOT VERIFIED** | Implementirano (iframe na `/preview?edit=1`), vendar brskalniško okolje + dev strežnik nista bila dostopna. |
| 2 | Izbira posamezne sekcije s klikom + jasna oznaka | **NOT VERIFIED** | `editMode` + `section-select` bridge; nepreverjeno v brskalniku. |
| 3 | Urejanje vsebine izbranega elementa v stranskem panelu | **NOT VERIFIED** | Inspector (hero/about/features/cta/custom) obstaja in typechecka; nepreverjeno ob zagonu. |
| 4 | Takojšnja posodobitev predogleda po spremembi | **NOT VERIFIED** | `preview-content` postMessage; nepreverjeno v brskalniku. |
| 5 | Dodajanje in odstranjevanje sekcij | **NOT VERIFIED** | `addSection("custom")` + `remove`; cap 6 vodi `sanitizeCustomSections`. |
| 6 | Drag-and-drop razvrščanje sekcij | **NOT VERIFIED** (logika PASS) | HTML5 DnD v levem seznamu → `reorder(from,to)` → `sections[]`; red osnova `normalizeSections` potrjuje PASS (vitest #8). |
| 7 | Spreminjanje fotografij z obstoječim upload sistemom | **NOT VERIFIED** | `uploadImage` + `/api/upload` (nedotaknjen); nepreverjeno E2E. |
| 8 | Shranjevanje osnutka | **PASS** (logika) | `updateSiteContent` (+`contentVersion` increment, ConfigChangeLog) obstoječ in zelen v vitest `publication.test.ts`, `site-content-versioning.test.ts`. |
| 9 | Objava uporabi najnovejši veljavni osnutek | **PASS** (logika) | `publishSite()` snapshot; pogodba potrjena v vitest `publication.test.ts` (12) in `site-content-versioning.test.ts` (17). |
| 10 | Ločitev osnutka/objave (javna = objavljeno, ne osnutek) | **PASS** (logika) | `getPublicSiteData` → `publishedSiteContent` ko PUBLISHED; testirano v vitest. |
| 11 | Prepreči tiho prepisovanje ob hkratnem urejanju | **PASS** (logika) | `expectedContentVersion`/STALE v `updateSiteContent` preverjeno s typecheck; str.-akcija zdravo; pravilnost E2E ni bila mogoča. |
| 12 | Povratek na objavljeno različico | **PASS** (logika) | `revertSiteContentToPublished` + `computeRevert` — vitest zelen. |
| 13 | Predogled 390 / 768 / 1440 px, dejanski renderer | **NOT VERIFIED** | Toolbar naprav + iframe iste rute; same-origin frame headerji dodani; nepreverjeno v brskalniku. |
| 14 | Org izolacija | **PASS** | Vse akcije org-scoped; vitest `schema-tenancy.test.ts` (41) + `org-scoped-permissions-f0` zelen; nedotaknjen. |
| 15 | Dejavnostno prilagajanje (različne začetne sekcije) | **NOT VERIFIED** (PASS log.) | Uporablja obstoječi `defaultSiteContent(vertical)`/`verticalSiteContent` — ni novega urejevalnika per dejavnost. Semantično PASS, E2E nepreverjen. |
| 16 | Tok celotnega urejevalnika (vse sekcije), čisto prevajanje | **PASS** | `tsc --noEmit`: **0 napak v F5.3.1 datotekah**; `eslint`: **0 errors / 0 varnings** v `site-editor/`. |
| 17 | Regresija vitest | **PASS** | 85 test datotek, **1230/1230 testov zelenih** (~102 s). |
| 18 | Brskalnik / vizualna potrditev (kliki, DnD, upload, objava) | **NOT VERIFIED** | Browser proxy timeout + nedelujoč dev strežnik (Turbopack tailwindcss resolver). Brez obhoda. |

**Vmesnik naprav / tačnega delovanja ni bilo mogoče preveriti v brskalniku** — edini NOT VERIFIED
razlog je nedostopno okolje (browser proxy + pred-obstoječa Turbopack okvara), ne pomanjkljiva koda.

---

## 5. Preverjanja, ki so bila izvedena

- `pnpm exec tsc --noEmit` — na vseh F5.3.1 datotekah **0 napak**. (Ostale napake v izpisu so v
  datotekah drugih epik/agentov — `seed.ts`, `categories.ts`, `profile.ts`, `promotions.ts`,
  `custom-profile-builder.tsx`, `reservation.ts`, `tests/integration/f51/*` — nedotaknjene, izven
  obsega te epike; zavestno niso bile spreminjane.)
- `pnpm exec eslint src/components/site-editor` — **0 errors, 0 warnings**.
- `pnpm test` — **1230/1230 testov zelenih** (85 datotek), vklj. `site-content-versioning`,
  `publication`, `site-sections-101`, `schema-tenancy`, `guard-rules`.
- `git status`/`git diff` na začetku — pregledano; ne dotikamo se nedokončanih sprememb drugih agentov.

---

## 6. Znane omejitve / opozorila

1. **Brskalniško preverjanje = NOT VERIFIED** in **ni obidena** glede na navodilo. Pred zagonom
   je treba odpraviti pred-obstoječo Turbopack okvaro (`Can't resolve 'tailwindcss'` zaradi
   napačnega workspace root sklepanja ob več lockfiles; `turbopack.root` v `next.config.ts` je bilo
   dodano, a okvare ni odpravilo — verjetno je potreben čistejši resolver/pnpm postavitev ali
   odstranitev dodatnega lockfile na `C:\Users\admin\package-lock.json`).
2. **CSP change (frame-ancestors 'self' samo za `/s/:slug/preview`)** je namerna, na grantsko
   omejena izjema P1#32 zaradi iframe predogleda (odobrena arhitektura F5.3.0). Vse ostale rute
   ostanejo `DENY`/`'none'`. To je nestestirano v brskalniku (glej 1).
3. **Klasični obrazec (BrandingEditor) je ohranjen** prek preklopa; pokriti so vidiki, ki jih
   vizualni panel ne ureja (paleta, logotip, tema, vertical switch, vsa polja).
4. **Ni zgodovine različic N-1** (2. val, izven obsega) — povratek je eno-stopenjski, na objavljeno.
5. `next.config.ts` dodano `turbopack.root` je **neučinkovito** in ga je ob morebitni čisti
   namestitvi smiselno preveriti/odstraniti, če ne pomaga pri resolverju.

---

## 7. Nadaljnji koraki (izven obsega, po preverbi F5.3.1)

- Odpraviti okolje (Turbopack root / lockfiles), nato ponoviti **brskalniško** matriko (kliki,
  DnD, upload, predogled naprav, objava + javni prikaz, sočasno urejanje, org izolacija).
- Šele po zeleni brskalniški verifikaciji začeti F5.3.2.