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
import { useState, useTransition, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { switchActiveOrganization } from "@/app/actions/organization-switch"
import { useI18n } from "@/lib/i18n/provider"
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
  StarIcon,
} from "@/components/icons"
import { usePermissions } from "@/components/admin/permissions-provider"
import {
  DASHBOARD_NAV,
  NAV_SECTIONS,
  isNavItemActive,
  isNavItemVisible,
  type DashboardNavItem,
  type NavSectionKey,
} from "@/lib/navigation/dashboard-nav"

/** Ikone po poti — podatki navigacije so čisti (brez React komponent). */
const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "/dashboard": LayoutDashboardIcon,
  "/dashboard/analytics": ChartBarIcon,
  "/dashboard/appointments": CalendarIcon,
  "/dashboard/waitlist": ClockIcon,
  "/dashboard/walk-in": UsersIcon,
  "/dashboard/customers": UsersIcon,
  "/dashboard/reviews": StarIcon,
  "/dashboard/marketing": EnvelopeIcon,
  "/dashboard/services": ScissorsIcon,
  "/dashboard/products": PackageIcon,
  "/dashboard/categories": FolderIcon,
  "/dashboard/packages": ToteIcon,
  "/dashboard/promotions": TagIcon,
  "/dashboard/orders": ShoppingBagIcon,
  "/dashboard/work-orders": ReceiptIcon,
  "/dashboard/documents": FileTextIcon,
  "/dashboard/einvoices": ReceiptIcon,
  "/dashboard/cash-register": WalletIcon,
  "/dashboard/payments": ReceiptIcon,
  "/dashboard/forms": SlidersIcon,
  "/dashboard/records": StackIcon,
  "/dashboard/projects": FolderIcon,
  "/dashboard/apiculture": HouseIcon,
  "/dashboard/tire-service": WrenchIcon,
  "/dashboard/traceability": StackIcon,
  "/dashboard/seamstress": ScissorsIcon,
  "/dashboard/staff": UserCogIcon,
  "/dashboard/roles": LockIcon,
  "/dashboard/settings": SettingsIcon,
}

const COLLAPSED_KEY = "markec.nav.collapsed"

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { t, term, profile } = useI18n()
  const { permissions, isAdmin } = usePermissions()

  // Capability/permission gate (EPIC #1 §21 + G8) — pravilo živi v
  // src/lib/navigation/dashboard-nav.ts, da ga uporablja tudi ⌘K paleta.
  const visibleItems = useMemo(
    () =>
      DASHBOARD_NAV.filter((item) =>
        isNavItemVisible(item, {
          capabilities: profile.capabilities as unknown as Record<string, string>,
          extensions: profile.extensions,
          permissions,
          isAdmin,
        })
      ),
    [profile.capabilities, profile.extensions, permissions, isAdmin]
  )

  // Zložene skupine (2026-11-18): 23 postavk v enem stolpcu je bilo
  // neobvladljivih — zdaj 6 skupin, stanje se ohrani med obiski.
  const [collapsed, setCollapsed] = useState<NavSectionKey[]>([])
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCollapsed(parsed.filter(Boolean))
      }
    } catch {
      /* localStorage ni na voljo — ostane privzeto (vse odprto) */
    }
  }, [])

  const toggleSection = (key: NavSectionKey) => {
    setCollapsed((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
      } catch {
        /* shramba ni na voljo — zlaganje velja samo v tej seji */
      }
      return next
    })
  }

  const renderItem = (item: DashboardNavItem) => {
    const isActive = isNavItemActive(item, pathname)
    const IconComponent = NAV_ICONS[item.href] ?? LayoutDashboardIcon
    const label = item.termKey
      ? term(item.termKey)
      : t.common.nav[item.nameKey]
    return (
      <Link
        key={item.nameKey}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <IconComponent size={18} className={cn(isActive && "text-primary-foreground")} />
        <span className="truncate">{label}</span>
      </Link>
    )
  }

  return (
    <nav aria-label="Glavna navigacija" className="space-y-2 px-3">
      {NAV_SECTIONS.map((section) => {
        const items = visibleItems.filter((item) => item.section === section)
        if (items.length === 0) return null
        // Skupina, v kateri je aktivna stran, je VEDNO odprta — sicer bi
        // uporabnik po navigaciji videl prazno mesto brez razlage.
        const hasActive = items.some((item) => isNavItemActive(item, pathname))
        const isCollapsed = collapsed.includes(section) && !hasActive
        const label = t.common.navGroups?.[section] ?? section
        return (
          <div key={section}>
            <button
              type="button"
              onClick={() => toggleSection(section)}
              aria-expanded={!isCollapsed}
              aria-controls={`nav-section-${section}`}
              className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 rounded-md px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wide uppercase transition-colors"
            >
              <span>{label}</span>
              <ChevronDown
                size={12}
                className={cn("shrink-0 transition-transform", isCollapsed && "-rotate-90")}
              />
            </button>
            {!isCollapsed && (
              <div id={`nav-section-${section}`} className="space-y-0.5">
                {items.map(renderItem)}
              </div>
            )}
          </div>
        )
      })}
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
