-- ============================================================
-- BLAGAJNA (WP-1) + POPRAVEK DRIFTA
--
-- Migracija je bila v delovnem drevesu brez zaščite pred ponovnim
-- izvajanjem, zato na bazi, kjer je del objektov že nastal
-- (Document.sourceId, Warranty …), ni bila izvedljiva. Zdaj je v
-- celoti IDEMPOTENTNA: ADD COLUMN / CREATE TABLE / CREATE INDEX z
-- IF NOT EXISTS, tuji ključi v DO blokih s preverjanjem pg_constraint.
-- Varno jo je pognati na katerikoli bazi — tudi dvakrat.
-- ============================================================

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "marketingConsentedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

-- AlterTable
ALTER TABLE "EInvoice" ADD COLUMN IF NOT EXISTS "peppolSchematronApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "standardVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "validatorVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "xsdApplied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cashSessionId" TEXT;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "staffId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "cashSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cardSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transferSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expensesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expectedAmount" DECIMAL(10,2),
    "actualAmount" DECIMAL(10,2),
    "varianceAmount" DECIMAL(10,2),
    "notes" TEXT,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashExpense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'drugo',
    "amount" DECIMAL(10,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Warranty_organizationId_idx" ON "Warranty"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Warranty_customerId_idx" ON "Warranty"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Warranty_documentId_idx" ON "Warranty"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Warranty_status_idx" ON "Warranty"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Warranty_organizationId_status_validUntil_idx" ON "Warranty"("organizationId", "status", "validUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WarrantyClaim_organizationId_idx" ON "WarrantyClaim"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WarrantyClaim_warrantyId_idx" ON "WarrantyClaim"("warrantyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashSession_organizationId_status_idx" ON "CashSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashSession_organizationId_openedAt_idx" ON "CashSession"("organizationId", "openedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashSession_staffId_idx" ON "CashSession"("staffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashExpense_organizationId_createdAt_idx" ON "CashExpense"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashExpense_sessionId_idx" ON "CashExpense"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_sourceId_idx" ON "Document"("sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_cashSessionId_idx" ON "Order"("cashSessionId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_cashSessionId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_sourceId_fkey') THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_organizationId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_customerId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warranty_documentId_fkey') THEN
    ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WarrantyClaim_organizationId_fkey') THEN
    ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WarrantyClaim_warrantyId_fkey') THEN
    ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_organizationId_fkey') THEN
    ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_openedById_fkey') THEN
    ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashSession_closedById_fkey') THEN
    ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashExpense_sessionId_fkey') THEN
    ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashExpense_organizationId_fkey') THEN
    ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashExpense_recordedById_fkey') THEN
    ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
