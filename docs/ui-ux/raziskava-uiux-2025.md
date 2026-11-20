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

- Preskusiti autofill celotne forme (Zemljak Test → NN/g predlaga testiranje
  shema). 
- A/B: krajša oblika (dodatni podatki na "povleci" pozneje) — hkrati paziti,
  da polog 3.3.4 ostaja.
- Navodilo datum/čas: parse potrebra bodočnosti (NN/g "do not ask for info
  that can be inferred").

## Zaključek

Raziskava je potrdila, da je jedro booking-flowa že na visoki ravni
(vedno-vidni labelem, pravllen type/autoComplete, stepper z relativnim
položajem, WCAG U10). Največja oprijemljiva praznina je bila **razlaga
formata telefonske številke pred vnosom** — implementirano ✅. Preostale
(vida roadmap zgoraj) so usmerjeni v merjenje/A-B, niso nujno vizualne.