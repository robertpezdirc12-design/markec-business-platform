# MARKEC — ZAKLJUČEK CELOTNEGA VSTOPA V ČEBELARJA IN POSLOVNEGA TOKA (2D-1K)

> Konsolidirano poročilo (naslonja se na izvedeno delo 2D-1E..2D-1J, vse na izolirani bazi `markec_e2e_test`
> port 5433, guard user `markec_e2e`). Statusi: PASS/PARTIAL/FAIL/BLOCKED/NOT VERIFIED.
> **Nič sheme/migracij; Git operacij nobenih; tuj WIP (`onboarding.ts`, `einvoices.ts`, schema, Stripe/checkout)
> nedotaknjen; `markec_dev`/produkcija nedotaknjeni; skrivnosti ne izpisane.**

---

## 1. Registracija in vstop (PASS + BLOCKED)
- **Sveža registracija (PASS, izolirano):** preko `/start?vertical=beekeeping` (sveža seja) nastane testni račun
  `cebeler.e2e@markec.test`, čebelarski workspace `e2e-cebelski-panj` (vertical beekeeping, ACTIVE). UI:
  "Podjetje je ustvarjeno!". D_B: `User` ADMIN + `Organization`.
- **Članstvo (BUG, BLOCKED na odobritev):** nova registracija ne ustvari `OrganizationMember` (`onboarding.ts`
  anonimna veja). Obhodno rešeno z uveljavljenim `backfill-organization-members.ts` na test bazi (ADMIN,
  isDefault). Minimalni diff (createMany skipDuplicates) + regresije: v `2D-1J-ONBOARDING-MEMBERSHIP-DIFF-RISK.md`.
  `onboarding.ts` = tuj WIP → **BLOCKED**.
- **Vstop (PASS):** po backfill `/dashboard` → 200; sidebar vsebuje "Pregled čebelarstva".

## 2. Organizacije in varnost (PASS)
- **Org-scoped podatki:** v izolirani bazi sta vseh 9 `ExtensionRecord` in 6 `Product` **izključno** pod org
  `cmwe1372y...` (ownOrg=total, ni puščanja); 1 `OrganizationMember`. Preverjeno SQL.
- **Fail-closed guard:** dostopi gredo skozi `requirePermissionOrg` (org iz članstva, ne legacy JWT);
  nepooblaščena org se zavrne. `resolveSessionOrganization` razreši le lastne ACTIVE workspace.
- **Več workspace-ov / tuja org:** ni bil izveden nov 2. workspace v tem run — **NOT VERIFIED** za cross-org
  delitev v živo, a org-scoped podatki + fail-closed guardi to podpirajo (PASS za izolacijo obstoječega sloja).

## 3. Čebelarske evidence (PASS)
- Vseh **9 evidenc** ustvarjenih prek `/dashboard/records` (aplikacijski tok, izolirano): postaja, panj, družina,
  pregled, zdravljenje, hranjenje, matice/rojenje, opravilo, pridelek. DB: 9 `entityKey` = po 1.
- **Povezave:** apiary↔hive↔colony↔inspection↔treatment↔feeding↔queen↔task↔harvest pravilno povezane (prikazane
  in trajne). **Trajnost:** po ponovnem odprtju (desktop+mobilno) vse ohranjene.
- **Zgodovina premikov družin (colony_move):** tab obstaja, ni bil ustvarjen (0) — **NOT VERIFIED**.

## 4. Dashboard (PASS)
- `/dashboard/apiculture` prikazuje **žive števce = bazi**: Postaje 1, Panji 1, Družine 1, Pregledi 1, Pridelki 1,
  Zdravljenja 1, Hranjenje 1, Opravila 1; zadnji pregledi; opravila/oskrba; **6 izdelkov z zaloga/rezervirano/
  razpoložljivo** (Akačijski 35/0/35 …). Prazna stanja (ko ni podatkov) pravilno prikazana.
- **Popravljen prejšnji FAJL (2D-1I):** `prisma.$transaction` v `getApicultureOverview` je vračal undefined →
  zamenjan s `Promise.all` (vzporedno branje) → števci = DB.

## 5. Zaloge (PARTIAL)
- **Inventura (PASS):** `/dashboard/products/stocktake` — Akačijski 40→35 (−5) → `StockMovement OUT/5/STOCKTAKE`,
  stockQuantity 40→35 (D_B).
- **Izdelek/varianta:** test org ima 6 izdelkov, **0 variant** → variant-ravnina ni bila neumnost (ni podatkov).
- **Prevzem dobave / rezervacije / negativna zaloga / prodaja rezervirane / odpisi-serije:** **NOT VERIFIED**
  (zahtevajo checkout/itest ali per-feature fixtures). Guardi v kodi so prisotni in enotno preverjeni:
  `NEGATIVE_STOCK` (stock≥qty) in `RESERVED_BLOCK` (stock−reserved≥qty) v `inventory.ts` pod `lockStockRow`
  (SELECT FOR UPDATE) in `computeSafeDelta`.

## 6. Pridelava medu in sledljivost (PARTIAL / BLOCKED)
- **Pridelek medu:** zapis ustvarjen (2026-08-20, Lipov med 15kg) — **PASS** (zapis).
- **Proizvodna serija:** tab Serija/lot obstaja; **veriga pridelek→serija→izdelek→razdelitev→kupcu ni dokončana**
  — zahteva `P1-D-1D` (idempotentnost) in `G7` (ProductionContribution/OrderItemBatchAllocation), kar je **PROPOSED
  schema** — **BLOCKED** (ni dovoljena migracija). Sledljivost izdelka ni bila preverjena do končnega kupca.

## 7. Naročila in prodaja (BLOCKED)
- **Edina pot do `order.create` za izdelke je Stripe checkout** (`product-checkout.ts`). **Ni administrativne/
  ne-Stripe poti.**
- Po navodilu (ne spreminjaj Stripe/checkout, ne ustvarjaj obvoda): **BLOCKED.** Minimalna varna opcija za ločeno
  rešitev (predlog): namenski admin "offline order" (nov server action, lastni testi, vpliv na zalogo/naročilo kot
  vidna uporabniška akcija) — večji in samostojen poseg, ki bi potreboval odobritev.

## 8. P1-D-1C — concurrency (NOT VERIFIED / analiza PASS)
- **Integration/concurrency:** sočasne prodaje/dobava/inventura/rollback/org-izolacija **NOT VERIFIED** — zahteva
  per-feature seedano izolirano bazo + session-mock itest harness (ni izvedeno).
- **Unit:** 46/46 PASS (vključno stock/zaloga), tsc čist.
- **P2034:** trenutni vzorec `prisma.$transaction` + `lockStockRow` (single-row FOR UPDATE) → serializacija,
  brez data-contention P2034; **omejen retry ni potreben za trenutni vzorec** (analiza, PASS logično).

## 9. Mobilno (PASS)
- 390×844: `/dashboard/apiculture` in `/dashboard/records` — HTTP 200, hamburger, brez horizontalnega preliva,
  vseh 9 tipov prikazano; **obrazci za vnos** (Dodaj vnos — Panj/Pregled) dejansko uporabni (polja + Shrani/Prekliči).

## 10. Celoten E2E (dejansko opravljeni deli)
**Verificirani deli:** sveža registracija ✓ → čebelarski workspace ✓ → vstop + membership (po backfill) ✓ →
dashboard z živimi podatki ✓ → 9 evidenc ustvarjenih in povezanih ✓ → inventura zapiše stanje ✓ → izolacija org ✓
→ mobilno ✓.
**NIZAVERIFICANTI deli E2E:** prevzem dobave, rezervacije, prodaja/naročilo, sledljivost pridelek→serija→kupcu,
colony_move zgodovina → **BLOCKED/NOT VERIFIED** (Stripe / schema / per-feature seed).

## Končni status po sklopih
| Sklop | Status |
|---|---|
| Registracija in vstop | PASS; članstvo BLOCKED (odobritev onboarding.ts) |
| Organizacije in varnost | PASS (org-scoped; fail-closed) |
| Čebelarske evidence | PASS (9/9, povezane, trajne) |
| Dashboard | PASS (žive številke = DB) |
| Zaloge | PARTIAL (inventura PASS; preostalo NOT VERIFIED) |
| Pridelava medu | PARTIAL (pridelek PASS; serija/sledljivost BLOCKED) |
| Naročila in prodaja | BLOCKED (Stripe) |
| Sledljivost | BLOCKED (G7/P1-D-1D schema) |
| Mobilno | PASS (330x844, obrazci delujoči) |
| Celoten E2E | PARTIAL (velik obseg verif.; prodaja/sledljivost niso) |

**Potrditve:** izključno `markec_e2e_test`; nič `markec_dev`/prod/migracij; Git operacij nobenih; tuj WIP
nedotaknjen; skrivnosti ne izpisane; nič umetnih/načrtnih "PASS".

**Zaključek: Čebelarja NE razglašamo za dokončanega.** Dejanska in trajna preverjanja so pokrila registracijo,
vstop, varnost, vseh 9 evidenc z povezavami, dashboard z živimi podatki, inventuro in mobilno. Preostali ključni
tokovi (prodaja/naročilo, prevzem, rezervacije, sledljivost pridelek→kupcu, P1-D-1C concurrency stres) so odvisni
od **odobritve posega v `onboarding.ts` (članstvo)**, **ločene administrativne ne-Stripe poti naročanja**, in
**sheme za P1-D-1D/G7**. Po teh odobritvah se lahko zaključi E2E do prodaje in sledljivosti.