-- #110 — Minimax računovodska integracija (Slovenija).
-- Lastnik v Nastavitve → Računovodstvo vnese OAuth2 podatke za
-- povezavo z Minimax API. Brez nastavitve se računi NE izvažajo.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "minimaxClientId" TEXT,
ADD COLUMN "minimaxClientSecret" TEXT,
ADD COLUMN "minimaxUsername" TEXT,
ADD COLUMN "minimaxPassword" TEXT,
ADD COLUMN "minimaxOrganisationId" INTEGER,
ADD COLUMN "minimaxConfiguredAt" TIMESTAMP(3);
