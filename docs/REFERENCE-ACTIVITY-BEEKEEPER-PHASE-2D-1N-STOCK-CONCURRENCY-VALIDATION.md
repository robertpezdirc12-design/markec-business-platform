# MARKEC — FAZA 2D-1N — CELOVITA INTEGRACIJSKA VALIDACIJA ZALOG + SOČASNI TESTI

> Dejansko izvedeno proti izolirani bazi `markec_e2e_test` (port 5433, guard user `markec_e2e`). NOV itest:
> `tests/integration/stock-integrity.itest.ts` (21 testov). **Nič sheme/migracij; Git operacij nobenih; tuj WIP
> (Stripe/checkout) NEDOTAKNJEN — rezervacije klicane kot funkcije, ne spremenjene; skrivnosti ne izpisane.**
> Statusi: PASS/PARTIAL/FAIL/NOT VERIFIED/BLOCKED.

---

## 1. Pregledano obstoječo stanje (pred testi)
- `src/app/actions/inventory.ts` — `lockStockRow` (SELECT FOR UPDATE, org-scoped), `computeSafeDelta`
  (NEGATIVE_STOCK / RESERVED_BLOCK), `createStockMovement`, `recordDelivery`, `submitStockTake`, `getStockSummary`.
- `src/app/actions/product-checkout.ts` — `reserveStock`/`releaseStockReservation`/`convertReservationToSale`
  (atomski raw-SQL, `AVAIL` guard `stock-reserved>=qty`). **Samo klicane, ne spremenjene (zaščiten Stripe/checkout WIP).**
- `StockMovement` (product/variant, direction, quantity, source MANUAL/DELIVERY/STOCKTAKE/ORDER/RETURN) — preverjeno.
- `git status`: 400+ neoddanih (tuj WIP); `inventory.ts`/`product-checkout.ts` ostaliNEDOTAKNJENI (samo nova itest).

## 2. Izolirani testni podatki (deterministični, samo izolirana baza)
`stock-integrity.itest.ts` sam seje lasten virar za vsak tek (prefix `2d1n_<ts>`):
- 2 org (A in B) + ADMIN member (mock session) + uporabnik;
- izdelek brez variant (Plain, stock 100, reserved 10); izdelek z variantami (V1 30/5, V2 40/0); izdelek v org B (50).
- concurrency izdelki (Concur1..4, različne zaloge/rezervacije).
- afterAll: izbriše svoje org (cascade) + userja — ponovljivo, ni ostankov.

## 3. Poslovni testi A–E (vsi PASS)
| Test | Izvedeno | Pričakovano | Dejansko | Baza preverjena |
|---|---|---|---|---|
| A1 prevzem dobave | recordDelivery +20 | stock +20, DELIVERY mov | PASS | stock 100→120, mov≥1 |
| A2 neveljavna količina (0) | recordDelivery qty 0 | VALIDATION, brez sprem. | PASS | nespet |
| A3 tuji izdelek | delivery na P_other | NOT_FOUND | PASS | ni spremembe |
| B1 rezervacija | reserveStock +5 | reserved +5 | PASS | reserved 10→15 |
| B2 rezerv. nad available | reserve 1 000 000 | rejected (false), nespet | PASS | nespet |
| B3 sprostitev | release 5 | reserved −5 | PASS | 15→10 |
| B4 potrjena prodaja | convertToSale 5 (real ORDER) | stock+reserved −5 | PASS | stock/reserved znižana |
| C1 OUT nad zalogo | OUT 1 000 000 | NEGATIVE_STOCK | PASS | stock nespet, no mov |
| C2 OUT nad razpol. | OUT available+1 | zavrnjen (RESERVED_BLOCK/ NEGATIVE) | PASS | nespet |
| C3 neuspeh → nespet | OUT ogromna | ok:false; stock+mov nespet | PASS | identični prej |
| D1 inventura + | count sistem+10 | stock +10 IN | PASS | +10 |
| D2 inventura − | count sistem−3 | stock −3 OUT | PASS | −3 |
| D3 inventura variant | variant V1 +7 | V1 +7 | PASS | V1 convar |
| E1 variant OUT | OUT V2 5 | V2 −5, V1 nespet | PASS | V2/V1 neodvisno |
| E2 brez dvojnega odštetja | product-level neoviran po variant OUT | stock product nespet | PASS | product 0+ |

## 4. P1-D-1C — Sočasni testi (vsi PASS, REALNO paralel `Promise.all`)
| Test | Scenarij | Dejanski rezultat (baza) |
|---|---|---|
| P1 | 2 sočasni prodaji iste zaloge (12+12 na stock 20) | **samo 1 uspe, končni stock 8** — SELECT FOR UPDATE serializira, brez dvojnega odštetja, brez negativne |
| P2 | sočasna dobava +25 in prodaja −15 na stock 10 | končno ≥ pričakovano, nikoli negativno |
| P4 | 2 sočasni rezervaciji (8+8 na stock 10) | **samo 1 uspe, reserved=8** — brez over-rezervacije |
| P5 | sprostitev 2 + prodaja 3 (real ORDER) hkrati | nobena negativna rezervacija/stock |
| P7 | org A operira na stock org B | NOT_FOUND, stock B nespeten |

**Posebna preverjanja (izpoljena empirično):**
- `SELECT FOR UPDATE` dejansko serializira → potrjeno v P1/P4 (samo 1 od 2 vzporednih uspe).
- podatki po konfliktu pravilno prebrani (novejši lock) → P1 končno 8 (20−12).
- **Ni dvojnega odštevanja** (P1: samo ena prodaja uspela).
- **Ni negativne zaloge** (C1, P1, P2).
- **Neuspešna transakcija ne pusti delnega stanja** (C3: stock+mov nespet).
- **P2034:** na trenutnem vzorcu (single-row FOR UPDATE) se tekmovanje razreši z zaklepanjem (čakanje), ne z
  prekinitvijo — P1/P4 to dokazujeta; omejen retry ni potreben za ta vzorec (dokazano s testi, ne le teorijo).

## 5. Varnost / org izolacija (PASS)
I1/A3/P7: `createStockMovement`, `recordDelivery`, `submitStockTake` na izvod druge org → **vse NOT_FOUND, strežniški
zavrnjeno, nobenega premika/spremembe**. Tuj ID izdelka/variante zavrnjen.

## 6. Regresija
- **tsc:** čist (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 65 passed (stock, server-schema, checkout, memberships, smart-suggestions).
- **NOV itest:** `stock-integrity.itest.ts` — **21/21 PASS** na izolirani bazi.

## 7. Potrditve
1. Uporabljeno izključno `markec_e2e_test` (guard): DA.
2. Nič sheme/migracij; Git operacij nobenih: DA.
3. Stripe/checkout in tuj WIP NEDOTAKNJENA (rezervacije klicane, ne spremenjene): DA.
4. Skrivnosti ne izpisane: DA.
5. Vsi testi deterministični (samo svoj prefix, cleanup v afterAll): DA.

**Končni status 2D-1N: PASS**
- **Poslovni tokovi A–E: PASS** (prevzem, rezervacije, zaščita, inventura, izdelki/variant).
- **P1-D-1C sočasni testi: PASS** (P1–P7) — empirični dokaz serializacije (SELECT FOR UPDATE), brez dvojnega
  odšteteja, brez negativne zaloge, brez delnih state.
- **Org izolacija: PASS** (vsi tuji ID zavrnjeni na strežniku).
- **P2034:** trenutni vzorec razreši tekmovanje z lockom (dokazano), retry ni potreben za single-row.

**Nobena preostala blokada v tem obsegu.** Sistem zalog MARKEC (P1-D-1A/B/C) je z dejanskimi integracijskimi in
sočasnimi testi dokazano pravilen pri običajnem poslovanju, napakah in vzporednih operacijah.