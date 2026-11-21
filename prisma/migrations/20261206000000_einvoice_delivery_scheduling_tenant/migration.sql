-- Faza 3.2 (točki 2 in 4): tenant-safe unikatnost providerMessageId + pošteno
-- časovno razporejanje polinga brez starvation.

-- TOČKA 2 — TENANT-SAFE UNIKATNOST:
-- Stari globalni indeks (channel, providerMessageId) je dovoljeval "message-100"
-- le enkrat v CELI platformi. To je bilo napačno: Direct kanal lahko pri različnih
-- organizacijah/računih ponudnika vrne enak `providerMessageId` brez kolizije.
-- Nadomestimo ga z unikatnostjo ZNOTRAJ ene organizacije.
DROP INDEX "EInvoice_channel_providerMessageId_key";

-- TOČKA 4 — ČASOVNO RAZPOREJANJE POLINGA:
-- `lastPolledAt` omogoča rotacijo vrste (tudi ob stalnem SUBMITTED odgovoru se
-- `updatedAt` spremeni), `nextPollAt` pa izbira le časovno primerne zapise ter
-- omogoča backoff poskusov brez hitrega izčrpavanja `deliveryAttempts`.
ALTER TABLE "EInvoice" ADD COLUMN "lastPolledAt" TIMESTAMP(3);
ALTER TABLE "EInvoice" ADD COLUMN "nextPollAt" TIMESTAMPTZ(3);

-- Nov podporni indeks za polling po vrstnem redu zapadlosti.
CREATE INDEX "EInvoice_nextPollAt_idx" ON "EInvoice"("nextPollAt");

-- Unikatnost na (organizationId, channel, providerMessageId).
-- Postgres obravnava NULL-e kot različne → SUBMITTED brez-ID ni v sporu.
CREATE UNIQUE INDEX "EInvoice_organizationId_channel_providerMessageId_key"
  ON "EInvoice"("organizationId", "channel", "providerMessageId");