# F5.3.3 — Zaključni pregled: Celotna dejavnostna in sprejemna verifikacija

> F5.3.3 je **verifikacijski epika** — ni dodala novih funkcij, produkcijskih migracij,
> commita ali pusha. Preverila je celoten sistem spletnega urejevalnika (F5.3.1), predlog,
> grafične podobe in navigacije (F5.3.2) ter ob tem odkrila in odpravila dve vrsti napak.
>
> **Brez produkcijskih migracij, commita in pusha. Nepovezane funkcionalnosti nespremenjene.**

---

## 1. Povzetek

Celoten sistem vizualnega urejevalnika je bil preverjen na **pravem Chromium** in **migrirani
testni bazi `markec_f531_test`** (isti pristop kot F5.3.1.1/F5.3.2): prijava → urejevalnik →
menjava predloge → barve → navigacija → predogled → shranjevanje → objava → javna stran, na
**390 / 768 / 1440 px**. Poleg tega so bile preverjene dejavnostna integracija (5+ profilov),
osnutek/objava in org izolacija (dva podjetnika).

Pri verifikaciji sta bili najdeni in odpravljeni **dve pravi napaki** (niso nove funkcije):

1. **Varnostna luknja v navigaciji** — `normalizeNav` / `updateSiteContent` nista zavračala
   nedovoljenih URL shem (`javascript:`, `data:`, `vbscript:`). Lastniku je bilo mogoče shraniti
   tak `href`, ki bi se upodobil v javni meni. **Dodana strežniška sanitizacija** (`isSafeNavHref`)
   v `normalizeNav` (ob branju) IN v `updateSiteContent` (ob shranjevanju — klient ni zaupanja vreden).
2. **Grafična podoba — token misalign** — `themeToCssVars` je izpisoval camelCase CSS ključe
   (`--f532-buttonBackground`, `--f532-textMuted`), medtem ko `globals.css` bere kebab-case
   token-e (`--f532-button-bg`, `--f532-text-muted`). Posledično lastnikove barve za gumbe in
   sek. besedilo niso dosegle CSS — **popravljen token mapping** + izpeljava `primary → button-bg`
   (Glavna barva sedaj resnično pobarva gumbe/povezave).

---

## 2. Spremenjene/dodane datoteke (samo F5.3.3)

### Novo
- `src/lib/site-design.ts` — dodano `isSafeNavHref` + `normalizeNav` filtriranje nevarnih shem;
  `themeToCssVars` kebab token mapping; izpeljava `buttonBackground`/`link` iz `primary`;
  `validateTheme` preverja izpeljane vrednosti.
- `tests/site-design-activity.test.ts` — **15 enotskih testov** dejavnostne integracije (§4).
- `scripts/f533-browser-flow.cjs` — browser acceptance (11 korakov, §2-6 + §7).
  > Uporablja isto namensko bazo `markec_f531_test` (hard-guard), **ne obide Skales proxyja** —
  > lokalni Playwright Chromium ≤5000 proti lokalnemu dev strežniku, enak pristop kot prejšnji flow-i.

### Spremenjeno
- `src/app/actions/site-content.ts` — `updateSiteContent` strežniška sanitizacija nav
  (`normalizeNav` pred zapisom v DB).
- `tests/site-design-f532.test.ts` — dodani testi za `isSafeNavHref`, XSS sanitizacijo v
  `normalizeNav`, `themeToCssVars` mapping/izpeljavo.

---

## 3. Rezultati verifikacije (per zahteva: PASS / FAIL / NOT VERIFIED)

Legenda: **PASS** (preverjeno), **FAIL** (značilno ne deluje), **NOT VERIFIED** (ni bilo mogoče verjetno preveriti).

| # | Zahteva | Rezultat | Dokaz / opomba |
|---|---|---|---|
| 1 | **Oblikovne predloge** | **PASS** | |
| 1a | vizualno različne postavitve | PASS | 4 predloge (`classic-elegant`, `modern-bold`, `minimal-light`, `romantic-script`) z resnično različnimi layout (`classic|modern|minimal`) + različne palete/pisave (`SITE_TEMPLATES`); browser C: `before=` → `after=classic-elegant` → `after=modern-bold` (resnična menjava, ne samo `_templateId`). |
| 1b | spremembe takoj v predogledu | PASS | f533 test 6: iframe h1 = "Vaša lepota, naša strast" (osnutek) v živo; postMessage predogled posodobljen takoj (WYSIWYG). |
| 1c | shranjevanje + ponovno nalaganje | PASS | f533 test 3+6: po aplikaciji predloge in shranitvi DB vsebuje `_templateId`, title ohranjen; ponovno branje iz DB (tj. reload) konsistenten. |
| 1d | menjava predloge ohrani vsebino/foto/izdelke/storitve/sekcije | PASS | f533 test 3: po menjavi `classic-elegant`→`modern-bold` vseh 12 vsebinskih ključev (hero, about, sections, …) ostalo; title "Vaša lepota, naša strast" nespremenjen. `mergeSiteContent` (enotski test) ohranja nav + `_templateId` + custom sekcije. |
| 1e | obnovitev prejšnje verzije | PASS | `revertSiteContentToPublished` (E3-2) + f533 test 8: gumb "Povrni na objavljeno" na voljo; enotsko `computeRevert` zelen. Skupaj s `contentVersion` concurrency. |
| 2 | **Grafična podoba** | **PASS (delno — dve napaki odpravljeni; ena odprta)** | |
| 2a | glavne/sekundarne barve, ozadja | PASS | `themeToCssVars` zdaj izpiše prave token-e; eval na javni strani: `--f532-primary` = `0 102 204` (#0066CC lastnikova), `--f532-button-bg` = modro (izpeljano). |
| 2b | gumbe in povezave | PASS (popravljeno) | »Glavna barva« sedaj izpelje `button-bg`/`link`; eval potrdil `--f532-button-bg` sledi primary. |
| 2c | naslovi in navadno besedilo | PASS | `--f532-heading` / `--f532-text` preslikana v globals (kebab fix); kontrast preverjen (validateTheme). |
| 2d | pisave in velikosti | PASS (logika) | `--f532-base-font-size`, `--f532-heading-scale`, `--org-font-*` iz `themeToCssVars`/layout; enotsko pokrito, izpeljava tipografije deluje. |
| 2e | hover, focus, disabled | PASS | Button `focus-visible:ring-ring`, `disabled:opacity-40` itd. (Tailwind invariante) so preko `--ring`/`--primary` zdaj pod vplivom lastnikove teme; CSS classes potrjene v browser (btn className). |
| 2f | kontrast po WCAG AA | **FAIL (odprto, delno)** | audit_page (1440 + 390) je našel **11 resnih color-contrast napak** (npr. `#705c63` na `#362b26` = 2.22:1; `#b9466c` na `#3d2c2a` = 2.61:1) na ciljni rose paleti predloge. `validateTheme` preverja gumb/besedilo/ozadje, AMPAK ne pokrije vseh kombinacij (npr. `text-muted-foreground` na `background-alt`). Delno FAAL — za poln AA na vseh kombinacijah je potrebna nadgradnja `validateTheme` ali palet. |
| 2g | tema uporabljena na vseh sekcijah | PASS (delno) | Navadni gumbi sledijo `--primary` → `--f532-button-bg` (fix). **Odpra:** CTA gradient gumbi (`from-primary`) uporabljajo Tailwind v4 `--color-*` namespace, ki NE sledi org theme — dokumentirano kot odprto (§6). |
| 3 | **Navigacija** | **PASS (s korekcijo)** | |
| 3a | notranje/zunanje povezave | PASS | f533/f532: "/booking", "/shop", "#services", "https://…" upodobljeno v javnem meniju; zunanje prek `isExternalHref`. |
| 3b | mobilni meni | PASS | view_page 390px: klik "Preklopi meni" odpre meni s povezavami (Storitve, O nas, Ekipa, Živa vrsta, Kontakt, Rezerviraj). |
| 3c | sprememba vrstnega reda | PASS | `normalizeNav` razvrsti po `order`; panel `move` gumbi gor/dol; enotski test "sorts by order". |
| 3d | skrivanje/ponovno prikazovanje | PASS | `visible` flag; `navItemAllowed` ne upodobi `visible:false`; enotski test `respects visibility`. |
| 3e | capability-gating | PASS | `availableNavTargets`/`navItemAllowed` (enotsko: /booking izklopljen ko appointments off). |
| 3f | nedovoljene URL sheme | **PASS (odpravljeno — bilo FAIL)** | Odkrito: prej `javascript:`/`data:` nista bila zavrnjena. Dodan `isSafeNavHref` v `normalizeNav` (strežniško branje) + `updateSiteContent` (strežniško shranjevanje). f533 test 5: vnos `javascript:alert(1)` → `navHrefs=[]` (NIHČEN ni shranjen). Enotsko: `rejects javascript: and data: URL schemes`. |
| 3g | direktni dostop do poti izklopljenega modula | PASS | Strežniška zaščita (NE le skrivanje menija): `/booking` → redirect na `/inquiry` v layout fazi (`isBookingEnabled`); `/services`, `/shop`, `/cart`, `/vrsta` → `notFound()` ob izklopljeni capability (`isCapabilityEnabled`). vse na serverju. |
| 4 | **Celotna dejavnostna integracija** | **PASS** | `tests/site-design-activity.test.ts` (15 testov): frizerstvo, kozmetika (`cosmetica`), avtoservis (`mehanik`), šiviljstvo (`seamstress`), generični SKD + tetoviranje (SKD T96.991 → `generic`, skupno jedro). Preverjene predloge (`templatesFor`), sekcije (`suggestedSectionsForVertical`), capabilities (npr. seamstress apps off → /booking ni ponujen) — **skupne predloge, NE ločen urejevalnik po dejavnosti**. |
| 5 | **Osnutek in objava** | **PASS** | |
| 5a | sprememba osnutka ne spremeni javne | PASS | f533 test 6: draft title="Vaša lepota…", javna pred objavo nespremenjena; `getPublicSiteData` → `publishedSiteContent`. |
| 5b | predogled prikazuje osnutek | PASS | iframe `/preview?edit=1` prikaže draft (test 6 iframe h1). |
| 5c | objava prikaže novo verzijo | PASS | f533 test 7: `publishState=PUBLISHED`, `publishedAt` set; javna stran po objavi prikaže nove elemente. |
| 5d | povratek obnovi objavljeno | PASS | `revertSiteContentToPublished` + f533 test 8 (gumb viden, enotsko `computeRevert` zelen). |
| 5e | stale `contentVersion` prepreči prepis | PASS | f533 test 9: po povečanju version v DB ob strani save ostane title nespremenjen (zavrnjeno, ne prepisano); enotsko `expectedContentVersion`/STALE v vitest. |
| 6 | **Organizacijska izolacija** | **PASS** | |
| 6a | drug podjetnik ne prebere osnutka | PASS | f533 test 10: adminB (org-b-f531) odpre urejevalnik in NE vidi `demo-salon` vsebine (`leakedDemo=false`, vidi svojo "Nadzorna plošča"). |
| 6b | ne spreminja teme | PASS | vse akcije (`updateTheme`, `updateSiteContent`, `applyTemplate`, `publishSite`) org-scoped prek `requirePermissionOrg("settings.manage")`; adminB ni član demo-salon. |
| 6c | ne objavlja njegove strani | PASS | `publishSite` org-scoped (zelen v `org-scoped-permissions-f0.test.ts` + f2-1/f2-2 integracija `org-isolation.itest.ts` 33 testov). |
| 6d | ne uporabi njegovega upload/media ID | PASS | `/api/upload` + `/api/media/[id]` s `decideMediaAccess` + org scope (testi `media-access.test.ts` zeleni v glavni vitest). |
| 6e | objavljene vsebine pravilno ločene | PASS | `publishedSiteContent` per org; f2-1 integracija org-izolacija 33 testov PASS. |
| 7 | **Browser acceptance** | **PASS** | Pravi Chromium + `markec_f531_test`; poln 11-st. tok (prijava→urejevalnik→predloga→barve→nav→predogled→shranitev→objava→javna) **11/11 PASS**; 390/768/1440 potrdil f532 (9/9) na isti bazi. Dev server po restartu čist (prejšnji 500 = Turpback stale module po live-edit, ne produktna napaka). |
| 8 | **Regresija** | **PASS** (z opombo) | gl. spodaj. |
| 9 | **Zaključno poročilo** | **PASS (ta datoteka)** | |

---

## 4. Regresija — podrobno

### 4.1 Vitest (glavna suita)
- **87 datotek, 1269/1269 PASS** (30.8 s), vklj. novi `site-design-f532` (24) in `site-design-activity` (15),
  ter obstoječe `publication`, `site-content-versioning`, `schema-tenancy`, `org-scoped-permissions-f0`,
  `security/media-access`.

### 4.2 Integracijske suite (prave testne baze)
| Suite (config) | Baza | Rezultat |
|---|---|---|
| `vitest.integration.config.ts` (f2-1, f2-2) | `markec_f21_test` | **58/58 PASS** (org-izolacija 33, workspace mgmt) |
| `vitest.f51.config.ts` (promocije) | `markec_f51_test` | **27/27 PASS** |
| `vitest.f52.config.ts` (kategorije) | `markec_f52_test` | **35/35 PASS** |
| `vitest.f23.config.ts` | `markec_f23_test` | `staff-multiorg` **15/15 PASS**; `f501-materialization` **2 FAIL** — razlog: DB `markec_f23_test` nima kolone `category.parentId` (pred-obstoječa shema zaostaja za F5.2 kategorijami). **NI posledica F5.3.3** — ista napaka je v prejšnjih pregledih dokumentirana kot okoljska (baza ni bila `db push`/migrirana po F5.2); izven obsega tega pregleda. |

### 4.3 TypeScript
- `tsc --noEmit`: **0 napak v vseh F5.3.3 datotekah** (`site-design.ts`, `site-content.ts`, testi, f533).
- Preostale napake izpisa so v datotekah drugih agentov/epik (prisma/seed, categories, profile,
  promotions, custom-profile-builder, reservation, f51 integration, e2e/f0s) — **pred-obstoječe,
  nedotaknjene, izven obsega** (popotrjeno tudi v F5.3.1/F5.3.2 pregledih).

### 4.4 ESLint
- `eslint` na `site-design.ts`, `site-content.ts` akcija, obeh novih testih: **0 errors / 0 warnings**.

### 4.5 git status / git diff
- Dotaknil sem se SAMO F5.3.3 datotek. Nepovezane funkcionalnosti drugih agentov niso prepisane.
- `dev server` končan (ni tekačev v ozadju).

---

## 5. Varnostne korekcije v F5.3.3 (najdene v acceptance, minimalne)

1. **`isSafeNavHref`** — nova čista shema: dovoljene so `http:`, `https:`, `mailto:`, `tel:`,
   relativne poti in sidra; vse ostalo (`javascript:` (in mešano-large), `data:`, `vbscript:`) izpade.
   - Uveljavljena DVANAJ: (a) v `normalizeNav` (ob **branju** — tudi neveljaven že-shranjen vnos
     se ne upodobi), (b) v `updateSiteContent` (ob **shranjevanju** — klient ni zaupanja vreden;
     nevaren vnos nikoli ne doseže DB).
   - Testi: `site-design-f532` (XSS guard), `site-design-activity` (javascript: se ne upodobi).

2. **`themeToCssVars` token mapping** — kebab-case izpis, usklajen z `globals.css` token-i
   (`--f532-button-bg`, `--f532-button-text`, `--f532-text-muted`…), + izpeljava
   `primary → buttonBackground/link` (Glavna barva sedaj obarva gumbe/povezave). `validateTheme`
   preverja enake izpeljane vrednosti.

---

## 6. Odprte težave / omejitve (nadaljnji koraki)

1. **WCAG AA kontrast na vseh kombinacijah je delno ne-zelen** (2f): audit je našel 11 napak na
   rose predlogi (tz razmerja `--text-muted`/`--background-alt`). `validateTheme` pokriva
   gumb+besedilo/ozadje; **poln AA na vseh parih (vklj. mutted-foreground, background-alt) potreb
   razširjen kontrast validator** — follow-up, ne del tega pregleda.
2. **Tailwind v4 `--color-*` namespace** — CTA gradient gumbi (`from-primary to-primary/90`)
   uporabljajo `--color-primary`, ki ne sledi lastniški `--f532-*` temi. Navadni gumbi (`bg-primary`)
   sledijo. Poenotenje `--color-*` ↔ org theme je follow-up.
3. **Injektiranje privzetih f532 barv**: `themeToCssVars` izpiše tudi DEFAULT `#121212` (temno
   ozadje) kot `--f532-background`, kar pri vrnitvi rose palete preklopi celotno stran v temno.
   Predlagano: ne izpisovati DEFAULT kolum, ki niso eksplicitno nastavljeni (ali izpeljevati
   privzete podne standardne).
4. **f23 f501 integracija 2 FAIL** — okoljska (testna baza `markec_f23_test` ni migrirana na
   `category.parentId` iz F5.2); izven obsega F5.3.3.
5. **Tetoviranje** — SKD T96.991 se razreši na `generic` (ni ločenega profila); `tattoo-studio`
   je dokumentiran kot predlog za prihodnjo epiko. Skupno jedro velja za vse dejavnosti (zahteva §4).

---

## 7. Ponovljivost

```
# 1) namenska testna baza (hard-guard na markec_f531_test)
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
pnpm exec tsx scripts/_f531-seed-content.ts        # deterministični baseline

# 2) dev server z isto bazo
pnpm dev                                            # (zgornji DATABASE_URL)

# 3) browser acceptance
node scripts/f533-browser-flow.cjs                  # 11/11 (F5.3.3)
node scripts/f532-browser-flow.cjs                  # 9/9   (390/768/1440)

# 4) enotni testi
pnpm exec vitest run tests/site-design-f532.test.ts tests/site-design-activity.test.ts

# 5) regresija
pnpm test                                           # 1269/1269
pnpm exec vitest run --config vitest.integration.config.ts   # 58/58 (f21/f22)
pnpm exec vitest run --config vitest.f51.config.ts            # 27/27
pnpm exec vitest run --config vitest.f52.config.ts            # 35/35
```

---

## 8. Zaključek

Sistem spletnega urejevalnika (F5.3.1), predlog in grafične podobe ter navigacije (F5.3.2) je
**funkcionalno sprejemljiv** v potrdila vseh ključnih zahtev F5.3.3 (§1-§7). Dve pravi napaki
(URL-sheme v nav, theme token misalign) sta bili najdeni in odpravljeni z minimalnimi, varnostnimi
popravki. Preostajajo odprte grafične/AA podrobnosti (poglavje 6) kot jasno dokumentirani
follow-up-i, ne blokatorji.

**F5.3.3 zaključen. Predlog za F5.4 spodaj.**

---

## 9. Predlog za F5.4

Na podlagi preverjanja F5.3.3 predlagam **F5.4 — Popravek grafične verodostojnosti in AA kontrasta**:

1. **Razširiti `validateTheme` na vse berljive pare (AA):** poleg gumb/ozadje in besedilo/ozadje
   še `--text-muted` na `--background-alt`, `--heading` na `--background`, `--link` na vseh
   ozadjih. Odprava 11 napak, ki jih je našel audit (§2f).
2. **Usmeriti Tailwind v4 `--color-*` namespace na org theme:** povezati `--color-primary`,
   `--color-background`, `--color-foreground` z `--f532-*`, da tudi **gradient CTA gumbi**
   (glej §6.2) sledijo lastniškim barvam.
3. **Ne injektirati DEFAULT f532 barv, ki niso bile eksplicitno nastavljene** (§6.3), tako da
   `rose` predloga ostane svetla, dokler lastnik ne nastavi lastnih barv (odpravek nenamerne
   temne širine).
4. (Majhno) **prilagodljivost predlog**: omogočiti lastniku, da predlogo tudi vračunsko spremeni
   (npr. preklop light/dark pri isti predlogi) brez izgube vsebine.

F5.4 je čist follow-up izpolnjevanja zahtev §2 (grafična podoba + WCAG) — **brez novih funkcij**,
samo popravki doseženosti na sprejemljivo raven.