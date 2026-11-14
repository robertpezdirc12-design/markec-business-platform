# MARKEC — R2 — RAZREŠITEV BLOKADE TUJEGA WIP (P1-D-1A PRIORITY)

> READ-ONLY analiza tujega neoddanega WIP v `src/app/actions/product-checkout.ts` in priprava varne poti za
> P1-D-1A. **Nič kode ni spremenjeno; nič tujega WIP ni posegano; Git operacij nobenih; sheme/migracij/baze ni;
> `einvoices.ts` in ves tuj WIP nedotaknjen.** Statusi: EXISTING-VERIFIED / PASS / PARTIAL / FAIL / NOT VERIFIED /
> BLOCKED. P1-D-1A NI implementiran.

---

## 1. Trenutno stanje Git-a (EXISTING-VERIFIED)

- `src/app/actions/product-checkout.ts` — **tracked**, delovno drevo M (unstaged) = **+572/−81**.
- To JE del **širšega, meddatotečni sklopa WIP** (potrjeno):
  | Datoteka | Stanje |
  |---|---|
  | `src/app/actions/product-checkout.ts` | M |
  | `src/app/actions/stripe.ts` | M |
  | `src/app/api/webhooks/stripe/route.ts` | M |
  | `src/app/(admin)/dashboard/orders/[id]/page.tsx` | M |
  | `tests/entry-checkout-65-69.test.ts` | M |
  | brisanje migraciji (order-status / asset-provenance) | D |
  | einvoice feature (einvoices.ts, routes, lib/einvoice, i18n) | ?? (untracked) |
  | `prisma/schema.prisma` | M (tuj) |

→ **WIP ni omejen na eno datoteko**; gre za koherenten, medodvisen rezervacijsko/checkout/einvoice feature.

---

## 2. Pregled tujega diff-a v product-checkout.ts

- Diff dodaja **koherenten blok**: `applyOrderStockDecrement`, `reserveStock`, `releaseStockReservation`,
  `convertReservationToSale`, `AVAIL` makro, + obsežne predelave `createProductCheckoutSession` (odstranjevanje
  neposrednega `stockQuantity decrement` na koncu → prehod na rezervacijski tok) in `verifyProductOrder`.
- Gre torej za **en funkcionalni sklop (online checkout + rezervacije)**, ne naključne rahle spremembe.

---

## 3. Lastnišvo WIP

- **OWNER UNKNOWN** — ni commit-a, ni veje, ni sažetka; ni spremljajoče eksplicitne opombe o lastniku v diffu.
  (Dokaz F5.5.1/einvoice dela obstaja v projektu, a posedovanje posameznih vrstic ni ugotovljivo z `git`.)
- **Ni dokaza**, da je WIP funkcionalno preverjen ali testiran (testen file je spremenjen, a ni izveden tu).
- **NOT VERIFIED** glede statusa dokončanosti.

---

## 4. Dokazana napaka pri rezervirani zalogi (EXISTING-VERIFIED / FAIL)

- `applyOrderStockDecrement` (product-checkout.ts:98–99 variant; :117–118 product):
  `where: { id, stockQuantity: { gte: item.quantity } }` → **preverja `S ≥ qty`, NE `S − RES ≥ qty`**.
- Posledica: neposredna prodaja (prepaid/offline) lahko odšteje zalogo, ki je **že rezervirana** za druge kupce.
- Sestrske funkcije (`reserveStock` :174–179, `convertReservationToSale` :216–223) **že uporabljajo** `AVAIL`
  (`"stockQuantity" - "reservedQuantity" >= qty`) — torej pravilo `S−RES` je norma v tem sklopu; `applyOrderStockDecrement`
  ga krši → **FAIL / P0**.

---

## 5. Tehnična analiza predlaganega popravka (P1-D-1A)

**Predlagana smer (iz načrta):** atomin `UPDATE ... WHERE "stockQuantity" - "reservedQuantity" >= qty`.

**Preverbnjeno glede na trenutno kodo:**
- Funkcija trenutno uporablja `tx.productVariant.updateMany` / `tx.product.updateMany` z `{ stockQuantity: { gte } }`
  in nato `tx.stockMovement.create`.
- Prisma `updateMany` v `where` **ne podpira** primerjave `stockQuantity − reservedQuantity ≥` (samo literal);
  potrebna je **nadgradnja na raw-SQL** `$executeRawUnsafe` (kar sestrske `reserveStock`/`convert` že uporabljajo)
  ali razširitev pogoja z `AND: [{ stockQuantity: { gte } }, { reservedQuantity: ... }]` (kar je težje, ker zahteva
  razmerje med dvema stolpcema).
- **Priporočena tehnična rešitev:** pretvoriti `applyOrderStockDecrement` na **enaki `$executeRawUnsafe` vzorec**
  kot `convertReservationToSale` — `UPDATE "Product|ProductVariant" SET "stockQuantity" = "stockQuantity" - $2
  WHERE "id"=$1 AND "stockQuantity" - "reservedQuantity" >= $2`; count≠1 → `STOCK_CONFLICT_*` (obstoječa napaka);
  rezervacljiva `reservedQuantity` se NE zmanjša (direktna prodaja RES nespremenjena). `StockMovement OUT ORDER`
  ostane. To je **minimalno, atomsko, skladno z obstoječim vzorcem**, in ne poslabša transakcije.
- **Odvisnost:** posneti, da bo sprememba v `product-checkout.ts` — ki je trenutno tuj WIP.

---

## 6. Primerjava možnosti (A/B/C)

### Možnost A — počakamo na zaključek tujega WIP
- **Postopek:** lastnik commitа WIP (z svojimi testi); nato razsodila + P1-D-1A na čistem HEAD.
- **Pred:on:** najmanj tveganja (popravek na committed osnovi); ni konflikta z nezabeleženim stanjem; spremembe
  WIP-a ne pomešamo.
- **Slabost:** odvisno od lastnika; lahko traja; dokler ne — P1-D-1A ne.
- **Tveganje:** nizko (glavno časovno).

### Možnost B — izrecno dovoljen poseg v tuji WIP (najmanjši)
- **Postopek:** uporabnik izrecno odobri poseg SAMO v `applyOrderStockDecrement` (produkt+varianto) v
  `product-checkout.ts`; vse ostalo v fileho ostaja untouched; potem pregled diff-a.
- **Pred:on:** P1-D-1A je takoj varnostno zaprt; minimalen poseg (le 2 WHERE-guards → raw-SQL).
- **Slabost:** editiranje datoteke, ki je del nedovršenega meddatotečnega WIP; tveganje konflikta/inconsistency
  če WIP ni zrel (npr. sprememba v `verifyProductOrder`/webhook lahko povzroči mešano stanje).
- **Tveganje:** srednje — varnostno je ok, a integracijsko čaka, da WIP dozori; ✅ pogoj: minimalni diff + pregled
  celotnega incl. webhooka.

### Možnost C — ločena integracija (izoliran popravek)
- **Postopek:** določiti, ali je mogoče popravek vnesti ob strateškem (npr. nov helper) brez vmešavanja v
  `verifyProductOrder`; ali kopirati samo funkcijo v novo datoteko.
- **Pred:on:** izogne se urejanju kritičnega tujega bloka.
- **Slabost:** **največje tveganje duplikacije nekonsistentnosti** (navodilo izrecno prepove prepis/kopiranje cele
  datoteke kot obvoz); ustvari vzporedne poti; lahko razide z WIP-jem.
- **Tveganje:** visoko — napačno (duplicirana logika zaloge).

**Priporočilo:** **Možnost A** (najvarnejša, integriteta), z možnostjo B kot drugim korakom, **če** uporabnik
sprejme izrecni najmanjši poseg (le `applyOrderStockDecrement` raw-SQL guard) in potem takoj pregleda diff. **Ni
C** (prepovedano obvozno).

---

## 7. Ocena tveganj

| Tveganje | P | I | Ukrepi |
|---|---|---|---|
| Poseg v nezrel WIP (B) razide z webhook/verify | S | H | če B: takojšnja revizija B gotovo pred implement. |
| Popravek brez org/avtoritativnega nivoja | L | H | guard z org + variant-izbrn (kot ostali) |
| Dvojno knjiženje / ne-S-Veh-Movement | L | H | atomsko `UPDATE ... WHERE` + idem/čeka (1D) |
| Nerezer-viravanje na varianti | L | H | guard `S−RES` na varianti |

---

## 8. Natančni pogoji za varno nadaljevanje P1-D-1A

1. **Odločitev uporabnika:** naročiti (A) počakati na commit WIP, ALI (B) izrecno odobriti minimalen poseg v
   `product-checkout.ts`.
2. Pred posegom: celotnega diff-a review (`product-checkout.ts`, `stripe.ts`, webhook, orders, einvoice) — da se
   potrdi, da `applyOrderStockDecrement` ni pogojen z drugimi še-nedokončanimi deli.
3. Popravek = izključno 2 guard-a (product+variant) → raw-SQL `S−RES>=qty`; ne dotika ostalih delov funkcije.
4. `StockMovement OUT ORDER` ostaja; `reservedQuantity` se ne zmanjša; org-scope ohranjen.
5. Regresijski testi (spodaj) PASS; TypeScript čist; diff pregledan.
6. Implementacija šele po tej odobritvi.

---

## 9. Testi, potrebni za P1-D-1A

- Test A: prodaja > razpol. (S20/RES15/A5 → prodaja 6) → zavrnjeno; S=20/RES=15, 0 StockMovement (PASS).
- Test B: prodaja = razpol. (5) → S=15/RES=15, +1 OUT ORDER.
- Test C: ProductVariant (isto, da se spremeni varianta le, druge rezerve zadevajo).
- Test D: dve sočasni prodaji ne presežeta razpoložljive (concurrency).
- Test E: regresija (checkout, rezervacije, STOCKTAKE, P1-A/B/C) — obstoječi testi.

---

## 10. Ni bilo preverjeno (NOT VERIFIED)

- Posedovaľstvo/lastnik WIP (OWNER UNKNOWN).
- Funkcionalna zrelost/dokončano stanje WIP (ali testi WIP-a dejansko delujejo).
- Browser E2E checkout poti v tem WIP stanju.
- Ali drugi deli WIP-a (stripe/webhook/einvoice) še niso odvisnosti za `applyOrderStockDecrement`.

---

## 11. Končni predlog in predstavitev

- **Lastnik:** OWNER UNKNOWN (ni dokazljiv z git).
- **WIP dokončan?** NOT VERIFIED (ni dokaza; je obsežen, meddatotečen, nezdružen).
- **Najvarnejša možnost:** **A** (počakati na commit WIP-a, nato P1-D-1A). Če ne more čakati → **B** (izrecno
  dovoljen najmanjši poseg v `applyOrderStockDecrement`), NIKOLI C.
- **Kaj mora biti izpolnjeno za P1-D-1A:** (a) odločitev A ali B; (b) revizija celotnega diff-a; (c) najmanjši
  raw-SQL guard `S−RES>=qty` (product+variant); (d) enotni `STOCK_CONFLICT_*`; (e) testi A–E PASS; (f) tsc čist;
  (g) diff pregledan; (h) nova ločena izrecna odobritev za poseg in implementacijo.

---

## Potrditve
- Spremenjen samo ta poročilni dokument: DA.
- Kode ni spremenjeno (tudi ne `product-checkout.ts`): DA.
- `schema.prisma` nedotaknjen: DA.
- Ni migracij/baze/testnih podatkov/: DA.
- Git operacije niso izvedene: DA.
- `einvoices.ts` in tuj WIP nedotaknjeni: DA.
- `markec_dev`/produkcija nedotaknjena: DA.
- Faza 2D-1A ostaja neodobrena: DA.

**Ustavljam se.** P1-D-1A NI implementiran; ne nadaljujem na P1-D-1B. Za poseg v tuj WIP in za implementacijo
P1-D-1A je potrebna nova, ločena in izrecna odobritev.