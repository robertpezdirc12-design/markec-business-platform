# UI/UX izboljšave — temeljit predlog (raziskava + priporočila)

> Stanje: predlog, ni še implementirano. Preslikano na dejansko kodo.
> Podlaga: uspešna orodja za booking (Fresha, Booksy, Mindbody), e-commerce
> (Baymard Institute), NN/g (Nielsen Norman Group) in WCAG 2.2. Obstoječi
> design system ("MARKEC DESIGN SYSTEM v2.0") je zrel — predlog gradi *na*
> njem, ne ruši.

---

## 0. Izvedba

| ID | Predlog | Vpliv | Napor | Prior |
|----|---------|-------|-------|-------|
| U1 | **Umakniti demo booking tok (`online-booking-page`)** | Kritičen | S | ★★★★★ | ✅ |
| U2 | **Realna dostopnost terminov namesto fiktivnih slotov** | Kritičen | M | ★★★★★ |  |
| U3 | **Eden vir resnice za booking tok (ne dva vzporedna)** | Visok | M | ★★★★☆ |  |
| U4 | **Povzetek v koraku + lepljiv "naprej" z dostopnostjo** | Visok | S | ★★★★☆ | ✅ |
| U5 | **Vidni indikatorji dostopnosti storitev (hitri filter)** | Visok | S | ★★★★☆ | ✅ |
| U6 | **Feedback pri ponovno-booking (realni appointment)** | Srednji | S | ★★★☆☆ | ✅ |
| U7 | **Admin: števci/badges v navigaciji** | Srednji | S | ★★★☆☆ | ✅ |
| U8 | **Command palette: uvrsti pogoste akcije višje** | Srednji | S | ★★★☆☆ | ✅ |
| U9 | **Varno stanje formularjev (draft, brez izgube ob prekinitvi)** | Srednji | M | ★★★☆☆ |  |
| U10 | **WCAG 2.2: fokus red, error-preventivno, contrast passed** | Visok | M | ★★★★☆ | ➡️ |

**Legenda:** ✅ že implemente-ran v bazi · ➡️ v teku · (prazno) odprto

---

## 0.5 — Status implementacije (posodobivljivo)

- **U1 ✅** — mrtva demo koda izbrisana (`online-booking-page`, `booking-calendar`,
  `booking-calendar-enhanced`), `git rm` commit `17ae156`.
- **U4 ✅** — že v bazi: `BookingSummaryCard` je `sticky top-4` (desktop),
  `booking-form.tsx` ima mobilno `fixed` spodnjo vrstico z running selection
  (liniji ~788–807). Torej ni treba dvojiti.
- **U3 ✅** — z izbrisom demo dvojnikov je `BookingForm` edini resnični tok.
- **U10 ➡️** — dodan WCAG 1.3.1/4.1.2 fiks na plačilno radio grupo v
  `booking-form.tsx` (navadno `<p>` → `<fieldset>` + `<legend>`), da je
  skupla radio-grupa programatično določljiva za brajalnik zaslona.
- **U5 ✅** — `services-list.tsx`: hitri filter + sort (cena/trajanje/rating)
  je že bil v `services-filter.tsx` (P1 #29). Dopolnjen je bil *pravi UX manko*:
  CTA gumb je bil `opacity-0`/hover-only → na mobilnih nerekviden. Gumb je zdaj
  vedno viden (afrdance za tap), z i18n label `common.actions.viewDetails`
  namesto tvrde SL "Podrobnosti". Regresija: `tests/unit/services-list-ux.test.ts`.
- **U7 ✅** — admin navigacija (sidebar) prikazuje operativne števce za
  recepcijo: neprebrani pogovori (chats), čakajoča čakalna lista (waitlist),
  nepotrjene termine (appointments). Server action `getNavCounters` je
  org-scoped (requirePermissionOrg appointments.view); navigacija ne blokira,
  če klic pade. Regresija: `tests/unit/sidebar-nav-counters.test.ts`.
- **U8 ✅** — `command-palette.tsx` pomni nazadnje uporabljene akcije/strani v
  versioned localStorage (`mec:palette-recent:v1`, max 8, pravilo #19) in jih
  ob odprtju palete (prazen query) prikaže kot prvo skupino "Zadnje"; ta id
  so iz poznejših skupin izločeni, da ni dvojnikov. Iskalni zadetki se ne
  pomnijo. i18n ključ `navGroups.recent`. Regresija: `tests/unit/command-palette-mru.test.ts`.
- **U6 ✅** — `getAvailableStaff` za prijavljeno stranko doda `visitCount` na
  vsakega strokovnjaka (štetje njenih veljavnih terminov per staff, `groupBy`,
  izključena `CANCELLED`/`NO_SHOW`); `staff-step.tsx` prikaže badge "Ponovni
  obisk (N× pri Ime)" ko je `visitCount > 0`. Brez prijave se število ne
  izpostavlja; štetje je best-effort (`catch`) — ne sme vreči rezervacije.
  i18n `booking.revisit`/`booking.revisitCount`. Regresija: `tests/unit/revisit-feedback.test.ts`.

---

## 1. KRITIČNO

### U1 — Umakniti demo booking tok (`online-booking-page.tsx`)

**Kaj:** `src/components/booking/online-booking-page.tsx` je **demo/deterterij**
z fiktivnimi podatki:
- `TIME_SLOTS` z `h % 3 !== 0 && h % 5 !== 0` → **lažna dostopnost**;
- 14 dni `addDays(new Date(), i)` → **vedno prosto**, ni realne zasedenosti;
- tvrdo slovenski labelji, ni i18n.

**Resnični in podprti tok:** `BookingForm` (`src/app/(customer)/booking/page.tsx`)
uporablja `booking-stepper.tsx`, `booking-summary-card.tsx`, `waitlist-card.tsx`
(vsi i18n, realni modeli, deposit/payment).

**Mrtva koda (preverjeno z grep — ni nobenega importa):**
- `src/components/booking/online-booking-page.tsx` — fiktivni sloti,
  tvrdi SL, ni i18n;
- `src/components/booking/booking-calendar.tsx`
- `src/components/booking/booking-calendar-enhanced.tsx`

**Zakaj (best practice):** "Fake-open demo" ruši zaupanje — ko se stranka
naroči na termin, ki "na videz obstaja", a se shrani drugje, je izguba over
background. Booking brez realne podlage je najsmrtnejši UX fail. Poleg tega
mrtvi dvojniki = dvojno vzdrževanje in tveganje, da se stari izvedbi slučajno
pokažeta.

### U2 — Realna dostopnost terminov

**Kaj:** da `BookingForm` res vrača dostopnost iz podatkov (obstoječi
appointments) — brez fiktivnih "is available".

**Zakaj:** Booking je transakcija v realnem času. Baymard: "calendar slot,
which is not actually available" = top conversion killer (price/napolnjenost.)

**Kako:** Preveriti da server action `getAvailable...` (že u `appointments.ts`)
uporablja pravo zasedenost (appointments za datum+staff), ne hevristike. Če
je že — samo zapreti demo tok (U1), da se uporabnik ne vodi v anketo. Dodati
**moment rezervacije**: zakleniti slot ob izbiri (optimistic lock), da dva
kupca nezahtevata isti čas.

---

## 2. VISOKO

### U3 — En vir resnice za booking

**Kaj:** dve vzporedni booking UI-vrstici (demo + realna) = dvojno vzdrževanje,
nedoslednosti, stalen strah. 

**Zakaj:** NN/g: redundantna, diverzirajoča navigacija med "top 10 nejasnosti".

**Kako:** Po U1 ostane `BookingForm` + `booking-stepper` (i18n) kot edini. Vse
povezave (hero, navbar CTA, services page) vedno vodijo na eno točko.

### U4 — Povzetek v koraku + lepljiv "Naprej"

**Kaj:** pri 3-5 koračnem booking flow imeti **živi povzetek** (izbrana
storitev/strokovnjak/čas/cena) vedno vidno na desni (desktop) oz. kot
trajna vrstica (mobile), ter **lepljiv primarni gumb** "Naprej" ki ostane
na zaslonu.

**Zakaj:** Baymard: sticky primary CTA + live order summary zmanjšata
"am I missing something" negotovost; pri multi-step booking je ključno da
viewer vidi celoto brez pomikanja.

**Kako:** V `online-booking` / `booking-summary-card.tsx` — izkoristiti
obstoječi `booking-summary-card` in ga narediti sticky (desktop) s
`sticky top-20`, mobile spodaj. Gumb `Naprej` dvigniti v vrstico, ki
follow mini.

### U5 — Vidni indikatorji dostopnosti storitev (hitri filter)

**Kaj:** na `services` seznamu omogočiti hitri filter: "Na voljo zdaj /
Naslednji termin / Cena / Trajanje", s sortiranjem in ikonama (trajanje,
cena, "blizu konca").

**Zakaj:** NN/g: filter + prikaz cene/trajanju neposredno na kartici zmanjša
decisijski napor; brisalno-manobra izogib redundantnemu kliku.

**Kako:** obstoječi service-cards (na `services/page.tsx`) dodati chips-filter
na vrhu + badge za ceno/trajanje na kartici (že morda prisoten v product-card —
uskladiti).

### U10 — WCAG 2.2 hard-pass

**Kaj:** pregledati kontrast, fokus-order, `:focus-visible`, error-prevention
pri submit (potrditev "Ste prepričani?", povlečni undo pri brisanju).

**Zakaj:** NN/g: accessibility = robustness; mandated (EU EAA 2025 za javni
doseg — evropski dostop).

**Kako:** token-based, design systemje že WCAG AA HSL; namenski **audit page**
ki preveri `focus-visible` po vseh interaktivnih elementih (brez modrobega
outline-a) + `autocomplete` na booking form novih polj.

---

## 3. SREDNJE

### U6 — Feedback pri ponovni rezervaciji

**Kaj:** če se prijavljena stranka ponovno naroči pri istem strokovnjaku,
pokazati "Ponovni obisk (3x pri Marku)" + možnost hitre izbire že izbranih
preferenc (ko tudi priljubljeni čas).

**Implementirano ✅ (število obiskov).** `getAvailableStaff`
(`appointments.ts`) za prijavljeno stranko (`auth()` → `Customer.userId`)
prešteje njene veljavne termine per staff (`prisma.appointment.groupBy`,
izključena `CANCELLED`/`NO_SHOW`) in nastavi `AvailableStaffMember.visitCount`.
`StaffStep` to izkoristi kot volnen badge **"Ponovni obisk · 3× pri Marku"**
kot značko na izboru specialista. Brez prijave (ali neobstoječi Customer)
je `visitCount` izpuščen — javno okolje ne razkriva številk. Štetje je
best-effort: morebitna napaka se ujame, rezervacija nikoli ne pade.
i18n: `booking.revisit`/`booking.revisitCount`. Regresija:
`tests/unit/revisit-feedback.test.ts` (5 testov). 

### U7 — Admin: števci/badges v navigaciji

**Kaj:** v sidebar (že zlagano, gated) prikažiti **števnike** (npr.
"Čakalnica: 4", "Nepotrjeni naročila: 2") prek `reception-inbox-client`
podatkov; vezano na command paletto.

**Zakaj:** NN/g: prioritizacija po aktualnosti; admin dashboardsberiaja
"at-a-glance operational".

### U8 — Command palette prioriteta pogostih

**Kaj (original):** `command-palette.tsx` naj trend-driven ali static prikaže
najpogosteje uporabljene module višje (MRU od Recent).

**Implementirano ✅** — MRU (most-recently-used) pomnilnik. Ko recepcionist
odpre paleto brez vprašanja, se pogosto uporabljene akcije/strani pokažejo v
novi, prvi skupini **"Zadnje"** (i18n `navGroups.recent`). Vnos se zapiše ob
izvedbi (`run` → `remember`) v versioned localStorage key `mec:palette-recent:v1`
(max 8 id-jev, dedup, pravilo #19); iskalni zadetki se ne pomnijo. Id-i v
"Zadnje" so izključeni iz "Quick actions"/"Go to", da ni dvojnega prikaza.
PaletteEntry dobi `kind: "recent"`, `groups` prepozna ključ `recent` in ga
renderira prvega. Regresija: `tests/unit/command-palette-mru.test.ts` (5 testov).

### U9 — Varno stanje formularjev (draft)

**Kaj:** pri dolgih admin obrazcih (npr. new appointment, invoicer, product)
— auto-draft v localStorage/sessionStorage z "Povrni" ipd., da se ob
prekinitvi temnega kadra izguba podatkov prepreči. Vključiti v redesign-existing-projects.

---

## 4. Kaj NE

- **Ne** preoblikovati barvnega sistema (rose/gold je zrel, WCAG AA).
- **Ne** dodajati animacij samo zaradi efekta (respect prefers-reduced-motion).
- **Ne** uvajati novega UI knjižničnega sloja — uporabiti obstoječi shadcn/ui.
- **Ne** obravnavati tega kot zapisnik new design — to je evolucija obstoječega.

---

## 5. Viri (kontekst / best practice)

- NN/g — Nielsen Norman Group: "The 10 Usability Heuristics", form errors (2020).
- Baymard Institute — e-commerce UX barvani za check-out/booking.
- Fresha / Booksy — SaaS booking tokovi kot industrijski referencni.
- WCAG 2.2 — AA kontrast, focus-visible, error-prevention (§3.3).