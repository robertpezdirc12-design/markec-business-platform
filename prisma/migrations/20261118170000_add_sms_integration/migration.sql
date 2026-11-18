-- #110 — 46elks SMS integracija.
-- Lastnik v Nastavitve → Obvestila vnese API podatke za pošiljanje SMS.
-- Brez nastavitve se SMS NE pošilja.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "smsApiKey" TEXT,
ADD COLUMN "smsApiPassword" TEXT,
ADD COLUMN "smsSenderName" TEXT DEFAULT 'MARKEC',
ADD COLUMN "smsConfiguredAt" TIMESTAMP(3);
