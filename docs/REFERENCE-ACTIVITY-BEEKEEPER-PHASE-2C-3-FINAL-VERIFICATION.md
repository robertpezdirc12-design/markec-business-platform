# MARKEC — FAZA 2C-3: ZAKLJUČNA PREVERBA (FINAL VERIFICATION)

> Ciljne browser preverbe (korekcija + mobil 390 + univerzalnost Record Detail) + regresija.
> Izvedeno na izolirani `markec_f631_test` (dev 3020, Playwright chromium, čebelar cb).
> Ni spremenjena koda/shema/migracija/produkcija; tuj WIP nedotaknjen. Oznake: PASS / PARTIAL / FAIL / NOT VERIFIED.
> Testni podatki (marker `F2V-`) — po preverbi pobrisani (f631 čista).

---

## A — Browser korekcija (desktop 1280)
**Ocena: PASS**

Dejanski izvedeni koraki (skript `scripts/f2c3-final-verify.mjs`, Del A):
1. Login čebelar → odpri Čebelja družina `F2V-Družina`.
2. Odpri Podrobnosti → **trenutna lokacija Panj-A** ✓.
3. Nova selitev → **Preseli družino** → cilj **Panj-B** → datum `2026-06-01` → potrdi.
4. UI po selitvi **trenutna lokacija = Panj-B** ✓.
5. **Refresh** strani → ponovno odpri → lokacija še vedno **Panj-B**, baseline + premik A→B v časovnici ✓.
6. Na prvotnem dogodku **»Popravi«** → cilj **Panj-C** → razlog popravka → potrdi.
7. Po korekciji: **original A→B še viden in nespremenjen** ✓; **nov korekcijski dogodek** (označen "Korekcija") ✓; **trenutna lokacija = Panj-C** ✓.
8. **Refresh** → ponovno odpri → vse pravilno (lokacija C, original + correction v časovnici) ✓.

Dokaz originala nespremenjenega: originalni `colony_move` (to=B) je v časovnici po korekciji še prikazan (ni izbrisan/urejen); korekcija je ločen append-only dogodek s `corrects_ref` (potrjeno prek kode / listColonyMoveDetail in itest 2C-3: `corrEv.correctsRef === originalId`, `isCorrection:true`). Rekonstrukcija lokacije upošteva korekcijo (currentHive=C). **PASS.**

## B — Mobilni E2E (390 × 844)
**Ocena: PASS**

- Širina zaslona: **390 px** (Playwright viewport).
- Preverjene poti: odpri records → tab Čebelja družina → Podrobnosti → **trenutna lokacija (Panj-C)** + **Zgodovina selitev** + **korekcija viden** → forma "Preseli družino" dostopna in zaprta.
- **Brez vodoravnega drsenja**: `document.documentElement.scrollWidth=390`, `clientWidth=390` → `scrollWidth <= clientWidth+1` ✓.
- Gumbi/obrazci ustrezno veliki, forma polje izbirnik cilja na voljo, dialog zapiran (Escape/Zapri) deluje.
- Posnetka: `scripts/f2c3-desktop-correction.png`, `scripts/f2c3-mobile.png`.
- **PASS** (dejansko klj'ˇ uso pot, ne le CSS širina).

## C — Univerzalnost Record Detail
**Ocena: PASS** (arhitekturno razširljiva; ni velike nove registracije)

Pregled `src/components/admin/records/record-detail.tsx`:
- **Generično jedro** izpisujede deklarativna polja katere koli entitete (read-only) — ne vsebuje čebelarskih pravil ali podatkov ✓.
- **Čebelarska zgodovina** je **ločena komponenta `ColonyDetailSection`**, privržena pod `entity.key === "colony"` (izoliran razširitveni del). NIJE vgrajena v splošni prikaz ✓.
- **Dodajanje nove dejavnosti** = dodati novo sekcijo v istem vzorcu (kot `ColonyDetailSection`), **brez spreminjanja generičnega jedra** ✓. (Uporabljena je čista veja, ne trdo-kodiranje čebelarskih pravil v jedro.)
- **Mešanje org**: onemogočeno strežniško (`requirePermissionOrg` v vseh akcijah; `listColonyMoveDetail` jo za tujo → `ok:false`) ✓.
- **Entiteta brez posebne razširitve**: prikaz polj deluje (generični del); čebelarska sekcija se ustvari samo za `colony` — za druge entitete se prikažejo osnovne podrobnosti ✓.

Opozorilo: veja `entity.key==="colony"` je explicit v `RecordDetail`; po želji se lahko pozneje zamenja za registriran `detailExtension` (kartiranje entiteta→komponenta), vendar to NIJE nujno za to preverbo in bi vneslo nov sistem — ni narejeno/nezahtevano. Arhitektura je čista in razširljiva. **PASS.**

## D — Regresija
| Test | Rezultat |
|---|---|
| itest 2C-3 (`colony-move-detail-2c3.itest.ts`) | **4/4 PASS** |
| itest 2B + 2C-1 + 2C-2 + f635 | **7 + 10 + 19 + 7 PASS** |
| **itest skupno** (5 datotek) | **47/47 PASS** |
| **Vitest** celota | **91 files / 1331 PASS** |
| **tsc --noEmit** | čist (ni spremembe tipov v tej preverbi) |
| Browser E2E korekcije + mobile | **PASS** |
| **Build** | **NOT VERIFIED** — blokira ga tuj `einvoices.ts` WIP (nisem ga popravil, ni predmet te naloge) |

## Spremenjene datoteke (ta preverba)
- **Nobena programska datoteka ni spremenjena** — le nov skript `scripts/f2c3-final-verify.mjs` (dokaz) + posnetka.
- Git status/diff: moje zaključene datoteke 2C-3 (`record-detail.tsx`, `records-client.tsx`, `dict/records.ts`, `colony-moves.ts`, itest) ostajajo kot v Faz 2C-3; **tuj WIP (`prisma/schema.prisma`, `einvoices.*`) nedotaknjen** ✓.
- Testni podatki `F2V-*` (+ `colony_move` dogodki) **očiščeni** (DELETE 8, count 0) — f631 čista ✓.

## Zaključek
Faza 2C-3 zaključna preverba: **PASS** za A (korekcija — original nespremenjen, korekcija append-only, lokacija posodobljena in ohranjena po refresh), **PASS** za B (mobil 390, brez overflow), **PASS** za C (univerzalen, razširljiv). **Faza 2D-1 se ne začne brez izrecne odobritve.**