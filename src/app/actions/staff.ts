"use server"

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { CreateStaffInput } from "@/lib/interfaces"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { getPublicOrg, getSessionOrg } from "@/lib/tenant"
import { enforcePlanLimit } from "@/lib/plans/resolve"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import {
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { safeTimezone, toDateKey, dayBounds } from "@/lib/booking-time"
import { StaffAppointmentFilters } from "@/lib/interfaces"
import {
  staffSelfUpdateSchema,
  type StaffSelfUpdateFormData,
} from "@/lib/validations/staff"

/**
 * M19 (audit 2026-11): meje dneva/meseca v časovnem pasu salona —
 * ne v server-UTC. Vrnjene vrednosti so Date objekti v salonskem času.
 */
async function salonDayBounds(orgId: string, now: Date) {
  const tz = safeTimezone(
    (
      await prisma.salonConfig.findFirst({
        where: { organizationId: orgId },
        select: { timezone: true },
      })
    )?.timezone
  )
  const today = toDateKey(now, tz) ?? "1970-01-01"
  const day = dayBounds(today, tz) ?? { start: now, end: now }
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const monthKey = `${y}-${String(m).padStart(2, "0")}`
  const firstDay = dayBounds(`${monthKey}-01`, tz) ?? day
  const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lastDay = dayBounds(
    `${monthKey}-${String(lastDayNum).padStart(2, "0")}`,
    tz
  ) ?? day
  return {
    dayStart: day.start,
    dayEnd: day.end,
    monthStart: firstDay.start,
    monthEnd: lastDay.end,
  }
}

export type UpdateStaffInput = Partial<CreateStaffInput> & {
  serviceIds?: string[]
  workingHours?: {
    dayOfWeek: number
    isActive: boolean
    startTime: string
    endTime: string
  }[]
}

//Get All Active Services for Staff Form (admin)
export const getActiveServicesForStaff = async () => {
  const org = await getSessionOrg()
  if (!org) return []

  const services = await prisma.service.findMany({
    where: { isActive: true, organizationId: org.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return services
}

//Get Featured Staff for Homepage
export const getFeaturedStaff = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const staffMembers = await prisma.staff.findMany({
    where: { isActive: true, organizationId: org.id },
    take: 4,
    orderBy: { name: "asc" },
  })
  return staffMembers
})

//Get Staff Member
export const getStaffMembers = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const staffMembers = await prisma.staff.findMany({
    where: {
      isActive: true,
      organizationId: org.id,
    },
    include: {
      services: {
        where: {
          service: { organizationId: org.id },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
              price: true,
            },
          },
        },
      },
      workingHours: true,
    },
  })
  // Serialize Decimal values
  return staffMembers.map((staff) => ({
    ...staff,
    services: staff.services.map((ss) => ({
      ...ss,
      service: {
        ...ss.service,
        price: Number(ss.service.price),
      },
    })),
  }))
})

//Get Staff Member by Slug
// Cached to avoid duplicate fetches in generateMetadata + page component
export const getStaffMemberBySlug = cache(async (slug: string) => {
  const org = await getPublicOrg()
  if (!org) return null

  // Get all active staff and find by slug match
  const staffMembers = await prisma.staff.findMany({
    where: {
      isActive: true,
      organizationId: org.id,
    },
    include: {
      services: {
        where: {
          service: { organizationId: org.id },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              duration: true,
              price: true,
            },
          },
        },
      },
      workingHours: true,
    },
  })

  // Generate slug from name and find match
  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

  const staffMember = staffMembers.find(
    (staff) => generateSlug(staff.name) === slug
  )

  if (!staffMember) return null

  // Serialize Decimal values
  return {
    ...staffMember,
    services: staffMember.services.map((ss) => ({
      ...ss,
      service: {
        ...ss.service,
        price: Number(ss.service.price),
      },
    })),
  }
})

//Get Admin Staff Members
export const getAdminStaffMembers = async (search?: string) => {
  const { org } = await requirePermissionOrg("staff.manage")

  const staffMembers = await prisma.staff.findMany({
    where: {
      organizationId: org.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: {
        select: {
          services: true,
          appointments: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
  return staffMembers
}

//Get Admin Staff Stats
export const getAdminStaffStats = async () => {
  const { org } = await requirePermissionOrg("staff.manage")

  const [totalStaff, activeStaff, inactiveStaff] = await Promise.all([
    prisma.staff.count({ where: { organizationId: org.id } }),
    prisma.staff.count({ where: { isActive: true, organizationId: org.id } }),
    prisma.staff.count({ where: { isActive: false, organizationId: org.id } }),
  ])
  return { totalStaff, activeStaff, inactiveStaff }
}

//Get Staff Member by ID (admin edit view)
export const getStaffMemberById = async (id: string) => {
  const { org } = await requirePermissionOrg("staff.manage")

  const staffMember = await prisma.staff.findFirst({
    where: { id, organizationId: org.id },
    include: {
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      workingHours: true,
    },
  })
  if (!staffMember) {
    return null
  }
  // #79: payroll polja za formo (Decimal → number)
  return {
    ...staffMember,
    defaultTipPercent: staffMember.defaultTipPercent
      ? staffMember.defaultTipPercent.toNumber()
      : null,
    commissionValue: staffMember.commissionValue
      ? staffMember.commissionValue.toNumber()
      : null,
  }
}

//Create Staff Member
export const createStaffMember = async (data: UpdateStaffInput) => {
  try {
    const { org } = await requirePermissionOrg("staff.manage")

    // Plan entitlements (EPIC #3 E3-3): block NEW team members at the plan
    // limit — never touches existing content (downgrade tolerance).
    const limit = await enforcePlanLimit(org, "staff", await getLocaleFromCookies())
    if (!limit.ok) {
      return { success: false, error: limit.message, code: limit.code }
    }

    const { serviceIds, workingHours, email, ...staffData } = data

    if (!staffData.name || !email) {
      return { success: false, error: "Name and email are required" }
    }

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // F2.3.1: duplicate check is per-ORGANIZATION. A user may be an
      // employee in MULTIPLE orgs (one Staff row per (user, org)). Only a
      // Staff row for THIS (user, org) is a duplicate; the same user being
      // staff elsewhere is normal and must NOT reject the new row.
      const existingStaff = await prisma.staff.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: org.id,
          },
        },
      })

      if (existingStaff) {
        return {
          success: false,
          error: "A staff member with this email already exists",
        }
      }
    }

    // Create user if doesn't exist, then create staff
    const staff = await prisma.staff.create({
      data: {
        name: staffData.name,
        email,
        phone: staffData.phone,
        bio: staffData.bio,
        image: staffData.image,
        isActive: staffData.isActive ?? true,
        organization: { connect: { id: org.id } },
        user: existingUser
          ? { connect: { id: existingUser.id } }
          : {
              create: {
                name: staffData.name,
                email,
                role: "STAFF",
                organization: { connect: { id: org.id } },
              },
            },
      },
    })

    // Update user role to STAFF if they exist
    if (existingUser && existingUser.role !== "STAFF") {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: "STAFF" },
      })
    }

    // Create service associations (only with services in this organization)
    if (serviceIds?.length) {
      const orgServices = await prisma.service.findMany({
        where: { id: { in: serviceIds }, organizationId: org.id },
        select: { id: true },
      })
      if (orgServices.length) {
        await prisma.staffService.createMany({
          data: orgServices.map((service) => ({
            staffId: staff.id,
            serviceId: service.id,
          })),
        })
      }
    }

    // Create working hours
    if (workingHours?.length) {
      await prisma.workingHours.createMany({
        data: workingHours.map((wh) => ({
          staffId: staff.id,
          dayOfWeek: wh.dayOfWeek,
          isActive: wh.isActive,
          startTime: wh.startTime,
          endTime: wh.endTime,
        })),
      })
    }

    revalidatePath("/dashboard/staff")

    return { success: true, staff }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error creating staff member:", error)
    return { success: false, error: "Failed to create staff member" }
  }
}

//Update Staff Member
export const updateStaffMember = async (id: string, data: UpdateStaffInput) => {
  try {
    const { org } = await requirePermissionOrg("staff.manage")

    const { serviceIds, workingHours, ...staffData } = data

    // Verify ownership before mutating
    const existing = await prisma.staff.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Staff member not found" }
    }

    const updatedStaffMember = await prisma.staff.update({
      where: { id },
      data: staffData,
    })

    // Update service associations (only with services in this organization)
    if (serviceIds !== undefined) {
      await prisma.staffService.deleteMany({
        where: { staffId: id },
      })
      if (serviceIds.length) {
        const orgServices = await prisma.service.findMany({
          where: { id: { in: serviceIds }, organizationId: org.id },
          select: { id: true },
        })
        if (orgServices.length) {
          await prisma.staffService.createMany({
            data: orgServices.map((service) => ({
              staffId: id,
              serviceId: service.id,
            })),
          })
        }
      }
    }

    // Update working hours
    if (workingHours !== undefined) {
      await prisma.workingHours.deleteMany({
        where: { staffId: id },
      })
      if (workingHours.length) {
        await prisma.workingHours.createMany({
          data: workingHours.map((wh) => ({
            staffId: id,
            dayOfWeek: wh.dayOfWeek,
            isActive: wh.isActive,
            startTime: wh.startTime,
            endTime: wh.endTime,
          })),
        })
      }
    }

    revalidatePath("/dashboard/staff")

    return { success: true, staff: updatedStaffMember }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating staff member:", error)
    return { success: false, error: "Failed to update staff member." }
  }
}

//Delete Staff Member (deactivates and changes user role to CLIENTE)
export const deleteStaffMember = async (id: string) => {
  try {
    const { org } = await requirePermissionOrg("staff.manage")

    // Get staff with user info (must belong to admin's organization)
    const staff = await prisma.staff.findFirst({
      where: { id, organizationId: org.id },
      select: { userId: true },
    })

    if (!staff) {
      return { success: false, error: "Staff member not found." }
    }

    // Deactivate staff profile (don't delete to preserve history)
    await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    })

    // Change user role back to CLIENTE if user exists
    if (staff.userId) {
      await prisma.user.update({
        where: { id: staff.userId },
        data: { role: "CLIENTE" },
      })
    }

    revalidatePath("/dashboard/staff")
    revalidatePath("/dashboard/users")
    revalidatePath("/staff")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error removing staff member:", error)
    return { success: false, error: "Failed to remove staff member." }
  }
}

//Toggle Staff Active Status
export const toggleStaffActiveStatus = async (id: string) => {
  try {
    const { org } = await requirePermissionOrg("staff.manage")

    const staffMember = await prisma.staff.findFirst({
      where: { id, organizationId: org.id },
      select: { isActive: true },
    })

    if (!staffMember) {
      return { success: false, error: "Staff member not found." }
    }

    const updatedStaffMember = await prisma.staff.update({
      where: { id },
      data: { isActive: !staffMember.isActive },
    })
    revalidatePath("/dashboard/staff")
    return { success: true, staff: updatedStaffMember }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error toggling staff active status:", error)
    return { success: false, error: "Failed to toggle staff active status." }
  }
}

// Get Current Staff Member
export const getCurrentStaffMember = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    // F2.3.1: resolve within the ACTIVE organization (a user may be staff in
    // several orgs — never a global one-to-one lookup).
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff profile not found" }
    }
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      include: {
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
                description: true,
                category: true,
              },
            },
          },
        },
        workingHours: true,
      },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff profile not found",
      }
    }

    return {
      success: true,
      staff: {
        ...staffMember,
        services: staffMember?.services.map((ss) => ({
          ...ss,
          service: {
            ...ss.service,
            price: Number(ss.service.price),
          },
        })),
      },
    }
  } catch (error) {
    console.error("Error fetching current staff member:", error)
    return {
      success: false,
      error: "Failed to fetch current staff member.",
    }
  }
}

// Get Staff Portal Stats
export const getStaffPortalStats = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    const now = new Date()

    // F2.3.1: org-scoped (a user may be staff in several orgs).
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff profile not found" }
    }
    // M19: meje dneva/meseca v časovnem pasu salona (ne server-UTC).
    const { dayStart, dayEnd, monthStart, monthEnd } = await salonDayBounds(
      org.id,
      now
    )
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff profile not found",
      }
    }

    const [todaysAppointments, monthlyAppointments] = await Promise.all([
      prisma.appointment.count({
        where: {
          staffId: staffMember.id,
          startTime: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          staffId: staffMember.id,
          startTime: { gte: monthStart, lte: monthEnd },
        },
      }),
    ])

    const completedThisMonthAppointments = await prisma.appointment.findMany({
      where: {
        staffId: staffMember.id,
        status: "COMPLETED",
        startTime: { gte: monthStart, lte: monthEnd },
      },
    })

    const monthlyEarnings = completedThisMonthAppointments.reduce(
      (sum, appointment) => sum + Number(appointment.totalPrice),
      0
    )

    return {
      success: true,
      stats: {
        todaysAppointments,
        monthlyAppointments,
        monthlyEarnings,
        completedThisMonthAppointments: completedThisMonthAppointments.length,
      },
    }
  } catch (error) {
    console.error("Error fetching staff portal stats:", error)
    return {
      success: false,
      error: "Failed to fetch staff portal stats.",
    }
  }
}

//Get Staff Today's Appointments
export const getStaffTodaysAppointments = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    const now = new Date()

    // F2.3.1: org-scoped.
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff profile not found" }
    }
    // M19: meja dneva v časovnem pasu salona.
    const { dayStart, dayEnd } = await salonDayBounds(org.id, now)
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      include: {
        appointments: {
          where: {
            startTime: { gte: dayStart, lte: dayEnd },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
          include: {
            customer: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
            services: {
              include: {
                service: {
                  select: {
                    name: true,
                    duration: true,
                    price: true,
                  },
                },
              },
            },
          },
          orderBy: {
            startTime: "asc",
          },
        },
      },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff profile not found",
      }
    }

    return {
      success: true,
      appointments: staffMember.appointments.map((apt) => ({
        ...apt,
        totalPrice: Number(apt.totalPrice),
        customerName: apt.customer?.name || apt.guestName || "Walk-in",
        services: apt.services.map((s) => ({
          ...s,
          service: { ...s.service, price: Number(s.service.price) },
        })),
      })),
    }
  } catch (error) {
    console.error("Error fetching staff today's appointments:", error)
    return {
      success: false,
      error: "Failed to fetch staff today's appointments.",
    }
  }
}

//Get Staff Appointments
export const getStaffAppointments = async (
  filters: StaffAppointmentFilters
) => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    const now = new Date()

    // M19: za today/month filtra uporabimo meje v časovnem pasu salona.
    const bounds =
      filters.dateFilter === "today" || filters.dateFilter === "month"
        ? await salonDayBounds((await getSessionOrg())?.id ?? "", now)
        : null

    // Calculate date range based on filter
    let dateStart: Date | undefined
    let dateEnd: Date | undefined

    switch (filters.dateFilter) {
      case "today":
        dateStart = bounds?.dayStart
        dateEnd = bounds?.dayEnd
        break
      case "week":
        dateStart = startOfWeek(now, { weekStartsOn: 1 })
        dateEnd = endOfWeek(now, { weekStartsOn: 1 })
        break
      case "month":
        dateStart = bounds?.monthStart
        dateEnd = bounds?.monthEnd
        break
      case "all":
      default:
        // No date filter
        dateStart = undefined
        dateEnd = undefined
    }

    // Build status filter
    const statusFilter =
      filters.statusFilter && filters.statusFilter !== "ALL"
        ? filters.statusFilter
        : undefined

    // F2.3.1: org-scoped staff of the ACTIVE workspace.
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff profile not found" }
    }
    const staff = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      select: { id: true },
    })

    if (!staff) {
      return {
        success: false,
        error: "Staff profile not found",
      }
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      staffId: staff.id,
    }

    if (dateStart && dateEnd) {
      whereClause.startTime = { gte: dateStart, lte: dateEnd }
    }

    if (statusFilter) {
      whereClause.status = statusFilter
    }

    // Search filter by customer name or guest name
    if (filters.search) {
      whereClause.OR = [
        {
          customer: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { guestName: { contains: filters.search, mode: "insensitive" } },
      ]
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, email: true, phone: true },
        },
        services: {
          include: {
            service: {
              select: { name: true, duration: true, price: true },
            },
          },
        },
      },
      orderBy: { startTime: "desc" },
      // P2: omejena serija (paginacija v UI še ni implementirana).
      take: 500,
    })

    return {
      success: true,
      appointments: appointments.map((apt) => ({
        ...apt,
        totalPrice: Number(apt.totalPrice),
        depositAmount: Number(apt.depositAmount),
        customerName: apt.customer?.name || apt.guestName || "Walk-in",
        services: apt.services.map((s) => ({
          ...s,
          service: { ...s.service, price: Number(s.service.price) },
        })),
      })),
    }
  } catch (error) {
    console.error("Error fetching staff appointments:", error)
    return {
      success: false,
      error: "Failed to fetch staff appointments.",
    }
  }
}

//Get Staff Profile
export const getStaffProfile = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    // F2.3.1: org-scoped staff.
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff member not found" }
    }
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        image: true,
        isActive: true,
        createdAt: true,
        services: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        appointments: {
          where: { status: "COMPLETED" },
          select: { id: true },
        },
      },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff member not found",
      }
    }

    return {
      success: true,
      staff: {
        ...staffMember,
        totalCompletedAppointments: staffMember.appointments.length,
      },
    }
  } catch (error) {
    console.error("Error fetching staff profile:", error)
    return {
      success: false,
      error: "Failed to fetch staff profile.",
    }
  }
}

//Get Staff Assigned Services
export const getStaffAssignedServices = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    // F2.3.1: org-scoped staff.
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff profile not found" }
    }
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      select: {
        services: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
                duration: true,
                price: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff profile not found",
      }
    }

    return {
      success: true,
      services: staffMember.services.map((ss) => ({
        ...ss.service,
        price: Number(ss.service.price),
      })),
    }
  } catch (error) {
    console.error("Error fetching staff assigned services:", error)
    return {
      success: false,
      error: "Failed to fetch staff assigned services.",
    }
  }
}

//Update Staff Self Profile
export const updateStaffSelfProfile = async (data: StaffSelfUpdateFormData) => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  const parsed = staffSelfUpdateSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Neveljavni podatki profila.",
    }
  }

  try {
    const org = await getSessionOrg()
    if (!org) {
      return {
        success: false,
        error: "Unauthorized",
      }
    }

    // F2.3.1: per-org — a user may be staff in several orgs.
    const existingStaff = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      select: { id: true, organizationId: true },
    })

    if (!existingStaff || existingStaff.organizationId !== org.id) {
      return {
        success: false,
        error: "Unauthorized",
      }
    }

    const updatedStaff = await prisma.staff.update({
      where: { id: existingStaff.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
      },
    })

    revalidatePath("/staff-portal/profile")

    return {
      success: true,
      staff: updatedStaff,
    }
  } catch (error) {
    console.error("Error updating staff self profile:", error)
    return {
      success: false,
      error: "Failed to update staff profile.",
    }
  }
}

//Get Staff Working Hours
export const getStaffWorkingHours = async () => {
  const session = await auth()

  if (!session?.user.role || session.user.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  try {
    // F2.3.1: org-scoped staff.
    const org = await getSessionOrg()
    if (!org) {
      return { success: false, error: "Staff member not found" }
    }
    const staffMember = await prisma.staff.findFirst({
      where: { userId: session.user.id, organizationId: org.id },
      select: {
        workingHours: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            isActive: true,
          },
          orderBy: { dayOfWeek: "asc" },
        },
      },
    })

    if (!staffMember) {
      return {
        success: false,
        error: "Staff member not found",
      }
    }

    return {
      success: true,
      workingHours: staffMember.workingHours,
    }
  } catch (error) {
    console.error("Error fetching staff working hours:", error)
    return {
      success: false,
      error: "Failed to fetch staff working hours.",
    }
  }
}
