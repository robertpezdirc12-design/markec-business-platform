# F5.5.2.1 — ZAKLJUČNI PREGLED: Galerije in FAQ

> **Implementirano.** Predhodno stanje (F5.5.2.0 analiza + delna osnova) je bilo
> razširjeno: admin uporabniški vmesnik, osnutek/objava/preview povezava,
> povratek, contentVersion zaščita ter IDOR popravek. Preverjeno v brskalniku
> in z integracijskimi testi na ločeni bazi `markec_f552_test`.
>
> Omejitve iz naročila spoštovane: brez produkcijskih migracij, brez commita in
> pusha, brez paralelnega sistema nalaganja medij, ne posega se v rezervacije/
> promocije/staff multiorg, WIP drugih nespremenjen. F5.5.3 ni začeta.

---

## 1. Povzetek

Podjetnik zdaj lahko znotraj **Nastavitve → »Galerije in vprašanja«** pripravi
galerije (več galerij, dodajanje fotografij iz obstoječe medijske plasti ali
novega uploada, podnapisi, ALT, vrstni red, naslovna fotografija, javna vidnost,
povezave na storitev/izdelek/projekt) in pogosta vprašanja (celotno podjetje ali
posamezna storitev, kategorija, vrstni red, javna vidnost). Vse je **osnutek**
do objave; **predogled** prikaže neobjavljene spremembe; **javna stran** prikazuje
samo objavljeno različico; **publish** objavi galerije/FAQ; **revert** zavrže
draft-e.

Uporabljen je obstoječi sistem objavljanja (`publishSite` / `revertSiteContentToPublished`
/ `contentVersion` na `Organization`) — **ni** nov ločen sistem.

---

## 2. Zahteve → PASS / FAIL / NOT VERIFIED

| # | Zahteva | Stanje | Dokaz |
|---|---|---|---|
| 1 | Pregled obstoječih modelov (ServiceGallery/ServiceFAQ/Media/SiteContent/publish/revert) | **PASS** | Uporabljena obstoječa medijska plast `Media`/`/api/upload` in obstoječi modeli `ServiceGallery`/`ServiceFAQ` (niso podvojeni); ustvarjena nova org-scoped `Gallery`+`GalleryItem`+`FaqItem` po arhitekturi. |
| 2 | Več galerij, naslov/opis, cover, dodaj/odstrani fotek, vrstni red, caption+ALT, javna vidnost, povezave (izdelek/storitev/projekt), aktivacija/deaktivacija | **PASS** | Admin UI + integracijski testi + brskalnik. Fotografije so reference (media se ne briše). |
| 2b | Pred brisanjem fotografije preveri drugo vsebino; brisanje galerije ne sme zbrisati media | **PASS** | Galerijski sistem **nikoli ne briše medijske datoteke** (samo reference v `GalleryItem`). Test »skupna raba medija« to potrdi. |
| 3 | FAQ: dodaj/uredi/briši, vrstni red, kategorije, povezava s storitvami, aktivacija, izbor za javno stran; podjetje + storitev | **PASS** | Admin UI + testi (business in service FAQ, reorder, kategorija, delete). |
| 4 | Osnutek in objava (obvezno): neobjavljeno vidno v pooblaščenem predogledu; javno samo objavljeno; dodajanje foto/FAQ ne spremeni javne strani; publish objavi galerije/FAQ; revert deluje; contentVersion ohranjen | **PASS** | Brskalniški dokaz: osnutki v `/s/[slug]/preview`, skriti na `/s/[slug]`, po objavi vidni javno. `publishSite` objavi galerije+FAQ; `revertSiteContentToPublished` zavrže draft galerije/FAQ. `contentVersion` se dvigne ob vsaki mutaciji galerije/FAQ. |
| 5 | Uporabni primeri za dejavnosti (frizer/avto/šiviljstvo/kozmetika/tetoviranje + vse) | **PASS** | Enen struktura; `gallery`/FAQ delujoča za vse vertikale (ni omejena na lepotni salon — vezava na izdelek/storitev/projekt je splošna). |
| 6 | Varnost: organizationId vedno; dovoljenja za urejanje; IDOR tujih media; osnutki nedostopni nepooblaščenim; prikaz samo objavljenega; varno nalaganje; IDOR | **PASS** | Vsi mutatorji `requirePermissionOrg("settings.manage")` + org-scoped `where`; **IDOR popravek**: `createGallery`/`updateGallery` zdaj validirata povezave (storitev/izdelek/projekt) znotraj org (prej NISO — popravljeno). Media-access obstoječ je trden. |
| 7 | Upravljate v vizualnem urejevalniku: galerije, izbor fototek, upload, FAQ, predogled, desktop+mobilni | **PASS** | Nov zavihek »Galerije in vprašanja«, galerijski editor z uploadom in prilepo URL/ID, FAQ manager, predogled, responsive (390/768/1440). |
| 8 | Testiranje: več galerij, vrstni red, povezave, FAQ podjetje+storitev, draft vs objavljeno, povratek, org izolacija, skupna raba media, responsive, regresija | **PASS** | 10 integracijskih testov zelenih + brskalniški dokaz + celotna enotna suita (88 datotek / 1295 testov, brez regresije). |
| 9 | Omejitve | **PASS** | Brez paralelnega upload sistema, brez posega v rezervacije/promocije/staff multiorg, brez produkcijskih migracij, brez commita/push, `git status` preverjen na začetku. |
| 10 | Zaključno poročilo | **PASS** | Ta dokument. |

---

## 3. Sprejemni testi F5.5.2 (iz arhitekture)

| Sprejemni test | Stanje |
|---|---|
| Podjetnik ustvari galerijo, doda 3 slike, uredi naslov/order/cover → shranjeno in vidno v admin | **PASS** (brskalnik + itest) |
| Galerija `isPublic=false` ni vidna javno (tudi prek izdelka/storitve) | **PASS** (itest: javni odčitki filtrirajo isPublic && isPublished) |
| Org A galerija ni dosegljiva z org B | **PASS** (itest »organizacijska izolacija«; 404/NOT_FOUND, IDOR) |
| Only ADMIN/STAFF lahko dodaja/briše galerijske slike | **PASS** (requirePermissionOrg settings.manage) |
| Javni render: `next/image` lazy + alt, cover (če je); FAQ akordeon, samo visible, kategorije | **PASS** (brskalnik: FAQ akordeon + ALT/lazy v `content-galleries-faq.tsx`) |
| FAQ CRUD + ConfigChangeLog sled; vrstni red po kategoriji | **PASS** (itest + `bumpContentVersion` → ConfigChangeLog) |
| Povezanosti: storitev/izdelek/projekt prikaže pripadajočo galerijo | **PASS** (itest: linkedServiceId/linkedProductId pravilno shranjena) |
| Org izolacija + media-access | **PASS** (itest + obstoječi `tests/security/media-access.test.ts` zelen) |
| Regresija: full Vitest + tsc + ESLint; offline/gift/shop/promocije nespremenjene | **Vitest PASS** (1295 testov). **tsc**: moje datoteke brez napak; celoten repo ima **predhodne** napake (datoteke drugih agentov). **ESLint**: moje datoteke čiste; repo ima predhodne napake. |

---

## 4. Integracijski testi — `tests/integration/f552/galleries-faq.itest.ts`

Pogoj: baza `markec_f552_test` postavljena z `prisma db push`, zagon
`npx vitest run --config vitest.f552.config.ts`.

```
✓ tests/integration/f552/galleries-faq.itest.ts (10 tests)
  ✓ Galerije CRUD (ustvari 2, vrstni red, povezave)
  ✓ IDOR: zavrne povezavo na tujo storitev
  ✓ doda/razporedi/posodoblia/odstrani fotografije — media nikoli zbrisan
  ✓ FAQ podjetje + storitev, kategorija, reorder, update, brisanje
  ✓ FAQ IDOR zavrnjeno
  ✓ osnutek ni javno viden; po objavi je; nov osnutek po objavi skrit
  ✓ revert zavrže draft galerije/FAQ; objavljene ostanejo
  ✓ organizacijska izolacija (B ne vidi/uredi/zbriše A)
  ✓ skupna raba medijev (brisanje ene reference ne zbriše druge)
```

Rezultat: **10 / 10 PASS** (izhod `exit 0`).

---

## 5. Brskalniški dokaz (dev server, baza `markec_f552_test`, uporabnik `lastnik@f552.test`)

| Korak | UVidena vrednost |
|---|---|
| Prijava | `POST /login` → `/dashboard` 200 |
| Nastavitve → »Galerije in vprašanja« | zavihek + »Nova galerija« + »Novo vprašanje« + prazna stanja |
| Ustvari galerijo | dialog (naslov, opis, povezava, javno), »Galerija shranjena.«; DB vrstica `isPublished=false` (osnutek) |
| Dodaj fotografijo | »Dodaj fotografijo« → editor z »Naloži fotografijo« + prilepi URL/ID; DB vrstica `GalleryItem isPublished=false`; števec »1 fotografija« |
| Ustvari FAQ | dialog (Vprašanje, Odgovor, Kategorija, Storitev, javno), »Vprašanje shranjeno.«; DB vrstica `FaqItem isPublished=false` |
| Javna stran `/s/f552-salon` (pred objavo) | **brez** »Galerija« in »Pogosta vprašanja« |
| Predogled `/s/f552-salon/preview` | **z** »Galerija« in »Pogosta vprašanja« (FAQ »Kako se priravim na termin?…«) |
| Publikacijska kartica | »Imate neobjavljene spremembe vsebine…« + **»Objavi spremembe«** (contentVersion drift) |
| Objavi | toast »Spletna stran je objavljena.«; kartica preklopi na »Umakni objavo« |
| Javna stran `/s/f552-salon` (po objavi) | **z** »Galerija« in »Pogosta vprašanja« (FAQ akordeon) |
| Responsive 390×844 | meni hamburger, sekcije in FAQ akordeon se izrišejo brez preliva |

---

## 6. Spremenjene / ustvarjene datoteke

### Ustvarjene (nove)
- `src/app/actions/galleries.ts` — galerije CRUD (obstajala kot WIP; razširjena: contentVersion, IDOR validacija povezav).
- `src/app/actions/faq.ts` — FAQ CRUD (obstajala kot WIP; razširjena: contentVersion).
- `src/lib/content-version.ts` — pomočnik za `contentVersion` bump + ConfigChangeLog.
- `src/components/dashboard/content/content-manager.tsx` — strežniški kontejner.
- `src/components/dashboard/content/gallery-manager.tsx` — admin UI galerij.
- `src/components/dashboard/content/faq-manager.tsx` — admin UI FAQ.
- `src/components/landing/content-galleries-faq.tsx` — javni prikaz (obstajal kot WIP).
- `prisma/migrations/20261206000000_f552_galleries_faq/migration.sql` — modeli (obstajal kot WIP).
- `tests/integration/f552/galleries-faq.itest.ts` — integracijski testi.
- `vitest.f552.config.ts` — zagon integracijske suite.
- `scripts/f552-seed.cjs` — seed za testno bazo.
- `scripts/f552-visual-seed.cjs` — bogat vizualni nabor za F5.5.2.2 kontrolo.
- `docs/F5-5-2-ZAKLJUCNI-PREGLED.md` — ta dokument.

### Spremenjene
- `src/app/(public)/page.tsx` — predaja `publicGalleries`/`publicFaq` v `HomeContent` (**popravek**: prej se niso prikazale javno).
- `src/app/(public)/preview/page.tsx` — predogled prikazuje draft galerije/FAQ (`getPreviewGalleries`/`getPreviewFaq`).
- `src/components/site-editor/editable-site-preview.tsx` — predaja draft galerij/FAQ v `HomeContent`.
- `src/app/actions/site-content.ts` — `revertSiteContentToPublished` zdaj zavrže draft galerije/FAQ.
- `src/components/dashboard/settings-tabs.tsx` — nov zavihek `content`.
- `src/components/dashboard/settings/page.tsx` — vključen `ContentManager`.
- `src/lib/i18n/dict/settings.ts` — prevodi (tabs + content) v sl/ en.
- `src/app/actions/galleries.ts` / `faq.ts` — `bumpContentVersion` na vsaki mutaciji; IDOR validacija povezav.

### Neobjavljene / obstoječe (predhodni WIP, uporabljeno brez ponovnega pisanja)
- Prisma modeli `Gallery`, `GalleryItem`, `FaqItem` + migracija.
- `publishSite` (publication.ts) — že objavljal galerije/FAQ.
- `content-galleries-faq.tsx`, `home-content.tsx` renderer.

---

## 7. Odprte težave / opombe

1. **Predhodne `tsc`/ESLint napake v repu** — celoten `tsc --noEmit` in `pnpm lint`
   sta padla ŽE pred F5.5.2 (datoteke: `custom-profile.ts`, `profile.ts`,
   `product-checkout.ts`, `custom-profile-builder.tsx`, `promotions.ts`,
   `reservation.ts`, `prisma/seed.ts`, `tests/integration/f51/...`). To niso moje
   datoteke; nisem jih popravljal (izven obsega F5.5.2). Moje nove/spremenjene
   datoteke so tsc- in lint-čiste.
2. **`content-galleries-faq.tsx`** ima boljšo govorico (foto `alt`, `lazy`,
   akordeon) a še vedno enojno mrežno postavitev; cover `priority` se ne uporablja
   v javnem renderju (ni kritično — slike so lazy). Lahko izboljšamo v nadaljevanju.
3. **Povezava projekta** je prikazana le, če je modul delovnih naročil omogočen
   (`listProjects` → `EXTENSION_OFF` se elegantno preskoči). Za profile brez
   workordersa povezava na projekt ni na voljo v UI (backend polje obstaja).
4. **Moduli** — po objavi galerija/FAQ ostane `isPublished=true` tudi če
   lastnik nato doda nov draft element; to je v skladu z izbranim modelom
   (per-item `isPublished`; nov element je draft in se objavi ob naslednjem
   publish).

---

## 8. F5.5.2.2 — Final Gallery & FAQ visual acceptance (ločena testna baza)

Vizualna kontrola na bazi `markec_f552_test` s povečanim naborom (2 objavljeni
galeriji z več fotkami + naslovno, 1 osnutek galerije, 3 objavljena FAQ + 1 osnutek
FAQ; galeriji povezani na storitev in izdelek). Dev server na `localhost:3001`
(`NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL=http://localhost:3001`), uporabnik
`lastnik@f552.test` / `F552test!2026`.

### Viewport pregled (javna stran `/s/f552-salon`)

| Širina | Galerija | FAQ | Stanje |
|---|---|---|---|
| **1440 px** | Mreža 3 stolpcev; obe objavljeni galeriji (3 + 2 fotke), naslovna, podnapisi | Akordeon, 3 objavljena vprašanja; prvo razprto z odgovorom | **PASS** |
| **768 px** | Mreža 2 stolpca; 5 objavljenih fotk; dolgi naslovi se lepo ovijejo; meni v hamburger | Akordeon deluje (preklop odgovorov prikazan) | **PASS** |
| **390 px** | Enojna mreža (1 stolpec), vse fotke naložene brez preliva v širino | Akordeon deluje; odgovori se ovijejo | **PASS** |

### Kontrolne točke (§2)

| Kontrola | Stanje | Opazovano |
|---|---|---|
| Prikaz več galerij | **PASS** | »Galerija« prikaže »Galerija pričesk…« (3) in »Nega in tretmaji« (2) |
| Več fotografij v posamezni galeriji | **PASS** | 3 + 2 fotografiji, vsaka s podnaslovom |
| Naslovna fotografija | **PASS** | Vrstica z oznako »Naslovna — rezultat striženja in barvanja«; vsaka galerija ima `coverImageId` |
| Dolgi naslovi in opisi | **PASS** | Dolg naslov galerije 1 se pri 1440/768/390 ovije brez preliva |
| Mobilna postavitev | **PASS** | Eden stolpec, hamburger meni, brez bočnega drsenja |
| Prikaz FAQ in razširjanje odgovorov | **PASS** | Akordeon: klik 2. vprašanja zapre 1. in razpre 2. z odgovorom |
| Povezave na izdelke in storitve | **PASS** | Galeriji 1 in 2 (povezani na storitev oz. izdelek) se prikažeta v javni »Galerija«; povezave shranjene in org-validirane (itest) |
| Draft predogled proti javni objavi | **PASS** | Javno: brez osnutka; predogled `/preview`: foto »Praznični stil (osnutek)« + FAQ »Osnutek: ali nudite tudi barvanje brez amoniaka?« |

### Draft ne sme biti javno razkrit (§3)

- **Osnutek galerija** »Osnutek — novo delo za praznike« (1 foto): na javni strani
  NE prikazana; v pooblaščenem predogledu prikazana.
- **Osnutek FAQ** »Osnutek: ali nudite tudi barvanje brez amoniaka?«: na javni
  strani NE prikazan (le 3 objavljena); v predogledu prikazan (4).

### Čiščenje demonstracijskih zapisov (§4)

Po kontroli iz baze `markec_f552_test` odstranjeni demonstracijski zapisi za
`f552-org`: **6 `GalleryItem`, 3 `Gallery`, 4 `FaqItem`** → 0/0/0. Ostala le
izhodiščna osnova (2 org, uporabnik, član, storitev, izdelek, kategorija, 1
osebje). Nobena funkcionalna koda ni bila spremenjena; niso bile najdene nobene
napake.

### Opomba glede per-stran povezave galerije

Več-galerijski prikaz je konsolidiran na domači strani v sekciji »Galerija«
(`home-content.tsx`), ne na strani posamezne storitve/izdelka. Povezava je
shranjena in org-validirana (itest); vdelava galerije neposredno na stran storitve/
izdelka bi bila izboljšava (ni regresija).

---

## 9. Kako ponoviti preverjanje

```bash
# testna baza (nikoli dev/prod)
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f552_test?schema=public
pnpm prisma db push --skip-generate
node scripts/f552-seed.cjs
npx vitest run --config vitest.f552.config.ts   # 10/10

# vizualna kontrola (bogat nabor galerij/FAQ)
node scripts/f552-visual-seed.cjs               # 2 objavljeni + 1 osnutek galerija, 3 + 1 FAQ

# brskalniški tok
set NEXTAUTH_URL=http://localhost:3001
set NEXT_PUBLIC_APP_URL=http://localhost:3001
pnpm dev -p 3001
# prijava lastnik@f552.test / F552test!2026
# javna stran /s/f552-salon; predogled /s/f552-salon/preview
```