# MARKEC — 2D-11 — Celovit uporabniški tok: WYSIWYG → poslovna vsebina → javna stran

Datum: izolirana baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: dokaži CELOTEN krog (ne le navigacije): WYSIWYG → modul → dejanska CREATE poslovne vsebine → povratek v urejevalnik → javna stran prikaže shranjeno.

## A. Agenti (dejansko uporabljeni)
Read-only podagenti **A**, **B**, **D** (delegate_task) + **E** (neodvisni reviewer). **Agent C je dosegel 50-step limit → ni oddal poročila** (to izrecno navajam; C nisem simuliral). Varnost/integrity je pokril koordinator + agenti A/B/D + moje DB-verifikacije.

| Agent | Prispevek |
|---|---|
| **A — return context** | Preveril 2D-10 gumba, predlagal VAREN statični "Nazaj na urejevalnik" href→`/dashboard/settings?tab=branding` (brez krhkega globalnega stanja / URL parametrov); exact insertion points. |
| **B — CRUD flows** | Mapiral realne create/edit tokove (services: #name/#duration/#price/#slug, submit; products: whitelist strip stock; staff: zahteva email → auto-create/reuse User; gallery: ?tab=content). Rollback: fresh service brez appt → varno brisan. |
| **C — tenant security** | **NI zaključil (step-limit)** — koordinator + A/B/D + DB checks pokrili (org-scoping, page guards, stock read-only). |
| **D — UX/mobile** | 390 OK; return-link v headerju; prazna stanja + toasti; napovedal, da editor iframe default 1440 (UX note). |
| **E — reviewer** | Potrdil: return-links PASS, T1 je pravi browser (ne API), public-poll smiseln (unikaten name, tenant-scoped), return statičen (ne-fragile), guards ohranjena, ni protected sprememb. |

## B. Implementacija
- **`src/app/(admin)/dashboard/services/page.tsx`**, **`products/page.tsx`**, **`staff/page.tsx`**: dodan `Urejevalnik` povratni `<Link href="/dashboard/settings?tab=branding">` v header vsakega modulnega seznema (varni povratni kontekst; editor že deep-linka na ta tab; osnutek je server-shranjen → brez izgube).
- **`e2e/2d11-roundtrip.spec.ts`** — nova E2E (T1). **Nepotrebni refactoring ni bil — le čisti gateway**.
- Uporabljeni fallback: **rollback testne storitve prek varnega DB-brisanja** (fresh, org-scoped, 0 appointment links) + ponovna public preverba — ker in-UI `window.confirm` delete v dev-harnessu visi; dokumentirano v spec. Nisem izmišljal rezultatov.

## C. Rezultati E2E — T1 (vulkanizer, realen Playwright)
**`[T1] create+return: PASS` + `[T1] javna prikaže novo storitev: PASS` (29–33 s)**
1. prijava → WYSIWYG (`?tab=branding`) → sekcija **Storitve** (klik) → **"Upravljaj storitve"** → `/dashboard/services`.
2. `/services/new` → realen form (`#name="2D11 vulkanizer {RUN}"`, `#duration=30`, `#price=45`) → **`POST /dashboard/services/new 200`** (server log) → vrnjeno na seznam.
3. Povratek: **"Urejevalnik"** link → `/dashboard/settings?tab=branding` (WYSIWYG spet).
4. Javna `/s/svezi-vulkanizer-2d1s/services` (ločena anonimna context) → **poll potrdi prisotnost nove storitve** (server RSC, tenant-scoped).
- **Rollback**: testna storitev izbrisana varno (DB, apptLinks=0) → public `/services` spet 6 original. **Poslovna integriteta ohranjena** (vulkanizer nazaj 6 storitev, ni zadetih appt/naročil).

## D. Tri organizacije / izolacija
- **Vulkanizer**: T1 dtali. **Cebelar (Izdelki→/dashboard/products)** in **Šivilja (Storitve→/dashboard/services)**: dostop do modula + javna dosegljivost potrjeni (2D-10 E2E, ta se nadgrajuje). Izolacija: spremembe ene org nikoli ne vplivajo na drugo (DB counts še vedno 6/6/7 itd. glede na org).
- **Mobilni 390**: return-link je text-button v headerju (stacked), editor gumbi full-width; moduli stacked — dosegljivo (Agent D potrdil; ni posnetkov za to fazo).

## E. Status
- **PASS —** CELOTEN krog v realnem brskalniku: WYSIWYG → CREATE storitve → povratek v editor → javna prikaže. Return-link na 3 modulih. Business integrity (nova vrstica, safe rollback). Izolacija. tsc čist (edina napaka je predhodni tuj `scripts/f631-inspect.ts:40` TS1109); unit 1360/1360.
- **PARTIAL —** CREATE E2E izvedena samo za **vulkanizer/services** (glavni tok). Za čebelarja (products) in šiviljo (services) je dokazan dostop + javna dosegljivost, a ne ponovljen full CREATE-form v tej fazi (istokrat, druga org — glej 2D-10). In-UI DELETE (window.confirm) ni bil browser-verificiran — rollback prek varnega DB-brisanja (dokumentirano).
- **FAIL —** (vulkanizer create/return/public je PASS; nič FAIL v glavnem toku).
- **NOT VERIFIED —** dejanska posodobitev obstoječe poslovne vrstice (price) v UI v tej fazi (izpostavljeno kot kandidat; services update je pokrit v modulnih E2E `b-tire-service.spec.ts`); mobile-specifični screenshot ikon 2D-11; gallery/reviews CREATE iz editorja (modul prek ?tab=content / reviews ni lastniške moderacije).
- **BLOCKED —** itest-sklopi s per-suite bazami (`markec_fXX_test`); in-UI window.confirm delete v dev-harnessu (zahteva višji timeout/native-dialog handling; uporabljen DB-rollback).

## F. Spremenjene datoteke (2D-11)
- `src/app/(admin)/dashboard/services/page.tsx` — return link + ArrowLeftIcon import.
- `src/app/(admin)/dashboard/products/page.tsx` — return link + ArrowLeftIcon import.
- `src/app/(admin)/dashboard/staff/page.tsx` — return link + ArrowLeftIcon import.
- `e2e/2d11-roundtrip.spec.ts` — nova E2E (T1). (+ `playwright.2d8.config.ts` testMatch 2d11.)
- Ni dotika `einvoices`/`product-checkout`/`schema.prisma`/Stripe/webhook.

## G. Dokaz i poslovna integriteta
- Nova storitev = **nova org-scoped vrstica** (0 appt linkov); preverjeno v DB; po rollbacku vulkanizer 6/2/1/0 (nespremenjeno). Niti zaloge/serije/naročila ∠ prisotni. tsc: samo predhodni f631. Unit: 1360/1360.

## Končni sklep
**Faza 2D-11 PASS (ob dokumentiranih mejah).** V realnem brskalniku je celoten tok dokazan: podjetnik iz WYSIWYG sekcije Storitve → **dejansko ustvari novo storitev v obstoječem modulu** (form submit, `POST /services/new 200`) → **se vrne v urejevalnik** prek varnega povratnega linka → **javna /services stran prikaže novo storitev**. Business modulo uleni vir resnice; rollback izveden varno + dokumentirano. Agent E potrdil korektnost in odsotnost krhkega stanja. Ni naznano kompletno za cebelar/sivilja CREATE-form in services-update UI v tej fazi (pokrita v modulnih E2E).