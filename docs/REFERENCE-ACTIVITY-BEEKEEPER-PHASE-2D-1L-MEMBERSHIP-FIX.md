# MARKEC — FAZA 2D-1L — POPRAVEK ČLANSTVA OB NOVI REGISTRACIJI

> Odobren in izveden minimalni popravek `onboarding.ts` (anonimna veja) + regresijski itest. Vse na izolirani bazi
> `markec_e2e_test` (port 5433, guard user `markec_e2e`). **Nič schema/migracij; Git operacij nobenih; tuj WIP
> (drugi deli onboarding.ts, einvoices.ts, schema, Stripe) nedotaknjen; `markec_dev`/prod nedotaknjena; skrivnosti
> ne izpisane.** Statusi: PASS/PARTIAL/BLOCKED.

---

## 1. Točno spremenjene datoteke (samo nujno)
1. **`src/app/actions/onboarding.ts`** — v **anonimni veji** (`else`, nov račun), takoj PO `createdUserId = user.id`
   (pred `staffId`), dodan `prisma.organizationMember.createMany({ ... skipDuplicates: true })`:
   - `organizationId: org.id` (pravkar ustvarjena org),
   - `userId: user.id` (pravkar ustvarjen uporabnik),
   - `role: "ADMIN"`,
   - `isDefault: !additionalOrg` (v anonimni veji vedno `true` — prvo podjetje).
   Obstoječi deli funkcije (`if (linkUserId)` veja, validacija, katalog, salonConfig, try/catch, P2002)
   **nespremenjeni** (diff je le +16 vrstic).
2. **`tests/integration/onboarding-membership.itest.ts`** — NOV regresijski itest (5 scenarijev).

## 2. Obseg popravka
- **Dodano:** članstvo ADMIN za novo anonimno registracijo (prej je manjkalo → user+org brez `OrganizationMember`).
- **Idempotentno:** `createMany` + `skipDuplicates: true`, skladno s `@@unique([organizationId, userId])` v shemi;
  ob ponovnem zaženu ne podvoji članstva.
- **Cleanup:** ob napadi po user-kreaciji `catch` izbriše user in org; FK `onDelete: Cascade` na OrganizationMember
  prek user/org → članstvo odstranjeno (ni navideznega uspešnega stanja).
- **Ne posegam** v vejo za obstoječi račun (dodatno podjetje) — ta ostane taka, kot je bila.

## 3. Regresijski testi (itest, pognani proti izolirani bazi — PASS)
| # | Test | Rezultat |
|---|---|---|
| 1 | Nova anonimna registracija ustvari User + Organization + OrganizationMember(ADMIN) | **PASS** (member role=ADMIN, orgId=userId povezani) |
| 2 | Prvo članstvo ima `isDefault: true` | **PASS** |
| 3 | Ponovljen klic ne ustvari podvojenega članstva | **PASS** (count ostane 1) |
| 6 | Obstoječi backfill ostane združljiv (createMany skipDuplicates → 0 novih, noben podvojen) | **PASS** |
| 7 | Bris organizacije odstrani članstvo (cascade) — ni navideznega uspešnega stanja | **PASS** (member 0; uporabnik račun ostane po P40) |
| 4 | Obstoječi uporabnik ustvari dodatno organizacijo | NOT VERIFIED v itest (zahteva session-mock obstoječi uporabnik; veja nespremenjena — pokrita obstoječimi testi) |
| 5 | Članstvo ene org ne omogoča dostopa do druge | Pokrito org-scoped guardi `requirePermissionOrg` (fail-closed); NOT VERIFIED v novem itestu |

Rezultat itest: **5/5 PASS** (`Tests 5 passed`).

## 4. Sveža registracija v browserju (izolirano, brez backfill) — PASS (odločilno merilo)
- Ustvarjen **nov** račun `cebeler.fresh@markec.test` prek `/start?vertical=beekeeping` (anonimni tok, brez
  ročnega backfill-a).
- Odziv: takoj **preusmeritev na `/dashboard?welcome=1`** z čebelarskim dashboardom ("Svezi Cebelar Test",
  Čebelarstvo) — **brez** `/workspaces` "ni aktivnih poslovnih prostorov".
- **Preverjeno v izolirani bazi (SQL):** `cebeler.fresh@markec.test` →
  `User.role=ADMIN`, **`OrganizationMember role=ADMIN, isDefault=true`**, org `svezi-cebeler-2d1l`
  (vertical `beekeeping`). **Članstvo je nastalo samodejno.**

## 5. TypeScript in obstoječi testi
- **tsc:** čist za spremenjene (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit (povezani poznamo):** 4 fajli → **55 passed** (stock, server-schema, entry-checkout 65-69,
  memberships-100a). **Brez regresije.**

## 6. Ostale blokade (iz predhodnih faz, nespremenjene)
- **Naročila/prodaja:** le Stripe checkout → BLOCKED (tuj WIP); ločena admin ne-Stripe pot predlagana za odobritev.
- **P1-D-1C concurrency stres:** per-feature seed itest → NOT VERIFIED.
- **Sledljivost pridelek→serija→kupcu (G7/P1-D-1D):** zahteva shemo → BLOCKED.

## 7. Potrditve
1. Spremenjen le nujni del anonimne veje `onboarding.ts` + nov itest: DA.
2. Tuje neoddane spremembe (F2.0 itd. v onboarding.ts, einvoices.ts, schema) nedotaknjene: DA.
3. Nič sheme/migracij; Git operacij nobenih: DA.
4. Uporabljeno izključno `markec_e2e_test` (guard): DA.
5. Skrivnosti ne izpisane: DA.
6. `markec_dev`/produkcija nedotaknjena: DA.

**Končni status: 2D-1L = PASS**
- Nova anonimna registracija dejansko ustvari `OrganizationMember` (ADMIN, isDefault) — **dokazano v itest in v
  živi browser registraciji**.
- Uporabnik brez ročnega backfill-a **takoj vstopi** v svoj čebelarski workspace.
- Idempotentnost, cascade-clearup, backfill kompatibilnost: preverjeni.
- tsc + 55 unit PASS; itest 5/5 PASS.

**Prvi korak do popolnoma delujočega vstopa v MARKEC Čebelarja je tako varno zaprt.**