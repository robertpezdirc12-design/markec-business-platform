# F1 — Zaključni pregled (neodvisna poglobljena revizija) in predlog F2

**Datum:** 2026-11-08
**Mandat:** pred začetkom F2 izvesti zaključni pregled F1 (shramba zadnjega workspacea, preklop za vse dovoljene vloge, strežniška zaščita pred tujim workspaceom, vizualni pregled vstopne table na namizju in telefonu, preiskava padajočega `deposit-rules-79.test.ts`), pripraviti poročilo in predlagati F2.
**Meje (strogo upoštevano):** brez posegov v kodo, brez pushanja, brez produkcijskih migracij, brez dotikanja nedokončanih sprememb drugih agentov, brez spreminjanja testa pred dokazanim vzrokom.

---

## Executive summary (EN)

F1 is **functionally close but not release-ready**. The last-used workspace is persisted and restored correctly, and the switch action is genuinely membership-bound and fail-closed. However, five issues block a clean sign-off: (1) the active workspace card's button is disabled, so a user redirected to `/workspaces` after login cannot enter their *current* workspace at all; (2) long workspace names break the card header on desktop and cause horizontal overflow on a 390 px phone; (3) the header switcher is `ADMIN`-only and the mobile sidebar has no switcher; (4) an anonymous `/workspaces` returns `200` while `/dashboard` returns `307` to login, and several legacy "first ACTIVE org" fallbacks plus a global `requireRole()` remain; (5) a brittle whitespace-sensitive source test fails because of an uncommitted one-line reformat in another agent's diff — the deposit/commission logic itself is intact. No code, test, migration or push was performed.

---

## 0. Stanje repozitorija ob pregledu

```
branch main | ahead/behind 0 0 | HEAD 1659d42
```

Nekomitirane spremembe (vse **nedotaknjene**): F1 datoteke (`workspaces/`, `actions/workspaces.ts`, `workspace-picker.tsx`, `vertical-label.ts`, dva nova testa, štirje docs), F0 varnostne spremembe (`guards.ts`, `permissions/effective.ts`, `appointments.ts`, `users.ts`, `header.tsx`, `layout.tsx`), booking-flow delo drugih agentov ter `docs/F1-PREGLED.md` (poročilo drugega agenta).

`docs/F1-PREGLED.md` sem prebral **read-only** in ga nisom spreminjal. To poročilo je ločena, neodvisna revizija; v razdelku 7 je navedeno, kaj je v njej izostalo.

**Okoljska omejitev:** lokalna `markec_dev` baza ni migrirana (samo `_prisma_migrations`, brez `User` / `Organization` / `OrganizationMember`). Zato avtentične prijave in prikaza table z 2+ članstvoma v živo ni bilo mogoče izvesti. Vizualni pregled kartic je zato narejen z reprezentativnimi karticami, vstavljenimi v **resnično CSS okolje žive strani** `/workspaces` (Playwright, dev server `:3000`). To je eksplicitno navedeno pri vsakem sklepu.

---

## 1. Shramba in prikaz zadnjega uporabljenega workspacea — ✅ jedro / 🔴 funkcionalni defekt

### Veriga (preverjena v kodi)

| Korak | Vir | Kaj se zgodi |
|---|---|---|
| Preklop | `src/app/actions/organization-switch.ts:26-48` | preveri lastno članstvo + `status === "ACTIVE"`, zapiše `User.organizationId`, osveži JWT z `unstable_update({ user: { organizationId } })` |
| Naslednja prijava | `src/lib/auth/auth.ts` (`authorize`) | vrne `user.organizationId` iz DB → JWT ga prevzame |
| Razrešitev | `src/lib/auth/memberships.ts:59-67` | `resolveActiveOrganizationId()` → M2 dvojno branje: session org, če je med članstvi, sicer `isDefault`, sicer prvi |
| Prikaz | `src/app/actions/workspaces.ts:59-94` | `isActive: m.organization.id === activeOrgId` → značka `Aktiven` |
| UI | `src/components/admin/workspace-picker.tsx:93` | `Badge variant="success"` → `Aktiven` |

**Sklep:** zadnji workspace se shrani v `User.organizationId` + JWT in se obnovi ob prijavi. ✅

### Ugotovljene pomanjkljivosti

**🔴 P0 — Aktivna kartica je slepa ulica.** `workspace-picker.tsx:62` in `:103-114`:

```tsx
const disabled = isPending || ws.isActive
...
<Button disabled={disabled} onClick={() => enter(ws.id)}>
  {ws.isActive ? "Odpri nadzorno ploščo" : "Vstopi"}
</Button>
```

Gumb na aktivni kartici je **onemogočen**, čeprav piše „Odpri nadzorno ploščo". Ker `login-form.tsx:95-97` uporabnika z 2+ članstvoma po prijavi preusmeri ravno na `/workspaces`, uporabnik, ki želi ostati v **trenutnem** workspaceu, s te table **ne more nikamor** — nima klikabilne poti do `/dashboard`. Lahko le preklopi na *drug* workspace. To je funkcionalni bloker vstopnega toka, ne kozmetika.

**🟡 `isDefault` se ne sinhronizira.** `OrganizationMember.isDefault` se postavi ob onboardingu (`onboarding.ts`) in se pri preklopu ne spreminja. Kartica A lahko prikazuje „Privzeti prostor", kartica B pa „Aktiven" — dva različna pojma brez razlage. Poleg tega `normalizeActiveMembership()` ob izgubi veljavnega session org vedno pade na `isDefault`, tj. na *stari* privzeti prostor, ne na zadnjega uporabljenega.

**🟡 Asimetrija filtra ACTIVE.** `getMembershipsForUser()` (`memberships.ts:45-49`) filtrira samo `where: { userId }`, medtem ko `getWorkspacePicker()`, `getActiveWorkspaceCount()` in `(admin)/layout.tsx` filtrirajo `organization: { status: "ACTIVE" }`. Posledica: `resolveActiveOrganizationId()` lahko kot „aktiven" vrne **začasno ustavljen** org; tabla (ki prikaže samo ACTIVE) tedaj nima nobene `Aktiven` kartice, `getSessionOrg()` pa še vedno razreši suspendirani org. Preklop sam se nato korektno zavrne z „To podjetje ni aktivno." (`organization-switch.ts:37-39`).

---

## 2. Preklapljanje za vse dovoljene vloge — ✅ delno / 🟡 nedoslednosti

Vloge v shemi (`prisma/schema.prisma:372-375`): `ADMIN`, `STAFF`, `CLIENTE`.

**Role-agnostično (✅):**
- `login-form.tsx:95-97` — preusmeritev temelji na `getActiveWorkspaceCount() > 1`, ne na vlogi.
- `src/app/(admin)/workspaces/page.tsx` — brez vlogovnega gate-a.
- `switchActiveOrganization()` — brez vlogovnega gate-a; edini pogoj je lastno članstvo.
- `sidebar.tsx:250` — `switcher = organizations && organizations.length > 1`, brez vloge.

**🟡 Header je `ADMIN`-only.** `header.tsx:53,147-152`: „Zamenjaj poslovni prostor" je znotraj `{isAdmin && ...}`, kjer je `isAdmin = userRole === "ADMIN"` iz **globalnega JWT-ja**. `STAFF` z 2+ članstvi do table pride samo ob prijavi, ne iz menija.

**🟡 Mobilni sidebar nima preklopnika.** `sidebar.tsx:252` je `<aside className="hidden ... lg:block">`; `MobileSidebar` (`:290-316`) renderira samo `<SidebarNav />`, brez `OrgSwitcher`. Na telefonu torej **ni nobenega preklopnika**, če uporabnik ni ravno na `/workspaces`.

**🟡 Chrome še vedno uporablja globalno vlogo.** `(admin)/layout.tsx:57` pošilja `isAdmin: session?.user?.role === "ADMIN"` v `PermissionsProvider`, `guards.ts:32-40` pa `requireRole()` preverja `session.user.role` (globalni JWT), ne `OrganizationMember.role` razrešenega org-a. Org-scoped pot (`requirePermission*`, `getEffectivePermissions(userId, org.id)`) je že pravilna — a dva vzporedna vira resnice ostajata.

**🟡 Testna vrzel.** `tests/workspaces-f1.test.ts:51-55` preverja le, da header **vsebuje niz** `"/workspaces"` in „Zamenjaj poslovni prostor". Test je zelen tudi z `{isAdmin && ...}` — ne ščiti zahteve „za vse dovoljene vloge".

**❓ Odprto vprašanje za F2:** ali je `CLIENTE` z več članstvi „dovoljena vloga" za administracijski šel? `(admin)/layout.tsx` nima vlogovnega gate-a, zato tak uporabnik po prijavi prejme administratorsko navigacijo. Potrebna je eksplicitna odločitev (dovoliti / preusmeriti na `/my-account`).

---

## 3. Strežniška zaščita pred neposrednim dostopom do tujega workspacea — ✅ jedro / 🟡 robovi

**Kar je varno (preverjeno):**

1. `switchActiveOrganization()` — `memberships.find(m => m.organizationId === id)`; tuji org vrže **enak**, neizdaten odgovor „Podjetje ni na voljo na tem računu." (brez probing-a). Dodaten `org.status !== "ACTIVE"` → zavrnitev. ✅
2. `getWorkspacePicker()` / `getActiveWorkspaceCount()` — `where: { userId, organization: { status: "ACTIVE" } }`, tj. samo lastna aktivna članstva; neprijavljen → `[]` / `0`. ✅
3. `getEffectivePermissions(userId, organizationId)` (`permissions/effective.ts:35-88`) — `OrganizationMember.role` + `customRoleId` sta per-org; brez članstva se globalna vloga dodeli **samo** ob dokazani pripadnosti (`User.organizationId === organizationId` ali aktiven `Staff` v tem org-u), sicer `return []` — fail-closed. ✅
4. `getTrustedOrgSlug()` (`tenant.ts:39-45`) — `x-org-slug` je HMAC-vezan prek `verifyOrgSlug`; `getResolvedOrg()` ne pade na session/default org pod neznanim `/s/*` slug-om ali pod preverjeno, a neaktivno domeno. ✅
5. Neprijavljen `/workspaces` ne razkrije podatkov (prazno stanje, preklop fail-closed).

**Robovi, ki ostajajo (🟡 → F2):**

| # | Mesto | Tveganje |
|---|---|---|
| a | `proxy.ts:575-577` | `/workspaces` ni med `isAdminDashboard` / `isStaffPortal` / `isClientArea`. Empirično: neprijavljen `/workspaces` → **200** (admin šel + prazno stanje), `/dashboard` → **307** `/login?callbackUrl=%2Fdashboard`. Ni uhajanja podatkov, a je neskladno z vzorcem appa. |
| b | `tenant.ts:184-189`, `:205-208`, `:267-270`; `guards.ts:152-157` | Štirje `prisma.organization.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } })` fallback-i. Globalni `ADMIN` brez `organizationId` / brez članstva dobi **prvo ACTIVE podjetje** kot svoj org kontekst — tudi `requireAdminOrg()` (`:197-210`). `getEffectivePermissions` sicer pravice zavrne, a razrešeni org (terminologija, `SalonConfig`, cilj akcij) je lahko tuji. |
| c | `guards.ts:32-40` | `requireRole()` še vedno globalni `session.user.role`. |
| d | `memberships.ts:45-49` | Brez ACTIVE filtra (glej razdelek 1). |

**Sklep:** jedro izolacije je **pravilno in fail-closed**; preostala tveganja so v *legacy* poteh, ne v F1 sami. Vseeno jih je treba zapreti pred F2, ker F2 gradi na istem razreševalniku.

---

## 4. Vizualni pregled vstopne table (namizje + telefon)

**Metoda:** Playwright 1.64.1 proti živemu dev serverju `http://localhost:3000/workspaces` (resnični CSS strani). Ker baza ni migrirana, so bile v prazno stanje vstavljene reprezentativne kartice z **enakim markupom/kot je v `workspace-picker.tsx`**. Meritve `getBoundingClientRect()`. Harnessi so izven repozitorija v `%TEMP%/f1-*.cjs`; posnetka `f1-workspaces-desktop.png`, `f1-workspaces-mobile.png`.

| Primer | `innerWidth` | Kartica | Značka „Aktiven" | Rezultat |
|---|---|---|---|---|
| Namizje 1440 / kratko ime | 1440 | x512–840 (328) | x747–815 | ✅ znotraj kartice |
| Namizje 1440 / dolgo ime | 1440 | x512–840 (328) | **x1022–1090** | 🔴 `badgeInsideCard: false`, značka 250 px izven kartice |
| Telefon 390 / kratko ime | 390 | x16–374 (358) | x281–349 | ✅ brez overflowa |
| Telefon 390 / dolgo ime | 390 | **x16–550 (534)** | **x457–525** | 🔴 `badgeVisibleInViewport: false`, `gridCols: 533.828px` |

Dolgo ime: `Vulkanizer & avtoservis Murn d.o.o.` — povsem običajno slovensko podjetje, ne ekstremni testni primer.

**Vzrok:** `workspace-picker.tsx:74` je `flex items-start justify-between gap-3`, notranji `:75` pa `flex items-center gap-3` **brez `min-w-0`**. `min-w-0` na `:84` je pregloboko — nahaja se na `flex-col`, ki je že znotraj flex predmeta, ki se ne sme skrčiti. Zato `h2.truncate` ne deluje (`h2ScrollWidth === h2ClientWidth === 417` namizje / 348 telefon, `h2Ellipsized: false`) in grid se na mobilnem razširi na ~534 px.

**Nepospremenjeno prazno stanje:** na obeh velikostih brez horizontalnega overflowa, `h1`, podnaslov, sidebar/header in hamburger se prikažejo pravilno. ✅

**Console:** `500 /api/auth/session` + `ClientFetchError: Unexpected token '<'` — posledica nemigrirane dev baze (ni tabele `User`), **ne F1 napaka**. Enako velja za občasno hidracijsko opozorilo ob vstavljanju fixture-jev.

**Omejitev:** avtentična tabla z 2+ članstvoma v živo ni bila vizualno preverjena; za to je potrebna migrirana + seedana baza. To je prvi korak F2-verifikacije, ne razlog za odobritev F1.

---

## 5. Preiskava `deposit-rules-79.test.ts` — dejanski vzrok dokazan

**Ukaz:** `npx vitest run tests/deposit-rules-79.test.ts` → `1 failed | 37 passed (38)`, padec na `tests/deposit-rules-79.test.ts:300-302`. (Celoten suite v prejšnjem krogu: `1 failed | 1120 passed (1121)`.)

Padajoča trditev:

```js
expect(src).toMatch(
  /status === "COMPLETED" &&\s*\n\s*appointmentDetails\.commissionAmount === null/
)
```

zahteva **dobesedno novo vrstico** med `&&` in `appointmentDetails`.

**Dokazi (HEAD vs delovna kopija):**

| Preverjanje | Rezultat |
|---|---|
| HEAD `git show HEAD:src/app/actions/appointments.ts:1577-1580` | večvrstični `if (` / `status === "COMPLETED" &&` / `appointmentDetails.commissionAmount === null` |
| Delovna kopija `:1600` | `if (status === "COMPLETED" && appointmentDetails.commissionAmount === null) {` |
| Regex na HEAD | **true** |
| Regex na delovni kopiji | **false** |
| CRLF (delovna / HEAD) | **0 / 0** → zaključki vrstic niso vzrok |
| Druga trditev `commissionAmount: commissionFreeze ?? 0` (`:303`) | **pass** |
| Logika v delovni kopiji (`:1629-1631`) | `...(status === "COMPLETED" && appointmentDetails.commissionAmount === null ? { commissionAmount: commissionFreeze ?? 0 } : {})` — **intaktna** |
| `git diff -U2` hunk `@@ -1575,8 +1598,5 @@` | prikazuje izključno zamenjavo 3 vrstic z 1, znotraj večjega **nekomitiranega diff-a drugega agenta** (F0 perms + booking-flow), ne F1 |

**Dejanski vzrok:** krhka **strukturna trditev, odvisna od presledkov**, ki preverja *obliko izvorne kode* namesto *vedenja*, v kombinaciji z nekomitanim enovrstičnim reformatom v tujem diff-u. **Ni napaka v logiki pologa/provizije** — provizija se še vedno zapiše enkrat, samo kadar je `commissionAmount === null`, izračunana iz pravila zaposlenega.

**Test ni bil spremenjen.** Priporočena rešitev (šele z odobritvijo lastnika diff-a): trditev narediti neodvisno od vrstic, npr. dovoliti `\s*` namesto obveznega `\n`, ali bolje — preverjati vedenje prek čiste funkcije namesto regex-a nad izvorno kodo. Ker je reformat del nedokončanega dela drugega agenta, naj uskladitev opravi njegov lastnik ali naj se izvede kot del F2 z izrecnim dovoljenjem.

---

## 6. Kaj je `docs/F1-PREGLED.md` izpustil

Poročilo drugega agenta je pravilno za osnovno verigo, a je izpustilo naslednje, v tem pregledu dokazane ugotovitve:

1. **Aktivna kartica je onemogočena** → po prijavi ni poti v trenutni workspace (najresnejši F1 defekt).
2. **Overflow kartic pri dolgih imenih** na namizju in telefonu (izmerjeno, ne le opisano).
3. **Mobilni sidebar brez `OrgSwitcher`** (zgolj „sidebar switcher je viden STAFF" ne drži za <1024 px).
4. **`getMembershipsForUser()` brez ACTIVE filtra** → asimetrija z vsemi drugimi resolverji.
5. **Legacy `findFirst(first ACTIVE)` fallback-i** v `tenant.ts` / `guards.ts` / `requireAdminOrg()` in globalni `requireRole()` — poročilo navaja „x-org-slug je pri adminu ignoriran", ne obravnava pa teh štirih poti.
6. **Testna vrzel** v `workspaces-f1.test.ts` (preverja niz, ne vlogovnega gate-a).

---

## 7. Sklepna ocena F1

**F1 NI pripravljena za zaključek brez popravkov.** Jedro (persistenca, članstveno vezan preklop, org-scoped pravice) je dobro; uporabniški vstopni tok in vizualna robustnost pa imata blokerja.

| Prioriteta | Ugotovitev | Mesto |
|---|---|---|
| **P0** | Aktivna kartica `disabled` → slepa ulica po prijavi | `workspace-picker.tsx:62,107` |
| **P0** | Dolga imena razbijejo kartico / overflow na 390 px | `workspace-picker.tsx:74-93` |
| **P1** | `/workspaces` brez auth redirecta (200 vs 307) | `proxy.ts`, `(admin)/layout.tsx` |
| **P1** | Header `ADMIN`-only, mobilni sidebar brez preklopnika | `header.tsx:147`, `sidebar.tsx:290` |
| **P1** | Legacy first-ACTIVE fallback-i + globalni `requireRole()` | `tenant.ts`, `guards.ts` |
| **P2** | `isDefault` se ne sinhronizira / dve oznaki | `organization-switch.ts`, picker |
| **P2** | ACTIVE asimetrija v `getMembershipsForUser()` | `memberships.ts:45` |
| **P2** | Krhki whitespace test | `tests/deposit-rules-79.test.ts:301` |
| **P2** | Testna vrzel za vloge | `tests/workspaces-f1.test.ts:51` |

---

## 8. Predlog F2

Vrstni red je zavestno: **najprej zapri F1, šele nato gradi**. Utemeljitev: F2 gradi na istem `resolveActiveOrganizationId` / `getSessionOrg`, zato bi gradnja na P0/P1 defectih podvojila napake v vseh modulih.

### F2.0 — Zaključek F1 (obvezno pred vsem drugim)

1. **Aktivna kartica**: `ws.isActive` naj ne onemogoča gumba — naj `enter(ws.id)` za aktivni org takoj `router.push("/dashboard")` (ali naj gumb kliče isti action, ki je idempotenten). Dodati strukturni test, da aktiven gumb ni `disabled`.
2. **CSS**: `min-w-0` na zunanji flex predmet (`:75`), `shrink-0` na znački, `break-words`/`truncate` navzven; grid `min-w-0` in `minmax(0,1fr)`. Regresijski vizualni test pri 390 px z dolgim imenom.
3. **Auth**: `redirect("/login?callbackUrl=%2Fworkspaces")` za neprijavljene (na strani ali v `(admin)/layout.tsx`); uskladiti s `proxy.ts`.
4. **Vloge**: header vnos pogojevati na število aktivnih članstev (ne na `isAdmin`); dodati `OrgSwitcher` v `MobileSidebar`; `PermissionsProvider.isAdmin` in `requireRole()` prevezati na `OrganizationMember.role` aktivnega org-a.
5. **Semantika**: odločiti se med (a) sinhronizacijo `isDefault` ob preklopu ali (b) preimenovanjem oznake v „Nazadnje uporabljeno"; oboje hkrati je zavajajoče.
6. **Enoten ACTIVE filter** v `getMembershipsForUser()`.
7. **Test `deposit-rules-79`** uskladiti z lastnikom diff-a (neodvisno od presledkov).

**Sprejemni kriterij F2.0:** `npx vitest run` → 0 padcev; anonimni `/workspaces` → 307; prijavljen uporabnik z 2+ članstvi se iz table lahko vrže v aktivni workspace; 390 px brez `document.documentElement.scrollWidth > innerWidth` pri dolgem imenu.

### F2.1 — Enoten, fail-closed razreševalnik organizacije

Odstraniti štiri `findFirst(first ACTIVE)` fallback-e; uvesti en `requireSessionOrg()` ki: (1) zahteva sejo, (2) razreši izključno iz lastnih **ACTIVE** članstev, (3) brez članstva vrže `UnauthorizedError` (ne „prvo podjetje"). Uskladiti `getSessionOrg`, `resolveSessionOrg`, `requireAdminOrg`, `getResolvedOrg`. Dodati integracijske teste: `ADMIN` v org-A ne sme razrešiti org-B; začasno ustavljen org ni razrešljiv; podpisani `x-org-slug` ne sme preglasiti seje na dashboardu.

### F2.2 — Upravljanje workspaceov (po `docs/WORKSPACE-ARHITEKTURA.md`)

Dodajanje novega workspacea iz obstoječega računa, seznam članov, povabila, zapuščanje, nastavitev privzetega. Vsaka akcija: članstveni gate + org-scoped dovoljenje + audit. `Staff.userId @unique` (že identificirano v `WORKSPACE-ANALIZA.md`) je treba razrešiti, preden lahko en zaposleni dela v dveh podjetjih.

### F2.3 — Per-workspace chrome in moduli

`moduleStates` / `modulesForVertical` že obstajata. Razširiti na: sidebar/navigacija glede na aktivne module izbranega org-a, terminologija in `SalonConfig` strogo vezana na `org.id`, javna objava (`publishState`) per workspace. Cilj produkcijske vizije: podjetnik z uporabniškim imenom + geslom → vodena postavitev z izbiro modulov → predogled → objava → izolirana stran.

### F2.4 — Testi in podatki

Migrirana + seedana **testna** baza z `ADMIN` (2 članstvi), `STAFF` (2 članstvi, različni vlogi per org) in `CLIENTE`. Matrika vlog × preklop × pravice; izolacijski testi, da podatki org-A ne pridejo v org-B; vizualna regresija 390/768/1440; nadomestiti krhke regex-nad-izvorom teste z vedenjskimi, kjer je mogoče.

### F2.5 — Produkcijska resnica (v skladu z zahtevo „GitHub je resnica")

Šele po F2.0–F2.4: commit + push na `main`, preveriti Vercel deploy status prek GitHub commit statuses, na **živi** domeni prijaviti seedanega uporabnika z 2 workspaceoma, izvesti preklop v obe smeri, preveriti, da se dashboard/nastavitve/moduli spremenijo, in potrditi, da javna stran vsakega tenant-a ostane nedotaknjena. Lokalen uspeh ni sprejemni kriterij.

---

## 9. Kaj je bilo in kaj ni bilo narejeno

**Narejeno:** pregled kode in diff-ov, porovnava HEAD ↔ delovna kopija, izoliran test, HTTP sonde (`/workspaces` 200, `/dashboard` 307), Playwright geometrija na 1440 in 390 px, primerjava z obstoječim poročilom, to poročilo + predlog F2.

**Ni narejeno (po mandatu):** nobena sprememba izvorne kode ali testov, noben popravek `docs/F1-PREGLED.md`, noben `git add/commit/push`, nobena migracija (lokalna ali produkcijska), noben poseg v nekomitirane spremembe drugih agentov. Vsi začasni harnessi in posnetki so izven repozitorija (`%TEMP%`).

**Edina nova datoteka v repozitoriju:** `docs/F1-ZAKLJUCNI-PREGLED.md` (to poročilo).
