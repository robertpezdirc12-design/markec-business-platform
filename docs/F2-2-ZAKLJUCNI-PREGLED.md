# F2.2 — KONČNI PREGLED: upravljanje podjetij in poslovnih prostorov

**Datum:** neodvisna končna revizija (po implementaciji).
**Mandat:** najprej preveri dejansko stanje, NE dodajaj novih funkcij in NE spreminjaj kode; brez commita/pusha, brez produkcijskih migracij, brez prepisovanja tujega dela. Za vsak kriterij: PASS / FAIL / NOT VERIFIED + dokaz.

Arhitekturni načrt: **`docs/F2-2-ARHITEKTURA.md`**. Ta dokument je revizijsko poročilo z matriko in dokumentiranimi blokatorji.

---

## 1. Prisma migracija — **PARTIAL (my SQL PASS; bazni order PRE-POSTOJECI FAIL)**

### 1.1 Schema model — **PASS**

`prisma/schema.prisma` vsebuje `model OrganizationInvitation` s polji `id, organizationId, email, role @default("STAFF"), customRoleId, token @unique, invitedById, status @default("PENDING"), createdAt, expiresAt, acceptedAt, revokedAt`; unikata `@@unique([organizationId, email])` in `token @unique`. `Organization` ima relacijo `invitations OrganizationInvitation[]`. `prisma validate` → valid.

### 1.2 migration.sql — **PASS (sintaktično in izolirano)**

`prisma/migrations/20261130010000_f22_organization_invitations/migration.sql` je standarden `CREATE TABLE` + `CREATE INDEX` + `ALTER TABLE ADD FOREIGN KEY` z `ON DELETE CASCADE`. **Izolirana verifikacija na sveži bazi** (minimalna `Organization` matična tabela, nato zagon zgolj tega SQL): `MIGRATION APPLIED OK`, 12 stolpcev pravilnih. → **SQL je veljaven in samopremičen.**

### 1.3 Zakaj datum 30. 11. 2026? — **POJASNITEV (ni napaka)**

Danes je **09. 11. 2026**. Datum v imenu migracije (`20261130010000`) ni stenski čas, temveč **repo-konvencija naprej-datiranih zaporednih ključev**: vse zadnje migracije uporabljajo datume po dejanskem času commit-a (npr. `git log --date=short` 2026-11-06 → mape `20261129…`/`20261130…`). `20261130010000` se sortira **takoj po** zadnji obstoječi `20261130000000_p100_demo_front_neutralize` (isti dan, +1 mesto) → pravilen vrstni red. Enotna praksa celotne basena.

### 1.4 Sveži `migrate deploy` — **PRE-EXISTING FAIL (ni krivda F2.2)**

Na sveži prazni bazi `prisma migrate deploy` **ne uspe pri PRVI migraciji** (`20251030000000_add_user_reset_token_and_prefs`): `ERROR: current transaction is aborted`. Vzrok: ta migracija izvaja `ALTER TABLE "User" ADD COLUMN …` in `ALTER TABLE "Appointment" …` (AlterEnum), a na sveži bazi **še ni tabel `User`/`Appointment`** — bazna `init` migracija (`20251116063324_init`, ki kreira `User`/`Appointment`) je **datumsko ZA njo** (16.11 > 30.10), torej narobe sortirana. **To je pred-obstoječi defekt basena** (npr. prod/dev/test so nastavljene z `db push`, ne s `migrate deploy`). F2.2 baza tudi ni bila postavljena z `migrate deploy` (db push). **Ta pomanjkljivost ni bila povzročena v F2.2** in popravek spada v ločeno bazo-opravilo; F2.2 migration.sql sama po sebi je veljavna.

> **Status: NOT FULLY VERIFIED** za "celoten `migrate deploy` od sveže baze" — preprečen s pred-obstoječim baznim redosledom. **F2.2 migration DDL je izolirano dokazana veljavna.**

---

## 2. Brisanje workspacea — življenjski cikel — **FAIL (blokator lastnika)**

Preverjen življenjski cikel v `workspace-management.ts`:

1. **Ustvarjanje**: `createWorkspace` → nov `Organization` + član lastnik `role:"ADMIN", isDefault:true`. ✅
2. **Lastnik postane ADMIN**: da (član z vlogo ADMIN). ✅
3. **Odstranitev drugih članov**: `removeMember` deluje za ostale. ✅
4. **Zaščita zadnjega ADMIN**: `removeMember`/`updateMemberRole` zavrneta, če `adminCount <= 1`. ✅
5. **Brisanje workspacea**: `deleteWorkspace` zahteva **`members === 0`** → **lastnik je vedno član** (vsaj on sam) in ga **ni mogoče odstraniti** (zadnji ADMIN). Zato je `members > 0` **vedno res** → **lastnik NE more nikoli izbrisati svojega workspacea.** ❌

**Ali lahko lastnik dejansko izbriše svoje podjetje? — NE.**

**Predlog pravilne politike brisanja** (za F2.3 ou ločeno opravilo):

- Exempt the deleting owner from the "no members" rule: brisanje naj dovoli lastnemu lastniku/ediniemu ADMIN-u tudi z obstoječim lastnim članstvom.
- Zahtevaj **izrecno potrditev** (npr. vpis `delete` ali tipkanje imena) PRI brisanju z kaskadnimi podatki (termini/naročila).
- **Alternative:** razširiti `removeMember` z izhodom lastnika, ki ob odhodu izbriše/zapre org (če ni drugih članov), in `deleteWorkspace` vezati na "samo lastnik (edini ADMIN)" namesto na "nič članov".

> **Status: FAIL — blokator.** Lastnik ne more izbrisati svojega workspacea zaradi kroga `members>0` (vedno res) ⇔ zadnji-ADMIN zaščita.

---

## 3. Povabila — **PASS z 2 odprtima vprašanjema**

| Pod-vprašanje                                   | Stanje                                                                                                                                                                                          | Dokaz                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Token v bazi kot hash?                          | **NE — plaintext.** `token` shranjen neposredno (high-entropy 192-bit hex), NI SHA-256.                                                                                                         | schema `token String @unique`; `inviteMember` piše `token` kot je. Hardening priporočilo (hash pred shrambo, lookup po hashu). |
| Rok veljavnosti?                                | **DA** — `expiresAt = now+7 dni`; `acceptInvitation` zavrne poteklega.                                                                                                                          | koda + itest.                                                                                                                  |
| Enkratna uporaba?                               | **DA** — PENDING→ACCEPTED; ponovni `acceptInvitation` je zavrnjen (`status!==PENDING`).                                                                                                         | itest.                                                                                                                         |
| Preklic prepreči sprejem?                       | **DA** — `revokeInvitation` → REVOKED; sprejem zavrnjen.                                                                                                                                        | koda.                                                                                                                          |
| Zahteva pravilno e-poštno identiteto?           | **DA** — `session.user.email === invitation.email` (črkovno-neobčutljivo); napačen račun zavrnjen.                                                                                              | itest (napačen račun fail, pravilen success).                                                                                  |
| Uporabnik vidi in kopira celoten povabilni URL? | **NE — funkcionalna vrzel.** `inviteMember` vrne `token`, a UI (`WorkspaceManager.handleInvite`) ga **ne izpiše/kopira**; `listInvitations` ne vrača `token`. Uporabnik URL-ja ne more vidjeti. | koda: `handleInvite` zavrže `res.token`; `listInvitations` select nima `token`.                                                |
| Članstvo po sprejemu?                           | **DA** — `organizationMember.upsert` z `role: invitation.role` + status ACCEPTED v transakciji.                                                                                                 | itest (član `f22-user-new`, role STAFF).                                                                                       |

> **Status: PASS za varnostno jedro** (rok/enkratnost/preklic/email/članstvo); **FAIL za "vidjeti in kopirati URL"** (funkcionalna vrzel); **FAIL za "hash tokena"** (hardening).

---

## 4. Varnost — **PASS (z manjšo arhiv-nekonsistenco)**

| Kriterij                                                               | Stanje                                                                                                                                                                                                                                                                                           | Dokaz                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| ADMIN upravlja samo svoj workspace                                     | **PASS** — `memberRoleIn(orgId)` iz lastnega članstva; tuja org → null.                                                                                                                                                                                                                          | itest                                                   |
| STAFF ne spreminja vlog brez dovoljenja                                | **PASS** — `updateMemberRole` zahteva `memberRoleIn==="ADMIN"`.                                                                                                                                                                                                                                  | itest                                                   |
| Tuj organization ID ne dovoli dostopa                                  | **PASS** — `memberRoleIn(tuj)` → null → vsa akcija fail-closed.                                                                                                                                                                                                                                  | itest ("vloga per org: ni član → error")                |
| Članstvo v enem workspaceu ne daje dostopa do drugega                  | **PASS** — org-scoped `memberRoleIn`; `getEffectivePermissions(userId, orgId)` disjunktna.                                                                                                                                                                                                       | itest                                                   |
| Arhiviran workspace blokira nova povabila                              | **PASS** — `inviteMember` uporablja `requireSessionOrg()` → zahteva ACTIVE (zavrne pri SUSPENDED).                                                                                                                                                                                               | koda `resolveSessionOrganization` ACTIVE check          |
| **Arhiviran workspace blokira ostale operacije (role/odstrani/briši)** | **DELNO** — `updateMemberRole`/`removeMember`/`delete`/`listInvitations` uporabljajo `memberRoleIn()` ki **ne preverja org.status**. ADMIN v arhiviranem orgu lahko še spreminja vloge (če vloge ne zahtevajo ACTIVE). Ni cross-org leak, a je nekonzistentno z ACTIVE-gate na povabilu/default. | koda `memberRoleIn` (le membership; brez status checka) |
| Zadnjega ADMIN ni mogoče odstraniti/degradirati                        | **PASS** — `adminCount<=1` v `removeMember` in `updateMemberRole`.                                                                                                                                                                                                                               | itest                                                   |

> **Status: PASS** za varnostno jedro (izolacija, fail-closed, last-ADMIN zaščita). **Manjša opomba:** arhiv-org ne blokira št. operacij razen povabila in default-a — ni blokator (ni leak), a predlog za F2.3 ali hardening.

---

## 5. "Check failed" — **RAZREŠENO (iskren zapis)**

V opravilu se je med razvojem F2.2 prikazal neuspeh preverjanja, čeprav je končno poročilo navajalo zelene teste. **To ni bila napaka orodja in ne false-positive.** Našel sem točen korak:

- **Ukaz:** `npx vitest run --config vitest.integration.config.ts tests/integration/f2-2/workspace-management.itest.ts`
- **Prvotni izhod:** `exit 1` — `13 passed | 3 failed` (prvi zagon, preden sem popravil).
- **Tri dejanske napake (vse spremenjene in nato zelen):**
  1. `deleteWorkspace` je vrnil `true` (izbrisal org s člani) — **realen defekt**, popravljen z dodanimi števci `members`/`invitations` (arhiviraj namesto brisanja).
  2. `listMyWorkspaces` je padel, ker je orgA v prejšnjem testu izbrisal (kaskada od #1).
  3. Testni assertion `"email" in members` (na arrayu) je bil napačen → `emails` je bil `[]`; popravljen na `Array.isArray`.
- **Konec:** po popravkih `vitest` integracija **49/49 exit 0**. **Zato je končno stanje zeleno in poročilo ni lagalo — a vmes je bil RESNEN neuspeh, ki je bil odpravljen.**

Ločeno: `prisma migrate dev --name f22_organization_invitations --create-only` je padel z **P3006** (shadow-DB) — posledica pred-obstoječega baznega redosleda (točka 1.4), **ne** F2.2 koda.

---

## 6. Zaključna validacija (ponovljena, vse exit 0)

| Preverjanje         | Ukaz                                                   | Rezultat                                                                                                           |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Celotni Vitest      | `npx vitest run`                                       | **81/81 datotek, 1173/1173 testov, exit 0**                                                                        |
| Integracijski       | `npx vitest run --config vitest.integration.config.ts` | **49/49, exit 0** (F2.1 33 + F2.2 16)                                                                              |
| TypeScript          | `npx tsc --noEmit`                                     | **exit 0**                                                                                                         |
| ESLint              | `npm run lint`                                         | **exit 0**, 0 errors, 4 pre-existing warningov (`start-wizard.tsx`)                                                |
| Browser (F2.2 UI)   | Playwright proti `markec_f21_test`                     | **9/9** (moj zagon prejšnji korak: `/workspaces/manage` h1, workspacei, člani+vloge, Povabi dialog, create dialog) |
| CRUD workspaceov    | integracijski                                          | **ok** (create/update/archive/activate/delete-safe)                                                                |
| Povabila + vloge    | integracijski                                          | **ok** (invite/accept/revoke/role-change)                                                                          |
| Varnostna izolacija | integracijski                                          | **ok** (številni)                                                                                                  |

---

## 7. Matrika sprejetja (PASS / FAIL / NOT VERIFIED)

| Področje                                                   | Status                   | Poanta                                                  |
| ---------------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| F2.2 migration.sql (izolirano)                             | **PASS**                 | Veljavna, samopremična                                  |
| Poln `migrate deploy` od sveže baze                        | **NOT VERIFIED**         | Preprečen s pred-obstoječim baznim redosledom (ni F2.2) |
| Ustvarjanje workspacea → lastnik/ADMIN                     | **PASS**                 |                                                         |
| Varno urejanje/arhiviranje/aktiviranje                     | **PASS**                 |                                                         |
| **Brisanje workspacea (lastnik)**                          | **FAIL (blokator)**      | Lastnik ne more izbrisati (krog members+last-ADMIN)     |
| Povabila: rok/enkratnost/preklic/email/članstvo            | **PASS**                 |                                                         |
| Povabilni URL videti/kopirati                              | **FAIL**                 | UI ga ne izpostavi                                      |
| Token v bazi kot hash                                      | **FAIL (hardening)**     | Plaintext (čeprav high-entropy)                         |
| Varnostna izolacija / admin / staff / tuj org / last-ADMIN | **PASS**                 |                                                         |
| Arhiv-blokiranje operacij (ne le povabil)                  | **DELNO / NOT VERIFIED** | Potrebno poenotenje ACTIVE-gate                         |
| Celotna validacija (Vitest/TS/lint/browser/integr.)        | **PASS**                 | 1173/1173; 49/49; TS 0; lint 0err                       |
| "Check failed" razrešen                                    | **PASS**                 | Realen vmesen neuspeh odpravljen; končno zeleno         |

---

## 8. Zaključek in priporočila

**F2.2 NI BILO v celoti sprejeto brez opomb.** Osnova (workspace CRUD razen brisanja, člani, povabila, privzeti prostor, varnostna izolacija) je **delujoča in zelena**. Odprte blokatorje/funkcionalne vrzeli je treba razrešiti (dokumentirano zgoraj, **ne v tem revizijskem koraku, saj mandat prepoveduje spreminjanje kode**):

1. **BLOCKER (F2.3 ali ločeno opravilo):** pravilo brisanja — lastnik mora imeti možnost izbrisati svoje podjetje (exempt last-ADMIN/member pri izrecni potrditvi).
2. **Funkcionalna:** UI za kopiranje/prikaz povabilnega URL-ja.
3. **Hardening:** hash povabilnega tokena pred shrambo.
4. **Pre-existing (ni F2.2, ločeno opravilo):** bazni redosled migracij — `init` mora biti pod vrstnim redom; da `migrate deploy` od sveže baze deluje.
5. **Dolga:** `Staff.userId` multi-org (že znana, F2.3).

**Nič commitano/pushano; brez produkcijskih migracij; prevpisanega tujega dela ni bilo.**

---

## 9. Kako je bilo upoštevano "ne podiraj obstoječih rezervacijskih funkcij" / "ne prepisuj tujega"

- `Staff.userId` se ni spreminjal; `appointments.ts` diff ostaja le F0 hunk. Booking komponente drugih agentov niso bile urejene. Prod-baza ni bila dotaknjena.
- Vse revizijske operacije so bile na `markec_f21_test` (ločeno) in na svežih začasnih bazah (odstranjene).

---

## 10. DODATEK F2.2.1 (09. 11. 2026) — trije blokatorji odpravljeni: **F2.2 SPREJETO**

Po odpravi blokatorjev in ponovljenih testih (Vitest / TypeScript / ESLint / integracijski / realni brskalnik — vse z `exit 0`). Datumi izvajanja: 09. 11. 2026.

### 10.1 Brisanje workspacea (prej **FAIL — blokator**) — **PASS**

- `deleteWorkspace` (`src/app/actions/workspace-management.ts`, sekcija 250–326) trdi izbris dovoli **samo** ko je izpolnjeno vse:
  1. klicatelj je **ADMIN** (`membershipWithStatus`);
  2. **izrecna potrditev** (`confirm: true`, drugače "Izbris mora biti izrecno potrjen");
  3. prostor je **ACTIVE** (arhiviran je samo za branje — najprej aktiviraj);
  4. **ni poslovnih podatkov** — hard gate z 9 števci: `appointment`, `order`, `service`, `product`, `customer`, `formSubmission`, `workOrder`, `prepaidPurchase`, `document`; ob kateremkoli podatku → "trdo brisanje je blokirano. Arhivirajte ga namesto tega";
  5. **ni drugih članov** razen lastnika (tihi odvzem dostopa tuje sim neprivoljen je onemogočen).
- Izbris v **transakciji**: `organizationInvitation.deleteMany` + `organization.delete`. Lastnikovo članstvo odstrani `onDelete: Cascade`; **uporabniški račun ostane** (User-relacije so SetNull). Zadnjega-ADMIN zaščita pri `removeMember`/`updateMemberRole` ostaja nespremenjena (adminCount<=1).
- Prizma-kaskade pregledane: `OrganizationMember.user`/`organization` Cascade; `OrganizationInvitation.organization` Cascade.

**Dokazi:**
- Integracijski test `tests/integration/f2-2/workspace-management-f221.itest.ts`: edini lastnik izbriše (org + članstvo pojdeta, račun ostane z e-pošto), brez `confirm` zavrnjeno (org ostane), storitev → blokada z "Arhivirajte", arhiviran potrebuje aktivacijo pred brisanjem.
- Brskalni tok (`scripts/f221-browser-flow.cjs`) 14/14 PASS, exit 0: potrditveni gumb onemogočen do vnosa imena prostora, po brisanju org izgine, račun admina ostane.

### 10.2 Povabilna povezava (prej **FAIL**) — **PASS**

- `inviteMember` (vrstica 541) vrne surovi token **natanko enkrat**; `listInvitations` (647–652) vrača `select: { email, role, status, createdAt }` — **token v seznamu nikoli**.
- UI (`src/components/admin/workspace-manager.tsx`): dialog `createdLink` (361, 661–696) prikaže **celoten URL `/invite/<token>`**, gumb Kopiraj→**Kopirano** (415–423, 696) + obvestilo "Prikaže se **samo enkrat**" (671); ob napaki kopiranja toast z opozorilom.
- `/invite/[token]/page.tsx` sestavi pravilno accept-stran (za veljaven token pokaže ime podjetja + vlogo; za neveljaven "Povabilo ni več veljavno").

**Dokazi (brskalnik, realni Chromium):** celoten URL dialog PASS; `Kopiraj → Kopirano` PASS; seznam povabil ne vsebuje surovega tokena PASS; `/invite/<token>` pokaže org + vlogo PASS; neveljaven token zavrnjen PASS. Integracijski: token v bazi ≙ `SHA-256(surovi)`, URL segment hashuje v bazo, seznam brez tokena.

### 10.3 Hashiranje tokenov (prej **FAIL**) — **PASS**

- Shranjevanje: `inviteMember` piše **SHA-256 hash** (`token = hashInvitationToken(raw)`). Sprejem (`acceptInvitation`, 550) hashira podani žeton **najprej** in poišče po hashu. Preveri `status === "PENDING"` (557), `expiresAt` (563), org `ACTIVE` (566) in e-poštno ujemanje seje (573).
- **Atomski enkratni sprejem** (582–606): transakcija `updateMany({ where: { id, status: "PENDING" } })` — vzporedna zahteva dobi `count 0` → zavrnjena; dvojna uporaba pri sočasnih zahtevah onemogočena. Konkurenčni test: natanko 1 od 2 uspeh, 1 članstvo.
- **Surovi token se ne zapisuje v loge**; v bazi samo hash (regex `^[a-f0-9]{64}$`).
- **Migracija obstoječih povabil** (`scripts/backfill-invitation-token-hash.ts`): idempotenčen in-place (64-hex vrstic se ne dotakne, kratke/plaintext hashuje). Zagnan na `markec_f21_test`: `total=7 converted=0` (vseh 7 že hash — preverjeno SQL-om: 7 hash / **0 plaintext**). `markec_dev` nima povabil (prazna shema). **Dokumentirana odločitev:** produkcijski zagon backfila v deploy koraku; veljavna (ne sprejeta/potekla/preklicana) povabila ostanejo uporabna, ker sprejem hashira še vedno enak surovi žeton.

**F2.2.1 defekt odkrit in popravljen med brskalnim testiranjem:** `hashInvitationToken` je bil sinhron export v `"use server"` modulu → Next bundler `Server Actions must be async functions` → **`GET /workspaces/manage` 500** (TypeScript + Vitest tega ne lovita — lovil ga je šele realni brskalnik). Popravek: hash premeščen v čisto jedro `src/lib/invitations/hash.ts`; sede uvezli `page.tsx` in 2 integracijska testa preusmerjeni; strukturni test `workspaces-f2-2.test.ts` posodobljen (preverja lib). Po popravku strežnik `/workspaces/manage` vrne **200**.

### 10.4 Arhiviran workspace = samo za branje (prej **DELNO**) — **PASS**

- Pravila uveljavljena **na veju strežniških akcijah**, ne v UI: `updateWorkspace` (urejanje, 159), `inviteMember` (nova povabila, 470), `setDefaultWorkspace` (673), `deleteWorkspace` (266 — aktiviraj pred brisanjem), `acceptInvitation` (org `ACTIVE` pogoj, 566); `archiveWorkspace`/`activateWorkspace` statusni prehod ACTIVE⇄SUSPENDED s samo ADMIN.
- Poslovne akcije splošno: `requireSessionOrg`/`resolveSessionOrganization` (`src/lib/auth/guards.ts` 175–202) je **fail-closed** — članstvo v ne-ACTIVE orgu se ne resolva, zato vse poslovne akcije pod njim zavrnejo.
- Upravljanje članov ostaja dovoljeno v arhiviranem(org)članstvo namenoma — čiščenje pred brisanjem (dokumentirana odločitev v 10.1).

**Dokazi:** integracijski test blokira povabila/urejanje/privzeti-prostor/brisanje v SUSPENDED (vse zavrnjeno, ni novih povabil v DB), aktivacija iz SUSPENDED→ACTIVE deluje; brskalnik "samo za branje" pasica + viden gumb Aktiviraj.

### 10.5 Testi — ponovljeni po popravkih (vsi `exit 0`)

| Preverjanje | Ukaz | Rezultat |
| --- | --- | --- |
| Vitest (celoten) | `pnpm vitest run` | **81/81 datotek, 1177/1177 testov** ✓ |
| Integracijski (test DB) | `npx vitest run --config vitest.integration.config.ts` | **3/3 datotek, 58/58 testov** ✓ (F2.1 + F2.2 16 + F2.2.1 9) |
| TypeScript | `npx tsc --noEmit` | **exit 0** ✓ |
| ESLint | `pnpm lint` | **0 napak**, 4 pre-existing warningi (`start-wizard.tsx`) ✓ |
| Brskalnik (F2.2.1 UI) | `node scripts/f221-browser-flow.cjs` (Playwright, realni NextAuth, `markec_f21_test`, dev :3001) | **14/14 PASS, exit 0** ✓ |

Novi vedenjski testi pokrijejo vseh 9 zahtevanih primerov: brisanje z edinim lastnikom ✓, blokada s poslovnimi podatki ✓, račun ostane ✓, prikaz+kopiraj URL ✓ (brskalnik), hash tokena ✓, sprejem veljavnega ✓, zavrnitev uporabljenega/preklicanega/pretečenega ✓ (3 ločena testi), sočasni sprejem natanko 1 uspeh ✓, blokada sprememb v arhiviranem ✓.

### 10.6 Matrika zaključka F2.2.1

| Zahteva | Status | Ključni dokaz |
| --- | --- | --- |
| 1. Brisanje workspacea (lastnik) | **PASS** | deleteWorkspace politika + integrac. + brskalnik |
| 2. Povabilni URL prikaz/kopiranje | **PASS** | createdLink dialog + Kopirano + brskalnik |
| Suvo token v seznamu nikoli | **PASS** | listInvitations select + test |
| 3. SHA-256 hash shramba + sprejem hashira najprej | **PASS** | lib/invitations/hash + akciji + testi |
| Atomski enkratni sprejem | **PASS** | updateMany PENDING claim + konkurenčni test |
| Surovi token ne v logih | **PASS** | ni rendera/logginga surovega (koda pregled) |
| Varna migracija obstoječih | **PASS** | backfill idempotencen (7/7 hash na test DB) + dokumentirana odločitev |
| 4. Arhiviran = samo za branje (akcijsko) | **PASS** | ACTIVE gate na 5 akcijah + requireSessionOrg |
| ADMIN reaktivacija | **PASS** | activateWorkspace + brskalnik |
| 5. Vseh 9 vedenjskih testov | **PASS** | tabel zgoraj |
| Celotni rejim testov | **PASS** | Vitest/TS/ESLint/integrac./brskalnik, vse exit 0 |

**F2.2 je SPREJETO.** Blokatorji odpravljeni, testi zeleni. F2.3 del ostaja `Staff.userId` multi-org refaktor (ločeno opravilo).

*Nič commitano/pushano; brez produkcijskih migracij; prejšnji WIP drugih agentov netaknjen.*
