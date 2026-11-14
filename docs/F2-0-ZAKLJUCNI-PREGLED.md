# F2.0 — Zaključek F1: izvedba, validacija in odprte težave

**Datum:** 2026-11-08
**Mandat:** `Nadaljuj s F2.0 – zaključkom F1.` Upoštevati ugotovitve `docs/F1-ZAKLJUCNI-PREGLED.md`, izvesti 6 zahtev, po koncu pognati celoten test suite, TypeScript, lint ter vizualni pregled namizja in telefona. `F2.0 je končan šele, ko so vse njegove sprejemne zahteve preverjene. Poročaj o vsaki še odprti težavi. Šele nato predlagaj F2.1.`
**Meje (strogo upoštevano):** brez posegov v nedokončane spremembe drugih agentov, brez spreminjanja `appointments.ts` in `deposit-rules-79.test.ts`, brez produkcijskih migracij, brez `commit` / `push`.

---

## Executive summary (EN)

All six F2.0 requirements are implemented and structurally verified. Final validation: full suite **1 pre-existing failure / 1144 passing** (baseline was 1 failure / 1120 passing — the +24 are the new F2.0 regression tests, **zero new failures**), TypeScript clean, lint 0 errors / 4 pre-existing warnings, and a post-fix visual review at 1440 px and 390 px plus the mobile menu. Anonymous `/workspaces` now returns **307** to `/login?callbackUrl=%2Fworkspaces`, the active card is enterable, and long names no longer cause horizontal overflow. Hash comparison proves all 16 protected files — including `appointments.ts`, `deposit-rules-79.test.ts` and `docs/F1-PREGLED.md` — remain byte-identical.

**F2.0 is therefore NOT fully signed off.** One acceptance criterion (`npx vitest run` → 0 failures) is unreachable under the explicit constraint not to touch `appointments.ts` / `deposit-rules-79.test.ts`. A second criterion (live authenticated entry into the active workspace) cannot be executed against the unmigrated local DB and is verified only structurally/DOM-wise. Every open issue is listed in section 6 before the F2.1 proposal.

---

## 1. Kaj je bilo implementirano

| # | Zahteva | Rešitev |
|---|---------|---------|
| 1 | Vstop tudi v trenutno aktivni workspace | `workspace-picker.tsx`: `enter(id, isActive)`; `const disabled = isPending` (ne več `isPending \|\| ws.isActive`); aktivni org preskoči `switchActiveOrganization` (brez odvečnega DB zapisa) in gre naravnost na `/dashboard`. Preklop na drug org ostane na varni strežniški akciji. |
| 2 | Strežniška zaščita + redirect neprijavljenih | `(admin)/workspaces/page.tsx`: `await auth()` → `redirect("/login?callbackUrl=%2Fworkspaces")`. `proxy.ts`: `isWorkspacesPage` + `!isLoggedIn` kot defense-in-depth. Vlogovna pravila za `/dashboard`, `/staff-portal`, `/my-account` niso spremenjena. Akciji ostaneta fail-closed brez seje. |
| 3 | Dolga imena + 390 px | `min-w-0` na vseh flex prednikih, `shrink-0` na ikoni in znački, `truncate` zato dejansko deluje; grid ima ekspliciten `grid-cols-1` (`minmax(0,1fr)`) in `min-w-0`. |
| 4 | Preklop v mobilnem meniju za vse ustrezne vloge | `MobileSidebar` prejme `organizations` / `currentOrganizationId` in renderira `OrgSwitcher` (pogoj `organizations.length > 1`, **ne** `isAdmin`); `onPicked` zapre Sheet. `AdminHeader` posreduje podatke, `(admin)/layout.tsx` jih napolni iz lastnih **ACTIVE** članstev. Menijski vnos `Zamenjaj poslovni prostor` je premaknjen iz `{isAdmin && ...}` v `{canSwitchWorkspaces && ...}`. |
| 5 | Globalni JWT role / `requireRole()` / `isAdmin` / legacy fallbacki | `PermissionsProvider.isAdmin` se zdaj izvaja iz `OrganizationMember.role` **aktivnega** workspacea (fallback na globalni role samo za račune brez member vrstice). Dodan `getActiveMembershipsForUser()` (ACTIVE filter), `hasAnyMembership()`, `legacyDefaultOrgAllowed()` / `mayUseLegacyDefaultOrg()`. Vsi trije `findFirst(first ACTIVE)` fallbacki (`resolveSessionOrg`, `getSessionOrg`, `requireAdminOrg`) so pogojeni z `mayUseLegacyDefaultOrg`. `getResolvedOrg()` za prijavljenega ADMIN/STAFF brez razrešenega org vrne `null` namesto padca na **anonimni javni** default tenant; anonimni `getPublicOrg()` je nedotaknjen. `requireRole()` ostane globalen — glej §5. |
| 6 | Jasno ločiti privzeti / zadnji uporabljeni | Značka aktivne kartice `Aktiven` → **`Zadnji uporabljeni`**; `Privzeti prostor` ostane ločena oznaka v vrstici z vlogo. Stran dodaja legendo, ki oba pojma razloži. `organization-switch.ts` **ne** piše `isDefault` — pojma nista zlita. |

### Datoteke

**Spremenjenih 9** (vse v mojem obsegu):
`src/components/admin/workspace-picker.tsx`, `src/app/(admin)/workspaces/page.tsx`, `src/app/(admin)/layout.tsx`, `src/components/admin/header.tsx`, `src/components/admin/sidebar.tsx`, `src/proxy.ts`, `src/lib/auth/memberships.ts`, `src/lib/auth/guards.ts`, `src/lib/tenant.ts`.

**Novi 2:** `tests/workspaces-f2-0.test.ts` (24 testov), `docs/F2-0-ZAKLJUCNI-PREGLED.md` (to poročilo).

**Nedotaknjenih 16** (SHA-256 primerjava z `hashes-before.txt` iz začetka F2.0): `src/app/actions/appointments.ts`, `tests/deposit-rules-79.test.ts`, `docs/F1-PREGLED.md`, `src/app/actions/workspaces.ts`, `src/lib/permissions/effective.ts`, `src/components/auth/login-form.tsx`, `tests/workspaces-f1.test.ts`, `tests/security/org-scoped-permissions-f0.test.ts`, `src/app/(admin)/dashboard/page.tsx`, `src/app/actions/users.ts`, `src/components/booking/booking-form.tsx`, `src/components/booking/steps/date-time-step.tsx`, `src/components/booking/steps/service-selection-step.tsx`, `src/components/booking/steps/staff-step.tsx`, `src/components/icons/index.tsx`, `src/lib/i18n/dict/booking.ts`. (`src/app/actions/organization-switch.ts`, `tests/memberships-100a.test.ts` in `tests/walk-in-98.test.ts` niso bili v hash posnetku, a so prav tako ostali nespremenjeni in so bili preverjeni z izoliranim zagonom testov.)

---

## 2. Validacija (končna, po vseh spremembah)

| Preverjanje | Rezultat | Primerjava z baseline |
|-------------|----------|-----------------------|
| `npx vitest run` | `1 failed \| 78 passed (79)` · `1 failed \| 1144 passed (1145)` · `VITEST_EXIT=1` | baseline `1 failed \| 77 passed (78)` · `1 failed \| 1120 passed (1121)`. **+1 datoteka, +24 testov, 0 novih padcev.** |
| Izolirani sorodni testi (`walk-in-98`, `workspaces-f2-0`, `workspaces-f1`, `memberships-100a`, `org-scoped-permissions-f0`) | `5 passed (5)` / `62 passed (62)` | — |
| `npx tsc --noEmit` | `TSC_EXIT=0` | baseline 0, vmesni 0 |
| `npm run lint` | `LINT_EXIT=0`, **0 errors / 4 warnings** | identično baseline (isti 4 `start-wizard.tsx` warningi) |
| HTTP sonde (anonimno) | `/workspaces` → **307** `/login?callbackUrl=%2Fworkspaces`; `/dashboard` → 307; `/staff-portal` → 307; `/workspaces/` → 308 → `/workspaces` → 307 | F1: `/workspaces` → **200** |
| Javne poti (anonimno) | `/` 200, `/login` 200, `/register` 200 | nespremenjeno |
| Hash delta | 9 namernih sprememb, 16 zaščitenih datotek byte-identičnih | — |

Edini padec je **že obstoječi** `tests/deposit-rules-79.test.ts`: krhka regex-trditev pričakuje literalni prelom vrstice med `&&` in `appointmentDetails`, delovna kopija `appointments.ts` drugega agenta pa ima isti pogoj v eni vrstici. Vzrok je dokazan v F1 poročilu (logika provizij je nedotaknjena, CRLF ni vpleten). Obe datoteki sta po mandatu nedotakljivi.

---

## 3. Vizualni pregled (po popravkih)

Playwright + **resnični prevedeni CSS** živega dev strežnika (`:3000`) + resnični `.admin-sans-headings` ovijalnik (ista klasa v `(admin)/layout.tsx` in `(auth)/layout.tsx`, slednji je na dosegljivi `/login` po redirectu). Ta ovijalnik preglasi globalno `h1/h2` tipografijo; prvi poskus harnessa ga je izgubil in je bil zato ponovljen. Kartice so vstavljene v ovijalnik, ne v `document.body`, zato je tipografija skladna z resnično stranjo. Reprezentativne kartice z ekstaktnimi class nizi iz `workspace-picker.tsx` — tj. z natančnimi nizi razredov —, vključno z namerno patološko dolgim imenom. Vsi harnessi in posnetki so izven repozitorija v `%TEMP%/f20/`.

| | Namizje 1440 | Telefon 390 |
|---|---|---|
| `document.documentElement.scrollWidth` | 1440 (= `innerWidth`) | **390 (= `innerWidth`)** |
| `horizontalOverflow` | `false` | **`false`** |
| grid | 672 px = `328px 328px` | 358 px = `358px` (en stolpec) |
| kartica | x384–712 | x16–374 |
| `badgeInsideCard` | `true` | `true` |
| `badgeVisibleInViewport` | `true` | `true` |
| `h2Ellipsized` | `true` | `true` |
| aktivni gumb | `disabled: false`, `Odpri nadzorno ploščo` | `disabled: false`, `Odpri nadzorno ploščo` |
| tipografija | h1 32 px / h2 24 px | h1 24 px / h2 20 px |
| legenda | vidna | vidna |

F1 je pri dolgem imenu izmeril `x16–550 (534)` v 390 px oknu in `badgeVisibleInViewport: false`; po F2.0 je `x16–374` in značka znotraj kartice.

**Mobilni meni (#4):** statični prikaz odprtega `SheetContent` (`w-72` = 288 px) z `OrgSwitcher` in odprtim seznamom 3 workspaceov: `sheet x0–288`, `trigger x16–271`, `list x16–271`, `optionCount: 3`, `listInsideSheet: true`, `switcherVisibleInViewport: true`, `horizontalOverflow: false`.

Posnetki: `desktop-board.png`, `mobile-390-board.png`, `desktop-real-redirect.png`, `mobile-390-real-redirect.png`, `mobile-390-menu-switcher.png`.

---

## 4. Sprejemne zahteve — matrika

| Sprejemni kriterij (`docs/F1-ZAKLJUCNI-PREGLED.md` §F2.0) | Status | Dokaz |
|---|---|---|
| `npx vitest run` → **0 padcev** | ❌ **NI izpolnjen** | 1 že obstoječ padec `deposit-rules-79.test.ts`; mandat prepoveduje popravek `appointments.ts` in testa. Noben nov padec. |
| anonimni `/workspaces` → **307** | ✅ | HTTP sonda + `realPath = /login?callbackUrl=%2Fworkspaces` v Playwrightu na obeh širinah; stran ima tudi avtoritativni `auth()` guard. |
| prijavljen uporabnik z 2+ članstvi se iz table lahko vrže v aktivni workspace | ⚠️ **delno** | Koda + strukturni testi + DOM (`disabled: false`, `router.push("/dashboard")`, brez DB zapisa). **Živ avtenticiran prehod ni izvedljiv** — lokalna baza ni migrirana (glej §6.2). |
| 390 px brez `scrollWidth > innerWidth` pri dolgem imenu | ✅ | `390 === 390`, `horizontalOverflow: false`, značka znotraj kartice. |
| celoten test suite + TypeScript + lint + vizualni pregled namizja in telefona | ✅ | §2 in §3. |

**Sklep: F2.0 ni v celoti podpisan.** Implementacija je končana, dva kriterija pa ostaneta odprta iz razlogov, ki niso v moji pristojnosti (eksplicitni mandat / nemigrirana baza). V skladu z `F2.0 je končan šele, ko so vse njegove sprejemne zahteve preverjene` to poročilo ne razglaša zaključka.

---

## 5. Zavestna odstopanja od predloga F1

* **`requireRole()` ostane globalen** (F1 §F2.0 točka 4 ga je predlagala prevezati na `OrganizationMember.role`). Mandat F2.0 pravi *„Odpravi samo dokazano napačne dostope ali napačne kontekste. Ne poruši upravičenih dostopov."* Napačen dostop prek `requireRole()` ni bil dokazan; org-scoped `requirePermission*` / `getEffectivePermissions(userId, org.id)` so že avtoritativni varuhi akcij. Sprememba bi lahko podrla upravičene legacy dostope. Ostaja dokumentiran dolg za F2.1.
* **ACTIVE filter ni vstavljen v `getMembershipsForUser()`** (F1 točka 6), temveč je dodan ločen `getActiveMembershipsForUser()`. Razlog: `organization-switch.ts` uporablja `getMembershipsForUser()` kot dokaz članstva in ločeno preverja `status === "ACTIVE"`, `tests/memberships-100a.test.ts` pa ta klic eksplicitno zagotavlja. Aktivni kontekst (`resolveActiveOrganizationId`, layout, picker) zdaj uporablja filtrirano različico.
* **`isDefault` se ne sinhronizira** (F1 točka 5 je ponujala dve možnosti). Izbrana je (b): preimenovanje/razlaga oznak, ker je `isDefault` rezerva, `User.organizationId` + JWT pa zadnji uporabljeni prostor. Zlitje bi bilo zavajajoče.
* **`deposit-rules-79` ni usklajen** (F1 točka 7), ker mandat izrecno prepoveduje spreminjanje obeh vpletenih datotek.

---

## 6. Vse še odprte težave

1. **Padajoč `tests/deposit-rules-79.test.ts`** — edini padec celotne suite. Vzrok dokazan, a obe datoteki sta po mandatu nedotakljivi. Posledica: sprejemni kriterij „0 padcev" ni dosegljiv. Zahteva dogovor z lastnikom diff-a `appointments.ts` (vrnitev večvrstičnega pogoja ali zamenjava krhke regex-trditve z vedenjskim testom).
2. **Lokalna `markec_dev` baza ni migrirana** — ni tabel `User` / `Organization` / `OrganizationMember`, zato `/api/auth/session` vrača 500 in `ClientFetchError` v dev konzoli. Avtenticirana tabla z 2+ članstvi, preklop v obe smeri in matrika vlog **v živo niso preverljivi**. Vizualni pregled je zato narejen na reprezentativnih karticah z resničnim CSS; mobilni Sheet je statični prikaz, ne živ Radix/React render. Rdeči „1 Issue" znački na posnetkih sta Next.js dev overlay za ta isti 500, ne napaka v vmesniku.
3. **Brez vedenjskega testa za `getResolvedOrg()` → `null`** pri prijavljenem ADMIN/STAFF z nerazrešenim org. Obstajajo le strukturne trditve. Potreben je integracijski test z migrirano bazo; javne anonimne poti so medtem preverjene (200).
4. **Agresivno krajšanje imena na aktivni kartici (namizje).** 133 px široka značka `Zadnji uporabljeni` pusti `h2` le 77 px, zato se dolgo ime skrči na `Vulk...`. Polno ime je na voljo prek `title` tooltipa; overflowa ni, a berljivost je slabša. Predlog: v F2.1 premakniti značko v `flex-wrap` vrstico z vlogo ali skrajšati njen tekst.
5. **4 pre-existing lint warningi** v `src/components/onboarding/start-wizard.tsx` (`SKD_AREAS`, `SKD_MODULE_LABELS`, `SKD_SECTIONS`, `normalizeHr`) — izven obsega F2.0, nedotaknjeni.
6. **`/workspaces/` → 308 → `/workspaces` → 307** (Next kanonizacija končne poševnice). Deluje, a vredno je preveriti ujemanje `matcher` v `proxy.ts` na produkciji.
7. **`requireRole()` še vedno temelji na globalnem JWT `role`** — namerno ohranjeno (§5), a ostaja tehnični dolg, ki ga je treba potrditi z matriko vlog na migrirani bazi.
8. **`isDefault` rezerva še vedno ni uporabniško nastavljiva** — F2.0 jo je le semantično ločil; upravljanje je predvideno v F2.2.

---

## 7. Predlog F2.1 (šele po zgornjem poročilu odprtih težav)

**Predpogoj (blokira vse ostalo):** migrirana in seedana **testna** baza (ne produkcijska) z `ADMIN` (2 članstvi), `STAFF` (2 članstvi z različnima vlogama per org) in `CLIENTE`. Brez tega noben „živ" kriterij ni preverljiv in F2.0 ostaja v statusu iz §4.

1. **Enoten, fail-closed razreševalnik organizacije:** po backfillu članstev odstraniti še preostale (zdaj strogo pogojene) `findFirst(first ACTIVE)` fallbacke in uvesti en `requireSessionOrg()`, ki zahteva sejo, razrešuje izključno iz lastnih ACTIVE članstev in brez članstva vrže `UnauthorizedError`. Uskladiti `getSessionOrg`, `resolveSessionOrg`, `requireAdminOrg`, `getResolvedOrg`.
2. **Integracijski testi izolacije:** ADMIN v org-A ne sme razrešiti org-B; začasno ustavljen org ni razrešljiv; podpisan `x-org-slug` ne sme preglasiti seje na dashboardu; vedenjski test za `getResolvedOrg() === null` (odprta težava #3).
3. **Zaključek F2.0 v živo:** na seedanih uporabnikih izvesti prijavo → tablo z 2 workspaceoma → vstop v aktivni → preklop v obe smeri → preveriti, da se dashboard/nastavitve/moduli spremenijo; vizualna regresija 390 / 768 / 1440 z dolgim imenom (odprti težavi #2, #4).
4. **Razrešiti konflikt `deposit-rules-79`** z lastnikom diff-a in zamenjati krhke regex-nad-izvorom trditve z vedenjskimi, kjer je mogoče — s tem pade zadnji padec suite in se izpolni sprejemni kriterij.
5. **Matrika vlog × preklop × pravice**, vključno z odločitvijo o `requireRole()` (odprta težava #7), šele na podlagi dokazanih dostopov.

Šele po F2.1 sledita F2.2 (upravljanje workspaceov, člani, povabila, `Staff.userId @unique`) in F2.5 (produkcijska resnica: commit + push + Vercel deploy status + preverjanje na živi domeni). **Lokalen uspeh ni sprejemni kriterij** — v skladu z `github je resnica`.

---

## 8. Kaj je bilo in kaj ni bilo narejeno

**Narejeno:** 6 zahtev v 9 datotekah, nov regresijski test (24/24), to poročilo, celoten test suite, TypeScript, lint, HTTP sonde, hash primerjava, vizualni pregled namizja / 390 px telefona / mobilnega menija.

**Ni narejeno (po mandatu):** noben `git add` / `commit` / `push`, nobena migracija (lokalna ali produkcijska), noben poseg v `appointments.ts`, `deposit-rules-79.test.ts`, `docs/F1-PREGLED.md` ali druge nekomitirane spremembe drugih agentov, nobena sprememba obstoječih testov. Vsi začasni harnessi, logi in posnetki so v `%TEMP%`, izven repozitorija.
