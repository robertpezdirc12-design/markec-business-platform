-- ============================================================
-- F5.2 — KATEGORIJE IN PODKATEGORIJE (additivna razširitev Category)
--
-- Doda: parentId (hierarhija), description, image, sortOrder,
-- isActive, categoryType (PRODUCTS | SERVICES | BOTH).
-- Vsa nova polja so nullable ali imajo privzete vrednosti, zato
-- obstoječe vrstice ostanejo nespremenjene (BOTH, active, order 0,
-- brez starša). Self-relacija parentId → id (SET NULL ob brisanju
-- starša: otroci postanejo korenski, elementi se NIKOLI ne izbrišejo).
-- Additivno in idempotentno (IF NOT EXISTS).
-- ============================================================

-- ---- Enum: CategoryType --------------------------------------
DO $$ BEGIN
  CREATE TYPE "CategoryType" AS ENUM ('PRODUCTS','SERVICES','BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Stolpci na Category --------------------------------------
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "categoryType" "CategoryType" NOT NULL DEFAULT 'BOTH';

-- ---- Indeksi za hierarhijo in izpis ---------------------------
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX IF NOT EXISTS "Category_organizationId_isActive_sortOrder_idx"
    ON "Category"("organizationId", "isActive", "sortOrder");