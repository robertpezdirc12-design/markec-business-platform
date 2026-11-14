# MARKEC — Migracije: baselined arhitektura (F5.5.4.4.2y/z)

Ta dokument opisuje, kako MARKEC upravlja podatkovno shemo po sprejeti
baselined migracijski arhitekturi. Namen: **dokazljiva in varna namestitev
na novo bazo** ter **varen, dokumentiran postopek nadgradnje obstoječih
namestitev** — vse brez spreminjanja zgodovine ali izgube podatkov.

## 1. Stanje migracijske mape

- **Aktivna mapa `prisma/migrations/`** vsebuje **samo**:
  - `00000000000000_baseline/migration.sql` — polna trenutna shema
    (iz `prisma migrate diff --from-empty --to-schema-datamodel`) **plus**
    izrecni SQL za delni unikatni indeks `DocumentPayment_org_doc_ref_key`
    (`... WHERE "reference" IS NOT NULL`), ki ga Prisma 6.19 ne zna generirati.
  - `migration_lock.toml`.
- **Arhiv `prisma/migrations-archived-legacy/`** — 42 izvirnih migracij
  (2025-10 → 2026-12), **byte-identično ohranjenih** (preverjeno LF-normalized
  proti git HEAD: 30/30 ujemajo; 12 novih f5.x je neplatformiranih iz drugih
  faz). Prisma jih **ne izvaja** (so zunaj aktivne mape).

## 2. Zakaj baseline? (kratka utemeljitev)

Izvirna veriga je bila naknadni backfill na baze, zgrajene z `db push`
(dokazuje glava `20261129050000_p100_f1_full_schema_sync`). Zato:
- `20251030000000` ALTERa `Appointment`/`User` pred `init` (20251116) → na
  **prazni bazi** pade (`relation "Appointment" does not exist`).
- `Organization` nima `CREATE TABLE` do `20261129 p100_f1`.

Baseline reši oboje: sveža baza dobi polno shemo v enem koraku; obstoječa
baza se sprejme pod nadzor z `resolve --applied` (le po verifikaciji brez drifta).

## 3. Orkestrator: `scripts/markec-migrate.mjs`

**NI del `build` skripte** (ločen, izrecen korak; ni omembe v `package.json`
ali `scripts/migrate-with-retry.mjs`). Uporaba:

```bash
# Nova (prazna) baza → FRESH
node scripts/markec-migrate.mjs --database-url "<URL>" --mode fresh

# Obstoječa baza (db-push ali z zgodovino) → UPGRADE
node scripts/markec-migrate.mjs --database-url "<URL>" --mode upgrade

# Brez --mode: avtomatski izbor, a fail-closed ob nejasnem stanju
node scripts/markec-migrate.mjs --database-url "<URL>"
```

### Odločanje o stanju (NIKOLI samo tabela "User")
- prazna baza (0 tabel, brez `_prisma_migrations`) → **FRESH**
- ne-prazna, brez `_prisma_migrations` → **UPGRADE-A** (db-push)
- ne-prazna z `_prisma_migrations` → **UPGRADE-B** (obstoječa zgodovina)
- 0 tabel + obstaja `_prisma_migrations` → **STOP (AMBIGUOUS)**
- ne-prazna, manjkajo jedrne tabele → **STOP** (stanje ni enoznačno)

### FRESH
`prisma migrate deploy` (baseline) + verifikacija delnega indeksa + odsotnost drifta.

### UPGRADE (A in B) — varnostni pogoji
1. **fail-on-drift**: `prisma migrate diff --from-url … → --to-schema-datamodel`
   mora biti prazen, sicer **STOP** (ne sprejmemo driftirane baze na slepo).
2. **Delni indeks** se preverja ločeno (`diff` ne pokriva Prisma-nevidnih
   objektov) in se (če manjka) ustvari idempotentno `CREATE UNIQUE INDEX IF NOT EXISTS`.
3. **UPGRADE-A**: baza brez ledžerja → `prisma migrate resolve --applied 00000000000000_baseline`
   (utemeljeno z dokazano enakostjo sheme) → `deploy`.
4. **UPGRADE-B**: požene `prisma migrate status`; če poroča ne-aplicirane/FAILED
   → **STOP** z jasnim sporočilom. **Nikoli ne popravlja FAILED samodejno,
   nikoli ne briše zapisov, nikoli ne ponavlja starih SQL.** Sprememba zgodovine
   je izrecno odločba operaterja.

## 4. UPGRADE na produkcijsko bazo (analiza / strategija)

Produkcijska baza (Vercel) lahko ima:
- **stare aplicirane migracije** (zapisi v `_prisma_migrations`),
- **morebitne FAILED** migracije,
- **migracije, ki so sedaj v arhivu**,
- **stare checksum-e**.

**Načelo ohranjanja zgodovine (brez slepega resolve / brisanja / ponovne Sage):**

0. **Najprej samo pregled** (read-only): `prisma migrate status --schema prisma/schema.prisma`
   + ročni pregled `_prisma_migrations` in SQL-ej v arhivu. **Ne izvajaj korekcij
   brez pregleda podatkovnih učinkov** (to je tudi naloga iz faze F5.5.4.4.2z).
1. **Dokumentirano stanje po arhiviranju**: `migrate status` bo prikazal
   "migrations from the database are not found locally in prisma/migrations"
   za tista imena iz arhiva (ker jih aktivna mapa ne vsebuje). To **ni napaka**
   — je pričakovano; ta imena so v arhivu, ne več v aktivni verigi.
2. **FAILED migracije** (npr. `20261105000000_onboarding_answers`) je treba
   obravnavati **po pregledu njihovega SQL-a**: če je SQL idempotenten (kot v
   `scripts/resolve-failed-migrations.mjs` allowlistu), je dovoljeno
   `prisma migrate resolve --rolled-back` (samo tiste, ki so res varne); sicer
   ročno. **To je odločba operaterja — orchestrator ne naredi sam.** (Pain:
   `prisma migrate resolve --rolled-back` **ne** izvrši zamenjav na podatkih in
   ne spremeni SQL-ov — le popravi status v ledžerju.)
3. **Aplicirane stare migracije ostanejo** nedotaknjene v `_prisma_migrations`
   (njihovi zapisi in checksum-i se ohranijo; ne brišemo in ne preštevilčujemo).
4. Ko je ledžer usklajeno z arhivom (ali ocenjeno kot "že na ciljni shemi"),
   se `00000000000000_baseline` **ne izvede na obstoječi bazi** — namesto tega
   se `migrate resolve --applied 00000000000000_baseline` (le če shema že
   ustreza, kar je dokazano z `fail-on-drift`). S tem se zgodovina "pasivno"
   naprej vodi iz baseline nivoja naprej, brez ponovnega izvajanja starih SQL.
5. **Nadaljnje spremembe sheme** se dodajajo kot **nove** migracije v aktivno
   mapo PO baseline-u; `prisma migrate deploy` jih nato izvede normalno.

**Pomembno (dokazano v kontroli):** orchestrator pri stanju z nečistim
`migrate status` **spustil s STOP** (izhod ≠ 0), ne da bi kaj spremenil v
ledžerju ali podatkih. Edina pred-STOP sprememba je idempotentno dodajanje
delnega indeksa `DocumentPayment` (varna, aditivna, nehistorična).

## 5. Lokalna razvojna baza (prehod iz db push na baseline)

Lokalna dev baza (`markec_dev`) je bila zgrajena z `db push`: **65 tabel,
brez `_prisma_migrations`** (DP indeks prisoten). Glede na trenutno shemo
ima **samo 3 manjkajoče nove tabele** (`Gallery`, `GalleryItem`, `FaqItem`,
iz faze F5.5.2).

**Postopek prehoda (ročni, izrecen):**
1. Ne zanašaj se samo na `npm run db:push` za prihodnje spremembe.
2. Za prihodnje shemske spremembe uporabi **`prisma migrate dev`**:
   ```bash
   # lokalno razviti novo migracijo (na lokalni dev bazi)
   npx prisma migrate dev --name "<opis>" --schema prisma/schema.prisma
   ```
   To:
   - preveri, da bazna drifta-od aktivne mape ni,
   - ustvari novo migracijo PO baseline-u za tvoj del matrike,
   - jo aplicira lokalno.
3. Če je dev baza trenutno `db push`-izven-sinhron (kot zdaj: manjka 3 tabele),
   najprej uskladiti s shemo, nato pretti na baseline:
   - Opcija A (priporočeno za čisto stanje): spraviti dev bazo pod baseline z
     `node scripts/markec-migrate.mjs --database-url "<dev>" --mode upgrade`
     po tem, ko so **vse trenutne shemske spremembe vnesene** v shemo (v tem
     primeru tudi `Gallery`/`FaqItem` — delo drugega agenta; zato se to nardi
     šele, ko je njihov WIP združen/zmana v shemo).
   - Opcija B: lokalno dovoliti `prisma db push` za tudi te 3 tabele, vendar
     to **NI** priporočljivo kot trajna navada (ker še naprej ustvarja drift
     v aktivni mapi). Po tem za prihodnost uporabi `migrate dev`.

> **Pozor:** vsi posegi v lokalno dev bazo zahtevajo, da najprej ni aktivnega
> dev strežnika, ki drži shemo/prikaže napako (opozorilo iz F5.5.4.4.1 glede
> `prisma generate` EPERM ob tekočem dev procesu).

## 6. Razvojni postopek — nova funkcionalnost, ki spreminja bazo (F5.5.4.4.4)

> **Osnovno načelo:** `schema.prisma` in nove migracije se razvijajo **skupaj**.
> **`00000000000000_baseline` se NIKOLI ne spreminja** — vsaka sprememba je nova
> migracija PO baseline-u. To je dokazano na izoliranem projektu (kopiji):
> `prisma migrate dev --name "<opis>"` ob prazni/razviti bazi ustvari in aplicira
> novo migracijo z le delto (npr. `ALTER TABLE "Organization" ADD COLUMN ...`),
> `migrate status` nato poroča "up to date", ponovljen `migrate dev` pa
> "Already in sync, no schema change or pending migration was found."

### 6.1 Urejanje nove funkcionalnosti
1. `schema.prisma` spremeniš (dodaš model/polje/indeks). Tudi to je del razvoja.
2. **Ustvari migracijo** (na lokalni dev bazi):
   ```bash
   # najprej ustavite dev strežnik (EPERM na query_engine ob prisma generate)
   npx prisma migrate dev --name "<opis>" --schema prisma/schema.prisma
   ```
   Ta ukaz: preveri drifta-od aktivne mape, ustvari novo migracijo
   (`prisma/migrations/<timestamp>_<opis>/migration.sql`), jo aplicira lokalno in
   zažene `prisma generate`.

### 6.2 Lokalno testiranje
- `npx prisma migrate status` → "Database schema is up to date!".
- Med enako shemo NAREDI: ponovi `migrate dev --name "noop"` → "Already in sync".
- Poganjaj aplikacijo/teste; nikoli ne pozabi, da je `schema.prisma` vir resnice.

### 6.3 Preverjanje migracijskega stanja
```bash
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script   # mora biti prazen (1010; delni indeks ni modeliran)
```

### 6.4 Namestitev na svežo bazo
```bash
node scripts/markec-migrate.mjs --database-url "<URL>" --mode fresh
# ali neposredno: npx prisma migrate deploy --schema prisma/schema.prisma
```
Sveža baza dobi baseline + vse poznejše migracije v vrstnem redu.

### 6.5 Nadgradnja obstoječe baze (že pod nadzorom migracij)
```bash
npx prisma migrate deploy --schema prisma/schema.prisma   # uveljavi nove migracije
node scripts/markec-migrate.mjs --database-url "<URL>" --mode upgrade   # za zaščito+verifikacijo
```

### 6.6 Postopek ob neuspešni migraciji
1. `npx prisma migrate status` → poišči FAILED `migration_name`.
2. Odpri `prisma/migrations/<ime>/migration.sql` in preglej podatkovne učinke.
3. Ročno uskladi (če je SQL delno izveden) ali označi `prisma migrate resolve --rolled-back <ime>`
   (le po pregledu; `resolve` ne izvede/spreminja SQL).
4. Popravi `schema.prisma`/SQL, nato ponovi `migrate dev`/`deploy`.
5. **Nikoli** ne uporabljaj `--accept-data-loss`, `migrate reset` ali `db push`
   kot trajno orodje (drift!); za sveže testne baze je `migrate reset` sprejemljiv
   le na izoliranem/lokalnem, ne na pravih naborih.

### 6.7 Opozorila
- `prisma generate` ob tekočem dev strežniku → EPERM na `query_engine-windows.dll.node`
  (malomočno viden, ne združuje migracijo; zgodi/jo na potem — še vedno velja: ustavite dev strežnik
  pred `migrate dev`).
- `prisma db push` zahteva `--accept-data-loss` pri novih unikatih (npr. Staff(userId,org));
  **ne** ga uporabljaj zaporedno— raje `migrate dev`.

## 7. Prihodnje migracije (povzetek)
- **Prepovedano**: spreminjati `00000000000000_baseline` ali starih SQL v arhivu
  (sproži checksum-drift). Baseline zamrzni.
- **Dovoljeno/Normalno**: `prisma migrate dev --name "..."` za nove spremembe;
  `prisma migrate deploy` na rednih okolji; `markec-migrate.mjs` za posebne
  scenarije (sveža / prehod / nadgradnja).
- Drift med aktivno mapo in shemo naj bo **0**: po vsaki spremembi je treba
  pozvati `prisma migrate diff --from-migrations --to-schema-datamodel` in
  preveriti, da je prazen (upoštevaj, da delni indeks ni modeliran — glej §3.2).