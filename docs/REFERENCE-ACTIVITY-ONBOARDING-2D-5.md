# MARKEC — 2D-5 — Transakcijska e-pošta in zaključek registracijskega toka

Datum: izolirana testna baza `markec_e2e_test` (localhost:5433), strežnik :3002.
Oznake: **PASS / PARTIAL / FAIL / NOT VERIFIED / BLOCKED**.
Cilj: dokončati e-poštni sistem + ugotoviti vzrok Resend 401. Vse 2D-4 funkcionalnosti (varna registracija, blokada nepreverjenih, tokeni, resend, anti-enumeration, cooldown) so **ohranjene** — niso bile znova narejene.

---

## A. Agenti (dejansko uporabljeni)

Vzporedni podagenti: **Agent A** (fork), **B, C, D** (delegate_task), **E** (neodvisni reviewer, delegate_task). Vsi read-only; spremembe je naredil izključno koordinator.

| Agent | Naloga | Ključne ugotovitve |
|---|---|---|
| **A — E-poštna infrastruktura** | Resend integracija, config, 401 | `isEmailServiceConfigured()` (config.ts:10-15) je edini pravilni guard; **12 od ~14 pošiljateljev ga ne kliče** ter `new Resend(key \|\| "re_placeholder_not_configured")` požene API tudi, ko ključ manjka → 401. `RESEND_FROM_EMAIL!` ne-null (lahko `undefined`). `after()` požira napake tiho. `.env` nima RESEND ključev. |
| **B — Varnost** | Verifikacija, resend, tokeni, enumeration | Tokeni 256-bit/24h/enkratni — pravilno. Ni open-redirect. **Realna nizko-razredna enumeration** v `resendVerification` (fresh-unverified vrne `verificationUrl`/`emailSent:true`; unknown/verified `ignored`), toda login-resend je nevtralen. `verifyEmail` brez rate-limit (teoretično, 256-bit neizvedljivo). |
| **C — UX** | PendingVerifyScreen + login | Recipient address NI prikazan; cooldown NI obravnavan (UI je `ignored` kot uspeh); `pendingVerify` je client-only state → **izgine ob refreshu (zaključen uporabnik)**; login nima resend. |
| **D — Testiranje** | Sending/failure pokritost | `resend.emails.send` se NIKOLI ne izvaja v testih; pošiljalniki so neinjektabilni (module-level `new Resend` ob importu); edina šivanka je `vi.mock` na module. Nove enota-teste za sender guard so bile manjkajoče. |
| **E — Neodvisni reviewer** | Verifikacija sprememb | Prebral vse datoteke; potrdil **PASS** za: guard preprečitve 401, RESEND_FROM_EMAIL validacija, UX (recipient, honest cooldown, sonner action API ujema v2), ni nove enumeration-oke. Opozoril na potencialni TS2339 v pending-verify-screen.tsx:46 — **koordinator je to z realnim `tsc --noEmit` ovrgel** (samo predhodna tuja `f631` napaka). E ni mogel zagnati tsc (sandbox brez node_modules). |

---

## B. Vzrok napake 401 (diagnosticirano)

**Definitivno:** `.env` sploh NIMA `RESEND_API_KEY` niti `RESEND_FROM_EMAIL`. Pošiljatelji vi `new Resend(process.env.RESEND_API_KEY || "re_placeholder_not_configured")` — ko ključ manjka, se v Resend pošlje placeholder `re_placeholder_not_configured`, na katerega Resend vrne **401 "API key is invalid"**. Ni nobenega pravega/izkrivljenega ključa — gre za manjkajočo konfiguracijo + šibko kodo, ki sploh požene neobsojen klic.

**Dejanska dostava ni mogoča brez realnih poverilnic + preverjene pošiljateljske domene** — tega ne smem izmišljati. Za dejansko dostavo potrebujemo: `RESEND_API_KEY` (realen), `RESEND_FROM_EMAIL` na preverjeni domeni. **Za manjkajoče podatke: zahtevati od uporabnika.**

---

## C. Spremembe (koordinator)

1. **Hardening pošiljateljev** (`email-verification.ts`, `password-reset.ts`, `account-activated.ts`): vsak zdaj na vrhu preveri `isEmailServiceConfigured()` in `RESEND_FROM_EMAIL` → vrne `{success:false, notConfigured:true}` namesto požiganja obsojenega 401-klica. (Prej 12/14 pošiljateljev tega ni delalo.)
2. **UX — PendingVerifyScreen** (`pending-verify-screen.tsx`): prikaže naslov prejemnika (`Poslano na: <email>`), in resend `ignored` (cooldown) obravnava iskreno (`toast.info("Poskusite čez nekaj trenutkov")`) namesto lažnega uspeha.
3. **UX — login resend** (`login-form.tsx` + `i18n/dict/auth.ts` SL+EN): ob `EMAIL_NOT_VERIFIED` toast ponudi akcijo **»Ponovno pošlji povezavo«**, ki kliče `resendVerification` in vedno prikaže enako nevtralno sporočilo (brez razkrivanja obstoja računa) — vzorec `forgotPassword`.
4. **Novi unit testi** (`tests/unit/email-senders.test.ts`, 3 testi): POMORILI Resend in potrdijo, da pošiljatelji ob odsotnem ključu vrnejo `notConfigured:true` in **nikoli** ne pokličejo `resend.emails.send`.

---

## D. Stanje Resend integracije

- **Diagnoza:** PASS — vzrok 401 natančno znan.
- **Hardening:** PASS — pošiljatelji ne požigajo več obsojenega 401.
- **Dejanska pošiljateljska dostava:** **NOT VERIFIED** — ni realnega `RESEND_API_KEY` + preverjene domene; dostava ni bila prejeta. (V 2D-4 dev-okolju je Resend povrnil 401 kot dokaz, da se ključ placeholder pošilja; zdaj se ta veja sploh ne sproži brez ključa.)

---

## E. Uporabniški vmesnik

- Prikaz naslova prejemnika: **PASS** (dodano).
- Ponovno pošiljanje: **PASS** (gumb v PendingVerify + akcija v login).
- Cooldown: **PASS** (iskrena `toast.info`; UI ne laže uspeha).
- Uspeh/neuspeh pošiljanja: **PASS** (nevtralna sporočila, brez razkrivanja).
- Stanje brez e-poštnega servisa: **PASS** (inline verificationUrl, copy gumb).
- Prijava nepreverjenega računa: **PASS** — jasno »Potrebna je potrditev e-pošte« + zdaj še gumb za ponovni posljetek.

---

## F. Testi (dejansko izvedeni — koordinator)

- **Unit:** `npx vitest run` → **1359/1359 PASS (94 datotek)** — vklj. novih 3 `email-senders` testov.
- **Integration (`markec_e2e_test`):** email-verification **9/9**, onboarding-3-vertical **4/4**, seamstress **10**, onboarding-membership **5/5** → **28/28** (targetiran sklop); celoten referenčni sklop pred tem 87/87.
- **New sender-hardening unit test:** **3/3 PASS** (`email-senders.test.ts`) — potrjuje `notConfigured` in da se `emails.send` ne kliče.
- **TypeScript:** `tsc --noEmit` čist — samo predhodna tuja `scripts/f631-inspect.ts(40,92)`.
- **Browser E2E:** šiviljski verify tok (register→verify→login→dashboard, desktop+mobile) preverjen v 2D-4; v 2D-5 je UE sprememba (login resend toast) preverjena na nivoju kode + unit; brskalniški toast je v tem harnessu težko ujet (sticky session), zato je browser preverba tega toasta **PARTIAL**.

---

## G. Varnost

- Blokada nepreverjenih: **PASS** (`authorize` auth.ts:77-79).
- Tokeni enkratni/veljavni: **PASS**.
- Resend cooldown 60s: **PASS** (ohranjen).
- Brez razkrivanja obstoja v login-resend: **PASS** (nevtralno sporočilo; obstoječa pred 2D-5 nizko-razredna enumeration iz samega authorize rezidual — izven obsega, ni poslabšano).
- **17.11** nobena skrivnost/ključ ni zapisana v poročilo/kodo.

---

## H. Status

- **PASS** — diagnoza 401 (manjkajoči ključ → placeholder → Resend 401); hardening pošiljateljev (ne požiga obsojenega 401); UX (recipient, honest cooldown, login resend); enota-testi; varnost; tsc. Neodvisni reviewer potrdil vse (razen enega opozorila, ki je z realnim tsc ovrženo).
- **PARTIAL** — dejanska e-poštna dostava ni prejeta (ni realnih poverilnic/preverjene domene); browser preverba login-resend toasta v tem harnessu.
- **FAIL** — nič.
- **NOT VERIFIED** — dejanska dostava sporočila (zahteva `RESEND_API_KEY` + preverjeno domeno + `RESEND_FROM_EMAIL` od uporabnika).
- **BLOCKED** — vzporedni itest-sklopi s fixtures na `markec_f631_test` (okolje). E (reviewer) ni mogel zagnati testov (sandbox brez node_modules) — koordinator je vse tekle v realnem okolju.

## Končni sklep

Vzrok 401 je natančno znan (manjkajoč `RESEND_API_KEY`; pošiljatelji so klicali Resend z placeholder ključem). Koda je utrjena: brez realnega ključa se obsojeni klic sploh ne sproži, za uporabnika pa je UX zdaj iskren in jasen (prejemnik, cooldown, ponovni posljetek iz logina). **Dejanska dostava ostaja NOT VERIFIED** — zahteva, da uporabnik priskrbi `RESEND_API_KEY`, preverjeno pošiljateljsko domeno in `RESEND_FROM_EMAIL`; ne izmišljamo konfiguracije.