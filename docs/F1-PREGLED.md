# F1 — Zaključni pregled (vstopna tabla za izbiro workspacea)

Vrstni red: pregled dejanske kode + živih strani (dev server na :3000) + podatkovna provjera.
**Ni bilo posega v kodo F1 med pregledom** (mandat: pregled → poročilo → F2 predlog). Ni pushanja, ni migracij.

---

## 1. Shranjevanje in prikaz zadnjega uporabljenega workspacea — ✅ / 🟡

**Kako se "zadnji" persistira in obnovi:**
- `switchActiveOrganization(id)` (action):
  1. preveri članstvo `getMembershipsForUser` + org ACTIVE (varnostno — ni preklopa na tuje),
  2. zapis `User.organizationId = id` (legacy kazalec v DB),
  3. `unstable_update({ user: { organizationId } })` — osveži JWT seje.
- Ob **naslednji prijavi** NextAuth `authorize` vrne `user.organizationId` (prebran iz DB → zadnji uporabljeni), JWT ga svež prevzame.
- `getWorkspacePicker()` določi "aktiven" kartico prek `resolveActiveOrganizationId` (M2 dvojno branje: session member → isDefault → prvi).

**Sklep:** zadnji workspace se **shrani v `User.organizationId` in JWT** ter se **obnovi ob prijavi** — deluje. ✅

**Pomanjkljivost 🟡:** `OrganizationMember.isDefault` (statika, postavljena ob onboardingu) se pri preklopu **ne posodablja**. Posledica:
- kartica lahko hkrati prikazuje **"Privzeti prostor"** (isDefault) na A in **"Aktiven"** (zadnji uporabljen) na B — dva ločena pojma, viden nesklad. 
- Priporočilo: ob `switchActiveOrganization` posodobiti `isDefault` (novi = true, ostali = false) **ali** spremeniti logiko prikaza, da "Privzeti prostor" zamenja "Nazadnje uporabljeno". To spada v F2.

---

## 2. Preklapljanje workspaceov za vse dovoljene vloge — ✅ / 🟡

- **Login preusmeritev** `getActiveWorkspaceCount() > 1` je **role-agnostic** — šteje članstva, ne vlog → STAFF z 2 membrama tudi dobi tablo. ✅
- **Stran `/workspaces`** je v `(admin)` group, ki **ne gate-a po vlogi** → dostopna STAFF. ✅
- **`switchActiveOrganization`** ne gate-a po vlogi — STAFF lahko preklopi na svoje članstvo. ✅
- **Sidebar OrgSwitcher**: gate je `organizations.length > 1`, brez vloge → viden STAFF. ✅

**Pomanjkljivost 🟡:** edina vstopna točka s preklopom v meniju (header) je **ADMIN-only**:
- `header.tsx` "Zamenjaj poslovni prostor" je znotraj `{isAdmin && ...}`.
- STAFF z več workspace-i pride do table le prek login-preusmeritve, **ne iz menija**. Nedoslednost z sidebar switcherjem.
- Priporočilo: menijski vnos prikazati vsem z 2+ članstvi (ali vsaj STAFF), ne samo ADMIN. → F2.

---

## 3. Strežniška zaščita pred neposrednim dostopom do tujega workspacea — ✅ (jedro) / 🟡 (rob)

**Kar je varno (preverjeno v kodi):**
1. **`switchActiveOrganization`**: `memberships.find(m => m.organizationId === id)` — mora biti **lastnikovo lastno** članstvo. Če ni: enak neizdaten odgovor "Podjetje ni na voljo na tem računu." — **brez probing-a**. Org mora biti tudi ACTIVE. ✅
2. **`resolveSessionOrg` / `getSessionOrg`**: aktivni org se razreši iz **uporabnikovih lastnih članstev** (M2 dvojno branje). Session org, ki ni med članstvi, se zamenja z isDefault/prvi — **nikoli** ne prevzame tuje org. `x-org-slug` header je pri admina **ignoriran** (razrešitev gre prek seje/članstva, ne prek headerja; header je še HMAC-vezan — V-1). ✅
3. **F0 dodatek**: guards računajo dovoljenja za razrešen (lasten) `org.id` — custom-role/perms so org-scoped. ✅
4. **`getWorkspacePicker`**: vrača **samo lastnikova članstva**; nepovabljen/neprijavljen → prazen seznam. ✅
5. **`getActiveWorkspaceCount`**: šteje samo lastnikova ACTIVE članstva. ✅

**Pomanjkljivost 🟡 — `/workspaces` nima preusmeritve za nepovabljene:** `(admin)/layout.tsx` **nima** auth-redirect-a (za razliko od `(staff)/layout.tsx`). Empirično:
- `/dashboard` nepovabljen → **redirect na `/login?callbackUrl=%2Fdashboard`** ✅
- `/workspaces` nepovabljen → **renderira admin šel + prazno stanje**, brez redirect-a. 

    Podatkov **ne razkriva** (akcija vrne prazno, switch fail-closed), ampak stran ni skladna z vzorcem appa. → F2: dodati preusmeritev (npr. `if (!session.user) redirect("/login")`) na `/workspaces` (ali v `(admin)` layout).

**Opomba:** dev baza `markec_dev` **ni migrirana** (samo `_prisma_migrations` — brez `User`, `OrganizationMember`), zato ni bilo mogoče autenticirano preklopiti/klicati vračanja podatkov v živo; zgornje temelji na kodi. (send /* dokaz */ izpostavljen spodaj pri F2.)

---

## 4. Vizualni pregled vstopne table (namizje + telefon) — ✅ (šel+stanje) / 🟡 (brez podatkov)

- **Namizje (1280×800) / telefon (390×844)**: stran `/workspaces` se renderira **pravilno, brez horizontal overflow-a**. Naslov h1 "Kam želiš danes vstopiti?", podnaslov, admin šel (sidebar + header) se prikažejo na obeh velikostih; na mobitelu je pravilno hamburger meni ("Odpri meni"). ✅
- **Vsebina na obeh**: "Na tem računu ni aktivnih poslovnih prostorov." (prazno stanje — baza prazna, nobenega članstva). ✅
- **Console error (okolje, ne F1):** `500 /api/auth/session` + `Unexpected token '<' not valid JSON` — Auth.js session fetch pade, ker **baza nima `User` tabele**. To je pomanjkljivost **razvojne baze**, ne F1 buga.
- **🟡 Kartice z dejanskimi workspace-i niso bile vizualno preverjene** — ker ni migrirane/seedane baze z uporabnikom 2+ članstev. Layout kartic je pokrit s strukturnim testom (`workspaces-f1.test.ts`), a živi prikaz z podatki zahteva `prisma migrate` + uporabnika z 2 članstvoma.

---

## 5. Preiskava padajočega `deposit-rules-79.test.ts` — pravi vzrok ugotovljen

**Ne gre (samo) za formatiranje z moje strani — vzrok je v nekomitani delovni kopiji drugega agenta.**

Testna trditev (vrstica 301):
```js
/src/status === "COMPLETED" &&\s*\n\s*appointmentDetails\.commissionAmount === null/
```
→ zahteva **literal newline med `&&` in `appointmentDetails`**.

**Primerjava HEAD vs delovna kopija:**
- **HEAD (committed):** vrstica 1577-1580
  ```js
  if (
    status === "COMPLETED" &&
    appointmentDetails.commissionAmount === null
  ) {
  ```
- **Delovna kopija:** vrstica 1600
  ```js
  if (status === "COMPLETED" && appointmentDetails.commissionAmount === null) {
  ```

Funkcionalno sta **identični** — isti pogoj, ista operanda, isti vrstni red. Spremenjena je bila **zgolj oblikovna** (multiline → oneline). Regex s a newline zato ne ujame.

**Kje je bil reformat narejen?** Gre za del **istega nedokončanega, nekomitiranega `appointments.ts` diff-a**, ki sem ga identificiral že prej (657 vrstic diff-a + obstoječi stash commit "wip-local-oboje-username-modules"; med spremembami je tudi booking-flow delo drugih agentov). Ni posledica F0 ali F1 — F0 sem v `appointments.ts` spreminjal le akciji tips/perms (vrstici ~1551, ~1974), ne vrstice 1600.

**Dejanski vzrok = krhka testna trditev na presledkih** — test preverja *oblikovanje* (newline), ne *vedenja*. Provizijska logika (vrstice 1600-1631) je **intaktna in pravilna**.

**Pravilni ukrep (priporočen):** test poenostaviti, da preverja resnico (npr. `/status === "COMPLETED" && appointmentDetails\.commissionAmount === null/` brez `\n`, oz. preverjati logiko, ne praznih vrstic). **Nisem ga spremenil** — po mandatu: najprej ugotoviti vzrok (zdaj znano), in ker reformat pripada drugemu agentu ("ne posegaj v nedokončane spremembe drugih agentov"), naj uskladitev opravi lastnik tega diff-a, ali pa predlagam popravek testa ob F2 z vašo odobritvijo.

---

## Povzetek F1 ugotovitev

| # | Področje | Stanje | Opomba |
|---|----------|--------|--------|
| 1 | Zadnji workspace | ✅ / 🟡 | Deluje prek `User.organizationId`+JWT; `isDefault` se ne posodablja → prikaz "Privzeti"/"Aktiven" neskladen |
| 2 | Vse vloge | ✅ / 🟡 | STAFF lahko preklaplja (stran, akcija, sidebar); header meni je ADMIN-only |
| 3 | Zaščita pred tujim workspaceom | ✅ / 🟡 | Jedro varno (članstvo-vezano, fail-closed); `/workspaces` brez auth redirect-a |
| 4 | Vizualno | ✅ / 🟡 | Šel+stanje OK na obeh; kartice z podatki niso verificirane (baza ni migrirana) |
| 5 | deposit-rules-79 | 🔎 | Vzrok: nekomitani reformat (other agent) = oneline; vzrok je oblika, ne vedenje |

---

## Predlog F2 (ločene nadzorne plošče / nastavitve / moduli per dejavnost)

Pred začetkom F2 predlagam **fokusiran zaključek F1-popravkov** (za varnost in konsistentnost) ter nato F2:

**F1-popravki (priporočeni, majhni in ciljani):**
1. **Auth redirect na `/workspaces`** (ali v `(admin)` layout) — uskladiti z `/dashboard`. (točka 3)
2. **Header meni za vse role z 2+ članstvi** — ne samo ADMIN. (točka 2)  
   *ali*: prestaviti vnos na vrh preklopnega menija s pogojevanjem na število članstev.
3. **Sinhronizacija `isDefault` ob preklopu** ali **prikaz "Nazadnje uporabljeno"** namesto "Privzeti prostor". (točka 1)

**Nato F2 — razčlenjeno po tvojem vrstnem redu (od tvoje arhitekture):**
- **F2.1** – Sinhronizacija `isDefault` + header vnos za vse vloge (komponentna).
- **F2.2** – Ločen dashboard-skel: per-workspace aktivni moduli (`moduleStates` že obstajajo) — sidebar/nav se per org razrešuje. Preveriti, da je terminologija (i18n `term`) že org-scoped — je (prek `profileId` v layoutu).
- **F2.3** – Nastavitve per workspace: preveriti, da `SalonConfig`/terminologija/palette veljata za izbrano org (že 1:1 z Org — razširiti le, če je treba).
- **F2.4** – Zaščitni testi za izolacijo (per-org podatki ne puščajo).

**Ključno pri F2:** ker je `Organization` že "workspace" in `OrganizationMember`/`switchActiveOrganization` že naredijo izolacijo per aktivni org, F2 ni nov model — je **dokončanje uporabniške izkušnje in konsistentnosti** preklopa (F1-popravki) + **per-org chroma** (sidebar/terminologija/menu), kar večinoma že deluje prek `profileId`.