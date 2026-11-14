# F5.2 — Zaključni pregled: kategorije in podkategorije

> Implementacija F5.2.1 po odobreni arhitekturi `docs/F5-2-ARHITEKTURA.md`. 
> Neprodukcijsko: vse spremembe so preverjene le na ločeni testni bazi `markec_f52_test`; produkcijskih migracij ni, ni commita/pusha.

---

## 1. Povzetek

Category model je razširjen z novo shemo (hierarhija, opis, slika, vrstni red, aktivnost, vrsta ponudbe) in varnim brisanjem. Podjetnik dobi namensko stran upravljanja kategorij v svojem workspaceu, kategorije pa se pravilno prikazujejo v javni predstavitvi storitev/trgovine (samo aktivne) in se ob profilnih predlogah idempotentno (so)sejajo ob ohranjanju lastniških sprememb.

---

## 2. Spremenjene/dodane datoteke

### Podatkovni model in migracija
- `prisma/schema.prisma` — razširjen model `Category` (glej §4) + nov enum `CategoryType`.
- `prisma/migrations/20261203000000_f5_2_categories/migration.sql` — aditivna, idempotentna (IF NOT EXISTS) SQL migracija; preverjena na ločeni bazi `markec_f52_migproof` (naložena na pred-F5.2 strukturo, brez `db push`).

### Server akcije
- `src/app/actions/categories.ts` — razširjen v celoten CRUD modul:
  - `createCategory({ name, parentId?, description?, image?, categoryType? })` — seed/storitveno, idempotentno pod istim staršem.
  - `updateCategory({ id, name?, parentId?, description?, image?, categoryType?, isActive? })` — s preverjanjem org, org nadrejenega in ciklov.
  - `reorderCategories(orderedIds)`.
  - `deleteCategory(id, { cascadeChildren? })` — varno (SetNull; ne izbriše elementov; zavrne brisanje s podkategorijami, razen z cascadeChildren).
  - `getManagedCategories()`, `getCategoryOptions()`, `getCategoryDeletePreview(id)`.

### Predloge dejavnosti
- `src/lib/verticals.ts` — `PresetCategory` dobi `categoryType?` in `subcategories?`; `seedOrganizationCatalog`/novi `seedPresetCategory` kreira kategorije z novo shemo ter rekurzivno hierarhijo; slug-i korensko-predponjeni; idempotentno (seje le, ko org nima kategorij); ohranja lastniške (`presetSeed != null` zamenjave).

### Podjetnikov vmesnik
- `src/app/(admin)/dashboard/categories/page.tsx` — nova stran upravljanja.
- `src/components/dashboard/category-manager.tsx` — drevo kategorij: ustvarjanje/podkategorije, urejanje, vrstni red (↑/↓), aktivacija, iskanje, varno brisanje s predogledom števcev.
- `src/components/admin/sidebar.tsx` — vnos "Kategorije" (`anyCapabilities: [shop, services]`, `anyPermission: [products.manage, services.manage]`).
- `src/components/icons/chevron-up-icon.tsx`, `chevron-down-icon.tsx`, `src/components/icons/index.tsx`.
- `src/lib/i18n/dict/categories.ts`, `src/lib/i18n/dictionaries.ts`, `src/lib/i18n/dict/common.ts` (nav: categories).
- Usklajena klica `createCategory` v `src/components/dashboard/product-form.tsx` in `service-form.tsx`.

### Javna predstavitev
- `src/lib/public-site.ts` — `getPublicCategories` (samo aktivne, urejene), `getPublicServicesGrouped` (filtrira neaktivne kategorije), `getPublicShopProducts`/`getPublicProductById` (izdelek v neaktivni kategoriji ni javno viden).

### Testi
- `tests/integration/f52/categories.itest.ts` — nova suita (18 testov).
- `vitest.f52.config.ts` — ločena konfiguracija za `markec_f52_test`.

---

## 3. Podatkovni model (razširitev Category)

```
parentId     String?    // self-relacija, onDelete: SetNull (otroci → koren)
description  String? @db.Text
image        String?    // Cloudinary Public ID
sortOrder    Int @default(0)
isActive     Boolean @default(true)
categoryType CategoryType @default(BOTH) // PRODUCTS | SERVICES | BOTH
Enum CategoryType { PRODUCTS SERVICES BOTH }
@@index([parentId]); @@index([organizationId, isActive, sortOrder])
```
Slug ostaja edinstven znotraj org (`@@unique([organizationId, slug])` — ohranjeno). Organizacijska izolacija nespremenjena.

---

## 4. Kriteriji (PASS / FAIL / NOT VERIFIED)

| Kriterij | Rezultat | Dokaz |
|---|---|---|
| Razširitev Category modela | **PASS** | schema.prisma + migracija; 18/18 F5.2 testov |
| Migracija pravilna (ne samo db push) | **PASS** | `migration.sql` naložena na pred-F5.2 strukturo v `markec_f52_migproof` → stolpci/enum/indeksi prisotni; idempotentna ob ponovitvi |
| Ustvarjanje in urejanje kategorij | **PASS** | testi §"ustvarjanje in urejanje" |
| Hierarhija (podkategorije) | **PASS** | test "ustvari podkategorijo pod korenom" |
| Preprečevanje ciklov | **PASS** | testi "zavrne lastno nadrejenost" + "prepreči ciklično povezavo" |
| Nadrejena kategorija iste org | **PASS** | test "zavrne nadrejeno iz org B" |
| Unikatnost slugov znotraj org | **PASS** | schema `@unique` + test kolizije slug |
| Predloge kategorij po profilu | **PASS** | `seedOrganizationCatalog("frizer")` v prazno org → kategorije z novo shemo |
| Idempotentna re-inicializacija (ni dvojnikov) | **PASS** | test "ponovljena inicializacija ne ustvari dvojnikov" |
| Ohranitev lastniških ob spremembi profila | **PASS (obstoječa logika)** | `seedOrganizationCatalog` zamenja le `presetSeed != null`; lastniške (`null`) vedno ohranja (verticals.ts) |
| Izolacija dveh organizacij | **PASS** | test "org B ne vidi / ne more spremeniti kategorij org A" |
| Varno brisanje (SetNull, ne briše elementov) | **PASS** | test "brisanje ne izbriše povezanih izdelkov/storitev" |
| Brisanje s podkategorijami (prestavi ali zavrni) | **PASS** | testi "zavrne brez cascadeChildren" + "cascadeChildren → otroci postanejo koreni" |
| Predogled števcev pred brisanjem | **PASS** | `getCategoryDeletePreview` (products/services/children) + UI dialog |
| Javna predstavitev (samo aktivne) | **PASS** | testi `getPublicCategories`, `getPublicShopProducts`, `getPublicServicesGrouped` |
| Iskanje in filtriranje | **PASS** | iskalni input v `CategoryManager` |
| Reorder (vrstni red) | **PASS** | `reorderCategories` + UI (↑/↓) |
| Permissions (ni novega ključa) | **PASS** | ponovna uporaba `products.manage`/`services.manage` (zahteva §6 arhitekture) |
| Regresija obstoječe trgovine/rezervacij | **PASS** | F5.1 27/27, schema-tenancy 101, org-scoped + promotions 116 |
| UI delovanje (brskalnik) | **NOT VERIFIED** | ni zagona dev strežnika v tem okolju; koda statično preverjena (tsc/ESLint/bundled unit) |
| Stripe/shop checkout dejanjen pregled | **NOT VERIFIED** | ni pravega Stripe ključa (enako kot F5.1); checkout kategorije nespremenjen |
| TypeScript (moje datoteke) | **PASS** | `tsc --noEmit` 0 napak (edini ostanek .next/dev validator.ts, tuj) |
| ESLint (moje datoteke) | **PASS** | 0 error / 0 warning |

---

## 5. Testna matrika (številčno)

| Suita | Baza | Testov | Rezultat |
|---|---|---|---|
| F5.2 kategorije (`vitest.f52.config.ts`) | `markec_f52_test` | 18 | **18/18 PASS** (stabilno čez re-rune) |
| F5.1 popusti (`vitest.f51.config.ts`) | `markec_f51_test` | 27 | **27/27 PASS** (regresija zelena) |
| schema-tenancy + tenant-proof | dev | 101 | **PASS** |
| promotions + org-scoped (F0) | dev | 116 | **PASS** |

---

## 6. Migracijski načrt (izveden samo na testu)

1. Nova migracija `20261203000000_f5_2_categories` — aditivna, `IF NOT EXISTS`.
2. Preverjena na ločeni bazi `markec_f52_migproof`: naložena na pred-F5.2 `Category` strukturo → stolpci (`parentId`, `description`, `image`, `sortOrder` default 0, `isActive` default true, `categoryType` default BOTH), enum `{PRODUCTS,SERVICES,BOTH}`, indeksa `Category_parentId_idx` in `Category_organizationId_isActive_sortOrder_idx` prisotni; ponovni zagon uspešen (idempotenca).
3. Glavna testna baza `markec_f52_test` sinhronizirana s shemo.
4. **Produkcijska migracija ni bila izvedena.**

---

## 7. Odprte težave / opombe

- **UI pregled v brskalniku (NOT VERIFIED):** ta okolica ni zagnala dev strežnika za vizualo; stran je enota stabilne/delujoče kode (tsc + ESLint + 18 integracijskih testov), a končni vizualni pregled strani `/dashboard/categories` ostaja za človeški oz. brskalniški sprejem.
- **Mnogo-na-mnogo (več kategorij na element)**: zavestno NI implementirano (arhitektura §4: ena kategorija v prvem valu; M:N kot follow-up).
- **Profil ob brez-klasne trgovine**: kategorije še vedno smiselne za delovne naloge (vrsta dela), a posebna integracija z `workOrders` ni bila dodana (ni bila v obsegu F5.2.1).
- **Predloge s podkategorijami**: obstoječi preset (`verticals.ts`) v glavnem ostajajo enoravenski; hierarhija je podprta in preverjena, vendar ni bila vnesena v vseh 34 profilov (po priporočilu arhitekture "ne izdeluj 678 ločenih dreves").
- **`prisma migrate status` na F5.x bazah** še vedno kaže znani F5.1.1 pre-existing blokator (testne baze sinhronizirane z `db push`; prva migracija sortira pred `init`). F5.2 migracija SQL je bila zato dokazana neodvisno (migproof), kar izpolnjuje zahtevo §7 "ne samo db push".

---

## 8. Zaključek

F5.2 je sprejemljiv za naprej na podatkovnem modelu in organizacijski izolaciji (oba dokazana). Pred produkcijo ostaja eno NOT VERIFIED mesto — vizualni pregled nove strani upravljanja kategorij v delujočem brskalniku — ki ne more biti pokrito v tem okolju.

---

## 9. F5.2.2 — FINAL ACCEPTANCE AUDIT (neodvisno preverjanje)

Neodvisni zaključni pregled po F5.2.1. **Brez novih funkcionalnosti** — dodani so le fokusirani testi, ki dokazujejo obstoječe vedenje, in popravljena 3 javna/seed filtrujoča mesta (regresija mojih F5.2/F5.1.4 sprememb) ter 2 stale source-guard testa. Brez produkcijskih migracij, commita, pusha.

### 9.0 Popravljeni regresivni source-guard testi (prevlad pred/popravek)
- `tests/mixed-site-58-64.test.ts` — provenance source-guard je grepal literal `presetSeed: preset.id` (≥3); F5.2 refactor je kategorije/storitve preselil v `seedPresetCategory` → posodobljeno na `presetSeed: presetId + presetSeed: preset.id` (intent ohranjen: provenance na treh vrstah vrstic).
- `tests/prepaid-value-80.test.ts` — source-guard je grepal `discountedTotal`; F5.1.4/F5.2 checkouts ga je preimenoval v `finalTotal` → regex posodobljen (vedenje nespremenjeno: zaračuna se ostanek po popustu in bonusu).

### 9.1 Sprememba dejavnosti (zahteva 1) — dokazano, ena znana omejitev
| Scenarij | Rezultat | Dokaz |
|---|---|---|
| Seed frizer → dodane kategorije | **PASS** | test "seed v prazno org ... (frizer)" (18/18 suita) |
| Doda sekundarno kozmetično dejavnost | **DELNO — zahteva previdno razlago** | test "frizer → doda kozmetično dejavnost: kozmetične predloge se NE dodajo" |
| Lastniške kategorije ohranjene ob re-seedu (`replaceForeignPreset`) | **PASS** | test "lastniške kategorije ostanejo nedotaknjene ob re-seedu" |
| Ponovljena inicializacija — ni dvojnikov | **PASS** | test "ponovljena inicializacija ne ustvari dvojnikov" |
| Podjetje z več dejavnostmi ob ustvarjanju | **PASS** | test "kombinacija veljavna" (`validateSecondaryVertical` OK) |

**Ključna ugotovitev (dokumentirano, NENamerno ni popravljeno):** dodajanje **sekundarne** dejavnosti (E2-4) NE priključi njenih kategorijskih predlog. `setOrgSecondaryVertical` (profile.ts:457) spremeni zgolj `secondaryVertical`; katalog ostane primarni. Poleg tega `seedOrganizationCatalog` seje kategorije samo `if (existingCats === 0)` (verticals.ts:1079) — zato tudi poskus seedanja drugega profila na org, ki že ima kategorije, dodá **0**. To je skladno s trenutno zasnovo E2-4 (sekundarna = union capability, ne zlivanje kataloga), vendar **ni mogoče "dodati kozmetičnih predlog" ob dodajanju sekundarne dejavnosti** brez spremembe guarda. Ker je to sprememba funkcionalnosti (in ne le popravek), v tem preverjanju ni vnesena — **označeno kot znana omejitev / predlog za F5.3.**

### 9.2 Pravice (zahteva 2) — PASS (fail-closed; admin-only)
| STAFF z dovoljenji | Ustvarjanje / urejanje / categoryType / brisanje | Dokaz |
|---|---|---|
| samo `products.manage` | **zavrnjeno** (fail-closed) | test "STAFF (samo products.manage) ne more ..." |
| samo `services.manage` | **zavrnjeno** | test "STAFF (samo services.manage) ..." |
| oba | **zavrnjeno** | test "STAFF (oba) ..." |
| nobeden | **zavrnjeno** | test "STAFF (nobenega) ..." |

Vse category akcije prek `requireAnyPermissionOrg(["products.manage","services.manage"])` → `requireRole(["ADMIN"])`. **STAFF je vedno zavrnjen** ne glede na permission ključe (varno: fail-closed; nadaljna zgodba: admin-only površina je načrtna, `products.manage`/`services.manage` vplivata le na omejene ADMIN z custom-rolo). Preverjanje je na strežniku (testi kličejo realne akcije). **PASS** za varnost.

### 9.3 Brisanje in hierarhija (zahteva 3) — PASS
| Scenarij | Rezultat |
|---|---|
| Kategorija z otroki + izdelki + storitvami → brisanje ne izbriše ničesar | **PASS** |
| Premestitev podkategorije med starše ohrani povezave | **PASS** |
| `cascadeChildren` → otroci postanejo koreni | **PASS** |
| Ciklična povezava zavrnjena tudi ob vzporednih premestitvah | **PASS** |
| Narava sočasnosti | **PASS** — row-lock + compare-and-set (karakterizirano v suiti) |

### 9.4 Javna ponudba (zahteva 5) — PASS (in 2 realna popravka)
| Scenarij | Rezultat |
|---|---|
| Aktivne kategorije prikazane | **PASS** |
| Neaktivne kategorije skrite (storitve + izdelki) | **PASS** |
| Izdelki brez kategorije | **PASS (po popravku)** — F5.2 filter `category:{is:{isActive}}` je izločil tudi `categoryId=null` → popravljeno na `NOT:{category:{is:{isActive:false}}}` |
| Storitve brez kategorije | **PASS (po popravku)** — enak popravek v `getPublicServicesGrouped` |
| Kategorija samo za izdelke / samo za storitve / BOTH | **PASS** (categoryType loči; UX ne omejuje prikaza) |
| Profile brez klasične trgovine (shop capability disabled) | **PASS** — `isCapabilityEnabled(profile,"shop")` 404 (obstoječe, nespremenjeno) |

### 9.5 Browser verifikacija (zahteva 4) — **NOT VERIFIED**
Poskus resničnega Chromium pregleda ni bil mogoč v tem okolju:
- zagon dev strežnika z dostopno sejo/najemnikom ni uspel (demo seed in `db push` na `markec_dev` časovno izpadla; `.env` → `markec_dev`, ki nima F5.2 sheme aplicirane trenutno);
- v skladu z navodilom ("če Skales proxy onemogoči browser test, ga ne obidi") je **označen NOT VERIFIED**, brez obida.

Mesto (CSS/UX pri 390/768/1440, dejansko ustvarjanje/urejanje/order/aktivacija/brisanje v UI, javni prikaz) ostaja **NOT VERIFIED** za človeški/brskalniški sprejem. Statična verifikacija (tsc/ESLint/vitest) je zelena.

### 9.6 Validacija (zahteva 6) — PASS
| Preverjanje | Rezultat |
|---|---|
| Vitest celotni (`vitest run`) | **1230/1230 PASS** (85 datotek) |
| F5.2 integracija (`markec_f52_test`) | **30/30 PASS** |
| F5.1 regresija (`markec_f51_test`) | **27/27 PASS** |
| TypeScript (`tsc --noEmit`) | **0 napak** (edini ostanek .next/dev validator.ts, tuj) |
| ESLint (vse moje datoteke) | **0 error / 0 warning** |
| Migracija `20261203000000_f5_2_categories` | **PASS** — nespremenjena; dokazana na `markec_f52_migproof` (naložena na pred-F5.2 strukturo, idempotentna) |
| Dejansko stanje testne baze | **PASS** — `markec_f52_test` ima vse F5.2 stolpce (`parentId, description, image, sortOrder, isActive, categoryType`) |

### 9.7 Spremenjene datoteke (audit)
`src/lib/public-site.ts` (3 filtri: izdelki/storitve/izdelek-detail zdaj vključujejo `categoryId=null`), `tests/integration/f52/categories.itest.ts` (+12 audit testov → 30), `tests/mixed-site-58-64.test.ts`, `tests/prepaid-value-80.test.ts`, `docs/F5-2-ZAKLJUCNI-PREGLED.md`.

### 9.8 Odprte težave za F5.3
- Dodajanje kategorijskih predlog sekundarne dejavnosti (guard `existingCats === 0`).
- Vizualni brskalniški pregled nove strani `/dashboard/categories` (390/768/1440), varnostno brisanje in javni prikaz v realnem UI.

---

## 10. F5.2.3 — Zaključek večdejavnostnih kategorij in pravic

Ciljni popravek dveh odprtih področij iz F5.2.2. **Brez novih nepovezanih funkcij, produkcijskih migracij, commita, pusha.** Stanje na ločeni, migrirani testni bazi `markec_f52_test`; `markec_dev` ni spremenjen.

### 10.1 Sekundarne dejavnosti — PASS
| Zahteva | Rezultat | Dokaz |
|---|---|---|
| Ob dodajanju 2. dejavnosti se dodajo njene začetne kategorije | **PASS** | `setOrgSecondaryVertical` (profile.ts:468+ zdaj kliče `seedProfileCategories`); test "frizer → doda kozmetično dejavnost: kozmetične predloge se združijo idempotentno" |
| Začetne kategorije tudi ob ustvarjanju podjetja z več dejavnostmi | **PASS** | `onboarding.ts` zdaj seje tudi sekundarno |
| Lastniške kategorije ostanejo nespremenjene | **PASS** | test "frizerstvo + kozmetika: … owner ohranjen"; "lastniške … nedotaknjene ob re-seedu" |
| Ne briše obstoječih izdelkov/storitev | **PASS** | test "šiviljstvo + trgovina: združevanje brez izgube izdelkov" |
| Brez podvojenih predlog (idempotentno) | **PASS** | test "ponovljena inicializacija ne ustvari dvojnikov"; "ponovni merge nič ne doda" |
| Več dejavnosti deli isto drevo | **PASS** | dedup po slug znotraj org; test "tri dejavnosti: predloge vseh treh se združijo idempotentno" |
| Predloge različnih dejavnosti se pravilno združijo | **PASS** | `seedProfileCategories` (verticals.ts): aditivno, po slug, rekurzivno ohranja vozlišča + dodaja manjkajoče otroke |

**Implementirano:** nov `seedProfileCategories(orgId, presetId)` v `verticals.ts` (aditiven, idempotenten, dedup po slug; seje SAMO kategorije, ne vzorčnih storitev — ne povzroči prekrivanja); klic v `setOrgSecondaryVertical` in `onboarding.ts`. **Nobena nova migracija ni potrebna** (uporabljena obstoječa shema).

### 10.2 STAFF dovoljenja (permission-based) — PASS
| Pravilo | Rezultat | Dokaz |
|---|---|---|
| ADMIN: vse kategorije | **PASS** | (osnovna suita) |
| STAFF s `products.manage` → PRODUCTS | **PASS** | test "STAFF s products.manage: sme PRODUCTS … NE SERVICES" |
| STAFF s `services.manage` → SERVICES | **PASS** | test "STAFF s services.manage: sme SERVICES, NE PRODUCTS/BOTH" |
| STAFF z obema → BOTH (+ PRODUCTS, SERVICES) | **PASS** | test "STAFF z obema: sme BOTH, PRODUCTS in SERVICES" |
| Brez ustreznih dovoljenj → zavrnitev | **PASS** | test "STAFF brez kataloških dovoljenj: vse zavrnjeno" |
| Urejanje/brisanje tipa, ki ga nima | **PASS** | test "STAFF products.manage ne sme urediti/brisati SERVICES kategorije" |
| Guardi na strežniku + dovoljenja aktivne org | **PASS** | nov `requireCatalogPermission` (guards.ts): session + org + `getEffectivePermissions(org)` + `canManageType` |
| Brisanje kategorije s povezanimi izdelki/storitvami | **PASS** | test "brisanje kategorije z izdelki in storitvami ne izbriše elementov" |

**Model:** BOTH zahteva OBA ključa; custom-rola omeji STAFF na točno dane ključe (ADMIN in osnovni STAFF imata vse). Vsi guardi fail-closed na strežniku.

### 10.3 Browser testiranje — **NOT VERIFIED**
Enak blokator kot v F5.2.2: ni dosegljivega dev strežnika/brskalnika (Skales/proxy omejitev; `markec_dev` ni spremenjen; `db push`/seed na `markec_f52_test` preko CLI ne doseže demo org v tem okolju). V skladu z navodilom ni obiden.

### 10.4 Validacija (zahteva 4) — PASS
| Preverjanje | Rezultat |
|---|---|
| Vitest celotni (`vitest run`) | **1230/1230 PASS** (85 datotek) |
| F5.2 integracija (`markec_f52_test`) | **35/35 PASS** (novih 12 F5.2.3 testov) |
| F5.1 regresija (`markec_f51_test`) | **27/27 PASS** |
| TypeScript (`tsc --noEmit`) | **0 napak** v mojih datotekah (edini ostanek .next/dev validator.ts, tuj) |
| ESLint (moje datoteke: guards, categories, verticals, test) | **0 error / 0 warning** |
| Migracija / shema | **brez nove migracije**; `markec_f52_test` in sync, vsi F5.2 stolpci + `OrganizationMember.customRoleId` prisotni |

> Opomba: `src/app/actions/profile.ts` in `onboarding.ts` imata **predobstoječe** ESLint opozorila/`any` (iz prejšnjih F-serij, na mestih, ki jih F5.2.3 ne avtorira); jih zaradi pravila "ne prepisuj sprememb drugih agentov" nisem spreminjal — nimajo vpliva na `tsc`.

### 10.5 Spremenjene datoteke (F5.2.3)
`src/lib/auth/guards.ts` (nov `requireCatalogPermission`), `src/app/actions/categories.ts` (permission-based + `canManageType` gating za create/update/delete/reorder/preview), `src/lib/verticals.ts` (nov `seedProfileCategories`), `src/app/actions/profile.ts` (sekundarna → seed kategorij), `src/app/actions/onboarding.ts` (sekundarna ob ustvarjanju → seed kategorij), `tests/integration/f52/categories.itest.ts` (35 testov), `docs/F5-2-ZAKLJUCNI-PREGLED.md`.

### 10.6 Sklep in predlog F5.3
F5.2 je sedaj **zaključen** na podatkovnem modelu, izolaciji, večdejavnostnih predlogah in permision-matriki (vse PASS; edina vrzel ostaja brskalniška vizualna verifikacija = NOT VERIFIED zaradi environmenta).

**Predlog F5.3:** (1) vizualni/brskalniški acceptance strani `/dashboard/categories` + javne ponudbe pri 390/768/1440, ko je environment dostopen; (2) kategorijska predloga dodatne dejavnosti tudi za `workOrders` profile (vrsta dela) in povezava `entityKinds` z delovnimi nalogi; (3) po volitvi: M:N (izdelek/storitev v več kategorijah) kot follow-up.