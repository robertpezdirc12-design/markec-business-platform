-- F5.5.1.2 — Online Inventory Reservation.
-- Ločimo RAZPOLOŽLJIVO (stockQuantity − reservedQuantity), REZERVIRANO
-- (reservedQuantity) in PRODANO (stockQuantity se zniža ob potrjenem plačilu).
-- Za izdelke in različice; obstoječe vrstice ostanejo s reservedQuantity=0.

ALTER TABLE "Product" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductVariant" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;