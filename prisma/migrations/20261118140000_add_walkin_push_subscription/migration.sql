-- #108 — anonimna push naročnina gosta na walk-in vstopnici.
-- Gost ni prijavljen (ni User), zato so VAPID ključi shranjeni
-- neposredno na vstopnici. Push je opt-in — brez njega vrsta
-- deluje enako (polling ostane).

-- AlterTable
ALTER TABLE "WalkInEntry" ADD COLUMN "pushEndpoint" TEXT,
ADD COLUMN "pushP256dh" TEXT,
ADD COLUMN "pushAuth" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WalkInEntry_pushEndpoint_key" ON "WalkInEntry"("pushEndpoint");
