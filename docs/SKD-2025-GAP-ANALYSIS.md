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
| D nepopolna | D | **382** | zahtevana zmožnost iz obravnavanega nabora brez dokaza (forms/workflows `required` brez predlog; `delivery` je edina neuniverzalna — documents/cashRegister je platforma dobavljena v jedru), ali zapisana izjema |
| E nepokrita | E | **0** | resolver nikoli ne pade na generični fallback za katalogirane kode |
| Ni ocenjeno | — | **296** | sekcijski privzetek brez profil-specifičnega dokaza ali dokumentirane podlage |

**Skupaj:** 678 podrazredov. Od tega je **382 ocenjenih** (vsi nivo D) in **296 not-assessed**.

> **Ključna sprememba od prejšnje različice:** prejšnja različica je imela »C = 638« in
> »D = 2«. To je bilo **nehonostno**: vrstice z `forms==0` so bile samodejno C, čeprav to NI
> dokaz ustreznosti. Nova metodologija takšne vrstice označi kot **not-assessed** ali **D**
> (kadar profil zahteva `required` zmožnosti, ki jih ne dostavi). C je zdaj **0**, dokler ne
> bo strokovno dokumentiranega primera. Ta sprememba je hotena in je bistvo revizije.
>
> **Revizija PR #142 (to je nova različica):** posodobljena sta tudi **A (12 → 0)** in
> **B (27 → 0)**. Prejšnji A/B sta počivala na runtime dokazih iz **drugih profilov**
> (`seamstress` → `apparel`, `tire-service` → `mehanik`, generični booking → frizer/beauty/massage/tattoo)
> ali na **knjižničnem** testu gradbenega engine-ja (ne na materializiranem profilu
> `skd-f-construction`). Nobena obstoječa A/B vrstica **ni imela** testa, ki bi poganjal
> prav ta profil skozi realno materializacijo (`materializeProfileAssets`). Po pošteni
> reviziji ti podrazredi ostanejo **not-assessed**, dokler profil-specifični test ne obstaja.
> D = **382** ostaja — to je trdna, profil-agnostična vrzel (deklarirano `required` brez predlog + izjeme).

## 2. Deklaracija vs. runtime (glavni arhitekturni vrzel)

Merjenje: za vsak profil primerjamo **deklarirane zmožnosti** (iz obravnavanega nabora:
`appointments, workOrders, shop, services, inventory, customers, staff, analytics, forms,
workflows, documents, delivery, cashRegister`) z **dejanskimi dokazi** (predloge + runtime).

### 2a. Profili, ki deklarirajo `workflows: required` in/ali `forms: required`, a nimajo predlog

> **AGREGAT (iz registerja, ne ročnega seznama):**
> - **347** podrazredov na profilih z `workflows: required` in **0** workflow predlog;
> - **33** dodatnih podrazredov na profilih z le `forms: required` in **0** forma predlog;
> - skupaj **380** podrazredov (56 %) na profilih, ki zahtevajo runtime, ki ga ne dostavijo;
> - poleg tega **2** evidentirani izjemi (S92 igre na srečo) → skupaj D = **382**.

| Profil | Podrazredov na njem | Deklarira workflows | Deklarira forms | Dejanskih procesov | Dejanskih form |
|---|---:|---|---|---:|---:|
| `skd-c-manufacturing` | **227** (233 − 6 C14→apparel) | ✓ | ✓ | 0 | 0 |
| `skd-h-transport` | 30 | ✓ | ✓ | 0 | 0 |
| `skd-r-health` | 22 | ✓ | ✓ | 0 | 0 |
| `skd-l-finance` | 20 | ✓ | ✓ | 0 | 0 |
| `skd-b-mining` | 15 | ✓ | ✓ | 0 | 0 |
| `skd-d-energy` | 12 | ✓ | ✓ | 0 | 0 |
| `skd-e-water-waste` | 11 | ✓ | ✓ | 0 | 0 |
| `skd-p-public-admin` | 9 | ✓ | ✓ | 0 | 0 |
| `skd-v-international` | 1 | ✓ | ✓ | 0 | 0 |
| `skd-q-education` | 13 | – | ✓ | 0 | 0 |
| `skd-m-real-estate` | 5 | – | ✓ | 0 | 0 |
| `skd-j-media` | 15 | – | ✓ | 0 | 0 |

> **Popravljeno (Revija P2):**
> - `skd-g-retail` in `skd-n-professional` sta bila **umaknjena** iz zgornje tabele —
>   oba deklarirata `forms`/`workflows` kot **`optional`** (ne `required`), zato NE spadata v
>   »zahtevano-a-nedostavljeno«. Njunih 86+27 podrazredov se uvrsti med **not-assessed**
>   (ni vrzeli v deklaraciji, a tudi ni dokazane poslovne ustreznosti).
> - `skd-c-manufacturing` je **227**, ne 233 — 6 podrazredov oddelka **C14** se razreši na
>   `apparel` (division-override), ne na `skd-c-manufacturing`.

### 2b. Profili z dokazanim runtime (referenčno, za ponovno uporabo)

> **Deklaracija ≠ runtime.** `forms`/`workflows`/`extensions` v tem stolpcu so **deklarirane
> predloge**. Sklic na test datoteke v stolpcu »Dokaz« je tisto, kar te profile loči od
> tistih, ki zgolj deklarirajo.

| Profil | Forme | Procesi | Razšir. | Podrazredov | Status | Dokaz (koda/testi) — in zakaj status NI A/B |
|---|---:|---:|---:|---|---|---|
| `skd-f-construction` | 2 | 1 (10-fazni) | documents | 27 | not-assessed | gradbeni engine je preverjen, a test je **knjižnični** (`work-order-inquiry` preverja title/due-date parsing); NITI eden test ne materializira `construction-inquiry`/`construction-handover` in ne poganja 27 F-podrazredov skozi profil |
| `apparel` | 2 | 1 | 3 | 6 (C14) | not-assessed | dokaz iz **`seamstress`** (drug profil) — test kreira `vertical:"seamstress"` + ročno zaseje workflow; ne uporabi `apparel`-profilnega `order-details` formularja |
| `mehanik` | 1 | 1 | 2 | 2 | not-assessed | dokaz iz **`tire-service`** — test kreira `vertical:"tire-service"`; ne poganja `mehanik` `vehicle-intake` formularja (`last_service`) |
| `frizer`/`beauty`/`massage`/`tattoo-studio` | 1 | 0 | 1 | 4 | not-assessed | dokaz je **generični booking** (noben test ne omenja teh profilov); `beauty` e2e naredi termin prek **DB-fixture**, ne prek strežniške akcije `createAppointment` |
| `seamstress` | 2 | 1 | 3 | (0 ročno SKD) | — | obstaja lasten itest (materializiran? ne — ročno zasejan), a ni del SKD preslikave |
| `beekeeping` | 1 | 0 | 2 | (0 ročno SKD) | — | lasten e2e, a ni del SKD preslikave |

*»not-assessed« pomeni: poslovna ustreznost za ta podrazred za zdaj NI dokazana. Skupno jedro
platforme (booking, work-orders, e-šop) je sicer UNIVERZALNO DOKAZANO in ponovno uporabno,
vendar to ni dokaz, da prav konfiguracija tega profila pokriva prav ta podrazred.*

## 3. Terminološki premozki

- README (vrstica 39) je **zastarel**: piše »12 poimenovanih + 24 SKD-sekcij, ~500 SKD«,
  medtem ko register vsebuje **14 specializiranih + 22 SKD** sekcijskih profilov in pokriva **678**.
- `TerminologySet` pokriva jedro (appointment/order/service/product/customer/bookingCta) — ne
  pokriva pa terminov za **workflow stopnje, proxy evidence, javne CTA po korakih**; obsežni
  panogi (proizvodnja, trgovina) sta terminološko prazni.

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
- ODPRTO: README opis (vrstica 39) — potrditi, da register (14 + 22 = 36) postane kanoničen.