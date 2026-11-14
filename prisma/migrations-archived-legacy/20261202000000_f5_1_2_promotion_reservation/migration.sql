-- ============================================================
-- F5.1.2 — STARTUPNA (začasna) rezervacija promocijskega mesta
--
-- Stripe payment amount integrity: ko dva kupca hkrati ustvarita
-- checkout za promocijo z maxUses=1, mora znesek, ki ga kupec plača
-- (PaymentIntent.amount_received), VEDNO sovpadati z zneskom, ki ga
-- MARKEC evidentira (Order.total + promotionSnapshot). Brez
-- rezervacije bi oba videla/plačala popustan znesek, ob unovčenju pa
-- bi se en naročil korektiral na polno ceno — kar ne bi ustrezalo
-- dejansko zaračunanemu znesku.
--
-- Rešitev (aditivno, neen stagljivo): vrstica PromotionRedemption
-- dobi status RESERVED | REDEEMED (+ heldUntil + checkoutSessionId).
-- RESERVED zaklene maxRedemptions/maxPerCustomer mesto ob ustvarjanju
-- checkouta; uspešno plačilo jo preklopi v REDEEMED; preteklo
-- (heldUntil < now) ali preklicano plačilo jo sprosti (lazy purge).
-- Ponovljen webhook ne podvoji unovčenja zaradi @@unique.
--
-- Additivno: novi stolpci so nullable / defaulted; obstoječe vrstice
-- ostanejo REDEEMED (default) in se obnašajo identično kot prej.
-- ============================================================

-- ---- Enum -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('RESERVED','REDEEMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Stolpci na PromotionRedemption ---------------------------
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'REDEEMED';
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "heldUntil" TIMESTAMP(3);
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "checkoutSessionId" TEXT;

-- ---- Indeks za lazy-spustitev ekspiranih rezervacij ------------
CREATE INDEX IF NOT EXISTS "PromotionRedemption_status_heldUntil_idx"
    ON "PromotionRedemption"("status", "heldUntil");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_checkoutSessionId_idx"
    ON "PromotionRedemption"("checkoutSessionId");