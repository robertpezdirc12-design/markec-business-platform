-- Username-identifikator : prijava z e-pošto ALI uporabniškim imenom.
-- Neobvezen, unikaten stolpec (NULL za obstoječe uporabnike — nazaj združljivo).
-- Vrednosti se normalizirajo na lowercase v aplikaciji (resolveLoginToEmail /
-- normalizeUsername); unikatnost velja za shranjeno (lowercase) vrednost.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");