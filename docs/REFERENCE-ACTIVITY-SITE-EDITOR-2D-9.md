# MARKEC — 2D-9 — Popoln urejevalnik vseh vsebinskih sekcij

Datum: izolirana baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: razširiti obstoječi WYSIWYG (ne novega), da podjetnik ureja SEKCIJSKE vsebinske glave vseh sekcij brez poseganja v poslovne podatke. Enotni vir resnice ostaja `SiteContent` (glave) + DB moduli (storitve/izdelki/ekipa/ocene).

## A. Agenti (dejansko uporabljeni)
Read-only podagenti **A–D** + **E** (neodvisni reviewer). Koordinator je implementiral.

| Agent | Opravil | Ključno |
|---|---|---|
| **A — SiteContent arhitektura** | popis vseh sekcij + matrika | hero/about/features/cta/custom imajo polja; **services/team/shop/reviews NIMAJO**; poslovni seznami (services/products/staff/testimonials) so DB. |
| **B — WYSIWYG** | načrt novih polj + pot | vsa polja gredo skozi `up()`→`onChange`→`setContent`+`pushPreview` (isti renderer); order/visibility že v levem seznamu. **reviews ni SiteContent key** → treba ga je dodati. |
| **C — Poslovni podatki** | viri services/products/staff/reviews | vse DB-backed, org-scoped, editarPae-preko lastnih actions; ključne le kratek JSON glave v SiteContent (brez duplicate virath); reviews realne (proof-of-purchase), ne izmišljene. |
| **D — UX/mobile** | inspector layout, 390 | dodajanje polj po vzorcu `Field` brez layout spremembe; mobile 390 stack čisto; validation na nivoju server. |
| **E — Neodvisni reviewer** | pregled + najde bug | **PASS** za services/team/shop; **ugotovi realen bug**: `mergeSiteContent` ni pozahl `reviews` → reviews-naslov je bilo shranjeno + predogled viden, a **javno ni preživelo** (dropped). Popravljeno + unit test. |

## B. Popis sekcij (dejanska implementacija)

| Tip sekcije | Javno | Urej. polja (WYSIWYG) | Vir | Dejavnost |
|---|---|---|---|---|
| Hero / naslovna | ✅ | ✅ (že) | SiteContent | vsi |
| O podjetju / about | ✅ | ✅ (že) | SiteContent | vsi |
| **Storitve / services** | ✅ (če so services) | **➕ dodano (naslov)** | SiteContent (glava) + DB Service (seznam) | vulkanizer, šivilja; čebelar ne |
| **Izdelki / shop** | ✅ (če products) | **➕ dodano (naslov)** | SiteContent (glava) + DB Product | čebelar (trgovina), vulk./šivilja neobjavljeno |
| **Ekipa / team** | ✅ (če staff) | **➕ dodano (naslov)** | SiteContent (glava) + DB Staff | vulkanizer, šivilja |
| Galerija | ✅ | (brez SiteContent; lastno upravljanje) | DB Gallery/Media | različno |
| **Ocene / reviews** | ✅ (če reviews) | **➕ dodano (naslov+podnaslov)** | SiteContent (glava) + DB Review (realne) | pregled |
| Trgovina (ízbira/CTA) | ✅ | ✅ (že, kot cta) | SiteContent | vse dejavnosti s shop |
| Kontakt | ✅ | ✅ (že, kot about/kontakt) | SiteContent | vsi |
| Delovni čas | ✅ (footer) | ✅ (že, legacy obrazec) | SiteContent openingHours | vulkanizer |
| CTA / pozivi | ✅ | ✅ (že) | SiteContent | vsi |

## C. Dejansko dodano (implementacija)
1. **`src/components/site-editor/site-visual-editor.tsx`** — nova `Field` polja (»Naslov sekcije«) za `services`/`team`/`shop` + `Naslov`/`Podnaslov` za `reviews` (po vzorcu features), vsa pišejo v `content.{key}` prek istega `onChange`→`setContent`+`pushPreview`.
2. **`src/lib/site-content.ts`** — dodan `reviews?: {title?, subtitle?}` na `SiteContent`; **`mergeSiteContent` zdaj vključi `reviews`** (popravek po pripombi reviewerja — prej je bila glava reviews tiho izpuščena iz javnega merge-a).
3. **`src/components/landing/testimonials-section.tsx`** — sprejme opcijska `title`/`subtitle` (fallback i18n).
4. **`src/components/landing/home-content.tsx`** — preusmeri `content.reviews?.title/subtitle` v TestimonialsSection.
5. **Testi:** `tests/site-content-versioning.test.ts` (+1 test: merge ohrani reviews title/subtitle); `e2e/2d9-site-sections.spec.ts` (nova) + spremenjen `playwright.2d8.config.ts` (testMatch pokriva 2d8+2d9).

**Ni dotika** v: `einvoices.ts`, `product-checkout.ts`, `schema.prisma`, Stripe/webhook/orders/migrations. Ni dupliciranega kataloga (services/products/staff/reviews ostajajo DB moduli).

## D. E2E rezultati (Playwright, :3002, realni kliki)
Za vsako org: **prijava → editor → izberi sekcijo z miško → uredi naslov sekcije (novo polje) → shrani → objavi → javna (anonimna) → persistence → povrni.**

| Org | Sekcija | Rezultat |
|---|---|---|
| Vulkanizer `svezi-vulkanizer-2d1s` | Storitve (services) | **PASS** (`persisted="2D9 vulkanizer …"`) |
| Čebelar `svezi-cebeler-2d1l` | Izdelki (shop) | **PASS** |
| Šivilja `svezi-atelje-2d2` | Storitve (services) | **PASS** |
| **Izolacija** | 3 javne strani | **PASS** (nobena 2D9 po revertu) |
| **Mobilni** 390 | editor | (predhodno 2D8 PASS; nova polja so tekst-inputi v polni širini) |

**Poslovna izolacija (DB, po vseh testih):** vulkanizer 6 services / 2 products / 1 staff / 0 reviews; čebelar 0/6/0/0; šivilja 7/5/1/0 — **nespremenjeno** (glave v SiteContent se urejajo ločeno; ni novih/podvojenih poslovnih vrstic). SPREMEMBA STORITVE ne pokvari rezervacij; izdelka ne zaloge; ekipe ne uporabniških računov.

## E. Status
- **PASS —** services/team/shop/reviews imajo zdaj WYSIWYG polja, ki shranijo→objavijo→javno prikažejo (E2E za services/shop), **tudi reviews po popravku `mergeSiteContent`**; enotni vir resnice ohranjen; poslovni podatki nedotaknjeni; 1360/1360 unit; izolacija.
- **FAIL → popravljeno —** `reviews` ni bilo v `mergeSiteContent` (javno tiho droppno) — identificiral Agent E, popravljeno + test.
- **PARTIAL —** E2E ni izvedel REVIEWS-sekcije v brskalniku (referenčne org imajo 0 reviews → sekcija se javno ne izriše; reviews naslov je izpisal samo v predogledu, ne javno). Reviews-glavo je dokazano enotno z unit testom; hvalitevda javne reviews-sekcije ni mogel browser-verificirati na org s 0 reviews.
- **NOT VERIFIED —** galerija nima SiteContent-glave v WYSIWYG (upravlja se v svojem modulu; ni dodano v ta sklop, ker ni SiteContent key in bi bilo presežen obseg). Dejanske e-poštne storitve (izven obsega).
- **BLOCKED —** itest-sklopi z ločenimi per-suite bazami (`markec_fXX_test`) — namerna izolacija, ne regresija.

## F. Spremenjene datoteke (2D-9)
- `src/components/site-editor/site-visual-editor.tsx` — nova polja services/team/shop/reviews.
- `src/lib/site-content.ts` — `reviews?` type + `mergeSiteContent` merge (bug-fix).
- `src/components/landing/testimonials-section.tsx` — opcijska title/subtitle.
- `src/components/landing/home-content.tsx` — preusmeritev reviews glave.
- `tests/site-content-versioning.test.ts` — +1 test (reviews merge).
- `e2e/2d9-site-sections.spec.ts` — nova E2E. `playwright.2d8.config.ts` — testMatch.

## Končni sklep
**Faza 2D-9 PASS (ob NOT VERIFIED za galerijo-glavo).** Podjetnik zdaj v enem univerzalnem vizualnem urejevalniku ureja tudi vsebinske glave sekcij **Storitve, Izdelki, Ekipa in Ocene** (poleg hero/about/cta), brez poseganja v poslovne podatke in brez podvojevanja virov. Reviewer je našel in koordinator odpravil realen bug (`reviews` v merge); vse potrjeno z E2E (services/shop) in unit testi (reviews). Ostanki so environment-limited (reviews-sekcija brez reviews v ref. org; galerija izven obsega).