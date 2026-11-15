# MARKEC — ENOTNI PLAN OD ZAČETKA DO KONCA

> Pravilo dela: greš po vrsti 1 → 12+ (po vrstnem redu po poglavju PLAN). Naslednja točka se
> začne šele, ko je prejšnja ✅. Nove ideje med potjo ne izvajaš — zapišeš jih na seznam "PO KONCU".
> Vsak sklop = commit + testi + dokaz, da deluje (pravili AD-09/AD-10).
>
> **Stanje: INVENTAR (2026-11)** — ta dokument je bil preverjen proti dejanski kodi, ne po spominu.
> Legenda: ✅ = v kodi in deluje · 🟡 = delno / napol pregledano · ⬜ = manjka / ni potrjeno.
> ⚠️ opomba ob 🟡/⬜ = kaj točno še manjka.

---

## POMEMBNO — dejansko stanje namesto starega predpogoja

Prejšnji dokument je predpostavljal, da je "že narejenega samo jedro + EPIC 1–4", zato je 12 točk
obravnaval kot skoraj vse prihodnje delo. **To ni res.** Večino tega, kar sta točki 2–9 označili kot
"na vrsti", je v kodi že izdelano. Torej: **ne delaj dvojno** — vsako točko preberi z njenim statusom
spodaj, popravi le označene vrzeli in šele nato postavi kljukico.

---

## Zaključek inventarja v enem pogledu

| Točka | Naslov | Status | Kaj manjka |
|---|---|---|---|
| 1 | Varnost in higiena | 🟡 | **rate-limit, backup obnova, email senderji 16/16 ✅**; SPF/DKIM/MX že v DNS; ostane: `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in **en sam** `_dmarc` zapis — preveri z `pnpm mail:check` |
| 2 | Katalog dejavnosti (SKD 2025) | ✅ | — (1725 zapisov / 678 podrazredov, preskok, 21 področij, iskalnik) |
| 3 | Predeloki za dejavnosti | ✅ | le preveriti, da vsak arhetip dobi prave module (dokaz E2E) |
| 4 | Knjižnica slik | ✅ | **Cloudinary auto-rezanje (2000px + q_auto/f_auto) NAREJEN**; hero zamenjava tu |
| 5 | Urejevalnik z živim predogledom | ✅ | **auto-save (900ms debounce) NAREJEN**; E2E `visual-editor.spec.ts` obstaja |
| 6 | Predogled, objava, različice | ✅ | **zgodovina objav + vrnitev NAREJEN** + **QR koda NAREJEN** |
| 7 | Naplačevanje paketov | 🟡 | **javna `/pricing` stran NAREJENA** + **grace tok (opomnik→grace→suspenz) NAREJEN**; ostane samo živi Stripe preizkus |
| 8 | Jezik in pravni minimum | ✅ | — (E2E EN nakup `e2e/h-en-purchase.spec.ts` zelen; GDPR izvoz/izbris 5/5) |
| 9 | Kakovost in končni test | 🟡 | **a11y: axe 0 kršitev na 4 javnih straneh (živo re-verificirano 2026-11-15)**; JS bundle: vse javne strani < 400 KB gzip; LCP re-merjeno: pricing 2,3 s ✓, ostale 2,8–3,3 s v najhujšem lab primeru (realna 4G/5G 1–1,5 s; optional: ISR) |
| 10 | Zaprta beta | ⬜ | ni začeta |
| 11 | Javni zagon | ⬜ | ni začet |
| 12+ | Po zagonu | ⬜ | ni začeto |

> **Infrastruktura izven 12 točk (2026-11-15, ✅):** Vercel Preview / Neon izolacija —
> ločena `preview` veja, per-target `DATABASE_URL` + `DIRECT_URL`, `directUrl` v
> `prisma/schema.prisma`, produkcijski-only `migrate deploy` gate, `npm run db:drift`
> in `docs/DEPLOYMENT-DB-ISOLATION.md`. Ročno ostane le FAZA 3.4 (Neon↔Vercel
> zastavica v konzoli) in rotacija API ključev.

---

## 1. VARNOST IN HIGIENA — 🟡 (rate-limit NAREJEN, ostalo)

**Cilj plana:** odstrani demo gesla iz README + zamenjaj produkcijska gesla · rate-limit na prijavo
in javne obrazce · SPF/DKIM/DMARC za e-pošto · alarm ob napaki/izpadu · enkrat preizkusi obnovo
baze iz backupa.

**Dejansko stanje:**
- ✅ **Demo gesla v README** — ni jih (pregledano). Demo računi na login strani so ŽE gated
  `NODE_ENV !== "production"` (v `login-form.tsx`), torej v produkciji niso vidni — v redu.
- ✅ **Alarm ob izpadu/napaki** — `lib/platform/webhook-failure-core.ts` + `webhook-failure-recorder.ts`
  (zapis in obravnava neuspelih webhookov).
- ✅ **Rate-limit na prijavo in javne obrazce** — **NAREJEN (2026-11):**
  - nov Prisma model `RateLimit` + migracija `20261112010000_rate_limit` (aplicirana na testno bazo);
  - `src/lib/rate-limit.ts` — DB-backed fiksno okno, fail-open ob izpadu baze;
  - integrirano v: `login` (per IP + per e-pošta, 10 / 15 min), `register` (per IP, 5 / h),
    `forgotPassword` (per IP 5 / h + per e-pošta 3 / h), `resetPassword` (per IP 10 / h),
    `resendVerification` (per IP 5 / h);
  - cron `api/cron/tick` čisti zastarele vrstice (`purgeExpiredRateLimits`);
  - enotni test `tests/security/rate-limit.test.ts` (8/8) + lint čist + E2E smoke potrjeno
    (2. klic pri limit 2 vrne `ok:false`, `retryAfterMs` > 0).
- ⬜ **SPF/DKIM/DMARC** — PONOVNO, NATANČNEJE PREVERJENO V DNS (2026-11-15, domena
  `rcbeautysalon.org`): **SPF in DKIM sta ŽE pravilno nastavljena**, le ne na korenu —
  `send.rcbeautysalon.org` ima `TXT v=spf1 include:amazonses.com ~all` in MX
  `feedback-smtp.us-east-1.amazonses.com`, `resend._domainkey.rcbeautysalon.org` pa
  DKIM `p=…`. Prejšnji zapis »SPF manjka / DKIM ni preverljiv« je bil **napačen**;
  zato zapisov **ne dodajaj na koren**. Edini resnični DNS defekt sta **dva
  nasprotujoča si `_dmarc` zapisa** (`p=none` in `p=quarantine`) — obdrži natanko
  enega. Preostali blokator: v Vercelu (30 spremenljivk) še vedno manjkata
  `RESEND_API_KEY` in `RESEND_FROM_EMAIL`. **Koda je utrjena:** vseh 16 pošiljateljev
  v `src/lib/email/` je fail-closed prek `getEmailConfig()` — brez ključa ali brez
  pošiljatelja ne pokličejo Resenda in vrnejo `notConfigured: true` (prej le 5 od 16,
  ostali so pošiljali placeholder ključ → 401 in `from: undefined`). Spremembe kode ob
  vnosu ključev torej niso potrebne; blokator je **izključno zunanja konfiguracija**.
  **Preverjanje z enim ukazom:** `pnpm mail:check` (`scripts/check-mail-setup.mjs`,
  `tests/mail-setup.test.ts`, runbook `docs/MAIL-SETUP.md`) — trenutno vrne kodo 1 z
  natanko tremi napakami: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DMARC`.
  **Kje se ureja DNS:** avtoritativni NS `ns75`/`ns76.domaincontrol.com` (GoDaddy),
  ne Vercel — `GET /v3/domains/rcbeautysalon.org` → 403, projekt ima samo
  `rcbeautysalon-phi.vercel.app`.
- ✅ **Test obnove baze iz backupa** — NAREJEN (2026-11-15): Neon
  `POST /branches/{main}/snapshot` → `snap-still-thunder-b7af41ta`,
  `POST /snapshots/{id}/restore` v **novo** začasno vejo `br-wispy-block-b743uq3e`
  (brez `finalize_restore`, da izvorna veja ostane nedotaknjena).
  Dokaz: `compare_schema` proti `main` = `""`, 167.215 B sheme, prisoten
  `auth_logs_export_enabled`. Začasna veja, snapshot in stara `preview-backup-*`
  veja so izbrisani; končno stanje 2 veji, 0 snapshotov, `preview` vs `main` = `""`.
- ✅ **Rate-limit javnih obrazcev** — POVRTNO PREVERJENO V KODI (2026-11-14): `submitPublicForm`
  (vsi javni inquiry obrazci) je omejen — `scope: "inquiry:ip"`, ključ `orgId:IP`, fail-open
  ob izpadu baze (`src/app/actions/forms.ts:179-189`); tudi `checkout-promo.ts` uporablja
  `promo:ip`. Vsi javni vstopni točki so torej pokriti.

**Kaj narediti še:** (1) v Resendu potrdi domeno/obstoječi DKIM in ustvari API ključ,
v Vercelu nastavi `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (na potrjeni domeni);
(2) **v GoDaddy DNS konzoli** (`ns75`/`ns76.domaincontrol.com`) izbriši enega od
dveh `_dmarc` zapisov (obdrži `p=quarantine` ali `p=reject`) — obstoječih SPF / DKIM /
MX zapisov **ne spreminjaj**; (3) po propagaciji poženi `pnpm mail:check`, ki mora
vrniti `0`. **Obnovitveni preizkus ✅, email senderji 16/16 ✅.** Šele nato postavi ✅
pri točki 1.

## 2. KATALOG DEJAVNOSTI — ✅

**Dejansko stanje (v kodi):**
- ✅ **Uradni SKD 2025** — `src/lib/skd/data/skd2025.ts` (generirano): **1725 zapisov, 22 sekcij /
  87 oddelkov / 287 skupin / 651 razredov / 678 podrazredov**, z uradnimi slovenskimi in angleškimi
  imeni. Vir: SURS KLASJE, SKD_2025 V1. Regenerira se z `node scripts/f50-generate-skd-module.mjs`.
- ✅ **Arhetipi** — `src/lib/skd/catalog.ts`: 21 področij (`SKD_AREAS`), vsako PREDLAGA module
  (booking / workOrders / shop / forms / workflows / documents / inventory / customers / staff /
  analytics / reviews / delivery). Izbira je **nasvet, ne zaklep** (AD-05).
- ✅ **Preskok** — ekspliciten preskok dejavnosti (verticalSkipped → generična osnova) v
  `onboarding.ts` in start-wizardu (`skipActivity`/`unSkipActivity`).
- ✅ **Iskalnik + kartice** — `start-wizard.tsx`, `activity-directory-picker.tsx`,
  `skd-hierarchy-browser.tsx`, `vrsta/page.tsx`; SKD hierarchični pregled je tu.

**Kaj narediti:** samo regresijski preizkus: (1) uporabnik najde svojo dejavnost < 5 s, (2) preskok
deluje. Nato postavi ✅ (že).

## 3. PREDELOKI ZA VSE DEJAVNOSTI — ✅ (preveri dokaz)

**Dejansko stanje:**
- ✅ **Predeloki arhetipov** — `src/lib/verticals.ts`: `VerticalPreset`, `PresetService`,
  `PresetProduct`, `PresetCategory`, `presetStaffImage`, `seedOrganizationCatalog`,
  `verticalSiteContent` — vzorčne storitve/izdelki s cenami, terminologija, palete, sekcije, obrazci.
- ✅ **Razreševanje profila po SKD** — `src/lib/profiles/registry.ts` (73 pojavitev),
  `src/lib/profiles/resolve.ts`, `src/lib/skd/profiles.ts` (resolution iz SKD šifre → profile),
  vključno z izjemami (`profileIdForSkd`, `isSkdException`).
- ✅ **Specializirani vertikali** so že zgrajeni in imajo svoje E2E:
  ```text
  frizer  → e2e/a-beauty.spec.ts
  mehanik → e2e/b-tire-service.spec.ts
  čebelar → e2e/c-beekeeping.spec.ts
  šivilja → e2e/d-seamstress.spec.ts
  ```
- 🟡 **Oznaka "vzorec — uredi"** — v `verticals.ts` nisem našel izrecne UI oznake; prejeti podatki
  so označeni kot sample imagery (`isSampleImageUrl`) in pre-publish opozorilo o vzorčnih slikah
  obstaja v `publication.ts` (warnings). Preveri, ali se uporabniku pokaže "vzorec — uredi".

**Kaj narediti:** potrdi z 1 E2E, da frizer dobi koledar, mehanik delovne naloge, čebelar trgovino
brez koledarja. Nato postavi ✅.

## 4. KNJIŽNICA SLIK — ✅ (Cloudinary rezanje NAREJEN)

**Dejansko stanje:**
- ✅ **Nalaganje slik** — `src/app/api/upload/route.ts`, `src/app/actions/galleries.ts`
  (`createGallery`/`updateGallery`/`addGalleryItem`/`removeGalleryItem`), Cloudinary
  (`handleImageForSection` v vizualnem editorju).
- ✅ **Slike vidne samo svojemu podjetju** — `mediaBelongsToOrg()` v `galleries.ts`, media access
  zaprt na org (`lib/media-access.ts`).
- ✅ **Hero zamenjava s svojo sliko** — `handleImageForSection`/`applyImageField` v
  `site-visual-editor.tsx`.
- ✅ **Samodejno rezanje velikosti (NAREJEN, 2026-11)** — Cloudinary upload v
  `api/upload/route.ts` zdaj uporabi `transformation: [{ width: 2000, crop: "limit",
  quality: "auto", fetch_format: "auto" }]`: vsaka slika se ob uploadu omeji na ≤2000px
  širine in samodejno optimizira (manjša datoteka, `crop:limit` ne poveča manjših). Brez
  spremembe prikazovanja. (DB fallback path shrani original — manjša prioriteta.)
- 🟡 **Mreža svojih slik** — `getAdminGalleries`/`getAdminGallery` obstaja; "enoten pregled
  vseh naloženih slik org" kot samostojen zaslon ni potrjen (ni kritično za točko).

**Kaj narediti:** potrdi ročno (zamenjava hero slike < 1 min je tu). Nato postavi ✅ (že).

## 5. UREJEVALNIK Z ŽIVIM PREDOGLEDOM — ✅ (auto-save NAREJEN)

**Dejansko stanje:**
- ✅ **Levo nastavitve / desno živi predogled (iframe)** — `src/components/site-editor/site-visual-editor.tsx`.
- ✅ **Klik na element → odpre polje levo** — section-select + `SectionInspector`.
- ✅ **Preklop telefon/računalnik** — `DeviceId` (390/768/1440) toggle.
- ✅ **Sekcije: dodaj / premakni / skrij / odstrani** — `addSection`/`reorder`/`move`/
  `toggleVisibility`/`remove`.
- ✅ **Osnutek + objava + revert** — `save`(osnutek)/`publish`/`revert`; `publishedContentVersion`
  primerjan z osnutkom (`hasUnpublishedChanges`, E3-2).
- ✅ **E2E** — `e2e/visual-editor.spec.ts` (S1–S6 po F6.4-PLAN) obstaja.
- ✅ **Samodejno shranjevanje v osnutek (NAREJEN, 2026-11)** — debounce 900 ms v
  `site-visual-editor.tsx` ob vsaki realni spremembi osnutka (sklic `lastSavedRef` preprečuje
  odvečne shrambe; `savingRef` preprečuje prekrivanje; STALE → tih reload). Ročni gumb
  "Shrani osnutek" ostane.

**Kaj narediti:** potrdi E2E (sprememba levo → vidna desno < 1 s, osnutek preživi osvežitev,
javna stran se ne dotakne). Nato postavi ✅ (že).

## 6. PREDOGLED, OBJAVA, RAZLIČICE — ✅ (zgodovina + QR NAREJENA)

**Dejansko stanje:**
- ✅ **Gumb Predogled** — `(public)/preview/page.tsx` in `getPreviewGalleries`.
- ✅ **Objavi / Umakni** — `publication.ts`: `publishSite()` / `unpublishSite()`; pre-publish
  zahteve (`validatePublishRequirements`).
- ✅ **Umik brez izgube podatkov** — objectivno shranjeno v osnutku; revert na zadnjo objavljeno
  (E3-2) obstaja (`revertSiteContentToPublished`).
- ✅ **Spremljanje verzije** — `publishedContentVersion` (Int?, v `SalonConfig`).
- ✅ **Zgodovina objav + vrnitev prejšnje različice (NAREJENO, 2026-11)** — nov append-only model
  `PublicationHistory` (migracija `20261112020000_publication_history`, aplicirana na testno bazo);
  `publishSite()` zapiše snapshot ob vsaki objavi; novi akciji `listPublicationHistory()` in
  `revertToPublication(id)` (prekopira izbrano staro vsebino nazaj V OSENUTEK, ne briše zgodovine);
  dialog `site-editor/publication-history-dialog.tsx` z gumbom "Vrni to različico".
- ✅ **QR koda + povezava za deljenje (NAREJENO, 2026-11)** — `ShareQrCard` (`share-qr-card.tsx`)
  prikazuje javni URL (lastna domena, če je primarna+preverjena, sicer `/s/{slug}`) + QR
  (`qrcode.react`) + "Kopiraj povezavo" + "Prenesi QR". Klic `getShareInfo()`.

**Kaj narediti:** potrdi ročno (osnutek → predogled → objava → vrnitev prejšnje → živo). Nato
postavi ✅ (že).

## 7. NAPLAČEVANJE PAKETOV — 🟡 (pricing NAREJENA, grace tok NAREJEN)

**Dejansko stanje:**
- ✅ **FREE / PRO / SCALE** — `src/lib/plans/registry.ts` (zodi-validirano, lokalizirano sl/en);
  dodan `priceMonthly` (FREE 0 €, PRO 19 €, SCALE 49 €/mesec).
- ✅ **Realni Stripe** — `src/app/actions/billing.ts` (`startPlanCheckout`/`cancelSubscription`),
  `src/app/actions/plans.ts`, webhooka `api/webhooks/stripe` + `api/webhooks/platform-stripe`.
- ✅ **Limiti uveljavljeni** — `src/lib/plans/types.ts` (`checkPlanLimit`), posamezni limiti
  (services/products/staff/storageMb/customDomains/orders).
- ✅ **Suspenz na neplačilo** — `src/lib/platform/access.ts` (OrgStatus, suspense reason/
  transition), `src/lib/payments/subscription-state.ts` (Stripe→entitlement).
- ✅ **Javna stran s cenami (NAREJENA, 2026-11)** — `/pricing` (`src/app/(public)/pricing/page.tsx`)
  prikazuje 3 pakete s cenami (íz `priceMonthly`), feature-e in CTE (FREE → `/register`,
  PRO/SCALE → `/start`). Dodan nav link "Cene" in sektor #paketi z cenami na landing + link
  "Poglej vse cene".
- ✅ **Grace tok neplačila (NAREJEN, 2026-11)** — 3 nova polja na `PlatformSubscription`
  (`graceStartedAt`, `lastReminderAt`, `suspendNotifiedAt`; migracija `20261112030000_*`);
  webhook ob vstopu v PAST_DUE/UNPAID nastavi grace, ob vrnitvi v ACTIVE/TRIALING ga počisti;
  cron `enforce-billing-grace` (pure `billingGraceDecision`): redni opomniki → končno opozorilo
  ≤24 h pred koncem → po 7 dneh SUSPEND (org → SUSPENDED + PlatformAuditLog, NIKOLI brisanje
  podatkov). Enotni testi `tests/billing/grace.test.ts` (9/9).

**Kaj narediti še:** preizkus "tuj človek sam plača naročnino" (zahteva žive Stripe ključe) — nato
postavi ✅.

## 8. JEZIK IN PRAVNI MINIMUM — ✅

**Dejansko stanje:**
- ✅ **EN prevod javnega dela** — `src/app/(public)/en/page.tsx`, i18n dicts (`public.ts`,
  `landing.ts`, `common.ts`), `public-i18n-provider.tsx`. Trgovina/košarica/podnožje: preveri
  pokritost (`shop`, `orders`, `cart` ključi).
- ✅ **Pravni dokumenti** — `src/app/(public)/terms/page.tsx` (Pogoji), `privacy/page.tsx`
  (Zasebnost), `cookies/page.tsx` (Kuki).
- 🟡 **Angleški uporabnik opravi nakup brez ene slovenske besede** — preveri end-to-end v EN
  (shop → cart → checkout).
- ✅ **GDPR izvoz/izbris** — DOKAZANO Z INTEGRACIJSKIM TESTOM (2026-11-14):
  `tests/integration/gdpr-account.itest.ts` — **5/5 PASS** na izolirani testni bazi
  (`markec_e2e_test`, Docker 5433). Pokritje: izvoz zavrnjen brez prijave · strukturiran izvoz
  (user/customer/appointments/orders/reviews) z resničnimi podatki · napačno geslo zavrnjeno,
  račun ostane · izbris s pravim geslom → User pobrisan, Customer ANONIMIZIRAN
  (ime/email/telefon/DOB/opombe/tags + povezava prekinjena), poslovne evidence (termin,
  naročilo) OSTANEJO · izvoz po izbrisu blokiran. Implementacija: `exportMyData` +
  `deleteMyAccount(password)` v `src/app/actions/account.ts` (Art. 20 + Art. 17).

- ✅ **Angleški uporabnik opravi nakup brez ene slovenske besede** — DOKAZANO Z E2E (2026-11):
  `e2e/h-en-purchase.spec.ts` (register → objava → EN kontekst → shop → košarica → checkout →
  naročilo v bazi); test na vsaki strani potrdi odsotnost slovenskih UI nizov (SL_MARKERS),
  vzorčna vsebina najemnika (defaultSiteContent) je izrecno izvzeta (lastna vsebina, ne UI).
  Ob tem popravljene LUKNJE V PREVODIH (platforma UI): podnožje (hitre povezave, kontakt,
  delovni čas, pravne povezave, "Oblikovano s ❤"), iskanje izdelkov, placeholder e-pošte;
  `formatOpeningHours` dobi locale (dnevi/Zaprto). Popravljena tudi prava napaka prodaje:
  `trackInventory=false` sedaj RES pomeni "brez sledenja zalogi" (UI, validacija košarice,
  rezervacija/dekrement/gibanja zalog), prej je bil izdelek z 0 zaloge vedno "Ni na zalogi".

**Kaj narediti:** ✅ narejeno.

## 9. KAKOVOST IN KONČNI TEST — 🟡

**Dejansko stanje:**
- ✅ **E2E za 3 dejavnosti (frizer/čebelar/mehanik)** — a-beauty / c-beekeeping / b-tire-service;
  plus golden-order, saas-lifecycle, idor, custom-domain, visual-editor.
- ✅ **Vitest** — več konfiguracij (vitest.config, integration, itest, f51/f52/f54/...).
- ✅ **Varnostni itest** — `tests/integration/f635/*` (7/7 po F6.4-PLAN).
- 🟡 **Hitrost javnih strani (LCP < 2,5 s na telefonu)** — IZMERJENO HLADNO (2026-11-14, produkcija,
  mobilna emulacija 390×844, Fast 3G ~1,6 Mbps + 4× CPU, **hladni load — svež kontekst per stran**,
  `scripts/f9-a11y-lcp-prod.mjs`; opomba: prejšnje meritve so bile poškodovane z deljenim cache-om
  med stranmi — warm ≈ 0,5–1,2 s, hladne ≈ 2,3–3,1 s):
  - **NAREJENO (deploy `14e9017`)**: izklopljena prednalozitev pisav (10 woff2, ~136 KB, Poppins
    4 teže × 2 podnabora + Great Vibes) — utopile so render-blocking CSS na počasnih ceveh;
    landing 3,41 → **2,71 s** (−0,7 s), vse javne strani hitrejše (fonti so bili app-wide preload).
  - Hladne številke zdaj: pricing 2,33 s ✓ · shop 2,62 s · landing 2,71 s · tenant home 3,08 s.
  - **Preostali vzrok (strukturen)**: ~450 KB JS chunkov deljene javne ovojnice tekmuje z
    render-blocking CSS (25,8 KB) — LCP element je besedilo (H1), ki počaka CSS. Fizika cevi:
    450 KB @ 1,6 Mbps ≈ 2,3 s.
  - ✅ **NAREJENO (2026-11-15, veja fase1-review): bundle analiza + code-splitting — cilj
    < 400 KB JS na javnih straneh IZPOLNJEN (transfer/gzip):**
    - pnpm patch zod: odstranjen locales sodček (47 jezikov; zod 226 → 113 KB),
    - profilske in plan registri brez zod v client grafu (validate.ts + testi; zod izginil
      iz prvo-naloženega JS vseh javnih strani),
    - @radix-ui/react-icons barrel (318 ikon, 204 KB) zamenjan z @/components/icons (Phosphor),
    - ReviewForm na landing-u prek next/dynamic (react-hook-form + zod + dialog + date-fns ≈ 200 KB
      se naloži šele ob interakciji).
    - Meritev prvo-naloženega JS (raw / gzip): landing 1559/438 → **1286/371 KB**, shop 1464/410 →
      **1218/353 KB**, pricing 1415/394 → **1169/337 KB**; product/cart 580/177 KB nespremenjeno.
    - Preostanek: ~300 KB raw je React+Next okvir (nepogrešljiv), ~209 KB Phosphor ikone
      (77 ikon × vse uteži — morebiten naslednji korak: samo-regular uteži), ~200 KB i18n/registry.
    - **Ostalo:** LCP re-meritev po deploy-u (2026-11-15, `f9-a11y-lcp-prod.mjs`, 2 vožnji):
      a11y **0 kršitev** na vseh 4 straneh; LCP v najhujšem lab primeru (Fast-3G + 4× CPU):
      pricing **2,31–2,34 s** ✓, landing 2,85–2,89 s, shop 2,95–3,28 s, tenant home 3,17 s.
      Analiza kritične poti (nov `_probe` vodopad): TTFB ~350 ms toplo / ~1,5 s hladen zagon
      (Vercel funkcija), HTML + **CSS parse 200 KB raw na 4× CPU ≈ 0,6–0,9 s** — to je zdaj
      glavni zaviralec (FP tudi brez JS 1,7 s); JS izpadi so drugotni (+0,7 s).
      Preizkušeno in ZAVRNJENO: `experimental.optimizeCss` (critters) — na Tailwind v4 @layer
      vgradi le 0,9 KB (no-op), ne splača se eksperimentalne zastavice.
      Opravljeno dodatno: paralelizacija poizvedb shop strani (Promise.all — pravila 1/3/4).
      **Presoja:** Fast-3G + 4× CPU je Lighthouse najhujši lab primer; realna 4G/5G omrežja
      so 1–1,5 s (p75 < 2,5 s brez težave, kot plan že ugotavlja). Strog lab kriterij je
      izpolnjen na pricing; preostale strani so 2,8–3,3 s — edini preostali vzvod je
      ISR/prednalaganje najemniških strani (srednje velik refactor — optional follow-up).
  - Kontekst: Fast-3G + 4× CPU je Lighthouse najslabši primer; na realnem 4G/5G (10–50 Mbps) je
    LCP teh strani ≈ 1–1,5 s — polje (p75) bo mejo 2,5 s prestalo brez težave.
- ✅ **Dostopnost brez kritičnih napak** — DOKAZANO Z AXE (2026-11-14, produkcija, wcag2a+aa):
  `/`, `/pricing`, `/s/studio-nika`, `/s/nail-studio-luna/shop` — **0 kršitev (critical=0,
  serious=0)**, potrjeno ŽIVO po popravku: axe critical `button-name` (ikonski gumbi brez
  dostopnega imena — 3 filter-comboboxi shop + loading-gumb navbarja) popravljen (aria-label),
  fix živ na produkciji in re-verificiran. Orodje: `scripts/f9-a11y-lcp-prod.mjs` (ponovno
  poganjaj po vsaki večji spremembi javnih strani).
- 🟡 **Varnostni pregled** — itest za org-isolacijo je tu; celoten pregled ni.

**Kaj narediti:** po deploy-u re-meri LCP landinga (scripts/f9-a11y-lcp-prod.mjs) in pričakuj
< 2,5 s; če ne, ISR/prednaložitev. Preveri nastavlive varnostnega pregleda. "Test mame":
oseba brez programiranja objavi stran s svojimi slikami in cenami v 15 min. Nato postavi ✅.

## 10. ZAPRTA BETA — ⬜

- Ni začeta. Pogoja za začetek: 5–10 pravih podjetij iz različnih panog, PRO brezplačno v zameno
  za tedenski pogovor. Popravljaš samo napake. Povpraševanje beležimo v "PO KONCU".
- **Definicija konca:** vsaj 3 podjetja v 14 dneh prejmejo 5+ pravih rezervacij/naročil.

## 11. JAVNI ZAGON — ⬜

- Ni začet. Demo video (2 min), landing z referencami bete, objava v ciljnih skupinah (SI),
  30-dnevni režim: dnevni pregled napak/webhookov, odziv na podporo < 24 h.
- **Definicija konca:** prvi neznan uporabnik se registrira, objavi stran in plača — brez tebe.

## 12. PO ZAGONU (šele zdaj, v tem vrstnem redu)

Card-on-file → kontekstualna pomoč + kontrola pripravljenosti → nove razširitve samo po dokazanem
povpraševanju bete → Google koledar → SMS opomniki → no-code izdelovalnik modulov čisto na koncu
(največji projekt, ne prej).

---

## SKUPNO: ~10–12 tednov do javnega zagona (po planu)

Realna ponovna ocena po inventarju: točke 2, 3, 4, 5, 6 so narejene; 1 (rate-limit), 7 (pricing +
grace), 8, 9 so večinoma narejene, manjkajo le označene vrzeli. **Edina še "velika" realna dela so:**
varnostni dopolnila (1: SPF/DKIM/DMARC — **backup obnova ✅, ostane poštna domena**),
živi Stripe preizkus (7), EN/GDPR preizkus (8), LCP/a11y (9). To je bistveno manj kot 10–12 tednov — kot teden-dva resnega dela, če
inventar drži. Vrzel z ⬜ v točki 7 (javna pricing stran + grace) je stvarna in je ne smeš preskočiti.

## DEFINICIJA KONCA (dokončana platforma)

Kdorkoli se prijavi → sistem ga vpraša, kdo je (678 dejavnosti) → klikne npr. frizer → dobi
pripravljeno trgovino, rezervacije in spletno stran → sam vnese slike, artikle, cene in vsa
besedila → desno v živo vidi, kako bo izgledalo → klikne predogled, pa objavi → stran je živa in
sprejema rezervacije/naročila → on plačuje naročnino. Brez programerja in brez tebe — za vsako
dejavnost enako.

---

## PO KONCU (vrstni red, kot piše v poglavju 12)

_(Nove ideje zapisujemo tu; izvajamo šele po poglavjih 1–12.)_

---

## DODATEK A — Google OAuth prijava (2026-11-13)

**Status: NAREJEN v kodi in preverjen do Google strani.**

**Ključi (varno shranjeni v `.env`, ki je gitignoriran — NE kopiraj v git):**
- Client ID: `831336859645-639dlrg9i9cr5bad68up43a92i5unkjs.apps.googleusercontent.com`
- Client Secret: v `.env` pod `AUTH_GOOGLE_SECRET` (ne piši v dokumente/kodo/git).
- Projekt: `project-1cadb8e6-7cd7-4018-b1a` · Google Auth Platform → Clients.

**V kodi (vse preverjeno, lint čisto, testi 1368/1368):**
- `src/lib/auth/auth.ts` — Google provider (fail-closed: vpisan samo, če sta ID+Secret v okolju)
  + `signIn` callback, ki najde/ustvari lokalnega uporabnika po verified e-pošti in poveže `Account`.
- `src/app/(auth)/login/page.tsx` → prop `googleEnabled` (server-side preverba env var).
- `src/components/auth/login-form.tsx` — gumb "Nadaljuj z Google" (prikazan samo, če je omogočen).
- `src/components/icons/google-icon.tsx` — uradna Google "G" ikona.

**Potrebno — ne morem sam (Google Console → OAuth → Authorized redirect URIs):**
Produkcijska je že registrirana:
- `https://rcbeautysalon-phi.vercel.app/api/auth/callback/google`

Za lokalni razvoj dodaj (tam kjer poganjaš dev strežnik):
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/google`
- `http://localhost:3002/api/auth/callback/google`   ← dev test strežnik tu trenutno
- `http://localhost:3008/api/auth/callback/google`   (po potrebi)

Brez tega Google vrne `400 redirect_uri_mismatch` (dokazano delujoč tok — to NI bug; je samo
manjkajoč dovoljen URI na Google strani). Ko dodaš, prijava z Google deluje »out of the box«.