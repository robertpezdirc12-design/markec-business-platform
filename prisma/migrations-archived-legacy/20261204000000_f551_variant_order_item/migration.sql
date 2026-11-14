-- F5.5.1 — ProductVariants → Checkout.
-- OrderItem dobi mehko referenco na kupljeno različico + snapshot polja,
-- da poznejše urejanje/izbris izdelka ali različice ne spremeni zgodovine naročila.

-- 1) OrderItem: variant referenca + snapshot.
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantSku" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantPrice" DECIMAL(10, 2);

-- 2) Indeks na variantId (query po različici za izdelke/variante v naročilu).
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- 3) Mehka tuji ključ: izbris različice SetNull (zgodovina naročila ostane),
--    urejanje variante ne pokvari referenco.
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;