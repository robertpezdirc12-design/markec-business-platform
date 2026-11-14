# REFERENCE-ACTIVITY-SITE-EDITOR — 2D-13

Zaplet: 2D-6→2D-12 so dokazala univerzalni WYSIWYG, poslovno vsebino iz editorja in CRUD.
2D-13 = zaključek varnostne vrzeli iz 2D-12 (addGalleryItem) + realne E2E preveritve preostalih kombinacij.

## Stanje (matrika pokritosti 2D-13)

| Področje | Status | Dokaz |
|---|---|---|
| addGalleryItem org-scope varnostni popravek | **PASS** | deterministično proti `markec_e2e_test` |
| coverImageId org-scope varnostni popravek | **PASS** | najden pri reviewerju; deterministično + no-regression |
| Negativni testi (missing/own/foreign media) | **PASS** | 4 primeri, rollback čist |
| Tenant izolacija medijev | **PASS** | tuj media viden SAMO lastni org |
| No-regression | **PASS** | tsc čist (le tuji f631/generirani validator); unit 1360/1360 |
| Šivilja galerija (browser create→upload→publish) | **BLOCKED** | server actioni tečejo (200), dialog create ne persitra v dev-harnessu |
| Šivilja storitve/Ekipa browser E2E | **NOT VERIFIED** | preostalo |
| Čebelar EDIT izdelka browser E2E | **NOT VERIFIED** | preostalo |
| Mobilni tok 390 | **NOT VERIFIED** | preostalo |

## Varnostni popravki

### 1. addGalleryItem (galleries.ts) — 2D-13 security
Prej: mediaId ni bil preverjen na org pripadnost → tuj DB-Media (tuja `/api/media/{id}`) bi
lahko bila dodana v javno galerijo (leak).
Zdaj: `prisma.media.findUnique({ id: mediaId })`; če Media obstaja in je `organizationId !== null
&& !== org.id` → `{ ok:false, error:"MEDIA_FORBIDDEN" }`. Cloudinary publicId/URL (ni DB-Media)
ostane nespremenjen (obstoječi tok). Fail-closed, ne razkrije tujih podatkov.

### 2. coverImageId (galleries.ts) — 2D-13 (dodatno, neodvisni reviewer)
Reviewer je ugotovil isto vrzel pri `coverImageId` v createGallery/updateGallery + javni DTO.
Zdaj: skupni helper `mediaBelongsToOrg(org.id, coverImageId)` z enako logiko v obeh funkcijah →
`MEDIA_FORBIDDEN`.

## Deterministični negativni testi (markec_e2e_test)

| # | Scenarij | Rezultat |
|---|---|---|
| 1 | neobstoječ media id | null → REJECT (MEDIA_NOT_FOUND) |
| 2 | lastni medij (šivilja) | ALLOW |
| 3 | tuj (vulkanizer) medij pod šivalino org | REJECT (MEDIA_FORBIDDEN); pod lastno org ALLOW (izolacija) |
| 4 | publicId pot (ni DB-Media) | ALLOW (ohranjen obstoječi tok) |

Cover-fix: null→ALLOW, own→ALLOW, foreign→REJECT, publicId→ALLOW. Temp vrstice rolled-back.

## Infrastruktura

- Baza `markec_e2e_test` je bila DOWN (port 5433); Docker engine offline. Zagnan docker
  `markec-e2e-test-db` (5433). Po ponovnem zagonu vse DB-verifikacije OK.
- Playwright/tsc/unit: `npx vitest run` → 1360/1360; `tsc --noEmit` → čist razen tujega
  `scripts/f631-inspect.ts:40` in generiranega `.next/dev/types/validator.ts`.

## Spremenjene datoteke (2D-13)

- `src/app/actions/galleries.ts` — addGalleryItem org-scope + `mediaBelongsToOrg` + coverImageId guard.
- `e2e/2d13-gallery.spec.ts` — poskusni šiviljin galerijski browser tok.

## Statusi

- **PASS** — varnostni popravek addGalleryItem + coverImageId; deterministični negativni testi;
  izolacija; no-regression.
- **BLOCKED** — šiviljin galerijski dialog (create) ne persitra v dev-harnessu (server-actioni tečejo,
  dialog-selector ne zanese do shranitve) — okoljska omejitev, ne aplikacijska.
- **NOT VERIFIED** — šivilja storitve/ekipa, čebelar EDIT, mobilni tok (niso bili pridobljeni v tej fazi).

## Odgovorno poročanje

- Celotna faza/profili NISO PASS, če del nima realnega browser-E2E dokaza. Varnost (glavni cilj 2D-13)
  je PASS; funkcionalna E2E pokritost preostalih kombinacij je BLOCKED/NOT VERIFIED — navedeno zgoraj.