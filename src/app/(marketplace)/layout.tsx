import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SearchIcon, MapPinIcon } from "@/components/icons"
import { MobileSearch } from "@/components/marketplace/mobile-search"

export const metadata: Metadata = {
  title: "MARKEC — Rezervirajte lokalne storitve",
  description:
    "Odkrijte najbolje ocenjene salone, brivce, zdravnike in lepotne strokovnjake. Rezervirajte termin v nekaj klikih.",
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-3 sm:px-4">
          {/* Logo */}
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              M
            </div>
            <span className="text-xl font-bold">MARKEC</span>
          </Link>

          {/* Search bar (desktop) — F0.6: real GET form, no dead inputs. */}
          <form
            action="/podjetja"
            method="get"
            className="hidden flex-1 items-center gap-2 px-8 md:flex"
          >
            <label className="flex flex-1 items-center gap-2 rounded-full border px-4 py-2">
              <SearchIcon size={18} className="text-muted-foreground" />
              <input
                type="text"
                name="q"
                aria-label="Storitev ali podjetje"
                placeholder="Kaj iščete? (storitev, salon...)"
                className="min-w-0 flex-1 rounded-md bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
            </label>
            <label className="flex items-center gap-2 rounded-full border px-4 py-2">
              <MapPinIcon size={18} className="text-muted-foreground" />
              <input
                type="text"
                name="location"
                aria-label="Kraj"
                placeholder="Lokacija"
                className="w-32 min-w-0 rounded-md bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
            </label>
            <Button type="submit" size="sm" className="rounded-full px-6">
              Išči
            </Button>
          </form>

          {/* Desne akcije — na mobilnem je iskalnik zavit v gumb. */}
          <div className="flex items-center gap-1 sm:gap-3">
            <MobileSearch />
            <Button asChild variant="ghost" size="sm" className="h-11 px-3 md:h-8">
              <Link href="/login">Prijava</Link>
            </Button>
            <Link href="/pricing" className="hidden sm:block">
              <Button variant="outline" size="sm" className="h-11 px-4 md:h-8">
                Za podjetja
              </Button>
            </Link>
            <Button asChild size="sm" className="h-11 px-3 md:h-8 md:px-4">
              <Link href="/register">Registracija</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  M
                </div>
                <span className="text-lg font-bold">MARKEC</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Platforma za rezervacijo lokalnih storitev. Odkrijte in rezervirajte v nekaj klikih.
              </p>
            </div>

            {/* Za stranke */}
            <div>
              <h3 className="mb-3 font-semibold">Za stranke</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/podjetja" className="inline-flex min-h-11 items-center hover:text-foreground">Razišči podjetja</Link></li>
                <li><Link href="/kategorije/frizerski-saloni" className="inline-flex min-h-11 items-center hover:text-foreground">Kategorije</Link></li>
                <li><Link href="/moji-termini" className="inline-flex min-h-11 items-center hover:text-foreground">Moji termini</Link></li>
                <li><Link href="/login" className="inline-flex min-h-11 items-center hover:text-foreground">Prijava</Link></li>
              </ul>
            </div>

            {/* Za podjetja */}
            <div>
              <h3 className="mb-3 font-semibold">Za podjetja</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-foreground">Cenik</Link></li>
                <li><Link href="/register" className="inline-flex min-h-11 items-center hover:text-foreground">Registracija podjetja</Link></li>
                <li><Link href="/login" className="inline-flex min-h-11 items-center hover:text-foreground">Prijava podjetja</Link></li>
                <li><Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-foreground">Funkcije</Link></li>
              </ul>
            </div>

            {/* Pravno */}
            <div>
              <h3 className="mb-3 font-semibold">Pravno</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">Pogoji uporabe</Link></li>
                <li><Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">Zasebnost</Link></li>
                <li><Link href="/cookies" className="inline-flex min-h-11 items-center hover:text-foreground">Piškotki</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 MARKEC. Vse pravice pridržane.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}