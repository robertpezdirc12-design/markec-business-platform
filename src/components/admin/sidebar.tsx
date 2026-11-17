"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { switchActiveOrganization } from "@/app/actions/organization-switch"
import { useI18n } from "@/lib/i18n/provider"
import type { CapabilityKey } from "@/lib/profiles/types"
import {
  LayoutDashboardIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  EnvelopeIcon,
  ScissorsIcon,
  PackageIcon,
  ToteIcon,
  TagIcon,
  ShoppingBagIcon,
  ReceiptIcon,
  FileTextIcon,
  SlidersIcon,
  StackIcon,
  UserCogIcon,
  SettingsIcon,
  CloseIcon,
  FolderIcon,
  LockIcon,
  HouseIcon,
  WrenchIcon,
  WalletIcon,
} from "@/components/icons"
import { usePermissions } from "@/components/admin/permissions-provider"
import type { PermissionKey } from "@/lib/permissions/roles"

interface NavItem {
  nameKey: "dashboard" | "analytics" | "appointments" | "waitlist" | "walkIn" | "customers" | "marketing" | "services" | "products" | "categories" | "packages" | "promotions" | "shopOrders" | "workOrders" | "documents" | "einvoices" | "cashRegister" | "payments" | "forms" | "records" | "projects" | "apiculture" | "tireService" | "traceability" | "seamstress" | "staff" | "roles" | "settings"
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Capability that must not be "disabled" for this item to render. */
  capability?: CapabilityKey
  /** Item renders when ANY of these capabilities is enabled (§11: packages combine services AND products). */
  anyCapabilities?: CapabilityKey[]
  /** Item renders only when the profile enables at least one extension with entities (§13). */
  requiresExtensions?: boolean
  /** Item renders only when the profile enables THIS extension id (E2-3: projects). */
  extension?: string
  /** Terminology key overriding the generic dictionary label. */
  termKey?: "appointmentPlural" | "servicePlural" | "productPlural" | "orderPlural"
  /** Custom-role permission required (G8). Absent → visible to all members. */
  permission?: PermissionKey
  /** F5.2: zadostuje KATERIKOLI od navedenih ključev (kategorije: products.manage ALI services.manage). */
  anyPermission?: PermissionKey[]
  /** F7.2: logična skupina — "common" (skupne, A) ali "activity" (dejavnost, B). */
  group?: "common" | "activity"
}

const navigation: NavItem[] = [
  // ===== A: SKUPNE POSLOVNE FUNKCIJE ===== (neodvisne od aktivne dejavnosti)
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon, group: "common" },
  { nameKey: "analytics", href: "/dashboard/analytics", icon: ChartBarIcon, capability: "analytics", permission: "analytics.view", group: "common" },
  { nameKey: "customers", href: "/dashboard/customers", icon: UsersIcon, capability: "customers", permission: "customers.manage", group: "common" },
  { nameKey: "marketing", href: "/dashboard/marketing", icon: EnvelopeIcon, capability: "customers", permission: "customers.manage", group: "common" },
  // Documents (quotes/invoices) — gated by the documents capability (§13)
  { nameKey: "documents", href: "/dashboard/documents", icon: FileTextIcon, capability: "documents", permission: "finances.view", group: "common" },
  // F5.5.4.6.2 — e-računi (priprava/validacija/arhiv)
  { nameKey: "einvoices", href: "/dashboard/einvoices", icon: ReceiptIcon, permission: "finances.view", group: "common" },
  // WP-1 (Blagajna) — eno jedro za VSE dejavnosti (capability cashRegister),
  // skupna poslovna funkcija (neodvisna od aktivne dejavnosti). Pravica:
  // orders.manage (prodaje so naročila — ista denarna pot kot neposredna prodaja).
  { nameKey: "cashRegister", href: "/dashboard/cash-register", icon: WalletIcon, capability: "cashRegister", permission: "orders.manage", group: "common" },
  // PREDRAČUN → STRANKA (2026-11-18): pregled neplačanih naročil
  // (dolžniki) — denar je na naročilih, zato ista pravica kot zanje.
  { nameKey: "payments", href: "/dashboard/payments", icon: ReceiptIcon, capability: "workOrders", permission: "workorders.manage", group: "common" },
  { nameKey: "staff", href: "/dashboard/staff", icon: UserCogIcon, capability: "staff", permission: "staff.manage", group: "common" },
  // Custom roles (G8) — admin-only
  { nameKey: "roles", href: "/dashboard/roles", icon: LockIcon, group: "common" },
  { nameKey: "settings", href: "/dashboard/settings", icon: SettingsIcon, permission: "settings.manage", group: "common" },

  // ===== B: FUNKCIJE AKTIVNE DEJAVNOSTI (capability/extension gated) =====
  { nameKey: "appointments", href: "/dashboard/appointments", icon: CalendarIcon, capability: "appointments", termKey: "appointmentPlural", permission: "appointments.view", group: "activity" },
  { nameKey: "waitlist", href: "/dashboard/waitlist", icon: ClockIcon, capability: "appointments", permission: "appointments.view", group: "activity" },
  { nameKey: "walkIn", href: "/dashboard/walk-in", icon: UsersIcon, capability: "walkIn", permission: "appointments.view", group: "activity" },
  { nameKey: "services", href: "/dashboard/services", icon: ScissorsIcon, capability: "services", termKey: "servicePlural", permission: "services.manage", group: "activity" },
  { nameKey: "products", href: "/dashboard/products", icon: PackageIcon, capability: "shop", termKey: "productPlural", permission: "products.manage", group: "activity" },
  { nameKey: "categories", href: "/dashboard/categories", icon: FolderIcon, anyCapabilities: ["shop", "services"], anyPermission: ["products.manage", "services.manage"], group: "activity" },
  { nameKey: "packages", href: "/dashboard/packages", icon: ToteIcon, anyCapabilities: ["shop", "services"], permission: "products.manage", group: "activity" },
  { nameKey: "promotions", href: "/dashboard/promotions", icon: TagIcon, anyCapabilities: ["shop", "services"], permission: "promotions.manage", group: "activity" },
  { nameKey: "workOrders", href: "/dashboard/work-orders", icon: ReceiptIcon, capability: "workOrders", termKey: "orderPlural", permission: "workorders.manage", group: "activity" },
  { nameKey: "shopOrders", href: "/dashboard/orders", icon: ShoppingBagIcon, capability: "shop", permission: "orders.manage", group: "activity" },
  { nameKey: "forms", href: "/dashboard/forms", icon: SlidersIcon, capability: "forms", permission: "inquiries.manage", group: "activity" },
  { nameKey: "records", href: "/dashboard/records", icon: StackIcon, requiresExtensions: true, permission: "workorders.manage", group: "activity" },
  // N1 — čebelarska nadzorna plošča (Z1): prikaže se SAMO profilom z
  // razširitvijo bee-apiary (čebelar). Vodi na živo pregledno ploščo.
  { nameKey: "apiculture", href: "/dashboard/apiculture", icon: HouseIcon, extension: "bee-apiary", permission: "workorders.manage", group: "activity" },
  // 2D-1P — sledljivost pridelka (pridelek → serija → zaloga → prodaja → izvor).
  { nameKey: "traceability", href: "/dashboard/traceability", icon: StackIcon, extension: "batch-production", permission: "products.manage", group: "activity" },
  // 2D-1S — delavnica vozil & vulkanizerija (tire-service): živa plošča.
  { nameKey: "tireService", href: "/dashboard/tire-service", icon: WrenchIcon, extension: "vehicle-workshop", permission: "workorders.manage", group: "activity" },
  // 2D-2B — šiviljstvo (seamstress): živa plošča, gated na merilno razširitev.
  { nameKey: "seamstress", href: "/dashboard/seamstress", icon: ScissorsIcon, extension: "seamstress-measurements", permission: "workorders.manage", group: "activity" },
  { nameKey: "projects", href: "/dashboard/projects", icon: FolderIcon, extension: "projects", permission: "workorders.manage", group: "activity" },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { t, term, profile } = useI18n()
  const { permissions, isAdmin } = usePermissions()

  // Capability-gated navigation (EPIC #1 §21): irrelevant modules never render.
  // G8: items may additionally require a custom-role permission; the
  // "roles" item is admin-only. Members WITHOUT a custom role hold the
  // full legacy set (see effectivePermissionKeys), so their chrome is
  // byte-for-byte unchanged.
  const itemVisible = (item: NavItem) => {
    if (item.nameKey === "roles" && !isAdmin) return false
    if (item.permission && !permissions.includes(item.permission)) {
      return false
    }
    if (item.anyPermission?.length && !item.anyPermission.some((k) => permissions.includes(k))) {
      return false
    }
    if (item.extension) {
      return profile.extensions.includes(item.extension)
    }
    if (item.requiresExtensions) {
      return profile.extensions.length > 0
    }
    if (item.anyCapabilities?.length) {
      return item.anyCapabilities.some(
        (cap) => profile.capabilities[cap] !== "disabled"
      )
    }
    if (!item.capability) return true
    return profile.capabilities[item.capability] !== "disabled"
  }

  // F7.2: dve jasno ločeni skupini — A Skupne poslovne funkcije, B Dejavnost.
  const commonItems = navigation.filter(
    (item) => item.group === "common" && itemVisible(item)
  )
  const activityItems = navigation.filter(
    (item) => item.group !== "common" && itemVisible(item)
  )

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href))
    const IconComponent = item.icon
    const label = item.termKey ? term(item.termKey) : t.common.nav[item.nameKey]
    return (
      <Link
        key={item.nameKey}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <IconComponent size={18} className={cn(isActive && "text-primary-foreground")} />
        {label}
      </Link>
    )
  }

  return (
    <nav aria-label="Glavna navigacija" className="space-y-1 px-3">
      {/* A: SKUPNE POSLOVNE FUNKCIJE */}
      {commonItems.length > 0 && (
        <div>
          <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Skupno
          </p>
          {commonItems.map(renderItem)}
        </div>
      )}
      {/* B: FUNKCIJE AKTIVNE DEJAVNOSTI */}
      {activityItems.length > 0 && (
        <div className="mt-1">
          <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Dejavnost
          </p>
          {activityItems.map(renderItem)}
        </div>
      )}
    </nav>
  )
}

// #100 8.A (M3): preklop med podjetji na računu (viden samo pri >1).
function OrgSwitcher({
  organizations,
  currentOrganizationId,
  onPicked,
}: {
  organizations: { id: string; name: string }[]
  currentOrganizationId: string | null
  /** F2.0: close the mobile Sheet after a pick (desktop passes nothing). */
  onPicked?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const current = organizations.find((o) => o.id === currentOrganizationId)

  function pick(id: string) {
    if (id === currentOrganizationId) {
      setOpen(false)
      onPicked?.()
      return
    }
    setOpen(false)
    startTransition(async () => {
      const res = await switchActiveOrganization(id)
      if (!res.success) {
        toast.error(res.error ?? "Preklop ni uspel.")
        return
      }
      onPicked?.()
      // NOTE: do NOT call router.refresh() after router.push() — it runs
      // synchronously and cancels the pending navigation (same bug fixed in
      // login-form / workspace-picker). switchActiveOrganization already
      // revalidated the layout, so /dashboard re-reads the new org on the
      // client-side navigation.
      router.push("/dashboard")
      // F7.2 (F7.1 open issue): klient-nav ne prerenderira server-side layouta
      // z revalidiranimi podatki (ime okolja, dejavnost, navigacija) sam —
      // zato naredimo en deferred refresh v naslednjem makrokoraku, da se
      // sidebar/header sveža navigacija takoj (brez ročnega F5/osvežitve).
      setTimeout(() => router.refresh(), 0)
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 truncate font-medium">
          {current?.name ?? organizations[0]?.name}
        </span>
        <ChevronDown size={14} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Podjetja na računu"
          className="bg-card absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
        >
          {organizations.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === currentOrganizationId}
                disabled={pending}
                onClick={() => pick(o.id)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50",
                  o.id === currentOrganizationId && "bg-primary/5 font-medium"
                )}
              >
                <span className="min-w-0 truncate">{o.name}</span>
                {o.id === currentOrganizationId && (
                  <span className="text-primary-text text-xs">aktiven</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminSidebar({
  organizations,
  currentOrganizationId,
  currentOrgName,
  currentVerticalLabel,
}: {
  /**
   * #100 8.A (M3): podjetja na tem računu (članstva) — preklop se pokaže
   * samo ko jih je več kot eno; eno podjetje = ničesar za preklopiti.
   */
  organizations?: { id: string; name: string }[]
  currentOrganizationId?: string | null
  /** F7.1 K2: ime aktivnega okolja + naziv dejavnosti (iz seje/org). */
  currentOrgName?: string | null
  currentVerticalLabel?: string | null
}) {
  const { t } = useI18n()
  const switcher = organizations && organizations.length > 1
  return (
    <aside className="hidden w-64 shrink-0 bg-card shadow-sm lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </Link>
        </div>
        {/* F7.1 K2: stalna identiteta okolja (ime podjetja + dejavnost z besedilom). */}
        {(currentOrgName || currentVerticalLabel) && (
          <div className="border-t px-4 py-2.5">
            <div className="truncate text-sm font-semibold text-foreground">
              {currentOrgName ?? "—"}
            </div>
            {currentVerticalLabel && (
              <div className="mt-1">
                <span className="bg-primary/10 text-primary-text inline-block rounded-md px-2 py-0.5 text-xs font-medium">
                  {currentVerticalLabel}
                </span>
              </div>
            )}
          </div>
        )}
        {switcher && (
          <div className="px-4 pb-2">
            <OrgSwitcher
              organizations={organizations}
              currentOrganizationId={currentOrganizationId ?? null}
            />
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <SidebarNav />
        </ScrollArea>

        {/* Footer */}
        <div className="space-y-2 p-4">
          <p className="text-center text-xs text-muted-foreground">
            {t.common.platformTagline}
          </p>
        </div>
      </div>
    </aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** F2.0: own ACTIVE memberships, same source as the desktop sidebar. */
  organizations?: { id: string; name: string }[]
  currentOrganizationId?: string | null
  /** F7.1 K2: identiteta okolja tudi v mobilnem listu. */
  currentOrgName?: string | null
  currentVerticalLabel?: string | null
}

export function MobileSidebar({
  open,
  onOpenChange,
  organizations,
  currentOrganizationId = null,
  currentOrgName,
  currentVerticalLabel,
}: MobileSidebarProps) {
  const { t } = useI18n()
  // F2.0: the phone used to have NO switcher at all — OrgSwitcher only lived
  // in the `hidden lg:block` desktop aside. Gate is membership count, never
  // a role, so STAFF/CLIENTE with 2+ workspaces can switch here too.
  const switcher = organizations && organizations.length > 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="flex h-16 shrink-0 flex-row items-center justify-between px-4">
          <SheetTitle className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <CloseIcon size={18} />
            <span className="sr-only">{t.common.header.closeMenu}</span>
          </Button>
        </SheetHeader>
        {switcher && (
          <div className="shrink-0 px-4 pb-2">
            <OrgSwitcher
              organizations={organizations}
              currentOrganizationId={currentOrganizationId}
              onPicked={() => onOpenChange(false)}
            />
          </div>
        )}
        {/* F7.1 K2: identiteta okolja v mobilnem menu (ime + dejavnost). */}
        {(currentOrgName || currentVerticalLabel) && (
          <div className="shrink-0 border-t px-4 py-2.5">
            <div className="truncate text-sm font-semibold">
              {currentOrgName ?? "—"}
            </div>
            {currentVerticalLabel && (
              <span className="bg-primary/10 text-primary-text mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium">
                {currentVerticalLabel}
              </span>
            )}
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1 py-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
