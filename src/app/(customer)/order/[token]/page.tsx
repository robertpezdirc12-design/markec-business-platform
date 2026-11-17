import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getResolvedOrg } from "@/lib/tenant"
import { isPublicToken, summarizePayments, isDepositCovered } from "@/lib/work-orders/payment-summary"
import { isOrgStripeConfigured } from "@/lib/stripe"
import { PublicOrderClient } from "@/components/public/public-order-client"

// ============================================================
// JAVNA STRAN NAROČILA — /s/<slug>/order/<token>
//
// Stranka tu vidi svoj predračun (znesek, rok, kontakt), ga potrdi ali
// zavrne in — če je najemnik vnesel svoj Stripe ključ — plača depozit.
// Žeton je edina skrivnost: 64 znakov hex, iskan izključno znotraj
// najemnika, ki ga razreši tenant kontekst. Stran ni nikoli indeksirana.
// ============================================================

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const org = await getResolvedOrg()
  return {
    title: `Naročilo | ${org?.name ?? "Podjetje"}`,
    // Žeton je zasebna povezava — nikoli v iskalnike.
    robots: { index: false, follow: false },
  }
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("sl-SI", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ paid?: string }>
}) {
  const [{ token }, query, org] = await Promise.all([
    params,
    searchParams,
    getResolvedOrg(),
  ])

  if (!org || !isPublicToken(token)) notFound()

  const order = await prisma.workOrder.findFirst({
    where: { publicToken: token, organizationId: org.id },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      dueDate: true,
      total: true,
      notes: true,
      depositAmount: true,
      customerApprovedAt: true,
      customerDeclinedAt: true,
      declineReason: true,
      currentStageKey: true,
      customer: { select: { name: true } },
      workflowDefinition: {
        select: {
          stages: { orderBy: { order: "asc" }, select: { key: true, name: true, order: true } },
        },
      },
      payments: { select: { amount: true, method: true, paidAt: true } },
    },
  })

  if (!order) notFound()

  // Kontakt izvajalca je v SalonConfig (nastavitve salona), ne na organizaciji.
  const config = await prisma.salonConfig.findFirst({
    where: { organizationId: org.id },
    select: { phone: true, email: true },
  })

  const summary = summarizePayments({
    total: order.total === null ? null : Number(order.total),
    depositAmount: order.depositAmount === null ? null : Number(order.depositAmount),
    payments: order.payments.map((p) => Number(p.amount)),
  })

  const stage = order.workflowDefinition?.stages.find(
    (s) => s.key === order.currentStageKey
  )
  const totalStages = order.workflowDefinition?.stages.length ?? 0

  return (
    <PublicOrderClient
      token={token}
      justPaid={query.paid === "1"}
      order={{
        number: order.number,
        title: order.title,
        status: order.status,
        customerName: order.customer?.name ?? null,
        dueDateLabel: fmtDate(order.dueDate?.toISOString() ?? null),
        stageName: stage?.name ?? null,
        stageNumber: stage?.order !== undefined ? stage.order + 1 : null,
        totalStages,
        notes: order.notes,
        approvedAt: order.customerApprovedAt?.toISOString() ?? null,
        declinedAt: order.customerDeclinedAt?.toISOString() ?? null,
        declineReason: order.declineReason,
        depositAmount: summary.depositAmount,
        depositCovered: isDepositCovered(summary.depositAmount, summary.paid),
        paid: summary.paid,
        balance: summary.balance,
        payments: order.payments.map((p) => ({
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.paidAt.toISOString(),
        })),
        paymentState: summary.state,
      }}
      business={{
        name: org.name,
        phone: config?.phone ?? null,
        email: config?.email ?? null,
        slug: org.slug,
      }}
      stripeConfigured={isOrgStripeConfigured(org)}
    />
  )
}
