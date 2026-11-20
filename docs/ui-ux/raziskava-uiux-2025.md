# Raziskava virov — kako izboljšati UX (UI/UX 2025)

Aktualna spletna raziskava (verodostojni viri: NN/g, Baymard, W3C WAI WCAG 2.2)
z namenom najti oprijemljive izboljšave za beauty-salon booking platformo
(Next.js + Tailwind + shadcn). Raziskava je bila **uporabljena**, ne le
zapisana: vsaka smernica je vrstico preslikana na projekt, implementirane
spremembe so označene z ✅.

## Viri (verificirano dosegljivi, HTTP 200)

| Vir | URL | Relevanca |
|-----|-----|-----------|
| NN/g — Web Form Design | https://www.nngroup.com/articles/web-form-design/ | oblike, polja, placeholders, field size |
| NN/g — Heuristike | https://www.nngroup.com/articles/ten-usability-heuristics/ | splošne UI/UX heuristike |
| Baymard — Landing design | https://baymard.com/blog/landing-page-design | konverzija, page layout |
| Baymard — Progress bars | https://baymard.com/blog/uses-of-progress-bars | stepper/progress v večkoraku |
| W3C WAI — WCAG 2.2 | https://www.w3.org/WAI/WCAG22/quickref/ | dostopnost (2.4.7 fokus, 3.3.4 error prevention, 4.1.3 status) |

> Opomba: ni samostojnega "najboljšega UI" — NN/g poudarja, da je UX
> odvisen od user researcha; tukaj so zbrane najbolj uveljavljene, na dokazih
> temelječe heuristike za **obrazce** (jedro naše rezervacije).

## Ključne smernice in njihov status v projektu

### A. NN/g — "Web Form Design" (najbolj relevantno za booking flow)

1. **"Every field you cut increases your conversion rate."** → Minimaliziraj
   polja. ✅ Naša customer-info forma ima samo firstName/lastName/email/phone/
   notes + soglasje — ni odvečnih polj. **Naknadno:** dodajanje novih polj
   (npr. "preferred stylist note") mora iti skozi ta filter.
2. **"Avoid placeholder text."** → vedno-vidne labelem, placeholder le kot
   dodaten nasvet. ✅ Vsa polja imajo trajne `<Label htmlFor>`, placeholder
   je zgolj dodatek. Identifikacija polja NIKOLI ni samo placeholder.
3. **"Match fields to the type and size of input."** → `type`, `inputMode`,
   `autoComplete` po pričakovanem vnosu; čim manj praznine za kratke vnose.
   ✅ email: `type="email" inputMode="email" autoComplete="email"`; telefon:
   `type="tel" inputMode="tel" autoComplete="tel"`.
4. **"Explain input/formatting requirements before entry."** → format vezave
   bodi jasen PRED vnosom, ne šele kot error po napaki.
   ✅ **NOVO (implementirano):** phone format hint "Npr. +386 41 234 567"
   pod telefonskim poljem, povezan z input prek `aria-describedby="phone-hint"`.
5. **"Avoid ambiguous spacing between labels and fields."** → Label ne sme biti
   enako oddaljen od dveh polj. ✅ single-column form + `space-y-2` ločnica.
6. **"Test Tab-order."** → ključ za keyboard uporabnike. ✅ (U10: Tab-nav
   preverjeno; globalni `:focus-visible` + popravljeni iskalni vhodi).
7. **"Test the schema / browser autofill."** → preveri da `autoComplete`
   pravilno napoveduje vsa polja, da autofill deluje.
   ✅ **NOVO (implementirano):** regression `tests/unit/wcag-nng-autofill-schema.test.ts`
   preverja booking (given-name/family-name/email/tel + type/inputMode) in
   login/register sheme (username / name / email / new-password / off).

### B. NN/g — heuristike, uporabne za salon

- **Flexibility and efficiency of use (H7):** shortcuti za izkušene.
  ✅ U8 ⌘K command paleta + "recent" MRU.
- **Status visibility (H1):** uporabnik mora vedeti kje je in kaj se dogaja.
  ✅ BookingStepper karti `aria-current="step"` + zapolnjeni koraki; promo
  status/live region; loading/error states.
- **Error prevention / recovery (H5, H9):** ✅ U10: WCAG 3.3.4 confirm korak
  pred plačljivo rezervacijo + 4.1.3 role="alert" sporočila.

### C. Baymard — progress/checkout

- Progress bar / step indicator: uporabnik vidi **relativni položaj** (korak 2
  od 3), ne le trenutni korak. ✅ BookingStepper: ordinalni krogi 1-2-3 +
  povezave + zaplnil korake; zadnji korak "done".
- Naknadno opazovanje: na koraku "Details" je vedno viden povzetek (summary
  card) — uporabnik ne izgubi konteksta. ✅ (P1 #9).

### D. W3C WAI — WCAG 2.2 (dostopnost; podrobno U10)

- 2.4.7 Focus Visible, 3.3.4 Error Prevention, 4.1.3 Status Messages —
  vse ✅ zaprto v U10 (glej `predlog-i2.md`).

## Učinek raziskave — ostane (roadmap)

- ✅ Autofill shema regression zdaj pokriva **booking, auth (login/register),
  cart guest-checkout** in **javne forme (inquiry + walk-in)**
  (name/email/tel + type/inputMode). Celoten contact-formni del je avditan —
  med avditom dodana manjkajoča `inputMode="tel"/"email"` na inquiry form in
  `type="tel"` na walk-in.
- ✅ **A/B — krajša forma, runtime //xeno + tracking + dashboard** (NN/g
  "vsako polje zniža konverzijo"): varianta ni več build-time, ampak jo določi
  **server ob requestu** (`src/lib/ab/variant.ts` → `getBookingABVariant`).
  `BOOKING_AB_VARIANT=short` skrije ne-obvezno `notes` polje (4 polja); prazno
  → deterministična 50/50 razdelitev po org (prav A/B grupa). Ob nalaganju
  forme `BookingForm` zabeleži **VIEW**, ob oddaji termina **CONVERSION**
  (`src/app/actions/ab-tracking.ts` → tabela `BookingExperimentEvent`);
  dashboard `dashboard/experiments` prikazuje konverzijo po varianti.
  Regresija: `tests/unit/ab-tracking-dashboard.test.ts` + visual-fixes.
- ✅ **Error recovery — fokus na prvo polje z napako ob submitu** (NN/g
  H5/H9, WCAG 3.3.1 + 2.4.3): po neuspelem submitu `focusFirstFormError()`
  premakne fokus + `scrollIntoView` na prvo `[aria-invalid="true"]` polje,
  da uporabnik s tipkovnico/bralnikom takoj ve kje popraviti. Zajeto v
  `tests/unit/booking-error-focus.test.ts`.
- ✅ **Zasedeni termini so AT-dostopni** (NN/g status visibility, WCAG 1.3.1):
  zaseden ura v mreži ni več pravi `disabled` (bralnik jo je povsem izpustil)
  — zdaj `aria-disabled` + `aria-label="Zasedeno: 09:00"` + `title`, onClick
  guard še vedno prepreči izbor. Vizual ostaja bled + prečrtan.
- ✅ **Submit-feedback za bralnike** (NN/g "status visibility", WCAG 4.1.3):
  med asinhrono oddajo forme `<form aria-busy={isPending}>` + stalna sr-only
  `role="status"` regija v summary-card, ki ob submitu napove "Oddajam
  rezervacijo…" (živi region v DOM od začetka, da je registriran). Gumb ima
  spinner + `disabled`. Realtime inline validacija (blur + veljavnost-sproti)
  je bila že izvedena (P1 #9) in ostaja. Zajeto v
  `tests/unit/booking-error-focus.test.ts`.
- ✅ **Performance-as-UX / bundle audit** regresija:
  `tests/unit/performance-bundle-audit.test.ts` — potrdi da težke
  (react-hook-form+zod+date-fns) kot `ReviewForm` na landing ostajajo
  `next/dynamic` (T9) in da največja admin editorja (branding, documents,
  product) niso nikoli uvožena na javni/customer poti (route-level izolacija).
- A/B merjenje je zdaj **vgrajeno**: dashboard prikazuje realne dogodke
  (VIEW/CONVERSION) že od prvega prikaza; lastnik le izbere varianto ali pusti
  uteženo 50/50 razdelitev.

## Zaključek

Raziskava je potrdila, da je jedro booking-flowa že na visoki ravni
(vedno-vidni labelem, pravllen type/autoComplete, stepper z relativnim
položajem, WCAG U10). Največja oprijemljiva praznina je bila **razlaga
formata telefonske številke pred vnosom** — implementirano ✅. Preostale
(vida roadmap zgoraj) so usmerjeni v merjenje/A-B, niso nujno vizualne.