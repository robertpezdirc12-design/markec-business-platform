-- CreateTable
CREATE TABLE "PublicationHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "siteContent" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "PublicationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationHistory_organizationId_idx" ON "PublicationHistory"("organizationId");

-- CreateIndex
CREATE INDEX "PublicationHistory_organizationId_publishedAt_idx" ON "PublicationHistory"("organizationId", "publishedAt");

-- AddForeignKey
ALTER TABLE "PublicationHistory" ADD CONSTRAINT "PublicationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;