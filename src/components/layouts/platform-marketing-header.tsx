// ============================================================
// PLATFORM MARKETING HEADER
// Skupna glava za platformne strani (Cenik, Pogoji, Zasebnost,
// Piškotki) — audit 2026-11-17: te strani prej niso imele NOBENE
// navigacije (layout (public) za platformni kontekst upodobi samo
// <main>), zato je obiskovalec obtičal brez poti naprej.
// Server component — brez JS, brez stanja.
// ============================================================

import Link from "next/link"
import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { label: "Poišči storitev", href: "/podjetja" },
  { label: "Cenik", href: "/pricing" },
  { label: "Za podjetja", href: "/za-podjetja" },
]

export function PlatformMarketingHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
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
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Prijava</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Registracija</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
