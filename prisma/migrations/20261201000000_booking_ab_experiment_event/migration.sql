-- A/B eksperiment — krajša booking forma (analitični dogodki).
-- Nova samostojna tabela (ne spreminja Appointment): VIEW (stran
-- naložena v varianti) + CONVERSION (oddan termin), za konverzijo
-- po varianti (baseline "full" vs "short").

-- CreateEnum
CREATE TYPE "BookingExperimentKind" AS ENUM ('VIEW', 'CONVERSION');

-- CreateTable
CREATE TABLE "BookingExperimentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "kind" "BookingExperimentKind" NOT NULL,
    "sessionKey" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingExperimentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingExperimentEvent_organizationId_variant_kind_createdAt_idx"
ON "BookingExperimentEvent"("organizationId", "variant", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "BookingExperimentEvent_organizationId_sessionKey_idx"
ON "BookingExperimentEvent"("organizationId", "sessionKey");