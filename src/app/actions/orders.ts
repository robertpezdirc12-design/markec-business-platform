"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { OrderStatus, type Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { getTrustedOrgSlug } from "@/lib/tenant"

// Admin: Get all orders with customer and items
export async function getAdminOrders(search?: string) {
  const { org } = await requirePermissionOrg("orders.manage")

  const orders = await prisma.order.findMany({
    where: {
      organizationId: org.id,
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { email: { contains: search, mode: "insensitive" } } },
              { guestName: { contains: search, mode: "insensitive" } },
              { guestEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return orders.map((order) => ({
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    // 2D-1P §5 — Decimal, ki preostaneta v `...order` (tipAmount /
    // promotionDiscount) pretvorimo v plain number, da z njimi ni Decimal
    // warninga pri prenosu v Client Components (ExportOrdersButton itd.).
    tipAmount: order.tipAmount.toNumber(),
    promotionDiscount: order.promotionDiscount.toNumber(),
  }))
}

// Admin: Get order statistics
export async function getOrderStats() {
  const { org } = await requirePermissionOrg("orders.manage")

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalOrders, pending, completedToday, revenueThisMonth] =
    await Promise.all([
      prisma.order.count({ where: { organizationId: org.id } }),
      prisma.order.count({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "PAID"] },
        },
      }),
      prisma.order.count({
        where: {
          organizationId: org.id,
          status: "COMPLETED",
          updatedAt: { gte: startOfDay },
        },
      }),
      prisma.order.aggregate({
        where: {
          organizationId: org.id,
          status: { in: ["PAID", "COMPLETED"] },
          createdAt: { gte: startOfMonth },
        },
        _sum: {
          total: true,
        },
      }),
    ])

  return {
    totalOrders,
    pending,
    completedToday,
    revenueThisMonth: revenueThisMonth._sum.total?.toNumber() || 0,
  }
}

// Admin: Get order by ID with full details
export async function getOrderById(id: string) {
  const { org } = await requirePermissionOrg("orders.manage")

  const order = await prisma.order.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    // 2D-1P §5 — preostala Decimal polja (tipAmount / promotionDiscount)
    // v plain number; DM ne spreminjamo poslovne logike naročil.
    tipAmount: order.tipAmount.toNumber(),
    promotionDiscount: order.promotionDiscount.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
      variantPrice: item.variantPrice ? item.variantPrice.toNumber() : null,
    })),
  }
}

// Update order status
export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { org } = await requirePermissionOrg("orders.manage")

  try {
    // Verify ownership before mutating
    const existing = await prisma.order.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Order not found" }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    })

    revalidatePath("/dashboard/orders")

    return { success: true, order }
  } catch (error) {
    console.error("Error updating order status:", error)
    return { success: false, error: "Failed to update order status." }
  }
}

// Customer: Get order by ID (only their own orders)
export async function getOrderByIdForCustomer(id: string) {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      customer: { userId: session.user.id },
    },
    include: {
      customer: true,
      organization: { select: { name: true, slug: true } },
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    // 2D-1P §5 — preostala Decimal polja (tipAmount / promotionDiscount)
    // v plain number; DM ne spreminjamo poslovne logike naročil.
    tipAmount: order.tipAmount.toNumber(),
    promotionDiscount: order.promotionDiscount.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
      variantPrice: item.variantPrice ? item.variantPrice.toNumber() : null,
    })),
  }
}

// Customer: Get all orders for the current user
export async function getCustomerOrders() {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "You must be logged in to view orders",
    }
  }

  // TENANT ISOLATION (EPIC #4 visual pass): under a tenant site
  // (/s/[slug]/my-orders — proxy sets x-org-slug) scope to THAT tenant;
  // another tenant's orders must never render under this brand. Unknown
  // slug -> empty list, never the global one. On the platform root the
  // user sees their own global order history (own data, own consent).
  let organizationId: string | null = null
  const slug = await getTrustedOrgSlug()
  if (slug) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!org) return { success: true, orders: [] }
    organizationId = org.id
  }

  const orders = await prisma.order.findMany({
    where: {
      customer: { userId: session.user.id },
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const convertedOrders = orders.map((order) => ({
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    // 2D-1P §5 — preostala Decimal polja (tipAmount / promotionDiscount)
    // v plain number; DM ne spreminjamo poslovne logike naročil.
    tipAmount: order.tipAmount.toNumber(),
    promotionDiscount: order.promotionDiscount.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
      variantPrice: item.variantPrice ? item.variantPrice.toNumber() : null,
    })),
  }))

  return {
    success: true,
    orders: convertedOrders,
  }
}

// ============================================================
// #79: NAPITNINA na naročilu — zabeleži napitnino (gotovina ali
// kartica) pri oddaji/prevzemu. Ločena vrstica prihodka, ne del
// postavk.
// ============================================================
export async function recordOrderTip(
  id: string,
  input: { amount: number; method?: "cash" | "card" | null }
): Promise<{ success: boolean; error?: string }> {
  const { org } = await requirePermissionOrg("orders.manage")

  const amount = input.amount
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000) {
    return { success: false, error: "Neveljaven znesek napitnine" }
  }

  try {
    const existing = await prisma.order.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Order not found" }
    }

    await prisma.order.update({
      where: { id },
      data: {
        tipAmount: amount.toFixed(2),
        tipMethod: input.method ?? null,
      },
    })

    revalidatePath("/dashboard/orders")
    return { success: true }
  } catch (error) {
    console.error("Error recording order tip:", error)
    return { success: false, error: "Failed to record tip." }
  }
}

// ============================================================
// P3-H — VRAČILO NAROČILA (refund)
//
// Prodajalec vrne kupcu znesek naročila. Akcija je strogo org-scoped
// (requirePermissionOrg) in ATOMSKO:
//   1. vrne zalogo vsake postavke nazaj (StockMovement IN, source RETURN,
//      orderId) — za različice na vrstici različice, za osnovne na izdelku;
//   2. prestavi Order v status REFUNDED.
//
// To je poslovno-priznano vračilo (owner vodi denarni refund zunaj sistema,
// npr. offline cashback ali Stripe Dashboard). Ne kličemo Stripe API-ja, ker
// testna/dev okolja nimajo živih ključev; ko bo Stripe konfiguriran, se tukaj
// lahko doda tvorba Refund objekta pred statusom — zaloga in status ostaneta
// enaka. Naročilo se sme refundirati samo iz PAID ali COMPLETED (že refundirano
// ali preklicano → napaka). Prazno naročilo brez postavk se samo prestavi.
// ============================================================
export async function refundOrder(orderId: string): Promise<{
  success: boolean
  error?: string
  refundedAmount?: number
}> {
  try {
    const { org } = await requirePermissionOrg("orders.manage")
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: org.id },
      include: { items: true },
    })
    if (!order) return { success: false, error: "Order not found" }
    if (order.status === "REFUNDED")
      return { success: false, error: "Naročilo je že refundirano." }
    if (order.status === "CANCELLED")
      return { success: false, error: "Preklicanega naročila ni mogoče refundirati." }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of order.items) {
        if (item.productId && !item.variantId) {
          const res = await tx.$executeRawUnsafe(
            `UPDATE "Product" SET "stockQuantity" = "stockQuantity" + $2::int WHERE "id" = $1::text`,
            item.productId,
            item.quantity
          )
          if (res !== 1) throw new Error("STOCK_PRODUCT_MISSING")
        } else if (item.productId && item.variantId) {
          const res = await tx.$executeRawUnsafe(
            `UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + $2::int WHERE "id" = $1::text`,
            item.variantId,
            item.quantity
          )
          if (res !== 1) throw new Error("STOCK_VARIANT_MISSING")
        } else {
          continue
        }
        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: item.productId,
            productVariantId: item.variantId ?? null,
            direction: "IN",
            quantity: item.quantity,
            source: "RETURN",
            orderId,
            note: `Vračilo naročila ${orderId}`,
          },
        })
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED },
      })
    })

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}`)
    return { success: true, refundedAmount: Number(order.total) }
  } catch (error) {
    console.error("Error refunding order:", error)
    return { success: false, error: "Vračilo naročila ni uspelo." }
  }
}

// ============================================================
// #108 — 1-KLIK PONOVI NAROČILO
// Stranka iz "Moja naročila" ponovi prejšnje naročilo z enim klikom.
// Server preračuna cene iz baze (nikoli ne zaupa arhivskim cenam),
// preveri zalogo in aktivnost izdelkov, nato ustvari Stripe Checkout
// sejo z ISTIMI izdelki. Manjkajoči izdelki se preskočijo z opozorilom.
// ============================================================

export interface ReorderResult {
  success: boolean
  checkoutUrl?: string
  /** Izdelki, ki niso več na voljo (preskočeni). */
  skipped?: string[]
  error?: string
}

export async function reorderFromOrder(orderId: string): Promise<ReorderResult> {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "Za ponovni nakup se prijavite." }
  }

  // Lastno naročilo — ali obstaja in pripada tej stranki.
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customer: { userId: session.user.id },
      // Ponovni nakup je smiseln samo iz zaključenih/plačanih naročil.
      status: { in: ["PAID", "COMPLETED"] },
    },
    include: {
      items: {
        select: {
          productId: true,
          variantId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              isActive: true,
              forSale: true,
              stockQuantity: true,
              trackInventory: true,
            },
          },
        },
      },
    },
  })
  if (!order) {
    return { success: false, error: "Naročila ni bilo mogoče najti ali ni ponovljivo." }
  }

  // Zgradimo CartItem[] iz arhiva — a CENE in ZALOGA pridejo iz baze
  // (createProductCheckoutSession jih tako ali tako preracuna).
  const skipped: string[] = []
  const items = order.items
    .filter((item) => {
      if (!item.product.isActive || !item.product.forSale) {
        skipped.push(item.product.name)
        return false
      }
      if (item.product.trackInventory && item.product.stockQuantity < item.quantity) {
        skipped.push(`${item.product.name} (ni zadostne zaloge)`)
        return false
      }
      return true
    })
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity,
      // CartItem zahteva te polje — checkout jih preracuna iz baze,
      // tu so le za tipovo skladnost (UI jih ne prikazuje).
      name: item.product.name,
      image: null,
      price: 0,
    }))

  if (items.length === 0) {
    return {
      success: false,
      error: "Noben izdelek iz tega naročila ni več na voljo.",
      skipped,
    }
  }

  // Prevzamemo obstoječo checkout pot (isti org, isti Stripe ključ).
  const { createProductCheckoutSession } = await import("./product-checkout")
  const result = await createProductCheckoutSession(items)

  if (!result.success) {
    return { success: false, error: result.error, skipped }
  }

  return {
    success: true,
    checkoutUrl: result.checkoutUrl,
    skipped: skipped.length > 0 ? skipped : undefined,
  }
}
