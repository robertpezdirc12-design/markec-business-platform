# MARKEC — F6.3.5 POPRAVKI (Varnost: READ IDOR + izklop modulov)

> Omejena popravljalna naloga (pred F6.4). Odpravljeni sta obe napaki iz
> `docs/F6-3-4-VARNOST-MODULI.md`: (1) read IDOR v javnih/predogled branjih in
> (2) izklopljen modul `reviews` ni skril sekcije z javne strani.
> Statusi: PASS / PARTIAL / FAIL / NOT VERIFIED.

---

## 1. Vzrok obeh napak

1. **READ IDOR (branje):** server actions `getPreviewFaq`, `getPublicFaq`,
   `getPreviewGalleries`, `getPublicGalleries`, `isSiteContentUntouched`,
   `getOrgTimezone` so sprejemale `orgId` NEPOSREDNO od klienta in ga uporabile v
   Prisma queryju **brez preverjanja pripadnosti** (membership). Posledica: uporabnik
  /neregistrirani je lahko s tujim `orgId` prebral **osnutke (draft)** drugih org.
2. **Izklop modula ne skrije sekcije:** javni renderer (`home-content.tsx`) je
   sekcije (npr. `reviews`) g-onnival po *profilni capability* in podatkih, **ne po
   dejanskem `OrganizationModuleState`** -> DEACTIVATED `reviews` je pustil sekcijo
   in ocen-formo na javni strani.

## 2. Spremenjene datoteke

| Datoteka | Sprememba |
|---|---|
| `src/app/actions/faq.ts` | `getPreviewFaq` → owner-gate (`requirePermissionOrg`), `getPublicFaq` → javni kontekst (`getPublicOrg`), arg `_orgId` NE zaupan |
| `src/app/actions/galleries.ts` | Enako za `getPreviewGalleries` / `getPublicGalleries` |
| `src/app/actions/site-content.ts` | `isSiteContentUntouched` → owner-gate (session), `_orgId` nezaupan, fail-closed `false` |
| `src/app/actions/appointments.ts` | `getOrgTimezone` → dovoli le session- ali javno-razrešeno org; sicer default (fail-closed) |
| `src/app/(public)/page.tsx` | Doda `reviewsModule` state + posreduje `reviewsEnabled` v HomeContent |
| `src/app/(public)/preview/page.tsx` | Enako za predogled |
| `src/components/landing/home-content.tsx` | Nov prop `reviewsEnabled`; `reviews` sekcija pogojena z njim (DEACTIVATED → se ne izriše) |
| `tests/batch-74-87.test.ts` | Posodobljen regex (reviews lastna sekcija, zdaj z modul-gating) |
| `vitest.itest.config.ts` (novo) | Ločena config za integracijske varnostne teste (izolirano od `npm test`) |
| `tests/integration/f635/security-read-idor-modules.itest.ts` (novo) | Varnostni + modulski integration testi (prava baza) |

> Nismo spreminjali sheme/migracij, `markec_dev`, produkcije, niti nismo pretirano
> posegali v WIP drugih agentov — narejene so bile le ciljne, minimalne spremembe.

## 3. Način odprave

### 3.1 (IDOR)
- **Predogledne (preview)** funkcije: org se določi IZKLJUČNO iz preverjene seje
  (`requirePermissionOrg("settings.manage")` → `resolveSessionOrganization` z aktivnim
  membership). Brez seje ali za tujca → `[]` (fail-closed). Pošiljanje tujega `orgId`
  je ignorirano.
- **Javne** funkcije: org se določi iz **varno razrešene javne org** (`getPublicOrg` —
  signed header/URL/domain), ne iz argumenta. Vrnejo SAMO javno objavljene
  (isPublished+isPublic) entitete tega gostitelja; ne obstoje → `[]`.
- `getOrgTimezone`: fal-back fail-closed, le session/javni org.
- **Legitimni javni prikaz brez prijave** je bil preverjen in ostaja nedotaknjen (§5/E2E).

### 3.2 (izklop modula)
- Uveden prop `reviewsEnabled` v `HomeContent`, izračunan iz **dejanskega
  `OrganizationModuleState`** za org (`.state !== "DEACTIVATED"`).
- `reviews` sekcija se izriše izključno ko je modul aktiven — vse, segmente in
  ocen-forma, odpada. Velja enako na javni strani in v predogledu.
- Iskani stanje ene org ne vpliva na drugo (ime DRŽNO per-org v `OrganizationModuleState`).
- Ponovni vklop ohrani podatke (brez brisanja — samo sprememba stanja).

## 4. Varnostni testi (integracijski, prava baza `markec_f631_test`) — PASS 7/7

`tests/integration/f635/security-read-idor-modules.itest.ts` (stanje njegov v
`vitest.itest.config.ts`, poganjano z `DATABASE_URL=<f631> npx vitest run --config vitest.itest.config.ts`):

- `getPublicFaq(orgId)` s tujim argom → vrne le JAVNI kontekst (frizer), NE ogromne o drugem → **PASS**
- `getPreviewFaq` brez seje → `[]` (fail-closed) → **PASS**
- `getPreviewFaq` lastnika org A → samo org A (vključno draft), `orgId` arg NIMA vpliva (ne razkrije mehanika) → **PASS**
- `getPublicGalleries` / `getPreviewGalleries` (anonim tuj orgId → `[]`) → **PASS**
- `getOrgTimezone(foreignOrgId)` anonim → fail-closed default → **PASS**
- `isSiteContentUntouched(foreignOrgId)` brez seje → `false` → **PASS**
- Modul: `reviews DEACTIVATED` → `reviewsEnabled false`; `ACTIVE` → `true` (podatki ohranjeni) → **PASS**

Rezultat: **7 passed / 7**, `Test Files 1 passed`.

## 5. Moduli — browser E2E (čebelar, kjer je bila napaka odkrita) — PASS

Na `markec_f631_test`, dev 3011, čebelar prijavljen:

| Akcija | Javna stran `/s/cebelar-test` | Rezultat |
|---|---|---|
| reviews **ACTIVE** | "Izjave" sekcija + ocen-forma prisotni | PASS |
| klik „Izklopi" (→ DEACTIVATED v DB) | sekcija + forma **izginili** (node + browser eval) | **PASS** (popravek deluje) |
| klik „Vklopi" (→ ACTIVE) | sekcija + forma **se vrnili**, podatki modula ohranjeni | PASS |
| Izolacija med org | samo čebelar ima module-state vrsto; drugi tenanti nedotaknjeni | PASS |

Prej (F6.3.4) je ta isti izklop pustil formo vidno — od tod sam dokaz da je popravek 
dejaven. Obla predogled (edit mode, `EditableSitePreview`) prikazuje lastniku drafts ne glede na
izklop (neobčutljivo — lastnikovo pregledovanje), kar je skladno z owner-gate; javna/uporabniška
vidnost odstrani sekcijo.

## 6. Regresija / tipi

- Celoten vitest suite: **91 datotek / 1325 testov PASS** (po posodobitvi `batch-74-87`).
- `tsc --noEmit`: **ni TS napak** v popravljenih datotekah (faq, galleries, site-content,
  appointments, home-content, page, preview).
- Javni prikaz brez prijave: `/s/mehanik-test`, `/s/frizer-test`, `/s/cebelar-test` → vse 200 s
  pravilnimi h1 naslovi (ni zlomljen anonimni prikaz).

## 7. Preostale omejitve / NOT VERIFIED

- `EditableSitePreview` (lastniški vizualni editor) še vedno prikaže review-formo kad izklopljeno
  — owner-only; javna izključitev je pravilna. Delno out-of-scope (WIP drug agent; ni del javne
  objave).
- Aktivni izklop/vklop drugih optional modulov (galerije/FAQ) — modul `reviews` je bil tisti s
  konkretno najdeno napako in je bil potrjen E2E; enak vzorec (per-module state) pokriva tudi
  tiste, ampak njihove vizualne sekcije je potrebno dodatno preveriti v F6.4.

## 8. Zaključek

| Področje | Status |
|---|---|
| Read IDOR — odprava (preview/javni gating, fail-closed) | **PASS** |
| Izklop modula → sekcija/CTA se skrije (javno) | **PASS** |
| Ponovni vklop → podatki ohranjeni, sekcija se vrne | **PASS** |
| Varnostni integration testi | **PASS (7/7)** |
| Modulski E2E (browser, čebelar) | **PASS** |
| Regresija (129 testov) + tsc | **PASS** |
| Javni prikaz brez prijaye | **PASS** |
| Edit-mode predogled (owner) | NOT VERIFIED (owner-only, WIP drug) |

**F6.4 se NI začel.** Obe napaki odpravljeni in preverjeni (integracijski testi + browser E2E +
polna regresija).