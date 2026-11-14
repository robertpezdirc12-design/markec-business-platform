-- AlterTable
ALTER TABLE "PlatformSubscription" ADD COLUMN     "graceStartedAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "suspendNotifiedAt" TIMESTAMP(3);