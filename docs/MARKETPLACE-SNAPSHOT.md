# Marketplace snapshot ob buildu — zakaj in kako

## Problem

Cloudflare Workers **Free** ima **10 ms CPU limit na HTTP zahtevek**. Stran `/podjetja` je prej ob vsakem obisku zagnala **5 vzporednih Prisma/Neon poizvedb**:

```
getMarketplaceBusinesses / getRecommendedBusinesses / getPopularBusinesses
getNewBusinesses / getMarketplaceStats
```

Rezultat: `error code: 1101` (izjema) in `1102` (CPU) v ~80 % zahtevkov. Build v GitHub Actionsu tega ne more rešiti — limit velja v **fazi izvajanja**, ne v fazi gradnje.

## Rešitev — Možnost B

Podatke pridobimo **enkrat ob buildu** v GitHub Actionsu (kjer ni CPU limita in je `DATABASE_URL` na voljo), jih zapišemo v statičen JSON, ki se uveljavi v bundle. Ob zahtevku `/podjetja` bere samo ta JSON in filtrira v spominu — **nič DB, nič fetch-a**.

### Tok

```
GitHub Actions build:
  prisma generate
  → scripts/generate-marketplace-snapshot.mjs   (DATABASE_URL iz secretov)
  → src/data/marketplace-snapshot.json          (generirano)
  → next build / OpenNext                       (JSON se uveljavi v bundle)
  → wrangler deploy

Ob zahtevku /podjetja:
  snapshot.ts → filterBusinesses() v spominu → SSR → 200 brez DB
```

## Datoteke

| Datoteka | Vloga |
|---|---|
| `scripts/generate-marketplace-snapshot.mjs` | Build-time generator. Pri manjkajoči/nedosegljivi bazi zapiše prazen snapshot in **ne ustavi builda**. |
| `src/data/marketplace-snapshot.json` | Generirani podatki + `generatedAt`. Committan je prazen fallback. |
| `src/lib/marketplace/snapshot.ts` | Branje snapshot-a, filtriranje `?q=` / `?location=`, razdelitev v Recommend/Popular/New, oznaka starosti. |
| `src/app/(marketplace)/podjetja/page.tsx` | Ne kliče več akcij iz `app/actions/marketplace.ts`. Ostane `force-dynamic`, da `searchParams` delujejo. |
| `scripts/build-smart.mjs` | Pred OpenNext buildom pokliče generator, dokler je `DATABASE_URL` še na voljo. |

## Poštenost podatkov

- Prikazana je oznaka `Podatki posodobljeni <datum>` neposredno pod herojem.
- Če baza ob buildu ni dosegljiva, je snapshot prazen in stran prikaže resnično prazno stanje — ne lažnih številk.
- Podatki so lahko zastarali do naslednjega deploya. To je zavestna trgovina za delovanje na Free planu.

## Kaj ni rešeno

**`/s/<slug>` (javne strani najemnikov)** ostanejo na Free planu nestabilne. Te strani:
- gredo skozi middleware z internim `fetch`-em na `/api/public/resolve-tenant`,
- nato izvedejo **8 DB poizvedb** v `src/app/(public)/page.tsx` (storitve, izdelki, osebje, mnenja, galerije, FAQ, štetja, moduli).

Snapshot teh strani ob buildu **ni mogoč** brez pokvaritve izdelka: lastnik spreminja vsebino iz dashboarda in spremembe bi bile vidne šele po naslednjem deployu. Zato za najemniške strani velja:

- **Workers Paid** (30 s CPU) — edina zanesljiva rešitev brez spremembe arhitekture, ali
- selitev na **Vercel**, kjer CPU limit ne velja na ta način.

## Preverjanje po deployu

```bash
# 10/10 mora biti 200
for i in $(seq 1 10); do
  curl -sS -o /dev/null -w "%{http_code} " \
    "https://markec-business-platform.robert-pezdirc12.workers.dev/podjetja"
done; echo

# Iskanje iz snapshot-a
curl -sS "https://markec-business-platform.robert-pezdirc12.workers.dev/podjetja?q=frizer" \
  | grep -o "Rezultati za"
```

Če je v logu builda vrstica `[snapshot] written to ... (N businesses ...)`, je snapshot uspešen. Če piše `baza ni dosegljiva`, preverite `DATABASE_URL` v GitHub Secrets.
