# MARKEC — FAZA 2C-3: NAČRT UI ZGODOVINE SELITEV ČEBELJIH DRUŽIN

> **Read-only analiza + načrt.** Nič implementirano. Temelji na dejanskem UI (records-client.tsx),
> strežniških akcijah 2C-2 (colony-moves.ts) in že obstoječih univerzalnih vzorcih.
> Oznake: PASS / PARTIAL / FAIL / NOT VERIFIED (za dejansko stanje) + priporočila.
> Varovalno: tuj WIP (`schema.prisma`, `einvoices.*`) nedotaknjen; ni kode/UI/sheme/migracij/Git.

---

## 1. Pregled trenutnega UI (dejansko)
- Čebelarske evidence (customer `bee-apiary`) se prikazuje na **`/dashboard/records`** s **generičnim** records UI
  (`records-client.tsx`): **tabi** (ena na entiteto: Panjska postaja, Panj, Čebelja družina, …), **tabela** (prvi 4
  declared columns + Customer + Last updated) in **en RecordDialog** (create/edit form) za VSE entitete.
- **Drugija ni posebnega "kartica/detail" pogleda:** podrobnosti družine vidimo samo v urejanju (dialog);
  `hive_ref` v tabeli se razreši na naziv panja (2B), v dialogu je izbirnik (single 2B + multi 2C-1).
- **Ni read-only detail prikaza**, ni "povezanih evidence" na družini, ni zgodovine v UI.
- Navigacija/meniji so generični (n-tabbar); terminologija čebelarska (profil registry, F7.1/F7.2 PASS).

## 2. Pregled obstoječih komponent in datotek
| Datoteka | Vloga v 2C-3 |
|---|---|
| `src/components/admin/records/records-client.tsx` | Glavni UI: tabela, dialog, `refOptions`, optgroup picker. Tu bo dodan detail/panel + gumbi. |
| `src/components/ui/*` (dialog, table, button, toast… shadcn) | Reuse. |
| `src/app/actions/records.ts` | `listExtensionRecordOptions`, reset → bi se lahko nadgradili za razrešitev performed_by. |
| **`src/app/actions/colony-moves.ts`** | **Strežnik 2C-2, ŽE ZAKLJUČEN (PASS)**: `createColonyMove`, `correctColonyMove`, `colonyLocationAt`, `listColonyMoveHistory`. UI bo LE kliče te akcije. |
| `src/lib/i18n/dict/records.ts` (in drugi dict) | Prevodi (SL/EN) za zgodovino/akcije. |
| `src/lib/profiles/extensions.ts` | Deklarativna definicija `colony_move` (appendOnly) — že obstaja. |

## 3. Predlagana lokacija funkcionalnosti (utemeljeno)
**Ne uvajamo novega menija.** Predlog: **generični »record detail« pogled** v `records-client.tsx` (odpre se z novim
gumbom za podrobnosti v vrstici), ki ga entitete lahko razširijo s "sekcijami". Za družino (entityKey `colony`) se ta
detail napolni z: trenutna lokacija, osnovni podatki, **zgodovina selitev** (iz `listColonyMoveHistory`) + akciji
**"Preseli družino"** in **"Popravi zadnjo evidenco"**. Tako je:
- univerzalno (isti detail-panel uporabijo druge dejavnosti),
- naravno integrirano ob družini (ni ločen sistem),
- brez spreminjanja zaključene strežniške logike (2C-2 ostane).

**Alternativa (zavrnjena):** posebna čebelarska kartica družine kot nova stran. Zavrnjeno zaradi: obstoječi UI je
univerzalen (records-client nim per-org kode); hardkodiranje čebelarske kartice bi razbilo univerzalnost in dodalo
novo pot. (Če kasneje želimo profesionalnejši vtis — podrobnostna kartica kot **generični** "record detail" z
entitetnimi sekcijami → v redu, NISO pa posebna str.)

## 4. Prikaz kartice družine (predlog)
V detail dialogu (ali razširjenem panelu), entityKey `colony`:
- **Naziv/oznaka** (`label`/title).
- **Trenutna lokacija** = `colony.hive_ref` (edini vir resnice, PASS — ni `current_hive_ref`), prikazan kot **naziv
  panja** (razrešen prek `listExtensionRecordOptions`/refOptions ali `listColonyMoveHistory`).
- Panjska postaja (prek `hive.apiary_ref` — navezujoča povezava; ali pa user odpre panj).
- Osnovna polja (lage, queen_age, health…) — read-only ali prek urejanja.
- Gumb **"Preseli družino"** -> potek §6.
- Razdelek **"Zgodovina selitev"** -> §5.
*Čas nalaganja/prazno/error state — §9.*

## 5. Časovnica selitev (predlog) — iz `listColonyMoveHistory` (PASS)
Vrstni red: **append order** (`createdAt` asc — tako vrne akcija). Vsak dogodek:
| Polje | Prikaz |
|---|---|
| Izvorni panj | naziv (razreši id) ali **"—" / "Izvor pred začetkom ni znan"** |
| Ciljni panj | naziv |
| **Datum selitve** (`moved_at`) | datum (ali "—" za baseline) — **jasno ločeno** od evidenčnega |
| **Evidenčni čas** (`recorded_at`) | npr. "vpisano 15.4. 14:02" (sistemski) |
| `performed_by` | **ime uporabnika** (zahteva razrešitev id→ime — GLEJ §11/blockade) |
| `reason` | text (če obstaja) |
| Vrsta | značka: **Baseline** / **Selitev** / **Korekcija** (iz `baseline`, `is_correction`) |
| Popravek | ikona/oznaka "popravljeno" kadar obstaja korekcija tega dogodka (sklic `corrects_ref`) |
Posebej: **baseline** ni prikazan kot "selitev", ampak kot "začetno evidentirano stanje" (`moved_at` prazno, banner
"datum dejanske lokacije ni znan"). **Neznan izvor** (`origin_unknown`) → izpis "Izvor pred začetkom vodenja ni znan".

## 6. Postopek nove selitve
1. Uporabnik odpre družino (detail) → gumb **"Preseli družino"**.
2. Dropdown **ciljni panj** — prek `listExtensionRecordOptions({extensionId:"bee-apiary", entityKey:"hive"})`
   (org-scoped picker 2B; izvornega panja ne ponudi ali ga označi).
3. Vnese **datum dejanske selitve** (optional → default today).
4. Vnese **razlog** (optional).
5. **Pregled**: pokaže "iz trenutne lokacije X → v Y" (current iz hive_ref).
6. **Potrditev** → kliče **`createColonyMove`** (edina pot; NIKOLI generic CRUD).
7. Ob uspehu: toast + posodobi trenutno lokacijo + zgodovino.
**Napake (UI mapranje na pošteno sporočilo, SL/EN):**
- `INVALID_REFERENCE` → "Neveljaven/drug organizacijski zapis" (a picker jo preprečuje);
- `DUPLICATE` → "Tak premik je že zabeležen za isti datum";
- `STATE_MISMATCH` → "Trenutna lokacija ni skladna z zgodovino — prekini in preveri";
- `STALE_MOVED_AT` → "Datum je starejši od zadnjega zabeleženega dogodka";
- `APPEND_ONLY` → "Ta dogodek je zaščiten in se ne da urejati/brisati";
- `INVALID`/`SAME_HIVE` → "Ni veljavnega premika / ni premika v isti panj";
- `FORBIDDEN`/perm → skrij gumb / spor ji.
**UI ne nastavlja `performed_by`** — vk pasivu se performace na server (PASS, ni sprememba).

## 7. Korekcija selitve
- V dogodku (usi zgodovini) gumb **"Popravi"** (kadar ni korekcije še tega dogodka) → odpre malo formo:
  nov ciljni panj + razlog popravka → potrdi → kliče **`correctColonyMove(originalId, { toHiveId, reason })`**.
- Original ostane viden (PASS, append-only). Korekcija se prikaže kot **noben nov dogodek z oznako "Korekcija"** +
  original pridobita oznako "popravljeno" (ali se prikaže sklic `corrects_ref`).
- UI ne ureja/briše originala.

## 8. Baseline in neznani izvor (obravnava)
- Baseline: značka "Začetni zapis", `moved_at` prazno, beseda "datum lokacije ni znan; evidentirano {recorded_at}". 
  **Ne prikazuj kot dokazano zgodovinsko selitev.**
- `origin_unknown`: pri izvornem panju "Izvor pred začetkom vodenja ni znan"; ne izmišljaj panja/datuma.
- Rekonstrukcija za datum pred zanesljivo evidence: UI pokaže opozorilo "za ta datum zgodovina ni bila vodena" 
  (prek `colonyLocationAt`, PASS).

## 9. Desktop + mobilni UX
- **Desktop:** detail dialog v širini ~lg; leva kolona (podatki družine + trenutna lokacija), desna **časovnica**
  (navpični seznam z letvicabili; gumbi "Preseli"/"Popravi"). 
- **Mobile (390px):** stolpci za črte; enostavna tabela → kartice; **brez vodoravnega drsenja** (kaže le 1–2 polji
  + časovnica pod njim); gumbi na spodnjem delu kart.
- **Zahtevani stanje:** loading (spinner), **empty history** ("Ni še zabeleženih selitev — preseli družino"), 
  **error load** ("Ni uspelo naložiti zgodovine — poskusi znova"), uspeh shranjevanje (toast), duplicirano/stale
  (sporočila §6), user brez dovoljenj (akcije skrite/na button).
- **SL/EN prevodi** — novi ključi v i18n dict (`moveHistory`, `moveColony`, `correct`, `baseline`, `originUnknown`, itd.).

## 10. Loading / error / empty states (spec §6)
- Vse iz `listColonyMoveHistory` + `listExtensionRecordOptions` asynchr; UI prikaže spinner, ko se nalaga;
  `catch` → error toast; `events.length === 0` → empty state z CTA "Preseli družino".
- pred-malo: onSave last done -> reload history + current hive_ref (s `revalidate`/refetch) — ne da UI lažjeno vidi.

## 11. Varnost in dovoljenja (PASS — ni sprememb logike)
- Org iz `requirePermissionOrg("workorders.manage")` (fail-closed) + per-akcija perm; UI ne kliče ne-org.
- `performed_by` — **strežniško**, UI ne sme pošiljati.
- Append-only — strežniški guard (PASS).
- **Blockade/funkcija manjka:** UI za prikaz `performed_by` id → potrebuje **ime izvajalca**. Predlog:
  bodisi razširi `listColonyMoveHistory` rezultat z imeni članov (server side joins), ali doda novo za-codex
  akcijo `listMemberNames()` (org-scoped) — BREZ spreminjanja sheme (uporabi OrganizationMember/User). To je
  minimalni dodatek, ki bo določen ob odobritvi.

## 12. Predlog E2E testOV (za kasnejšo izvedbo, NE zdaj)
1. Odpri obstoječo družino → trenutna lokacija vidna (PASS).
2. Odpri zgodovino (baseline prikazan).
3. Dodaj novo selitev (ciljni panj + datum + razlog) → uspeh.
4. Preveri posodobljeno trenutno lokacijo v UI.
5. Preveri zgodovino (novi dogodek).
6. Osveži (reload) → ponovno odpri → stanje ostane.
7. Korekcija → original ostane, nov korekcijski dogodek, oznaka.
8. Baseline (moved_at prazno) in neznani izvor (origin_unknown) prikaz.
9. Mobile 390: časovnica brez vodoravnega drsenja.
10. Uporabnik brez dovoljenj → akcije skrite/zavrnjene.
11. Izolacija 2. org: tuj panj ni v izbirniku; tuj dogodek ni dosegljiv.
Kriterij: vsi PASS, brez console error, brez overflow.

## 13. Datoteke, ki bi jih spremenili pri implementaciji (predlog)
- `src/components/admin/records/records-client.tsx` — detail dialog/panel, timeline, gumbi,
  strežniški klici `createColonyMove`/`correctColonyMove`/`listColonyMoveHistory` (+ names rezolucja).
- `src/app/actions/records.ts` (ali novo `colony-moves-ui.ts`) — razrešitev performed_by imena (minimalno).
- `src/lib/i18n/dict/records.ts` (+ novi dict ključi SL/EN za zgodovino/akcije/napake).
- NIT: `colony-moves.ts` **ostane nedotaknjen** (že dokončan, PASS) razen po potrebi nov helper names (ne logic).
- Možno: nov `src/components/admin/records/colony-detail.tsx` (razširitev detail panel, entiteta `colony`).
- Testi: `tests/integration/f2-3/colony-move-ui?` (server-side helper names) + browser E2E (nov skript f2c3).

## 14. Odvisnosti in tveganja
- Odvisnosti: 2C-2 (done, PASS); shadcn UI; i18n dict; prevodi SL/EN.
- Tveganja:
  - performed_by id→ime (manjka helper) — najmanjši server-dodatek; **brez sheme**.
  - "zgodovina" kot globoko vgradit v generični records detail — razširitev vzorca; brez hardkoda.
  - UI mora po shranitvi osvežiti hive_ref (local refetch), da se trenutna lokacija posodobi.
  - tuj WIP ne vpliva (jedro control se ne dotika).

## 15. Kriteriji za sprejem 2C-3 (when odobreno)
1. Uporabnik v UI družine vidi trenutno lokacijo + zgodovino (baseline/selitve/korekcije) — PASS.
2. "Preseli družino" prek `createColonyMove`; napake (DUPLICATE/STALE/STATE_MISMATCH/…) prikazano sporočilo — PASS.
3. "Korekcija" prek `correctColonyMove`; original ostane nespremenjen, oznaka popravka — PASS.
4. Baseline/neznani izvor prikazani brez lažnih datumov — PASS.
5. Mobile 390 brez vodoravnega drsenja — PASS.
6. performed_by prikazano kot ime (server-side resolucja) — PASS.
7. Izolacija org + besede perm (tuj ne dosegljiv) — PASS.
8. E2E scenarij (§12) vseh PASS; vitest+itest+tsc regresija zelena; ni spremembe sheme.

---

## KONČNO POROČILO
- **Ali obstaja primeren obstoječi prostor za zgodovino selitev?** **NE kot je danes** — obstaja le generični
  records tabela + dialog; ni detail-karte (2C-3 mora dodati "record detail" vzorec). **PASS** za možnost vzorca.
- **Katere obstoječe komponente lahko znova uporabimo?** shadcn dialog/button/table/toast/badge;
  optgroup picker (2C-1) za ciljni panj; `refOptions` razreševanje; stale `i18n` (razširimo).
- **Katere datoteke bi spremenili?** records-client.tsx (+ morebitni `colony-detail.tsx`), i18n dict,
  morda records/colony-moves UI helper (names). **colony-moves.ts** (logika) se NE spreminja.
- **Ali je mogoče brez spremembe sheme?** **DA** — vse gre skozi obstoječe `ExtensionRecord` + akcije 2C-2.
  Edini dodatek (razrešitev performed_by→ime) je brez sheme (OrganizationMember/User join).
- **Najboljši uporabniški potek?** Odpri družino → detail (trenutna lokacija + časovnica) → "Preseli družino"
  (cilj+datum+razlog) → potrdi (akcija 2C-2) → refresh. Korekcija pod dogodkom.
- **Tehnične blokade?** (1) performed_by→ime (majhen server helper; brez sheme), (2) vgraditi generični detail
  panel v records UI (vzorec), (3) UI refetch ob spremembah; (4) tuj `einvoices.ts` build-blocker (ni moj — ne blokira
  te faze, le build).
- **Status revizije:** strežniška logika 2C-2 **PASS**; UI (ta faza) je načrtovan, **NI implementiran**.

**Faza 2C-3 (implementacija) se ne začne brez izrecne odobritve.**