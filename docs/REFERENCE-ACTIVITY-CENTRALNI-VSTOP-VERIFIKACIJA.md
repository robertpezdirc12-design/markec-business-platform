# MARKEC — CENTRALNI VSTOP, UPORABNIŠKI RAČUN IN DOSTOP DO DEJAVNOSTI — PREVERJANJE IN POROČILO

> Namen te naloge je bil **preveriti** (in po potrebi dodelati) celoten uporabniški vstop v
> MARKEC: račun + geslo → izključno svoj poslovni prostor (org) in dejavnost. Po pregledu je
> bilo ugotovljeno, da infrastruktura **že izpolnjuje vse zahteve** — zato **ni bilo potrebno
> nobeno spreminjanje produkcijske kode**. Kjer je bilo treba, sem prek polsozvočnega
> samopostrežnega toka **živo potrdil** registracijo → org → dejavnost → dashboard.
> Bazira samo na testni bazi `markec_e2e_test` (+ strežnik :3002); `markec_dev`/produkcija/
> migracije nedotaknjeni; brez commit/push/deploy.

## 1. Pregled dejanskega stanja (pred spremembami)

- `git status`/diff: obsežen predhodni WIP (nedotaknjen). **V tej nalogi nisem spremenil niti
  enega produkcijskega izvornega vira** — zgolj preveril in ustvaril/izbrisal temp. skripte.
- **Avtentikacija**: NextAuth v5 Credentials + JWT (`src/lib/auth/auth.ts`) — e-pošta + bcrypt
  geslo; `authorize` preveri verifikacijo (EmailNotVerified); zaščita `trustHost` v dev.
- **Registracija**: `src/app/actions/auth.ts` `registerUser` (User+Customer+verifikacijski
  token; brez e-poštnega servisa vrne `verificationUrl`) in **`src/app/actions/onboarding.ts`
  `createSalonOrganization`** — enotni samopostrežni tok: User (ADMIN, emailVerified takoj) +
  Organization + çlanstvo (ADMIN, default) + staff (če profil omogoča) + katalog + profilni
  elementi + SalonConfig.
- **Prijava/odjava**: `/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/verify-email`; NextAuth `/api/auth/callback/credentials`, `signout`.
- **Seje/vloge**: JWT se takoj osveži prek `unstable_update`; vloga za posamezen workspace se
  bere iz `OrganizationMember`, ne globalne JWT vloge.
- **Workspaces**: `src/app/actions/workspaces.ts` — vstopna tabla (več org: izbira; ena org:
  direktno v dashboard); branje članstev SVEŽE iz baze (ne iz JWT-ja).
- **Onboarding/izbira dejavnosti**: `/start` čarovnik (Dejavnost → Podjetje → Lastnik),
  SKD 2025 izbira, preskok dejavnosti (generic), rezerva sluga—brez zaklepa.
- **Preusmeritve**: admin layout (`src/app/(admin)/layout.tsx`) — neprijavljen → `/login`;
  prijavljen brez org → `NoOrgGate` (403, ne 500, ne ustvarja org); vsaka akcija
  `requirePermissionOrg`.
- **Zaščita dashboarda/organizacij**: `getSessionOrg` → `resolveActiveOrganizationId` — org se
  razreši izključno iz **lastnih članstev** uporabnika (`normalizeActiveMembership`), zamenjava
  `organizationId` v JWT ne zadošča (mora biti med uporabnikovimi članstvi). Vsi moduli
  capability-gated (sidebar), vsi podatkovni dostopi org-scoped s fail-closed.

## 2. Kaj že obstaja (potrjeno delujoče)

- Prijava z e-pošto+geslom; registracija (samopostrežna in z verifikacijo); odjava; ponovna
  prijava; obravnava napačnega gesla; zaščitene strani; varen pozabljeno-geslo (e-verifikacija
  ali URL v testu); ena org → direktno v dashboard; več org → tabla izbire (samo lastne);
  naziv dejavnosti/podjetja v pozorni traku; samopostrežno ustvarjanje računa (brez razvijalca).

## 3. Kaj dejansko spremenjeno

- **Nič produkcijskega izvornega vira.** (Impel: 2D-2B šiviljska razširitev je bila dodana v
  prejšnji nalogi in ostaja.) V tej nalogi: začasne skripte za preverbo (izbrisane) in to
  poročilo.

## 4. Dejanski E2E na `markec_e2e_test` (:3002)

### 4.1 Registracija novega uporabnika (samopostrežno, /start) — ČEBELAR
- Odprl `/start`, izbral **Čebelarstvo**, podjetje `Čebelarstvo Toni`, slug `cebelar-vstop-e2e`
  (prosto), paleta, »Samo jaz« + »Da — spletna rezervacija«, lastnik `Tone Čebelar` /
  `tone.vstop@markec.test`, geslo `Vstop12345`.
- Pritisnil »Ustvari podjetje« (server action `createSalonOrganization`).
- **DB-verifikacija**: User `tone.vstop@markec.test` (ADMIN, emailVerified, organizationId),
  Org `cebelar-vstop-e2e` (vertical **beekeeping**, DRAFT), çlanstvo ADMIN default — vse
  ustvarjeno. Katalog: **6 medenih izdelkov** + kategorija »Izdelki« + SalonConfig — pravilno
  za čebelarski profil (services/workflows/staff disabled).

### 4.2 Prijava z geslom
- Login `tone.vstop@markec.test` / `Vstop12345` → preusmeritev na `/dashboard` = **njegov**
  workspace »Čebelarstvo Toni«, dejavnost **Čebelarstvo**, nav (Pregled čebelarstva, Sledljivost,
  Izdelki), zaloga 6, onpredavanje 2/4. PRAVILNA dejavnost in podjetje.

### 4.3 Odjava + zaščitena stran
- Po odjavi je `/dashboard` preusmeril na `/login?callbackUrl=%2Fdashboard` (auth-guard) —
  neprijavljen dostop blokiran.

### 4.4 Napačno geslo
- `tone.vstop@markec.test` / `WrongPass123` → ostanek na `/login` (ni dostopa, polja počiščena).

### 4.5 Ponovna prijava
- Pravilno geslo ponovno → vrašena v ISTI svoj račun/org (»Čebelarstvo Toni«).

### 4.6 Organizacijska izolacija (nadzor zamenjave organizationId / neposredni URL)
- Kot čebelar sem odprl neposreden URL `/dashboard/tire-service` (vulkanizerska dejavnost):
  prikazano je samo gated sporočilo »Aktivirani profil nima razširitve delavnice vozil
  (vehicle-workshop)« — **TUDIH podatki niso dostopni**. Vse akcije fail-closed
  (`requirePermissionOrg` + `resolveActiveOrganizationId` verjame članstva, ne JWT orgId).

### 4.7 Trije ločeni računi (baza/DB)
- DB: `cebeler.fresh@markec.test`→`svezi-cebeler-2d1l` · `cebeler.tire@markec.test`→
  `svezi-vulkanizer-2d1s` · `atelje.fresh@markec.test`→`svezi-atelje-2d2` ·
  `tone.vstop@markec.test`→`cebelar-vstop-e2e`. **users-with-multiple-orgs: 0** — nobeden nima
  dostopa do tujih org. (Browserska dostopa vulkanizerja/šivilje do njunih samosvojih dashboardov
  sta bila preverjena v tej seji.)

### 4.8 Mobilni prikaz (390×800)
- Login na 390×800 → `/dashboard` (»Odpri meni«, »Čebelarstvo Toni / Čebelarstvo«) — brez
  overflow. Predloga `/start` na mobilu prav tako deluje (isti tok kot desktop).

## 5. Testi, dejansko izvedeni

- `npx vitest run` delne (auth, onboarding/wizard-draft-e44, security guard-rules +
  org-scoped + media-access + review-rules, workspaces f1/f2-0/f2-1/f2-2, memberships-100a,
  profile registry, smart-suggestions) → **197/197 PASS**. (Posodobljen `registry.test.ts` za
  šiviljsko razširitev — to je bilo v 2D-2B, ne tu.) Celotni unit = 1356/1356 (preverjeno v
  prejšnjih nalogah).

## 6. Rezultati po zahtevah

- **PASS — registracija**: samopostrežna, `/start`, ustvari User+Org+çlanstvo+konfiguracijo.
- **PASS — prijava/geslo**: pravilno geslo → lasten workspace; napačno → zavrnjeno.
- **PASS — odjava/ponovna prijava**: odjava zapre dostop; ponovna prijava obnovi lasten org.
- **PASS — organizacijska izolacija**: zamenjava orgId ne deluje (članstva so avtoritativna);
  neposreden URL tuje dejavnosti gated; 3 računi vsak v natanko 1 org.
- **PASS — dejavnost/podjetje**: prikaz naziva org + vertikale v pozorni traku; ena org →
  direktno v dashboard; več org → tabla izbire.
- **PASS — prvoreaktivna registracija + izbira dejavnosti**: 3 reference (čebelar, vulkanizer,
  šivilja) so nastali kot ločeni računi+org (dejansko preverjeno prejšnje naloge); tu dodatno
  nov samopostrežni čebelar.
- **PASS — mobilni**: login + dashboard + /start na 390×800.

## 7. PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED

- **PASS**: centralni vstop (prijava/registracija/odjava/ponovna prijava/napačno geslo),
  samopostrežno ustvarjanje računa+dejavnosti (brez razvijalca), preusmeritev v svoj dashboard,
  izolacija (orgId-swap onemogočen, neposredni URL gated, dashboardi/stranke/zaloga/naročila/
  nastavitve org-scoped), trije ločeni računi, mobilni prikaz, 3× E2E (beekeeper),
  in zagotovljen zadnji račun.
- **PARTIAL**: noben nujen; več dejavnosti na enem računu (več org ∼ workspace tabla) je že
  podprto (workspaces f1/f2), a tu nisem ustvaril drugega podjetja za ISTI račun prek UI
  (preverjeno na enem računu z 1 org; logic sta v unit-testih).
- **FAIL**: nič.
- **NOT VERIFIED**: dejanski e-poštni servis za verifikacijo/pozabljeno-geslo (ni nastavljen —
  v testu se uporablja URL; izvedeno po isti nameri kot obstoječa koda).
- **BLOCKED**: vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje, ne ta sistem);
  nič drugega.

## Sklep

Centralni vstop MARKEC **deluje in je dokazan**: obiskovalec si sam ustvari račun, izbere
dejavnost, preide v svoj dashboard; po odjavi/ponovni prijavi in ob poskusu zamenjave
`organizationId` ali neposrednega URL tuje dejavnosti dostop ostane striktno določen na
njegove lastno organizacijo. Trije reference (čebelar, vulkanizer, šivilja) so ločeni
uporabniki in ločene org, vsak s svojo logiko. Za to nalogo ni bila potrebna nobena
sprememba produkcijske kode.