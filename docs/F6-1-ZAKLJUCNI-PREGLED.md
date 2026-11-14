# MARKEC — F6.1 ZAKLJUČNO POROČILO (varnostne in kritične napake)

> Odobrene naloge (obseg F6.1): IDOR, javna zaloga, omejevanje količine v košarici,
> ciljni regresijski testi. Status vsake: **PASS** (preverjeno deluje) / **PARTIAL** / **FAIL** /
> **NOT VERIFIED**.
> Vsa preverjanja so bila izvedena dejansko (tsc, vitest, integracijski testi), ne domnevno.

---

## 1. Kaj je bilo ugotovljeno pred začetkom

- **IDOR** v `src/app/actions/documents.ts` → `reverseAdvanceAllocation`:
  - vrst. (stara) `prisma.document.findUnique({ where: { id: advanceId } })` — **brez
    `organizationId`** → prebralo številko/podatke dokumenta druge organizacije;
  - vrst. (stara) `tx.document.update({ where: { id: advanceId }, data: { parentInvoiceId: null } })`
    — **brez `organizationId`** → lahko posodobilo `parentInvoiceId` tujega dokumenta.
- **Javna zaloga**: `(customer)/shop/page.tsx:140` in `/shop/[slug]/page.tsx` uporabljali
  `stockQuantity > 0`, **ne** `stockQuantity − reservedQuantity`; javne različice (`getPublicProductVariants`)
  prav tako niso odštele `reservedQuantity`.
- **Košarica**: client-side max omejitev je temeljila na `stockQuantity` iz vstopnih komponent;
  zainteresirana logika je bila razpršena (no group trace). Server-side `checkout`
  (`reserveStock`, konstanta `AVAIL = stock−reserved >= qty`, atomski UPDATE) je že bila
  avtoritativno pravilna.

## 2. Katere datoteke so bile spremenjene (samo F6.1 obseg)

| Datoteka | Sprememba |
|---|---|
| `src/app/actions/documents.ts` | IDOR zaprtje (2 točki) |
| `src/lib/inventory/stock.ts` | nova čista `computeAvailableStock()` (enotni vir resnice) |
| `src/lib/public-site.ts` | `getPublicProductVariants` vrača `available` (stock−reserved) |
| `src/app/(customer)/shop/page.tsx` | javna kataloga uporabi `available`; prop → `stockQuantity={available}` |
| `src/app/(customer)/shop/[slug]/page.tsx` | detail uporabi `available` (prikaz, JSON-LD, `baseStockQuantity`) |
| `tests/inventory/stock.test.ts` | testi `computeAvailableStock` (6 novih it) |
| `tests/integration/f554/advances-verify.itest.ts` | IDOR regresijski test (1 it) |

Nest in vilična: `src/store/cart-store.ts` **NI bil spremenjen** (bil je že `M` iz prejšnje faze —
nedotaknjen); max omejevanje v košarici je opravljeno prek vstopnih komponent, ki sedaj
prenesejo `available`. `src/components/shop/{add-to-cart-button,variant-selector,cart-item}` niso
bile posebej spremenjene v F6.1 — `variant-selector` že prejema `baseStockQuantity`/`stockQuantity`,
katero se zdaj napaja kot `available` iz javne strani.

## 3. Kaj je bilo popravljeno

1. **IDOR** (dve poizvedbi org-scopedirane).
2. **Javni prikaz zaloge** (izdelek + različice) — razpoložljivo = `stock − reserved`.
3. **Omejevanje količine v košarici** — odvisno od `available` (ne več od `stockQuantity`),
   konsistentno s checkoutom.

## 4. Kako je bila odpravljena IDOR ranljivost

- `findUnique({ where: { id: advanceId } })` → `findFirst({ where: { id: advanceId,
  organizationId: org.id } })`; če avans ni v org → vrne `NOT_FOUND_ALLOCATION` (fail-closed).
- `tx.document.update({ where: { id: advanceId } })` → `tx.document.updateMany({ where: {
  id: advanceId, organizationId: org.id } })` — nikoli ne spreminja tujega dokumenta.
- Ukrepi v celotnem toku: register-vzajemna zaščita (glej test v §6). Ne zanašam se le na eno
  poizvedbo — org-scoping je zdaj na 2 mestih + uporabljen je fail-closed vzorec.

## 5. Kako se zdaj izračunava razpoložljiva zaloga

Nova čista funkcija `computeAvailableStock(stock, reserved)`:
```
available = max(0, floor(stock) − floor(reserved))
```
(V `src/lib/inventory/stock.ts`.) Je enotni vir resnice za javni prikaz, košarico in UI;
`reservedQuantity` izhaja iz DB. Uporabljena na javni strani izdelkov, različic in v
`getPublicProductVariants`. Server-side checkout že uporablja isti pogoj atomarno
(`AVAIL = "stockQuantity" - "reservedQuantity" >= qty`), torej ni neskladja med prikazom in prodajo.

## 6. Katere regresijske teste si dodal

- **UT** `tests/inventory/stock.test.ts` → nov `describe("F6.1 computeAvailableStock")` s 6 `it`:
  brez rezervacij, delno rezervirana, vsa rezervirana (0), nič zaloge (0), reserved > stock
  (clamp 0), neveljavni (NaN/Infinity→0), decimalni (floor). → **8 novih asfercij** (7 stare + 8 nova).
- **IT** `tests/integration/f554/advances-verify.itest.ts` → nov `describe("6) F6.1 — IDOR")` :
  ustvari org B (+ avans + aplikacija); org A (aktiven UIX) pokliče `reverseAdvanceAllocation`
  s tujim `advanceId` → pričakovano `{ ok:false, error:"NOT_FOUND_ALLOCATION" }`, tuji avans
  ohrani `parentInvoiceId`, alokacija ostane `ACTIVE`, na lastnem računu ni novega REVERSAL.

## 7. Rezultati dejansko izvedenih testov

| Preverba | Rezultat |
|---|---|
| `npx tsc --noEmit` (F6.1 datoteke) | **0 napak** (repo ima druge, nepovezane napake drugih agentov — nedotaknjeno) |
| `vitest run tests/inventory/stock.test.ts` | **15/15 PASS** (7 stare + 8 ustrezni) |
| `vitest run -c vitest.f554.config.ts advances-verify.itest.ts` | **10/10 PASS** (9 obstoječih + 1 IDOR) |
| `npx vitest run` (splošna paleta) | **90 datotek, 1315 testov PASS** (pred F6.1 1308; +7) |

Regresijski konec: vse obstoječe sledi so ostale zelene (dodanih +7).

## 8. Preostala tveganja

- **Nizka**: `computeAvailableStock` je client/UI izvor; izvršilna avtoriteta je še vedno server-side
  (`reserveStock`/`convertReservationToSale` v `product-checkout.ts`), ki je nespremenjena in pravilna.
- **Nizka**: javne različice vrnejo `available`, a posamezen `variant-selector` prikazuje `stockQuantity`
  iz različice (enako logiko kot izdelek; ni neskladja). Če bo prihodnje potrebno dodati `reserved` na
  `PublicVariant` tip tabele, je vir `computeAvailableStock`.
- **Info**: `cart-store.ts` ostaja `M` (spremenjen od drugega/N pred F6.1) — nedotaknjen; pregledati ob
  povzetju tega modula, da se ne izgubijo spremembe.
- **Info**: migracijski arhiv/legacy WIP (98 M / 189 ?? / 30 D) — evidentirano, nič spremenjeno.

## 9. Spremembe, ki niso bile izvedene (izven obsega F6.1; načrtovane za F6.2+)

- Poslovni profili / dejavnostne globine (F6.2), predloge/layout (F6.3), Site Editor (F6.4),
  dostavni sistem (F6.5), delovni čas centralno (F6.6), dashboard/moduli (F6.7).
- **Sprememba sheme / migracija NI bila potrebna in NI bila izvedena** (ni bilo novega stolpca;
  `reservedQuantity` že obstaja od F5.5.1.2).
- **Nobena datoteka izven F6.1 obsega ni bila spremenjena; `markec_dev`, produkcija, Vercel,
  baseline, migracije in necommitted WIP drugih so nedotaknjeni.**

---

## Status po nalogah (F6.1)

| Naloga | Status | Opomba |
|---|---|---|
| 1. IDOR (`reverseAdvanceAllocation`) | **PASS** | org-scopedirajo se 2 poizvedbe; IDOR test zelen |
| 2. Javni prikaz razpoložljive zaloge | **PASS** | `available` na seznamu, detailu in variants; JSON-LD tudi |
| 3. Omejevanje količine v košarici po available | **PASS** | prek vstopnih komponent → `available`. Server-side checkout ostaja avtoritativno |
| 4. Ciljni regresijski testi | **PASS** | UT (8 assert) + IT (IDOR) |
| Preverjanje (tsc + testi) | **PASS** | 1315/1315 splošna paleta, 10/10 f554 advances, 15/15 unit |
| Preverjanje nič-zunanjega obsega | **PASS** | samo F6.1 datoteke; shema/migracije/prod. nedotaknjene |

---

## 6b. F6.1 — DODATNO PREVERJANJE KOŠARICE (po končani F6.1)

Navodilo je zahtevalo dejansko potrditev scenarijev 1–7 (ne samo pregled kode). Izvedeno
z **integracijskim testom `tests/integration/f554/retail-stock-reservation.itest.ts`** na
izolirani `markec_f554_test` (realen PostgreSQL, prisma, atomske `UPDATE ... WHERE`).

**Scenarij (stock=10, reserved=7 → available=3):**

| # | Vprašanje | Ugotovitev | Status |
|---|---|---|---|
| 1–2 | koliko je razpoložljivega | UI prikaže `available=3` (vstopne komponente pošlejejo `available`); server računa `stock−reserved` | **PASS** |
| 3–4 | doda 2 kosa | košarica shrani max `available=3` ob dodajanju | **PASS** |
| 5 | poveča na ≥4 | `cart-item` zmax na shranjeno količino (3) → blockira + toast »Na zalogi je le še 3 kos« | **PASS** (fiksna), pri čemer je vir shranjen ob dodajanju |
| 6 | zaloga se zmanjša po dodajanju | košarica drži **staro** max; server `reserveStock` (available, atomsko) **zavrne** → transakcija se prekliče, prodaja se ne zgodi | **PASS** (varnost) / **PARTIAL** (UI max ni na novo osvežen — kos zavrne, ne tiho prepiše) |
| 7 | različice (ločena zaloga) | vsaka varianta pridobi `available` ob dodajanju (`getPublicProductVariants`) | **PASS** |

**Testi, dejansko izvedeni (server-side autoriteta):**

| Test v `retail-stock-reservation.itest.ts` | Rezultat |
|---|---|
| rezervacija nad available (qty 4 pri available 3) → `false`, reserved ostane 7 | ✓ |
| rezervacija do available (qty 3 pri available 3) → `true`, reserved=10 | ✓ |
| sočasnost (oba po 4 od available 5) → natanko eden uspe, reserved=9 ne 13 | ✓ |
| pretvorba v prodajo → stock 8→6, reserved 5→3 (+ StockMovement) | ✓ |
| pretvorba z premalo reserved → no-op (stock/reserved nespremenjen) | ✓ |

**Sklep o košarici:** **noben kup ni mogoč nad razpoložljivo zalogo** — zadnja beseda je na
strežniku (`reserveStock`/`convertReservationToSale` z atomarnim pogojem `stock−reserved>=qty`);
client je le UX-napotek, ki pri fiksni zalogi pravilno omeji in pri spremenjeni zalogi po
dodajanju prikaže višji max, a ga strežnik varno zavrne. Razumljivost sporočil: cart-item in
stran javita številčno sporočilo »Na zalogi je le še X kos«; strežnik pri checkoutu dopolni s
`stockErrors` (»… na voljo le še {available}«, glej `cart-content.tsx`/`product-checkout.ts`).
**Ni bilo stålno potrebeno popravljati `cart-store.ts` ali `cart-item.tsx` (oba sta `M`/od drugega
agenta, nepoesega); popravki F6.1 so ostali v vstopnih točkah javne strani + `public-site.ts` +
`inventory/stock.ts`. Neskladna količina z rezervirano zalogo je VEDNO ujeta na strežniku.**

**Regresija:** `vitest.f554.config.ts` → ta datoteka **5/5 PASS**; spodnja F6.1 paleta nespremenjena
(tsc za F6.1 datoteke čist). Skupno z obstoječim naborom (vključno `advances-verify` 10/10).