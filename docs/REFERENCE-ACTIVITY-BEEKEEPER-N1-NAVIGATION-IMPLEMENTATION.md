# MARKEC — N1 — DEJAVNOSTNA NAVIGACIJA ČEBELARJA (IMPLEMENTACIJA)

> **Status: PASS (implementacija + tsc + unit). Browser/mobilni: NOT VERIFIED.**

## Kaj je implementirano
Čebelar (profil z razširitvijo `bee-apiary`) zdaj dobi **dejavnostni vstop v navigaciji**:

- Nov nav item **"Pregled čebelarstva"** (`nameKey: apiculture`, href `/dashboard/apiculture`, ikona House) v
  `src/components/admin/sidebar.tsx`, ograjen z `extension: "bee-apiary"` — prikaže se le profilom Čebelar,
  ostali dejavnosti nespremenjene.
- Dodan v i18n (`common.nav.apiculture`): slo "Pregled čebelarstva", eng "Beekeeping overview".

## Zakaj ne več podmenij (pošteno)
Predlagana struktura iz navodila ima podmenije (Panjske postaje, Panji, …). Te **ne bi bile delujoče** — vseh 9
čebelarskih evidenc živi pod **enim univerzalnim** `/dashboard/records` (ni ločenih per-entity CRUD poti), in
bočni meni nima podmenij-skega mehanizma. Po izrecnem pravilu navodila ("ne prikazuj nedelujočih povezav; dodaj le
delujoče ") je dodan **en vstop ("Pregled čebelarstva")**, ki vodi na novo živo nadzorno ploščo Z1; ta pa daje
prehode na realne obstoječe poti (Evidence, Izdelki, Inventura). S tem obdržimo **vse delujoče povezave** in
ohranimo univerzalno navigacijo drugih dejavnosti nedotaknjeno.

## Spremenjene datoteke
| Datoteka | Status |
|---|---|
| `src/components/admin/sidebar.tsx` | nav item + `nameKey`.
| `src/lib/i18n/dict/common.ts` | `nav.apiculture` (slo+eng) |

## Odloženo za kasnejšo fazo
- Dedicated per-evidence CRUD strani (apilac, hive, colony, …) — brez njih ne morejo nastati po-entity navitemi
  brez dead-linkov. (Zahteva večji UI obseg + testiranje; ni del te odobritve.)

## Preverjanje
- **tsc:** brez napak (sidebar/common).
- **Unit:** 46/46 PASS.
- **Browser / mobilni (390×844):** NOT VERIFIED (zahteva prijavljeno sejo; ni dostopno okolje).

## Potrditve
Nič sheme/migracij/baze; Git operacij nobenih; tuj WIP/`einvoices.ts` nedotaknjeni; `markec_dev`/produkcija
nedotaknjena; univerzalna navigacija drugih aktivnosti nespremenjena.
**Končni status: PASS (impl+tsc+unit), NOT VERIFIED (browser/mobilni).**