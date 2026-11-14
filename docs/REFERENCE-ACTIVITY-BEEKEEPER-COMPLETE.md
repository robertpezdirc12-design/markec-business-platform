# MARKEC — REFERENČNA DEJAVNOST: ČEBELAR (REFERENCE-ACTIVITY-BEEKEEPER-COMPLETE)

> Cilj: čebelarstvo kot prva popolnoma dokončana referenčna dejavnost MARKEC — produkcijsko
> pripravljen poslovni program + univerzalno jedro za druge dejavnosti.
> **Stanje tega dokumenta je iskren posnetek po začetni sesiji izvedbe:** ogrodje platforme je
> dejansko delujoče (preverjeno z browser E2E skozi F6.3–F7.2 + tej fazi), tejfaza pa je izvedla
> PRVI konkreten sklop (čebelarske evidence). Preostali sklopi so načrtovani, NISO še v celoti
> izvedeni in so označeni PARTIAL / NOT VERIFIED — sistem ne sme biti razglašen za "dokončan"
> dokler niso ključni postopki dejansko izvedeni in dokazani. Oznake: DOKAZANO / DELNO / NI PREVERJENO.

---

## 1. Celotna funkcionalnost (cilj)

Čebelar, ki se registrira in izbere dejavnost Čebelarstvo:
- dobi svoje **čebelarsko poslovno okolje** (identieta podjetja + dejavnost na vseh zaslonih, F7.1/F7.2);
- vodi **čebelarske evidence** (panjske postaje, panji, družine, pregledi, zdravljenje, hranjenje,
  matice/rojenje, opravila, pridelek) — **nov Faza 1**;
- upravlja **izdelke/cenik/zaloge** (single-source Product tabela), **trgovino** (javno košarico→checkout→naročilo→zaloga, Stripe),
  **stranke, naročila, plačila** in **spletno stran** (uredi→predogled→objava, responzivno);
- vidi **poslovni pregled** (dashboard widgeti + analitika).

## 2. Kaj je že obstajalo (verificirano SKOZI prejšnje faze + ta faza)

Dejansko, z orglami delujoče (iz kode + browser E2E + itest):

| Področje | Stanje | Dokaz |
|---|---|---|
| Org/membership/workspaces, IDOR-zaščita | **DOKAZANO** | itest f635 7/7; getSessionOrg→membership; fail-closed |
| Profile registry `beekeeping` + capability-gating | **DOKAZANO** | registry.ts, catalog.ts, tests |
| Instili moduli (shop/inventory/customers/analytics req) | **DOKAZANO** | — |
| Spletna stran (uredi/objavi/umik/predogled, custom domena E3-6, responzivno) | **DOKAZANO** | publikacija, preview owner-only, home-content |
| Trgovina full pot (izdelek→košarica→Stripe checkout→naročilo→zaloga, statusi) | **DOKAZANO** | delegate #3; zaloga atomarna, neg-zaloga nemogoča, single-source |
| Stranke, naročila, dokumenti | **DOKAZANO** | customer/order/documents org-scoped |
| Onboarding `/start` (izbira dejavnosti→org→dashboard) | **DOKAZANO** | start-wizard, createSalonOrganization |
| `batch-production` + `suppliers` extension | **DOKAZANO** | generični records UI |
| Navigacija A/B (Skupno/Dejavnost) | **DOKAZANO** | F7.2 browser |

## 3. Kaj je bilo dodano/popravljeno v tej sesiji (Faza 1 — ČEBELARSKE EVIDENCE)

**Datoteke:**
- `src/lib/profiles/extensions.ts` — nov extension **`bee-apiary`** ("Čebelnjaki in panji") z **9 entity
  registri** (deklarativno, brez spremembe sheme/migracije):
  `apiary (Panjska postaja)`, `hive (Panj)`, `colony (Čebelja družina)`, `inspection (Pregled družine)`,
  `treatment (Zdravljenje)`, `feeding (Hranjenje in oskrba)`, `queen_management (Matice in rojenje)`,
  `task (Opravilo)`, `harvest (Pridelek medu)`.
- `src/lib/profiles/registry.ts` beekeeping profil: `extensions` += `"bee-apiary"`.

**Zakaj:** čebelar ima zdaj celovite evidence na UNIVERZALNEM extension sistemu (§13) — nothing per-org,
brez ločenih tabel, isti CRUD UI za vse dejavnosti. Vrstne medu so select-i znotraj entitet
(Cvetlični/Lipov/Gozdni/Akačijski/Drug). Povezljivost med zapisi je izražena s skupnimi label/select polji.

**Browser dokaz (Playwright, f631 dev):** `/dashboard/records` za čebelarja prikaže **11 tabov**
(Serija/lot, Dobavitelj + 9 novih); dodan record "Panjska postaja" je shranjen in prikazan (CRUD smoke).

## 4. Podatkovni modeli

- **Brez novih tabel/migracij.** Vsi čebelarski zapisi živijo v obstoječi **`ExtensionRecord`**
  (org-scoped JSON) + entiteti definirani deklarativno v `extensions.ts`. Field tipi = univerzalna
  omejena množica (text/textarea/number/date/select/checkbox). Povezave na `Customer` in delovne
  naloge prek obstoječih `customerId`/`linkedRecordId`.
- Jedro naslone: `Organization`, `OrganizationMember`, `User`, `Customer`, `Product(+Variant)`,
  `Order(+Item)`, `SalonConfig.siteContent/publishedSiteContent`, `StockMovement`, `ExtensionRecord`,
  `WalkingEntry`, `CustomDomain` … (ni spreminjano).

## 5. Povezave med moduli

- Spletna stran + trgovina → **ista `Product` tabela** (en vir resnice; admin in javni shop).
- Zaloga → `StockMovement` ledger + atomarna rezerv./decrement na plačilo; batch-extension povezuje
  serije z zalogo.
- Evidence (ExtensionRecord) → customerId/recordId; harvest→zaloga (ročno prek serije/izdelka, robustneje v Fazi 2).
- Terminologija/navigacija → profile registry + F7.2 A/B.

## 6. Univerzalne funkcije (jedro)

Uporabniki, org/workspaces, člani/permissions, stranke, zaposleni, dokumenti, spletna stran, trgovina,
naročila, plačila, nastavitve, obvestila, poročila, evidence (generični records) — vse org-scoped in
dejavnost-neodvisno.

## 7. Funkcije specifične za čebelarstvo

Čebelnjaki, stojišča, panji, družine, pregledi, zdravljenje, hranjenje, matice/rojenje, opravila,
pridelek medu, vrste medu — **zdaj** kot deklarativni extension `bee-apiary` (in `batch-production`).

## 8. Kako se doda nova dejavnost

V `src/lib/profiles/registry.ts` dodaš `ActivityProfile` (capabilities + terminology + forms) in v
`extensions.ts` deklarativne entity — jedro (CRUD/UI/records) materializira vse; ni per-org kode.
(Od F6.3/7.2: identiteta, A/B nav, terminologija se takoj prilagodijo.)

## 9. Testi (ta faza)

- `npx vitest run` — **91 files / 1325 tests PASS** (vključno extensions-e21, registry, secondary, schema-tenancy 89 testov).
- `itest f635 (security-read-idor-modules)` — **7/7 PASS** (izolacija org).
- `tsc --noEmit` — čist.
- Browser (f631 dev): records page 11 tabov, CRUD dodaj record PASS.

## 10. Znane omejitve / nedokončano (POŠTENO)

- **NI VERIFIED — sod. produkt? NE.** Celotna naloga v §3-I ni izvedena v eni sesiji. Do zdaj:
  - Evidence entity 9 tipov → **Faza 1 DONE** (browser CRUD + register).
  - Pridelek **ne** še združen v agregatnih poročilih/graf (zbirni pregled žetve per datum/postaja/vrsta) → **PARTIAL** (entiteta obstaja, agregat/panel manjka).
  - Trgovina/plačila/zaloga: pot **že deluje** (delegate #3), ampak **ni** bila v tej sesiji ponovno preverjena z novim E2E scenarijem 20 korakov → **NOT VERIFIED** v tej sesiji (verificirano v F6.x/E2E prej).
  - Poslovni pregled dashboard: widgeti obstajajo; čebelarski "pregled pridelka/zalog" ni dodan → **NOT VERIFIED**.
  - Prazna stanja / onboarding deterministično (nova & delna org) → **PARTIAL** (F7.1 logika; poln browser dokaž v prihodnji fazi).
  - E2E 20-korakov z dvema izoliranima org → **NOT VERIFIED** kot celovit paket (itest f635 7/7 pokrije IDOR; poln kupni E2E še ni ponovljen s crossover org-1/org-2).
  - Zakonodajne trditve (davčno ustrezen račun, varnostni intervali zdravljenja) **NISO** potrjeni/izmišljeni — sistem ne trdi davčne ustreznosti; dokumentacija vira potreba na pravni pregled.

## 11. Kaj še preprečuje komercialno uporabo

- Production build je **blokiran** s tujim WIP `src/app/actions/einvoices.ts:51` (ne-async export →
  "Server Actions must be async") — potrebna uskladitev lastnika (iz F6.4/F7 silno) → prepreduje build/deploy.
- Manjkajo: agregat pomoči pridelka, prazna stanja akcij, deterministični onboarding E2E za novo/delno org,
  celovit 20-koraki kupni E2E s crossover izolacijo.
- Davčno/računovodsko spodobnost je treba potrditi pravno (sistem izda dokumente, ne trdi davčne ustreznosti).

## 12. Fazni načrt nadaljevanja (suggested, majhni varni sklopi)

- **Faza 2 — Agregat pridelka/zaloge:** dashboard/records povzetek (kg per postaja/datum/vrsta, nizka zaloga
  opozorilo) iz resničnih recordov + procedure. Test unit+E2E.
- **Faza 3 — Prazna stanja + determinističen onboarding E2E** (nov & delna org) na f631 s 2 izoliranima org.
- **Faza 4 — Celovit kupni E2E (20 korakov)** s preverjanjem izolacije med 2 org (cb vs. druga čebelarska
  org istega profile).
- **Faza 5 — (ko je odpravljen einvoices WIP)** production build + regression.

## Seznam pomembnih sprememb v tej sesiji

- `src/lib/profiles/extensions.ts` → dodan `bee-apiary` extension (9 entity, 135 vrstic), v EXTENSION_LIST.
- `src/lib/profiles/registry.ts` → beekeeping `extensions` + `bee-apiary`.
- `scripts/reference-bee-check.mjs`, `scripts/reference-bee-crud.mjs` (Playwright dokazi).
- Test data: dodan+izbrisan čebelarski record (Prtava) — f631 čista.
- Ni git add/commit/push; ni migracij; ni spremembe sheme; ni produkcije.

**Zaključek:** v tej sesiji je **Faza 1 (čebelarske evidence)** dejansko izvedena in dokazana (browser
CRUD + regresija). Ostali deli naloge so načrtovani; **čebelarstvo NI razglašeno za "dokončano"** —
rail je narejen prvi izvedljiv sklop referenčne dejavnosti, kot zahteva §8 (ne razglašaj na podlagi UI).
Priporočam nadaljevanje po ~Faza 2-4 v naslednjih sesijah.