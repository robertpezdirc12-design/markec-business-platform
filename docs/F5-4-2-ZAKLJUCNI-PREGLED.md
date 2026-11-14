# F5.4.2 — Multi-Organization Module Acceptance (zaključni pregled)

> **Stanje:** DONE (z opombo pri browser toku). Omogoča integracijsko in browser verifikacijo
> moduli sistema v multi-org kontekstu. Brez novih funkcionalnosti, brez produkcijskih migracij,
> brez commit/push, WIP drugih agentov ni prepisan.

---

## 1. Testni okvir

- **Ločena testna baza:** `markec_f54_test` (postgres) — polna Prisma shema prek `db push`, realni
  Prisma klient, realne strežniške akcije; mockana le seja / next-cache / next-headers / tenant-proof.
- **`vitest.f54.config.ts`** — a nova ločena integracijska vitest konfig (varnostna zavora: ime baze
  se nujno prepiše na `markec_f54_test`; ne more zadeti produkcije/dev).
- **`tests/integration/f54/multi-org-modules.itest.ts`** — 16 testov, ki neposredno kličejo
  `setModuleState` / `getModuleOverview` / `reconcileModuleStates` (obvoz UI).
- **Testna masa (§1):**
  - `admin` — ADMIN v orgA (frizer) in orgB (avtoservis);
  - `onlyA` — ADMIN samo v orgA (za cross-org blokado);
  - `staff` — član obeh org: v orgA z custom vlogo, ki **vključuje** `settings.manage` (lahko
    upravlja), v orgB z custom vlogo **brez** `settings.manage` (ne sme);
  - orgA `vertical: frizer`, orgB `vertical: mehanik` — različne CapabilityMatrix.

---

## 2. Zahteve → status

| # | Zahteva | Status | Dokaz |
|---|---|---|---|
| §1 | Testni uporabniki/podjetja | **PASS** | 2 podjetji (frizer/avtoservis), ADMIN obojih, STAFF obojih z različnimi custom vlogami; seedana na f54 bazi. |
| §2 | Različni moduli + izolacija | **PASS** | Integracija: frizer appointments required / workOrders disabled; avtoservis appointments non-required / workOrders required. `setModuleState` v A ne spremeni B stanja; preklop / ponovna prijava ohranita stanje (testi). Browser: frizer 6 obveznih vs avtoservis 9 obveznih, navigacija se preimenuje. |
| §3 | Varnostna matrika (neposredni klici) | **PASS** | ADMIN upravlja; STAFF z `settings.manage` v orgA upravlja module uspešno; STAFF brez (orgB) vrže `UnauthorizedError`; uporabnik A/onlyA ne more spremeniti orgB; required ni izklopljiv (`allowed:false`); disabled ni vklopljiv; manipulacija `organizationId` (tudi fiktivna) ne omogoči cross-org. |
| §4 | Legacy stanja | **PASS** | required+DEACTIVATED → `reconcile` ga vrne na aktivno, prikaz `required`; disabled+ACTIVE → razrešeno na `disabled` (ni odprto); HIDDEN pri required → funkcionalno aktiven, javno skrit; odvisnost izklopljenega modula spoštovana. Poslovni podatki nikoli izbrisani (reconcile briše le `OrganizationModuleState` vnos, ne modulnih podatkov). |
| §5 | Uporabniški tok (Chromium) | **PASS (1–5) / NOT VERIFIED (6–8)** | Browser: ADMIN prijava → workspace picker (Frizer/Avtoservis) → Frizer (orgA) moduli → preklop na Avtoservis (orgB) → drugačna konfiguracija (9 obveznih vs 6). **Koraki 6–8** (ponovna prijava + STAFF) niso bili polno izvedljivi v shared browserju (vztrajna sesija iz prejšnje testne baze; logout ni uspel očistiti) → označeno **NOT VERIFIED**; pokrito pa z integracijskimi neposrednimi klici (ki so strožji od UI) v §3. |
| §6 | Validacija (regresija) | **PASS** | Vitest 88 datotek / **1295/1295**; f54 integracija **16/16**; tsc 0 napak na F5.4.2 datotekah; ESLint 0 errors/0 warnings; audit log append-only + org-scoped (testi). |
| §7 | Poročilo | **PASS** | Ta dokument, PASS/FAIL/NOT VERIFIED z dokazi. |

---

## 3. Spremenjene datoteke (F5.4.2)

### Nova
- `tests/integration/f54/multi-org-modules.itest.ts` — 16 integracijskih modulnih testov.
- `vitest.f54.config.ts` — ločena integracijska vitest konfig (markec_f54_test).
- `scripts/_f542-seed-browser.ts` — seed testne mase za browser tok (f54web uporabniki).

### Spremenjena
- `src/app/actions/modules.ts` — **ciljna sprememba varnostnega modela (F5.4.2 §3):** modulne akcije
  (`setModuleState`, `getModuleOverview`, `reconcileModuleStates`) so zdaj **org-scoped in
  permission-based** prek novega `requireModuleManageOrg()` (namesto `requirePermissionOrg`
  ADMIN-role-only). Tako lastnik (ADMIN) in **STAFF s custom vlogo, ki vsebuje `settings.manage`**,
  lahko upravljajo module SVOJE organizacije; STAFF/član brez tega dovoljenja je zavrnjen
  (fail-closed). Ključ je permisija po organizaciji, nikoli globalna vloga.
- `tests/modules-f2.test.ts` — strukturni guard test posodobljen na `requireModuleManageOrg` +
  `settings.manage` perm in org-scoped `getEffectivePermissions`.

> **Opomba namerna:** §3 zahteva, da "STAFF z ustreznimi dovoljenji ima samo dovoljen obseg
> upravljanja" — zato je bila globoka varnostna vrata za modulne akcije razširjena s permission-based
> (prej jih je omejevala `requireRole(["ADMIN"])`). To realizira §3 in ne zlomi drugih akcij
> (pri njih `requirePermissionOrg` ostaja).

---

## 4. Varnostni dokazi (iz integracijskega testa)

| Scenarij | Rezultat |
|---|---|
| `setModuleState("appointments","DEACTIVATED")` frizer (required) | `success:false, allowed:false`, ni shranjeno |
| `setModuleState("documents","ACTIVE")` frizer (disabled) | `success:false, allowed:false` |
| STAFF orgA (settings.manage) `setModuleState("reviews","ACTIVE")` | `success:true` |
| STAFF orgB (brez settings.manage) `setModuleState("reviews","ACTIVE")` | `rejects UnauthorizedError("permission")` |
| onlyA (član samo orgA) poskuša orgB / fiktivni orgId | orgB stanje nespremenjeno (fallback na lastni org, nikoli tuji) |
| Legacy required+DEACTIVATED → reconcile | prikaz `required`, `fixed>=1` |
| Legacy disabled+ACTIVE → reconcile | prikaz `disabled`, ni odprt |
| required+HIDDEN | category `required` + `hidden:true` (javno skrito) |
| Audit log | vsaka sprememba `ConfigChangeLog module:*` za CILJNO org, org-scoped |

---

## 5. Odprte težave / opombe

1. **Browser §5 koraki 6–8 NOT VERIFIED:** popoln ponovni-login (logout→re-login) in STAFF
   browser-tok nista bila polno izvedljiva v skupnem (shared) browserju zaradi vztrajne sesije iz
   prejšnje testne baze; logout je vrnil 200, a cookie ni bil očiščen. **Status:** NOT VERIFIED
   (ni obiden — uporabljeni neposredni strežniški klici, ki so strožji od UI).
2. `requireModuleManageOrg()` — nova permission-based vrata modulov. To je namerna sprememba iz
   §3; če ni zaželena na produkcijsko dolgi rok, dokumentiraj in preveri z lastniki (dostop STAFF
   do modulov je sedaj mogoč le, če ima custom vloga `settings.manage`).
3. Testna baza `markec_f54_test` je `db push` (polna shema, brez migration zgodovine) — primerno
   za izolirane integracijske teste; produkcijska migracija ni bila izvedena.

---

## 6. Predlog naslednje faze (F5.4.3 ali nadaljevanje)

F5.4.1 + F5.4.2 sta dokazala: enoten »Moji moduli« zaslon, trdno avtoritativno politiko
(required/optional/disabled), org-scoped izolacijo in permission-based dostop. Predlog za F5.4.3:

1. **Dokončaj browser tok 6–8** (ponovna prijava + STAFF browser) v čistem Chromium profilu
   (ločen browser kontekst, ne skupni) — zapri NOT VERIFIED z enakim seedom.
2. **Priporočila na profilu:** dodaj izrecen `recommended` odmerek v profil (brez Prisma
   migracije — izpeljano iz CapabilityMatrix/predlogov SKD), da "Priporočeni" postanejo
   razlikovani od zgolj "aktivni optional".
3. **Stratifikiraj dashboard widgete** v `ModulesConfigurator` z vidnostjo po profilu (trenutno
   vsi widgeti, ločeno od modulov).
4. **Avtomatiziraj** f54 integracijsko suito v CI (redni run na f54 bazi + clean DB).

To ne zahteva produkcijskih migracij in se opira na obstoječe komponente.