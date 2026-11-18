# Prispevanje / Contributing

Hvala za interes za prispevanje k projektu **MARKEC – MY BUSINESS PLATFORM**. Repozitorij je lasten (proprietary), zato so spremembe sprejete samo v skladu z dogovorom z vzdrževalci/lastnikom projekta.

## Pred začetkom

- Preberi [`README.md`](README.md) za lokalno namestitev, okoljske spremenljivke in osnovne ukaze.
- Za arhitekturna načela glej [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) in [`docs/ADD-NEW-TEMPLATE.md`](docs/ADD-NEW-TEMPLATE.md).
- Ne vključuj skrivnosti, produkcijskih poverilnic, osebnih podatkov ali `.env` datotek v commite/PR-je.

## Lokalno okolje

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm exec prisma generate
pnpm run dev
```

Za delo z bazo uporabi lokalno ali namensko razvojno/testno bazo. Ne izvajaj destruktivnih operacij nad produkcijskimi podatki.

## Razvojni potek

1. Ustvari vejo iz ustrezne ciljne veje (npr. `main` ali dogovorjene feature veje).
2. Naredi majhne, pregledne spremembe z jasnim namenom.
3. Posodobi dokumentacijo, če sprememba vpliva na vedenje, nastavitev ali operativne postopke.
4. Pred PR-jem poženi relevantne preverbe.

## Preverbe pred PR-jem

```bash
pnpm run format:check
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test
```

Po potrebi (odvisno od spremembe):

```bash
pnpm run test:e2e
pnpm run test:itest      # zahteva testno DB okolje
pnpm run db:drift
pnpm run depcruise
```

> Če spremeniš odvisnosti, posodobi `pnpm-lock.yaml` (`pnpm install`) in commitaj spremembo.

## Pull requesti

- Jasno opiši **kaj** se spreminja, **zakaj** in kako je bilo preverjeno.
- Poveži issue/EPIC/fazo, če obstaja.
- Dodaj posnetke zaslona za vidne UI spremembe (če je primerno).
- Ne mešaj nepovezanih refaktorjev v isti PR brez utemeljitve.

## Koda in dokumentacija

- Ta repozitorij vsebuje tako aplikacijsko kodo kot obsežno projektno dokumentacijo v `docs/`.
- Pri spremembah spoštuj obstoječe vzorce, večnajemniško izolacijo (`organizationId` scoping) in varnostna pravila (avtorizacija na strežniku, brez izpostavljanja skrivnosti).
- Za večje arhitekturne spremembe predlagaj načrt v issue/PR opisu ali ustreznem `docs/EPIC-*` dokumentu.

## Vprašanja

Če nisi prepričan, odpri issue ali se uskladi z vzdrževalci pred večjo spremembo.
