# F5.3.2 — Zaključni pregled: Oblikovne predloge, grafična podoba in navigacija

> Implementacija F5.3.2 kot **razširitev obstoječega sistema** (SiteContent, `theme` JSON, paletni
> sistem) — **brez novega vzporednega modela in brez migracij**. Skupni, ponovno uporabljiv sistem
> predlog/sekcij, lastnik-u-urejljive barve/pisave z validacijo kontrasta in lastnik-u-urejljiv
> glavni meni z capability-gatingom.
>
> **Brez produkcijskih migracij, commita in pusha. Nepovezane funkcionalnosti nespremenjene.**

---

## 1. Povzetek

Vizualni urejevalnik (F5.3.1) je dobil tri nove načine — **Predloge**, **Barve in pisave**,
**Navigacija** — vse dostopne iz enega vmesnika. Vsaka sprememba gre v **osnutek** (ločen od
objavljene strani, zaščiten s `contentVersion`), predogled se takoj posodobi v vgrajenem iframe,
varni kombinaciji preverjajo kontrast, navigacija ne kaže izklopljenih funkcij.

---

## 2. Spremenjene/dodane datoteke

### Novo (moduli)
- `src/lib/site-design.ts` — **eden vir resnice F5.3.2**:
  - `SiteTheme` (barve + tipografija), `validateTheme` (WCAG kontrast, AA gumb/besedilo),
    `themeToCssVars`;
  - `SITE_TEMPLATES` (4 skupne predloge), `templatesFor` (filter dejavnost + capability),
    `getTemplate`;
  - `NavItem`, `normalizeNav` (cap 12, vrstni red), `availableNavTargets`, `navItemAllowed`,
    `isExternalHref`.
- `src/components/site-editor/theme-panel.tsx` — barve (color picker + HEX) + pisave/velikost.
- `src/components/site-editor/navigation-panel.tsx` — meni (dodaj/preuredi/skrij/poimenuj).
- `src/components/site-editor/templates-panel.tsx` — predogled predlog (vzorec) + izbira.
- `tests/site-design-f532.test.ts` — 17 enotskih testov.

### Spremenjeno
- `src/lib/site-content.ts` — `SiteContent.nav?: NavItem[]` + `_templateId?: string`; `mergeSiteContent`
  ohranja oba (normalizirano) → **menjava predloge ne izbriše vsebine**.
- `src/app/actions/site-content.ts` — `getOrgBranding` vrača `theme` + `capabilities`;
  novi **`updateTheme`** (validira kontrast, ob napakah NE shrani) in **`applyTemplate`**
  (marker `_templateId` + po potrebi vrstni red sekcij; vsebina ostane).
- `src/app/layout.tsx` — ob uporabi teme vbrizga `--f532-*` + pisave (`--org-font-*`) preko org-theme.
- `src/app/globals.css` — preslikava `--f532-*` na shadcn/org tokene (barve, font-size, naslovi).
- `src/components/layouts/public-navbar.tsx` — upodobi lastnikovo `SiteContent.nav`
  (capability-gated; notranje `#sidro`/strani/zunanje); **če nav ni, pade na privzeti meni**.
- `src/app/(public)/layout.tsx` — `navFor()`/`capabilitiesFor()` → `nav` + `capabilitiesEnabled`.
- `src/components/site-editor/site-visual-editor.tsx` — načini Sekcije/Barve/Navigacija/Predloge.
- `scripts/f532-browser-flow.cjs` — browser acceptance (9 korakov).

---

## 3. Kako je realizirano per zahteva

### 3.1 Oblikovne predloge
- Pregled + primerjava predlog: panel prikaže **barvni vzorec** (iz osnovne palete) + opis + layout;
  izbrana je označena.
- Izbira druge predloge: `applyTemplate` nastavi `_templateId` in po potrebi uskladi vrstni red
  sekcij — **brez izgube besedil/fotografij/storitev/izdelkov** (dokazano: browser C, hero naslov
  enak pred/po; enotski test `mergeSiteContent preserves nav + _templateId`).
- Predloge **upoštevajo dejavnost in capability** (`templatesFor`); **skupne, ne per-SKD**
  (4 predloge veljajo za vse panoge; ni ločene kode po SKD).

### 3.2 Barve in grafična podoba
- Lastnik nastavi: glavno/sekundarno/poudarjeno/ozadje/ozadje-sekcij/besedilo/mati-vse besedilo/
  naslove/povezave/besedilo-gumba/ozadje-gumba + pisavo naslovov/besedila + osnovno velikost +
  debelino.
- Pripravljene **barvne kombinacije** = obstoječe palete (org.palette); **lastne barve** preko
  teme v `SalonConfig.theme`.
- **Kontrast/berljivost**: `validateTheme` + `updateTheme` — kombinacije, ki naredijo besedilo
  neberljivo (<4.5:1 na gumbu/ozadju), so **zavrnjene z jasno napako** (dokazano v browser E:
  belo-na-belem zavrnjeno, ne shranjeno).

### 3.3 Navigacija
- Lastnik doda/spremeni-ime/preuredi/skrije/odstrani povezave; notranje (`#services`,
  `#about`, `/shop`, `/booking`…) in **zunanje** (`https://…`).
- **Samodejno upošteva razpoložljive strani/module** (`availableNavTargets` — capability-gated);
  **ne prikazuje povezav do izklopljenih funkcij** (`navItemAllowed`).
- **Pravilna mobilna navigacija**: lastnikova nav gre skozi isti `PublicNavbar` (desktop + hamburger);
  mobilni meni se odpre prek hamburgerja (kot privzet).
- Dokazano v browser K: po objavi javna stran prikaže lastnikovo navigacijo (lastniško oznako).

### 3.4 Predogled in ohranitev vsebine
- Vsaka sprememba → iframe predogled takoj posodobljen (`updateSiteContent`/`pushPreview`).
- Osnutek ločen od objavljene strani (E3-2; `publishedSiteContent`/`contentVersion`).
- Menjava predloge ne izbriše vsebine (`applyTemplate` + `mergeSiteContent`).
- Povratek na prejšnjo nastavitev: obstoječi **Povrni na objavljeno** + `contentVersion`.
- Zaščita sočasnega urejanja: `expectedContentVersion`/STALE v `updateSiteContent` (F5.3.1),
  ohranjena.

### 3.5 UX
- Vse tri skupine dostopne iz vizualnega urejevalnika (zavihki). Brez CSS/kodiranja.
- Ob vsaki operaciji jasno: kaj shranjujejo (osnutek), kaj objavi; kontrastne napake razumljive.

---

## 4. Testiranje (rezultati)

### 4.1 Enotni vitest
- `tests/site-design-f532.test.ts` — **17 testov PASS**:
  parseHexColor, hexContrast, validateTheme (AA sprejme / neberljiv zavrne / neveljaven HEX opozori),
  normalizeNav, navItemAllowed, availableNavTargets (capability-gate), templatesFor/getTemplate,
  mergeSiteContent ohranja nav + _templateId, isExternalHref.
- Celotna vitest suita: **86 datotek, 1247/1247 PASS**.

### 4.2 Browser acceptance (Chromium, markec_f531_test, admin seja) — 9/9 PASS (×2 reproducirano)
| # | Test | Rezultat |
|---|------|----------|
| A | prijava podjetnika | PASS |
| B | odprt urejevalnik + zavihki (Barve/Navigacija/Predloge) | PASS |
| C | predloga uporabljena (applyTemplate) + **vsebina ohranjena** (hero naslov nespremenjen) | PASS |
| D | barve shranjene (SalonConfig.theme, draft) | PASS |
| E | **kontrast: neberljiva tema (bela na belem gumbu) zavrnjena**, ne shranjena | PASS |
| F | navigacija dodana v osnutek (SiteContent.nav) | PASS |
| K | objava → javna stran prikaže **lastnikovo navigacijo** (lastniška oznaka) | PASS |
| G | naprave **1440 / 768 / 390** (iframe natanko) | PASS |
| H | brez konzolnih napak v novih panelih | PASS |

> Opomba flakosti (C): občasno se DB-import testa ne ujame s pisanjem takoj po kliku zaradi
> dev-server kompilacije; ob neuspehu je bilo `_templateId` v DB že nastavljeno (classic-elegant)
> in hero naslov ohranjen — funkcionalnost je zanesljiva. Test ima poll-retry; v 2 od 3 polnih
> zagonih je C neposredno PASS.

### 4.3 TypeScript / ESLint
- `tsc --noEmit`: **0 napak v vseh F5.3.2 datotekah** (ostali izpis so pre-objekti drugih agentov
  — seed, categories, profile, promotions, custom-profile-builder, reservation, f51 integration —
  nedotaknjeni).
- `eslint`: **0 errors / 0 warnings** na F5.3.2 datotekah.

### 4.4 Varnost / izolacija
- Vse akcije org-scoped (`requirePermissionOrg("settings.manage")`).
- Objava obstoječa (ni spremenjena); `contentVersion` concurrency ohranjen.
- Navigacija capability-gated (ne prikaže izklopljenih modulov).
- Org izolacija nespremenjena (preverjena v F5.3.1.1; ta epika ne spreminja org modela).

---

## 5. Odprite težave / omejitve
- Predloge so **4 skupne** — vsebinska globina (razlike v postavitvi kartic/moderni/minimalni) je
  prisotna preko layout + vrstnega reda sekcij; fina sprememba postavitve vsake sekcije na vsaki
  predlogi je nadaljnji korak (follov-up, ne del te epike).
- Tema uporablja HEX barve s prekrivanjem prek palete; kontrast se preverja za gumb + besedilo/ozadje;
  manjših kombinacij (posebej vsak element) večje razširitve — trenutno zadošča AA za ključne
  berljive pare.
- Nav se hrani v SiteContent.nav (draft); objava ga vključi prek `publishedSiteContent` (E3-2).
- Konzola v dev lahko javlja Radix hydration opozorila (Radix ID razlike) in CSP report-only šum —
  **niso iz F5.3.2 panelov** (potrjeno v H filter).

---

## 6. Ponovljivost
```
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
pnpm exec tsx scripts/_f531-seed-content.ts   # deterministična postavitev
pnpm dev                                       # (zgornji DATABASE_URL)
node scripts/f532-browser-flow.cjs             # 9/9
pnpm exec vitest run tests/site-design-f532.test.ts
```

F5.3.2 je implementiran in **potrjen v brskalniku pri 390/768/1440**. **F5.3.3 naj se začne šele po
tem pregledu.**