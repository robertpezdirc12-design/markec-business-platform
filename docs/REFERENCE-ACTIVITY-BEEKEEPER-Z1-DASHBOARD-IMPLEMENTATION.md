# MARKEC — Z1 — ČEBELARSKA NADZORNA PLOŠČA (IMPLEMENTACIJA)

> **Status: PASS (implementacija + tsc + unit). Browser/mobilni: NOT VERIFIED** (zahteva prijavljeno sejo + podatke DB).

## Kaj je implementirano
Nova **živa čebelarska nadzorna plošča**, dostopna na `/dashboard/apiculture`, prikazuje podatke iz resničnih
virov (brez izmišljenih statistik):

- **Nov server action:** `src/app/actions/apiculture.ts` — `getApicultureOverview()`:
  - števci enot `ExtensionRecord` (bee-apiary) po `entityKey`: apiary, hive, colony, inspection, treatment,
    feeding, queen_management, task, harvest;
  - zadnji pregledi (inspection, 5, newest);
  - odprta opravila/zdravljenja/hranjenje (task/treatment/feeding, 8);
  - izdelki z `stockQuantity`/`reservedQuantity` → `available = max(0, stock − reserved)`;
  - nizka zaloga (≤ 5) in število naročil zadnjih 14 dni;
  - **org-scoped** (`requirePermissionOrg("workorders.manage")`), ni IDOR.
- **Nova stran:** `src/app/(admin)/dashboard/apiculture/page.tsx`:
  - ograja na razširitvi `bee-apiary` (`getSessionEffectiveProfile().extensions.includes("bee-apiary")`); druge
    profile vidi obvestilo, ne podatkov;
  - kartice števcev (postaje, panji, družine, pregledi, pridelki, zdravljenja, hranjenje, opravila);
  - Pregledi + Opravila/roki (prazna stanja prikazana);
  - tabela izdelkov in zaloge (zaloga / rezervirano / razpoložljivo), opozorilo nizke zaloge, naročila;
  - prehodi na Evidence (/dashboard/records), Izdelki (/dashboard/products), Inventura
    (/dashboard/products/stocktake) — vse **delujoče obstoječe poti** (brez mrtvih linkov).

## Spremenjene datoteke
| Datoteka | Status |
|---|---|
| `src/app/actions/apiculture.ts` | novo |
| `src/app/(admin)/dashboard/apiculture/page.tsx` | novo |

## Preverjanje
- **tsc (`--noEmit`):** brez napak v novih datotekah.
- **Unit (`vitest`):** 46/46 PASS (brez regresije).
- **Browser / mobilni (390×844 itd.):** **NOT VERIFIED** — `/dashboard/apiculture` zahteva prijavljeno sejo in
  podatke v DB; v tem okolju ni dostopnega prijavljenega brskalnika/podatkov.

## Znane omejitve
- Čebelarske "proizvodne serije" niso posebej prikazane (model jih nima kot ločene DB, so ExtensionRecord; kadar
  so podatki prisotni, jih števec harvest/batch prek ExtensionRecord prisotno zajema na Evidence strani).
- Mobilni izgled ni vizualno preverjen; komponente uporabljajo obstoječe responsive kartice/tabele (`overflow-x-auto`).

## Potrditve
Nič sheme/migracij/baze; Git operacij nobenih; tuj WIP in `einvoices.ts` nedotaknjeni; `markec_dev`/produkcija
nedotaknjena. **Končni status: PASS (impl+tsc+unit), NOT VERIFIED (browser/mobilni).**