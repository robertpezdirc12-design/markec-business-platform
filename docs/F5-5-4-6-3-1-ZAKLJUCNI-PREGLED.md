# F5.5.4.6.3.1 — Posodobitev e-račun validatorja in priprava izvajalnega okolja

**Status: verzija za pregled. Pošiljanje NI implementirano (kot naročeno).**

## Povzetek

Nadgradnja validatorja iz F5.5.4.6.3 z osredotočanjem na (a) preverbo najnovejše PEPPOL
različice, (b) izvedljivost v predvidenem strežniškem okolju (Vercel/Node serverless brez
Java), (c) ponovno preverbo e-SLOG 2.0 virov, (d) kakovost/reproducibilnost artefaktov in
(e) regresijo. Ključne odločitve so v spodnjih razdelkih.

---

## 1. PEPPOL BIS: 3.0.21 vs 3.0.22 — primerjava in odločitev

### Preverba (2026-11-11)

| Vir | Rezultat |
|---|---|
| `docs.peppol.eu/poacc/billing/3.0/release-notes/` | zadnja verzija **3.0.21**; 3.0.22 ni v TOC/naslovih |
| `docs.peppol.eu/poacc/billing/3.0/` (Home) | "May 2026 Release" = **3.0.21** |
| `docs.peppol.eu/poacc/billing/3.0.22/` | **HTTP 404** |
| Živi Schematron prenos SHA vs manifest 3.0.21 | **identična** |
| `peppol.eu/whats-new`, `docs.peppol.eu/poacc/` | nedosegljivo / 404 |

### Dejanske spremembe, ki bi jih imela 3.0.22 (če bi bila), glede na 3.0.21

Ker 3.0.22 **ni bila objavljena na uradnem viru** v tem okolju, sprememb ni mogoče tehnično
dokazati. Reference na letne spremembe BIS Billing vključujejo (iz zgodovine 3.0.x):
EAS/ICD/ISO4217/VATEX šifranti, en nie Postave (`PEPPOL-COMMON-R0xx`), EN 16931 Schematron
posodobitve (`CEN-*`), nacionalna pravila. Nič od tega ni potrjeno za "3.0.22".

### Vpliv na obstoječe XML

Brez uradnih 3.0.22 artefaktov **ni vpliva**: validator vztraja na 3.0.21, za katere so
artefakti zaklenjeni in testirani. Eksisterji (ubl21/exporter/eslog20) so nespremenjeni.

### ODLOČITEV

> **Ostajamo na PEPPOL BIS Billing 3.0.21.** Ne menjamo različice zgolj po številki.
> Ko bo 3.0.22 zares dostopna na `docs.peppol.eu`, se izvede identičen postopek preverbe
> (SHA release-artefaktov + release-notes) in se odloči o prehodu. MANIFEST je zaklenjen na 3.0.21.

## 2. Izvajalno okolje (Java 17 na Vercel?

### Problem
Vercel = Node.js serverless **brez Java 17 runtime**. Pogon `java` podprocesa tam ni mogoč.

### Primerjava arhitektur

| Rešitev | Prednosti | Slabosti | Priporočilo |
|---|---|---|---|
| **Ločen validacijski servis z Java 17** (podproces ali microservis ob Node) | edini izvede prave uradne XSD+Schematron; drži SHA-256; deterministično | dodatna infrastruktura (daemon/servis) | **Priporočeno za produkcijo** |
| **Validator kot del istega Node procesa → Java podproces** (trenutno dev) | dostopno v samopostreženem/development okolju | odvisen od namestitve Jave; na Vercel ne deluje | za dev/test/self-host |
| **Lokalni JS-validator** | brez Jave | **ni enakovreden** (UBL 2.1 XSD + PEPPOL/CEN Schematron polno ni robustno pokrivo s čistim JS; tveganje lažnih rezultatov) | **NE priporočamo kot uradno** |
| **Ponudnik e-računov / PEPPOL AP** (naslednja faza) | validator je vgrajen; brez lastne Java | odvisnost od tretje osebe (predvideno v naslednji fazi) | integracijski cilj |

### Implementirana arhitektura (F5.5.4.6.3.1)
- Nov konfiguracijski mode `EINVOICE_VALIDATOR`:
  - `auto` (privzeto): lokalna Java validacija ČE je Java + artefakti na voljo.
  - `dev-java`: enako (eksplicitno).
  - `off`: popolnoma onemogočeno.
- **Pošteno**: kadar Java ni na voljo (Vercel serverless) ALI je `off` → `validateOfficial`
  vrne `NOT_VERIFIED` (nikoli lažni PASS). Preverjeno z smoke testom.
- **Lokalna validacija NI predstavljena kot produkcijska**: gostiteljam brez Jave se vrne
  `NOT_VERIFIED`, ne "skladen".

## 3. e-SLOG 2.0 — ponovna preverba

- `eslog.pisrs.si` → nedosegljiv (fetch failed).
- UJP (gov.si) je dosegljiv in **uradno navaja**: e-računi proračunskim uporabnikom se
  pošiljajo **prek PEPPOL omrežja ali portala UJPeRačun (UBL 2.1 / BIS)**; odložišče za
  velike priloge; ponudniki izmenjave.
- **Samostojna e-SLOG 2.0 vsebinska XSD ni javno objavljena na UJP** — to je zgodovinski
  koncept; danes format = UBL 2.1 / PEPPOL BIS.
- **Pridobljeni uradni artefakti** (v `docs/einvoicing/artifacts/ujp/`):
  - `schPodpisERacuniNarocanje_1_1.xsd` (UJP shema podpisa/naročanja; iz `_1_1.zip`),
  - `PEInvoicesImportRights_1_0.xsd` + `ERacuniPravice.xml` (`eVloge.zip`),
  - `UJPeRacun-Tehnicni-napotki.pdf`, `UJPeracun-B2B-Interface.pdf`.
  - Vsi s SHA-256 v MANIFEST.
- **Stanje: NOT VERIFIED** za samostojno e-SLOG 2.0 XSD (ni javne uradne XSD); UJP
  dokumentacija podpira PEPPOL BIS 3.0.21 kot uradni ciljni standard. Brez uporabe
  neuradnih kopij kot dokaza uradne skladnosti.

## 4. Varnost in kakovost artefaktov (§4)

- **Izvor + licence**:
  - PEPPOL/CEN `.sch`, `Envelope`, primeri — OpenPeppol (open standard, attribution).
  - UBL 2.1 + CCTS XSD — OASIS (open standard, svobodna uporaba).
  - ISO Schematron XSLT — Schematron.org/ISO 19757-3 (Publicly Available Specification,
    svobodna uporaba).
  - `Saxon-HE-12.5.jar` — **MPL-2.0** (potrjeno v POM).
  - `xmlresolver 5.2.2` — odvisnost POM Saxon (Apache/MPL kombinirano).
- **SHA-256 v `docs/einvoicing/artifacts/MANIFEST.md`** — reproducibilno preverjeno z
  neodvisno sken-jo; vsi hash-i na disku se ujemajo.
- **Popravek kakovosti**: `xmlresolver` usklajena na **5.2.2** (točna deklarirana v POM
  Saxon-HE 12.5; prej 5.2.0). Odstranjena prazna smet `phloc-schematron.jar`.
- **Reproducibilnost**: enak vhod → enak izhod → enak SHA-256. Dokazano: ponovna
  validacija vseh vzorcev po zamenjavi xmlresolver daje **identične SHA in 7/7 PASS**.
- **Offline**: vsi artefakti so na disku; validiranje ne kliče spleta ob vsakem računu.
- **Validacijska sporočila**: razumljiva, z ID-ji pravil (npr. "PEPPOL-EN16931-R020"),
  v `validationMessages`; UI jih prikazuje (ne skriva napak).

## 5. Regresija (§5)

| Preverba | Rezultat |
|---|---|
| Testni XML vzorci (8 vrst) | **7/7 generator + ročni 00 = PASS** (XSD+PEPPOL+CEN), reproducibilno |
| XSD (UBL 2.1) | PASS (JDK-JAXP) |
| CEN Schematron (TC434) | PASS |
| PEPPOL Schematron (3.0.21) | PASS |
| Enotni testi kodne kontrole | **7/7 PASS** (`tests/unit/einvoice-codes.test.ts`) |
| TypeScript (`npx tsc`) | e-invoice datoteke **0 napak** (repo ima ~100 napak drugih agentov/WIP, ne mojih) |
| SHA-256 idempotenca | potrjeno; ponovna generacija vrne enak SHA+byte identičen XML |
| Neizmenljivost XML | arhiv write-once, validacija ne spreminja originala |
| Smoke `validateOfficial` | `VALIDATED` (auto), `NOT_VERIFIED` (off) |
| IDOR | nespremenjen (org-scoped); ni posegano |
| Integracijski itest (`einvoices.itest.ts`) | **Ni ponovljen**: zahteva postavitev izolirane `markec_einvoice_test` DB + migracije + Java; ni bila pripravljena v okolju. To je pošteno zabeleženo, NI se trdi da je tekel. |

### Pojasnilo `schema.prisma` diff (+2645/−2516 per naloga)

- Dejanski `git diff HEAD prisma/schema.prisma` = **+809/−16**. Velika številka +2645/−2516
  iz naloge se ne ujema z HEAD; verjetno se nanaša na primerjavo z novim baselineom
  (`prisma/migrations/00000000000000_baseline`), kamor je prejšnja faza (F5.5.4) prestavila
  celotno shemo in **arhivirala 20+ starih migracij** (`prisma/migrations-archived-legacy/`,
  vidne kot `D` v `git status`).
- Moje e-invoice spremembe v shemi so **minimalne**: modeli `EInvoiceSettings`,
  `EInvoiceChannelConfig`, `EInvoice`, `EInvoiceReceipt`, `EInvoiceDeliveryEvent` z dodatnimi
  polji `standardVersion`, `validatorVersion`, `xsdApplied`, `peppolSchematronApplied`.
- **Nisem brisal migracij in nisem prevezal baselinea** — to je obstoječa migracijska
  arhitektura (off-del of other agents), v katero nisem poseglo.

## 6. Omejitve / soglasje (§6)

- Brez dejanskega pošiljanja. Brez produkcije in staginga. Brez posegov v `markec_dev`.
- Brez Vercel deploya. Baseline in arhiv ostaneta nedotaknjena.
- Brez poseganja v WIP drugih agentov (množice nekomitiranih sprememb v `git status` so
  drugih — jih nisem spreminjal).
- Brez splošnega `git add`/commit (spremembe so le v delovnem drevesu).

## 7. Končni predlog / priporočilo za naslednjo fazo

1. **PEPPOL**: zaklenjen na **3.0.21**; ponovno preveri ob dostopu 3.0.22.
2. **Izvajalno okolje**: pri produkciji uporabi **ločen Java 17 validacijski servis** ali
   integracijo z **izbranim ponudnikom e-računov / PEPPOL AP**, ki bo v naslednji fazi
   prevzel pošiljanje in validacijo. Lokalno (dev/self-host) ostane `EINVOICE_VALIDATOR`.
3. **e-SLOG 2.0**: uradna samostojna XSD ni javna; cilja se **UBL 2.1 / PEPPOL BIS** kot
   dejanski format; e-SLOG boostra se ohrani kot NOT VERIFIED dokler se ne pridobijo uradne
   XSD + UJP validator.
4. **Naslednja faza**: integracija izbranega ponudnika e-računov (zaključki §2) — validator
   ponudnika, pošiljanje, potrditve (ACK). Pred tem postaviti izolirano `markec_einvoice_test`
   in ponoviti celotni itest.

## Datoteke spremenjene / dodane
- `src/lib/einvoice/official.ts` — `EINVOICE_VALIDATOR` mode (auto/dev-java/off) + NOT_VERIFIED.
- `docs/einvoicing/artifacts/MANIFEST.md` — preverba 3.0.22, xmlresolver 5.2.2, UJP artefakti, licence.
- `docs/einvoicing/artifacts/ujp/**` — uradni UJP artefakti (shema podpisa, eVloge, PDF-ji).
- `docs/einvoicing/artifacts/validator/xmlresolver.jar` → 5.2.2 (SHA posodobljen).
- `scripts/_smoke-official.ts` — reproducibilni smoke validatorja.
- Izpis reproducibilne SHA sken-ja (poročilo).