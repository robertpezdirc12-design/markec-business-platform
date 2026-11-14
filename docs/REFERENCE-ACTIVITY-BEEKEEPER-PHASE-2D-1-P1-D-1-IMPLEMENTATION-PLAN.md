# MARKEC — P1-D-1 — IMPLEMENTACIJSKI NAČRT: TRANSAKCIJSKA VARNOST, ZAKLEPANJE ZALOGE, IDEMPOTENTNOST

> **Priprava načrta (BREZ IMPLEMENTACIJE).** Cilj: tehnično natančen načrt za varen univerzalni zalogovni sistem
> (preprečiti negativno zalogo, izgubo posodobitev, dvojno knjiženje, napačne sočasne rezultate). **Nič
> kode/sheme/migracij/baze ni spremenjeno; Git operacij nobenih; tuj WIP in `einvoices.ts` nedotaknjena.
> `markec_dev`/produkcija nedotaknjena. Implementacija P1-D-1 NI odobrena.** Statusi: EXISTING-VERIFIED /
> EXISTING-PARTIAL / PROPOSED / GAP / NOT VERIFIED.

---

## 1. Povzetek dejanskega stanja (EXISTING-VERIFIED)

| Operacija | Datoteka:vrst. | Txn | ZAKLEP | Guard | Idem | Org | Variant | Ledger | Tveganje |
|---|---|---|---|---|---|---|---|---|---|
| createStockMovement | inventory:81–188 | DA ($tx) | NE (default), `FOR UPDATE` NI | `computeStockDelta` NEGATIVE_STOCK | NE | DA | DA | DA | lost-update pri 2 sočasnih |
| recordDelivery | inventory:371–460 | DA | NE | computeStockDelta(IN) | NE | DA | DA | DA | — |
| submitStockTake | inventory:513– | DA | NE | delta (counted≥0) | NE | DA | **NE** (product-only, stocktakeLine :491) | DA, STOCKTAKE | **GAP: ne-variant-aware** |
| reserveStock | checkout:166 | v okviru txi | CAS `AVAVAIL` | `S−RES≥qty` | strik. (Stripe idem) | DA | DA | NE (ni fiz.) | ownership GAP |
| releaseStockReservation | checkout:187 | v okviru txi | CAS `reserved>=qty` | reserved aizh | NE (ownership) | DA | DA | NE | **ownership GAP (P2/G3)** |
| convertReservationToSale | checkout:208 | v okviru txi | CAS `reserved>=qty` | rezerv | Stripe idem | DA | DA | DA OUT ORDER | — |
| applyOrderStockDecrement | checkout:91 | v okviru txi | CAS `stockQuantity>=qty` | **S≥qty (ne S−RES≥qty)** | Stripe idem | DA | DA | DA OUT ORDER | **GAP: lahko proda pod RES pri direkt. izdaji** |

**Splošno:** `SELECT FOR UPDATE` v kodo **ni** na stock vrsticah — obstaja le v `colony-moves.ts:110/:300`
(ExtensionRecord), `documents.ts` (Document), `numbering.ts` (DocumentSequence). Ne zamenjevat (te so
ostalih modulov). — NOT na Product/ProductVariant v nobeni zalogovni akciji.

---

## 2. Natančen obseg P1-D-1

**Vključeno (P1-D-1):** transakcijsko varnost; zaklepanje stock-vrstic; negativna zaloga; izgubljene posodobitve;
retry; idempotentnost; doslednost stanje↔StockMovement; testi sočasnosti in rollbacka.
**Izven:** `OPENING_BALANCE` (P1-D-2); agregacijski servis + UI (P1-D-3); prehod modelov (ločena faza);
`StockReservationEvent`/ownership (P1-D-4/G3); G7; drugi moduli.
**Odvisnost P1-D-1 → shema:** univerzalni `idempotencyKey` bi zahteval **PROPOSED** model/polje (glej §7); če se
ne odobri → P1-D-1 uporabi obstoječe CAS/idem (Stripe) in `@@unique` preko obst. vrstic; odvisnost dokumentirana.

---

## 3. Datoteke / funkcije / predlagane spremembe (PROPOSED prihodnje)

| Datoteka | Funkcija | Trenutno | Ciljno | Tveganje | Test |
|---|---|---|---|---|---|
| `src/app/actions/inventory.ts` | createStockMovement | $tx brez FOR UPDATE | +`$queryRaw SELECT ... FOR UPDATE` na agregat v txn; + `stock≥reserved` guard pri OUT | deadlock/lost-update | conc. test |
| `src/app/actions/inventory.ts` | recordDelivery | IN v $tx | enako (IN ne gre neg; guard naj ostane) | — | prejem |
| `src/app/actions/inventory.ts` | submitStockTake | product-only | + variant-level (stocktakeLine dodaj `variantId`) | ne-variant | inventura variante |
| `src/app/actions/inventory.ts` | (nov helper) | — | skupni `withStockLock(tx,{productId,variantId})` | — | unit |
| `src/app/actions/product-checkout.ts` | applyOrderStockDecrement | `stock>=qty` | + `S−RES≥qty` (na varianti) guard za direkt. izdajo | oversell pod RES | test D/nat |
| `lib/*` | (idempotency) | odvisno | PROPOSED polje/model | shema | idem test |

`src/app/actions/products.ts`, `catalog.ts`, `schema.prisma`, `einvoices.ts` — **NE spreminjati v P1-D-1** (ni
obsega ali tuji WIP).

---

## 4. Transakcijski diagram (predlagan, PROPOSED)

```
BEGIN TX
  1. SELECT id FROM Product|ProductVariant WHERE id=? AND organizationId=? FOR UPDATE   → zakleni agregat
  2. read current S, RES (po lock-u, svežo)
  3. verify org/product/variant pripadnost
  4. guard: qty>0; S−RES ≥ potrebno (za OUT/izdajo/prodajo); S ≥ 0; (OUT) next = S−qty ≥ RES
  5. izračunaj finalState (IN: S+qty; OUT: S−qty; res: RES±qty)
  6. UPDATE Product|Variant SET stockQuantity=..., reservedQuantity=...
  7. IF fiz.premik → INSERT StockMovement (append-only)
  8. IF predviden rezervacijski dogodek → (P1-D-4, tu ne)
  9. idempotency: INSERT zgodovine/ključ (če shema)
COMMIT;  (rollback ob katerikoli napaki → vso)
```
**Kje:** `SELECT FOR UPDATE` na **avtoritativno vrstico** (variant z variant, product brez). **CAS** (pogojni
`UPDATE ... WHERE`) vzorobno pri checkout/oizdaji (zvesto trenutno), vendar z **dodatnimi pogoji** (S−RES≥qty).
Zaporedje: zakleni agregat → preberi sveže → guard → update → ledger → commit. NIkoli prepisa starega s
(after-lock read je svež).

---

## 5. Zaklepanje in vrstni red (PROPOSED)

- **Pri variantah:** zaklepati **ProductVariant vrstico** (ne samo Product).
- **Brez variant:** zaklepati **Product vrstico**.
- **Ena operacija knjiži Product ALI ProductVariant, ne oboje hkrati.**
- **Vrstni red zaklepov (deadlock-preprečitev):** urejen niz `(table, id)` naraščajoče; pri več variantah istega
  izdelka → po `productId` → pa `variantId`; enoten globalni red.
- **Sočasna rezervacija+izdaja / izdaja+direkt:** oba na isti agregat vrstici → `FOR UPDATE` → serializirana.
- **Dve različni varianti istega izdelka:** zaklepanje per-variant (vzporedno varno, brez blokade celotnega
  izdelka).
- **Različne org:** tabela ima `organizationId` v WHERE → izolirano; različne org ne tekmujeta.
- **Izgubljena posodobitev / mrtve točke:** preko `FOR UPDATE` + enotnega reda + retry.

---

## 6. Guard in CAS pravila (PROPOSED)

**Def: S=fiz., RES=rez., A=S−RES.**
- Fizični prejem: S+ , RES0, A+ ; guard: S−RES ≥ 0 (S+ ne more pod nič).
- Rezervacija: S0, RES+ , A−; guard: **A ≥ req** (`S−RES ≥ req`), nikoli presega A.
- Sprostitev: S0, RES−, A+; guard: `RES ≥ qty` (sprostitev ≤ veljavna rez).
- Izdaja rezerviranega: S−, RES− (isto qty), A enak; guard: `RES ≥ qty` + `S−RES ne sme pod nič`; OUT povezan z
  ISSUE (P1-D-4); ne dvojni OUT.
- Direktna prodaja (brez rez): S− , RES0 , A−; guard: **`A = S−RES ≥ qty`** (popravi trenutni `applyOrderStockDecrement`
  ki uporablja le `stock≥qty` → **GAP**, popraviti).
- Robni: qty0 → zavrni; qty<0 → zavrni; decimalna (če Int) → zavrni; prevelika rez./iz / stare podatke → zavrni;
  dvoj. izvedba iste op. → idem.

---

## 7. Idempotentnost (PROPOSED, shema odvisnost)

**Predlog:**
- `idempotencyKey` string na operaciji (ali na `StockMovement`/poseben `StockOperation` model) + **org-scope**:
  `@@unique([organizationId, idempotencyKey])`.
- preverba ponovljene: INSERT z uniq → conflict pomeni že izvedeno; enak key+enak payloadHash → vrnjen obstoječi
  rezultat; enak key+drugašen payload → **`IDEMPOTENCY_CONFLICT`**.
- kanonični payload hash: JSON kanoničnen (sortirani ključi, brez createdAt).
- sočasna ista key: samo ena uspe (uniq), druga se blokira/vrne rezultat (ali retry).
- napaka med txn → rollback → retry velja za novo.
- webhook (Stripe): obstaja z `stripeEventId` uniq (EXIST-VER), a za posploševanje predlagan univerzalni key.
- **Ločeno nastaviti:** idempotentnost fiz. premika, rezervacije, izdaje, webhooka. **En ključ ne sme pokriti več
  ločenih transakcij** (vsaka svoj key scope).
- **Shema obsega vs:** prepotrebna PROPOSED sprememba = dodati `idempotencyKey` (+ `payloadHash?`, `createdById`)
  ter `@@unique(org, idempotencyKey)` ali poseben model `StockOperation`. — PROPOSED; odvisnost P1-D-1.

---

## 8. Obravnava napak in retry (PROPOSED)

- **P2034 (deadlock/serialization)** → kontrolirani retry (max N, npr. 3, z naključnim backoff), **idempotentno**
  (isti key ne ustvari duplikata).
- Napaka med zgod to update z ledger → **rollback cele txn** (obe ali nič).
- Ne-slep retry: retry le za P2034/timeout; druge napake (validation/org) → takoj zavrni.
- Zapiranje: po 3 poskusih → jasen error (npr. `STOCK_CONFLICT`/`MAX_RETRY`).

---

## 9. Povezava StockMovement ↔ operacija (PROPOSED)

- **Ena fiz. operacija = 1 StockMovement z ustreznim source** (IN/OUT). NIkoli spremembe stock brez ledgerja in
  nikoli ledgerja brez spremembe (ista txn).
- **Ni dvojnega OUT / prepisa** → idempotency + `FOR UPDATE` + CAS.
- **Variantni premiki** → vezani na `productVariantId` (createStockMovement že).
- **`reservationEventId` (G3)** — P1-D-1 **predvideti** (rezerviraj prostor), a **ne implementirati**
  `StockReservationEvent` (to je P1-D-4/G3). Odvisnost zabeležena.

---

## 10. Predlagane sheme spremembe (PROPOSED, ne izvedeno)

1. **`StockOperation` model** (ali polje na StockMovement): `id, organizationId, idempotencyKey, payloadHash?,
   operation, createdAt, createdById` + `@@unique(organizationId, idempotencyKey)`; indeks org+operation. → P1-D-1
   odvisnost.
2. (P1-D-2) `OPENING_BALANCE` enum + `openingBalanceId`.
3. (G3/P1-D-4) `StockMovement.reservationEventId` + `@@unique` + `StockReservationEvent`.
Migracija: dodati model/polja (additive); obstoječi zapisi brez ključa → NULL/brez (transformed); preveriti
uniq; rollback → revert additive. NIkoli spreminjati brez pregleda/odobritve.

---

## 11. Testna matrika (PROPOSED)

| # | Test | Start | Operaciji (sočasno) | Konč. S/RES | StockMovement | PASS |
|---|---|---|---|---|---|---|
| 1 | prodaja brez var | S20 | OUT 5 | 15/0 | +1 | PASS=15 |
| 2 | prodaja z var | var S20 | OUT 5 | 15/0 | +1 | PASS=15 |
| 3 | 2 sočasna prodaja ist var | S20 | 2×OUT5 | 10 | +2 | PASS=10 |
| 4 | 2 sočasna rez iste var | S20 | 2×rez5 | 20/10 A10 | +0 | PASS A=10 |
| 5 | rez+prodaja | S20 | rez5, prod5 | 10/5 A5 | +1 | PASS: 1 prodana |
| 6 | prejem+prodaja | S20 | IN5, OUT5 | 20 | +2 | PASS=20 |
| 7 | inventura+prodaja | S20 | stocktake counted18, OUT5 | (CONFLICT ali 13) | +1/+1 | PASS/na odl. |
| 8 | izdaja rez | S20/RES8 | izdaja3rez | 17/5 A12 | +1 | PASS |
| 9 | idem ista key same payload | S20 | op×2 | 15 | **+1** (2. ne) | PASS +1 |
| 10 | idem ista key drug payload | S20 | op+op' | (CONFLICT) | +1 | PASS |
| 11 | sočasna ista key | S20 | op×2 vzporedno | 15 | +1 | PASS |
| 12 | ponovljen webhook | var | stripe komplet×2 | enkrat | +1 | PASS |
| 13 | prevelika rez | S20 | rez25 | 20/0 (zavrn) | +0 | PASS zavrn |
| 14 | prevelika izdaja | S20/A12 | izd13 | zavrn | +0 | PASS |
| 15 | negat. zaloga | S5 | OUT10 | zavrn | +0 | PASS |
| 16 | napačna org | orgB→S | — | zavrn | +0 | PASS |
| 17 | napačna varianta | var drug. prod | — | zavrn | +0 | PASS |
| 18 | deadlock+retry | — | 2 zapeta | uspe (retry) | 2 | PASS |
| 19 | napaka zaloga vs ledger | S20 | OUT, simulate ledger fail | ROLLBACK S20 | +0 | PASS |
| 20 | rollback celote | S20 | naročilo multi | ROLLBACK | +0 | PASS |

Vsi testi na **izolirani test DB** (ne prod/markec_dev). Te s konkurentom: samo izolirano okolje.

---

## 12. Vrstni red prihodnje implementacije

1. P1-D-1: `FOR UPDATE` na agregat, `stock≥reserved` guard v OU/direkt, `submitStockTake` variable-aware,
   idempotency (ali model/propolje).
2. P1-D-2: `OPENING_BALANCE` + `openingBalanceId`.
3. P1-D-3: agregacijski servis + UI (Σ variant, read-only).
4. Prehodni program (brez → z variant / z → brez) — ločeno.
5. P1-D-4/G3: `StockReservationEvent` + ownership + ISSUE↔StockMovement vez.
6. G7 (čebelarska sledljivost).

---

## 13. Merila PASS/FAIL (P1-D-1)

**PASS:** vse 4 glavne poti varno: (a) nobena OUT/direkt ne gre pod `S−RES`; (b) `FOR UPDATE` na agregat prepreči
lost-update (testi 3/5/6/18); (c) noben dvojni StockMovement (testi 9–12); (d) rollback pri napaki (19/20);
(e) org/variant izolacija (16/17); (f) `submitStockTake` variant-aware — test inventar. 
**FAIL** če: manjka `S−RES` guard v direktni prodaji, ali idem ne dokaže +1, ali ne-variant stocktake, ali ni
P2034-retry.

---

## 14. Odprte blokade / odvisnosti

1. **`applyOrderStockDecrement` GAP:** trenutno `stockQuantity>=qty` → **proda pod RES** pri direkt. izdaji;
   potrebno `S−RES≥qty` (+ na varianti). — blokira PASS-do implementacije.
2. **`submitStockTake` ne-variant-aware** (stocktakeLine samo productId) → GAP za variant-led.
3. **Idempotency shema**: če bo univerzalni key → **PROPOSED model/polje** + migracija; odvisnost P1-D-1 na
   odobritvi sheme.
4. **`SELECT FOR UPDATE` na stock ni v kodi** (le drug moduli) — dokazni test (concurrency) pred PASS.
5. **Ownership rezervacij (P2/G3)** — ločena faza, ne P1-D-1.

---

## 15. Končna ocena

| Področje | Status |
|---|---|
| Dejansko stanje op. | PASS (EXIST-VER) |
| Zaklepanje stock | PARTIAL (CAS na checkout; FOR UPDATE na stock MANJKA) |
| Guard neg. zaloga / stock<res | PARTIAL (NEGATIVE DA; direktna S−RES GAP) |
| Idempotentnost | PARTIAL (Stripe/CAS; univerzalni key PROPOSED) |
| Trans. celovitost | PARTIAL (txn na vseh; P2054-retry PROPOSED) |
| Variant-stocktake | GAP |
| Migracijske odvisnosti | znana (idem model PROPOSED) |

**Končni odgovori:**
1. P1-D-1 dovolj natančen? **DA (načrt)**, a z blokadami (GAP se popravil pred PASS).
2. Vse zalogovne poti zajete? **DA** (7 op. pregledanih).
3. Zaklepanje dovolj določeno? **PARTIAL** (FOR UPDATE na stock potrebno dodati).
4. Idempotentnost dovolj določena? **PARTIAL** (Proposed shema potrebna za univerzalni).
5. Trans. celovitost zagotovljiva? **PARTIAL** (občutljivo na retry/P2034).
6. Migracijske odvisnosti? **znane** (idem → PROPOSED; odvisnost).
7. Pripravljen za ločeno odobritev? **DA** — načrt skladen, a P1-D-1 NI implementiran in NI odobren.

---

## 16. Končna zaustavitev / potrditev
- Ustvarjen samo novi implementacijski načrt: DA.
- Aplikacijska koda nedotaknjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze in testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuj WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Pripravljen načrt čaka na izrecno odobritev implementacije P1-D-1; nič ni izvedeno. Ne začnem P1-D-2/3/4, P2,
G3/G7. Ustavljam se.**

---

# P1-D-1 FINAL — PET NADZOROVANIH IMPLEMENTACIJSKIH PODFAZ

> Razdelitev P1-D-1 na 5 podfaz (1A–1E), vsaka z ločenim obsegom, datotekami, testi, PASS-kriterijem in ločeno
> odobritvijo. **Nič kode/sheme/migracij ni spremenjeno. Odobritev ene podfaze ne pomeni odobritve naslednje.
> Statusi: EXISTING-VERIFIED / PARTIAL / PROPOSED / GAP / NOT VERIFIED.**

---

## 5 podfaz — pregled

| Podfaza | Namen | Datoteke | Shema | MERILO PASS |
|---|---|---|---|---|
| **1A** | Zaščita razpoložljive zaloge (popravi `stock≥qty` → `S−RES≥qty`) | product-checkout.ts | NE | direktna prodaja ne seže v RES |
| **1B** | Variant-aware inventura | inventory.ts, stocktake shema | **PROPOSED** (`variantId` v stocktakeLine) | inventura variant + zavrni napačno |
| **1C** | Zaklepanje stock-vrstic (`FOR UPDATE`, order, retry) | inventory.ts, checkout | NE (implementation) | brez lost-update/neg. zaloge |
| **1D** | Idempotentnost | nov model/akcije | **PROPOSED** (`StockOperation`/key+uniq) | brez dvojnega knjiženja |
| **1E** | Celovita validacija | (testi) | NE | vsi testi PASS + regresija |

---

## 1. P1-D-1A — Zaščita razpoložljive zaloge (P0)

**Težava (EXISTING-VERIFIED):** `applyOrderStockDecrement` (product-checkout:91) uporablja `stockQuantity >= qty`
(variant :98–99; product :117–118) → **preverja S, NE `S − RES ≥ qty`** → lahko proda tudi v rezervirano količino.

**Ciljno pravilo:** `stockQuantity − reservedQuantity >= qty` (A = S − RES).

**Natančna lokacija:** `product-checkout.ts` :91 (direktna izdaja/prepaid brez rezervacije). Klicatelji: verify/prepaid
poti (status-CAS; Guard v isti txn).

**Guard:** 
- Product: `WHERE id=? AND organizationId=? AND "stockQuantity"−"reservedQuantity" >= qty`
- ProductVariant: `WHERE id=? AND organizationId=? AND "stockQuantity"−"reservedQuantity" >= qty`
- Nezadostna A: `UPDATE ... WHERE` vrne count=0 → throw/return `STOCK_CONFLICT`, **brez spremembe in brez
  StockMovement**.
- **Txn:** enaka `$transaction` kot zdaj (CAS upsert → SUP => Count), z dodanim A-pogojem.
- **Združljivost z obst. rezervacijami:** ne dotika `reservedQuantity` (direktna izdaja RES nespremenjena).
- **Ponovljene zahteve:** Sproti prek status-CAS/verify; za dvojni → idempotency (1D) — tu poskrbi, da ne ustvari
  2× OUT (status-CAS + idem).
- **Vpliv na checkout/naročila:** direktni (prepaid/gift) ne sme več poseči v rezervirano — zahtevani prehod.

**Primer 1:** S20/RES15/A5, direkt prodaja 6 → zavrnjeno; S=20, RES=15, **0 dodatnih StockMovement** (PASS).
**Primer 2:** S20/RES15/A5, direkt prodaja 5 → S=15, RES=15, A=0, +1 OUT ORDER (PASS).

---

## 2. P1-D-1B — Variant-aware inventura

**Težava (EXISTING-VERIFIED):** `stocktakeLineSchema` (inventory:491–494) ima **samo `productId`+`counted`**, brez
`productVariantId` → `submitStockTake` (inventory:513) inventira samo product-level; ne-variant (GAP za variant-led).

**Natančno določi:**
1. Uporabnik izbere izdelek → (če ima variante) varianto.
2. Preverba: varianta pripada izdelku + org (`requirePermissionOrg` products.manage) + `findFirst org+productId`.
3. **Prepreči knjiženje na Product, ko je izbrana varianta** (samo variant row; ne product).
4. Razlika: `delta = counted − currentVariantStock` (svežo po lock).
5. Zapis: `StockMovement` STOCKTAKE (direction po znaku delta), qty=|delta|; **Product skupna = prek agregacije Σ
   (P1-D-3), ne z dodatnim knjiženjem.**
6. Sočasna prodaja med inventuro → s svežim stanjem v txn + `FOR UPDATE` (1C) ali zavrni (`INVENTORY_CONFLICT`).
7. Zgodovina: append-only StockMovement; nova inventarna vrstica, ne brisanje.

**Primer:** varianta M sist. 20, inventurno 17 → delta −3 → varianta 17; +1 `StockMovement` STOCKTAKE OUT 3; Product
Σ=označeno skozi agrega, **brez** dodatnega product-knjiženja.

**Shema:** `stocktakeLineSchema` dodati `productVariantId?` (ali uporabiti obstoječi `MovementInput` ki že
podpira productVariantId :24/:342). Če inventura potrebuje persist stanje → samo PROPOSED (ne migracija zdaj).

---

## 3. P1-D-1C — Zaklepanje stock-vrstic

**Dejansko (EXISTING-VERIFIED):** `SELECT FOR UPDATE` NI na Product/ProductVariant stock; obstaja le v drugih
modulih (`colony-moves.ts`, `documents.ts`, `numbering.ts`). Checkout operacije (reserve/release/convert/
applyOrder) uporabljajo atomični CAS `UPDATE ... WHERE` (varno per-linija); `createStockMovement`/`recordDelivery`/
`submitStockTake` uporabljajo `$transaction` z branjem pred (potencialna lost-update).

**Določi, kje FOR UPDATE:**
- **Za prejem/povečanje/zmanjšanje/inventuro** (`createStockMovement`, `recordDelivery`, `submitStockTake`):
  potreben **`SELECT ... FOR UPDATE`** na avtoritativni vrstici (variant|product) znotraj `$transaction`, da ni
  lost-update — vrstni red: (productId → variantId) urejeno.
- **Za reserve/release/convert/applyOrder (CAS paths):** lahko ostanejo na pogojnem `UPDATE ... WHERE` —
  **dokazano varno** (atomski CAS per-linija, P1-D-1A doda A-pogoj). Ne enotiti vsega na FOR UPDATE, kjer CAS
  zadostuje.

**Vrstni red:** urejen niz (table,id) naraščajoče; Product → ProductVariant; enoten globalni red za več izdelkov.
Deadlock → `P2034` → kontroliran retry (max 3, backoff), idempotentno. Isolation org: vsa WHERE z organizationId.

**Scenariji (konkreten):** 
- dve prodaji iste variant → CAS na isti vrstici serialized (PASS).
- prodaja+rezervacija iste var → CAS na isti (A-pogoj), varno.
- prejem+prodaja → prejem FOR UPDATE, prodaja CAS; isto vrstico → serialized.
- inventura+prodaja → inventura FOR UPDATE (sveža), prodaja CAS; konsistenca prek lock/CAS.
- sprostitev+izdaja → CAS (ist vrstica), varno.
- dve različni varianti istega izdelka → per-variant (vzporedno varno, brez blokade celotnega izdelka).

---

## 4. P1-D-1D — Idempotentnost

**Dejansko:** NO universal `idempotencyKey` column (samo Stripe `stripeEventId` unique, shema komentar :246/:292).
`applyOrderStockDecrement`/convert uporabljata status-CAS + Stripe idem. 

**Predlog (PROPOSED):**
- model `StockOperation`: `id, organizationId, idempotencyKey, payloadHash?, operation, status, createdById,
  createdAt` + **`@@unique(organizationId, idempotencyKey)`**; indeks `(organizationId, operation)`.
- Zapis strogo **v isti transakciji** kot zalogovna sprememba + StockMovement, da ni stanja »zaloga spremenjena,
  idemp manjka« ali obratno (obe ali nič).
- `IDEMPOTENCY_CONFLICT` ob istem key + drugačen payloadHash.
- Ločeno obravnavati: fiz. premik, rezervacijo, sprostitev, izdajo, direktno prodajo, webhook.
  **En ključ ne pokriva več ločenih transakcij** (vsak svoj key) — 1D scoped per-operation.
- Stripe webhook: že dedup via `stripeEventId` (EXIST); P1-D-1D poenoti/razširi la `StockOperation` za vse.

**Shema 1D (PROPOSED)** — model `StockOperation` (ali `idempotencyKey` na StockMovement + `@@unique(org,key)`).
Vpliv/stare zapise: additive (NULL starih ni-ključa); migracijska tveganje: uniq na novih; rollback: revert.
Ne uvajati `OPENING_BALANCE`/`StockReservationEvent` v P1-D-1 (to je P1-D-2/P1-D-4) — dokumentirano kot odl.

---

## 5. P1-D-1E — Celovita validacija

Testna matrika (25 testov iz navodila), vsak s S/RES/StockMovement/idempodatki in PASS/FAIL:
1–5 A-zavarovanje, 6–7 variant/non-variant inventura, 8–9 napačna var/org, 10–13 sočasne op, 14 deadlock/retry,
15–17 idem (sama/druga payload/sočasna ista key), 18 ponovljen webhook, 19 napaka stock↔ledger rollback,
20 rollback celote, 21 org izolacija, 22–25 regresija (checkout/rezer/variant/brez-variant).
Izolirana test DB za integration (race/rezero/webhook); unit za čiste dele (guard/išračun). Ne izvajaj na
produkcijski/nepreverjeni.

---

## 6. Odvisnosti in spremembe sheme (P1-D-1)

| Podfaza | Shema nujna? | Predlog | Tveganje | Rollback |
|---|---|---|---|---|
| 1A | **NE** (le sprememba WHERE v product-checkout) | — | nizko | reverz kode |
| 1B | **Možno**: `productVariantId` v stocktakeLine (že `MovementInput` :342 obstaja) | dodati ali uporabiti obst. | nizko | reverz |
| 1C | **NE** (le txn/lock v kodi) | — | deadlock (retry) | reverz |
| 1D | **DA (PROPOSED)**: `StockOperation` model + `@@unique(org,key)` | additive | uniq na novih | revert |
| (P1-D-2/4) | — | OPENING_BALANCE/StockReservationEvent **NE SO del P1-D-1** | — | — |

`schema.prisma` **se v P1-D-1 ne spreminja** brez ločene odobritve; 1D odvisnost se dokumentira in čaka.

---

## 7. Varnost in regresija

Načrt NE oslabi: org-scope, IDOR (vse WHERE z org), variant-pripadnost, Stripe/s checkout, zgodovino naročil/
StockMovement, F5.5.1, tuj WIP. Nobena podfaza ne dopušča spremembe zaloge brez org + avtoritativnega nivoja.

---

## 8. Predlagani vrstni red izvedbe (potrjeno)

1. **P1-D-1A** (A-zaščita, P0) → 2. **P1-D-1B** (variant inventura) → 3. **P1-D-1C** (zaklepanje) →
4. **P1-D-1D** (idempotentnost) → 5. **P1-D-1E** (validacija).
**Utemeljitev:** A je najkritičnejša (P0, odpravi takojšnje tveganje); B zahtevano pred C? — B je samostojna (ni
odvisna od C; inventura je super). C in D so neodvisni; vrstni red C→D vzročno nebistvena, a C (lock) pred D
(sest rado) zato, da se sočasnost najprej osnovno zaščiti. E je zadnja (validacija).
**Vsaka podfaza ima:** ločen obseg/datoteko/teste/poročilo/PASS-merilo/odobritev. Odobritev ene ni odobritev druge.

---

## 9. Končna zaustavitev / potrditev

- Spremenjen samo implementacijski načrt (dodano to poglavje): DA.
- Aplikacijska koda nedotaknjena: DA.
- `schema.prisma` nedotaknjen: DA.
- Migracije niso ustvarjene: DA.
- Baze in testni podatki nedotaknjeni: DA.
- Git operacije niso izvedene: DA.
- Tuj WIP nedotaknjen: DA.
- `einvoices.ts` nedotaknjen: DA.
- `markec_dev` in produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Po končanem načrtu čakam izrecno odobritev P1-D-1A. Nobena druga podfaza (1B–1E) ni vnaprej odobrena. Nič ni
implementirano; ne začnem P1-D-2/3/4, P2, G3/G7. Ustavljam se.**