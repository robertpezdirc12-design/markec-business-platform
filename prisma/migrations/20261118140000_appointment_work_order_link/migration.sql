-- ============================================================
-- PRIBION: termin ↔ delovno naročilo (2026-11-18)
--
-- Naročilo lahko ima priblonski termin (ali več). Povezava je mehka
-- (ON DELETE SET NULL): brisanje naročila ne sme pobrisati termina in
-- obratno — denarna in terminska zgodovina ostaneta neokrnjeni.
--
-- Idempotentno (IF NOT EXISTS + DO bloki).
-- ============================================================

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appointment_workOrderId_idx" ON "Appointment"("workOrderId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_workOrderId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

