# MARKEC – SKLADNOST S SMERNICAMI 2026–2027 · Primerjalna analiza

> **Datum:** analiza kodebeze (brez spreminjanja kode) proti smernicam 2026/2027.
> **Metoda:** pregled dejanske implementacije v `src/` + `prisma/schema.prisma` + obstoječih
> dokumentov (`MARKEC-ARCHITECTURE.md`, `MARKEC-NACRT.md`, `UX-AUDIT-2026-11.md`,
> `KONKURENCA-ANALIZA-2026-11.md`, `P1-TASKS.md`). Nič ni bilo popravljeno.
> **Legenda:** ✅ implementirano · 🟡 delno implementirano · ❌ manjka · ➖ ni relevantno

---

## 1. Spletna stran – standard 2026/2027

| Smernica | Stanje | Dokaz / opomba |
|---|---|---|
| Prilagodljiva stran (PC / tablic / telefon) | ✅ | UX-AUDIT: preverjeno @1440 in @390 brez horizontalnega preliva; hamburger navigacija, polnoširinski CTA |
| Jasna navigacija / hitro dostopne glavne funkcije | ✅ | `(public)/layout.tsx` + `public-navbar`; pogojev CTA po dejavnosti |
| Urejanje besedil, fotografij, barv, vsebine | ✅ | `site-content` actions (9 f.), `branding-editor`, palete 8× kontrastno popravljene |
| Jasni kontakt, lokacija, delovni čas | ✅ | `content.openingHours`, JSON-LD, kontakt sekcija na strani |
| Hitro nalaganje | 🟡 | P1 #10: font preload optimizacija (≤6, 562 KB→manj); Core Web Vitals vrednosti NI izmerjenih na produkciji |
| SEO naslovi, opisi, URL-ji | ✅ | `tenantTitle/Description`, samo-referencirajoč canonical (#26), `noIndex` |
| Strukturirani podatki | 🟡 | LocalBusiness ✅ / Product ✅ / BreadcrumbList ❌ / ProductGroup ❌ (pod 5.) |
| Dostopnost WCAG 2.2 AA | 🟡 | kontrasta zaščita v CI + axe rescan ✅; obseg ni poln WCAG 2.2 (pod 4.) |

**Ciljne vrednosti CWV:** dokumentirane kot cilj, vendar na repozitoriju ni izmerjenih
LCP/INP/CLS meritev (živa produkcijska meritev). Stanje: pravila za izvedbo upoštevana,
meritev manjka.

---

## 2. Rezervacije – sodoben sistem naročanja

| Smernica | Stanje | Dokaz / opomba |
|---|---|---|
| Storitve (ime, opis, cena, trajanje) | ✅ | `Service`, `ServiceAddon` (#92), deposit rule per service |
| Izbira zaposlenega | ✅ | `StaffService`, staff-step v čarovniku, več zaposlenih |
| Koledar (dnevni/tedenski/mesečni) | ✅ | `appointment` admin poti + `WorkingHours` (urnik), e2e |
| Samodejni prikaz prostih terminov | ✅ | `booking-calendar`, `resources.ts`, termin izračun |
| Delovni čas, odmori, prazniki, dopusti | 🟡 | `WorkingHours` per staff ✅; **odmori/prazniki/dopusti kot ločena podpora ❌** (ni modela `Holiday`/`TimeOff` ali `Break`) |
| Takojšnja potrditev ali odobritev | ✅ | `AppointmentStatus` PENDING/CONFIRMED; konfiguracija |
| Odpoved in sprememba termina | ✅ | `reschedule-dialog`, e-poštne predloge odpoved/reschedule |
| Obvestila e-pošta / SMS | 🟡 | e-pošta ✅ (opomniki, confirm, cancel, no-show #95); **SMS ❌** (ni kanala) |
| Plačila (predplačilo / ara / na lokaciji) | ✅ | `deposit.ts` INHERIT/NONE/FIXED/PERCENT + Stripe; card-on-file ❌ (#97) |
| Upravljanje (statusi, zgodovina, poročila) | ✅ | statusi, zgodovina, analytics |
| **Termin takoj nedostopen drugim** | ✅ | **PostgreSQL advisory-transaction lock** (`locking.ts`) — prepreči dvojno rezervacijo |
| Upoštevanje trajanja in časa med storitvami | ✅ | `booking-time`, interval logika |
| Omejitev dni vnaprej | ✅ | `lockDays`/config |
| Pregled datuma, ure, storitve, končne cene pred potrditvijo | ✅ | `booking-summary-card` + addons avto izračun |
| Rezervacija brez računa | ✅ | guest polja `guestName/guestEmail/guestPhone` na Appointment |
| Rezervacija konkretnega zaposlenega | ✅ | staff-step |

---

## 3. Spletna trgovina – standard 2026/2027

### Katalog
| Smernica | Stanje | Opomba |
|---|---|---|
| Kategorije in podkategorije | ✅ | `Category` per org |
| Fotografije, galerije, videi | ✅ | `images[]`, galerija izdelkov, thumbnail |
| Različice (velikost, barva) | ✅ | `ProductVariant` model, `product-variants-card` |
| Cene, popusti, zaloga | 🟡 | cene/compareAt ✅, zaloga ✅, **kuponi/popust kodi ❌** (ni customer-facing kuponov) |
| Iskanje, filtri, razvrščanje | 🟡 | iskanje po API filtri ✅; **javni katalog ima le iskanje, brez filtra po kategoriji/razvrščanja** (`shop/page.tsx`) |

### Nakup
| Smernica | Stanje | Opomba |
|---|---|---|
| Košarica ohrani izdelke | ✅ | Zustand cart + cart menu, per-org scope |
| Nakup brez registracije | ✅ | guest checkout (P2 #70, `guest-identity.ts`) |
| Večstopenjski / enostranski zaključek | ✅ | **Stripe-hosted Checkout** (redirect) — kratek, brez odvečnih korakov |
| Dostava, prevzem, načini plačila | 🟡 | dostava (flat 5,99 € / brezplačno ≥50 €) ✅, prevzem ✅ (txt), **plačila so samo Stripe (brez gotovine ob prevzemu / na lokaciji kot izbirna možnost ni izpostavljeno)** |
| Jasni stroški dostave in končna cena | ✅ | `cart-content.tsx` prikaže Dostava + skupaj pred potrditvijo |
| Pregled naročila pred potrditvijo | ✅ | summary v Stripe Checkout |
| Potrditev naročila + e-pošta | ✅ | order + email |
| Poročilo Baymard (kratki koraki, končna cena prezgodaj) | ✅ | model ustreza: 2-pogledni Stripe checkout, cena + dostava jasni |

### Upravljanje
| Smernica | Stanje | Opomba |
|---|---|---|
| Naročila in statusi | ✅ | `OrderStatus`, admin orders |
| Zaloga | ✅ | inventory gibi, prevzemi, inventura, low-stock |
| Vračila in reklamacije | 🟡 | `OrderStatus REFUNDED` ✅; **ločen postopek vračila/reklamacije ❌** |
| **Kuponi in popusti** | ❌ | samo 20% employeeski popust (hard-coded) + paketi; **ni sistema kuponov/promokod** |
| Poročila o prodaji | ✅ | analytics (revenue, top products) |
| Upravljanje dostave in plačil | 🟡 | dostava konfigurirana v kodi (flat) — **ni admin konfiguracije prevoznikov/pavšalov**; plačila Stripe ✅ |

---

## 4. WCAG 2.2 AA in evropska dostopnost

| Smernica | Stanje | Dokaz / opomba |
|---|---|---|
| Uporaba s tipkovnico | ✅ | Radix primitives |
| Dovolj velik in razmaknjen gumb | 🟡 | večinoma; ni sistematičnega 44×44 px pregleda |
| Vidni fokus | ✅ | Radix + fokus slogi |
| Pravilni kontrasti | ✅ | **CI kontrastna zaščita** (`tests/contrast-wcag-94.test.ts`), WCAG 2.x helpers v `verticals.ts`, 8 palet popravljenih (#7) |
| Dostopni obrazci | ✅ | RHF + Zod, označena polja |
| Podpora bralnikom zaslona | 🟡 | axe rescan v CI ✅; pogoste sekcije pregledane, ni celotnega imenika |
| **Alternativa drag & drop** | ❌ | ni pregledano/dokumentirano; obrazci sami so klasični (non-drag), a ni politike |
| **EAA / WCAG 2.2 ocena celotne platforme** | ❌ | prioriteta AA ni uradno ocenjena; ni izjave o dostopnosti; ni 2.2 specifičnih kontrol (npr. 2.4.11 Focus Not Obscured, 3.2.6 Consistent Help) |

**EAA izjema za mikro podjetja** — v smernicah pravilno opozorjena; skladnost z EAA se
preverja **per podjetje**, ne na platformi kolektivno. MARKEC da skupno izhodišče, končna
odgovornost je najemnikova.

---

## 5. Google SEO, strukturirani podatki in Core Web Vitals

| Smernica | Stanje | Dokaz |
|---|---|---|
| LocalBusiness JSON-LD | ✅ | `buildTenantJsonLd`, tip po vertikali (`schemaTypeForVertical`), opening hours, sameAs, resna ocena |
| Product JSON-LD | ✅ | `buildProductJsonLd` na strani izdelka, Offer/price/availability/SKU |
| **ProductGroup (različice)** | ❌ | `ProductVariant` obstaja v podatkih, a **ni ProductGroup structured data**; niti `offers` za variante |
| **Review / AggregateRating** | ✅ | `aggregateRatingForTenant` iz resnih aktivnih vrstic, nikoli izmišljeno (#75) |
| **BreadcrumbList JSON-LD** | ❌ | breadcrumb je samo UI (`breadcrumbs.tsx`), **ni JSON-LD bločne strukture** |
| SEO meta / canonical | ✅ | samo-referencirajoč canonical (#26), OG/Twitter, `noIndex` za košarico/checkout/prijavo |
| Sitemap XML | ✅ | per-tenant `sitemap.xml`, `revalidate 900`, samo objavljeni ne-demo, module-gated URL-ji |
| Pravilno indeksiranje | ✅ | publish gate, draft → 404/noindex, internal demo izključen (#28) |
| robots.txt | ✅ | `/dashboard`, `/api/`, `/my-appointments`, `/settings` disallow |
| **Merchant Center povezava / product feed** | ❌ | ni izvoza/fida za Google Merchant Center |
| Organisation/Logo | 🟡 | LocalBusiness je obenem org; **Organization + Logo structured data nista eksplicitna bloka** |
| Core Web Vitals (LCP≤2,5 s / INP<200 ms / CLS<0,1) | 🟡 | pravila upoštevana (font, preload, Image priority); **živa meritev CWV ne obstaja**, CLS ni eksplicitno varovan |

---

## 6. Univerzalnost platforme – enotna platforma

| Smernica | Stanje | Dokaz |
|---|---|---|
| Enotna platforma (ne 3 ločeni sistemi) | ✅ | eno jedro, vsi moduli delijo Organization/data |
| Modul se vklopi/izklopi brez posega v druge | 🟡 | `OrganizationModuleState` (ACTIVE/DEACTIVATED) + `modules/catalog.ts` + resolve zadnja beseda ✅; **preostali dve dejanji (HIDDEN/ARHIVIRANO/BRISANJE) in odvisnostna opozorila ❌** (F5) |
| Vsak modul ima svoje nastavitve + skupne podatke | ✅ | capabilities + skupna Organization/core |
| Izbira dejavnosti spremeni vsebino/kategorije/obrazce | ✅ | profili (11), terminologija, ctaMode, materializacija |
| **Izbira dejavnosti ni obvezna** | ❌ | `verticalSkipped`/preskok **ni implementiran** (schema: ni field, ni skips v wizard) — razlika B |
| **Več podjetij pod enim računom** | ❌ | `OrganizationMember`/povabila **ni implementiran**; `User.organizationId` še vedno enojen FK — razlika A |
| Nadgradnja paketa brez izgube podatkov | ✅ | plan upgrade, podatki ostanejo |
| Enotno upravljanje strank/naročil/povpraševanj | ✅ | customers, orders, inquiry/forms |
| Mobilna nadzorna plošča | 🟡 | odzivni web dashboard; **PWA/push ❌** (#99) — lastnikov mobilni kanal ni pokrit |

---

## Seznam dejanskih manjkajočih funkcionalnosti (ni relevantno izpuščeno)

### Vrzeli P1 (največji poslovni / skladnostni vpliv)
1. **Kuponi / promokodi v trgovini** (smernica 3) — ni customer-facing sistema popustov.
2. **SMS kanal obvestil** (smernica 2) — samo e-pošta.
3. **Več podjetij pod enim računom** (smernica 6) — `OrganizationMember`, povabila, izbira aktivnega podjetja. Arhitekturno načrtovano (§8.A), še ne implementirano.
4. **Dejavnost neobvezna / preskok** (smernica 6) — `verticalSkipped`, čarovnik korak preskoka (§8.B).
5. **ProductGroup structured data + Google Merchant Center feed** (smernica 5) — ključno za trgovinsko SEO/Shopping.
6. **BreadcrumbList JSON-LD** (smernica 5).
7. **Sledenje Core Web Vitals na produkciji** (smernica 1) — merljiv cilj brez izmerjenega stanja.

### Vrzeli P2 (pomembne, manj krovne)
8. **Card-on-file + odpovednina** (smernica 2, #97) — no-show zaščita ni dokončana.
9. **PWA + push + lastnikov mobilni kanal** (smernica 6, #99) — samo manifest, ni SW/VAPID.
10. **Funkcionalna odjava od e-pošte + privolitev pri pošiljanju** (smernica 2, #95, P1-B/C) — `promotionalEmails` se ne upošteva pri pošiljanju; odjava ni vezana v vse poti.
11. **Odmori, prazniki, dopusti v urniku** (smernica 2) — ločena podpora ni modelirana.
12. **Katalog filtri/razvrščanje na javnem /shop** (smernica 3) — danes le iskanje.
13. **Admin konfiguracija dostave/pavšalov in gotovina ob prevzemu** (smernica 3) — pavšal je trdo zakodiran, načini plačila omejeni na Stripe.
14. **Vračila/reklamacije kot postopek** (smernica 3) — samo status REFUNDED.

### Vrzeli P3 (obseg WCAG/obrazci + platforma)
15. **Polna WCAG 2.2 AA ocena + izjava o dostopnosti** (smernica 4) — ni uradne ocene; kontrasti/axe ✅, 2.2 specifična pravila ne.
16. **Odvisnostna opozorila med moduli + HIDDEN/ARHIVIRANO/BRISANJE dejanja** (smernica 6, F2/F5).
17. **Eksplicitna Organization/Logo structured data** (smernica 5).

> Ni vrzel (potrjeno prisotno): advisory-lock concurrency, polog/deposit, addons, guest
> booking + guest checkout, darilni boni/paketi, inventura + DDV, delovni nalogi/dinamični
> obrazci, per-tenant Stripe, SL/EN terminologija po panogah, moduleStates katalog.

---

## Razvojni načrt po prioritetah

Vrstni red spoštuje AD-09 (ločeni sklopi, vsak z dokazom) in že potrjene faze iz MARKEC-NACRT.

| Prior | Vsebina | Opomba |
|---|---|---|
| **P1-A** | Kuponi/promokodi (kupon model + košarica + checkout) | neodvisno od drugih; velik trgovinski vpliv |
| **P1-B** | Card-on-file + odpovednina (#97) | dokonča smernico 2 plačila |
| **P1-C** | PWA + push + dnevni digest (#99) | pokrije lastnikov mobilni kanal (smernica 6) |
| **P2-D** | Funkcionalna odjava + privolitev pri pošiljanju (#95, P1-B/P1-C) | skladnost (GDPR/ZEKom-1), ne UX |
| **P2-E** | Več podjetij pod računom (§8.A, M1–M4) + dejavnost preskok (§8.B, M7) | krovne arhitekturne razlike A/B |
| **P2-F** | SMS kanal oz. večkanalno obveščanje | po odločitvi o strošku/povezavi (konkurenca ima) |
| **P2-G** | ProductGroup JSON-LD + Merchant Center product feed (smernica 5) | trgovinsko Google Shopping |
| **P3-H** | Odmori/prazniki/dopusti v urniku; katalog filtri/razvrščanje; admin dostava/načini plačila; vračila/reklamacije | funkcionalne zapolnitve trgovine in rezervacij |
| **P3-I** | BreadcrumbList JSON-LD; Organization/Logo structured data | hitra SEO zmaga |
| **P3-J** | Polna WCAG 2.2 AA ocena + izjava o dostopnosti (če ciljna stranka ni mikro-izjema) | smernica 4 |
| **P4-K** | Sledenje Core Web Vitals na produkciji | stalna meritev LCP/INP/CLS |

---

## Sklep

MARKEC je po dejanski implementaciji **že zelo blizu** standardom 2026/2027, predvsem na
denarnem sloju in univerzalnosti (per-tenant Stripe, pologi, depoziti, addons, delovni
nalogi, 11 dejavnosti, resne ocene v JSON-LD, advisory-lock rezervacije). Največje **dejanske**
vrzeli so: **kuponi**, **card-on-file**, **PWA/push**, **odjava/privolitev**, arhitekturni
**A/B razliki** (več podjetij, preskok dejavnosti), **ProductGroup/Merchant Center SEO** ter
**celovita WCAG 2.2 AA ocena**. Ni treba redizajna — potrebne so ciljane nadgradnje po načrtu zgoraj.