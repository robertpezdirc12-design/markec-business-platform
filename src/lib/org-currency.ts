import { prisma } from "@/lib/prisma"

/**
 * Valuta organizacije (privzeto EUR).
 *
 * M5 (audit 2026-11): Stripe bremenitve in zapisi dokumentov morajo
 * uporabljati valuto najemnika (SalonConfig.currency), ne trdo kodiranega
 * EUR. Uporablja se v vseh server-side plačilnih poteh.
 */
export async function getOrgCurrency(organizationId: string): Promise<string> {
  const cfg = await prisma.salonConfig.findFirst({
    where: { organizationId },
    select: { currency: true },
  })
  return cfg?.currency ?? "EUR"
}
