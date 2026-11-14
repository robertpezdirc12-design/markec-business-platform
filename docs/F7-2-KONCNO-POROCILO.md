# MARKEC — F7.2 KONČNO POROČILO (Prenova navigacije + ločitev poslovnih funkcij)

> Po `docs/F7-0-UI-UX-CELOVIT-AUDIT.md` (V1/V2) + `docs/F7-1-KONCNO-POROCILO.md` (odprta težava preklopa).
> Izvedba na izolirani `markec_f631_test` (dev 3013; Playwright chromium + Chrome DevTools MCP).
> NI produkcije/`markec_dev`/migracij/Vercela; `einvoices.ts:51` (tuji WIP) NEDOTAKNJEN; ni git add/commit/push.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED. Oznake: DOKAZANO / DELNO / NI PREVERJENO.

---

## 1. Dejanske spremenjene datoteke

| Datoteka | Sprememba |
|---|---|
| `src/components/admin/sidebar.tsx` | **(glavno)** NavItem dobi `group: "common" \| "activity"`. `navigation` vzdržuje 22 postavk, razdeljenih na skupino A (Skupne: dashboard, analytics, customers, marketing, documents, einvoices, staff, roles, settings) in skupino B (Dejavnost: appointments, waitlist, walkIn, services, products, categories, packages, promotions, workOrders, shopOrders, forms, records, projects). `SidebarNav` nadomesti flat `visible.map` z ločenim renderjem dveh skupin pod naslovoma **"SKUPNO"** in **"DEJAVNOST"**; gating (capability/extension/permission) preseljen v `itemVisible()` in **nespremenjen**. OrgSwitcher `pick()` dobil `setTimeout(() => router.refresh(), 0)` po `router.push` (reši stale-UI). |
| `tests/waitlist-90.test.ts` | Nav-assert pretvorjen iz exact-stringa v regex (tolerira dodan `group: "activity"`); namen testa (capability/permission) ohranjen. |
| `scripts/f72-nav-check.mjs` (nov) | Playwright: A/B nav check za 4 dejavnosti + mobile 390 no-overflow. |
| `scripts/f72-links-check.mjs` (nov) | Playwright: sanity dejavnostnih route (work-orders, records). |

Spremembe v `sidebar.tsx` so bile **diskretne (edit_file, ne prepis cele datoteke)**; tuji WIP v
datoteki (od drugih agentov) ni prebrisan. `einvoices.ts:51` ni popravljen (prepoved).

## 2. Kako je razdeljena navigacija (A / B)

**Skupne poslovne funkcije (A)** — stalno, neodvisno od aktivne dejavnosti:
`Nadzorna plošča · Analitika · Stranke · Marketing · Dokumenti · E-računi · Osebje · Vloge · Nastavitve`.
Vse so capability/permission-gated (npr. Analitika → capability analytics; Dokumenti → documents; Vloge → admin-only).

**Funkcije aktivne dejavnosti (B)** — dinamične, po aktivnem okolju (capability/extensions/profile):
`Termini/Čakalna lista/Walk-in · Storitve · Izdelki · Kategorije · Paketi · Popusti · Delovni nalogi · Spletna naročila · Obrazci · Evidence · Projekti`.
Ne-ekzistujoči za dejavnost se ne prikažejo (capability disabled → item odsoten).

Uporabljen obstoječi sistem (capabilities + profile registry + activity navigation) — **ni vzporednega sistema**.

## 3. Konkretni primeri za štiri dejavnosti (browser, DOKAZANO)

| Dejavnost | Skupne (A, vse) | Dejavnost (B) videne | (B) skrite/PRAVILNO | Rezultat |
|---|---|---|---|---|
| **Mehanik** | Nadzorna plošča, Analitika, Stranke, Marketing, Dokumenti, E-računi, Osebje, Vloge, Nastavitve | Termini servisa, Čakalna lista, Walk-in, Storitve, Izdelki, Kategorije, Paketi, Popusti, Delovni nalogi, Spletna naročila, Obrazci, Evidence | – | **PASS** |
| **Čebelar** | (vse razen Osebje — staff disabled; Vloge admin) | Walk-in, Izdelki, Kategorije, Paketi, Popusti, Spletna naročila, Obrazci, Evidence | Termini/Storitve/Delovni nalogi/Projekti ODSOTNI | **PASS** |
| **Frizer** | (vse; Osebje) | Termini, Čakalna lista, Walk-in, Storitve, Izdelki, Kategorije, Paketi, Popusti, Spletna naročila, Obrazci, Evidence | – (Termini prisotni, čebelarskih/−) | **PASS** |
| **Šivilja** | (vse; Osebje) | Walk-in, Storitve, Izdelki, Kategorije, Paketi, Popusti, Delovni naročila, Spletna naročila, Obrazci, Evidence, **Projekti** | – | **PASS** |

Vsaka dejavnost vidi samo lastne B-funkcije; skupne ostajajo skupne (DOKAZANO — Playwright navLinks izpisi).

## 4. Preklop okolja — odprta težava F7.1 (S5/S6) — PASS (rešena)

- Razlog stale UI: `revalidatePath(layout)` posodobi server data, ampak `router.push` (client nav) ne prerenderira layouta sveže; ročni reload je bil pred tem potreben.
- **Popravek:** v `OrgSwitcher.pick()` dodan `setTimeout(() => router.refresh(), 0)` (deferred v naslednjem makrokoraku, ne synchronous — kar je cancelalo push).
- Browser (preklop čebelar → frizer org s testnim 2. članstvom): po kliku **takoj** (brez reload) → sidebar identity `Druga dejavnost Test · Frizerski salon`, dejavnost B → `Termini · Čakalna lista · Osebje` (čebelarska nav zamenjana) → **PASS**.
- Testna 2. org + membership **vrnjeni/pobrisani** po dokazu (f631 čista).

## 5. Testi / browser E2E rezultati

| Scenarij | Rezultat | Dokaz |
|---|---|---|
| S1 mehanik → skupne + le mehanične | **PASS** | Playwright navLinks |
| S2 čebelar → skupne + le čebelarske | **PASS** | navLinks (brez Termini/Delovni nalogi/Osebje) |
| S3 frizer → skupne + frizerske | **PASS** | navLinks (Termini/Storitve) |
| S4 šivilja → skupne + šiviljske | **PASS** | navLinks (Delovna naročila/Projekti) |
| S5 preklop med 2 dejavnostmi → nav se spremeni | **PASS** | browser (takoj, dev 3013) |
| S6 po preklopu takoj identiteta (ime+dejavnost+nav) | **PASS** | browser „živ prehod", brez reload |
| S7 kdor nima dovoljenja ne vidi | **PASS** (koda gating) + itest | `itemVisible()` permission filter; itest f635 7/7 |
| S8 izklopljen modul ni viden kot delujoč | **PASS** (koda gating) | capability disabled → item odsoten (npr. staff čebelarja) |
| S9 mobilna navigacija 390 | **PASS** | Playwright 390: sidebar Sheet vsebuje A/B skupine |
| S10 ni horizontalnega preliva | **PASS** | `mobile390Overflow:false` v vseh 4 |
| S11 obstoječe povezave delujejo | **PASS** | /dashboard/work-orders in /dashboard/records → 200 render |
| S12 nova/delno nastavljena org potek | **PARTIAL** | to privlači iz F7.1 K1 (guided/prob. pogoj); browser čist preklop na tak org otežen zaradi session-state po test cleanup → glej odprto |

## 6. Varnost / izolacija

- Aktivna org izključno iz seje/membership (`getSessionOrg` → OrganizationMember); client `orgId` ni vir zaupanja (nespremenjeno).
- Capability-gating, permissions, OrganizationMember pravice, cross-org IDOR zaščita **nespremenjena** — itest f635 **7/7 PASS**.
- Brez podatkovnega modela/migracij. Brez produkciji.

## 7. Regresija

- `vitest run` — **91 datotek / 1325 testov PASS** (popravljen waitlist-90 nav-assert na regex).
- `vitest.itest.config.ts tests/integration/f635` — **7/7 PASS**.
- `tsc --noEmit` — brez TS napak v spremenjenih datotekah.
- Selecktivni: waitlist 12, walk-in 14, site-layout 10, modules-f2 16 → PASS.

## 8. Odprte težave / omejitve

- **Tuji WIP `einvoices.ts:51`** (ne-async `formatLabel` → production build pade). Nedotaknjen; predlog (iz F6.4/F7.1): prenesti label funkcijo iz server-action datoteke ali narediti async. To ostaja odprto za uskladitev z lastnikom.
- **S12** (nova/delna org potek): browser-prover v tej seji delno oviran zaradi session/cleanup stanja; logika (guidedEntry v F7.1) deluje in je bila delno browser potrjena — oznaka **PARTIAL (DELNO)**; za polnega priporočam namensko zretanje onbo welcome determinizemsko v F7.3.
- **Minor:** po dodanih testnih org v seji breathing, browser session je lahko ostal s starim org id v JWT (ni DB residual); testna 2. org + membership pobrisana.

## 9. Statusni pregled

| Področje | Status |
|---|---|
| Ločitev navigacije A/B (Skupne / Dejavnost) | **PASS** (browser 4 dejavnosti + koda) |
| Skupine vizualno ločene, naslovi razumljivi | **PASS** (SKUPNO / DEJAVNOST) |
| Aktivna dejavnost = funkcionalno (ne le oznaka) | **PASS** (capability-gated B) |
| Preklop okolja — takoj osveženo | **PASS** (S5/S6 browser) |
| Mobilna navigacija 390, no-overflow | **PASS** |
| Pravice + izolacija ohranjene | **PASS** (itest f635 7/7) |
| Nova / delna org potek | **PARTIAL** (S12) |

## 10. Priporočilo pred F7.3

1. Odprava `einvoices.ts:51` (lastnik WIP) → production build zelen (blokira vse).
2. V F7.3: determinističen browser onboarding (nova in delna org) s svežim čistim filom org, da se S12 zaključi kot PASS, plus prazna stanja / vizalni editor prostor.

**F7.3 se ne začne brez NOVE izrecne odobritve. Ustavljam se po tem poročilu.**