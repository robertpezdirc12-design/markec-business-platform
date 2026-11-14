// ============================================================
// BILLING GRACE ENFORCEMENT (točka 7b) — cron job
//
// Teče poleg drugih cron opravil (api/cron/tick, dnevno 03:00).
// Za vsako naročnino v grace (PAST_DUE/UNPAID) odloči (pure
// billingGraceDecision) in:
//   • pošlje redni opomnik (idempotentno prek lastReminderAt),
//   • pošlje končno opozorilo pred suspenzom (suspendNotifiedAt),
//   • po izteku grace SUSPENDira org (status → SUSPENDED,
//     PlatformAuditLog), NIKOLI ne briše podatkov.
//
// Fail-soft & at-least-once: zapis landing fields se zgodi le ob
// dejanskem pošiljanju/suspenzu; če proces pade vmes, naslednji tek
// ponovi (podvojen opomnik neškodljiv, izpuščen suspenz ne).
// ============================================================

import { prisma } from "@/lib/prisma"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendBillingReminderEmail } from "@/lib/email/billing-reminder"
import { billingGraceDecision, BILLING_GRACE_DURATION_MS } from "@/lib/billing/grace"
import { ORG_STATUS_SUSPENDED } from "@/lib/platform/access"
import type { Prisma } from "@prisma/client"

const BATCH = 50

/** Dnevno število poln grace — uporablja se za izbira dn. */
export function graceExpiry(graceStartedAt: Date): Date {
  return new Date(graceStartedAt.getTime() + BILLING_GRACE_DURATION_MS)
}

export async function enforceBillingGrace(
  now: Date = new Date()
): Promise<{
  sent: number
  failed: number
  skipped?: string
  detail?: Record<string, unknown>
}> {
  if (!isEmailServiceConfigured()) {
    // Brez email transporta job pošteno izstopi (ne pošlje napake, ne suspenzira
    // na slepo) — suspenz je vedno pred-opozorjen. V produkc. je email nujen.
    return { sent: 0, failed: 0, skipped: "no-email-transport" }
  }

  const inGrace = await prisma.platformSubscription.findMany({
    where: {
      status: { in: ["PAST_DUE", "UNPAID"] },
      graceStartedAt: { not: null },
    },
    take: BATCH,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          status: true,
          slug: true,
          plan: true,
          salonConfig: { select: { email: true } },
          // lastnik: najdemo ADMIN uporabnika, ki je član te org (če ni salonConfig email).
          members: {
            where: { role: "ADMIN" },
            select: { user: { select: { email: true } } },
            take: 1,
          },
        },
      },
    },
  })

  let sent = 0
  let final = 0
  let suspended = 0
  let failedEmails = 0
  const billingHrefBase =
    (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") + "/dashboard/settings"

  for (const sub of inGrace) {
    const org = sub.organization
    if (org.status === ORG_STATUS_SUSPENDED) continue // že ustavljen

    const decision = billingGraceDecision(sub, now)
    if (decision.phase === "grace") {
      const ownerEmail =
        org.salonConfig?.email ??
        org.members[0]?.user?.email ??
        null
      if (!ownerEmail) continue // ni poštnega naslova → ne moremo opozoriti, skip
      const billingHref = `${billingHrefBase}?plan=${org.plan}`

      // Končno opozorilo (prednostno, ≤24 h pred koncem grace).
      if (decision.finalWarningDue) {
        const ok = await sendBillingReminderEmail({
          email: ownerEmail,
          orgName: org.name,
          plan: sub.plan ?? org.plan,
          kind: "final",
          billingHref,
        })
        if (ok.success) {
          final += 1
          await prisma.platformSubscription.update({
            where: { id: sub.id },
            data: { suspendNotifiedAt: now },
          })
        } else {
          failedEmails += 1
        }
      } else if (decision.reminderDue) {
        const ok = await sendBillingReminderEmail({
          email: ownerEmail,
          orgName: org.name,
          plan: sub.plan ?? org.plan,
          kind: "reminder",
          daysLeft: decision.daysLeft,
          billingHref,
        })
        if (ok.success) {
          sent += 1
          await prisma.platformSubscription.update({
            where: { id: sub.id },
            data: { lastReminderAt: now },
          })
        } else {
          failedEmails += 1
        }
      }
    } else if (decision.phase === "suspend-due") {
      // Končno opozorilo @ normalno, ampak če ni uspel nikoli pošlji zdaj, da ne
      // ustavimo presenetično. Če suspendNotifiedAt ni nikoli uspel → pošlji enkrat.
      const ownerEmail = org.salonConfig?.email ?? org.members[0]?.user?.email ?? null
      if (!sub.suspendNotifiedAt || decision.daysOverdue >= 1) {
        if (ownerEmail) {
          const ok = await sendBillingReminderEmail({
            email: ownerEmail,
            orgName: org.name,
            plan: sub.plan ?? org.plan,
            kind: "final",
            billingHref: `${billingHrefBase}?plan=${org.plan}`,
          })
          if (ok.success) {
            final += 1
            await prisma.platformSubscription.update({
              where: { id: sub.id },
              data: { suspendNotifiedAt: now },
            })
          } else {
            failedEmails += 1
          }
        }
      }

      await prisma.$transaction([
        prisma.organization.update({
          where: { id: org.id },
          data: {
            status: ORG_STATUS_SUSPENDED,
            suspendedAt: now,
            suspendedReason: "Neplačana naročnina — grace tok je potekel.",
          },
        }),
        prisma.platformAuditLog.create({
          data: {
            organizationId: org.id,
            actorEmail: "system@grace-cron",
            action: "TENANT_SUSPENDED",
            reason: "Neplačana naročnina (grace potekel).",
            metadata: { daysOverdue: decision.daysOverdue, auto: true } as Prisma.InputJsonValue,
          },
        }),
      ])
      suspended += 1
    }
  }

  return {
    sent,
    failed: failedEmails,
    detail: { batch: inGrace.length, finalWarnings: final, suspended },
  }
}