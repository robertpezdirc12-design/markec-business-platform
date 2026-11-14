# MARKEC — FAZA 2C-3: UNIVERZALNI RECORD DETAIL + ZGODOVINA SELITEV (IMPLEMENTACIJA)

> Po potrjenem načrtu `REFERENCE-ACTIVITY-BEEPER-PHASE-2C-3-UI-PLAN.md`. Nastala kot **generični vzorec
> Record Detail** (ne le čebelarski zaslon) + **čebelarska razširitev za entiteto `colony`** (zgodovina selitev).
> Strežniška logika Faze 2C-2 se ni spreminjala (le additive helper za UI). Brez sheme/migracij/produkcije/Git.

---

## 1. Arhitektura generičnega detail panela
- **`src/components/admin/records/record-detail.tsx`** — nova generična komponenta `RecordDetail`:
  - Nariše **podrobnosti vseh deklarativnih polj** entitete (read-only).
  - Ima **izoliran razširitveni del** (`entity.key === "colony"` → čebelarska sekcija). Jedro NE vsebuje
    industrijskih podrobnosti; druge dejavnosti lahko dodajo lastne sekcije v istem vzorcu.
  - Ločitev: komponenta je generična → per-org/entiteni vzorec, brez hardkoda drugih dejavnosti v jedro.
- V `records-client.tsx` vsaka vrstica dobi **gumb "Podrobnosti"** (EyeIcon, pred Uredi), ki odpre
  `RecordDetail`. Nobena nova navigacija/menija ni bila dodana.

## 2. Uporabljene strežniške akcije
- **`listColonyMoveDetail(colonyId)`** (nova, additive v `colony-moves.ts`): vrne
  `colonyLabel, currentHiveId, currentHiveTitle, currentApiaryTitle, events[]` z razrešenimi nazivi panjev,
  **imeni izvajalcev**, baseline/korekcijo/korekcijski sklic. Org-scoped (`requirePermissionOrg`).
- **`createColonyMove`** in **`correctColonyMove`** — UI jih kliče NEPOSREDNO (brez generic CRUD). Logika 2C-2
  nespremenjena.
- **`listColonyMoveHistory`** — le razširjen izhod (dodani `recordedAt/reason/isCorrection/correctsRef/
  correctionReason` — poslovna pravila ne dotaknjena).

## 3. Varnost in dovoljenja
- Vse akcije **`requirePermissionOrg("workorders.manage")`** (fail-closed) — uporabljena obstoječa pravica,
  skladno z obstoječim modelom (ločevanje pregled/selitev/korekcija na več pravic bi zahtevalo spremembo
  permission modela — **NI narejeno**; skupne pravice enake kot pri ostalih evidencah; skriti gumb ni varnost).
- **`performed_by`** — vedno strežniško določen; UI ne pošilja. Imena razrešuje strežnik **samo za člane iste
  organizacije** (OrganizationMember ∩ User); tuji → `performedByName=null` ("Neznan uporabnik"), brez razkritja
  tujih identitet.
- **Org izolacija**: druga org → `ok:false`; reference/picker org-scoped (ni cross-org povezav).
- **Append-only** — zaščita na strežniku (generic CRUD → APPEND_ONLY); UI nima brisanja/urejanja originalov.

## 4. Razreševanje izvajalca (§6)
- `listColonyMoveDetail`:
  - zbere uniq `performedById` iz zgodovine,
  - poišče **OrganizationMember te org** (isti `organizationId`), nato `User.name`.
  - Če uporabnik ni član te org ali ni najden → `performedByName = null` → UI pokaže **"Neznan uporabnik"**.
- Ni novih polj, ni sheme. `colony-moves.ts` poslovna logika 2C-2 NESpremenjena (helper je additive).

## 5. UX / vizualne odločitve
- **Desktop**: detail dialog (max-width 2xl, scroll) s podatki družine na vrhu, zgoraj **trenutna lokacija**
  (naziv panja + postaja), časovnica (navpična, s **Baseline / Premik / Korekcija** značkami).
- **Mobile**: dialog responziven, navpična postavitev, brez vodoravnega drsenja (tablo/formi en kolona).
- **Akcije**: "Preseli družino" → forma (ciljni panj iz org-scoped pickerja, datum `moved_at`, razlog);
  "Popravi" pod vsakim dogodkom → `correctColonyMove` (cilj + razlog korekcije).
- **Stati**: loading (spinner), kot naložitev; empty history ("Ni še zabeleženih selitev."); error load (retry);
  uspehi (toast); baseline / neznani izvor / korekcija ločeni z značkami.
- **Traductions**: vse novo besedilo je v `src/lib/i18n/dict/records.ts` (`recordsSl.detail` / `recordsEn.detail`),
  SL + EN, ni hardkodiranih nizov v komponentah.

## 6. Testi in dejanski rezultati
| Test | Rezultat | Dokaz |
|---|---|---|
| **itest 2C-3** `colony-move-detail-2c3.itest.ts` (4) | **4/4 PASS** | names istele org prazna baseline/korekcija; tuj user → unknown; korekcija original+correction; tuja org → ok:false |
| **itest** (vse: f635+2b+2c1+2c2+2c3) | **47/47 PASS** | — |
| **Vitest** celota | **91 files / 1331 PASS** | na enaki bazi kot prej (2c3 je itest, enote nespremenjene) |
| **tsc --noEmit** | čist | ni TS napak |
| **Browser E2E** `f2c3-browser-detail.mjs` (f631) | **PASS** | detail→lokacija Panj-A→prazna zgodovina→preseli Panj-B→razlog→refresh→lokacija Panj-B + baseline+dogodek |

## 7. Spremenjene datoteke
- `src/components/admin/records/record-detail.tsx` — **novo**: generični RecordDetail + čebelarska razširitev.
- `src/components/admin/records/records-client.tsx` — gumb "Podrobnosti" (EyeIcon) + state/render.
- `src/app/actions/colony-moves.ts` — **nov helper** `listColonyMoveDetail` (additive) + razširjen izhod
  `listColonyMoveHistory` (logika 2C-2 NESpremenjena).
- `src/lib/i18n/dict/records.ts` — `recordsSl.detail` / `recordsEn.detail` (SL/EN).
- `tests/integration/f2-3/colony-move-detail-2c3.itest.ts` — **novo**.
- `scripts/f2c3-browser-detail.mjs` — **novo** (browser E2E, testni podatki F2C3-* pobrisani po testu).

## 8. Znane omejitve / poštno
- **Dovoljenja**: pregled / selitev / korekcija so pod isto `workorders.manage` (kot vsi records) — ni ločenih
  pravic (ločitev bi zahtevala spremembo permission modela → izven odobrenega obsega, zabeleženo).
- **UI korekcija**: `correctColonyMove` popravlja cilj; original ostane viden z oznako "popravljeno"; ni urejanja
  datumov/razlogov originala (skladno z 2C-2 omejitvijo).
- **Mobilni E2E na 390px** (zadnji del §13.B) ni ponovljen kot celovit browser test v tej sesiji (predvideno
  za 2D/fazi) — označeno pošteno.
- **Build**: `npm run build` **NOT VERIFIED** — tuj `einvoices.ts` WIP ga še blokira (nisem ga popravil).
- Tuji WIP (`schema.prisma`, `einvoices.*`) **nedotaknjeni** — potrjeno s pregledom diffa.

## 9. Zaključek
Faza 2C-3 je implementirana in testno dokazana (PASS) kot **univerzalni RecordDetail** z **čebelarskim primerom
(zgodovina selitev)**, uporabljajoč neposredno obstoječe akcije 2C-2 (brez spreminjanja njihove logike). **Faza 2D-1
se ne začne brez izrecne odobritve.**