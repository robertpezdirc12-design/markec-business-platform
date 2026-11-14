# MARKEC – Workspace arhitektura · Analiza obstoječe sheme pred spremembo baze

> **Namen:** odgovor na zahtevo **"preden se spremeni baza, AI pregleda obstoječo Prisma shemo in ugotovi, kako varno dodati raven Workspace"**.
> **Metoda:** pregled dejanske kode `prisma/schema.prisma` (1857 vrstic), `src/lib/auth/*`, `src/lib/permissions/*`, `src/lib/tenant-proof.ts`, `src/proxy.ts`, `src/app/actions/organization-switch.ts`, `src/components/admin/sidebar.tsx`.
> **Stanje:** **nič ni bilo spremenjeno / migrirano.** To je izključno analiza in priporočeni načrt.

---

## 1. Ključna ugotovitev (preberi prvo)

**Raven "Workspace", kot si jo opisal, v obstoječi shemi ŽE obstaja — pod imenom `Organization`.**

V obstoječi arhitekturi `Organization` **ni "podjetje"** (kakršno si predlagaš na vrhu), ampak je **točno dejavnostni prostor**: ima svojo dejavnost, nastavitve, trgovino, rezervacije, zaposlene, katalog in module. Vse, kar si označil kot "Workspace lastno", je v shemi vezano neposredno na `Organization.organizationId`.

| Tvoj koncept | Leta v kodi | Dokaz |
|---|---|---|
| Workspace = ena dejavnost | `vertical`, `skdCodes`, `secondaryVertical`, `moduleStates` | `schema:49,99-123` |
| Workspace lastne nastavitve | `SalonConfig` 1:1, `profileOverrides`, terminologija, `ctaMode` | `schema:412` |
| Workspace trgovina/rezervacije/strežba/naročila | vsi viri vezani na `organizationId` | `Service/Product/Order/Appointment/Customer/Staff/WorkOrder` |
| Članstvo z vlogo **per workspace** | **`OrganizationMember`** (`@@unique([organizationId,userId])`, vloga, `isDefault`) | `schema:897-910` |
| **Preklop workspacea** | **`switchActiveOrganization`** + OrgSwitcher v sidebarju | `organization-switch.ts` · `sidebar.tsx:162` |
| Predizbira / zadnji uporabljeni workspace | `normalizeActiveMembership` (trenutni iz seje → `isDefault` → prvi) | `memberships.ts:24-39` |

**Sklep:** razlika A iz tvoje dokumentacije ("več podjetij pod enem računom") in **M1–M3 so v kodi že implementirani** — shema, guards (M2 dual-read), preklopna akcija in sidebar switcher vse obstajajo. Dokumenti `MARKEC-ARCHITECTURE.md` / `MARKEC-NACRT.md` (stanje "razlika A ni narejena") so **zaostali za dejansko kodo**.

---

## 2. Kaj dejansko manjka za tvoj koncept (Workspace + Podjetje)

Tvoj predlog dodaja **eno višjo raven: "PODJETJE"** (pravna identiteta: naziv, davčna, lastnik) nad vsaj dvema Workspace-oma. V shemi se to **ne ujema** na treh mestih:

| Omejitev | Mesto | Posledica |
|---|---|---|
| **`User.organizationId` je enojen FK** (n:1 na eno Organization) | `schema:323` | Sesija (JWT) še vedno nosi enojni org kazalec, ne seznama članstev — vse večorg funkcionalnosti je prek `switchActiveOrganization` enojnega preklopa, ni naravne "Company" skupine. |
| **`Staff.userId @unique`** | `schema:633` | **Isti zaposleni ne more biti v dveh Workspace-ih/podjetjih.** Za podjetnika, ki je hkrati osebje v "šiviljstvu" in "mehaniki", to ne deluje. |
| **Ni modela pravne identitete** (`Company`/`LegalEntity`) nad `Organization` | odsoten | Davčna številka, pravni naziv, skupni podatki nimajo naravnega doma, kadar ima podjetnik več dejavnosti. |

---

## 3. Dve možnosti (odločitev je tvoja)

### Možnost A — "Organization = Workspace" + nova raven `Company` (tvoj predlog v celoti)
Dodamo vrh raven za pravno identiteto in več Workspace-ov pod njo:
- nov model `Company` (naziv, davčna, lastnik) — brez poslovnih podatkov;
- `Organization.companyId` + `Company.organizations[]`;
- dokončanje prehoda iz legacy `User.organizationId` na `OrganizationMember` (backfill + sesija + cleanup);
- sprostitev `Staff.userId @unique` na `userId String?` (dovoli isti User v več Org).

**Varno brez izgube podatkov:** vse obstoječe `organizationId` reference in relacije ostanejo nespremenjene; `Company` je dodatek višje, ne sprememba obstoječe strukture. Migracijski vrstni red (vsak korak ločen, reverzibilen, z ohranjanjem podatkov):
1. nov model `Company` + novi `Organization.companyId` (nullable, brez spremembe obstoječih vrstic),
2. backfill: za vsako obstoječo `Organization` ustvarimo `Company` in povežemo (preslika 1:1 po default),
3. sesija/guards: `OrganizationMember` za vloge + branje aktivnega company-ja (ne uničuje legacy poti),
4. šele nato sprostitev `Staff.userId @unique` in cleanup legacy polj.

**Možnost B — Organization ŽE je Workspace, brez nove ravni Company:**
Podjetnik z dvema dejavnostima ustvari dve Organization (že podprto) in ju poveže prek `OrganizationMember` (že podprto). Pravna identiteta (davčna) se zgolj centralizira v obstoječih nastavitvah. **Brez migracije, hiter win.** Slabost: ni naravne skupne pravne identitete nad več workspace-ov.

> **Priporočilo:** **F0 najprej** (zapri varnostne vrzeli v obstoječem modelu), nato **Možnost A** kot F5 — ker si jo izrecno izbral in je najbolj prilagodljiva.

---

## 4. F0 — varnostni načrt (popraviti najprej, še pred Workspace UI)

Ugotovljene dejanske varnostne pomanjkljivosti v kodi (strežniška raven, ne UI):

1. **`getEffectivePermissions` ni org-scoped.** `src/lib/permissions/effective.ts` bere `User.role` + `customRole` **samo po `userId`**, ne po aktivnem `OrganizationMember`. Če ima uporabnik v Workspace A vlogo STAFF in v Workspace B ADMIN, se dovoljenja **ne spreminjajo z aktivnim workspace-om** — globalni `User.role` zmaga. **Kršitev tvojega pravila "pravice per workspace, na strežniku".**
   → **Popravek:** odstraniti odvisnost od `User.role` v `getEffectivePermissions` (ali dodati `organizationId`) in brati vlogo sveže iz `OrganizationMember` za aktivni workspace.

2. **Legacy `session.user.organizationId` + `User.organizationId` (enojen) = tog vrat.** Sesija nosi enojni org kazalec; `unstable_update` ga zamenja ob preklopu. To pomeni, da **ni pravega "po prijavi izberi workspace"** toka (tvoja zahteva #2). Dodatno: `resolveSessionOrg` v `guards.ts:137-141` ima legacy fallback na `session.organizationId`, ki **ni člansko preverjen** — če se org v seji razlikuje od `OrganizationMember`, še lahko pade nazaj na star kazalec (tihi fallback; tvoja skrb iz besedila).
   → **Popravek:** sesija naj nosi samo `userId` + `activeOrgId`, vloga/pravice se vedno berejo sveže iz `OrganizationMember` (fail-closed, brez fallback na legacy `User.organizationId` v auth za točke, kjer obstaja članstvo).

3. **`Staff.userId @unique` preprečuje istega zaposlenega v 2 dejavnostih** (tvoj primer šivilja+mehanik). F0 blok za multi-workspace osebje.
   → **Popravek** (šele po M1 backfill, ne zdaj): `Staff.userId` postane `String?` z `@@unique([organizationId, userId])` namesto enojnega globalnega unique.

4. **Ni UI/mehanizma "izbira workspacea po prijavi" za več članstev.** OrgSwitcher obstaja v sidebarju, a ni vstopne table (tvoja zahteva #2–#3); "zadnji uporabljeni" je `User.organizationId`, ne per-user `isDefault` prepis ob vsaki uporabi.
   → **Popravek/F1:** po prijavi z več članstvi → vstopna tabla; ob preklopu posodobi `OrganizationMember.isDefault = true` za ta user (ali `activeOrgId` v seji).

---

## 5. Predlagani vrstni red (F0 → F3)

Tvoj predlagani vrstni red je pravilen in ga potrjuje analiza. Razširjen s konkrektnimi nalogami:

| Faza | Vsebina | Dokaz zaključka |
|---|---|---|
| **F0 – Varnost** | (a) `getEffectivePermissions` → org-scoped prek `OrganizationMember`; (b) odstrani tihi legacy fallback v `resolveSessionOrg` pri obstoječih članstvih; (c) negativni testi: druga vloga v drugem workspace-u, tuja organizationId, forged `x-org-slug`; (d) pregled `Staff.userId @unique` (priprava, brez spremembe še) | testi falijo prej / gredo po; ni dostopa do tujih podatkov; pravice se spreminjajo z aktivnim workspace-om |
| **F1 – Vstopna tabla** | po prijavi pri več članstvih → seznam poslovnih prostorov; `isDefault`/`activeOrgId` kot zadnji uporabljeni | tabelarska izbira; zadnji izbor per user ostane |
| **F2 – Workspace izkušnja** | ločene nadzorne plošče, nastavitve in moduli per dejavnost (že je org-scoped, potrjuje se z novimi guards) | vsak uživ na org dato |
| **F3 – Vizualna nadgradnja** | javne strani, rezervacije, trgovine, nadzorne plošče | post-F0 obnovljen UX, kontrast/axe |
| **[F5] – Možnost A** | nov `Company` + `Organization.companyId` + `Staff` sprostitev (šele po vseh zgoraj stabilnih) | reverzibilne migracije z backfill; obstoječi podatki ohranjeni |

**Trda pravila (po AD-09 / AD-10 iz tvojih dokumentov):**
- vsak korak = ločen commit + testi + lint + dokaz dejanskega delovanja,
- izklop/funkcija ne izgubi podatkov, zgodovine, rezervacij, plačil, dokumentov,
- pravice in izolacija najemnikov preverjene **na strežniški strani**,
- pred vsako migracijo sheme: sveži `git fetch`, preveri HEAD, backup na produkciji.

---

## 6. Povzetek

Obstoječa shema **že vsebuje Workspace = Organization** in **že vsebuje množična članstva, preklop in predizbiro**. Kar manjka za tvoj koncept je **višja raven pravne identitete (Company)** in **dozorjenje guardsov na pravo članstvo per workspace** (popraviti `getEffectivePermissions` + odstraniti tihi legacy fallback). To dosežemo **brez izgube podatkov** — `Company` je čisti dodatek višje, guardsi se preimenujejo, legacy pot ostane kot napovednik do cleanupa. Ograničenje `Staff.userId @unique` se sprosti šele po backfillu.

**Priporočen naslednji korak:** potrdi Možnost A (Company) in vrstni red F0 → F1 → F2 → F3 → F5. Lahko začnem s F0-skupino (a) in (b) — to je čisto varnostno, ne spreminja baze, in že zdaj zapre "sistemske" vrzeli, ki si jih opisal.