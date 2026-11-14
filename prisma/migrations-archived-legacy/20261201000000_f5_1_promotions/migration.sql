-- ============================================================
-- F5.1 — POPUSTI IN PROMOCIJE
--
-- Tenant-scoped promotions the owner creates in the dashboard.
--   • Promotion            — a discount rule (percent/fixed, scope,
--                            target entities, dates, code, limits).
--   • PromotionRedemption  — one concrete use, guarded by a UNIQUE
--                            constraint so a promotion can never be
--                            redeemed twice on the same transaction.
-- Plus immutable discount snapshots on Order and Appointment so a
-- later edit of a Promotion never rewrites past transactions.
--
-- Migration is additive and applies cleanly to a fresh test database
-- (it is run through `prisma migrate deploy` against markec_f51_test
-- during the F5.1 integration suite setup). No existing data is
-- touched: all new columns are nullable or defaulted.
-- ============================================================

-- ---- Enums ----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "PromotionScope" AS ENUM ('WHOLE_AMOUNT','PRODUCTS','SERVICES','CATEGORIES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PromotionDiscountType" AS ENUM ('PERCENT','FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT','ACTIVE','INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Promotion table ------------------------------------------
CREATE TABLE IF NOT EXISTS "Promotion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "PromotionDiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DECIMAL(10,2) NOT NULL,
    "scope" "PromotionScope" NOT NULL DEFAULT 'WHOLE_AMOUNT',
    "targetEntityIds" TEXT[] NOT NULL DEFAULT '{}',
    "code" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "maxPerCustomer" INTEGER,
    "minOrderValue" DECIMAL(10,2),
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- ---- PromotionRedemption table --------------------------------
CREATE TABLE IF NOT EXISTS "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orderId" TEXT,
    "appointmentId" TEXT,
    "customerId" TEXT,
    "guestEmail" TEXT,
    "codeUsed" TEXT,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- ---- Indexes / unique constraints -----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_organizationId_code_key"
    ON "Promotion"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "Promotion_organizationId_idx"
    ON "Promotion"("organizationId");
CREATE INDEX IF NOT EXISTS "Promotion_organizationId_status_idx"
    ON "Promotion"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Promotion_organizationId_startsAt_endsAt_idx"
    ON "Promotion"("organizationId", "startsAt", "endsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_orderId_key"
    ON "PromotionRedemption"("promotionId", "orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_appointmentId_key"
    ON "PromotionRedemption"("promotionId", "appointmentId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_organizationId_idx"
    ON "PromotionRedemption"("organizationId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_idx"
    ON "PromotionRedemption"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_orderId_idx"
    ON "PromotionRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_appointmentId_idx"
    ON "PromotionRedemption"("appointmentId");

-- FKs (org cascade; promotion cascade; redemption → order/appointment
-- are deliberately NOT enforced as FKs — they are plain scoping
-- columns because Order/Appointment models are shared with other
-- epics and we keep the snapshot decoupled).
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- Order / Appointment immutable discount snapshots ----------
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promotionDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promotionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "promotionDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "promotionId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB;