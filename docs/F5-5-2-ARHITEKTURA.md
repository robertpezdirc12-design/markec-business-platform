# F5.5.2.0 — Arhitekturna analiza galerij in FAQ

> **Samo analiza obstoječe kode — nobena koda ali Prisma shema ni bila spremenjena.**
> Namen: ugotoviti, kaj galerije in FAQ že imamo, kaj manjka, ter pripraviti priložen
> podatkovni model in uporabniški tok. Brez implementacije, brez produkcijskih migracij,
> brez commit/push, WIP drugih nespremenjen.

---

## 1. Povzetek: kaj ŽE obstaja

### 1.1 Upload / mediji
- **Cloudinary** (`src/lib/utils/cloudinary.ts`): ko je `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  nastavljen, se slike nalagajo na Cloudinary (ogled: `getCloudinaryUrl` s transformacijami
  `w/h/crop` in presets `cloudinaryPresets`). Springback: **DB `Media`** model (base64, org-scoped,
  storage quota E3-7, max 5 MB, `/api/media/[id]`).
- **`src/app/api/upload/route.ts`**: prijava (session), **role-gate** (ADMIN/STAFF za site content,
  CLIENTE samo avatar), tip (image/) in velikost file validacija, org via `getSessionOrg`.
  Cloudinary `public_id` je **server-generiran** (IDOR-protected). Pravijo tujih medijev ne morejo
  prepisati.
- **`/api/media/[id]`**: (V-3/issue #102) vsak dostop gre skozi `decideMediaAccess` — public site →
  public immutable cache; draft/suspended → member/operator only, odstranjeni zaposleni → denied;
  404 (ne 403) za tuje. **Varnost medijev je že trdna.**

### 1.2 `SiteContent` — JSON v `SalonConfig.siteContent`
Obstojne sekcije (SAMPLE_KEYS): `hero`, `features`, `services`, `about`, `team`, `reviews`,
`shop`, `cta` + `sections[]` (vidnost/vrstni red) + `customSections` (do 6) + `openingHours`,
`social`, `seo`, `nav`.
- Slike: **hero (1 imageUrl/posterUrl)**, **about (1)**, **cta (1)**, **custom section (1 imageUrl)**.
- **Ni namenske galerije** (več fotek, naslov, opis, vrstni red, cover) in **ni FAQ sekcije**.

### 1.3 Modela `ServiceGallery` in `ServiceFAQ` (Prisma, obstojata)
- `ServiceGallery`: `imageUrl` (Cloudinary Public ID), `caption?`, `order`, `serviceId`.
- `ServiceFAQ`: `question`, `answer`, `order`, `serviceId`.
- **Oba nimata admin CRUD UI niti javnega prikaza** (F5.5.0 potrjeno; edina uporaba
  `ServiceGallery` je branje v `default-media-migration`, ne upravljanje). Sta čista "placeholder"
  modela — lastnik ne more ničesar urediti/odstraniti.

### 1.4 Javni renderer + vizualni urejevalnik
- `renderCustomSection` v `home-content.tsx` uporablja **`next/image`** (fill, `sizes`,
  `quality={85}`, `alt={custom.title}`) — optimizacija/alt za custom je dobra, a **1 slika/section**.
- `site-visual-editor.tsx`: `patchSection` + `Field` (besedilo/slika/gumb), reorder/toggle/remove/
  add section, `applyImageField` (eno sliko na sekcijo). **Nima galerijskih/FAQ urejevalnih orodij.**

---

## 2. Zahteve podjetnika → preslikava na obstoječe / manjkajoče

| Zahteva | Obstaja? | Kje/Ident. |
|---|---|---|
| Ustvari **več galerij** | NI | samo 1:1 `ServiceGallery`; ni kolekcije po podjetju. |
| **Dodaja fotografije** | DELNO | Cloudinary/`Media` upload obstaja; ni galerijskega zbiralnika. |
| **Ureja naslove in opise** | NI | `ServiceGallery.caption` ni uredljiv; ni title/description polja. |
| **Vrstni red** | DELNO | `ServiceGallery.order`/`ServiceFAQ.order` so v shemi, a neupravljivi. |
| **Odstranjuje fotografije** | NI | ni delete UI za galerijske elemente. |
| **Poveže z izdelki/storitvami/projekti** | DELNO | `ServiceGallery` le za storitve; izdelki/projekti nimajo galerije. |
| **Določi javne galerije** | NI | ni `isPublic` na galeriji (le posredno `isActive`). |
| **Naslovna fotografija (cover)** | NI | ni `coverImageId`. |
| FAQ: dodaj/uredi/zbriši in razvrsti | DELNO | `ServiceFAQ` model; brez UI. |
| FAQ po kategorijah | NI | ni category. |
| FAQ javna vidnost / izbor za prikaz | NI | ni `isPublic`/selected. |

**Ključen sklep:** upload + org-media varnost + `SiteContent` so **dobra podlaga**. Manjka
**galerijska struktura** (več galerij z več slikami) in **FAQ urejanje**, kjer `SiteContent` lahko
reši preprost FAQ/omejeno galerijo, medtem ko **dodatna tabela** reši galerije s polnim nadzorom.

---

## 3. Priporočeni podatkovni model

Ne podvajamo obstoječega upload sistema (Cloudinary/`Media` se uporabi kot storage za `mediaId`);
novi objekti so zgolj **organizacijski kontejnerji nad obstoječo medijsko plastjo**.

### 3.1 Galerija (polna, priporočena)
```prisma
// LASTNIŠKA GALERIJA — org-scoped, več slik, javna vidnost.
model Gallery {
  id             String  @id @default(cuid())
  organizationId String
  title          String
  description    String? @db.Text
  coverImageId   String?          // mediaId (Cloudinary publicId ali Media.id) — naslovna foto
  isPublic       Boolean @default(true)
  position       Int     @default(0)
  // Opcijska povezava na entiteto: SERVICE / PRODUCT / PROJECT.
  sortableType   String?          // "service" | "product" | "project" | null (standalone)
  sortableId     String?          // serviceId / productId / projectId
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  items          GalleryItem[]
  @@index([organizationId])
  @@index([organizationId, isPublic])
  @@index([sortableType, sortableId])
}

model GalleryItem {
  id             String   @id @default(cuid())
  galleryId      String
  mediaId        String            // reference na Cloudinary publicId ali Media.id (url)
  caption        String? @db.Text
  alt            String?           // alt besedilo (dostopnost / SEO)
  position       Int      @default(0)
  isPublic       Boolean  @default(true) // per-slika javna vidnost
  createdAt      DateTime @default(now())
  gallery        Gallery  @relation(fields: [galleryId], references: [id], onDelete: Cascade)
  @@index([galleryId])
  @@index([galleryId, position])
}
```

### 3.2 FAQ (dva bližja — odvisno od obsega)
- **(a) Lahki / brez migracije s poljem v `SiteContent`:** dodamo `faq?: { title?: string;
  items: { question: string; answer: string; category?: string; visible: boolean }[] }` v
  `SiteContent` JSON. Spodobno za manjša podjetja, brez Prisma spremembe; urejanje prek
  obstoječega vizualnega editorja (nov `Field` podform). Omejeno: ni vrstnega reda po več, ni
  per-org relacij, ni sledi zgodovine (edini strošok je JSON diff v ConfigChangeLog).
- **(b) Robustni / podatkovni:** razširimo `ServiceFAQ` ali nov **`FaqItem`** (organizationId,
  question, answer, category?, position, isPublic, sortableType/Id optional).
  Priporočeno **b**, ker ponuja organizacijsko vidnost, zgodovino (ConfigChangeLog na rows)
  in skalira; obstoječi `ServiceFAQ` se refaktrorira ali vzdrži ločeno (brez podvajanja funkc.
  — če ostane `ServiceFAQ`, dobimo admin CRUD po zgledu `catalog.ts`).

Zaključek modela: **`Gallery` + `GalleryItem` (nova, org-scoped, nad obstoječo medijsko plastjo)
+ FAQ kot polje v `SiteContent` (a) ali `FaqItem` (b)** — konkretno b, ker omogoča vidnost in
zgodovino, ter ne sega v modele, ki jih nihče ne ureja.

---

## 4. Uporabniški tok

### 4.1 Galerije
1. **Podjetnik vidi** v dashboard-u novo/uporabno sekcijo "Galerije" (priporočeno znotraj
   obstoječe "Izgled in vsebina" ali modulnega sklopa).
2. **Ustvari galerijo**: naslov, opis, izbirna povezava (storitev/izdelek/projekt), javna vidnost,
   cover.
3. **Doda fotografije**: nalaga prek obstoječega `/api/upload` (Cloudinary ali DB `Media`),
   doda caption + alt; sistem že omeji velikost/typo/quoto in org-scoping.
4. **Ureja**: naslov, opis, caption/alt, **vrstni red** (drag), označi cover, odstrani fotografije,
   vklopi/izklopi javno.
5. **Shrani**: CRUD v strežniških akcijah (applyPermission `content.manage` ali pripadajoči
   `finances`/`products.manage` glede na povezavo), zapisi v `Gallery`/`GalleryItem`, `ConfigChangeLog`.
6. **Pozneje uporablja**: javna stran/ed business renderira galerijo; izdelek/storitev/projekt
   prikaže pripadajočo galerijo.
7. **Stranka vidi**: javna, objavljena galerija (isPublic) na javni strani (npr. sekcija galerije
   ali znotraj izdelka/storitve); neobjavljena pa samo v prvem pogledu (varnost prek media-access).

### 4.2 FAQ
1. Lastnik odpre "Pogosta vprašanja" na dashboard-u.
2. Doda vprašanje + odgovor, izborno kategorijo, javno vidnost.
3. Ureja/zbriše/razvrsti (position) ali doda kategorijo.
4. Strežniška akcija shrani (b) `FaqItem` ali (a) `SiteContent.faq`, s ConfigChangeLog.
5. Javna stran (landing/tail ali posebna sekcija) prikaže samo `visible` vprašanja, po kategorijah,
   z akordeonom.

---

## 5. Integracija z `SiteContent` + vizualnim urejevalnikom

- **Galerija:** javni renderer razširi `renderCustomSection`/nova sekcija `gallery` (v `SECTION_KEYS`
  ali kot `custom`), ki iterira po `GalleryItem`s z `next/image` (fill, sizes, quality=85, `alt` iz
  `GalleryItem.alt` — dostopnost). Vizualni editor doda `GalleryPanel` (izbor galerije → ogled →
  dodaj/uredi/cover/premake), ob strani obstoječega `SectionInspector`.
- **FAQ:** dashboard (b) `FaqManager` po vzorcu `product-variants-card.tsx`; ali (a) nov `Field`
  v editorju. Javni render: akordeon, `visible` filter, kategorično grupiranje.
- **SEO/dostopnost:** galerijske slike dobijo `alt` (iz `GalleryItem.alt`), semantično `<figure>/<figcaption>`,
  LCP-lazy (`loading="lazy"`, razen cover `priority`), Cloudinary responsive presets. FAQ lahko
  dobijo schema.org `FAQPage` (JSON-LD) za SEO.

---

## 6. Dejavnostni primeri (§3) — en sistem, predlogom vsebine

Ena galerijska/FAQ struktura zadostuje za vse panoge — prilagodljivost je **v profilno-sejanih
vsebinah** (ne ločenih sistemih):

| Dejavnost | Galerija (predlog vnosa) | FAQ (predlog vsebine) |
|---|---|---|
| Frizerstvo | dela/kriteri; slike pričesk, postopkov | nega, postopki, priprava na termin, dogovori |
| Kozmetika | tretmaji, priprava kože | tretmaji, priprava kože, nega po postopku |
| Avtoservis | dela na vozilih, faze servisa | garancija, servis, naročanje, prevzem vozila |
| Šiviljstvo | izdelki, mere, roki | mere, izdelava, roki, popravila |
| Spletna trgovina | izdelki, ambient, dostava | izdelki, dostava, vračila |

Profili žal danes **nimajo** `gallery`/`faq` template polj (ni `src/lib/profiles/*` značilnih polj) —
priporoča se dodati v profile template: `galleryPrompt?: string[]`, `faqPrompt?: { q: string;
a: string }[]` (brez kode, kot terminologija), kar pred-vzame vsebino, a deluje en strukturiran sistem.

---

## 7. Varnost in migracije

### Varnost (ocena obstoječe — večinoma PASS)
- **Dostop do tujih medijskih datotek:** PASS — `/api/media/[id]` skozi `decideMediaAccess`
  (draft = member-only, javno = public cache, odstranjeni zaposleni denied, tuje → 404).
- **Pravice dodajanja/brisanja:** PASS (upload) — role-gate ADMIN/STAFF, org via session, size/type
  validacija, server-generated `public_id`. Nova galerijska CRUD mora zahtevati `content.manage`
  (ali primeren modul) + org-scoped.
- **Zaščita neobjavljenih fotografij:** PASS (media-access) — neobjavljena galerija mora držati
  `isPublic=false` in `media-access` še vedno blokira draft org.
- **Javno prikazovanje:** samo `isPublic` (+ org PUBLISHED) se izpostavi; `getPublicSiteData` je
  org-scoped.
- **Neposredni API zahtevki:** nova akcija mora org-scoped resolovati (kot `getPublicOrg`) in
  vrniti referenco galerije/FAQ iz objavljene org samo, drugače vrne 404.

### Migracije
- **Produkcijske migracije: NI.** Za implementacijo (F5.5.2.1): ena nova migracija
  `Gallery`/`GalleryItem` (če gremo po modelu 3.1) in (b) `FaqItem` — s `@@index`/FK kot zgoraj,
  na ločeni testni bazi; obstoječi `ServiceGallery`/`ServiceFAQ` se obdrži brez brisanja.

---

## 8. Sprejemni testi (za F5.5.2.1)

- [ ] Podjetnik ustvari galerijo, doda 3 slike, uredi naslov/slika-vrstni-red/cover → vse shranjeno
      in vidno v admin-u.
- [ ] Galerija z `isPublic=false` ni vidna na javni strani (tudi posredno prek izdelka/storitve).
- [ ] Org A galerija ni dosegljiva z org B (org-scoped CRUD + media-access).
- [ ] Only ADMIN/STAFF lahko dodaja/briše galerijske slike (role-gate).
- [ ] Javni render: `next/image` optimiziran (lazy + alt), cover `priority`; FAQ → akordeon, samo
      `visible`, kategorije.
- [ ] FAQ CRUD + ConfigChangeLog sled; vrstni red po kategoriji.
- [ ] Povezanosti galerij: storitev/izdelek/projekt prikaže pripadajočo galerijo.
- [ ] Integracijski testi (f54 suita) za org izolacijo in media-access → PASS.
- [ ] Regresija: full Vitest + tsc + ESLint, offline/gift/shop/promocije nespremenjeni.

---

## 9. Zaključek

Obstoječa medijska plast (Cloudinary/`Media` + `/api/media` access control) in `SiteContent`
(až. 5 org-infra) dajeta **močno osnovo brez podvajanja**. Manjkata pa **galerijska struktura**
(več galerij z več slikami, naslov/opis/vrstni red/cover/javna vidnost) in **FAQ upravljanje**
(SAMO modela `ServiceGallery`/`ServiceFAQ` brez UI). Priporočeni model: nova org-scoped
`Gallery` + `GalleryItem` nad obstoječo medijsko plastjo ter `FaqItem` (ali lahki `SiteContent.faq`).
Uporabniški tok, varnost in sprejemni testi so zgoraj določeni.

Pričakam odobritev **F5.5.2.1** za implementacijo.