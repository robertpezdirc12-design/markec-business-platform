"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { overridesSnapshot, type ConfigSnapshot } from "@/lib/config-history/logic"
import { recordConfigChange } from "@/lib/config-history/record"
import { OVERRIDES_ENTITY_KEY } from "@/lib/config-history/logic"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CustomFieldSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})

const CustomFormSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  fields: z.array(CustomFieldSchema).min(1),
})

const CustomWorkflowStageSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  slaHours: z.number().int().positive().optional(),
  isFinal: z.boolean().default(false),
  order: z.number().int().optional(),
})

const CustomWorkflowSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(100),
  entity: z.string().min(1).max(50),
  stages: z.array(CustomWorkflowStageSchema).min(2),
})

const CustomProfileSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  palette: z.string().min(1).max(50),
  schemaType: z.string().min(1).max(100),
  capabilities: z.record(z.string(), z.enum(["required", "optional", "disabled"])),
  ctaMode: z.enum(["booking", "inquiry", "order", "quote"]),
  forms: z.array(CustomFormSchema).optional().default([]),
  workflows: z.array(CustomWorkflowSchema).optional().default([]),
  dashboardWidgets: z.array(z.string()).max(20).optional().default([]),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomProfileData {
  id: string
  label: string
  description: string
  palette: string
  schemaType: string
  capabilities: Record<string, "required" | "optional" | "disabled">
  ctaMode: "booking" | "inquiry" | "order" | "quote"
  forms: z.infer<typeof CustomFormSchema>[]
  workflows: z.infer<typeof CustomWorkflowSchema>[]
  dashboardWidgets: string[]
}

export interface CustomProfileResult {
  ok: boolean
  error?: string
  profile?: CustomProfileData
}

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

/** Load the org's custom activity profile (if any). */
export async function getOrgCustomProfile(): Promise<
  | { ok: true; profile: CustomProfileData | null }
  | { ok: false; error: string }
> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")

    const raw = (org as any)?.profileOverrides
    const custom = raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as any).customProfile
      : null

    if (!custom) {
      return { ok: true, profile: null }
    }

    // Tolerant parse — legacy/partial shapes are treated as "no custom profile".
    const parsed = CustomProfileSchema.safeParse(custom)
    if (!parsed.success) {
      return { ok: true, profile: null }
    }

    return { ok: true, profile: parsed.data }
  } catch (error) {
    console.error("getOrgCustomProfile error:", error)
    return { ok: false, error: "Profila ni bilo mogoče naložiti." }
  }
}

/** Save (create or replace) the org's custom activity profile. */
export async function saveOrgCustomProfile(
  input: z.input<typeof CustomProfileSchema>
): Promise<CustomProfileResult> {
  try {
    const { org, session } = await requirePermissionOrg("settings.manage")
    const parsed = CustomProfileSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: "Neveljavi vnos." }
    }

    const profile = parsed.data

    const previousOverrides = overridesSnapshot(
      (await prisma.organization.findUnique({
        where: { id: org.id },
        select: { profileOverrides: true },
      }))?.profileOverrides
    )

    const nextOverrides = {
      ...(previousOverrides as any),
      customProfile: profile,
      v: 1,
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: org.id },
        data: { profileOverrides: nextOverrides },
      })
      await recordConfigChange({
        organizationId: org.id,
        actorEmail: session.user.email ?? "",
        entityKey: OVERRIDES_ENTITY_KEY,
        action: "UPDATE",
        previous: previousOverrides,
        next: nextOverrides as ConfigSnapshot,
        tx,
      })
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/settings")
    return { ok: true, profile }
  } catch (error) {
    console.error("saveOrgCustomProfile error:", error)
    return { ok: false, error: "Napaka pri shranjevanju profila." }
  }
}

/** Remove the org's custom activity profile — back to the registry profile. */
export async function removeOrgCustomProfile(): Promise<CustomProfileResult> {
  try {
    const { org, session } = await requirePermissionOrg("settings.manage")

    const previousOverrides = overridesSnapshot(
      (await prisma.organization.findUnique({
        where: { id: org.id },
        select: { profileOverrides: true },
      }))?.profileOverrides
    )

    const nextOverrides = { ...(previousOverrides as any) }
    delete nextOverrides.customProfile

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: org.id },
        data: { profileOverrides: nextOverrides },
      })
      await recordConfigChange({
        organizationId: org.id,
        actorEmail: session.user.email ?? "",
        entityKey: OVERRIDES_ENTITY_KEY,
        action: "UPDATE",
        previous: previousOverrides,
        next: nextOverrides as ConfigSnapshot,
        tx,
      })
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch (error) {
    console.error("removeOrgCustomProfile error:", error)
    return { ok: false, error: "Napaka pri brisanju profila." }
  }
}
