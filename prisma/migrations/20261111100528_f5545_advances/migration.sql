-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "advanceTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "parentInvoiceId" TEXT,
ADD COLUMN     "serviceDate" TIMESTAMP(3),
ADD COLUMN     "servicePeriodEnd" TIMESTAMP(3),
ADD COLUMN     "servicePeriodStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DocumentAdvanceAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "appliedToInvoice" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "taxBase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAdvanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAdvanceAllocation_organizationId_idx" ON "DocumentAdvanceAllocation"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentAdvanceAllocation_appliedToInvoice_idx" ON "DocumentAdvanceAllocation"("appliedToInvoice");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAdvanceAllocation_organizationId_advanceId_key" ON "DocumentAdvanceAllocation"("organizationId", "advanceId");

-- CreateIndex
CREATE INDEX "Document_parentInvoiceId_idx" ON "Document"("parentInvoiceId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentInvoiceId_fkey" FOREIGN KEY ("parentInvoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAdvanceAllocation" ADD CONSTRAINT "DocumentAdvanceAllocation_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAdvanceAllocation" ADD CONSTRAINT "DocumentAdvanceAllocation_appliedToInvoice_fkey" FOREIGN KEY ("appliedToInvoice") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
