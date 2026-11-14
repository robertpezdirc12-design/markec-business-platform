# MARKEC — P1-D-1C — ZAKLEPANJE ZALOGOVNIH VRSTIC (IMPLEMENTACIJA)

> Skupino x. **Status: PASS** (implementirano, tsc/unit čisto; DB-integration NOT VERIFIED).

## Kaj je implementirano
V `src/app/actions/inventory.ts` je dodan enoten mehanizem zaklepanja zalogovnih vrstic za sočasne operacije:

1. **`lockStockRow(tx, orgId, productId, variantId?)`** — `SELECT ... FOR UPDATE` na avtoritativni vrstici
   (ProductVariant, če je izbrana varianta; sicer Product), z **org pripadnostjo v istem SELECT** (prepreči IDOR).
   Vrača svež `stockQuantity`/`reservedQuantity`.
2. **`computeSafeDelta(...)`** — na svežem stanju izračuna delta z **obema guard-oma**: negativna zaloga
   (`computeStockDelta`) in **`stock ≥ reserved`** za OUT premike (RESERVED_BLOCK).
3. **Refaktor** vseh treh operacij, da berejo sveže stanje **pod zaklepom** (ne zaupljivano izven tx-a):
   - `createStockMovement` — lock v txn, re-read, safe delta, update + ledger, napake popisane (NEGATIVE_STOCK /
     RESERVED_BLOCK / NOT_FOUND / NOT_TRACKED / GENERIC);
   - `recordDelivery` — lock per line, IN safe delta, update + ledger;
   - `submitStockTake` — lock per line, delta = counted − fresh, safe delta, update + ledger (variant-aware).

## Ključne spremembe
| Datoteka | Sprememba |
|---|---|
| `src/app/actions/inventory.ts` | +`lockStockRow`, +`computeSafeDelta`, refaktor txn treh funkcij; +`RESERVED_BLOCK` v `MovementErrorCode` |

## Zaklepanje in vrstni red
- Brez variant → zaklepanje `Product`; z variantami → zaklepanje `ProductVariant` (nikoli oboje).
- Org pripadnost v WHERE zaklepa → izolacija organizacij.
- Vrstni red: ena vrstica na operacijo (Product ali ProductVariant); checkout-CAS poti (reserve/release/convert/
  applyOrder z P1-D-1A) so že atomski `UPDATE ... WHERE` — niso spremenjeni (po navodilu le, če analiza pokaže
  potrebo — analiza ne kaže; so že brez lost-update).

## Testi
- **tsc (`--noEmit`):** v `inventory.ts`/povezanih NI napake.
- **Unit (`vitest`):** 46/46 PASS (stock 15, server-schema 9, entry-checkout 22) — brez regresije.
- **DB-integration (sočasne prodaje, dobava+prodaja, inventuri, ista/razl. varianta, negativna zaloga, negativna
  rezervirana, rollback, deadlock/retry, org izolacija):** **NOT VERIFIED** — zahteva izoliran test DB, ki v tem
  okolju ni na voljo; ne izvajam operacij nad `markec_dev`/produkcijo.

## Znane omejitve
- Retry ob P2034 (deadlock/serialization) **ni dodan** (zahteva poseben handler); zaklepanje prepreči lost-update,
  a so konflikti možen vir. To je v načrtu P1-D-1C-prihodnje (retry max 3). — PARTIAL.
- DB-integration je NOT VERIFIED.

## Potrditve
- Spremenjena le `inventory.ts` (+ ta dokument): DA.
- Ni sheme/migracij/baze in Git operacij: DA.
- Tuj WIP in `einvoices.ts` nedotaknjeni: DA.
- `markec_dev`/produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Končni status: PASS** (implementacija + tsc + unit); **NOT VERIFIED** (DB-integration/concurrency). Nadaljujem z
Z1 (nadzorna plošča) in N1 (navigacija).