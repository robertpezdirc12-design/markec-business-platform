-- Faza 3.2 (varnost): A6 nedvomna povezava pošiljke + A10 omejitev poskusov polinga.

-- A6: edinstvena preslikava (channel, providerMessageId) → ena pošiljka/organizacija.
-- Postgres edinstveni indeks obravnava NULL-e kot različne, zato več SUBMITTED/brez-ID
-- vrstic ni v sporu; vsak ne-NULL par je provable enoličen.
CREATE UNIQUE INDEX "EInvoice_channel_providerMessageId_key"
  ON "EInvoice" ("channel", "providerMessageId");

-- A10: števec zaporednih neuspešnih poskusov dostave + čas zadnjega poskusa.
ALTER TABLE "EInvoice" ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EInvoice" ADD COLUMN "lastDeliveryAttemptAt" TIMESTAMP(3);