# Poštna domena — preverjanje in nastavitev (točka 1 `docs/PLAN.md`)

**Namen:** en ukaz, ki pove, ali je produkcijsko pošiljanje e-pošte pripravljeno. Skript je
**read-only** — ne pošilja pošte, ne spreminja DNS in nikoli ne izpiše vrednosti API ključa.

```bash
pnpm mail:check
pnpm mail:check -- --domain=rcbeautysalon.org   # če RESEND_FROM_EMAIL še ni nastavljen
pnpm mail:check -- --json                       # za CI / avtomatizacijo
```

Izhodne kode: `0` = pripravljeno, `1` = ni pripravljeno, `2` = napaka pri ugotavljanju domene.
Domena se vzame iz `RESEND_FROM_EMAIL`; če ta manjka, iz prvega naslova v
`PLATFORM_ADMIN_EMAILS`, lahko pa jo podaš z `--domain`. DKIM selektor je privzeto `resend`
(`--selector` za drugačnega).

## Kaj preverja

| Preverjanje | Kje išče | Zahteva |
|---|---|---|
| `RESEND_API_KEY` | `process.env` | neprazen, ne `re_placeholder*` |
| `RESEND_FROM_EMAIL` | `process.env` | veljaven naslov na potrjeni domeni |
| SPF | `TXT` na korenu **ali** `send.<domena>` | vsaj en `v=spf1` |
| DKIM | `TXT` na `resend._domainkey.<domena>` | vsaj en zapis s `p=` |
| DMARC | `TXT` na `_dmarc.<domena>` | **natanko en** `v=DMARC1` |
| MX (return-path) | `MX` na `send.<domena>` | priporočilo, ne blokator |

Več kot en SPF zapis je opozorilo (RFC 7208), ne napaka. Manjkajoč MX je opozorilo.
DNS se bere prek `node:dns`; kjer ta ne deluje (npr. lokalni WARP proxy → `ECONNREFUSED`),
skript sam pade na `nslookup -type=TXT/MX`.

## Dejansko stanje — 2026-11-15, `rcbeautysalon.org`

```
FAIL RESEND_API_KEY     manjka ali je placeholder
FAIL RESEND_FROM_EMAIL  manjka ali je neveljaven
OK   SPF                najden 1 (koren: 0, send: 1)
OK   DKIM               najden 1
FAIL DMARC              nasprotujoči si zapisi: 2 (obdrži natanko enega)
```

**Pomemben popravek zgodnejše diagnoze:** SPF in DKIM **niso manjkali**, le nista bila na korenu.
Izmerjeno v DNS:

| Ime | Tip | Vrednost (skrajšano) |
|---|---|---|
| `send.rcbeautysalon.org` | `TXT` | `v=spf1 include:amazonses.com ~all` |
| `send.rcbeautysalon.org` | `MX` | `feedback-smtp.us-east-1.amazonses.com` (prio 10) |
| `resend._domainkey.rcbeautysalon.org` | `TXT` | `p=MIGfMA0GCSqGSIb3DQEBAQUA…` |
| `_dmarc.rcbeautysalon.org` | `TXT` | `v=DMARC1; p=none;` |
| `_dmarc.rcbeautysalon.org` | `TXT` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; …` |
| koren | `TXT` / `MX` | brez zapisa |

To je standardna postavitev z ločeno povratno potjo (`send.` poddomena), zato **ne dodajaj
SPF/DKIM zapisa na koren** — podvojen ali napačen zapis bi pokvaril obstoječo, očitno že
potrjeno domeno. Edini resnični DNS defekt sta **dva nasprotujoča si `_dmarc` zapisa**.

## Kaj je treba narediti (vrstni red)

1. **Resend konzola** → potrdi, da je `rcbeautysalon.org` domena v statusu *Verified* in preveri,
   ali obstoječi DKIM ključ še ustreza tam prikazani vrednosti. Ustvari API ključ.
2. **Vercel** → `rcbeautysalon` → Settings → Environment Variables: dodaj `RESEND_API_KEY` in
   `RESEND_FROM_EMAIL` za `production` (po potrebi tudi `preview` z lastnim preverjenim
   naslovom). `RESEND_FROM_EMAIL` naj bo na potrjeni domeni, ne na `…vercel.app`.
   Koda je že pripravljena: vseh 16 pošiljateljev je fail-closed prek
   `src/lib/email/config.ts#getEmailConfig`, zato **sprememba kode ni potrebna**.
3. **GoDaddy DNS** (avtoritativni NS `ns75.domaincontrol.com` / `ns76.domaincontrol.com`,
   SOA `dns.jomax.net`; Vercel nima dostopa — `GET /v3/domains/rcbeautysalon.org` → 403):
   izbriši enega od dveh `_dmarc` zapisov in obdrži strožjega
   (`p=quarantine`, kasneje lahko `p=reject`). Drugih zapisov ne spreminjaj.
4. Počakaj na propagacijo (TTL 600 s), nato lokalno z nastavljenima spremenljivkama ali
   v CI ponovno poženi `pnpm mail:check`. Ko vrne `0`, lahko točka 1 v `docs/PLAN.md`
   postane ✅.

## Sorodno

- `docs/PLAN.md` — točka 1 (Varnost in higiena) in inventar.
- `docs/REFERENCE-ACTIVITY-ONBOARDING-2D-5.md` — zgodovina utrjevanja pošiljateljev.
- `src/lib/email/config.ts` — `isEmailServiceConfigured()` / `getEmailConfig()`.
- `tests/mail-setup.test.ts` — testi čistih helperjev (brez mreže).
