"use server"

// ============================================================
// F5.5.3.1 — UPRAVLJANJE STRANK (»Moje stranke«).
//
// Org-scoped, IDOR-varno; vse akcije prek requireCustomerPermission
// (ADMIN ali STAFF z `customers.manage` in aktivnim članstvom) +
// `where { id, organizationId }` (fail-closed).
//  - ročno dodajanje/urejanje/arhiviranje,
//  - enoten seznam z iskanjem in filtri,
//  - podrobnosti stranke z zgodovino vseh poslovnih relacij,
//  - povezovanje walk-in vstopov,
//  - GDPR izvoz in anonimizacija (ne briše računov/rezervacij/dokumentov).
//
// Identity-politika: enoten `lib/customers/identity.ts` — e-pošta =
// identifikator (samo varna politika), telefon sam ni dovolj, brez
// samodejnega spajanja po imenu.
// ============================================================

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireCustomerPermission } from "@/lib/auth/guards"
import {
  normalizeEmail,
  pickIdentityMatch,
} from "@/lib/customers/identity"
import { sanitizeCustomerTags } from "@/lib/customers/tags"

// ---- Seznam (enoten »Moje stranke«) ----

/** Lahit seznam strank za izbirnike (ime/e-pošta/telefon), org-scoped. */
export async function getCustomers(): Promise<{ id: string; name: string; email: string | null; phone: string | null }[]> {
  const { org } = await requireCustomerPermission()
  return prisma.customer.findMany({
    where: { organizationId: org.id, isArchived: false },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { createdAt: "desc" },
  })
}

export interface CustomerListOptions {
  search?: string
  tag?: string
  archived?: boolean // privzeto false (aktivne)
  withUser?: "registered" | "leads" | "all"
}

export interface CustomerListItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  tags: string[]
  dateOfBirth: Date | null
  // P2-D: izrecna privolitev za marketing (GDPR opt-in), berljiva v UI.
  marketingConsent: boolean
  isArchived: boolean
  archivedAt: Date | null
  userId: string | null
  createdAt: Date
  totalSpent: number
  _count: {
    appointments: number
    orders: number
    workOrders: number
    formSubmissions: number
  }
}

export async function listCustomers(opts: CustomerListOptions = {}): Promise<CustomerListItem[]> {
  const { org } = await requireCustomerPermission()

  const search = opts.search?.trim()
  const tag = opts.tag?.trim()
  const archivedOnly = opts.archived === true

  // Išči po imenu/e-pošti/telefonu; filtriraj arhiv in segment (oznaka).
  const where = {
    organizationId: org.id,
    isArchived: archivedOnly,
    ...(tag ? { tags: { has: tag } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
          ],
        }
      : {}),
    ...(opts.withUser === "registered" ? { user: { isNot: null } } : {}),
    ...(opts.withUser === "leads" ? { user: null } : {}),
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      user: { select: { id: true, email: true } },
      _count: {
        select: { appointments: true, orders: true, workOrders: true, formSubmissions: true },
      },
    },
    orderBy: { name: "asc" },
  })

  // Skupna poraba (samo COMPLETED termini + PAID/COMPLETED naročila).
  // PERFORMANCE: ena agregacija na vir za VSE stranke; prejšnja koda je
  // izvajala 2 poizvedbi NA STRANKO (N+1) — pri več tisoč strankah je
  // seznam postal neuporabno počasen.
  const customerIds = customers.map((c) => c.id)
  const apptSums = customerIds.length
    ? await prisma.appointment.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          organizationId: org.id,
          status: "COMPLETED",
        },
        _sum: { totalPrice: true },
      })
    : []
  const orderSums = customerIds.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          organizationId: org.id,
          status: { in: ["PAID", "COMPLETED"] },
        },
        _sum: { total: true },
      })
    : []
  const apptSumByCustomer = new Map(
    apptSums.map((r) => [r.customerId, r._sum.totalPrice?.toNumber() ?? 0])
  )
  const orderSumByCustomer = new Map(
    orderSums.map((r) => [r.customerId, r._sum.total?.toNumber() ?? 0])
  )

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    tags: c.tags,
    dateOfBirth: c.dateOfBirth,
    marketingConsent: c.marketingConsent,
    isArchived: c.isArchived,
    archivedAt: c.archivedAt,
    userId: c.userId,
    createdAt: c.createdAt,
    totalSpent: (apptSumByCustomer.get(c.id) ?? 0) + (orderSumByCustomer.get(c.id) ?? 0),
    _count: {
      appointments: c._count.appointments,
      orders: c._count.orders,
      workOrders: c._count.workOrders,
      formSubmissions: c._count.formSubmissions,
    },
  }))
}

// ---- Ročno dodajanje ----

export interface CustomerInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  tags?: string[]
  dateOfBirth?: string | null // YYYY-MM-DD
  // P2-D: izrecna privolitev za marketing (GDPR opt-in).
  marketingConsent?: boolean
}

export type CustomerResult = { ok: true; id: string } | { ok: false; error: string; id?: undefined }

/** Preveri, da e-pošta, če je podana, ni v rabi pri DRUGI stranki iste org. */
async function emailTaken(orgId: string, email: string | null | undefined, excludeId?: string): Promise<boolean> {
  if (!email) return false
  const norm = normalizeEmail(email)
  const dup = await prisma.customer.findFirst({
    where: { organizationId: orgId, email: { equals: norm, mode: "insensitive" } },
    select: { id: true },
  })
  if (!dup) return false
  return excludeId ? dup.id !== excludeId : true
}

export async function createCustomer(input: CustomerInput): Promise<CustomerResult> {
  const { org } = await requireCustomerPermission()
  const name = input.name?.trim()
  if (!name) return { ok: false, error: "MISSING_NAME" }

  const email = input.email?.trim().toLowerCase() || null
  const phone = input.phone?.trim() || null

  // Identity-politika: ne tiho spajaj. Če kontakt varno ustreza obstoječi
  // stranki (e-pošta ali telefon+ime), NOČEMO dvojnika — vrni napako, da
  // lastnik izbere obstoječo stranko ali uredi podatke.
  if (email || phone) {
    const candidates = await prisma.customer.findMany({
      where: {
        organizationId: org.id,
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone: { equals: phone } }] : []),
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 20,
    })
    const match = pickIdentityMatch(candidates, { name, email, phone })
    if (match) {
      return {
        ok: false,
        error: "DUPLICATE_CUSTOMER",
      }
    }
    // E-pošta že pri drugi stranki (ne po isti politiki ujemanja, ker ime
    // ni bilo zahtevano) — prepreči podvojen e-poštni naslov.
    const dup = await prisma.customer.findFirst({
      where: { organizationId: org.id, email: { equals: email, mode: "insensitive" as const } },
      select: { id: true },
    })
    if (dup) return { ok: false, error: "DUPLICATE_EMAIL" }
  }

  let dob: Date | null = null
  if (input.dateOfBirth) {
    const parsed = new Date(input.dateOfBirth)
    if (!Number.isNaN(parsed.getTime())) dob = parsed
  }

  const created = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name,
      email,
      phone,
      notes: input.notes?.trim() || null,
      tags: sanitizeCustomerTags(input.tags),
      dateOfBirth: dob,
      // P2-D: izrecna privolitev za marketing ob vpisu (GDPR opt-in).
      ...(input.marketingConsent !== undefined
        ? {
            marketingConsent: input.marketingConsent,
            marketingConsentedAt: input.marketingConsent ? new Date() : null,
          }
        : {}),
    },
    select: { id: true },
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/customers")
  return { ok: true, id: created.id }
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<CustomerResult> {
  const { org } = await requireCustomerPermission()
  const existing = await prisma.customer.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  if (input.name !== undefined && !input.name.trim()) return { ok: false, error: "MISSING_NAME" }

  const email = input.email !== undefined ? input.email?.trim().toLowerCase() || null : undefined
  const phone = input.phone !== undefined ? input.phone?.trim() || null : undefined

  if (email !== undefined && email) {
    const taken = await emailTaken(org.id, email, id)
    if (taken) return { ok: false, error: "DUPLICATE_EMAIL" }
  }

  let dob: Date | null | undefined = undefined
  if (input.dateOfBirth !== undefined) {
    dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null
    if (dob && Number.isNaN(dob.getTime())) dob = null
  }

  await prisma.customer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.tags !== undefined ? { tags: sanitizeCustomerTags(input.tags) } : {}),
      ...(dob !== undefined ? { dateOfBirth: dob } : {}),
      ...(input.marketingConsent !== undefined
        ? {
            marketingConsent: input.marketingConsent,
            marketingConsentedAt: input.marketingConsent ? new Date() : null,
          }
        : {}),
    },
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/customers")
  revalidatePath(`/dashboard/customers/${id}`)
  return { ok: true, id }
}

// ---- Arhiviranje ----

export async function setCustomerArchived(id: string, archived: boolean): Promise<CustomerResult> {
  const { org } = await requireCustomerPermission()
  const existing = await prisma.customer.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }
  await prisma.customer.update({
    where: { id },
    data: { isArchived: archived, archivedAt: archived ? new Date() : null },
  })
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/customers")
  revalidatePath(`/dashboard/customers/${id}`)
  return { ok: true, id }
}

export async function archiveCustomer(id: string): Promise<CustomerResult> {
  return setCustomerArchived(id, true)
}

export async function unarchiveCustomer(id: string): Promise<CustomerResult> {
  return setCustomerArchived(id, false)
}

// ---- Podrobnosti stranke + zgodovina ----

export interface CustomerDetail extends CustomerListItem {
  userId: string | null
  userEmail: string | null
  appointments: {
    id: string
    startTime: Date
    status: string
    totalPrice: number
    services: { name: string }[]
  }[]
  orders: {
    id: string
    status: string
    total: number
    createdAt: Date
    items: { id: string; name: string; quantity: number; unitPrice: number }[]
  }[]
  documents: { id: string; type: string; number: number; status: string; total: number; createdAt: Date }[]
  workOrders: { id: string; number: number; title: string; status: string; createdAt: Date }[]
  projects: { id: string; name: string; status: string; deadline: Date | null }[]
  walkInEntries: { id: string; ticketCode: string; name: string; phone: string | null; status: string; createdAt: Date }[]
  formSubmissions: { id: string; status: string; createdAt: Date }[]
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const { org } = await requireCustomerPermission()
  const c = await prisma.customer.findFirst({
    where: { id, organizationId: org.id },
    include: {
      user: { select: { id: true, email: true } },
      appointments: {
        where: { organizationId: org.id },
        include: { services: { include: { service: { select: { name: true } } } } },
        orderBy: { startTime: "desc" },
        take: 50,
      },
      orders: {
        where: { organizationId: org.id },
        include: { items: { include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      documents: {
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      workOrders: {
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      projects: {
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      walkInEntries: {
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      formSubmissions: {
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })
  if (!c) return null

  const [apptSum, ordSum] = await Promise.all([
    prisma.appointment.aggregate({
      where: { customerId: c.id, organizationId: org.id, status: "COMPLETED" },
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: { customerId: c.id, organizationId: org.id, status: { in: ["PAID", "COMPLETED"] } },
      _sum: { total: true },
    }),
  ])
  const totalSpent = (apptSum._sum.totalPrice?.toNumber() ?? 0) + (ordSum._sum.total?.toNumber?.() ?? 0)

  return {
    ...c,
    totalSpent,
    _count: {
      appointments: c.appointments.length,
      orders: c.orders.length,
      workOrders: c.workOrders.length,
      formSubmissions: c.formSubmissions.length,
    },
    userId: c.userId,
    userEmail: c.user?.email ?? null,
    appointments: c.appointments.map((a) => ({
      id: a.id,
      startTime: a.startTime,
      status: a.status,
      totalPrice: a.totalPrice.toNumber(),
      services: a.services.map((s) => ({ name: s.service?.name ?? "—" })),
    })),
    orders: c.orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total.toNumber(),
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        id: i.id,
        name: i.product?.name ?? "—",
        quantity: i.quantity,
        unitPrice: i.price.toNumber(),
      })),
    })),
    documents: c.documents.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      status: d.status,
      total: d.total.toNumber(),
      createdAt: d.createdAt,
    })),
    workOrders: c.workOrders.map((w) => ({
      id: w.id,
      number: w.number,
      title: w.title,
      status: w.status,
      createdAt: w.createdAt,
    })),
    projects: c.projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      deadline: p.deadline,
    })),
    walkInEntries: c.walkInEntries.map((w) => ({
      id: w.id,
      ticketCode: w.ticketCode,
      name: w.name,
      phone: w.phone,
      status: w.status,
      createdAt: w.createdAt,
    })),
    formSubmissions: c.formSubmissions.map((f) => ({ id: f.id, status: f.status, createdAt: f.createdAt })),
  }
}

// ---- Walk-in povezava ----

export async function linkWalkInCustomer(entryId: string, customerId: string): Promise<CustomerResult> {
  const { org } = await requireCustomerPermission()
  const entry = await prisma.walkInEntry.findFirst({ where: { id: entryId, organizationId: org.id }, select: { id: true } })
  if (!entry) return { ok: false, error: "NOT_FOUND_ENTRY" }
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId: org.id }, select: { id: true } })
  if (!customer) return { ok: false, error: "NOT_FOUND_CUSTOMER" }
  await prisma.walkInEntry.update({ where: { id: entryId }, data: { customerId } })
  revalidatePath("/dashboard/walk-in")
  revalidatePath(`/dashboard/customers/${customerId}`)
  return { ok: true, id: entryId }
}

export async function getWalkInCustomers(orgId: string): Promise<{ id: string; name: string; email: string | null; phone: string | null }[]> {
  // Org-scoped read za povezovanje walk-in vstopa prijavljenega uporabnika.
  const { org } = await requireCustomerPermission()
  void orgId
  const rows = await prisma.customer.findMany({
    where: { organizationId: org.id, isArchived: false },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take: 300,
  })
  return rows
}

// ---- Opombe (deluje tudi za stranke brez uporabniškega računa) ----

/**
 * F5.5.3.1 — opombe po `customerId` (ne `userId`), tako da delujejo tudi
 * za leads (Customer brez uporabniškega računa). Org-scoped, IDOR-varno.
 */
export async function updateCustomerNotesByCustomerId(
  customerId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org } = await requireCustomerPermission()
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) return { success: false, error: "Stranka ni najdena ali ni vaša." }
    await prisma.customer.update({ where: { id: customerId }, data: { notes: notes?.trim() || null } })
    revalidatePath("/dashboard/users")
    revalidatePath("/dashboard/customers")
    revalidatePath(`/dashboard/customers/${customerId}`)
    return { success: true }
  } catch (error) {
    console.error("updateCustomerNotesByCustomerId failed:", error)
    return { success: false, error: "Shranjevanje opomb ni uspelo." }
  }
}

// ---- GDPR ----

/** Izvoz vseh osebnih podatkov stranke (JSON) — za zahtevo posameznika. */
export async function exportCustomerData(id: string): Promise<
  { ok: true; data: CustomerDetail } | { ok: false; error: string }
> {
  const detail = await getCustomerDetail(id)
  if (!detail) return { ok: false, error: "NOT_FOUND" }
  return { ok: true, data: detail }
}

/**
 * GDPR brisanje/anonimizacija (pravico do pozabe ob upoštevanju zakonske
 * hrambe). NIKOLI ne briše računov, rezervacij, naročil ali dokumentov —
 * obdrži org-scoped zgodovino, odstrani le osebne podatke in označi
 * arhiviranje. Objavljeni in regulacijski zapisi ostanejo (zahtevana
 * hramba), a anonimizirani.
 */
export async function anonymizeCustomer(id: string): Promise<CustomerResult> {
  const { org } = await requireCustomerPermission()
  const existing = await prisma.customer.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  await prisma.customer.update({
    where: { id },
    data: {
      name: "Anonimizirana stranka",
      email: null,
      phone: null,
      dateOfBirth: null,
      notes: "Anonimizirano po zahtevi za zasebnost (GDPR).",
      isArchived: true,
      archivedAt: new Date(),
      tags: [],
    },
  })
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard/customers")
  return { ok: true, id }
}

// ---- Secure download (izvoz) — ni javni poti; return JSON v procesu akcije.