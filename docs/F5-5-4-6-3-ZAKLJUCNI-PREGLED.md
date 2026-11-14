# F5.5.4.6.3 — Uradna validacija in skladnost elektronskih dokumentov MARKEC

**Status: VERZIJA — najprej branje. Cilj: dokazljiva skladnost generiranih e-računov s
konkretnim ciljnim standardom in profilom. Pošiljanje NI implementirano (kot naročeno).**

## Povzetek

Nadgradnja faze F5.5.4.6.2 v obsegu, ki daje dokazljivo skladnost:

1. **PEPPOL BIS Billing 3.0.21 (uradni)** — uradni Schematron `PEPPOL-EN16931-UBL.sch`
   in `CEN-EN16931-UBL.sch` prenesena iz `docs.peppol.eu` in preverjena lokalno prek
   Saxon-HE / iso-Schematron. Vsi sintetični primeri so **XSD + PEPPOL + CEN PASS**.
2. **e-SLOG 2.0** — uradni e-SLOG XSD / UJP validator **niso bili dosegljivi** →
   pošteno **NOT VERIFIED** (nikoli PASS). Adapter generira UBL-semantičen XML, vendar
   ne izdaja uradne skladnosti.
3. **Kritična kontrola kod** — popravljen napačen `PaymentMeansCode 97` za avanse
   (97 = Clearing between partners, NI predplačilo); avans → `cbc:PrepaidAmount` +
   `cac:BillingReference/InvoiceDocumentReference` s `DocumentTypeCode 386`. Preverjeni
   tipi 380/381/386/326 (326 le za DE — PEPPOL-P0112).
4. **Testni dokumenti** — 8 vrst sintetičnih vzorcev, vsi VALIDNII skozi XSD + PEPPOL +
   CEN Schematron (PASS).
5. **UI** — jasna 5-stopenska stanja; **nikoli lažni PASS** (razvid varovalo: ko uradna
   validacija ni izvedljiva → `NOT_VERIFIED`).
6. **Arhiv** — originalni XML nespremenljiv (SHA-256 enak ob ponovnem prenosu); za vsak
   dokument shranjena različica standarda in validatorja ter rezultat validacije.
7. **Varnost** — samo izolirana testna baza; brez pošiljanja, brez git add/commit.

---

## 1. PEPPOL BIS Billing 3.0.21 — artefakti in validacija

### Uradni artefakti (v `docs/einvoicing/artifacts/`)
Vir: `https://docs.peppol.eu/poacc/billing/3.0/` (May 2026 Release = **3.0.21**,
mandatory 2026-08-17). SHA-256 v `docs/einvoicing/artifacts/MANIFEST.md`.

| Artefakt | Namen |
|---|---|
| `peppol-bis3/PEPPOL-EN16931-UBL.sch` | uradni PEPPOL Schematron (profile 01) |
| `peppol-bis3/CEN-EN16931-UBL.sch` | uradni TC434 EN 16931 Schematron |
| `peppol-bis3/PeppolBIS-Envelope-Rules.sch` | enveloping compliance (rezervirano) |
| `peppol-bis3/BIS-Billing3-Examples.zip` | uradni primeri (za testne podatke) |
| `ubl21/xsd/**` + `CCTS_CCT_SchemaModule-2.1.xsd` | uradne UBL 2.1 XSD sheme |
| `schematron-xslt/*` | uradni ISO Schematron XSLT (Schematron.org) |
| `validator/Saxon-HE-12.5.jar`, `validator/xmlresolver.jar` | lokalni XSLT/URI engine |
| `scripts/einvoice-validator/*.java` | lokalna Java validatorja (JDK-JAXP + Saxon) |

**Lokalnost**: vsi artefakti so na disku. Validiranje ob generiranju računa **ne**
kliče spleta — le lokalni `java` podproces + datoteke.

### Validacijski cevovod (`src/lib/einvoice/official.ts`)
- **XSD**: JDK 17 vgrajeni JAXP XML Schema 1.0 (Xerces interno) nad UBL 2.1.
- **PEPPOL Schematron**: iso-Schematron (XSLT2) + Saxon-HE nad `.sch` PEPPOL.
- **CEN Schematron**: isti cevovod nad `.sch` CEN (TC434).
- **Pošten fallback**: če Java/JAR-i niso dosegljivi → rezultat `NOT_VERIFIED`;
  UI/arhiv to NIKOLI ne pokaže kot "skladen".

### Potrditve iz uradnega Schematrona (fatal, PEPPOL BIS 3.0.21)
- `PEPPOL-EN16931-R004` — `CustomizationID` mora biti
  `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0` (brez `::`).
- `ProfileID` `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` (Profil 01). Profil 02
  ("billing with response", dodan v 3.0.21) uporablja isto `CustomizationID`; loči se v
  Invoice Response SBDH — ni del UBL Invoice instance Schematrona.
- `PEPPOL-EN16931-R010/R020` — obe stranki morata imeti `cbc:EndpointID`.
- `PEPPOL-COMMON-R040` — EndpointID s `schemeID=0088` mora biti veljaven 13-mestni GLN.
- `PEPPOL-EN16931-P0100` — InvoiceTypeCode dovoljen nabor vklj. 380/386.
- `PEPPOL-EN16931-P0112` — **326/384 le za nemške organizacije**.
- `PEPPOL-EN16931-P0101` — CreditNoteTypeCode dovoljen nabor vklj. 381.

## 2. e-SLOG 2.0 — NOT VERIFIED (pošteno)

Uradni e-SLOG 2.0 XSD + UJP ovojnica + UJP validator iz slovenskih uradnih virov
(eslog.pisrs.si / UJP / epos) **niso bili dosegljivi** iz tega okolja v nobeni fazi.

- Adapter `src/lib/einvoice/eslog20.ts` sestavi dobro oblikovan UBL-semantičen XML
  (eSlog wrapper), ki je matematično in poslovno konsistenten — vendar NI uradno XSD
  validiran.
- **Stanje = NOT VERIFIED.** UI/arhiv prikazuje »ni uradno validirano«. **Nobena nadomestna
  XSD shema ni predstavljena kot uradna. Brez lažnega PASS.**

Preverjeno strukturno (sintaktično): e-SLOG wrapper, UJ P ovojnica (bodoča), priloge
(referencirane), sintaksa avansnega računa (386) in dobropisa (381) — kvalitetno v
adapterju, ampak **uradna preverbenost ni zaključena**.

## 3. Kritična kontrola kod (§3)

### Popravljen `PaymentMeansCode 97`
- V fazi 1 je `model.ts::paymentMeansCode("advance")` vračal **97**. Uradni UNCL 4461:
  **97 = “Clearing between partners”** (kompenzacija med partnerji) — **NI** predplačilo
  in **ne sme biti** splošna oznaka avansa.
- Popravek: `paymentMeansCode("advance")` → `""` (izpusti); `exporter.ts` filtrira
  prazne kode. Avans se v UBL predstavi kot **`cbc:PrepaidAmount`** (BT-113) +
  **`cac:BillingReference/cac:InvoiceDocumentReference`** z `DocumentTypeCode 386`
  (preceding invoice reference, BT-17) — po EN 16931 / PEPPOL BIS 3.0.

### Razločevanje po nalogi
- **dejanski način plačila** → `PaymentMeansCode` iz UNCL 4461 (30 transfer, 10 gotovina,
  54 kartica).
- **prejeto predplačilo (avans)** → `PrepaidAmount` + `InvoiceDocumentReference` tip 386.
- **interna uporaba avansa na končnem računu** → isto: reference na avans + PrepaidAmount.

### Tipi dokumentov (kontrola kod)
- **386** = avansni račun (prepayment) — dovoljen (P0100). **PEPPOL PASS**.
- **326** = delni račun (partial) — v PEPPOL dovoljen **le za DE** (P0112). Za slovenski
  primer → **FAIL** po Schematronu (testirano v enoti).
- **380** = komercialni račun — dovoljen. **PEPPOL PASS**.
- **381** = dobropis — dovoljen. **PEPPOL PASS**.

## 4. Testni dokumenti (§4) — vsi PASS

Generator: `scripts/einvoicing-gen-samples.ts`. Validator: `scripts/einvoicing-validate-samples.ts`.
Vsi vzorci imajo veljaven GLN (0088), CustomizationID, ProfileID 01, InvoicedQuantity,
PayeeFinancialAccount.

| # | Vzorec | Tip | XSD | PEPPOL | CEN | SHA-256 (kratki) | Skupno |
|---|---|---|---|---|---|---|---|
| 00 | običajni končni račun | 380 | PASS | PASS | PASS | — (ročni) | **PASS** |
| 01 | avansni račun | 386 | PASS | PASS | PASS | `f3db2a92…` | **PASS** |
| 02 | končni račun z 1 avansom | 380 | PASS | PASS | PASS | `c546812f…` | **PASS** |
| 03 | končni račun z več avansi | 380 | PASS | PASS | PASS | `f40daf48…` | **PASS** |
| 04 | dobropis | 381 | PASS | PASS | PASS | `6e755735…` | **PASS** |
| 05 | račun z delnim plačilom | 380 | PASS | PASS | PASS | `92bbf1b1…` | **PASS** |
| 06 | več davčnih stopenj (22% + 9.5%) | 380 | PASS | PASS | PASS | `a9a0cacc…` | **PASS** |
| 07 | oprostitev DDV (Z, VATEX-EU-132) | 380 | PASS | PASS | PASS | `01f5e995…` | **PASS** |

Enotni testi: `tests/unit/einvoice-codes.test.ts` (7/7 PASS) — kontrole kod iz §3.

> e-SLOG vzporednice bi bile NOT VERIFIED (uradni validator nedosegljiv); prikazano kot take.

## 5. Uporabniški vmesnik (§5)

`src/components/admin/einvoices-client.tsx` prikazuje 5-stopenska stanja z barvo + tooltip:
`XML ustvarjen → Osnovno preverjen → XSD-validiran → Poslovno validiran → PEPPOL/e-SLOG
profilno skladen → Pripravljen za pošiljanje`.

**Varovalo poštenosti**: kadar `xsdApplied=false` ali `peppolSchematronApplied=false`
(pomanjkanje Jave/artefaktov ali e-SLOG), se prikaže `NOT VERIFIED` ali `ni uradno
validirano` — NIKOLI zelen "skladen". Dodatno se pokaže `standardVersion`.

## 6. Arhiv (§6)

- Originalni XML se shrani nespremenljivo (`EInvoice.xml` base64, write-once).
- Validacija ga NE spreminja.
- Za vsak dokument se shrani `standardVersion` (PEPPOL-BIS-3.0.21 / eSLOG-2.0) in
  `validatorVersion` (JDK-JAXP-XSD-1.0 + ISO-Schematron-XSLT2 + Saxon-HE-12.5).
- `validationMessages` (JSON) vsebuje rezultate; `xsdApplied` / `peppolSchematronApplied`
  označujeta kaj se je dejansko izvedlo.
- Ponovni prenos vrne enak SHA-256 (test idempotence) in byte-identičen XML.

## 7. Varnost (§7)

- Delo na izolirani testni bazi `markec_einvoice_test` (tam, kjer so tečeni itest/i).
- Brez produkcije in staginga.
- **Brez UJP/PEPPOL pošiljanja** — pošiljanje NI implementirano.
- Baseline (Drobn documents, migracije) **nespremenjen**; arhiv migracij nedotaknjen.
- Ne posega v WIP drugih agentov.
- **Brez splošnega `git add` / commit** — spremembe so le v delovnem drevesu.

## 8. Končno poročilo (§8) — MATRIKA

| Vrsta dokumenta | XML | Standard | XSD | Schematron (PEPPOL/CEN) | Matematično | UJP | SHA-256 | Rezultat |
|---|---|---|---|---|---|---|---|---|
| Končni račun 380 | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a (B2B ni UJP obvezen) | `f3db…`-par | **PASS** |
| Avansni račun 386 | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `f3db2a92…` | **PASS** |
| Končni + 1 avans | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `c546812f…` | **PASS** |
| Končni + več avansov | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `f40daf48…` | **PASS** |
| Dobropis 381 | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `6e755735…` | **PASS** |
| Delno plačilo | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `92bbf1b1…` | **PASS** |
| Več davčnih stopenj | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `a9a0cacc…` | **PASS** |
| Oprostitev DDV | ✅ | PEPPOL BIS 3.0.21 | PASS | PASS / PASS | PASS | n/a | `01f5e995…` | **PASS** |
| e-SLOG vzporednice | ✅ | eSLOG-2.0 | **NOT VERIFIED** | **NOT VERIFIED** | PASS | **NOT VERIFIED** | — | **NOT VERIFIED** |

### Nerealizirano / poštenost
- **e-SLOG 2.0 uradna validacija NI VERIFICIRANA** (uradni vir nedosegljiv). To ni prikazano
  kot PASS.
- **Dejanska PEPPOL dostava / UJP pošiljanje NI implementirana** (kot je naročeno).
- Java 17 runtime je predpogoj za lokalno uradno XSD/Schematron; na Vercel (brez Jave)
  validator zanesljivo vrne `NOT_VERIFIED`, nikoli lažni PASS.

## Datoteke spremenjene / dodane (pregled)
- `src/lib/einvoice/official.ts` (novo) — uradna localna validacija + NOT_VERIFIED fallback.
- `src/lib/einvoice/validate.ts` — kontrola kod (P0100/P0101/P0112), 97-prepoved, robusten XML parse.
- `src/lib/einvoice/ubl21.ts` — PEPPOL 3.0.21: CustomizationID, ProfileID, EndpointID, avans→BillingReference/PrepaidAmount, CreditNoteLine qty.
- `src/lib/einvoice/eslog20.ts` — 97 odstranjen, avans→BillingReference/PrepaidAmount.
- `src/lib/einvoice/model.ts`, `exporter.ts` — paymentMeansCode (brez 97), filtriranje.
- `src/app/actions/einvoices.ts` — uradna validacija v arhiv (standard/validator/xsdApplied/peppolApplied/status).
- `src/components/admin/einvoices-client.tsx`, `page.tsx`, `i18n/dict/einvoices.ts` — 5-stopenska stanja.
- `scripts/einvoicing-gen-samples.ts`, `scripts/einvoicing-validate-samples.ts` — generator+validator vzorcev.
- `scripts/einvoice-validator/{XsdValidator,SchematronValidator}.java` — lokalni Java validatorji.
- `docs/einvoicing/artifacts/**` — uradni artefakti + MANIFEST (SHA-256).
- `tests/unit/einvoice-codes.test.ts` — enotni testi kodne kontrole.