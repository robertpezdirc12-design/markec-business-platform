"use server"

import { prisma } from "@/lib/prisma"
import { getPublicOrg } from "@/lib/tenant"
import { computeAvailableStock } from "@/lib/inventory/stock"
import { CartItem } from "@/store/cart-store";

export async function validateCartStock(items: CartItem[]) {
  const errors: {
    productId: string
    name: string
    available: number
    requested: number
  }[] = []

  // SECURITY (E4-6b): the tenant is ALWAYS resolved from the request
  // (proxy header / custom domain / session). A client-supplied orgId
  // would allow cross-tenant product probing, so the parameter was removed.
  const org = await getPublicOrg()

  if (!org) {
    // No organization -> no products can be validated
    return {
      valid: false,
      errors: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        available: 0,
        requested: item.quantity,
      })),
    }
  }

  // Fetch all products in parallel (not sequentially), scoped to the organization
  const products = await Promise.all(
    items.map((item) =>
      prisma.product.findFirst({
        where: { id: item.productId, organizationId: org.id },
      })
    )
  )

  // F5.5.1 — variant-aware: postavka z variantId preverja zalogo RAZLIČICE
  // (org-scoped + pripadnost izdelku + aktivnost), drugače zalogo izdelka.
  const variants = await Promise.all(
    items.map((item) =>
      item.variantId
        ? prisma.productVariant.findFirst({
            where: {
              id: item.variantId!,
              organizationId: org.id,
              productId: item.productId,
              isActive: true,
            },
          })
        : Promise.resolve(null)
    )
  )

  // Validate each product / variant
  items.forEach((item, index) => {
    const product = products[index]
    const variant = variants[index]
    // Splošna veljavnost postavke: product mora obstajati; če je stated
    // variantId, mora obstajati in pripadati productId.
    const stock = variant ?? product
    const validItem = product && (item.variantId ? !!variant : true)
    // F5.5.1.2 — RAZPOLOŽLJIVO = stockQuantity − reservedQuantity (online
    // rezervacije ne štejejo med razpoložljive). Izdelek BREZ sledenja
    // zalogi (#78) je prodajljiv vedno — količina ni omejena.
    const available = stock
      ? computeAvailableStock(stock.stockQuantity, stock.reservedQuantity ?? 0, stock.trackInventory)
      : 0
    if (!validItem || !stock || available < item.quantity) {
      errors.push({
        productId: item.productId,
        name: item.name,
        available,
        requested: item.quantity,
      })
    }
  })

  return { valid: errors.length === 0, errors }
}
