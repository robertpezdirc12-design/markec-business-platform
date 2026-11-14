// F5.5.1.1 — predhodni OrderItem na markec_f5511_mig preko Prisma model-API-jem
// (pozna NOT NULL/defaults). Nato: (a) drop variant columns + čist _prisma_migrations
// (b) migration.sql (c) check (ohranitev vrstice).
import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()
  const exists = await p.orderItem.findUnique({ where: { id: "mig-check-item" } })
  if (!exists) {
    // Order + OrderItem + Product preko model API-ja (values defaults).
    const order = await p.order.create({
      data: { id: "mig-check-order", subtotal: 20, tax: 0, total: 20, status: "PAID", paymentMethod: "offline", promotionDiscount: 0 },
    })
    const product = await p.product.create({
      data: { id: "mig-check-product", name: "Mig", price: 10, images: [], forSale: true, trackInventory: true, stockQuantity: 3 },
    })
    await p.orderItem.create({
      data: { id: "mig-check-item", orderId: order.id, productId: product.id, quantity: 2, price: 10 },
    })
    console.log("OK OrderItem mig-check-item seeded (stanje PRED migracijo)")
  } else {
    console.log("SKIP OrderItem že obstaja")
  }
  await p.$disconnect()
}
void main()