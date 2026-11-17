// ============================================================
// Zod sheme + validatorji za Activity Profile Registry (EPIC #1 §4–§5, §21)
//
// Tega modula NE uvaža nobena runtime pot — registri (registry.ts,
// extensions.ts) se zlagajo iz PODATKOV brez zod-a, zod validacija pa
// teče v testih (tests/profiles/registry-validation.test.ts) ob vsaki
// spremembi registrov. Prej so bile sheme vezane na module-load v
// registry.ts → zod (v4 core, 110+ KB) je končal v vsakem client bundle
// javnih strani (footer + i18n kontekst uvažata registry).
//
// Varnostni model se NE slabša: podatki registrov so ročno pisani v
// repozitoriju; testno validacijo poganja CI ob vsakem zagonu.
// ============================================================

import { z } from "zod"
import { CAPABILITY_KEYS, type ExtensionDefinition } from "./extensions"
import type { ActivityProfile } from "./types"

// ------------------------------------------------------------
// Zod sheme za profile
// ------------------------------------------------------------
const capabilityState = z.enum(["required", "optional", "disabled"])

/** Shema za shranjeno/vhodno vrednost secondary vertikale (null = počisti).
 *  Uporabljata jo actions/profile.ts in testi — client moduli je NE uvažajo. */
export const secondaryVerticalSchema = z.string().trim().min(1).nullable()

const capabilitySchema = z.object({
  appointments: capabilityState,
  workOrders: capabilityState,
  shop: capabilityState,
  services: capabilityState,
  inventory: capabilityState,
  customers: capabilityState,
  staff: capabilityState,
  analytics: capabilityState,
  reviews: capabilityState,
  forms: capabilityState,
  workflows: capabilityState,
  documents: capabilityState,
  delivery: capabilityState,
  // #98 (AD-02): walk-in vrsta — samostojen izbirni modul za VSE
  // dejavnosti (prijava brez računa, živa vrsta, javni status).
  walkIn: capabilityState,
  // WP-1 (Blagajna): dnevna denarna seja — eno jedro za VSE dejavnosti.
  cashRegister: capabilityState,
})

const termSchema = z.object({ sl: z.string().min(1), en: z.string().min(1) })

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})

const formSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(fieldSchema).min(1),
})

const workflowSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  entity: z.string().min(1),
  stages: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        name: z.string().min(1),
        description: z.string().optional(),
        slaHours: z.number().int().positive().optional(),
        isFinal: z.boolean().optional(),
      })
    )
    .min(2),
})

const profileSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.number().int().positive(),
  label: z.string().min(1),
  description: z.string().min(1),
  palette: z.string().min(1),
  // P2 #36: schema.org tip je del definicije profila — nov profil MORA
  // izbrati pravi @type (test to zaklene po vseh vertikalah).
  schemaType: z.string().min(1),
  capabilities: capabilitySchema,
  terminology: z.object({
    appointmentSingular: termSchema,
    appointmentPlural: termSchema,
    orderSingular: termSchema,
    orderPlural: termSchema,
    serviceSingular: termSchema,
    servicePlural: termSchema,
    productSingular: termSchema,
    productPlural: termSchema,
    customerSingular: termSchema,
    customerPlural: termSchema,
    bookingCta: termSchema,
  }),
  forms: z.array(formSchema),
  workflows: z.array(workflowSchema),
  dashboardWidgets: z.array(
    z.enum([
      "todayAppointments",
      "revenue",
      "customers",
      "topServices",
      "recentOrders",
      "lowStock",
      "activeOrders",
      "deadlines",
      "pendingApprovals",
      "readyForDelivery",
      "projects",
    ])
  ),
  website: z.object({
    ctaMode: z.enum(["booking", "inquiry", "order", "quote"]),
  }),
  extensions: z.array(z.string()),
  catalog: z.object({ seedVerticalId: z.string().min(1) }),
})

// ------------------------------------------------------------
// Zod sheme za razširitve
// ------------------------------------------------------------
const fieldDefSchema = z
  .object({
    key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    type: z.enum([
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "checkbox",
      "entityReference",
    ]),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    // Faza 2B/2C-1: za entityReference — dovoljeni cilj(i). Single objekt (2B) ALI niz.
    referenceTo: z
      .union([
        z.object({
          extensionId: z.string().regex(/^[a-z][a-z0-9-]*$/),
          entityKey: z.string().regex(/^[a-z][a-z0-9_]*$/),
        }),
        z.array(
          z.object({
            extensionId: z.string().regex(/^[a-z][a-z0-9-]*$/),
            entityKey: z.string().regex(/^[a-z][a-z0-9_]*$/),
          })
        ),
      ])
      .optional(),
    unit: z.string().optional(),
    placeholder: z.string().optional(),
  })
  // entityReference brez referenceTo je napaka — ne more se naložiti.
  .refine((f) => f.type !== "entityReference" || !!f.referenceTo, {
    message: "entityReference field mora definirati referenceTo",
    path: ["referenceTo"],
  })

const extensionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  capabilities: z.array(z.enum(CAPABILITY_KEYS)),
  entities: z.array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      name: z.string().min(1),
      description: z.string().min(1),
      fields: z.array(fieldDefSchema),
      appendOnly: z.boolean().optional(),
    })
  ),
})

// ------------------------------------------------------------
// Validatorji (kličejo jih testi — tests/profiles/registry-validation.test.ts)
// ------------------------------------------------------------

/** Zod validacija profilov + strukturna preverjanja (dvojniki, neznane razširitve). */
export function validateProfiles(
  list: ActivityProfile[],
  extensions: Record<string, unknown>
): void {
  const seen = new Set<string>()
  for (const profile of list) {
    const parsed = profileSchema.safeParse(profile)
    if (!parsed.success) {
      throw new Error(
        `[profiles] Invalid profile "${profile.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    if (seen.has(profile.id)) throw new Error(`[profiles] Duplicate profile id: ${profile.id}`)
    seen.add(profile.id)
    for (const e of profile.extensions) {
      if (!extensions[e]) throw new Error(`[profiles] Profile references unknown extension: ${e}`)
    }
  }
}

/** Zod validacija razširitev. */
export function validateExtensions(list: ExtensionDefinition[]): void {
  for (const ext of list) {
    const parsed = extensionSchema.safeParse(ext)
    if (!parsed.success) {
      throw new Error(
        `[profiles] Invalid extension "${ext.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
  }
}
