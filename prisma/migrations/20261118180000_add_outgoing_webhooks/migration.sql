-- #110 — Outgoing webhooks: obvestila tretjim osebam ob dogodkih.

-- CreateTable
CREATE TABLE "OutgoingWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveredAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutgoingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "OutgoingWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutgoingWebhook_organizationId_idx" ON "OutgoingWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "OutgoingWebhookDelivery_webhookId_status_idx" ON "OutgoingWebhookDelivery"("webhookId", "status");

-- CreateIndex
CREATE INDEX "OutgoingWebhookDelivery_status_nextRetryAt_idx" ON "OutgoingWebhookDelivery"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "OutgoingWebhook" ADD CONSTRAINT "OutgoingWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingWebhookDelivery" ADD CONSTRAINT "OutgoingWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "OutgoingWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
