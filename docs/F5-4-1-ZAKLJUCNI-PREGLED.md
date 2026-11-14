# F5.4.1 — Zaključni pregled: inteligentno upravljanje modulov

> **Stanje:** DONE. Implementirano na podlagi odobrene arhitekture `docs/F5-4-ARHITEKTURA.md`.
> Nobena produkcijska migracija, noben commit/push, WIP drugih agentov ni prepisan.

---

## 1. Spremenjene datoteke

### Nove
| Datoteka | Vloga |
|---|---|
| `src/lib/modules/policy.ts` | **Enotna politika modulov** (avtoritativna pravila required/optional/disabled + `isTransitionAllowed` + `modulePolicyFor`). Čista, client-safe. |
| `src/components/dashboard/modules-overview.tsx` | **Nov enoten »Moji moduli« zaslon** — kategorije, iskanje, preklop, odvisnosti, razlaga. |
| `tests/module-policy-f54.test.ts` | Politika + dejavnostni scenariji (§8): frizer/cosmetica/mehanik/seamstress/tetoviranje/generic + legacy-nedosledno stanje + §5 HIDDEN-required. |

### Spremenjene
| Datoteka | Sprememba |
|---|---|
| `src/lib/modules/catalog.ts` | `effectiveCapabilities` + `effectivePublicCapabilities` zdaj **spoštujeta avtoritativni profil**: required se nikoli ne izklopi, disabled se nikoli ne vklopi, HIDDEN je ločena javna vidnost (§2, §5). |
| `src/app/actions/modules.ts` | `setModuleState` izvaja **strežniško politiko** (prek `isTransitionAllowed`) + `getModuleOverview` z kategorijami + `reconcileModuleStates` (razreševanje starih nedoslednih stanj brez brisanja podatkov). |
| `src/components/dashboard/modules-configurator.tsx` | Preoblikovan v **widgets-only** konfigurator (dashboard widgete); modulni del je prevzel ModulesOverview. |
| `src/app/(admin)/dashboard/settings/page.tsx` | Modulni zavihek zdaj prikazuje `ModulesOverview` (+ `ModulesConfigurator` za widgete); `ModulesV2Card` odstranjen iz prikaza. |
| `tests/modules-f2.test.ts` | Posodobljeni scenariji: required ne-izklopljiv, disabled ne-odklepijv, HIDDEN javno skrit. |

---

## 2. Zahteve → status

### ✔ §1 Enoten konfigurator — **PASS**
- `ModulesV2Card` + `ModulesConfigurator` združena v en »Moji moduli« zaslon (`ModulesOverview`).
- Podjetnik vidi: obvezne, priporočene (aktivne), razpoložljive (izbrene izklopljene), nedovoljene z razlago.
- **Ni novega vzporednega sistema** — stanje ostane v istem `OrganizationModuleState` (istia akcija `setModuleState`).

### ✔ §2 Kritična varnostna napaka (P0) — **PASS**
- `setModuleState` zdaj izvaja avtoritativna pravila profila (required/optional/disabled) **prek enotne politike** (`isTransitionAllowed`).
- Organizacijsko stanje **ne more** preglasiti avtoritativnega `CapabilityMatrix` aktivnega profila:
  - `required` → nikoli izklopljivo (tudi legacy DEACTIVATED se razreši);
  - `optional` → lastnik izbira; `disabled` → nikoli vklopljivo (tudi legacy ACTIVE/HIDDEN se razreši).
- **Stara nedosledna stanja:** `reconcileModuleStates` proaktivno razreši prej shranjena nedosledna stanja (obriše zgolj opozorilni `OrganizationModuleState` vnos — **poslovni podatki ostanejo**).

### ✔ §3 Priporočila glede na dejavnost — **PASS**
- Priporočila izhajajo iz profila (SKD→profil→CapabilityMatrix→katalog), analogno obstoječemu `suggestModulesForSkd` (F5.0) — ni globalnega priporočanja.
- `getModuleOverview` izračuna `category` (required/optional→recommended/available/disabled) iz capability base profila — priporočilo je vezano na profil, ne na modul.
- **Brez Prisma migracije** (zahtevano).

### ✔ §4 Odvisnosti med moduli — **PASS**
- Deklarirane odvisnosti (workflows→workOrders, delivery→shop, appointments→services) že v katalogu.
- Vklop: manjkajoča odvisnost → **jasno sporočilo**, prepovedana odvisnost (disabled) se **ne vklopi** (setModuleState filtrira disabled dep iz prompta za samodejno vklop).
- Izklop: `dependentsOf` → opozorilo (ne tiho kaskado), **podatki nikoli izbrisani**.

### ✔ §5 Ločitev skrit/izklopljen — **PASS**
- `ACTIVE` = funkcionalno aktiven + javno viden.
- `HIDDEN` = funkcionalno aktiven, **javno skrit** (javna stran: capability disabled; plošča: capability deluje).
- `DEACTIVATED` = funkcionalno izklopljen (optional); `required` ni mogoče deaktivirati.
- Dokaz (§5 test): za `required` + `HIDDEN` → `effectiveCapabilities` = required (plošča dela), `effectivePublicCapabilities` = disabled (javno skrito).

### ✔ §6 Večorganizacijska izolacija — **PASS**
- `OrganizationModuleState` org-scoped (`@@unique([organizationId, moduleId])`); vse akcije `requirePermissionOrg("settings.manage")`.
- Sprememba v podjetju A ne vpliva na B; isti uporabnik v različnih podjetjih ima iste module (per-org).
- STAFF — brez `settings.manage` ne more spreminjati modulov (fail-closed `requirePermissionOrg`, zadokazano v `org-scoped-permissions-f0.test`).
- Audit log ostaja append-only (`ConfigChangeLog` — `setModuleState` zapisuje `action:"UPDATE"` z `previous/next`).

### ✔ §7 Uporabniška izkušnja — **PASS**
- Vsak modul: ime, opis (kaj omogoča), kategorija, odvisnosti ("Potrebuje …"), posledica pri izklopu ("podatki ostanejo"), pri required razlog zakaj zaklenjen.
- Vklop aktivira dejansko funkcionalnost (prek capability gating → nav/plošča/javna stran).

### ✔ §8 Testiranje — **PASS** (z opombo about integration)
- Dejavnostni scenariji: frizer/cosmetica/mehanik/seamstress/tetoviranje (SKD T96.991→generic)/generični SKD → v `tests/module-policy-f54.test.ts`.
- `required` ni mogoče izklopiti, `disabled` ni mogoče vklopiti, `optional` deluje v obe smeri (enotska politika + efektivna matrika).
- Odvisnosti pravilne; podatki ob deaktivaciji ohranjeni (politika ne briše; legacy razrešeno brez izgube).
- **Dva workspacea istega uporabnika / večpodjetje:** org-scoped (strukturno+F0 test). Integracijski E2E z dvema workspacema ni bil izveden v tem ciklu — označen **NOT VERIFIED** (zahteva DB+session sandbox; kot browser flow ga lahko naredimo v naslednjem koraku).

### ✔ §9 Omejitve — **PASS**
- Brez prepisovanja WIP; brez posega v F2.3.1 / rezervacije / promocije; `git status` + `git diff` preverjena pred in po delu; brez produkcijske migracije; brez commit/push.

---

## 3. Varnostni dokazi (P0)

| Napad | Rezultat |
|---|---|
| `isTransitionAllowed("required","DEACTIVATED")` | zavrnjen (razlog SL/EN) |
| `isTransitionAllowed("disabled","ACTIVE"|"HIDDEN")` | zavrnjen |
| Legacy `required` + vnos DEACTIVATED | `effectiveCapabilities` → `required` (popravljeno) |
| Legacy `disabled` + vnos ACTIVE/HIDDEN | `effectiveCapabilities` → `disabled` (ni odprt) |
| direktni klic `setModuleState` (obvoz UI) | akcija izvaja isto politiko → zavrne |

---

## 4. Regresija / stanje modulov

- **Vitest:** 88 datotek / **1295/1295 PASS** (vključno novih 24 policy + 16 modules-f2).
- **ESLint:** 0 errors / 0 warnings na vseh F5.4.1 datotekah.
- **TypeScript (`tsc --noEmit`):** 0 napak na vseh mojih datotekah (ostale napake so v pre-existing drugih agentov).
- **Browser verifikacija** (demo-salon, Lepotni salon/beauty): »Moji moduli« pravilno prikaže kategorije — Obvezni: 6 (gumbi zaklenjeni), Priporočeni/aktivni: 4 (preklopljiv), Ni na voljo: 4 (gumbi onemogočeni + razlog). Potrjeno prek eval (`disabled:true` required/unavailable, `disabled:false` optional).

---

## 5. Odprte težave / opombe

1. **NOT VERIFIED:** Integracijski E2E "dva workspacea istega uporabnika + STAFF poskus spreminjanja" ni predviden v enotnem vitest naboru brez DB sandboxa — pokriva ga strukturno (org-scoped + fail-closed guard), poln browser flow pa bi bil dober naslednji krog (kot `.cjs` flow, izven enotnih testitc).
2. **Dashboard widgete** so zdaj v `ModulesConfigurator` (widgets-only) pod novim »Moji moduli« v zavihku Moduli — funkcionalnost ohranjena, lokacija sekundarna.
3. `setup-checklist` / onboarding nista bila razširjena s predlogi "Moji moduli" — ostaja priporočilo; arhitektura prostovoljno odlaša na F5.4.2 (če želiš).
4. Priporočila so trenutno "recommended = aktiven optional", ni ločenega izrecnega flaga "recommended" v profilu (zahtevano "če je smiselno, dodaj" — izvedeno kot razpoznana kategorija iz profila, brez migracije).

---

## 6. Sprejemni kriteriji (prej odobreni) — status

| Kriterij | Status |
|---|---|
| Enoten zaslon z vsemi kategorijami | PASS |
| required ni izklopljiv (strežniško+UI), disabled ni vklopljiv prek UI | PASS |
| Vklop blokiran pri manjkajočih dep; izklop z opozorilom | PASS |
| Odvisnosti + posledice izklopa prikazane | PASS |
| Več podjetij + isti uporabnik izolacija | PASS (strukturno) |
| Dejavnostni testi + regresija | PASS |
| Brez produkcijske migracije, audit log org-scoped | PASS |

**Zaključek:** F5.4.1 dosega cilje (konsolidacija modulov + P0 varnostna politika) brez novega shranjevalnega sistema in brez migracij. Priporočam zagon F5.4.2 (če bo odobreno) za lastni filter "priporočeni" per-profil in polni E2E z več workspace-i.