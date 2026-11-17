-- ============================================================
-- PREDRAČUN → STRANKA + DENAR NA NAROČILU (2026-11-18)
--
-- Delovno naročilo dobi:
--   • javni žeton (povezava za stranko: potrditev predračuna, depozit),
--   • potrditev/odklonitev stranke z datumom in razlogom,
--   • načrtovani depozit + datum plačila depozita,
--   • tabelo WorkOrderPayment (append-only plačila: depozit prek Stripe,
--     gotovina/kartica/nakazilo pri prevzemu).
--
-- Idempotentno (IF NOT EXISTS + DO bloki), varno tudi ob ponovnem izvajanju.
-- ============================================================

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "customerApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "customerDeclinedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "declineReason" TEXT,
ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "publicToken" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkOrderPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderPayment_stripeSessionId_key" ON "WorkOrderPayment"("stripeSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrderPayment_organizationId_paidAt_idx" ON "WorkOrderPayment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrderPayment_workOrderId_idx" ON "WorkOrderPayment"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_publicToken_key" ON "WorkOrder"("publicToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrder_organizationId_depositPaidAt_idx" ON "WorkOrder"("organizationId", "depositPaidAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPayment_recordedById_fkey') THEN
    ALTER TABLE "WorkOrderPayment" ADD CONSTRAINT "WorkOrderPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPayment_organizationId_fkey') THEN
    ALTER TABLE "WorkOrderPayment" ADD CONSTRAINT "WorkOrderPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPayment_workOrderId_fkey') THEN
    ALTER TABLE "WorkOrderPayment" ADD CONSTRAINT "WorkOrderPayment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

