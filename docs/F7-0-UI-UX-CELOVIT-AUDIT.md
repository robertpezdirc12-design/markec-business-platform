# MARKEC — F7.0 CELOVIT UI/UX AUDIT IN NAČRT PRENOVE

> Read-only faza: pregled, analiza, načrt. **Brez spremembe aplikacijske kode, migracij, baz,
> produkcije, Vercela, git add/commit/push.** Statistični dokazi: koda (lineanja) + resnični browser
> (Chrome DevTools MCP na izolirani `markec_f631_test`, dev 3013, čebelar/f635). Stanje po F6.4.
> Oznake: **DOKAZANO** (dejansko v browserju/kodi), **DELNO** (delno preverjeno), **NI PREVERJENO**.

---

## 0. Temeljno stanje (vhod)

- Git: `main`; WIP drugih agentov vseobsežen (130 datotek `M`; `??` novi: screeniers, einvoices,
  promocije, workspaces, content-manager …). **Ni prepisan.**
- **Blokator iz F6.4:** `src/app/actions/einvoices.ts:51` (ne-async `formatLabel` v server-action
  datoteki) → production build pade; `/dashboard/einvoices` včasih 500 (dev overlay). V tem adjit-u
  nismo popravljali (prepoved §8); browser pregledi so na dev serverju, kjer /dashboard deluje.
- Ta audit obsega UI/UX pregled človeškega vitvega funkcionalnosti; vidljiva obstoječih modelov je
  opisana vnaprej (profili/capabilities/modules).

## 1. Celoten seznam pregledanih zaslonov (DOKAZANO/DELNO)

UI deli, pregledani v tem adjit-u (browser ali koda):

| Zaslon | Vir | Ugotovitev (gl. §4) | Dokaz |
|---|---|---|---|
| Prijava `/login` | koda (login-form) + browser (F6.3/4) | Obstoji, demo creds dodatno v dev | DOKAZANO |
| Registracija/invite | koda (onboarding) | Wizard korakov | DELNO |
| Onboarding dashboard `/dashboard` | **browser (čebelar)** | **Namesto plošče se prikaže "Kaj počnete?" wizard; čebelar/org že ima dejavnost** | **DOKAZANO** |
| Nadzorna plošča (po nadaljevanju) | **browser** | "Nadzorna plošča" + **"Vodena namestitev" (setup checklist 2/4)** + widgeti (prihodki, stranke) | DOKAZANO |
| Leva navigacija (sidebar) | koda + **browser** | **Flat seznam (dv¯ 22 itemov), ni ločitve Skupne/Dejavnost** | DOKAZANO |
| Zgornji meni (header) | browser | user menu, "Obišči stran", jezik, obvestila, **ni vidne oznake dejavnosti** | DOKAZANO |
| `/workspaces` (izbor prostora) | **browser** | "Kam želiš danes vstopiti?" karta "Čebelarstvo Test/Čebelarstvo/ADMIN" | DOKAZANO |
| Nastavitve (tabs) | koda + F6.3/4 | modularni tabi (Osnovne, Moduli, Izgled, Plačila, Domene, …) | DELNO |
| Vizualni urejevalnik | **browser (F6.4)** | DeviceId toggle, Sekcije/Barve/Nav/Predloge; **desni panel stisnjen** | DOKAZANO (F6.4) |
| Stranke/izdelki/storitve/termini/računi | koda (actions/pages) | CRUD screens, capability-gated | DELNO (koda) |
| Profili/vloge | koda | dashboard roles, permissions | DELNO |
| Trgovina/order/checkout | koda + F6.1 | zaloga/checkout avtoritativno; ni poln UI pregled tu | DELNO |

> Ni bilo ponovnega browser pregleda vsake CRUD-strani v tem adjit-u (obseg velik); zanačeni na
> kodišno analizo + prejšnje faze (F6.3 E2E robustno pokril javne strani, editor, moduli).

## 2. Posnetki zaslona problematičnih mest

- Browser snapshot za **dashboard** (onboarding-wizard prvič pred nastavljeno ploščo) in `sidebar`
  sta bila ustvarjena (Chrome DevTools MCP) — v tej okolini nisem mogel zapisati PNG v workspace
  (MCP tiska samo text; PNG workspace omejen — kot v F6.3/4). **Vidnejši so kot text/DB-dokazi v
  §3–4.** Po uveljavljeni politika "ni ELA browser dokaza" — snapshot-i so zabeleženi v temu
  dokumentu kot DOKAZANO (struktura strani z a11y snapshots + log requesti).

## 3. Seznam težav po resnosti

### KRITIČNO
- **K1 – Dashboard prikaže onboarding wizard namesto nadzorne plošče** (ni občutek "kje sem").
  Pri čebelarju (že vertikala beekeeping + PUBLISHED org) se na `/dashboard` privede "Izberite
  svojo dejavnost / barvni izgled / vprašanja / Obdrži trenutno" — šele po klike "Obdrži trenutno
  in nadaljuj" pride prava Nadzorna plošča. Za začetnika zmedeno in ne-jedra nočna predaja.
- **K2 – Vizualna oznaka aktivne dejavnosti ni prisotna v stalnem chrome-u (sidebar/header)**:
  uporabnik, ki je v org X, ne vidi vedno naziva "Čebelarstvo"/"Avtoservis" kot trajno sidro; je
  samo na `/workspaces` ali setup banner. (Hkrati sidebar vseeno capability-girates — moduli so
  dejansko drugačni; ampak prikaz "kje sem" je šibek.)

### VISOKO
- **V1 – Navigacija je en flat seznam brez skupin (A: Skupne / B: Dejavnost).** Vseh ~22 `navItems`
  v enem seznamu (dashboard→settings) znotraj capability-gatelda; dolgo nav za dejavnosti z veliko
  moduli, nič separator/null/stopenjske tematske skupine.
- **V2 – Dejavnostni izrazi in moduli se mešajo z splošnimi** (npr. "Obrazci", "Evidence" — splošni,
  ampako so pole dejavnost-specific; "Stranke/Marketing" splošni, "Izdelki/Kategorije/Paketi/Popusti"
  dejavnost-trgovinska). Uporabnik težko loči, kaj je splošno in kaj njegova panoga.
- **V3 – Prazne "Vodena namestitev" checklist na vrhu dashboarda** side-by-side z widgeti: veliko
  blokov na nič (2/4 korakov), widget "Prihodki 0€", "Število strank 0") — zač s pripomočkov ni
  navdihujočo prazna plošča.
- **V4 – Setup checklist koraki prepleteni z dejavnostjo**: "2/4 korakov", "naslednji korak", odpri
  katalog, dodaj stranko, objavi — koristno, ampak ob prazni plošči duplicate.

### SREDNJE
- **S1 – Desktop sidebar 64-ust. ločljivost je ozka** (w-64, ScrollArea) za dejavnosti z veliko
  moduli (mehanik ima delovne naloge, projekti, evidence, popusti…); scroll znotraj sidebarja.
- **S2 – Mobilna sidebar je Sheet (vlutični)** — ločitev (org switch) v zgornjem dropdown; ni
  vidna dejavnost v mobile chrome.
- **S3 – OrgSwitcher/workspaces** prikazan samo če >1 org — single-org uporabnik nima dezorientacije,
  ampak tudi na moreča neve videti "kateri prostor / katero dejavnost" raven.
- **S4 – e-racuni (einvoices) / delovni nalogi / projekti so capability/extension gated** — za
  nekatere dejavnosti odsotni (prav), ampak ob odsotnosti ni opise/odprta-serte nav (včasih prazno
  mesto ali tiho izpust).
- **S5 – Capability-gating v sidebarju ni popolno** (ne pride "mrtva povezava" za capability
  disabled — dobro; ampak ni subtilno ločila which items so "skupne" vs "aktivne dejavnosti").

### NIZKO
- **N1 – Sporočila/sorodnost besed** v i18n (SL) nekje dosledno s tips, drugod razlika (banneri
  "Vodena namestitev" vs “izpolnite”), nisem avtentiziral vseh.
- **N2 – Nekatere grafike/ikone** flat, nekaj barvnih pasov — lahko enotim.
- **N3 – Demover demo podatki (dev)** — dev sejan demo creds v login (dev-only, pošteno).

## 4. Dokazi o mešanju dejavnosti / potrditev ločitve

### Arhitektura ločevanja (DOKAZANO — koda)
- **Org=Naprava**: uporabnik ima eno ali več `Organization` (podjetij); vsak org ima `vertical`
  (dejavnost). Aktivna org iz session (`getSessionOrg` → `resolveSessionOrganization` skozi aktivno
  `OrganizationMember`).
- **Capability-gated nav**: `sidear.tsx` `navigation.filter` gleda `profile.capabilities[cap] !==
  "disabled"`, `extensions`, `requiresExtensions`, `permission` → dejavnost-neljavni moduli nikoli
  ne renderirajo (npr. čebelar nima "Rezervacije", "Zaposleni"; ima "Izdelki/trgovina",
  "Evidence/Zaloge"). → **ŠTRIGA ločitev orodij/evidenci/menijev dosežena na funkcionalni ravni.**
- **Terminologija** `termKey`/`term()` pritege dejavnost-specific (npr. "termini" za salon,
  "delovna naročila" za servis, "žetev/serije" za čebelar). → **beseda se prilagodi panogi**.
- **Org switch**: sidebar OrgSwitcher (samo >1) + header dropdown na /workspaces, `switchActiveOrganization`.

### Sklep za §1 (DOKAZANO, delno)
- **Ločitev FUNKCIJSKO deluje** (tj. moduli/evidence/meniji dejavnosti se dejansko razlikujejo — npr.
  čebelar vs frizer; dokazano tudi F6.3.2: strukture naročil/povpraševanja/trgovine različne).
- **Vizualna jasnost "v katerem okolju sem" je šibka:** sidebar/header NE prikazujeta trajno
  dejavnosti v vseh okniščih (le /workspaces in setup banner). → ločitev je v veliki meri dejanska,
  a "uporabnik vedno ve, v katerem okolju je" NI v celoti izpolnjeno.
- **Dashboard pretak (K1) meša onboard-wizard s poobla-tržno ploščo** → zmeda za večorg/beginer.

## 5. Predlagana nova struktura navigacije (2 skupini)

Na podlagi §2 cilja (spet smiselna, dejavnost-logična):

**A. Skupne poslovne funkcije** (vede, ne glede na dejavnost → A-groupa)
1. Nadzorna plošča
2. Stranke
3. Računi / e-računi (dokumenti/ponudbe)
4. Splošne nastavitve (org+nastavitev)
5. Uporabniki in dovoljenja (vloge)
6. (opcijsko) Analitika — splošna kros

**B. Funkcije aktivne dejavnosti** (po profilu; capability-gated)
- Dejavnostni osnovni tok: npr. Rezervacije/termini (salon) ali Delovni nalogi (servis/šivilja) ali
  Trgovina/zaloge (čebelar/servis s trgovino)
- Evidence dejavnosti (obrazci, procesi, projekti, records)
- Katalog dejavnosti: Storitve in cenik / Izdelki + kategorije/paketi/popusti (kjer relevantno)
- (opcijsko) Walk-in vrsta, marketing — če dejavnost podpira
- Vsi znotraj skupine B se izrišejo samo, če sta capability/extensions aktivni.

Predlog izvedbe v sidebarju: **rakurs struktura — delimiter + vedna podglava "Skupno" in "Dejavnost
(naziv)"**. Npr. seznam:
```
─ SKUPNO ─────────
 Nadzorna plošča
 Stranke
 Računi
 Nastavitve
 Uporabniki in vloge
─ DEJAVNOST: Čebelarstvo ─
 Izdelki
 Zaloge/Evidence
 Katalog/Popusti/Paketi
 Obrazci
 Walk-in
```
To ni dovoljenje za brezpogojno premikanje — preveriti dejansko namembnost vsakega itema ob izvedbi
(F6-next faza).

## 6. Predlagana struktura poslovnih okolij

- **Restavra_OKOLJE = podjetje (Org)**; znotraj org ve deljav (vertical + opc. secondaryVertical —
  razširivi moduli). Več org = več okolij.
- **Na vsakem zaslonu**:
  - ime aktivnega okolja (podjetje) — **dodati oznako v header/sidebar** stalno;
  - aktivna dejavnost — **badge/naziv** (npr. `Čebelarstvo`) pod imenom podjetja ali kot druga vrstica
    v sidebarju zgornjem delu;
  - trenutni razdelek — ohraniti `usePathname` highlight;
  - možen preklop v drugo okolje — dropdown/icon, vedno prikazan, tudi če 1 org (za več: OrgSwitcher;
    za enojnega: ne-obteževati, ali pa prikazati "1 podjetje" minimalno).
- **Ločeni začetni tok pri org z nedokončanim onboarding** → wizard naj NIKOLI ne nadomesti nadzorne
  plošče po tem, ko je org že postavljena (K1 popravek): moder separator "Nastavitev ni dokončana —
  nadaljuj namestitev" kot banner namesto full-wizard.

## 7. Predlogi izboljšav posameznih zaslonov

- **Dashboard**: vrhnja vrstica "Dobrodošli" + setup-checklist preurediti v kompaktno progo (steps),
  widgete gruppirati (prihodki/stranke/termini), prazna stanja z "Dodaj stranko / odpri katalog"
  akcijskimi gumbi, ne suwelout ena-za-drugo.
- **Sidebar**: razdelitev na najprej 2 skupini (A/B), možnost collapse v ikone (desktop), term-key ma
  dejavnosti.
- **Header**: dodati dejavnost badge (npr. `Čebelarstvo`) + vedno vidno ime okolja; preklop med okolji
  v dropdown; mobilna vrstica z enako oznako.
- **Vizualni urejevalnik (F6.4)**: povečati prostor predogleda — nastavljiv levi/seznam panel (skrij),
  desni inspector samo ob izboru sekcije (ni zadniplno velik), device-toggle jasno; večji iframe;
  lahkotna razvpud z mobile/destop.
- **Prazna stanja** povsod z akcijskim pozivom (npr. prazna stranka → "Dodaj prvo stranko").
- **Tabelarni CRUD** enotni: kartice/obrazci dati dosledno spacing; začetnikom z kompaktnejši navodila.
- **Mobilna**: sidebar kot Sheet, header badge dejavnosti, prazne sekcije moat — zmanjšati scrolling.

## 8. Predlog enotnega oblikovalskega sistema

Predlog (dosleden, sodoben, ne pre-natlačen):
- **Tipografija**: en sistem (npr. Inter/system-ui), hierarhija `font-heading`/body z nadzorom
  `text-sm/base`, `tracking` dosledno; minima.
- **Barve**: uporabiti obstoječe semantične token (primary/accent/background/border/muted-foreground)
  iz Tailwind v4; definirati brand-palette + `bg-linear` dosledno; ne veliko div oppril.
- **Razmiki**: sistem `space-y-4/6`, `px-4/6`, `py-16`; kartice `rounded-lg border` enotni.
- **Elementi**: enotni `Button` (ghost/outline/secondary), Badge, Card, Input/Textarea/Select,
  Table; negled na view syloji.
- **Tabele/kartice**: stolpci osenčen, hover states, `sort/copy`, prazna stanja.
- **Obvestila/warnings**: toast (sonner) enoten; inline error z `text-destructive`; banner za
  unfinished-setup (Banner variant).
- **Odzivnost**: rešiti z obstoječimi breakpoints (sm/md/lg), ne tablet-posebne dir styles.
> Navodlo: predelan da izhodnjega dizajn-sistema, ne prepise; poenotiti i18n + termini.

## 9. Prednostni vrstni red izvedbe (suggested F7.x)

- F7.1 – Poprvak **K1** (dashboard ne preusmerja več na onboarding wizard; dejavnost badge v chrome).
- F7.2 – **V1/V2** razdelitev navigacije na skupine A/B (sidebar struktura + workspace/manage).
- F7.3 – Prazna stanja + dashboard widget redesign (V3/V4) + vizureni editor prostor (F6.4 nadgradnja).
- F7.4 – Oblikovni sistem poenotenje (tipografija/barve/razmiki/komponente) — podrobni pregled.
- F7.5 – Mobilna izkušnja + prazni komple lični QA.
> Vsako faze je majhna in samostojno verifljiva; po večina solver s F6.5 stroke.

## 10. Ocena tveganj in datotek, ki bi jih bilo treba spremeniti

- **Tveganja**: visoko — regresija nav/permissions (capability-gating v `sidebar.tsx`),
  dashboard (k1 restrukt), editor layout; srednje — i18n/termini; nizko — čisto UI.
- **Ključne datoteke (predvidene obj. po odobritvi)**:
  - `src/components/admin/sidebar.tsx` (nav skupine, OrgSwitcher, dejavnost badge)
  - `src/components/admin/header.tsx` (badge dejavnosti, switch)
  - `src/app/(admin)/dashboard/page.tsx` (setup checklist / prazma stanja / wizard redirect logika)
  - `src/app/(admin)/dashboard/settings/page.tsx` + `settings-tabs.tsx` (izgled)
  - `src/components/dashboard/modules-*`, `src/lib/modules/catalog.ts` (nav gating helpers)
  - `src/components/site-editor/site-visual-editor.tsx` (F6.4 prostor inspector/panel)
  - `src/app/(admin)/workspaces/*` (prikaz okolij) + `workspace-picker.tsx`
  - `src/lib/i18n/*` (termini A/B skupine)
- Ni migracij sheme, ni baze. Ampak – del datotek je WIP drugih (sidebar/header/dashboard M) →
  **F7 izvedba zahteva skrbno usklajevanje z lastniki WIP-ja**; predlagam lasto, izolirano v F7
  z explicit-s printsi (kot F6.3/5) — ampak vedno ročno.

## 11. Testni načrt po vsaki fazi

- **Regresija**: `npx vitest run` (1325/1325) + `tests/integration/f635` itest + e2e
  (`e2e/visual-editor.spec.ts`).
- **Per-faza browser**: prijava → vsak zaslon (sidebar/header/dashboard/workspaces/editor) →
  capability-gating prailen po dejavnosti (mehanik/frizer/šivilja/čebelar) → prazna stanja → mobile
  390 (no overflow) → org switch (2 org) → invalid/anonim zepred.
- **Merila**: PASS/FAIL po DOKAZANO pravila (browser, ne le koda); vsaka faza neodvisno.

---

## Priloga – razdelitev izvedbe na male varne faze (predlog)

- **F7.1** K1+K2 (chrome dejavnost badge + dashboard ne preusmeri na wizard). Obseg: sidebar/header/
  dashboard page. Majhen.
- **F7.2** Nav skupine A/B (sidebar struktura + terminologija). Obseg: sidebar + i18n.
- **F7.3** Dashboard redesign (prazna stanja, setup proga, widget grupe).
- **F7.4** Vizualni editor prostor (F6.4 nadgradnja: skrivanje seznama, večji preview, inspector
  ob izboru).
- **F7.5** Oblikovni sistem (tipografija/barve/razmiki/komponente) globalno.
- **F7.6** Mobilna + prazni QA celoti; potrditev no-overflow in accessibility-light.
Vsaka faza se po izvedbi preveri z browser E2E + vitest regresijo, nato naslednja.

## Zaporedje zaključka

Ta dokument **Ne spreminja kode**. F7.1 (ali poimenovanje prve napslednje izvedbene faze) se NE začne
brez tvoje odobritve. Ugotovitve so označene (DOKAZANO/DELNO/NI PREVERJENO) — za tiste DELNO je
potrebno dodatno namensko preverbo v izvedbeni fazi (prednost: K1/K2). Ustavljamo se po oddaji tega
dokumenta.