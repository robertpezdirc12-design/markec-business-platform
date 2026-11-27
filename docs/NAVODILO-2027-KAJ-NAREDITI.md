# NAVODILO: kaj narediti — MARKEC 2026/2027

**Sklep na začetku:** ne dodajaj novih funkcij, dokler ne popraviš treh stvari: **zanesljivost, resničnost podatkov, mobilna navigacija**. Vse drugo lahko počaka. Vsak nov gumb na nestabilni ali lažni podlagi povečuje škodo.

---

## 1. Vodilna načela — drži se jih pri vsaki odločitvi

1. **Honest UX / fail-closed.** Če podatek ni resničen, ga ne prikaži. Če akcija ni shranjena, ne javi uspeha.
2. **Ena resnica.** Vsaka številka na zaslonu mora priti iz baze ali iz izračuna nad bazo. Nobene hardcodirane vrednosti v UI.
3. **Globina pred širino.** Ena panoga (priporočam `barber` ali `beauty`) mora imeti popoln krog: termin → stranka → depozit → plačilo → poročilo → ponovna rezervacija. Šele potem dodaj deseto panogo.
4. **Pridobivanje pred administracijo.** Fresha ne zmaga zaradi boljšega kalendarja, ampak zato, ker prinaša stranke. Zato je tržnica + lokalno iskanje pred dodatnimi back-office moduli.
5. **Merjenje pred optimizacijo.** Najprej postavi števce (uptime, uspešnost rezervacije, ponovni obisk), šele nato spreminjaj dizajn.

---

## 2. Prva odločitev: kje teče produkcija

To odloči pred vsakim drugim korakom.

| Možnost | Kaj dobiš | Omejitev | Kdaj izbrati |
|---|---|---|---|
| **Cloudflare Workers Paid** | 30 s CPU namesto 10 ms, ostaneš na obstoječem OpenNext adapterju, R2 ostaja blizu | Plačljiv plan; še vedno OpenNext specifike (`dynamic require`, `AUTH_TRUST_HOST`) | Če želiš hitro obdržati trenutno arhitekturo |
| **Vercel + R2 prek S3** | Nativni Next.js 16, ni OpenNext adapterja, manj "workerd" težav, zanesljivejši build | Ločen deploy pipeline; R2 se prek AWS SDK že uporablja | Dolgoročno, če je Next.js jedro izdelka |

**Priporočilo:** produkcijsko spletno mesto in aplikacijo prestavi na **Vercel**, R2 naj ostane za slike. Workers Free takoj opusti — 10 ms CPU ni primerno za Next.js. Če izbereš Workers Paid, je to sprejemljiv vmesni korak, ne končna arhitektura.

**Preverjanje po odločitvi:**

```bash
for p in / /start /podjetja /api/health /api/auth/session; do
  printf "%s " "$p"
  curl -sS -o /dev/null -w "%{http_code}\n" "https://MARKEC_HOST$p"
done
```

Pričakovano: **200 pri vseh**, brez `Error 1102`, brez 500 na `/api/auth/session`.

---

## 3. FAZA 0 — zaustavitev krvavitve (highest priority)

### F0.1 — Odpravi 503 / Error 1102

- **Zastarelo (2026-11-27):** Cloudflare Workers deployment je odstranjen iz repozitorija. Edini deploy cilj je Vercel: `pnpm build` → `scripts/build.mjs` → `next build`. `wrangler.jsonc`, `open-next.config.ts`, `worker.js` in celotna `.open-next` veriga ne obstajajo več.
- Koristni ukazi:

```bash
npx wrangler tail markec-business-platform
npx wrangler deployments list --name markec-business-platform
npx wrangler rollback <deployment-id> --name markec-business-platform -y
```

- **Sprejemno merilo:** 50 zaporednih `GET /`, `/start`, `/podjetja` vrne 200.

### F0.2 — Popravi AuthJS 500 in `__name is not defined`

- Simptom v konzoli:

```txt
500 /api/auth/session → AuthError: There was a problem with the server configuration
pageerror: __name is not defined
```

- Preveri `src/lib/auth/auth.ts`, še posebej `trustHost`, `NEXTAUTH_URL`, `AUTH_SECRET` in oznako `use server`.
- Preveri, da se `process.env` ne bere med statičnim prerenderom tam, kjer ni na voljo.
- **Sprejemno merilo:** `/api/auth/session` ne vrže 500 niti na prvi obisk neprijavljenega uporabnika.

### F0.3 — Dodaj mobilno navigacijo

- Trenutna koda v `src/components/landing/platform-landing.tsx`:
  - `nav` ima `hidden ... lg:flex` (vrstice 87–106),
  - prijava ima `hidden md:inline` (116–121),
  - CTA ima `max-[420px]:hidden` (122–128).
- Ukrep: dodaj `useState` + hamburger gumb + sheet/drawer. Vanj dati: `Moduli, Primeri, Kako deluje, Paketi, Cene, Prijava, Začni brezplačno`.
- Zapri meni ob kliku povezave in ob `Escape`.
- **Sprejemno merilo:** pri 390×844 so vse povezave dosegljive iz glave, brez skrolanja 6000 px.

### F0.4 — Odstrani lažni social proof na naslovnici

- Datoteka: `src/components/landing/platform-landing.tsx`, vrstice 193–214.
- Odstrani: zvezdice, `4.9/5`, `več kot 500 zadovoljnih podjetij`, štiri generirane začetnice `A E C D`.
- Dokler ni resničnih mnenj, prikaži en resničen produktni dokaz: posnetek resnične rezervacije ali resnične strani podjetja.
- **Sprejemno merilo:** v DOM-u ni nobene številke, ki ne izhaja iz baze.

### F0.5 — Odstrani lažne številke na tržnici

- Datoteka: `src/components/marketplace/hero-section.tsx`:
  - vrstice 75–92: `floatingCards` z `Lassana Salon` in `Barbershop AS`,
  - vrstice 95–97: `useAnimatedCounter(12500)`, `(500)`, `(85)`,
  - vrstica 144: `432.594 terminov rezerviranih danes`,
  - vrstica 159: `milijoni po vsem svetu`.
- Ukrep: vse skrij ali zamenjaj z agregati iz Prisma poizvedb (`COUNT` rezervacij, `COUNT` podjetij, `COUNT` mest).
- **Sprejemno merilo:** nobena od teh vrednosti se ne pojavi v HTML-ju; vsaka prikazana številka ima SERVER-side vir.

### F0.6 — Popravi iskanje

- Naslovnica: `platform-landing.tsx`, vrstice 252–266. `<input>` nima `name`/state-a, gumb je `<Link href="/podjetja">`.
- Tržnica: `hero-section.tsx`, vrstice 162–176. Enaka težava.
- Ukrep:

```tsx
const [q, setQ] = useState("")
const [location, setLocation] = useState("")

<form action="/podjetja" method="get">
  <input name="q" value={q} onChange={(e) => setQ(e.target.value)} />
  <input name="location" value={location} onChange={(e) => setLocation(e.target.value)} />
  <button type="submit">Išči</button>
</form>
```

- V `/podjetja` preberi `searchParams`, filtriraj v Prisma in predizpolni polji.
- **Sprejemno merilo:** vnos `frizer` + `Ljubljana` privede do `/podjetja?q=frizer&location=Ljubljana` in filtriranih rezultatov.

### F0.7 — Uskladi demo z obljubo

- `Oglej si, kako deluje` odpre `DemoTour` z `vertical="cebelar"`, čeprav je naslovnica generična.
- Ukrep: preimenuj v `Oglej si demo` in dodaj izbiro panoge, ali naredi generičen demo.
- **Sprejemno merilo:** obiskovalec ni presenečen nad čebelarskimi števci.

### F0.8 — Popravi PWA manifest

- `public/manifest.json` reference manjkajoče `/icons/icon-*.png`, manjkajoče screenshots in napačno shortcut `/moji-termini` namesto `/my-appointments`.
- Ukrep: generiraj resnične ikone 192/512, dodaj screenshot-a, popravi shortcut.
- **Sprejemno merilo:** Lighthouse PWA installability brez napak.

---

## 4. FAZA 1 — Eno delujoče jedro

Izberi **eno** panogo, priporočam `beauty` ali `barber`. Zgraditi moraš ta krog, ne describati novih modulov:

```txt
Stran podjetja → izbira storitve → izbira termina → depozit → potrditev
→ opomnik → prihod → plačilo → mnenje → ponovna rezervacija
```

### Obvezne popravke obstoječih lažnih površin

| Površina | Datoteka | Trenutno | Popravek |
|---|---|---|---|
| Izvoz podatkov | `src/components/dashboard/data-connector.tsx:131-146` | `setTimeout` + toast "Izvoz končan", nobene datoteke | Resničen export iz baze → CSV → download |
| Moderacija mnenj | `src/components/dashboard/reviews-manager.tsx` | lokalni `setItems`, ni DB zapisa | Server action + `prisma.review.update` |
| Mnenja stran | `src/app/(admin)/dashboard/reviews/page.tsx:41-42` | vse forced na `APPROVED` | Pravi `status` iz baze |
| Profil zaposlenega | `src/components/staff/staff-profile-form.tsx:69-81` | `TODO`, `console.log`, toast "Profil posodobljen" | `updateStaffProfile` server action + DB write |
| Marketing števila | `src/app/(admin)/dashboard/marketing/page.tsx:43-46` | `VIP: 12, Redne: 45, Nove: 23` | `COUNT` po tagu in konsenzu |
| Waitlist zavihek | `src/app/(admin)/dashboard/appointments/page.tsx:266` | `<WaitlistManager entries={[]} />` | Pravi waitlist iz baze |

**Sprejemno merilo za celo fazo:** vsak uspešni toast ima za seboj `prisma.*.create/update/delete`. Če nima, ga odstrani.

---

## 5. FAZA 2 — Pridobivalni krog (to je Freshin resnični lok)

1. **Pravi marketplace.** Ne samo katalog podjetij, ampak: lokacija, kategorija, razpoložljiv termin, cena, ocena, neposredna rezervacija brez registracije.
2. **Lokalni SEO.** Generiraj strani ` /podjetja/{kategorija}/{mesto}` iz resničnih podjetij. Dodaj `LocalBusiness` JSON-LD, resnične ure, resnično lokacijo.
3. **Mnenja z resničnim krogom.** Pozvani po opravljenem terminu, ne ob odprtju strani. Odgovor podjetnika, moderacija, `verified` zastavica.
4. **Dvosmerna komunikacija.** SMS/WhatsApp/Instagram inbox s konsenzom in predlogami. Ne samo obvestila v eno smer.
5. **AI sprejemnik.** Odgovarja iz resničnih podatkov podjetja: storitve, cene, ure, prosti termini. Zna rezervirati in zna povedati, ko ne ve — potem preusmeri na človeka.
6. **Zvestoba.** `deposit`, `card on file`, `no-show pravila`, članstva, paketi, darilni boni, samodejna ponovna rezervacija, waitlist, ki se sam zapolni.

---

## 6. FAZA 3 — Operacija in ekipa

- **Ekipa:** smene, urni trak, evidence, nadomestila, vloge in pravice. Danes imamo samo profil, ki se ne shrani.
- **Plačila:** per-tenant Stripe že obstaja — dodaj uskladitev, refund, depozite in poročilo o provizijah.
- **Poročila:** najmanj: prihodek po storitvi, po zaposlenem, po dnevu; retencija; LTV; zasedenost urnika; pametna cena glede na povpraševanje.
- **Integracije:** Google Business Profile, Google/Meta kalendar, e-racuni za Slovenijo, Zapier.
- **Mobilno:** namestljiv PWA s pushom in offline koledarjem.

---

## 7. FAZA 4 — 2027

Šele po fazah 0–3:

- AI povzema klice in pogovore, predlaga cene, piše opise storitev.
- Več lokacij z centralnim upravljanjem in ločenimi pravicami.
- Partner app z napovedmi, cilji in tedenskim povzetkom.
- Odprt API za integratorje.
- Tržnica z resničnim povpraševanjem, ne z dekorativnimi karticami.

---

## 8. Kaj izrecno NE narediti

- Ne dodajaj nove panoge, dokler prva nima celega kroga.
- Ne objavljaj novih "success" toastov brez DB zapisa.
- Ne piši več gradientov in dekorativnih animacij, dokler je desna polovica heroja prazna.
- Ne prehajaj na Paid plan brez odločitve med Workers Paid in Vercel.
- Ne meri uspeha po številu modulov. Meri ga po **prvem rezerviranem terminu**.

---

## 9. Kaj merimo — postavi te števce takoj

| Metrika | Cilj |
|---|---|
| Dostopnost `/`, `/start`, `/podjetja` | 100 % v zadnjih 50 poizkusih |
| `/api/auth/session` 500 | 0 |
| Čas do prve rezervacije | < 60 s na mobilnem |
| Stopnja konverzije obisk → podjetje | meri pred optimizacijo |
| Ponovni obisk v 90 dneh | meri od prvega resničnega meseca |
| Število lažnih številk v DOM-u | 0 |
| Uspešnih toastov brez DB zapisa | 0 |

---

## 10. Seznam za jutri — po vrstnem redu

1. Odloči: **Vercel** ali **Workers Paid**. Ne odlašaj.
2. Stabiliziraj `/`, `/start`, `/podjetja`, `/api/auth/session`.
3. Dodaj mobilni hamburger meni.
4. Izbriši `4.9/5`, `500 podjetij`, `432.594`, `milijoni`, `Lassana`, `Barbershop`.
5. Priključi iskanje na `?q=` in `?location=`.
6. Popravi `Oglej si, kako deluje`.
7. Popravi PWA manifest.
8. V enem sprintu pokrij vseh 6 lažnih površin iz tabele v fazi 1.
9. Izberi eno panogo in jo naredi globoko.
10. Šele nato začni graditi pridobivalni krog.

---

## 11. Z zaključkom vsake faze

Preden označiš katero koli fazo kot končano, odgovori na tri vprašanja:

1. **Ali vsaka številka na zaslonu prihaja iz baze?**
2. **Ali vsak uspeh, ki ga vidi uporabnik, obstaja tudi v bazi?**
3. **Ali lahko podjetnik brez razvijalca opravi cel krog od objave do plačila?**

Če je odgovor na katerokoli vprašanje **ne**, faza ni končana — ne g naprej.
