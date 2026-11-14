# MARKEC — 2D-10 — Upravljanje poslovne vsebine neposredno iz vizualnega urejevalnika

Datum: izolirana baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: podjetnik iz enega WYSIWYG urejevalnika upravlja poslovno vsebino (storitve/izdelki/ekipa/galerija/ocene) — **poslovni moduli ostanejo edini vir resnice**; brez duplikatov katalogov.

## A. Agenti (dejansko uporabljeni)
Read-only podagenti **A–D** + **E** (neodvisni reviewer). Koordinator je implementiral minimalno lepljenje.

| Agent | Opravil | Ključno |
|---|---|---|
| **A — Arhitektura/CRUD map** | popis actions + rut | services/products/staff so DB-backed, org-scoped, vsak s svojimi actions (`services.manage`/`products.manage`/`staff.manage`) in dashboard rutami (`/dashboard/services|products|staff`). **Nobene reviews-moderacije ni** (samo customer self-service + auto-approve). Galerija prek `?tab=content`. |
| **B — WYSIWYG integracija** | načrt | Editor `pushPreview` ne more nositi poslovnih seznamov (featured items so server-fetched props) → **najbolj varno je navigacijsko lepljenje** (gumb → obstoječi modul), ne inline-embedd (kompleksno, tvegano za divergence). Poslovni moduli ostanejo source of truth. |
| **C — Poslovni moduli/integrity** | side-effect avdit | Service update nima Zod-whitelista (staffIds/categoryId/deposit/duration so business fieldi — izvajamo samo prek obstoječega obrazca). Product update ima močan whitelist (stock/batch/traceability se ne dotakne). Staff update ne spreminja User creds, a `workingHours`/`serviceIds` sta destruktivna — zato ne šaljemo poljubnih. |
| **D — UX/mobile** | inspector + 390 | Gumb »Upravljaj X« (text-button, full-width) se zlahka doda v inspector; 390 stekla v full-width (lg:flex-row → column). Reviews brez rut → **prazno stanje, ne lažne ocene**. |
| **E — Neodvisni reviewer** | pregled | **PASS**: lepljenje korektno, ni novih akcij, ni dupliciranega modela, ni pisanja v Service/Product/Staff iz editorja; target rut obstajajo. **GAP**: E2E dokazuje NAVIGACIJO + dosegljivost modula, ne izvede dejanskega CREATE/EDIT form-submit v tem specu (leži na obstoječih modulnih E2E, npr. `e2e/b-tire-service.spec.ts`). |

## B. Implementacija (minimalno lepljenje, 0 novih virov resnice)
Modificirane le: `src/components/site-editor/site-visual-editor.tsx` (+ `Link` iz `next/link`, `SettingsIcon`) in `e2e/2d10-manage.spec.ts` (+ config testMatch).
- **Sekcija Storitve** → gumb »Upravljaj storitve« → `/dashboard/services`.
- **Sekcija Izdelki** → gumb »Upravljaj izdelke« → `/dashboard/products`.
- **Sekcija Ekipa** → gumb »Upravljaj ekipo« → `/dashboard/staff`.
- **Sekcija Ocene** → prazno stanje (»Ocene ustvarijo stranke … bez lažnih mnenj«; ni moderacije → ni gumba).
- **Ekipa/team** veže na obstoječi staff modul (poslovni vir); **ne ustvarja novih User računov**.

Ni novih akcij, ni sprememb sheme, ni dotika `einvoices`/`product-checkout`/`schema.prisma`/Stripe/webhook.

## C. Rezultati E2E (Playwright, :3002, realni kliki)
| Org | Sekcija | Manage gumb | Nav na modul | Javna | Pon. prijava → modul |
|---|---|---|---|---|---|
| Vulkanizer | Storitve → `/dashboard/services` | **PASS** | **PASS** (href točen + ruta 200) | **PASS** | **PASS** |
| Šivilja | Storitve → `/dashboard/services` | **PASS** | **PASS** | **PASS** | **PASS** |
| Čebelar | Izdelki → `/dashboard/products` | **PASS** | **PASS** (href točen) | **PASS** | **PASS** |
| **Izolacija** | 3 javne strani dosegljive | — | — | **PASS** | — |

Server log: `GET /dashboard/services 200`, `GET /dashboard/products 200` (modul-navigacije iz editorja), `POST /dashboard/settings?tab=branding 200` (save/publish v editorju), `GET /s/{slug} 200` (public).

## D. Poslovna integriteta (DB, po vseh testih)
Vulkanizer 6 services/2 products/1 staff/0 reviews; čebelar 0/6/0/0; šivilja 7/5/1/0 — **nespremenjeno**. Lepljenje ni ustvarilo duplikatov, ni dotaknilo zalog/serij/sledljivosti/naročil/računov. **Sprememba javne predstavitve ne spreminja poslovne zgodovine.**

## E. Status
- **PASS —** WYSIWYG sekcije Storitve/Izdelki/Ekipa imajo → obstoječi modul (enotni vir resnice), dosegljiv iz editorja, ohranitev dela; izolacija; business integrity (št. vrstic nespremenjeno); 1360/1360; tsc čist; ni dotika zaščitenih datotek.
- **PARTIAL —** REVIEWS: ni lastniške moderacije (ne obstaja rut) → prikazan prazno stanje; galerija nima SiteContent-glave, ureja se prek `?tab=content` (izven lepljenja). Dejanski CREATE/EDIT form-submit iz WYSIWYG ni ponovljen v 2D-10 specu (dokazan z navigacijo + moduli lastni E2E `e2e/b-tire-service.spec.ts`).
- **FAIL —** nič.
- **NOT VERIFIED —** dejansko neposredno vnašanje nove storitve/izdelka s tipkovnico v WYSIWYG oknu (zamenjava: modul, ohranjena enotni vir); mobilna URL-dostop (390 editorji polja ostajajo; moduli neodvisno od editorja).
- **BLOCKED —** itest-sklopi z ločenimi per-suite bazami (`markec_fXX_test`) — namerna izolacija, ne regresija.

## F. Spremenjene datoteke (2D-10)
- `src/components/site-editor/site-visual-editor.tsx` — gumbi »Upravljaj X« (Link na obstojče module) + `Link`/`SettingsIcon` import.
- `e2e/2d10-manage.spec.ts` — nova E2E (3 org nav + izolacija).
- `playwright.2d8.config.ts` — testMatch (2d8|2d9|2d10).

## Končni sklep
**Faza 2D-10 PASS (ob trdih mejah: reviews/galerija brez lastniškega modula, ki bi še obstajal).** Podjetnik **iz enega vizualnega urejevalnika** doseže upravljanje vse poslovne vsebine (storitve, izdelki, ekipa) prek obstoječih modulov — **brez dupliciranih katalogov, brez novih virov resnice, brez vpliva na zaloge/serije/naročila/račune in druge org** (št. vrstic nespremenjeno). WYSIWYG je enotno upravno mesto za dostop do urejanja; poslovna operacija se izvede v obstoječem modulu (katere zmogljivost dodatno dokazujejo njihovi lastni E2E). Reviewer potrdil korektnost in nizek risk; označil pokritost navezanosti (nav) kot močno, CREATE/EDIT-submit pa kot predmet obstoječih modulnih E2E.