-- #OBOJE: uporabniško ime (username) kot alternativa e-pošti pri prijavi.
-- Neobvezno polje; edinstveno med ne-praznimi vrednostmi (Postgres
-- UNIQUE omogoča več NULL zapisov).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
