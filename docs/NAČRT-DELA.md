# MARKEC — NAČRT DELA: produkt za obrtnike

> **Namen tega dokumenta** je en sam vir resnice, po katerem delova naprej — skupaj.
> Nima "Scrum balasta". Vsak blok ima: kaj točno · definicijo "narejeno" · kako preverimo.
> Stanje vsakega elementa je označeno: ✅ narejeno+preverjeno v brskalniku · 🟡 narejeno, ni preverjeno · ⬜ ni narejeno.
> Ta dokument se ureja TAKO, kot nastaja delo — ne pusti ga zaostati za kodo.

---

## 0. Severna zvezda (cilj produkta)

**MARKEC je samopostrežna platforma, kjer obrtnik (čebelar, vulkanizer, šivilja …)**
**sam postavi svojo spletno stran, jo ureja z miško in prodaja svoje storitve/izdelke — brez programerja.**

Zadovoljen obrtnik z rečenim: "Prijavil sem se, izbral svojo dejavnost, uredil stran in jo objavil — vse sam, v enem popoldnevu."

### Definicija "konec"
Produkt je "končan" (prvi pravi MVP za prvo stranko), ko obrtnik lahko, **sam, iz brskalnika**:
1. ustvari račun in izbere svojo dejavnost (onboarding);
2. vidi svojo storitev/izdelke, ki so smiselni ZA NJEGOVO dejavnost;
3. javno stran uredi v vizualnem urejevalniku in jo objavi;
4. prejme stranko (rezervacija / povpraševanje / naročilo) in plačilo;
5. platforma je varna (organizacije so ločene) in živa v produkciji (Vercel + resnična baza).

### Kaj JE v obsegu (privzeto)
- Javne spletne strani obrtnikov z dejavnostno pravilno vsebino.
- Lastnikovo samopostrežno urejanje (WYSIWYG) + objava.
- Naročila / rezervacije / povpraševanja + plačila (Stripe).
- Onboarding od registracije do prve stranke.
- Varnostna izolacija med organizacijami.

### Kaj NI v obsegu (na začetku — ne delamo, dokler ni resnične potrebe)
- Lastne domene strank (api/domains) — ni narejeno, narediti šele ko prva plačajoča stranka to potrebuje.
- Napredna analitika ekip, komisije, e-računi — obstoječi WIP, ne blokira MVP.

---

## 1. Stanje danes (resnica iz repozitorija, ne želja)

Tehnična baza je **močna in realna** (ne demo): Next.js 16 · TypeScript 5 · Prisma/PostgreSQL · Stripe · Resend · Cloudinary · NextAuth v5 · Playwright · Vercel (`vercel.json`).

| Področje | Stanje | Opomba |
|---|---|---|
| **Čebelar** (javna stran + trgovina) | ✅ | preverjeno: 6 izdelkov, košarica, objavljena stran. **Reference.** |
| **Vulkanizer** (storitve + rezervacije) | ✅/🟡 | E2E delno; ni celotnega računanja rezervacije v produkciji preverjeno. |
| **Šivilja** (storitve + povpraševanje + galerija) | 🟡 | galerija delno; inquiry preverjen, galerija ne v celoti. |
| **WYSIWYG urejevalnik** (lastnik) | ✅/🟡 | urejanje sekcij + fotografije + objava deluje; nekateri kliki E2E omejeni v dev-harnessu. |
| **Onboarding** (registracija → dejavnost) | ✅ | čarovnik (start-wizard) + imenik dejavnosti obstaja. |
| **Stripe per-tenant** | ✅/🟡 | implementacija obstaja; resnično testirano le testni mod. |
| **Operaterska konzola** (workspaces) | 🟡 | obstaja, ni končno preverjena. |
| **Lastne domene (api/domains)** | ⬜ | NI narejeno. |
| **Produkcija (Vercel + resnična baza)** | ⬜/🟡 | vercel.json je, deploy nikoli pošteno dokazan. |

### VARNOST — pravkar opravljeno
- Popravljen `addGalleryItem` + `coverImageId` (org-scope preverjanje medijev) — ✅, deterministični negativni testi, unit 1360/1360.

---

## 2. Gradient do produkta — bloki po vrednosti (vrstni red)

Vsak blok je **sam po sebi delujoča celota**. Ne delaj "vse hkrati".

### Blok 1 — Varnostno omrežje in produkcija (NI SKAKALEC, predpogoj)
> Brez tega ni vredno dodajati funkcij: če ni žive baze in varnega deploya, vsa zgodovina izgine.
- [ ] Pošten Vercel deploy iz `main` (brez `main` → zasebna branch do produkcije).
- [ ] Resnična produkcijska baza (Neon/Supabase), migracije `prisma migrate deploy`.
- [ ] Backups + obnovitev (barvita "kako obnoviti po nesreči").
- [ ] Okoljske spremenljivke: `AUTH_SECRET` (openssl rand), `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, Stripe ključi, `PLATFORM_ADMIN_EMAILS`.
- **Narejeno, ko:** `vercel --prod` uspe, domača izložba (/) je živa, registracija lastnika deluje, email pride ven.
- **Prevra:** dejanski krog novice (registracija na produkciji + e-pošta).

### Blok 2 — Strgensko osnovno: pregled / demonstracija po vseh treh dejavnostih (že blizu)
> Potrjuje, da obrtnik DOBI svoj "obraz na spletu" — pred plačilno potjo.
- [ ] Čebelar, vulkanizer, šivilja: javna stran + pravilna "terminologija" (naroči / rezerviraj / povprašaj) — ⬜/✅, preveri vsako v brskalniku.
- [ ] WYSIWYG za lastnika: klik sekcije → uredi → objavi → javno vidno (vsaj ena dejavnost do konca v brskalniku).
- [ ] Pravilne sekcije po dejavnosti (brez rezervacije pri čebelarju itd.).
- **Narejeno, ko:** lastnik brez pomoči uredi+objavi stran vsaj za čebelarja.

### Blok 3 — Prvi realni poslovni tok (najpomembnejši po vrednosti)
> To lastnika uvrstijo a MORDA postane produkcija: naročilo/zplačilo.
- [ ] Naročilo izdelka (trgovina) + Stripe plačilo per-tenant — do konca testiran na produkciji (test mode, potem live).
- [ ] Rezervacija (vulkanizer) + potrditev po e-pošti.
- [ ] Povpraševanje (šivilja) + obvestilo lastniku.
- **Narejeno, ko:** obrtnik prejme prvo resnično naročilo/reaktivcijo in plačilo in ga vidi v skoraj "moj posel" oddelku.

### Blok 4 — Onboarding do "prve stranke" plus operaterska upravljalnica (čisti vstop)
- [ ] Register → izberi dejavnost → ime/barva → prva javna stran → urejanje → objava — vse v enem toku (že delno, poveži do konca).
- [ ] Operaterska konzola (`/workspaces`): videti organizacije, stanja, sporočiti spremembe — da lahkotno konvertiraš "demo → stranka".
- **Narejeno, ko:** nov lastnik od začetka do objavljene strani brez e-mailov iz podpore.

### Blok 5 — Odpornost in varnost (pred širšo uporabo)
- [ ] Resnično varnostno pregledovanje (tenant izolacija, vloga, ločitev operaterja od najemnika) — delno je ✅, dokončaj.
- [ ] Ena pravica "vloga" brez skrivnostnih poti (na nivoju strani + server action).
- [ ] Monitor/obnova baze (del Blok 1) — nadaljuj.
- **Narejeno, ko:** seznam varnostnih odgovorov z enostavnimi meritvami (brez "ne vem").

### Blok 6 — (naknadno, NI blokada MVP)
- Lastne domene, napredna analitika, komisije ekipe, e-računi — samo če resnično stranka to zahteva.

---

## 3. "NAREDIMO / NE DELAMO / NAKNADNO" (delovni seznam)

| Naredimo zdaj (MVP) | Ne delamo zdaj | Naknadno |
|---|---|---|
| Vercel deploy + resnična baza | Lastne domene | Lastna domena |
| WYSIWYG do konca (vsaj čebelar) | E-računi | Analitika |
| Naročilo/rezervacija/povpraševanje + plačilo | Komisije ekipe | Komisije |
| Onboarding celega toka | Napredna poročila | E-računi |
| Varnostna izolacija | | Push obvestila |
| Operaterska konzola | | |

---

## 4. Kako delova naprej (delovna pravila, da AI-modeli ne uničijo)

1. **Vedno najprej preveri stanje** (git status, dejstvo, ne "mislim da").
2. **En vir resnice = ta dokument + koda.** Ni "drugega načrta" drugje.
3. **Vsak element v planu ima status** (✅/🟡/⬜) — posodobi pri vsakem bloku.
4. **"Narejeno" = preverjeno v brskalniku na `markec_e2e_test`**, ne samo "kompajler se strinja".
5. **Ne delaj izven obsega** (tabela §3), dokler potreba ne pride od stranke.
6. **Vedno varnostno**: org izolacija je ne-dotaknjiva; vsaka sprememba → ne sme vdreti.

---

## 5. Prvi korak, ki ga predlagam zdaj (ti potrdiš)

Ne bom tekel naprej mimo tvojega odobritve. Privlačne naslednje polne naloge po vrstnem redu:

**Prednost A (največja vrednost za "produkt za obrtnike"):**
> Dokončaj **Blok 1** — pošten Vercel deploy + resnična produkcijska baza + email ključi — ker brez tega ni "produkta", samo demota.

**Prednost B (če hočeš najprej da "pokazujemo spremembe"):**
> Dokončaj Blok 2 za čebelarja do konca v brskalniku (uredi+objavi javno), ker je to tvoja reference.

**Prednost C (če hočeš pritegniti prvo stranko takoj):**
> Dokončaj naročilo+plačilo (Blok 3) na produkciji, tudi test-mode, ker je to kar prodaja.

**Izberi s številko A / B / C (ali svoje). Ko potrdiš, po tem načrtu naprej.**