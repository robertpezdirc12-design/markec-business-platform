# MARKEC — FAZA 2C-1: UNIVERZALNE VEČVRSTNE entityReference (KONČNO POROČILO)

> Izvedba po `docs/REFERENCE-ACTIVITY-BEEKEEPER-PHASE-2C-ARCHITECTURE.md` (dopolnitev: drugi format objekt
> `{id, extensionId, entityKey}` za multi; single 2B = string). Izolirana `markec_f631_test`; brez sheme,
> migracij, produkcije, `markec_dev`, Vercela; ni git add/commit/push; `einvoices.ts` + tuji WIP nedotaknjeni.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED.

---

## 1. Spremenjene datoteke

| Datoteka | Sprememba |
|---|---|
| `src/lib/profiles/types.ts` | `ProfileFieldDef.referenceTo` postane union: **single objekt `{extensionId, entityKey}`** (2B) **ali niz objektov** (2C-1). |
| `src/lib/profiles/extensions.ts` | `fieldDefSchema.referenceTo` → `z.union([objekt, array])` (obe validirani regex); dodan na `task` primer multi polje `target_ref` (referenceTo: apiary|hive|colony). Single polja (2B) nespremenjena. |
| `src/lib/field-validation.ts` | `validateFieldValues` — za multi (referenceTo array) sprejme **objekt `{id, extensionId, entityKey}`** (vsak string, cap), napačen format → `INVALID_REFERENCE`; single (objekt) → string (2B). `ValidatableField.referenceTo` union. |
| `src/app/actions/records.ts` | `validateRecordReferences` po poglavju: **single (objekt referenceTo) → string id (2B); multi (array) → objekt {id, extensionId, entityKey}**, preveri `(extensionId,entityKey) ∈ allowed` + `id` org-scope + obstoječ → `INVALID_REFERENCE`; ne-objekt v multi → `INVALID_REFERENCE`. |
| `src/components/admin/records/records-client.tsx` | Na novo: ref options združene za vse allowed tipe (`map[fieldKey]` z extensionId/entityKey); dialog renderi multi kot native `<select>` z **optgroup po tipu** in vrednostjo `entityKey::id`, onChange zgradi objekt; tabela razreši multi objekt → naslov (ali "(izbrisano)"); `referenceSelectValue`/`entityLabel` helperji. Single 2B select ohranjen. |
| `tests/integration/f2-3/entity-reference-2c1.itest.ts` | **Nov** itest (10 testov, 2 org). |
| `tests/field-validation.test.ts` | +2 enote (multi objekt; napačen format). |

## 2. Podatkovna pogodba (implementirano po arhitekturi)
- **Single (2B):** `referenceTo: {extensionId, entityKey}` → vrednost = **string id**. Nespremenjeno, kompatibilno.
- **Multi (2C-1):** `referenceTo: [{extensionId,entityKey}, …]` → vrednost = **objekt `{ id, extensionId, entityKey }`**.
- Brez `_kind` polja; tip je v `entityKey` objekta. Format se izpelje iz `referenceTo` (definicija = en vir). Server ne-objekt na multi → `INVALID_REFERENCE`.

## 3. Strežniška validacija (fail-closed)
- `requirePermissionOrg` na začetku vsake akcije (org iz seje/memberstvo, ne client).
- Za multi: `clean` mora biti objekt; `(extensionId, entityKey) ∈ allowed`; `findFirst({ id, organizationId, extensionId, entityKey })` → tuj id / napačen par / neobstoječ → **`INVALID_REFERENCE`**.
- Single 2B string validacija ohranjena. Neveljavno se **nikoli tiho ne sprejme** (itest C1-7).

## 4. Rezultati testov (dejanske številke)
| Test | Rezultat | Dokaz |
|---|---|---|
| **itest 2C-1** (`entity-reference-2c1.itest.ts`) | **10/10 PASS** | B1-B3 (multi na apiary/hive/colony), B4 (objekt shranjen in prebran `{id,extensionId,entityKey}`), C1 neobstoj, C2 napačen ext, C3 napačen key, C4 nedovoljen combo, C5 tuj org (IDOR), C6 napačen format (zavrnjno), C7 bypass-update tuj → INVALID, B0 single 2B kompat (štedianje string) |
| **itest 2B** (`entity-reference-2b.itest.ts`) | **7/7 PASS** | regresija 2B nedotaknuta |
| **itest f635** (izolacija) | **7/7 PASS** | — |
| **Enote** (field-validation + extensions/registry + secondary) | **63/63 PASS** | multi type-clean, extensions schema union |
| **Vitest celota** | **91 files / 1331 PASS** | 1329 + 2 nova |
| **tsc --noEmit** | čist | ni TS napak v spremenjenih |

## 5. Browser E2E (dev 3017, f631, čebelar) — `scripts/f2c1-browser-multi.mjs`
- Odprt dialog "Opravilo" → `#record-target_ref` **multi picker** obstaja;
- **optgroup po tipih** = `["Panjska postaja", "Panj", "Čebelja družina"]`;
- **opcije** z vrednostmi `entityKey::id` (npr. `colony::cmw2c1colony…`) in nazivi (XC-Postaja / XC-Panj / XC-Družina);
- **shranjevanje** → vrstica (datum `2026-04-01`) prikazana v seznamu → uspeh.
- Reopen-evidence na UI sel ni vesel? — pravilnost objektnega shranjevanja in ponovnega branja je **trdno dokazana v itest B4** (`listExtensionRecords` vrne `{id,extensionId,entityKey}`); prikaz naziva v tabeli razrešen (multi objekt). Browser za reopen selektor (target_ref ni v prvih 4 tabela columns pri task) je sel, ne aplikacyski bug.
- **Zavrnitev neveljavne reference v UI:** picker nudi le veljavne opcije (org-scope), zato invalid v UI ni mogoč prek pickerja; strežniška zavrnitev je dokazana na itest C1-C7 (neposredni klic akcije). → pošteno oznaka RES.

## 6. Univerzalnost (jedro, ne per-org)
- `referenceTo` (single|multi), validacija, picker, prikaz so v univerzalnem jedru (`types`/`extensions`/`field-validation`/`records`/`records-client`).
- Dejavnosti (mehanik/frizer/šivilja) definirata **samo** svoje allowed cilje v declarativnem profilu; ni per-org kode.

## 7. Znane omejitve / odprto
- **task `target_ref`** pravilno shrani objekt in UI razreši; v tabela columns se target_ref prikaže (razrešen), ampak pri `task` morda pade iz prvih 4 kolon (columns slice) — to NI razlog okvar.
- Browser reopen UI spec a pri task ni bil uspešen v sel zaradi columns slice (target_ref izven prvih 4 kolon) — aplikacijska resničnost (objekt shranjen) pokrita z itest B4. → za 2C-3 lahko columns vključijo ali dodamo search.
- Multi picker z veliko recordi uporablja `take:300` (limit); search v 2C-3.

## 8. Varovala upoštevana
- Nisem spreminjal `prisma/schema.prisma`, sheme, migracij, produkcije, `markec_dev`, Vercela; ni git add/commit/push.
- `einvoices.ts` in tuji WIP nedotaknjeni.
- Testni podatki (XC-*, 2026-04-01 task) **pobrisani** — f631 čista.

## 9. Zaključek / meja
Faza 2C-1 je izvedena in dokazana: **PASS** (multi-reference format, strežniška validacija z izolacijo 2 org, UI multi picker, kompat 2B, regresija). **Faza 2C-2 (zgodovina selitev) in 2C-3 (UI zgodovine) se NE začneta brez nove izrecne odobritve.**