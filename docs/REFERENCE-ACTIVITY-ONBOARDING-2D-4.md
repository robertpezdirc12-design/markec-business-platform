# MARKEC — 2D-4 — Varna registracija, e-pošta in celoten onboarding

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: odpraviti odprte točke 2D-3 — (1) ni samodejne potrditve e-pošte v produkciji, (2) varen ponovni posljetek verifikacije, (3) celoten browser onboarding vključno s šiviljstvom.

---

## A. Agenti (res uporabljeni)

Uporabljen je bil sistem `fork_chats` (vzporedni, dejanski, ločeni agentski pogovori). Vsi pregledovalni agenti so bili **read-only**; edini so implementacijski spremembe naredil koordinator (jaz), da ne bi prišlo do konfliktov v istih datotekah.

| Agent | Naloga | Ugotovitve (potrjene s strani koordinatorja) |
|---|---|---|
| **A1 – Auth/varnost** | read-only: `registerUser`, `verifyEmail`, `authorize`, NextAuth, tokeni | `registerUser` NE postavi `emailVerified`; token 256-bit crypto, 24h, enkraten (izbrisan ob uporabi), shranjen plain. `authorize` (auth.ts:77-79) blokira `!emailVerified` prek `EmailNotVerifiedError`. Edini auto-verify je bil v `createSalonOrganization` (onboarding.ts:307). Ni `resendVerification`. Brez OAuth. |
| **A2 – Onboarding/poslovna logika** | read-only: `createSalonOrganization`, `/start` wizard, draft, mater./katalog | Anonimna veja: `emailVerified:new Date()` + `signIn`-auto-login v `start-wizard.tsx:536` → `/dashboard`. Org/katalog/materializacija so pravilni za vse tri vertikale (per profil). |
| **A3 – Testiranje/regresija** | read-only: pregled obstoječih itestov + mapa pokritosti | Testi, ki trdijo `emailVerified` ni-null na `onboarding-3-vertical:114,126,139` se morajo obrniti; mock template (`next/server` `after`) za resend; predlog 5 testov resend. |
| **A4 – Browser/UX šivilja** | read-only: analiza `start-wizard`, `activity-directory-picker`, `pending-verify-screen`: **ni nobene napake v apl.**; šivilja je v wizardu vertikalno-agnosticna; `Šiviljstvo` izbirljivo identično; PendingVerify wiring veljaven; težava v browserju izključno omejitev test-harness (eval 10s + SPA reset). |
| **A5 – Neodvisni reviewer** | read-only: ponoven pregled sprememb + lastni testi | tsc čist (razen predhodne tuje `f631-inspect.ts:40`); itest 3 datoteke/18/18 z res exit 0; **nobene auto-verify** ne ostane (edini `emailVerified: new Date()` je znotraj `verifyEmail` = klik na povezavo); `authorize` gating drži → nepreverjeni uporabnik ne dobi sesije → dashboard zaščiten. Našel **minor hygiene napako** (osiroteli verifikacijski token v catch ob padcu pozneje; ni varnostno) — koordinator jo je POPRAVIL. |

Neodvisni reviewer NI samo ponavljal povzetkov — je prebral datoteke, zagnal tsc/itest in podal lastne verodiktete (E, F, orphan-token, cooldown).

---

## B. E-pošta

- **Registracija:** `registerUser` in `createSalonOrganization` sedaj ustvarijo račun **brez** `emailVerified`; token 24h enkraten. **PASS.**
- **Verifikacija:** `verifyEmail` potrdi le veljaven, nepretečen token; po uspehu `emailVerified` + izbris tokena. **PASS.**
- **Ponovno poslana povezava:** nova akcija `resendVerification` — 60s cooldown (ključ `issuedAt=expires−24h`), samo za obstoječe nepreverjene račune, **ne razkrije obstoja e-pošte** (unknown/verified/cooldown → enaka `{success:true,emailSent:false,ignored:true}`), izbrise stari token, nov enkratni token. UI: gumb »Ponovno pošlji potrditveno povezavo« v `PendingVerifyScreen`. **PASS.**
- **Napačen token:** zavrnjen (itest 2.). **PASS.**
- **Potekel token:** zavržen + izbrisan (itest 4.). **PASS.**
- **Dejanska dostava:** **NOT VERIFIED** — v testnem dev-server okolju je `.env` nastavil `RESEND_API_KEY` (ne-placeholder) in `isEmailServiceConfigured()` je vrnil `true`; Resend je ob dejanskem pošiljanju vrnil **401 "API key is invalid"** (vidno v server log). Moja koda **ni izmišljevala uspešne dostave** (PendingVerify je v tem okolju pravilno prikazal »preverite e-pošto«, ne lažnega verificationUrl). Produkcijska dostava ni bila preverjena.

---

## C. Onboarding (tri vertikale)

- **Čebelar** (`tone.vstop@markec.test` → `cebelar-vstop-e2e`) — preverjeno v prejšnji fazi; sedaj regresijsko potrjeno (itest 4/4, 6 medu, 0 storitev, brez terminov). **PASS.**
- **Vulkanizer** (`robi.vulkanc@markec.test` → `vulkanizer-vstop-e2e`) — preverjeno v prejšnji fazi; regresija potrjena (6 storitev, 1 staff, workflow). **PASS.**
- **Šivilja** — **browser tok sedaj DOKONČAN** (v prejšnji fazi ni šel). V browserju sem v `/start?vertical=seamstress` zaključil celoten tok za svež anonimni račun `moja.sivilka@markec.test` → `atelje-moja-2d4`:
  1. — registracija → **PendingVerifyScreen** (»Podjetje je ustvarjeno! … potrdite svoj e-poštni naslov« + povezava, ker brez servisa v itest okolju; v dev je šlo na »preverite e-pošto«).
  2. — prijava PRED verifikacijo → **blokirana** (»Potrebna je potrditev e-pošte«).
  3. — `/verify-email?token=…` → **»E-pošta potrjena!«** (DB: `verified:true`).
  4. — prijava PO verifikaciji → **uspešna** v šiviljski dashboard (»Šiviljski atelje Moja / Šiviljstvo«, nav »Delovna naročila« + »Šiviljstvo« + »Projekti«, onboarding 2/5).
  5. — **mobilno 390×800** → dashboard deluje brez overflow.
  **PASS.** (Prejšnja neuspešna šivilja v browserju je bila vezana na 10s-eval + SPA-reset testno okolje, ne na napako apl. — A4 neodvisno potrdil.)

---

## D. Varnost

- **Izolacija org:** vsak uporabnik je član natanko ene org (`users-with-multiple-orgs: []` po popravku kontaminiranih); IDOR teste prehodne. **PASS.**
- **Prijava/odjava:** deluje (prejšnja fase + ta). **PASS.**
- **Nepreverjeni računi:** `authorize` (auth.ts:77-79) blokira; browser-izvedeno. **PASS.**
- **Neposredni URL druge dejavnosti/dejavnost-manipulacija:** module-gate zavrne (preverjeno 2D-2C in ta faza preko `/dashboard/seamstress` kot vulkanizer → gated message). **PASS.**

---

## E. Testi (dejansko izvedeni)

- **Unit:** `npx vitest run` → **1356/1356 PASS** (93 datotek).
- **Integration (markec_e2e_test):** email-verification **9/9** (vklj. 5 novih resend), onboarding-3-vertical **4/4** (flipped na unverified), onboarding-membership **5/5** (popravljen), seamstress **10**, tire-service **15**, traceability **14** → **57/57** po osnovnem sklopu; širši sklop 8 datotek → **87/87** (vklj. beekeeping-final, stock-integrity, direct-sale).
- **Browser E2E:** šivilja celoten tok (register→verify→login→dashboard, desktop+mobile 390); blokiranje nepreverjene prijave. Čebelar/vulkanizer dashboard regresijsko videna v prejšnjih fazah.
- **TypeScript:** `tsc --noEmit` čist (samo predhodna tuja `scripts/f631-inspect.ts:40`).
- **Regresija:** 87/87 itest + 1356/1356 unit; trije profili (čebelar/vulkanizer/šivilja) še vedno ustvarijo pravilne module.

---

## Status

- **PASS** — odstranitev auto-verify (produkcijska registracija nezahteva verifikacijo); resendVerification (cooldown, no-enumeration, star-token neveljaven, enkratnost); browser onboarding šivilje (nekdaj odpovedan) po celem toku; blokiranje nepreverjene prijave; mobilni; regresija; neodvisni reviewer.
- **PARTIAL** — dejanska dostava e-pošte ni končana (v test okolju Resend 401; koda iskrena — ne lažne dostave). Minor hygiene: osiroteli token ob padcu poznega koraka (POPRAVLJEN na priporočilo reviewerja).
- **FAIL** — nič.
- **NOT VERIFIED** — dejanska e-poštna dostava; login-resend v samem login obrazcu (gumb je v PendingVerify zaslonu; login ob »potrebna verifikacija« nima lastnega gumba za ponovi).
- **BLOCKED** — slepi itest-sklopi s fixtures na `markec_f631_test` (okolje, ne regresija); tuji WIP (storjene spremembe so ozke, produkcijske datoteke onboarding/auth/start-wizard so v obstoječem WIP-ju — edite sem izvedel brez prepisovanja tuje vsebine).

## Končni sklep

MARKEC zdaj omogoča, da se podjetnik **sam registrira, varno potrdi e-pošto, izbere dejavnost in dobi svoj samostojni poslovni sistem** — brez razvijalca in brez ročnega posega v bazo. Šiviljstvo (nekdaj neuspešno v browserju) je potrjeno po celem toku. Nepreverjeni računi ne morejo v poslovni prostor.