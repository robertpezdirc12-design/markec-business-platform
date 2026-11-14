# F2.2 — Arhitekturni načrt: upravljanje podjetij in poslovnih prostorov

**Faza:** arhitekturna analiza pred implementacijo (mandat: najprej preglej, kar obstaja; pripravi načrt z modeli, migracijami, tveganji in sprejemnimi kriteriji; šele nato implementacija).

---

## 1. Pregled obstoječe arhitekture (dokazano iz sheme in kode)

### 1.1 Povezani modeli (prisma/schema.prisma)

| Model                            | Ključna polja                                                                                                              | Relacije / omejitve                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`User`** (l.309)               | `role UserRole @default(CLIENTE)`, `organizationId String?`, `customRoleId String?`                                        | `staff Staff?` (1:1!), `customer Customer?` (1:1), `memberships OrganizationMember[]`          |
| **`Organization`** (l.44)        | `vertical @default("beauty")`, `status` (ACTIVE\|SUSPENDED), `publishState`, `customRoles`, `members OrganizationMember[]` | isti `User` je lahko član več `Organization` (n:n prek member)                                 |
| **`OrganizationMember`** (l.897) | `role String`, `customRoleId String?`, `isDefault Boolean @default(false)`                                                 | `@@unique([organizationId, userId])`, `@@index([userId])` — **vloga per org**                  |
| **`Staff`** (l.614)              | `organizationId String?`, `isActive`                                                                                       | **`userId String @unique` (1:1!)** — ima tudi `@@index([userId])`, `@@index([organizationId])` |
| **`CustomRole`** (l.385)         | `organizationId`, `permissions`                                                                                            | org-scoped permission presets                                                                  |

### 1.2 Kaj ŽE omogoča struktura

1. **En račun → več podjetij:** `OrganizationMember` (judro M1) veže en `User` na več `Organization` z **vlogo per org**. To je bilo dokazano v F2.1 (`org-isolation.itest.ts`: `OrganizationMember.role` A=STAFF / B=ADMIN, `getEffectivePermissions` per-org disjunktna).
2. **`getEffectivePermissions(userId, organizationId)`** (lib/permissions/effective.ts) je **org-scoped**: vloga priteče iz `OrganizationMember` vrstice (role + customRole) tistega workspacea; za legacy člane iz globalne `User.role` samo ob dokazanem pripadanju org; drugače fail-closed.
3. **Preklop + zadnji uporabljeni:** `switchActiveOrganization` piše `User.organizationId` + JWT; `lastUsed` se obnovi iz seje/DB. **`isDefault` = statična rezerva** (posebna oznaka, neli se z zadnjim).
4. **Org-scoped zaščita akcij:** `requireSessionOrg` / `requirePermissionOrg(key)` + `hasActiveMembershipInOrg` (F2.1) — fail-closed, brez globalnega fallbacka.
5. **Ustvarjanje podjetja:** `createSalonOrganization` (onboarding.ts) — kreira org + članstvo + (samo za PRVO podjetje) staff. Za dodatna podjetja **staff vrstica se ne ustvari** — eksplicitno dokumentirana "limitacija v1" (komentar l.264-265).

### 1.3 Glavne vrzeli (kar F2.2 zapolni)

| #   | Vrzel                                                         | Posledica danes                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **`Staff.userId @unique` (1:1)**                              | Istega uporabnika **ni mogoče imeti za STAFF v dveh podjetjih** s samostojnim staff poslovnim profilom (urnik/storitve). Membership-po roles se dveh org. Že deluje (ADMIN A / STAFF B — F2.1), toda staff **poslovni zapis** je 1:1 → omejen. |
| B   | **Ni `Invitation` modela / povabil**                          | Člane je mogoče dodajati le skozi `createSalonOrganization` ali `updateUserRole` (obstoječ uporabnik); ni asinhronega povabila po e-pošti/žetonu.                                                                                              |
| C   | **Ni "Moja podjetja" upravl jasnega vmesnika**                | Workspace picker obstaja; ni ločenega upravljalnega zaslona za urejanje/metadata workspacea, privzetega prostora, članov.                                                                                                                      |
| D   | **Življenjski cikel** (urejanje, arhiviranje, varno brisanje) | `Organization.status` ima le ACTIVE/SUSPENDED; ni uporabniške poti za mirujoči/arhiviran workspace.                                                                                                                                            |

---

## 2. Potrebne spremembe in migracije

### 2.1 `Staff.userId @unique` — varen načrt

**Cilj:** isti uporabnik lahko ima staff poslovni zapis v več podjetjih (h katerim ima članstvo z vlogo STAFF/ADMIN).

**Dokazano dejstvo:** dovoljenja in vloge že pritečejo iz `OrganizationMember` (ne iz Staff). `Staff` je **poslovni subjekt** (urnik, storitve, terminologija), vedno org-scoped prek `organizationId`.

**Predlagana shema (najmanj invazivna):**

```
model Staff {
  ...
  userId String          // NEHATI biti @unique
  organizationId String? // ostane org-scoped
  @@unique([userId, organizationId])   // največ en staff zapis na (user, org)
  @@index([userId])
}
```

- `User.staff Staff?` → `User.staffStaffs Staff[]` (ali pustiti ime, tip se spremeni v array). **Vsi klicatelji `prisma.staff.findUnique({ where: { userId } })` se morajo preusmeriti na `findMany({ where: { userId, organizationId } })` v org-kontekstu.**

**Tveganja:** `findUnique({where:{userId}})` v `appointments.ts`, `staff.ts` lahko ob več staff vrsticah pade (P2025). Zato je DODATNO potrebno:

1. **Branje staff vedno v org kontekstu** (`findFirst({ where: { userId, organizationId } })`) — večinoma v akcijah, ki že imajo `org`.
2. **`@@unique([userId, organizationId])`** prepreči dvojnika znotraj istega org.
3. Najprej **preveriti preslikave** (vsi klicateji), kajti napaka tam = zlomljeni urniki/rezervacije.

> **ODLOČITEV (razlaga obsega, po potrditvi uporabnika):** V **F2.2** je obseg **workspace CRUD + člani + povabila + privzeti prostor**. Vloge per org (ADMIN/STAFF) **že delujejo** prek `OrganizationMember` (dokazano v F2.1). **`Staff.userId` multi-org (poslovni zapis z urnikom v 2 org) se POS-restavi v F2.3** kot ločen varen zagon — vsa branja `staff.findUnique({where:{userId}})` (14 klic-ev) se preusmerijo v org-kontekst tam, šele za manjše tveganje na rezervacije. F2.2 zato **ne spreminja sheme `Staff`** in ne razbija rezervacijskih funkcij.

### 2.2 Nova `OrganizationInvitation`

```
model OrganizationInvitation {
  id             String  @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields:[organizationId], references:[id], onDelete: Cascade)
  email          String            // spodnji klic: ena e-pošta, ena vrstica
  role           String            // ADMIN | STAFF
  customRoleId   String?
  token          String  @unique   // 192-bit za povezavo /accept/[token]
  invitedById    String?           // kdo je povabil
  status         String  @default("PENDING")  // PENDING | ACCEPTED | REJECTED | REVOKED
  createdAt      DateTime @default(now())
  expiresAt      DateTime?
  acceptedAt     DateTime?
  revokedAt      DateTime?

  @@unique([organizationId, email])
  @@index([token])
  @@index([organizationId])
  @@index([email])
}
```

- Povabilo še ne kreira `User` (prejemnik je lahko nov ali obstoječ račun). Ob sprejemu: če račun obstaja → `OrganizationMember.create`; če ne → pri ob registraciji/potrditvi povežemo po e-pošti.
- Varnost: `token` naključen, org+status preverjena ob vsakem klicu; povabilo strogo org-scoped (`requirePermissionOrg("members.manage")` ali podobno).

### 2.3 Življenjski cikel `Organization`

- **Ustvarjanje**: obstoječi `createSalonOrganization` (že podpira `additionalOrg`), plus novi `createWorkspace` ki **ne zahteva** vseh onboarding polj (le ime + dejavnost + osnovni podatki) za obstoječega ownerja → nov `Organization` + članstvo ADMIN. **Brez spremembe sheme** — članstvo se ustvari kot pri `additionalOrg`.
- **Urejanje osnovnih podatkov**: `name`, `slug`, `logo`, `vertical` (že je settings akcija, razširi za per-workspace).
- **Arhiviranje/deaktiviranje**: `Organization.status` dobi uporabniško stanje `ARCHIVED` (ali uporabimo obstoječi `SUSPENDED` s tematiko "arhiviran"). Član lahko še vedno vidi zgodovino, ne more dodajati.
- **Varno brisanje**: omejeno — le prazna / redno podjetja brez odvisnih podatkov (brez appointments/orders/ključne vsebine) ali le za ownerja z izrecnim potrditvenim potekom. Kjer podatki obstajajo → samo arhiviranje. **Fizični `delete` kot zadnja možnost**; po defaults velja `onDelete: Cascade` na org, a to bi zbrisalo tudi rezervacije — zato brisanje omejeno in revidirano.

### 2.4 Privzeti + zadnji uporabljeni

- `isDefault` (OrganizationMember) = uporabnikova izbira privzetega (novi `setDefaultWorkspace`).
- Zadnji uporabljeni = `User.organizationId` + JWT (kot danes). **Preklapljanje NE spreminja `isDefault`** (ohraniti ločitev — F2.0 je to določil).
- UI: v "Moja podjetja" izbira "Nastavi privzeti" per workspace.

---

## 3. Varnostna tveganja in varovala

| Tveganje                                      | Varovalo                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Ustvarjanje workspacea brez dovoljenja        | Samo prijavljen uporabnik; novi workspace = lasten (ADMIN član postane lastnik).                                                               |
| Član spreminja tuje podjetje                  | Vsaka akcija na workspace/člane gre prek `requirePermissionOrg(...)` (org-scoped, fail-closed).                                                |
| Removing člana ali sprememba vloge v tuji org | `requirePermissionOrg` + preverba, da je tarča član PRAVEGA workspacea; owner zadnjega ADMIN člana ni mogoče degradirati/odstraniti (zaščita). |
| Povabilo v tujo org                           | Organizacija povabila vedno iz `requireSessionOrg`/`requirePermissionOrg`; ni tujega org id-a.                                                 |
| Sprejem povabila z zlorabljenim token         | Token naključen 192-bit; org+status+expiresAt ob vsakem klicu; enkratno (PENDING→ACCEPTED).                                                    |
| `Staff.userId` multi-org                      | `@@unique([userId, organizationId])` + vsa branja v org kontekstu; regresijski testi na rezervacije (nikoli ne podri).                         |
| Fail-closed vnosi                             | Zod validacija vseh vnosov; neznan org/član → zavrnjeno, nikoli "tiho default".                                                                |
| Legacy fallback                               | Ne uvajam novega globalnega fallbacka; `resolveSessionOrg` ostane fail-closed (F2.1).                                                          |

---

## 4. Sprejemni kriteriji (za konec F2.2)

1. Uporabnik lahko **ustvari nov workspace** (ime + dejavnost + osnovni podatki) in postane njegov owner (ADMIN član).
2. **En uporabnik ima lahko več workspaceov** pod enem računom; podatki med njimi so izolirani (branje/sprememba v enem ne vpliva na drug).
3. **Člani + povabila**: owner/pooblaščeni član lahko pošlje povabilo, prejemnik ga lahko sprejme/zavrne, owner lahko odstrani člana in spremeni vlogo; vse org-scoped.
4. **Ista uporabnik lahko ima v enem workspaceu ADMIN, v drugem STAFF** (različne vloge/permissioni) — dokazano.
5. **`Staff.userId` multi-org** deluje brez zlomljenih rezervacijskih funkcij (regresijski testi zeleni).
6. **Urejanje / arhiviranje / varno brisanje** workspacea deluje; izolacija podatkov je ohranjena.
7. **Privzeti workspace** je uporabniško nastavljiv; preklapljanje ne spreminja privzetega; "zadnji uporabljeni" se še vedno obnovi.
8. UI "Moja podjetja / poslovni prostori" je dostopen in usklajen z obstoječim pickerjem in preklopom (F2.1 ostane funkcionalen).
9. Celoten Vitest + TypeScript + lint zelen; F2.1/F2.0/F1 testi ostanejo zeleni.

---

## 5. Obseg in omejitve

- **V F2.2**: workspace CRUD (create/edit/archive/limited-delete), člani + povabila + vloge, privzeti workspace, `Staff.userId` multi-org (varna, minimalna), UI "Moja podjetja".
- **NE v F2.2 (F2.3)**: dejavnostno specifične nadzorne plošče, polno varno brisanje s podrobnimi rezervacijami, razširjen staff urnik/rezervacije v več org na produkciji.
- **Ne dotikamo** nedokončanih sprememb drugih agentov (booking komponente). **Brez produkcijskih migracij** — migracije samo na `markec_f21_test`/lokalnem dev.

---

## 6. Redosled implementacije

1. Shema: `Staff.userId` (odstrani @unique, `@@unique([userId,organizationId])`) + `OrganizationInvitation`.
2. Migracija na testni DB (markec_f21_test) + backfill/idempotentno.
3. Server-akcije: `createWorkspace`, `updateWorkspace`, `archiveWorkspace`, `deleteWorkspace`; `inviteMember`, `acceptInvitation`, `rejectInvitation`, `revokeInvitation`, `removeMember`, `updateMemberRole`; `setDefaultWorkspace`.
4. Preusmeritev vseh `staff.findUnique({where:{userId}})` v org-kontekst.
5. UI: "Moja podjetja" (board + člani + povabila + default), integracija z obstoječim pickerjem.
6. Testi: enot + integracijski (na markec_f21_test) za vse zgoraj.
7. Poročilo `docs/F2-2-ZAKLJUCNI-PREGLED.md`.

> Ta načrt ne uvaja modelov, preden ni preverjeno kar obstaja (zgoraj §1). Nove entitete: `OrganizationInvitation`; sprememba omejitve `Staff.userId`. Vse ostalo je razširitev obstoječih modelov in akcij.
