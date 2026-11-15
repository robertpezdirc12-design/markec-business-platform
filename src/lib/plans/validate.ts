// ============================================================
// Zod shema + validacija za Plan Registry (EPIC #3 E3-3)
//
// Tega modula NE uvaža nobena runtime pot — registry (registry.ts)
// se zloži iz PODATKOV brez zod-a, zod validacija pa teče v testih
// (tests/plans/registry.test.ts) ob vsaki spremembi planov. Prej so
// bile sheme vezane na module-load v registry.ts → zod (110+ KB) je
// končal v client bundle-u javne pricing/landing strani.
//
// Varnostni model se NE slabša: podatki planov so ročno pisani v
// repozitoriju; testno validacijo poganja CI ob vsakem zagonu.
// ============================================================

import { z } from "zod"
import { PLAN_IDS, type PlanDefinition, type PlanId } from "./types"

// ------------------------------------------------------------
// Zod schema
// ------------------------------------------------------------

const planIdSchema = z.enum(PLAN_IDS)

const localizedText = z.object({ sl: z.string().min(1), en: z.string().min(1) })

/** null = unlimited; a number must be a positive integer. */
const limitValue = z.number().int().positive().nullable()

/** Like limitValue but 0 is allowed — a resource can be entirely
 * outside a plan (e.g. custom domains on FREE, EPIC #3 E3-6). */
const limitValueOrZero = z.number().int().min(0).nullable()

const planSchema = z.object({
  id: planIdSchema,
  version: z.number().int().positive(),
  label: z.string().min(1).max(24),
  description: localizedText,
  // Mesečna cena v EUR centih (0 = brezplačno). Prikaz za javno pricing stran.
  priceMonthly: z.number().int().min(0),
  limits: z.object({
    services: limitValue,
    products: limitValue,
    staff: limitValue,
    storageMb: limitValue,
    customDomains: limitValueOrZero,
    // Monthly orders (E3-7) — a derived counter, so the same
    // nullable-positive schema as other count limits applies.
    orders: limitValue,
  }),
  features: z.array(localizedText).min(1),
})

// ------------------------------------------------------------
// Validacija (kličejo jo testi — tests/plans/registry.test.ts)
// ------------------------------------------------------------

/** Zod validacija planov + strukturna preverjanja (dvojniki, manjkajoči obvezni plani). */
export function validatePlans(list: PlanDefinition[]): void {
  const out = {} as Record<PlanId, boolean>
  for (const plan of list) {
    const parsed = planSchema.safeParse(plan)
    if (!parsed.success) {
      throw new Error(
        `[plans] Invalid plan "${plan.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    if (out[plan.id]) throw new Error(`[plans] Duplicate plan id: ${plan.id}`)
    out[plan.id] = true
  }
  for (const id of PLAN_IDS) {
    if (!out[id]) throw new Error(`[plans] Missing required plan: ${id}`)
  }
}
