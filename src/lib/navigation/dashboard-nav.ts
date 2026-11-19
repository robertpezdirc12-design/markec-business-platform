// ============================================================
// DASHBOARD NAVIGATION — en vir resnice za stranski meni IN ukazno
// paleto (⌘K). Podatki so čisti (brez ikon), da jih lahko uporablja
// tudi strežnik; ikone doda stranski meni po `href`.
//
// Audit 2026-11-18 (Fresha primerjava): 23 ravnih postavk je bilo
// neobvladljivih. Zdaj 6 skupin, enakih mentalnim modelom lastnika:
// Pregled · Prodaja · Stranke · Katalog · Dejavnost · Upravljanje.
// ============================================================

import type { CapabilityKey } from "@/lib/profiles/types"
import { hasAllPermissions, type PermissionKey } from "@/lib/permissions/roles"

export type NavSectionKey =
  | "overview"
  | "sales"
  | "clients"
  | "catalog"
  | "activity"
  | "manage"

export type NavNameKey =
  | "dashboard"
  | "analytics"
  | "appointments"
  | "waitlist"
  | "chats"
  | "walkIn"
  | "customers"
  | "users"
  | "reviews"
  | "marketing"
  | "services"
  | "products"
  | "categories"
  | "packages"
  | "promotions"
  | "shopOrders"
  | "workOrders"
  | "documents"
  | "quotes"
  | "warranties"
  | "costs"
  | "einvoices"
  | "cashRegister"
  | "payments"
  | "forms"
  | "records"
  | "projects"
  | "apiculture"
  | "tireService"
  | "traceability"
  | "seamstress"
  | "staff"
  | "roles"
  | "modules"
  | "settings"

export interface DashboardNavItem {
  nameKey: NavNameKey
  href: string
  section: NavSectionKey
  /** Capability that must not be "disabled" for this item to render. */
  capability?: CapabilityKey
  /** Item renders when ANY of these capabilities is enabled. */
  anyCapabilities?: CapabilityKey[]
  /** Item renders only when the profile enables at least one extension. */
  requiresExtensions?: boolean
  /** Item renders only when the profile enables THIS extension id. */
  extension?: string
  /** Terminology key overriding the generic dictionary label. */
  termKey?: "appointmentPlural" | "servicePlural" | "productPlural" | "orderPlural"
  /** Custom-role permission required. Absent → visible to all members. */
  permission?: PermissionKey
  /** Renders when the member holds ANY of these permissions. */
  anyPermission?: PermissionKey[]
}

/** Vrstni red skupin v meniju (in v ukazni paleti). */
export const NAV_SECTIONS: NavSectionKey[] = [
  "overview",
  "sales",
  "clients",
  "catalog",
  "activity",
  "manage",
]

export const DASHBOARD_NAV: DashboardNavItem[] = [
  // ── Pregled ────────────────────────────────────────────────
  { nameKey: "dashboard", href: "/dashboard", section: "overview" },
  {
    nameKey: "analytics",
    href: "/dashboard/analytics",
    section: "overview",
    capability: "analytics",
    permission: "analytics.view",
  },

  // ── Prodaja (denar in termini) ─────────────────────────────
  {
    nameKey: "appointments",
    href: "/dashboard/appointments",
    section: "sales",
    capability: "appointments",
    termKey: "appointmentPlural",
    permission: "appointments.view",
  },
  {
    nameKey: "waitlist",
    href: "/dashboard/waitlist",
    section: "sales",
    capability: "appointments",
    permission: "appointments.view",
  },
  {
    nameKey: "walkIn",
    href: "/dashboard/walk-in",
    section: "sales",
    capability: "walkIn",
    permission: "appointments.view",
  },
  {
    nameKey: "chats",
    href: "/dashboard/chats",
    section: "sales",
    capability: "appointments",
    permission: "appointments.view",
  },
  {
    nameKey: "cashRegister",
    href: "/dashboard/cash-register",
    section: "sales",
    capability: "cashRegister",
    permission: "orders.manage",
  },
  {
    nameKey: "payments",
    href: "/dashboard/payments",
    section: "sales",
    capability: "workOrders",
    permission: "workorders.manage",
  },
  {
    nameKey: "shopOrders",
    href: "/dashboard/orders",
    section: "sales",
    capability: "shop",
    permission: "orders.manage",
  },
  {
    nameKey: "workOrders",
    href: "/dashboard/work-orders",
    section: "sales",
    capability: "workOrders",
    termKey: "orderPlural",
    permission: "workorders.manage",
  },

  // ── Stranke ────────────────────────────────────────────────
  {
    nameKey: "customers",
    href: "/dashboard/customers",
    section: "clients",
    capability: "customers",
    permission: "customers.manage",
  },
  {
    nameKey: "users",
    href: "/dashboard/users",
    section: "clients",
    capability: "customers",
    permission: "customers.manage",
  },
  // Mnenja so bila dosegljiva samo z ročnim vpisom naslova —
  // stran je obstajala, povezave pa ni bilo nikjer (audit 2026-11-18).
  {
    nameKey: "reviews",
    href: "/dashboard/reviews",
    section: "clients",
    capability: "reviews",
    permission: "customers.manage",
  },
  {
    nameKey: "marketing",
    href: "/dashboard/marketing",
    section: "clients",
    capability: "customers",
    permission: "customers.manage",
  },
  {
    nameKey: "forms",
    href: "/dashboard/forms",
    section: "clients",
    capability: "forms",
    permission: "inquiries.manage",
  },

  // ── Katalog ────────────────────────────────────────────────
  {
    nameKey: "services",
    href: "/dashboard/services",
    section: "catalog",
    capability: "services",
    termKey: "servicePlural",
    permission: "services.manage",
  },
  {
    nameKey: "products",
    href: "/dashboard/products",
    section: "catalog",
    capability: "shop",
    termKey: "productPlural",
    permission: "products.manage",
  },
  {
    nameKey: "categories",
    href: "/dashboard/categories",
    section: "catalog",
    anyCapabilities: ["shop", "services"],
    anyPermission: ["products.manage", "services.manage"],
  },
  {
    nameKey: "packages",
    href: "/dashboard/packages",
    section: "catalog",
    anyCapabilities: ["shop", "services"],
    permission: "products.manage",
  },
  {
    nameKey: "promotions",
    href: "/dashboard/promotions",
    section: "catalog",
    anyCapabilities: ["shop", "services"],
    permission: "promotions.manage",
  },
  {
    nameKey: "documents",
    href: "/dashboard/documents",
    section: "catalog",
    capability: "documents",
    permission: "finances.view",
  },
  {
    nameKey: "quotes",
    href: "/dashboard/quotes",
    permission: "finances.view",
    section: "manage",
  },
  {
    nameKey: "warranties",
    href: "/dashboard/warranties",
    permission: "finances.view",
    section: "manage",
  },
  {
    nameKey: "costs",
    href: "/dashboard/costs",
    permission: "finances.view",
    section: "manage",
  },

  // ── Dejavnost (vertikalno specifično) ──────────────────────
  {
    nameKey: "seamstress",
    href: "/dashboard/seamstress",
    section: "activity",
    extension: "seamstress-measurements",
    permission: "workorders.manage",
  },
  {
    nameKey: "tireService",
    href: "/dashboard/tire-service",
    section: "activity",
    extension: "vehicle-workshop",
    permission: "workorders.manage",
  },
  {
    nameKey: "apiculture",
    href: "/dashboard/apiculture",
    section: "activity",
    extension: "bee-apiary",
    permission: "workorders.manage",
  },
  {
    nameKey: "traceability",
    href: "/dashboard/traceability",
    section: "activity",
    extension: "batch-production",
    permission: "products.manage",
  },
  {
    nameKey: "projects",
    href: "/dashboard/projects",
    section: "activity",
    extension: "projects",
    permission: "workorders.manage",
  },
  {
    nameKey: "records",
    href: "/dashboard/records",
    section: "activity",
    requiresExtensions: true,
    permission: "workorders.manage",
  },

  // ── Upravljanje ────────────────────────────────────────────
  {
    nameKey: "staff",
    href: "/dashboard/staff",
    section: "manage",
    capability: "staff",
    permission: "staff.manage",
  },
  // Custom roles (G8) — admin-only
  { nameKey: "roles", href: "/dashboard/roles", section: "manage" },
  // VSTOPNA IZKUŠNJA (2026-11): "Moduli" je stalna vstopna točka v grid
  // (po vstopu z Google se uporabnik tja preusmeri z ?welcome=1, a jo
  // lahko kadarkoli ponovno odpre iz menija).
  { nameKey: "modules", href: "/dashboard/setup", section: "manage" },
  {
    nameKey: "einvoices",
    href: "/dashboard/einvoices",
    section: "manage",
    permission: "finances.view",
  },
  {
    nameKey: "settings",
    href: "/dashboard/settings",
    section: "manage",
    permission: "settings.manage",
  },
]

export interface NavVisibilityContext {
  capabilities: Record<string, string>
  extensions: string[]
  permissions: readonly string[]
  isAdmin: boolean
}

/**
 * Capability-gated navigation (EPIC #1 §21): irrelevant modules never render.
 * G8: items may additionally require a custom-role permission; "roles" is
 * admin-only. Members WITHOUT a custom role hold the full legacy set, so
 * their chrome is unchanged.
 */
export function isNavItemVisible(
  item: DashboardNavItem,
  ctx: NavVisibilityContext
): boolean {
  if (item.nameKey === "roles") {
    if (!ctx.isAdmin) return false
    if (!hasAllPermissions(ctx.permissions as PermissionKey[])) return false
  }
  if (item.permission && !ctx.permissions.includes(item.permission)) return false
  if (
    item.anyPermission?.length &&
    !item.anyPermission.some((k) => ctx.permissions.includes(k))
  ) {
    return false
  }
  if (item.extension) return ctx.extensions.includes(item.extension)
  if (item.requiresExtensions) return ctx.extensions.length > 0
  if (item.anyCapabilities?.length) {
    return item.anyCapabilities.some((cap) => ctx.capabilities[cap] !== "disabled")
  }
  if (!item.capability) return true
  return ctx.capabilities[item.capability] !== "disabled"
}

/** Ali je ta postavka aktivna za trenutno pot. */
export function isNavItemActive(item: DashboardNavItem, pathname: string): boolean {
  return (
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )
}
