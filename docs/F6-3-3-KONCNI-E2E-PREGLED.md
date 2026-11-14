# MARKEC — F6.3.3 ZAKLJUČNO POROČILO (Končni E2E pregled urejanja, shranjevanja, objave)

> Verifikacijska faza. Cilj: dokazati, da lastnik (podjetnik) v **vseh 4 dejavnostih** samostojno
> uredi spletno stran, shrani spremembe, vidi predogled in po objavi vidi dejanske spremembe na
> javni strani. Statusi: **PASS / PARTIAL / FAIL / NOT VERIFIED / NOT IMPLEMENTED**. Vse preveritve
> so bile izvedene v pravem browserju (Chrome DevTools MCP) na izolirani bazi `markec_f631_test`.

---

## 0. Izvedbena infrastruktura

- **Baza:** `markec_f631_test` (izolirana, 4 objavljeni tenanti: mehanik/frizer/šivilja/čebelar).
- **Server:** `npm run dev -- -p 3009` z `DATABASE_URL=…markec_f631_test`,
  `NEXT_PUBLIC_APP_URL=http://localhost:3009`, `NEXTAUTH_URL=http://localhost:3009`.
- **Browser:** Chrome DevTools (MCP) na `http://localhost:3009`. 
- **Priprava za prijavo:** lastniki vseh 4 tenantov so dobili **veljaven bcrypt hash** gesla
  (`TestPass123!`), da je `credentials` login dejansko deloval — prvi poskus je odpovedal, ker je
  SQL vstavil `\$2b…` (backslash) namesto `$2b…`; popravljeno (compare ✓). To so bile izključno
  prilagoditve **testnih podatkov v izolirani bazi**, ne aplicirane kodi.

## 1. Začetno stanje

- Git veja `main`; WIP drugih agentov ostal nedotaknjen (`git status` prepovedan add/commit/push).
- `src/proxy.ts` je `M` (od drugega agenta) — **nisem ga spremenil**.
- Nova datoteka te faze: `scripts/f631-h1.ts` (read-only h1 preverba javne strani).

## 2. Mobile E2E za vse 4 dejavnosti (375 px) — dejanski browser test

V pravem browserju (viewport 375×812, mobile/touch) so bile odprte vse 4 javne strani in izmerjen
**dejanski horizontalni overflow** (scrollWidth vs clientWidth prek `evaluate`):

| Dejavnost | URL | scroll/client W | Overflow | Opomba |
|---|---|---|---|---|
| Avtomehanik | /s/mehanik-test | 375 / 375 | **false (PASS)** | mobile responsive |
| Frizer | /s/frizer-test | 375 / 375 | **false (PASS)** | mobile responsive |
| Šivilja | /s/sivilja-test | 375 / 375 | **false (PASS)** | mobile responsive |
| Čebelar | /s/cebelar-test | 375 / 375 | **false (PASS)** | mobile responsive |

Ključni deli (navigacija/hamburger, hero, sekcije) so bili prikazani tudi native na desktop (F6.3.2
snapshots). Mobile screenshot za mehanik je shranjen v `docs/assets-f631/mehanik-mobile.png`
(F6.3.2). **PASS** za mobilno prilagodljivost v vseh 4.

## 3. Prijava (owner) — PASS za vse 4

Uporabljena prava `credentials` prijava (email/geslo) kot lastnik:
- frizer-test `fr@f631.test`, mehanik-test `mk@f631.test`, sivilja-test `si@f631.test`,
  cebelar-test `cb@f631.test` (vsi `TestPass123!`, ADMIN). Vsak toast-u dashboard z **lastnimi
  moduli po dejavnosti** (npr. mehanik → Termini servisa + Delovni nalogi; šivilja → Delovna
  naročila + Projekti; čebelar → Izdelki/trgovina; frizer → Termini).

## 4. Urejanje vsebine (per-tenant) — PASS

Vstop: Nastavitve → **Izgled in vsebina → Vizualni urejevalnik** (vsak tenant). Uredil sem
**glavni del sekcije hero** (naslov, podnaslov, CTA-besedilo) in objavil. V poročilu so dokazi:

| Tenant | Uredil (testna vsebina) | Objavljen hero naslov | Javna stran h1 |
|---|---|---|---|
| frizer-test | Naslov + CTA | „Vaš slog, naša obrt — TEST-NASLOV“ | ✓ (h1) |
| mehanik-test | Naslov + podnaslov + CTA | „Servis, ki mu zaupate — TEST“ | ✓ (h1) |
| sivilja-test | Naslov + podnaslov + CTA | „Šivanje po meri — TEST“ | ✓ (h1) |
| cebelar-test | Naslov + podnaslov + CTA | „Med iz lastnih panjev — TEST“ | ✓ (h1) |

Urejevalnik je **prikazal pravilne podatke izbranega tenanta** (mehanik „Vaše vozilo…“, frizer
„Vaš slog…“, šivilja „Vsako oblačilo…“, čebelar „Med, kot ga daje narava“) — **ni mešanja vsebine**.

## 5. Shranjevanje + ponovno odpiranje + osvežitev — PASS

- Klik **„Shrani osnutek“** je zapis v `siteContent` (draft) — preverjeno v bazi (npr. sivilja draft
  „Šivanje po meri — TEST“, public ostal „Vsako oblačilo, popolno prileganje“, version 1).
- Ponovno odpiranje urejevalnika je pokazalo shranjene vrednosti (draft ostal vidni).
- **Osvežitev / ponovno odpiranje po objavi** je potrjeno neposredno na javni strani (h1 = nov naslov).

## 6. Predogled in objava — PASS

- **Predogled** (iframe `/s/{slug}/preview?edit=1` v urejevalniku) prikazuje **osnutek** z isto
  strukturo (hero/split/minimal po dejavnosti) — v predogledu je viden draft.
- **Objavi** → `publishedSiteContent` je postavljen na nov draft **in `publishedContentVersion` je
  narasla 1 → 2 za VSE 4 tenante** (preverjeno v bazi). Javna stran je po objavi/reload-u prikazala
  nov naslov (potrjeno z `f631-h1.ts`; testna vsebina trajna po reload-u — ni le lokalna browser-state).

## 7. Vklop / izklop modulov (#7) — PARTIAL (pasivni dokaz)

- **Pasivno preverjeno:** neaktivni/skriti moduli **ne puščajo praznih sekcij niti mrtvih CTA-jev**.
  Primer (public-site in editor predogled): čebelar-tenant NIMA v navigaciji/glavnem delu „Storitve“
  niti „Rezerviraj“ (brez services/booking modula) — samo „Trgovina“ + „Naroči izdelke“. Šivilja
  NIMA `/booking` (vodi 307 → `/inquiry`), čebelar /booking → 307 → `/inquiry` (iz F6.3.2). Sekcija
  „Storitve“ v seznamu urejevalnika je **vidno skrita/neaktivna** ob pomanjkanju kataloga → ni
  prazne sekcije na javni strani.
- **Aktivni UI preklop (izklop → ponoven vklop enega modula v urejevalniku) NI bil izveden** v tem
  obsegu (veliko korakov v nestabilnem MCP screenshot-okolju). Oznaka **NOT VERIFIED** za aktivni
  krožni modul-test; pasivno obnašanje (ni mrtvih CTA/sekcij ob neaktivnih modulih) je **PASS**.

## 8. Izolacija organizacij — PASS

- Po urejanju/objavi za VSE 4 tenante, vsak je zelo različen naslov — **izolacija potrjena
  dejansko** (baza in javne strani):
  - cebelar-test „Med iz lastnih panjev — TEST“
  - frizer-test „Vaš slog, naša obrt — TEST-NASLOV“
  - mehanik-test „Servis, ki mu zaupate — TEST“
  - sivilja-test „Šivanje po meri — TEST“
- Sprememba enega ni prepisala ali vplivala na druge (vsi ostali so obdržali svoj original do
  lastnega urejanja). Dostop z uporabnikom druge organizacije **ni bil testiran** (lastniki vsi
  ADMIN v lastnem org) — **NOT VERIFIED** (a prijava je org-scoped in respond per-tenant, kot dokazuje
  dejstvo da je bil vsak dashboard pravega tenanta).

## 9. Testi / dokazila

- Browser (Chrome DevTools) click/fill/shrani/objavi za vse 4 + preverjene vrednosti v bazi
  (`publishedContentVersion` 1→2) + javna h1 (`f631-h1.ts`).
- Screenshots: `docs/assets-f631/mehanik-desktop.png`, `mehanik-mobile.png`, `frizer-desktop.png`
  (F6.3.2). Interaktivni urejevalnik v tej fazi – MCP screenshot je večkrat timed-out, zato so
  dokazi predvsem a11y snapshots (vsebina) + DB + server-check podatkov.
- Podroben dnevnik requestov MARKEC-next (200 za vse objavljene /s/, /login, /api/auth/*) v dev logu.

## 10. Odkrite napake / omejitve
- **Dev okolje:** Turbopack dev občasno (po veliko requestih) preneha pravilno registrirati
  nekatere routes (`/login`/`/api/auth/*` → 404). Reši se s čistim restartom dev procesa (na portu
  3009, po restarts vse deluje). To je dev-diagnostika, ne aplikacijska napaka javne strani.
- **F6.3.1 setup:** lastnikom manjkal bcrypt hash — popravljeno (testna baza).
- **Screenshot fiksiranje** v workspace je omejeno (Chrome DevTools MCP filePath je dostopen le v
  temp; workspace PNG kopirani ročno — 3 shuttle so v `docs/assets-f631`).
- Aktivni modul-toggle in med-org-dostop preverbi nista bili zaključeni (NOT VERIFIED gore).

## 11. GLAVNI ODGOVOR

**Ali lahko podjetnik v vseh štirih dejavnostih samostojno uredi spletno stran, shrani podatke,
jih vidi v predogledu in jih objavi, tako da se spremembe dejansko pokažejo na javni strani?**

**DA — PASS.**

Dejansko izvedeno in preverjeno v browserju + bazi za **vse 4 dejavnosti** (mehanik, frizer,
šivilja, čebelar):

1. Lastnik se prijavi (credentials) in odpre **Nastavitve → Izgled in vsebina → Vizualni
   urejevalnik**.
2. Uredi vsebino (naslov, podnaslov, CTA-gumb) — urejevalnik prikazuje **pravilne podatke svojega
   tenanta**.
3. Click **Shrani osnutek** → revolucija v poli `siteContent` (draft), objavljeno ostane nemoteno.
4. Click **Objavi** → `publishedSiteContent` = nov draft in **`publishedContentVersion` 1→2**.
5. **Javna stran (/s/{slug})** prikazuje novo vsebino tudi po ponovnem nalaganju (trajno).

Poleg tega: **mobilni prikaz brez horizontal overflow** v vseh 4; **izolacija** med organizacijami
velja (vsak tenat ohrani svojo vsebino); ob izklopljenih modulih ni mrtvih CTA-jev/praznih sekcij.

Omejitve (iskano): aktivni UI preklop modula in dostop z uporabnikom druge organizacije nista bila
zaključena v tem obsegu (**NOT VERIFIED**); screenshots interaktivnega urejevalnika so delni zaradi
MCP screenshot-časov. Te omejitve ne vplivajo na glavni zaključek — celoten cikel
**Urejanje → Shrani → Predogled → Objava → Javna stran** je bil izveden in preverjen za vse 4
dejavnosti.

---

### Statusi po področjih

| Področje | Status |
|---|---|
| Mobile 4 dejavnosti (overflow 375px) | **PASS** |
| Prijava 4 lastnikov | **PASS** |
| Urejevalnik prikaz pravega tenanta | **PASS** |
| Urejanje + Shrani osnutek (draft) | **PASS** |
| Objava (publishedContentVersion 1→2) | **PASS** |
| Javna stran po reloadu = objavljeno | **PASS** |
| Izolacija org (med 4 tenanti) | **PASS** |
| Moduli: pasivno (ni mrtvih CTA/sekcij) | **PASS** |
| Moduli: aktivni UI toggle krožni test | **NOT VERIFIED** |
| Dostop z uporabnikom druge org | **NOT VERIFIED** |
| Screenshots (mobilni 4) | PARTIAL (mehanik PNG + desktop; ostali prek a11y snapshotov) |

**Zaključek:** F6.3.3 je izveden — glavni cikel E2E je **PASS** za vse 4 dejavnosti. Ustavljam se;
F6.4 ne začenjam.