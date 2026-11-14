# F5.0.2 — ZAKLJUČNI PREGLED: Integracijska stabilizacija pred F5.1

**Datum:** končna revizija po stabilizaciji.
**Mandat:** stabiliziraj obstoječo integracijo pred F5.1 — uredi `User.staff/staffs`, register profilov, ikone, schema-type, brskalniško verifikacijo; brez novih funkcij, produkcijskih migracij, commita in pusha. Vsako preverjanje = **PASS / FAIL / NOT VERIFIED** + dejanski rezultat.

---

## A. Prisma `User.staff` / `staffs` — **PASS**

**Shema + generirani klient:** potrjeno, da `User` uporablja **`staffs Staff[]`** (množina, F2.3.1 — uporabnik je lahko zaposlen v več org, `@@unique([userId, organizationId])`); enojnega `staff` relacije ni več.

**Popravljene neusklajene reference (vse na nespremenjeno poslovno logiko):**
| Datoteka | Popravek |
|----------|----------|
| `src/lib/permissions/effective.ts` | legacy član brez `OrganizationMember` — pripadnost org dokazana z `user.staffs.some(s => s.organizationId === organizationId && s.isActive)` (bivši enojni `user.staff`) |
| `src/lib/permissions/guard-rules.ts` | `MemberTargetInfo.staffs: array` + `targetBelongsToOrg` preko `staffs.some(...)` |
| `src/app/actions/users.ts` | `getUserById`, `updateUserRole`, `adminSetUserPassword`, `deleteUser` — vse `staff`→`staffs`; ustvarjanje staff profila in brisanje **org-scoped** (samo Staff zapis tega org) |
| `src/app/actions/onboarding.ts` | nested-create `staffs: { create }`, `include: { staffs }`, `staffs[0]?.id` |
| `src/app/(admin)/dashboard/users/[id]/page.tsx` | prikaz staff profila trenutne org (`user.staffs[0]`) |

**Org-isolation testi (F2.1, `markec_f21_test`):** ponovljeni — **33/33 PASS** (vključno prejšnji 4 neuspehi: CLIENTE javna veja, `getEffectivePermissions` tujega admina, `updateUserRole`, STAFF v tujem orgu). 
**Dovoljenja in povezave zaposlenih:** nespremenjene — logika "pripadnost org = aktivni Staff zapis v tistem orgu" je ohranjena (samo enojni→množina). 33 F2.1 + 131 stabilizacijskih + 1200 enotnih testov zelenih.

---

## B. Register profilov — **PASS**

- Dejansko število **34 profilov** iz centralnega registra (`listProfileOptions().length = 34`).
- **Neusklajena testa** `platform-landing` (»12 registered profiles«) in `entry-checkout` (»`toBe(12)`«) **posodobljena, da izpeljeta iz registra** (`TOTAL = ids.length`), brez brisanja preverjanj:
  - ohranjeno: točno 5 primerov, brez `generic`, pravilo sl/en enak set, vsak primer → dejanski profil + obstoječa slika, caption izraža podatek;
  - dodano: skd-* sekcij (A–V) jih je 22; caption mora **dinamično odražati dejansko število** (futur-proof).
- **Ostale striktne preverbe obdržane** — nisem odstranil nobenega varovala.

---

## C. Ikone za 22 `skd-*` profilov — **PASS**

- `src/lib/profiles/profile-icons.ts` dobi **eksplicitno ikono za vseh 22 SKD sekcij A–V** (Sprout, Pickaxe, Factory, Zap, …, Globe) — brez spreminjanja poslovne logike profilov (capability/terminologija/forme/workflowi nedotaknjeni).
- `profile-icons.test.ts` (prejšnji »missing icon for skd-a-agriculture«) — **PASS** (vseh 22 pokritih).
- Varen fallback na `LayoutGrid` ostaja za neznane id-je.

---

## D. Schema-type testi — **PASS**

- `tests/seo/schema-type-e36.test.ts` `EXPECTED` mapa dopolnjena za **vseh 22 `skd-*`** z njihovimi `schemaType` iz registra (Farm, Industrial, Manufacturing, Utility, …, LocalBusiness).
- **Stroga validacija ohranjena:** linearni test »covers every profile« (`Object.keys(PROFILES) === Object.keys(EXPECTED)`) zdaj velja za 34 profilov — **noben novi profil ne sme tiho uiti**.
- `schemaTypeForVertical` se opira na `getProfile(id).schemaType` (en vir resnice) — skd-* profili imajo pravilne tipe.

---

## E. Brskalniška verifikacija — **NOT VERIFIED** (varnostna zapora, ni obidena)

- **Vzrok "pnpm run dev exit 1":** dev strežnik (`npx next dev --turbopack`, port 3000) **NE pade** — odgovori **HTTP 200** na `GET /start` z veljavnim SSR HTML (82 KB, vsebuje čarovnik in iskanje dejavnosti). »Exit 1« je bila napaka **brskalniškega orodja** (`view_page`/`open_preview`), ki je skozi **Skales token-proxy** dobil **HTTP 401**.
- **Proxyja nisem obhodil** (mandat: ne odstranjuj varnostnih kontrol); tokena prek orodja ni mogoče predati.
- **Server-side verifikacija:** `/start` → 200 validna SSR stran (čarovnik + dejavnostni imenik prisotni). Logiko toka (subclass → profil → workspace materializacija) preverjajo integracijski testi F5.0/F5.0.1 (18 pass).
- **Interactive click-flow (iskanje→hierarhija→izbira podrazreda→ustvarjanje workspacea):** **NOT VERIFIED** — zahteva brskalnik brez token-proxyja. Če želiš to preveriti, mora biti aplikacija dostopna brez proxyja (npr. localhost brez Skales vstopa) oz. s predanim tokenom.

---

## F. Zaščita dela drugih agentov — **PASS**

- Pred spremembami: `git status` + `git diff` — mapiral lastništvo.
- **Nisem prepisal tujega WIP-a** brez dogovora. Dotaknil sem se samo dokazano potrebnih popravkov:
  - F2.3.1/M2 napake `User.staff→staffs` (skema to že zahteva; ta popravek je razreševanje povezave = dovoljen popravek, ne prepis logike);
  - skd-* ikone + schema-type + register-števec (dovršitev faksade, ki jo je profilna širitev potrebovala);
  - konfig `vitest.integration.config.ts` (f21 suita zožena na f2-1/f2-2, da ne zaide v f23 testne na f21 bazi).
- **Nedotaknjeno:** `src/app/actions/custom-profile.ts`, `src/components/dashboard/custom-profile-builder.tsx` in drugi WIP-ji drugih agentov (imajo pre-existing TS/ESLint napake — §H).

---

## G. Ponovljeni testi in linterji — matrika

| Preverjanje | Rezultat |
|-------------|----------|
| Celotno Vitest (enotna suita) | **1200/1200 PASS (83 datotek)** |
| F2.1 + F2.2 integracija (`vitest.integration.config.ts`) | **58/58 PASS** |
| F2.3 + F5.0.1 integracija (`vitest.f23.config.ts`) | **18/18 PASS** |
| Org-isolation (F2.1) | **33/33 PASS** (prej 4 fail) |
| F5.0 enotni testi (`f50-skd-2025`) | **14/14 PASS** |
| Stabilizacijski (icons/schema/landing/entry/guard/workspace) | **131/131 PASS** |
| TypeScript (`tsc --noEmit`) — moje spremenjene datoteke | **0 napak** |
| ESLint — moje spremenjene datoteke | **0 napak, 0 opozoril** |

---

## H. Odprte / pre-existing težave (niso F5.0.2)

| Težava | Stanje |
|--------|--------|
| `prisma/seed.ts` + `e2e/f0s-media-removed-staff.spec.ts` — `staff.findUnique({ userId })` (stari globalni unikat po F2.3.1) | **pre-existing** (ločen od F5.0.2; seed/e2e še na stari obliki) |
| `src/app/actions/custom-profile.ts` + `custom-profile-builder.tsx` (TS/ESLint napake, `no-explicit-any`, neuporabljene) | **other-agent WIP** — ni v dometu F5.0.2 |
| `start-wizard.tsx` / scraper skripti (`require()`) — ESLint napake | **pre-existing** |
| Brskalniška click-flow verifikacija | **NOT VERIFIED** (proxy) |

> Celotno ESLint na `src tests` vrne 79 problemov (39 err / 40 warn); **vsi so v WIP drugih agentov ali pre-existing** — moje datoteke so čiste (0/0).

---

## Zaključek

**PASS.** Vseh 9 prejšnjih neuspehov je odpravljeno: `User.staff→staffs` (4 F2.1 integracijskih) + register-števec/ikone/schema-type (5 enotnih). Ponovljen: **1200 enotnih + 58 (f21/f22) + 18 (f23) integracijskih = 1276 testov zelenih**; tsc in ESLint na spremenjenih datotekah čista; logika dovoljenj in povezav zaposlenih nespremenjena. Edina **NOT VERIFIED** je brskalniška click-flow pot (Skales proxy, ni obiden) — SSR je potrjen.

**Predlog:** F5.1 lahko začneš. Najprej (neobvezno) razreši pre-existing `seed.ts`/e2e `findUnique(userId)` in predhodno uskladi WIP drugih agentov, če želiš tudi `tsc --noEmit` in celoten ESLint čist — a to ni blok za F5.1.