import { prisma } from "../src/lib/prisma"
async function main() {
  try {
    await prisma.product.deleteMany({ where: { id: "rf1" } })
    await prisma.product.create({
      data: { id: "rf1", name: "R1", price: 5, organizationId: "f551-org-a", forSale: true, trackInventory: true, stockQuantity: 1 },
    })
    const after = await prisma.product.findUnique({ where: { id: "rf1" } })
    console.log("stockAfterCreate", after?.stockQuantity)
    const [r1, r2] = await Promise.allSettled([
      prisma.$transaction((t) =>
        t.product.updateMany({ where: { id: "rf1", stockQuantity: { gte: 1 } }, data: { stockQuantity: { decrement: 1 } } })
      ),
      prisma.$transaction((t) =>
        t.product.updateMany({ where: { id: "rf1", stockQuantity: { gte: 1 } }, data: { stockQuantity: { decrement: 1 } } })
      ),
    ])
    console.log("r1", r1.status, r1.status === "rejected" ? String(r1.reason) : r1.value.count)
    console.log("r2", r2.status, r2.status === "rejected" ? String(r2.reason) : r2.value.count)
    const fin = await prisma.product.findUnique({ where: { id: "rf1" } })
    console.log("finalStock", fin?.stockQuantity)
  } catch (e) {
    console.log("ERR", (e as Error).message)
  } finally {
    await prisma.$disconnect()
  }
}
void main()