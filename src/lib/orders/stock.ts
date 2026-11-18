// Zaloga in rezervacije za spletna naročila — čista strežniška logika.
//
// P1 (audit 2026-11): te funkcije so bile izvožene iz modula z `"use server"`
// (`src/app/actions/product-checkout.ts`). V Next.js je vsak `export` iz
// takega modula javna RPC končna točka — tudi `reserveStock`, ki ne preverja
// seje, ker je mišljena kot del transakcije v webhooku. Odjemalec sicer ne
// more sestaviti `Prisma.TransactionClient`, a pravilo je jasno: v
// `"use server"` modulu sme biti izvoženo samo tisto, kar je res namenjeno
// odjemalcu. Zato so te funkcije (in `PricedLine`) prestavljene sem.
import type { Prisma } from "@prisma/client"

export interface PricedLine {
  productId: string
  variantId: string | null
  variantName: string | null
  variantSku: string | null
  quantity: number
  price: number
  name: string
  image: string | null
}


/**
 * F5.5.1 — variant-aware, ATOMSKO pogojno zmanjšanje zaloge za plačano naročilo.
 * Za postavko z variantId zniža zalogo RAZLIČICE in zapiše StockMovement z
 * variantId; za postavko brez različice osnovnega izdelka.
 *
 * F5.5.1.1 — VARNOST: zaloga se zmanjša SAMO, če je na voljo dovolj kosov
 * (`updateMany` s pogojem `stockQuantity >= quantity`). Dve sočasni seji ne
 * moreta obe prodati zadnjega kosa: druga dobi `count === 0` → vržemo napako,
 * transakcija se prekliče (rolling back order status), zaloga ne gre v negativ,
 * StockMovement se NE zapiše. Ne zanašamo se na pre-check `validateCartStock`.
 */
export async function applyOrderStockDecrement(
  tx: Prisma.TransactionClient,
  item: PricedLine,
  orgId: string,
  orderId: string
): Promise<void> {
  // Brez sledenja zalogi (#78) ni kaj odštevati niti knjižiti — prodaja
  // ostane zabeležena v Order/OrderItem, gibanja zaloge ni.
  const policy = await rowStockPolicy(
    tx,
    item.variantId ? "ProductVariant" : "Product",
    item.variantId ?? item.productId
  )
  if (policy.exists && !policy.tracked) return
  if (item.variantId) {
    // P1-D-1A — direktna prodaja sme odšteti le RAZPOLOŽLJIVO zalogo
    // (stockQuantity − reservedQuantity), ne posegati v že rezervirano.
    const res = await tx.$executeRawUnsafe(
      `UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - $2::int
       WHERE "id" = $1::text AND "stockQuantity" - "reservedQuantity" >= $2::int`,
      item.variantId,
      item.quantity
    )
    if (res !== 1) {
      throw new Error("STOCK_CONFLICT_VARIANT")
    }
    await tx.stockMovement.create({
      data: {
        organizationId: orgId,
        productId: item.productId,
        productVariantId: item.variantId,
        direction: "OUT",
        quantity: item.quantity,
        source: "ORDER",
        orderId,
      },
    })
  } else {
    const res = await tx.$executeRawUnsafe(
      `UPDATE "Product" SET "stockQuantity" = "stockQuantity" - $2::int
       WHERE "id" = $1::text AND "stockQuantity" - "reservedQuantity" >= $2::int`,
      item.productId,
      item.quantity
    )
    if (res !== 1) {
      throw new Error("STOCK_CONFLICT_PRODUCT")
    }
    await tx.stockMovement.create({
      data: {
        organizationId: orgId,
        productId: item.productId,
        direction: "OUT",
        quantity: item.quantity,
        source: "ORDER",
        orderId,
      },
    })
  }
}

// ============================================================
// F5.5.1.2 — ONLINE INVENTORY RESERVATION.
// Ločimo RAZPOLOŽLJIVO (stockQuantity − reservedQuantity), REZERVIRANO
// (reservedQuantity) in PRODANO (stockQuantity se zniža ob plačilu).
// Vsi trije so atomarni `UPDATE ... WHERE` (row-lock + pogoj), da dva
// checkouta ne moreta rezervirati/prodati/iste kose.
// ============================================================

/** SQL pogoj: razpoložljivo >= qty. */
const AVAIL = `"stockQuantity" - "reservedQuantity" >= $2::int`

/**
 * Politika zaloge vrstice: ali vrstica obstaja in ali se zaloga sploh šteje
 * (#78 trackInventory: false → brez sledenja, brez knjiženja zaloge).
 */
async function rowStockPolicy(
  tx: Prisma.TransactionClient,
  table: "Product" | "ProductVariant",
  id: string
): Promise<{ exists: boolean; tracked: boolean }> {
  const r = await tx.$queryRawUnsafe<{ track: boolean }[]>(
    `SELECT "trackInventory" AS track FROM "${table}" WHERE "id" = $1 LIMIT 1`,
    id
  )
  return r.length === 1
    ? { exists: true, tracked: r[0].track }
    : { exists: false, tracked: true }
}

/**
 * Atomična rezervacija ob začetku spletnega checkouta (online Stripe).
 * Zmanjša le REZERVIRANO — dejanska zaloga se NE zmanjša (nikoli dvakrat):
 * available ostane nespremenjen, prodano šteje šele ob plačilu.
 * Vrne false, če ni dovolj razpoložljivega (count=0) → klicatelj zbFig rollback.
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  item: PricedLine,
  orgId: string
): Promise<boolean> {
  const table = item.variantId ? "ProductVariant" : "Product"
  const id = item.variantId ?? item.productId
  const policy = await rowStockPolicy(tx, table, id)
  if (!policy.exists) return false
  // Brez sledenja zalogi ni kaj rezervirati — uspeh brez spremembe.
  if (!policy.tracked) return true
  const r = await tx.$executeRawUnsafe(
    `UPDATE "${table}" SET "reservedQuantity" = "reservedQuantity" + $2::int
     WHERE "id" = $1::text AND "organizationId" = $3::text AND ${AVAIL}`,
    id,
    item.quantity,
    orgId
  )
  return r === 1
}

/**
 * Sprostitev rezervacije (unpaid / expired / cancelled / opuščeno).
 * Atomično zniža le reservedQuantity (condition: reservedQuantity >= qty).
 */
export async function releaseStockReservation(
  tx: Prisma.TransactionClient,
  item: PricedLine,
  orgId: string
): Promise<boolean> {
  const table = item.variantId ? "ProductVariant" : "Product"
  const id = item.variantId ?? item.productId
  // Brez sledenja zalogi ni bilo rezervacije — uspeh brez spremembe.
  const policy = await rowStockPolicy(tx, table, id)
  if (!policy.exists) return false
  if (!policy.tracked) return true
  const r = await tx.$executeRawUnsafe(
    `UPDATE "${table}" SET "reservedQuantity" = "reservedQuantity" - $2::int
     WHERE "id" = $1::text AND "organizationId" = $3::text AND "reservedQuantity" >= $2::int`,
    id,
    item.quantity,
    orgId
  )
  return r === 1
}

/**
 * Potrjeno PLAČILO: rezervacijo pretvori v PRODAJO v enem atomskem stavku —
 * `stockQuantity` se zniža (dejanska prodaja), `reservedQuantity` se zniža
 * (sprosti ta kos), dostopnost za druge ostane nespremenjena (ni dvojnega
 * štetja). Pogoj: reservedQuantity >= qty (ne sme sprostiti več kot ima).
 */
export async function convertReservationToSale(
  tx: Prisma.TransactionClient,
  item: PricedLine,
  orgId: string,
  orderId: string
): Promise<boolean> {
  const table = item.variantId ? "ProductVariant" : "Product"
  const id = item.variantId ?? item.productId
  // Brez sledenja zalogi ni rezervacije niti knjiženja — prodaja je v
  // evidencah (Order/OrderItem), zaloge se ne dotikamo.
  const policy = await rowStockPolicy(tx, table, id)
  if (!policy.exists) return false
  if (!policy.tracked) return true
  const r = await tx.$executeRawUnsafe(
    `UPDATE "${table}"
     SET "stockQuantity" = "stockQuantity" - $2::int,
         "reservedQuantity" = "reservedQuantity" - $2::int
     WHERE "id" = $1::text AND "organizationId" = $3::text AND "reservedQuantity" >= $2::int`,
    id,
    item.quantity,
    orgId
  )
  if (r !== 1) return false
  // Ledger: prodaja z source ORDER (kot prej), variant-aware.
  await tx.stockMovement.create({
    data: {
      organizationId: orgId,
      productId: item.productId,
      ...(item.variantId ? { productVariantId: item.variantId } : {}),
      direction: "OUT",
      quantity: item.quantity,
      source: "ORDER",
      orderId,
    },
  })
  return true
}

