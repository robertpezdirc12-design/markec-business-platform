# MARKEC — celovita analiza projekta in primerjava s podobnimi/boljšimi platformami

**Datum:** 2026-11-25
**Metoda:** (1) neposredno branje kode in konfiguracije v repu `C:/Users/admin/Documents/Qoder/markec-app`; (2) pregled obstoječih internih analiz; (3) spletna raziskava javnih strani in cenikov konkurence; (4) razlikovanje med preverjenim stanjem kode in trditvami dokumentacije.
**Omejitve:** cene in obseg konkurence so geolokalizirane in se spreminjajo; navajam jih kot orientacijo, ne kot revidirane pogodbe. Za Slovenijo je treba pred odločitvijo preveriti lokalne pogoje.

---

## 1. Izvršni sklep

MARKEC ni "še en rezervacijski koledar". Je **multi-tenant operacijski sistem za lokalne storitve**, ki poleg rezervacij pokriva izdelke, dokumente, DDV, delovne naloge, procese, obrazce brez kode, evidence po panogah in per-tenant Stripe. V tem obsegu je **bližje vertikalnemu ERP-ju za mala podjetja** kot pa Freshi, Booksyju ali Treatwellu.

Najbližji konkurent po obliki izdelka je **Fresha**: tržnica za potrošnike plus SaaS za lastnike. Najboljši konkurenti po **pridobivanju strank** so Fresha, Booksy, Treatwell in Mindbody/ClassPass. Nihče izmed njih pa nima MARKEC-ove kombinacije: več panog, delovnih nalogov, procesov, lastne domene in per-tenant Stripea brez platformne provizije.

**Glavna strateška napaka bi bila kopiranje Freshajevega back-officea po vrsticah.** Zmagovalna pot je:

1. najprej odstraniti preostale "lažne" površine in prazne podatke,
2. zgraditi resničen, a **neobvezen** pridobivalni krog,
3. obdržati in poglobiti multi-vertikalno diferenciacijo,
4. AI uvajati počasi in eksplicitno označeno.

Ena poved: **MARKEC naj ne postane slovenska Fresha. Naj postane operacijski sistem za slovenske lokalne storitve, ki ima tržnico — ne pa tržnica, ki ima dodaten koledar.**

---

## 2. Kaj je v projektu preverjeno

### 2.1 Tehnični obseg

| Element | Preverjeno stanje |
|---|---|
| Okvir | Next.js 16.4.6, React 19.2.3, TypeScript 5, Tailwind CSS v4, Radix/shadcn |
| Avtentikacija | NextAuth v5 beta |
| Plačila | Stripe 19, per-tenant Stripe brez env fallbacka |
| Baza | Prisma: 89 modelov, 18 enumov, 3.226 vrstic sheme |
| Poti | 105 `page.tsx`, 14 API `route.ts`, 9 route group |
| Testi | 90 Vitest test datotek, 40 integracijskih `.itest.ts`, 23 Playwright specifikacij |
| CI | E2E job ima `continue-on-error: true`; torej ni trdilo blokade |
| Profili | 36 profilov = 14 imenovanih + 22 uradnih SKD sekcij A–V |
| Moduli | 15 modulov, med njimi rezervacije, izdelki, dokumenti, delovni nalogi, obrazci, čakalna lista, kampanje, e-računi |
| Klasifikacija | SKD 2025: 1.725 vozlov, od tega 678 resničnih listnih dejavnosti; 21 `SKD_AREAS` je internih MARKEC področij, ne uradne SKD sekcije |

### 2.2 Kaj je bilo nedavno izboljšano

V tem sesiji so bile preverjene in izboljšane javne površine:

- mobilna navigacija na marketinških straneh,
- resnična GET iskalna forma na namizju `/podjetja`,
- zložljivi mobilni iskalnik v sticky headerju,
- "Zemljevid dejavnosti" kot vizualni raziskovalec kategorij, ne kot geografski zemljevid,
- 44 px ciljna območja za dotik na ključnih mobilnih poteh,
- odprava horizontalnega preliva pri 390 px,
- pojasnitev arhitekture dveh dreves v `src/lib/marketplace/categories.ts`,
- popravek napačnih številk v `README.md` in `docs/PLAN.md`.

### 2.3 Kaj je v kodi že resnično, čeprav stare analize pravijo nasprotno

Starejša dokumentacija (`docs/KONKURENCA-ANALIZA-2026-11.md`, `docs/FRESHA-vs-MARKEC-KIRURSKA-ANALIZA-2026-11-16.md`) je delno zastarela. Spot-check je pokazal:

- čakalna lista ni več prazna: `appointments/page.tsx` uporablja `getWaitlistEntries` in `WaitlistManager`,
- izvoz podatkov ni več `setTimeout` simulacija: `data-connector.tsx` ustvari URL in prenese datoteko,
- moderacija mnenj uporablja `setReviewVisibility`, ne več samo lokalnega React statea,
- profil zaposlenega kliče `updateStaffSelfProfile`,
- marketinške številke prihajajo iz `overview`, ne iz trdno zakodiranih 12/45/23,
- App Download sekcija pošteno pove "Aplikacija v pripravi", ko ni pravih trgovinskih povezav,
- PWA ikone obstajajo v `public/icons/`.

### 2.4 Kaj je še vedno odprto ali šibko

| Področje | Stanje | Dokaz / opomba |
|---|---|---|
| Marketplace podatki | Kritično | `src/data/marketplace-snapshot.json`: `generatedAt: null`, `businesses: []`, `stats` ničelni. Iskanje deluje, a nima kaj prikazati. |
| Dashboard poročila | Šibko | `dashboard/page.tsx` še vedno podaja `thisWeek: 0`, `lastMonth: 0`, `customers: {total: 0...}`, `services: {top: []}`. |
| Analytics kampanje | Šibko | `dashboard/analytics/page.tsx` podaja `campaigns={[]}`, `totalRevenue={0}`, `totalSent={0}`. |
| Obvestilni zvonec | Dekoracija | `components/admin/header.tsx`: `BellIcon` brez `onClick` in brez panela. |
| E-računi | Delno | Shema izrecno pravi "SAMO vmesnik (brez realnega pošiljanja)" in "pošiljanje pozneje". Oblika in validacija obstajata, dostava ne. |
| Dvosmerna sporočila | Ni | Obstaja transakcijska e-pošta in reception chat, ne pa enoten inbox SMS/e-pošta/WhatsApp. |
| Card-on-file | Ni | Pologi so pravilno izvedeni, kartice na datoteki ni. |
| AI | Ni | `Generate with AI` je pošteno označen kot prihajajoč. To je trenutno v redu; pokvariti ga ne smemo. |
| E2E v CI | Ni trdo | `continue-on-error: true` pomeni, da testi lahko rdeči ne da bi blokirali združitev. |
| PWA screenshots | Manjkajo | Manifest jih navaja, `public/screenshots/` ne obstaja. Za namestitev niso ključni, za kakovost predstavitve pa. |

---

## 3. Najpodobnejše in boljše platforme na spletu

### 3.1 Primerjalna matrika

| Platforma | Model | Najmočnejša stran | Monetizacija | Kaj pomeni za MARKEC |
|---|---|---|---|---|
| **Fresha** | Tržnica + SaaS, lepota/wellness | Pridobivalni krog: marketplace, Google, Facebook, Instagram, ocene, portfolio, AI concierge | Naročnina + transakcijske pristojbine + enkratna provizija za nove stranke iz tržnice; viri se razlikujejo glede natančne stopnje | Najbližji konkurent. Kopirati **krog**, ne back-officea in ne obvezne provizije. |
| **Booksy** | Tržnica + SaaS, lepotno/barber | Mobilna aplikacija in push-first dnevni ritem lastnika; močan consumer reach | Ravna naročnina + neobvezen Boost (~30 % v nekaterih virih) | Dokaz, da je marketplace lahko **neobvezen**. Kopirati mobilni ritem, ne vezanosti na tržnico. |
| **Vagaro** | All-in-one SaaS + free listing | Širina: obrazci, payroll, MySite, AI vsebine, waitlist | Osnova + dodatki; oglaševanje neobvezno | Podoben "vse v enem", a plitvejši po panogah. MARKEC ga lahko premaga z globino procesov. |
| **Treatwell** | Tržnica, zahodna Evropa, lepota | Močno odkrivanje v mestih | Visoka provizija (viri navajajo okoli 35 %) | Prikazuje tveganje tržnične odvisnosti. Ne kopirati ekonomskega modela. |
| **Mindbody / ClassPass / Playlist** | Fitness, razredi, članstva | Najmočnejši ekosistem za razrede in ponovne rezervacije; ClassPass kot kanal povpraševanja | SaaS + omrežje/partnerstvo | Če MARKEC razširi fitness, mora imeti razrede in članstva, ne le termine. |
| **Square Appointments** | Plačilno vodeno naročanje | "Interest → checkout", add-ons, invoice ob terminu, card-on-file | Brezplačen osnovni sedež, plačljive nadgradnje | Kopirati atomarno izračunavanje cene/časa pri dodatkih in potrditev plačila. |
| **Boulevard / Mangomint / Zenoti** | SaaS-first, premium | Kakovosten UX, enterprise, analitika; Zenoti tudi globalni enterprise | Naročnina, malo ali nič tržničnega pridobivanja | Dokaz, da se da uspeti brez tržnice. MARKEC ima podobno "lastna stran, lastni ključi" zgodbo, a za več panog. |

### 3.2 Kje so drugi objektivno naprej

1. **Pridobivanje strank.** Fresha, Booksy in Treatwell imajo milijone obiskov, lokalne SEO strani `storitev × mesto`, ocene, portfelje in vstopne točke iz družbenih omrežij. MARKEC ima tehnično iskanje, a prazen snapshot.
2. **Mobilna izkušnja.** Fresha in Booksy imata resnični aplikaciji z visokimi ocenami in pushom. MARKEC ima odzivni splet in delujoč web-push, ne pa objavljene aplikacije.
3. **AI.** Fresha ima AI concierge, AI opise in pametno segmentacijo; Vagaro in Square imata AI vsebine/sporočila. MARKEC ima pošten "coming soon", kar je v redu, a zaostaja.
4. **Dvosmerna komunikacija.** Fresha 2026 združuje SMS/e-pošta/WhatsApp v en inbox. MARKEC ima ločeno transakcijsko pošto in reception chat.
5. **Ocene in ugled.** Fresha zapre zanko: po obisku pozove k oceni, ponovni rezervaciji in napitnini. MARKEC ima model ocen, a šibko javno uporabo in moderacijsko zgodovino.
6. **Enterprise zrelost.** Fresha navaja ISO 27001, ISO 9001, GDPR, HIPAA; Zenoti in Mindbody sta močni na globalnih verigah. MARKEC ima močno tenancy in varnostno logiko, ne pa teh certifikatov ali uradnih SLO-jev.
7. **Operativna disciplina.** Pri vodilnih platformah je "danes naredi" vmesnik koledar, ne statusna plošča. Fresha default landing odpre koledar; MARKEC odpre dashboard s številnimi karticami.

### 3.3 Kje je MARKEC objektivno naprej

1. **Več panog, ne le lepota.** 14 imenovanih profilov + 22 SKD sekcij; terminologija se prilagodi panogi. Fresha in Treatwell sta strukturno lepotni.
2. **Delovni nalogi in procesi.** Avtoservis, vulkanizer, čebelar, šivilja — evidence, serije, vozila, mere in validirani prehodi. To konkurenca nima.
3. **Obrazci brez kode.** MARKEC ima per-tenant urejevalnik z verzijami; konkurenca ima večinoma fiksne obrazce.
4. **Per-tenant Stripe.** Platforma ne vidi najemniškega denarja. To je močan prodajni argument proti 20–35 % provizijskim modelom.
5. **Slovenska fiskalna realnost.** DDV na izdelku, številčenje dokumentov po najemniku, UBL/e-računska priprava. Tuje platforme tega nimajo izvorno.
6. **Poštena UX filozofija.** Fail-closed dostopi, grace politika brez brisanja podatkov, jasne oznake "prihaja" namesto lažnih gumbov — če to ohranimo.
7. **Lastna domena in bela oznaka.** Za razliko od tržnic lahko najemnik resnično gradi svojo blagovno znamko.

---

## 4. Pomembna strateška ugotovitev: dve drevesi, ne ena kategorizacija

Vprašanje "1.725 dejavnosti, 21 področij" je bilo upravičeno nerazumljivo. Pravilna razlaga:

- **Zaledje:** SKD 2025 je državni standard, različica NACE Rev. 2.1. Ima 1.725 vozlov hierarchije, od katerih je 678 resničnih listnih dejavnosti. To je primerno za register, davke in statistiko.
- **Preslikava:** polje `verticals` je N:N plast brez lastne kode. Povezuje SKD z uporabniškim svetom.
- **Prednja stran:** 14 kuriranih MARKEC kategorij za iskanje in odkrivanje. 21 `SKD_AREAS` je internih področij in **ni** uradnih SKD sekcij; uradne so A–V, torej 22.

To je isti vzorec kot pri Taobao, Yelp ali Google: stroga klasifikacija v ozadju, enostavna taksonomija spredaj. Tega vzorca ne spreminjajte.

**Zemljevid dejavnosti** je zato pravilno izveden kot vizualni raziskovalec kategorij. Geografski zemljevid trenutno ni odgovorna izbira: ni podjetij, ni koordinat, zakonodaja o zemljevidih pa omejuje ponudnike. Če bo kdaj postal smiseln, bo potreboval resnične objave, koordinate in ustrezno licenciranega ponudnika.

---

## 5. Kaj kopirati, kaj ne

### Kopirati

1. **Freshajev pridobivalni krog, ne provizije.** Tržnica → lokalna SEO stran → ocene/portfolio → rezervacija → poziv k oceni → ponovna rezervacija.
2. **Booksyjevo mobilno naravo.** Lastnikov dan v enem pogledu: koledar, novi termini, odpovedi, čakalna lista. Pri nas lahko najprej kot PWA digest.
3. **Squareov "interest → checkout".** Dodatek naj v atomu prešteje ceno, trajanje in razpoložljivost; ob odpovedi naj čakalna lista dobi enoklikovno povezavo do rezervacije.
4. **Freshajevo pošteno AI oznako.** AI se mora vedno predstaviti kot AI. To je že del naše filozofije.
5. **Koledar kot landing za lastnika.** Dashboard naj ostane za status, a prva akcija dneva naj bo koledar.
6. **Kontekstni drawer namesto dolgih strani.** Nastavitve koledarja, čakalna lista in hitri pregledi naj ostanejo v kontekstu.

### Ne kopirati

1. **Obvezne tržnične provizije.** "Marketplace optional" je močnejši 2026 model in se bolj ujema z per-tenant Stripeom.
2. **64 poročil in payrolla kot prioritete.** To je zrelo podjetje, ne zagon.
3. **Lažnih številk in mrtvih gumbov.** To je najhitrejši način, da izgubimo edino prednost pred Fresho — zaupanje.
4. **Geografskega zemljevida brez podatkov in licence.**
5. **SKD drevesa v potrošniškem vmesniku.** 678 listnih dejavnosti uporabnika preobremeni.

---

## 6. Priporočeni vrstni red

### P0 — integriteta in resnični podatki

1. Napolniti `marketplace-snapshot.json` iz resničnih objavljenih najemnikov. Dokler je prazen, `/podjetja` ni tržnica, ampak ogrodje.
2. Priključiti `ReportsDashboard` na resnične metrike namesto ničel.
3. Priključiti `CampaignAnalytics` na resnične kampanje.
4. Zvonec v admin headerju narediti funkcionalen ali ga odstraniti.
5. E-računom jasno povedati "pripravljeno za pošiljanje" ali implementirati resnično dostavo.
6. E2E job odstraniti iz `continue-on-error`, ko je stabilen.

### P1 — pridobivalni krog

1. Resnične ocene s števcem in pozivom po obisku.
2. Portfolio, označen s storitvijo, z direktnim skokom v rezervacijo.
3. Vstopne točke Google Business Profile, Facebook in Instagram.
4. Popraven PWA manifest in namestitveni poziv.
5. Card-on-file za odpovednine, z zakonsko pregledanimi pogoji.
6. Čakalna lista z enoklikovno ponudbo termina.
7. Neobvezna marketplace provizija samo za novo stranko, pridobljeno prek MARKEC tržnice, z jasnim pravilom "ko je stranka tvoja, je tvoja".

### P2 — diferenciacija in AI

1. Virtualna vrsta za avtoservise in vulkanizerje; evidence vozil in gum.
2. Sledljivost serij za čebelarje; mere in zaključki za šivilje.
3. Pošten AI pomočnik z eksplicitno oznako, najprej za opise storitev in odgovore na ocene.
4. Revizijski dnevniki, SLO in priprava na GDPR/ISO dokumentacijo za večje najemnike.
5. Razredi in članstva, če se odpremo fitness vertikali.

---

## 7. Kako meriti uspeh

| KPI | Cilj |
|---|---|
| Objavljeni najemniki v snapshotu | vsaj 50 pred resno tržnično objavo |
| Iskanje → profil | merljiv CTR na `/podjetja` |
| Profil → rezervacija | merljiva konverzija po kategoriji |
| Marketplace pridobljene nove stranke | delež vseh novih strank |
| No-show stopnja | znižanje z card-on-file in opomniki |
| Ponovna rezervacija v 90 dneh | ključni indikator zadržanja |
| Lastniška aktivacija v 7 dneh | koledar, storitev, prva rezervacija |
| Integriteta | nič lažnih gumbov, nič trdnih številk v UI |

---

## 8. Viri

### Lastna koda in dokumentacija

- `package.json`, `prisma/schema.prisma`, `src/app/`, `src/components/`, `src/lib/marketplace/categories.ts`
- `src/data/marketplace-snapshot.json`
- `README.md`, `docs/PLAN.md`
- `docs/KONKURENCA-ANALIZA-2026-11.md`
- `docs/FRESHA-vs-MARKEC-KIRURSKA-ANALIZA-2026-11-16.md`
- `docs/FRESHA-ANALIZA-VMESNIKA.md`

### Spletni viri, uporabljeni za primerjavo

- Fresha: `fresha.com/for-business`, `fresha.com/pricing`, `fresha.com/for-business/features/marketplace`, `fresha.com/for-business/features/ai-concierge`, `fresha.com/blog/Up-Next-2026`
- Booksy: `biz.booksy.com/features`, `biz.booksy.com/whats-new`
- Vagaro: `vagaro.com`, javni ceniki in waitlist dokumentacija
- Treatwell: javne poslovne strani in pogoji tržnice
- Mindbody, ClassPass, Playlist: javne objave o ekosistemu razredov in združitvah
- Square Appointments: `squareup.com/us/en/appointments`
- Boulevard, Mangomint, Zenoti, GlossGenius: javne strani izdelkov in cen

---

## 9. Končna ocena

MARKEC ima **boljši temelj, a šibak pridobivalni krog**. Fresha ima **močnejši pridobivalni krog, a ozek in provizijski poslovni model**. Zato zmaga ne bo prišla iz kopiranja Freshinih 64 poročil ali Booksyjeve aplikacije, ampak iz kombinacije:

**resnični podatki + poštena UX + lastniška lastnost stranke + multi-vertikalni procesi + neobvezna tržnica.**

To je pozicija, ki je nobeden od analiziranih konkurentov trenutno ne zaseda.

---

## Dodatek A — lokalni demo podatki

Ker v projektu ni resničnega uporabnika, javna tržnica ostaja pošteno prazna. Za lokalno vizualno preverjanje uporabite:

```bash
pnpm db:seed:demo
```

Seed ustvari determinističnega najemnika `demo-salon`. Ta je že po obstoječih pravilih izključen iz:

- javnega snapshot-a (`scripts/generate-marketplace-snapshot.mjs` filtrira `demo-`, `test-`, `qa-` in testne domene),
- `sitemap.xml` (`isInternalTenantSlug`),
- produkcijskega ponovnega seed-a (fail-safe zahteva `SEED_*_PASSWORD`, ko teče v produkciji).

Demo podatki so torej namenjeni izključno lokalnemu/statusnem preverjanju vmesnika, ne pa kot nadomestilo za resnične objave.
