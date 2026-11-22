# MARKEC — SKD 678 pokritost: Gap analiza (Faza 0/1, izvedljiva)

> **Stanje:** read-only analiza na veji `feat/skd-678-coverage-register`, nad `main` = `d8bcba6`.
> **Vir podatkov:** register `src/lib/skd/activity-coverage.ts` + stvarni resolver/profili
> (SURS KLASJE SKD 2025 V1). Vsako število je **izračunano iz aktualne kode**, ne trdo zapisano.
> **Datum:** 2026-11-22.

## 0. Uvod

Ta dokument izhaja iz **istega verodostojnega vira** kot `docs/SKD-2025-COMPLETE-COVERAGE.md`
(tj. `activity-coverage.ts`). Register loči **deklaracijo** (kaj profil zapiše) od **runtime**-a
(kaj je dejansko delujoče in preverjeno). Nobena vrstica ni označena kot »poslovno preverjena«
brez dokaza (strežniške akcije + testi).

## 1. Izmerjena pokritost (poverno z merjenjem, ne z obljubo)

| Nivo | Oznaka | Št. | Pomen |
|---|---|---:|---|
| A specializirana | A | **0** | izrecna preslikava podrazreda/oddelka + DOKAZAN PROFIL-SPECIFIČEN runtime (akcije + test, ki poganja prav ta profil). Trenutno NITI eden (dokazi A so bili iz drugih profilov — revidirano v PR #142) |
| B arhetip | B | **0** | podrazredno 5-mestna preslikava na profil, ki res služi prav ta podrazred (nie avtomatska promocija sekcije za obstoj obrazca) |
| C osnovna | C | **0** | dokumentirano »osnovna konfiguracija zadostuje« — nič se ne dodeli samodejno |
| D nepopolna | D | **678** | preslikava obstaja, a ocena pokritosti zmožnosti pokaže dokazni manko — razčlenitev spodaj: 380 vrstic ima `no-template` (forms/workflows/workOrders `required` z 0 predlog) in je hkrati tudi `not-delivered`; 298 jih ima SAMO `not-delivered` (`context-limited` `required`, npr. `analytics`) ali `delivery`; + 2 izjemi (S92) |
| E nepokrita | E | **0** | resolver nikoli ne pade na generični fallback za katalogirane kode |
| Ni ocenjeno | — | **0** | pokritost zmožnosti je ocenjena za VSEH 678 vrstic; ločeno je kljub temu celoten nabor `fit=not-assessed` |

**Skupaj:** 678 podrazredov — **vsi D** (0 A + 0 B + 0 C + 678 D + 0 E + 0 ni-ocenjeno).

> **Razčlenitev D = 678 (iz tekoče kode `missingRequiredCapabilities`, ne ročnega seznama):**
> - **380** vrstic: profil deklarira `forms`/`workflows`/`workOrders: required` z **0 predlog**
>   (`no-template`, deklaracija brez materializacije). Prav teh 380 **ima hkrati tudi
>   `not-delivered`** vrzel (noben profil, ki mu manjka predloga, nima obenem `analytics`
>   pokritih univerzalno).
> - **298** vrstic: SAMO `not-delivered` vrzel (ni `no-template`) — profil zahteva
>   `context-limited` zmožnost (`analytics`, `appointments`, `services`, `cashRegister`)
>   ali `delivery`, za katero NI univerzalnega modula.
> - **2** izjemi (S92 igre na srečo) — že všteti v 678.
> - Vsota: 0 + 298 + 380 = **678**. `380 + 2` iz prejšnje različice je bil **podmnožica**
>   D, ne celotni D.
> - **`fit`:** 0 `verified` / 678 `not-assessed`. Vrstica z `Oznaka=D` in `Status=assessed`
>   NIMA dokazane poslovne ustreznosti (fit) — to sta dve različni dimenziji.

> **Ključna sprememba od prejšnje različice:** prejšnja različica je imela »D = 382« in
> »ni-ocenjeno = 296« ter »documents/cashRegister = dobavljeno univerzalno v jedru«. To je
> bilo **nehonostno** na dva načina: (1) vrstice brez dokazane poslovne ustreznosti so štele
> kot `not-assessed`, čeprav je ocena evidence-gapa pokazala D; (2) kapaciteta `cashRegister`
> (in indirectno `analytics`) je veljala za univerzalno, čeprav je v naboru `context-limited`.
> Nova metodologija **oceni pokritost zmožnosti za vseh 678** (od tod 678 D) in **ločeno**
> vodi poslovno ustreznost (fit=0/678). A/B/C ostajata **0**, dokler ni podrazredno-specifičnega
> dokaza. Dokumenti (`documents`) so `universal` in `required` dokumenti NISO vrzel;
> `cashRegister` pa je `context-limited` in `required` blagajna JE vrzel.
>
> **Revizija PR #142 (to je nova različica):** posodobljena sta tudi **A (12 → 0)** in
> **B (27 → 0)**. Prejšnji A/B sta počivala na runtime dokazih iz **drugih profilov**
> (`seamstress` → `apparel`, `tire-service` → `mehanik`, generični booking → frizer/beauty/massage/tattoo)
> ali na **knjižničnem** testu gradbenega engine-ja (ne na materializiranem profilu
> `skd-f-construction`). Nobena obstoječa A/B vrstica **ni imela** testa, ki bi poganjal
> prav ta profil skozi realno materializacijo (`materializeProfileAssets`). Po pošteni
> reviziji ti podrazredi ostanejo **`fit=not-assessed`/D**, dokler profil-specifični test ne obstaja.
> Skupno D = **678** (380 no-template + 298 only-not-delivered + izjeme) — trdna, profil-agnostična vrzel.

## 2. Deklaracija vs. runtime (glavni arhitekturni vrzel)

Merjenje: za vsak profil primerjamo **deklarirane zmožnosti** (iz obravnavanega nabora:
`appointments, workOrders, shop, services, inventory, customers, staff, analytics, forms,
workflows, documents, delivery, cashRegister`) z **dejanskimi dokazi** (predloge + runtime).

### 2a. Template-vrzel (deklaracija `required` brez predlog) — podmnožica D = 380

> **AGREGAT (iz tekoče kode `missingRequiredCapabilities`, ne ročnega seznama):**
> - **380** podrazredov (od skupnih **678 D**) leži na profilih, ki deklarirajo
>   `forms`/`workflows`/`workOrders: required` in imajo **0 predlog** (`no-template`,
>   deklaracija brez materializacije). To je **podmnožica** D — **ne** celotni D.
> - Prav teh 380 ima hkrati tudi `not-delivered` vrzel (noben tak profil nima
>   `analytics` pokritih univerzalno) — tj. 380 ∈ {vrstice z `no-template`} ∈ D.
> - Preostalih **298** D-podrazredov ima **samo `not-delivered`** vrzel
>   (in `no-template` napačno ni) — glej 2c.
> - **S92 izjemi (igre na srečo) nista v 380** — preslikani sta na `skd-s-culture-sport`
>   (v 298 bucketu), torej 380 (no-template) + 298 (samo not-delivered) = **678**.

| Profil | Podrazredov z `no-template` | Deklarira workflows | Deklarira forms | Dejanskih procesov | Dejanskih form |
|---|---:|---|---|---:|---:|
| `skd-c-manufacturing` | **227** | ✓ | ✓ | 0 | 0 |
| `skd-h-transport` | 30 | ✓ | ✓ | 0 | 0 |
| `skd-r-health` | 22 | ✓ | ✓ | 0 | 0 |
| `skd-l-finance` | 20 | ✓ | ✓ | 0 | 0 |
| `skd-b-mining` | 15 | ✓ | ✓ | 0 | 0 |
| `skd-j-media` | 15 | – | ✓ | 0 | 0 |
| `skd-q-education` | 13 | – | ✓ | 0 | 0 |
| `skd-d-energy` | 12 | ✓ | ✓ | 0 | 0 |
| `skd-e-water-waste` | 11 | ✓ | ✓ | 0 | 0 |
| `skd-p-public-admin` | 9 | ✓ | ✓ | 0 | 0 |
| `skd-m-real-estate` | 5 | – | ✓ | 0 | 0 |
| `skd-v-international` | 1 | ✓ | ✓ | 0 | 0 |

> **Popravljeno (Revija P2):**
> - Ta tabela meri **`no-template` podmnožico** (380), ne celotnega D. Za celotno
>   razčlenitev 678 = 380 (no-template ∩ not-delivered) + 298 (samo not-delivered) + izjeme glej 2c.
> - `skd-g-retail` in `skd-n-professional` deklarirata `forms`/`workflows` kot **`optional`**
>   (ne `required`), zato NE spadata v »zahtevano-a-nedostavljeno« template-vrzel. Njunih
>   86+27 podrazredov je v D po drugi poti (`not-delivered`/`context-limited`), ne po template-vrzeli.
> - `skd-c-manufacturing` je **227**, ne 233 — 6 podrazredov oddelka **C14** se razreši na
>   `apparel` (division-override), ne na `skd-c-manufacturing`.

### 2c. Context-limited `required` in `delivery` — preostali del D = 298

> **Skupen platformni evidence-gap, PONOVLJEN čez preslikave, NE podrazredno dokazana
> nepopolnost.** Vsak profil, ki deklarira `analytics: required` (in vse 28 profilov, ki jih
> SKD-resolver dejansko uporablja, to deklarirajo), dobi `not-delivered`, ker je `analytics`
> v seznamu zmožnosti `context-limited` (ni univerzalnega modula; strežniška akcija
> `/analytics` ni uvrščena v profile-specific dokaze). Isto velja za `appointments`/`services`/
> `cashRegister` (vsi `context-limited`) in `delivery` (nima lastnega strežniškega modula).
>
> - **298** podrazredov ima **samo** to pot (no `no-template`): to so profili, ki nimajo
>   template-vrzeli, a kličejo eno ali več `context-limited`/`delivery` zmožnosti.
> - **380** podrazredov ima BOTH (template-vrzel + `context-limited`), zato so v**š**teji v 2a.
> - **Mehanska resnica:** vsaka od 678 vrstic **NI posebej preverjena** kot nepopolna — isto
>   `analytics`-evidence-gap se lahko upravičeno ponavlja. Noben profil-specifičen test ne
>   poganja `getKPIData`/`getRevenueChartData`; zato smo `analytics` **obdržali `context-limited`**
>   in ne »povišali na universal samo zaradi števila D«. Poslovna ustreznost (fit) ostaja
>   `not-assessed` (0/678) in se ne šteje za dokazano s tem platformnim dokazom.

### 2b. Profili z dokazanim runtime (referenčno, za ponovno uporabo)

> **Deklaracija ≠ runtime.** `forms`/`workflows`/`extensions` v tem stolpcu so **deklarirane
> predloge**. Sklic na test datoteke v stolpcu »Dokaz« je tisto, kar te profile loči od
> tistih, ki zgolj deklarirajo.

| Profil | Forme | Procesi | Razšir. | Podrazredov | Status | Dokaz (koda/testi) — in zakaj status NI A/B |
|---|---:|---:|---:|---|---|---|
| `skd-f-construction` | 2 | 1 (10-fazni) | documents | 27 | not-assessed | gradbeni engine je preverjen, a test je **knjižnični** (`work-order-inquiry` preverja title/due-date parsing); NITI eden test ne materializira `construction-inquiry`/`construction-handover` in ne poganja 27 F-podrazredov skozi profil |
| `apparel` | 2 | 1 | 3 | 6 (C14) | not-assessed | dokaz iz **`seamstress`** (drug profil) — test kreira `vertical:"seamstress"` + ročno zaseje workflow; ne uporabi `apparel`-profilnega `order-details` formularja |
| `mehanik` | 1 | 1 | 2 | 2 | not-assessed | dokaz iz **`tire-service`** — test kreira `vertical:"tire-service"`; ne poganja `mehanik` `vehicle-intake` formularja (`last_service`) |
| `frizer` | 1 | 0 | 1 | (0 ročno SKD) | not-assessed | dokaz je **generični booking**; `beauty`/strokovni e2e termin se ustvari prek **DB-fixture**, ne prek strežniške akcije `createAppointment` |
| `beauty` | 0 | 0 | 1 | 1 | not-assessed | dokaz je **generični booking** (noben test ne omenja tega profila); `beauty` e2e naredi termin prek **DB-fixture**, ne prek strežniške akcije `createAppointment` |
| `massage` | 1 | 0 | 1 | 1 | not-assessed | dokaz je **generični booking**; ni profil-specifičnega runtime testa |
| `tattoo-studio` | 2 | 0 | 1 | (0 ročno SKD) | not-assessed | dokaz je **generični booking**; ni profil-specifičnega runtime testa |
| `seamstress` | 2 | 1 | 3 | (0 ročno SKD) | — | obstaja lasten itest (materializiran? ne — ročno zasejan), a ni del SKD preslikave |
| `beekeeping` | 1 | 0 | 2 | (0 ročno SKD) | — | lasten e2e, a ni del SKD preslikave |

*»not-assessed« pomeni: poslovna ustreznost za ta podrazred za zdaj NI dokazana. Skupno jedro
platforme (booking, work-orders, e-šop) je sicer DELOMA UNIVERZALNO (npr. `documents`) — a
**`cashRegister`/`analytics`/`appointments`/`services` so `context-limited`, ne universal**,
zato njihov `required` ostane iskrena vrzel (D). Obstoj jedrnih modulov NI dokaz, da prav
konfiguracija tega profila pokriva prav ta podrazred (fit).*

### 2d. Status zmožnosti po trenutnem `CAPABILITY_EVIDENCE`

| Zmožnost | Scope (evidence) | `required` povzroči D? | Pojasnilo |
|---|---|---|---|
| `appointments` | `context-limited` | ✓ | booking engine obstaja, a izvedba je vezana na profil; splošni dokaz ne velja za vsak presežek. |
| `workOrders` | `context-limited` | pri 0 predlog | `createWorkOrder` vrne `NO_WORKFLOW`, ko ni tenant `workflowDefinition` s stopnjami. Pokrita LE, kadar profil deklarira ≥1 predlogo; **merimo deklaracijo/materializacijsko prehod, ne runtime-odbote** če ni testa. |
| `services` | `context-limited` | ✓ | storitveni katalog je per-tenant; ni univerzalnega dokaza za vsak profil. |
| `analytics` | `context-limited` | ✓ | strežniška akcija `/analytics` NI profil-specifično poganjana; `getKPIData`/`getRevenueChartData` nimata E2E dokaza. Obdržano `context-limited` (ne dvignjeno na universal samo zaradi števila D). Skupen evidence-gap, ponovljen čez 678. |
| `cashRegister` | `context-limited` | ✓ | direct-sale poganja le `direct-sale.ts`; strežniške akcije `cash-register.ts` NISO testno poganjane. NI »dobavljeno v jedru za VSE« — prejšnja trditev popravljena. |
| `documents` | `universal` | ✗ | jedrni dokumentni + e-računski tok je preverjen; `required` dokumenti NISO vrzel. |
| `delivery` | (nima last. strež. modula) | ✓ | le `recordDelivery`/prevzem v inventuri + work-order rokovanje; `required` dostava je iskrena vrzel. |

> Ti scope-i izhajajo iz `CAPABILITY_EVIDENCE` v `activity-coverage.ts` in `isPlatformDeliveredCapability()`
> (universal ⇒ dobavljeno; context-limited ⇒ `required` = vrzel). Dokumenti so univerzalni; blagajna
> NI. Retail (`skd-g-retail`) deklarira forme/workflowe kot **optional** — NE sodi v template-vrzel.

## 3. Terminološki premozki

- README (vrstica 39) je **zastarel**: piše »12 poimenovanih + 24 SKD-sekcij, ~500 SKD«,
  medtem ko register pokriva **678**. Profilni register sploh vsebuje **36** profilov;
  od teh **28** dejansko uporablja sedanji SKD-resolver (678 preslikav) — **22 sekcijskih
  (`skd-…`) + 6 specializiranih** (`apparel`, `beauty`, `frizer`, `massage`, `mehanik`,
  `tattoo-studio`). Preostalih **8** (npr. `seamstress`, `tire-service`, `beekeeping`) so
  ločeni specializirani profili, ki NISO del 678 SKD-preslikav — NE trditi, da jih resolver uporablja.
- `TerminologySet` pokriva jedro (appointment/order/service/product/customer/bookingCta) — ne
  pokriva pa terminov za **workflow stopnje, proxy evidence, javne CTA po korakih**.
- Proizvodnja in trgovina **NISTA terminološko prazni**: `skd-c-manufacturing` (tovarna / Delovni
  nalog / „Oddaj povpraševanje“) in `skd-g-retail` imata lastno profilno terminologijo. Procesna
  vrzel pa ni enaka za oba:
  - `skd-c-manufacturing` deklarira **workflowe/form-e kot required, a z 0 materializiranih
    predlog** → prava zahtevana-template vrzel (D).
  - `skd-g-retail` deklarira **workflowe/form-e kot optional** → NI zahtevane-template vrzeli;
    ostaja `not-assessed`, ker ni dokazanega profilnoposebnega pokritja (business fit), in tudi ni
    v makro procesne vrzeli, ki bi terjala nov univerzalni proces.

## 4. Največje priložnosti (kjer je 1 arhetip = mnogo dejavnosti)

| Arhetip | Št. SKD podrazredov | Področje | Stanje |
|---|---:|---|---|
| Proizvodni proces (proizvodni nalog + serije + zaloge) | 233 | sekcija C | deklaracija, ni runtime (`skd-c-manufacturing`) |
| Trgovina/vzdrževanje (maloprodaja + servis) | 86 | sekcija G | not-assessed; ni dokazane fit (`skd-g-retail`: forms/wf optional) |
| Kmetijsko-živinorejska pridelava | 39 | sekcija A | not-assessed; obstaja le čebelarski vertikal |
| Transport in logistika | 30 | sekcija H | deklaracija, ni runtime (`skd-h-transport`) |
| Gostinstvo (HORECA) | 18 | sekcija I | not-assessed (`skd-i-hospitality`) |

## 5. Ocena izvedbe (predlog — ne spreminjamo še)

> **Razmerje do EPIC-2 (`docs/EPIC-2/PLAN.md`):** EPIC-2 obravnava univerzalni poslovni
> konfiguracijski motor (vrzeli G1–G8). Ta analiza je komplementarna: kvantificira
> **SKD-pokritost na nivoju vseh 678 podrazredov** in razporedi, kje v EPIC-2 sprinterje
> manjkajoči procesi spadajo.

1. **Register** (`activity-coverage.ts`) + testi. **To je osnova vseh faz.**
2. **Validacija registrov** — dodati pravilo ANTI-deklaracije: profil, ki deklarira
   `workflows: required`, MORA imeti vsaj 1 `workflows: [...]` predlog (ali biti not-assessed).
3. **Arhetipi:** za 3–5 največjih skupin (C, G, A, H, I) pripraviti ločene poslovne procese +
   terminologijo, ki se deklarativno prilepijo na obstoječe profile (specializacije).
4. **Vsak korak** = majhen PR; testi pokritosti ob vsakem.

## 6. Status / odprta vprašanja

- SKLADNO z EPIC-2 G1/G2/G4 (`docs/EPIC-2/PLAN.md`); ta dokument doda SKD-nivo.
- ODPRTO: ali `batch-production`, `bee-apiary`, `vehicle-workshop` razširitve pokrivajo
  serije/žetev/vozila v runtime. V registerju so dokazane le tiste z lastnimi akcijami + testi
  (vehicle-workshop, bee-apiary, batch-production, seamstress). Obravnava: EPIC-2 G1/G2.
- ODPRTO: razmejitev z EPIC-2 — isto aditivno, malo-koračno načelo.
- ODPRTO: README opis (vrstica 39) — potrditi, da register (36 profilov; 28 v 678-SKD-preslikavi) postane kanoničen.