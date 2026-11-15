# Varna izolacija Vercel Preview / Neon — operativni priročnik

> Stanje: **vzpostavljeno in preverjeno 2026-11-15**. Ta dokument je vir resnice za
> povezavo med Vercelom, Prismo in Neonom. Nadomešča zastarele trditve v
> `docs/EPIC-3/ROLLBACK-BACKUP.md` (§6.2) in `docs/EPIC-4/PLAN.md` (E4-2b), ki
> pravita, da *vsak* Vercel build poganja `prisma migrate deploy`.

## 1. Zakaj

Pred posegom je bila ena sama `DATABASE_URL` dodeljena ciljem
`production, preview, development` in je kazala na produkcijsko Neon vejo
`main`. `package.json` je `node scripts/migrate-with-retry.mjs` zaganjal v
**vsakem** buildu. Posledica: vsak Preview deploy je izvedel
`prisma migrate deploy` na produkcijski bazi — shemo bi spremenil še pred
pregledom PR-ja. Cilj je bil ločiti podatkovni ploskvi, ne da bi pri tem
ohromili lokalni razvoj.

## 2. Končna arhitektura

```
Koda (main)                     Vercel env (po cilju)             Neon rcbeautysalon-db
                                bold-cell-76839441
prisma/schema.prisma
  url       = DATABASE_URL  ──► production: main -pooler      ──► main      (primary, PROD)
  directUrl = DIRECT_URL    ──► production: main direct       ──► preview   (PREVIEW + DEV)
                                preview/development: preview
scripts/migrate-with-retry.mjs
  shouldRunMigrations()         VERCEL_ENV=production → migriraj
  VERCEL_ENV=preview|development → preskoči
  VERCEL_ENV ni nastavljen     → migriraj (lokalni build)
  MIGRATE_FORCE=1              → izrecen nadzorovan zagon
```

Projekt: Vercel `rcbeautysalon` = `prj_wWddLpLHTwmFoAliAe6lLwx9f7Fj`,
production branch `main`, git `robertpezdirc12-design/rcbeautysalon`.

## 3. Matrika okoljskih spremenljivk

| Spremenljivka | production | preview | development |
|---|---|---|---|
| `DATABASE_URL` | `main`, pooled (`ep-floral-star-…-pooler`) | `preview` (`ep-dark-boat-…`) | `preview` (`ep-dark-boat-…`) |
| `DIRECT_URL` | `main`, ne-pooled (`ep-floral-star-…`) | `preview` | `preview` |

- `pooler=false` na Neon endpointih, vendar integracija še vedno izpostavi
  pooled host za produkcijski runtime. Zato je `directUrl` nujen: migracije
  morajo iti na ne-pooled endpoint.
- `src/` ne bere nobene druge Neon spremenljivke — preverjeno z iskanjem po
  `POSTGRES_*`, `PGHOST`, `PG*`, `DATABASE_URL_UNPOOLED`, `NEON_*` v celotnem
  repozitoriju. Edini porabnik je `prisma/schema.prisma`.
- 14 neuporabljenih integracijskih poverilnic (`PGHOST`, `POSTGRES_URL`,
  `POSTGRES_PASSWORD`, …) je bilo zoženih na `["production"]`, da ne morejo
  po pomoti pricurljati v Preview. Tri metapodatkovne vrednosti
  (`NEON_AUTH_BASE_URL`, `NEON_PROJECT_ID`, `VITE_NEON_AUTH_URL`) ostanejo na
  vseh treh ciljih — niso poverilnice in ne odpirajo dostopa do `main`.
- **Pozor:** teh 14 vrednosti upravlja Neon↔Vercel integracija. Ob njeni
  ponovni sinhronizaciji se lahko cilji vrnejo na vse tri — po vsaki večji
  spremembi integracije matriko preveri z `GET /v9/projects/{id}/env`.

## 4. Odmik sheme `preview` veje — najpomembnejše operativno tveganje

Ker Preview buildi **ne** migrirajo, se shema `preview` veje ne posodablja
samodejno. Ko produkcijski deploy aplicira novo migracijo, `preview` ostane na
stari shemi. PR z novo migracijo bo build zaključil, a bo aplikacija v Preview
v času izvajanja padla (manjkajoč stolpec/tabela).

**Danes (2026-11-15) odmika ni**: `compare_schema` med `preview` in `main`
vrne `{"diff":""}`; oba produkcijska deployja sta javila
`shema baze je aktualna`.

### 4.1 Preverjanje (berljivo, varno)

```bash
NEON_API_KEY=... node scripts/check-preview-schema-drift.mjs
# ali: npm run db:drift
```

Izhodne kode: `0` = ni odmika, `1` = odmik, `2` = napaka API/konfiguracije.
Zaženi pred odpiranjem PR-ja z migracijo in po vsakem produkcijskem deployu.

### 4.2 Sinhronizacija — dve možnosti

**A. Priporočeno: obnovi `preview` vejo iz `main` (Neon API).**
Veja obdrži svoj ID, zato praviloma ostane tudi endpoint host in Vercelovih
vrednosti ni treba spreminjati. Postopek je **destruktiven za podatke na
`preview` veji** — zato vedno shrani trenutno stanje:

```bash
# 1. shrani IDs
MAIN=br-patient-cherry-b7f2c3ib       # primary veja
PREVIEW=br-weathered-glitter-b7blquxp # preveri v Neon konzoli

# 2. obnovi; preserve_under_name ustvari varnostno kopijo stare vsebine
curl -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"source_branch_id\":\"$MAIN\",\"preserve_under_name\":\"preview-backup-$(date +%Y%m%d-%H%M)\"}" \
  "https://console.neon.tech/api/v2/projects/bold-cell-76839441/branches/$PREVIEW/restore"

# 3. preveri endpoint host (primerjaj z ep-dark-boat-b76z5aio) in shemo
curl -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/bold-cell-76839441/endpoints"
NEON_API_KEY=... node scripts/check-preview-schema-drift.mjs
```

Če se endpoint host spremeni, osveži štiri vrednosti v Vercelu
(`DATABASE_URL` in `DIRECT_URL` za `preview` + `development`) z novim
`GET /projects/{id}/connection_uri?branch_id=$PREVIEW&database_name=neondb&role_name=neondb_owner&pooled=false`.
Nato izbriši začasno `preview-backup-*` vejo, ko potrdiš, da je vse delovalo.

**B. Namesto obnove: nadzorovan enkraten zagon migracij proti `preview`.**
`MIGRATE_FORCE=1` zaobide `shouldRunMigrations()`. Uporabi **izključno** z
`VERCEL_ENV=preview` in `DATABASE_URL`/`DIRECT_URL`, ki kažeta na `preview`
vejo — nikoli v produkcijskem kontekstu. Primernejše, če želiš ohraniti
testne podatke na `preview` veji.

### 4.3 Zaporedje ob PR-ju z migracijo

1. PR vsebuje `prisma/migrations/*` → Preview build preskoči migracije (pravilno).
2. Pred mergeom zaženi `db:drift`; če javlja odmik, izvedi §4.2 A ali B.
3. Merge v `main` → produkcijski deploy aplicira migracijo na `main`.
4. Takoj po deployu ponovno sinhroniziraj `preview` (§4.2 A) ali ponovi `db:drift`.

## 5. Statični povezovalni nizi

Šest vrednosti `DATABASE_URL` / `DIRECT_URL` je bilo ustvarjenih prek
`GET /projects/{id}/connection_uri`. Pet od njih je **navadnih šifriranih
nizov**, ne skrivnosti integracijske shrambe; edina izjema je produkcijski
`DATABASE_URL`, ki ga še vedno upravlja integracija in se samodejno osvežuje.

**Če Neon zamenja geslo vloge `neondb_owner`** (rotacija poverilnic,
`reset_password`), je treba teh pet vrednosti ročno osvežiti v Vercelu,
sicer Preview in `development` deployji izgubijo povezavo. Preveri z
`GET /v9/projects/{id}/env/{envId}` (posamični endpoint vrne dešifrirano
vrednost; seznam je ne vrne).

## 6. Preverjanje po spremembah (evidence iz 2026-11-15)

| Deploy | Cilj | Rezultat |
|---|---|---|
| `dpl_AWrhZGA5Cg9fR3Q9mPcnxQ8HZYnX` | Preview (PR #115) | `preskočim migracije (VERCEL_ENV=preview)`, `Build Completed` |
| `dpl_Ekdxvvb5xsoPP92R6hFCDR8YA4Gb` | production (PR #115) | migracije izvedene, READY |
| `dpl_DH3MzSZkBWQjubLnAjjS6rXMstUd` | Preview (PR #116) | `preskočim migracije`, `Build Completed` |
| `dpl_FfnFJy6KDbgWWNEXJzMS5ddxQ4u7` | production (PR #116) | `shema baze je aktualna`, `Build Completed`, brez P1012 |

Vsi štirje so `READY`, brez `errorCode`. Produkcijski alias vrača HTTP 200,
Preview alias HTTP 302. `npx prisma@6.19.0 validate` preide z dummy
`DATABASE_URL` + `DIRECT_URL`.

## 7. Postavke, ki ostajajo ročne (nadzorne plošče)

1. **FAZA 3.4** — Neon konzola → `rcbeautysalon-db` → Integrations → Vercel:
   omogoči *Prevent automatic branch creation per preview* in potrdi
   `production → main`, `preview → preview`. Neonov organizacijski API ključ
   na `/api_keys` in `/integrations` vrača `not allowed for organization API
   keys`; Vercelov integracijski endpoint vrača 403.
2. **Rotacija ključev** — opravi **zadnjo**, saj ukine API dostop:
   Vercel → Settings → Tokens, Neon → Organization Settings → API keys.
   `DOMAINS_VERCEL_TOKEN` je **drugačen** žeton (preverjeno s primerjavo
   zgoščevin), zato rotacija ne pokvari `src/lib/domains/vercel-domains.ts`.
3. Ob rotaciji posodobi `NEON_API_KEY` / `VERCEL_TOKEN` povsod, kjer se
   uporablja `check-preview-schema-drift.mjs` ali API skripte.

## 8. Hitri diagnostični ukazi

```bash
# Vercel: vse env vrednosti (ZAHTEVA teamId kot query parameter)
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/prj_wWddLpLHTwmFoAliAe6lLwx9f7Fj/env?teamId=$VERCEL_TEAM_ID"

# Neon: veje in endpointi
curl -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/bold-cell-76839441/branches"
```
