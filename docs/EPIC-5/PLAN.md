# EPIC 5 — RECEPCIONIST (skriptni, brez AI modela)

> Cilj: javna stran odvrne stranko 24/7 — cene, ure, lokacija, rezervacija,
> čakalna lista — prek tankega pogovornega sloja, ki klika IZKLJUČNO obstoječe
> akcije in podatke iz baze. Noben AI model, noben zunanji ključ, nobena nova
> odločevalna logika: vse besede so v slovarju, vse dejanske podatke daje baza.
>
> **Zakaj skripte, ne LLM (odločitev 2026-11):**
> - 90 % pogovorjev v tej vrsti podjetja je transakcijsko (termin, cene, ure,
>   lokacija) — meniji + ključne besede to pokrijejo brez jezika, brez tveganja.
> - Cena na pogovor 0 € (LLM: ~0,01–0,05 €/pogovor + ključ + doba odziva).
> - Ni halucinacij: vsak podatek (cena, ura, telefon) pride iz DB — bot NE MORE
>   obljubiti napačne cene, ker jih ne zna izmisliti.
> - GDPR: imena/telefoni ne gredo k tretji osebi.
> - SL jezik je popoln (slovar piše lastnik platforme), ni modelov, ki bi
>   šuščali v slovenščini.
> - **LLM ostaja rezervirana nadgradnja (v2)**: vklopi se SAMO kot fallback,
>   kadar skripta ne prepozna namena ("ne razumem" → LLM razvrsti v obstoječi
>   nabor namenov, ne odgovarja prost). Arhitektura tega EPIC-a to že omogoča —
>   `classifyIntent()` je ena točka, ki se pozneje nadgradi.

## Razlog za denar (tržna podlaga, raziskava 2026-11)

- Trg AI recepcionistov: $2,7B (2025) → $31,4B (2035); pri lastnikih salonov
  60–73 % pogovorjev avtomatizirano, $560–$2.515/mes. prihranka, ki ga
  lastniki pripisujejo avtomatskemu sprejemu.
- Gledano iz prodajne perspektive: "recepcionist, ki ne zaspava" — prodaja se
  kot zanesljivost, ne kot AI. Kasneje plačana dodatna vrstica (PRO/SCALE):
  skriptni sprejem vgrajen, "pametni način" (LLM fallback) = +9–19 €/mes.

## Arhitektura

```
Javna stran (vsaka, pod /s/{slug} ali custom domeno, objavljen najemnik)
  └─ <ChatWidget> (client, "use client", next/dynamic lazy load)
        │  invoke sendReceptionMessage(message)  [SERVER ACTION]
        ▼
  actions/reception-actions.ts  ("use server" — ista varnostna lastnost kot
  waitlist/booking: najemnik iz PODPISANE glave, ki jo je proxy napisal iz
  URL-ja /s/<slug> ali preverjene custom domene — E5-D9)
        ├─ rate limit: chat:ip, 30 sporočil / 10 min (obstoječa rateLimit, fail-open)
        ├─ organizacija iz podpisane glave — JAMČENO (nikoli iz payloada)
        ├─ najemnik objavljen? capability "appointments" aktiven? (fail-closed)
        ├─ loadReceptionContext() — org + config + siteContent + storitve
        ├─ resolveReceptionRequest() — ČISTA odločitvena funkcija (testabilna)
        │     ├─ classifyIntent() — SL/EN ključne besede → 7 namenov
        │     └─ buildReply() — besedilo + akcija (izključno podatki iz DB)
        ├─ cookies().set(mkc_conv) — anonimen piškotek (IDOR: ref velja samo
        │  znotraj te org; tuji ref → nov)
        └─ shranjevanje Conversation + Message v eni transakciji
        ▼
  odgovor: { ok, reply, intent, action, suggested[], conversationId }
```

**7 namenov (intento) v1:**

| Intent | SL ključne besede (vrstni red = prioritetni) | ODGOVOR | AKCIJA |
|---|---|---|---|
| `book` | rezerviraj, termin, dogovorim, uro, hour, book, appointment… | Vabljamo, da rezervirate — izberite storitev in prosto uro | gumb → `/booking` (orgPath) |
| `waitlist` | čakalna, waitlist | Prosti termini se izpolnjujejo hitro — vpis na čakalno listo | gumb → `/booking` (WaitlistCard je tam) |
| `prices` | cena, cene, koliko stane, price… | Seznam storitev in cen (do 8, iz DB) | gumb → `/services` |
| `hours` | ura, ure, delovni čas, odprti, open, hours… | Delovni ur po dnevih (iz siteContent.openingHours, `formatOpeningHours`) | — |
| `location` | kje, naslov, address, location, mapa | Naslov + meste (iz SalonConfig) | `tel:` gumb, če je telefon nastavljen |
| `cancel` | prekliči, odpoved, cancel, reschedule, prestavi | Navodilo: prijava → "Moji termini", ali pokličite +{phone} | `tel:` gumb |
| `greeting` | pozdrav, hvala, dober dan, hi, hello… | Pozdrav + hitri predlogi (čipki) | — |
| `help` (privzeto) | — | Ne razumem + ponavljajoči se nabor + `tel:` | — |

Vrstni red razvrščanja (zažgan v `classifyIntent`, preverjen z testom):
1. `cancel` (najbolj specifičen, da ga "termin" ne pojde za `book`)
2. `waitlist`
3. `prices`
4. `hours`
5. `location`
6. `book`
7. `greeting`
8. sicer `help`

**Brez podatkov bot NE VZROČI:** če najemnik nima nastavljenega telefona,
besedilo "pokličite" izgine; brez naslova — ni naslova; brez storitev —
"cene" pade na `help` s telefonom. Bot nikoli ne izmišljuje podatkov.

## Faze

### E5-1 — Podatkovni model ✅
- `Conversation`: organizationId, status (ACTIVE/REPLIED/CLOSED), visitorRef
  (anonski id iz piškotka — NE osebni podatek brez konteksta, GDPR: zbiramo
  samo, kar obiskovalec sam napiše), lastReplyAt.
- `Message`: conversationId, sender (VISITOR/OWNER/AUTO), body, createdAt.
- Migrate `20261126xxxxxx_add_reception_chat`.
- **Ni** e-pošte/telefona v v1 — kontakt ostaja na strani (footer) in v
  rezervaciji, kjer ga obiskovalec sam vnese (obstoječi tok).

### E5-2 — Čisto jedro ✅
- `src/lib/reception/intents.ts` — `classifyIntent(text, locale)`,
  `buildReply(intent, ctx, locale)` — čista funkcija, brez prisma/next.
- Slovar SL + EN (EN = ista struktura, prevod naborov).
- Testi `tests/reception/intents.test.ts` (vitest): prioritete, SL+EN,
  manjkajoči podatki, `help` fallback, sanitizacija (brez novih vrstic).

### E5-3 — Server action + jedro ✅ (E5-D9)
- `src/app/actions/reception.ts` — `loadReceptionContext()` (org, config,
  content, storitve z cenami), `resolveReceptionRequest()` — čista, testna.
- `src/app/actions/reception-actions.ts` — `"use server"` file z
  `sendReceptionMessage()`: rateLimit (chat:ip), fail-closed brez org/objave/
  capability, IDOR-safe piškotek `mkc_conv`, shranjevanje v eni transakciji.
  **E5-D9: namesto API route `POST /api/chat`** — proxy podpisuje najemniško
  glavo samo za `/s/*` + custom domene; fiksna pot `/api/chat` bi padla na
  `getPublicOrg()` = "prvi objavljen najemnik" = **napačni najemnik**.
  Server action deduje podpisano glavo iz konteksta strani (isti vzorec kot
  waitlist/booking) — problem izgine, ne samo reši se.
- **Varnost:** org se NIKOLI vzame iz payloada (podpisana glava); telo
  zgoraj 2.000 znakov; obiskovalčeve besede se shranijo, NIKOLI renderjajo
  kot HTML (React escape); auto-odgovori so le besedilo + akcije.
- Testi `tests/reception/route.test.ts` (vitest): `resolveReceptionRequest`
  za 7 namenov; manjkajoči telefon/naslov/storitve/ure (degradacija);
  SL+EN. (IDOR + najemnik: preverjeno z E2E, glej spodaj.)

### E5-4 — Widget na javni strani ✅
- `src/components/reception/chat-widget.tsx` — "use client", "use client" +
  `next/dynamic` (lazy, brez `ssr: false` — widget ni SSR-ov).
- Naloži se v `(public)/layout.tsx` — SAMO objavljen najemnik (gate ===
  "published") + capability "appointments" aktiven. Brez analytics vpliva
  (klient, ne script tag).
- Piškotek `mkc_conv` (anonimni id pogovora, 30 dni) — ponovni obisk dobi
  zgodovino pogovora (do zadnjih 20 sporočil).
- UI: gumb v desnem spodnjem kotu (Phosphor `ChatsCircle`), okno s
  sporočili, hitri čipki (Predlogi), gumb za akcijo (Rezerviraj → orgPath),
  polje + pošiljanje. Brez zvočnih/odprtij obvestil (brez nadlegovanja).
- **Bundle:** widget se naloži z `next/dynamic` (ne v prvi JS javne strani —
  pravilo #9 iz CLAUDE.md).

### E5-5 — Inbox za lastnika ✅
- `src/app/dashboard/chats/page.tsx` — seznam pogovorov (status, zadnje
  sporočilo, čas) + pogled na pogovor + polje za lastniški odgovor.
- `src/app/actions/reception-owner.ts` — `getConversations`, `getConversation`,
  `replyToConversation` (permission `appointments.view` / `appointments.manage`).
- Sidebar: `/dashboard/chats` (nav "sales", capability appointments,
  permission appointments.view) — ista struktura kot waitlist.
- Status: ACTIVE → (prvi lastniški odgovor) → REPLIED.

## Varnost (glej tudi VARNOSTNI-PREGLED)

- **Fail-closed:** brez organizacije / neobjavljen najemnik / izklopljen modul
  → bot ne odgovarja (`{ok:false, error:"unavailable"}`, widget pokaže
  neutravno napako), ne "morda". Nikoli ne odgovori za napačnega najemnika
  (E5-D9 — najemnik samo iz podpisane glave).
- **Rate limit:** `chat:ip` 30/10 min — spam/brute-force blokirane; legitimate
  obiskovalci nimajo problema (10 sporočil = pogovor).
- **Ni osebni podatkov brez konteksta:** v1 se ne zbira e-pošta/telefon.
- **IDOR:** conversationId se vedno preveri z organizationId (ne samo z id).
- **Sanitizacija:** auto-odgovor je le besedilo + akcije; obiskovalčev input
  ne vstopi v HTML (React escape), le v `body` (DB).
- **GDPR:** piškotek `mkc_conv` je anonski (ni povezan z osebo, dokler
  obiskovalec ne napiše sporočila — takrat se zabeleži kot podatki o fizični
  osebi, povezani z org). Ob GDPR izbrisu (`deleteMyAccount`) se pogovori
  ANONIMIZIRALI (body → null, visitorRef → null), ne izbrisali (poslovna
  evidenca, kot stranke).

## Odločitveni dnevnik

| # | Odločitev | Razlog |
|---|---|---|
| E5-D1 | **Skripte, ne LLM, v v1** | 0 € na pogovor, 0 halucinacij, 100 % SL, GDPR, deterministično testno |
| E5-D2 | **Org iz podpisane glave / seje / slug — NIKOLI iz payloada** | Isti vzorec kot Stripe webhook (P0 SECURITY) |
| E5-D3 | **Piškotek `mkc_conv` (anonimni id) — brez prisilnega računa** | Zadrži pogovor brez zidov; stranka lahko rezervira brez prijave |
| E5-D4 | **Bot NE zbira e-pošte/telefona v v1** | GDPR minimizacija; kontakt ostaja v rezervaciji (obstoječi tok) |
| E5-D5 | **`classifyIntent()` = ena točka nadgradnje** | LLM fallback v2 se vklopi samo tukaj; ostalo ostane |
| E5-D6 | **Widget z `next/dynamic` (lazy load)** | Ne v prvi JS javne strani (pravilo #9, bundle) |
| E5-D7 | **Inbox: permission `appointments.view`** | Isti prag kot waitlist; ne zahteva ločene permission |
| E5-D8 | **Bez SMS v v1** | SMS kanal #110 obstaja; sprejem po SMS je v2 (zahteva dvosmerni tok) |
| E5-D9 | **Chat = server action, NE `POST /api/chat`** | Proxy podpisuje najemniško glavo samo za `/s/*` + custom domene; fiksna pot `/api/chat` bi padla na "prvi objavljen najemnik" = napak ni najemnik. Server action deduje podpis iz konteksta strani (isti vzorec kot waitlist/booking). Odpravljeno + preverjeno z E2E. |

## Preizkusi

- `tests/reception/intents.test.ts` — classifyIntent (7 namenov, SL+EN,
  prioritete, help fallback, sanitizacija).
- `tests/reception/route.test.ts` — buildReply za 7 namenov (z/brez telefona,
  z/brez naslova, z/brez storitev); IDOR zaščita; nepoznan slug.
- `npm run test` (vitest) — vsi novi testi + obstoječi (brez regresije).
- `npx tsc --noEmit` — brez napak tipov.
- `npm run lint` — brez napak.
- **E2E (prezirač, 2026-11-18):** `/s/{slug}` → odpre chat → "Kdaj ste
  odprti?" → pravilne ure iz DB → "Koliko stane striž?" → cene iz DB →
  "Želim termin" → gumb Rezerviraj → `/s/{slug}/booking`. Pogovor v bazi
  (1 pogovor, 6 sporočil VISITOR/AUTO, status ACTIVE). IDOR: piškotek iz
  tuje org ni prenesen (tuji ref → nov). Lastnik: login → `/dashboard/chats`
  → pogovor viden → odgovor → status ACTIVE → REPLIED, števec 1/0 → 0/1.
- **IDOR preizkus:** chat na `/s/{slug-a}` s piškotkom iz `/s/{slug-b}` →
  pogovor ostane v org A (ni prenos med najemniki).

## Kaj NI v v1 (zavedno izpuščeno)

- LLM fallback ("pametni način") — v2, plačana dodatna vrstica
- SMS dvosmerni sprejem — v2 (zahteva dvosmerni tok z 46elks)
- Vozi na klice (telefonski AI) — v3, zahteva telefonski kanal
- Analitika pogovorov (koliko rezervacij je prinesel bot) — v2 (merjenje)
- Višji jezik kot SL/EN — v2 (po povpraševanju)
- Predlog termina v chatu (razpoložljivost) — v2 (zahteva getAvailableTimeSlots
  v odgovoru — trenutno bot vabi na /booking, kjer termin izbira že deluje)
