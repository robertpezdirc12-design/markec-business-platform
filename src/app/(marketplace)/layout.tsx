import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SearchIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon,
  MenuIcon,
} from "@/components/icons"

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
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              M
            </div>
            <span className="text-xl font-bold">MARKEC</span>
          </Link>

          {/* Search bar (desktop) */}
          <div className="hidden flex-1 items-center gap-2 px-8 md:flex">
            <div className="flex flex-1 items-center gap-2 rounded-full border px-4 py-2">
              <SearchIcon size={18} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Kaj iščete? (storitev, salon...)"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border px-4 py-2">
              <MapPinIcon size={18} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Lokacija"
                className="w-32 bg-transparent text-sm outline-none"
              />
            </div>
            <Button size="sm" className="rounded-full px-6">
              Išči
            </Button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Prijava
              </Button>
            </Link>
            <Link href="/pricing" className="hidden sm:block">
              <Button variant="outline" size="sm">
                Za podjetja
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Registracija</Button>
            </Link>
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
                <li><Link href="/podjetja" className="hover:text-foreground">Razišči podjetja</Link></li>
                <li><Link href="/kategorije/frizerski-saloni" className="hover:text-foreground">Kategorije</Link></li>
                <li><Link href="/moji-termini" className="hover:text-foreground">Moji termini</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Prijava</Link></li>
              </ul>
            </div>

            {/* Za podjetja */}
            <div>
              <h3 className="mb-3 font-semibold">Za podjetja</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/pricing" className="hover:text-foreground">Cenik</Link></li>
                <li><Link href="/register" className="hover:text-foreground">Registracija podjetja</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Prijava podjetja</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Funkcije</Link></li>
              </ul>
            </div>

            {/* Pravno */}
            <div>
              <h3 className="mb-3 font-semibold">Pravno</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground">Pogoji uporabe</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground">Zasebnost</Link></li>
                <li><Link href="/cookies" className="hover:text-foreground">Piškotki</Link></li>
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