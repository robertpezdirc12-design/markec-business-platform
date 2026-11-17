"use server"

// ============================================================
// PRIBION: termin ↔ delovno naročilo (2026-11-18)
//
// Priblonski termin je navaden termin v koledarju, ki je povezan z
// naročilom — tako lastnik vidi oboje: kdaj stranka pride in kaj je
// treba na oblačilu narediti. Povezava je mehka (SetNull), zato noben
// izbris ne uniči zgodovine.
//
// Pravice: workorders.manage (povezovanje je del vodenja naročila) in
// appointments.view (termini so terminska domena).
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"

export interface LinkableAppointment {
  id: string
  startTime: string
  status: string
  customerName: string | null
  services: string[]
  staffName: string | null
  linkedToOrderId: string | null
  linkedToOrderNumber: number | null
}

export interface LinkAppointmentResult {
  ok: boolean
  error?: string
}

/** Kandidati za priblon: prihodnji termini tega podjetja. */
export async function getLinkableAppointments(): Promise<LinkableAppointment[]> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { startTime: "asc" },
    take: 50,
    select: {
      id: true,
      startTime: true,
      status: true,
      customer: { select: { name: true } },
      staff: { select: { user: { select: { name: true } } } },
      services: { select: { service: { select: { name: true } } } },
      workOrder: { select: { id: true, number: true } },
    },
  })

  return appointments.map((a) => ({
    id: a.id,
    startTime: a.startTime.toISOString(),
    status: a.status,
    customerName: a.customer?.name ?? null,
    services: a.services.map((s) => s.service.name),
    staffName: a.staff?.user?.name ?? null,
    linkedToOrderId: a.workOrder?.id ?? null,
    linkedToOrderNumber: a.workOrder?.number ?? null,
  }))
}

/** Poveže termin z naročilom (isti tenant, termin še ni vezan drugam). */
export async function linkAppointmentToOrder(
  orderId: string,
  appointmentId: string
): Promise<LinkAppointmentResult> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const [order, appointment] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: orderId, organizationId: org.id },
      select: { id: true, number: true },
    }),
    prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: org.id },
      select: { id: true, workOrderId: true },
    }),
  ])
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (!appointment) return { ok: false, error: "APPOINTMENT_NOT_FOUND" }
  if (appointment.workOrderId === order.id) return { ok: true }
  if (appointment.workOrderId) return { ok: false, error: "ALREADY_LINKED" }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { workOrderId: order.id },
    }),
    prisma.workOrderEvent.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        type: "NOTE",
        message: "Povezan priblonski termin",
        actorEmail: null,
      },
    }),
  ])

  revalidatePath(`/dashboard/work-orders/${orderId}`)
  revalidatePath("/dashboard/appointments")
  return { ok: true }
}

/** Odveže termin od naročila (termin ostane v koledarju). */
export async function unlinkAppointmentFromOrder(
  orderId: string,
  appointmentId: string
): Promise<LinkAppointmentResult> {
  const { org } = await requirePermissionOrg("workorders.manage")

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      organizationId: org.id,
      workOrderId: orderId,
    },
    select: { id: true },
  })
  if (!appointment) return { ok: false, error: "NOT_FOUND" }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { workOrderId: null },
  })

  revalidatePath(`/dashboard/work-orders/${orderId}`)
  revalidatePath("/dashboard/appointments")
  return { ok: true }
}
