"use server"

// ============================================================
// REZERVACIJA → VOZILO → DELOVNI NALOG (2D-1W)
//
// Povezuje vulkanizersko/avtoservisno REZERVACIJO (Appointment) z
// obstoječim sistemom delavnice vozil (2D-1S) — BREZ spremembe sheme.
//
// Sled (želena, org-scoped):
//   javna stran → rezervacija → stranka → vozilo → potrjen termin
//                    → delovni nalog → porabljeni deli → zaloga → izvor.
//
// Kako hranimo povezave brez nove sheme (vzorec že uporabljen v 2D-1S za
// `__workOrderIds`): vozilo je `ExtensionRecord` (vehicle-workshop/vehicle)
// in nosi v svojem `data` append-only seznam `__appointments`:
//
//   data.__appointments: Array<{
//     appointmentId: string
//     workOrderId?: string   // izpolnjen, ko je iz rezervacije nastal nalog
//     serviceNames: string[]
//     at: string             // ISO trenutek shrambe povezave
//   }>
//
// S tem ima (a) vozilo polno zgodovino rezervacij in iz njih nastalih
// nalogov, (b) delovni nalog NEPOSREDNO razumljiv izvor (appointmentId),
// (c) preprečitev podvajanja naloga iz iste rezervacije (zapis z istim
// appointmentId, ki že ima workOrderId → zavrni). Rezervacija SE NE
// odšteva zaloge — to dela le delovni nalog (sellPartsOnWorkOrder).
// ============================================================

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const VEHICLE_EXT = "vehicle-workshop"
const VEHICLE_KEY = "vehicle"

export interface WorkshopBookingVehicle {
  id: string
  title: string
  licensePlate: string
  linkedWorkOrderId: string | null
}

export interface AppointmentWorkshopInfo {
  enabled: boolean
  vehicles: WorkshopBookingVehicle[]
  /** Delovni nalog, že ustvarjen iz te rezervacije (če obstaja). */
  createdWorkOrder: { id: string; number: number; title: string } | null
  canCreateWorkOrder: boolean
  createDisabledReason: string | null
}

export interface BookingLink {
  appointmentId: string
  workOrderId?: string
  serviceNames?: string[]
  at?: string
}

/** Append-only seznam rezervacij na vozilu (data.__appointments). */
function appointmentLinksOf(vehicleData: Record<string, unknown> | null | undefined): BookingLink[] {
  if (!vehicleData || typeof vehicleData !== "object") return []
  const arr = vehicleData.__appointments
  return Array.isArray(arr) ? (arr as BookingLink[]) : []
}

function workshopEnabled(
  vertical: string | null | undefined,
  secondaryVertical: string | null | undefined
): boolean {
  return (
    vertical === "tire-service" ||
    vertical === "mehanik" ||
    secondaryVertical === "tire-service" ||
    secondaryVertical === "mehanik"
  )
}

/**
 * Poišče/poveže vozilo te org (po registrski oznaki) na stranko rezervacije
 * in v `data.__appointments` append-a to rezervacijo. Org-scoped, idempotentno.
 * Kliče se PO nastanku rezervacije (imamo appointmentId).
 */
export async function linkVehicleToAppointment(opts: {
  organizationId: string
  customerId: string | null
  appointmentId: string
  vehiclePlate: string
  vehicleName?: string
  serviceNames: string[]
}): Promise<{ ok: boolean; vehicleId?: string }> {
  const plate = (opts.vehiclePlate || "").trim()
  if (!plate) return { ok: false }

  const existing = await prisma.extensionRecord.findFirst({
    where: {
      organizationId: opts.organizationId,
      extensionId: VEHICLE_EXT,
      entityKey: VEHICLE_KEY,
      data: { path: ["license_plate"], equals: plate },
    },
    select: { id: true, data: true, customerId: true },
  })

  try {
    const { vehicleId } = await prisma.$transaction(async (tx) => {
      if (existing) {
        const prev = (existing.data ?? {}) as Record<string, unknown>
        const kept = appointmentLinksOf(prev).filter((l) => l.appointmentId !== opts.appointmentId)
        kept.push({ appointmentId: opts.appointmentId, serviceNames: opts.serviceNames, at: new Date().toISOString() })
        await tx.extensionRecord.update({
          where: { id: existing.id },
          data: {
            customerId: existing.customerId ?? opts.customerId,
            data: { ...prev, __appointments: kept } as unknown as Prisma.InputJsonValue,
          },
        })
        return { vehicleId: existing.id }
      }
      const name = (opts.vehicleName || "").trim() || `Vozilo ${plate}`
      const created = await tx.extensionRecord.create({
        data: {
          organizationId: opts.organizationId,
          extensionId: VEHICLE_EXT,
          entityKey: VEHICLE_KEY,
          title: name,
          customerId: opts.customerId,
          data: {
            license_plate: plate,
            name: (opts.vehicleName || "").trim() || undefined,
            __appointments: [
              { appointmentId: opts.appointmentId, serviceNames: opts.serviceNames, at: new Date().toISOString() },
            ],
          } as unknown as Prisma.InputJsonValue,
        },
      })
      return { vehicleId: created.id }
    })
    return { ok: true, vehicleId }
  } catch {
    return { ok: false }
  }
}

// ============================================================
// Podatki za dashboard: vozila / obstoječi nalog / omogočenost
// ============================================================
export async function getAppointmentWorkshopInfo(
  appointmentId: string
): Promise<AppointmentWorkshopInfo> {
  const { org } = await requirePermissionOrg("appointments.view")
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: org.id },
    include: { customer: { select: { id: true } } },
  })
  if (!appt)
    return { enabled: false, vehicles: [], createdWorkOrder: null, canCreateWorkOrder: false, createDisabledReason: "NOT_FOUND" }

  const orgRow = await prisma.organization.findUnique({ where: { id: org.id }, select: { vertical: true, secondaryVertical: true } })
  const enabled = workshopEnabled(orgRow?.vertical, orgRow?.secondaryVertical)
  if (!enabled)
    return { enabled: false, vehicles: [], createdWorkOrder: null, canCreateWorkOrder: false, createDisabledReason: "NOT_ENABLED" }

  const vehicles = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, entityKey: VEHICLE_KEY },
    select: { id: true, title: true, data: true, customerId: true },
  })
  const matches = vehicles.filter((v) => {
    const links = appointmentLinksOf(v.data as Record<string, unknown> | null)
    if (links.some((l) => l.appointmentId === appt.id)) return true
    return appt.customerId != null && v.customerId === appt.customerId
  })

  const enriched: WorkshopBookingVehicle[] = []
  let createdWorkOrder: { id: string; number: number; title: string } | null = null
  for (const v of matches) {
    const links = appointmentLinksOf(v.data as Record<string, unknown> | null).filter((l) => l.appointmentId === appt.id)
    let linkedWorkOrderId: string | null = null
    for (const l of links) {
      if (l.workOrderId) {
        const wo = await prisma.workOrder.findFirst({ where: { id: l.workOrderId, organizationId: org.id }, select: { id: true, number: true, title: true } })
        if (wo) {
          linkedWorkOrderId = wo.id
          if (!createdWorkOrder) createdWorkOrder = wo
        }
      }
    }
    enriched.push({
      id: v.id,
      title: v.title,
      licensePlate: String((v.data as Record<string, unknown>)?.license_plate ?? ""),
      linkedWorkOrderId,
    })
  }

  const canCreate = appt.status === "CONFIRMED" && !createdWorkOrder && enriched.length > 0
  const reason = appt.status !== "CONFIRMED"
    ? "STATUS_NOT_CONFIRMED"
    : createdWorkOrder
      ? "ALREADY_CREATED"
      : enriched.length === 0
        ? "NO_VEHICLE"
        : null

  return { enabled, vehicles: enriched, createdWorkOrder, canCreateWorkOrder: canCreate, createDisabledReason: reason }
}

// ============================================================
// IZRECNA akcija: Ustvari delovni nalog iz potrjene rezervacije
// ============================================================

const createWoSchema = z.object({
  appointmentId: z.string().min(1).max(64),
})

export interface CreateWorkOrderFromAppointmentResult {
  ok: boolean
  error?: string
  workOrderId?: string
}

export async function createWorkOrderFromAppointment(
  input: z.input<typeof createWoSchema>
): Promise<CreateWorkOrderFromAppointmentResult> {
  const parsed = createWoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }

  const { org } = await requirePermissionOrg("workorders.manage")

  const appt = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, organizationId: org.id },
    include: {
      customer: { select: { id: true, name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  })
  if (!appt) return { ok: false, error: "APPOINTMENT_NOT_FOUND" }
  if (appt.status !== "CONFIRMED") return { ok: false, error: "NOT_CONFIRMED" }

  const orgRow = await prisma.organization.findUnique({ where: { id: org.id }, select: { vertical: true, secondaryVertical: true } })
  if (!workshopEnabled(orgRow?.vertical, orgRow?.secondaryVertical)) return { ok: false, error: "WORKSHOP_DISABLED" }

  const allVehicles = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, entityKey: VEHICLE_KEY },
    select: { id: true, title: true, data: true, customerId: true },
  })
  const viaLink = allVehicles.find((v) => appointmentLinksOf(v.data as Record<string, unknown> | null).some((l) => l.appointmentId === appt.id))
  const vehicle = viaLink ?? (appt.customerId ? allVehicles.find((v) => v.customerId === appt.customerId) : undefined)
  if (!vehicle) return { ok: false, error: "NO_VEHICLE" }

  const links = appointmentLinksOf(vehicle.data as Record<string, unknown> | null).filter((l) => l.appointmentId === appt.id)
  const existingLink = links.find((l) => l.workOrderId)
  if (existingLink) {
    const existingWo = await prisma.workOrder.findFirst({
      where: { id: existingLink.workOrderId!, organizationId: org.id },
      select: { id: true },
    })
    if (existingWo) return { ok: false, error: "ALREADY_CREATED", workOrderId: existingWo.id }
  }

  const def = await prisma.workflowDefinition.findFirst({ where: { organizationId: org.id, entity: "order", isActive: true }, select: { id: true } })
  if (!def) return { ok: false, error: "NO_WORKFLOW" }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingLinked = await tx.workOrder.count({ where: { organizationId: org.id, linkedRecordId: vehicle.id } })
      const linkRec = existingLinked === 0 ? vehicle.id : null
      const max = await tx.workOrder.aggregate({ where: { organizationId: org.id }, _max: { number: true } })
      const number = (max._max.number ?? 0) + 1
      const svcNames = appt.services.map((s) => s.service.name)
      const title = `${svcNames.join(", ") || "Servis"} — ${vehicle.title}`

      const prev = (vehicle.data ?? {}) as Record<string, unknown>
      const prevWorkOrderIds: string[] = Array.isArray(prev.__workOrderIds)
        ? (prev.__workOrderIds as unknown[]).map((x) => String(x))
        : []

      const wo = await tx.workOrder.create({
        data: {
          organizationId: org.id,
          number,
          title,
          status: "OPEN",
          priority: "NORMAL",
          linkedRecordId: linkRec,
          customerId: appt.customerId,
          workflowDefinitionId: def.id,
          currentStageKey: (
            await tx.workflowStage.findFirst({ where: { definitionId: def.id }, orderBy: { order: "asc" }, select: { key: true } })
          )!.key,
          events: {
            create: {
              organizationId: org.id,
              type: "CREATED",
              message: `Ustvarjen iz rezervacije #${appt.id.slice(-8)} — ${svcNames.join(", ")}`,
              actorEmail: null,
            },
          },
        },
      })

      const newLinks = appointmentLinksOf(prev).map((l) =>
        l.appointmentId === appt.id ? { ...l, workOrderId: wo.id } : l
      )
      await tx.extensionRecord.update({
        where: { id: vehicle.id },
        data: {
          data: {
            ...prev,
            __workOrderIds: [...prevWorkOrderIds, wo.id],
            __appointments: newLinks,
          } as unknown as Prisma.InputJsonValue,
        },
      })
      return { workOrderId: wo.id }
    })

    revalidatePath("/dashboard/appointments")
    revalidatePath("/dashboard/work-orders")
    revalidatePath("/dashboard/tire-service")
    return { ok: true, workOrderId: result.workOrderId }
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" }
  }
}