"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email/password-reset"
import { notificationPreferencesSchema } from "@/lib/validations/reschedule"
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/validations/profile"
import type { Payment } from "@/lib/interfaces"

// Update user profile image
export async function updateProfileImage(imageUrl: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Niste prijavljeni" }
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageUrl },
    })

    revalidatePath("/my-account")
    return { success: true }
  } catch (error) {
    console.error("Update profile image error:", error)
    return { success: false, error: "Posodabljanje profilne slike ni uspelo" }
  }
}

// Update user profile action
export async function getUserProfile() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          phone: true,
          // customer.notes so INTERNE opombe salona — stranka jih ne sme
          // videti (prej so bile v RSC payloadu Mojega računa).
        },
      },
    },
  })
  return user
}

// Get order stats for customer
export async function getOrderStats() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: true },
  })

  if (!user?.customer) {
    return {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      totalSpent: 0,
    }
  }

  const [totalOrders, completedOrders, pendingOrders, totalSpentResult] =
    await Promise.all([
      prisma.order.count({
        where: { customerId: user.customer.id },
      }),
      prisma.order.count({
        where: {
          customerId: user.customer.id,
          status: "COMPLETED",
        },
      }),
      prisma.order.count({
        where: {
          customerId: user.customer.id,
          status: { in: ["PENDING", "PAID"] },
        },
      }),
      prisma.order.aggregate({
        where: {
          customerId: user.customer.id,
          status: { in: ["PAID", "COMPLETED"] },
        },
        _sum: {
          total: true,
        },
      }),
    ])

  return {
    totalOrders,
    completedOrders,
    pendingOrders,
    totalSpent: totalSpentResult._sum.total?.toNumber() || 0,
  }
}

// Get current stats
export async function getUserStats() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: true },
  })

  if (!user?.customer) {
    return {
      totalAppointments: 0,
      completedAppointments: 0,
      upcomingAppointments: 0,
    }
  }

  const [totalAppointments, completedAppointments, upcomingAppointments] =
    await Promise.all([
      prisma.appointment.count({
        where: { customerId: user.customer.id },
      }),
      prisma.appointment.count({
        where: {
          customerId: user.customer.id,
          status: "COMPLETED",
        },
      }),
      prisma.appointment.count({
        where: {
          customerId: user.customer.id,
          startTime: { gte: new Date() },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
    ])

  return {
    totalAppointments,
    completedAppointments,
    upcomingAppointments,
  }
}

// Update profile action
export async function updateProfile(data: UpdateProfileInput) {
  const session = await auth()

  if (!session?.user?.id) {
    return { success: false, errors: [{ message: "Nepooblaščen dostop" }] }
  }

  const validated = updateProfileSchema.safeParse(data)

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0].message,
    }
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: validated.data.name },
    })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })

    if (user?.customer) {
      await prisma.customer.update({
        where: { id: user.customer.id },
        data: {
          name: validated.data.name,
          phone: validated.data.phone || null,
        },
      })
    }
    revalidatePath("/my-account")
    return { success: true }
  } catch (error) {
    console.error("Update profile error:", error)
    return { success: false, error: "Posodabljanje profila ni uspelo" }
  }
}

// Change password
export async function changePassword(data: ChangePasswordInput) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Niste prijavljeni" }
  }

  const validated = changePasswordSchema.safeParse(data)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0].message,
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    if (!user?.password) {
      return {
        success: false,
        error: "Za OAuth račune gesla ni mogoče spremeniti",
      }
    }

    // Verify current password
    const isValid = await bcrypt.compare(
      validated.data.currentPassword,
      user.password
    )

    if (!isValid) {
      return { success: false, error: "Trenutno geslo ni pravilno" }
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(validated.data.newPassword, 12)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    })

    return { success: true }
  } catch (error) {
    console.error("Change password error:", error)
    return { success: false, error: "Sprememba gesla ni uspela" }
  }
}

// Send password reset email from account page
export async function sendPasswordResetFromAccount() {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    return { success: false, error: "Niste prijavljeni" }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, password: true },
    })

    if (!user) {
      return { success: false, error: "Uporabnika ni mogoče najti" }
    }

    if (!user.password) {
      return {
        success: false,
        error: "Za OAuth račune gesla ni mogoče ponastaviti",
      }
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save token to database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    // Send email
    await sendPasswordResetEmail(user.email, resetToken)

    return { success: true }
  } catch (error) {
    console.error("Send password reset error:", error)
    return { success: false, error: "Pošiljanje e-poštnega sporočila za ponastavitev ni uspelo" }
  }
}

// Get notification preferences for the current user
export async function getNotificationPreferences() {
  const defaults = {
    emailReminders: true,
    reminderTime: "24h" as "24h" | "48h" | "1week",
    promotionalEmails: false,
    appointmentUpdates: true,
  }

  const session = await auth()

  if (!session?.user?.id) {
    return defaults
  }

  try {
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
      select: {
        emailReminders: true,
        reminderTime: true,
        promotionalEmails: true,
        appointmentUpdates: true,
      },
    })

    if (!prefs) {
      return defaults
    }

    const reminderTime =
      prefs.reminderTime === "24h" ||
      prefs.reminderTime === "48h" ||
      prefs.reminderTime === "1week"
        ? prefs.reminderTime
        : defaults.reminderTime

    return {
      emailReminders: prefs.emailReminders,
      reminderTime,
      promotionalEmails: prefs.promotionalEmails,
      appointmentUpdates: prefs.appointmentUpdates,
    }
  } catch (error) {
    console.error("Error getting notification preferences:", error)
    return defaults
  }
}

// Update notification preferences
export async function updateNotificationPreferences(data: {
  emailReminders: boolean
  reminderTime: string
  promotionalEmails: boolean
  appointmentUpdates: boolean
}) {
  const session = await auth()

  if (!session?.user?.id) {
    return { success: false, error: "Niste prijavljeni" }
  }

  try {
    const validated = notificationPreferencesSchema.safeParse(data)

    if (!validated.success) {
      return { success: false, error: "Neveljavni podatki" }
    }

    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    })
    revalidatePath("/my-account")
    return { success: true, preferences: prefs }
  } catch (error) {
    console.error("Update notification preferences error:", error)
    return { success: false, error: "Shranjevanje nastavitev ni uspelo" }
  }
}

// Get payment history for the current user
export async function getPaymentHistory(): Promise<Payment[]> {
  const session = await auth()

  if (!session?.user?.id) {
    return []
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })

    if (!user?.customer) {
      return []
    }

    const [appointments, orders] = await Promise.all([
      prisma.appointment.findMany({
        where: { customerId: user.customer.id, depositPaid: true },
        include: {
          services: { include: { service: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          customerId: user.customer.id,
          status: { in: ["PAID", "COMPLETED"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const payments: Payment[] = []

    // Map appointments to Payment
    for (const appt of appointments) {
      const serviceNames = appt.services.map((s) => s.service.name).join(", ")
      payments.push({
        id: appt.id,
        type: "APPOINTMENT_DEPOSIT",
        amount: appt.depositAmount.toNumber(),
        status: "COMPLETED",
        createdAt: appt.createdAt,
        description: serviceNames || "Polog za termin",
        referenceId: appt.id,
      })
    }

    // Map orders to Payment
    for (const order of orders) {
      payments.push({
        id: order.id,
        type: "PRODUCT_ORDER",
        amount: order.total.toNumber(),
        status: order.status === "COMPLETED" ? "COMPLETED" : "PENDING",
        createdAt: order.createdAt,
        description: `Naročilo #${order.id.slice(-6).toUpperCase()}`,
        referenceId: order.id,
      })
    }

    // Sort by date descending
    return payments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  } catch (error) {
    console.error("Get payment history error:", error)
    return []
  }
}

// ============================================================
// GDPR — pravica do izvoza in izbrisa (točka 8)
//
// exportMyData: vrne strukturiran JSON z vsemi osebnimi podatki
// prijavljenega uporabnika (pravico do prenosljivosti, Art. 20).
//
// deleteMyAccount: anonimizira osebne podatke in izbriše prijavni
// račun (pravica do pozabe, Art. 17). Poslovne evidence (naročila,
// termini, računi) OSTANEJO — z anonimiziranim sklicem namesto
// osebnih podatkov, ker jih mora podjetje hraniti (davčni/računski
// predpisi). NIKOLI tih, vedno z geslom + potrditvijo.
// ============================================================

export type MyDataExport = {
  generatedAt: string
  user: {
    name: string | null
    email: string
    createdAt: string | null
  }
  customer: {
    email: string | null
    phone: string | null
    dateOfBirth: string | null
  } | null
  appointments: {
    id: string
    status: string
    startTime: string | null
    salonName: string | null
  }[]
  orders: {
    id: string
    status: string
    totalCents: number
    createdAt: string
  }[]
  reviews: {
    id: string
    rating: number
    comment: string
    createdAt: string
  }[]
  formSubmissions: {
    id: string
    formName: string | null
    submittedAt: string
  }[]
  prepaidPurchases: {
    id: string
    balanceObr: number
    sessionsLeft: number | null
    createdAt: string
  }[]
}

export async function exportMyData(): Promise<MyDataExport | { success: false; error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Niste prijavljeni" }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })
    if (!user) return { success: false, error: "Račun ne obstaja." }

    const customerId = user.customer?.id

    const [appointments, orders, reviews, formSubmissions, prepaidPurchases] =
      await Promise.all([
        prisma.appointment.findMany({
          where: { customerId: customerId ?? "__no_customer__" },
          orderBy: { startTime: "desc" },
          select: {
            id: true,
            status: true,
            startTime: true,
            organization: { select: { name: true } },
          },
        }),
        prisma.order.findMany({
          where: { customerId: customerId ?? "__no_customer__" },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, total: true, createdAt: true },
        }),
        prisma.review.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, rating: true, comment: true, createdAt: true },
        }),
        prisma.formSubmission.findMany({
          where: { customerId: customerId ?? "__no_customer__" },
          orderBy: { createdAt: "desc" },
          select: { id: true, formDefinition: { select: { name: true } }, createdAt: true },
        }),
        prisma.prepaidPurchase.findMany({
          where: { customerId: customerId ?? "__no_customer__" },
          orderBy: { purchasedAt: "desc" },
          select: { id: true, balance: true, sessionsLeft: true, purchasedAt: true },
        }),
      ])

    return {
      generatedAt: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      customer: user.customer
        ? {
            email: user.customer.email,
            phone: user.customer.phone,
            dateOfBirth: user.customer.dateOfBirth?.toISOString() ?? null,
          }
        : null,
      appointments: appointments.map((a) => ({
        id: a.id,
        status: a.status,
        startTime: a.startTime?.toISOString() ?? null,
        salonName: a.organization?.name ?? null,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.total.toNumber() * 100,
        createdAt: o.createdAt.toISOString(),
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),
      formSubmissions: formSubmissions.map((f) => ({
        id: f.id,
        formName: f.formDefinition?.name ?? null,
        submittedAt: f.createdAt.toISOString(),
      })),
      prepaidPurchases: prepaidPurchases.map((p) => ({
        id: p.id,
        balanceObr: p.balance.toNumber(),
        sessionsLeft: p.sessionsLeft,
        createdAt: p.purchasedAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error("GDPR export error:", error)
    return { success: false, error: "Izvoza ni bilo mogoče pripraviti." }
  }
}

export type DeleteAccountResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteMyAccount(password: string): Promise<DeleteAccountResult> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: "Niste prijavljeni." }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })
    if (!user) return { success: false, error: "Račun ne obstaja." }

    // Zahtevaj geslo (vedno), razen če uporabnik nima gesla (Google-only) —
    // tedaj zadostuje prijava sama (passkey), tako da ne zaklenemo ven.
    if (user.password) {
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) return { success: false, error: "Geslo ni pravilno." }
    }

    // Varnost podatkov: edini skrbnik aktivnega podjetja ne sme izbrisati
    // računa — organizacija bi ostala brez upravljavca (nobody could ever
    // manage it again). Prenos skrbništva ali brisanje/arhiviranje podjetja
    // je najprej.
    const adminOrgs = await prisma.organizationMember.findMany({
      where: { userId: user.id, role: "ADMIN", organization: { status: "ACTIVE" } },
      select: { organizationId: true, organization: { select: { name: true } } },
    })
    for (const m of adminOrgs) {
      const admins = await prisma.organizationMember.count({
        where: { organizationId: m.organizationId, role: "ADMIN" },
      })
      if (admins <= 1) {
        return {
          success: false,
          error: `Ste edini skrbnik podjetja "${m.organization.name}". Najprej prenesite skrbništvo na drugega člana ali podjetje arhivirajte/izbrišite.`,
        }
      }
    }

    // 1) Anonimiziraj osebne podatke stranke (poslovne evidence ostanejo).
    if (user.customer) {
      await prisma.customer.update({
        where: { id: user.customer.id },
        data: {
          name: "Anonimiziran",
          email: null,
          phone: null,
          notes: null,
          dateOfBirth: null,
          tags: [],
          userId: null, // prekinemo povezavo z (kar brišemo) odjemalčevim User
        },
      })
    }

    // 2) Izbriši prijavni račun (User + Account + Session kaskadirno).
    await prisma.user.delete({ where: { id: user.id } })

    return { success: true }
  } catch (error) {
    console.error("GDPR delete error:", error)
    return { success: false, error: "Brisanja ni bilo mogoče dokončati." }
  }
}
