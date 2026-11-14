-- ============================================================
-- F5.5.4.2 — PLAČILA, DOBROPISI, ŽIVLJENJSKI CIKEL DOKUMENTOV.
--
--  • Document: paidAmount, creditedTotal (strežniško vzdrževana).
--  • DocumentPayment: plačila + sledljivi storno (REVERSAL, negativen
--    znesek, reversalOfId); delni unikat (org, documentId, externalRef)
--    prepreči dvojno knjiženje istega plačila.
--  • CreditNote: dobropis, vezan na izvirni račun (original number ref),
--    z deljenim DDV; ne spreminja totalov izvirnega računa.
--  • DocumentEvent: revizijska sled življenjskega cikla.
--
-- Aditivno; brez izgube podatkov. Preverjeno na ločeni testni bazi
-- markec_f554_test (nikoli dev/prod).
-- ============================================================

-- ---- 1) Document: paidAmount + creditedTotal ----
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "creditedTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ---- 2) DocumentPayment ----
CREATE TABLE IF NOT EXISTS "DocumentPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PAYMENT',
  "amount" DECIMAL(10,2) NOT NULL,
  "method" TEXT,
  "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'CLEARED',
  "reversalOfId" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocumentPayment_documentId_idx" ON "DocumentPayment"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentPayment_organizationId_idx" ON "DocumentPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "DocumentPayment_reversalOfId_idx" ON "DocumentPayment"("reversalOfId");
-- Delno požvrčenje dvojne knjižbe (le kadar externalRef ≠ NULL):
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentPayment_org_doc_ref_key"
  ON "DocumentPayment"("organizationId", "documentId", "reference")
  WHERE "reference" IS NOT NULL;
ALTER TABLE "DocumentPayment" ADD CONSTRAINT "DocumentPayment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPayment" ADD CONSTRAINT "DocumentPayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- 3) CreditNote ----
CREATE TABLE IF NOT EXISTS "CreditNote" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "invoiceId" TEXT NOT NULL,
  "customerId" TEXT,
  "originalInvoiceNumber" INTEGER NOT NULL,
  "originalInvoiceCode" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "taxBase" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_organizationId_fiscalYear_number_key"
  ON "CreditNote"("organizationId", "fiscalYear", "number");
CREATE INDEX IF NOT EXISTS "CreditNote_organizationId_idx" ON "CreditNote"("organizationId");
CREATE INDEX IF NOT EXISTS "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---- 4) DocumentEvent (življenjska sled) ----
CREATE TABLE IF NOT EXISTS "DocumentEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT,
  "actorUserId" TEXT,
  "amount" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocumentEvent_documentId_idx" ON "DocumentEvent"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentEvent_documentId_createdAt_idx" ON "DocumentEvent"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "DocumentEvent_organizationId_idx" ON "DocumentEvent"("organizationId");
ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;