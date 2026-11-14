# MARKEC — F6 STRATEŠKI NAČRT DOKONČANJA IN URESNIČITVE OSNOVNE PLATFORME

> **Vrsta:** produktna + tehnična analiza, arhitekturni načrt, izvedbeni načrt (NO CODE).
> **Osnova:** celovita tehnična revizija z dne 11. 11. 2026 (`docs/REVIZIJA-2026-11-11.md`).
> **Stanje priprave:** NAČRT. Nič ni implementirano; implementacija se začne ŠELE po izrecni
> odobritvi lastnika. Vse tabele/statusi temeljijo na *dejanski kodi* (file:line), nič na domnevi;
> ti pa so sestavljeni iz revizije in ciljanega ponovnega branja ključnih datotek v tej fazi.

---

# 1. Povzetek poslovne vizije

MARKEC je **enotna večuporabniška SaaS platforma**, kjer samostojni podjetnik/manjše podjetje
brez tehničnega znanja:
**PRIJAVA → IZBIRA DEJAVNOSTI → MOJE PODJETJE → UREJANJE → SPLETNA STRAN, TRGOVINA, REZERVACIJE, POSLOVANJE.**

Podjetnik vnese podatke, fotografije, storitve/izdelke, cene; MARKEC iz tega **sestavi in
vzdržuje** njegovo digitalno poslovanje in skrije tehnično kompleksnost za preprostim vmesnikom.
Osrednje načelo: **kompleksnost skrivanje, enostavnost uporabnika — najpomembnejši KPI ni koda,
temveč to, da podjetnik sam uspešno vzpostavi in vodi svoje poslovanje.**

---

# 2. Ocena trenutnega stanja glede na ciljno vizijo

Na osnovi revizije (11. 11. 2026) in ponovnega branja kode:

| Vizija | Trenutno stanje | Oznaka |
|---|---|---|
| Enostavna prijava + izbira dejavnosti | Obstoječi onboarding/guided-entry; `onboarding.ts:195,234,301`; `guided-entry.ts:125-141` | **PASS** |
| Ločen delovni prostor za podjetje | `OrganizationMember` + `organization-switch` + `workspace-picker` | **PASS** |
| Poslovni profil po dejavnosti | **11+ profilov** v `registry.ts` (frizer, barber, nails, cosmetica, massage, epilation, seamstress, tire-service, mehanik, beauty, generic), vsak s `capabilities`, `forms`, `workflows`, `dashboardWidgets`, `website.ctaMode`, `catalog.seedVerticalId`; šivilja in mehanik imata **delovne tokove**. | **PASS (delna globina)** |
| Dejavnost vpliva na dejansko funkcionalnost | Capability matrika izklaplja module, sekcije (`home-sections.ts`), vsebino (`defaultSiteContent`); delovni tok šivilje/mehanika. | **PARTIAL** (vse dejavnosti nimajo enake globine; `templates` niso uporabljene). |
| Podjetnik sam ureja spletno stran | Site Editor (`components/site-editor`, `site-content.ts`, predogled `/s/[slug]/preview`) | **PASS** |
| Trgovina / rezervacije dejansko delujejo | Trgovina end-to-end (order+stock); rezervacije z dvojno double-booking zaščito + Stripe | **PASS** (3 odstopanja, glej §8) |
| Objava + javna dostopnost | `publication.ts:100-202` (snapshot), prepariv-gate, sitemap/robots | **PASS** (E2E v browserju NOT VERIFIED) |
| Varnost večpodjetniške izolacije | org-scoped dovoljenja; 1 IDOR opomba `documents.ts:1555` | **PASS** (z 1 opombo) |

**Skupna ocena: platforma je po osnovnih zmožnostih več kot polovico na poti k viziji**,
vendar manjkata dve ključni komponenti, ki ločita "navidezno enako, le barve" od "resnično
prilagojeno":
- (a) **predloge so skupek vrstnega reda sekcij + tema, ne različna layout struktura**
  (`site-design.ts:250-286`, `layout` polje se pri renderju ne uporabi);
- (b) **globina profilov ni izenačena** — frizer/kozm., mehanik in šivilja imajo delovne
  tokove, ostali (npr. `barber`, `nails`, `generic`) delno.

---

# 3. Analiza obstoječe arhitekture

## 3.1 Sloji
- **App Router** `src/app/` s skupinami `(public)`, `(auth)`, `(customer)`, `(admin)`, `(staff)`,
  `(platform)`, `src/app/s/`, `intake/`. 
- **Poslovna logika** ~50 server actions `src/app/actions/*.ts`.
- **App libraries** `src/lib/*`: auth, tenancy, permissions, modules, profiles, site-content,
  site-design, publication, checkout, stripe, einvoice, skd, profiles/extensions itd.
- **DB** Prisma PostgreSQL, org-scoped prek `organizationId`.
- **UI** Tailwind v4, shadcn/ui, Phosphor; Recharts (analitika), Zustand (košarica).

## 3.2 Tačni vtičniki za strateško delo
- Profil: `src/lib/profiles/registry.ts` (`profileSchema:84-129`, `salonCapabilities:135-153`,
  profili od `:214` dalje; `isCapabilityEnabled:1869`, `term:1874`). Razširitve: `src/lib/profiles/extensions.ts`.
- Capability/moduli: `src/lib/modules/catalog.ts`, `policy.ts`; `OrganizationModuleState` v shemi.
- Spletna vsebina: `src/lib/site-content.ts` (SectionKey:65, `defaultSiteContent:361`, normalize).
- Sekcije domov: `src/lib/home-sections.ts` (data + capability gate).
- Predloge/tema: `src/lib/site-design.ts` (`SITE_TEMPLATES:250`, `templatesFor`, navgacija + palete).
- Objava: `src/lib/publication.ts`, `src/lib/publish-gate.ts`, javni `src/lib/public-site.ts`.
- Editor: `src/components/site-editor/*`, `src/lib/site-editor-bridge.ts`.
- Trgovina: `src/lib/checkout`, `src/app/actions/product-checkout.ts`, `store/cart-store.ts`.
- Rezervacije: `src/app/actions/appointments.ts`, `src/lib/booking/*`.
- Dovoljenja: `src/lib/permissions/effective.ts`, `src/lib/auth/guards.ts`, `src/lib/tenant.ts`.

---

# 4. Analiza uporabniške izkušnje

**Trenutni tok (potrjeno):** registracija → onboarding/guided-entry (dejavnost) →
materializacija profila (katalog + staff + content + forms + workflows) →
dashboard (capability-gated widgets, setup-checklist, guided-entry gate) →
site editor → publish → javna stran.

**Vrzeli / priložnosti (na podlagi dejanske kode):**
- **Ni vstopne tabele "kdo si" ob več workspace-ih nodei** (revizija: prijava vodi naravnost v
  dashboard; izbira je v stranski vrstici). Gate `GuidedEntryGate` vodi le v izbiro dejavnosti
  prvega podjetja.
- **Dashboard ima veliko informacij naenkrat** — ni res jasno, "kaj je aktivirano / kaj lahko
  vključim" (potrebne naloge za §7).
- **Urejanje strani** je ločen način (editor z iframe predogledom), ni "klikni-sekcijo-uredi"
  WYSIWYG na javni podlagi — vendar je to sprejemljiv MVP (ne dodajati kompleksnost brez koristi).
- **Delovni čas** se ureja prek osebja, ne centralno (F6.6).

---

# 5. Analiza poslovnih profilov (ključna tema)

## 5.1 Kaj že obstaja (dejstvo, ne domneva)
- Profili po dejavnosti z `capabilities`, `terminology`, `forms`, `workflows`,
  `dashboardWidgets`, `website.ctaMode`, `extensions`, `catalog.seedVerticalId`
  (`registry.ts:84-129`, profili od `:214`).
- **Workflows dejansko definirani** za šiviljo (`:534-545`: inquiry→measurements→quote→
  approval→production→fitting→delivery→payment→done) in mehanika (`:616-622`: checkin→
  diagnostics→approved→in_progress→done→handover→closed).
- **Extensions** (`profiles/extensions.ts`): vehicle-workshop (vozila+gume), body-measurements,
  batch-production, projects, multi-location, memberships, suppliers, delivery-runtime,
  workspace-resources, documents.
- Capability matrika res izklopi module/sekcije; vsebina default je per-vertical (`defaultSiteContent`).

## 5.2 Vrzel (dejstvo)
- **Predloge so skupne in ne uporabljajo `_templateId` pri renderju** (`site-design.ts:250-286`;
  revizija §3). Izgled = paleta + tema, ne layout.
- **Ni vsaka dejavnost enako globoka**: delovni tokovi so le za šiviljo/mehanika; `generic`,
  `barber`, `nails` itd. so bližje "capability-driven salon".
- Razlika frizer/rebr.struktura "resnično prilagojena" (po viziji §3 primera 1-3) je še delna.

## 5.3 Arhitekturni predlog (ravnotežje ponovne uporabe in prilagoditve)
**NE** razvijati ločene kode za vsako dejavnost. Namesto tega nadgraditi **profilni manifest**:
1. **`profileSchema` že podpira** `forms`, `workflows`, `capabilities`, `website.ctaMode`,
   `dashboardWidgets`, `extensions`. Vse, kar je tu, naj se dejansko uporablja (že delno).
2. **Dodati** v profil (schema + definicije) dva nova, neobvezna ključa (brez lomljenja):
   - `defaultTemplateId?: string` (privzeta predloga za profil; vezano na §6.3 template manifest).
   - `linkableEntities?: string[]` (npr. mehanik: vozilo; šivilja: merilni list) → za prilagojene
     obrazce/evidence (že delno v `workflows`/`extensions`).
3. **Renderer naj prebere `_templateId`** in s tem izbere layout manifest (F6.3) — namesto da ga
   ignorira. To dvigne diferenciacijo brez nove arhitekture.
4. **`templatesFor`** (`site-design.ts:322`) naj omogoči `verticals` filter (že predvideno v
   tipu, a danes vsi `null`); per-vertical predloge bodo naslovljive.
5. Razlika med dejavnostmi: večina deljene komponente; le "pomembno različni poteki"
   (mehanik delovni nalog, šivilja meritve) so že prikazani kot `workflows`/`extensions`.

**Merilo:** frizer in mehanik NE smeta dobiti istega layoutu — brez podvajanja na javni strani.

---

# 6. Analiza generiranja spletnih strani

**Trenutno (potrjeno):** `defaultSiteContent(vertical)` (`site-content.ts:361`) ustvari per-vertical
copy; sekcije so capability-gated (`home-sections.ts`); `seedOrganizationCatalog` zgenerira DB
katalog (`verticals.ts:1010-1113`); objava zamrzne snapshot (`publication.ts:100-202`).

**Vrzeli / cilji:**
- `SectionKey` pokriva `hero|features|services|about|team|reviews|shop|cta` — ni sekcij
  "cenik", "galerija v ospredju", "vozila/delovni nalog", "izdelek specialist".
- **Predloge ne vplivajo na layout.** To je glavni prazno prostor F6.3.
- Za nekatere dejavnosti bi bilo smiselno po novostih `SectionKey` razširiti opcijsko s
  sekcijami, ki jih prikazuje le določen profil (npr. mehanik: "servisni nalogi / vozila"),
  brez lomljenja obstoječih.

---

# 7. Analiza urejevalnika (Site Editor)

**Trenutno (potrjeno):** vizualni editor z iframe predogledom (`components/site-editor/*`,
`preview/page.tsx:60-75`), section reorder/toggle/add (`site-visual-editor.tsx:472-523`),
photo upload, theme (barve/pisave), content-version lock, publish.

**Predlog (enostavnost, brez podvajanja):**
- **MVP** = obstoječi (ne graditi novega).
- **Izboljšanje vrednosti** (F6.4): "klikni-sekcijo-uredi" v iframe predogledu — ob kliku na
  sekcijo se odpre njen urejevalnik v stranskem panelu (brez lomljenja obstoječega editorja —
  dodati na obstoječ `postMessage` bridge).
- Razdeljen način za telefon/računalnik: obstoječi preview že podpira width; dodati le
  plovni preklop (mobile/desktop) v iframe (nizko stroškovno).
- **Ne dodajati** drag-drop HTML blokov za MVP (overkompleksnost ni potrebna).

---

# 8. Analiza trgovine

**Potrjeno delujoče:** modul, izdelek (foto/cena/kategorija/zaloga), javni prikaz, cart,
checkout (3 poti), Order v DB, admin upravljanje, stock reserve/convert, IDOR-protected
customer orders.

**Znanih 3 odstopanja iz revizije (§4):**
1. **Javni prikaz zaloge ne odšteje `reservedQuantity`** — `(customer)/shop/page.tsx:140` in
   `/shop/[slug]/page.tsx:88` uporabljata `stockQuantity > 0` (FAIL).
2. **Košarica max količina po `stockQuantity`, ne `available`** — `store/cart-store.ts:91-102` (PARTIAL).
3. **Dostava fiksna** (0 / 5.99 € prag 50 €) — `cart-content.tsx:115`, `product-checkout.ts:30-31,474` (PARTIAL).

**Predlog (F6.5, majhna in varna):** ne razvijati nove trgovine. Uporabiti obstoječi
`available = stock − reserved` (`cart.ts:69-71`, `reserveStock`/`convertReservationToSale`)
kot enotni izvor, in:
- javno prikaz `available` (pogoji ali `available > 0`);
- cart max po `available` (manjko retiai: PRAGEM lahko nosi rezervo);
- dostavo premakniti na podatkovni model (razširiti obstoječi stock/order objekte) z minimalno
  konfiguracijo (methodi/zone/naslov) ali slediti obstoječim pavljenim `delivery` capability.

---

# 9. Analiza rezervacij

**Potrjeno delujoče:** delovni čas (per-staff), termine (WorkingHours + resource), create
appointment (z dvojno double-booking zaščito), cancel/reschedule, admin/staff management,
Stripe polog, idempotenca.

**Vrzel:** delovni čas se ureja prek osebja, ne centralno (`staff.ts:334-344`,
`getStaffWorkingHours staff.ts:1050` je bralni).

**Predlog (F6.6):** dodati centralno "Nastavitve → Delovni čas" stran, ki parametriraja
obstoječo `createWorkingHours` logiko (is — ne podvajati), ter "Storitve → trajanje/termini"
(v eno).

---

# 10. Analiza dashboarda in modulov

**Potrjeno:** capability-gated navigacija (profili), `OrganizationModuleState`, policy
(`modules/policy.ts:57-107`), widget configurator v dashboard (`page.tsx:130-137`), setup
checklist.

**Predlog (F6.7):** enoten "Moduli" pogled, ki za vsakoyoč veljavo prikaže
`REQUIRED / OPTIONAL (vklap/izklop) / DISABLED` (že deloma na
`modules-overview.tsx`). Nobena capability ne sme ostati "mrtvo stikalo" (npr. reviews je v
reviziji bilo že pol to). Cilj: podjetnik vidi kaj je aktivirano, kaj lahko vklopi, kje ureja.

---

# 11. Varnostne in tehnične omejitve

- **IDOR opomba** `documents.ts:1555` (`findUnique` na `advanceId` brez `organizationId`) — F6.1 prioriteta.
- Org-scoping centralen (f0 f2.1), fail-closed; ne spreminjati brez razloga.
- Ne spreminjati varnostne arhitekture; vse novo mora biti org-scoped.
- E2E testi ne smejo teči na produkciji; izolirane baze.
- Ohraniti vse capabilities/module ključe Excel pri današnjih (ne dodajati brez potrebe).
- Ne končuj z delom drugih agentov (necommitted WIP 98 M / 187 ?? / 30 D — evidentirano, ne dotikati).

---

# 12. Predlagana ciljna arhitektura (poslovni profili)

```
ActivityProfile (registry.ts) ── manifest delovnega okolja
   ├─ capabilities            (katere module/subsistem)
   ├─ terminology             (SL/EN pojmi)
   ├─ forms                   (obrazci/evidence)
   ├─ workflows               (poslovni poteki)
   ├─ dashboardWidgets        (home widgets)
   ├─ extensions              (zaprte namestitvene razširitve)
   ├─ website.ctaMode         (booking|inquiry|order|quote)
   └─ defaultTemplateId  [NOVO] + per-vertical templates (F6.3)
        └─ Template (site-design.ts) ── layout manifest: hero style,
           section order, section grid, cards, gallery mode, contact/CTA style
```
**Načelo:** ven vse iz profila; renderer (javni home + editor) naj parame tira. Nobena
cross-dejavnostno identična koda ob vezju — vendar profili definirajo *razlike*, ne podvajanja.

---

# 13. Razdelitev na razvojne faze

Faze so majhne, samostojno preverljive, po prioriteti (na podlagi revizije):

| Faza | Naslov | Bistvo |
|---|---|---|
| F6.1 | Varnost in kritične napake | IDOR zaprtje; javna zaloga; regresija |
| F6.2 | Poslovni profili po dejavnostih (globina) | dokončati profile/workflows/extensions, izenačiti globino |
| F6.3 | Predloge in vizualna identiteta | `_templateId` renderer + layout manifest + per-vertical |
| F6.4 | Enostavno urejanja spletne strani | klikni-sekcijo-uredi, mobilni preview |
| F6.5 | Trgovina | zaloga, dostava, nastavitve, E2E |
| F6.6 | Rezervacije | centralni delovni čas, storitve, UX, E2E |
| F6.7 | Enotna uporabniška izkušnja | dashboard/nav/moduli, začetni vodič |
| F6.8 | Celovito preverjanje | frizer/mehanik/šivilja + multi-podjetje + mobile/desktop + izolacija |

Odvisnost med fazami je navedena v §14; prednostni vrstni red v §19. (F6.1 najprej zaradi
varnosti in kritične napake zaloge; F6.2/F6.3 sta srce vizije; F6.4-6.7 gradita na njima.)

---

# 14. Natančne naloge za vsako fazo, z merili (NO CODE tukaj)

### F6.1 — Varnost in kritične napake
- N1.1 Zapri IDOR `documents.ts:1555` → dodaj `organizationId: org.id` v `where` (po vzoru
  `:1549-1551`). Datoteka: `src/app/actions/documents.ts`.
- N1.2 Javna zaloga: `(customer)/shop/page.tsx` in `/shop/[slug]/page.tsx` — uporabi
  `available` (stock − reserved), ne `stockQuantity`. (Mesto izračuna: `cart.ts:69-71`).
- N1.3 Cart max po `available`: `store/cart-store.ts:91-102`.
- N1.4 Regression tests za zgornje (`tests/retail-inventory-78`, dodan enoten test).
- **Merilo PASS (F6.1):** tsc, splošni vitest zeleni; en test dokaže da `available` 
  se upošteva; IDOR enota po testu `reverseAdvanceAllocation` ne vrne tujo številko.

### F6.2 — Poslovni profili po dejavnostih
- N2.1 Revizijska tabela vseh profilov (`registry.ts`) z njihovimi forms/workflows/extensions;
  označi praznine (barber/nails/generic brez workflowov).
- N2.2 Dokončati za profile brez delovnega toka, kjer je smiselno (ob uporabi obstoječega
  `workflowSchema`). Ne silim: ne delavni tok za kosmetiko, če je termini dovolj.
- N2.3 Povezati `website.ctaMode` profila z javnim CTA renderom (ali je že upoštevano?
  preveri — ni dokazano; označi NOT VERIFIED).
- **Merilo PASS (F6.2):** vsak profil ima koherenten manifest; `tsc`; test
  `tests/profiles/*` zeleni; frizer vs mehanik imata drugačen CTA in dashboard.

### F6.3 — Predloge in vizualna identiteta
- N3.1 Layout manifest v `site-design.ts` (hero style, grid, card varianti, gallery mode,
  contact/CTA style) za vsako predlogo — poleg `sectionOrder`/palette.
- N3.2 Renderer (javni `home-content.tsx` / `app/layout.tsx`) naj prebere `_templateId`
  (revizija: `_templateId` se shrani a se ne uporabi) in izvede manifest.
- N3.3 `templatesFor` (`site-design.ts:322`) omogoči `verticals` filter; per-vertical privzete
  predloge (F6.2 `defaultTemplateId`).
- N3.4 Odzivnost + mobile preview.
- **Merilo PASS (F6.3):** frizer in mehanik imata različno layout strukturo (hero + grid),
  en sam test preveri da `_templateId` vpliva na DOM; `tests/site-design-*` zeleni.

### F6.4 — Enostavno urejanja spletne strani
- N4.1 "Klikni-sekcijo-uredi": obstoječi editor ipd. via postMessage — ob kliku v iframe
  odpre panel za to sekcijo (brez novega editorja).
- N4.2 Mobile/desktop preview toggle v editorju.
- **Merilo PASS (F6.4):** E2E (playwright) ustrežen skorprikaz: klik na sekcijo → uredi →
  shrani → objava → javno; `tests/site-content-versioning` zeleni.

### F6.5 — Trgovina
- N5.1 konsolidiraj `available` kot enotni izvor (že delno; poveži cart+shop).
- N5.2 Dostava: razširi podatkovni model (methodi/zone/naslov) na obstoječo strukturo ali
  uporabi `delivery` capability (že v `extensions/delivery-runtime`). Izogibaj novemu copypaste.
- N5.3 "Izdelek od vnosa do naročila" — enoten E2E test.
- **Merilo PASS (F6.5):** shop prikazuje `available`; dostava uporabniško nastavljiva; E2E
  checkout → Order; `tests/retail-inventory-78`, `shop-*` zeleni.

### F6.6 — Rezervacije
- N6.1 Centralni "Nastavitve → Delovni čas" (per-staff + org), ki kliče obstoječo
  `createWorkingHours` logiko (staff.ts) — brez podvajanja.
- N6.2 Poenoten "Storitve → trajanje" prikaz termina.
- **Merilo PASS (F6.6):** E2E rezervacija (delovni čas → termini → rezervacija → dvojne;
  `tests/booking-*`, `no-show-97` zeleni).

### F6.7 — Enotna uporabniška izkušnja
- N7.1 Moduli pogled (REQUIRED/OPTIONAL/DISABLED) po vsaki org — povezati `modules-overview`.
- N7.2 Vstopni "kdo si / izbira" ob več workspace-eh (F6.8 s).
- N7.3 Poenostavljen nov drajven dashboard (widgeti per manifesta).
- **Merilo PASS (F6.7):** uporabnik brez tehničnega znanja razume kaj je aktivirano /
  prižge modul; `tests/modules-f2`, `tests/memberships-100a` zeleni.

### F6.8 — Celovito preverjanje
- N8.1 Dejanski E2E scenariji A–D (§16) v izoliranih bazah.
- N8.2 Izolacija organizacij, mobile/desktop, javna objava.
- **Merilo PASS (F6.8):** scenariji A/B/C/D so zeleni ob uporabi metode E2E; vsak ima
  PASS/FAIL pogoje (§17).

---

# 15. Odvisnosti med nalogami

- F6.3 je odvisna od F6.2 (profil `defaultTemplateId`); vendar F6.3 nepotrebuje drugih.
- F6.4 (editor) je neodvisen; F6.5/F6.6 sta neodvisna in lahko tečeta vzporedno s F6.3.
- F6.7 (dashboard) se opira na F6.2 profile manifest.
- F6.8 = sinteza vseh.
- F6.1 je samostojna in takoj lahko teče (varnost).

---

# 16. Testni scenariji (F6.8 + tekoči)

### A — Frizerski salon
- Zagnati: nova prar `markec_einvoice_test`/`markec_f51_test` (izolirana).
- Koraki: prijava → ustvari salon → dodaj logo/foto → storitve+cene → delovni čas →
  vklopi rezervacije → objavi → javna stran + javna rezervacija.
- **PASS pogoji:** javna stran ni generična; rezervacija deluje; podatki so v DB.

### B — Avtomehanična delavnica
- Koraki: prijava → ustvari delavnico → servisne storitve → foto/opis → kontaktni obrazec →
  povpraševanje ali naročanje na servis → delovni nalog.
- **PASS:** dashboard in javna stran prilagojena mehaniku (delovni nalog, vozila), ne
  frizerju.

### C — Šiviljstvo
- Koraki: prijava → ustvari šiviljstvo → storitve → foto → cenik → povpraševanje → (po
  potrebi shop).
- **PASS:** delovni tok šivilje (meritve→predračun→izdelava→…) je dosegljiv v dashboardu.

### D — Več podjetij
- Koraki: en uporabnik ustvari 2 podjetji → preklaplja → preveri izolacijo strank, izdelkov,
  rezervacij, dovoljenj.
- **PASS:** podatki org A se ne prikažejo v org B (org-scoped); dovoljenja per org.

---

# 17. Merila PASS/FAIL (za vsako fazo)

SSpecifici — glej §14 "Merilo PASS". Splošna merila za vse faze:
- **PASS:** `tsc --noEmit` brez novih napak v dotičnih datotekah; `npx vitest run` zeleni;
  dodan test, ki cilja na novo vedenje; E2E (playwright, kjer velja) zelen v izolirani bazi.
- **FAIL:** koda se kompilira, a ciljno vedenje ni dokazano s testom; ali je regresija.
- **NOT VERIFIED:** ni v okolju izvedljivo (omrežje, sandbox) — treba označiti.

---

# 18. Ocena tveganj

| Tveganje | Verjetnost | Vpliv | Ukrepanje |
|---|---|---|---|
| Razbijanje obstoječih (capability/widget/test) | Srednja | Visok | majhne faze + regresija; stalni `vitest` |
| Povečanje programnega dolga (podvojena logika) | Srednja | Srednji | uporaba obstoječega (profil, modules, delivery ext) |
| IDOR/neorg-scoped | Nizka | Visok | F6.1; centralne garde |
| E2E v produkciji | Nizka | Kritičen | samo izolirane baze |
| Migracije baz / baseline | Nizka | Visok | brez migracij do odobritve; arhiv nedotaknjen |
| Prevelik obseg predlog (layout manifest) | Srednja | Srednji | omejiti MVP na 3-4 layout atribute |

---

# 19. Prednostni vrstni red (konkretno)

1. **F6.1** (varnost + javna zaloga) — takoj, majhen, poveča varen temelj.
2. **F6.2** (profile globina) — osnova vizije.
3. **F6.3** (predloge + layout) — vizualno ločuje dejavnosti.
4. **F6.4** (editor klikni-uredi) — ključni UX za podjetnika.
5. **F6.5/F6.6** (trgovina/rezervacije) — produktno srce.
6. **F6.7** (dashboard in moduli) — enostavnost upravljanja.
7. **F6.8** (celovito preverjanje) — potrditev celote.

Razlog: prvo varnost in kritična napaka; nato vizualna/funkcionalna razlika dejavnosti
(vizija), šele nato izčrpna UX/trgovino. (Če lastnik želi drugače, se utemeljiti.)

---

# 20. Vprašanja, ki zahtevajo odločitev lastnika projekta

1. Katere dejavnosti so absolutni MVP za F6.2 (frizer, mehanik, šivilja in kaj še)?
2. Ali naj predloge v F6.3 prvi MVP omejimo na 3-4 layout atribute (hero style, grid, cards,
   gallery mode) ali zahtevamo poln layout manifest?
3. Vstopni zaslom ob več workspace-ih (F6.7) — ali želimo ločen "kdo si" tok ali je dovolj
   izboljšan picker?
4. Trgovina: ali MVP dostave pusti nizek profil (0/5.99€) ali naj tako vpelje podatkovni
   model dostave (metode/zone)?
5. Ali smejo faze F6.4/F6.5/F6.6 teči vzporedno (kot ločeni agenti) ali striktno zaporedno?
6. Kdaj je "implementacija" za vas E2E browser test potrjena in kje naj se izvaja
   (playwright v lokalnem sandboxu)?
7. Ali naj F6.2 vključi izenačenje profila `barber/nails/generic` (delovni tok) ali je
   dovolj capability-driven?
8. Prednost e-računov (F6.5/F6.6) — ali so zahteva za ta razvojni val, ali je "pošiljanje"
   že prestavljeno in se F6 ukvarja predvsem z stranjo/trgovino/rezervacijami?

---

# 21. Tabela faz

| Faza | Cilj | Obseg (datoteke) | Odvisnosti | Tveganje | Merilo zaključka |
|---|---|---|---|---|---|
| F6.1 | Varnost; javna zaloga; regresija | `actions/documents.ts` (IDOR), `(customer)/shop/page.tsx`, `/shop/[slug]/page.tsx`, `store/cart-store.ts`, testi | — | Nizko–Srednji | tsc + vitest zeleni; enotni test: `available` se upošteva; IDOR test ne vrne tuje številke |
| F6.2 | Globina poslovnih profilov | `lib/profiles/registry.ts`, `profiles/extensions.ts`, site-content default | — | Srednje | vsi profili koherentni; frizer vs mehanik drugačen CTA/dashboard; tests/profiles zeleni |
| F6.3 | Predloge → dejanski layout | `lib/site-design.ts`, `components/home-content`/`app/layout`, `templatesFor`, `_templateId` render | F6.2 | Srednje | frizer in mehanik različen layout; test `_templateId` vpliva; site-design zeleni |
| F6.4 | Editor: klikni-sekcijo-uredi, mobile preview | `components/site-editor/*`, `site-editor-bridge.ts` | — | Nizke–Srednje | E2E click→uredi→objavi; content-versioning zeleni |
| F6.5 | Trgovina: zaloga, dostava, E2E | `checkout`, `cart-store`, `product-checkout.ts`, `products`, `prisma` (dostava) | — | Srednje | shop prikazuje `available`; dostava nastavljiva; E2E checkout→Order |
| F6.6 | Rezervacije: centralni delovni čas, UX | `actions/appointments.ts`, `actions/staff.ts` (WHS), dashboard/settings, staff | — | Srednje | centralni delovni čas deluje; E2E rezervacija; booking-* testi zeleni |
| F6.7 | Enoten dashboard/moduli/navigacija | `dashboard/page.tsx`, `modules/*`, `workspaces/*`, setup-checklist | F6.2 | Srednje- | uporabnik razume kaj je aktivirano; modul pogled; nav iz profila |
| F6.8 | Celovita potrditev (A–D, mobile, izolacija) | E2E testi, izolirane baze | vse | Visok | scenariji A–D zeleni; IDOR izolacija; `vitest` zeleni |

---

## Viri / dokazila
- Revizija: `docs/REVIZIJA-2026-11-11.md`.
- Ključne datoteke (dejansko brano v tej fazi): `src/lib/profiles/registry.ts`,
  `src/lib/profiles/extensions.ts`, `src/lib/modules/catalog.ts`, `src/lib/modules/policy.ts`,
  `src/lib/home-sections.ts`, `src/lib/site-design.ts`, `src/lib/site-content.ts`,
  `src/app/actions/{documents,product-checkout,cart,appointments,staff}.ts`,
  `src/store/cart-store.ts`, `src/app/(admin)/dashboard/page.tsx`.

*Načrt je pripravljen. Ne implementiramo ničesar do izrecne odobritve.*