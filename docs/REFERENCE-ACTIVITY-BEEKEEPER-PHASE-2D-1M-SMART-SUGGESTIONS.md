# MARKEC — FAZA 2D-1M — ZAMENJAVA VODENE NAMESTITVE S PAMETNIMI PREDLOGI

> Izvedeno na izolirani bazi `markec_e2e_test` (port 3002, guard user `markec_e2e`). **Nič sheme/migracij; Git
> operacij nobenih; tuj WIP nedotaknjen; skrivnosti ne izpisane.**
> Statusi: PASS/PARTIAL/BLOCKED/NOT VERIFIED.

---

## 1. Dosedanja vodena namestitev (preverjeno v repozitoriju)
- **Full-screen "guided entry" gate** v `src/app/(admin)/dashboard/page.tsx` (`guidedEntryPending`, :91-107) — ko org
  nima `verticalChosenAt`, ni preklopljen (skip) in ni objavljenega, se prikaže SAMO izbira dejavnosti, dashboard pa
  NE je izrisan (blokada workspace-a). **To je tuja neoddojena sprememba (383+/251- diff).**
- **SetupChecklistCard** ("Vodena namestitev", `setup-checklist.tsx` + `lib/profiles/setup-checklist.ts`) — trajni
  vodi k izvedbi, koraki izpeljani iz REALNIH podatkov (services/staff/customers/publish); ne-blokirajoča.
- **Dejstvo iz izolirane baze:** obe svež beginnerski org (`e2e-cebelski-panj`, `svezi-cebeler-2d1l`) imata
  `verticalChosenAt=true` → **gate NE odda** → uporabnik že takoj vstopi na dashboard (preverjeno: vse registracije
  prešle ravno na `/dashboard`, ne na gate). Zato je "takojšen vstop" za normalen tok **že izpolnjen**; gate je
  rele len za redke učbe (registracija brez potrditve vertikale).

## 2. Kaj je spremenjeno
### Nov sistem pametnih predlogov (2D-1M)
- **`src/lib/profiles/smart-suggestions.ts`** (NOV) — čist motor: predlogi izpeljani iz **dejanskega stanja
  podatkov** (org-scoped counts), ne iz privzetega seznama. Beekeeping veriga: postaja→panj→družina→pregled→pridelek
  (vsak korak se pojavi šele, ko je predhodni izpolnjen; izgine/namivi ob opravitvi). Za druge dejavnosti generični
  predlogi (objava, prvi izdelek, prvo naročilo). Capability-aware; limit (3–5); brez server imet.
- **`src/components/dashboard/smart-suggestions-card.tsx`** (NOV) — client kartica: kratek pozdrav + ime dejavnosti,
  opis "zakaj koristno", neposreden CTA (`href`), gumb za skrij (localStorage, brez sheme); **ne blokira ničesar** —
  oko njez workspace dispatch in deluje.
- **Integracija na čebelarski dashboard** (`/dashboard/apiculture`, moja lastna datoteka): `SmartSuggestionsCard`
  izračuna predloge iz `getApicultureOverview` (živi števci) in jih prikaže zgoraj. Ostale funkcije dashboarda
  (števci, izdelki, inventura) nespremenjene.

### Vodena namestitev — sprememba/mertva
- Obvezni full-gate: **ni bilo spreminjano** (tuja WIP v dashboard/page.tsx). Ker pa fresh uporabniki že vstopijo
  neposredno, se normalen tok (registracija → dashboard) **ni spremenil**; aktivnost ostaja dosegljiva prek
  SetupChecklist / Nastavitve (neodstranjeno). **Odstranjevanja** v varovalnem obsegu ni izvedeno (BLOCKED, glej §5).

## 3. Nove komponente predlogov (seznam)
| Datoteka | Vloga |
|---|---|
| `lib/profiles/smart-suggestions.ts` | čista funkcija buildSmartSuggestions (data-derived, org-scoped, beekeeping chain + generic) |
| `components/dashboard/smart-suggestions-card.tsx` | klient kartica (pozdrav + do 4 predlogi + CTA + skrij) |
| `(admin)/dashboard/apiculture/page.tsx` | integracija (izračun predlogov iz getApicultureOverview + prikaz) |
| `tests/smart-suggestions.test.ts` | enotni testi (10) |

## 4. Predlogi se prilagajajo dejanskim podatkom (PASS)
- Beekeeping veriga iz `overview.counts` (apiary/hive/colony/inspection/harvest): pri praznem WS predlaga
  "postaja"; ko je postaja dodana (števec>0), predlog izgine in se pojavi "panj" itn. **Dokazano v unit testih**
  (10/10). V živo: svež WS (`svezi-cebeler-2d1l`, ni evidenc) prikaže "Dodajte panjsko postajo" in "Objavite"; CTA
  vodi na `/dashboard/records#apiary-new`.
- Org-scoped: predlogi temeljijo le na števcih aktualne org (getApicultureOverview = getPermissionOrg scoped);
  nobena podatka druge org se ne bere.
- Druge dejavnosti: motor ima generično vejo (publish/firstProduct/firstOrder) — podprto za vse profile (ni
  čebelarnostno oklepljeno).

## 5. Main dashboard integracija + odstranitev gate — BLOCKED (foreign WIP)
- `src/app/(admin)/dashboard/page.tsx` je **močno spremenjen s tujim WIP** (383+ / 251-). Pri minimiram additive
  patch za namestitev SmartSuggestionsCard na **glavni dashboard** (vse dejavnosti) in za odstranitev/ponožanje
  full-gate-a bi se moralo editovati ta tuji fajl → **izvedba BLOCKED** (po pravili: ne posegaj v tuj WIP brez
  odobritev).
- **Pripravljen minimalni additivni patch** (da bi bil izvedljiv po odobritvi):
  1) v `dashboard/page.tsx` import `SmartSuggestionsCard`, ter ob `overview` podobnim podatkom (iz `getStockSummary`/
     št. izdelkov + živi record counts, če so na voljo) izračunati predloge in jih prikazati nad widgeti; tukaj je
     treba prenijeti deployment števec evidenc (če multiverzijsko) v dashboard.
  2) gate pogoj `guidedEntryPending` obdržati le kot tehnično preusmeritev v Settings/non-blocking poziv (ne
     full-screen blokada).
- Ker je ispolnjeno takojšno vstop za sveže uporabnike dejano, je dodatna vrednost glavnega dashboard predlogov
  omejena na ne-čebelske profile (glavni dashboard je splošen).

## 6. Rezultati testov (desktop + mobilno, na izolirani bazi)
- **Prikaz predlogov (PASS):** svež čebelarski WS → kartica "Dobrodošli · Čebelarstvo" + 2 predloga.
- **Skrij predlog (PASS):** gumb "Skrij predloge" skrije kartico; po novi navigaciji znate prikaz (localStorage).
- **Izvedba predlagane naloge (PASS):** klik "Dodajte panjsko postajo" → `/dashboard/records#apiary-new` (Evidence,
  tab postaje).
- **Samodejna posodobitev predlogov (PASS, unit 10/10):** ob opravitvi koraka (števec>0) veriga predloga izgine /
  se premakne na naslednjega.
- **Mobilno 390×844 (PASS):** kartica + predloge + gumb prioritizirajo, brez preliva; workspace delujoč.
- **Izolacija med org:** predlogi temeljijo na števcih aktualne org (getApicultureOverview org-scoped) — ni
  postruženega uporaba drug-org podatkov (PASS po konstrukciji + unit).
- **Uporabnik uporablja app tut brez predlogov (PASS):** po gizh "Skrij predloge" je dashboard polno uporaben
  (števci/izdelki/inventura).
- **Fresh vstop (PASS):** registracija → dashboard direktno (že prej veljaveno, novi tok nespremenjen).

## 7. Regresija
- **tsc:** čist za nove fajle (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 65 passed (10 novih smart-suggestions + 55 obstoječih: stock, server-schema, checkout, memberships).
- **browser/mobilno:** apiculture z predloge, skrij, CTA, mobile — vse deluje (izolirano).

## 8. Potrditve
1. Nova datoteka/komponente (smart-suggestions motor + kartica + unit testi): DA.
2. Spremenjen le moj lastni `apiculture/page.tsx` (untracked); tuj `dashboard/page.tsx` ni bil posegan (BLOCKED):
   DA.
3. Nič sheme/migracij; Git operacij nobenih: DA.
4. Uporabljeno izključno `markec_e2e_test`: DA.
5. Skrivnosti ne izpisane: DA.
6. `markec_dev`/produkcija nedotaknjena: DA.

**Končni status 2D-1M: PASS (jedro predloge) + BLOCKED (glavni dashboard integracija / odstranitev gatea, foreign
WIP)**
- **PASS:** pametni predlogi sistem (motor + kartica + enotni testi 10/10), prikaz na čebelarskem dashboardu,
  skrij, CTA, dinamika (data-derived), mobilno, izolacija med org, uporabnik neodvisen od predlog.
- **PASS (že prej veljaveno):** fresh registracija → takojšen vstop v dashboard (gate ne odda za normalen tok).
- **BLOCKED:** namestitev predloge na **glavni** dashboard vseh dejavnosti + eksplicitno odstranjevanje full-gate-a
  — zahteva poseg v tuj `dashboard/page.tsx` (odobritev). Minimalni additivni patch pripravljen.