# F5.2.0 — Arhitekturna analiza kategorij

> **Namen:** arhitekturna analiza PRED implementacijo. **Ni bila spremenjena nobena koda niti Prisma shema.** Ta dokument je osnova za pregled in odobritev (task F5.2: "Po pripravi arhitekture počakaj na pregled in odobritev").
>
> **Kontekst:** F5.1.4 je bil pred tem pregledan in popravljen (manjkajoči `stripeSessionStateResolver`), preden se je začela ta analiza — glej §15.7 v `docs/F5-1-ZAKLJUCNI-PREGLED.md`. Ta analiza stoji na preverjeni, zeleni osnovi (27/27 F5.1 integracijskih testov).

---

## 1. Pregled trenutnega stanja (dokazno, z datotekami)

### 1.1 Podatkovni model kategorije (Prisma)

`Category` (`prisma/schema.prisma:483–506`):

```
id, name (String), slug (String)
presetSeed String?                // P2 #59: izvor (vzorčna vrsta)| null = lastniško ustvarjena
organizationId String?            // NULLABLE — globalna/vzorčna kategorija lahko nima najemnika
createdAt, updatedAt
@@unique([organizationId, slug])  // slug edinstven znotraj najemnika
@@index([organizationId]), @@index([slug])
```

**Najpomembnejše ugotovitve:**
- **NI** polj za: opis, sliko, vrstni red/pozicijo, `isActive`, starševsko kategorijo (podkategorija), `deletedAt` (arhiv).
- `organizationId` je **nullable** in `onDelete: Cascade` na `Organization` (495). To je rahlo tvegano: logično naj bi bila kategorija vedno vezana na najemnika, a model to dopušča (vzorčne vrste z `organizationId = null` bi bile možne). Dejansko vse kategorije gradijo s `organizationId: orgId`.
- Povezava z **enim elementom**: `Service.categoryId String?` (530) + `Product.categoryId String?` (1134), oba `onDelete: SetNull` (544, 1145). → **en element v natanko eni kategoriji (ali nobeni); ni mnogo-na-mnogo.**

### 1.2 Kategorijske akcije

Edina akcija je `src/app/actions/categories.ts`:
- `createCategory(name)` (42–92): ustvari kategorijo iz **samo imena** (name → slug prek `uniqueSlug`, 28–40). Idempotentna po enakem imenu (63–72). Validacija imena v `category-picker.ts` (2–60 znakov). Zaščita `requireAnyPermissionOrg(["products.manage","services.manage"])` (46).
- **Manjkata**: update, delete, reorder, image, description, isActive, subcategory, iskanje/filtriranje, stran za upravljanje.

### 1.3 Povezave v obstoječi kodi

- `src/app/actions/products.ts`: `include category` (35), filter `categoryId` (152), validacija kategorije pripada org (322–328), `category: { connect: { id } }` (336). Enako pri update (385–400).
- `src/app/actions/services.ts`: `getCategoriesWithCount` (154, stranske–sidebar), filter po `categoryId` (244), `getAllCategories` (378).
- `src/lib/public-site.ts`:
  - `getPublicServicesGrouped` (223–241): **storitve združi po kategoriji** za javno stran.
  - `getPublicCategories` (244–250): kategorije za filter storitev. **Nima slik/opisov/vrstnega reda — samo `id`, `name`.**
  - `getPublicRelatedServices` (291+): sorodne storitve v isti kategoriji.
- Javni prikaz:
  - Storitve: `src/app/(public)/services/page.tsx` (49–87) — groupira po kategoriji; `services/[slug]/page.tsx` (167–170) — kategorijski badge + breadcrumb.
  - Rezervacija: `src/app/(customer)/booking/page.tsx` (156–187) — groupira po kategoriji.
  - Trgovina (izdelki): `src/app/(customer)/shop/page.tsx` — **raven grid brez grupacije/filtra po kategoriji** (samo search); izdelek v `shop/[slug]/page.tsx` (204–208) ima kategorijski badge. `getPublicCategories` za izdelke ni uporabljen.
- Admin: `src/app/(admin)/dashboard/products/page.tsx` (38–221) — filter po kategoriji; (358) stolpec kategorija. `services/page.tsx` (152) prikaže ime kategorije.
- Promocije: `src/app/actions/promotions.ts` scope `CATEGORIES` (173–177) — org-scoped validacija kategorij.

**Sklep:** kategorije se danes uporabljajo za: združevanje storitev na javni/booking strani, filter izdelkov v adminu, badge, promocije scope. Trgovina izdelkov NI grupirana po kategoriji.

### 1.4 Capability matrix in 34 poslovnih profilov

- `src/lib/profiles/registry.ts`: `PROFILE_LIST` (211) → `PROFILES` (1841), `getProfile` (1846), `GENERIC_PROFILE_ID = "generic"` (1844).
- **34 profilov** = 12 prepoznavnih + 22 SKD (NACE). 12 prepoznavnih: `beauty, frizer, barber, nails, cosmetica, massage, epilation, generic, seamstress, tire-service, mehanik, beekeeping`. SKD serija: `skd-a…skd-v` (22).
- `CapabilityMatrix` (`src/lib/profiles/types.ts:13–45`): 15 ključev — `appointments, workOrders, shop, services, inventory, customers, staff, analytics, reviews, forms, workflows, documents, delivery, walkIn` (+ še en). Vsak s stanjem `"required" | "optional" | "disabled"`.
- `isCapabilityEnabled(profile, key)` (`registry.ts:1869–1871`): `capabilities[key] !== "disabled"` — master gate.
- `modulesForVertical` (`modules.ts:63–71`): seznam modulov iz ne-disabled capability → poganja sidebar/vmesnik.
- Uporabniški override: `src/lib/profiles/overrides.ts` — lastnik lahko spreminja samo `"optional"` capability; `"required"` zaklenjena (120–122).
- Modulni preklop nazadnje odloča: `src/lib/modules/catalog.ts` `effectiveCapabilities` (180–197) — `DEACTIVATED` → disabled, `ACTIVE/HIDDEN` na disabled → optional.

**Pomen za kategorije:** "ali dejavnost uporablja trgovino/storitve" določa capability `services` in `shop`. Npr. `beekeeping` nima storitev in ima izdelke; `tire-service`/`mehanik` imata delovne naloge (`workOrders`) in storitve; `generic` je fallback.

### 1.5 SKU/SKD katalog in predloge dejavnosti

- `src/lib/verticals.ts`: `VerticalPreset { id, label, description, palette, currency, locale, timezone, categories: PresetCategory[], products?: PresetProduct[], siteContent }` (359–396). `PresetCategory { name, slug, services: PresetService[] }` — **kategorija kot starš s servisi**.
- `seedOrganizationCatalog` (930–1052): najprej (opcijsko) pobriše tuje-prednastavljene vzorčne vrstice (954–997), nato za vsak `presetCategory` ustvari `Category` + pod njim vsak `Service` s `categoryId: category.id` (1001–1025). Izdelke (`products`) ustvari prek `createMany` **brez kategorije** (1030–1049) — `categoryId` pri izdelkih iz predloge NI nastavljen.
- Prehod na drug profil: `src/app/actions/guided-entry.ts` (105–146) — če katalog ni v uporabi (0 terminov+naročil), pobriše `prepaid, service, product, category` (137–140) in ponovno seeda → **kategorije se ob zamenjavi dejavnosti DRMATIČNO prebrišejo**. Če je v uporabi → `catalogNote = "in-use"`, ne briše.

**Sklep za §4:** predloge kategorij so vezane na `vertical` (profil), ne na capability. Tudi profili z `services: []` (čebelarstvo) lahko dobijo kategorijski predlog, ampak danes predlog kategorij pride le s `seedOrganizationCatalog` (ko so kategorije 0). Profili z izklopljeno trgovino (npr. nekateri SKD) kategorijskih predlog ne dobijo posebej.

### 1.6 Pravice in organizacijska izolacija

- Vsaka kategorija nosi `organizationId`; edina akcija preverja `products.manage`/`services.manage` (categories.ts:46).
- Vsi branji v javni poti so org-scoped: `getPublicCategories(orgId)` (public-site.ts:244) uporablja `where: { organizationId: orgId }`.
- Ažuriranje izdelkov/storitev validira, da kategorija pripada org (products.ts:322). Promocije prav tako (promotions.ts:173–177).
- **Vrzel:** delovanje je org-scoped na bralni poti, a NI ločene "category.update/category.delete" akcije; co najkategorija po hierarhiji (ko bo dodana) preverja org na strežniku. Trenutno `organizationId` nullable pomeni, da bi morebitni globalni seed lahko šel mimo. Treba je zagotoviti **vedno** `organizationId != null` za lastniške.

---

## 2. Ciljna uporabniška izkušnja (željena)

Podjetnik upravlja kategorije v svojem workspaceu, brez programiranja:

1. **Ustvarjanje** kategorij **in podkategorij** (hierarhija starš→otrok, npr. frizer → "Nega las" ⊂ "Lasje").
2. **Urejanje imen in opisov** (slik).
3. **Dodajanje slik** (kjer je smiselno — trgovina izdelkov, javna ponudba).
4. **Spreminjanje vrstnega reda** (drag in drop / številčni `order`).
5. **Aktiviranje/deaktiviranje** (`isActive`) — skrito z javnega, ne izbrisano.
6. **Brisanje ob varnem preverjanju** povezanih izdelkov in storitev (servert: `SetNull`-kot danes, a z jasnim opozorilom, koliko elementov bo izgubilo kategorijo).
7. **Iskanje in filtriranje** (po imenu, staršu, stanju).
8. **Predogled** kategorij v trgovini/predstavitvi ponudbe.

Pomembno: podjetnik ne vidi tehničnih `slug`/-ov; UI upravlja imena, slug se ustvari samodejno in ostane stabilen (neviden).

---

## 3. Prilagajanje dejavnosti

Ne predpostavljamo enotnih kategorij. Nadgradnja obstoječega `vesticals.ts`:
- **Predloge kategorij naj bodo lastnost profila** (že v `VerticalPreset.categories`), AMPAK s **hierarhijo** (podkategorije) in **tem, ali je kategorija za izdelke, storitve ali oboje** (`entityKinds: ["products","services"]`). Npr.:
  - frizerstvo: Lasje ⊃ {Striženje, Barvanje, Nega}, Izdelki ⊃ {Nega las doma};
  - avtoservis: Servis ⊃ {Motor, Zavore, Pnevmatike}, Delovni nalogi;
  - šiviljstvo: Popravila, Oblačila po meri, Izdelki;
  - kozmetika: Nega obraza, Tretmaji, Nega telesa.
- Vsak profil mora imeti **rešitev tudi z izklopljeno trgovino**: za `services`-only profile se kategorije uporabljajo za storitve; ko je `services` disabled in `shop` disabled (npr. čisti SKD profile z delovnimi nalogi), se kategorije lahko uporabijo za **delovne naloge / vrste del** ali pa se predlog preskoči (kategorij ni treba vsiliti vsem).

---

## 4. Arhitekturne odločitve (priporočila, utemeljena z obstoječo kodo)

| Odločitev | Priporočilo | Utemeljitev (koda) |
|---|---|---|
| **Skupne ali ločene kategorije za izdelke in storitve** | **SKUPNE** (eno drevo), z `entityKinds` oznako; element se poveže z eno kategorijo | Danes je `Category` ŽE skupen model z `services[]` + `products[]` relacijama (500–501) in oba elementa uporabljata isti `categoryId` (530, 1134). Ločevanje bi podvojilo model brez koristi. `entityKinds` omeji predlog na profil (izdelki-only za `beekeeping`, storitve-only za frizer). |
| **Hierarhija** | **Da**, `parentId String?` (`self` relacijo), `ORDER`/`left/right` za zaporedje | Želena UX incl. podkategorij. Drevo omogoča "Izbrani izdelki" pod sektorjem. `onDelete` za starša = `SetNull` ob brisanju (otroci postanejo korenski), NE kaskada. |
| **Več kategorij na element** | **Ne** (ostane 1-kategorija) v PRVEM valu; opcija mnogo-na-mnogo kot follow-up | Današnja shema nima join tabele in vsi filtr/sort kode deluje na eno `categoryId`. Dodajanje M:N bi prizadelo `getPublicServicesGrouped`, filter izdelkov, promocijo `CATEGORIES`. Najprej hierarhija + poenostavljeno eno-kategorijo; M:N je ločeno delo. |
| **Unikatnost imen in URL-slugov** | Ime **ni** globalno unikatno (lahko dve kategoriji isto ime pod različnima staršema), **slug JE** unikaten znotraj org (`@@unique([organizationId, slug])` — že obstaja, 503). Podkategorije dobijo slug, ki upošteva koren (npr. `lasje-nega`). | `@@unique([organizationId, slug])` (503) že varuje slug; to ohranimo. Idempotenca po imenu (categories.ts:63) se omili: samo znotraj istega starša in entityKinds. |
| **Predloge kategorij po profilih** | Da, iz `VerticalPreset.categories`, razširiti v `preset-seed` s hierarhijo + entityKinds; ohraniti `presetSeed` provenance | `seedOrganizationCatalog` (verticals.ts:930) že uporablja `presetSeed` za označevanje in zamenjavo vzorčnih vrstic. Podkategorije dodamo kot rekurzivno `parentId` pri seedanju. |
| **Varno arhiviranje in brisanje** | `isActive` (arhiviraj, skrij z javnega) + ob brisanju **strežnik poveže koliko izdelkov/storitev bo izgubilo kategorijo** in to javi; `onDelete: SetNull` (544/1145) OH – ne briše elementov | `getPublicServicesGrouped`/shop filter uporabljata `isActive` na elementih; kategorije danes nimajo `isActive` — dodamo ga na Category in ga filtriramo na javni poti. Brisanje kategorije po shemi že `SetNull` (elementi ostanejo). |
| **Vedénje ob zamenjavi profila** | Ko kategorije niso v uporabi, jih `guided-entry` še vedno lahko zamenja (že obstaja, 137–140). ANPRAK **ohranimo lastniško ustvarjene** kategorije in le nadomestimo `presetSeed != null` vzorčne (to logiko `seedOrganizationCatalog` že ima — 954–997). Dodamo `isActive` in podkategorije v ta postopek. | `seedOrganizationCatalog` (954–997) že briše le tuje-prednastavljene in PUŠČA lastniške. Obnovimo enako za hierarhijo. |

---

## 5. Varnost in podatki

- **`organizationId` obvezen**: pri ustvarjanju API vedno `organizationId: org.id` (categories.ts:75–80) — zagotovimo, da se nova kategorija ne ustvari z `null`.
- **Izolacija A/B**: vsaka kategorija (in vsak podrejeni element) mora biti preverjena z `organizationId` na **strežniku** v VSEH akcijah (širjenje obstoječe prakse iz products.ts:322–328, promotions.ts:174–177).
- **Strežniška validacija** za vsako novo akcijo (update/delete/reorder/subcategory): `requireAnyPermissionOrg` + `findFirst({ id, organizationId })`.
- **Brisanje ne sme izbrisati elementov**: uporaba `onDelete: SetNull` (že obstaja za kategorične referenc izdelkov/storitev 544/1145) — ob brisanju kategorije se izdelki/storitve ohranijo (postanejo "brez kategorije").
- **Trajnost podatkov**: obstoječe vrstice in podatki se ob migraciji ohranijo (dodajamo le nove nullable/defaulted stolpce).

---

## 6. Končno poročilo

### Kaj že obstaja
- `Category` model (id,name,slug,presetSeed,organizationId) z relacijami `services[]`,`products[]` in `@@unique([organizationId,slug])`.
- `createCategory` (samo ime) + idempotenca, org-scoped, zaščita z dovoljenji.
- Predloge kategorij v `verticals.ts` s `presetSeed` provenance in `seedOrganizationCatalog`.
- Uporaba kategorij: grupiranje storitev na javni/booking strani, filter izdelkov v adminu, badge, promocije `CATEGORIES`, getPublicCategories.
- Prehod profila: guided-entry z varnim/uporabniškim katalogom (brisanje if-unused).

### Kaj manjka
- Hijerarhija (podkategorije), opis, slika, vrstni red, `isActive`, arhiviranje.
- Akcije update/delete/reorder/active, ločena stran za upravljanje kategorij.
- Iskanje in filtriranje kategorij (admin).
- Grupiranje **izdelkov** po kategoriji v trgovini (danes le badge).
- Predogled kategorij v javni trgovini/ponudbi (manjka).
- Trgovina trenutno ne ponuja kategorijskega filtra/lookupa (samo admin filter).
- Za profili z izklopljeno trgovino nedefinirano, kako predlog kategorij uporabiti (workOrders).

### Priporočena podatkovna struktura (aditivno, brez produkcijske migracije zdaj)
Dodati polja modelu `Category`:
```
parentId      String?   // self-relation, onDelete: SetNull (otroci → koren)
description   String?   @db.Text
image         String?   // Cloudinary Public ID (isti vzorec kot Service.imageUrl, 517)
order         Int       @default(0)
isActive      Boolean   @default(true)
entityKinds   EntityKinds[] @default(["services","products"]) // kje prikaz (opc.)
deletedAt     DateTime? // mehki delete/arhiv (opcionalno ali isActive zadostuje)
```
+ `Category` naveže `parent  Category? @relation("CategoryTree", fields:[parentId], references:[id], onDelete: SetNull)` in `children Category[] @relation("CategoryTree")`.

### Uporabniški tok
1. Navigacija: stran "Kategorije" (nov route, npr. `dashboard/categories`).
2. Ustvari koren ali podkategorijo (starš, ime, opis, slika, vrstni red).
3. Uredi/preuredi (drag-and-drop `order`), arhiviraj `isActive`, išči.
4. Ob brisanju strežnik javi "N kategorij bo postalo korenskih, M izdelkov/storitev bo ostalo brez kategorije" → potrdi.
5. Predogled: povezava na javni /services, /booking, /shop (org-scoped).

### Povezava s profili in dejavnostmi
- Predlog kategorij iz `vertical.categories` + hierarhija + entityKinds.
- Ko se `service`/`shop` capability spremeni, `materialize`/`seedOrganizationCatalog` dopolni kategorije (ne-preglašuje lastniških).
- Za profile z delovnimi nalogi (`workOrders`) kategorija lahko označuje vrsto dela.

### Potrebne spremembe
- schema: dodati polja (aditivna migracija, nova, samo testna baza).
- nov akcijski set `categories-manage.ts` (update/delete/reorder/setActive/subcategory).
- nova admin stran `dashboard/categories`.
- javna pot: `getPublicCategories` vrniti `isActive=true`, `order`, `parent`; izdelke grupirati po kategoriji v /shop; kategorijski filter izdelkov v trgovini.
- predloge v `verticals.ts` razširiti.
- validacija org na strežniku vsaka pot.

### Migracijski načrt (aditivni)
1. Nova migracija (npr. `20261203000000_f5_2_categories`), samo `markec_f51_test` (nikoli prod): `ALTER TABLE "Category" ADD COLUMN "parentId" ...`, `description`, `image`, `"order" int default 0`, `"isActive" bool default true`, `"entityKinds"`.
2. Backfill: odvisno od obstoječega kataloga — ni predelav podatkov, saj vsa nova polja imajo defaults/nulls.
3. Preveriti z `prisma migrate status` na testni bazi.
4. BREZ produkcijske migracije.

### Varnostna tveganja
- `organizationId` nullable → na vsaki novi akciji strežniško preveri `organizationId: org.id`.
- M:N (follow-up) bi olajšala invalidno povezovanje tuje kategorije na element — obdržimo eno-kategorijo na začetku in ohranimo org-scope na vsaki akciji.
- Mehki delete vs brisanje: če `isActive=false`, javna stran ga mora skriti; brisanje pa mora `SetNull` elemente, ne izbrisati.
- Slike (Cloudinary): odpoved pri nalaganju ravnaj enako vidno (isti error handling kot Service.imageUrl).

### Sprejemni testi
1. Uporabnik ustvari kategorijo + podkategorijo (imena, slug jedinstven znotraj org).
2. Urejanje imena/opisa/slike/vrstnega reda deluje.
3. `isActive=false` skrije kategorijo z javne strani (services/shop), ne pa v adminu.
4. Brisanje kategorije: N izdelkov/storitev obdrži `categoryId=NULL`, noben element se NE izbriše.
5. Podkategorija po brisanju starša postane koren (parentId=null).
6. Org A ne vidi/spreminja kategorij Org B (strežniški test, ne samo UI).
7. Zamenjava profila (guided-entry) za nezaseden katalog → predloge kategorij/servisov/izdelkov zamenjane; za lastniški katalog → ohranjen, `presetSeed` lastniški ostaja.
8. Filter in iskanje kategorij v adminu.
9. Predogled kategorij v javni trgovini/ponudbi je org-scoped in upošteva `isActive`+`order`.

---

## Priloga: potrjena dejstva iz kode
- Capability `services`/`shop` (types.ts) odloči o prikazu profila; `isCapabilityEnabled` v registry.ts:1869.
- `seedOrganizationCatalog` (verticals.ts:1001–1025) ustvari Category → Service s `categoryId`; izdelke BEZ kategorije (1030–1049).
- `guided-entry.ts:140` pobriše kategorije ob zamenjavi nezasedenega profila; `seedOrganizationCatalog` (954–997) pa ohranja lastniške.
- `getPublicCategories` (public-site.ts:244) vrača samo `{id,name}`, brez vrstnega reda/aktivnosti/hierarhije; `getPublicServicesGrouped` (223–241) grupira storitve po kategoriji.