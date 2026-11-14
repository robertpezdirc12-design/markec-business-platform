# MARKEC — FAZA 2C: ZGODOVINA SELITEV + VEČVRSTNE POVEZAVE (ARHITEKTURA, READ-ONLY)

> Nadgradnja univerzalnega `entityReference` mehanizma (Faza 2B). **Samo analiza + načrt — nič
> spremenjeno (koda/shema/baza).** Vse ugotovitve podprte z datotekami/vrsticami/testi.
> Oznake: **DOKAZANO / DELNO / NI PREVERJENO**.

---

## 1. Analiza trenutnega stanja (pregledano)

### 1.1 Git stanje / tuji WIP
- `prisma/schema.prisma` je **M s tujim WIP** (commit 06248ab — "moduli / ConfigChangeLog revizija", +825 vrstic) — **analiza ga ne dotika; izvedba, ki bi šla v shemo, zahteva uskladitev in ločeno odobritev.**
- Moje datoteke (Faza 2B): `types.ts`, `extensions.ts`, `field-validation.ts`, `records.ts`, `records-client.tsx`, `i18n/dict/records.ts` — stanje po 2B (v nadaljevanju).

### 1.2 Kako deluje entityReference (DOKAZANO — Faza 2B)
- **Tip** `"entityReference"` v `ProfileFieldType` (types.ts) + `ProfileFieldDef.referenceTo?: { extensionId, entityKey }`.
- **Strežniška vrednost** = string id `ExtensionRecord` v JSON `data`; `validateRecordReferences` v `records.ts` preverja `(id, organizationId, extensionId, entityKey)` → `INVALID_REFERENCE` (neobstoječ / napačna entiteta / tuj org). Pick potrjen itest 2B (7/7) + browser E2E (dejansko shranjen ID, reopen enak).
- **Picker org-scoped** (`listExtensionRecordOptions` s filterjem), UI select s title-i, tabela razreši id→naziv, `mergeDataPreserveLegacy` ohrani stare podatke.

### 1.3 Trenutna družina ↔ panj
- `colony` ima `hive_ref` (entityReference→hive, optional) poleg legacy `hive` (text). **NI zgodovine** — samo trenutna vrednost; preselitev bi prepisala `hive_ref`, zgodovina bi se izgubila (DEL A manjka).
- **Opravilo** (`task`) ima **enojni `colony_ref`** (samo družina) — ne podpre "postaja ALI panj ALI družina" (DEL B manjka).

### 1.4 ExtensionRecord model (DOKAZANO)
- Ena org-scoped tabela; `id, organizationId, extensionId, entityKey, title, data(Json), customerId?`.
- **Ni relacije dogodek→zgodovina**; ni `onDelete` za JSON-reference (brisanje cilja → UI pokaže "(izbrisano)"). Ni polja `createdById` na ExtensionRecord (le createdAt/updatedAt).

### 1.5 Kaj že dela vs. delno vs. manjka
| | Stanje |
|---|---|
| entityReference en vrst, org-scope, picker, prikaz | **DOKAZANO / dela** (2B) |
| Zgodovina selitev družine | **MANJKA** (samo trenutna `hive_ref`) |
| Večvrstna referenca (task→apiary|hive|colony) | **MANJKA** (single-target) |
| Revizijska sled sprememb evidence | **NI (na ExtensionRecord)** — le ConfigChangeLog obstaja za nastavitve (tuj WIP) |
| Uporabnik na dogodku | **MANJKA** (ExtensionRecord nima createdById; vse/nevisible) |
| Preprečevanje nelogičnega (selitev v isti panj) | **MANJKA** |

## 2. DEL A — Zgodovina selitev družine (predlog)

### 2.1 Arhitektura lokacije
Priporočena: **KOMBINACIJA** — družina ima `current_hive_ref` (za hitri pogled/sort) IN obstaja append-only zgodovina `colony_move` (avtoriteta resnice za "kje je bila na datum"). Utemeljitev:
- `current_hive_ref` = hitra trenutna lokacija (UI, filter, poročila) brez agregacije vsakič.
- append-only zgodovina = rekonstrukcija stanja na dan (zaporedje dogodkov datum≤X), revizijska sled, nepopravljanje zgodovine.
- Razlogi: (a) ena sama "izpeljan" bi bila počasna/kompleksna za UI in bi izgubila revizijsko sled, (b) samo "shranjena" brez zgodovine izgubi zgodovino. Kombinacija je standardni "current + immutable ledger".

### 2.2 Dogodek `colony_move`
- **Univerzalno:** event entiteta v registru (npr. v `bee-apiary` `entityKey: "colony_move"`) — uporabi obstoječi `ExtensionRecord` (brez sheme). Polja:
  - `colony_ref` (entityReference→colony, required),
  - `from_hive_ref` (entityReference→hive, optional — izvor pri premik itd.),
  - `to_hive_ref` (entityReference→hive, required),
  - `moved_at` (date/datetime),
  - `reason` (textarea optional),
  - `performed_by` (text optional — vodi k `createdById` kadar ga dodamo; za zdaj `data.performed_by`).
- **Pravila:**
  1. `to_hive_ref != from_hive_ref` (selitev v isti panj → zavrnjeno `SAME_HIVE`).
  2. Vsi ref counterpart morajo pripadati ISTI org → obstoječi `validateRecordReferences` (org+entity) to pokrije; dodati org-ujemanje `colony` in `to_hive` iste org.
  3. Podvojen/dvoumno datirano → uniq (colony_ref, moved_at) kot preventivni; ali app-logi (stikane).
  4. Append-only: **prepovedan `delete`/`update` zgodovinskega dogodka** (ali le przez "popravek" z novo entiteto `colony_move_correction` ali "reverse move"), da se zgodovina ne tiho uniči.
  5. Revizija: vsak dogodek je samovoljen record (immutable), s `performed_by`; pri budući `createdById` na shemi.
- **Trenutna lokacija:** ob uspešni selitvi atomarno posodobimo `colony.current_hive_ref` = `to_hive_ref` **v isti transakciji** kot ustvarijo `colony_move` (izogibrace dirkanju, konzistenci).
- **Lokacija na izbran datum:** SQL-vprašanje: najnovejši `colony_move` z `moved_at <= D` za družino → to_hive; če ni dogodka → demonstracija current (ali začetno from) — implementira se kot pure helper.

### 2.3 Popravljanje napačne selitve
- Ne prepisujemo starega dogodka. Dodamo **reverzni dogodek** (»povzeto nazaj«) ali `colony_move` novi s pravilno info in opombo — zgodovina ostane verodostojna revizijska sled. UI ponudi "odpravi" → generira novo lokacijsko spremembo (nov dogodek), ne reduce starega.

## 3. DEL B — Večvrstne reference (predlog)

### 3.1 Deklarativno
Razširimo `referenceTo` v **array** za multi-target (ohranimo string za nazaj združljivost):
```ts
referenceTo: { extensionId, entityKey } | { extensionId, entityKey }[]
```
Primer: `task.target_ref` → `referenceTo: [{bee-apiary,apiary},{bee-apiary,hive},{bee-apiary,colony}]`.
- Zod: nullable/string-array branch z `.refine` (vsak je veljaven par; entityReference mora imeti enega).

### 3.2 UI izbor
- Dialog: po "vrsti" select (`target_kind` → Panjska postaja/Panj/Družina) ali pa enoten search kombobox, ki po izbiri pokaže naziv + (za vektor) kakšen tip je izbran.
- **Prikaz naziva** (ne ID), search kadar je veliko, odstranitev povezave (optional).
- Za začetnika: enega naziv npr. "Tarča (družina / panj / postaja)" z jasnimi ločenimi skupinama v dropdownu (optgroup po tipu).

### 3.3 Strežniška validacija
- `validateRecordReferences` preveri vsak allowed par: `{id, organizationId, (extensionId,entityKey)∈ referenceTo[]}` → tuj org ali ni dovoljen tip → `INVALID_REFERENCE`. Enako kot sedaj, le OR-across allowed pairs.
- Shranjevanje: dodatno shranimo `_kind` (entityKey izbranega) v `data` za prikaz/trace.
- IDOR onemogočen (org-scope), ni per-org kode.

### 3.4 Kompatibilnost s 2B
- En SQL `referenceTo` (single) še deluje (obravnavo kot array z 1 elementom). UI/picker/prikaz isti; nove multi polja uporabijo nov format. `mergeDataPreserveLegacy` ščiti iter opi.

## 4. DEL C — Univerzalnost za druge dejavnosti (isti mehanizem, deklarativno)
- **Mehanik:** `vehicle` (record), `work_order`(delovni nalog — klik GUI), `service_record` z `vehicle_ref`; zgodovina servisov = `service_event` (record) kot pri čebeljem `colony_move`. Identita/trace per record.
- **Frizer:** `customer`(že jedro) → `appointment` → `service_occurrence` z `appointment_ref`; zgodovina obiskov = `visit` record.
- **Šivilja:** `customer` → `order` → `garment` z `order_ref` + mere `measurement_set`; zgodovina sprememb naročila = `order_change_event`.
**Univerzalno jedro:** `entityReference` (single+multi), event-record `*_move`/`*_event` vzorec, `validateRecordReferences`, picker, prikaz, (UI zgodovine komponent v Faza 2D). **Deklarativno per org:** kateri entiteti/cilji, terminologija, workflow. Ni per-org kopije.

## 5. DEL D — Uporabniški vmesnik (predlog)
- **Družina detail:** tabla/lista "Trenutni panj" + zavihek/panel "Zgodovina selitev" — vrstice (datum, iz → v, uporabnik, razlog).
- **Dodajanje selitve:** dialog — prikaže trenutno lokacijo, izbirnik ciljnega panja (picker entityReference, org-scoped), datum (naprej), razlog; po shranitvi posodobi trenutno + doda dogodek; prikaže UI toast.
- **Dostop do panja/družine** iz dogodka: klik gor → odpre povezani record (raje: link "#" na record — za 2D).
- **Večvrstni picker (task):** optgroup (Panjska postaja / Panj / Družina), prikaz izbranega naziva + ikona tipa, iskanje (substring), ali razlegena vrednost "(izbrisano)". Da user ne vidi ID-jev (nikoli).
- **Mobilne:** enaka picker v native select (kot sedaj), panel zgodovine zdrsne (accordion), vnosna polja širine sm:grid-cols-1. Brez raw ID.

## 6. DEL E — Podatkovni model in varnost

### 6.1 Možnosti za zgodovino
- **Opcija A (ZA 2C, brez sheme/migracije):** `colony_move` kot `ExtensionRecord` (entityKey v `bee-apiary`). Vse ključime v JSON `data` + entityReference polja; org-scope + validacija že; append-only pravele na nivoju strežniške akcije (`createMove` ima pravila; `deleteExtensionRecord` grep za event entityKey → blokiran/omejen). **Prednosti:** ni sheme (dela takoj, v skladu z omejitvijo), univerzalno. **Slabosti:** search/agregacija po JSON manj učinkovita; per-akcijska pravila (SAME_HIVE, reverse) so v strežniški losvojina; morda ni popolne relacijske revizije.
- **Opcija B (priporočena za 2D/nadgradnjo, zahteva novo tabelo → ločena odobritev):** nova relacijska tabela `EntityEvent` / `HiveMove`:
```prisma
model HiveMove {
  id             String  @id @default(cuid())
  organizationId String
  colonyId       String   // → ExtensionRecord bee-apiary.colony
  fromHiveId     String?
  toHiveId       String   // → ExtensionRecord bee-apiary.hive
  movedAt        DateTime
  reason         String?
  performedById  String?
  createdAt      DateTime @default(now())
  organization Organization @relation(..., onDelete: Cascade)
  colony ExtensionRecord @relation(fields:[colonyId], references:[id], onDelete: Restrict)
  fromHive ExtensionRecord? @relation(..., onDelete: SetNull)
  toHive ExtensionRecord @relation(..., onDelete: Restrict)
  @@index([organizationId, colonyId])
  @@index([organizationId, movedAt])
}
```
  Relacije, indeksi, onDelete (Restrict za sodniki; SetNull za izvor), transakcijsko atomarno posodobitvijo `colony.currentHiveId` + insert dogodka.
  To je shema/migracija → **ne izvedeno; predlagano + zahteva ločeno odobritev (uskladitev s tujim WIP sheme).**

**Priporočilo:** Faza 2C izvede **Opcija A** (event record v ExtensionRecord — tako delovanje brez sheme, v skladu z omejitvijo tega naloga, dokazuje univerzalni vzorec); Opcija B (relacijska tabela) pride v Faza 2D skupaj z `OrderItem.batchRecordId`, ko bomo s posebno odobritvijo urejali shemo in se uskladili s tujim WIP.

### 6.2 Varnost (v vseh)
- Vse akcije gre čez `requirePermissionOrg` (fail-closed); org iz seje/memberstvo.
- `validateRecordReferences` org+entity za vsak cilj (single & array), `INVALID_REFERENCE` za tuje/neke.
- Preprečevanje ponarejenih reference: picker org-scoped + server-side recheck.
- Revizijska sled: append-only event record + (naslednje) `createdById`.
- Obnašanje brisanja: `colony_move` z Restrict (ne sme biti izbrisan če racuna corrente) / UI prepreči brisanje zgodovinskih; ciljni hive Restrict; ali SetNull po UX pri JSON. Pri bazni (Opcija B) Restrict varuje.
- **Sočasne selitve družine:** transakcija `tx` (eneu update currentHiveRef + insert event), optimistična/st varovalka (če `colony.currentHiveRef` = from, sele po primeru) → druga selitev zavrnjena `CONCURRENT`.

## 7. DEL F — Testni načrt
- **Unit:** logika "lokacija na datum" (zaporedje), preverba `multi-reference` type-clean v `field-validation`, `referenceTo array` schema.
- **Integration (prava baza, 2 org):** pravilna selitev (currentHive upda + event); zgodovina več zaporednih; lokacija na datum; `SAME_HIVE` zavrnjen; neobstoječi ciljni panj; panj druge org (IDOR); podvojen dogodek; popravek (reverse/replacement event, ne reduce); sočasni selitvi (`CONCURRENT`); multi-reference valid; regresija 2B (single entityReference še dela in org-scope).
- **Browser E2E (Playwright, f631):** dodajanje selitve v UI, zgodovina vidna, trenutna lokacija spremenjena, mobil 390 (no overflow), večvrstni picker za `task`. Ne prikaz ID, cleanup.

## 8. Razdelitev implementacije na korake (za kasnejšo odobritev)
1. **Korak 2C-1 — uni-`entityReference` multi-target:** types (array), field-validation (type-clean), records (validacija OR/array), records-client (picker z optgroup + kind), tests (unit+itest), kompat 2B. Datoteke: types/extensions/field-validation/records/records-client. Brez sheme.
2. **Korak 2C-2 — event record zgodovine (Opcija A):** `colony_move` entity (ExtensionRecord) + server akcija `createColonyMove` (pravila SAME_HIVE, transakcija currentHive+event, append-only, performed_by) + UI zgodovina/driver + tests. Brez sheme.
3. **Korak 2C-3 — UI zgodovina + večvrstni picker razčiščavanje + mobilna; E2E.**
(Korak 2D — relacijska `HiveMove` tabela + `OrderItem.batchRecordId` — zahteva shemo/odobritev, ločeno.)

Vsak korak ima jasen PASS kriterij (testi + browser) in se izvaja ločeno, obvezno z regresijo (vitest + itest + tsc).

## 9. Tveganja in odprta vprašanja
- **Tveganja:** shema je tuj WIP (konflikt pri 2D); JSON-event izvedba manj relacijska (search/perf pri veliko dogodkih) → Opcija B v 2D; zgodovina-append-only po pravilih akcije (ne DB trditev) → lahka popravljava če kdo brez pravila briše; multi-reference spremeni UI (več izbirnikov) → ot framing za začetnike.
- **Odprta vprašanja:** naj `performed_by` živi v `data` (zdaj) ali `createdById` na shemi (2D)? Ali naj `colony_move` pravila (SAME_HIVE/append-only) veljajo za VSE event-entity ali le pri določenem konvencionalnem imenu? Kje naj UI zgodovine živi (univerzalni record-detail panel vs přiunkcional col)? — predlog: univerzalni "record history" panel (kjer recordi iste org z ref na družino) za 2D.

## 10. Jasno priporočilo
- Izvedi **Fazo 2C v Koraku 2C-1 (multi-target entityReference)** → **2C-2 (event record `colony_move` na ExtensionRecord — Opcija A, brez sheme)** → **2C-3 (UI zgodovina + večvrstni picker + mobile)**.
- Ne posegaj v shemo zdaj; relacijska `HiveMove` + `OrderItem.batchRecordId` postavimo kot **Faza 2D** z ločeno odobritvijo in uskladitvijo s tujim WIP `prisma/schema.prisma`.
- Vse z obveznimi testi (unit→integration→browser), regresijo vitest+itest, tsc.

**Ta faza (2C-analiza) ni spremenila nič.** Implementacija (Koraki 2C-1..3) zahteva novo izrecno odobritev.

---

# DOPOLNITEV 2C — KONČNE ODLOČITVE (arhitekturno, read-only)

> Ponovni pregled obstoječega (records.ts, records-client.tsx, types.ts, extensions.ts, ExtensionRecord shema,
> 2B testi) izvaja sledeče dokončne odločitve. **Kjer so tukaj v konfliktu s prejšnjimi predlogi, veljajo tukaj.**
> Nič programske kode/sheme/baze ni spremenjeno.

## A. Trenutna lokacija družine — ENOLIČEN vir resnice
**Odločitev:** `colony.hive_ref` (entityReference→hive) je **edini vir trenutne lokacije**. Predlog
`current_hive_ref` iz prejšnjega pola se **ČRTA** (preprečimo dva vira resnice). `colony.hive` (legacy text)
je samo ohranjena stara vrednost (ne uporabljena za trenutno stanje). `colony_move` je zgodovina.
Skladnost: vsaka selitev v **eni transakciji** (1) `update colony.hive_ref = new` (2) `create colony_move`. Zato sta
current in zgodovina *vedno* skladna (brez podvojenih podatkov; current je denormaliziran zadnji dogodek).

## B. Začetno stanje / baseline (obstoječe družine brez zgodovine)
- **Ne izmišljujemo datumov.** Obstoječa družina z `hive_ref`, a brez `colony_move`, **nima določljive izvedene
  zgodovine pred uvedbo sistema**.
- **Mehanizem:** deterministični **baseline-označba** implementirana brez sheme: ko uporabnik **prvič dodaja
  selitev** za družino, ki še nima / nikoli ni imela zgodovinskega dogodka, se v akciji `createColonyMove` ob
  prvem dogodku **vnese tudi `colony_move` tipa `baseline`** z `toHiveRef = takratne hive_ref` in `movedAt = null` (če ni potreba po datumu) ali
  `movedAt = <hive_ref neznan>` — namesto lažnih datumov: baseline dogodek dobi `baseline: true` + `kda`/`approxPast` = null,
  in `reason: "stanje ob uvedbi evidence"`. To **ni** izmišljen datum, ampak označena "znano stanje od začetka beleženja".
- **Prikaz:** zgodovina pred prvim pravim dogodkom → "pred začetkom vodenja evidence ni podatka"; baseline prikažemo
  kot "trenutno stanje ob začetku vodenja" (brez datuma), nikoli ne trdimo zgodovinske lokacije za datum pred njo.
- Rekonstrukcija za datum `D`: najnovejši `colony_move` z `movedAt <= D`;
  - če **ni** takega dogodka in ni baseline → **NI ZANESLJIVO** (UI opozori "za ta datum zgodovina ni bila vodena");
  - če obstaja baseline → pokaže "znano od začetka (datum neznan)";
  - če obstajajo pravi dogodki → zadnji `toHiveRef` pred `D`.
- **Ni sheme/migracije:** baseline je navaden event record (`baseline:true` v `data`), ne nova tabela.

### B2. Vrstni red PRVE selitve (ko družina še nima nobenega `colony_move`)
Primer vhod: `colony.hive_ref` = panj A; uporabnik prvič evidentira selitev družine v panj B.

Zaporedje znotraj **ene transakcije** (`tx`):
1. **Strežnik prebere trenutno lokacijo** `colony.hive_ref` (org-scoped, iz seje) → A.
2. **Ustvari baseline** (`colony_move` z `baseline: true`, `toHiveRef = A`, `movedAt = null`, `reason "stanje ob uvedbi evidence"`, `performed_by` iz seje), **edino kadar soči še ni nobenega eventa** za to družino.
3. **Ustvari dogodek selitve** A → B (veljavna akcija, `toHiveRef = B`).
4. **Posodobi `colony.hive_ref = B`**.
5. Če katerakoli operacija odpove (npr. napaka pri shranjevanju B, tuj panj) → **rollback celotne transakcije**; ni delnega stanja (ni baseline brez selitve in obratno; `hive_ref` se ne spremeni, če event ne uspe).

### B3. Manjkajoča začetna lokacija (ne izmišljaj)
- Če `colony.hive_ref` je prazen (družina brez znane lokacije) in uporabnik vnese prvo selitev v B:
  - **baseline se NE ustvari** z izmišljeno lokacijo A;
  - ustvari se samo event `colony_move` A→B, kjer je `fromHiveRef = null` in `toHiveRef = B`,
    s poljem `originUnknown: true`;
  - `colony.hive_ref` se posodobi na B.
- UI/dogovor: `fromHiveRef = null + originUnknown: true` pomeni "izvor pred začetkom evidence ni znan" (ne "brez panja").

### B4. Časovna veljavnost baseline / `movedAt = null`
- Baseline **nikoli ne dobi izmišljenega `movedAt`**. `movedAt = null` ostane.
- Dejanski sistemski čas, ko je bila lokacija **prvič vnesena**, je **`createdAt` strežniškega zapisa** (nak.- `ExtensionRecord.createdAt`, PostgreSQL `now()`). Baseline zato ima `data.recordedAt = createdAt` (ločeno od zgodovinskega `movedAt`).
- **Tri jasno ločene vrednosti:**
  1. `movedAt` (zgodovinski datum prihoda na lokacijo) — pri baseline **null** (neznano);
  2. `recordedAt` (= `createdAt`, dejanski čas, ko je sistem prvič zabeležil trenutno lokacijo) — **system, zanesljiv**;
  3. `movedAt` poznejših selitev — dejanski datumi.
- Prikaz: baseline se nikoli ne izpiše kot "na lokaciji X od datuma Y" za Y, ki ni dokazan; prikaže "omenjeno na lokaciji X od vodenja evidence (datum lokacije neznan, beleženo od {recordedAt, časopisno})". Za datum pred `recordedAt` in pred prvim pravim dogodkom → **NI ZANESLJIVO**.

## C. Izvajalec selitve (`performed_by`)
- **Odločitev:** izvajalca določi **strežnik iz seje**, nikoli browser. Brez sheme → `performed_by` je **string id** uporabnika iz
  `auth().user.id` (znotraj strežniške akcije). Ne uporablja se prosto besedilo.
- Čeprav `ExtensionRecord` trenutno nima `createdById` (dodamo v 2D na shemi), v `data.performed_by` shranimo
  zgolj **server-verodostojno** vrednost. Prikaz v UI: **uporabniško ime** (strežnik ga razreši iz membershipa),
  nikoli gol id; če se user ne da razrešiti → prikaz "—" in **brez lažnega naziva** (dokumentirano).
- Validacija: v TEST mora biti dokažan, da poskus `performed_by` iz browser-ja **nima vpliva** (strežnik ga prepiše).

## D. Append-only zaščita (fail-closed na strežniku)
`colony_move` je `ExtensionRecord`; generični CRUD mora zavrniti nespoštljive operacije:
- **Mehanizem:** v `ExtensionEntity` dodati logični flag **`appendOnly?: true`** (deklarativno v `extensions.ts`; velja za `colony_move` + kakršne koli `*_event`).
- **Guard v `records.ts` (fail-closed):**
  - `updateExtensionRecord` → če entity.reference `appendOnly` → return `{ ok:false, error:"APPEND_ONLY" }` (tudi če napačen).
  - `deleteExtensionRecord` → prav tako `{ ok:false }`/`APPEND_ONLY` za `appendOnly` entiteto.
  - `createExtensionRecord` → dovoljen **samo prek namenske akcije** (npr. `createColonyMove`); splošni `createExtensionRecord`
    za `appendOnly` entiteto se prav tako zavrne (`APPEND_ONLY`) — ustvarjanje zgodovine gre izključno skozi poseben
    postopek, ki izvaja pravila (SAME_HIVE, baseline, transakcija).
  - Obhod ob stran: **vsaka** splošna akcija (`update`/`delete`/`create`) preverja `appendOnly` na `findEntityOwner` — ne more ji obiti.
- **Poprave:** izključno **korekcijski novi dogodek** (ne urejanje/brisanje) — `createColonyMove` z ustrezno `content` in
  `isCorrection:true` + opomba).
- **Test (obvezen):** itest "attemptBypass": pokliči `updateExtensionRecord`/`deleteExtensionRecord` neposredno na
  `colony_move` → pričakovana zavrnitev `APPEND_ONLY`/`{ok:false}`; dokaži da ni tihe spremembe.

## E. Univerzalni pogodbeni format večvrstnih referenc (IZBRANO)
**Odločitev — objekt `ReferenceValue { id, extensionId, entityKey }` ZA več-vrstne** (multi-target), in **status quo string ID za
single** (2B). Pregled ob likvidiranju:
- **Single (2B):** vrednost = `string` (extensionRecord id); `referenceTo = { extensionId, entityKey }`. **Nedotaknuto, kompatibilno.**
- **Multi (2C):** `referenceTo = Array<{extensionId, entityKey}>`; vrednost = **objekt `{ id, extensionId, entityKey }`**. Vse polja validirana.
- **Zakaj:** objekt nosi tip cilja znotraj same vrednosti (deterministično, nima svobodnega `_kind` polja → ni konflikta imen);
  datumshranjevanje zádi objekt ni v nasprotju z 2B ker polja so ločena (single polje nikoli multi). Kompat: obstoječi single polja ostanejo string.
- **Validacija (server):** za dah-a field, če `referenceTo` je zbran → `clean` mora biti objekt `{id,extensionId,entityKey}`, kjer
  `(extensionId,entityKey) ∈ allowed`, id org-scoped + obstajajoč → sicer `INVALID_REFERENCE`. Single → string (org-scope) kot 2B.
- **Organizacija:** vsak `id` vedno `findFirst({ id, organizationId })` — tuj/neke → `INVALID_REFERENCE`; nimam `kind`-polja, ki bi ga lahko ponaredilo.
- **Cilj ne obstaja več:** UI razreši `id` → title; če ne pounce → "(izbrisano / neznano)". Podatki vrednosti (objekt) ostane.

### E2. Konkreten primer shranjevanja (pogodba)
**Single (Faza 2B) — nedotaknuto:** definirano kot
```ts
{ key: "hive_ref", label: "Panj", type: "entityReference",
  referenceTo: { extensionId: "bee-apiary", entityKey: "hive" } }
```
shranjena vrednost v `data`:
```json
"hive_ref": "cmw1hive0000000000000001"
```
(string id; org-scope + obstoječ → sicer `INVALID_REFERENCE`, kot 2B.)

**Multi (Faza 2C) — novo:** definirano kot
```ts
{ key: "target_ref", label: "Tarča", type: "entityReference",
  referenceTo: [
    { extensionId: "bee-apiary", entityKey: "apiary" },
    { extensionId: "bee-apiary", entityKey: "hive" },
    { extensionId: "bee-apiary", entityKey: "colony" },
  ] }
```
shranjena vrednost v `data`:
```json
"target_ref": {
  "id": "cmw1colony0000000000009",
  "extensionId": "bee-apiary",
  "entityKey": "colony"
}
```
(objekt; `entityKey` = izbran cilj, vse tri vrednosti validirane.)

### E3. Kako sistem prepozna pričakovani format iz definicije polja
- Pri razliki pojam dela **`referenceTo`**:
  - če je **objekt `{extensionId, entityKey}`** → polje je **single**; `clean` MORA biti **string** id → org-validacija;
  - če je **array** → polje je **multi**; `clean` MORA biti **objekt `{id, extensionId, entityKey}`** → validacija `(extensionId, entityKey) ∈ allowed` + org-scope.
- Format je **izpeljan iz `referenceTo`** (deklarativna definicija je en vir), ne iz napovedane vrednosti → prepreči nenamerne mešanje formatov na istem polju.
- **Neveljavna kombinacija ID / extensionId / entityKey:** server iz `clean` razčleni trio in preveri:
  1. `id` obstaja z org-scope (`findFirst({ id, organizationId })`) — `INVALID_REFERENCE` sicer;
  2. `(extensionId, entityKey)` je v dovoljenem naboru (`referenceTo`) — `INVALID_REFERENCE` sicer;
  3. za single: identično, a vrednost je string (entityKey iz `referenceTo`, ne iz podatka).
- **Brez** tihega sprejema; napaka je jasna (`INVALID_REFERENCE` na polju).
- **2B kompat:** obstoječa single polja (`hive_ref`, `colony_ref`, …) delujejo nespremenjeno (string); nobena obstoječa vrednost ni pretvorjena.
- **Isti pravila za vse dejavnosti** (mehanik/frizer/šivilja) — objekt je univerzalen; per-org samo deklaracijo allowed ciljev.
- (Opomba: `_kind` prejšnjega predloga se **ne** uporabi kot ločeno polje — tip je v `entityKey` objekta; brez konfliktov imen.)

## F. Razmejitev podfaz (končno)
### 2C-1 — Večvrstne reference (ni zgodovine selitev)
- tip `referenceTo`∈single|array; validacija več-vrste na serverju; UI optgroup picker + array; kompat 2B (single string);
  testi dovoljenih/nedovoljenih (ne pravi entKey, tuja org), IDOR; datoteke types/extensions/field-validation/records/records-client/+i18n+tests. PASS: unit+itest (2 org)+tsc+vitest.
### 2C-2 — Zgodovina selitev (strežnik, malo UI)
- `colony_move` entity (`appendOnly:true`) + `createColonyMove` (pravila: SAME_HIVE, baseline vnos, transakcija `hive_ref`+event, performed_by iz seje, korekcijski dogodki);
  append-only guard v generic CRUD; testi (SAME_HIVE, neobstoječ panj, tuj panj IDOR, baseline, append-only bypass, transakcija/concurrent). Brez širjenja UI (le minimalne primer recon).
### 2C-3 — UI
- prikaz trenutne lokacije (iz `hive_ref`), panel zgodovine, dodajanje selitve, korekcijski dogodek, prikaz izvajalca+razloga, večvrstni picker, mobile 390. E2E + regresija.
(Korak 2D — relacijske tabele `HiveMove` + `OrderItem.batchRecordId` + `createdById` — shema, ločena odobritev, uskladitev s tujim WIP schema.prisma.)

## G. Univerzalnost (isti mehanizem, deklarativno)
- Mehanik: `service_record` z `vehicle_ref` (single string) + `service_event` (`appendOnly`, baseline prek `createXxxEvent`) → zgodovina servisov.
- Frizer: `appointment` → `service_occurrence` z `appointment_ref`; `visit` event → zgodovina obiskov.
- Šivilja: `order` → `garment` z `order_ref`; `order_change_event` (appendOnly) → zgodovina sprememb.
- Čebelar: `colony` → `hive_ref` + `colony_move`. **En isti `entityReference`(single|multi) + `appendOnly` + baseline + create event vzorec; ni ločenega sistema.**

## H. Tehnične omejitve, ki ostajajo
- Tuj WIP `prisma/schema.prisma` (moduli, ConfigChangeLog) — 2C dela brez sheme; relacijsko (2D) zahteva uskladitev+odobritev.
- `colony_move` v ExtensionRecord je JSON — agregacije/search na polju manj učinkovite (Opcija B v 2D).
- `performed_by` v `data` (brez relacijskih FK) — User.organizationId/createdById dodamo v 2D.
- baseline brez datuma ni "zgodovinska lokacija" za datum pred njo — prikažemo pošteno (ni zavajajoče).

## I. Potrditev
Ni bila spremenjena nobena programska koda, shema prisma, migracija, baza ali Git stanje (edini nov/urejen je ta docs dokument). Čakam izrecno odobritev za Faza 2C-1.