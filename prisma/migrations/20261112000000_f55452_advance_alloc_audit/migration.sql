-- F5.5.4.5.2 — REVIZIJSKA SLED AVANSNIH ALOKACIJ.
--
-- Prej je `reverseAdvanceAllocation` vrstico DocumentAdvanceAllocation HARD BRISAL,
-- zato je podatek (znesek, davčna osnova, DDV, čas uporabe) izginil iz zgodovine.
-- Ta migracija vpelje mehki storno: vrstica se OHRANI s statusom REVOKED in
-- metapodatki storniranja (kdo, kdaj, razlog). Avans postane ponovno uporaben.
--
-- UNIKAT / PONOVNA UPORABA:
--   Star polni unikatni indeks (org, advanceId) se ODSTRANI. Namesto njega se
--   ustvari DELNI UNIKATNI INDEKS ... WHERE status = 'ACTIVE', ki prepoveduje,
--   da bi bil isti avans aktiven na več kot ENEM končnem računu hkrati, a hkrati
--   dopušča ponovno uporabo po REVOKED storniranju. (Enaka tehnika kot
--   DocumentPayment delni unikat v f5542 — Prisma 6.19 ne podpira delnega unikata
--   v datamodelu, zato se upravlja izključno prek te SQL migracije; v Prisma shemi
--   je le navaden @@index, da ni drifta.)

-- AlterTable: dodaj stolpce revizijske sledi (vse NOT NULL/prazno dovoljeno).
ALTER TABLE "DocumentAdvanceAllocation"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT;

-- Odstrani stari polni unikatni indeks (dopušča ponovno uporabo po stornu).
DROP INDEX IF EXISTS "DocumentAdvanceAllocation_organizationId_advanceId_key";

-- Prisma shema deklarira @@index([organizationId, advanceId]) — navaden indeks,
-- ki ga prisotnost (org, advanceId) v modelu pričakuje.
CREATE INDEX "DocumentAdvanceAllocation_organizationId_advanceId_idx"
  ON "DocumentAdvanceAllocation"("organizationId", "advanceId");

-- Delni unikatni indeks: en avans le na enem AKTIVNEM končnem računu.
CREATE UNIQUE INDEX "DocumentAdvanceAllocation_org_advance_active_key"
  ON "DocumentAdvanceAllocation"("organizationId", "advanceId")
  WHERE "status" = 'ACTIVE';

-- Indeks za zgodovino storniranih po uporabniku (pregled revizijske sledi).
CREATE INDEX "DocumentAdvanceAllocation_revokedById_idx"
  ON "DocumentAdvanceAllocation"("revokedById");