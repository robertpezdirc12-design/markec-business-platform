-- ============================================================
-- F5.5.4.3 — PDF, E-POŠTA IN ELEKTRONSKI ARHIV DOKUMENTOV.
--
--  • DocumentArchive: nespremenljiv original (PDF, base64) izdanega
--    dokumenta + sha256 + metapodatki; @unique(documentId) prepreči
--    prepis že arhiviranega izvirnika; Restrict na izbris dokumenta.
--  • DocumentSendLog: sled pošiljanja (SENT le ob potrditvi ponudnika,
--    FAILED ob napaki, UNSENT brez konfiguriranega ponudnika).
--
-- Aditivno; brez izgube podatkov. Preverjeno na ločeni testni bazi
-- markec_f554_test (nikoli dev/prod).
-- ============================================================

-- ---- DocumentArchive ----
CREATE TABLE IF NOT EXISTS "DocumentArchive" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "doctype" TEXT NOT NULL,
  "docCode" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "generatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentArchive_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentArchive_documentId_key" ON "DocumentArchive"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentArchive_organizationId_idx" ON "DocumentArchive"("organizationId");
ALTER TABLE "DocumentArchive" ADD CONSTRAINT "DocumentArchive_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentArchive" ADD CONSTRAINT "DocumentArchive_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- DocumentSendLog ----
CREATE TABLE IF NOT EXISTS "DocumentSendLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "doctype" TEXT NOT NULL,
  "docCode" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "messageId" TEXT,
  "archiveId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentById" TEXT,
  CONSTRAINT "DocumentSendLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocumentSendLog_documentId_idx" ON "DocumentSendLog"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentSendLog_organizationId_idx" ON "DocumentSendLog"("organizationId");
CREATE INDEX IF NOT EXISTS "DocumentSendLog_toEmail_idx" ON "DocumentSendLog"("toEmail");
ALTER TABLE "DocumentSendLog" ADD CONSTRAINT "DocumentSendLog_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSendLog" ADD CONSTRAINT "DocumentSendLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;