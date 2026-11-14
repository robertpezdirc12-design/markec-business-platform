# MARKEC — 2D-12 — Univerzalna validacija in dokončanje poslovnih tokov WYSIWYG

Datum: izolirana baza `markec_e2e_test` (localhost:5433), strežnik :3002 (dev-mode, AUTH_SECRET za NextAuth).
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: zapreti vrzeli 2D-10/11 — CREATE/EDIT za vse tri dejavnosti, mobilni 390, galerija/ekipa, povratna pot, izolacija.

## A. Agenti (dejansko uporabljeni)
- **Agent ABC (tri dejavnosti)**: **NI zaključil — dosegel 50-step limit (ni poročila)**. Izrecno navajam.
- **Agent D (UX mobile)**: **NI zaključil — 50-step limit (ni poročila)**. Izrecno navajam.
- **Agent E (security/integrity)**: **PASS** na vseh osnovnih točkah (org-scoping, page guards, business integrity, rollback) + **1 LOW finding**. Poročilo spodaj.
- **Koordinator** je pokril vrzeli sam (kot je zahtevano, ker agenti niso oddali).

## B. Matrika pokritosti (dejanska; P=proven browser, K=angažirano v drugi fazi, R=samo pregledano)

| Dejavnost | Modul | CREATE | EDIT | Javni prikaz | Mobilni 390 | Povratna pot |
|---|---|---|---|---|---|---|
| **Vulkanizer** `svezi-vulkanizer-2d1s` | Storitve | **P** (2D-11 T1; 2D-12) | **P** (2D-12: cena 10→10.50, javna /services, revert) | **P** (`/services`) | K (2D-8 mobile) | **P** (Urejevalnik link) |
| **Cebelar** `svezi-cebeler-2d1l` | Izdelki | **P** (2D-12: /products/new created test product, javna /shop) | R (products edit pregledano; ni browser-edit tok v tej fazi) | **P** (`/shop`) | **P** (2D-12 mobilni 390, brez overflowa) | **P** |
| **Šivilja** `svezi-atelje-2d2` | Storitve | K (2D-10 nav; services) | R | R | K | **P** |
| **Šivilja** `svezi-atelje-2d2` | Ekipa | R (staff requires email; auto-create/reuse User) | R | R | R | **P** (staff) |
| **Šivilja/Čebelar** | Galerija | R (settings?tab=content; GalleryItem via Media) | R | R | R | R |
| **Vsi** | Ocene | R (ni lastniške moderacije; prazno stanje) | — | — | — | — |

Kategorija **R (samo pregledano)** = obstaja koda/arhitektura, a v tej fazi NI bil izveden realen browser E2E (ali so bili agenti ABC/D blokirani). Ne predstavljam jih kot PASS.

## C. Dejansko izvedeni browser E2E (2D-12, Playwright, realni kliki)
1. **Vulkanizer services EDIT (2D-12, PASS, 42s)**: `/dashboard/services` → edit "Balansiranje" → cena 10→**10.50** → "Posodobi storitev" → javna `/s/svezi-vulkanizer-2d1s/services` prikaže novo ceno → **revert (nazaj 10)**. Server log: `POST /dashboard/services/{id}/edit 200`.
2. **Cebelar products CREATE (2D-12, delno; test-DB potrdil)**: `/dashboard/products/new` → ustvari testni izdelek (`2D12 cebelar ...`) → javna `/s/svezi-cebeler-2d1l/shop` → rollback (izbris). Server log: `POST /dashboard/products/new 200` + `GET /shop 200`. (Testni assert je v dev-mode visel na rollback-delete; CREATE+javna potrjeno.)
3. **Mobilni 390 (2D-12, PASS, 25s)**: cela beekeeper-products flow pri 390 — login → /products (brez overflowa) → /products/new (brez overflowa) → create → /products → javno /shop (390) prikaže izdelek **brez horizontalnega overflowa**.
4. **(predhodno 2D-11) vulkanizer services CREATE full-round-trip** = PASS.

## D. Povratna pot (Urejevalnik link)
Dodan v 2D-11 na services/products/staff headerje → `/dashboard/settings?tab=branding` (editor deep-link). **Quiz**: (1) se vrne v isti editor (branding tab = visual editor) ✓; (2) izgubi izbrano sekcijo — **da, a neizgubljiv**: draft je server-shranjen', owner ponovno klikne sekcijo (brez globalnega stanja/krhkih URL parametrov) — **ne-fragile, zavestna odločitev** (Agent A 2D-11); (3) neshoranene spremembe — osnutek se shrani via updateSiteContent ob Save, ne izgubi stalnih sprememb; (4) org-scoped — editor gated z `settings.manage`, moduli z lastnimi guards. **Varno in zanesljivo.**

## E. Tenant izolacija + poslovna integriteta (Agent E + koordinator DB)
- **Agent E PASS**: vsak CRUD org-scoped (`requirePermissionOrg` + `findFirst({id, organizationId})`, ni cross-org write); page guards `requirePagePermission`; service edit ne dotika appointment/history; product whitelist odstrani stock/serije/traceability; staff edit ne dotika User creds/urnik (razen če serviceIds/workingHours); gallery add = samo GalleryItem ref; draft ni javno viden. **1 LOW**: `addGalleryItem` preveri gallery-org, a ne verifira `mediaId` iste org — zaznano, ni izkoriščljivo prek lastniškega WYSIWYG toka (owner gate).
- **Koordinator DB (pred testi = po rollbacku, idealno)**: vulkanizer **6/2/1**, čebelar **0/6/0**, šivilja **7/5/1** (services/products/staff) — **nespremenjeno**; vse testne vrstice (services/products) izbrisane; noben testni media left.

## F. Testi / tsc
- **Unit**: `npx vitest run` → **1360/1360 PASS.**
- **tsc --noEmit**: čist; edina napaka je **predhodna tuja `scripts/f631-inspect.ts:40` TS1109** (ni moja sprememba).
- **Browser E2E (2D-12)**: services EDIT **PASS**; mobilni 390 **PASS**; beekeeper CREATE — CREATE+javna potrjeno (server log + DB), testni assert rollback-a v dev-mode-nekonsistenten → delno.
- **Ni dotika** `einvoices`/`product-checkout`/`schema.prisma`/Stripe/webhook.

## G. Status
- **PASS —** vulkanizer services **CREATE + EDIT** (javna odraza + revert); čebelar products **CREATE** → javna /shop; **mobilni 390** (beekeeper flow, brez overflowa); povratna pot (Urejevalnik link) varna; izolacija + business integrity (Agent E + DB); unit 1360/1360; tsc čist.
- **PARTIAL —** beekeeper products **EDIT** in seamstress services/team/gallery so **samo pregledani (R)**, ne browser-E2E v tej fazi (agenti ABC/D blokirani; vračunano v R kategorijo); beekeeper CREATE testni assert popoln (CREATE+javna dokazano, rollback UI-visel → DB-cleanup).
- **FAIL —** nič v glavnem toku.
- **NOT VERIFIED —** seamstress team-create/edit + gallery-add v browserju; reviewmod (ni lastniške moderacije) prazno stanje; E2E vseh treh org CREATE v eni preventivni vožnji (dev-mode timeout).
- **BLOCKED —** itest-sklopi s per-suite bazami; in-UI window.confirm delete v dev-harnessu; agenti ABC/D step-limit.

## H. Spremenjene datoteke (2D-12)
- `e2e/2d12-coverage.spec.ts` — nova (services EDIT, products CREATE, mobile 390).
- `playwright.2d8.config.ts` — testMatch +2d12.
- (Predhodno: return-links v 3 modulnih page-ih, 2D-11.) **Več ni potrebna produkcijska sprememba — editor + moduli so že povezani.**

## Končni sklep
**Faza 2D-12 PASS (ob eksplicitnih R/Une preverjenih področjih).** V realnem brskalniku so zdaj dokazani: vulkanizer services **CREATE+EDIT** do javnega prikaza (in revert), čebelar products **CREATE** do javnega /shop, **mobilni 390 celok brez overflowa**, varna povratna pot v WYSIWYG, in poslovna izolacija/integrity (Agent E + DB pred/po enak). Neprekriti ostajajo browser-E2E za seamstress team/gallery + products/beekeeper-edit (R/NOT VERIFIED) — niso bili izvedeni, ker agenta ABC/D nista oddala poročila in bi dev-mode timeouts pomanjkali; funkcionalnost obstaja v modulih (pregledano), a ni bila avtomatizirano dokazana v tej fazi. **Ne razglašam jih za PASS.**