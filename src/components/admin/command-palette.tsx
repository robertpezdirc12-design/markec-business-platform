"use client"

// ============================================================
// ⌘K UKAZNA PALETA (audit 2026-11-18).
//
// Fresha ima globalno iskanje v glavi; MARKEC ga ni imel — do tu.
// Eno vnosno polje, tri skupine zadetkov:
//   1. Hitra dejanja (nov termin/stranka/storitev/izdelek, javna stran)
//   2. Pojdi na (vse strani, ki jih član sploh sme videti)
//   3. Rezultati iz baze (stranke, storitve, izdelki, termini)
//
// Tipkovnica: ⌘K / Ctrl+K odpre, ↑↓ izbira, Enter izvede, Esc zapre.
// Pravice se preverijo DVakrat: v paleti (skrivanje) in v strežniški
// akciji (fail-closed) — paleta ni varnostna meja.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  searchDashboard,
  type SearchHit,
  type SearchResults,
} from "@/app/actions/dashboard-search"
import {
  DASHBOARD_NAV,
  isNavItemVisible,
  type DashboardNavItem,
} from "@/lib/navigation/dashboard-nav"
import { useI18n } from "@/lib/i18n/provider"
import { usePermissions } from "@/components/admin/permissions-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { SearchIcon, PlusIcon, CalendarIcon, HouseIcon, UsersIcon, ScissorsIcon, PackageIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

const EMPTY_RESULTS: SearchResults = {
  customer: [],
  service: [],
  product: [],
  appointment: [],
}

interface PaletteEntry {
  id: string
  label: string
  hint?: string | null
  href: string
  kind: "action" | "destination" | "recent" | SearchHit["kind"]
}

const KIND_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  action: PlusIcon,
  destination: CalendarIcon,
  recent: CalendarIcon,
  customer: UsersIcon,
  service: ScissorsIcon,
  product: PackageIcon,
  appointment: CalendarIcon,
}

export function CommandPalette() {
  const router = useRouter()
  const { t, term, profile } = useI18n()
  const { permissions, isAdmin } = usePermissions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Počisti iskanje ob zaprtju. Klici so v handlerjih (ne v efektu), zato
  // ni kaskadnega izrisa: React Compiler opozori na setState v telesu efekta.
  const resetSearch = useCallback(() => {
    setQuery("")
    setResults(EMPTY_RESULTS)
    setActiveIndex(0)
  }, [])

  // ⌘K / Ctrl+K — globalna bližnjica (tudi ko je fokus v polju).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        // Zapiranje s tipkovnico ne gre skozi Dialog.onOpenChange.
        if (open) resetSearch()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, resetSearch])

  // Fokus po animaciji odpiranja — sicer Radix vrne fokus na trigger.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  // Radix pokliče to ob preklopu (Esc, klik na ozadje, gumb za zaprtje).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) resetSearch()
    },
    [resetSearch]
  )

  const navCtx = useMemo(
    () => ({
      capabilities: profile.capabilities as unknown as Record<string, string>,
      extensions: profile.extensions,
      permissions,
      isAdmin,
    }),
    [profile.capabilities, profile.extensions, permissions, isAdmin]
  )

  const navItems = useMemo(
    () => DASHBOARD_NAV.filter((item) => isNavItemVisible(item, navCtx)),
    [navCtx]
  )

  const label = useCallback(
    (item: DashboardNavItem) =>
      item.termKey ? term(item.termKey) : t.common.nav[item.nameKey],
    [t, term]
  )

  // ── U8: MRU (most-recently-used) prioriteta ─────────────────
  // Pogosto uporabljene akcije/strani se ob odprtju palete (prazen query)
  // pokažejo kot prva skupina "Zadnje". Shranjeno versioned v localStorage
  // (CLAUDE.md → pravilo #19: versioned + minimizirano, max 8 vnosov).
  const RECENT_KEY = "mec:palette-recent:v1"
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem(RECENT_KEY)
      const parsed = raw ? (JSON.parse(raw) as string[]) : []
      return Array.isArray(parsed) ? parsed.slice(0, 8) : []
    } catch {
      return []
    }
  })

  const remember = useCallback(
    (entry?: PaletteEntry) => {
      if (!entry) return
      if (entry.kind !== "action" && entry.kind !== "destination" && entry.kind !== "recent")
        return
      const next = [entry.id, ...recentIds.filter((id) => id !== entry.id)].slice(0, 8)
      setRecentIds(next)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* lokalno shranjevanje lahko pade (npr. private mode) — ignoriraj */
      }
    },
    [RECENT_KEY, recentIds]
  )

  // Rezultati veljajo samo za poizvedbe z vsaj 2 znakoma — tako ostanejo
  // stari zadetki skriti brez dodatnega setState klica.
  const activeResults = query.trim().length >= 2 ? results : EMPTY_RESULTS

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLocaleLowerCase("sl")
    const match = (text: string) => !q || text.toLocaleLowerCase("sl").includes(q)

    const canAction = (capability: string | undefined, permission: string) =>
      (!capability || navCtx.capabilities[capability] !== "disabled") &&
      (navCtx.permissions as readonly string[]).includes(permission)

    const actions: PaletteEntry[] = [
      { id: "act-appointment", label: t.common.navGroups.actionAppointment, href: "/dashboard/appointments/new", capability: "appointments", permission: "appointments.manage" },
      { id: "act-customer", label: t.common.navGroups.actionCustomer, href: "/dashboard/customers", capability: "customers", permission: "customers.manage" },
      { id: "act-service", label: t.common.navGroups.actionService, href: "/dashboard/services", capability: "services", permission: "services.manage" },
      { id: "act-product", label: t.common.navGroups.actionProduct, href: "/dashboard/products", capability: "shop", permission: "products.manage" },
      { id: "act-site", label: t.common.navGroups.actionSite, href: "/dashboard/settings", capability: undefined, permission: "settings.manage" },
    ]
      .filter((a) => canAction(a.capability, a.permission) && match(a.label))
      .map((a) => ({ id: a.id, label: a.label, href: a.href, kind: "action" as const }))

    const destinations: PaletteEntry[] = navItems
      .filter((item) => match(label(item)))
      .map((item) => ({
        id: `nav-${item.nameKey}`,
        label: label(item),
        href: item.href,
        kind: "destination" as const,
      }))

    const dbEntries: PaletteEntry[] = (Object.keys(activeResults) as SearchHit["kind"][])
      .flatMap((kind) =>
        activeResults[kind].map((hit) => ({
          id: `${kind}-${hit.id}`,
          label: hit.title,
          hint: hit.subtitle,
          href: hit.href,
          kind,
        }))
      )

    // U8 — zgradi MRU skupino (Zadnje) iz pomnjenih id akcij/strani.
    // Brinalco: recent id, ki ni več v nav (npr. odstranjen modul), se
    // izpusti; dejanja/strani z istim id ne morejo še enkrat spodaj.
    const recent: PaletteEntry[] = recentIds
      .map((id) => [...actions, ...destinations].find((e) => e.id === id))
      .filter((e): e is PaletteEntry => Boolean(e))
      .map((e) => ({ ...e, kind: "recent" as const }))
    const recentIdSet = new Set(recentIds)
    const actionsRest = actions.filter((a) => !recentIdSet.has(a.id))
    const destinationsRest = destinations.filter((d) => !recentIdSet.has(d.id))

    // Brez vprašanja: dejanja + strani, MRU (Zadnje) na vrhu.
    return q
      ? [...dbEntries, ...destinations, ...actions]
      : [...recent, ...actionsRest, ...destinationsRest]
  }, [query, navItems, activeResults, label, t, navCtx, recentIds])

  // Iskanje po bazi z zakasnitvijo — brez poizvedbe na vsak pritisk.
  useEffect(() => {
    const q = query.trim()
    // Pod 2 znakoma ne iščemo; prazne zadetke izpeljemo spodaj (brez setState v efektu).
    if (q.length < 2) return
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await searchDashboard(q))
        } catch {
          setResults(EMPTY_RESULTS)
        }
      })
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query])

  const run = useCallback(
    (entry?: PaletteEntry) => {
      if (!entry) return
      remember(entry)
      setOpen(false)
      resetSearch()
      router.push(entry.href)
    },
    [router, remember, resetSearch]
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(entries.length - 1, 0)))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      run(entries[activeIndex])
    }
  }

  // Aktivno postavko drži v vidnem polju.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const groups = useMemo(() => {
    const bySection = new Map<string, PaletteEntry[]>()
    for (const entry of entries) {
      const key =
        entry.kind === "action"
          ? "actions"
          : entry.kind === "destination"
            ? "destinations"
            : entry.kind === "recent"
              ? "recent"
              : "results"
      const list = bySection.get(key) ?? []
      list.push(entry)
      bySection.set(key, list)
    }
    return bySection
  }, [entries])

  const groupTitle = (key: string) =>
    key === "actions"
      ? t.common.navGroups.quickActions
      : key === "destinations"
        ? t.common.navGroups.destinations
        : key === "recent"
          ? t.common.navGroups.recent
          : t.common.navGroups.results

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.common.navGroups.searchPlaceholder}
        className="text-muted-foreground hover:bg-muted/60 hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors sm:flex"
      >
        <SearchIcon size={16} />
        <span className="hidden lg:inline">Išči …</span>
        <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] lg:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">
            {t.common.navGroups.searchPlaceholder}
          </DialogTitle>
          <div className="border-border/60 flex items-center gap-2 border-b px-3">
            <SearchIcon size={18} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={t.common.navGroups.searchPlaceholder}
              aria-label={t.common.navGroups.searchPlaceholder}
              className="placeholder:text-muted-foreground h-12 w-full rounded-md bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            {pending && <span className="text-muted-foreground text-xs">…</span>}
          </div>

          <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
            {entries.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                {t.common.navGroups.noResults}
              </p>
            ) : (
              (["recent", "results", "destinations", "actions"] as const).map((key) => {
                const list = groups.get(key)
                if (!list?.length) return null
                return (
                  <div key={key} className="mb-1">
                    <p className="text-muted-foreground px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                      {groupTitle(key)}
                    </p>
                    {list.map((entry) => {
                      const index = entries.indexOf(entry)
                      const Icon = KIND_ICON[entry.kind] ?? HouseIcon
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-index={index}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => run(entry)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                            index === activeIndex
                              ? "bg-primary/10 text-foreground"
                              : "hover:bg-muted/60"
                          )}
                        >
                          <Icon size={16} className="text-muted-foreground shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                          {entry.hint && (
                            <span className="text-muted-foreground shrink-0 truncate text-xs">
                              {entry.hint}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          <div className="text-muted-foreground border-border/60 flex items-center gap-3 border-t px-4 py-2 text-[11px]">
            <span>↑↓</span>
            <span>Enter</span>
            <span>Esc</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
