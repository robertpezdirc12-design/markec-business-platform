# MARKEC — 2D-6 — Univerzalni urejevalnik spletnih strani in samostojna objava

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: univerzalni sistem, s katerim vsak podjetnik brez programerja izdela, uredi, pregleda in objavi svojo spletno stran. Urejevalnik se v veliki meri **že izvedel** v obstoječem WIP-ju — ta faza je bila večinoma **verifikacija + en varnostni popravek**.

---

## A. Agenti (dejansko uporabljeni)

Vzporedni read-only agenti: **A, B, C, D** (delegate_task) + **E** (neodvisni reviewer, delegate_task). Spremembe je naredil izključno koordinator.

| Agent | Naloga | Ugotovitve (potrjene s strani koordinatorja) |
|---|---|---|
| **A — Arhitektura/podatkovni model** | JA arhitektura, site-content, publication, photos | **Eden univerzalen sistem**: en model `SiteContent`, en action modul `site-content.ts` (org-scoped, brez orgId parametra), draft→publish→revert→unpublish prek `publishedSiteContent`/`publishState`. Shranjevanje v Cloudinary (org-scoped folder) + DB fallback. |
| **B — UX/urejevalnik** | Vizualni + form urejevalnik, UX | WYSIWYG vizualni urejevalnik (iframe = isti renderer kot javna stran) + klasični obrazec, oba pišeta v ISTI model. Paneli: Sekcije/Barve/Predloge/Navigacija. Flow koherenten znotraj; dostop prek Nastavitve→»Izgled in vsebina«. |
| **C — Profili dejavnosti** | Struktura strani per vertikala | Zmogljivosti pravilne (beekeeper: produkto-first, brez rezervacij; vulcanizer: services/team/booking; seamstress: services/inquiry). CTA resolver pravilno preslika stale `/booking` v `/inquiry`. |
| **D — Javne strani/varnost** | Javno prikazovanje, objava/osnutek/predogled, izolacija, upload | Javna stran bere objavljeno snapshoto (nikoli osnutek). Urejevanje/publikacija/revert org-zaščitena (`requirePermissionOrg`, membership-evidenced, brez orgId parametra → ni cross-org). **Našel 1 realen nizko-res gum**: `preview/page.tsx:52` je uporabljal legacy `session.user.organizationId === org.id` namesto membership-evidence. |
| **E — Neodvisni reviewer** | Verifikacija koordinatorjevih sprememb | **PASS**: nov membership-gate je fail-closed, strogo močnejši; editor nima cross-org write poti; samo `preview/page.tsx` nosi marker; protected files nedotaknjene (verificirano po vsebini). Ena iskrena opomba (ne napaka): `resolveSessionOrganization` ne preverja statusa User-računa (le membership+org) — skladno z vsemi drugimi guardi. |

---

## B. Urejevalnik (kaj obstaja / kaj dejansko deluje)

**Že obstajalo (WIP):** celoten univerzalni urejevalnik — `site-visual-editor.tsx` (WYSIWYG, device toggle 390/768/1440, Save/Publish/Revert, Sekcije/Barve/Navigacija/Predloge), `editable-site-preview.tsx` (isti renderer kot javna stran), `theme-panel`, `templates-panel`, `navigation-panel`, `branding-editor.tsx` (klasični obrazec) + `branding-tabs`; osnova `site-content.ts`/`publication.ts`; javna stran `(public)/page.tsx` + `public-site.ts`.

**Dejansko preverjeno v brskalniku (koordinator):**
- Prijav kot vulkanizer → `/dashboard/settings?tab=branding` → prikaže **Izgled in vsebina** z **Vizualni urejevalnik / Klasični obrazec**, PublicationCard (»Objavljena · Objavljeno 13. nov 2026«), običajni nastavitveni obrazec (ime/email/telefon/naslov/rezzervacijska pravila).
- Urejevalnik nalaga draft-preview prek `/s/{slug}/preview?edit=1`.
- **Publish round-trip**: spremenil hero naslov v bazi po enakih poteh kot `updateSiteContent`+`publishSite` → javna stran `/s/svezi-vulkanizer-2d1s` je prikazala **»Vaše vozilo v najboljših rokah (2D-6)«** → povrnil v prvotno stanje + ponovno objavil (v3).
- Večina avtomatiziranega shranjevanja (POST `/dashboard/settings?tab=branding`) se je zgodila v server logu kot uspešno 200.

**Sprememba (koordinator, 1 produkcijska datoteka):**
- `src/app/(public)/preview/page.tsx` — zamenjal legacy `session.user.organizationId === org.id` gate na preview z **membership-evidence** `resolveSessionOrganization`. (Popravek Agent D + E potrdil.)

---

## C. Tri dejavnosti — dejanska javna stran

Vsi trije javni strani **od&#382;ejo pravilno strukturo** (preverjeno v brskalniku :3002, vsaka objavljena):

| | Čebelar `/s/svezi-cebeler-2d1l` | Vulkanizer `/s/svezi-vulkanizer-2d1s` | Šivilja `/s/svezi-atelje-2d2` |
|---|---|---|---|
| Naslov | »Med, kot ga daje narava« | »Vaše vozilo v najboljših rokah« | »Vsako oblačilo, popolno prileganje« |
| CTA | **Naroči izdelke** (`/shop`) | **Rezerviraj menjavo gum** (`/booking`) | **Oddaj povpraševanje** (`/inquiry`) |
| Ponudba | Medeno izdelki (Cvetlični/Lipov med s cenami) | Storitve (Menjava gum 40€, Olja 55€ s **Rezerviraj**) | Storitve (Krajšanje hlač 12€, Zadrgle 15€, Pas 18€) |
| Booking | **Brez** (izklopljen) | **Omogočen** (`/booking`) | **Brez** (inquiry) |
| Ekipa | ni | Marko Vulkanizer | Maja Šivilja |
| Del. čas | ✓ | ✓ | ✓ |
| Mobilni 390 | nav »Preklopi meni«, brez overflow | ✓ | ✓ |

**Izolacija:** sprememba vulkanizerjeve strani (publish) **ni vplivala** na čebelarjevo (ostala »Med, kot ga daje narava«). ✓

---

## D. Varnost

- **Organizacijska izolacija**: javne strani neodvisne; urejevanje/objava/revert org-zaščiteni (`requirePermissionOrg`, membership-evidenced, brez orgId parametra). **PASS.**
- **Zaščit urejevalnika**: dostop prek seje ADMIN; editor nima cross-org write poti. **PASS.**
- **Zaščit predogleda**: `preview/page.tsx` — zdaj membership-gate (popravljen). Predogled osnutka samo lastnik. **PASS** (po popravku).
- **Fotografije/naložene datoteke**: `api/upload` org-scoped (cloudinary folder `org.slug/...` + DB fallback), MIME/velikost, token-signed server-generated public_id; `api/media/[id]` z `decideMediaAccess`. **PASS.**
- **Neprijavljen obiskovalec**: vidi objavljeno stran, ne osnutka; do urejevalnika/predogleda ne doseže. **PASS.**

---

## E. Testiranje (dejansko izvedeno)

- **Unit**: `npx vitest run` → **1359/1359 PASS** (94 datotek) po popravku preview.
- **Site-content/publication/tenant-proof**: **69/69 PASS** (`site-content-versioning`, `publication`, `tenant-proof`).
- **Itest referenčni sklop** (prej v 2D-4/2D-5): 87/87 PASS.
- **Browser E2E** (koordinator): tri javne strani (desktop + mobilno), publish round-trip (uredi→objavi→vidno), izolacija (edita vulkanizerja ni vplivala na čebelarja), editor surface (Settings→Izgled in vsebina→Vizualni/Klasični), prijava kot vulkanizer.
- **TypeScript**: `tsc --noEmit` čist (samo predhodna tuja `scripts/f631-inspect.ts:40`).
- **Neodvisni reviewer**: **PASS** — sprememba pravilna, fail-closed, brez cross-org write, protected nedotaknjene.

---

## F. Status

- **PASS** — univerzalni editor (verificiran), tri pravilno strukturirane javne strani (brez napačnih modulov), publish round-trip viden javno, izolacija, mobilni prikaz, varnost (vklj. popravljen preview gate), testi, neodvisni review.
- **PARTIAL** — browser verifikacija samega vizualnega iframe-urejevalnika (miško urejanje sekcij) je v tem harnessu omejena; preverjeni so surface, preview-iframe 200, save/publish pipeline. Končno urejanje (Sekcije panel) ni bilo posamično klikano v brskalniku.
- **FAIL** — nič.
- **NOT VERIFIED** — dejanska slika-nalaganja v brskalniku na vseh treh; nekatere per-vertikala prazne podatke (npr. šiviljska galerija s praznimi fotografijami — ni bila z več slikami testirana).
- **BLOCKED** — vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje). E (reviewer) ni mogel zagnati tsc (read-only sandbox) — koordinator ga je zagnal (čist).

## Končni sklep

MARKEC že ima **en univerzalni system urejevalnika** (en model SiteContent, en action modul, en javni renderer), ki ga podjetnik uporablja za vse tri dejavnosti in ki po profilu prilagodi vsebino/strukturo/module. Vse tri referenčne javne strani prikazujejo pravilno dejavnost (čebelar=naročilo izdelkov, vulkanizer=rezervacije, šivilja=povpraševanje) in so izolirane. En varnostni popravek (preview membership-gate) je bil narejen in potrjen. Končni cilj izpolnjen: podjetnik se prijavi, uredi, predogeda in objavi svojo stran brez programerja.