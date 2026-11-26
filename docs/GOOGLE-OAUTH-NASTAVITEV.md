# Google OAuth — nastavitev v Google Cloud Console

**Datum:** 2026-11-25  
**Status kode:** pripravljena in aktivna.  
**Status Google Console:** pravilno nastavljen za novi client (lokalni in produkcijski callback sta potrjena).  
**Status lokalno:** Google prijava deluje do Google izbire računa.  
**Status produkcijsko:** po popravku Vercel env in redeployju Google gumb odpre pravo Google prijavno stran z novim clientom. preostane le še prijava z resničnim testnim uporabnikom do `/my-account`.

---

## Kaj sem preveril v živo ob 19:43

- `GET http://localhost:3008/api/auth/providers` vrne `google` in `credentials`.
- `.env.local` vsebuje `AUTH_GOOGLE_ID`, ki se ujema z **novim** OAuth clientom:

  ```txt
  831336859645-7l8bqd189pfp9pls7s1kvao3lkpisrr5.apps.googleusercontent.com
  ```

- Klik na gumb »Nadaljuj z Google« lokalno zdaj pripelje do prave Google prijavne strani (`Sign in to continue to markec`). Napake `redirect_uri_mismatch` ni več.
- Ročno sestavljen avtorizacijski URL z novim clientom in produkcijskim callbackom prav tako odpre Google prijavno stran (`Sign in to continue to rcbeautysalon-phi.vercel.app`). Torej so URI-ji v Google Console pravilno vpisani.
- Na produkciji se gumb prikaže, vendar klik vrne:

  ```txt
  Access blocked: Authorization Error
  Error 401: invalid_client
  The OAuth client was not found.
  ```

  V odposlanem URL-ju je:

  ```txt
  client_id=831336859645-639dlrg9i9cr5bad68up43a92i5unkjs.apps.googleusercontent.com%22
  ```

  Torej Vercel še vedno uporablja **stari client ID** in ima na koncu še dodan znak `"` (`%22`). To je edina preostala ovira.

### 19:52 — po Vercel popravku

- Vercel env je bil posodobljen prek REST API-ja, sledil je nov produkcijski deployment `dpl_Di2AVrCStXcxuG9FFoyUueNa6RSf` (status `READY`).
- Ponoven klik na produkciji zdaj odposlje:

  ```txt
  client_id=831336859645-7l8bqd189pfp9pls7s1kvao3lkpisrr5.apps.googleusercontent.com
  redirect_uri=https://rcbeautysalon-phi.vercel.app/api/auth/callback/google
  ```

- Rezultat je Google prijavna stran `Sign in to continue to rcbeautysalon-phi.vercel.app`. Napak `invalid_client` in `redirect_uri_mismatch` ni več.
- Preostane samo še zaključek prijave z resničnim Google testnim uporabnikom, da se potrdi končni redirect na `/my-account`.

---

## Kateri OAuth client je pravilen

Na posnetku `APIs & Services → Credentials` sta dva OAuth 2.0 Client ID-ja:

| Client ID | Status |
|---|---|
| `831336859645-7l8bqd189pfp9pls7s1kvao3lkpisrr5...` | **Ta je aktiven** — ta urejaj |
| `831336859645-639dlrg9i9cr5bad68up43a92i5unkjs...` | Stari client — ne uporablja se več |

Urejaj **prvega** (`7l8b...`). Če dodaš URI-je staremu (`639d...`), se lokalna prijava ne bo popravila.

---

## Koraki v Google Cloud Console

### 1. Odpri aktiven OAuth client

`APIs & Services → Credentials → OAuth 2.0 Client IDs`  
Klikni svinčnik pri clientu, ki se začne z `831336859645-7l8b...`.

### 2. Authorized JavaScript origins

Dodaj natanko:

```txt
http://localhost:3008
https://rcbeautysalon-phi.vercel.app
```

Če v prihodnje spet zaženeš dev strežnik na drugem portu, dodaj še ta origin (npr. `http://localhost:3000`).

### 3. Authorized redirect URIs

Dodaj natanko teh pet vrstic — brez presledkov, brez dodatnega `/` na koncu:

```txt
http://localhost:3008/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
http://localhost:3002/api/auth/callback/google
https://rcbeautysalon-phi.vercel.app/api/auth/callback/google
```

**Obvezni sta zadnja produkcijska in prva lokalna (`3008`).** Ostali localhost URI-ji so dodani za stare/preklicane dev portove.

Spravi → `Save`.

### 4. OAuth consent screen

Preveri `APIs & Services → OAuth consent screen`:

- App name: `MARKEC`
- User support email: tvoj resnični kontaktni e-naslov
- Scopes: `openid`, `profile`, `email` (te zahteva NextAuth)
- **Testing / Test users:** dodaj Google račun, s katerim boš opravil preizkus prijave.

Dokler je consent screen v »Testing«, se lahko prijavijo samo navedeni testni uporabniki. Ko boš imel resnične stranke, objavi consent screen (`Publish App`).

### 5. Vercel okolje — OBVEZNO popraviti

V Vercelu (`Settings → Environment Variables`) **zamenjaj** obstoječi `AUTH_GOOGLE_ID`. Trenutna vrednost je stara in vsebuje napačen znak na koncu:

```txt
...639dlrg9i9cr5bad68up43a92i5unkjs.apps.googleusercontent.com"
```

Pravilna vrednost brez narekovaja:

```txt
831336859645-7l8bqd189pfp9pls7s1kvao3lkpisrr5.apps.googleusercontent.com
```

Prav tako posodobi `AUTH_GOOGLE_SECRET` na vrednost iz trenutnega gitignoriranega `.env.local` (secret-a ne objavljaj v klepet ali dokumentacijo).

Nastavi za **Production**, **Preview** in **Development**, nato ponovno deployaj. Če `AUTH_GOOGLE_ID` ostane stari, bo produkcija še vedno vračala `Error 401: invalid_client`.

---

## Preverjanje po nastavitvi

### Lokalno

1. `curl http://localhost:3008/api/auth/providers` → `google` je prisoten.
2. Odpri `http://localhost:3008/login` → klikni »Nadaljuj z Google«.
3. Pričakovan rezultat: Google consent/izbira računa, **ne** `redirect_uri_mismatch`.
4. Po uspešni prijavi mora uporabnik pristati na `/my-account` (ne v `/self-service`).

### Produkcijsko

1. Odpri `https://rcbeautysalon-phi.vercel.app/login`.
2. Google gumb mora biti viden. *(To že drži.)*
3. Klik na gumb mora odpreti Google prijavno stran brez `invalid_client`.
4. V odposlanem URL-ju mora biti `client_id=831336859645-7l8bqd189pfp9pls7s1kvao3lkpisrr5...` brez `%22`.
5. Po uspešni prijavi mora uporabnik pristati na `/my-account`.

**Trenutno (19:52):** koraki 1–4 so preverjeni in OK. Korak 5 zahteva prijavo z resničnim Google testnim uporabnikom.

---

## Varnost

- `AUTH_GOOGLE_SECRET` je bil vklepan v klepet. Po uspešni nastavitvi ga **rotiraj** v Google Console in posodobi `.env.local` + Vercel.
- Skrivnice ne shranjuj v dokumentacijo ali git.
- API ključ `AIzaSy...` na posnetku je »Generative Language API Key«, omejen na Gemini API. **To ni dostop do Google Cloud Console** in ne more nadomestiti OAuth secret-a. Ker je bil deljen, ga omeji ali rotiraj.
- Vercel token, ki si ga posredoval za popravek, je bil deljen v klepetu. Po končanem delu ga v Vercelu prekliči/rotiraj. Ni shranjen v projektu niti v dokumentaciji.

---

## kaj lahko naredim sam

Nimam dostopa do tvoje prijavljene Google seje v brskalniku in nimam nameščenega `gcloud` CLI-ja. Google Console je bilo že pravilno nastavljeno.

**19:48 — Vercel env je bil popravljen neposredno prek REST API-ja** s tokenom, ki si ga posredoval (token ni shranjen v projektu). Zamenjana sta bila `AUTH_GOOGLE_ID` (novi client brez narekovaja) in `AUTH_GOOGLE_SECRET` (iz lokalnega `.env.local`) za `production`, `preview` in `development`. Sprožen je bil nov produkcijski deployment `dpl_Di2AVrCStXcxuG9FFoyUueNa6RSf`, ki je dosegel status `READY`.

**19:52 — ponovljen preizkus na produkciji je uspešen:** Google gumb odpre prijavno stran z novim client ID-jem in pravilnim produkcijskim callbackom brez napak.
