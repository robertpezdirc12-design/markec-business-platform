# MARKEC — F6.2 ZAKLJUČNO POROČILO (poslovni profili)

> Vsebinsko: (1) stanje F6.1 po dodatnem preverjanju košarice, (2) dejansko stanje poslovnih
> profilov pred spremembami, (3) kaj je bilo dopolnjeno, (4) datoteke, (5) kaj posamezni profil
> zdaj omogoča, (6) kaj še manjka, (7) rezultati izvedenih testov, (8) tveganja, (9) nedotaknjeno,
> (10) statusi PASS/PARTIAL/FAIL/NOT VERIFIED.
>
> Jasno ločenica: **IMPLEMENTIRANO** (vodi skozi kodo/DB/UI), **KONFIGURIRANO** (descriptive v
> `registry.ts`, si materializira, ni izvedeno runtime tukaj), **NAČRTOVANO** (ni).

---

## 1. Stanje F6.1 po dodatnem preverjanju košarice

Navodilo je zahtevalo dejansko potrditev scenarijev 1–7 (ne le pregled kode). Izvedeno z novim
**integracijskim testom `tests/integration/f554/retail-stock-reservation.itest.ts`** (5/5 PASS)
na izolirani `markec_f554_test` (realen Postgres, atomski `UPDATE .. WHERE`).

| Scenarij | Zaključek | Status |
|---|---|---|
| (1–4) stock=10, reserved=7 → available=3; dodano 2 kom | UI prikaže `available=3`; server računa `stock−reserved` | **PASS** |
| (5) povečanje v košarici na ≥4 | client max na shranjeno (3) → blokira + toast »Na zalogi je le še 3 kos« | **PASS** (fiksna) |
| (6) zaloga se zmanjša po dodajanju | košarica drži staro max; streak `reserveStock` **zavrne** atomsko → order se ne zgodi | **PASS** (varnost) / **PARTIAL** (UI max ni sveže osvežen — kos se zavrne, ne zgodi se prodaja) |
| (7) različice | vsaka varianta pridobi `available` ob dodajanju (`getPublicProductVariants`) | **PASS** |

**Zaključek:** **nobena prodaja ni mogoča nad razpoložljivo zalogo** — zadnja avtoriteta je na
strežniku (`reserveStock`/`convertReservationToSale` z atomarnim pogojem `stock−reserved >= qty`).
Client (košarica) je UX-napotek, pri fiksni zalogi pravilno omeji, pri zmanjšani zalogi po
dodajanju prikaže zastarel max, ampak ga streak zavrne. Sporočila so številčna in razumljiva
(»… na voljo le še X«, `stockErrors`). **F6.1 zaključek: PASS** (z eno PARTIAL oznako za UX max).

Posodobljeno: `docs/F6-1-ZAKLJUCNI-PREGLED.md` (dodano §6b + status table).

---

## 2. Stanje poslovnih profilov pred spremembami

`src/lib/profiles/registry.ts` — **34 profilov** (objektivno preštevi `PROFILE_LIST`):
`beauty, frizer, barber, nails, cosmetica, massage, epilation, generic, seamstress,
tire-service, mehanik, beekeeping` + **22 SKD-profilov** (skd-a-agriculture idr.).

**Kot je bilo (PRED spremembami, analiza dejanske kode):**

| Profil | capabilities | forms | workflows | extensions | ctaMode | Funkcionalna diferenciacija |
|---|---|---|---|---|---|---|
| beauty, frizer, barber, nails, cosmetica, massage, epilation | `salonCapabilities()` (enaka: appointments required, shop/services/staff required, workOrders disabled, documents disabled) | beauty/frizer/barber/nails/epilacija `[]`; **cosmetica** `consultation`; **massage** `health-screening` | — | `workspace-resources` | booking | **Večinoma enaka**; razlika le v terminology/shema/katalog/barva; cosmetica+massage imata formove |
| generic | vse `optional` | [] | — | `projects` | inquiry | Univerzalno |
| **seamstress** | workOrders required, appointments disabled, forms+workflows required | `order-details`, `measurements` | `production-order` (9 stopenj) | body-measurements, projects | inquiry | **Res ločen** (produkcijski tok) |
| **tire-service** | shop+inventory+workorders required, appointments optional | `vehicle-intake` | `work-order` (7 stopenj) | vehicle-workshop, suppliers | booking | **Res ločen** |
| **mehanik** | shop+inventory+workorders required, appointments optional, reviews optional | `vehicle-intake` | `work-order` (7 stopenj) | vehicle-workshop, suppliers | booking | **Res ločen** |
| **beekeeping** | appointments/workOrders disabled, shop+inventory required | `harvest-record` | — | batch-production, suppliers | order | **Res ločen** (trgovina/serije) |
| skd-* (22) | variabilne lastne | delni odvisno od SKD | — | variabilno | variabilno | odvisno od SKD |

**Ključna dejstva iz analize:**
- **Profile manifest (`profileSchema`) že podpira** `capabilities`, `forms`, `workflows`,
  `dashboardWidgets`, `extensions`, `website.ctaMode`, `catalog.seedVerticalId` (registry.ts:84-129).
- **Materializacija forms/workflows DELUJE**: `materializeProfileAssets` (materialize.ts) ustvari
  `FormDefinition`/`WorkflowDefinition` per-org iz `profile.forms`/`profile.workflows`; klicano v
  onboarding (onboarding.ts:364), guided-entry (guided-entry.ts:150) in ob spremembi profila
  (site-content.ts). Je generično (kopi po profilu). Obstaja integracijski test f501-materialization.
- **`website.ctaMode` dejansko vpliva na javni CTA** (ne samo barve): `resolvePublicCta`,
  `resolveCtaLinks`, `resolveCtaSectionHref`, `isBookingEnabled` (public-cta.ts) usmerjajo na
  `/booking` (booking), `/inquiry` (seamstress), `/shop` (beekeeping) **in spoštujejo capability**.
- **`dashboardWidgets` profila res vodi offashboard** (dashboard/page.tsx:130-137 `hasWidget`).
- **SKD profili** so bili dodani v projektu od agenta (registry.ts je `M` WIP), to ni F6.2.

**Vrzel pred F6.2:** frizer, barber, nails, epilacija (in beauty) so bili `forms: []` — dejansko
funkcionalno enaki salonu (le drugi termin/katalog), brez svojega osnovnega obrazca. To ni
"razične funkcije za različno dejavnost".

---

## 3. Kaj je bilo popravljeno ali dodano (F6.2)

Dodane **forme (configurativne, `forms` v profilu)** za 4 salon-dejavnosti, ki jih niso imele —
tako, da ob materializaciji dejansko dobijo svoj osnovni obrazec in se ločijo od "enake z
drugimi barvami". Vzorec konsistenten s cosmetica/massage. Polja so prevladujoče **neobveznna**,
da ne obremenjujejo lastnika.

| Profil | Dodani form (key) | Polja |
|---|---|---|
| **frizer** | `hair-note` | desired_style, current_state (lisi/bakre), allergies (barva/prep.) |
| **barber** | `barber-request` | style_preference (klasično/fade/brada/…) , skin_sensitivity, notes |
| **nails** | `nail-appointment` | shape, design_preference, allergies_lacquer |
| **epilation** | `epilation-check` | contraindications, allergies, skin_prep |

Ti so **uporabni** (lastnik jih lahko uredi v dashboardu/forms) in **povezani** (materializer jih
preseje v DB `FormDefinition`). **Ni sheme, ni migracije, ni nove kode** — le konfiguracija profila.

---

## 4. Katere datoteke so bile spremenjene (F6.2)

- `src/lib/profiles/registry.ts` — dodani `forms` za frizer, barber, nails, epilacija (4 edits,
  v klobučno zaporedne; **ne poPrepisujemo SKD-profilov ali drugih sprememb agrenta** — datoteka
  je bila `M` in niti iso bila prepisana, dodani le bloki forms).

**Obseg F6.2:** ni bila spremenjena nobena druga datoteka. `F6.1`-relevantne datoteke (documents,
shop, public-site, inventory, tests) so bile v prejšnji odobreni fazi in so tukaj **kot so**,
nedotaknjene v F6.2.

---

## 5. Kaj posamezni profil zdaj dejansko omogoča (po F6.2)

Na podlagi kode (ne predpostavk):
| Dejavnost | Omogoča (res, preverjeno) | Preko česa |
|---|---|---|
| **Frizer** | rezervacije + storitve/trajanje/cenik + izbira osebja na terminu + galerija + prodaja izdelkov + **nova forma hair-note** | appointments (bookings), services, staff assignment, shop, `hair-note` form |
| **Barber** | prikazovanje moško striženje/brado, rezervacije, prodaja, **barber-request** form | appointments, shop, `barber-request` |
| **Nails** | rezervacije (manikira/pedikura), prodaja, **nail-appointment** form (oblike/laki) | appointments, shop, `nail-appointment` |
| **Epilacija** | rezervacije, **epilation-check** form (kontraindikacije) | appointments, `epilation-check` |
| **Kozmetičarka** | rezervacije + **consultation** form + prodaja | appointments, `consultation`, shop |
| **Masaža** | rezervacije + **health-screening** form + prodaja | appointments, `health-screening`, shop |
| **Vulkanizer / Avtomehanik** | delovni nalog (work-order) + vehicle-intake form + vozila/zaloge + shop (deli) + (option) rezervacije | `vehicle-intake`, `work-order` workflow, `vehicle-workshop`+`suppliers` ext, shop, inventory |
| **Šivilja** | produkcijski tok (inquiry→measurements→quote→approval→production→fitting→delivery→payment→done) + body-measurements + shop (opt) | `order-details`, `measurements` forms, `production-order` workflow, body-measurements, shop |
| **Čebelar** | trgovina izdelkov + inventory + batch-production (žetev/serije) + shop | shop, inventory, `harvest-record` form, batch-production ext |
| **Generic / SKD** | po capability—odvisno od profila; katalog prek SKD | capabilities + SKD catalog |

Javni CTA zdaj posamično: booking→/booking, inquiry→/inquiry, order→/shop (public-cta.ts). Dashboard
widgeti per profil (dashboardWidgets). To pomeni: **mehanik in frizer NISTI več samo barva/katalog —**
razlika je v capability matrikah + workflowi + obrazci + CTA + dashboard widgeti (in bodo, ko se
templatei igjedajajo F6.3 in renderirk uporabi `_templateId`).

---

## 6. Kaj še manjka (F6.2 seja)

- **Runtime materializacija novih 4 form** v F6.2 tukaj **ni bila izvedena/testirana** (in označeno
  NOT VERIFIED za runtime) — ker bi integracijski test zahteval migracijo izolirane baze
  (`markec_f23_test` je out-of-sync; F6.2 omejena, brez baze). Šablonsko je to enako kot za
  kozmetiko/masažo (ki deluje), a ne smem trditi PASS brez izvedenega testa. Priporočilo: ob
  naslednji dovoljeni bazi/migraciji zagnati `f501-materialization` ali dodati en minimum IT.
- **Skrb pri `_templateId` in layout** (defa-ne v F6.3) še ni (different layout med profili) —
  to je pravi vizualni gradnik F6.3, ki je zunaj te faze.
- Nekateri SKD profili imajo malo ali nič forms (odvisno od estate SKD) — dopolnjevanje morda
  smiselno v nadaljnjem, a ni zahtevano zdaj.
- `website.ctaMode` za `quote` — za zdaj redki profili; ni testirano end-to-end (glej NOT VERIFIED).

---

## 7. Rezultati dejansko izvedenih testov

| Preverba | Rezultat | Opomba |
|---|---|---|
| `npx tsc --noEmit` (profiles/registry + spremenjeno) | **0 napak** | — |
| `vitest run tests/profiles tests/modules-f2.test.ts tests/entry-checkout-65-69.test.ts` | **12 datotek, 142 PASS** | register zod-validiran; brez loma (vklj. §21 scenariji) |
| `vitest run` (celotna splošna paleta) | **90 datotek, 1315 PASS** | pred spremembami 1315; novih forms ni lomilo |
| `vitest.f554` `advances-verify.itest.ts` | 10/10 PASS | F6.1 regresija (ze prej; tukaj ni ponovno spremenjen) |
| `vitest.f554` `retail-stock-reservation.itest.ts` | **5/5 PASS** | F6.1 potrditev košarice (nova) |
| `f501-materialization.itest.ts` (F2.3) | **NOT RUN** | zahteval bi migracijo izolirane baze (out-of-sync) — izven F6.2 omejitve (ne spreminjamo baz). |

**Brez domošljanja rezultatov prejšnjih faz kot novih:** vsi zgoraj navedeni so izvedeni v tej
se«ji (profile/tsc/splošna; f554 advances/retail so ze v F6.1/X v isti seji).

---

## 8. Tveganja

| Tveganje | Ocena | Kako |
|---|---|---|
| Dodani forms ne bodo prikazani zaradi materializacije ne-izvedene (ni DB) | Srednje-NIZKO | šablonsko kozmetika/masaža deluje; a IT NOT RUN → NOT VERIFIED runtime |
| SKD profil (od drugega agenta) v `registry.ts` - dodan forms morda zmede | Nizko | to ni prepis; samo dodani bloki; tests/registry prešli |
| `_templateId` co layout (F6.3) še ni — mehanik vs frizer razlikujejo po capability/workflow/CTA, NE po layout | Dejansko | F6.3 skrbi za layout; tu ni presežek |
| Baza `markec_f23_test` iz-sink | Visok za IT | ne migriramo v F6.2; označeno NOT RUN |

---

## 9. Kaj je ostalo nedotaknjeno (F6.2)

- **Nobena shema, migracija, baseline, migracijski arhiv** — NI spremenjeno.
- **`markec_dev` / produkcija / Vercel** — nedotaknjeni.
- **Baza** — ni bila spremenjena (niti testna izolirana — f23 ostala out-of-sync, ni migracije).
- **Delo drugih agentov / necommitted WIP** — evidentirano (98→101 M, 190→192 ??, 30 D) jih nisem
  pisal; `registry.ts` je bil `M` pred mano in je bil **samo dopolnjen** (forms), ne prepisan.
- **Predloge/renderer/editor/trgovina/rezervacije (F6.3–6.8)** niso bile spremenjene zunaj F6.1/F6.2.

---

## 10. Statusi nalog (F6.2)

| Naloga | Status | Opomba |
|---|---|---|
| Analiza vseh 34 profilov (čeprav 10 ×) | **PASS** | dejanska koda; tabela §2 |
| Preverjanje ali se dejavnosti res razlikujejo po funkcionalnosti | **PASS** (za mehanik/vulkanizer/šivilja/čebelar); **PARTIAL** za salon (zdaj dodamo forme → bolje) | capability/workflow/CTA kodo ključno |
| Dopolnitev profilov, kjer je dejansko potrebno | **PASS** | +4 forme; brez sheme/migracije |
| Povezava forms/workflows z onboardingom/materializacijo | **PASS** (logika generična); **NOT VERIFIED** (runtime za nove) | `materializeProfileAssets` povezave |
| Testiranje (profile/tsc/regresija) | **PASS** | 1315; profile 142 |
| Nič sheme/migracije | **PASS** | — |
| Ločnica implementirano/konfigurirano/načrto | **PASS** | glej uvod |

**F6.2 ni predlagal spremembe sheme/migracije** — vse je bilo dosežljivo s profilisko konfiguracijo.
Kadar bo odobrena migracija izolirane baze (naslednja faza), naj se zagnati `f501-materialization`
za potrditev runtime materializacije novih 4 forms (trenutno NOT VERIFIED).