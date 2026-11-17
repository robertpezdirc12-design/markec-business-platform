-- ============================================================
-- POPRAVEK DRIFTA (2026-11-18)
--
-- Commit bcaafa6 je v shemo dodal Document.sourceId (veriga
-- ponudba → račun) ter modela Warranty/WarrantyClaim, ne da bi
-- priložil migracijo. Posledica v produkciji: vsak `findMany` na
-- Document (in s tem stran stranke, e-računi, ponudbe, garancije)
-- je padel s P2022 »The column `Document.sourceId` does not exist«.
--
-- SQL je namerno idempotenten (IF NOT EXISTS + DO bloki), da ga je
-- mogoče varno pognati tudi na bazi, kjer je bil del že ročno
-- uveljavljen.
-- ============================================================

-- 1) Document.sourceId (veriga ponudba → račun)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "Document_sourceId_idx" ON "Document"("sourceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_sourceId_fkey'
  ) THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Document"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Garancije
CREATE TABLE IF NOT EXISTS "Warranty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'SERVICE',
    "subjectId" TEXT NOT NULL,
    "documentId" TEXT,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "validUntilMileage" INTEGER,
    "warrantyPeriodDays" INTEGER NOT NULL,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" TEXT,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "outcome" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Warranty_organizationId_idx" ON "Warranty"("organizationId");
CREATE INDEX IF NOT EXISTS "Warranty_customerId_idx" ON "Warranty"("customerId");
CREATE INDEX IF NOT EXISTS "Warranty_documentId_idx" ON "Warranty"("documentId");
CREATE INDEX IF NOT EXISTS "Warranty_status_idx" ON "Warranty"("status");
CREATE INDEX IF NOT EXISTS "Warranty_organizationId_status_validUntil_idx" ON "Warranty"("organizationId", "status", "validUntil");
CREATE INDEX IF NOT EXISTS "WarrantyClaim_organizationId_idx" ON "WarrantyClaim"("organizationId");
CREATE INDEX IF NOT EXISTS "WarrantyClaim_warrantyId_idx" ON "WarrantyClaim"("warrantyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_organizationId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_customerId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_documentId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WarrantyClaim_organizationId_fkey') THEN
    ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WarrantyClaim_warrantyId_fkey') THEN
    ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_warrantyId_fkey"
      FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
