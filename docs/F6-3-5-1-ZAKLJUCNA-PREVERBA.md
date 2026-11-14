# MARKEC — F6.3.5.1 ZAKLJUČNA PREVERBA (lastniški vizualni predogled z izklopljenimi moduli)

> Omejena preverba pred F6.4. Cilj: odpraviti/potrditi, da `EditableSitePreview`
> (lastniški vizualni urejevalnik) upošteva izklopljen (DEACTIVATED) modul `reviews`
> enako kot javna stran — aktiven → sekcija/obrazec vidna; deaktiviran → skrita
> (vklj. brez mrtvih CTA/povezav); ponovni vklop → sekcija se vrne, podatki ohranjeni.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED.

---

## 1. Git status / WIP drugih (pred spremembami)

- `src/components/site-editor/` — **novo (??), WIP drugih agentov** (ni commited).
- `src/app/(public)/preview/page.tsx`, `src/components/landing/home-content.tsx` — `M` (vključ. moje F6.3.5 spremembe).
- `git log`: zadnja commit-a v ta območja od `robertpezdirc12-design` (Nov 6) in `clixad-agent` (Nov 6) — stara, ne pred mojimi.

Po pregledu diff-a WIP: sprememba, je bila izvedena **varno — le diskretni dodatki (props + nerender own) brez prepisovanja obstoječe logike** `EditableSitePreview`, `preview/page.tsx`, `home-content.tsx`/`page.tsx`.

## 2. Ugotovitev vzroka (F6.3.5: lastniški predogled ni upošteval izklopa)

- `EditableSitePreview` je sicer renderjal `HomeContent`, **vendar ni posredoval `reviewsEnabled`**
  (HomeContent privzeto `true`) → tudi DEACTIVATED je pustil sekcijo vidno kadar so realne ocene.
- Dodatno: **ni posredoval `testimonials`** niti `canReviewBusiness` → v lastniškem predogledu review
  sekcija ni bila pravilno prikazana niti pri ACTIVE (HomeContent dobil prazen array). Torej je manjka
  pravi prenos podatkov/gatinga v lastniški vizualni predogled.

## 3. Spremenjene datoteke (varna odprava)

| Datoteka | Sprememba |
|---|---|
| `src/components/site-editor/editable-site-preview.tsx` | dodani props `reviewsEnabled`, `testimonials`, `canReviewBusiness`; polni jih v `HomeContent` |
| `src/app/(public)/preview/page.tsx` | v Promise doda `getPublicTestimonials(org.id)`; `isEditMode` preda `testimonials`, `canReviewBusiness`, `reviewsEnabled` v `EditableSitePreview` |

Ni spremenjene sheme/migracij, `markec_dev`, produkcije; `home-content.tsx`/`page.tsx` iz F6.3.5 nedotaknjeni (že pravilno gated).

## 4. Dejansko izvedene preverbe (browser E2E, f631, dev 3011)

Testna postavitev: prijavljen čebelar (cb@f631.test), eden test Review (5,0) ustvarjen samo za preverbo (in po koncu **izbrisan**).

### Lastniški vizualni predogled `/s/cebelar-test/preview?edit=1` (browser eval)
| Stanje modula | Rezultat eval | Sklep |
|---|---|---|
| reviews **ACTIVE** | `Izjave:true`, ocena `5.0:true`, besedilo review:true | **PASS** (sekcija + ocena vidni) |
| klik „Izklopi" → **DEACTIVATED** (DB potrjen) | `Izjave:false`, `5.0:false`, besedilo:false, nav `Mnenja` link:false | **PASS** (sekcija/obrazec/CTA skriti, brez mrtvih povezav) |
| klik „Vklopi" → **ACTIVE** (DB potrjen) | `Izjave:true`, `5.0:true`, besedilo:true | **PASS** (sekcija se vrne) |

### Ohranitev podatkov + izolacija drugih org
- Po ponovnem vklopu `Review` vrstica v DB še vedno obstaja (`count=1`) → **PASS** (ni brisanja).
- `OrganizationModuleState`: samo `cebelar-test / reviews / ACTIVE`; frizer/mehanik/šivilja **brez module-state vrstic** → izklop/vklop pri eni org ni vplival na druge → **PASS**.
- Javne strani `frizer/mehanik/sivilja/cebelar` → vse **200** → **PASS** (Javna + owner predogled konsistentno).

## 5. Avtomatizirani testi / regresija

- `npx vitest run` → **91 datotek / 1325 testov PASS**.
- itest F6.3.5 (prava baza) → **7/7 PASS** (`tests/integration/f635/security-read-idor-modules.itest.ts`).
- `npx tsc --noEmit` → **brez TS napak** v spremenjenih datotekah.

## 6. Statusni pregled

| Preverba | Status |
|---|---|
| Lastniški predogled — reviews ACTIVE (sekcija + ocena / obrazec vidni) | **PASS** |
| Lastniški predogled — reviews DEACTIVATED (sekcija/obrazec/CTA skriti) | **PASS** |
| Ponovni vklop — sekcija se vrne | **PASS** |
| Ohranitev podatkov (Review v DB ostane) | **PASS** |
| Brez mrtvih CTA/povezav („Mnenja" link izgine) | **PASS** |
| Javna stran — enako vedenje (ACTIVE/DEACTIVATED/ponovni vklop) | **PASS** (potrjeno že v F6.3.5 + tu node-check) |
| Izolacija drugih organizacij | **PASS** |
| Regresija (1325 testov) + itest 7/7 + tsc | **PASS** |

## 7. Opombe / preostala omejitev

- Testni Review vrstica je bila po preverbi **pobrisana** (baza čista).
- Spremembe so v `editable-site-preview.tsx` + `preview/page.tsx` — varni dodatki, ne prepis
  tujega WIP.
- Ostali moduli (galerije/FAQ itd.) izrecno **niso bili preverjani** (naloga: ne širiti obsega); isti
  vzorec (per-module state) pokriva tudi njih, ampak vizualna potrditev je za F6.4.

## 8. Zaključek

**Vse zahtevane preverbe so PASS.** Napaka iz F6.3.5 (lastniški predogled ne upošteva izklopa `reviews`)
je odpravljena in potrjena z resničnim browser E2E + avtomatiziranimi testi. **F6.4 se ne začne brez
nove odobritve.**