# MARKEC — ločeni poslovni workspaces (analiza + načrt)

> Status: načrt, koda še ni spremenjena.
> Namen: vsaka dejavnost (šivilja, mehanik, frizer, kozmetičarka, trgovina) dobi
> svoj poslovni prostor, en račun pa lahko vodi več prostorov — brez mešanja
> podatkov, nastavitev in pravic.

---

## 1. Tri plasti — kje so danes

Cilj zahteva strogo ločevanje treh stvari. Vse tri v modelu **že obstajajo**;
težava ni v shemi, ampak v tem, da tretja plast (vloga v workspaceu) ni
povsod uporabljena in da vmesnika za vstop ni.

| Plast | Model / mehanizem | Stanje |
|---|---|---|
| **1. Račun** — kdo se prijavi | `User` (email + geslo, bcrypt), NextAuth JWT seja z `role` + `organizationId` (`src/lib/auth/auth.ts`) | ✅ obstaja |
| **2. Podjetje** — čigavi so podatki | `Organization` (slug, `vertical`, `palette`, `publishState`, `profileVersion`, `profileOverrides`); ~50 tabel z `organizationId`; `SalonConfig` per org; `OrganizationModuleState` per org | ✅ obstaja, izolacija po `organizationId` |
| **3. Workspace** — katero okolje je odprto | `Organization.vertical` → profil dejavnosti (`src/lib/profiles/registry.ts`): capability matrika, terminologija (`term()`), moduli, dashboard widgeti, preset katalog, javni profil | ✅ obstaja kot *capability-driven* profil |
| Članstvo / vloga per podjetje | `OrganizationMember` (`organizationId + userId` unique, `role`, `customRoleId`, `isDefault`); `resolveActiveOrganizationId()` v `src/lib/auth/memberships.ts` | ⚠️ obstaja, a se uporablja samo za **izbiro** org, ne za **avtorizacijo** |
| Preklapljanje med podjetji | `switchActiveOrganization()` (`src/app/actions/organization-switch.ts`) + izbirnik v `src/components/admin/sidebar.tsx` | ✅ obstaja (samo v stranski vrstici) |
| Drugo podjetje na istem računu | `createSalonOrganization()` — prijavljenemu uporabniku ustvari novo `Organization` + `OrganizationMember(ADMIN, isDefault:false)` (`src/app/actions/onboarding.ts:155–258`) | ✅ obstaja, a brez vhoda v UI |
| Migracija starih računov | `scripts/backfill-organization-members.ts` (dual-read `User.organizationId`) | ⚠️ delno (dual-read še aktiven) |

**Zaključek:** arhitektura ni treba na novo — treba jo je dokončati.

---

## 2. Vrzeli (po prioriteti)

### V1 — avtorizacija bere GLOBALNO vlogo, ne vloge v aktivnem podjetju (P0, varnost)
`getEffectivePermissions(userId)` bere `User.role` in `User.customRole`
(`src/lib/permissions/effective.ts`), `requireRole()` pa `session.user.role`.
`OrganizationMember.role` se uporablja samo za prikaz (stran `dashboard/roles`)
in v enem preverjanju (`custom-roles.ts`).
Posledica: uporabnik, ki je **ADMIN v podjetju A** in **STAFF v podjetju B**,
po preklopu v B obdrži admin pravice v B. To neposredno krši zahtevo
»vsak ima svoje pravice, nastavitve se ne smejo mešati«.

### V2 — tihi priklop na tuje podjetje (P0, varnost)
`getSessionOrg()` (`src/lib/tenant.ts:184`) in `resolveSessionOrg()`
(`src/lib/auth/guards.ts`) imata legacy fallback: ADMIN **brez** organizacije
dobi `findFirst({ status: "ACTIVE" })` — najstarejše aktivno podjetje.
Po izbrisu/odvzemu članstva admin tako pristane v tujem podjetju.

### V3 — ni vstopnega zaslona »kdo si / kaj odpiraš« (P1, UX)
Prijava pelje naravnost v `/dashboard` (`src/proxy.ts`). Pri več podjetjih
uporabnik ne izbira; izbira je skrita v stranski vrstici. Vstopna tabla iz
zahteve (»tabla pri vhodu v blok«) ne obstaja. Delni nadomestek je
`GuidedEntryGate` znotraj plošče, ki pa izbira **dejavnost prvega** podjetja,
ne workspaca.

### V4 — ni upravljanja workspaceov (P1, UX)
Ni vhoda »Dodaj poslovni prostor« iz plošče (pot obstaja le prek `/start`),
ni seznama članstev, ni povabila sodelavca v drugo podjetje, ni zapustitve
podjetja.

### V5 — diferenciacija po dejavnosti je danes capability-driven, ne ločena (P1, produkt)
Ena plošča se prilagaja z capability matriko, `term()` in moduli. To pokriva
navigacijo in terminologijo, ne pa tudi različnih **delovnih tokov**
(npr. delovni nalogi pri mehaniku, meritve/nalogi pri šivilji, recepti pri
kozmetičarki), ki jih je treba definirati kot del profila dejavnosti.

### V6 — prevodi in copy so globalni (P2)
`i18n` je SL/EN za celo aplikacijo; terminologija po dejavnosti gre prek
`term()`, marketinški copy pa je še skupen.

### V7 — dvojni vir resnice za aktivni org (P2, tehnični dolg)
`User.organizationId` se še vedno piše ob preklopu in ob kreiranju podjetja;
ko `OrganizationMember` pokrije vse račune, je treba legacy kazalec opustiti.

---

## 3. Faze izvedbe

Vsaka faza je samostojno preverljiva (`tsc`, `lint`, `pnpm test`) in ne
uvaja novih funkcij, dokler prejšnja ni zaključena.

### F0 — Varnost in izolacija (brez UI sprememb)
1. `getEffectivePermissions` dobi **aktiven org**: `(userId, organizationId)`;
   vir je `OrganizationMember.role` + `OrganizationMember.customRoleId`,
   legacy `User.role` ostane samo za račune brez članstva.
2. `requireRole`/`requireAdmin`/`requireStaffOrAdmin` preverjajo vlogo v
   **aktivnem** podjetju (ne v JWT).
3. Odstraniti fallback »najstarejše aktivno podjetje« (V2) — brez članstva
   akcija vrne `UnauthorizedError`, stran preusmeri na izbiro workspaca.
4. Regresijski testi: dva računa × dve podjetji, preklop, poskus dostopa do
   akcije tujega podjetja, ADMIN-v-A/STAFF-v-B.

**Tveganje:** veliko akcij kliče `requireAdminOrg`; sprememba je centralna,
zato jo je treba narediti na enem mestu in pokriti s testi.

### F1 — Vstopni zaslon (workspace picker)
1. Nova pot `/workspaces` (skupina `(auth)`): seznam `OrganizationMember`
   uporabnika z imenom podjetja, dejavnostjo, vlogo in stanjem objave;
   kartice po dejavnosti (ikona + barva profila).
2. Ob prijavi: 0 članstev → onboarding (`/start`), 1 članstvo → naravnost v
   njegov workspace (brez friction), 2+ → `/workspaces`.
3. `switchActiveOrganization` ostane edini mehanizem preklopa; doda se
   »Nazaj na izbiro« v uporabniški meni.
4. Zapomni si zadnji workspace (`isDefault`/`User.organizationId`), da vračanje
   ne sprašuje vsakič — izbira je ob ponovni prijavi predizbrana.

### F2 — Upravljanje workspaceov
1. »Dodaj poslovni prostor« v meniju → obstoječi `createSalonOrganization`
   (že podpira dodatno podjetje), z jasnim stavkom, da gre za **novo** okolje
   z lastnimi podatki.
2. Seznam članov per podjetje + vloga (že obstaja na `dashboard/roles`) in
   povabilo v **drugo** podjetje istega računa.
3. Zapustitev/preklop privzetega podjetja; prepoved izbrisa edinega ADMIN-a.

### F3 — Globina delovnega prostora po dejavnosti
1. Vsak profil dobi **manifest delovnega prostora**: privzeti moduli,
   domači widgeti, primarni delovni tok (termini | delovni nalogi | naročila |
   projekti), terminologija in prazna stanja.
2. Plošča sestavlja widgete iz manifesta (ne iz skupnega seznama).
3. Nastavitve: zavihki se prikažejo glede na capability (že delno), privzeti
   obrazci/potoki pa se prednastavijo iz profila.
4. Brez podvajanja komponent: ista komponenta se parametrizira z manifestom;
   kjer tok res ni skupen (npr. delovni nalog vs termin), se doda ločena pot.

### F4 — Čiščenje tehničnega dolga
1. Backfill članstev za vse račune, nato odstranitev branja
   `User.organizationId` iz `tenant.ts` in `guards.ts`.
2. Odstranitev legacy polj, ki ostanejo brez bralcev; migracija + rollback načrt.
3. Dokumentacija: kako se doda nova dejavnost (profil + manifest + preset).

---

## 4. Česa ne bomo delali

- Ne podvajamo tabel na podjetje — izolacija ostane `organizationId` na
  obstoječih modelih.
- Ne ukinjamo capability matrike; manifest profila jo **uporablja**, ne
  nadomešča.
- Ne uvajamo ločenih prijav za vsako dejavnost (zahteva: en račun).
- Ne spreminjamo delujočega javnega dela (`/s/[slug]`, proxy vrata, Stripe tok)
  razen tam, kjer F0 zahteva strožjo avtorizacijo.

---

## 5. Merila uspeha

1. Uporabnik z dvema podjetjema ob prijavi vidi izbiro in po izbiri pristane v
   pravem okolju; podatki drugega podjetja se ne prikažejo nikjer.
2. ADMIN v A / STAFF v B nima admin pravic v B (test).
3. Račun brez članstva ne pade na tuje podjetje (test).
4. Šivilja in mehanik se po prijavi razlikujeta v domači plošči, modulih in
   delovnem toku — ne le v barvi in besedilih.
5. `tsc`, `lint`, `pnpm test` zeleni po vsaki fazi.

---

## 6. Odprta vprašanja (pred F1)

1. **Workspace = podjetje ali podjetje + dejavnost?** Predlagam: workspace je
   podjetje (en `Organization` = en workspace); dejavnost je lastnost podjetja.
   Če želiš v istem podjetju dve dejavnosti, je to drugo podjetje z istim
   računom.
2. **Izbira ob vsaki prijavi ali le pri več workspaceih?** Predlagam: pri enem
   ne sprašujemo, pri več pokažemo izbiro z zadnjim izborom predizbranim.
3. **Kaj vidi stranka (CLIENTE)?** Predlagam: stranka ne izbira workspaca —
   gre v `/my-account`; izbira je le za lastnike in osebje, ki imajo članstva.
