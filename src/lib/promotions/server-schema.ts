// ============================================================
// F5.1 — STREŽNIŠKA ZOD VALIDACIJA PROMOCIJ (bela lista polj)
//
// Enako načelo kot produkta (#106): odjemalec nikoli ne pošlje
// surovih podatkov naravnost v Prisma. Ta shema je avtoritativna na
// strežniku — parsed.data vsebuje SAMO dovoljena polja; marsikateri
// ponesrečen/zloben ključ strukturno izgine, preden pride do baze.
// Čisto + testabilno (brez DB).
// ============================================================

import { z } from "zod"

const CODE_PATTERN = /^[A-Z0-9]{2,32}$/

export const promotionServerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ime promocije je obvezno")
    .max(200, "Ime je predolgo (največ 200 znakov)"),
  description: z
    .string()
    .trim()
    .max(5000, "Opis je predolg (največ 5000 znakov)")
    .optional()
    .nullable(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z
    .number()
    .min(0, "Vrednost popusta ne sme biti negativna")
    .max(1_000_000, "Vrednost popusta je prevelika"),
  scope: z.enum(["WHOLE_AMOUNT", "PRODUCTS", "SERVICES", "CATEGORIES"]),
  targetEntityIds: z
    .array(z.string().max(64))
    .max(2000, "Preveč ciljnih entitet")
    .default([]),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_PATTERN, "Koda ima lahko samo črke in številke (2–32 znakov)")
    .optional()
    .nullable(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maxRedemptions: z
    .number()
    .int()
    .min(1, "Omejitev uporab mora biti vsaj 1")
    .max(1_000_000)
    .nullable()
    .optional(),
  maxPerCustomer: z
    .number()
    .int()
    .min(1, "Omejitev na stranko mora biti vsaj 1")
    .max(1_000_000)
    .nullable()
    .optional(),
  minOrderValue: z
    .number()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
})

export type PromotionServerInput = z.infer<typeof promotionServerSchema>

export const promotionServerUpdateSchema = promotionServerSchema.partial()

/** Polja, ki jih dovolimo pri posodobitvi EXISTING promocije. */
const UPDATABLE_FIELDS = [
  "name",
  "description",
  "discountType",
  "discountValue",
  "scope",
  "targetEntityIds",
  "code",
  "startsAt",
  "endsAt",
  "maxRedemptions",
  "maxPerCustomer",
  "minOrderValue",
] as const

export function parsePromotionServerInput(
  data: unknown,
  mode: "create"
): { ok: true; data: PromotionServerInput } | { ok: false; error: string }
export function parsePromotionServerInput(
  data: unknown,
  mode: "update"
): { ok: true; data: Partial<PromotionServerInput> } | { ok: false; error: string }
export function parsePromotionServerInput(
  data: unknown,
  mode: "create" | "update"
): { ok: true; data: Partial<PromotionServerInput> } | { ok: false; error: string } {
  const schema = mode === "create" ? promotionServerSchema : promotionServerUpdateSchema
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path?.join(".") || "podatki"
    return {
      ok: false,
      error: `Neveljavni podatki promocije — ${field}: ${issue?.message ?? "napaka"}`,
    }
  }
  let out: Partial<PromotionServerInput> = parsed.data
  if (mode === "update") {
    // Pri posodobitvi dovolimo SAMO lastniška polja — status
    // preklapljamo izključno prek namenske akcije setPromotionStatus.
    const clean: Record<string, unknown> = {}
    for (const key of UPDATABLE_FIELDS) {
      if (key in parsed.data) {
        clean[key] = (parsed.data as Record<string, unknown>)[key]
      }
    }
    out = clean
  }
  return { ok: true, data: out }
}