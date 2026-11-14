-- F5.5.1.1 — simulira "predhodno shemo" na markec_f5511_mig:
-- bodmo že seedan OrderItem mig-check-item obdrži (ohranitev podatkov).
-- Tukaj LE odstranimo F5.5.1 polja in očistimo _prisma_migrations,
-- da migracijski SQL nastopi na predhodnem stanju.

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_variantId_fkey";
DROP INDEX IF EXISTS "OrderItem_variantId_idx";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "variantId";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "variantName";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "variantSku";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "variantPrice";