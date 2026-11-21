-- #129 (P0): Odprava Prisma migration drift indeksa BookingExperimentEvent.
-- Stari ročno ustvarjen indeks "BookingExperimentEvent_organizationId_variant_kind_createdAt_idx"
-- je bil >63 bytes (Prisma limit), zato ga Prisma ni znala mapirati na
-- @@index([organizationId, variant, kind, createdAt]) in prisma migrate diff
-- je padal. Nedestruktiven aditivni popravek: drop starega, recreate s kratkim
-- eksplicitnim imenom (map v modelu): "BookingExperimentEvent_variant_kind_date_idx".

-- DropIndex
DROP INDEX "BookingExperimentEvent_organizationId_variant_kind_createdAt_idx";

-- CreateIndex (kratko ime, ≤63 bytes — matche model *)
CREATE INDEX "BookingExperimentEvent_variant_kind_date_idx"
ON "BookingExperimentEvent"("organizationId", "variant", "kind", "createdAt");