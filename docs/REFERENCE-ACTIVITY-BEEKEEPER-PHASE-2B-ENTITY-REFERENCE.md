# MARKEC — FAZA 2B: UNIVERZALNI entityReference RELACIJSKI MEHANIZEM

> Po `docs/REFERENCE-ACTIVITY-BEEKEEPER-PHASE-2A-RELATIONAL-ARCHITECTURE.md`. Izvedeno na izolirani
> `markec_f631_test` (dev + itest s pravo bazo). Nista spremenjeni shema, migracije, produkcija,
> `markec_dev`, Vercel, ni git add/commit/push; `einvoices.ts` (tuji WIP) NI dotaknjen.

---

## 1. Spremenjene datoteke

| Datoteka | Sprememba |
|---|---|
| `src/lib/profiles/types.ts` | `ProfileFieldType` + `"entityReference"`; `ProfileFieldDef.referenceTo?: {extensionId, entityKey}`. |
| `src/lib/profiles/extensions.ts` | `fieldDefSchema`: dodan `entityReference` + validiran `referenceTo` (regex); `.refine` — entityReference brez referenceTo → napaka pri load. |
| `src/lib/field-validation.ts` | `ValidatableField.referenceTo?`; v `validateFieldValues` smer entityReference: potrdi string id (cap 200), optional prazna → izpuščen. (Existence/org-scope je server-side — ta funkcija je client-safe/deljena z javnimi obrazci.) |
| `src/app/actions/records.ts` | **Strežniška varnost:** `validateRecordReferences(fields, clean, org.id)` — za vsak entityReference `findFirst({ id, organizationId, extensionId, entityKey })`; če ne obstaja/napačna entiteta/tuj org → `INVALID_REFERENCE`. Klicana v `create` in `update`. `listExtensionRecordOptions({extensionId, entityKey})` — picker, scoped na entiteto. `mergeDataPreserveLegacy` — pri update obdrži legacy/ne-več-deklarirane ključe (varuje stare text podatke pred migracijo). |
| `src/components/admin/records/records-client.tsx` | Naloži ref options (org-scoped) za vse entityReference cilje; dialog renderi `entityReference` kot **spustni seznam** z title-i + "— ni povezave —"; tabela razreši id→naslov (+ "(izbrisano / neznano)"); `errorText` mapira `INVALID_REFERENCE`. |
| `src/lib/i18n/dict/records.ts` | `errorInvalidReference` (SL/EN): "Izbrana povezava ne obstaja v vašem podjetju ali je napačne vrste." |
| `src/lib/profiles/extensions.ts` (bee-apiary) | Dodane reference: `hive.apiary_ref→apiary`, `colony.hive_ref→hive`, `inspection/treatment/feeding/queen_management/task→colony_ref`, `harvest.apiary_ref→apiary`. Vse **neobvezne** (stari text zapisi ostanejo). |
| Testi | `tests/integration/f2-3/entity-reference-2b.itest.ts` (nov, 7 testov, prava baza, 2 org); `tests/field-validation.test.ts` (+4 enote). |

## 2. Implementirane funkcionalnosti (PASS)

- **Tip `entityReference` + `referenceTo`** v univerzalnem jedru — deklarativno, brez per-org kode.
- **Stabilni ID** (priložek ExtensionRecord id) shranjen v JSON `data`.
- **Picker org-scoped** (`listExtensionRecordOptions` + filter extensionId/entityKey) — ne pokaže tujih ali napačnih entitet.
- **Prikaz naziva** povezanega zapisa (tabela + dropdown title), izbrisano → "(izbrisano / neznano)".
- **Urejanje + odstranitev** (update/remove).
- **Konfiguracijska validacija** `referenceTo` v registru extensions (zod + refine).

## 3. Način strežniške validacije (kritično)

`validateRecordReferences` v `records.ts` (klicalo v create/update):
```
for each field.type === "entityReference":
  if value != null && value != "":
    target = prisma.extensionRecord.findFirst({
      where: { id: value, organizationId: org.id,
               extensionId: ref.extensionId, entityKey: ref.entityKey }
    })
    if !target → errors[key] = "INVALID_REFERENCE"
```
- **ID iz brskalnika nikoli ni zaupan**; org pride iz `requirePermissionOrg` (fail-closed), ne iz clienta.
- Tuj org / neobstoječi id / napačna entiteta / odt internet → `INVALID_REFERENCE`. Enako velja direkt na strežniškem klicu (itest 3/4).

## 4. Rezultati testov (dejanske številke)

**Itest (prava baza, f631, 2 organizaciji) — `entity-reference-2b.itest.ts`: 7/7 PASS**
1. shrani veljaven id (apiary→hive) ✓
2. neobstoječ id → INVALID_REFERENCE ✓
3. id napačne entitete (batch za hive.apiary_ref) → INVALID_REFERENCE ✓
4. id iz DRUGE organizacije (IDOR) → INVALID_REFERENCE ✓
5. posodabljanje reference (apiary A→B) + odstranitev → PASS ✓
6. picker ne prikazuje zapisov druge organizacije ✓
7. regresija non-reference (batch) + brez ref ✓

**Enote — `field-validation.test.ts` + extensions/registry: 46/46 PASS** (entityReference type-clean, referenceTo schema).
**itest f635 (varnost/izolacija): 7/7 PASS.**
**Vitest — celoten paket: 91 files / 1329 tests PASS** (1325 + 4 nova).

## 5. Browser dokaz (Playwright, dev 3015, f631 — čebelar)

- Odprt dialog "Panj" → **entityReference select (Panjska postaja) napolnjen z title-i obstoječih zapisov iste org** (`candidateTitles: ["BP-501", …]`), izbira na voljo (picker), ne raw ID. → **PASS**.

## 6. Preverjanje izolacije 2 organizacij

- Itest 4: id iz `mehanik` org (tuj čebelarju) → `INVALID_REFERENCE`.
- Itest 6: picker v seji `mk` ne vrne `cb`-jevega apiary landa; in obratno.
- ExtensionRecord je org-scoped (`organizationId` filter povsod); `getExtensionEntities`/`listExtensionRecordOptions` org-scoped.

## 7. Prva uporaba – čebelarstvo (PASS)

- Panj→postaja, družina→panj, pregled/zdravljenje/hranjenje/matice/opravila→družina, pridelek→postaja — kot `entityReference` polja (neobrezna; stari text ohranjen prek `mergeDataPreserveLegacy`).

## 8. Znane omejitve / notranja opomba (pošteno)

- **Multi-target reference** (opravilo → postaja ALI panj ALI družina) ni pokruta z enim `referenceTo` (single-target po dizajnu). Za Faza 2C predlagamo `target_kind` select ali razširitev `referenceTo` na array; opravilo zdaj veže na družino (`colony_ref`).
- Spartan `listExtensionRecordOptions` je omejeno na 300 zapisov — pri zelo večjih org bi potrebovala search (Faza 2C).
- EntityReference shranjuje Raw ID; brisanje ciljnega zapisa pusti news "(izbrisano / neznano)" (SetNull-like po UX-u) — ded. `onDelete` za EPS ni možno ker JSON. Ohranje zgodovina zahteva audit (Faza 2C).

## 9. Ovire za naslednjo fazo

- Vse za 2B je zeleno. Za **2C** (zgodovina selitve `colony_move`, multi-target, search) ni blokatorjev; za **2D** (sledljivost prodaje `OrderItem.batchRecordId`) bo potrebna **majhna nadgradnja sheme** → ločena odobritev in migracija (per §9 Faza 2A).
- Tuji WIP `einvoices.ts:51` še vedno pade production build (nespremenjen; uskladitev lastnika pred Faza 2D/build).

## 10. Statusni pregled

| Funkcija | Status |
|---|---|
| entityReference tip + referenceTo + schema validacija | **PASS** |
| Shranjevanje veljavnega ID | **PASS** |
| Neobstoječ ID / napačna entiteta / tuji org → INVALID_REFERENCE | **PASS** (itest 2/3/4) |
| Posodabljanje / odstranjevanje reference | **PASS** (itest 5) |
| Picker ne prikazuje drugih org | **PASS** (itest 6 + browser) |
| Razumljiv naziv povezanega, izbrisano stanje | **PASS** (browser picker + UI) |
| Univerzalnost (brez per-org kode) | **PASS** (jedro, deklarativno) |
| Regresija obstoječih evidence | **PASS** (vitest 1329) |
| Mobilno delovanje | **DELNO** (select-native, responsive; ni ločene mobilne preverbe v tej fazi) |

**Zaključek:** Faza 2B je izvedena in dokazana (jedro + čebelarstvo + izolacija). **Faza 2C, 2D, 2E se ne začnejo brez nove odobritve.** Priporočilo: naslednja odobrena faza = **2C** (zgodovina selitve družine + multi-target/search).

---

## 11. DODATNO E2E PREVERJANJE (browser, f631) — dejansko shranjevanje reference

Po zahtevi o dodatnem preverjanju je bil izveden nov E2E pojempoo: `scripts/f2b-e2e-proof.mjs` (realni Playwright chromium, dev 3016, prijava čebelar `cb@f631.test`).

Potek in DEJANSKI rezultati (vsak korak po realnem stanju, nič artikane):

| Korak | Rezultat | Dokaz |
|---|---|---|
| Prijava + odpri Evidence | **PASS** | /dashboard/records 200 |
| Ustvari enolično postajo `XZ-Postaja-B515` (UI) | **PASS** | ID zapisa `cmwddfw4e0…` (realni ExtensionRecord, iz pickerja) |
| Ustvari panj `XZ-Panj-B515` v UI + izberi postajo po nazivu | **PASS** | `selectOption` po labelu; `selectedRef` = `cmwddfw4e0…` |
| Shrani zapis → vrstica v seznamu | **PASS** | `shrani-ui${panjLabel}` → `true`; DB/UI pokaže vrstico |
| Ponovno odpri (reopen edit dialog) | **PASS** | `reIzbrana: true`, `reopenedRef === selectedRef` (`cmwddfw4e0…`) — **ISTI ohranjeni ID** |
| Naslov ponovno odprtega | **PASS** | `reopenLabel === panjLabel` |
| Prikaz naziva, ne ID, v seznamu/tabeli | **PASS** | entityReference razrešen na title (UI razrešuje id→naziv) |
| Negativni primer (UI) | **NOT VERIFIED v UI** | picker (`native select`) nudi le VALNE opcije iz iste org — invalid ID prek pickerja ni mogoč; ročni JS-tampering se v tem repliku ni deterministično prenesel v React (dialog se je zaprl kot shranjen veljaven). **Strežniška zavrnitev invalidne reference je zanesljivo dokazana v itest 2/3/4** (`INVALID_REFERENCE`: neobstoječ / napačna entiteta / tuji org). |
| Čiščenje testnih podatkov | **PASS** | `DELETE ExtensionRecord` kjer `title`/`data` začne z `XZ-` → 2 pobrisana, nadaljnji count=0 |

**Glavni zaključek dodatnega E2E:** *dejansko shranjevanje reference deluje — panj je bil ustvarjen v UI, postaja izbrana po nazivu, izbrani in ponovno odprti `apiary_ref` ID sta enaka (`cmwddfw4e0…`), vrstica v seznamu prisotna.* Negativni UI primer ni čisto izvedljiv (picker z validnimi opcijami); strežniška validacija je dokazana na integracijskem nivoju.

### Dodatna končna ocena (ta odmor)
- ustvarjanje: **PASS**
- shranjevanje: **PASS**
- ponovno odpiranje (isti ID): **PASS**
- dokaz ohranjenega ID-ja: **PASS** (`reopenedRef === selectedRef`)
- čiščenje testnih podatkov: **PASS** (0 ostankov `XZ-*`)
- negativni primer: **NOT VERIFIED v UI** / **PASS (strežniško)** — itest 2/3/4 `INVALID_REFERENCE`

**Faza 2C se ne začne brez nove odobritve.**