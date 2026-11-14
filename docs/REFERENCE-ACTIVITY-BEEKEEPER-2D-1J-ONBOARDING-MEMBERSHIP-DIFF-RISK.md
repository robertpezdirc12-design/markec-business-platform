# MARKEC — ČEBELAR 2D-1J — ONBOARDING ČLANSTVO: MINIMALNI DIFF + TVEGANJE + BACKFILL (DODATEK)

> Dopolnjuje `REFERENCE-ACTIVITY-BEEKEEPER-2D-1I-ONBOARDING-MEMBERSHIP-TECHNICAL-NOTE.md`. Samo analiza;
> `onboarding.ts` se NE spreminja brez izrecne odobritve (tuj WIP). Statusi PASS/PARTIAL/BLOCKED.

## 1. Minimalni diff predlaganega popravka (v anonimni veji)
V `src/app/actions/onboarding.ts`, v `else` veji (nov račun), takoj PO `createdUserId = user.id` (po vrstici ~340),
pred `seedOrganizationCatalog(...)`, dodati:

```ts
// #100 F2.1 + 2D-1H: tudi za nov račun ustvarimo ADMIN članstvo
// (sveža registracija). Idempotentno — nikakršno podvajanje ob retry/ponovni oddaji.
await prisma.organizationMember.createMany({
  data: {
    organizationId: org.id,
    userId: user.id,          // nov račun
    role: "ADMIN",
    isDefault: true,          // novo podjetje = lastnikovo prvo (default)
  },
  skipDuplicates: true,       // varno ob ponovitvi (no dvojne vrste)
})
```

- Obstaja že pri linking računu (`if (linkUserId)`, ~:253) z `isDefault: !additionalOrg`; v anonimni veji je
  `additionalOrg` vedno null → `!null === true`. Enako nameri.
- **Brez** spreminjanja ostalih vrstic; minimalno, aditivno.

## 2. Seznam regresijskih testov (ko bi bil popravek odobren)
1. `createSalonOrganization` z **novim** e-poštnim (npr. `fresh.E2E@markec.test`, vertical `beekeeping`):
   → nastane `Organization` (ACTIVE), `User` (role ADMIN, `organizationId` → org) **in** `OrganizationMember`
   (ADMIN, `isDefault=true`, `organizationId=<org>`, `userId=<user>`).
2. **Ponovljena registracija**: klic obeh ne sme podvojiti članstva (skipDuplicates → eden sam).
3. **Obstoječi uporabnik (dodatno podjetje)**: `linkUserId` → članstvo ADMIN za novo org z `isDefault` glede na
   `additionalOrg` (prvo podjetje default, dodatno ne); prejšnje podjetje ostane nedotaknjeno.
4. **Org izolacija**: `resolveSessionOrganization(admin, novOrg)` → novOrg; tuja org ni dosegljiva.
5. **Cleanup ob napaki** (po user-kreaciji, pred članstvom): napaka → tudi ustvarjeno članstvo (če je že) se
   odstrani; ni osiromašenega org/user.
6. **Backfill kompatibilnost**: po napolnitvi, ponovni tek `backfill-organization-members.ts` → 0 novih (brez
   podvajanja).

## 3. Tveganje neatomarne registracije
- Org (:230), user (:301-339) in membership (predlog) so **posamezni `await`, brez `$transaction`** (top-level
  `try/catch` :413). Neatomalni.
- **Tveganje:** ob napaki med koraki lahko ostane org ali user brez članstva (kot sedaj: org+user brez članstva).
  **Vpliv:** uporabnik ne more vstopiti v workspace (simptom iz 2D-1H); ni podatkovne poškodbe, le neskladje.
- **Poslabšanje:** minimalni popravek članstva ne reši neatomarnega stanja (še vedno 3 ločeni zapisi), a dodaja
  članstvo, ki je ključno za vstop; priporočena nadgradnja (po odobritvi) je oviti org+user+membership v
  `prisma.$transaction` (atomic) — ločen, večji poseg.
- **Ocena:** nizko tveganje za integriteto (facturirano), zmerna za UX (blokiran vstop brez backfill). Minimalni
  popravek je varna prva stopnja; atomic je druga stopnja.

## 4. Dokaz idempotentnosti obstoječega backfill-a
`scripts/backfill-organization-members.ts`:
- `createMany({ data, skipDuplicates: true })` in `findMany` obstoječih parov pred ustvarjanjem — na ponovnih
  tekih se politje **ne podvoji** (`skipped Duplicates`). Preverjeno 2D-1H: `legacy=1, ustvarjenih=1`.
- Po popravku onboarding-a bi bila članstva že prisotna pri novih registracijah → backfill jih **preskoči** (že
  obstoječ par) → ostane idempotenten (zniža `ustvarjenih` na 0). **PASS** (idempotentnost tudi z novim članstvom).

## 5. Status
- Minimalni diff: pripravljen.
- Regresijski testi: pripravljeni.
- Tveganje: ocenjeno (nízka integriteta, UX blokada; priporočen atomic).
- Backfill idempotenten: **PASS**.
- **Izvedba: BLOCKED na odobritev posega v `onboarding.ts`.**