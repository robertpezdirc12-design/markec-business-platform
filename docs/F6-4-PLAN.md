# MARKEC — F6.4 NAČRT (Vizualni urejevalnik spletne strani)

> Pripravljalna dokumentacija (Phase plan) — **pred kakršno koli spremembo kode**. Namen:
> potrditi dejansko stanje (F6.1–F6.3.5.1), določiti obseg F6.4, E2E scenarije, potrebne teste
> ter merila PASS/PARTIAL/FAIL/NOT VERIFIED. Po potrditvi tega načrta se F6.4 šele začne.

---

## 1. Cilj in obseg F6.4

**Cilj (strateški načrt §F6.4):** dokončati in **celovito verificirati** lastniški vizualni
urejevalnik spletne strani — podjetnik lahko v pravem browserju po "klikni-sekcijo-uredi" vodi:
uredi katero koli sekcijo → naloži/nadomesti fotografijo → premakne/doda/odstrani sekcijo →
predogled (mobilni/desktop) → shrani osnutek → objavi = javna stran prikaže spremembo.

**Obseg F6.4 (verifikacijsko usmerjen, ne nova velika gradnja):**
1. Počistiti/popolni avtomatiziran **Playwright E2E** vizualnega urejevalnika (manjka; danes le ročni MCP dokaz).
2. Zapolniti **manjkajoče module-sekcije v urejevalniku**: aktivni vklop/izklop modula galerije in FAQ
   (in da se ob izklopu sekcija skrije z javne, enako kot `reviews` iz F6.3.5.1).
3. Celovit E2E za vse 4 dejavnosti (mehanik/frizer/šivilja/čebelar) v navoju "uredi → shrani → objavi → javno".
4. Mobile/desktop (390/768/1440) toogle v urejevalniku + dejanski mobilni pregled **za vse 4** (doslej
   frizer/šivilja/čebelar samo sklep iz kode — PARTIAL).
5. Fotografije (upload/Cloudinary) — dodaj, nadomesti, predogled, objava.
6. Regresija celotnega paketa (vitest + e2e) brez lomba obstoječega.

**Izven obsega F6.4:** F6.5/F6.6/F6.7 (trgovina zaloga/dostava; rezervacije/delo; dashboard) —
niso predmet te faze, le **funkcionalna preverba end-to-end** (glej §5) kot vhod za naslednje faze.

## 2. Dejansko obstoječe funkcionalnosti (dokazano iz F6.1–F6.3.5.1)

| Območje | Dokaz | Status dokaza |
|---|---|---|
| Spletna stran — urejanje → shrani → predogled → objava → javna | F6.3.3 (4 tenanti, `publishedContentVersion` 1→2, javna h1) | **PASS** |
| Mobilna odzivnost (365/375 px, no overflow) | F6.3.2/F6.3.3 (vse 4) | **PASS** |
| Vizualni editor (ifcrame preview, postMessage, DeviceId 390/768/1440) | `site-visual-editor.tsx` (branje): DeviceId toggle, EditorMode (Sekcije/Barve/Navigacija/Predloge), section-select, addSection, reorder, remove, save/publish/revert | Implementirano v kodi; **rok E2E editorja** |
| Fotografije (upload/Cloudinary, `handleImageForSection`) | `site-visual-editor.tsx` `uploadImage` + `applyImageField` | Implementirano; **brez dokazanega predogleda/objave v E2E** |
| Modul izklopa (reviews → sekcija skrita) | F6.3.5/F6.3.5.1 (lastniški + javni predogled browser E2E) | **PASS** (le reviews) |
| Trgovina end-to-end (katalog → košarica → checkout) | F6.1 (zaloga/`computeAvailableStock`, reserveStock → sale); F6.3.2 (košarica dodaj, 6 izdelkov, reviews) | **PASS** (zaloga), PARTIAL za poln checkout E2E v F6.5 |
| Rezervacije / povpraševanja (booking / inquiry, 307 routing) | F6.3.2 (frizer/mehanik → booking; šivilja/čebelar → inquiry, 307) | **PASS** (routing), PARTIAL poln termin→potrditev v F6.6 |
| Profili dejavnosti (34, capabilities/forms/workflows; materialize) | F6.2 (registry + materialize + f501 test) | **PASS** |
| Varnost (pisanje org-scoped, read IDOR odtranjen, fail-closed) | F6.1/F6.3.4/F6.3.5 (itest 7/7, org-isolation) | **PASS** |
| E2E suite (Playwright) | `e2e/*.spec.ts` (beauty/beekeeping/seamstress/golden-order/idor/custom-domain/…) | Obstaja, **brez vizualnega editor spec-a** |

## 3. Ugotovljene pomanjkljivosti (vhod v F6.4)

1. **Ni avtomatiziranega Playwright E2E spec-a za vizualni urejevalnik** (klikni-sekcijo-uredi,
   mobile toggle, shrani/objavi na javnem). Danes le ročni Chrome-DevTools dokaz (F6.3.3).
2. **Galerije in FAQ** imajo render (content-galleries-faq) in dashboard tab "Galerije in vprašanja",
   ampak **niso del pogojevanja z `OrganizationModuleState` v vizualnem editorju** in nimajo
   aktivnega vklop/izklop E2E (F6.3.5.1 je potrdil le `reviews`). Njihovi moduli (galerije/FAQ) niso
   preizkušeni s skrij-sekcijo ob DEACTIVATED.
3. **Mobile preview frizer/šivilja/čebelar** — doslej sklep iz kode (PARTIAL), ni dejanskega browser
   preverjanja prek DeviceId toggle.
4. **Prazne sekcije / mrtvi CTA** pri izključenih modulih — preverjeno pasivno (F6.3.3 §7), ni pa
   avtomatiziranega testa za vse module.
5. **Sviťavanje fotografij** — `handleImageForSection` je v kodi, ampak ni E2E dokazano (upload → 
   predogled → objava).

## 4. Natančni E2E scenariji (browser, izolirana `markec_f631_test`)

Vsak scenarij se izvede s pravim browserjem (Playwright E2E spec; za hitre ročne potrditve Chrome DevTools MCP) kot določen lastnik (fr/mk/si/cb @f631.test / TestPass123!):

**S1. Klikni-uredi → objava (osnovni cikel, vse 4 dejavnosti)**
  Nastavitve → Izgled in vsebina → Vizualni urejevalnik → klik ni sekcijo (hero) → uredi naslov/
  podnaslov/CTA → Shrani osnutek → Predogled (ifcrame) prikaže nov osnutek → Objavi → javna `/s/{slug}`
  prikaže novo vrednost (h1) ter `publishedContentVersion` narase.

**S2. Mobile/desktop toggle (vse 4)**
  V editorju stikalo 390/768/1440 → ifcrame se zoži na to širino, brez horizontalnega overflow
  (scrollWidth ≤ clientWidth) pri 390 px v vseh 4.

**S3. Sekcije: dodaj / premakni / skrij / odstrani (vsaj 2 dejavnosti)**
  Dodaj lastno sekcijo → pojavi se na koncu; premakni navzgor (DnD) → spremeni vrstni red; skrij →
  izgine iz predogleda; odstrani → se odstrani tudi osnutek. Objava odraža novo strukturo.

**S4. Fotografija (vsaj 2 dejavnosti)**
  Pri sekciji hero/about naloži sliko (Cloudinary) → predogled prikaže sliko → objavi → javna stran
  ima sliko.

**S5. Modul galerije / FAQ — aktiven vklop/izklop (cebelar + 1 z galerijo)**
  Z galerijo/FAQ podatki in `OrganizationModuleState` = ACTIVE → sekcija vidna; = DEACTIVATED →
  sekcija, obrazec in CTA skriti; ponovni ACTIVE → vrnjeno, podatki ohranjeni (istovetno kot F6.3.5.1
  reviews). Enako na javni + predogled.

**S6. Ohranitvena preverba drugih org (regresija varnosti)**
  Po vseh spreminjanjih: samo ta org se spremeni; drugi 3 tenanti nespremenjeni; itest F6.3.5 (7/7)
  zeleni.

**S7. Trgovina stop-and-go (por-vhod za F6.5, ne gradnja)**
  Čebelar: izdelek → Dodaj v košarico → košarica prikaže izdelek (število=available) → spreminjaj
  količino → checkout (Stripe sandbox) → Order/Stock potrditev. Označeno kot NOT F6.4-guba (F6.5).

**S8. Rezervacije / povpraševanje stop-and-go (por-vhod za F6.6)**
  Frizer: izberi termin → podatki → rezervacija; šivilja/čebelar: `/inquiry` forma z merilnim listom →
  pošlji → povpraševanje. Označeno kot NOT F6.4-guba (F6.6).

## 5. Potrebni testi

- **Vitest (regresija):** celota `npx vitest run` → PASS (1325 danes).
- **Integration itest (varnost):** `tests/integration/f635/*` → PASS (7/7), + po potrebi dodaj za
  galerije/FAQ module state v javni gating.
- **Nov Playwright spec `e2e/visual-editor.spec.ts`:** S1–S6 (avtomatizirano, na f631/reload setup).
- **Ročna/E2E za S4 (Cloudinary upload)** — morda dehomed pri preprostosti; če se Cloudinary ne more
  uporabiti v testnem okolju → oznaka NOT VERIFIED ali mock.

## 6. Merila PASS / PARTIAL / FAIL / NOT VERIFIED

- **PASS:** dejansko izvedeno preko browserja; rezultat pozitiven; regresija (vitest + e2e) zelena;
  varnostni itest zelen.
- **PARTIAL:** delno deluje / potrjeno v omejenem obsegu (npr. brez foto v E2E).
- **FAIL:** dejanje ne deluje v browserju (dokazan server/DB/UI bug).
- **NOT VERIFIED:** ni bilo mogoče izvesti v tem okolju (npr. Cloudinary sandbox, Stripe live) — 
  jasno označeno, ne domnevamo.
- Pravilo: **brez PASS brez dejanskega browser dokaza** (ne zadošča pregled kode).

## 7. Tveganja in odvisnosti

- **Turbopack dev** je ob velikih zahtevkih flaky (404 routes) → restart na čist port (kot predhodno).
- **Chrome DevTools MCP screenshot** ob velikih pogledih timeout-ira → uporabiti Playwright za
  avtomatiziran E2E (deterministično) + a11y snapshots/DB-kot dokazi.
- **Cloudinary/Stripe** v test-nem okolju morda nista dostopna s pravimi ključi → omejiti na
  sandbox/mock ali označiti NOT VERIFIED.
- **WIP drugih agentov** (`site-editor/`, `proxy.ts`, actioni) — ne prepisovati; spremembe le
  diskretne/ciljane, z explicitnim dokumentnim sledom.
- **Galerije/FAQ** nimajo še module-state gating v editorju → popravek (izven F6.3.5.1) je del F6.4;
  če zahteva spremembo sheme → ustaviti in pripraviti predlog (ni odobreno zdaj).
- **Odvisnost:** F6.5/F6.6 (trgovina/rezervacije) sta potrjena le kot stop-and-go vhod; polna
  implementacija je naslednje faze.

## 8. Predlagan vrstni red (po odobritvi)

1. Playwright E2E spec (S1–S3, S5, S6) na f631 — avtomatizacija obstoječega.
2. Galerije/FAQ module-state gating v editorju/javnem renderju (S5) — popravek + E2E.
3. Mobile toggle E2E za vse 4 (S2) + fotografije (S4).
4. Trgovina (S7) + rezervacije/inquiry (S8) kot stop-and-go poročilo (vhod F6.5/F6.6).
5. Regresija (vitest + e2e + itest) + polno poročilo F6.4; ustavitev pred F6.5.

## 9. Pripravljeno / čaka odobritev

Ta načrt še ni izveden. **Načrtujejo se spremembe samo po odobritvi.** Vmes ni bila spremenjena
aplikacijska koda, ni WIP drugih, ni sheme/migracij, ni `markec_dev`/produkcije, ni `git add/commit/push`.