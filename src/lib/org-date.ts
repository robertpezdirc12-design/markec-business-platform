import { prisma } from "@/lib/prisma"
import { safeTimezone, toDateKey } from "@/lib/booking-time"

/**
 * "Today" as a salon-local calendar date (`YYYY-MM-DD`).
 *
 * Server actions used `new Date().toISOString().slice(0, 10)` for default
 * dates. That is the UTC date: for a Slovenian business (UTC+1/+2) it is
 * still *yesterday* until 01:00/02:00 local, so records created after
 * midnight were back-dated. Business dates must follow the tenant's timezone.
 */
export async function orgToday(
  organizationId: string,
  now: Date = new Date()
): Promise<string> {
  const cfg = await prisma.salonConfig.findUnique({
    where: { organizationId },
    select: { timezone: true },
  })
  return (
    toDateKey(now, safeTimezone(cfg?.timezone)) ?? now.toISOString().slice(0, 10)
  )
}
