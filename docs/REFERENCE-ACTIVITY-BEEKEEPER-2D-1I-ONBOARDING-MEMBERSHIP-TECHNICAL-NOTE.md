# MARKEC — ČEBELAR 2D-1I — TEHNIČNA UGOTOVITEV: MANJKAJOČE ČLANSTVO V ONBOARDINGU

> Samo **tehnična ugotovitev** — `src/app/actions/onboarding.ts` se NE spreminja brez izrecne odobritve
> (tuj WIP). Namenjeno predlogi minimalnega popravka in regresijskih testov. Statusi: PASS/PARTIAL/FAIL/BLOCKED.

## 1. Kontekst (dokazano v 2D-1H, izolirana baza)
Sveža registracija čebelarskega workspacea (prek `/start?vertical=beekeeping`) je v izolirani bazi ustvarila:
- `Organization` (beekeeping, ACTIVE),
- `User` (role ADMIN, `organizationId` → org),
- a **NE** `OrganizationMember`.

Simptom: `/dashboard` → `/workspaces` "Na tem računu ni aktivnih poslovnih prostorov." F2.1 message-based resolver
(`resolveSessionOrganization`) zahteva članstvo → dostop zavrnjen. Trenutno obhodno rešeno z izvajanjem
`scripts/backfill-organization-members.ts` (idempotentno, skipDuplicates) na test bazi (registracija → backfill).

## 2. Točno mesto izpusta
V `src/app/actions/onboarding.ts`, funkcija `createSalonOrganization` (od :82), po kreiranju org (:230):

- **Obstoječi račun** (`if (linkUserId)`, :250): članstvo se USTVARI takoj — `prisma.organizationMember.create({ organizationId: org.id, userId: linkUserId, role: "ADMIN", isDefault: !additionalOrg })` (:253-260).
- **Anonimni/sveži račun** (`else`, :298-342): kreira `User` (:301-339), nastavi `createdUserId = user.id` (:340) in **nikjer ne pokliče** `prisma.organizationMember.create`. → Članstvo se NE ustvari. **GROOT VZROK.**

Celotna funkcija ni v Prisma `$transaction` (org :230, user :301, membership :253 posamezni `await`; top-level
`try/catch` na :413). Funkcije so zato ločeni zapisi (vsak commit preventuralen).

## 3. Minimalni predlagani popravek (brez spreminjan registrov)
V **anonimni veji**, takoj po `createdUserId = user.id` (po :340), dodati enako članstvo kot v linking veji, z
idempotentnostjo:

```ts
// #100 F2.1: tudi za nov račun ustvarimo ADMIN članstvo (sveža registracija).
await prisma.organizationMember.createMany({
  data: {
    organizationId: org.id,
    userId: user.id,
    role: "ADMIN",
    isDefault: true,          // novo podjetje je lastnikovo prvo/default
  },
  skipDuplicates: true,       // idempotentno (ponovni zagon/zapise) — ni dvojnih članstev
})
```

`isDefault: !additionalOrg` je enakovredno — v anonimni veji `additionalOrg=null` → `!null=true` → `isDefault=true`.

## 4. Transakcijske in idempotentne zaščite (predlog)
- **Idempotentnost:** `createMany` + `skipDuplicates` prepreči podvojitev, če se korak ponovi ob retry/ponovnem
  zagonu. Rahlo PODPRTO (org/user create nista v $transaction), a `skipDuplicates` oslabi to slabost.
- **Atomic (močneje):** oviti org+user+membership+katalog v en `prisma.$transaction`, da je registracija atomarna;
  to je večji poseg in bi zahteval ustrezno urejanje (npr. seed/katalog lahko ostane zunaj). Kot minimalni prvi
  korak zadostuje `createMany skipDuplicates` (varna dodatek, brez preure janja); atomic je priporočena nadgradnja.
- **Cleanup:** na obstoječi `try/catch` ob napaki — uporabiti `createdUserId` za izbris, ko je potrebno (že obstoja
  za nov račun); za članstvo velja isti cleanup (brisati članstvo), če napaka prekliče registracijo.

## 5. Regresijski testi (predlog)
1. **Nova registracija:** `createSalonOrganization` z novim e-poštnim + beekeeping vertical → obstaja `Organization`
   (ACTIVE), `User` (ADMIN, org pointer), in **`OrganizationMember` (ADMIN, isDefault true)**; ponovljen korak
   ne doda dvojnega članstva (skipDuplicates).
2. **Obstoječi uporabnik (dodatno podjetje):** `linkUserId` → članstvo ADMIN za novo podjetje, `isDefault` upošteva
   `additionalOrg`; prejšnje podjetje ostane (Staff.userId 1:1 limitacija).
3. **Org izolacija:** članstvo samo za novo podjetje; `resolveSessionOrganization(admin, novOrg) === novOrg`.
4. **Cleanup ob napaki:** simulirana napaka po user-kreaciji → ne ostane osiromašeno org/user/članstvo.
5. **Backfill združljivost:** po napolnitvi, ponovni tek `backfill-organization-members.ts` → neskodljiv (0 ustvarjenih).

## 6. Blokada
`onboarding.ts` je **tuj neodobren WIP (M)**. Poseg zahteva **izrecno odobritev**. Po odobritvi bi se izvedel
minimalni dodatek iz §3 + regresijski testi iz §5. **Status: TECHNICAL NOTE (PASS); izvedba BLOCKED na odobritev.**