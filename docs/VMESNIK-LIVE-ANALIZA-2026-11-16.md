# Live analiza vmesnika — MARKEC (2026-11-16)

URL: https://markec-business-platform.robert-pezdirc12.workers.dev/

Analiza temelji na dejanskem nalaganju strani v Chrominu pri 1440×900 in 390×844, na posnetkih zaslona ter na pregledu kode. Med analizo **nisem spreminjal kode**.

---

## 1. Kaj se odpre prvo

### Desktop — 1440×900

1. **Header, visok 69 px**, sticky, belo/prosojno ozadje:
   - logotip je samo okrogla ploščica z črko **M** — brez besednega `MARKEC`;
   - leva navigacija: `Moduli · Primeri · Kako deluje · Paketi · Cene`;
   - desno: jezikovno stikalo `Slovenščina / English`, `Prijava za podjetnike`, burgundski gumb `Začni brezplačno`.
2. **Hero z gradijentom** (rožnat → bež). Levi blok je omejen na `max-w-3xl` = 768 px:
   - badge `MARKEC – MY BUSINESS PLATFORM`;
   - **H1, 64 px**, 4 vrstice:
     `Tvoje podjetje. Tvoja spletna stran. Tvoje stranke. Tvoja platforma.`;
   - mala angleška pasica `YOUR BUSINESS. YOUR WEBSITE. YOUR CUSTOMERS. YOUR PLATFORM.`;
   - odstavek: `MARKEC ni samo še en izdelovalec spletnih strani — je enostaven sistem...`;
   - primarni CTA `Ustvari svoje podjetje — brezplačno →`;
   - sekundarni CTA z ikono predvajanja `Oglej si, kako deluje`;
   - mikrokopija `Brez kartice · V 3 korakih · ...`;
   - social proof: 4 okrogle začetnice `A E C D`, 5 zvezdic, `4.9/5 — več kot 500 zadovoljnih podjetij`.
3. **Desna polovica ekrana je prazen gradijent** — brez slike izdelka, brez terminala, brez rezervacijskega vmesnika, brez dokaza.

### Mobilno — 390×844

- Header prikaže **samo logotip M in jezikovno stikalo**.
- `nav` ima razred `hidden ... lg:flex`, prijava je `hidden md:inline`, CTA pa `max-[420px]:hidden`.
- **Ni hamburger gumba, ni mobilnega menija.** Do `Moduli / Primeri / Kako deluje / Paketi / Cene / Prijava` uporabnik ne pride iz glave — šele iz noge strani, 6000 px nižje.
- H1 zavzame 220 px višine (5 vrstic), CTA je viden, social proof je pod foldom.
- Ni vodoravnega prelivanja (`scrollWidth = 390`).

---

## 2. Kaj dejansko deluje

- Tipografija, barvna paleta in kartice so vizualno dosledne.
- Sticky header, jezikovni routi (`/` in `/en`) in demo modal tehnično delujejo.
- Gumb `Oglej si, kako deluje` res odpre modal — ni mrtv. Toda prikaže **čebelarski demo** (`panjske postaje, panje, družine, zaloga, odprta naročila`), čeprav je naslovnica generična.
- `/start` ima smiselno 3-koračno strukturo (`Dejavnost → Podjetje → Lastnik`), opcijsko drugo dejavnost in možnost preskoka. Ko se naloži, je koristen.
- Razdelek s paketi (FREE / PRO / SCALE) in FAQ je pod foldom prisoten in pregleden.

---

## 3. Kritične najdbe — uredi pred vsakim novim gumbom

### P0-1: Stran občasno sploh ne odpre

Opazovani odzivi v isti seji:

```txt
/            200 / 503
/start       503 / 200
/podjetja    503 / 200
/en          200
/pricing     200
```

Ob 503 se prikaže Cloudflare **Error 1102 — Worker exceeded resource limits**. To ni UI napaka, ampak znana omejitev Workers Free (10 ms CPU na zahtevo). Posledica: **primarni CTA vodi na stran, ki v ~2 od 3 poizkusov prikaže Cloudflare error**. To je največja interface napaka, večja od katerih koli barv ali poravnav.

Dodatno v konzoli:

```txt
pageerror: __name is not defined
500 /api/auth/session  → AuthError: There was a problem with the server configuration
503 /api/auth/session
CSP: 'upgrade-insecure-requests' ignored in report-only policy
```

**Zahteva za sprejem:** 50 zaporednih poizkusov `/`, `/start`, `/podjetja` vrne 200 brez Error 1102; `/api/auth/session` ne vrže 500.

### P0-2: Na mobilnem ni navigacije

To je funkcionalna, ne kozmetična napaka. Rešitev: hamburger + sheet/drawer z vsemi petimi risalnimi povezavami ter `Prijava` in `Začni brezplačno`.

**Zahteva za sprejem:** pri 390×844 so vse povezave dosegljive iz enega menija, brez skrolanja 6000 px.

### P0-3: Lažni social proof na naslovnici

`src/components/landing/platform-landing.tsx` (vrstice 193–214) vsebuje trditev:

```tsx
<strong>4.9/5</strong> — več kot 500 zadovoljnih podjetij
```

Ocena, zvezdice in število so **hardcodirani**, okrogle začetnice `A E C D` so generirane iz seznama barv. Pod komponento piše komentar `verifiable facts only, no invented numbers/logos` — kar je v neposrednem nasprotju z zgornjim blokom. To je natanko tisti "fake success state", ki smo ga identificirali v prvi analizi.

### P0-4: Lažne številke na tržnici `/podjetja`

`src/components/marketplace/hero-section.tsx` vsebuje:

```tsx
"432.594 terminov rezerviranih danes"     // vrstica 144
"ki jim zaupajo milijoni po vsem svetu"   // vrstica 159
useAnimatedCounter(12500, ...)            // vrstica 95
useAnimatedCounter(500, ...)              // vrstica 96
useAnimatedCounter(85, ...)               // vrstica 97
floatingCards = [Lassana Salon 5.0/39, Barbershop AS 5.0/229]  // vrstice 75–92
```

Vse vrednosti so statične, animirane navzgor, ne pridejo iz baze. Na zaslonu so hkrati `2708+`, `133+`, `31+`, `432.594` in `milijoni` — številke si celo medsebojno nasprotujejo.

**Predlog:** dokler ni resničnih agregatov iz baze, te bloke **skrij** namesto da jih "popraviš". Zamenjaj jih z resničnim izdelkom: `1 podjetje → 1 živa stran → 1 rezervacija`.

### P0-5: Iskanje ne prenese poizvedbe

Na naslovnici (`platform-landing.tsx`, vrstice 252–266) je `<input>` brez `name`, brez state-a, gumb pa je navadna `<Link href="/podjetja">`. Po vnosu `frizer` in kliku `Išči` se poizvedba ne pojavi v URL-ju niti v rezultatih. Enako na `/podjetja` (`hero-section.tsx`, vrstice 162–176).

**Predlog:** kontroliran input + `<form action="/podjetja">` z `?q=` in `?location=`, predizpolnjevanje iz URL-ja, filter v `/podjetja`.

---

## 4. Pomembne, a ne kritične spremembe — P1

| # | Težava | Predlog |
|---|--------|---------|
| 1 | Desna polovica heroja je prazna | Razdeli 55/45: levo krajše besedilo, desno **pravi posnetek** dashboarda ali rezervacijskega widgeta. Ne še en gradient. |
| 2 | H1 ima 4 vrstice po 64 px in ponavlja `Tvoja` štirikrat | Skrči na 2 vrstici, 48–56 px desktop / 36–40 px mobilno. Primer: `Vsa vaša poslovna spletna prisotnost. Na enem mestu.` |
| 3 | Angleška tagline pod slovenskim naslovom | Lokaliziraj v slovenščino ali odstrani. Mešanje jezikov brez razloga zmanjšuje profesionalnost. |
| 4 | CTA `Ustvari svoje podjetje — brezplačno` je predolg | Povsod uporabi isti kratek label `Začni brezplačno`. |
| 5 | `Oglej si, kako deluje` odpre čebelarski demo | Preimenuj v `Oglej si demo` in dodaj izbiro panoge ali naredi generičen demo. |
| 6 | Naslovnica meša B2B in B2C | Dodaj zgornjo izbiro `Za podjetja / Za stranke` ali premakni iskanje storitev za razdelek `Moduli`. Trenutno obiskovalec ne ve, ali je stran za lastnika salona ali za stranko, ki išče termin. |
| 7 | Mikrokopija in zvezdice so nizke kontrastne | Povečaj na 14 px in `text-foreground`; odstrani lažne začetnice. |

---

## 5. Vrstni red dela — moja priporočena prva prioriteta

1. **Stabilizacija**：Workers Paid ali Vercel, da `/`, `/start`, `/podjetja` ne verbose Error 1102. Brez tega je vsak UI popravek neopazen.
2. **Mobilni meni** — ker je trenutno nedosegljiva polovica strani.
3. **Odstrani lažne številke in lažne ocene** na naslovnici in tržnici. To je temelj zaupanja in se ujema s prejšnjo ugotovitvijo o "honest UX".
4. **Delujoče iskanje** z `?q=`.
5. Šele potem: split hero, krajši H1, prava slika izdelka, segmentacija obiskovalcev.

---

## 6. Posnetki zaslona

- `markec-home-first.png` — naslovnica, 1440×900, prvi ekran
- `markec-home-mobile.png` — naslovnica, 390×844, prvi ekran
- `markec-home-full.png` — cela naslovnica
- `markec-start-ok.png` — `/start`, 1. korak
- `markec-podjetja-ok.png` — `/podjetja`, prvi ekran
- `markec-start-first.png` in `markec-podjetja-first.png` — primerja Error 1102

Posnetki so bili shranjeni v začasno mapo med analizo.
