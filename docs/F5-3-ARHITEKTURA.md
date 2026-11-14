# F5.3.0 — Arhitekturna analiza: vizualni urejevalnik spletnih strani

> **Namen:** arhitekturna analiza PRED implementacijo. **Ni bila spremenjena nobena koda.** F5.3.1 se ne implementira, dokler ta analiza ni pregledana in odobrena.
>
> **Vodilno načelo:** ne izdelovati novega urejevalnika od začetka — obstoječi sistem ima že velik del (form-based `BrandingEditor`, model `SiteContent`, osnutek/objava, predloge po dejavnosti). F5.3 je **vizualni sloj nad obstoječim modelom** + manjkajoč inline predogled.

---

## 1. Pregled obstoječega sistema (evidenca)

### 1.1 Urejevalnik — `src/components/dashboard/branding-editor.tsx` (1932 vz.)
- **Form-based, zavihki-polja** (ne WYSIWYG canvas): polja po sekcijah (hero, about, features, stats, openingHours, customSections), slike (`ImageField`), barve/paleta, logo upload, tipografija (prek `theme`), objava/povratek.
- Ključni handlerji (izput): `handleSave` (827), `handlePublish` (891), `handleRevert` (916), `handleLogoUpload`/`handleLogoRemove` (520/539), `handleImageUpload` (557), `handleVertical`+`confirmVertical` (575/586), sekcijski UI: `moveSection` (721), `addCustomSection` (738), `updateCustomSection` (762), `relabelCustomSection` (772), `removeCustomSection` (786), `applySuggestion` (800).
- **Predogled = povezava na `/s/{slug}/preview` v novem zavihku** (978–980) — ločena stran polne širine, ne inline frame; **ni namiznega/tabličnega/mobilnega pogleda znotraj urejevalnika.**

### 1.2 Model shranjevanja vsebine in oblikovanja
- **`src/lib/site-content.ts` (1026 vz.)** — čisti tipi in logika:
  - `SiteContent` (119–133): `hero, features, services(title/subtitle), about, team, shop, cta, openingHours, social, seo, sections, customSections?`.
  - `SectionKey` (63–71) / `SECTION_KEYS` (135–144): `hero | features | services | about | team | reviews | shop | cta`.
  - `SectionMeta { key, visible }` (74–77); `CustomSectionContent` (94–102) s capom `MAX_CUSTOM_SECTIONS = 6` (91); `SectionEntry = SectionMeta | CustomSectionMeta` (117).
  - `normalizeSections` (170–234) toleranten; `renderableSections` (241–247); `defaultSiteContent(vertical)` (355+) per-vertical SL copy; `mergeSiteContent` (847).
- **Prisma `SalonConfig`** (schema 420+):
  - `siteContent Json?` (**draft**), `theme Json?` (fontHeading/fontBody/radius/colors), **`publishedSiteContent Json?` + `publishedContentVersion Int?`** (objavljen snapshot, E3-2).
- **Prisma `Organization`** (schema 125–135): `publishState` (DRAFT|PUBLISHED|UNPUBLISHED, def PUBLISHED), `publishedAt`, `contentVersion Int` (E3-2; primerjan s `publishedContentVersion` za "Objavi spremembe"/revert).

### 1.3 Sekcije — dodajanje/odstranjevanje/razvrščanje
- Obstoječe: vse prednastavljene sekcije (8) + **do 6 custom sekcij** (naslov, odstavki, slika, gumb) s premikanjem, preimenovanjem, vidnostjo (`sections[].visible`).
- Pomanjkljivost: razvrščanje poteka prek gumbov/preimenovanj, ne preko drag-and-drop vizualnega paleta; custom sekcije so omejene na en predlogo (naslov+odstavki+gumb), brez prostega blok-sistema.

### 1.4 Shranjevanje osnutkov in objavljanje
- **Draft**: `updateSiteContent` (actions/site-content.ts:99) piše v `SalonConfig.siteContent`.
- **Objava**: `publishSite` (actions/publication.ts:97) — vzame `siteContent`, preveri `validatePublishRequirements` (#112-1, koherentnost), zapiše `publishedSiteContent` + `publishedContentVersion` (E3-2) in `publishState`/`publishedAt`.
- **Revert**: `revertSiteContentToPublished` (171) — vrne draft na objavljen snapshot.
- **Javno**: `getPublicSiteData` (public-site.ts:51–75) izbere `publishedSiteContent` (ko PUBLISHED + snapshot obstaja), sicer živi `siteContent`.

### 1.5 Javno prikazovanje
- URL `/s/[slug]/...` razrešuje `src/proxy.ts` → `(public)` route group (home, /services, /staff, /preview, legal).
- `(public)/layout.tsx:93–121` objavi-PUBLISHED/DRAFT gate; unpublished = maintenance za tujce, "Predogled — ni objavljena" za lastnika.
- `(public)/preview/page.tsx:36–53` prikaže **draft** (gledalec je lastnik; PreviewBanner).

### 1.6 Nalaganje fotografij in medijev
- Route `src/app/api/upload/route.ts` POST: **Cloudinary** (sever-side, base64, mapa po `org.slug`) ali **DB fallback** (`prisma.media`, URL `/api/media/{id}`, kvota). Auth: session; le ADMIN/STAFF nalaga vsebinske slike; tip `image/*`, ≤5 MB. Vrne `{ success, url, publicId }`.
- Klient: `src/lib/upload-client.ts` `uploadImage(file, type)` + `prepareImageForUpload` (downscale/reencode JPEG pre nalaganja).
- `src/app/api/media/[id]/route.ts` z `decideMediaAccess` (javne slike immutabilno cacheirane).

### 1.7 Povezava s kategorijami, izdelki in storitvami
- Javne kataloške strani **niso** pod nadzorom content-modela — prikažejo VSE aktivne elemente:
  - `/services` (public-site.ts:223+ `getPublicServicesGrouped`), `/shop` (getPublicShopProducts:329+, `(customer)/`), `/booking` (getPublicServicesGrouped).
  - Izbira "kaj na landing" = `isFeatured` zastavica (featured services/products).
- Content model ima `SectionKey. services/shop` za **landing predogled** sekciji (visibility/order/copy), ne za izbor vrstic kataloga.

### 1.8 Predloge spletnih strani v profilih
- **Ni ločene izbire predlog** — vsak profil ima ONE fixed default site: `defaultSiteContent(vertical)` (site-content.ts:355+) + `verticalSiteContent(id)` (verticals.ts:905–912, doda slike). Na onboardingu se zapiše `verticalSiteContent(profile.id)` v `SalonConfig.siteContent`.
- Profil → SDK/vertical: `catalog.seedVerticalId` (registry.ts:128) in profilov id = vertical id za vsebino.

---

## 2. Cilj za podjetnika (željena uporabniška izkušnja)

Podjetnik uredi celo stran brez programiranja. Vizija F5.3 nadgradi obstoječi form-based editor v **vizualni urejevalnik**:

- Logotip, barve, pisave (že gre danes: palette + logo + `theme` = fontHeading/fontBody/radius/colors).
- Naslovi, besedila, opisi (že gre danes: polja po sekcijah).
- Slike (že gre: `ImageField` + upload).
- **Dodajanje/odstranjevanje/premikanje sekcij: drag-and-drop v vizualnem canvasu** (danes: gumbi/preimenovanje).
- Izbira pripravljenih oblikovnih predlog (danes: ena default per dejavnost; cilj: več `template` variant iste `SiteContent`).
- Urejanje navigacije (cilj: upravljati `nav`/mnenje št. elementov — danes meni izhaja iz sekcij/kataloga).
- Prikaz storitev/izdelkov/kategorij (delno: featured, landing sekcije; cilj: izbira katere skupine/sekcije in števila).
- Kontakt + odpiralni čas (že gre: `contact` v SalonConfig + `openingHours`).
- **Predogled pred objavo (namizje/tablica/mobilni) — manjkajoče.**

---

## 3. Predogled (manjkajoči ključni kos)

**Zahteva:** predogled mora uporabljati ISTO vsebino + ISTO oblikovno logiko kot objavljena stran, v namizni/tablični/mobilni velikosti, pred objavo.

**Stanje:** danes obstaja `/s/{slug}/preview` (draft, polna širina) in gate v `(public)/layout.tsx`. **Manjka inline iframe z več napravami v urejevalniku.**

**Predlog (uporabiti obstoječo prezpreview):**
- V vizualni urejevalnik vgraditi `iframe` na `/s/{slug}/preview` z `width` po izbrani napravi (390 / 768 / 1440) — predogled je **isti route** kot objava (ista `getPublicSiteData` logika, draft via preview gate).
- Ne graditi ločenega renderja; `(public)/preview/page.tsx` + `home-content.tsx` sta že en vir resnice; sprememba je **samo vložitev iframe + device-toolbar** v urejevalnik.
- Predogled brez objave: preview route Ņe oddaja draft za lastnika (layout.tsx gate).

---

## 4. Dejavnostno prilagajanje

- **Uporabiti skupen sistem sekcij/predlog**, ne ločenih urejevalnikov. Predloge = razširitev `defaultSiteContent(vertical)` (že obstaja per-dejavnost) na **več `template` variant z istim `SiteContent` obliko**.
- Dejavnost določa privzete sekcije/CTL (že: `website.ctaMode` v `ActivityProfile`, `suggestedSectionsForVertical` v site-content.ts:334). Npr.:
  - avtoservis (`mehanik`): servis, delo, vozila, kontakt → sekcije `services`(red.read `workOrders`), `about`, `cta`, `openingHours`.
  - šiviljstvo (`seamstress`): izdelava oblačil, popravila, galerija (customSections), naročila (cta `/shop`).
  - frizer (`frizer`): storitve, cenik, zaposleni (`team`), rezervacije (cta `/booking`).
  - kozmetika (`cosmetica`): tretmaji, strokovnjaki, paketi (`shop`), rezervacije.
- **Brez 34 ločenih urejevalnikov**: predloge se zgradijo iz (a) obstoječega `defaultSiteContent(vertical)` + (b) `VerticalPreset` (kategorije/storitve) — eno skupno jedro.

---

## 5. Shranjevanje in varnost

| Vidik | Trenutno | Predlog / analiza |
|---|---|---|
| Draft vs objava | 2 JSON-a: `siteContent` (draft) + `publishedSiteContent` snapshot (E3-2) | **Ohrani.** Vizualni editor piše v isti `siteContent` (draft); objava kopira v snapshot. |
| Obnovitev prejšnje različice | `revertSiteContentToPublished` (en snapshot) | **Manjka zgodovina različic.** Predlog (F5.3, ni nujno v 1. val): `ContentVersion` tabela ali `Json` zveza `Snapshot[]` (id, content, createdAt, createdBy) za vračanje na N-1. Za 1. val zadostuje obstoječi "revert na objavljeno". |
| Org izolacija | Vse akcije org-scoped (`getPublicSiteData`, `updateSiteContent` prek `requirePermissionOrg("settings.manage")`) | **PASS** — ohraniti; vsaka nova akcija (template, snapshot) preveri org. |
| Dovoljenja urejanje/objava | `settings.manage` (ADMIN omejeni na custom-roles) | **Predlog:** ločiti urejanje (`settings.manage`) od objave (lahko isti ključ; če želimo več, nov `site.publish`, a "ne uvajaj novega ključa brez potrebe" → priporočam isti ključ za 1. val). |
| Fotografije | `/api/upload` (Cloudinary/DB, tip/size/kvota, Auth) + `prepareImageForUpload` (downscale) | **PASS** — ohraniti; dodati optimizacijo formatov (WebP) kot follow-up. |
| Zaščita pri hkratnem urejanju | Ni zaklepanja; zadnji zapis zmaga (LAST-WRITE-WINS) | **Predlog:** `contentVersion` optimistični concurrency (server primerjaj `Organization.contentVersion`, zavrni stale `updateSiteContent` ob konfliku, vrni "fresh".) |

---

## 6. Končno poročilo

### Kaj že obstaja (ponovno uporabiti)
- `SiteContent` model + `normalizeSections`/`renderableSections`/`defaultSiteContent`/`mergeSiteContent`.
- Form-based `BrandingEditor` (vse vsebinske sekcije, custom sekcije, slike, palette, logo, publish/revert).
- Draft/published snapshot (E3-2) + `publishState`/`contentVersion`.
- `/s/{slug}/preview` (draft) + Publish gate v layout; `/api/upload` + `/api/media/[id]`.
- Predloge per dejavnost (`defaultSiteContent`/`verticalSiteContent`), offertability `SectionKey`.

### Kaj manjka
1. **Vizualni canvas** (WYSIWYG) nad `SiteContent` — namesto čistih form-polj.
2. **Inline predogled z napravami (390/768/1440)** znotraj urejevalnika (iframe na `/s/{slug}/preview`).
3. **Drag-and-drop razvrščanje sekcij** (danes gumbi).
4. **Več oblikovnih predlog per dejavnost** (danes 1 default).
5. **Urejanje navigacije/menija.**
6. **Optimistični concurrency** (contentVersion) za hkratno urejanje.
7. (2. val) Zgodovina različic/obnovitev N-1.

### Ponovno uporabne komponente
`home-content.tsx` (landing renderer), `(public)/preview/page.tsx`, `BrandingEditor` (re-use kot podplošča/bottom), `ImageField`/`uploadImage`, `defaultSiteContent`/`mergeSiteContent`, E3-2 `site-content` akcije, `SalonConfig.siteContent/publishedSiteContent`.

### Predlagana uporabniška izkušnja (vizualni editor)
Leva stranska paleta (sekcije + predloge + navigacija), center = **vizualni canvas z iframe predogledom** + toolbar naprav (390/768/1440), desna = lastnosti izbrane sekcije (polja). Spodaj/dialog: objava (validate) + povratek. Podatki iz workspacea (featured storitve/izdelki, odpiralni čas, kontakt) sežejo v predogled prek istih javnih funkcij.

### Potrebne podatkovne spremembe
- Za 1. val: **ni nujna nobena migracija** — uporabimo obstoječo `SiteContent`, `theme`, `publishedSiteContent`, `contentVersion`.
- Opcijsko (obseg): `contentVersion` že obstaja na Organization → uporabimo za concurrency.
- (2. val) Nova tabela `ContentSnapshot` (id, organizationId, version, content Json, createdAt, createdBy).

### Varnost
- Org izolacija na VSEH akcijah (strežniško, org-scoped).
- Dovoljenja: urejanje + objava prek `settings.manage` (re-use ključa; ne uvajaj novega).
- Upload: obstoječa Auth + tip/size/kvota + Cloudinary/DB; predogled ne nalaga (le iframe).
- Concurrency: optimistična zaščita prek `contentVersion`.

### Testi in sprejemni kriteriji
1. Urejevalnik shrani spremembo v draft; objava postavi `publishedSiteContent`; javna stran prikaže objavljeno (ne draft).
2. Predogled v vseh 3 napravah (390/768/1440) uporablja ISTO vsebino/logiko kot objavljena (iframe istega route).
3. Drag-and-drop sekcij spremeni `sections[]` red; `normalizeSections` ohrani.
4. Custom sekcija (do 6) se doda/odstrani/prestavi; cap spoštovan.
5. Org A ne vidi/pokvari org B (izolacija).
6. STAFF-custom-rola brez `settings.manage` ne sme shraniti/objaviti.
7. Hkratno urejanje: drugi uporabnik ob konfliktu dobi "fresh" namig (concurrency).
8. Profilna predloga: frizer/šiviljstvo/avtoservis začneta s pravilnimi privzetimi sekcijami.
9. Regresija: F5.1/F5.2 vitest + celotna `vitest run`.

---

## Priloga — potrjena dejstva (datoteke/vrstice)
- `branding-editor.tsx`: 827 (save), 891 (publish), 916 (revert), 721 (moveSection), 738 (addCustomSection), 978 (preview link only).
- `site-content.ts`: 119 (SiteContent), 63 (SectionKey), 135 (SECTION_KEYS), 241 (renderableSections), 355 (defaultSiteContent), 847 (mergeSiteContent).
- `actions/site-content.ts`: 99 (updateSiteContent), 171 (revert), (publishSite) — snapshot.
- `scheme`: SalonConfig 420–439 (siteContent/theme/publishedSiteContent/contentVersion); Organization 125–135 (publishState/contentVersion).
- `proxy.ts` 486/535 (razčleni `/s/[slug]` → rewrite na `(public)` z signed org header); `(public)/preview/page.tsx` 36–53 (draft); `(public)/layout.tsx` 93–121 (publish/DRAFT gate).
- `api/upload/route.ts` 11–158 (Cloudinary/DB, auth, 5MB, folders); `lib/upload-client.ts` (uploadImage + downscale).
- `public-site.ts` 51–75 (getPublicSiteData → pub snapshot/live), 223 (services), 329 (shop).
- `verticals.ts` 905–912 (verticalSiteContent) + `defaultSiteContent`/`VerticalPreset.siteContent`.
- `home-content.tsx` 132 (sectionNodes, data gated), 188/333/380/454 (services/team/shop/reviews).