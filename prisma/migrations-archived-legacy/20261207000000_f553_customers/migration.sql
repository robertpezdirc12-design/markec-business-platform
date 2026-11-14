-- F5.5.3.1 — Upravljanje strank (Moje stranke)
-- Arhiviranje strank (ne brisanje) + opcijska povezava walk-in vstopa na stranko.

-- Customer: arhiviranje (zgodovina se ohrani).
ALTER TABLE "Customer" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- WalkInEntry: opcijska povezava na Customer (SetNull — vstop preživi anonimizacijo).
ALTER TABLE "WalkInEntry" ADD COLUMN     "customerId" TEXT;
CREATE INDEX "WalkInEntry_customerId_idx" ON "WalkInEntry"("customerId");
ALTER TABLE "WalkInEntry" ADD CONSTRAINT "WalkInEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;