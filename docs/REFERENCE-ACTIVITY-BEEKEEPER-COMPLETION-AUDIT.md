# MARKEC — CELOVITA REVIZIJA REFERENČNE DEJAVNOSTI ČEBELAR

> Revizija dejanskega stanja (koda + browser E2E + itest skozi faze 2A/2B/2C-1/2C-2 + prejšnje faze F6–F7).
> **Izključno pregled — nič spremenjeno.** Oznake: PASS / PARTIAL / FAIL / NOT VERIFIED / MISSING.
> Ne zamenjuj zaključene **arhitekturne faze** (2B/2C-1/2C-2 je kodirano in testirano) z **dokončano dejavnostjo**.
> Varovalno: tuj WIP (`prisma/schema.prisma`, `einvoices.*`) nedotaknjen; brez kode/sheme/migracij/produkcije/Git.

---

## A. Povzetek

**Ali je čebelar dokončan?** **NE.**

**Koliko je dejansko funkcionalno (dokazano v kod + testi + browser na f631)?**
- ✅ **Evidence (9 entitet):** panjska postaja, panj, družina, pregled, zdravljenje, hranjenje, matice/rojenje,
  opravilo, pridelek — **PASS** (CRUD prek univerzalnega records UI, entityReference povezave, org-scope).
- ✅ **Selitve družine (2C-2):** strežniška zgodovina `colony_move` + baseline + append-only + transakcije —
  **PASS (strežniško)**; UI zgodovine **MISSING (2C-3)**.
- ✅ **Univerzalno jedro:** org/workspaces + IDOR-izolacija, members/permissions, Product/shop/orders/zaloga
  (Stripe), stranke, spletna stran, dokumenti, records sistem — **PASS** (dokazano v COMPLETE §2 in itest f635).
- ⚠️ **Poslovna veriga vs »med in izdelki«:** pridelek → izdelek → zaloga → prodaja **NI e2e povezana**
  (glej C). To je glavna blokada poslovne uporabe.

**Kaj preprečuje dokončanje:**
1. **P1** — ni sledljivosti pridelek→(serija/)izdelek→zaloga; `harvest.product_reference` je goli text; ni pretvorbe kg→kozarec.
2. **P1** — ni UI zgodovine selitev (2C-3 ni odobreno/izvedeno) — dosegljivo samo strežniško.
3. **P1** — ni agregat/panel pridelka (kg per postaja/datum/vrsta, nizka zaloga) — dashboard je generičen.
4. **P1/P0** — production build **blokiran** s tujim WIP `einvoices.ts:51` (ne-async export → "Server Actions must be async") — ni deploya.
5. **P2** — ni pretvorbe v noge/količine iz `amount_kg` v `StockMovement` (unit handling ročno).

---

## B. Pregled funkcij (dejansko)

### B1. Čebelarske evidence (records) — vse prek univerzalnega sistema
| Funkcija | Status | Dokaz |
|---|---|---|
| Panjska postaja — CRUD · shranj. · reopen · org | **PASS** | records UI (f631 browser 2B/2C-1), itest 2B |
| Panj — CRUD · `apiary_ref` | **PASS** | itest 2B; entityReference picker |
| Čebelja družina — CRUD · `hive_ref` (single 2B) | **PASS** | itest 2B B0; browser 2C-1 |
| Pregled družine — CRUD · `colony_ref` | **PASS** | itest 2B |
| Zdravljenje · Hranjenje · Matice/rojenje — CRUD | **PASS** | records CRUD (2B browser), org-scope |
| Opravilo — CRUD · `colony_ref` + **multi `target_ref` (2C-1)** | **PASS** | itest 2C-1 10/10; browser multi picker |
| Pridelek medu — CRUD · `apiary_ref` + prosti `product_reference` | **PARTIAL** | same CRUD; **NI povezave na Product/stock/serijo** (goli text) |
| **Selitve družine (2C-2) — strežniško** (baseline, transakcija, append-only, korekcija, rekonstrukcija) | **PASS** | itest 2C-2 15/15 + rollback R1–R4 (19/19) |
| **UI zgodovine selitev** | **MISSING** | ni faza 2C-3 |

### B2. Poslovni procesi (A–H po naročilu)
| Področje | Status | Opomba |
|---|---|---|
| **A. Upravljanje čebelarstva** (postaja→panj→družina→pregled/tret/matice/task→selitev) | **PARTIAL** | Vse evidence in selitev strežniško delajo; **manjka UI za zgodovino selitev + agregat**. Osnovni tok skozi records je izvedljiv. |
| **B. Pridelava medu** (harvest datum/količina/vrsta/postaja + sledljivost izvora) | **PARTIAL** | `harvest.apiary_ref` kaže na postajo (izvor sledljiv na postajo); **ni serije → izdelka → zaloge** |
| **C. Predelava in izdelki** (med→kozarci, poraba, izdelek, povezava na pridelek/serijo, zaloga, neg-zaloga) | **MISSING (veriga)** | Product/stock/zaloga **deluje** (univerz. jedro), **a NI pretvorbe medu v izdelke, NI povezave izdelek↔pridelek/serija, NI izračuna porabljene količine**. `batch-production` lahko ročno veže `StockMovement.batchRecordId→batch`, vendar batch ni avtomatsko iz harvesta. |
| **D. Zaloga in skladišče** (vhod/izhod/popravki/premiki/serije/dobavitelji/zgodov./poročila) | **PASS (jedro)** / **PARTIAL (čebelar)** | `StockMovement` ledger + `NEGATIVE_STOCK` + batch/supplier link **deluje** (itest shop v COMPLETE §2). Čebelar nima **pretvorbe kg→kozarec** in količine/`amount_kg` nimajo enotne semantike → delno. |
| **E. Stranke in prodaja** (customer/order/items/stock verify/cena/popust/status/zgodovina) | **PASS** | univerzalno jedro (order + zaporedstek zaloge, atomsko) — COMPLETE §2 DOKAZANO |
| **F. Trgovina** (admin ustvari izdelek/slike/opis/cena/kategorija/zaloga/objava + naročilo) | **PASS** | shop full pot (Product single-source, Stripe checkout) — COMPLETE §2 |
| **G. Spletna stran** (ime/logo/slike/predstavitev/cenik/kontakt/objava/javno brez prijave) | **PASS** | branding-editor + publishedSiteContent + javna pot (COMPLETE §2, home-content layout } čebelar→products) |
| **H. Plačila in računi** (načini, evidencija, status, povezava z naročilom, računi, DDV, zneski, neuspeh) | **PARTIAL** | Stripe checkout + order/plačilo **deluje** (COMPLETE §2). **Računi/davčni dokumenti: ni davčno-ustreznosti trditev; dokumenti obstajajo, davčna veljavnost NI potrjena (potreben pravni pregled).** Obdelava neuspelih plačil se temelji na Stripe reshal (reservation.ts). |

### B3. UI — ali uporabnik ve, da je v ČEBELARSTVU
| | Status |
|---|---|
| Identiteta dejavnosti v glavi/nav/menu (profil registry, terminologija, A/B nav) | **PASS** (F7.1/F7.2 DOKAZANO) |
| Brez mešanja z drugimi dejavnostmi (terminologija se izriše iz profila; `/services` izklopljeno za čebelarja) | **PASS** (public page.tsx #58, services layout) |
| Professional čebelarski vtis (specifične čebelarske pano ž/form nedosežen; vse evidence v generičnem "Records" vmesniku) | **PARTIAL** — rec recordi uporabljajo generični table-form; **ni namenskega "čebelarskega dashboarda/layouta posamezne družine"** (kartica družine: trenutni panj+zgodovina → MISSING, 2C-3) |
| Mobilni prikaz | **PASS** (records responsive + tablice; nisem v tej reviziji ponovil polnega 390-E2E) → **NOT VERIFIED as z nova** (oznaka: PASS iz predhodnih f71/browser mobile) — označim NOT VERIFIED za ta pregled |

### B4. Varnost in izolacija organizacij
| | Status |
|---|---|
| Vse čebelarske records org-scoped (org iz seje/membership, fail-closed) | **PASS** (itest f635 7/7 + faza 2B/2C-1 cross-org) |
| Reference ne dovolijo križanja org (entityReference org+ext+key) | **PASS** (itest 2B C4/C5 IDOR; 2B itest 3/4) |
| Dovoljenja preverjena server-side (requirePermissionOrg per akcija) | **PASS** |
| Append-only zaščita (colony_move; generic CRUD → APPEND_ONLY) | **PASS** (itest 2C-2 D, 2C-2 R) |
| Ločeni workspaces istega uporabnika | **PASS** (membership-based org resolution; itest f635) |

### B5. Dejanski E2E (če varno; f631, čebelar)
Izvedeno v predhodnih fazah na isti f631 izolirani bazi (Playwright chromium), s testnimi podatki XC2-FIN-/XC2-Družina, nakar **pobrisani**:
1. Records (9 tabov) + CRUD postaja/panj/družina — ✅
2. entityReference single/multi picker + shranjevanje + reopen + refresh — ✅ (2B final + 2C-1 final browser)
3. Selitev družine `createColonyMove` (server) z baseline + append-only — ✅ (itest; UI izvajanja ni)
4. Trgovina + stranke + naročila + Stripe + spletna stran — **NOT VERIFIED v tej reviziji** (dokazano v COMPLETE §2 pred fazo; ni ponovno z E2E 20-korakov tu).
Scenarij (1)→(20) iz naročila: koraki do selitve(preverba zgodovine **UI MISSING**) → naprej pridelek/zaloga/izdelek veriga **MISSING**. Celoten scenarij **NI uspešen do konca** (post more E2E kot dovoljeno).

---

## C. Pregled poslovnih procesov (od začetka do konca)
- **Čebelarske evidence** — od začetka do konca **dela** (ustvari→poveži→shrani→reopen→org-scope).
- **Selitev** — strežniški tok **dela** (baseline→event→hive_ref); čez UI **prekinjen** (ni zgodovinskega panela/dodajanja selitve v UI) → **2C-3**.
- **Med→izdelek→prodaja** — **prekinjen**: harvest je ločen od Product/stock; izdelek urediš ročno v Shop/inventory, **ni povezave izvora**, ni pretvorbe → čebelar ne more slediti "koliko medu je šlo v ta kozarec".
- **Trgovina/plačila/spletna stran** — deluje kot GENERIČNO jedro; čebelar ju uporablja (products-first layout), ampak brez čebelarske sledljivosti iz medu.

---

## D. Manjkajoče funkcije (prioritete)
**P0**
- (nothing new: build-blocker `einvoices.ts` je tuj WIP — **ne moje**, P0 le kot deployment blokada.)

**P1**
- Povezava pridelek→(serija/)izdelek (po čebelarskem: harvest → StockMovement/Product z batchRecordId ali productVariant + `honey_type`), vključno **pretvorba kg→število kozarcev/volumen** (npr. 1 kg ≈ N × 250 g kozarcev) z definiranimi enotami.
- UI zgodovina selitev + dodajanje selitve + korekcija v družini (2C-3).
- Čebelarski agregat pridelka (kg per postaja/datum/vrsta) + low-stock opozorilo vezano na med.

**P2**
- Kartica družine (trenutni panj + zgodovina + brze panel) — profesionalen čebelarski vtis.
- Dashboard "Pregled pridelka/zaloge" spec za čebelarja.
- Enotno količinsko obravnavanje (enote, amount_kg ↔ stock quantity ob pretvorbi).

**P3**
- Varnostni intervali tretmaja (opozorilo ob prekrivanju; **brez davčno/pravne trditve**), odpravljanja pred zahtevami.
- Poročila (letni pregled, pridelek per leto).

---

## E. Predlog izvedbenih faz
- **Faza 2C-3 — UI zgodovine selitev:** panel družine (trenutna lokacija, zgodovina, dodaj selitev, korekcija, izvajalec+razlog), povezave panj/družina; E2E mobil.
  Datoteke: records-client/extension beseda/history del; odvisnosti: 2C-2 (done). Test: browser 19→ ravne.
- **Faza 2D-1 — Sledljivost pridelka→produkta:** `harvest` postane stock-source/BOM: pretvorba kg→enot, `StockMovement` z batchRecordId(=harvest ali batch iz harvest), serija iz harvesta, izdelek povezan z izvorom; atomsko (reuse inventory eng). Shema: **lahko zahteva majhno dodano polje na harvest ali relacijo — ločena odobritev + uskladitev s tujim WIP `schema.prisma`**. Test: unit+itest+E2E.
- **Faza 2D-2 — Agregat pridelka + dashboard:** kg per postaja/datum/vrsta iz pravih records, low-stock. Test unit+E2E.
- **Faza E — Izdelava čebelarskega r. kartice + mobilna preverba:** pro vtis družine/panja.
- **Faza F — (po odpravljenem einvoices WIP)** production build + regression + (za širšo uporabo) onboarding E2E 2 org.

## F. Referenčna arhitektura
**Univerzalno, prenesljivo v druge dejavnosti (NIKOLI kopirati kot per-org):**
- `entityReference` (single + multi 2B/2C-1), `appendOnly` dogodki + baseline (2C-2), worthWorks records, org-scope validacija, `createColonyMove`/`correctColonyMove` vzorec (kot generičen `moveByEvent` za vozila/termine/naročila).
- Product/shop/orders/stock/Stripe/stranke/spletna stran — popolnoma ponovni; `StockMovement` ledger + neg-zaloga.
**Čebelar-specifično (deklarativno, NE koda):**
- `bee-apiary` 10 entitet, `bee-apiary` extension; terminologija/barve; `batch-production`/`suppliers`.
**Izboljšati v univerzalnem jedru:** generičnega `entityReference` razreševanje/paneli; `derived report na ExtensionRecord` (za agregat pridelka);enoteke za stock (long numeric unit).
**Česa NE kopirati v druge dejavnosti:** pridelaštivene poti/shorthand `product_reference` text (nadomestiti z realno relacijo); hardkodirane čebelarske direkt zadaj v UI; append-only naming (`colony_move`) — v jedru naj bo generični `*_event`.

---

## G. Končna odločitev

**ALI JE ČEBELAR PRIPRAVLJEN ZA PRODUKCIJSKO UPORABO?** → **DELNO (NE — še ne).**

Blokade:
1. **P1** — veriga pridelek→izdelek→zaloga→prodaja **manjka** (ni sledljivosti izvora/pretvorbe). Brez tega "vodenje dejavnosti" ni realno.
2. **P1** — **UI zgodovine selitev manjka** (2C-3) — zgodovina je strežniška, uporabnik je v UI ne vidi.
3. **P1** — brez čebelarskega agregata pridelka/zaloge (dashboard generičen).
4. **P0-build** — production build blokira tuj `einvoices.ts` WIP (uskladitev lastnika) → ni deploya.

Arhitekturne faze 2B/2C-1/2C-2 so **zaključene in dokazane** (itest + browser), vendar **faze ≠ dokončan produkt**. Priporočam nadaljevanje po **Faza 2C-3 → 2D (sledljivost pridelek)→2D-2(agregat)** ob izrecnih odobritvah.

*(Revizija ni spremenila nič razen tega agregat poročila; tuj WIP nedotaknjen.)*