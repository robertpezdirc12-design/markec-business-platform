import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { redeemGiftCardForOrder, activatePrepaidPurchase } from "@/app/actions/prepaid"
import {
  convertReservationToSale,
  applyOrderStockDecrement,
  releaseStockReservation,
} from "@/lib/orders/stock"
import { constructWebhookEvent, getStripeForOrg } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { addMinutes } from "date-fns"
import { after } from "next/server"
import { dispatchOutgoingEvent } from "@/lib/webhooks/outgoing"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"
import { getOrgById } from "@/lib/tenant"
import { checkTenantBinding, extractClaimedOrgId } from "@/lib/stripe/webhook-tenant"
import { formatSalonTime, safeTimezone } from "@/lib/booking-time"
import { acquireBookingLocks, bookingLockKeys } from "@/lib/booking/locking"
import { GUARANTEE_METADATA_TYPE } from "@/lib/booking/no-show-policy"
import { pickIntakeService } from "@/lib/forms/intake"
import { generateIntakeToken } from "@/lib/forms/intake-token"
import { Prisma } from "@prisma/client"
// P2 (audit 2026-11): webhook secret je v bazi šifriran.
import { decryptSecret } from "@/lib/crypto/secrets"
import Stripe from "stripe"
// F5.1: promo engine + atomsko unovčenje v webhooku (Stripe-paid path).
import { loadActivePromotions } from "@/lib/promotions/map"
import { bestPromotion, buildPromotionSnapshot, round2, type PricingLine } from "@/lib/promotions/engine"
import { redeemPromotion, PromotionRedeemError } from "@/lib/promotions/redeem"
import { redeemOrderPromotion } from "@/lib/promotions/redeem-order"

/**
 * Multi-tenant webhook signature verification (E4-3b): each salon registers
 * the SAME endpoint URL in its OWN Stripe account, so every organization has
 * its own signing secret. We try every organization's stored webhook secret —
 * there is deliberately NO platform/env secret: the platform cannot hold the
 * key. constructEvent never calls the API, so trying candidates is cheap.
 *
 * P0 SECURITY (audit 2026-11): the function returns the ORGANIZATION whose
 * secret actually verified the signature. Prej je vrnil samo dogodek in je
 * najemnika nato določil iz `session.metadata.orgId` — torej iz podatka, ki
 * ga nadzoruje POŠILJATELJ. Najemnik, ki pozna SVOJO whsec_, je lahko tako
 * podpisal poljuben payload in z metadata.orgId = žrtev posegel v tuje
 * podatke (preklic tujega naročila, potrditev tujega termina brez plačila).
 * Zdaj je podpis edini vir resnice o najemniku; metadata.orgId se uporablja
 * samo še kot TRDITEV, ki mora soglašati s podpisom (sicer 400).
 */
type VerifiedStripeEvent = {
  event: Stripe.Event
  org: { id: string; slug: string }
}

async function verifyStripeEvent(
  body: string,
  signature: string
): Promise<VerifiedStripeEvent | null> {
  const orgsWithWebhook = await prisma.organization.findMany({
    where: { stripeWebhookSecret: { not: null } },
    select: { id: true, slug: true, stripeWebhookSecret: true },
  })

  for (const org of orgsWithWebhook) {
    // P2 (audit 2026-11): webhook secret je v bazi šifriran.
    const secret = decryptSecret(org.stripeWebhookSecret)
    if (!secret) continue
    try {
      const event = constructWebhookEvent(body, signature, secret)
      // The signature belongs to THIS organization — never to metadata.
      return { event, org: { id: org.id, slug: org.slug } }
    } catch {
      continue
    }
  }
  return null
}

/**
 * P0 (S3, audit 2026-11) — AVTORITATIVNA PREVERBA PLAČILA.
 *
 * Najemnik pozna SVOJO `whsec_`, zato lahko podpiše poljuben payload za
 * lastno org (npr. `checkout.session.completed` brez dejanskega plačila).
 * Payload ni dokaz plačila — edini vir resnice je Stripe API s ključem
 * organizacije. Ta helper retrieve-a sejo in primerja `payment_status` +
 * plačani znesek s pričakovanim (naročilo/polog iz DB).
 */
async function verifyPaidSessionMatches(
  organizationId: string,
  sessionId: string,
  expectedAmount: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSecretKey: true },
  })
  const client = getStripeForOrg(org)
  if (!client) return { ok: false, reason: "no-stripe-key" }
  try {
    const s = await client.checkout.sessions.retrieve(sessionId)
    if (!s || s.payment_status !== "paid") {
      return { ok: false, reason: "session-not-paid" }
    }
    const actual = Number(s.amount_total ?? 0) / 100
    if (Math.abs(actual - expectedAmount) > 0.001) {
      return {
        ok: false,
        reason: `amount-mismatch (${actual} !== ${expectedAmount})`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: "retrieve-failed" }
  }
}

/**
 * P1 (audit 2026-11) — IDEMPOTENCA najemniškega webhooka po `event.id`.
 *
 * Platformni webhook je imel `stripeEventId @unique`, najemniški ničesar:
 * ponovljena dostava (Stripe retry, hkratna dostava) je lahko drugič
 * obdelala isto sejo. Vrstica je tudi kratek revizijski dnevnik dostav.
 *
 * @returns `true`, kadar je dogodek ŽE obdelan (ali se trenutno obdeluje)
 */
async function claimTenantEvent(
  event: Stripe.Event,
  organizationId: string
): Promise<boolean> {
  try {
    const existing = await prisma.tenantStripeEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, outcome: true },
    })
    if (existing) {
      // Prejšnji poskus je spodletel → dovolimo ponovni poskus.
      if (existing.outcome === "failed") {
        await prisma.tenantStripeEvent.update({
          where: { id: existing.id },
          data: { outcome: "received", detail: null },
        })
        return false
      }
      return true
    }
    await prisma.tenantStripeEvent.create({
      data: {
        organizationId,
        stripeEventId: event.id,
        type: event.type,
        outcome: "received",
      },
    })
    return false
  } catch (error) {
    // Sledenje ne sme nikoli ustaviti obdelave plačila — če zapis ne uspe
    // (npr. P2002 iz hkratne dostave), se zanesemo na per-objekt dedupe
    // (unique stripePaymentId, pogojni status PENDING→PAID).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return true
    }
    console.error("Webhook: idempotency claim failed", error)
    return false
  }
}

/** Označi dostavo kot obdelano (uspešen konec). */
async function markTenantEventProcessed(stripeEventId: string): Promise<void> {
  await prisma.tenantStripeEvent
    .updateMany({
      where: { stripeEventId, outcome: "received" },
      data: { outcome: "processed" },
    })
    .catch(() => undefined)
}

/** Označi dostavo kot spodletelo — omogoči ponovni poskus ob retryju. */
async function markTenantEventFailed(
  stripeEventId: string,
  detail: string
): Promise<void> {
  await prisma.tenantStripeEvent
    .updateMany({
      where: { stripeEventId },
      data: { outcome: "failed", detail: detail.slice(0, 500) },
    })
    .catch(() => undefined)
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event
  // P0 SECURITY: najemnik pride IZ PODPISA, ne iz metadata.
  let signedOrg: { id: string; slug: string }

  try {
    const verified = await verifyStripeEvent(body, signature)
    if (!verified) {
      console.error("Webhook signature verification failed")
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      )
    }
    event = verified.event
    signedOrg = verified.org
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  // Vsak objekt (checkout seja) nosi metadata.orgId, ki ga je vpisala
  // aplikacija ob ustvarjanju seje. Če se ta TRDITEV ne ujema z
  // organizacijo, katere skrivnost je podpisala dostavo, je dostava bodisi
  // napaka bodisi poskus preskoka najemnika → zavrnemo (fail-closed).
  const binding = checkTenantBinding(
    extractClaimedOrgId(event.data?.object),
    signedOrg.id
  )
  if (!binding.ok) {
    console.error(
      `Webhook: org mismatch — signature=${signedOrg.id} metadata=${binding.claimed} type=${event.type}`
    )
    return NextResponse.json(
      { error: "Webhook organization mismatch" },
      { status: 400 }
    )
  }

  // Idempotenca po event.id (P1 audit 2026-11): platformni webhook jo je
  // imel, najemniški ne. Brez nje je ponovljena dostava (Stripe retry ali
  // hkratna dostava) lahko drugič obdelala isto sejo.
  const alreadyHandled = await claimTenantEvent(event, signedOrg.id)
  if (alreadyHandled) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // F5.5.1.2 — checkout.session.expired → sprostitev inventarne rezervacije.
  // Stripe kavelj (event pošlje sam Stripe) je zanesljivejši od lokalnega
  // časovnega pollinga. Spustimo rezervacijo SAMO za order, ki je še PENDING
  // (ni bil plačan) in katerega rezervacija sploh obstaja. Če je plačilo že
  // plačano/procesirano ali API status neznan → NE sproščamo (fail-closed).
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId
    if (orderId && session.metadata?.type === "product_order") {
      try {
        await prisma.$transaction(async (tx) => {
          // P0: iskanje je ORG-SCOPED (prej `findUnique` samo po id-ju —
          // tuj najemnik je lahko preklical tuje naročilo).
          const order = await tx.order.findFirst({
            where: { id: orderId, organizationId: signedOrg.id },
            include: { items: true },
          })
          // Idempotentno + fail-closed: vzemi SAMO PENDING order in še ne
          // plačan; sprosti rezervacijo (če je bila) za vsako postavko.
          if (!order || order.status !== "PENDING" || order.paymentMethod === "offline") return
          const orgId = order.organizationId
          for (const item of order.items) {
            if (!orgId) continue
            const line = {
              productId: item.productId,
              variantId: item.variantId ?? null,
              variantName: item.variantName ?? null,
              variantSku: item.variantSku ?? null,
              quantity: item.quantity,
              price: item.price.toNumber(),
              name: "",
              image: null,
            }
            await releaseStockReservation(tx, line, orgId)
          }
          await tx.order.updateMany({
            where: { id: orderId, organizationId: signedOrg.id },
            data: { status: "CANCELLED" },
          })
          console.log(`Webhook: order ${orderId} expired — reservation released`)
        })
      } catch (error) {
        console.error("Webhook: error releasing expired reservation:", error)
      }
    }
    return NextResponse.json({ received: true })
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    // #97 (AD-07): garancija s kartico — SETUP način (payment_status je
    // "unpaid" po zasnovi; kartica se SHRANI, ne zaračuna). Zapiši
    // SetupIntent/Customer reference na termin (SAVED → CONFIRMED).
    if (
      session.mode === "setup" &&
      session.metadata?.type === GUARANTEE_METADATA_TYPE
    ) {
      const appointmentId = session.metadata.appointmentId
      if (appointmentId) {
        // P0: org-scoped — tuj najemnik ne more potrditi tujega termina.
        const updated = await prisma.appointment.updateMany({
          where: {
            id: appointmentId,
            organizationId: signedOrg.id,
            noShowSetupStatus: "PENDING",
          },
          data: {
            stripeSetupIntentId:
              typeof session.setup_intent === "string"
                ? session.setup_intent
                : null,
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : null,
            noShowSetupStatus: "SAVED",
            status: "CONFIRMED",
          },
        })
        console.log(
          `Webhook: no-show guarantee ${updated.count > 0 ? "saved" : "skipped (already handled)"} for appointment ${appointmentId}`
        )
      }
      return NextResponse.json({ received: true })
    }

    // Only process if payment was successful
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true })
    }

    const metadata = session.metadata

    if (!metadata) {
      console.error("Webhook: no metadata in checkout session", session.id)
      // Acknowledge — retrying won't fix bad metadata
      return NextResponse.json({ received: true })
    }

    // #80: DARILNI BON nakup — aktivacija PENDING nakupa (idempotentna).
    if (metadata.type === "prepaid_purchase" && metadata.purchaseId) {
      try {
        const result = await activatePrepaidPurchase(session.id)
        if (!result.ok) {
          console.error(
            `Webhook: prepaid purchase for session ${session.id} not found`
          )
        } else if (result.activated) {
          console.log(
            `Webhook: prepaid purchase ${result.purchaseId} activated (code emailed)`
          )
        }
        return NextResponse.json({ received: true })
      } catch (error) {
        console.error("Webhook: error activating prepaid purchase:", error)
        return NextResponse.json({ received: true })
      }
    }

    // PREDRAČUN → STRANKA (2026-11-18): depozit na delovnem naročilu.
    // Denar gre na najemnikov Stripe račun; tu zabeležimo PLAČILO kot
    // append-only vrstico (WorkOrderPayment) in pokrijemo depozit.
    // Idempotenca: stripeSessionId je @unique → ponovna dostava ne podvoji.
    if (metadata.type === "work_order_deposit" && metadata.workOrderId) {
      try {
        const workOrder = await prisma.workOrder.findFirst({
          where: { id: metadata.workOrderId, organizationId: signedOrg.id },
          select: { id: true, organizationId: true, depositAmount: true, title: true },
        })
        if (!workOrder) {
          console.error(
            `Webhook: work order ${metadata.workOrderId} not found for org ${signedOrg.id}`
          )
          return NextResponse.json({ received: true })
        }

        const amount = (session.amount_total ?? 0) / 100
        if (amount <= 0) return NextResponse.json({ received: true })

        const inserted = await prisma.workOrderPayment.createMany({
          data: [
            {
              organizationId: workOrder.organizationId,
              workOrderId: workOrder.id,
              amount,
              method: "stripe",
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
            },
          ],
          skipDuplicates: true,
        })

        if (inserted.count > 0) {
          await prisma.workOrderEvent.create({
            data: {
              organizationId: workOrder.organizationId,
              workOrderId: workOrder.id,
              type: "NOTE",
              message: `Depozit plačan prek spleta: ${amount.toFixed(2)} €`,
              actorEmail: null,
            },
          })

          const sum = await prisma.workOrderPayment.aggregate({
            where: { workOrderId: workOrder.id },
            _sum: { amount: true },
          })
          const paid = Number(sum._sum.amount ?? 0)
          const deposit =
            workOrder.depositAmount === null ? null : Number(workOrder.depositAmount)
          if (deposit !== null && deposit > 0 && paid >= deposit) {
            await prisma.workOrder.updateMany({
              where: { id: workOrder.id, depositPaidAt: null },
              data: { depositPaidAt: new Date() },
            })
          }
          console.log(`Webhook: work order ${workOrder.id} deposit paid (${amount} €)`)
        } else {
          console.log(`Webhook: work order deposit ${session.id} already recorded`)
        }
        return NextResponse.json({ received: true })
      } catch (error) {
        console.error("Webhook: error recording work order deposit:", error)
        return NextResponse.json({ received: true })
      }
    }

    // Handle product orders (e-commerce checkout)
    if (metadata.type === "product_order" && metadata.orderId) {
      try {
        const order = await prisma.order.findFirst({
          where: { id: metadata.orderId, organizationId: signedOrg.id },
          include: { items: true },
        })

        if (!order) {
          console.error(
            `Webhook: order ${metadata.orderId} not found (session ${session.id})`
          )
          return NextResponse.json({ received: true })
        }

        // Idempotency — skip if already processed (webhook retries, or the
        // client-side success page got there first)
        if (order.status !== "PENDING") {
          return NextResponse.json({ received: true })
        }

        // P0 (S3): payload ni dokaz plačila — preveri sejo na Stripe API-ju
        // (ključ org) in primerjaj plačani znesek z naročilom. Ob
        // neskladju 400 → Stripe ponovi dostavo; naročilo ostane PENDING.
        const paidCheck = await verifyPaidSessionMatches(
          signedOrg.id,
          session.id,
          order.total.toNumber()
        )
        if (!paidCheck.ok) {
          console.error(
            `Webhook: paid-session verification failed (order ${order.id}): ${paidCheck.reason}`
          )
          return NextResponse.json({ received: false }, { status: 400 })
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null

        await prisma.$transaction(async (tx) => {
          // Conditional update guards against racing with verifyProductOrder.
          // Backfill organizationId for legacy orders missing it.
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId,
              // P0: legacy naročilo brez organizacije se pripne PODPISANI
              // organizaciji (nikoli metadata.orgId).
              ...(order.organizationId
                ? {}
                : { organizationId: signedOrg.id }),
            },
          })

          if (updated.count === 0) return

          for (const item of order.items) {
            // F5.5.1.2 — online plačilo pretvori rezervacijo v prodajo
            // (stockQuantity −= qty, reservedQuantity −= qty, StockMovement).
            // Če rezervacije ni bilo (legacy / brez online rezerve) → fallback
            // na klasično znižanje zaloge (F5.5.1).
            const line = {
              productId: item.productId,
              variantId: item.variantId ?? null,
              variantName: item.variantName ?? null,
              variantSku: item.variantSku ?? null,
              quantity: item.quantity,
              price: item.price.toNumber(),
              name: "",
              image: null,
            }
            const paidOrgIdNow = order.organizationId ?? signedOrg.id
            const converted = await convertReservationToSale(
              tx,
              line,
              paidOrgIdNow,
              order.id
            )
            if (!converted) {
              await applyOrderStockDecrement(tx, line, paidOrgIdNow, order.id)
            }
          }

          // F5.1: promocija se unovči ob potrjenem plačilu (idempotentno),
          // ne ob kreaciji seje. Idempotence → `@@unique([promotionId, orderId])`.
          const paidOrgId = order.organizationId ?? signedOrg.id
          if (paidOrgId && order.promotionId) {
            await redeemOrderPromotion(tx, order, paidOrgId)
          }
        })

        // #80: darilni bon se unovči ŠELE ob potrjenem plačilu.
        // redeemGiftCardForOrder je idempotentna (unikatni [purchaseId,
        // orderId]) — ponovljen webhook ne odšteje dvakrat.
        if (metadata.giftCardCode) {
          await redeemGiftCardForOrder(
            order.organizationId ?? signedOrg.id,
            metadata.giftCardCode,
            order.id,
            parseFloat(metadata.giftCardRedemption || "0") ||
              order.total.toNumber()
          ).catch((e) =>
            console.error("Webhook: gift card redemption failed:", e)
          )
        }

        // NOTE: no order confirmation email template exists in the codebase yet
        console.log(`Webhook: order ${order.id} marked as PAID`)
        return NextResponse.json({ received: true })
      } catch (error) {
        console.error("Webhook: error processing product order:", error)
        await markTenantEventFailed(
          event.id,
          error instanceof Error ? error.message : "product order error"
        )
        // Acknowledge to avoid infinite retries; order can be reconciled manually
        return NextResponse.json({ received: true })
      }
    }

    try {
      // P0 (audit 2026-11): najemnik je TISTI, katerega skrivnost je
      // podpisala dostavo — nikoli metadata.orgId (to je vrednost, ki jo
      // nadzoruje pošiljatelj). Prej je bilo tu `getOrgById(metadata.orgId)`,
      // kar je najemniku omogočilo, da se predstavi kot drug salon.
      const org = await getOrgById(signedOrg.id)

      if (!org) {
        console.error("Webhook: signed organization not found", signedOrg.id)
        return NextResponse.json({ received: true })
      }

      // Handle existing appointment payment (from "Pay Now" button)
      if (metadata.type === "existing_appointment" && metadata.appointmentId) {
        // P0: termin iščemo ORG-SCOPED. Prej je bil `findUnique` po id-ju,
        // "tenant check" pa je primerjal z metadata.orgId — če je napadalec
        // v metadata zapisal ŽRTEV, je bil check zadovoljen in tuj termin je
        // postal "plačan" brez plačila.
        const existingAppointment = await prisma.appointment.findFirst({
          where: { id: metadata.appointmentId, organizationId: org.id },
          select: { id: true, depositAmount: true },
        })

        if (!existingAppointment) {
          console.error(
            `Webhook: appointment ${metadata.appointmentId} not found in org ${org.id} (session ${session.id})`
          )
          return NextResponse.json({ received: true })
        }

        // P0 (S3): preveri, da je bila seja dejansko plačana in da znesek
        // ustreza pologu termina (payload ni dokaz plačila).
        const paidCheck = await verifyPaidSessionMatches(
          org.id,
          session.id,
          existingAppointment.depositAmount.toNumber()
        )
        if (!paidCheck.ok) {
          console.error(
            `Webhook: existing-appointment paid-session verification failed (${metadata.appointmentId}): ${paidCheck.reason}`
          )
          return NextResponse.json({ received: false }, { status: 400 })
        }

        await prisma.appointment.updateMany({
          where: { id: existingAppointment.id, organizationId: org.id },
          data: {
            depositPaid: true,
            status: "CONFIRMED",
            stripePaymentId: session.payment_intent as string,
          },
        })
        console.log(`Webhook: existing appointment paid ${metadata.appointmentId}`)
        return NextResponse.json({ received: true })
      }

      // Parse metadata for new appointment
      const serviceIds = JSON.parse(metadata.serviceIds || "[]")
      const staffId = metadata.staffId
      const startTime = new Date(metadata.startTime)
      const guestName = metadata.guestName || null
      const guestEmail = metadata.guestEmail || null
      const guestPhone = metadata.guestPhone || null
      const notes = metadata.notes || null
      const userId = metadata.userId || null
      const customerName = metadata.customerName || "Customer"

      if (!staffId || !metadata.startTime || serviceIds.length === 0) {
        console.error("Webhook: incomplete appointment metadata", session.id)
        return NextResponse.json({ received: true })
      }

      const paymentIntentId = session.payment_intent as string

      // IDEMPOTENCY — the webhook can be retried by Stripe, and the
      // /booking/success fallback may have created the appointment already.
      const existing = await prisma.appointment.findFirst({
        where: { stripePaymentId: paymentIntentId },
        select: { id: true },
      })

      if (existing) {
        console.log(`Webhook: appointment already exists for payment ${paymentIntentId}`)
        return NextResponse.json({ received: true })
      }

      // Get services for duration calculation (scoped to this organization)
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, organizationId: org.id },
        select: { id: true, name: true, duration: true, price: true, categoryId: true, intakeFormDefinitionId: true },
      })

      if (services.length !== new Set(serviceIds).size) {
        console.error(
          `Webhook: services not found in org ${org.id} (session ${session.id})`
        )
        return NextResponse.json({ received: true })
      }

      const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
      const totalPrice = services.reduce(
        (sum, s) => sum + s.price.toNumber(),
        0
      )

      // #92: dodatki potujejo kot ID-ji prek metadata — ponovno se
      // razrešijo org-scoped iz DB (cene iz metadata se NE zaupajo) in
      // prištejeta ceni/trajanju termina; snapshot gre na zapis.
      let selectedAddons: { name: string; price: number; durationMin: number }[] = []
      if (metadata.addonIds) {
        try {
          const addonIds: string[] = JSON.parse(metadata.addonIds || "[]")
          if (Array.isArray(addonIds) && addonIds.length > 0) {
            const addonRows = await prisma.serviceAddon.findMany({
              where: {
                id: { in: addonIds },
                isActive: true,
                serviceId: { in: serviceIds },
                service: { organizationId: org.id },
              },
            })
            const byId = new Map(addonRows.map((a) => [a.id, a]))
            selectedAddons = addonIds
              .filter((id) => byId.has(id))
              .map((id) => {
                const a = byId.get(id)!
                return { name: a.name, price: a.price.toNumber(), durationMin: a.durationMin }
              })
          }
        } catch {
          // Pokvarjen metadata → brez dodatkov; plačilo storitve ostane
          // veljavno (ne obrnemo plačila zaradi dodatka).
        }
      }
      const addonPrice = selectedAddons.reduce((s, a) => s + a.price, 0)
      const addonDuration = selectedAddons.reduce((s, a) => s + a.durationMin, 0)

      const endTime = addMinutes(startTime, totalDuration + addonDuration)

      // F5.1: promocija iz metadate — popust na storitve (+ globalni za
      // WHOLE_AMOUNT vključi dodatke). Cena iz klienta se NE zaupa.
      const promoCodeRaw = metadata.promotionCode as string | undefined
      const promoTargets: PricingLine[] = services.map((s) => ({
        kind: "service",
        serviceId: s.id,
        categoryId: s.categoryId ?? undefined,
        amount: s.price.toNumber(),
        quantity: 1,
      }))
      if (addonPrice > 0) {
        promoTargets.push({ kind: "service", amount: addonPrice, quantity: 1 })
      }
      const whPromotions = await loadActivePromotions(prisma, org.id)
      const whPromo = bestPromotion(whPromotions, promoTargets, {
        code: promoCodeRaw || null,
      })
      const whDiscount = whPromo ? whPromo.discountAmount : 0
      const whSnapshot = whPromo
        ? buildPromotionSnapshot(whPromo.rule, {
            baseAmount: whPromo.baseAmount,
            discountAmount: whPromo.discountAmount,
            affectedLines: whPromo.affectedLines,
          })
        : null
      const effectiveTotal = Math.max(0, round2(totalPrice + addonPrice - whDiscount))

      // DOUBLE-BOOKING GUARD — re-check that the slot is still free before
      // confirming. Payment received for a taken slot is logged for manual refund.
      const overlapping = await prisma.appointment.count({
        where: {
          staffId,
          organizationId: org.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })

      if (overlapping > 0) {
        console.error(
          `Webhook: PAID booking for an occupied slot! staff=${staffId} start=${startTime.toISOString()} payment=${paymentIntentId} — manual refund required`
        )
        return NextResponse.json({ received: true })
      }

      // Get salon config for this organization
      const config = await prisma.salonConfig.findFirst({
        where: { organizationId: org.id },
      })
      // #79: polog potuje s sejo (metadata.depositAmount, izračunan v
      // createCheckoutSession iz per-storitvenih pravil). Fallback pokrije
      // stare seje pred #79.
      const metaDeposit =
        typeof metadata.depositAmount === "string" && metadata.depositAmount
          ? parseFloat(metadata.depositAmount)
          : null
      const depositAmount =
        metaDeposit !== null && Number.isFinite(metaDeposit) && metaDeposit >= 0
          ? metaDeposit
          : (config?.bookingDeposit.toNumber() || 50)

      // Handle customer creation/retrieval
      let customerId: string | null = null

      if (userId) {
        // Check if user has a customer profile
        const userWithCustomer = await prisma.user.findUnique({
          where: { id: userId },
          include: { customer: true },
        })

        if (userWithCustomer?.customer) {
          customerId = userWithCustomer.customer.id
        } else if (userWithCustomer) {
          // Create customer profile
          const customer = await prisma.customer.create({
            data: {
              name: customerName,
              email: userWithCustomer.email,
              phone: guestPhone,
              userId: userId,
              organizationId: org.id,
            },
          })
          customerId = customer.id
        }
      }

      // Get staff info (must belong to this organization)
      const staff = await prisma.staff.findFirst({
        where: { id: staffId, organizationId: org.id },
        select: { name: true },
      })

      if (!staff) {
        console.error(
          `Webhook: staff ${staffId} not found in org ${org.id} (session ${session.id})`
        )
        return NextResponse.json({ received: true })
      }

      // E2-7 (G7): optional workspace resource from checkout metadata —
      // validated org-scoped; the conflict was checked at checkout time and
      // is re-checked here (webhook may arrive after other bookings).
      let resourceRecordId: string | null = null
      const rawResourceId = metadata.resourceRecordId || ""
      if (rawResourceId) {
        const resourceRecord = await prisma.extensionRecord.findFirst({
          where: {
            id: rawResourceId,
            organizationId: org.id,
            extensionId: "workspace-resources",
            entityKey: "workspace",
          },
          select: { id: true },
        })
        if (resourceRecord) {
          const resourceBusy = await prisma.appointment.findMany({
            where: {
              resourceRecordId: resourceRecord.id,
              organizationId: org.id,
              startTime: { lt: endTime },
              endTime: { gt: startTime },
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { startTime: true, endTime: true },
          })
          const conflict = resourceBusy.some(
            (w) => startTime < new Date(w.endTime) && endTime > new Date(w.startTime)
          )
          // On conflict the paid booking still gets created — WITHOUT the
          // resource (never lose the payment record; the salon sees the
          // missing resource in the dashboard and resolves it).
          if (!conflict) resourceRecordId = resourceRecord.id
        }
      }

      // Create the appointment — #93: pod advisory ključavnico + v
      // transakciji z AVTORITATIVNIM staff-overlap checkom (zgornji
      // hitri check je samo hitra pot; dirka z drugo instanco rešuje
      // ključavnica). Duplikat plačila zadrži unique constraint na
      // stripePaymentId (P2002 = termin že obstaja → samo logiraj).
      const appointment = await prisma
        .$transaction(async (tx) => {
          await acquireBookingLocks(tx, bookingLockKeys(org.id, staffId, resourceRecordId))

          const overlapping = await tx.appointment.count({
            where: {
              staffId,
              organizationId: org.id,
              status: { in: ["PENDING", "CONFIRMED"] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          })
          if (overlapping > 0) {
            throw new Error(
              `Webhook: PAID booking for an occupied slot! staff=${staffId} start=${startTime.toISOString()} payment=${paymentIntentId} — manual refund required`
            )
          }

          const appt = await tx.appointment.create({
            data: {
              organizationId: org.id,
              staffId,
              customerId,
              resourceRecordId,
              // #96 v2: žeton za obrazec po povezavi (isti princip kot
              // neposredna rezervacija) — samo ko storitev ima obrazec.
              intakeToken: pickIntakeService(services)?.intakeFormDefinitionId
                ? generateIntakeToken()
                : null,
              guestName: !customerId ? guestName : null,
              guestEmail: !customerId ? guestEmail : null,
              guestPhone: !customerId ? guestPhone : null,
              startTime,
              endTime,
              status: "CONFIRMED", // Confirmed because payment was successful
              notes,
              // F5.1: total že upošteva popust (immutabilni posnetek).
              totalPrice: effectiveTotal,
              ...(whDiscount > 0 && whPromo
                ? {
                    promotionDiscount: whDiscount,
                    promotionId: whPromo.rule.id,
                    promotionSnapshot: whSnapshot as unknown as Prisma.InputJsonValue,
                  }
                : {}),
              depositAmount,
              depositPaid: true, // Payment was successful
              stripePaymentId: paymentIntentId,
              addons: selectedAddons.length > 0 ? selectedAddons : undefined,
              services: {
                create: serviceIds.map((serviceId: string) => ({
                  serviceId,
                })),
              },
            },
            include: {
              services: {
                include: { service: true },
              },
            },
          })

          // F5.1: atomsko unovčenje promocije v isti transakciji. Če
          // popust v oknu ni več unovčljiv (npr. presežena omejitev),
          // PLAČILO in termin OSTANDATA nedotaknjena — popust se tiho
          // odpravi (nikoli ne izgubimo plačane rezervacije zaradi
          // promocijskega pravila).
          if (whPromo) {
            try {
              await redeemPromotion(tx, {
                promotion: whPromo.rule,
                baseAmount: whPromo.baseAmount,
                customerId,
                guestEmail: !customerId ? guestEmail : null,
                appointmentId: appt.id,
                codeUsed: whPromo.rule.code,
              })
            } catch (err) {
              if (!(err instanceof PromotionRedeemError)) throw err
              await tx.appointment.update({
                where: { id: appt.id },
                data: {
                  promotionDiscount: 0,
                  promotionId: null,
                  promotionSnapshot: Prisma.DbNull,
                  totalPrice: round2(totalPrice + addonPrice),
                },
              })
            }
          }
          return appt
        })
        .catch((error) => {
          // #93: P2002 na stripePaymentId = verify path je že ustvaril
          // termin za to plačilo (ali ponovljen webhook) — idempotentno
          // uspeh, NE napaka (sicer bi Stripe večno ponavljal).
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            console.log(
              `Webhook: appointment for payment ${paymentIntentId} already exists (unique stripePaymentId) — idempotent skip`
            )
            return null
          }
          throw error
        })

      if (!appointment) {
        return NextResponse.json({ received: true })
      }

      // #96: FormSubmission iz checkout seje poveži z ustvarjenim terminom.
      await prisma.formSubmission
        .updateMany({
          where: {
            organizationId: org.id,
            contextType: "checkout-session",
            contextId: session.id,
          },
          data: { contextType: "appointment", contextId: appointment.id, customerId },
        })
        .catch(() => undefined)

      // Send confirmation email (non-blocking, never fails the webhook)
      const customerEmail = guestEmail || session.customer_email
      if (customerEmail) {
        const serviceNames = services.map((s) => s.name).join(", ")

        // Salon timezone for a correct local display time in the email
        const salonConfigTz = await prisma.salonConfig.findFirst({
          where: { organizationId: org.id },
          select: { timezone: true },
        })
        const salonTz = safeTimezone(salonConfigTz?.timezone)

        after(async () => {
          try {
            const result = await sendAppointmentConfirmationEmail({
              email: customerEmail,
              customerName,
              serviceName: serviceNames,
              staffName: staff?.name || "Our Staff",
              appointmentDate: startTime,
              appointmentTime: formatSalonTime(startTime, salonTz),
              duration: totalDuration,
              totalPrice,
              depositAmount,
              appointmentId: appointment.id,
            })
            // P1 #76 — evidence: confirmationSentAt PO uspešnem pošiljanju.
            if (result?.success !== false) {
              await prisma.appointment
                .update({
                  where: { id: appointment.id },
                  data: { confirmationSentAt: new Date() },
                })
                .catch(() => undefined)
            }
          } catch (emailError) {
            console.error("Webhook: confirmation email failed:", emailError)
          }
        })
      }

      console.log(`Webhook: appointment created ${appointment.id}`)

      // #110: outgoing webhook — obvestilo tretjim sistemom (best-effort).
      after(async () => {
        try {
          await dispatchOutgoingEvent(org.id, "appointment.created", {
            appointmentId: appointment.id,
            organizationId: org.id,
            status: appointment.status,
            startTime: appointment.startTime.toISOString(),
            endTime: appointment.endTime.toISOString(),
            customerEmail: customerEmail ?? null,
            customerName,
            serviceNames: services.map((s) => s.name),
            totalPrice,
          })
        } catch (err) {
          console.error("Webhook: outgoing appointment.created dispatch failed:", err)
        }
      })
    } catch (error) {
      console.error("Webhook: error processing checkout session:", error)
      // Dostava ni uspela → dogodek označimo kot spodletelo, da bo ponovni
      // poskus (Stripe retry) lahko stekel (claim ga sicer šteje za rešenega).
      await markTenantEventFailed(
        event.id,
        error instanceof Error ? error.message : "checkout session error"
      )
      // Acknowledge — payment intent id dedupe makes a manual replay safe
      return NextResponse.json({ received: true })
    }
  }

  await markTenantEventProcessed(event.id)
  return NextResponse.json({ received: true })
}
