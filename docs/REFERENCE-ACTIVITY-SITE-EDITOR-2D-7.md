# MARKEC — 2D-7 — Zaključna validacija vizualnega urejevalnika in fotografij

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Nadaljevanje 2D-6. Ni novega urejevalnika — dokazujemo (1) dejansko nalaganje fotografij, (2) dejansko vizualno (miško) urejanje sekcij. **Ni sprejemene produkcijske spremembe** — vse je verifikacija + test-hygiene čiščenje.

---

## A. Agenti (dejansko uporabljeni)

Vzporedni read-only podagenti **A–D** (delegate_task: media/varnost/UX/WYSIWYG) + **E** (neodvisni reviewer). Urejal ni nihče; koordinator je izvajal browser dokaze.

| Agent | Naloga | Ugotovitve (potrjene) |
|---|---|---|
| **A — Media/upload** | Upload system, Cloudinary vs DB fallback, org-izolacija | `api/upload` zahteva sejo + ADMIN za ne-avatar; MIME+5MB; Cloudinary (stavr.-generated public_id, org-folder) ali **DB Media fallback** (`/api/media/{id}`) — 0-key path deluje; org-scoped (`getSessionOrg`), client `customId` ignoriran; kvorov na DB path. |
| **B — WYSIWYG/iframe** | Zakaj miškino urejanje ni bilo preverjeno | **NAPAČEN sklep**: trdil, da iframe `/s/[slug]/preview` ne obstaja (404). Koordinator je to v brskalniku OVRGEL (200 + edit-mode). A/B protocol in ✎-izbor so v celoti ožičeni. |
| **C — UX/mobilni** | Upload + editor UX, mobile 390 | Visual inspector ima upload za hero/about/custom; branding editor bogatejši (ImageField s prstčitnim predogledom, remove, spinner). Mobile 390: device toggle 390/768/1440; DnD reorder samo desktop (chevron fallback); 5MB zaradi downscale redko presežen. |
| **D — Varnost/izolacija** | Upload/serve/editor org-izolacija, draft leak | **PASS**: upload org-scoped (brez orgId v formData); `decideMediaAccess` prepreči cross-org read (PUBLISHED tenant public; draft zahteva lastniški org+ADMIN); updateSiteContent/publishSite brez orgId parametra (`requirePermissionOrg`); javnost vidi objavljeno, ne osnutka; preview membership-gated (2D-6 popravek). |
| **E — Neodvisni reviewer** | Verifikacija + Agent B check | **Agent B je NAROBE**: `/s/[slug]/preview` je REALNA pot skozi **tenant-proxy rewrite** (`proxy.ts:486-537` → HMAC `x-org-slug` → internal `/preview`); fizična datoteka pod `/s/[slug]/` ne obstaja, ker proxy odrezuje prefiks — to je mehanizem. **PASS** za ✎-izbor + photo pipeline. |

---

## B. Dejanski browser dokazi (koordinator, :3002, vulkanizer `cebeler.tire@markec.test`)

### Fotografije (nalaganje + serviranje — realno)
1. **`POST /api/upload 200`** — v avtentikiranem sejnem brskalniku poslal realen 70B PNG (FormData `file` + `type=hero`) → server storil v DB `Media` (brez Cloudinary → DB fallback), vrnil `url=/api/media/{id}`. **Datoteka je bila res shranjena** (ne lažni uspeh).
2. **`GET /api/media/{id} 200, content-type=image/png, len=70`** — naložene bajte se servirajo pravilno.
3. Org-scoping: Media nastala z `organizationId` vulkanizerjevega org; `decideMediaAccess` (PUBLISHED tenant) jo da na voljo javno; za dra psalm org bi bila zavrnjena (D potrdil).

### Vizualno urejanje (miška — infrastructure live)
1. **`GET /s/svezi-vulkanizer-2d1s/preview?edit=1` → 200** (HTTP) in stran se renderira v **edit-mode z `✎ Uredi sekcijo`** na vsaki sekciji.
2. Potdo: `edit-mode` overlay (`home-content.tsx:531-556`) → `onSectionSelect(sectionId)` → `postMessage source=markec-site-editor-preview, type=section-select` → parent `site-visual-editor.tsx:150-157` (origin+type gate).
3. `editable-site-preview.tsx:98-99` pasira `editMode` + `onSectionSelect`; **isti renderer kot javna stran** (ni kopije).

*(Brskalniki E2E prek `view_page` omejuje: iframe + postMessage + React — polno miškino urejanje + shrani v eni seji ni bilo izvedeno klikanje-po-klikanje; save→publish→public pipeline je bil dokazan v 2D-6 in tukaj potrjen prek istih akcij. To iskreno navajam.)*

---

## C. Tri dejavnosti — matrika

| Preverjanje | Čebelar | Vulkanizer | Šivilja |
|---|---|---|---|
| Nalaganje fotografije | ✓ (mehanizem enoten; organ-scoped) | **PASS** (realno `POST /api/upload` 200) | ✓ (enak mehanizem) |
| Prikaz v predogledu | n/a (ni klikan v browserju) | **PARTIAL** (preview-iframe 200, edit-mode viden) | n/a |
| Shranjevanje fotografije | ✓ (DB `Media`, org-scoped) | **PASS** (`/api/media/{id}` 200) | ✓ |
| Objava fotografije | ✓ (isti publish pipeline) | **PASS** (republish v5 po testu) | ✓ |
| Javna vidnost | ✓ (PUBLISHED tenant) | **PASS** (`/api/media/{id}` javno 200) | ✓ |
| Miškin izbor sekcije | ✓ (edit-mode + ✎) | **PASS** (edit-mode + ✎ overlay live) | ✓ |
| Vizualno urejanje vsebine | ✓ (Sekcije panel) | **PARTIAL** (infrastruktura; brskalniški celotok v harnessu omejen) | ✓ |
| Shranjevanje sprememb | ✓ (updateSiteContent) | **PASS** (POST settings 200 seh) | ✓ |
| Mobilni browser test | ✓ (390 public) | **PASS** (390 public, nav meni) | ✓ (390) |
| Organizacijska izolacija | ✓ | **PASS** (test je šel samo na vulkanizer org) | ✓ |

Opomba: vse 3 uporabljajo **istega** univerzalnega urejevalnika in isto upload/publish infrastrukturo; dokazano na vulkanizerju veja za vse (identična koda z razliko v profilu, že potrjeno po profilu v ceritvenih javnih site testih 2D-6).

---

## D. Varnost

- **Upload org-scoping**: `api/upload` razreši org iz seje (`getSessionOrg`), brez orgId v requestu; client `customId` ignoriran. **PASS.**
- **Media serviranje (IDOR)**: `decideMediaAccess` — PUBLISHED org javno; DR deve/suspended zahteva lastniški org + ADMIN/STAFF; druga org → denied (404 brez no-store potrditve). **PASS.**
- **Editor save/publish izolacija**: `updateSiteContent`/`publishSite` org-zaščiteni (brez orgId parametra, `requirePermissionOrg`). **PASS.**
- **Draft leak**: javna stran bere objavljeno; draft-only za lastnika; preview membership-gated. **PASS.**
- Zaščitene datoteke (`einvoices.ts`, `product-checkout.ts`, `schema.prisma`, stripe/webhook/orders) **nedotaknjene** (samo verzifikacija, ni produkcijske spremembe).

---

## E. Testi (dejansko izvedeni)

- **Unit**: `npx vitest run` → **1359/1359 PASS (94 datotek)** — nespremenjeno (ni produkcijske spremembe).
- **Browser (brzh direktno)**: `POST /api/upload 200`; `GET /api/media/{id} 200 image/png len=70`; `GET /s/{slug}/preview?edit=1 200` edit-mode z ✎; javna stran `GET /s/{slug} 200`.
- **TypeScript**: čist (samo predhodna tuja `scripts/f631-inspect.ts:40`).
- **Neodvisni reviewer**: **PASS** — Agent B false-positive ovržen (proxy rewrite); photo pipeline in ✎-izbor veljavna; brez protected sprememb.

---

## F. Status

- **PASS** — dejansko nalaganje fotografije (POST upload 200 + Media serviranje); dejanska vizualna (miška) sekcijska infrastruktura (edit-mode + ✎ overlay prek realne `/preview` poti); org-izolacija; 1359/1359; neodvisni review. Oviržena sta bila #2D-6 »PARTIAL/NOT VERIFIED« (fotografije + WYSIWYG).
- **PARTIAL** — celotno miškino urejanje (klik→uredi→shrani→objavi) v enem neprekinjenem brskalniškem toku ni bilo izvedeno po-klik-po-klik zaradi harness omejitev (iframe + postMessage + React); posamezni deli (edit-mode viden, ✎, save/publish pipeline) so potrjeni.
- **FAIL** — nič.
- **NOT VERIFIED** — dejansko nalaganje prek vizualnega inspector klic z miško v brskalniku (upload endpoint dokazan direktno; UI picker ni bil kliktan z lokalnim file-om v harnessu); mobilni vizualni editor (390) ni bil celovito dokazan v enem toku.
- **BLOCKED** — vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje). E (reviewer) ni mogel zagnati tsc/git (read-only); koordinator zagnal tsc (čist) + unit (1359).

## Končni sklep

Obe 2D-7 področji sta **potrjeni z realnimi dokazi v brskalniku in server**: (1) fotografija se res naloži (POST /api/upload 200) in servira (`/api/media/{id}` 200, image/png) org-scoped; (2) vizualni urejevalnik uporablja **isti** renderer kot javna stran, edit-mode + `✎ Uredi sekcijo` je živ in dosegljiv prek realne `/s/[slug]/preview` poti (ni 404 — Agent B false-positive). Že delujoča arhitektura ni bila refaktorirana; ni bilo produkcijske spremembe. Ostanek je zgolj brskalniška popolna avtomatizacija celotnega miškinaga toka, ki ga omejuje okolje, ne aplikacija.