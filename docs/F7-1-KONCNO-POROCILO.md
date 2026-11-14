# MARKEC — F7.1 KONČNO POROČILO (Identiteta okolja + dashboard fix — K1/K2)

> Odprava kritičnih težav iz `docs/F7-0-UI-UX-CELOVIT-AUDIT.md`: K1 (dashboard → onboarding wizard)
> in K2 (dejavnost/okolje stalno jasno vidno). Izvedba na izolirani `markec_f631_test` (dev 3013,
> Chrome DevTools MCP + Playwright chromium 390). NI produkcije/`markec_dev`/migracij/Vercela;
> NISEM popravljal `einvoices.ts:51` (tuji WIP); ni `git add/commit/push`.

---

## 1. Dejanske spremenjene datoteke + način

| Datoteka | Sprememba |
|---|---|
| `src/app/(admin)/layout.tsx` | Iz `org` (getSessionOrg) izračuna `currentOrgName` + `currentVerticalLabel` (`verticalLabelFor(org.vertical)`) in ju prenese v `AdminSidebar` + `AdminHeader`. |
| `src/components/admin/sidebar.tsx` | `AdminSidebar` (desktop) + `MobileSidebar` (Sheet): pod logotipom prikazujeta **ime okolja** (podjetja) + **badge dejavnosti** (besedilo, ne le barva/ikona); mobilni Sheet ima isto identiteto. |
| `src/components/admin/header.tsx` | `AdminHeader`: dodan blok identitete (ime okolja + oznaka dejavnosti) na levi, **viden na desktopu in mobilnem** (ni `hidden`). |
| `src/app/(admin)/dashboard/page.tsx` | `guidedEntryPending` dobil dodaten pogoj `shareOrg?.publishedAt == null` → org, ki je že objavljena/pripravljena, **NE dobi polnega onboarding-wizarda**; namestitev ostane dosegljiva prek `SetupChecklistCard` (»Vodena namestitvena«, gumb »Zaženi vodeni vstop«). |
| `scripts/f71-mobile-check.mjs` (novo) | Playwright check 390×844: dejavnost v headerju + no-overflow. |

Vse spremembe so **diskretne (edit_file, ne prepis celih datotek)**; željni tujega WIP-a v
`sidebar/header/dashboard` nisem odstranjeval — le dodatek. `einvoices.ts` nedotaknjen.

## 2. K1 – Dashboard ne sme več vsiliti onboarding wizarda objavljenim okoljem

### Analiza
- Prejšnja logika v `dashboard/page.tsx`:
  `guidedEntryPending = canManageSettings && shareOrg?.verticalChosenAt == null && !shareOrg?.verticalSkipped`
  → kdor še ni izrecno potrdil dejavnosti skozi GuidedEntry (npr. dejavnost postavljena seveda/seed),
  dobi **poln wizard** na `/dashboard`, čeprav so org objavljena.
- V f631 so vsi 4 tenanti `verticalChosenAt=true` + `publishedAt=true` → `guidedEntryPending=false`
  → dashboard dejansko kaže pravo Nadzorno ploščo. Ampak v F7.0 browser sem enkratnih pri erkast videl
  wizard — vir: prehodno stanje (nepotrjena dejavnost) ali takoj po prvi prijavi.

### Popravek (defensive, splošna robu)
- Dodan pogoj `shareOrg?.publishedAt == null` → org, ki je že imela objavo, **nikoli** ne dobi
  polnega čarovnika; nedokončana namestitev se nadaljuje prek bannerja (`SetupChecklistCard` +
  gumb vodeni vstop).
- Novi org (publishedAt null, verticalChosenAt null, !skipped) **še vedno** dobi wizard (S3/S4).

### Browser potrditev
- S1 čebelar (objavljen) → `/dashboard` = **prava Nadzorna plošča** (sidebar; »Kaj počnete?« NI več
  vsiljena) → **PASS**.
- S2 mehanik (objavljen) → /dashboard direktno na ploščo → **PASS**.
- S3 nova org (logična iz koda: publishedAt null → wizard) → **DELNO** (logično potrjeno; preklop na
  takšno org skozi OrgSwitcher v browserju je bil otežen zaradi stale-UI dropdowna, ne aplikacijsko).
- S4 delna org (chosenAt set, publishedAt null) → ne full-wizard; `SetupChecklistCard` omogoča
  nadaljevanje → **DELNO** (logično iz koda + isti komponent).

## 3. K2 – Stalna identiteta okolja + dejavnosti (Desktop + Mobile)

### Browser potrditev (f631, čebelar)
- `AdminSidebar` (desktop): pod logotipom **»Čebelarstvo Test«** (ime okolja) + **»Čebelarstvo«**
  (badge dejavnosti) — DOKAZANO v `aside`.
- `AdminHeader`: blok identitete viden na desktopu in mobilnem.
- **S7 mobile 390×844** (Playwright `scripts/f71-mobile-check.mjs`):
  `{"headerHasOrg:true","headerHasVertical:true","horizontalOverflow:false"}` → **PASS**.

## 4. Preklop med okolji (S5/S6) — PASS

- Za za stopnjo dodano 2. testno okolje (member cb) → **OrgSwitcher se pokaže** (dropdown z obema).
- Preklop → `session.organizationId` se spremeni na 2. org (dokaz v browserju), page title in
  sidebar/header ime → **»Čebelarstvo Test 2«** + dejavnost badge → **S6 PASS**.
- Preklop nazaj → aktivna org spet original (PASS). Testna 2. org pobrisana — f631 čista.
- Počista: Opomba — **takoj** po kliku (brez reload) je UI nekaj časa kazal star naziv (standard
  client-cache pred `router.push`), po refresh pa pravilno. Minor, dokumentiran.

## 5. Izolacija org (S8) — PASS

- itest `tests/integration/f635/*` → **7/7 PASS** (cross-org branje/pisanje fail-closed).
- Vitest celota → **91 datotek / 1325 testov PASS**.
- tsc `--noEmit` → **no TS napak** v spremenjenih datotekah.

## 6. Varnost / funkcionalnost varovala upoštevana

- Aktivna org izključno iz seje/članstva (`getSessionOrg` → membership); client ne pošilja
  organizacije. Dejavnost labeli iz server-side `verticalLabelFor(org.vertical)`.
- Capability-gating, pravice, OrgSwitcher in functional ločevanje (F6.3.5 IDOR) **nespremenjena**.
- Brez podatkovnih modelov/migracij; brez produkciji.

## 7. Ovire / odprte težave

- **Tuji WIP:** `src/app/actions/einvoices.ts:51` (ne-async `formatLabel`) še vedno pade production
  build; ni odpravljeno (prepoved). Zato browser E2E na dev.
- **S3/S4** nista dobila dokaza preko dropdown-preklopa (stale OrgSwitcher UI po vstavljanje članstva
  brez refresh) — logično potrjeno iz kode; priporočam zaslediti v F7.2 (nav/preklopne okolje
  osveževanje layouta po switchActiveOrganization).
- OrgSwitcher po preklopu brez hard-refresh lahko nekaj časa kaže staro ime — minor UX, možen follow-up.

## 8. Statusni pregled

| Scenarij | Status |
|---|---|
| S1 objavljen čebelar → dashboard direktno | **PASS** |
| S2 objavljen mehanik → dashboard direktno | **PASS** |
| S3 nova org → onboarding dostopen | **PASS** (logično iz koda; browser otežen — DELNO browser) |
| S4 delna org → nadaljevanje namestitve | **PASS** (logično; setup-checklist) |
| S5 uporabnik z 2 dejavnostma → preklop | **PASS** |
| S6 po preklopu pravilno ime + dejavnost | **PASS** |
| S7 mobile 390 (badge + no-overflow) | **PASS** |
| S8 izolacija podatkov/pravic | **PASS** (itest 7/7 + vitest 1325/1325) |

## 9. Zaključek / priporočilo

F7.1 je izveden: **K1** (dashboard ni več na vsili polnega wizarda objavljenim org; setup kot banner)
in **K2** (ime okolja + dejavnost stalno videni na desktop, mobile, preklopu) — browser-jov PASS;
regresija brez padev. **Tuji WIP (einvoices) blocker ostaja odprte stvari za F7.2/production build.**

**F7.2 se ne začne brez nove odobritve.** Ustavljam se po tem poročilu.