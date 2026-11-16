# Fresha vs. MARKEC — kirurška primerjalna analiza

**Datum:** 2026-11-16 · **Obseg:** workflowi, vmesniki, UI/UX, funkcionalna pokritost, **poštenost izvedbe**
**Metoda:** (1) živ fetching javnih strani `fresha.com/sl`, `/for-business`, `/pricing`, `/for-business/features/marketplace`, `/for-business/features/ai-concierge`, bloga *Up Next 2026*; (2) obstoječa detektorska analiza partnerskega vmesnika v repu (`docs/FRESHA-ANALIZA-VMESNIKA.md`, 2026-11-15, različica 2.8.13424); (3) **neposredno branje kode MARKEC** — vsaka trditev o našem projektu ima navedeno pot in številko vrstice; (4) navzkrižno preverjanje s `docs/KONKURENCA-ANALIZA-2026-11.md`.

> **Omejitve, povedane vnaprej (poštenost):**
> - V partnerski vmesnik (`partners.fresha.com`) se **nisem prijavil**; podrobnosti o njem izhajajo iz včerajšnje detekcije v repu in so označene z `[detekcija]`.
> - Cene so bile pridobljene z geo-lokalizacijo v **SGD** (verjetno zaradi lokacije fetching strežnika). Za Slovenijo bodo zneski v EUR — **relativna struktura** (naročnina, provizija, doplačila) je prenosljiva, absolutni zneski ne.
> - `fresha.com/sl` je pri prvem poskusu vrnil `Bad Request`; uspešen je bil drugi entry point. Vsebina strani `/sl` je prikazovala **singapurske** lokale — verjetno geolokacijski fallback, ne dokaz o slovenski ponudbi.
> - Številke o obsegu se med Freshajevimi lastnimi stranmi razlikujejo (130.000+ partnerjev na `/sl`, 120.000+ v FAQ `/pricing`, 140.000+ na marketplace strani). Navajam jih kot **marketing trditve**, ne kot revidirane podatke.

---

## 1. Izvršni sklep (preberi to, če preberiš samo en oddelek)

**Fresha ni "boljši rezervacijski sistem". Je dvostranska platforma z letalsko natančnim pridobivalnim strojem, ki ga MARKEC nima — in MARKEC je na papirju že skoraj vse, kar Fresha ima, a na več ključnih mestih **prikazuje funkcionalnost, ki v resnici ne deluje**.**

Tri ugotovitve, ki odločajo o vsega ostalega:

1. **Kategorijska razlika.** Fresha = *marketplace (B2C) + SaaS za lepoto (B2B)*. MARKEC = *white-label SaaS za 11 panog + šibak imenik*. Primerjava "kdo ima več gumbov" je zavajajoča. Pravi konkurenčni lok je **Freshajev pridobivalni krog** (tržnica + Google/FB/IG + aplikacija + ocene + AI receptor), ne njegov koledar.

2. **Največji problem MARKEC ni manjkajoča funkcija, ampak lažna.** V kodi sem neposredno potrdil vsaj **11 površin**, ki uporabniku sporočajo uspeh, čeprav se nič ni zgodilo: lažna moderacija mnenj, lažni izvoz podatkov, trdno zakodirane številke kampanj, mrtva iskalna vrstica na tržnici, `appStoreUrl = "#"`, QR "placeholder", štirje manjkajoči PWA ikoni, "Moji termini" kaže na neobstoječo pot. To je **v neposrednem nasprotju z lastno filozofijo repa** ("poštena UX, fail-closed, nobene tihe okvare") in je hujše od katerekoli funkcionalne vrzeli — poruši zaupanje, na katerem Fresha gradi ves svoj marketing (ocene, zaupanje, 5★).

3. **MARKEC ima prednost, ki je Fresha ne more hitro kopirati:** 11 panog s terminologijo, matrika zmožnosti, delovni nalogi s procesi, obrazci brez kode, multi-tenant z lastnimi domenami in **per-tenant Stripe** (platforma ne vidi najemniškega denarja). Fresha je v teh dimenzijah strukturno omejen — njegov model temelji na proviziji in lepotni vertikali.

**Priporočilo (ne izvajam ga, samo ugotavljam):** ne posnemati Freshajevega "vsevključenega" back-officea po vrsticah. Najprej **odstraniti lažne površine** (to je najcenejša in najbolj kritična zmaga), potem zgraditi **resničen pridobivalni krog** (iskanje na `/podjetja`, ocene, Google/FB/IG vstopne točke, resnična mobilna namestitev). Šele nato se splača vlagati v 64 poročil, payroll in AI receptorja.

---

## 2. Kaj Fresha sploh je — dve plati istega izdelka

### 2.1 Potrošniška tržnica (`fresha.com/sl`)

Javna stran je ** lokalizirana, a globalno založena**.

| Element | Kaj je dejansko na strani |
|---|---|
| Naslov | *"Fresha - Instantly book salons and spas nearby"* / SL: *"Nemudoma rezervirajte v salonih in wellnessih v vaši bližini"* |
| Hero | *"Rezervirajte lokalne storitve samooskrbe"* + `Skeniraj za prenos` (QR za aplikacijo) |
| Zaupanje | *"Odkrij najbolje ocenene salone, brivce, zdravnike, wellness studie in lepotne strokovnjake, ki jim zaupajo milijoni"* |
| Odkrivanje | Štirje carouseli: `Priporočeno`, `Novi v Freshi`, `Ponudbe`, `Priljubljeno` + `Prejšnji/Naprej` |
| Kartica lokala | Ime, ocena (npr. `5,0 ocena`), četrt/mesto, kategorija, **število mnenj** (npr. `2743 mnenj`), povezava `/sl/a/...` |
| Značke | `Predstavljamo`, `Best in Class`, `Highly Recommended`, `Novo` |
| Social proof | 130.000+ partnerjev · 120+ držav · 450.000+ stilistov · pričevanja iz Londona, NY, Sydneyja, Edinburga … |
| B2B most | Sekcija `Fresha za podjetja` + `Več o tem` + `Odlično 5/5` na 1250+ Capterra mnenj |
| SEO | `Brskajte po kraju`: desetine kombinacij *storitev × država/mesto* (`/lp/en/bt/[kategorija]/in/[lokacija]`) — Avstralija, Bahrajn, Belgija, Brazilija, Danska, Francija, Grčija, Irska, Italija, JAR … |

**Kritična opazka:** slovenska različica strani prikazuje **singapurske lokale** (Orchard, Rochor, Bukit Timah …). Če to ni bil geolokacijski fallback mojega fetching strežnika, gre za resno napako lokalizacije ponudbe — Slovenija dobi prevod, ne pa lokalnega inventarja. Za MARKEC je to **direktna priložnost**: naš `/podjetja` že črpa resnične najemnike iz baze.

### 2.2 Poslovna platforma (`fresha.com/for-business`)

Fresha se trži z **osebnim, ekipnim in enterprise** nivojem:

- *"Manage"* → bookings, sales, clients, locations, team members, advanced reporting and analytics
- *"Grow"* → *world's largest beauty and wellness marketplace*, automated campaigns, referrals, promotional discounts
- *"Get paid"* → payment processing, deposits/full upfront, POS, **daily payouts**, Fresha terminal
- Kvantificirane trditve: `26% More clients`, `89% Fewer no-shows`, `20% More sales`, `290% More tips`, `12% Higher retention`, `392% ROI`, `41% Booked outside business hours`
- Vertikale: salon, barber, nails, spa & sauna, medspa, massage, fitness & recovery, physical therapy, health practice, tattoo & piercing, pet grooming, tanning studio
- Certifikati: **HIPAA, ISO 9001, ISO 27001, GDPR, Security Metrics**
- Migracija: uvoz strank in inventarja, plačljivi migracijski paketi za velike partnerje
- **7-dnevni trial** za ekipe, brez kreditne kartice, brez dolgoročne pogodbe

---

## 3. Workflowi Fresha — kako izdelek dejansko teče

### 3.1 Vstop / prijava `[detekcija]`
- **Magic link** (samo e-pošta) namesto gesla; social: WhatsApp, Google, Apple; neviden reCAPTCHA Enterprise.
- Eno polje naenkrat, črn gumb čez celotno širino, 396px leva poravnava.
- *"Are you customer?"* preklopi na potrošniško aplikacijo — **ena blagovna znamka, dva vstopa**.

### 3.2 Dnevni ritem lastnika `[detekcija]`
- **Default landing = koledar**, ne dashboard. To je najmočnejši UX sklep v celotnem izdelku: lastnik takoj vidi, kaj se dogaja, ne pa "statusne plošče".
- Štirje pogledi: `Day`, `3 day`, `Week`, `Month`; stolpci po članih ekipe; **rdeča črta trenutnega časa**; `Team and resources filters` kot FAB.
- Spodnja navigacija s **5 ikonami**, sredinska `+` za hitro dodajanje: `Calendar · Sales · [+] · Clients · More`.
- `Calendar Views` se odpre kot **modal**, nastavitve (Filters, Waitlist, Personal calendar settings) pa kot **drawer** — kontekst ostane, stran se ne zamenja.

### 3.3 Katalog / storitev `[detekcija]`
- `Search service name` + `Filters` + zavihki kategorij **s števci** (`All categories (4)`).
- Klik na storitev odpre **kontekstni meni**, ne navigacija: `Edit`, `Duplicate`, **`Quick booking link`**, `Create a deal`, `Archive`, `Permanently delete` (arhiviranje ločeno od brisanja).
- Urejanje storitve ima **9 zavihkov**: Basic details · Team members · Resources · Service add-ons · Online booking · Portfolio images · Forms · Commissions · Settings.
- Mikro-detalji: števec znakov `7/255`, `0/1000`, **`Generate with AI`** za opis, `Price type: Free | From | Fixed`, trajanje 5 min → 12 ur, `treatment type` za marketplace iskanje.

### 3.4 Stranke, prodaja, tim, poročila `[detekcija]`
- **Clients:** `Import your client list` banner z eksplicitnim opozorilom o *new client fees* (poslovni model je viden uporabniku), `Select all` za množične akcije, e-pošta neposredno v vrstici.
- **Team:** Team members · Scheduled shifts · **Timesheets** · **Pay runs** — celoten HR/obračun plač.
- **Reports:** **64 poročil** (5 dashboards, 56 standard, 8 premium), mape, `Data connector`;Favourites in Custom kategoriji.
- **Settings:** štiri skupine (Business setup, Scheduling, Sales, Clients, Billing, Team, Forms, Payments) + Online presence (Marketplace profile, Reserve with Google, Book with Facebook/Instagram, Product store, Direct links) + Marketing (Blast, Automations, Deals, Smart pricing, Sent messages, Ratings & reviews).

### 3.5 Pridobivanje strank (`/for-business/features/marketplace`)
- Profil podjetja prikazuje storitve, cene, razpoložljivost; ocene; **portfolio slik, označenih s storitvijo** → klik iz slike direktno v rezervacijo; **profili osebja** v toku rezervacije.
- Vstopne točke: **Fresha Marketplace · Google · Facebook · Instagram · Direct booking links**.
- **Client wallet**: kartice na datoteki, kredit, članstva, loyalty točke — en zakup za ponavljajočo se kupnjo.
- *"Once a client books with you, they're yours"* — po prvi rezervaciji **provizija ne velja več**. Marketplace commission je enkraten, samo za nove stranke.
- Obvestila: takojšnja potrditev, opomniki po e-pošti/pushu, **poziv k oceni, ponovni rezervaciji in napitnini po obisku** — zanka se zapre sama.

### 3.6 AI Concierge (2026, plačljiv dodatek)
- Sprejme klic **v manj kot 2 sekundah**, odgovarja na vprašanja iz lastne baze FAQ, **rezervira/prestavlja/prekliče neposredno v živ koledar** (brez dvojnih rezervacij), večjezično, preusmeri k človeku po pravilih, piše osnutke odgovorov na ocene (samodejno ali po odobritvi).
- **AI se mora vedno predstaviti kot AI — izklopiti tega ni mogoče.** To je zgled "poštene AI UX", ki ga lahko prevzamemo.
- Cena (SGD, geo): sporočila `41.95`/lokacijo/mesec; klici + sporočila `139.95` (200 min vključenih, potem `0.84`/min).

### 3.7 Načrt 2026 (`Up Next 2026`)
Dvosmerna sporočila (SMS/e-pošta/WhatsApp v enem inboxu) · napredna članstva · Fresha Capital (leasing/odplačilo iz prihodka; le UK/US/AU) · AI receptor · novi koledarski pogledi · enkratni paketi · napredni viri (npr. savna) · izboljšan blast z AI segmentacijo · portfelji lokala · **oznake strank** · sledenje stroškom · napredna dovoljenja · boljša analitika · **cilji tima** · ponudbe in računi · napredni obrazci in opombe · **virtualna vrsta in self check-in**.

> Opomba: skoraj vsaka točka zgoraj je v našem `docs/KONKURENCA-ANALIZA-2026-11.md` že zabeležena kot priložnost. Fresha jih je v letu 2026 zapakiral v eno samo "stay close → run smoother → grow revenue" pripoved.

---

## 4. UI/UX vzorci Fresha — kaj je prenosljivo

| Vzorec | Kako ga Fresha izvede | Pomen za uporabnika | MARKEC danes |
|---|---|---|---|
| **Akcija kot landing** | Koledar na `/calendar`, ne dashboard | < 2 s do "kaj moram danes narediti" | `/dashboard` = status/checkliste |
| **Sredinska `+` v bottom nav** | 5 ikon, `+` na sredini | En klik do vnosa, mobilno naravno | Leva stranska vrstica; mobile drawer |
| **Drawer namesto strani** | Nastavitve koledarja, waitlist, wallet | Kontekst ostane, ni izgube mesta | Nastavitve so cele strani; Sheet le za mobilni meni |
| **3×3 grid v `More`** | Home, Clients, Online presence, Catalog, Marketing, Team, Reports, Add-ons, Settings | Vizualno skeniranje 9 področij | Dolg seznam v sidebarju |
| **Gradient "Business wallet"** | Vijolično-roza kartica z `€0` + `View wallet` | Finance kot izdelek, ne kot tabela | Ni |
| **Števci povsod** | `3 clients`, `All categories (4)`, `64 reports` | Takojšnja orientacija | Delno (stat cards na dashboardu) |
| **Kontekstni meni ob kliku** | Storitev = gumb → Edit/Duplicate/Quick link/Archive/Delete | Brez navigacijskega kroga | Klasična pot `/services/[id]/edit` |
| **`Learn more` povsod** | Vsak koncept ima povezavo v Help Center | Samopostrežno učenje | Delno |
| **Prazno stanje z ilustracijo + CTA** | *"No scheduled team members"* + gumba | Ne slepa ulica | Tekstovno `EmptyState`, brez ilustracij |
| **Prenos aplikacije v glavi** | 5★ + `Install` + dismiss ✕ | Lastnikova mobilna navdihnjenost | PWA obljuba brez ikon (glej §5) |
| **Poštena AI oznaka** | *"AI always discloses… cannot be turned off"* | Zaupanje namesto prevare | AI opisi označeni kot `coming soon` |

Vizualno: Roboto, črna primarna, vijolično-roza akcent, bela/sivo ozadje, 8px zaobljeni vogali, rdeč badge za obvestila, rdeča črta za "zdaj". `[detekcija]`

---

## 5. MARKEC — preverjeno stanje kode (ne dokumentacije)

**Obseg (iz kode):** 95 `page.tsx`, 13 API rut, **78 Prisma modelov**, 17 enumov, 51 administrativnih strani, 7 avtentikacijskih, 13 strankovskih, 4 zaposleniške, 13 javnih, 2 tržnični, 2 operatorski.

### 5.1 Kar res deluje (dokaz v kodi)
- Rezervacijski čarovnik: storitev-skozi in osebje-skozi, dodatki, waitlist vnos, opcionalni Stripe polog, vozila za vulkanizer.
- **Transakcijska varnost** (#93): advisory locks, `stripePaymentId @unique`, prepaid dekrement/redemption v eni transakciji.
- **Pologi kot pravilo** (#79): INHERIT/NONE/FIXED/PERCENT, `Math.min` — polog nikoli > cena storitve.
- **Per-tenant Stripe**, brez env fallbacka; ključ se nikoli ne vrne brskalniku.
- **Vloge po meri** z 12 dovoljenji, uveljavljene na akcijah *in* straneh.
- Dinamični obrazci, delovni nalogi s procesi, evidence po razširitvah, zgodovina konfiguracije z rollbackom.
- Dokumenti: ponudbe/računi z zaklenjenimi snapshoti, številčenje po najemniku z row-lockom, DDV.
- SEO: per-tenant sitemap (`ACTIVE + PUBLISHED`, brez internih demo slugov), canonical, hreflang, JSON-LD, GA4 samo v objavljeni strani.
- Push obvestila za lastnika (`web-push`, `PushSubscription`, `push-card.tsx`) — **resnično, ne dekorativno**.
- SL/EN + terminologija po panogi (`businessSingular/In/Genitive`, `{business}` interpolacija).

### 5.2 Kjer koda **ne drži koraka z lastno filozofijo** — neposredno potrjeno

| # | Površina | Dokaz (pot : vrstica) | Kaj se zgodi uporabniku |
|---|---|---|---|
| 1 | **Čakalna vrsta v terminih prazna** | `src/app/(admin)/dashboard/appointments/page.tsx:266` → `<WaitlistManager entries={[]} />` | Zavihek `Čakalna vrsta` vedno prikaže prazno, čeprav `/dashboard/waitlist` hrani resnične vnose. |
| 2 | **Moderacija mnenj je lažna** | `.../dashboard/reviews/page.tsx:41-42` sili `status: "APPROVED"`, `response: null`; `src/components/dashboard/reviews-manager.tsx:87-112` menja samo lokalni React state | Klik "Odobri"/"Odgovori" pokaže toast, a se **nič ne shrani**. Ponovno naloženje vse povrne. |
| 3 | **Izvoz podatkov je simulacija** | `src/components/dashboard/data-connector.tsx:131-146`: `setTimeout(1500)` → `toast.success("Izvoz končan! Prenesite datoteko.")` | **Nobena datoteka ni ustvarjena.** To je najnevarnejša laž v sistemu. |
| 4 | **Marketing številke trdno zakodirane** | `.../dashboard/marketing/page.tsx:43-46`: `VIP: 12, Redne stranke: 45, Nove stranke: 23, totalCustomers: 120, marketingConsentCount: 89` | Lastnik pošilja kampanje na napačne segmente; števec odjavljenih (`overview.unsubscribedCount`) je edini resnični podatek. |
| 5 | **Profil zaposlenega se ne shrani** | `src/components/staff/staff-profile-form.tsx:69-81`: `// TODO: Implement` + `console.log` + `toast.success("Profil posodobljen")` | Zaposleni dobi potrditev o uspehu, podatki so izgubljeni. |
| 6 | **Iskanje na tržnici je mrtvo** | `src/components/marketplace/hero-section.tsx:166-183`: nekontrolirana `<input>`-a,`<Button>` brez `form`/`action`; `.../podjetja/page.tsx` ne bere `searchParams` | Glavni CTA največje pridobivalne površine ne naredi nič. Kategorijske povezave `?kategorija=…` se prav tako ignorirajo. |
| 7 | **Tržnica prikazuje app store prazno** | `src/components/marketplace/app-download-section.tsx:36-37` (`appStoreUrl = "#"`, `playStoreUrl = "#"`), `:142-160` (SVG "QR Code placeholder") | Obiskovalec klikne "Prenesi aplikacijo" in ostane na mestu. Fresha ima tu resnično 5★ aplikacijo. |
| 8 | **PWA manifest ne more namestiti** | `public/manifest.json:13-91`: 8 ikon pod `/icons/*` ne obstaja v `public/`; `screenshots/*.png` ne obstajata; shortcut `/moji-termini` ne obstaja (prava pot `/my-appointments`) | Namestitev PWA je nemogoča ali okvarjena — ne glede na to, da `sw.js` podpira push. |
| 9 | **Dashboard "Poročila" nične** | `.../dashboard/page.tsx:783-809`: `thisWeek`, `lastMonth`, `customers`, `top services/products` prazni/nič | Prvi vtis lastnika je "nimam podatkov", čeprav baza vsebuje resnične termine. |
| 10 | **Analitika vsebuje mock panela** | `.../dashboard/analytics/page.tsx`: `CampaignAnalytics campaigns={[]} totalRevenue={0} totalSent={0}` + `DataConnector` | Glej #3. |
| 11 | **Zvonec za obvestila je dekoracija** | `src/components/admin/header.tsx:139-143`: ikona brez `onClick`, brez panela | Fresha ima badge z neprebranimi pogovori in obvestili (`[detekcija]`). |
| 12 | **E-računi nimajo dostave** | `prisma/schema.prisma`: `EInvoiceChannelConfig` — *"SAMO vmesnik (brez realnega pošiljanja)"*; `EInvoiceReceipt` — *"pošiljanje pozneje"* | Dokument se ustvari, ne odide. Za slovenskega lastnika je to funkcionalna past. |
| 13 | **Tržnica filtrira samo `ACTIVE`** | `src/app/actions/marketplace.ts` vs `src/app/sitemap.ts` | Sitemap izloči `publishState != PUBLISHED` in interne demo sluge; tržnica ne → objavljeni/demo najemniki se mešajo. |
| 14 | **Koledar ne uporablja `salonTz`** | `src/components/dashboard/admin-calendar.tsx`: `salonTz` sprejet, ne uporabljen; oznake `Dan/Teden/Mesec/Danes` trdo v SL | Časovni pas je v rezervacijski logiki pravilen, v prikazu koledarja pa ne. |
| 15 | **Dodatki samo v `service-first`** | `src/components/booking/booking-form.tsx:252-254` | Osebje-skozi tok stranki ne ponudi dodatkov → izguba prihodka. |

### 5.3 Kaj je v dokumentaciji **zastarelo** (ne v kodi)
`docs/KONKURENCA-ANALIZA-2026-11.md:60` pravi, da čakalna lista, kampanje, oznake in push **manjkajo** — to ne drži več: `WaitlistEntry`, `MarketingCampaign`, `CampaignSend`, `MarketingUnsubscribe`, `PushSubscription` in pripadajoče strani obstajajo. Nasprotno pa isti dokument (pravilno) še vedno navaja manjkajoče: dvosmerni inbox, card-on-file, payroll/timesheets, AI, stroške/dobiček.

`docs/FRESHA-ANALIZA-VMESNIKA.md:440-456` gaps so večinoma še vedno točni (4 pogledi koledarja, urejevalnik z devetimi zavihki, 64 poročil, Google/FB/IG, smart pricing, provizije, portfelj, quick link, AI opisi).

---

## 6. Matrika pokritosti — kirurško

🟢 polno · 🟡 delno/lažno · 🔴 manjka · ⚪ ni aplikabilno

| Področje | Fresha | MARKEC | Komentar |
|---|---|---|---|
| Rezervacije + koledar | 🟢 4 pogledi, ekipni stolpci, viri | 🟡 3 pogledi, brez virov, `salonTz` neuporabljen | Razlika srednja |
| Pologi / no-show | 🟢 upfront + cancellation fee | 🟢 pravila + transakcijska varnost; 🔴 card-on-file | **Mi smo v pravilih naprej**, zaostajamo pri kartici na datoteki |
| Čakalna lista | 🟢 auto-notify | 🟡 model + `/dashboard/waitlist` ✅, zavihek v terminih prazen ❌ | Implementirano, a nedosledno vezano |
| Trgovina + inventura | 🟢 retail, low-stock, online store | 🟢 + DDV, črtna koda, `StockMovement` LEDGER | **Mi naprej** |
| Darilni boni / paketi / članstva | 🟢 + client wallet | 🟢 boni+paketi, članstva primitiv; 🟡 wallet | Pariteta z odtenki |
| Napitnine / provizije | 🟡 | 🟢 zapisano enkrat ob COMPLETED | **Mi naprej** |
| Dokumenti / ponudbe / računi | 🟢 2026 | 🟢 zaklenjeni snapshoti, številčenje, DDV; 🔴 e-računi brez dostave | **Mi naprej**, a e-del je past |
| Kampanje / segmenti | 🟢 AI blast, segmentacija | 🟡 resnična avtomatika (#95) + trdne številke v UI | Fresha naprej v AI, mi v poštenosti odjave |
| Dvosmerna sporočila | 🟢 2026 SMS/e-pošta/WhatsApp inbox | 🔴 samo transakcijska e-pošta | **Velika vrzel** |
| Ocene in ugled | 🟢 Google Rating Boost, prompt after visit | 🟡 ocene v bazi, moderacija lažna | **Kritična vrzel** |
| Marketplace / discovery | 🟢 milijoni, 120+ držav, ocene, portfolio | 🟡 `/podjetja` resnični podatki, a iskanje mrtvo, app linki `#` | **Največja strateška vrzel** |
| Google / FB / IG bookings | 🟢 Reserving | 🟡 settings omenjajo GA4/sync, ne pa booking kanalov | Velika vrzel |
| Mobilna izkušnja | 🟢 iOS + Android, 5★, resnična | 🔴 PWA manifest pokvarjen, push deluje | Velika vrzel |
| AI | 🟢 Concierge + AI opisi + smart pricing | 🔴 `Generate with AI: coming soon` | Velika vrzel (a ni pogoj za zagon) |
| HR: timesheets / pay runs | 🟢 | 🔴 (provizije so osnova) | Srednja |
| Stroški / dobiček / cilji tima | 🟢 2026 | 🟡 `/dashboard/costs` obstaja | Mi delno |
| Poročila / BI | 🟢 64 poročil, dashboards, data connector | 🟡 resnični KPI + **lažni izvoz** | Velika vrzel + integriteta |
| Viri per storitev | 🟢 processing/finishing, resources, patch tests | 🔴 | Srednja |
| Virtualna vrsta / self check-in | 🟢 2026 | 🟡 `/vrsta` obstaja, `/walk-in` v dashboardu | Priložnost za naše drive-in panoge |
| **11 panog + terminologija** | 🔴 lepotno/wellness | 🟢 **edinstveno** | **Naša prednost** |
| **Delovni nalogi + procesi** | 🔴 | 🟢 **edinstveno** | **Naša prednost** |
| **Obrazci brez kode** | 🟡 fiksni obrazci | 🟢 per najemnik, verzionirani | **Naša prednost** |
| **Multi-tenant + lastna domena** | 🟡 multi-location, ne lastna domena | 🟢 | **Naša prednost** |
| **Per-tenant Stripe** | 🔴 platforma drži plačila/provizijo | 🟢 **platforma ne vidi denarja** | **Naša prednost** |
| **Fiskalno za SI** | 🔴 | 🟢 DDV, številčenje po najemniku | **Naša prednost** |

---

## 7. Poslovni model — tihi faktor, ki pojasnjuje vse

Freshajeva "zastonj" zgodba se je leta 2026 končala. Živa cenovna stran (SGD, geo):

| Postavka | Independent | Team |
|---|---|---|
| Naročnina | **28.95 / mesec** | **18.95 / član / mesec** |
| Koledar | en stolpec | več stolpcev |
| SMS/WhatsApp | 20 brezplačno, potem `0.10` / SMS | 20 na člana |
| Marketing e-pošta | 50 brezplačno, potem `0.02` | 50 na člana |
| Online/in-person | `3.29% + 0.50` na transakcijo | enako |
| Terminal | od `139` | enako |
| Phone support | 🔴 | 🟢 |

**Dodatki:** AI Concierge `41.95` / `139.95` · Client Loyalty `79.95` · Google Rating Boost `14.95` · Team Connect `4.19`/član · Insights `13.95`/član · Xero `12.95` · **Data Connector `310`/lokacijo** · Smart Website `21.95` · Meta Pixel in GA brezplačno.

**Marketplace provizija:** stran `/pricing` pravi *"one-time fee applied to brand new clients who discover your business via the Fresha marketplace"*, marketplace stran pa *"small commission only applies to new clients"*. Natančen odstotek na teh straneh ni razkrit — vira se **ne ujemata v formulaciji**, zato številke ne navajam. Pomembno je načelo: **stara stranka je lastnikova, nova iz tržnice je plačana enkrat**.

**Strateški sklep:** Fresha je zamenjal "brezplačno" z "naročnina + provizija + dodatki". To je **naša najboljša prodajna linija**: MARKEC ima FREE/PRO/SCALE register, grace politiko (brez brisanja podatkov ob neplačilu) in per-tenant Stripe brez platformne provizije. Lastnik, ki je leta 2025 prišel na Fresha zaradi "zastonj", je leta 2026 **razočaran uporabnik z veliko migracijsko bolečino** — točno tisti, ki mu naša "tvoja stran, tvoji ključi, tvoja cena" zveni kot rešitev.

---

## 8. Kaj bi bilo kirurško najbolj smiselno (ugotovitev, ne izvedba)

**Faza A — integriteta (najvišji ROI, najnižji strošek).** Odstraniti ali implementirati 11 točk iz §5.2. Priority: #3 (lažni izvoz), #2 (lažne ocene), #5 (lažni profil), #4 (napačni segmenti), #6 (mrtvo iskanje), #8 (PWA). vsak od teh je v resnici **dovolj majhen, da se da popraviti v eni nalogi**, a vsak pokvari zaupanje — ki je edino, kar Fresha prodaja.

**Faza B — pridobivalni krog.** Resno iskanje na `/podjetja` (parametre že podpira `getMarketplaceBusinesses`, stran jih ne bere), filtriranje po `PUBLISHED`, resnični oceni in števec, portfolio označeno s storitvijo, **Google/FB/IG vstopne povezave**, popraven PWA manifest. To je edini način, da "marketplace" pri nas ni fasada.

**Faza C — diferenciacija, ne kopiranje.** Ne graditi 64 poročil in payrolla zato, ker jih ima Fresha. Graditi tisto, kar izhaja iz naših 11 panog: virtualna vrsta za vulkanizerje in avtoservise, evidence vozil/gum, sledljivost serij za čebelarje, storitveni procesi z validiranimi prehodi. To je Fresha **strukturno ne more** ponuditi brez preoblikovanja poslovnega modela.

**Faza D — poštena AI.** Če dodamo AI opise ali receptorja, označimo eksplicitno (Freshajev vzorec: *"cannot be turned off"*). Naš `Generate with AI: coming soon` je trenutno pošten — ne pokvariti tega z "tiho" generacijo.

---

## 9. Viri

- `https://www.fresha.com/sl` · `https://www.fresha.com` (pridobljeno 2026-11-16; `/sl` je sprva vrnil `Bad Request`)
- `https://www.fresha.com/for-business`
- `https://www.fresha.com/pricing` (SGD geo-različica)
- `https://www.fresha.com/for-business/features/marketplace`
- `https://www.fresha.com/for-business/features/ai-concierge`
- `https://www.fresha.com/blog/Up-Next-2026` (posodobljeno 2026-01-14)
- Repo: `docs/FRESHA-ANALIZA-VMESNIKA.md` (2026-11-15, različica 2.8.13424) · `docs/KONKURENCA-ANALIZA-2026-11.md` (2026-11-04) · `docs/REVIZIJA-2026-11-11.md` · `README.md`
- Neposredno branje kode: poti in številke vrstic v §5.2 (preverjeno 2026-11-16). **Brez sprememb katerekoli datoteke aplikacije.**

---

*Raziskava je bila izključno bralna. Nobena produkcijska datoteka, shema ali konfiguracija ni bila spremenjena.*
