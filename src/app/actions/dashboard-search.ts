"use server"

// ============================================================
// ⌘K — globalno iskanje po nadzorni plošči.
//
// Ena poizvedba na tip entitete, org-scoped in fail-closed (brez
// organizationId v where pogoju ne gremo nikamor). Vrača SAMO tisto,
// kar paleta potrebuje: naslov, podnaslov in cilj.
//
// Pravice: iskanje je vezano na isto pravico, kot jo ima stran, na
// katero rezultat vodi — brez te pravice rezultat ni vrnjen (sicer bi
// paleta razkrila obstoj podatkov, ki jih član ne sme videti).
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireSession, resolveSessionOrganization } from "@/lib/auth/guards"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import type { PermissionKey } from "@/lib/permissions/roles"

export interface SearchHit {
  id: string
  title: string
  subtitle: string | null
  href: string
  kind: "customer" | "service" | "product" | "appointment"
}

export type SearchResults = Record<SearchHit["kind"], SearchHit[]>

const EMPTY: SearchResults = {
  customer: [],
  service: [],
  product: [],
  appointment: [],
}

const LIMIT = 5

function money(value: unknown): string {
  const n =
    typeof value === "number"
      ? value
      : value && typeof value === "object" && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value ?? 0)
  return `${n.toFixed(2).replace(".", ",")} €`
}

export async function searchDashboard(rawQuery: string): Promise<SearchResults> {
  const query = (rawQuery ?? "").trim()
  if (query.length < 2) return EMPTY

  const session = await requireSession()
  const org = await resolveSessionOrganization(session)
  if (!org) return EMPTY
  const permissions: PermissionKey[] = await getEffectivePermissions(
    session.user.id,
    org.id
  )
  const can = (key: PermissionKey) => permissions.includes(key)

  const term = query.toLowerCase()
  const contains = { contains: term, mode: "insensitive" as const }

  const tasks: Promise<void>[] = []
  const out: SearchResults = { customer: [], service: [], product: [], appointment: [] }

  if (can("customers.manage")) {
    tasks.push(
      prisma.customer
        .findMany({
          where: {
            organizationId: org.id,
            isArchived: false,
            OR: [
              { name: contains },
              { email: contains },
              { phone: contains },
            ],
          },
          select: { id: true, name: true, email: true, phone: true },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
        })
        .then((rows) => {
          out.customer = rows.map((c) => ({
            id: c.id,
            title: c.name,
            subtitle: c.phone || c.email || null,
            href: `/dashboard/customers?q=${encodeURIComponent(c.name)}`,
            kind: "customer",
          }))
        })
    )
  }

  if (can("services.manage")) {
    tasks.push(
      prisma.service
        .findMany({
          where: {
            organizationId: org.id,
            isActive: true,
            name: contains,
          },
          select: { id: true, name: true, duration: true, price: true },
          orderBy: { name: "asc" },
          take: LIMIT,
        })
        .then((rows) => {
          out.service = rows.map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `${s.duration} min · ${money(s.price)}`,
            href: `/dashboard/services?q=${encodeURIComponent(s.name)}`,
            kind: "service",
          }))
        })
    )
  }

  if (can("products.manage")) {
    tasks.push(
      prisma.product
        .findMany({
          where: {
            organizationId: org.id,
            isActive: true,
            OR: [{ name: contains }, { sku: contains }],
          },
          select: { id: true, name: true, sku: true, stockQuantity: true },
          orderBy: { name: "asc" },
          take: LIMIT,
        })
        .then((rows) => {
          out.product = rows.map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: p.sku ? `${p.sku} · ${p.stockQuantity} na zalogi` : `${p.stockQuantity} na zalogi`,
            href: `/dashboard/products?q=${encodeURIComponent(p.name)}`,
            kind: "product",
          }))
        })
    )
  }

  if (can("appointments.view")) {
    tasks.push(
      prisma.appointment
        .findMany({
          where: {
            organizationId: org.id,
            OR: [
              { guestName: contains },
              { guestPhone: contains },
              { guestEmail: contains },
              { customer: { name: contains } },
              { customer: { phone: contains } },
              { customer: { email: contains } },
            ],
          },
          select: {
            id: true,
            guestName: true,
            startTime: true,
            status: true,
            customer: { select: { name: true } },
          },
          orderBy: { startTime: "desc" },
          take: LIMIT,
        })
        .then((rows) => {
          out.appointment = rows.map((a) => ({
            id: a.id,
            title: a.customer?.name || a.guestName || "Termin",
            subtitle: new Intl.DateTimeFormat("sl-SI", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(a.startTime),
            href: "/dashboard/appointments",
            kind: "appointment",
          }))
        })
    )
  }

  await Promise.all(tasks)
  return out
}
