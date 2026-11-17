# Fresha vs MARKEC — kirurška UI/UX primerjava

**Datum:** 17. 11. 2026
**Pregledano:** Fresha Partners (poskusni račun, prijavljen) + fresha.com (stran za stranke) proti MARKEC produkciji (rcbeautysalon-phi.vercel.app) in dev instanci (demo-salon) tam, kjer produkcija nima objavljenega salona s storitvami.

**Metoda:** vsaka stran je bila odprta kot uporabnik; popisani so bili vsi gumbi, zavihki, filtri, prazna stanja in tokovi. Nobena ugotovitev ni iz kode — vse je iz opazovanja v brskalniku.

---

## 0. Povzetek v treh vrsticah

Fresha je **kalendar + blagajna + tržnica** z neverjetno gosto funkcionalnostjo in zelo malo "praznega prostora"; MARKEC je **platforma za poslovanje po vertikalah** (šiviljstvo, mehanik, lepota) z močnejšim ozadjem (dokumenti, e-računi, delovni nalogi, lastna domena), a z **mnogo tanjšim operativnim jedrom** (rezervacije, blagajna, trgovina) in **slabšo informacijsko arhitekturo** (23 ravne postavke v meniju, skrite strani).

Kjer Fresha zmaguje: hitrost opravila (modalna okna, vse na enem zaslonu, živi povzetek), globina prodaje (paketi, članstva, darilni boni, napitnine, povračila), trženje (email+SMS kampanje z segmenti in statistiko), poročila (64 poročil, 5 nadzornih plošč) in tržnica (zemljevid, iskanje po datumu, rezervacija v 4 korakih z več storitvami).

Kjer MARKEC zmaguje: e-računi in fiskalna logika (SI), dokumenti, delovni nalogi in 9-fazni proces (šiviljstvo), matrika zmogljivosti po dejavnostih, walk-in vrsta, blagajna **brezplačno** (pri Freshi je za plačilnim zidom), podatkovni priključek/API + izvozi, lastna domena in vizualni urejevalnik strani.

---

## 1. Kaj je bilo pregledano in kaj obstaja

### 1.1 Stran za podjetnike (partners)

| Fresha | MARKEC | Opomba |
|---|---|---|
| `/dashboard` | `/dashboard` | oba imata KPI + sezname |
| `/calendar` (dan/teden, ekipa, filtri, waitlist, nastavitve) | `/dashboard/appointments` (Koledar/Seznam/Čakalna vrsta, Dan/Teden/Mesec) | MARKEC **nima stolpcev po osebju** |
| `/sales/*` (10 zavihkov) | `/dashboard/cash-register` + `/dashboard/orders` + `/dashboard/payments` | MARKEC nima dnevnega povzetka prodaje |
| `/clients/list` + segmenti/engage/loyalty/reputation | `/dashboard/customers` + `/dashboard/reviews` | MARKEC reviews **ni v meniju** |
| `/reports` (64 poročil, 5 plošč) | `/dashboard/analytics` (1 stran) | velika vrzel |
| `/marketing/*` (blast, avtomacije, zgodovina) | `/dashboard/marketing` (2 šabloni + darilni boni + zvestoba) | ni SMS, ni segmentnega kampanjskega orodja |
| `/setup` (hub: 4 zavihki, 20 kartic) | `/dashboard/settings` (4 skupine) | MARKEC bolj ploščat, a ima urejevalnik strani |
| `/add-ons`, `/connect` | — (404) | ni tržnice dodatkov |

### 1.2 Stran za stranke (tržnica + rezervacija)

| Fresha | MARKEC | Opomba |
|---|---|---|
| fresha.com: iskalnik + živi števec + priporočila + mnenja | `/` (MARKEC landing, iskalnik v heroju) | MARKEC landing je **prodaja platforme**, ne tržnica |
| `/search?q=` z zemljevidom, datumsko vrstico, filtri | `/podjetja`, `/kategorije/[slug]` | brez zemljevida, brez iskanja po datumu |
| `/a/<slug>` (Photos/Services/Team/Reviews/Portfolio/About) | `/s/<slug>` (Storitve/O nas/Ekipa/Živa vrsta/Kontakt) | MARKEC brez galerije, portfolia, bližnjih salonov |
| `/a/<slug>/booking` — 4 koraki + košarica + skupinsko | `/s/<slug>/booking` — 4 razdelki na eni strani | MARKEC brez košarice (1 storitev) |
| Product store + blagajna v aplikaciji | `/s/<slug>/shop`, `/cart`, `/checkout` | MARKEC pošlje na Stripe Checkout |

---

## 2. Stran za stranke — kaj manjka

### 2.1 Iskanje in seznam (P0)

**Fresha `/search?q=frizer`:**
- "18 venues within map area" — štetje se prilagaja vidnemu delu zemljevida
- Zemljevid z žebljički, gumb **Hide map / Expand map**, Zoom in/out
- Datumska vrstica: `Any day · Today · Tomorrow · Thu 19 · Fri 20 … Tue 1 · Choose date` — iskanje po **prostem terminu**, ne po datumu rojstva podjetja
- Zavihka **Venues | Professionals** (iskanje po osebi, ne le po salonu)
- Filtri: rating čipi `5.0`, `4.9`; `Filters` splošno
- Kartica rezultata: ime, ocena + število mnenj, razdalja (`0.3 mi`), naslov, tip (`Hair Salon`), **3 storitve z trajanjem in ceno**, `View 41 matching services`, značka **Deals**

**MARKEC `/podjetja`:**
- Kartice podjetij brez storitev, brez razdalje, brez "Deals", brez zemljevida, brez datumske razpoložljivosti, brez iskanja po osebju.

**Manjka:** zemljevid, iskanje po razpoložljivosti, iskanje po osebju, prikaz storitev na kartici, razdalja/sortiranje, filtri po oceni/ceni, "Deals" značka.

### 2.2 Stran podjetja (P0)

**Fresha `/a/<slug>` vsebuje:** Photos (galerija z "See all images"), lepljivo podnavigacijo `Photos · Services · Team · Reviews · Portfolio · About`, kruhov drobec `Home › Hair Salons › Slovenia › Ljubljana › …`, ocena + `(13)`, **živo stanje** `Closed - opens on Wednesday at 7:00 AM`, naslov + `Get directions`, `Share`, `Sign in to add to favorites`, kategorije storitev kot čipi (`STRIŽENJE`, `BARVANJE` …), storitev z `15min · from €8.80 · Save up to 20% · Book`, ekipo s slikami in ocenami, mnenja **z navedbo storitve in osebja** (`Prameni cela glava + umivanje in oblikovanje • with Nada`), Portfolio, About, Opening times, Additional information, **Other locations**, **Venues nearby**.

**MARKEC `/s/<slug>`:** Storitve / O nas / Ekipa / Živa vrsta / Kontakt; (pri šiviljstvu) CTA "Oddaj povpraševanje". Ni galerije, portfolia, "bližnjih podjetij", delovnega časa v obliki "odprto/zaprto do …", deljenja, priljubljenih.

**Manjka:** galerija/portfolio, živo stanje odprtja, bližnja podjetja, priljubljene, deljenje, mnenja z atribucijo storitve in osebja, "from" cene z razponom.

### 2.3 Pot rdajevalnega toka (P0)

| | Fresha | MARKEC |
|---|---|---|
| Predstavitev | Modalno okno čez stran podjetja | ločena stran |
| Koraki | `Services → Professional → Time → Confirm` (stepper zgoraj) | 4 oštevilčeni razdelki na eni dolgi strani |
| Košarica | **Da** — stranski panel: izbrane storitve, `Total`, `Continue` | **Ne** — ena storitev na rezervacijo |
| Več storitev | Da (doda več storitev v en termin) | Ne |
| Skupinska rezervacija | `Book group appointment — For yourself and others` | Ne |
| Iskanje | `Try something else` (iskalnik znotraj toka) | Ne |
| Osebje | izbira + "kdor koli" (dynamic assignment) | obvezna izbira točno določene osebe |
| Plačilo | v aplikaciji (polog/celo) | preusmeritev na Stripe Checkout |
| Upsell | priporočila storitev/članstev med rezervacijo | ne |

MARKEC-ov povzetek rezervacije je dober (storitev, osebje, datum, trajanje, cena, polog, "Za oddajo še manjka: …"), promo koda in čakalna lista sta prednost; a tok je **linearen in tog** v primerjavi s Freshinim.

### 2.4 Spletna trgovina za stranke

MARKEC `/s/<slug>/shop` je soliden: filtri `Vse kategorije / Vsi izdelki / Priporočeno`, značke `Izpostavljeno`, `Akcija`, precrtana cena, `z DDV`, `Dodaj v košarico`, `Podrobnosti`.

Manjka: hitri pogled (quick view), izbira velikosti/različice, zaloga "samo še 2", priporočila "kupci so kupili tudi", dostava/prevzem izbira v košarici, darilni bon kot izdelek, ocene izdelkov.

---

## 3. Stran za podjetnike — kaj manjka

### 3.1 Navigacija (P0, poceni popravek)

- **Fresha:** ikonski steber (12 ikon) + letaki: `Team → Team members · Scheduled shifts · Timesheets · Pay runs`, `Setup` hub z zavihki `Settings · Add-ons · Online presence · Marketing · Other` in 20 karticami. Globalno **Search**, `Performance insights`, `Notifications`, profil.
- **MARKEC:** 23 postavk v enem stolpcu, brez grupiranja in brez iskanja:
  `Nadzorna plošča, Analitika, Stranke, Marketing, Dokumenti, Elektronski računi, Blagajna, Plačila, Osebje, Vloge, Nastavitve, Walk-in vrsta, Storitve, Izdelki, Kategorije, Paketi, Popusti, Delovna naročila, Spletna naročila, Obrazci, Evidence, Šiviljstvo, Projekti`.
- **Skrite strani:** `/dashboard/reviews` (Mnenja strank) in `/dashboard/waitlist` obstajata, a ju v meniju ni. `/dashboard/delivery`, `/dashboard/integrations`, `/dashboard/reports`, `/dashboard/taxes`, `/dashboard/billing` ne obstajajo (404).

**Priporočilo:** 5 skupin (`Prodaja`, `Stranke`, `Katalog`, `Ekipa`, `Nastavitve`) + globalno iskanje (⌘K) + vpis `Mnenja` v meni.

### 3.2 Koledar / termini (P0)

Fresha: dnevni pogled z **vrsticami po osebju in virih**, `Scheduled team`, `Visibility Filters`, `Waitlist`, `Calendar settings`, gumb `Add` (na klik v mrežo), "performance insights" v glavi.

MARKEC: `Upravljanje terminov` s KPI (Današnji termini, V čakanju na potrditev, Zaključeno danes, Prihodki danes), zavihki `Koledar | Seznam | Čakalna vrsta`, `Danes`, `Dan/Teden/Mesec`, dnevna vrstica z števci, mreža 8:00–19:00 — **en stolpec, brez osebja**.

Manjka: stolpci/lane po osebju, filtriranje po osebju, vlečenje terminov, blokiran čas (odmor, dopust), barvanje po kategoriji, prikaz "processing time", hitro urejanje na klik, zaključek + plačilo iz kartice termina.

`Nov termin` je pri MARKECu **cela stran** z zaporednimi odvisnimi polji (stranka → ime/telefon/e-pošta → storitev → osebje → datum → ura → opombe). Fresha: modalno okno, iskanje stranke, več storitev, takojšnja razpoložljivost. MARKEC = 6 odvisnih odločitev preden vidiš termin.

### 3.3 Blagajna in prodaja (P0)

| Fresha `/sales/*` | MARKEC |
|---|---|
| `Daily sales summary` — povzetek po tipu postavke (storitve, dodatki, izdelki, dostava, darilni boni, paketi, članstva, zamudnine, ne-prihod), `Refund qty`, `Gross total`, `Total Sales` | — (ni dnevnega povzetka) |
| `Cash movement summary` — po tipu plačila: gotovina, drugo, unovčitve bonov, `Payments collected`, `Of which tips` | delno: `Blagajna` (odprtje z začetnim fondom, prodaja, stroški, pričakovano/dejansko/odstopanje) |
| `Register` (odpiranje/zapiranje, petty cash) | **Da** — MARKEC ima in je brezplačno (Fresha za plačilnim zidom) |
| `Appointments · Sales · Payments · Sold items · Gift cards sold · Packages sold · Memberships sold · Product orders` | delno (`Spletna naročila`, `Plačila`) |
| Nastavitve: `tax rates`, `receipts` (oblikovanje računa), `tipping`, `service charges`, `gift cards`, `payment methods` | `Elektronski računi` (SI prednost), a brez UI za napitnine/storitvene stroške/oblikovanje računa |

**Manjka:** dnevni povzetek prodaje, povračila (refunds) kot tok, napitnine, storitveni pribitki, prodaja paketov/članstev/bonov skozi blagajno.

### 3.4 Stranke (CRM) (P1)

Fresha `Clients`: zavihki `Clients list · Client segments · Engage · Client loyalty · Online reputation`; tabela `Client name · Mobile number · Reviews · Sales · Created at` s sortiranjem, `Filters`, izbira vrstic → `Bulk edit` / `Delete`, `Import your client list` (CSV) z obrazložitvijo koristi.

MARKEC `Stranke`: dodajanje/urejanje, oznake (segmenti), GDPR privolitev, iskanje. Ni uvoza, ni množičnih dejanj, ni segmentov kot samostojne strani, ni "zvestobe" kot strani (je zavihek v Marketingu), ni profila stranke s časovnico obiskov/porabe.

### 3.5 Katalog (P1)

Fresha: kategorije storitev z vrstnim redom, dodatki k storitvam (`Service add-ons`), `Display processing time`, cene "from", članske cene, akcije v rezultatih iskanja.

MARKEC: Storitve, Kategorije, Izdelki, Paketi, Popusti — dobri temelji, a brez dodatkov k storitvi, brez "processing vs service time", brez članskih cen, brez razvrščanja kategorij z vlečenjem.

### 3.6 Ekipa (P1)

Fresha: `Team members · Scheduled shifts · Timesheets · Pay runs`, dovoljenja, kompenzacije, dopust, `time-off`.
MARKEC: `Seznam · Urnik · Uspešnost · Plače` + `Vloge`. Ni `Timesheets` (evidentiranje prisotnosti), ni toka za dopust, ni plačilnih ciklov.

### 3.7 Marketing in "reklame" (P0)

Fresha `Marketing`:
- **Messaging:** `Blast campaigns` (email + SMS, ciljanje vseh/segmentov/posameznikov, statistika v realnem času), `Automations` (knjižnica avtomatizacij), `Messages history` (vsi poslani email/SMS/push).
- **Promotion:** `Deals` (kode, flash akcije, promocijske ponudbe), `Smart pricing` (različne cene glede na zasedenost).

MARKEC `Marketing`: dve avtomatski e-pošti (reaktivacija, sledenje po ne-prihodu) z vstavki `{name} {business} {days} {date} {bookingLink}`, število odjavljenih, `Shrani kampanjo`, zavihka `Darilni boni` in `Program zvestobe`.

**Manjka:** SMS kanal, ročne kampanje s segmenti in statistiko (odprtja/kliki so v analitiki, a pošiljanje je omejeno na 2 avtomatiki), knjižnica avtomatizacij (rojstni dan, ponovno povabilo, prošnja za mnenje), zgodovina sporočil, `Deals` s kodami (MARKEC ima `Popusti` — druga logika), dinamične cene po zasedenosti.

### 3.8 Analitika in poročila (P0)

Fresha: **64 poročil** v kategorijah `Sales · Finance · Appointments · Team · Clients · Inventory · Other`, **5 nadzornih plošč** (`Performance`, `Online presence`, `Loyalty`, `AI Concierge`, `Smart Website`), ločeno `Standard` (56) / `Premium` (8) / `Custom` (0), `Favourites`, `Folders`, `Add folder`, `Data connector`, iskanje in `Created by` filter.

MARKEC `/dashboard/analytics`: obdobje (30 dni), KPI (prihodki, termini, naročila izdelkov, stranke, povpraševanja), graf prihodkov (termini/izdelki/vnaprej), najboljše storitve in izdelki, status terminov in povpraševanj (kolobar), uspešnost osebja z napitninami in provizijami, e-poštne metrike (poslano/odprto/klik/prihodek), `Podatkovni priključek` (`API dostop`), `Nov izvoz`.

MARKEC je **dober v enem samem pregledu**, a brez kataloga poročil, brez izbirnikov stolpcev/filtrov na poročilo, brez nadzornih plošč za spletno prisotnost in zvestobo, brez načrtovanega pošiljanja poročil.

### 3.9 Nastavitve (P1)

Fresha `Workspace settings`: `Business setup`, `Scheduling`, `Sales`, `Clients`, `Billing`, `Team`, `Forms`, `Payments` + zavihek `Online presence` (`Marketplace profile`, `Reserve with Google`, `Book with Facebook and Instagram`, `Product store`, `Direct links` s QR) + `Marketing` + `Other` (`Add-ons`, `Integrations`).

Podrobnost, ki jo MARKEC nima: `Scheduling` ima `Time and calendar` (časovni pas, format ure, prvi dan tedna, vir barve termina, prikaz processing/blocked time), `Waitlist appointments`, `Blocked time types`, `Resources`, `Cancellation reasons`, `Appointment statuses`, `Closed periods`, `Dynamic assignment`, `Availability`, `Booking options` (kdo lahko rezervira koga, prikaz ekipe/portfolia/ocen, skupinske rezervacije, upsell, `Important info` pred potrditvijo, e-poštna obvestila), `Service menu` (slike v storitvah, izpostavljene storitve, imena storitev v mnenjih).

MARKEC `Nastavitve`: `🏢 Podjetje · 🎨 Spletna stran · ⚙️ Funkcije · 🔧 Napredek`, objava/umik strani z opozorili ("Uporabljate vzorčne slike"), matrika zmogljivosti (`Spletna trgovina · izbirno`, `Termini in rezervacije, Ocene · izklopljeno` …), poslovni procesi (šiviljstvo: Povpraševanje → Meritve → Predračun → Potrditev → Izdelava …), `Vizualni urejevalnik` in `Klasični obrazec`, `Povežite Google Calendar`.

**Kje je MARKEC slabši:** ni `Resources` (sobe/stoli), ni vrst blokiranega časa, ni razlogov za odpoved, ni statusov po meri, ni "closed periods" (dopust salona), ni `booking options` v tej globini, ni `Reserve with Google` / Facebook / Instagram, ni QR povezav, ni tržnice dodatkov.

**Kje je MARKEC boljši:** vizualni urejevalnik strani (Fresha ima samodejno "Smart Website"), lastna domena, matrika zmogljivosti po dejavnosti, e-računi, dokumenti.

---

## 4. Sistemski UI/UX detajli

| Element | Fresha | MARKEC | Ocena |
|---|---|---|---|
| Gostota | zelo gosta, majhne pisave, veliko podatkov na zaslon | srednja, več praznega prostora | MARKEC izgleda "lepše", Fresha "hitreje" |
| Opravilo v enem oknu | modalna okna za vsa dejanja | mešano: `Nov termin` = cela stran, `Dodaj stranko` = modal | MARKEC neskladen |
| Prazna stanja | akcijsko besedilo: "Make some appointments for sales data to appear" | mešano: "Ni podatkov" / vodeni koraki (materiali) | delno popravljeno |
| Globalno iskanje | da (Search v glavi) | ne | manjka |
| Obvestila | da (Notifications) | da (Obvestila) | enako |
| Pomoč | `Help and support` v nogi + AI Concierge | ne | manjka |
| Mobilna aplikacija | da (banner "Download the app", QR) | ne (samo PWA?) | manjka |
| Več jezikov | da (English (US), lokalizirano) | SL/EN | ok |
| Dostopnost | aria oznake na vseh ikonah (preverjeno) | ikone v meniju imajo besedilo; izboljšano pri meritvah | ok |
| Barvna paleta | belo/sivo + ena akcentna (modra) | belo/bordo + temna tema | ok |

---

## 5. Prioritizirana vrzel (P0 = blokira prodajo)

| # | Vrzel | Kje | Zakaj boli | Ocena dela |
|---|---|---|---|---|
| 1 | Košarica v rezervaciji (več storitev, skupni znesek, en termin) | booking | stranka ne more rezervirati "barvanje + striženje"; izgubljen promet | 3–5 dni |
| 2 | Koledar po osebju (stolpci + filter) | appointments | salon z 5 osebami je neuporaben | 3–4 dni |
| 3 | Dnevni povzetek prodaje + povračila + napitnine | cash-register | lastnik ne ve, koliko je dneva "na koncu" | 2–3 dni |
| 4 | Iskanje po razpoložljivosti na tržnici (datum) | /podjetja | stranka išče "jutri popoldne", ne "salon" | 2 dni |
| 5 | Stran podjetja: galerija, portfolio, bližnja podjetja, deljenje | /s/[slug] | zaupanje in konverzija | 2 dni |
| 6 | SMS kanal + ročne kampanje s statistiko | marketing | opomniki po SMS so standard | 3 dni |
| 7 | Navigacija: 5 skupin + globalno iskanje + Mnenja v meni | sidebar | 23 postavk je neobvladljivo | 0,5 dneva |
| 8 | Zemljevid + razdalja na tržnici | /podjetja | mobilna uporaba | 2 dni |

## 6. Hitri dobitki (P1, malo dela, velik občutek)

1. **`Nov termin` v modal** z iskanjem stranke in takojšnjo razpoložljivostjo (namesto cele strani).
2. **Prikaz 3 storitev na kartici podjetja** v `/podjetja` + `View N services` (podatki že obstajajo).
3. **Živo stanje "Odprto do 19:00"** na strani podjetja (delovni čas je v bazi).
4. **Mnenja v meni** (`/dashboard/reviews` obstaja, ni povezave).
5. **`Deals` značka** na karticah, ko ima podjetje aktivni popust.
6. **Iskanje (⌘K)** po strankah, storitvah, terminih, nastavitvah.
7. **Prazna stanja z akcijo** povsod (vzor: "Začnite z materiali za šivanje").
8. **"Odpri v novem zavihku" za javno stran** iz nastavitev (obstaja `Oglej si stran` — dodaj še v glavo).
9. **Povzetek rezervacije lepljiv** na mobilnem (že delno).
10. **Breadcrumbs** na javni strani podjetja.

## 7. Kar imamo bolje kot Fresha

- **Vertikale onkraj lepote:** šiviljstvo (merilni listi, 9-fazni proces, materiali z zalogo), mehanik, projekti, evidence.
- **E-računi in DDV logika (SI)** — Fresha je globalna in tega ne pokriva.
- **Blagajna brezplačno** — pri Freshi za plačilnim zidom ("INCLUDED IN YOUR PLAN").
- **Dokumenti** (predloge, generiranje) — Fresha nima.
- **Podatkovni priključek / API dostop + izvozi** — Fresha ima `Data connector`, a MARKEC ima to vključeno.
- **Vizualni urejevalnik strani + lastna domena** — Fresha ponuja generirano stran.
- **Matrika zmogljivosti po dejavnosti** — Fresha je beauty-only.
- **Čakalna vrsta (walk-in)** — Fresha ima `Waitlist`, a MARKEC ima tudi fizično vrsto.
- **Brez provizije pri tržnici** (poslovni model).

---

## 8. Česa nisem mogel preveriti (pošteno)

- Fresha **Product store / checkout** (plačilni tok, dostava, vračila) — v poskusnem računu za plačilnim zidom.
- Fresha **Marketplace profile editor**, **Smart Website**, **Add-ons katalog**, **Integrations** vsebina — za plačilnim zidom.
- MARKEC **trgovina/rezervacija na produkciji** sta bili preverjeni na dev instanci (`demo-salon`), ker v produkciji ni objavljenega salona s storitvami; koda je ista.
- MARKEC **Plače / Urnik** vsebina (samo zavihki evidentirani).
