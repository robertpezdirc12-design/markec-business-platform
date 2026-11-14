# F2.2.2 — Zaključni pregled (odprava dokazanih napak brskalniškega testiranja)

> Status: **ZAKLJUČENO** — izveden celovit pretres v resničnem Chromium brskalniku
> (realni NextAuth login za ADMIN/STAFF/CLIENTE, gostova + prijavljena rezervacija),
> celotni Vitest, integracijski testi, TypeScript in ESLint. Vsaka točka ima
> PASS / FAIL / NOT VERIFIED + konkreten dokaz (exit code 0 ali živa stran / URL).
>
> Metodologija: dev strežnik `next dev -p 3000` na `markec_dev` (migrirana + seedana),
> skripta `scripts/2026-…`; pregled žive strani prek brskalnika, DB vpogledi v
> `markec_dev`, in `scripts/f222-*` probe skripte. Brez produkcijskih migracij,
> brez posegov v Staff.userId, brez commit/push.

---

## 1. Uvod

F2.2 je sprejeta (`docs/F2-2-ZAKLJUCNI-PREGLED.md`). F2.2.2 je pregled skozi
pravi brskalnik, ki je na F2.2/F2.2.2 odkril dodatne napake. Ta dokument
razrešuje vsako z dokazi iz živih preverjanj.

| # | Prio | Napaka | Sekcija |
|---|------|--------|---------|
| 1 | P0 | demo ADMIN nima OrganizationMember članstva — 22 admin strani brez ročnih posegov | 2 |
| 2 | P0 | gostova rezervacija izgubi tenant kontekst; IDOR guard | 3 |
| 3 | P1 | Decimal serializacija pri posredovanju Client komponentam | 4 |
| 4 | P1 | telefon prijavljene stranke ni prefilled + jasna validacija | 5 |
| 5 | P1 | dev okolje: `markec_dev` + .env; tenantska resolucija 3000 in 3001 | 6 |
| 6 | P1 | Resend brez ključa ne sme biti prikazan kot "delujoča e-pošta" | 7 |
| 7 | P2 | slike, grafikon NaN, krajšanje imen storitev, hydration | 8 |

---

## 2. P0-1 — demo ADMIN + OrganizationMember (seed)

**PASS**

Popravljen `prisma/seed.ts`: ustvari eno deterministično demo organizacijo
(`demo-salon`, ACTIVE + PUBLISHED) in zanjo `OrganizationMember` vrstice
(idempotentni `upsert` na `@@unique([organizationId, userId])` → nobenih
duplikatov). Admin → ADMIN (+`isDefault:true`), 4× zaposleni → STAFF. `User.organizationId`
(legacy M2 kazalec) je nastavljen na demo org. Ves demo katalog (storitve,
izdelki, stranke, roki, naročila) je **scoped na demo org**, da so admin
strani in javna stran polni (ne prazni).

Dokaz — idempotenca na `markec_dev` (nov zagon + ponovni zagon):
```
Services 12 / null_org 0 / members 5 (1 ADMIN + 4 STAFF) / products 6 / appointments 10   # drugi zagon NI podvojil
```

Dokaz — realen Chromium login (realni NextAuth):
```
PASS | ADMIN admin@rcbeautysalon.org/admin123 → /dashboard  HTTP 200
  "+82.2% ... +200.0% ... 211,09 €" (org podatki prisotni, ne prazno)
PASS | STAFF laura@rcbeautysalon.org/staff123 → /staff-portal  HTTP 200
PASS | CLIENTE cliente@rcbeautysalon.org/cliente123 → /my-account  HTTP 200
```
Preverjene admin podstrani (vse HTTP 200, brez napak/NaN):
`/dashboard`, `/dashboard/analytics`, `/dashboard/appointments` (+ `/new`),
`/dashboard/appointments/[id]`, `/dashboard/users`, `/dashboard/products`,
`/dashboard/services`, `/dashboard/orders`, `/dashboard/staff`, `/dashboard/settings`,
`/dashboard/marketing`, `/dashboard/waitlist`, `/dashboard/walk-in`, `/dashboard/forms`,
`/dashboard/packages`, `/dashboard/roles`, `/dashboard/records`, `/dashboard/documents`,
`/dashboard/projects`, `/dashboard/work-orders`, `/dashboard/products/stocktake`.

---

## 3. P0-2 — gostova rezervacija: ohranjen tenant kontekst + IDOR

**PASS**

Popravljen (usklajen) preusmeritve v `src/components/booking/booking-form.tsx`:
uspešna gostova rezervacija brez spletnega plačila → `router.push('${tenantPrefix}/booking/success?appointment=…')`,
kjer `tenantPrefix` pride iz `useOrgPrefix()` (trenutni `/s/<slug>` iz poti). Úspešna stran
je org-scoped; na custom domeni gola pot. IDOR guard v `src/app/(public)/booking/success/page.tsx`
iskanje omeji na `organizationId: site.org.id` — tuj/neznan id → "not found".

Dokaz (realen Chromium, gost brez seje, salon brez Stripe):
```
POST /s/demo-salon/booking?service=haircut-style  → success TRUE
URL po oddaji:  http://localhost:3000/s/demo-salon/booking/success?appointment=cmw9…zakyzyux
  → tenant kontekst OHRAJEN (/s/demo-salon), ne platforma
"Rezervacija oddana! … 75,00 € … Striženje in oblikovanje … 11. nov. 2026 ob 09:00 … Maja Kovač"
Osvežitev istega URL-ja → še vedno prikaže termin.  HTTP 200
IDOR: /s/demo-salon/booking/success?appointment=cmw99999999990000foreign
  → "Rezervacija ni bila najdena" (tuj id nedostopen)  HTTP 200
```

---

## 4. P1-3 — Decimal serializacija

**PASS**

Vsi javni/adminski podatki, ki gredo v Client komponente, so Decimal→number
že v akcijah: `getServiceForBooking` (`price.toNumber()`, `depositValue.toNumber()`),
`getPublicShopProducts` (`price`/`compareAtPrice` `.toNumber()`), `getTopServices/products`,
`getStaffPerformance` (`depositAmount/tipAmount/commissionAmount .toNumber()`),
analytics revenue (`Math.round(...*100)/100`), orders/checkout (`toNumber()`).

Dokaz: analitika, admin termin [id], shop, booking, cart — vse prikažejo cene
brez RSC "Only plain objects …" napak; `formatCurrency`/`toNumber` po celotnem
prometu. Nadzorna plošča "Prihodki (ta mesec) 211,09 €", termin "75,00 €",
produkt "28,00 €" — vse čiste vrednosti, brez `[object Decimal]` / NaN.

> Opomba: e-poštni ključ/senderje brez ključa vrnemo kao `{success:false}` —
> glej sekcijo 7.

---

## 5. P1-4 — telefon prijavljene stranke + validacija

**PASS**

`src/app/(customer)/booking/page.tsx` predizpolni `phone` iz Customer profila
(najprej org-scoped profil, nato najnovejši); `defaultValues.phone` in
`buildAuthenticatedBookingSchema` validata telefon ob oddaji.

Dokaz (realen Chromium, prijavljen CLIENTE John Doe na `/s/demo-salon/booking?service=manicure`):
```
#phone value = "+386 40 200 202"    ← predizpolnjeno iz profila (profil prikazuje isti)
#firstName = John / #lastName = Doe / #email = cliente@rcbeautysalon.org
```

---

## 6. P1-5 + P1-6 — dev okolje in tenantska resolucija 3000 / 3001

### 6a. P1-5 dev okolje — PASS

- `markec_dev` je **migrirana + seedana** (schema `prisma db push`, nato `tsx prisma/seed.ts`).
- `.env` kaže na `markec_dev` (ni prazen), **ne** na `markec_review`.
- Idempotenčni ponovni seed — brez duplikatov (glej §2).

### 6b. P1-6 porta 3000 / 3001 — PASS (resolucija odvezana od fiksnega porta)

`src/lib/tenant-proof.ts`: v razvoju razreševalnik uporabi **izvor ZAHTEVE**
(kadar je loopback) namesto env-pined `:3000`, na obeh straneh (proxy signer +
resolver verifier) → podsistemi, ki ga uporabljajo, ne bodo več fiksirani na
:3000. Produkcija ostane nespremenjena (izolacija ohranjena).

Dokaz — regresijska vitest datoteka `tests/p16-portcheck.test.ts` (3/3 exit 0):
```
proxyResolverOrigin({nextUrl: localhost:3001/s/demo-salon}) → http://localhost:3001   # NODE_ENV=development
resolverExpectedOrigin(localhost:3001/api/public/resolve-tenant) → http://localhost:3001
production (attacker host) → https://markec.example (env origin, izolacija)
```

Dokaz na živo:
- `next dev -p 3000` na `markec_dev` → `/s/demo-salon` HTTP 200, `GET /api/public/resolve-tenant?slug=demo-salon 200`.
- `next dev -p 3001` z `NEXT_PUBLIC_APP_URL/NEXTAUTH_URL=http://localhost:3001`
  → `/s/demo-salon` HTTP 200 (tenant stran), `GET /api/public/resolve-tenant?slug=demo-salon 200`.

> Omejitev (iskreno): NextAuth–Next zahteva, da sta `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL`
> enaka dejanskim vratom dev strežnika (kanonični URL). Razreševalnik (točka P1-6)
> je port-agnosticen; preostala vezava je NextAuth middleware. `.env` to dokumentira
> (opomba ob NEXTAUTH_URL/NEXT_PUBLIC_APP_URL). To NI šibitev tenant izolacije
> (proof še vedno vezan na realen izvor; production fail-closed).

---

## 7. P1-7 — Resend brez ključa

**PASS (konfiguracija pošteno ne razglaša e-pošte za delujočo) / delivery = NOT VERIFIED**

`src/lib/email/config.ts` `isEmailServiceConfigured()` → `false` kadar ni
`RESEND_API_KEY` ali kadar se začne z `re_placeholder`; vsi email senderji
vrnejo `{success:false}` ob napaki/401; `createAppointment` zapisuje
`confirmationSentAt` SAMO ob `success !== false`.

Dokaz iz dev log (guest booking brez veljavnega ključa):
```
Resend error: { message: 'API key is invalid' … statusCode: 401 }
```
→ pošiljanje ni razglašeno za delujočega; termin ni označen kot "confirmacija poslana".
`RESEND_API_KEY` v `.env` ni nastavljen. Test `tests/seo/tenant-metadata.test.ts` zelen.

> **Dejansko pošiljanje e-pošte je NOT VERIFIED** (F2.2 sprejemna kontrola #4): v
> demo okolju ni veljavnega `RESEND_API_KEY`, zato dostave ni mogoče dokazati.
> Ne trdimo, da e-pošta odhaja; trdimo le, da sistem brez ključa vrne iskren
> neuspeh (tu dokazano z 401) in ne lažnega uspeha. Ključ ni nikoli izpisan v
> loge ali poročilo; v repo/tracked datotekah ni REAL `re_…` ključa (samo
> literal `"re_placeholder_not_configured"`).

---

## 8. P2 — slike, grafikon NaN, krajšanje imen, hydration

### 8.1 Slike — PASS

Vsi self-hosted asseti v `public/img/media/**` obstajajo (services, products,
staff, hero, brand). Na živi strani `/s/demo-salon` (390/1280/1440) ni broken-image
napak; le LCP `loading="eager"` priporočila (ne napake). Reference v
`src/lib/default-assets.ts` se ujemajo z dejanskimi datotekami.

### 8.2 Grafikon NaN — PASS

`src/components/analytics/staff-performance-chart.tsx`: NaN pri ničelnih
vrednostih je izviral iz neusklajenosti lokaliziranih kategorij (sl: "Termini")
z angleškimi data-ključi ("Appointments"). Popravljeno: data-ključi uporabljajo
ISTE lokalizirane imena kot Tremor `categories` + `finiteOrZero()` sanitizacija
v `valueFormatter`.)

Dokaz (analytics, realni Chromium):
```
PRIJE:  Error: <rect> attribute y: Expected length, "NaN".  (številne)
POTEM:  brez NaN; os Y "0 25 50 75 100"; ustrezni stolpci Termini/Prihodki.
```
Regresijski test `tests/deposit-rules-79.test.ts` (38/38) posodobljen in zelen.

### 8.3 Krajšanje imen storitev — PASS

Imena na kartah (storitve) uporabljajo `truncate`/`line-clamp` — namerni UI za
dolga imena, brez izgube podatkov. Stran `/s/demo-salon/services` (1440 px)
prikaže vsa 12 imen/popisov pravilno.

### 8.4 Hydration opozorila — DELNO (open P2)

Na nekaterih straneh (booking, appointments, products, users, my-account,
cart) brskalnik prijavi `A tree hydrated but some attributes … didn't match`.
Vzrok: Client komponente uporabljajo `new Date(iso).toLocaleDateString()` /
`toLocaleString()` (server TZ vs. brskalnik) in/ali uporabo datotek pod
kirifno, ki se med SSR in client razlikuje. Strani še vedno delujejo (oddajanje
termina, seznam, urejanje) — opozorili ne blokirajo. **FAIL/FIX za 0 hydration
opozoril v tem pregledu ni bil dosežen** (P2, po sprejemu lahki hardening:
deterministične oblike datumov ali `suppressHydrationWarning` pri teh
komponentah). To je edini delno nerešen P2.

---

## 9. Zaključne kontrole (exit kode)

| Preverjanje | Ukaz | Rezultat |
|-------------|------|----------|
| Celotni Vitest | `npx vitest run` | **82 datotek, 1185/1185, exit 0** |
| Integracijski | `npx vitest run --config vitest.integration.config.ts` | **3 datoteke, 58/58, exit 0** |
| TypeScript | `npx tsc --noEmit` | **exit 0 (brez napak)** |
| ESLint | `npm run lint` | **exit 0, 0 errors (4 warningi v `start-wizard.tsx`, pred-obstoječi)** |
| Realni Chromium login ADMIN/STAFF/CLIENTE | browser-flow | **PASS (glej §2)** |
| Gostova rezervacija | browser-flow | **PASS (§3)** |
| Prijavljena rezervacija + telefon prefill | browser-flow | **PASS (§5)** |
| Nakup/košarica + naročila | browser-flow | **Košarica PASS; checkout zaključek NOT VERIFIED (demo–Stripe nekonfiguriran), naročila se prikazujejo (§6/account)** |
| 390 / 768 / 1280 / 1440 px | browser-flow | **390 PASS, 768 PASS (javno + admin dashboard, brez overflow/napak), 1280 PASS, 1440 PASS** |

---

## 10. Sprejemna odluka

- **P0 — 2/2 PASS** (member + gostova rezervacija/IDOR).
- **P1 — 5/5 PASS** (Decimal, telefon, dev okolje, resolucija porta, Resend; delivery Resend NOT VERIFIED).
- **P2 — 3/4 PASS, 1 odprt (hydration opozorila) — ne blokira sprejema P0/P1.
- **Produkcijski blokator (ločen):** `prisma migrate deploy` na sveže prazni bazi pade na prvi migraciji (§11.7) — `db push` NIJE dokaz delujočega migracijskega postopka.

F2.2.2 je **sprejemljiv po P0 in P1**. P2–hydration ostaja dokumentiran odprti
kos za naslednjo iteracijo (determinističen format datumov / suppressHydrationWarning).
Migracijski red (`migrate deploy` od sveže baze) je **ločen produkcijski blokator**,
ki zahteva ločeno bazo-opravilo, NE velja za F2.2.2 kodo (pred-obstoječ).

Zadnja veljavna stanja so potrjena z exit kod 0 v vseh spodnjih kontrolah in z
živimi pregledi v Chromium.

---

## 11. F2.2 — FINAL ACCEPTANCE CHECK (končna sprejemna kontrola)

Ponovljen sprejenni pregled F2.2 na zaključnem stanju (ni novih funkcij; ni
produkcijskih migracij; ni commit/push).

### 11.1 `tests/deposit-rules-79.test.ts` diff — ni oslabljen — PASS

Diff spremeni samo keys 3. testa (#79 "chart renders them as their own
categories"):
```diff
-   expect(chart).toMatch(/Tips: staff\.tips/)
-   expect(chart).toMatch(/Commission: staff\.commission/)
+   expect(chart).toMatch(/\[catTips\]: finiteOrZero\(staff\.tips\)/)
+   expect(chart).toMatch(/\[catCommission\]: finiteOrZero\(staff\.commission\)/)
+   expect(chart).toMatch(/\[catAppointments\]: finiteOrZero\(staff\.appointments\)/)
+   expect(chart).toMatch(/\[catRevenue\]: finiteOrZero\(staff\.revenue\)/)
```
Jedro #79 (provizije/napitnine so LOČENA linija, nikoli vključene v prihodek)
še vedno preverja: vsaka od `staff.tips`/`staff.commission`/`staff.appointments`/
`staff.revenue` se zapiše v LOČEN data-ključ grafa iz SVOJEGA `staff.*` polja —
odštevanje katerekoli vrstice (npr. združitev tips v revenue) bi test
spustilo. Keys so zdaj lokalizirani (iskanje se ujema s Tremor `categories`),
kar je ISTI razlog kot popravek NaN (§8.2). Test ostaja zelen 38/38.

### 11.2 Decimal → number natančnost — PASS (brez izgube)

- Vse denarne kolone so `@db.Decimal(10,2)` (prisma/schema.prisma) — 10 števk,
  2 decimalki, daleč pod JS-safe int mejo (2^53).
- Vsi prometni pretvorniki pretvorijo OBJAVLJENO prejo: `getServicesForBooking`
  (`price.toNumber()`, `depositValue.toNumber()`), `getPublicShopProducts`,
  `getTopServices/Products`, `getStaffPerformance` (`deposit/tip/commission .toNumber()`),
  `getRevenueChartData` (`Math.round(x*100)/100`), orders/checkout.
- Vsako množenje, ki uvaja možni float šum (20 % popust zaposlene, pologi v
  %, provizije), gre skozi `round2()` (`Math.round((n+EPSILON)*100)/100`) ali
  `Math.round(x*100)/100` PRED pisno v Decimal(10,2) kolono oz. v Stripe
  `unit_amount` (cents, `Math.round(x*100)`).

Dokaz (izračun na živih vrednostih):
```
75 × 0.8 → 60 ; round2=60 ; Decimal(10,2) storitve=60.00 ; Stripe 6000 ; float noise=60
35 × 0.8 → 28.00 (booking UI "Cena 35,00 €, Popust -7,00 €, Končna 28,00 €")
```
Stored value je vedno natančno na cent; ni izgube natančnosti.

### 11.3 Viewport 768 px — PASS (dopolnjeno)

Realni Chromium pri 768×1024: javna stran `/s/demo-salon` (page width 758,
brez horizontal overflow) in admin `/dashboard` (sidebar collapse → "Odpri
meni"; brez overflow/napak) — vse čisto. Viewporti 390/768/1280/1440 so
sedaj vse dokazani.

### 11.4 Resend — delivery NOT VERIFIED

Dejansko pošiljanje ni preverjeno (ni veljavnega `RESEND_API_KEY`); sistem
isceno vrne `success:false` ob neuspcu (dokaz 401 v §7). Ne izpisuje ključa.

### 11.5 `.env` v Git / skrivnosti — PASS

- `git check-ignore -v .env` → `.gitignore:11:.env*` (`.env` je ignoriran).
- `git ls-files .env` → prazno (ni trackan).
- `git diff --cached --name-only` → prazno (NIČ ni staged za commit).
- `git grep "CVM0…WY="` (AUTH_SECRET vrednost) → ni zadetka v tracked.
- `git grep "postgres:postgres@localhost:5432/markec_dev"` → ni zadetka.
- Skrivnosti ne prisotne v diff niti pripravljene za commit. Only `re_placeholder_not_configured` je literal v kodi.

### 11.6 F2.2.1 popravki dokazani v kodi — PASS

Pregled `src/app/actions/workspace-management.ts` + `src/lib/invitations/hash.ts`
potrjuje, da so vse F2.2.1 spremembe v kodi (dokumentira jih tudi
`docs/F2-2-ZAKLJUCNI-PREGLED.md` §2–4 kot "before"/"after"):

| F2.2.1 kos | Stanje v kodi |
|------------|---------------|
| varno brisanje praznega workspacea | `deleteWorkspace` — izrecna potrditev (`confirm`), ACTIVE-only, hard-delete blokiran ob obstoju poslovnih podatkov, samo-član lastnik; sicer kaskadni izbris + čiščenje povabil (§249–325) |
| kopiranje povabilne povezave | `handleInvite` sestavi `origin/invite/<token>` → `setCreatedLink` → dialog z gumbom **Kopiraj** (`navigator.clipboard.writeText`), stanje `copied` (§392–418, 661–704) |
| hashiranje tokena | `hashInvitationToken` = `createHash("sha256")`; `inviteMember` shrani SAMO hash, surovi token vrne enkrat; sprejem/preklic iščejo po hashu (§517–531, 549–551, 621–623) |
| preklic / potek / enkratna uporaba | `revokeInvitation`→REVOKED (sprejem zavrnjen); `acceptInvitation` zavrne poteklega (`expiresAt < now`) in je ATOMSKO enkraten (`updateMany … status:PENDING`) (§546–615) |
| arhivirani workspace + omejitve | `inviteMember`/`acceptInvitation` zahtevata ACTIVE org; `deleteWorkspace` blokira arhivirane prosto­re (§265–270) |

### 11.7 Migracijski problem — LOČEN PRODUKCIJSKI BLOKATOR

`prisma migrate deploy` na sveže prazni bazi pade pri **prvi** migraciji:
- `20251030000000_add_user_reset_token_and_prefs` izvaja `ALTER TABLE "Appointment" …`
  in `ALTER TABLE "User" ADD…` + FK na `User` (migration.sql §13) — a `User`/`Appointment`
  še ne obstajata,
- A `20251116063324_init` (ki ustvari `User`/`Appointment`) se sortira PO njej
  (16.11 > 30.10) → tabel še ni → `current transaction is aborted`.

Dokaz: omemba v F2.2 §1.4; pregled `prisma/migrations/` vrstnega reda + SQL
(vidna neskladja). `db push` (uporabljen za dev/test) **NI dokaz** delujočega
`migrate deploy` pipe. Ta blokator NI krivda F2.2.2 kode (pred-obstoječ red)
in zahteva ločeno bazo-opravilo (npr. urediti vrstni red/squash init pred
ALTER-ji, ali preveriti migriranje na obstoječi bazi).

### 11.8 Ponovljeni testi (exit kode)

| Kontrola | Izid |
|----------|------|
| Celotni Vitest (`npx vitest run`) | **82 datotek, 1185/1185, exit 0** |
| Integracijski (`vitest.integration.config.ts`) | **3 datoteke, 58/58, exit 0** |
| TypeScript (`npx tsc --noEmit`) | **exit 0** |
| ESLint (`npm run lint`) | **exit 0 (0 errors, 4 warninga v start-wizard.tsx, pred-obstoječi)** |
| Browser (Chromium) | ADMIN/STAFF/CLIENTE login PASS; tenant stran + booking PASS; analitika brez NaN PASS; 768 px PASS; gostova rezervacija + IDOR PASS (§2–3) |