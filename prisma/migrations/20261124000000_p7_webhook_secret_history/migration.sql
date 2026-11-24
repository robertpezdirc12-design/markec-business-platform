-- M20 (audit 2026-11): zgodovina rotiranih webhook skrivnosti (grace okno).
CREATE TABLE "WebhookSecretHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSecretHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookSecretHistory_organizationId_createdAt_idx"
    ON "WebhookSecretHistory"("organizationId", "createdAt");

ALTER TABLE "WebhookSecretHistory"
    ADD CONSTRAINT "WebhookSecretHistory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
