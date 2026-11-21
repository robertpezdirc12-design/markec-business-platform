import { NextResponse } from "next/server"
import { sendDueReminders } from "@/lib/jobs/send-due-reminders"
import { expireStalePending } from "@/lib/jobs/expire-stale-pending"
import { sendMarketingEmails } from "@/lib/jobs/send-marketing-emails"
import { sendDailyDigest } from "@/lib/jobs/send-daily-digest"
import { withJobRun } from "@/lib/jobs/job-run"
import { purgeExpiredRateLimits } from "@/lib/rate-limit"
import { enforceBillingGrace } from "@/lib/jobs/enforce-billing-grace"
import { retryPendingDeliveries } from "@/lib/webhooks/outgoing"
import { pollPendingDeliveries } from "@/lib/einvoice/delivery"

export const dynamic = "force-dynamic"

/**
 * P1 #76 — edini sistemski časovnik v izdelku (Vercel cron, dnevno 03:00
 * UTC — glej vercel.json; #99: dnevni digest poteče ob istem teku).
 *
 * Varnost: Vercel podpisuje cron zahtevke z `Authorization: Bearer
 * $CRON_SECRET`. Brez ujemanja → 401. Manjkajoč CRON_SECRET v okolju →
 * vedno 401 (route je zaprt, dokler skrivnost ni nastavljena).
 */

/** Čista preverba avtorizacije — testabilna brez HTTP. */
export function isAuthorizedCron(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (
    !isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Vsak job je neodvisen: neuspeh opomnikov ne sme ustaviti čiščenja.
  const [reminders, expiry, marketing, digest, rateLimitPurge, billingGrace, webhookRetries, einvoiceDeliveryPoll] = await Promise.all([
    withJobRun("send-due-reminders", sendDueReminders),
    withJobRun("expire-stale-pending", expireStalePending),
    withJobRun("send-marketing-emails", sendMarketingEmails),
    // #99: dnevni digest lastniku (samo ko se je kaj zgodilo).
    withJobRun("send-daily-digest", sendDailyDigest),
    // Točka 1: počisti zastarele rate-limit vrstice (brez brisanja aktivnih oken).
    withJobRun("rate-limit-purge", async () => {
      const purged = await purgeExpiredRateLimits()
      return { sent: purged, failed: 0, detail: { purged } }
    }),
    // Točka 7b: grace tok neplačila (opomnik → grace → suspenz).
    withJobRun("enforce-billing-grace", () => enforceBillingGrace()),
    // #110: retry čakajočih outgoing webhook dostav.
    withJobRun("retry-webhook-deliveries", async () => {
      const result = await retryPendingDeliveries()
      return {
        sent: result.delivered,
        failed: result.dead,
        detail: result,
      }
    }),
    // F5.5.4.6.4 / Faza 3.2 (A9): sistemko globalno pollanje dostave e-računov.
    // To je edina površina, ki sme poganjati globalni poller (Bearer CRON_SECRET);
    // org uporabnik poganja samo svojo organizacijo prek pollEinvoiceDeliveries.
    withJobRun("einvoice-delivery-poll", async () => {
      const result = await pollPendingDeliveries()
      return { sent: result.transitioned, failed: 0, detail: result }
    }),
  ])

  return NextResponse.json({
    ok: true,
    results: {
      reminders,
      expiry,
      marketing,
      digest,
      rateLimitPurge,
      billingGrace,
      webhookRetries,
      einvoiceDeliveryPoll,
    },
  })
}
