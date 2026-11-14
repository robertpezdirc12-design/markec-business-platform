# MARKEC — FAZA 2D-1E — POPRAVEK ADMIN AUTH-GUARD (AUTH-FIX)

> Odobren omejen poseg v `src/app/(admin)/layout.tsx` (ki vsebuje tuje neodobrene spremembe). Poročilo o popravku,
> trih stanjih uporabnika in rezultatih browser preverjanja. Nič drugega tujega WIP-a ni posegano; nič
> sheme/migracij/baze; Git operacij nobenih; `einvoices.ts` nedotaknjen; `markec_dev`/produkcija nedotaknjena.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED.

---

## 1. Natančen popravek

**Datoteka:** `src/app/(admin)/layout.tsx`.

1. **Stanje A (neprijavljen):** na vrhu layouta
   `const session = await auth(); if (!session?.user?.id) redirect("/login")` — neprijavljen obiskovalec
   `admin` območja dobi **preusmeritev na `/login`**, ne HTTP 500. (Odstranjen podvojen `const session` znotraj
   layouta; samo ena `auth()`.)
2. **Stanje B (prijavljen, brez organizacije):** `if (session?.user?.id && !org) return <NoOrgGate>{children}</NoOrgGate>`
   — NOV client komponent `src/components/admin/no-org-gate.tsx`, ki s `usePathname` usmeri na izb 환경o/nuj
   prostorov **`/workspaces`** (prava pot — ne `/dashboard/workspaces`, kar bi bilo 404) in prepreči zanko.
   **Ne** gre na `/login`, **ne** ustvarja organizacije, **ne** spreminja sheme. All org-scoped akcije ostanejo
   `requirePermissionOrg` fail-closed (ne oslabljeno).
3. **Stanje C (prijavljen + veljavna org):** layout se izriše normalno (nespremenjen); NoOrgGate se ne vklopi,
   org-scoped varnost ostaja.

## 2. Ohranjene tuje spremembe

- Diff datoteke je bil pregledan pred posegom: tuje so **F2.0 active-workspace membership spremembe**
  (`getEffectivePermissions(session.user.id, org?.id)`, `activeMembership`→`isAdmin`, `currentOrgName`,
  `currentVerticalLabel`). **Vse ostale nedotaknjene** (moj poseg je aditivni guard na vrhu + NoOrgGate).
- Potrjena pravilna pot izberanja prostorov: `header.tsx:185` → `/workspaces`, proxy `proxy.ts:580`.

## 3. Rezultati treh stanj (browser, actual)

| Stanje | Vhod | Rezultat | HTTP |
|---|---|---|---|
| A — neprijavljen | (na /dashboard brez seje) | preusmeritev na `/login` (guard `!session.user`) | redirect (ne 500) |
| B — prijavljen, brez org | /dashboard z aktivnim računom brez članstva | **steje na izbor prostorov `/workspaces`**, prikaz "Na tem računu ni aktivnih poslovnih prostorov." | **200 (PASS)** |
| C — prijavljen + org | (org-scoped seje v DB manjka v tem okolju) | layout nespremenjen; org-scope guardi ostanejo fail-closed | NOT VERIFIED |

- **Dejansko izmerjeno v slepem brskalniku:** `/dashboard` → prej HTTP 500; **po popravku → HTTP 200 na
  `/workspaces`** z ustreznim sporočilom. **PASS** za stanje B (in A-preusmeritev logike).

## 4. Admin browser testi
- `/dashboard` (prej 500) → sedaj 200 (izbor prostorov). **PASS.**
- `/dashboard/apiculture`, `/dashboard/records`, izdelki, zaloga, naročila, prodaja: zaradi tega, da trenutni
  račun v DB nima aktivne organizacije/čebelarskega workspace-a, **niso dostopni brez org**; bi pa zdaj ne smeli
  več vrniti 500 — obrnjen/Vernene v /workspaces. **Z1/N1/business/mobilni browser-E2E: BLOCKED** (zahteva
  delujočo organizacijo s podatki, kar trenutna seja/DB nima; pisni vnos v neznano-ilo bazo prepovedan).

## 5. Čebelarski E2E / mobilno
- **Not izvedljivo** v tem okolju (ni org + DB ni potrjen kot izoliran). **BLOCKED / NOT VERIFIED.**

## 6. Regresija
- **tsc:** čist za layout/no-org-gate (edina napaka tuja `scripts/f631-inspect.ts:40`).
- **unit:** 46/46 PASS.
- **browser:** /dashboard 500 → 200 (izbor prostorov); landing še vedno 200 (PASS).

## 7. Odprte blokade
- **Poslovni tok E2E, Z1/N1 z org, mobilni:** BLOCKED, dokler obstaja delujoča čebelarska org + znano izolirano
  test DB.
- **P1-D-1D / G7:** PROPSED shema (idempotency `StockOperation`; `ProductionContribution`/`OrderItemBatchAllocation`)
  — zahteva odobritev migracije; `schema.prisma` in product-checkout tuj WIP.

## 8. Potrditve
1. Poseg je omejen na `(admin)/layout.tsx` + nov `no-org-gate.tsx`: DA.
2. Tuje spremembe v layoutu ohranjene: DA (F2.0 membership nedotaknjene).
3. `schema.prisma`, migracije, baza nespremenjeni: DA.
4. Git operacije niso izvedene: DA.
5. `einvoices.ts`, Stripe, webhook, drugi tuj WIP nedotaknjeni: DA.
6. `markec_dev`/produkcija nedotaknjeni: DA.
7. Faza 2D-1A ostaja neodobrena: DA.

**Končni status popravka: PASS** (stanja A/B pravilna; C NOT VERIFIED zaradi manka org v okolju). **E2E/business/
mobilni: BLOCKED** (ni delujoče org + neznana DB izolacija).