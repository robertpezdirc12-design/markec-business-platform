-- AlterTable — Faza 3.2 dostavna zanka: ID tehničnega sprejema ponudnika za
-- stanjsko preverjanje (poll dolgotrajne dostave SUBMITTED → DELIVERED).
ALTER TABLE "EInvoice" ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "channel" TEXT;