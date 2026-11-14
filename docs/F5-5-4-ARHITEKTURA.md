# F5.5.4.0 — Arhitekturna analiza modula dokumentov (ponudbe in računi)

> **Read-only analiza obstoječe kode — nobena koda, shema ali migracija ni bila spremenjena.**
> Namen: ugotoviti, ali je modul dokumentov (QUOTE/INVOICE) dovolj razvit za resno
> večorganizacijsko poslovno platformo MARKEC, ter pripraviti podatkovni model in vrstni red
> za F5.5.4.1. Brez implementacije, brez migracij, brez commit/push, WIP drugih nespremenjen.

---

## 1. Povzetek

Modul dokumentov **obstaja in deluje kot osnovni CRM-dodatek**, vendar je **računovodsko in davčno
nezrel** za resno poslovno platformo. Ima trdno ogrodje (org-scoping, zaporedno številčenje,
statusne prehode, povezavo na Customer/WorkOrder), a **manjka vse, kar račun naredi zakonsko veljaven
in ponovljiv**: DDV/davčne stopnje, podpora, dobropisi, plačila, PDF, nespremenljivi posnetki
(immutable snapshots), številčenje po poslovnem letu ter računanje na strani strežnika.

**Ključen zaključek glede nespremenljivosti (§Posebna pozornost):** modul zaenkrat **NE** zagotavlja
nespremenljivega posnetka že izdanega računa. Vrstice (DocumentItem) hranijo opis+ceno, a **podatki
izdajatelja (salon) in stranke se berejo v živo** ob prikazu/s tiskanju. Sprememba imena/e-pošte
stranke ali podatkov salona pozneje **spremeni prikaz že izdanega računa**. To je glavna računovodska
napaka sedanje zasnove.

---

## 2. Prisma modeli in relacije (§1 naloge)

### 2.1 `Document` (schema.prisma:1696)
```prisma
model Document {
  id             String @id @default(cuid())
  organizationId String
  type           String // QUOTE | INVOICE
  number         Int    // zaporedna, per org IN per type
  status         String @default("DRAFT")
  customerId  String?
  workOrderId String?
  issueDate   DateTime  @default(now())
  dueDate     DateTime?
  total       Decimal   @db.Decimal(10, 2)   // samo BRUTO znesek
  notes       String?   @db.Text
  items       DocumentItem[]
  @@unique([organizationId, type, number])   // številčenje po najemniku+tipu
}
```

### 2.2 `DocumentItem` (schema.prisma:1729)
```prisma
model DocumentItem {
  description String
  quantity    Decimal
  unitPrice   Decimal
  total       Decimal
  position    Int
  document    Document @relation(onDelete: Cascade)
}
```

### 2.3 Relacije
| Entiteta | Povezava z Document | PK/FK |
|---|---|---|
| `Organization` | lastnik (Cascade) | org-scoped |
| `Customer` | `customerId` (SetNull) | polje + indeks |
| `WorkOrder` | `workOrderId` (SetNull) | polje + indeks |
| `Order` (trgovina) | **NI povezave** | — |
| `Appointment` (termin) | **NI povezave** | — |

**Ugotovitve:**
- Document je vezan **samo** na Customer in WorkOrder. **Ni** povezave na `Order` (spletno naročilo)
  in **ni** povezave na `Appointment` (termin) — zato frizer/trgovec **ne more** računa izpeljati
  neposredno iz opravljenega termina ali potrjenega spletnega naročila (te tokove spremljata lastna
  modela `Appointment` in `Order` z njunima poljema `total/tax`).
- Vrstice so **prost opis** (`description`) — nameren razlog: katalog se ne sme pokvariti, ko se
  izdelek/storit venuje ali izbriše. **Pravilno načelo**, a manjka posnetek šifrantov (cena, merska
  enota, davčna stopnja, referenca kataloga).
- **Ni `documentId` na `Order`/`Appointment`** → ni niti povratne povezave niti povezanih plačil.

---

## 3. Ustvarjanje, urejanje, shranjevanje, izdajanje (§2 naloge)

Actions v `src/app/actions/documents.ts`:
- `getDocumentsOverview` — pregled (quote/invoice, statistika, izbira odprtih work-orderjev).
- `getDocumentDetail` — podrobnost + **v živo** customer/workOrder (glej §9 posnetki).
- `createDocument` — ustvari v `DRAFT`; številka = `max+1` per org+tip; **transakcija**.
- `changeDocumentStatus` — prehodi: QUOTE `DRAFT→SENT→ACCEPTED/REJECTED`; INVOICE
  `DRAFT→ISSUED→PAID/CANCELLED` (validacija na strežniku).
- `convertQuoteToInvoice` — sprejeti QUOTE kopira v INVOICE (DRAFT).
- `listDocumentCustomers` — izbirnik strank (org-scoped).

**Ugotovitve:**
- **NI `updateDocument`** — dokumenta ni mogoče po izdelavi popraviti (niti v DRAFT). Napačen vnos =
  samo `CANCELLED`. To je **uporabniška vrzel** (DRAFT bi moral biti urejiv), a hkrati dobra za
  izdane račune (ne preobrablja se zgodovine).
- **NI `deleteDocument`** — izdanega računa ni mogoče zbrisati (pravilno za hrambo), ampak tudi
  DRAFT ne (test lahko ostane odpadni).
- **`createDocument` sprejme `issueDate` iz odjemalca** in ga ne zaklene ob izdaji; izdajatelj lahko
  nastavi poljuben datum izdaje v DRAFT (za računovodstvo problematično, če se pozneje spreminja).
- `total` se **računa na strani strežnika** (vsota `qty×unitPrice`) — ne zaupanje odjemalcu. ✅
  A **brez davka, brez podaloga, brez zaokroževanja** (glej §5).

---

## 4. Zaporedno številčenje (§4 naloge)

- **Per org in per tip** (`@@unique([organizationId, type, number])`) — ✅ organizacijsko ločeno; A in B
  imata vsak svoj niz.
- Številka = `_max(number)+1` znotraj transakcije v `createDocument` in `convertQuoteToInvoice`.
- **Brez poslovnega leta**: ni `fiscalYear`/`period` v unikatu; vsako leto se ne resetira (1.1. se ne
  začne z 1). ZDDV-1 zahteva jasno, nezamenljivo zaporedno številko, vsaj letno zaporedje je tržni
  standard.
- **Občutljivo na dirkalne pogoje** kljub transakciji: `_max+1` ni zasebno-serijsko; pri vzporednih
  zahtevkih lahko dva dokumenta dobita isto številko (unique bi potem vrgel na drugem) ali se preskoči
  številka. Za resen računovodski tok je potreben/zaklep ali povezan agregat/serija.
- **Ni prilagodljivega formata** (predpona, začetna številka, ločilo tipa); UI prikaže trdi
  `RAC-0001`/`PON-0001` (v `docCode` v documents-client.tsx).

---

## 5. DDV, davčne stopnje, popusti, valute, zaokroževanje (§5 naloge)

**Modul `Document` NIMA niti enega od teh pojmov.** Primerjava z obstoječim modelom `Order`
(trgovina), ki je bogatejši:

| Pojem | `Order` / `Product` (obstaja) | `Document` (manjka) |
|---|---|---|
| Bruto/navtična cena | `Product.price` je GROSS, `vatRate` 0–100 (schema:1163-1171) | ❌ samo bruto `unitPrice`, brez `vatRate` |
| DDV znesek | `Order.tax` | ❌ ni `tax`, ni `taxBase` |
| Podaloga | `Order.subtotal` | ❌ ni `subtotal` (kot bruto) |
| Popust | `Order.promotionDiscount` + `promotionSnapshot` (immutable) | ❌ ni popusta |
| Valuta | `SalonConfig.currency` (default EUR) | ❌ ni `currency` na dokumentu |
| Zaokroževanje | `Decimal(10,2)` | ❌ ni eksplicitnega pravila (zanaša na DB Decimal) |

**Posledice:**
- **Nobene davčne stopnje (DDV/9,5 %/22 %/0 %)** in **nobene razčlenitve davka** → račun ni skladen
  z ZDDV-1/ZPIZ-2 (zahtevana davčna osnova + znesek DDV in stopnja).
- **Brez podpore** — edini znesek je bruto total.
- **Brez večvalutnosti** — vse je EUR, dokument nima svoje valute (mednarodne stranke, če pridejo).
- **Brez zaokroževanja na nivoju zneska** — `30 × 0,10` da 3,00; problem nastane pri DDV vključeni
  različici (cena z DDV vključeno → obratni izračun → zaokrožanje se mora zgoditi po enotnem pravilu).

---

## 6. PDF, predogled, pošiljanje, arhiviranje (§6 naloge)

- **PDF = `window.print()`** na HTML `print-area` (documents-client.tsx). **Ni strežniškega PDF-ja**,
  ni digitalnega podpisa, ni elektronske hrambe (arhiva).
- **Ni pošiljanja**: `SENT` pri QUOTE je samo statusna sprememba; **ni e-poštnega pošiljanja** računa
  stranki (npr. prek Resend, ki je sicer v skladišču).
- **Ni arhiva**: ni `archivedAt`, ni nedotakljive hrambe, ni exporta/backup; hramba = kar ostane v DB.
- Predogled = dialog pred tiskanjem (HTML). Ok.

---

## 7. Plačila, delna plačila, zapadlost, dobropisi (§7 naloge)

- **`PAID` je zgolj statusna sprememba** (`changeDocumentStatus` → `PAID`). **Ni evidenc plačila**:
  noben znesek, datum, metoda plačila, reference.
- **Ni delnih plačil** (no `paidAmount`, no `payments[]` na dokumentu).
- **Zapadlost** obstaja le kot **izpeljan prikaz** v seznamu (overdue = ISSUED + dueDate<presečnika),
  vendar ni **opomnikov, obresti ali pologa**.
- **Ni dobropisov** (`CreditNote`/`storno`). Prekljano stanje = `CANCELLED`, kar ni računovodski
  dobropis (CANCELLED ne zniža prihodkov brez pomožne ročne obravnave).
- Obračun plačil s platforme (`lib/interfaces.ts` `PaymentType`) pokriva `APPOINTMENT_DEPOSIT` in
  `PRODUCT_ORDER` — **invoice ni v plačilnem sistemu** na nobeni poti.

---

## 8. Varnost: org-scoping, STAFF, IDOR (§8 naloge)

- **Org-scoped**: vse akcije `requirePermissionOrg("finances.view")` + `findFirst({ where: { id,
  organizationId: org.id } })` → tuj `documentId` = null/NOT_FOUND (fail-closed). ✅ **IDOR varno.**
- **STAFF**: vse dejavnosti uporabljajo `requirePermissionOrg`, ki je **ADMIN-only** (`requireRole
  ["ADMIN"]`) — enak vzorec kot v F5.5.3.1. STAFF z custom rolo (tudi s `finances.view`) **ne more**
  izdajati/urejati dokumentov; samo ADMIN da. To je varno, a kot v customers — **razhajanje z
  arhitekturnim ciljem iz F5.5.3 §6** (STAFF naj bi upravljal stranke/dokumente skladno s custom
  rolo); odločitev pustimo na F5.5.4.1 / odločevalcu.
- **Granularnost dovoljenj**: obstaja samo **`finances.view`** — **ni `documents.manage`/`finances
  .manage`/read-vs-write**. Vsak, ki lahko *gleda* dokumente (ima `finances.view`), lahko *tudi
  ustvari, izda, preklice*. Ni možnosti »poglej, a ne dajaj« za osebje.
- **Sidebar**: »Dokumenti…«, capability `documents`, permission `finances.view`.
- **Rizično**: izdajanje računa je **avtorizacijsko** dejanje (finančno) — vstopiti bi moralo pod
  strožji ključ (npr. `finances.manage`), ne le `finances.view`.

---

## 9. Posnetki (nespremenljivost) — POSEBNA POZORNOST naloge

**Trenutno NI celovitega nespremenljivega posnetka izdanega računa.**

| Kaj | Posnetek ob izdaji? | Živi ali posnetek? |
|---|---|---|
| Vrstice (opis, qty, cena) | ✅ shranjeno v `DocumentItem` ob izdelavi | posnetek (pravilno) |
| Podatki izdajatelja (salon) | ❌ | **živo** iz `SalonConfig` pri tiskanju (imena/adresa/bank) |
| Podatki stranke | ❌ | **živo** iz `Customer` (`getDocumentDetail` → `customer: true`) |
| Valuta | ❌ | prikazana kot ukoreninjen EUR (`formatCurrency`) brez shranjenega polja |
| Davčna stopnja / DDV znesek | ❌ | ne obstaja |
| Popust / promocija | ❌ | ne obstaja (Order ima `promotionSnapshot` — vzorec že obstaja) |
| Številka, datum izdaje | ✅ | shranjeni `number`+`issueDate` (pomembna stalnica) |

**Posledica:** če ime stranke ali naslov salona pozneje spremeniš, **že izdan račun** ob tiskanju
prikaže nove podatke. To krši načelo »izdani račun se pozneje ne spreminja«.

**Vzorec za popravek že obstaja v kodi:** `Order.promotionSnapshot` (JSON slika pravila, F5.1) in
`OrderItem.variantName/variantPrice/variantSku` (F5.5.1.1). Isto načelo je treba prenesti na
`Document`:
- `Document.issuerSnapshot` (ime, naslov, davčna številka, IBAN, valuta, predpona) — JSON, ob izdaji.
- `Document.customerSnapshot` (ime, e-pošta, davčna številka) — JSON, ob izdaji.
- `DocumentItem` → dodati `vatRate`, `taxFee`/`taxBase`, `discount` (po možnosti `catalogRef`),
  izračunano **na strežniku**, shranjeno prvič ob `ISSUED`.
- Zakleni neizbrisnost/nespreminjanje po `ISSUED` (npr. `changeDocumentStatus` iz `ISSUED` dovoli le
  točno določene prehode in **noben `updateDocument` po ISSUED**; CANCELLED ostane).

---

## 10. Razlike med profili dejavnosti (§9 naloge)

Večinoma registriranih profilov (frizer, avtoservis, šiviljstvo, trgovina, tetoviranje) prinaša
**isti `Document` model z enako obliko vrstic** — **ni per-dejavnostnega prilagajanja** dokumenta.

| Dejavnost | `documents` capability | Prevlad. vir podatkov izdelka/računa | Opomba |
|---|---|---|---|
| Frizer (frizer) | optional | `Appointment` (termin) | NI povezave Document↔Appointment → ne moreš računa iz termina |
| Avtoservis (mehanik) | optional | `WorkOrder` (delovni nalog) | ✅ ima povezavo; a deli + delo na work-orderju nimata davčne razčlenitve |
| Šiviljstvo (seamstress) | optional | `WorkOrder`/`Order` | povezava na work-order ok; sivanje po meri → merilni listi ločeno |
| Trgovina (retail) | optional | `Order` (spletno naročilo) | NI povezave Document↔Order → račun za naročilo je ročen vnos |
| Druge SKD podobe | optional | odvisno | isti generični model |

**Sklenitev:** enoten osnovni `Document` je dobra odločitev (»ena osnova, pogledi po dejavnosti« —
enako kot F5.5.3 za Customer), a **manjka povezava na `Order` in `Appointment`**, ki sta glavna
generatorja prihodkov za trgovino in storitvene dejavnosti. Za vsako dejavnost je treba omogočiti
»obrazec za račun« iz izvornega zapisa (workorder/order/appointment) ob zahtevani davčni razčlenitvi.

---

## 11. GDPR in zakonska hramba (§10 naloge)

- **GDPR**: dokumenti so vezani na `Customer` (org-scoped); GDPR anonimizacija stranke (F5.5.3.1)
  **NE** izbriše dokumentov — relacija `Document.customerId` je `SET NULL`, zgodovina ostane. ✅
  **Vendar** če je račun brez imena/številke izdajatelja (ni issuerSnapshot), anonimizacija stranke
  pomeni, da račun postane brez povezanega subjekta — potrebuje obvladanje na nivoju hrambe.
- **Zakonska hramba**: **ni izrecne hrambe** (ZDDV-1 zahteva hrambo računov 10 let pri DDV zavezancu;
  ZPIZ-2/ZDR-1 10 let). Trenutno je hramba = trajno v DB, **brez oznake roka, brez arhiva, brez
  izvoza/backupa (za pravno veljavo je potrebna elektronska hramba z neizbrisljivostjo in
  verifikacijo)**.
- **Izbris zahtev za pozabo**: `DocumentItem` se briše prek Cascade na `document` (ne na customer),
  zato GDPR-cleanup ne izniči računa — ✅.

---

## 12. Razvrščene ugotovitve

### A. Že pravilno implementirano
1. **Org-scoping + IDOR** — vse akcije `requirePermissionOrg` + `findFirst({id, organizationId})`
   (fail-closed); A in B sta ločena. ✅
2. **Zaporedno številčenje per org+tip** — `@@unique([orgId, type, number])`, v transakciji. ✅
3. **Statusni prehodi na strežniku** — ne zaupamo odjemalcu; QUOTE/INVOICE imajo eksplicitne mape. ✅
4. **Strežniški izračun skupnega zneska** — `total` se računa na strežniku (ne zaupanje odjemalca). ✅
5. **Prosto opisane vrstice + ločitev od kataloga** — sprememba/izbris kataloga ne pokvari računa. ✅
6. **Ni `deleteDocument`** — izdani računi se ne brišejo (dobra sledljivost). ✅ (delnik / delne)
7. **GDPR prijazno**: anonimizacija stranke ne izbriše dokumentov (SET NULL). ✅
8. **Povezava s `WorkOrder`** — za avtoservis/šiviljstvo deluje povezava na izvorni zapis. ✅

### B. Manjkajoče funkcionalnosti
1. **DDV + davčne stopnje + davčna osnova + znesek DDV** (ZDDV-1) — modul je popolnoma brez davka.
2. **Podpora/popust/valuta/zaokroževanje** — dejavna/sli vrstica ima le qty×cena.
3. **Urejanje v DRAFT** (updateDocument) in popravki; poslej pa **zakleni po ISSUED**.
4. **PDF na strežniku + pošiljanje e-pošte (Resend)** in **elektronski arhiv/hramba**.
5. **Plačila**: vpis plačila (znesek, datum, metoda), **delna plačila**, boljša zapadlost.
6. **Dobropisi (credit note).**
7. **Povezava Document↔Order in Document↔Appointment** (račun iz termina/naročila).
8. **Številčenje po poslovnem letu + robustna serija (brez `max+1` dirkeljev).**
9. **Issuer/Customer snapshot (nespremenljivost) — osrednja manjkajoča točka.**
10. **Elektronska hramba + zakonski roki (10 let) + izvoz/backup.**

### C. Varnostna tveganja
1. **`finances.view` daje tudi pisanje** (create/issue/cancel) — ni read/write ločnice; izdajanje
   računa bi moralo biti strožji ključ (`finances.manage`/`documents.manage`).
2. **STAFF ne more upravljati dokumentov** niti s custom rolo (`requirePermissionOrg` = ADMIN-only)
   — protislovje s ciljem delegacije; odločitev za F5.5.4.1.
3. **Ni granularnih dovoljenj** za opombe/izvoz/PDF/posmeški — vse pod en ključ.
4. **Ni arhiviranja/exporta** dokumentov (brez vrtenja stranke na izdano → hramba v tveganju).
5. **(Srednje) `issueDate` sprejet iz odjemalca** — lahko nastavi arbitrarni datum izdaje ob DRAFT;
   zakleni ob ISSUED.

### D. Računovodska in davčna tveganja
1. **Sprememba stranke/salona pozneje spreminja prikaz izdanega računa** — povzroči neskladje med
   poslanim in prikazanim računom; **krši nespremenljivost** (to je najhujše tveganje).
2. **Brez davka/DDV** — račun ni sestavljen skladno z ZDDV-1 (ni davčne osnove, stopnje, zneska).
3. **Ni dobropisov** — storno/izbira samo CANCELLED zamegli prihodke.
4. **Ni plačilne evidence** — `PAID` je status brez reference (znesek/datum/metoda) → slab pregled
   nad terjatvami.
5. **Številčenje brez leta + `max+1`** — možne luknje/duplikati/preskoki; zakonsko neotrdno.
6. **Valuta in zaokroževanje nista eksplicitna** → napake pri ne-EUR ali pri obratnem DDV izračunu.
7. **Brez arhiviranja/rokov hrambe** — dolgoročna (a lahko se da naknadno).

### E. Priporočeni vrstni red implementacije (F5.5.4.1+)
1. **Posnetki (immutable snapshots) + zaklenitev po ISSUED** — issuerSnapshot + customerSnapshot;
   zaklepanje `changeDocumentStatus` (noben update po ISSUED, izjema samo CANCELLED).
2. **DDV + davčne stopnje + davčna osnova + znesek** (vrstica in total) — enoten, strežniški
   obračun, za e-EU/NN nalogi; podpora `SalonConfig.vatId`, davčna številka izdajatelja.
3. **Urejanje v DRAFT** (updateDocument za neneederje) + **brisanje v DRAFT**.
4. **Številčenje po poslovnem letu + serija (brez `max+1`)** — agregat/serija per org+tip+leto.
5. **Povezava Document↔Order in Document↔Appointment** (račun iz vira za trgovino/storitev).
6. **Plačila + delna plačila + dobropisi** (model `Payment`/`CreditNote`, povezano z Invoice).
7. **Dovoljenja**: dodati `finances.manage`/`documents.manage`, ločiti read/write; odločitev STAFF.
8. **PDF na strežniku + pošiljanje (Resend) + elektronski arhiv + roki hrambe + izvoz.**
9. **GDPR**: povezati issuer/customer snapshot z GDPR nožem (ob anonimizaciji stranke račun še
   vedno nosi posnetek brez identifikacije).

---

## 13. Sklep

Modul dokumentov je **funkcionalen MVP modul za osnovne ponudbe/račune**, a **ni računovodsko/davčno
dovolj razvit** za resno večorganizacijsko poslovno platformo. Najresnejša vrzel je **odsotnost
nespremenljivih posnetkov** (sprememba stranke/salona pozneje spreminja izdani račun) ter **popolna
odsotnost DDV/davkov, dobropisov, plačil, PDF-ja in zakonske hrambe**. Vzorec za popravek (immutable
snapshot) že obstaja v `Order.promotionSnapshot`/`OrderItem` — implementacijska pot je torej
nadaljevanje obstoječe konvencije, ne novo arhitekturno preoblikovanje. Za **F5.5.4.1** priporočam
najprej snimke + DDV + številčenje po letih, nato plačila/dobropise in PDF/arhiv.

Pričakujem odobritev **F5.5.4.1**.