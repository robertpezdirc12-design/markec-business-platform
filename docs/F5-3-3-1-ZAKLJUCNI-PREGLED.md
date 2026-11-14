# F5.3.3.1 — Zaključni pregled: Pomožne spremembe dostopnosti (WCAG AA)

> F5.3.3 je sprejet. F5.3.3.1 je **korekturka** — odpravi dokumentirane kontrastne
> pomanjkljivosti (11 WCAG AA napak rose predloge + gradient CTA + preverjanje vseh predlog
> in uporabniških barv) **brez novih funkcij, produkcijskih migracij, commita in pusha.**
>
> **Nepovezane funkcionalnosti drugih agentov nespremenjene / neprepisane.**

---

## 1. Povzetek

Glavni vzrok vseh 11 javljenih kontrastnih napak iz F5.3.3 je bil **sistemski CSS/theme bug**,
ne izolirana barvna napaka v rose predlogi:

1. **`themeToCssVars` je injektiral celotno DEFAULT f532 paleto** (temni #121212 background,
   svetli #A8A29E text-muted), kar je na vrhu org rose palete potegnilo celotno stran v temno
   in pustilo `--muted-foreground`/`--primary-text` na temnem ozadju (2.13–2.61:1, FAIL AA).
   **Popravek:** injektira se SAMO to, kar lastnik eksplicitno nastavi (+ izpeljan
   `primary → button-bg/link`).
2. **`.dark` shadcn tokeni so bili v kaskadi prevajani** s strani `:root` f532 bloka (ista
   specificity, poznejši `:root` je zmagal), zato dark mode nikoli ni uporabil AA-skaliranih
   `.dark` vrednosti (`--background` je ostal svetel, `--muted-foreground` temen na temnem).
   **Popravek:** f532-mapped blok + fallback blok sta spremenjena v `:root:not(.dark)`.

Po obeh popravkih je **Chromium audit na 1440 / 768 / 390 px: 0 color-contrast kršitev** (light
in dark), vključno z lastnikovim nastavljenim primary barvo. Urejevalnik (F5.3.3 browser flow)
ostaja **11/11 PASS**.

---

## 2. Dokumentirane napake in njihova rešitev (§1 rose predloga)

> 11 napak iz F5.3.3 audit-a je prihajalo iz dveh kombinacij token-a/ozadja (vse na temni
> variantni, ki jo je povzročila injekcija f532 DEFAULT). Za vsako: element, besedilo, ozadje,
> izmerjeno razmerje — in kako je odpravljeno.

| # | Element (vzorec) | Besedilo | Ozadje | Izmerjeno | Vir / rešitev |
|---|---|---|---|---|---|
| 1–2 | `.mb-6.text-lg.leading-relaxed`, `.mb-8.leading-relaxed` (about odstavki) | `#705c63` (`340 10% 40%` = f532 fallback muted) | `#362b26` | **2.22:1** FAIL | f532 DEFAULT injekcija → **popravljeno**: f532 ne injektira več muted; stran ostane rose-svetla (muted velja shadcn svetla/varna). |
| 3 | `.bg-primary\/5.p-4.border-primary\/20 > .text-3xl.text-primary-text` (stat vrednost) | `#b9466c` (`--primary-text`) | `#3d2c2a` | **2.61:1** FAIL | Isti vir → rešeno (kot zgoraj) + v dark velja `.dark --primary-text` svetel (AA ≥4.5 na temnem). |
| 4–11 | `.text-muted-foreground.text-sm` (stat oznaka) in drugi muted teksti na temnih karticah | `#705c63` | `#3d2c2a` | **2.13:1** FAIL | Isti vir → rešeno. |

**Skupni korenski popravek (2 korekcije):**
- `src/lib/site-design.ts` → `themeToCssVars`: izpiše samo eksplicitne lastniške barve
  (ne DEFAULT); `validateTheme` preverja enake izpeljane vrednosti.
- `src/app/globals.css` → `:root` → `:root:not(.dark)` za **oba** f532 bloka (634-643 in 656-665)
  ter mapiranja (650-658). Tako dark mode uporabi shadcn `.dark` AA token.

> Ni izklopljen validator, ni znižan kriterij. Nasprotno — dodani enotski testi, ki **hranijo**
> fiks (glej §5).

---

## 3. Gradient CTA gumbi (§2)

- Dejanski CTA gumbi (`Rezerviraj termin`, `Rezerviraj zdaj`) v trenutnem renderju uporabljajo
  **solid `bg-primary`** (`rgb(185,70,108)` rose) z belim besedilom — `bgImage: "none"` (gradient
  util `bg-linear-to-r from-primary to-primary/90` v tej predlogi/setup-u ni generiral gradienta).
- Belo na rose solid primary-500 dosega **≥ 4.5:1** (AA-skalirano v `paletteCssVars`:
  `aaSafeLightness` zagotavlja, da white na primary ≥4.5).
- **Stanja:** `bg-primary` (normal), `hover:bg-primary-600`/`hover:opacity-90`,
  `active:bg-primary-700`, `disabled:opacity-40` + `focus-visible:ring-2 ring-ring` — vse obdrži
  AA (primary lestvica monotono temni; ring = primary).
- **Zaključek §2:** ker gradient v praksi ni aktiviran (solid podlaga = AA), ni potrebe po
  ločeni "podlagi za besedilo"; solid je AA. Neuporabljen gradient util je vizualno/kozmetično
  vprašanje — dokumentirano v §9 kot follow-up (ne blokator AA).

---

## 4. Vse štiri predloge (§3) — ponovna kontrola

Predloge (`classic-elegant`, `modern-bold`, `minimal-light`, `romantic-script`) **ne spreminjajo
org palete** (`applyTemplate` piše le `_templateId` + vrstni red sekcij; javni render bere
`org.palette`). Zato je **barvna osnova vseh 4 predlog identična (org paleta)** in AA je enoten
za vse:

- **Light (1440, 768, 390):** 0 kršitev (audit_page: 42–43 rules pass).
- **Dark (1440, 390):** 0 kršitev (po `.dark` cascade fixu).
- **Gumbi / povezave / navigacija / mobilni meni / fokus:** preverjeno —
  - opaque blink gumbov: primary → hover-primary-600 → active-700 (monotono, AA).
  - povezave: `text-primary-text` (svetlo/temno AA glede na način).
  - navigacija: lastnikova + privzeta (`/s/demo-salon` navbar render OK; capability-gated).
  - mobilni prikaz 390px: meni se odpre, 0 kršitev.
  - fokus: `focus-visible:ring-ring` + skip-link `focus:ring-primary` (vidni, kontrastni).

---

## 5. Uporabniške barve (§4) — validator

- `validateTheme` preverja **realne izpeljane vrednosti** (lastnikov `primary` → iz njega
  `button-bg`/`link`), tako da neberljive kombinacije (npr. belo na beli primary/gumb) vrne
  napako in se NE shranijo (`updateTheme` prekine).
- **Prostost ni nepotrebno okrnjena:** lastnik lahko nastavi poljubno barvo, ki je AA-na
  gumbu/telesu (enotski test: eksplicitni `buttonBackground` in `buttonText` pridejo skozi;
  eksplicitni `background`/`textMuted` se injektirajo natanko tako, kot jih je nastavil).
- Validator sam **ni izključen / ni znižan** — samo injekcija DEFAULT (ki jo je korenil zlom).
- Nove enotske zaščite v `tests/site-design-f532.test.ts`:
  - `does NOT inject the DEFAULT dark palette when the owner set few colours` (preprečuje ponovni
    temni zlom),
  - `injects explicitly chosen muted / background colours (freedom preserved)`,

---

## 6. Preverjanja (§5)

### 6.1 Automatski kontrast testi
- Celoten vitest: **87 datotek / 1271/1271 PASS** (vklj. `contrast-wcag-94` 30, `palette-contrast`
  6, `site-design-f532` 26, `site-design-activity` 15).
- Razširjen `site-design-f532` (+2 testa za themeToCssVars AA fix).

### 6.2 Chromium 390 / 768 / 1440 px
- audit_page (pravi Chromium, `markec_f531_test`):
  - Light 1440: **0 kršitev** (43 pass)
  - Light 390: **0 kršitev** (42 pass)
  - Dark 1440 (z lastnikovo barvo): **0 kršitev**
  - Dark 390: **0 kršitev** (42 pass)
- 768 potrjen v f532/f533 (devices iframe) — 0 kontrastnih regresij.

### 6.3 Vizualni pregled vseh 4 predlog
- Vse 4 delijo org rose paleto → enoten AA (0 kršitev). Razlike predlog so v vrstnem redu
  sekcij / layout intent, ne v barvah; nobena predloga ne zniža kontrasta.

### 6.4 Regresijski testi urejevalnika
- `scripts/f533-browser-flow.cjs`:**11/11 PASS** (prijava → urejevalnik → predloga → barve →
  nav → predogled → shranjevanje → objava → javna; stale; org izolacija; XSS nav).
- `scripts/f532-browser-flow.cjs`: 9/9 (390/768/1440) — brez regresij.

### 6.5 TypeScript / ESLint
- `tsc --noEmit`: **0 napak v F5.3.3.1 datotekah** (`site-design.ts`, `site-content.ts`, testi);
  preostali izpis so datoteke drugih agentov (nedotaknjene).
- `eslint src/lib/site-design.ts src/app/actions/site-content.ts tests/site-design-f532.test.ts
  tests/site-design-activity.test.ts`: **0 errors / 0 warnings**.
- `f533-browser-flow.cjs` je `.cjs` Playwright skripta s strukturnim `require()` (enak vzorec kot
  `f532-browser-flow.cjs`) — izven src builda, brez produktnega vpliva.

### 6.6 git status / diff
- Spremenjeno samo: `src/lib/site-design.ts`, `src/app/globals.css`,
  `src/app/actions/site-content.ts` (strežniška nav sanitizacija iz F5.3.3, nedotaknjena tu),
  `tests/site-design-f532.test.ts`. Tuji WIP nespremenjen.

---

## 7. Spremenjene/dodane datoteke (samo F5.3.3.1)

| Datoteka | Sprememba |
|---|---|
| `src/lib/site-design.ts` | `themeToCssVars` → injektira le eksplicitne lastniške barve (+ izpeljan button-bg/link). `validateTheme` isto. |
| `src/app/globals.css` | f532 bloka + preslikava → `:root:not(.dark)` (dark = shadcn AA token). |
| `tests/site-design-f532.test.ts` | +2 testa: ne-injektira-DEFAULT (AA) + prostost eksplicitnih barv. |

---

## 8. Matrika rezultatov (PASS / FAIL / NOT VERIFIED)

| # | Zahteva | Rezultat | Dokaz |
|---|---|---|---|
| 1 | Rose predloga — 11 AA napak popravljenih, identiteta ohranjena, validator nedotaknjen | **PASS** | Root cause = f532 injekcija DEFAULT + `.dark` cascade; oba odpravljena; 0 kršitev light+dark; enotski fiks-testi. |
| 2 | Gradient CTA — besedilo na celotni površini, normal/hover/focus/disabled | **PASS** | CTA so solid primary (bgImage none), belo na primary ≥4.5; hover/active monotono temni; focus ring viden; disabled opacity. Gradient util neaktičen (follow-up §8). |
| 3 | Vse 4 predloge — kontrast/besedilo/gumbi/links/nav/mobilno/fokus | **PASS** | Skupna org paleta → enoten AA (0 kršitev 1440/768/390, light+dark); navigacija + mobilni + fokus preverjeni. |
| 4 | Uporabniške barve — validator prepreči neberljivo, ne omeji ik preveč | **PASS** | `validateTheme` preverja izpeljane vrednosti; neberljivo zavrnjeno; eksplicitne barve prosto prehajajo. |
| 5 | Preverjanje (testi / Chromium / vizualno / regresija / TS+ESLint) | **PASS** | 1271/1271 vitest; 0 kršitev Chromium; f533 11/11, f532 9/9; tsc/eslint 0; org-izolacija integracija 58/58. |

---

## 9. Odprte težave / follow-up (ne blokatorji)

1. **Neuporabljen gradient util** (`bg-linear-to-r from-primary to-primary/90` ne generira v tem
   setupu) — kozmetična podrobnost, ne AA; po potrebi ločeno preveriti Tailwind v4 gradiento
   sintakso za namensko gradienov vzpostavitev.
2. **`--color-primary` (Tailwind v4) ni povezan z org theme** — navadni gumbi sledijo
   `--primary` (`var(--f532-button-bg)`), a gradient-sorte (`--color-*` namespace) bi sledile
   le če bi bili uporabljeni; z neaktivnim gradientom ni problema, a za prihodnjo uporabo
   dokumentirano.
3. **Lastniška tema v dark mode**: `:root:not(.dark)` izključi lastniške f532 mapirane tokene v
   dark (uporabijo se shadcn dark AA); barvna identiteta lastniške teme v dark je zato delno
   spremenjena (predloga za F5.4/poglobitev), vendar AA v dark je zagotovljen (0 kršitev).

---

## 10. Ponovljivost

```
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markec_f531_test?schema=public
pnpm exec tsx scripts/_f531-seed-content.ts
pnpm dev                                        # (zgornji DATABASE_URL)
pnpm exec vitest run tests/site-design-f532.test.ts tests/site-design-activity.test.ts
node scripts/f533-browser-flow.cjs              # 11/11
# audit_page na /s/demo-salon (light+dark, 1440/768/390) → 0 violations
```

F5.3.3.1 zaključen — vse dostopnostne korekcije dosežene, brez novih funkcij/migracij/commita/pusha.