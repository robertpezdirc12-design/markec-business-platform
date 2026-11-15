# 🔍 Fresha Partner — Detektivski pregled vmesnika
**Datum:** 2026-11-15 | **Različica:** 2.8.13424 | **URL:** partners.fresha.com

---

## 1. ARHITEKTURA IN TEHNOLOGIJA

| Podrobnost | Vrednost |
|-----------|----------|
| **Tip aplikacije** | SPA (Single Page App) — React (`createRoot`) |
| **API** | GraphQL (`partners-api-gateway.fresha.com/graphql`) |
| **Feature flags** | Unleash (`unleash-proxy.fresha.com`) — A/B testiranje |
| **Analitika** | Datadog + Amplitude + Sentry + Meta Pixel + TikTok Pixel + Bing Ads |
| **Session recording** | Hindsight (`hindsight-ingest.fresha.com`) — snemanje sej |
| **Varnost** | Google reCAPTCHA Enterprise (neviden) |
| **CDN** | `cdn-partners.fresha.com` (assets) |
| **Geolokacija** | `refresh.fresha.com/geolocation` — zazna državo (SI) |
| **Push obvestila** | `staffNotificationsUnreadCount`, `CustomerConnect_unreadConversationsCount` |
| **Font** | Roboto (Google Fonts) |

---

## 2. PRIJAVNA STRAN (`/users/login`)

### Vizualna organizacija
- **Layout:** leva poravnana oblika (396px), minimalistična
- **Logotip:** Fresha zgoraj levo, brez navigacije
- **Naslov:** "Fresha for professionals" + "Create an account or log in"
- **Email polje:** SAMO email → magic link tokokrog (pošlje kodo)
- **Gumb "Continue":** črn, celotna širina
- **Social login:** WhatsApp, Google, Apple
- **reCAPTCHA:** neviden (enterprise)

### UX vzorci
1. **Magic link namesto gesla** — varneje, manj trenja
2. **Eno polje naenkrat** — ne cela forma
3. **WhatsApp login** — zanimivo za salone (mobilni uporabniki)
4. **"Are you customer?"** → povezava na customer app

---

## 3. GLAVNI VMESNIK — KOLEDAR (default landing)

### 3.1. Vrhnja vrstica (Header)
| Element | Lega | Opomba |
|---------|------|--------|
| **Download app banner** | vrh | 5★ ocena + "Install" gumb + dismiss ✕ |
| **Hamburger (Calendar Views)** | levo | odpre modal z nastavitvami pogleda |
| **Datum (Sun, Nov 15)** | levo | dropdown za izbiro datuma |
| **Fresha Connect** | desno | ikona (verjetno integracije) |
| **Obvestila (🔔)** | desno | z rdečo oznako (badge) |
| **Profil (RP)** | desno | avatar z začetnicami |

### 3.2. Koledar (Calendar Grid)
- **Časovna os:** 00:00–23:00 (ure na levi, 48px široka)
- **Stolpci za člane ekipe:** avatar + ime na vrhu vsakega stolpca
- **Časovnica:** trenutni čas rdeča črta (22:57)
- **Prazno stanje:** "No scheduled team members" + CTA gumba
- **Gumb "Team and resources filters"** (desno spodaj) — FAB (floating action button)

### 3.3. Spodnja navigacija (Bottom Nav) — 5 elementov
| # | Ikona | Pot | Opomba |
|---|-------|-----|--------|
| 1 | 📅 Calendar | `/calendar` | glavni pogled |
| 2 | 💰 Sales | `/sales` | prodaja |
| 3 | ➕ Add | `/calendar-add-modal` | hitro dodajanje (središče!) |
| 4 | 👥 Clients | `/clients/list` | stranke |
| 5 | ☰ More | `/more` | celoten meni |

**VPogled:** Sredinska "+" ikona za hitro dodajanje — univerzalni vzorec (Instagram, WhatsApp).

---

## 4. CALENDAR VIEWS MODAL

Klik na hamburger odpre **modal** (ne sidebar!):

### Pogledi (radio gumbi z ikonami)
| Pogled | Ikona | Opis |
|--------|-------|------|
| **Day** | 📋 | en dan (default) |
| **3 day** | 📋📋📋 | trije dnevi |
| **Week** | 📋📋📋📋 | teden |
| **Month** | 📅 | mesec |

### Nastavitve (seznam s chevron)
| Nastavitev | Ikona | Pot |
|-----------|-------|-----|
| **Filters** | ⚙️ | `/calendar/drawer/visibility-filters` |
| **Waitlist** | 📋 | `/calendar/drawer/waitlist` |
| **Personal calendar settings** | ⚙️ | `/calendar/drawer/settings` |

**VPogled:** Uporabljajo DRAWER (drsnik) za nastavitve — ne nove strani. Hitro in kontekstualno.

---

## 5. "MORE" MENI — CELOTNA NAVIGACIJA

### 5.1. Business wallet (kartica na vrhu)
- **Gradient:** vijolično-roza (moderno, privlačno)
- **Podatki:** "Business wallet" + €0 + "View wallet"
- **Povezava:** `/more/drawer/wallet/...` (drawer, ne stran!)

### 5.2. Glavne kategorije (grid 3×3)
| Kategorija | Ikona | Pot |
|-----------|-------|-----|
| **Home** | 🏠 | `/dashboard` |
| **Clients** | 👥 | `/clients` |
| **Online presence** | 🌐 | `/fresha/online-booking` |
| **Catalog** | 📦 | `/catalogue` |
| **Marketing** | 📣 | `/marketing` |
| **Team** | 👥 | `/team` |
| **Reports** | 📊 | `/reports` |
| **Add-ons** | 🧩 | `/add-ons` |
| **Settings** | ⚙️ | `/setup` |

**Opomba:** Grid layout (3 stolpci) — vizualno privlačno, hitro skeniranje.

### 5.3. Spodnje možnosti
| Možnost | Ikona | Opomba |
|---------|-------|--------|
| **Performance insights** | 📊 | z chevron (nov feature?) |
| **🇺🇸 English (US)** | 🌐 | jezikovne nastavitve |
| **Earn up to €100** | 💰 | referral program |
| **News** | 📰 | novice |
| **Help and support** | ❓ | pomoč |
| **Guides** | 📖 | vodiči |

---

## 6. SETTINGS (`/setup`) — CELOVITA ORGANIZACIJA

### 6.1. Workspace settings ("Manage settings for markec")
| Kategorija | Vsebina |
|-----------|---------|
| **Business setup** | osnovni podatki, lokacije, delovni čas |
| **Scheduling** | urniki, termini, razpoložljivost |
| **Sales** | cene, davki, popusti, načini plačila |
| **Clients** | upravljanje strank, zvestoba, segmenti |
| **Billing** | računi, naročnine, plačila |
| **Team** | zaposleni, vloge, dovoljenja |
| **Forms** | obrazci (ankete, vprašalniki) |
| **Payments** | Stripe, plačilni sistemi |

### 6.2. Online presence
| Funkcija | Opomba |
|----------|--------|
| **Marketplace profile** | profil na Fresha tržnici |
| **Reserve with Google** | rezervacije prek Google Maps |
| **Book with Facebook/Instagram** | rezervacije prek družabnih omrežij |
| **Product store** | spletna trgovina |
| **Direct links** | neposredne povezave za rezervacije |

### 6.3. Marketing
| Funkcija | Opomba |
|----------|--------|
| **Blast marketing** | množična e-pošta/SMS kampanje |
| **Automations** | samodejni marketing (rojstni dnevi, opomniki) |
| **Deals** | akcije, kuponi, popusti |
| **Smart pricing** | dinamične cene (AI?) |
| **Sent messages** | zgodovina sporočil |
| **Ratings and reviews** | ocene in mnenja strank |

### 6.4. Other
| Funkcija | Opomba |
|----------|--------|
| **Add-ons** | dodatni moduli |
| **Integrations** | zunanje integracije |

**VPogled:** Settings ima **4 glavne skupine** (kot naš načrt!): Business setup, Online presence, Marketing, Other. **Scheduling in Sales sta ločena** — to je logično za salone (urniki ≠ prodaja).

---

## 7. VIZUALNI SLOG IN DIZAJN

### 7.1. Barvna shema
| Element | Barva | Opomba |
|---------|-------|--------|
| **Primarna** | črna | gumbi, tekst |
| **Akcent** | vijolična/roza | wallet gradient, aktivni elementi |
| **Ozadje** | bela/svetlo siva | čisto, pregledno |
| **Rdeča** | za opozorila | badge, trenutni čas |

### 7.2. Tipografija
- **Font:** Roboto (Google Fonts)
- **Naslovi:** bold, 16-20px
- **Telo:** regular, 14px
- **Barva besedila:** temno siva (ne čista črna)

### 7.3. Komponente
| Komponenta | Opis |
|-----------|------|
| **Kartice** | zaobljeni vogali (8px), rahla senca |
| **Gumbi** | polni (črni) in outline (obrobljeni) |
| **Drawer** | desni drsnik za nastavitve (ne modal!) |
| **Modal** | za hitre izbire (Calendar Views) |
| **Grid** | 3×3 za kategorije |
| **FAB** | plavajoči gumb za filtre |
| **Bottom nav** | fiksna spodnja navigacija (ikone + besedilo) |

### 7.4. Animacije in efekti
- **Gradient** na wallet kartici (vijolično-roza)
- **Hover stanja** na karticah (sprememba sence/ozadja)
- **Badge** (rdeča pika) za obvestila
- **Rdeča črta** za trenutni čas na koledarju

---

## 8. PRIMERJAVA Z MARKEC (priložnosti)

| Funkcija | Fresha | MARKEC | Priporočilo |
|----------|--------|--------|-------------|
| **Default landing** | Koledar (akcija) | Nadzorna plošča (status) | ✅ PREMAKNI na koledar/termine |
| **Bottom nav** | 5 ikon (Calendar, Sales, +, Clients, More) | Stranska vrstica | Razmisliti o bottom nav za mobile |
| **Settings** | 4 skupine (Business, Online, Marketing, Other) | 4 skupine (Company, Website, Features, Advanced) | ✅ PODOBNO — dobro! |
| **Nastavitve** | Drawer (drsnik) | Ločena stran | Drawer je hitrejši |
| **Kategorije** | Grid 3×3 vizualno | Seznam | Grid je bolj vizualno |
| **Wallet** | Gradient kartica | Ni | Zanimivo za prihodnost |
| **Online presence** | Google/Facebook/Instagram | Osnovno | Ključno za rast |
| **Marketing** | Blast, Automations, Deals | Osnovno | Priložnost za diferenciacijo |
| **Smart pricing** | Dinamične cene (AI) | Ni | Inovativna funkcija |
| **Prazno stanje** | Ilustracija + CTA gumbi | Besedilo | Ilustracije so bolj prijazne |

---

## 9. KLJUČNI UX VZORCI (za prevzem)

1. **📱 Bottom nav za mobile** — 5 ikon, sredinska "+"
2. **📊 Koledar kot default** — takoj vidim, kaj se dogaja
3. **🗂️ Drawer za nastavitve** — ne ločene strani
4. **🎨 Grid za kategorije** — vizualno skeniranje
5. **💜 Gradient za finance** — privlačno, moderno
6. **📊 Prazna stanja z ilustracijami** — prijazno, ne suhoparno
7. **🔗 Online presence integracije** — Google, Facebook, Instagram
8. **📧 Marketing automation** — samodejni opomniki, kampanje
9. **💰 Smart pricing** — AI za dinamične cene (inovativno)
10. **⭐ Prenos aplikacije** — banner z oceno (5★) v glavi

---

## 11. CATALOG — PODROBEN PREGLED

### 11.1. Struktura kataloga
| Kategorija | Vsebina |
|-----------|---------|
| **Catalog** | Service menu, Packages, Memberships, Products |
| **Inventory** | Stocktakes, Stock orders, Suppliers |

### 11.2. Service menu (Storitve)
**Layout:**
- Naslov + opis: "View and manage the services offered by your business. Learn more"
- **Options** gumb (⋯) + **Add** gumb (+)
- **Iskanje:** "Search service name" + Filters gumb
- **Zavihki kategorij:** "All categories (4)" | "Hair & styling (4)" — s števci!
- **Seznam storitev** po kategorijah z "Actions" gumbom

**Storitve (primer):**
| Storitev | Trajanje | Cena |
|----------|----------|------|
| Haircut | 45 min | €40 |
| Hair Color | 1 hr, 15 min | €57 |
| Blow Dry | 35 min | €35 |
| Balayage | 2 hr, 30 min | €150 |

**VPogled:** Vsaka storitev je BUTTON (ne link) — klik odpre kontekstni meni.

### 11.3. Kontekstni meni storitve (klik na storitev)
| Akcija | Opomba |
|--------|--------|
| **Edit** | odpre formo za urejanje (9 zavihkov!) |
| **Duplicate** | podvajanje storitve |
| **Quick booking link** | hitra povezava za rezervacijo |
| **Create a deal** | ustvari akcijo/popust |
| **Archive** | arhiviraj (ne izbriše) |
| **Permanently delete** | trajno izbriši |

**VPogled:** "Quick booking link" je genialno — lastnik dobi povezavo za deljenje na družabnih omrežjih!

### 11.4. Edit Service forma (9 zavihkov!)
| Zavihek | Vsebina |
|---------|---------|
| **Basic details** | ime, kategorija, tip zdravljenja, opis (AI!), cena, trajanje |
| **Team members (2)** | kdo izvaja storitev |
| **Resources** | viri (oprema, prostori) |
| **Service add-ons** | dodatne storitve (npr. "masaža glave +€10") |
| **Online booking** | nastavitve spletnih rezervacij |
| **Portfolio images** | slike portfelja |
| **Forms** | obrazci (ankete, vprašalniki) |
| **Commissions** | provizije za zaposlene |
| **Settings** | dodatne nastavitve |

**Basic details podrobnosti:**
- **Service name:** 7/255 znakov (števec!)
- **Menu category:** "Hair & styling" — "The category displayed to you, and to clients online"
- **Treatment type:** "Haircut" — "Used to help clients find your service on the Fresha marketplace"
- **Description:** 0/1000 znakov + **"Generate with AI"** gumb! 🤖
- **Price type:** Free | From | Fixed (radio gumbi)
- **Price:** € vnosno polje
- **Duration:** dropdown (5 min → 12 hr) + "Add extra time"

**VPogled:** "Generate with AI" za opise storitev — to je INOVATIVNO! Lastnik vnese ime, AI generira opis.

---

## 12. CLIENTS (Stranke) — PODROBEN PREGLED

### 12.1. Layout
- **Naslov:** "Clients list" + "3 clients" (števec)
- **Options** + **Add** gumba
- **Opis:** "View, add, edit and delete your client's details. Learn more"
- **Import banner:** "Import your client list — Takes a few minutes and prevents new client fees for existing clients who book online" + "Start import" + "Learn more"
- **Iskanje** + **Filters** + **Select all** (bulk akcije!)
- **Seznam strank** z checkbox-i:
  - Jack Doe (jack@example.com)
  - Jane Doe (jane@example.com)
  - John Doe (john@example.com)

### 12.2. UX vzorci
1. **Import banner** — opozorilo o "new client fees" (Fresha zaračunava nove stranke!)
2. **Bulk akcije** — Select all + checkbox za množične operacije
3. **Števec strank** — takoj vidim koliko jih imam
4. **Email prikazan** neposredno v seznamu — hitro prepoznavanje

---

## 13. REPORTS (Poročila) — PODROBEN PREGLED

### 13.1. Struktura poročil
| Kategorija | Število |
|-----------|--------|
| **All reports** | 64 |
| **Favourites** | 0 |
| **Dashboards** | 5 |
| **Standard** | 56 |
| **Premium** | 8 |
| **Custom** | 0 |

### 13.2. Funkcije
- **Folders** — organizacija poročil v mape
- **Add folder** — ustvarjanje novih map
- **Data connector** — povezovanje z zunanjimi viri podatkov

**VPogled:** 64 poročil! To je OGROMNO. Fresha ima celoten BI (Business Intelligence) sistem. "Data connector" pomeni izvoz podatkov v zunanja orodja (npr. Google Sheets, Excel).

---

## 14. DODATNA OPAZANJA IZ RAZISKOVANJA

### 14.1. Navigacijski vzorci
| Vzorec | Opomba |
|--------|--------|
| **"Go back" gumb** | na vsaki podstrani — dosledno! |
| **"Learn more" povezave** | povsod — vodi na Help Center |
| **"Options" gumb (⋯)** | za dodatne akcije na vsaki strani |
| **"Add" gumb (+)** | primarna akcija na vsaki strani |
| **Števci** | povsod ("3 clients", "4 storitve", "64 poročil") |
| **Tab z števci** | "All categories (4)" — takoj vidim koliko je v vsaki |

### 14.2. Mikro-interakcije
- **Kontekstni meni** ob kliku na storitev (ne navigacija!)
- **Checkbox-i** za bulk akcije (Select all)
- **AI generiranje** besedil (Description)
- **Import wizard** za uvoz strank
- **Quick booking link** za deljenje na socialnih omrežjih

### 14.3. Varnostna opozorila
- **"new client fees"** — Fresha zaračunava nove stranke (poslovni model!)
- **"Permanently delete"** — ločeno od "Archive" (varnost!)

---

## 17. MARKETING — PODROBEN PREGLED

### 17.1. Struktura marketinga
| Kategorija | Funkcije |
|-----------|----------|
| **Messaging** | Blast campaigns, Automations, Messages history |
| **Promotion** | Deals, Smart pricing |

### 17.2. Funkcije podrobno
| Funkcija | Opomba |
|----------|--------|
| **Blast campaigns** | množična e-pošta/SMS kampanje |
| **Automations** | samodejni marketing (rojstni dnevi, opomniki, ponovni obiski) |
| **Messages history** | zgodovina vseh poslanih sporočil |
| **Deals** | akcije, kuponi, popusti |
| **Smart pricing** | dinamične cene (AI!) |

**VPogled:** "Smart pricing" je verjetno AI za dinamično določanje cen glede na povpraševanje, čas, zasedenost. To je NAPREDNA funkcija!

---

## 18. TEAM — PODROBEN PREGLED

### 18.1. Struktura tima
| Kategorija | Funkcije |
|-----------|----------|
| **Team members** | upravljanje zaposlenih |
| **Scheduled shifts** | urniki, delovni čas |
| **Timesheets** | evidence delovnega časa |
| **Pay runs** | obračun plač!

**VPogled:** Fresha ima celoten **HR + obračun plač** sistem! To je OGROMNO za salon. "Pay runs" pomeni, da Fresha obdeluje tudi plače zaposlenih.

---

## 19. CELOVITA KARTA FUNKCIONALNOSTI

### 19.1. Primarne funkcije (core)
| Področje | Funkcije |
|----------|----------|
| **Calendar** | Day/3-day/Week/Month pogledi, team scheduling, waitlist, filters |
| **Catalog** | Services, Packages, Memberships, Products, Inventory |
| **Clients** | List, Import, Bulk akcije, Profiles |
| **Sales** | POS, Payments, Refunds |
| **Team** | Members, Shifts, Timesheets, Pay runs |

### 19.2. Marketing in rast
| Področje | Funkcije |
|----------|----------|
| **Messaging** | Blast campaigns, Automations, History |
| **Promotion** | Deals, Smart pricing |
| **Online presence** | Marketplace, Google, Facebook, Instagram, Direct links |
| **Reports** | 64 poročil, Dashboards, Data connector |

### 19.3. Nastavitve in konfiguracija
| Področje | Funkcije |
|----------|----------|
| **Business setup** | Osnovni podatki, Lokacije, Delovni čas |
| **Scheduling** | Urniki, Termini, Razpoložljivost |
| **Sales** | Cene, Davki, Popusti, Plačila |
| **Clients** | Upravljanje, Zvestoba, Segmenti |
| **Billing** | Računi, Naročnine, Plačila |
| **Team** | Zaposleni, Vloge, Dovoljenja |
| **Forms** | Obrazci, Ankete, Vprašalniki |
| **Payments** | Stripe, Plačilni sistemi |

---

## 20. POSODOBLJENA PRIMERJAVA Z MARKEC (končna)

| Področje | Fresha | MARKEC | Razlika | Prioriteta |
|----------|--------|--------|---------|------------|
| **Calendar** | 4 pogledi + team scheduling | Osnoven | VELIKA | 🔴 |
| **Service edit** | 9 zavihkov + AI | 1 forma | VELIKA | 🔴 |
| **Clients** | Import + Bulk akcije | Osnoven | SREDNJA | 🟡 |
| **Marketing** | Blast + Automations + Deals | Osnoven | VELIKA | 🔴 |
| **Team** | HR + Pay runs | Osnoven | VELIKA | 🔴 |
| **Reports** | 64 poročil + BI | Osnoven | VELIKA | 🔴 |
| **Online presence** | Google/FB/IG | Osnoven | VELIKA | 🔴 |
| **Smart pricing** | AI dinamične cene | Ni | INOVATIVNO | 🟡 |
| **Service add-ons** | Dodatne storitve | Ni | SREDNJA | 🟡 |
| **Commissions** | Provizije | Ni | SREDNJA | 🟡 |
| **Portfolio images** | Slike portfelja | Ni | MAJHNA | 🟢 |
| **Quick booking link** | Deljenje | Ni | SREDNJA | 🟡 |
| **AI opisi** | Generate with AI | Ni | INOVATIVNO | 🟡 |

---

## 21. STRATEŠKE PRIPOROČILA ZA MARKEC

### 21.1. Takojšnji ukrepi (P0)
1. **Calendar prenova** — 4 pogledi (Day/3-day/Week/Month) + team scheduling
2. **Service edit prenova** — 9 zavihkov + AI generiranje opisov
3. **Marketing modul** — Blast campaigns + Automations + Deals

### 21.2. Srednjeročni ukrepi (P1)
4. **Team HR sistem** — Timesheets + Pay runs
5. **Reports BI** — 64 poročil + Dashboards + Data connector
6. **Online presence** — Google/Facebook/Instagram integracije

### 21.3. Dolgoročni ukrepi (P2)
7. **Smart pricing** — AI dinamične cene
8. **Service add-ons** — dodatne storitve za povečanje prihodkov
9. **Commissions** — provizije za zaposlene
10. **Portfolio images** — vizualna predstavitev storitev

---

## 22. SKLEP

Fresha je **celovita platforma za salone** z:
- **64 poročil** (BI sistem)
- **9 zavihki** za urejanje storitev
- **AI generiranjem** opisov in dinamičnimi cenami
- **Celotnim HR sistemom** (Timesheets + Pay runs)
- **Marketing avtomatizacijo** (Blast + Automations + Deals)
- **Online presence** (Google/FB/IG integracije)

**MARKEC ima trdno osnovo**, a za konkurenčnost potrebuje:
1. **Calendar prenovo** (4 pogledi + team scheduling)
2. **Service edit prenovo** (9 zavihkov + AI)
3. **Marketing modul** (Blast + Automations + Deals)

To so **ključne diferenciacije**, ki jih stranke pričakujejo od moderne platforme za salone.
