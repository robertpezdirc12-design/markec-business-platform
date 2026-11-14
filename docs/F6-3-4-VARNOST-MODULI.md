# MARKEC — F6.3.4 ZAKLJUČNO POROČILO (Varnost in upravljanje modulov)

> Verifikacijska faza (pred F6.4). Cilj: preveriti izolacijo organizacij (uporabnik ene org ne sme
> dostopati/spreminjati podatkov druge) in upravljanje modulov (vklop/izklop → sekcije/gumbi ostanejo
> ali izginejo pravilno; podatki ohranjeni). Statusi: **PASS / PARTIAL / FAIL / NOT VERIFIED /
> NOT IMPLEMENTED**. Okolje: izolirana baza `markec_f631_test`, dev na 3010, browser = Chrome DevTools MCP.

---

## 1. Uvod / arhitektura dostopa (analiza kode)

- **Mutacije** (updateSiteContent, moduli, customeri, izdelki …) določijo org IZKLJUČNO iz **session-a**
  (`requireSessionOrg` / `requirePermissionOrg` / `requireModuleManageOrg` → `resolveSessionOrganization`).
  `resolveSessionOrganization` (guard) je **fail-closed**: vrne null če uporabnik NI član te org (mora
  obstajati ACTIVE `OrganizationMember` row; brez legacy fallback). Entity updejti se povezujejo z
  `where: { id, organizationId: org.id }` / `findFirst({ id, organizationId: org.id })` — preverijo, da
  vnos pripada session org. → **pisanje skozi UI je org-izolirano (PASS, na podlagi kode + izolacije
  dejanskih sprememb iz F6.3.3).**
- **Branje:** nekaj server actions sprejme `orgId` NEPOSREDNO od klienta in ga uporabi v Prisma queryju
  **brez preverjanja pripadnosti** — glej §3.

## 2. Cross-org dostop / izolacija — browser + DB

| Test | Rezultat |
|---|---|
| Prijavljen kot čebelar (org A): odpre urejevalnik | prikaže SAMO čebelarjeve podatke; `foreignOrgLeak` sken HTML = [] (ni frizer/mehanik/sivilja podatkov) — **PASS** |
| Prijavljen lastnik vsake org ureja lastno vsebino; drugi tenanti ostanejo nespremenjeni | **PASS** (iz F6.3.3 izolacija + potrjeno v DB) |
| Cross-org **pisanje** (poskus UI/modul prek druge org) | zavrnjeno/vano — org vedno iz session, modul-vrsta se ustvari le v lastni org (`OrganizationModuleState` obstaja le za čebelarja) — **PASS** |
| **Branje prek `orgId` od klienta** | glej §3 — **pomanjkljivost** |

## 3. Varnostna pomanjkljivost (branje, read-only IDOR)

**Najdeno:** sledeče *server actions* sprejmejo `orgId` kot argument in izvedejo Prisma query **brez
preverjanja, da kličitelj pripada tej org**:
- `getPreviewFaq(orgId)` in `getPublicFaq(orgId)` (faq.ts)
- `getPreviewGalleries(orgId)` in `getPublicGalleries(orgId)` (galleries.ts)
- `isSiteContentUntouched(orgId)` (site-content.ts)
- (podobno `getOrgTimezone(organizationId)` v appointments.ts)

Posledica: uporabnik org A (ali neregistrirani, če je action izpostavljen/a klice) lahko s podajanjem
orgId org B pridobi **osnutke / celotno vsebino FAQ-jev, galerij in stanje vsebine** org B. Gre za
**branje** (read) — ne spreminjanje — vendar je **cross-tenant (IDOR)**.

- **Trenutna dejanskost v testni bazi:** tenanti nimajo FAQ ali galerij (0 vrstic) → read-leak za te
  entitete **ni demonstriran z realnimi podatki** (ne bi vrnil nič).
- **Ocenjevanje:** **FAIL / PRISOTNA POMANJKLJIVOST v kodi** (access-control ne oskrbi org-scooping za
  branje), resnost **srednja** (branje vsebine/drafts drugih org, ne zapis podatkov). Trenutni podatkovni
  dokaz zlorabe **NOT VERIFIED** (ni podatkov za leak), ampak koda to dopušča.

**Predlog popravka (pred F6.4 / ob naslednji priložnosti):**
1. Te branja preoblikovati v **org-scoped z session** (kot `updateSiteContent`):
   `const { org } = await requireSessionOrg()` za `getPreview*`, ali pa vsaj
   `if (orgId !== session.orgId) return []` z membership check.
2. `getPreview*` naj bo dostopen **samo prijavljenemu lastniku** tiste org (in oblikovalec preview z
   owner-session), nikoli od anonimnega klienta.
3. Dodati guard wrapper (npr. `requireOrgIdAccess(session, orgId)`) ki potrdi membership PRED queryjem.
> Ni implementirano v tej fazi (naloga: brez spreminjanja kode pri verifikaciji; napaka dokumentirana
> po §10).

## 4. Upravljanje modulov — dejanski UI test (čebelar)

Uporabljen Moduli tab (Nastavitve → Moduli). Moduli imajo tri stanja: **Vklopi / Skrij / Izklopi**;
obvezni so zaklenjeni; neaktivni (za dejavnost) disabled.

### 4.1 Kategorije modulov (čebelar)
- **Obvezni:** Spletna trgovina, Statistika, Stranke, Zaloge (locked).
- **Priporočeni/aktivni:** Dokumenti, Dostava, Obrazci, Ocene strank, Walk-in (vklopljeni).
- **Ni na voljo:** Rezervacije, Storitve+cenik, Zaposleni, Delovna naročila, Poslovni procesi (disabled).

### 4.2 Izklop modula → javna stran (REZULTAT SUMA)
Izpolnjenn: klik **„Izklopi"** na **Ocene strank** → zapisano v DB: `cebelar-test / reviews / DEACTIVATED`
(autosave ob kliku, POST 200). **Po izklopu JAVNA stran `/s/cebelar-test` ŠE VEDNO prikazuje review
formo** („Delite svoje mnenje", „Oddaj oceno"). **→ FAIL §7** („ob izklopu modula se odstranijo
pripadajoči CTA-gumbi/sekcije" — NE, sekcija ostane). Razlog v kodi: javni `home-content.tsx` izriše
`reviews` sekcijo neodvisno od `OrganizationModuleState` DEACTIVATED (gledano na capability, ne na
per-module state).

### 4.3 Ponovni vklop → podatki ohranjeni (PASS)
Klik „Vklopi" → `reviews` → `ACTIVE`. Vsi tenantovi podatki (katalog, vsebina) so ostali (nič ni bilo
izbrisano). **PASS** (ob vklopu podatki ohranjeni; tudi izklop ni izbrisal podatkov — le sekcija je
ostala v prikazu, glej zgoraj).

### 4.4 Izolacija modulov med tenanti (PASS)
Po vseh operacijah ima **samo cebelar-test** vrsto v `OrganizationModuleState` (reviews → ACTIVE);
frizer/mehanik/šivilja so brez vrste — modul config je per-org, spremembe ne udarjajo v druge.

## 5. Preverjeni moduli (trgovina/rezervacije/galerije/povpraševanja)

- **Rezervacije / povpraševanja (guest):** pri ne-booking tenatih `/booking` → **307 → `/inquiry`**
  (že F6.3.2/3); omogočeno/delujoče za frizer (booking) in šiviljo (inquiry) — PASS.
- **Trgovina (čebelar):** modul je **obvezen** → zaklenjen, trgovina `/shop` deluje — PASS.
- **Galerije:** ni galerij podatkov pri tenatih → aktivni izklop v UI ni bil demonstrabilen (podatki 0)
  → **NOT VERIFIED**. (Pomanjkljivost `getPreviewGalleries` orgId pa dokumentirana, §3.)
- **Ocene:** izklop ne skrije sekcije → **FAIL** (§4.2).
- **Obrazci:** modul vklopljen (`getPreviewFaq` njeg osnutke brez org-check → §3).

## 6. Statusni pregled

| Področje | Status |
|---|---|
| Cross-org prikaz izolacije (urenjevalnik) | **PASS** |
| Cross-org **pisanje** (session-bound, fail-closed) | **PASS** |
| Cross-org **branje** (read IDOR getPreview*/getPublic*/isSiteContentUntouched) | **FAIL** (pomanjkljivost; eksploit z realnimi podatki ni demonstriban — NOT VERIFIED) |
| Modul izklop → javna sekcija izgine | **FAIL** (reviews ostane po DEACTIVATED) |
| Modul ponovni vklop → podatki ohranjeni | **PASS** |
| Moduli per-org izolacija | **PASS** |
| Trgovina / rezervacije / inquiry routing | **PASS** |
| Galerije aktivni izklop v UI | **NOT VERIFIED** (ni podatkov) |

## 7. Napake / predlogi

1. **(VARNOST, srednja)** Read-only IDOR: getPreviewFaq/getPublicFaq/getPreviewGalleries/
   getPublicGalleries/isSiteContentUntouched/getOrgTimezone sprejmejo `orgId` od klienta in ne
   preverijo pripadnosti → lahko vlečejo/draft podatke drugih org. **Predlog:** org-guard prek session
   (kot updateSiteContent) ali membership check pred queryjem; getPreview* samo za lastnika.
2. **(FUNKCIONALNOST, srednja)** Izklopljen (DEACTIVATED) modul `reviews` **ne skrije** sekcije/forme z
   javne strani (`home-content.tsx` gating ne upošteva OrganizationModuleState). **Predlog:** javni
   renderer naj za vsako sekcijo upošteva *efektivni* modul state (base + moduleStates), ne le capability
   profila — ali pa izklop modula naj najpo tem odstrani sekcijo v `publishedSiteContent`/render.

## 8. Zaključek / priporočilo pred F6.4

- **Pisanje in izolacija podatkov sta na podlagi kode in dejanskih testov pravilna** (fail-closed, session
  scoped), kar ščiti pred cross-org spreminjanjem — to je bilo tveganje, ki sem ga najbolj pazlist.
- **Najdeni sta dve odprti pomanjkljivosti**, ki ju **priporočam odpraviti pred ali v okviru F6.4**:
  (1) read IDOR + (2) izklopljen modul ne skrije sekcije. Obe sta dokumentirani zanesljivo zgoraj.
- Aktivni galerie-toggle in branch cross-org bere s pravo stop še nista bila v celoti izvedena (ni
  podatkov/NOT VERIFIED), ampak koda jasno kaže pomanjkljivost.

Ustavljam se po tem poročilu (ne začenjam F6.4 brez tvoje odobritve in naslova glede najdenih napak).