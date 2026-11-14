# MARKEC — Načrt: Izkusnja podjetnika od prijave do delovanja

**Vrsta:** analiza obstoječega + načrt celotne uporabniške poti (ne implementacija).
**Metoda:** pregled dejanske kode (profilski motor, katalog SKD, nadzorna plošča, urejevalnik spletne strani, trgovina, čarovnik, moduli, nastavitve) s `file:line` dokazi; trije vzporedni raziskovalni pregledi + neposreden pregled jedra.
**Status:** ANALIZA IN NAČRT. Nič se ni spremenilo/migriralo, nič ni bilo implementirano.

> **Glavni cikel uspeha:** podjetnik izbere dejavnost → MARKEC pripravi celotno okolje → uredi podatke → objavi spletno stran in trgovino → samostojno vodi poslovanje.

---

## 1. Kratek povzetek (preberi prvi)

**MARKEC že ima skoraj celoten kostur za zahtevo.** Nekatere dele je treba le dokončati/izboljšati, ne zgraditi na novo. Ključno:

| Zahteva | Stanje | En stavek |
|---------|--------|-----------|
| §1 Vstop (registracija/prijava/dejavnost) | ✅ **v glavnem EXISTING** | čarovnik pripravi delovni prostor takoj; imenik dejavnosti deluje, a ima le **~35 profilov**, NE ~1000 |
| §2 Samodejna priprava sistema | ✅ **EXISTING** | `seedOrganizationCatalog` + `materializeProfileAssets` + aktivacijski seznam = ni prazne plošče |
| §3 Urejanje spletne strani | ✅ **EXISTING** | urejevalnik "Izgled in vsebina" pokrije logo/barve/tekste/sekcije/osnutek/objavo |
| §4 Trgovina in ponudba | ✅ **EXISTING, delno** | CRUD izdelkov/storitev/kategorij/naročil; manjkajo popusti (razen `compareAtPrice`), ni samostojnega upravljanja kategorij |
| §5 Poslovna nadzorna plošča | ✅ **EXISTING** | vklop/izklop modulov po org (!), profile-aware dashboard, aktivacijski seznam |
| §6 Celoten katalog (~1000) | ⚠️ **NAJVEČJA VZREL** | 22 sekcij A–V + 21 področij; manjkajo interni SKD **oddelki/razredi (Raven 2/3 ≈ 700–1000)** |
| §7 Samostojnost podjetnika | ✅ **EXISTING** | vse upravljivo iz vmesnika; podatki org-izolirani; več-org staff (F2.3.1) zaključen |
| §8 Obstoječe analiziraj pred razvojem | ✅ ta dokument | poglej §4 (matrika), §5 (vrzeli), §6 (načrt) |

**Ni treba graditi ničesar od nič za §2–§5.** Največji vlaganje je razširitev kataloga dejavnosti (§6) na področja/razrede SKD in vmesna manjša funkcionalnost (§4 popusti, fotografije, predogled v urejevalniku).

---

## 2. Zemljevid uporabniške poti (stanje po korakih)

### Korak 0 — Registracija
- **Registracija + geslo:** ✅ EXISTING — `src/app/actions/onboarding.ts:82` `createSalonOrganization`, `register` form v `src/app/(auth)/register`.
- **Potrditev e-pošte:** ✅ EXISTING — `auth.ts` (verifyEmail, VerificationToken), `verify-email` stran.
- **Prijava:** ✅ EXISTING — `login-form`, NextAuth JWT.
- **Možnost dodatnega podjetja za prijavljenega lastnika:** ✅ EXISTING — `onboarding.ts:172` `additionalOrg`; več delovnih prostorov prek `switchActiveOrganization` + OrgSwitcher.
- **_2. korak vprašanj (velikost tima, spletna rezervacija):_** ✅ EXISTING — `onboarding.ts:217-224` `teamSize`/`onlineBooking` v `onboardingAnswers`, checklista jih upošteva.
- **Gap:** ni "po prijavi izberi workspace" vstopne table ob VEČ članstvih na prvi prijavi (OrgSwitcher obstaja v sidebarju; vstopna tabla mapa je del F2.1 → F2.2, glej `WORKSPACE-ANALIZA.md:86` F1).

### Korak 1 — Izbira dejavnosti
- **Imenik v čarovniku `/start`:** ✅ EXISTING — `src/components/onboarding/activity-directory-picker.tsx` (spustni imenik: pripravljene predloge + področja SKD + sekcije SKD + lastna oznaka).
- **Iskanje po imenu/dejavnosti:** ✅ — `activity-directory-picker.tsx:110-135` filtrira po `label`+`description`, področju (ime/ključ), sekciji (ime/šifra A–V).
- **Iskanje po kategoriji:** ✅ delno — področja SKD = kategorija; ni internih kategorij oddelkov.
- **Iskanje po šifri:** ✅ delno — samo sekcija A–V (`s.code`), ni ~1000 šifer oddelkov/razredov.
- **Celoten katalog ~1000:** ❌ **MANJKA največji del** — le Raven 1 (22 sekcij) + 21 področij; **brez Raven 2/3 (oddelki/razredi ≈ 700–1000 aktivnosti)**. Profilov v registru je **~35** (`registry.ts:211` PROFILE_LIST: 7 lepotni + generic + seamstress + tire-service + mehanik + beekeeping + 22 `skd-*`).
- **Sekundarna dejavnost:** ✅ EXISTING — `validateSecondaryVertical` (`onboarding.ts:119`), capability union E2-4.

### Korak 2 — Samodejna priprava sistema (po izbiri)
`createSalonOrganization` v enem toku ustvari (vse EXISTING):
1. **Organization/workspace** (`onboarding.ts:230`) z `vertical`, `palette`, `skdCodes`, `onboardingAnswers`, `publishState:"DRAFT"`.
2. **Lastnik = ADMIN + članstvo** (`onboarding.ts:253-293`) + staff vrstica (če profil omogoča osebje; `onboarding.ts:266`) z woking hours in preset sliko.
3. **Vzorčni katalog storitev/izdelkov/kategorij** za dejavnost — `seedOrganizationCatalog(org.id, profile.id)` (`onboarding.ts:350`) iz `src/lib/verticals.ts`.
4. **Materializacija obrazcev in workflowov** iz profila — `materializeProfileAssets` (`onboarding.ts:354`, `src/lib/profiles/materialize.ts`).
5. **Povezava storitve → lastnikov staff** (`onboarding.ts:357`), **SalonConfig** (spletna vsebina, jezik, rezervacijska politika, telefon).

**Rezultat: podjetnik po čarovniku NE začne na prazni plošči** — dobi aktivacijski seznam (`src/lib/profiles/setup-checklist.ts`) na nadzorni plošči z **next-best-action**, profile-aware koraki in izpolnjen vzorčni katalog.

### Korak 3 — Urejanje spletne strani
Urejevalnik **`src/components/dashboard/branding-editor.tsx`** ("Izgled in vsebina"):
- **Ime podjetja** → SettingsForm (osnovni zavihek); **logotip** → `handleLogo`/upload/remove (`branding-editor.tsx:520,539`); **barve** → 8 fiksnih palet `updateOrgPalette` (`site-content.ts:216`).
- **Slike** → hero/o-nas upload; **besedila/opisi** → poljski podatki.
- **Sekcije dodaj/odstrani/preuredi** → `moveSection` (reorder), `addCustomSection`, `removeCustomSection`, `toggleSection` (vidnost) (`branding-editor.tsx:708,721,738,786`).
- **Shrani osnutek** → `handleSave` → `updateSiteContent` (`branding-editor.tsx:827`);
- **Objavi** → `handlePublish` → `publishSite` (`branding-editor.tsx:891`); razveljavi → `handleRevert:916`.
- **Predogled namizne in mobilne strani:** ⚠️ PARTIAL — obstaja `/s/[slug]/preview` (ločena stran, namizje), a **NI vgrajenega predogleda v urejevalniku** in **ni stikala namizje/mobilno** (`branding-editor.tsx:978` predogled = zunanja povezava v nov zavihek).
- **Vrstni red sekcij brez drag-and-drop:** ⚠️ PARTIAL — gumbi gor/dol, ne vizualni drag (`branding-editor.tsx:1546-1573`).
- **Brez poljubnih barv:** ⚠️ — 8 fiksnih palet, ne poljubni color picker.

### Korak 4 — Urejanje trgovine in ponudbe
- **Izdelki CRUD** (ustvari/uredi/izbriši/preklopi razpoložljivost): ✅ EXISTING — `src/app/actions/products.ts` (`:299,:375,:453,:494`); cene, `compareAtPrice:43`, slike `:101`, opisi, SKU per org (P2002 `:358`), `forSale:98`, zaloga.
- **Storitve CRUD:** ✅ EXISTING — `services.ts`, `seedOrganizationCatalog`.
- **Kategorije:** ⚠️ PARTIAL — **samo `createCategory`** (inline), ni samostojnega urejanja/popisa (dodaj/uredi/izbriši) v vmesniku.
- **Naročila:** ✅ EXISTING — `orders.ts`, dashboard orders.
- **Popusti/akcije:** ⚠️ PARTIAL — le `compareAtPrice` ("Akcija"); **ni odstotkega popusta, časovnih akcij ali promo kod** za ročno urejanje.
- **Zaloge:** ✅ EXISTING — `src/app/actions/inventory.ts`.
- **Predstavitev ponudbe za dejavnosti brez klasične trgovine:** ✅ — Capability Matrix (`registry.ts`) gleda `isCapabilityEnabled(profile, "shop")`; ne-trgovske dejavnosti dobijo predstavitev storitev/povpraševanja (`ctaMode` booking/inquiry/order/quote).

### Korak 5 — Poslovna nadzorna plošča + moduli
- **Profile-aware dashboard:** ✅ — `dashboard/page.tsx` gates widgete na `profile.dashboardWidgets`; demonstracija: beauty (`todayAppointments, revenue…`), seamstress (`activeOrders, deadlines…`), tire-service (projekti/vozila).
- **Navigacija:** ✅ — `sidebar.tsx` filtrira NavItems po capability/extension/moduleStates.
- **Vklop/izklop modulov po podjetju, neodvisno od vertikale:** ✅ **v celoti EXISTING** — `src/app/actions/modules.ts` (`setModuleState`, dependency warnings, ConfigChangeLog za revizijo/rollback) + `src/lib/modules/catalog.ts`. Izklop ne izgubi podatkov.
- **⚠️ Vrzel:** `getModuleOverview` vedno vrača `profileDisabled:false` (`modules.ts:65`), torej profilno `disabled` capability se v pregledu modulov ne izraža — fascada prikaže vse module "ACTIVE" (vklop zanje je v F5; v1 samo informativno).
- **Nastavitve delovnega prostora:** ✅ — `workspace-management.ts` (ime, slug, davčna?, kontakt, barve, rezervacijska politika, objava). Lastnik je vse ureja sam.
- **Aktivacijski seznam:** ✅ — `setup-checklist.ts` (glej Korak 2).
- **Ni "izprazni ploščo" tveganja**, ker se vzorčni katalog + checklista materializirajo ob ustvarjanju.

---

## 3. Kaj JE že implementirano vs delno vs manjka (matrika)

### 3.1 Obstaja in deluje (ne ponavljaj gradnje)
| Stvar | Dokaz |
|---|---|
| Univerzalni profilski motor (Capability Matrix, terminologija, forme, workflowi, dashboard widgeti, CTA, extensioni) | `src/lib/profiles/*` |
| Samodejno ustvarjanje celotnega okolja ob izbiri | `onboarding.ts:350,354` |
| Aktivacijski seznam + next-best-action + profile-aware | `setup-checklist.ts` |
| Urejevalnik spletne strani (logo/barve/tekst/sekcije/osnutek/objava) | `branding-editor.tsx` + `site-content.ts` |
| Moduli vklop/izklop po org + revizija | `modules.ts` + `catalog.ts` |
| CRUD izdelkov/storitev/naročil/zalog | `products.ts`/`services.ts`/`orders.ts`/`inventory.ts` |
| Registracija/prijava/potrditev e-pošte | `(auth)/*`, `auth.ts` |
| Več podjetij istega računa + preklop + več-org staff | `onboarding.ts:172`, `organization-switch.ts`, F2.3.1 |
| Večvalutni katalog SKD Raven 1 (22 sekcij) + 21 področij | `src/lib/skd/catalog.ts` |
| Predstavitev ponudbe za ne-trgovske dejavnosti | `registry.ts` capability + `ctaMode` |

### 3.2 Delno implementirano (izboljšaj, ne gradi na novo)
| Stvar | Vrzel |
|---|---|
| Predogled spletne strani | ločena pot, brez stikala namizje/mobilno, ni vgrajen |
| Vrstni red sekcij | gumbi, ne drag-and-drop |
| Barve | 8 fiksnih palet, ni poljubne izbire |
| Kategorije | samo inline create; ni samostojnega upravljanja |
| Popusti/akcije | le `compareAtPrice`; ni odstotkov/časovnih/promo kod |
| Modul pregled | `profileDisabled:false` trdo; fasada ne odraža capability |

### 3.3 Manjka (glavni deli za dosego vizije)
| Stvar | Opis |
|---|---|
| **Katalog SKD Raven 2/3 (~700–1000 aktivnosti)** | samo Raven 1 + 21 področij; treba dopolniti datoteko `catalog.ts` z oddelki (Raven 2) in po nepotrebnem razredi (Raven 3), mapiranimi na profile glede na capabilities |
| Iskanje po ~1000 šifrah | picker išče šifre le za sekcije A–V; z oddelki/razredi se razširi |
| Poljubne barve | dodati color-picker poleg 8 palet |
| Vgrajen mobilni/namizni predogled | dashboard iframe predogled + device toggle |
| Samostojno upravljanje kategorij | screen za dodaj/uredi/izbriši/preuredi kategorije |
| Popusti/akcije (odstotki, časovne, kode) | promocijski model na izdelku |
| `getModuleOverview` upošteva `profileDisabled` | povezava capability matrike z modul pregledom |
| Raven "Company" (pravna identiteta nad org) | `WORKSPACE-ANALIZA.md:42-53` — opcija A, ločena faza F5 |

---

## 4. Načrt implementacije po fazah (predlagano)

Faze so ločene, vsaka s testi (enotni + integracijski na `markec_f23_test`), lint, typecheck in dokazom delovanja. **Najprej največja vrzel (katalog), nato manjše zahteve.**

### F5.0 — SKD katalog Raven 2/3 (~1000 aktivnosti) ⭐ glavna vrzel
- **Cilj:** podjetnik izbere iz ~1000 dejanskih dejavnosti, iskanje po imenu/kategoriji/šifri deluje, generični osnovni sistem za vsako.
- **Delo:**
  1. Dopolniti `src/lib/skd/catalog.ts` s **SKD oddelki (Raven 2)** in po potrebi **razredi (Raven 3)** (viri: SURS SKD_2025). Novo: `SkdDepartment` (code, name, sectionCode, suggestedModules, profileHint).
  2. Vsak oddelek → **predlog profila** (28 zmogljivostnih preslikav: appointments/workOrders/shop/services/inventory/…), enako kot področja zdaj predlagajo module, a na ravni oddelka.
  3. **Picker** (`activity-directory-picker.tsx`) prikaže oddelke/razrede pod sekcijami, išče po šifri oddelka (npr. `C311`/`95.11`), ponudi 2-3 pripravljenih profilov kot "izberite predlogo", default je profil oddelka.
  4. **Materializacija:** vsak oddelek (ki še nima lastnega profila) pade na **generic profil + profile-aware sugeriran modul set** — podjetnik tako dobi uporaben osnovni sistem, ne prazne plošče. Ni 1000 posebnih aplikacij.
- **Dokaz:** enotni testi sanitizacije kataloga (Rx:n): `suggestModulesForSkd`/`sanitizeSkdInput` na oddelkih; račun števila zapisov ≥ 700; integracijski test: izbira oddelka → org z generic profilom + aktivacijski seznam (ne prazna plošča).
- **Ne delamo:** 1000 ločenih profilov v `registry.ts` — ostane 35 profilov + katalog oddelkov, ki se preslika nanje.

### F5.1 — Popusti in akcije
- **Cilj:** §4 "ureja popuste in akcije".
- **Delo:** realni promocijski model na izdelku/storitvi: odstotek/absolut, časovno okno (od–do), vidnost "Akcija" = trguje z `compareAtPrice` na checkoutu. Admin screen za vnos.
- **Dokaz:** enotni testi izračuna cene s popustom; UI test trgovine.
- _Pozor:_ ne zlomiti obstoječega `compareAtPrice` prikaza.

### F5.2 — Samostojno upravljanje kategorij
- **Cilj:** §4 "ureja kategorije".
- **Delo:** screen za dodaj/uredi/izbriši/preuredi kategorije (services + products), navezava na obstoječi `categories.ts` in `Category` model.
- **Dokaz:** CRUD testi.

### F5.3 — Izboljšave urejevalnika spletne strani
- **Cilj:** §3 "predogled namizne in mobilne" in "shrani osnutek in objavi".
- **Delo:** (a) vgrajen iframe predogled v urejevalniku + stikalo namizje/mobilno; (b) opcijsko drag-and-drop razporejanje sekcij (ali dvoklik za skrčenje, kjer je UX zahtevnejši); (c) poljubna izbira barv poleg 8 palet (hrani v `Organization.palette`/`profileOverrides`, screenshot + axe).
- **Dokaz:** view_page/audit_page predogleda na 390/768/1440 px; WCAG kontrast za poljubne barve.

### F5.4 — Modul pregled odraža capability profile (zapiranje vrzeli §2 / modules.ts:65)
- **Cilj:** lastnik vidi pravo stanje modulov (disablan modul profila izražen kot "onemogočen za to dejavnost", ne "AKTIVEN").
- **Delo:** `getModuleOverview` naj izračuna `profileDisabled` iz `isCapabilityEnabled(getProfile(org.vertical), ključ)` namesto trde `false` (izogibaj se ciklu: modul ključi ↦ capability ključi preslikati).
- **Dokaz:** enotni testi `getModuleOverview` za beauty (shop zaprt? NE — beauty je shop required) in generic; UI test kartice modulov za profil z onemogočeno capability.

### F5.5 (opcijsko) — Raven Company (pravna identiteta)
- **Cilj:** §1 "več dejavnosti ali podjetij… vsaka ločen poslovni prostor" + davčna/legalna identiteta.
- **Podlaga:** `WORKSPACE-ANALIZA.md:42-58` — Možnost A: `Company` + `Organization.companyId`, ločena faza po stabilnih F0–F3 (in zdaj F2.x). Ni nujna za osnovno samostojnost.
- **Dokaz:** reverzibilne migracije + backfill + integracijski testi izolacije.

### F5.6 — Vstopna izbira workspacea po prijavi (ureja §1, "po prijavi izberi workspace")
- **Podlaga:** `WORKSPACE-ANALIZA.md:86` (F1 tabelarska izbira). OrgSwitcher obstaja; manjkata vstopna tabla ob več članstvih in preklop posodobi `isDefault`.
- **Dokaz:** browser test login → izbira → dashboard pravega org.

---

## 5. Glavne vrzeli, ki jih je treba zapreti za "glavno merilo uspeha"

1. **Katalog ~1000 (F5.0)** — brez njega podjetnik NE najde svoje dejavnosti (danes vidí le 22 sekcij/21 področij). To je predpogoj celotnega cikla. **Prednost št. 1.**
2. **Iskanje po šifri oddelka/razreda (F5.0)** — zdaj le A–V.
3. **Predogled mobilne/namizne in poljubne barve (F5.3)** — §3 nepopoln.
4. **Popusti (F5.1)** in **kategorije (F5.2)** — §4 delno.
5. **Modul pregled odraža popečioje profile (F5.4)** — zaupanje lastnika v module.

**Po F5.0–F5.4 je vsaka točka iz zahteve §1–§7 pokrita** (razen opcijske pravne identitete Company F5.5 in vstopne table F5.6). Glavni cikel uspeha je izvedljiv brez programerja.

---

## 6. Priporočeni naslednji korak

Potrdi vrstni red faz in **začni s F5.0** (SKD katalog Raven 2/3). F5.0 je najsamostojnejši del z največjim vplivom na "izbere dejavnost iz kataloga približno 1.000 dejavnosti" in ne zahteva sprememb sheme ali obstoječih relacij — le razširitev kataloške datoteke, pickerja in preslikave na profile. Vse ostale faze so manjše nadgradnje obstoječih funkcij.

**Pravila:** vsaka faza ločen pregled + testi + lint + dokaz delovanja; brez produkcijskih migracij; brez `db push` kot dokaza migracije; brez prepisovanja tujega nedokončanega dela.