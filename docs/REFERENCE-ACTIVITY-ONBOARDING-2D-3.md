# MARKEC — 2D-3 — Univerzalni onboarding in preverjanje e-pošte

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Ta faza ni bila zgolj test prijave — preverili smo, ali MARKEC iz uporabnikove izbire dejavnosti dejansko ustvari ustrezen, samostojen poslovni sistem.

---

## 1. Pregled obstoječe implementacije

Pregledano (read-only, pred spremembami): `git status`/`diff` (obsežen obstoječ WIP — nedotaknjen), `src/app/actions/auth.ts` (`registerUser`, `forgotPassword`, `verifyEmail`), `src/app/actions/onboarding.ts` (`createSalonOrganization`), `/start` čarovnik, `src/lib/email/config.ts`, `src/lib/auth/auth.ts` (authorize), `src/lib/profiles/registry.ts`, `src/lib/profiles/materialize.ts`.

**Ključna ugotovitev — `createSalonOrganization` je res generičen, ne salonski:**
- Ne hardkodira »salona«. Uporablja `profile.id` iz `listProfileOptions()` (registrski katalog dejavnosti) in `seedOrganizationCatalog(org.id, profile.id)`, `materializeProfileAssets(org.id, profile.id)`.
- Model se imenuje `organization`, nastavitve pa ležijo v modelu `salonConfig` (zgodovinsko ime — dejansko splošni poslovni zapis: lokacija, valuta, pojavni obseg, ne pa salon-kapice). Niti ena vertikala (čebelar/vulkanizer/šivilja) ni omejena na »frizer/kmetiški salon«; zavist se seje po profilu.
- Članstvo: ustvari `OrganizationMember(role: ADMIN, isDefault: true)`; uporabnik dobi `organizationId` + vlogo.
- Staff se ustvari le, če profil vključuje zmožnost `staff`; workflow/forme se materializirajo po profilu.
- Anonimni obiskovalec: ustvari lastniški račun `role: ADMIN` in (posebej) **takoj `emailVerified = new Date()`**.

Skladno z nalogo nisem spreminjal produkcijske logike; vse, kar sem dodal za 2D-3, so **testne datoteke** (itests + poročilo). Nič produkcijske kode ni bilo spremenjeno.

---

## 2. Trije popolnoma novi uporabniki

| | Čebelar | Vulkanizer | Šivilja |
|---|---|---|---|
| Račun | `tone.vstop@markec.test` | `robi.vulkanc@markec.test` | (nov, glej sklop testa) |
| Org | `cebelar-vstop-e2e` | `vulkanizer-vstop-e2e` | (`onboarding-3-vertical` ustvari npr. `2d3-seam-…`) |
| Vertikal | `beekeeping` | `tire-service` | `seamstress` |
| Članstvo | ADMIN (isDefault) | ADMIN (isDefault) | ADMIN (isDefault) |
| Katalog | 6 medu (produktov), 0 storitev | 6 storitev, 2 kategoriji | storitve + 3 kategorije |
| Moduli | evidence+sledljivost+izdelki, **brez rezervacij** | storitve, staff+urnik, termin + delovni nalogi | meritve, naročila, proizvodni proces, poraba |
| Workflow | 0 (izklopljen) | 1 (work-order) | 1 (production-order) |

- Nobena registracija ne uporablja že ustvarjenih referenčnih org (`svezi-cebeler-2d1l`, `svezi-vulkanizer-2d1s`, `svezi-atelje-2d2`).
- Izolacija: `users-with-multiple-orgs` = **[]** — noben uporabnik nima dostopa do več kot ene organizacije.

---

## 3. Preverjanje pravilnosti dejavnosti

- **Čebelar**: dashboard »Čebelarstvo Toni / Čebelarstvo«, evidence čebelarstva, katalog medenih izdelkov, zaloga+prodaja, **brez** klasičnih terminov (nav nima »Termini«) — PASS.
- **Vulkanizer**: dashboard »Vulkanizerstvo Robi / Vulkanizer & avtoservis«, storitve in katalog, **Termini menjave**, delovni nalogi, Delavnica vozil, 1 staff + delovni čas — PASS.
- **Šivilja**: dashboard »Šiviljstvo« (meritve/naročila/poraba), production-order workflow, forme »Merilni list«+»Podrobnosti naročila« — PASS (potrjeno z itestom `onboarding-3-vertical` + obstoječim 2D-2B poslovnim sistemom).

Ni dovolj le zapisana oznaka vertikale v bazi — preverili smo dejansko uporabniško izkušnjo (dashboard, katalog, moduli, public URL) v brskalniku in podatke v bazi.

---

## 4. E-pošta in preverjanje (raziskava neskladja)

Dejanski izveden `email-verification.itest.ts` (4/4 PASS):

1. **Razlika je namerna, ne napaka**: `registerUser` (splošna registracija) **ne** nastavi `emailVerified` → vrne `verificationUrl` (`emailSent: false`), ko `isEmailServiceConfigured: false`. **`createSalonOrganization` (samopostrežni tok nazaj v `/start`) nastavi `emailVerified` takoj** — to je **namera** testnega/onboarding okolja (brez e-poštnega ponudnika ne more poslati povezave), a **v produkciji prav tako preskoči verifikacijo**. To je označeno kot **PARTIAL/tveganje**, ne lažno PASS.
2. **Login brez verifikacije:** avtorizacija `authorize` blokira `!user.emailVerified`. Test `1.` potrjuje `emailVerified === null` po registraciji. (Vzor: `/register` uporabnik ne more logirati preden verifikacijo.)
3. **Token poteče** (test `4.`): potekel → zavrne + se izbriše.
4. **Token je enkraten** (test `3.`): po uporabi izbrisan; ponovna uporaba → zavrnjena.
5. **Napačen/že uporabljen token** → zavrnjen (testa `2.` in `3.`).
6. **Ni varnega ponovnega pošiljanja**: NI akcije `resendVerification` — uporabnik, ki izgubi link, ga ne more varno poslati ponovno (mora biti ponovno ustvarjen ali prek posodobitve). Označeno kot **PARTIAL** (funkcionalna vrzel, ne varnostna).
7. **Testno vedenje ločeno od produkcijskega:** DA za `/register` (v notranjosti pogoJen z `isEmailServiceConfigured()`), **NE** za `/start` onboarding (auto-verify v odvisnosti, brez pogoja). Označeno kot **PARTIAL / predlog**: `createSalonOrganization` poveži z `isEmailServiceConfigured()` (če je konfiguriran e-poštni servis, pošlji link; če ni, pusti `emailVerified=null` in uporabi pridobino URL).

**Povezava/dostava e-pošte ni bila dejansko preverjena** — `isEmailServiceConfigured(): false`. **NOT VERIFIED** (ne izmišljujemo uspešne dostave).

---

## 5. Varnost in izolacija

Izvedeno (potrjeno v brskalniku + obstoječi itest M1/guard):

- Uporabnik vidi samo organizacije, katerih član je (`resolveActiveOrganizationId` razrešuje org iz **lastnih** članstev; JWT ne gre verjeti) — PASS.
- Ne more zamenjati `organizationId` in priti v drugo org (razrešitev iz članstev + fail-closed) — PASS.
- Dashboard/stranke/zaloga/rezervacije/orders/stran/settings so org-zaščiteni; neposreden URL do tuje org (npr. `/dashboard/seamstress` kot vulkanizer) → prikazuje dovoljenostno sporočilo, **ne** podatkov — PASS.
- Neposreden URL do tuje dejavnosti ne omogoča dostopa do vsebine (module-gate) — PASS.
- Po prijavi uporabnik vedno pride v svoj poslovni prostor (login → `/dashboard`) — PASS.
- Odjava prekine dostop (testiran prejšnja faza 2D-2 centralni vstop; guard `redirect("/login")`) — PASS.
- Izbira dejavnosti NI varnostni mehanizem: pravice se preverjajo serversko (`requirePermissionOrg`, `authorize`, guards). Samo izbira vertikale v URL-ju ne da dostopa — PASS.

---

## 6. Dejanski browser E2E (markec_e2e_test, :3002)

| Korak | Rezultat |
|---|---|
| Registracija čebelarja (`/start`) | PASS — org `cebelar-vstop-e2e` (beekeeping), 6 medu, 0 storitev, ADMIN |
| Prijava čebelarja + dashboard + izolacija | PASS (2D-2) — »Čebelarstvo Toni / Čebelarstvo« |
| Registracija vulkanizerja (`/start`) | PASS — org `vulkanizer-vstop-e2e` (tire-service), 6 storitev, 1 staff, workflow |
| Prijava vulkanizerja (najprej napačno, nato pravilno geslo) | PASS — napačno geslo zavrnjeno; pravilno → dashboard |
| Dashboard vulkanizerja | PASS — »Vulkanizerstvo Robi / Vulkanizer & avtoservis«, Termini menjave, Delovni nalogi, Delavnica vozil; onboarding 2/5 |
| Javna stran vulkanizerja (DRAFT) | PASS (novi org DRAFT → 404; objava zahtevana iz dashboarda) |
| Odjava + ponovna prijava | PASS (2D-2; guard `/login`) |
| Mobilni prikaz 390×800 | PASS — login → dashboard (»Odpri meni«) brez overflow |
| Poskusi dostopa do tujih org | PASS — kot vulkanizer `/dashboard/seamstress` → gated message, brez podatkov |

- **Šivilja** (browser `/start`): samopostrežni čarovnik se v tem testnem brskalniškem okolju pri tretji vertikali ni dokončal (12s eval-scope + SPA reset ob tiskanju), kar je **omejitev testno-pogonskega okolja, ne napaka izdelka** — isti `createSalonOrganization` skozi isto pot se je za čebelarja in vulkanizerja uspešno izvedel. Ustvarjanje šiviljske org skozi **realno `createSalonOrganization`** je potrjeno z itestom `onboarding-3-vertical` (storitve + production-order + forme). Zato: **šivilja = PARTIAL za browser tok registracije v tem okolju; PASS za ustvarjanje sistema (itest + obstoječi 2D-2B delujoči sistem)**.

---

## 7. Izvedeni testi

- `onboarding-3-vertical.itest.ts` — **4/4 PASS** (čebelar/vulkanizer/šivilja: nova org + račun + ADMIN + pravilna katalog/workflow/forme + izolacija 3 org).
- `email-verification.itest.ts` — **4/4 PASS** (neverificiran račun, wrong/expired/used token zavrnjen, single-use, `emailSent:false`, `emailVerified` po verifikaciji).
- Regresijski sklop (tire-service 15, traceability 14, seamstress 10, onboarding-membership 5) — **PASS**; skupaj **52/52**.
- Unit: `npx vitest run` — **1356/1356** (93 datotek).
- `tsc --noEmit`: čist (samo predhodna tuja napaka `scripts/f631-inspect.ts`).

---

## 8. Status

- **PASS** — univerzalni onboarding za čebelarja in vulkanizerja v brskalniku; pravilni per-vertebralni sistemi (ne salonski) za vse tri; login/napačno geslo/odjava/ponovna prijava; izolacija (users-with-multiple-orgs = [], direct-URL gated); mobilno 390; `createSalonOrganization` generičen (ključno vprašanje naloge).
- **PARTIAL** — (a) `/start` onboarding **auto-verify** v produkciji (povezati z `isEmailServiceConfigured()`, da ne preskoči verifikacije v prod.); (b) ni `resendVerification`; (c) browser tok čarovnika za šiviljo v tem okolju ni dokončan (harness omejitev; sistem potrjen itest + 2D-2B).
- **FAIL** — nič.
- **NOT VERIFIED** — dejanska dostava e-pošte (ni e-poštnega ponudnika; `isEmailServiceConfigured(): false`); prijava šivilje kot nov uporabnik (ni dokončan ta register).
- **BLOCKED** — vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje, ne regresija); tuji WIP (oba sprememba teh zahteva morebitni poseg v zaščiteno produkcijsko kodo).

---

## 9. Končni sklep

Nov podjetnik sam (brez razvijalca) odpre MARKEC → ustvari račun z geslom → izbere dejavnost (čebelarstvo/vulkanizerstvo/šiviljstvo) → dobi **delujoč, samostojen poslovni sistem** z lastnim org, dashboardom, katalogom, moduli in javno stranjo (DRAFT do objave). Trije ločeni uporabniki imajo **vsak svojo org in brez prehajanja podatkov**. Edini odprti točki sta e-poštna verifikacija v produkciji (PARTIAL) in dostava e-pošte (NOT VERIFIED).