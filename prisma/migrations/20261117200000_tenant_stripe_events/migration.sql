-- P1 (audit 2026-11) — idempotenca najemniškega Stripe webhooka.
-- Ponovljena dostava (Stripe retry, hkratna dostava dveh instanc) se zdaj
-- ustavi na unikatnem `stripeEventId`; vrstica je tudi kratek dnevnik dostav.
CREATE TABLE "TenantStripeEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'received',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantStripeEvent_stripeEventId_key" ON "TenantStripeEvent"("stripeEventId");
CREATE INDEX "TenantStripeEvent_organizationId_createdAt_idx" ON "TenantStripeEvent"("organizationId", "createdAt");
CREATE INDEX "TenantStripeEvent_outcome_createdAt_idx" ON "TenantStripeEvent"("outcome", "createdAt");
