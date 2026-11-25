"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  MenuIcon,
  BellIcon,
  LogoutIcon,
  SettingsIcon,
  UsersIcon,
  HouseIcon,
  StorefrontIcon,
  ChatsCircleIcon,
  CalendarCheckIcon,
} from "@/components/icons"
import { Question as QuestionIcon } from "@phosphor-icons/react"
import { MobileSidebar } from "./sidebar"
import { CommandPalette } from "./command-palette"
import { LanguageSwitcher } from "./language-switcher"
import { useI18n } from "@/lib/i18n/provider"
import { getNavCounters } from "@/app/actions/nav-counters"

export function AdminHeader({
  orgSlug,
  organizations = [],
  currentOrganizationId = null,
  currentOrgName = null,
  currentVerticalLabel = null,
}: {
  orgSlug?: string | null
  /** F2.0: own ACTIVE memberships, computed server-side in (admin)/layout. */
  organizations?: { id: string; name: string }[]
  currentOrganizationId?: string | null
  /** F7.1 K2: identiteta okolja (ime + dejavnost) v zgornji vrstici. */
  currentOrgName?: string | null
  currentVerticalLabel?: string | null
}) {
  // Javna stran lastnega salona (/s/{slug}) — ne platformni landing (P0 #2 walkthrough).
  const publicSiteHref = orgSlug ? `/s/${orgSlug}` : "/"
  const router = useRouter()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useI18n()

  // Obvestila niso okras: števci prihajajo iz resničnih, org-scoped podatkov.
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [counters, setCounters] = useState<{
    chatActive: number
    waitlist: number
    apptPending: number
  } | null>(null)
  const [countersUnavailable, setCountersUnavailable] = useState(false)

  const handleNotificationsOpenChange = (open: boolean) => {
    setNotificationsOpen(open)
    if (open) {
      setCounters(null)
      setCountersUnavailable(false)
    }
  }

  useEffect(() => {
    if (!notificationsOpen) return
    let active = true

    getNavCounters()
      .then((result) => {
        if (!active) return
        if (result.ok && result.counters) setCounters(result.counters)
        else setCountersUnavailable(true)
      })
      .catch(() => {
        if (active) setCountersUnavailable(true)
      })

    return () => {
      active = false
    }
  }, [notificationsOpen])

  const notificationTotal = counters
    ? counters.chatActive + counters.waitlist + counters.apptPending
    : 0

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/login")
    router.refresh()
  }

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const userRole = session?.user?.role || "CLIENT"
  const isAdmin = userRole === "ADMIN"

  // F2.0: the workspace switcher is gated on OWN ACTIVE MEMBERSHIPS, not on
  // the global ADMIN role. Any member who actually has 2+ workspaces may
  // switch between them (the server action re-checks membership + ACTIVE).
  const canSwitchWorkspaces = organizations.length > 1

  const getRoleBadgeVariant = () => {
    switch (userRole) {
      case "ADMIN":
        return "default"
      case "STAFF":
        return "secondary"
      default:
        return "outline"
    }
  }

  const roleLabel =
    t.common.roles[userRole as keyof typeof t.common.roles] || userRole

  return (
    <>
      <header className="bg-card sticky top-0 z-40 shrink-0 shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left side - Menu (drawer) + identity — navigacija je v drsnem meniju
              (drawer) na vseh velikostih; leva stran je prosta za delovno površino. */}
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MenuIcon size={20} />
              <span className="sr-only">{t.common.header.openMenu}</span>
            </Button>
            {/* F7.1 K2: stalna identiteta okolja (ime podjetja + dejavnost) —
                vidna vselej, tudi na mobilnih napravah. */}
            {(currentOrgName || currentVerticalLabel) && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {currentOrgName ?? "—"}
                </div>
                {currentVerticalLabel && (
                  <span className="bg-primary/10 text-primary-text inline-block max-w-40 truncate rounded px-1.5 py-px text-[11px] font-medium leading-4">
                    {currentVerticalLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* ⌘K — globalno iskanje (audit 2026-11-18) */}
            <CommandPalette />

            {/* Language switcher */}
            <LanguageSwitcher />

            {/* Visit site link */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-2 sm:flex"
              asChild
            >
              <Link href={publicSiteHref} target="_blank">
                <HouseIcon size={16} />
                <span className="hidden md:inline">
                  {t.common.header.visitSite}
                </span>
              </Link>
            </Button>

            {/* Notifications — resnični, org-scoped števci. */}
            <DropdownMenu
              open={notificationsOpen}
              onOpenChange={handleNotificationsOpenChange}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative min-h-11 min-w-11"
                  aria-label={`${t.common.header.notifications}${
                    notificationTotal > 0 ? ` (${notificationTotal})` : ""
                  }`}
                >
                  <BellIcon size={20} />
                  {notificationTotal > 0 && (
                    <span
                      aria-hidden="true"
                      className="bg-destructive text-destructive-foreground absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4"
                    >
                      {notificationTotal > 9 ? "9+" : notificationTotal}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(20rem,calc(100vw-2rem))] p-0"
              >
                <DropdownMenuLabel className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">
                    {t.common.header.notifications}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Današnji pogled na dogajanje v poslovnem prostoru
                  </p>
                </DropdownMenuLabel>

                <div className="p-2">
                  {countersUnavailable ? (
                    <p className="text-muted-foreground px-2 py-5 text-center text-xs">
                      Obvestila trenutno niso dostopna za to vlogo.
                    </p>
                  ) : !counters ? (
                    <p className="text-muted-foreground px-2 py-5 text-center text-xs">
                      Nalagam obvestila…
                    </p>
                  ) : notificationTotal === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <div className="bg-muted mx-auto mb-3 flex size-9 items-center justify-center rounded-full">
                        <BellIcon size={18} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Za zdaj ni obvestil</p>
                      <p className="text-muted-foreground mx-auto mt-1 max-w-56 text-xs leading-relaxed">
                        Ko pride do nove rezervacije, odpovedi ali vprašanja stranke,
                        bo opozorilo tukaj.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {counters.chatActive > 0 && (
                        <DropdownMenuItem asChild className="min-h-11">
                          <Link href="/dashboard/chats" className="gap-3">
                            <ChatsCircleIcon size={18} />
                            <span className="flex-1">Neprebrani pogovori</span>
                            <span className="bg-primary/10 text-primary-text rounded px-2 py-0.5 text-xs font-semibold">
                              {counters.chatActive}
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {counters.apptPending > 0 && (
                        <DropdownMenuItem asChild className="min-h-11">
                          <Link href="/dashboard/appointments" className="gap-3">
                            <CalendarCheckIcon size={18} />
                            <span className="flex-1">Termini v potrditev</span>
                            <span className="bg-primary/10 text-primary-text rounded px-2 py-0.5 text-xs font-semibold">
                              {counters.apptPending}
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {counters.waitlist > 0 && (
                        <DropdownMenuItem asChild className="min-h-11">
                          <Link href="/dashboard/waitlist" className="gap-3">
                            <UsersIcon size={18} />
                            <span className="flex-1">Čakalna lista</span>
                            <span className="bg-primary/10 text-primary-text rounded px-2 py-0.5 text-xs font-semibold">
                              {counters.waitlist}
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm leading-none font-medium">
                        {session?.user?.name || t.common.header.user}
                      </p>
                      <Badge
                        variant={getRoleBadgeVariant()}
                        className="ml-2 text-xs"
                      >
                        {roleLabel}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs leading-none">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* F2.0: moved OUT of the ADMIN-only block. Role-agnostic by
                    design — membership count is the only meaningful gate. */}
                {canSwitchWorkspaces && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/workspaces">
                        <StorefrontIcon size={16} className="mr-2" />
                        Zamenjaj poslovni prostor
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/workspaces/manage">
                        <SettingsIcon size={16} className="mr-2" />
                        Moja podjetja
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/staff-portal">
                        <UsersIcon size={16} className="mr-2" />
                        {t.common.header.staffPortal}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={publicSiteHref}>
                        <HouseIcon size={16} className="mr-2" />
                        {t.common.header.viewAsClient}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <SettingsIcon size={16} className="mr-2" />
                    {t.common.header.settings}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/help">
                    <QuestionIcon size={16} className="mr-2" />
                    Pomoč in podpora
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 dark:text-red-400"
                >
                  <LogoutIcon size={16} className="mr-2" />
                  {t.common.header.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile sidebar — F2.0: same memberships as the desktop sidebar so
          the switcher exists on phones too, for every eligible role. */}
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        organizations={organizations}
        currentOrganizationId={currentOrganizationId}
        currentOrgName={currentOrgName}
        currentVerticalLabel={currentVerticalLabel}
      />
    </>
  )
}
