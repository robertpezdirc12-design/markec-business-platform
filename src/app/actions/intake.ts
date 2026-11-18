"use server"

// ============================================================
// #96 — JAVNI SPREJEMNI OBRAZCI (žeton v URL, brez prijave).
//
// Ločeno od actions/appointments.ts NAMERNA (FAZA 3 perf, #96): javni
// žetonski tok ne sme vleči booking grapha (locking, addons, email,
// stripe) iz appointments.ts v javne client bundle-je — merjen
// izkupiček ločitve je majhen, a ločitev drži javno stranko čisto:
// /intake/[token] uvozi samo prisma + lib/forms/intake (client-safe
// validacija) in nič drugega.
// ============================================================

import { prisma } from "@/lib/prisma"
import {
  validateIntakeAnswers,
  isPlausibleIntakeToken,
  pickIntakeService,
  intakeLinkAllowed,
} from "@/lib/forms/intake"
import type { ProfileFieldDef } from "@/lib/profiles/types"
import { Prisma } from "@prisma/client"

async function getIntakeContextByToken(token: string) {
  if (!isPlausibleIntakeToken(token)) return null

  const appointment = await prisma.appointment.findUnique({
    where: { intakeToken: token },
    include: {
      organization: { select: { id: true, name: true, status: true } },
      services: {
        include: {
          service: {
            select: { id: true, name: true, intakeFormDefinitionId: true },
          },
        },
      },
    },
  })
  if (!appointment || !appointment.organization) return null
  if (!intakeLinkAllowed(appointment.status)) return null
  if (appointment.organization.status !== "ACTIVE") return null

  // Isto pravilo kot v booking flow-u: prva storitev z obrazcem določi
  // obrazec termina.
  const intakeService = pickIntakeService(appointment.services)
  const definitionId = intakeService?.service.intakeFormDefinitionId
  if (!definitionId) return null

  const definition = await prisma.formDefinition.findFirst({
    where: {
      id: definitionId,
      organizationId: appointment.organization.id,
      isActive: true,
    },
    select: { name: true, description: true, fields: true },
  })
  if (!definition) return null

  let fields: unknown = definition.fields
  if (typeof fields === "string") {
    try {
      fields = JSON.parse(fields)
    } catch {
      return null
    }
  }
  if (!Array.isArray(fields) || fields.length === 0) return null

  return {
    appointmentId: appointment.id,
    organizationId: appointment.organization.id,
    organizationName: appointment.organization.name,
    serviceName: intakeService?.service.name ?? null,
    startTime: appointment.startTime,
    definitionId,
    form: {
      name: definition.name,
      description: definition.description,
      fields: fields as {
        key: string
        label: string
        type: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
        required: boolean
        options?: string[]
        placeholder?: string
      }[],
    },
  }
}

/** Javno (gost): pregled obrazca pred izpolnjevanjem prek žetona. */
export async function getIntakeFormByToken(token: string) {
  const context = await getIntakeContextByToken(token)
  if (!context) return null

  const submission = await prisma.formSubmission.findFirst({
    where: {
      contextType: "appointment",
      contextId: context.appointmentId,
    },
    select: { id: true },
  })

  return {
    submitted: Boolean(submission),
    organizationName: context.organizationName,
    serviceName: context.serviceName,
    when: context.startTime.toISOString(),
    form: context.form,
  }
}

/** Javno (gost): oddaja obrazca prek žetona. Unique index na
 * (formDefinitionId, contextType, contextId) naredi ponovljeno oddajo
 * varno odstopljivo (P2002 = že oddano). */
export async function submitIntakeByToken(
  token: string,
  answers: unknown
): Promise<
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_SUBMITTED" | "INVALID"; errors?: Record<string, string> }
> {
  const context = await getIntakeContextByToken(token)
  if (!context) return { ok: false, code: "NOT_FOUND" }

  const check = validateIntakeAnswers(context.form.fields as unknown as ProfileFieldDef[], answers)
  if (!check.ok) {
    return { ok: false, code: "INVALID", errors: check.errors }
  }

  const existing = await prisma.formSubmission.findFirst({
    where: { contextType: "appointment", contextId: context.appointmentId },
    select: { id: true },
  })
  if (existing) return { ok: false, code: "ALREADY_SUBMITTED" }

  try {
    await prisma.formSubmission.create({
      data: {
        organizationId: context.organizationId,
        formDefinitionId: context.definitionId,
        status: "NEW",
        data: check.data as Prisma.InputJsonValue,
        contextType: "appointment",
        contextId: context.appointmentId,
      },
    })
  } catch (error) {
    // P2002: (formDefinitionId, contextType, contextId) je že zapolnjen.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "ALREADY_SUBMITTED" }
    }
    throw error
  }

  return { ok: true }
}
