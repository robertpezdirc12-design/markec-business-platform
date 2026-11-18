# MARKEC – MY BUSINESS PLATFORM

[![Tests](https://github.com/robertpezdirc12-design/markec-business-platform/actions/workflows/tests.yml/badge.svg)](https://github.com/robertpezdirc12-design/markec-business-platform/actions/workflows/tests.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06b6d4?logo=tailwindcss&logoColor=white)
![pnpm 10](https://img.shields.io/badge/pnpm-10-f69220?logo=pnpm&logoColor=white)
![License: Proprietary](https://img.shields.io/badge/license-proprietary-lightgrey)

Univerzalna, modularna večnajemniška poslovna platforma za samostojne ponudnike in mala podjetja — od lepotnih salonov in frizerjev do avtoservisov, čebelarjev, šiviljstva in splošnih storitev.

> *Universal modular multi-tenant business platform for independent service providers — configurable per business vertical, without code changes for new industry profiles.*

🌐 **Produkcija:** [rcbeautysalon-phi.vercel.app](https://rcbeautysalon-phi.vercel.app)  
📚 **Arhitektura:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · **Vodnik za nov profil/razširitev:** [`docs/ADD-NEW-TEMPLATE.md`](docs/ADD-NEW-TEMPLATE.md)

> 🏷️ **Preimenovanje (#100):** aplikacija je bila sprva »RCBeauty« (lepotni saloni). Danes je **MARKEC – MY BUSINESS PLATFORM** — univerzalna platforma za katerokoli dejavnost. Nekateri tehnični identifikatorji (ime repozitorija, produkcijski URL, e-poštni naslovi, slug-i) zaenkrat ostajajo nespremenjeni, dokler lastnik ne odloči o migraciji.

## Kazalo

- [Ključne zmožnosti](#ključne-zmožnosti)
- [Tehnologije](#tehnologije)
- [Lokalna namestitev](#lokalna-namestitev)
- [Okoljske spremenljivke](#okoljske-spremenljivke)
- [Stripe plačila](#stripe-plačila)
- [Struktura projekta](#struktura-projekta)
- [Večnajemniškost](#večnajemniškost)
- [Testiranje in kakovost](#testiranje-in-kakovost)
- [Deployment](#deployment)
- [Dokumentacija](#dokumentacija)
- [Demo najemniki](#demo-najemniki)
- [Prispevanje in varnost](#prispevanje-in-varnost)
- [Licenca](#licenca)

## Ključne zmožnosti

### Profilni motor in dejavnosti (EPIC #1)
- **11 profilov dejavnosti:** lepotni salon, frizer, barber, nohti, kozmetika, masaža, epilacija, šiviljstvo, vulkanizer/avtoservis, čebelarstvo ter univerzalni profil.
- **Profil določa izkušnjo:** module, terminologijo (SL/EN), obrazce, delovne procese, dashboard widgete, javni CTA način (`booking | inquiry | order | quote`) in razširitve.
- **Matrika zmožnosti `required | optional | disabled`:** nepomembni moduli se ne izrisujejo (npr. čebelarstvo brez terminov/delovnih nalog tam, kjer niso smiselni).
- **Univerzalna delovna naročila** s konfigurabilnimi stopnjami, validiranimi prehodi in sledjo dogodkov.
- **Dinamični obrazci:** javna povpraševanja, admin inbox, urejanje polj brez kode in strežniška validacija.
- **Evidence po razširitvah:** vozila/gume (vulkanizer), serije/žetev (čebelarstvo), mere (šiviljstvo) prek registra razširitev — brez migracije za nov tip evidence.
- **Katalog in prodaja:** storitve, izdelki, variante, paketi, ponudbe in računi s številčenjem po najemniku.
- **Lastniška prilagoditev brez programiranja:** moduli, dashboard widgeti, obrazci in procesi z verzioniranjem.

### Razširitve in več dejavnosti (EPIC #2)
- **Registry razširitev** z deklarativnimi vnosi in tipiziranimi odvisnostmi.
- **Projekti + naloge:** večdnevni posli z pravilom zaključka in opozorili rokov.
- **Inventarni runtime:** `StockMovement` ledger, transakcijski prihod/odhod, zavrnitev negativne zaloge.
- **Več dejavnosti pod enim računom:** sekundarna panoga kot unija zmožnosti ob ohranjeni primarni terminologiji/konfiguraciji.
- **Zgodovina konfiguracije + rollback:** append-only sled sprememb, povrnitev kot nova verzija.

### SaaS platforma (EPIC #3)
- **Objava strani:** DRAFT/PUBLISHED/UNPUBLISHED, snapshot objave in povrnitev verzij vsebine.
- **Naročnine in plani:** FREE/PRO/SCALE, limiti, prikaz rabe, Stripe checkout + idempotenten webhook.
- **Grace politika:** neplačilo/downgrade **nikoli ne briše podatkov** — glej [docs/EPIC-3/GRACE-POLICY.md](docs/EPIC-3/GRACE-POLICY.md).
- **Lastne domene:** verifikacija prek Vercel Domains API, DNS navodila, host-based razrešitev najemnika.
- **Operaterska konzola `/platform`:** najemniki, naročnine, suspend/reaktivacija z revizijsko sledjo.

### Analitika, zdravje in vizualni pregled (EPIC #4)
- **Platformna analitika:** paketi, konverzija, odhod, prihodki, webhook zdravje (iz obstoječih tabel).
- **Najemniška analitika:** povpraševanja s poštenimi praznimi stanji; neobvezen lastni GA4 Measurement ID (samo na objavljeni strani).
- **Webhook dnevnik napak in zdravje:** beleženje neuspešnih dostav, javen `/api/health`, operaterski `/api/health/internal` (fail-closed), runbook v [docs/EPIC-3/ROLLBACK-BACKUP.md](docs/EPIC-3/ROLLBACK-BACKUP.md).
- **Najemniški Stripe ključi:** izključno lastniški vnos (env fallback za najemniška plačila odstranjen).
- **Nadaljevanje namestitve:** osnutek čarovnika v localStorage brez gesel, TTL 7 dni.
- **Vloge po meri (G8, E4-6):** katalog dovoljenj, per-salon vloge, uveljavljanje na ravni akcij in strani, brez eskalacije pravic.
- **Rezervacija brez spletnega plačila:** brez Stripe ključa se ustvari PENDING termin (plačilo ob obisku) z jasnim potrditvenim tokom.
- **Per-tenant SEO:** naslov/opis, Open Graph/Twitter kartice, canonical, `noindex` za osnutke.
- **Ponastavitev gesla:** samoslužni tok in admin ponastavitev z varnostnimi omejitvami.

### Konkurenčni P0 sklop (november 2026, #88–93)
- **Čakalna lista (#90):** prijava na zaseden termin, admin obvestilo z enim klikom (brez auto-bookinga).
- **Oznake strank + segmenti (#91):** proste oznake na strankah in linkih brez računa, strežniško filtriranje.
- **Dodatki storitvi / add-ons (#92):** doplačila z lastnim trajanjem, atomarni izračun iz DB in snapshot na terminu.
- **Transakcijska varnost rezervacij (#93):** advisory lock + transakcije na pisalnih poteh, `stripePaymentId @unique`.
- **Onboarding in terminologija (#88, #89):** prilagoditev korakov glede na velikost tima/način rezervacije ter panogno specifična terminologija.

### Večnajemniškost, rezervacije in trgovina
- **Javna pot najemnika:** `/s/[slug]` (npr. `/s/salon-luna/rezervacija`), org-scoped poizvedbe, profilne predloge in teme.
- **Rezervacije:** časovni pas `Europe/Ljubljana`, preverjanje razpoložljivosti, izbira storitve/osebja, preklic/prestavitev, e-poštna obvestila, pravila pologa, čakalna lista in add-ons.
- **Trgovina:** katalog, košarica, Stripe checkout, gostov checkout, offline naročilo brez Stripe ključa, identiteta naročila vezana varno (e-pošta), org-scoped podrobnosti naročila.
- **Blagrovane poti in UX:** platformni koren kot izložba, nevtralni 404 za gole vsebinske poti (razen eksplicitnega legacy pravila), kontekstna prijava, OwnerBar za lastnika.
- **Dvojezičnost:** slovenščina (privzeto) + angleščina; preklopnik v admin in javnem delu, preveden rezervacijski tok in ključni UI elementi.
- **Vloge:** `ADMIN`, `STAFF`, `CLIENTE` z dodatnimi per-salon omejitvami prek vlog po meri.

## Tehnologije

| Področje | Tehnologija |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Jezik | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Phosphor/Lucide ikone |
| Baza | PostgreSQL (Neon) + Prisma ORM |
| Avtentikacija | NextAuth.js v5 (Prisma adapter) |
| Plačila | Stripe (ključi na nivoju organizacije) |
| E-pošta | React Email + Resend |
| Obrazci/validacija | React Hook Form + Zod |
| Stanje (client) | Zustand |
| Testi | Vitest, Playwright |
| Paketni upravitelj | pnpm ≥ 10 (pin v `packageManager`, lockfile: `pnpm-lock.yaml`) |

## Lokalna namestitev

### Predpogoji
- **Node.js** ≥ 20.9 (priporočeno 22 LTS, kot v CI)
- **pnpm** prek Corepacka (repo uporablja točno različico iz `package.json#packageManager`)
- Dostop do PostgreSQL baze (lokalno ali Neon)

### Koraki

```bash
# 1. Uporabi pripeto različico pnpm
corepack enable

# 2. Namesti odvisnosti (deterministično, kot v CI/Vercel)
pnpm install --frozen-lockfile

# 3. Pripravi okolje
cp .env.example .env
# izpolni DATABASE_URL, DIRECT_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL, ...

# 4. Pripravi bazo
pnpm exec prisma generate
pnpm run db:push      # ali: pnpm run db:migrate
pnpm run db:seed      # neobvezno: demo podatki za lokalni razvoj

# 5. Zaženi razvojni strežnik
pnpm run dev          # http://localhost:3008 (Turbopack)
```

## Okoljske spremenljivke

Najmanjša lokalna konfiguracija (glej [`.env.example`](.env.example) za celoten seznam):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/markec_db"
DIRECT_URL="postgresql://user:password@localhost:5432/markec_db" # za migracije/direct access
AUTH_SECRET=""              # npr. openssl rand -base64 32
NEXT_PUBLIC_APP_URL="http://localhost:3008" # uskladi z lokalnim dev URL-jem

# Neobvezno: dedno preusmerjanje golih poti na določenega najemnika
# LEGACY_DEFAULT_SLUG="ime-najemnika"
```

> **Stripe (najemniška plačila):** ključe vnese **vsak lastnik salona** v *Nastavitve → Plačila*. Platforma ne uporablja skupnega env ključa za najemniška plačila (env fallback odstranjen). `PLATFORM_STRIPE_*` spremenljivke so namenjene izključno platformnemu računu za naročnine SaaS.

## Stripe plačila

Nastavitev za lastnika salona (brez urejanja `.env` na strežniku):

1. Prijava kot admin → **Nastavitve → Plačila**.
2. V Stripe Dashboardu kopiraj **Secret key** (`sk_test_…` ali `sk_live_…`).
3. V aplikaciji shrani ključ — veljavnost se preveri prek Stripe API-ja.
4. (Priporočeno) dodaj webhook endpoint v Stripe:
   - URL: `https://<tvoja-domena>/api/webhooks/stripe`
   - Dogodek: `checkout.session.completed`
   - `whsec_…` skrivnost vnesi v **Nastavitve → Plačila**.

**Varnostne opombe:**
- Ključ je vezan na organizacijo in se brskalniku ne vrača (samo maskiran prikaz).
- Webhook podpis se preverja s skrivnostmi organizacij.
- Brez lastnega ključa se plačilni tok elegantno degradira (rezervacija brez pologa / offline naročilo, brez izgube povpraševanja).

## Struktura projekta

```text
.
├─ src/
│  ├─ app/                  # Next.js App Router (public, customer, staff, admin, auth, api)
│  │  ├─ (public)/          # javne strani (prek /s/[slug] proxyja)
│  │  ├─ (customer)/        # strankov portal (shop, cart, checkout, my-*)
│  │  ├─ (staff)/           # portal za osebje
│  │  ├─ (admin)/dashboard/ # nadzorna plošča
│  │  ├─ (auth)/            # prijava, registracija, onboarding (/start)
│  │  ├─ actions/           # server actions
│  │  └─ api/               # API routes (npr. webhooks)
│  ├─ components/           # UI, dashboard, booking, shop komponente
│  ├─ lib/                  # domenska logika, auth, i18n, tenant, stripe, profili, ...
│  └─ proxy.ts              # /s/[slug] prepis + x-org-slug + role guards
├─ prisma/                  # schema, migracije, seed
├─ docs/                    # arhitektura, EPIC načrti, operativni/runbook dokumenti
├─ tests/                   # Vitest testi (unit, architecture, plans, profiles, security, ...)
├─ e2e/                     # Playwright testi
├─ scripts/                 # build/migrate/check/utility skripte
└─ .github/workflows/       # CI (tests), deploy/diag workflow-i
```

> Opomba: struktura `src/app` in modulov se razvija; za podrobnosti glej [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Večnajemniškost

1. Zahteva na `/s/<slug>/...` se prek `src/proxy.ts` prepiše na interno pot in označi z `x-org-slug`.
2. Domenska logika in poizvedbe so organizacijsko omejene (`organizationId` / tenant scoping).
3. Vsaka organizacija ima lastno temo, vsebino, katalog, osebje, stranke, naročila, nastavitve plačil, valuto in časovni pas.
4. Onboarding na `/start` ustvari najemnika, izbere dejavnost in materializira začetno konfiguracijo (obrazci, procesi, katalog, tema).

Gole vsebinske poti na platformnem gostitelju (`/shop`, `/services`, `/staff`, `/booking`, `/cart`, `/inquiry`) vrnejo 404, razen če je eksplicitno nastavljeno `LEGACY_DEFAULT_SLUG` za dedne povezave.

## Testiranje in kakovost

### Pogosti ukazi

```bash
pnpm run lint                 # ESLint
pnpm run format:check         # Prettier check
pnpm exec tsc --noEmit        # typecheck
pnpm run test                 # Vitest (unit/architecture/...)
pnpm run test:watch           # Vitest watch
pnpm run test:e2e             # Playwright
pnpm run depcruise            # dependency-cruiser

# DB testi / integracija (zahteva testno bazo)
pnpm run test:db:push
pnpm run test:itest

# Preverbe sheme/pošte/assets
pnpm run db:drift
pnpm run mail:check
pnpm run check:assets

# Runtime preverba izolacije najemnikov (zahteva DATABASE_URL)
DATABASE_URL=… pnpm exec tsx scripts/verify-tenant-isolation.ts
```

### CI

Workflow [`.github/workflows/tests.yml`](.github/workflows/tests.yml) na `push`/`pull_request` izvaja:
- **Quality:** `pnpm install --frozen-lockfile`, Prisma generate, TypeScript check, ESLint, audit poročilo (trenutno neblokirajoče).
- **Unit & architecture tests:** proti PostgreSQL 16 servisu (`prisma db push` + `vitest run` + arhitekturni/security/plans/profiles testi).
- **Build check:** preverjanje uspešnega builda (glej workflow za podrobnosti).

## Deployment

- **Vercel + Neon (trenutna produkcijska postavitev):** povezava z repozitorijem, PostgreSQL na Neonu.
- **Webhook endpoint:** `https://<domena>/api/webhooks/stripe`
- **Cloudflare build skripte:** `build:cf`, `build:cloudflare`, `preview:cloudflare`, `deploy:cloudflare` (OpenNext + Wrangler) — glej `wrangler.jsonc`, `open-next.config.ts` in workflow-e.
- **DB izolacija preview/production:** operativni priročnik v [docs/DEPLOYMENT-DB-ISOLATION.md](docs/DEPLOYMENT-DB-ISOLATION.md).

> Po spremembi odvisnosti vedno posodobi `pnpm-lock.yaml` z `pnpm install`, sicer lahko build pade z `ERR_PNPM_OUTDATED_LOCKFILE`.

## Dokumentacija

| Dokument | Namen |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arhitekturna načela, skupno jedro, profili/razširitve |
| [`docs/ADD-NEW-TEMPLATE.md`](docs/ADD-NEW-TEMPLATE.md) | Dodajanje novega profila/razširitve |
| [`docs/DEPLOYMENT-DB-ISOLATION.md`](docs/DEPLOYMENT-DB-ISOLATION.md) | Vercel/Neon izolacija okolij in migracije |
| [`docs/EPIC-1/ARCHITECTURE.md`](docs/EPIC-1/ARCHITECTURE.md) | Univerzalna platforma (profilni motor) |
| [`docs/EPIC-2/PLAN.md`](docs/EPIC-2/PLAN.md) | Razširitve po panogah |
| [`docs/EPIC-3/PLAN.md`](docs/EPIC-3/PLAN.md) | SaaS platforma |
| [`docs/EPIC-3/GRACE-POLICY.md`](docs/EPIC-3/GRACE-POLICY.md) | Grace politika (neplačilo/downgrade) |
| [`docs/EPIC-3/GDPR.md`](docs/EPIC-3/GDPR.md) | GDPR opombe |
| [`docs/EPIC-3/E2E.md`](docs/EPIC-3/E2E.md) | E2E opombe |
| [`docs/EPIC-3/ROLLBACK-BACKUP.md`](docs/EPIC-3/ROLLBACK-BACKUP.md) | Rollback/backup runbook |
| [`docs/EPIC-4/PLAN.md`](docs/EPIC-4/PLAN.md) | Analitika, zdravje, vizualni pregled |
| [`docs/EPIC-5/PLAN.md`](docs/EPIC-5/PLAN.md) | Nadaljnji načrt (EPIC 5) |
| [`docs/KONKURENCA-ANALIZA-2026-11.md`](docs/KONKURENCA-ANALIZA-2026-11.md) | Konkurenčna analiza (november 2026) |

## Demo najemniki

Produkcija vsebuje demo najemnike za pokritost panog (primeri):

| Panoga | Javna stran |
| --- | --- |
| Frizer | [`/s/demo-frizer`](https://rcbeautysalon-phi.vercel.app/s/demo-frizer) |
| Barber | [`/s/demo-barber`](https://rcbeautysalon-phi.vercel.app/s/demo-barber) |
| Naili | [`/s/demo-nails`](https://rcbeautysalon-phi.vercel.app/s/demo-nails) |
| Kozmetika | [`/s/demo-kozmetika`](https://rcbeautysalon-phi.vercel.app/s/demo-kozmetika) |
| Masaža | [`/s/demo-masaza`](https://rcbeautysalon-phi.vercel.app/s/demo-masaza) |
| Epilacija | [`/s/demo-epilacija`](https://rcbeautysalon-phi.vercel.app/s/demo-epilacija) |
| Lepotni salon | [`/s/demo-lepotni`](https://rcbeautysalon-phi.vercel.app/s/demo-lepotni) |
| Šiviljstvo | [`/s/demo-siviljstvo`](https://rcbeautysalon-phi.vercel.app/s/demo-siviljstvo) |
| Vulkanizer | [`/s/demo-vulkanizer`](https://rcbeautysalon-phi.vercel.app/s/demo-vulkanizer) |
| Čebelarstvo | [`/s/demo-cebelarstvo`](https://rcbeautysalon-phi.vercel.app/s/demo-cebelarstvo) |

> **Varnost:** v javnem repozitoriju ne objavljamo produkcijskih poverilnic. Za lokalni razvoj uporabi `pnpm run db:seed` in gesla iz `prisma/seed.ts` (namenjena izključno lokalni bazi). V demo okoljih brez Stripe ključa se plačilni tok degradira v pričakovano vedenje (polog ob obisku / offline naročilo).

## Prispevanje in varnost

- Prispevanje: glej [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Varnostna poročila: glej [`SECURITY.md`](SECURITY.md).
- Licenca: glej [`LICENSE`](LICENSE).

## Licenca

**Proprietary — vse pravice pridržane.**  
Neavtorizirano kopiranje, spreminjanje, distribucija ali uporaba ni dovoljena brez izrecnega pisnega dovoljenja imetnika pravic.

---

Zgrajeno z Next.js 16, React 19 in Tailwind CSS v4.
