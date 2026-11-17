# GitHub Actions → Cloudflare Workers — nastavitev

Dokument opisuje, kako nastaviti avtomatski build in deploy na Cloudflare Workers prek GitHub Actions. Repo:

```
https://github.com/robertpezdirc12-design/markec-business-platform
```

## Kaj se zgodi ob `git push origin main`

```
push main
   │
   ├─► Job: quality      → tsc --noEmit + ESLint
   ├─► Job: test         → vitest + arhitekturni testi (pravi Postgres)
   │
   └─► Job: build-and-deploy  (čakata oba zgornja)
          ├─ 1. prisma migrate deploy   (shema baze)
          ├─ 2. pnpm run build          (OpenNext → .open-next/worker.js)
          ├─ 3. wrangler deploy         (na Worker)
          ├─ 4. wrangler secret put × N (runtime secreti)
          ├─ 5. wrangler secret list    (poročilo: samo imena)
          └─ 6. GET /api/health         (10 poskusov × 5 s)
```

Na PR v `main` in push na `fase1-review` teče samo `tests.yml` (brez deploya).

---

## Korak 1 — GitHub Secrets

V repo odprite **Settings → Secrets and variables → Actions → New repository secret** in dodajte spodnje.

### Obvezni (brez njih deploy pade)

| Secret | Kaj je | Kje dobiti |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | API žeton z dovoljenjem **Workers Scripts: Edit** | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | ID Cloudflare računa | Cloudflare Dashboard → desna stranska vrstica |
| `DATABASE_URL` | Poolana Neon Postgres povezava | Neon Dashboard → Connection string (pooled) |
| `DIRECT_URL` | Neposredna Neon povezava (za migracije) | Neon Dashboard → Connection string (direct) |
| `AUTH_SECRET` | NextAuth tajni ključ | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Alias za `AUTH_SECRET` | enaka vrednost kot `AUTH_SECRET` |
| `NEXTAUTH_URL` | Korenjska URL aplikacije | `https://markec-business-platform.robert-pezdirc12.workers.dev` |
| `NEXT_PUBLIC_APP_URL` | Javna URL (v client bundle) | enako kot `NEXTAUTH_URL` |

### Slikovno shranjevanje — R2 (priporočeno)

| Secret | Opomba |
|---|---|
| `R2_ACCOUNT_ID` | enak kot `CLOUDFLARE_ACCOUNT_ID` |
| `R2_ACCESS_KEY_ID` | R2 S3 API token |
| `R2_SECRET_ACCESS_KEY` | R2 S3 secret |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | npr. `markec-images` |
| `R2_PUBLIC_URL` | javni R2 domen, npr. `https://images.markec.si` |

### E-pošta (Resend)

| Secret | Opomba |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM_EMAIL` | npr. `MARKEC <info@markec.si>` |

### Plačila, cron, push, tenant, e-računi

| Secret | Opomba |
|---|---|
| `PLATFORM_STRIPE_SECRET_KEY` | platformno billing (ne najemniški — ti so v bazi) |
| `PLATFORM_STRIPE_WEBHOOK_SECRET` | webhook za platformni billing |
| `PLATFORM_ADMIN_EMAILS` | več emailov ločenih z vejico |
| `CRON_SECRET` | tajna za `/api/cron/tick` |
| `TENANT_PROXY_SECRET` | podpis tenant proxyja (privzeto `AUTH_SECRET`) |
| `UNSUBSCRIBE_SECRET` | HMAC za odjavo (privzeto `CRON_SECRET`) |
| `VAPID_PRIVATE_KEY` | Web Push |
| `VAPID_PUBLIC_KEY` | Web Push |
| `VAPID_SUBJECT` | npr. `mailto:info@markec.si` |
| `EINVOICE_SECRET_KEY` | e-računi |
| `EINVOICE_VALIDATOR` | validacija e-računov |
| `LEGACY_DEFAULT_SLUG` | samo če potrebujete migrate starega slug-a |

### Cloudinary (alternativa R2)

| Secret | Opomba |
|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | **javno** ime clouda — vgradi se v client bundle ob buildu |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |

### Google OAuth (opcijsko)

| Secret | Opomba |
|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

> **Pomembno:** prazni secreti se **preskočijo** — ne izbrišejo obstoječe vrednosti na Workerju. Če secret še ni nastavljen, ga lahko dodate kadarkoli in naslednji deploy ga bo prevzel.

---

## Korak 2 — Cloudflare API žeton

Minimalna dovoljenja za `CLOUDFLARE_API_TOKEN`:

```
Account  → Workers Scripts   : Edit
Account  → Account Settings  : Read   (za account ID, opcijsko)
Zone     → ne potrebujemo (workers.dev domena)
```

Žeton naj bo **Account-scoped** (ne User-scoped), sicer `wrangler` lahko javi `Invalid API Token` pri `/user/tokens/verify`, čeprav account endpointi delajo.

---

## Korak 3 — Workers plan (P0 blokator)

Na **Free planu** ima Worker **10 ms CPU na request**. Čeprav je koda pravilna, bodo `/`, `/start`, `/podjetja` občasno vrnile **Error 1102**.

**Za produkcijo je obvezno eno od:**
- **Workers Paid** — 30 s CPU, $5/mesec + usage
- **Vercel** — selitev deploya (drugačna konfiguracija)

Brez tega bo health check v workflowu opozarjal (`::warning::`), deploy pa bo tehnično uspel.

---

## Korak 4 — Preverjanje

Po uspešnem deployu odprite **Actions → zadnji run → Build & Deploy**. V povzetku (Summary) boste videli:

- Status quality gates, testov in builda
- Seznam imen vseh Worker secretov ( Cloudflare ne vrne vrednosti — samo imena)
- URL aplikacije

Roučno preverjanje:

```bash
curl -i https://markec-business-platform.robert-pezdirc12.workers.dev/api/health
# pričakujete HTTP 200 z JSON telesom

npx wrangler secret list --name markec-business-platform
```

---

## Korak 5 — Rotacija kompromitiranih ključev

Če ste ključe kadarkoli delili v klepetu, e-pošti ali jih commitnili:

1. **Cloudflare API žeton** → izbrišite in ustvarite novega
2. **R2 access key + secret** → ustvarite nov R2 API token, starega prekličite
3. Posodobite ustrezne GitHub Secrets
4. Sprožite `workflow_dispatch` z `skip_migrations: true` za takojšnjo uporabo novih ključev

---

## Dodatno — ročni deploy

Če želite deploy brez čakanja na quality gates:

```
Actions → Build & Deploy to Cloudflare Workers → Run workflow
       → izberite vejo → skip_migrations (če je shema že aktualna)
```

---

## Datoteke v repu

| Datoteka | Namen |
|---|---|
| `.github/workflows/deploy-cloudflare.yml` | Build + deploy na `main` |
| `.github/workflows/tests.yml` | Testi na PR / `fase1-review` |
| `wrangler.jsonc` | Worker config (`main`, `assets`, `vars`, `services`) |
| `scripts/build-smart.mjs` | Prisma generate + OpenNext build (skrije `.env` pred buildom) |
| `open-next.config.ts` | OpenNext Cloudflare adapter |
