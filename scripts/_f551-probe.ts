import { prisma } from "../src/lib/prisma"
async function main() {
  const o = await prisma.order.create({
    data: {
      subtotal: 0,
      tax: 0,
      total: 0,
      status: "PENDING",
      organizationId: "f551-org-a",
      items: {
        create: [
          { productId: "f551-product-var", variantId: "f551-var-l", quantity: 1, price: 20 },
          { productId: "f551-product-var", variantId: "f551-var-xl", quantity: 1, price: 25 },
        ],
      },
    },
  })
  const rows = await prisma.orderItem.findMany({ where: { orderId: o.id } })
  console.log("ROWS", rows.length)
  rows.forEach((r) => console.log(r.variantId, r.price.toNumber()))
  await prisma.order.delete({ where: { id: o.id } })
  await prisma.$disconnect()
}
void main()