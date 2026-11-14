# MARKEC — F6.3 ZAKLJUČNO POROČILO (dejanske predloge in layout po dejavnosti)

> Status per naloga: **PASS / PARTIAL / FAIL / NOT VERIFIED / NOT IMPLEMENTED**.
> Jasno ločeno: **IMPLEMENTIRANO** (koda/DB/UI), **KONFIGURIRANO** (manifest/vnos, ne izvedeno
> runtime tukaj), **NAČRTOVANO**.
> Vse trditve so iz dejanske kode (file:line) in izvedenih testov; E2E browser je iskreno
> označen NOT VERIFIED (ni bil izvedljiv v sandboxu).

---

## 1. Kaj je bilo ugotovljeno pred začetkom (analiza obstoječe kode)

- `src/lib/site-design.ts` — predloge (`SITE_TEMPLATES`) so definirane kot: `id`, `name`,
  `sectionOrder`, `basePaletteId`, `theme`, `layout: "classic"|"modern"|"minimal"` +
  `requiresCapabilities`/`verticals`. **`layout` polje obstaja, vendar ga renderer ne upošteva.**
- `_templateId` se shrani v `SiteContent._templateId` (site-content.ts:138) prek `applyTemplate`
  (actions/site-content.ts:520-573). **Renderer (`home-content.tsx`) NIMA reference na
  `_templateId` ali `layout`** — celotna domača stran je ena fiksna `sectionNodes` struktura
  (velik gradienten centered hero, services cards, …). Sekcije se le capability-gate-ajo.
- **Posledica:** vsi profili/depresije (mek, frizer, šivilja, čebelar) dobijo isto vizualno
  strukturo z razliko le v capability izklopu sekcij, temi in terminologiji. Ugotovitev revizije
  (da `_templateId` ni uporabljen) je potrjena tudi v trenutni kodi.
- Renderer klicev: `(public)/page.tsx`, `(public)/preview/page.tsx`,
  `components/site-editor/editable-site-preview.tsx` — vsi uporabijo `HomeContent`.

## 2. Kako je prej deloval `_templateId`

`_templateId` je bil **samo marker** (identifikator izbrane predloge), ki je:
- po `applyTemplate` vplival le na **vrstni red sekcij** (če je predloga imela `sectionOrder`);
- poleg barvne teme (`basePaletteId`/`theme` → CSS vars);
- **NE pa na dejanski layout/strukturo strani** (hero tip, primarna hierarhija, grid način).

Renderer je `_templateId` ignorirao — stran je bila vedno ista struktura.

## 3. Kaj je bilo implementirano (F6.3)

| Mehaniem | Status | Kje |
|---|---|---|
| `LayoutManifest` (heroVariant + primary + showStats + prominentCta) + `resolveLayout(templateId, profileId)` | **IMPLEMENTIRANO** | `src/lib/site-layout.ts` |
| `defaultTemplateForProfile(profileId)` — privzeta predloga za dejavnost | **IMPLEMENTIRANO** | `src/lib/site-layout.ts` |
| Hero strukturi `SplitHero` in `MinimalHero` (namenski, ne barvni) | **IMPLEMENTIRANO** | `src/components/landing/hero-variants.tsx` |
| Renderer uporabi manifest: split/minimal/centered hero + primary | **IMPLEMENTIRANO** | `home-content.tsx` (hero: split/minimal branža, obstoječi centered kot fallback) |
| `_templateId` se obravnava pri renderju (ni več samo marker) | **IMPLEMENTIRANO** | `home-content.tsx` → `resolveLayout(content._templateId, profileId)` |
| Privzet `_templateId` per dejavnost v defaultSiteContent | **IMPLEMENTIRANO** | `site-content.ts` (konec `defaultSiteContent`) |
| `profileId` posredovani renderju (public/preview/editor) | **IMPLEMENTIRANO** | `(public)/page.tsx`, `preview/page.tsx`, `editable-site-preview.tsx` |

Nobena shema ali migracija ni bila potrebna (vse v obstoječem `SiteContent._templateId` JSON).

## 4. Katere predloge so dejansko izdelane

V `site-layout.ts` `DEFAULT_TEMPLATE_BY_PROFILE` (privzeta predloga → manifest):

| Profil | Privzeta predloga | Hero struktura | Primarna hierarhija |
|---|---|---|---|
| **mehanik, tire-service** | `modern-bold` | **split** (besedilo + slika, poudarjen CTA) | delovni nalog / servis |
| **frizer, beauty, barber, nails, cosmetica, massage, epilation** | `classic-elegant` | **centered** (velika predstava) | storitve (rezervacijski) |
| **seamstress** | `minimal-light` | **minimal** (kompaktna bela pasica) | povpraševanje / delovni nalog |
| **beekeeping** | `minimal-light` | **minimal** | **izdelki/trgovina** (ne storitve) |
| generic / neznano | `classic-elegant` (fallback) | centered | storitve |

Te razlike so **strukturne** (različen hero HTML, primarna sekcija = druga hierarhija), ne le
temeljene na barvi. (Barse še dodatno določa dejanska izbrana predloga SITE_TEMPLATES po
paleti/temi, kot prej.)

## 5. Kako se razlikujejo strukture posameznih dejavnosti

- **Frizer (centered + storitve):** velik steward-gradient hero s CTA »Rezerviraj termin«, nato
  storitve (rezervacijski tok), osebje, galerija, ocene. → Hospodarjenje s terminom.
- **Mehanik/vulkanizer (split + delovni nalog):** levo besedilo + desno fotografija, poudarjen
  CTA na servis/delovni nalog, nato delavni nalog/vozila, servisne storitve, trgovina z deli.
- **Šivilja (minimal + povpraševanje):** kompaktna pasica, nato povpraševanje/delovni nalog
  (proizvodni tok), storitve, galerija; ni ponev angle napačnega velikega heroja.
- **Čebelar (minimal + izdelki):** minimalna predstava, nato izdelki/trgovina (pridelava),
  info o izdelkih — nima »storitev« strukture.

Renderjevo osnovno sekcije so še vedno capability-gated (če lastnik izklopi modul, se odseki
ne renderirajo — preko obstoječih `hasServices`/`staffEnabled` itd.), kar pomeni da se stran
pravilno prilagodi izklopom modulov.

## 6. Kako je predloga povezana s poslovnim profilom

- On-niza → `defaultSiteContent(vertical)` postavi `_templateId` (iz `defaultTemplateForProfile`).
- Renderer → `HomeContent(profileId, content)` → `resolveLayout(content._templateId, profileId)`
  → izbere hero variante + primarno hierarhijo.
- `applyTemplate` (lastnik v editorju) lahko še vedno spremeni predlogo (marker + order + tema);
  dejavnost (profil) je **avtoritativna** za hero/primary strukturo (če lastnik izbere drugo
  predlogo, ki bi strukturo spremenila, dejavnost preglasi strukturo - zaščita pred napačnim
  layoutom, npr. frizer ne dobi split servisnega heroja nenamerno). To je oblikovalska odločitev
  F6.3 in je pokrito z unit testom.

**Povezava z urejevalnikom (nujno za pravilno uporabo predlog):**
- `src/components/site-editor/templates-panel.tsx` — lastnik izbere oblikovno predlogo
  (`applyTemplate(id)` → `_templateId` + vrstni red + tema); UI ni spreminjan.
- `src/components/site-editor/editable-site-preview.tsx` — sedaj posreduje `profileId`, zato
  predogled odraža isto layout strukturo kot objavljena javna stran. Urejevalnik ni na novo
  narejen — le prejema `profileId` (nujna povezava iz F6.3 §6); drugi UX urejevalnika je F6.4.

## 7. Predogled, shranjevanje, objava

Predogled in javni prikaz uporabljata isti `HomeContent` (z `profileId`) — predogled
(`/preview?edit=1`) prikazuje isto strukturo, kot bo objavljena. Shranjevanje/objava so
nespremenjeni (obstoječi `publishSite`/`snapshot` iz F5.5.4.x), nič se ni lomilo. Objava kopira
`_templateId` v snapshot (že deluje).

## 8. Katere datoteke so bile spremenjene (F6.3)

- **Nove:** `src/lib/site-layout.ts` (manifest), `src/components/landing/hero-variants.tsx`
  (SplitHero, MinimalHero), `tests/site-layout-f63.test.ts`.
- **Modificirane (ciljano, brez prepisa WIP):** `src/lib/site-content.ts` (defaultTemplateForProfile
  import + `_templateId` v defaultSiteContent), `src/components/landing/home-content.tsx` (import,
  prop, layout izračun, hero branža — obstoječi centered ostal), `src/app/(public)/page.tsx`,
  `src/app/(public)/preview/page.tsx`, `src/components/site-editor/editable-site-preview.tsx`
  (posredovanje `profileId`).

**Nobena druga datoteka ni bila spremenjena.** `site-design.ts` ni bil preurejen (predloge so
obstoječe); dodanemu manifestu ni treba spreminjati SITE_TEMPLATES.

## 9. Rezultati testov (dejansko izvedenih)

| Preverba | Rezultat |
|---|---|
| `npx tsc --noEmit` (F6.3 datoteke) | **0 napak** |
| `vitest run tests/site-layout-f63.test.ts` | **10/10 PASS** (različne strukture po dejavnosti, frizer centered / mehanik split / šivilja minimal / čebelar products, fallback) |
| `vitest run` (celotna paleta) | **91 datotek, 1325 PASS** (prej 1315; +10) — nič lomljeno (vklj. site-design-f532, mixed-site, landing, entry-checkout) |
| E2E browser (javni prikaz frizerja/mehanika …) | **NOT VERIFIED** (ni mogoče izvesti v sandboxu — zahteva dev server + veljaven objavljen tenant z delujočimi moduli, brez poseganja v markec_dev/produkcijo) |

## 10. End-to-end testiranje (obvezno v §7)

**Iskren poskus E2E (izveden v tem obtoku):**
- Poskusil sem poganjati `next dev` + odpreti javno stran v browserju (view_page).
- **Ugotovitev:** dev server na 3000 (in 3001, auto-prebrano) je v tem okolju **zaseden/servira
  tuj projekt** (odprti `http://localhost:3001/s/demo-salon` je prikazal popolnoma drugo aplikacijo
  »Discover Slovenia AI« — ne MARKEC). Zato ni mogoč zanesljiv prikaz dejanske MARKEC javne strani
  z našim layoutom.
- Poleg tega `markec_dev` vsebuje le **enega objavljenega tenanta (demo-salon, beauty)** —
  za preverjanje razlik frizer/mehanik/šivilja/čebelar bi potreboval 4 objavljene tenante z
  različnimi dejavnostmi, ki jih **ne smem ustvariti** v `markec_dev`/produkcije (omejitve), in
  druge testne baze niso migrirane (brez baze).
- **Sklep: E2E browser preverjanje ni bilo zanesljivo izvedljivo v tem sandboxu → oznaka
  **NOT VERIFIED**. Ni nadomeščeno z unit testi (dodani so kot dopolnilo, §9). Priporočen
  dejanski način po odobritvi izvora: pognati MARKEC dev na prostem portu s pravilnim
  DATABASE_URL + 4 objavljenimi testni tenanti (frizer/mehanik/šivilja/čebelar), odpreti vsako
  javno stran in preveriti strukturo/CTA/mobile/objavo ter izolacijo org.

## 11. Težave in tveganja

| Tveganje | Ocena |
|---|---|
| Renderer je bil `M`/`??` od drugih agentov (WIP) — moji edits so ciljani, ne prepisi; možnost konflikta ob združitvi WIP | Nizko–Srednje |
| Vsak novi profil (34) še nima eksplicitnega manifesta — če ga nimajo, spadajo na varni fallback (generic → centered/storitve) | Nizko (fallback je delujoč) |
| E2E ni izveden — dejansko vizualno/strukturno potrjevanje na javni strani ni zaključeno | **Srednje** (unit dokazuje logiko, ne vizualno) |
| Strukturna razlika je trenutno omejena na hero + primarno hierarhijo; services/products grid in nav-štrukcija ostajata na obstoječi predlogi (barva/order) | **Nizko–Srednje** → potencialna F6.3 dopolnitev |

## 12. Kaj je ostalo nedotaknjeno (F6.3)

- **Nobena shema, migracija, baseline, migracijski arhiv** — nedotaknjeno.
- **`markec_dev` / produkcija / Vercel** — nedotaknjeno.
- **Delo drugih agentov** — evidenra (M 101, ?? 193, D 30); moje spremembe so ciljane; nisem
  prepisoval `home-content`/editor nasploh.
- **Trgovina (F6.5), rezervacije (F6.6), dashboard/moduli (F6.7)** niso bile spremenjene.
- **Urejevalnik (F6.4)** ni bil spreminjan (le `editable-site-preview` je posredoval `profileId`).

---

## Status per naloga (F6.3)

| Naloga | Status | Opomba |
|---|---|---|
| Analiza obstoječe kode (renderer/`_templateId`) | **PASS** | potrjeno: `_templateId` se shrani, renderer je ignorira (ni marca) |
| Sistem predlog (razširljiv, layout manifest) | **PARTIAL** | implementiran `LayoutManifest` + map profili → struktura; poln "layout manifest" za vsak SITE_TEMPLATES ni 100% (order/tema+BW seveda) |
| Predloge za 7 dejavnosti | **PARTIAL→PASS za jedro** | hero+primarna razdeljena po dejavnostih; services/products grid še obstoječ |
| Layout res iz dejavnosti (ne le barva) | **PASS** | unit test (10) dokazuje razlike |
| Povezava profil ↔ predloga (onboarding/privzeto) | **PASS** | `defaultSiteContent` + `defaultTemplateForProfile` |
| Moduli izklopi → pravilni | **PASS** | capability-gating ostal (nove sekcije le sledijo obstoječi logici) |
| E2E (browser) 4 dejavnosti | **NOT VERIFIED** | ni izvedljivo v sandboxu (iskreno) |
| Bez sheme/migracije / nedotaknjen WIP | **PASS** | — |

**F6.3 jedro je implementirano** (renderer upošteva `_templateId`, dejavnost vodi strukturo,
hero variante). Polna "predloga = dejanski layout" (services grid, nav struktura, …) je delna
(PARTIAL) in čaka bodisi F6.3 nadgradnjo ali F6.4 — a osnovna vizija (mehanik ≠ frizer, struktura
ne barva) je dosežena na hero/hierarhija nivoju in podprta z testom. **E2E browser / daljše grid
/ nav razlike so iskreno NOT VERIFIED / načrtovane.**