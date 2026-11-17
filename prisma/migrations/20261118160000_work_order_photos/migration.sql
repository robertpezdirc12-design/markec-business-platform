-- ============================================================
-- FOTOGRAFIJE NAROČILA po stopnjah (2026-11-18)
--
-- Vsaka fotografija nosi stopnjo, v kateri je nastala, da je pozneje ni
-- mogoče pripisati napačnemu trenutku. Brisanje naročila pobriše tudi
-- zapise fotografij (slike v Cloudinaryju/sefu ostanejo — brisanje
-- zunanjih virov ni del te migracije).
--
-- Idempotentno (IF NOT EXISTS + DO bloki).
-- ============================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkOrderPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stageKey" TEXT,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "caption" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrderPhoto_organizationId_workOrderId_idx" ON "WorkOrderPhoto"("organizationId", "workOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrderPhoto_workOrderId_createdAt_idx" ON "WorkOrderPhoto"("workOrderId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPhoto_organizationId_fkey') THEN
    ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPhoto_workOrderId_fkey') THEN
    ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderPhoto_uploadedById_fkey') THEN
    ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

