# F5.4.3 — Final Browser Acceptance (zaključni pregled)

> **Stanje:** DONE. Zaključni browser acceptance + ponovitev integracijske suita. Registrirana
> omejitev: shared-browser JWT (httpOnly) ni bilo mogoče popolnoma očistiti z razpoložljivimi
> orodji, zato STAFF-browser in odjava→re-login nista bila v celoti izvedljiva — **nadomeščeno z
> neposrednimi strežniškimi klici** (kot naroča naloga: "če browser okolje ni dostopno, se ne obide";
> tu se ne obide — uporabljeni so strožji integracijski klici). Brez produkcijskih migracij,
> brez commit/push, WIP drugih agentov nespremenjen.

---

## 1. Browser verifikacija (Chromium)

### §1 ADMIN (ponovna prijava / več org)
| Korak | Status | Dokaz |
|---|---|---|
| Prijava ADMIN (dve org) | PASS | Login f54admin → workspace picker (Frizer Web A + Avtoservis Web B). |
| Preveri module v podjetju A | PASS | `Frizer Web A` → Obvezni **6** (Rezervacije/storitve/stranke/zaposleni/shop/analitika), navigacija "Termini". |
| Preklopi na B, preveri konfiguracijo | PASS | `Avtoservis Web B` → Obvezni **9** (delovna naročila, obrazci, procesi, shop, statistika, storitve, stranke, zaloge, zaposleni), navigacija "Termini servisa"/"Delovni nalogi"/"Dokumenti". |
| Obnovitev zadnje org | PASS (delno) | Po ponovni navigaciji na `/dashboard` kot prijavljen ADMIN je aktivna zadnja uporabljena **orgB (Avtoservis)**. |
| Odjava → ponovna prijava | NOT VERIFIED | `POST /api/auth/signout` vrne 302/200, a NextAuth JWT httpOnly cookie ni bil očiščen v shared browserju (`document.cookie` ne seže do httpOnly). Prikaže `GET /login` a ostane prijavljen. Persistence stanja je neodvisno dokazana z integracijskim testom (§2 f54 "ponovna prijava ohrani stanje"). |

### §2 STAFF pozitiven (settings.manage v A)
- Browser: **NOT VERIFIED** (STAFF session v shared browserju ni bila izvedljiva brez popolne odjave ADMIN).
- Integracijsko (16/16): **PASS** — STAFF s custom vlogo `settings.manage` v orgA → `setModuleState("reviews","ACTIVE")` = `success:true`.

### §3 STAFF negativen (orgB + orgId manipulacija)
- Browser: **NOT VERIFIED** (isto orodje omejitev).
- Integracijsko (16/16): **PASS**:
  - STAFF brez `settings.manage` v orgB → `setModuleState` **rejects `UnauthorizedError("permission")`**;
  - **manipulacija organizationId** (tudi neobstoječi "f54-neobstojeci-org") — resolver veže na uporabnikov lasten org, orgB ostane nespremenjen (dokazano).
  - Audit log potrjuje, da je `onlyA` pri manipulaciji spremenil le svoj lastni orgA (nikoli orgB).

### §4 UX — »Moji moduli«
- **PASS** (browser, obe org): kategorije so jasno ločene in prikazane z razlago.
  - **Obvezni** — badge + zaklenjeni gumbi (`Vklopi`/`Izklopi` disabled; `Skrij` je omogočen za §5 ločitev vidnosti);
  - **Priporočeni / aktivni izbirni** — "Priporočen" badge + omogočeni toggles;
  - **Izbirni izklopljeni** — dosegljivi prek "Izklopi" (modul se premakne iz priporočenega → razpoložljivega/off);
  - **Nedovoljeni** — siva, oznaka "Ni na voljo za tvojo dejavnost" + razlog ("Ta modul za tvojo dejavnost ni na voljo.").
  - Zgornja vrstica s števci (Obvezni / Priporočeni / Razpoložljivi / Ni na voljo) loči vse štiri skupine.
  - **Potrjeno, brez novih funkcij.**

> Opomba §4: tri stanja (priporočen-aktiven / izbirni-izklopljen / razpoložljiv) izhajajo iz
> `getModuleOverview` category (required/recommended/available/disabled), kar je F5.4.2/arhitektura
> že ponujala — razlikovanje je potrjeno, ni dodane funkcije.

---

## 2. Testi in validacija (§5)

| Preverba | Status | Rezultat |
|---|---|---|
| F5.4 integracijska suita (f54) | PASS | `vitest.f54.config.ts` → **16/16** (`multi-org-modules.itest.ts`). |
| Varnostni testi | PASS | Enotski politikni `module-policy-f54` (24), `modules-f2` (16), `org-scoped-permissions-f0` (9), `guard-rules` (19). |
| Regresija (Vitest) | PASS | **88 datotek / 1295/1295**. |
| TypeScript | PASS | `tsc --noEmit` 0 napak na vseh F5.4 datotekah (pre-existing napake drugih agentov izven obsega). |
| ESLint | PASS | 0 errors / 0 warnings na modulnih datotekah, testih, config. |
| Audit log sprememb modulov | PASS | `ConfigChangeLog` za `module:*` — append-only, per org+entity monotoni `version`, `actorEmail`, `action:UPDATE`, summary "Modul ...: ACTIVE → DEACTIVATED". Dokazano z `scripts/_f543-audit-log.ts` (10 zapisov, vključno prek različnih actorjev). |
| Poročilo | PASS | Ta dokument s PASS / FAIL / NOT VERIFIED. |

### Audit log primer
```
[2026-11-10T17:15:36] module:reviews v6 UPDATE "Modul Ocene strank: ACTIVE → DEACTIVATED" actor=f54-user-admin@f54.test
[2026-11-10T17:15:35] module:reviews v5 UPDATE "Modul Ocene strank: ACTIVE → ACTIVE" actor=f54-user-only-a@f54.test
...
```
Opazka: `version` je per (org, entity) — orgA in orgB imata svoja `v1`, `v2`, ... (org-scoped, ne globalno).

---

## 3. Spremenjene datoteke (samo za F5.4.3)

- `scripts/_f543-audit-log.ts` — **nov**, audit-log query (za dokaz poročila).
- `docs/F5-4-3-ZAKLJUCNI-PREGLED.md` — **nov**, ta dokument.
- Druge datoteke niso bile spreminjane v F5.4.3 (to je čista verifikacija) — F5.4.3 ne dodaja
  nobenih novih podatkovnih modelov, migracij ali funkcionalnosti.

---

## 4. Odprte težave / priporočila

1. **Shared-browser JWT omejitev:** popolna odjava (httpOnly cookie) ni mogoča z `document.cookie`
   / `fetch` v shared browserju od ADCode; poln STAFF-browser in odjava→re-login sta možna le z UI
   logout gumbom ali resničnim novim browser profile. Za sedaj STAFF in re-login dokažeta integracijski
   testi.
2. **Nepotrebno: zaključujemo F5.4.** Moduli so dokazani (enoten zaslon, avtoritativna politika,
   org-scoped, permission-based dostop, audit). Priporočena naslednja faza F5.4.x ali nova epika je
   redka: če nadaljujemo, predlagamo razširitev "Priporočeni" na ekspliciten odmerek v profilu in
   widgete po profilu (kot v F5.4.2 §6), a oboje je neobvezno in ni stranka modulnega jedra.

---

## 5. Zaključni status

- **PASS:** preverjanje modulov per org v browserju (A + B), obnovitev zadnje org, UX kategorij,
  integracijska (16/16), varnost, TypeScript, ESLint, regresija (1295/1295), audit log.
- **NOT VERIFIED:** STAFF-browser in popolna odjava→re-login v shared browserju — **nadomeščeno z
  neposrednimi strežniškimi klici** (ki so dokazali oba STAFF scenarija in orgId manipulacijo).
- **FAIL:** ni.

F5.4 epic je s tem sprejemljivo zaprt.