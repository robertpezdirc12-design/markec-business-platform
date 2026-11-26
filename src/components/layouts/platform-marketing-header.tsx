// ============================================================
// PLATFORM MARKETING HEADER
// Skupna glava za platformne strani (Cenik, Pogoji, Zasebnost,
// Piškotki) — audit 2026-11-17: te strani prej niso imele NOBENE
// navigacije (layout (public) za platformni kontekst upodobi samo
// <main>), zato je obiskovalec obtičal brez poti naprej.
//
// Responsive nadgradnja (2026-11-25): na mobilnih <768 px so bile
// vse navigacijske povezave skrite (`hidden md:flex`) BREZ zamenjave
// — uporabnik do Cenika / Za podjetja / Poišči storitev sploh ni
// imel poti iz glave. Dodan je dostopen hamburger meni z:
//   • Escape zapre in vrne fokus na gumb,
//   • klik zunaj zapre,
//   • samodejno zaprtje ob prehodu na namizno širino,
//   • 44x44 px ciljna področja (WCAG 2.5.8 / audit #54),
//   • aria-expanded / aria-controls / aria-current,
//   • inert panel ko je zaprt (tab fokus ne uhaja v skriti nav).
// ============================================================

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Poišči storitev", href: "/podjetja" },
  { label: "Cenik", href: "/pricing" },
  { label: "Za podjetja", href: "/za-podjetja" },
]

export function PlatformMarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  const close = () => setMobileOpen(false)
  const isActive = (href: string) => pathname === href

  // Escape zapre meni in vrne fokus na toggler — standardni overlay vzorec.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mobileOpen])

  // Klik izven glave zapre meni (ne pozabi: panel je znotraj <header>).
  useEffect(() => {
    if (!mobileOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [mobileOpen])

  // Rotacija / razširitev okna na >=md: zapri, da ne ostane pol-odprt panel.
  useEffect(() => {
    if (!mobileOpen) return
    const mq = window.matchMedia("(min-width: 768px)")
    const onChange = () => {
      if (mq.matches) setMobileOpen(false)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mobileOpen])

  // Tipkovnici: ob odprtju prestavi fokus na prvo povezavo v meniju.
  useEffect(() => {
    if (mobileOpen) firstLinkRef.current?.focus()
  }, [mobileOpen])

  return (
    <header
      ref={headerRef}
      className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur"
    >
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" onClick={close} className="flex min-h-11 items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg font-bold">
            M
          </div>
          <span className="text-xl font-bold">MARKEC</span>
        </Link>

        <nav
          aria-label="Glavna navigacija"
          className="hidden items-center gap-6 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center border-b-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Namizne akcije — na mobilnem jih nadomesti spodnji panel. */}
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Prijava</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Registracija</Link>
          </Button>
        </div>

        <Button
          ref={toggleRef}
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={mobileOpen ? "Zapri navigacijski meni" : "Odpri navigacijski meni"}
          aria-expanded={mobileOpen}
          aria-controls="marketing-mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobilni panel — vedno v DOM, animiran z max-height; inert ko zaprt. */}
      <nav
        id="marketing-mobile-nav"
        aria-label="Mobilna navigacija"
        inert={!mobileOpen}
        className={cn(
          "absolute inset-x-0 top-full z-40 overflow-hidden bg-background shadow-lg transition-all duration-200 ease-out md:hidden motion-reduce:transition-none",
          mobileOpen
            ? "max-h-96 border-b border-border opacity-100"
            : "max-h-0 border-b border-transparent opacity-0"
        )}
      >
        <div className="container mx-auto flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              ref={index === 0 ? firstLinkRef : undefined}
              onClick={close}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-base font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary/10 text-primary-text"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}

          <div className="my-2 h-px bg-border" role="separator" />

          <Button asChild variant="ghost" className="justify-start" onClick={close}>
            <Link href="/login">Prijava</Link>
          </Button>
          <Button asChild className="mt-1 w-full" onClick={close}>
            <Link href="/register">Registracija</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
