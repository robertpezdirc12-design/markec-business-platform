-- ============================================================
-- F5.5.4.1 — VARNOST IN PRAVILNOST DOKUMENTOV
--
--  • Nespremenljivi posnetki (issuer/customer snapshot, vatEnabled)
--    na Document — prikaz izdanega dokumenta ne bere živih podatkov.
--  • Totali (subtotal/discountAmount/taxBase/taxTotal/total) strežniško,
--    cena je BRUTO (slovenska konvencija).
--  • Davčna in popustna preslika na DocumentItem (vatRate, discountPercent).
--  • Številčenje po org + tip + poslovnem letu (fiscalYear) — obstoječi
--    dokumenti ohranijo svoje številke (fiscalYear = leto issueDate).
--  • DocumentSequence (serija, zaklenjena s FOR UPDATE) za vzporedno
--    izdajanje brez duplikatov.
--  • Povezave na Order in Appointment (org-scoped).
--
-- Dodajalno; brez izgube podatkov. Preverjeno na ločeni testni bazi
-- markec_f554_test (nikoli dev/prod).
-- ============================================================

-- ---- 1) SalonConfig: računovodski podatki izdajatelja ----
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "vatId" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "isVatRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "SalonConfig" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;

-- ---- 2) Document: novi stolpci ----
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "issuedByUserId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fiscalYear" INTEGER NOT NULL DEFAULT 0;

-- posnetki + davčna oznaka
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "issuerSnapshot" JSONB;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "vatEnabled" BOOLEAN NOT NULL DEFAULT false;

-- totali (strežniško)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(10,2);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "taxBase" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "taxTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- obstoječi zapisi: fiscalYear = leto issueDate, total = subtotal (bruto),
-- vatEnabled = false (nismo poznali DDV), taxBase = total (brez DDV).
UPDATE "Document" SET "fiscalYear" = EXTRACT(YEAR FROM "issueDate")::int WHERE "fiscalYear" = 0;
UPDATE "Document" SET "subtotal" = "total" WHERE "subtotal" IS NULL;
UPDATE "Document" SET "taxBase" = "total" WHERE "taxBase" = 0;
UPDATE "Document" SET "total" = "subtotal" WHERE "total" IS NULL;

-- stolpec subtotal ne sme biti NULL za nove zapise (privzeta vrednost)
ALTER TABLE "Document" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "subtotal" SET DEFAULT 0;

-- ---- 3) Document: unique → org+tip+leto+številka, ohranja številke ----
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_organizationId_type_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Document_organizationId_type_fiscalYear_number_key"
  ON "Document"("organizationId", "type", "fiscalYear", "number");
CREATE INDEX IF NOT EXISTS "Document_fiscalYear_idx" ON "Document"("fiscalYear");
CREATE INDEX IF NOT EXISTS "Document_orderId_idx" ON "Document"("orderId");
CREATE INDEX IF NOT EXISTS "Document_appointmentId_idx" ON "Document"("appointmentId");

-- FKs na Order/Appointment (org preverjena v akcijah; relacija SET NULL, da
-- vstop preživi anonimizacijo/izbris izvornega zapisa).
ALTER TABLE "Document" ADD CONSTRAINT "Document_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---- 4) DocumentItem: davčna in popustna preslika ----
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "taxBaseLine" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "DocumentItem" ADD COLUMN IF NOT EXISTS "catalogRef" TEXT;

-- ---- 5) DocumentSequence: serija za številčenje ----
CREATE TABLE IF NOT EXISTS "DocumentSequence" (
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("organizationId", "type", "fiscalYear")
);