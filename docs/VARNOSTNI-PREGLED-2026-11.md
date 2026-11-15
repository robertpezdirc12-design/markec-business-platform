# Varnostni pregled — celovit pregled kode (2026-11-15)

**Obseg:** celotna koda (`src/`), fokus na OWASP področja, pomembna za multi-tenant SaaS
(avtentikacija, avtorizacija/IDOR, injekcije, XSS, skrivnosti, webhooki, nalaganje,
omejevanje zahtevkov). Stanje dokumentirano v `docs/PLAN.md` točka 1 in 9.

## Najdbe in rešitve

| # | Področje | Najdba | Resnost | Stanje |
|---|----------|--------|---------|--------|
| 1 | XSS (shranjen) | `app/layout.tsx` je JSON-LD (`jsonLd`, `platformJsonLd`) izpisoval z `JSON.stringify` **brez ubežnega zapisa `<`** — lastniško polje (ime/opis) z `</script><script>…` izvaja kodo na VSEH straneh najemnika (vsi obiskovalci). Shop stran (`shop/[slug]`) je to pravilno delala — neskladje. | **VISOKA** | ✅ popravljeno (`.replace(/</g, "\\u003c")`, kot na shop strani) |
| 2 | XSS (shranjen) | Tipografija teme (`headingScale`, `baseFontSize`, `fontHeading`, `fontBody`, `fontWeight`) se vbrizga v `<style id="org-theme">` **brez validacije**: `validateTheme` je preverjal LE barve/kontrast, TypeScript tipi pri server action ne ščitijo (vhod je poljuben JSON). `headingScale: "1}</style><script>…"` = shranjen XSS za obiskovalce. | **VISOKA** | ✅ popravljeno: `sanitizeTypography()` (edini lijak — številke na varne intervale, pisave prek `FONT_CSS_VARS` mape) + `validateTheme` zavrača ne-numerične vrednosti z `errors` |
| 3 | Skrivnosti v repo | `_deploy.mjs` (gitignored) vsebuje **hardkodiran Vercel token** (`vcp_…`). Ni commitan, a je v delovnem drevesu. | SREDNJA | ⚠️ **uporabnik: rotacija tokena** v Vercel konzoli |
| 4 | DMARC | `_dmarc.rcbeautysalon.org` ima **2 nasprotujoča zapisa** (RFC zahteva natanko enega). | SREDNJA | ⚠️ **uporabnik: izbrisati enega** (glej `docs/MAIL-SETUP.md`) |

## Preverjeno — brez najdb

| Področje | Stanje |
|----------|--------|
| SQL injekcija | ✅ Vsi surovi SQL klici so parametrizirani (`$queryRaw` template literal, `$queryRawUnsafe` z `$1/$2`); interpolirana tabela (`"Product" \| "ProductVariant"`) je tipa literal union (ni iz vhoda) |
| Brute force prijave | ✅ DB-backed rate limit `login:ip` + `login:email` (10/15 min), fail-open, brez razkrivanja obstoja e-pošte (enotni "Invalid credentials") |
| Gesla | ✅ bcrypt, cost 10; enotna sporočila napak |
| Verifikacijski / reset žetoni | ✅ `crypto.randomBytes(32)` (256-bit), preteklost/enkratnost preverjena v akcijah |
| Stripe webhook | ✅ Obvezen `stripe-signature` header (400 brez), `constructEvent` verifikacija prek shranjenih org skrivnosti (E4-3b), zavrnitev ob neveljavnem podpisu |
| Nalaganje datotek | ✅ Prijava + vloge (avatar: vsi prijavljeni; ostalo: ADMIN/STAFF), MIME `image/*`, 5 MB limit, storage-plan pregrada |
| Odprta preusmeritev | ✅ Ni custom `redirect` callbacka — NextAuth v5 privzeto dovoli le isto-izvorne/relativne URL-je |
| Masovno dodeljevanje | ✅ Nobenega širjenja uporabniškega vhoda (`...data`) v Prisma vnese |
| Piškotki | ✅ NextAuth privzeti: httpOnly, secure (v produkciji), sameSite=lax; JWT strategija |
| Multi-tenant izolacija | ✅ Podpisane org glave (HMAC, proxy-only), resolve-tenant proof; pokrito z itesti (`tests/integration/f635/*`, 7/7) |
| CSP / varnostne glave | ℹ️ Namerno v Report-Only (odločba P1#32 — inline skripte Next/teme zahtevajo nonce/hash pristop; poročila se zbirajo). `X-Frame-Options: DENY`, `nosniff`, HSTS (Vercel) |

## Regresijski testi

`tests/security/theme-injection.test.ts` (5 testov) — zaklene popravka:
- `sanitizeTypography` zavrne injicirane nize / prototype ključe, omeji obsege;
- `validateTheme` zavrača ne-numerično tipografijo (errors);
- `themeToCssVars` nikoli ne izpuste vrednosti z `<`, `>`, `;`, `{`, `}`;
- neveljavna barva ne prispeva CSS vrednosti.

## Priporočila (naslednji krog)

1. **CSP iz Report-Only v enforce** — prehod na `nonce` za inline skripte (Next 16 podpira);
   odločitev in implementacija ločeno (srednje veliko delo).
2. **Vsebinsko preverjanje slike pri nalaganju** (magic bytes namesto MIME glave odjemalca).
3. Aktivno spremljanje CSP poročil (`report-uri`) pred enforce.
