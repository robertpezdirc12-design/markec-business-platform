-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "buyerReference" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "customerType" TEXT,
ADD COLUMN     "electronicId" TEXT,
ADD COLUMN     "electronicIdScheme" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "orderReference" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "vatId" TEXT;

-- CreateTable
CREATE TABLE "EInvoiceSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eslogEnabled" BOOLEAN NOT NULL DEFAULT false,
    "peppolEnabled" BOOLEAN NOT NULL DEFAULT false,
    "b2bEnabled" BOOLEAN NOT NULL DEFAULT false,
    "invoiceTypeCode" INTEGER NOT NULL DEFAULT 380,
    "creditNoteTypeCode" INTEGER NOT NULL DEFAULT 381,
    "advanceTypeCode" INTEGER NOT NULL DEFAULT 386,
    "retentionYears" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceChannelConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "providerEndpoint" TEXT,
    "encryptedSecret" TEXT,
    "encryptedKeyRef" TEXT,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceChannelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "docCode" TEXT NOT NULL,
    "xml" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "xmlValidatedXsd" BOOLEAN NOT NULL DEFAULT false,
    "xmlValidatedBusiness" BOOLEAN NOT NULL DEFAULT false,
    "validationMessages" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALIDATED',
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "einvoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "data" TEXT,
    "sha256" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceDeliveryEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "einvoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceSettings_organizationId_key" ON "EInvoiceSettings"("organizationId");

-- CreateIndex
CREATE INDEX "EInvoiceChannelConfig_organizationId_idx" ON "EInvoiceChannelConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceChannelConfig_organizationId_channel_key" ON "EInvoiceChannelConfig"("organizationId", "channel");

-- CreateIndex
CREATE INDEX "EInvoice_organizationId_idx" ON "EInvoice"("organizationId");

-- CreateIndex
CREATE INDEX "EInvoice_documentId_idx" ON "EInvoice"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_organizationId_documentId_format_kind_key" ON "EInvoice"("organizationId", "documentId", "format", "kind");

-- CreateIndex
CREATE INDEX "EInvoiceReceipt_einvoiceId_idx" ON "EInvoiceReceipt"("einvoiceId");

-- CreateIndex
CREATE INDEX "EInvoiceReceipt_organizationId_idx" ON "EInvoiceReceipt"("organizationId");

-- CreateIndex
CREATE INDEX "EInvoiceDeliveryEvent_einvoiceId_idx" ON "EInvoiceDeliveryEvent"("einvoiceId");

-- CreateIndex
CREATE INDEX "EInvoiceDeliveryEvent_einvoiceId_createdAt_idx" ON "EInvoiceDeliveryEvent"("einvoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "EInvoiceDeliveryEvent_organizationId_idx" ON "EInvoiceDeliveryEvent"("organizationId");

-- AddForeignKey
ALTER TABLE "EInvoiceSettings" ADD CONSTRAINT "EInvoiceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceChannelConfig" ADD CONSTRAINT "EInvoiceChannelConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceReceipt" ADD CONSTRAINT "EInvoiceReceipt_einvoiceId_fkey" FOREIGN KEY ("einvoiceId") REFERENCES "EInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceDeliveryEvent" ADD CONSTRAINT "EInvoiceDeliveryEvent_einvoiceId_fkey" FOREIGN KEY ("einvoiceId") REFERENCES "EInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
