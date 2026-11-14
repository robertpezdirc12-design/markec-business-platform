# F5.4.0 — Arhitekturna analiza: inteligentno upravljanje modulov

> **Samo arhitekturna analiza — nobena koda ali Prisma shema ni bila spremenjena.**
> Namen: diagnosticirati obstoječi modulni sistem, določiti cilj za podjetnika in predlagati
> načrt F5.4.1 (brez implementacije do odobritve). Ne podvajamo obstoječega sistema modulov —
> analiza pokaže, da je večina jedra že zgrajena in da F5.4 gradi **konsolidacijo + razlago**,
> ne nov vzporedni sistem.

---

## 1. Povzetek

MARKEC **že ima** robustno jedro upravljanja modulov, razpršeno med **tri medsebojno povezane
sloje**:

1. **`CapabilityMatrix` per poslovni profil** (`required | optional | disabled`) — ključna
   semantika že obstaja v `src/lib/profiles/types.ts`.
2. **SKD→profil + modulni predlogi** — vsak od 678 podrazredov že razreši na veljaven profil
   (`src/lib/skd/profiles.ts` + `src/lib/skd/catalog.ts`), tako da **ni treba graditi 678
   konfiguracij** (analiza §4).
3. **Dva obstoječa konfiguratorja** — `ModulesConfigurator` (starejši, capability-overrides,
   spoštuje required) in `ModulesV2Card` (novejši, `OrganizationModuleState`, neodvisen od
   vertikale).

**Glavni manjki za F5.4** (po analizi):
- **Manjka enoten »Moji moduli« pregled**, ki podjetniku pokaže vse 4 kategorije (active /
  recommended / required / not-allowed) + odvisnosti + posledice izklopa. Danes sta dva ločena
  konfiguratorja z različnimi pravili.
- **`setModuleState` ne izvaja required/disabled pravil profila** (za razliko od
  `ModulesConfigurator`/overrides poti) — omogoči izklop obveznih modulov in vklop
  prepovedanih. To je varnostna/logična vrzel (§3).
- **Model je razpršen med `profileOverrides` (JSON) in `OrganizationModuleState` (tabela)** —
  F5.4 poenoti na en sloj urejanja (module-tabela kot edini vhod), overrides ostane kot
  zgodovinski/naslednji vir.

---

## 2. Pregled obstoječega sistema (§1 naloge)

### 2.1 Profili in CapabilityMatrix
- `src/lib/profiles/types.ts` — `CapabilityState = "required"|"optional"|"disabled"` in `CapabilityMatrix` (14 ključev: appointments, workOrders, shop, services, inventory, customers, staff, analytics, reviews, forms, workflows, documents, delivery, walkIn).
- `src/lib/profiles/registry.ts` — `PROFILE_LIST` (34 profilov, npr. `frizer`, `cosmetica`, `mehanik`, `seamstress`, `tire-service`, `generic`, `skd-*` 22 sekcijskih). **Dokaz (primer `seamstress`):** `appointments: "disabled"`, `reviews: "disabled"`, `workOrders/services/staff/forms/workflows: "required"` (registry.ts:477-492).
- `src/lib/profiles/modules.ts` — `modulesForVertical(profileId)` iz capability matrix izpelje seznam module (required/optional) za vodeni vstop. **Ločen pogled od module-kataloga** (§2.3) — eden od dveh vzporednih seznamov.

### 2.2 SKD → profil (678 podrazredov)
- `src/lib/skd/profiles.ts` — `resolveSkdProfile(code)` hodi podrazred→razred→oddelek→sekcija, na koncu vedno pade na sekcijski/generični profil. `SKD_PROFILE_EXCEPTIONS` (T96.991 tetoviranje → generic; C14 → skd-c).
- `src/lib/skd/catalog.ts` — `SKD_AREAS` (21 panožnih področij) + `suggestModulesForSkd(codes)` vrne predloge iz profila/sekcije/področja + `sanitizeSkdInput`.
- `src/lib/skd/data/skd2025.ts` — 1725 uradnih zapisov (22/87/287/651/678). `tests/f50-skd-2025.test.ts:98` **že preverja, da vsak od 678 podrazredov razreši na veljaven profil.**
- **Zaključek:** F5.4 **ne izdeluje 678 konfiguracij** — kombinacija (sekcijski profil → subclass override → SKD profilna izjema) jih pokrije deterministično.

### 2.3 Modulni katalog in odvisnosti
- `src/lib/modules/catalog.ts` — `MODULES` (14 modulov, id = capability ključ), vsak z `capabilities[]`, `dependsOn[]`, `nameSl/En`, `descriptionSl/En`. `getModule`, `dependentsOf`, `missingDependencies`, `effectiveCapabilities`, `effectivePublicCapabilities`.
- **Odvisnosti:** `workflows → workOrders`, `delivery → shop`, `appointments → services`. (mod rešljivo.)

### 2.4 Shranjevanje stanja po organizaciji
- `prisma/schema.prisma` — `model OrganizationModuleState` (`organizationId, moduleId, state, updatedAt`, `@@unique([organizationId, moduleId])`). **Dokaz:** model na vrstici 973. Po organizaciji (org-scoped).
- `prisma/schema.prisma` — `Organization.profileOverrides` (JSON) za `capabilityStates`/`dashboardWidgets`.
- `src/lib/profiles/resolve.ts` — `resolveEffectiveProfile`/`resolvePublicEffectiveProfile` združi profil → secondary → overrides → **moduleStates (zadnja beseda)**.
- `src/lib/tenant.ts` — `include: { moduleStates }` (4 nalagalci org vrstice, test ga preverja).

### 2.5 Audit log
- `src/lib/config-history/record.ts` + `ConfigChangeLog` (append-only, per org+entity, version, actorEmail, previous/next). Uporabljata ga tudi `setModuleState` (module:*) in `updateOrgOverrides` (profile-overrides).

### 2.6 Navigacija / dashboard / guard-i / dovoljenja
- `src/components/admin/sidebar.tsx` — nav elementi `capability:` gate (capability ≠ disabled → prikaz), widgeti po `dashboardWidgets`.
- `src/app/actions/modules.ts` — `setModuleState`/`getModuleOverview`, guard `requirePermissionOrg("settings.manage")`.
- `src/app/actions/profile.ts` — `updateOrgOverrides` (strog `CAPABILITY_NOT_OPTIONAL` za ne-optional), `getOrgProfileOverview` (optional keys).
- Javne poti: `resolve-tenant`/`resolve-host` (moduleStates kot vhod za public capability), `sitemap` (izklopljen modul brez URL-ja), `public-cta`, `public-site` — vse skozi `EffectiveCapabilities`/`EffectivePublic`.

### 2.7 Povezava s spletno stranjo/trgovino/poslovnimi procesi
- Spletna stran: `effectivePublicCapabilities` (HIDDEN = javno izklopljen, plošča dela).
- Trgovina/rezervacije/delovna naročila: capability gating v javnih in admin poteh (že F5.3 / nastalo).
- Poslovni procesi: `src/lib/profiles/materialize.ts` materializira forms/workflows per org (`sourceProfile` provenance).

---

## 3. Ugotovljene vrzeli (zakaj F5.4 ni le »katalog«)

| # | Vrzel | Dokaz | Vpliv |
|---|---|---|---|
| V1 | **Dva vzporedna konfiguratorja** (`ModulesV2Card` ACTIVE/HIDDEN/DEACTIVATED + `ModulesConfigurator` optional↔disabled) z različnimi pravili → zmeda podjetnika. | `settings/page.tsx:114-120` prikazuje oba; `modules-v2-card.tsx` (moduleStates) vs `modules-configurator.tsx` (overrides). | UX (zahteva §2, §6) + stanje, ki ga je težko razložiti. |
| V2 | **`setModuleState` ne preverja required/disabled profila.** | V `actions/modules.ts` ni guarda za `profileCapabilities` (le za obstoj modula in odvisnosti); `catalog.ts` komentar: "ACTIVE odklene disabled… jedro 8.C"; test `modules-f2.test.ts:64-69` potrjuje odklepanje. | Podjetnik lahko izklopi obvezen modul dejavnosti (npr. appointments pri frizerju) in vklopi prepovedan (npr. reviews pri šiviljstvu). **Samo UI skrivanje ni varnostni mehanizem** (zahteva §7). |
| V3 | **UI ne izpostavlja kategorij** active / recommended / required / not-allowed. | `modules-v2-card.tsx` nima badge za required/disabled; `getModuleOverview` trdo nastavi `profileDisabled:false`. | Podjetnik ne ve, kaj je obvezno/priporočeno/nedovoljeno (zahteve §2, §4). |
| V4 | **Ni enotne razlage "kaj se zgodi ob izklopu"** / ponovnem vklopu na ravni modula. | `modules-v2-card` le generic description + "podatki ostanejo"; brez per-module posledice za odvisne ali javne vložke. | Zmeda pri izklopu modula z odvisniki (zahteva §2). |
| V5 | **Model stanja razpršen**: `profileOverrides.capabilityStates` (JSON) + `OrganizationModuleState` (tabela) — dva mehanizma za "vklopi/izklopi". | `resolve.ts` obravnava overrides in moduleStates separatno; oba se zapisujeta. | Podvajanje + možnost neusklajenega stanja (zahteva §4, §7). |
| V6 | **Secondary activity lahko sam širi required** (union) → konflikt s profijevo required-zaščito v UI. | `secondary.ts` (`enabled → required/optional`) — dokaz, da secondary lahko naredi neko capability required, ki je primarno bila disabled. | Zaradi U1 prevajanja; F5.4 mora pravilno zakriliti to kombinacijo. |

---

## 4. Cilj za podjetnika (§2-§3) — predlog

**»Moji moduli«** — en zaslon, ki razloži vklapljanje kot človek, ne kot seznam stikal:

- Vsak modul prikazan z **jasno kartico**: ikona, ime, namen (ne-tehnično), **kategorija**:
  - **Obvezen** (profil zahteva) — preklop onemogočen + znak zaklepa + razlaga "dejavnost zahteva ta modul, brez njega ne moreš obratovati".
  - **Priporočen / aktiven** (profil optional ali ACTIVE) — vklopljen, preklop na voljo.
  - **Izbiren in izklopljen** — preklop na voljo.
  - **Nedovoljen** (profil disabled/neznan + ni ACTIVE override od nas) — siv zaslon + razlaga "za to dejavnost ni na voljo".
- **Odvisnosti:** "Potrebuje: Storitve", "Odvisni moduli: …" z jasno sporočilom kaj pade.
- **Posledica izklopa:** dinamičen rek ("Spletna rezervacija in javni koledar bosta izginila z javne strani; zgodovina in podatki ostanejo shranjeni. Ponovni vklop jih vrne.").
- **Iskanje in filtriranje** po imenu/kategoriji/odvisnosti.
- **Razlaga v slovenščini** (in en), brez tehničnih izrazov; kratki "Kaj je to?" tooltip.
- Predlogi se računajo iz profila + SKD (že obstaja `suggestModulesForSkd`) — **poljubna priporočila (recommended) se določijo kot: optional ∩ SITE_TEMPLATES/preporočena za dejavnost, ne kot 678 ločenih konfiguracij**.

**Odnos do 678 podrazredov:** vsak podrazred → `resolveSkdProfile` (profil) → pravila modulov iz tega profila. Brez 678 definicij, samo en urejevalnik pravil na profilu + manjšo nadgradjo katalogov.

---

## 5. Pravila modulov (§4) — predlog

Enoten izračun v čisti funkciji `src/lib/modules/policy.ts` (predlagano):

- `moduleStatusForOrg(profileCapabilities, moduleStates) → { required[], optional[], disabled[], notAllowed[] }`, kjer:
  - **Required**: profile `required` IN ni `DEACTIVATED` (in ni s strani moduleStates znižano) — **zaklenjeno**.
  - **Optional/active**: profile `optional` ali `required`-z-ACTIVE? → active; izklopljen → DEACTIVATED (lastnik ima pravico izklopiti *optional*).
  - **Disabled / not allowed**: profile `disabled` IN NI `ACTIVE` override od iskanja → ni na voljo za samostojen vklop brez eksplicitne odločbe (želeno v F5.4: ni preklopa).
- **Odvisnosti:** `missingDependencies` (vklop blokiran z sporočilom) in `dependentsOf` (izklop opozori).
- **Vrstni red aktivacije:** vklop modula zahteva vklopljene dep-e (`delivery → shop`); konfigurator jih predlaga v pravem vrstnem redu.
- **Varna deaktivacija:** `setModuleState` zadrži podatke (koda le skrije vhode); **ne briše nikoli** (ŽE drži).
- **Ponovna aktivacija:** obakteru ponovni ACTIVE vrne capability; materializirani forms/workflows (sourceProfile) ostanejo (ali so znova aktivni po revisiji).
- **Zaščita podatkov:** izklop ni brisanje; podatki ostanejo, dokler jih lastnik po ločenem varnem postopku (izven F5.4) ne izbriše.

**Predlog bistva:** F5.4 preuredi `modules.ts` (katalog) v **en politikni sloj**, ki ga uporabljata tako old-overrides kot moduleStates.

---

## 6. Več podjetij (§5)

- `OrganizationModuleState` + `ConfigChangeLog` + vse akcije so **per-org** (`organizationId`). Sprememba v podjetju A nikakor ne vpliva na B (org-scoped).
- Isti uporabnik v več organizacijah → vsako podjetje `switchActiveOrganization` (obstaja), urejevalnik modulov se veže na **aktivno org**.
- Predlogi (SKD→profil→moduli) so per-org glede na to org-ino dejavnost.
- **Testna zahteva:** isti uporabnik s 2 org (ne bi videl A-jevih modulov v B-jih) — §8.

---

## 7. Varnost (§7)

- **Org-scoped shranjevanje:** ŽE (OrganizationModuleState @@unique by org, vse akcije `requirePermissionOrg`).
- **Strežniško preverjanje capability:** ŽE za javne poti (resolve → EffectivePublicCapabilities); **manjka** v `setModuleState` za required/disabled (V2).
- **Dovoljenja za upravljanje:** `settings.manage` (ŽE).
- **Neposredni dostop do izklopljenega modula:** ŽE (javne poti capability-gate; sitemap ne indeksira; public en 404). Samo skrivanje menija NE velja — resnična zaščita je na resolverju, kar F5.4 ohrani.
- **Podatki ob deaktivaciji:** podatki ostanejo (ŽE); F5.4 ohrani + dokumentira.
- **Audit log:** ŽE (ConfigChangeLog) za module + overrides.
- **F5.4 dodaja:** politiko (required/disabled) v module-akcije (strežniško), da ni mogoča sprememba prek UI v nasprotju s profilnimi pravili.

---

## 8. Testna matrika (§8) — predlog za F5.4.1

| Scenarij | Preverba |
|---|---|
| **Frizer** (`frizer`) | appointments=required → zaklenjen; services=required; shop optional → preklop; reviews optional. |
| **Kozmetika** (`cosmetica`) | kasneje optional; appointments required. |
| **Avtoservis** (`mehanik`) | workOrders required, appointments required, shop optional (preklop), brez walkIn po potrebi. |
| **Šiviljstvo** (`seamstress`) | appointments disabled → NI preklopa; workOrders/forms/workflows/services required; reviews disabled → NI preklopa. |
| **Tetoviranje** (SKD T96.991 → generic) | generic profil; appointments optional; preveri ponovno odklepanje + se ne sme obnavljati. |
| **Generični SKD** (npr. skd-c) | optional vse razen customers/analytics (required); documents disabled → ni preklopa. |
| **Podjetje z več dejavnostmi** (secondary) | sekundarni profil doda capability → v UI ustrezno označeno kot omogočeno (ne required-zaščiteno če sekundarno). |
| **Isti uporabnik, več org** | org A: appointments zaklenjen; org B: appointments optional — no cross-bect. |
| **required/optional/disabled combo** | politika vrnemo praven status. |
| **Odvisnosti** | vklop `delivery` brez `shop` → blokiran z jasno napako; izklop `shop` z `delivery` → opozorilo. |
| **Izolacija podatkov** | izklop modula ne izgubi podatkov (zapisi ostanejo), ponovni vklop vrne. |

---

## 9. Ponovna uporaba (kaj NAM ne graditi od začetka)

- `src/lib/modules/catalog.ts` — katalog, odvisnosti, effective matrika (ponovno uporabiti/razširiti).
- `src/lib/skd/profiles.ts` + `catalog.ts` — SKD→profil + predlogi.
- `src/lib/profiles/resolve.ts` + `secondary.ts` — efektivna matrika.
- `src/lib/profiles/types.ts` — `CapabilityState`.
- `src/lib/config-history` — audit.
- `src/lib/profiles/materialize.ts` — forms/workflows materializacija.
- `OrganizationModuleState` (tabela) — en končni model stanja.
- Akcije `setModuleState`/`getModuleOverview` — nadgraditi z politiko, ne zamenjati.

---

## 10. Predlagani podatkovni model

F5.4 **ne zahteva nove tabele** (stanje ŽE v `OrganizationModuleState`). Predlagamo le:

1. **`ModuleDef` obogatimo** v `catalog.ts` s poljema:
   - `impactSl/En` (kaj se zgodi ob izklopu — na ravni modula),
   - `isRecommended?: boolean` (priporočen za dejavnost — se lahko izpelje iz profil-preference, ne ročno).
2. **`Organization` ne dobi novih stolpcev** — `moduleStates` ostane. Morebitna normalizacija za izolacijo podatkov ni potrebna (podatki v ločenih tabelah so zaradi capability gatinga prosto ohranjeni neodvisno od module-tabele).
3. Optionally `OrganizationModuleState` dobi `toggledBy`/`toggledAt` (že `updatedAt`), da audit log z ostalo.

> Brez produkcijskih migracij v F5.4.0; kakršna koli shematska sprememba se implementira v F5.4.1 šele po odobritvi.

---

## 11. Uporabniška izkušnja (predlog zaslona)

**Nastavitve → Moji moduli** (nadomesti/združi ModulesV2Card + ModulesConfigurator):

- **Vsebinski sklopi (kategorije)**
  - `Aktivni moduli` — badg "vklopljen" + toggle.
  - `Priporočeni` — badg "priporočen za tvojo dejavnost" + toggle (če optional).
  - `Obvezni` — badg "obvezen" + zaklep + onemogočen toggle + kratka razlaga.
  - `Nedovoljeni za to dejavnost` — siva barva + razlaga, brez toggla.
- **Iskalnik/filter** po imenu ali kategoriji.
- **Detajl modula (klik)** — modal/sheet z: imenom, namenom, odvisnostmi (potrebuje/je odvisen od), posledico izklopa, podatki, ki ostanejo, gumb za vklop/izklop (če dovoljen).
- Vse preko obstoječih akcij `getModuleOverview`/`setModuleState` (razširjenih s politiko).

---

## 12. Varnostne kontrole (§7)

- Vse akcije ostanejo `settings.manage` org-scoped.
- `setModuleState` dobi **strežniško politiko**: required modula dejavnosti ni mogoče DEACTIVATED (ali pa vrnemo eksplicitno napako "obvezen modul"), disabled se ne more vključiti brez izjeme.
- Javni resolver ostane `EffectivePublicCapabilities` (neposredni dostop do izklopljenega = 404/skrito).
- Audit log z `previous/next` za vsako spremembo politike.

---

## 13. Načrt implementacije (F5.4.1 — predlog)

1. **Politika modulov** — `src/lib/modules/policy.ts` (čist): `moduleStatusForOrg`, `canActivate`, `canDeactivate`, razlogi. (jedro, testno čisto, brez DB.)
2. **Akcije** — `getModuleOverview` vrne politiko + kategorije; `setModuleState` izvaja required/disabled/odvisnosti (vrne razlago).
3. **Katalog** — `ModuleDef` ≥ `impactSl/En`, `isRecommended` (iz profil-preference).
4. **UI »Moji moduli«** — nov/nadgrajen zaslon (kategorije, iskanje, detajl, toggle), zamenja/združi oba obstoječa konfiguratorja.
5. **Predlogi per dejavnost** — uporabi `suggestModulesForSkd` + profil za recommended.
6. **Testi** — enotski (politika, SKD→moduli) + browser (frizer/seamstress/generic/avtoservis tetoviranje; več org) + regresija.
7. **Dokumentacija** — F5.4.1 zaključni pregled.

---

## 14. Sprejemni kriteriji (odobritev pred F5.4.1)

- [ ] Podjetnik vidi vse module z kategorijami (required/optional/not-allowed/recommended) — brez tehničnih izrazov.
- [ ] required modul dejavnosti NI izklopljiv (strežniška + UI zaščita); disabled/modul NEDOVOLJEN ni vklopljiv prek UI.
- [ ] Vklop blokiran ob neizpolnjenih odvisnostih z jasno napako; izklop z odvisniki da opozorilo.
- [ ] Odvisnosti, posledice izklopa in ohranitev podatkov prikazani pri več modulih (appointments, delivery/shop, workflows).
- [ ] Podjetje z več dejavnostmi + isti uporabnik z več podjetji — izolacija (org A ne vpliva na B).
- [ ] Odvisni testi: frizer/kosmetika/avtoservis/šiviljstvo/tetoviranje + generični SKD; regresija.
- [ ] Brez produkcijskih migracij; audit log vsake spremembe; org-scoped.

---

## 15. Zaključek

F5.4 je **konsolidacija in razlaga obstoječega modulnega jedra**, ne nov sistem. Največja
vrednost je (a) en zaslon »Moji moduli« z jasnimi kategorijami za podjetnika brez računalniškega
znanja, (b) **doseg varnosti**: required/disabled pravila profila, ki jih mora uveljaviti tudi
`setModuleState` (strežniško, ne le UI), (c) naravno razširljivo priporočanje (SKD→profil).
Vse komponente že obstajajo in bodo ponovno uporabljene.

**Čaka na odobritev F5.4.1 za implementacijo.**