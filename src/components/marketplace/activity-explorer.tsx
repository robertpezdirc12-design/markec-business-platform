// ============================================================
// ACTIVITY EXPLORER — "zemljevid dejavnosti" za tržnico.
//
// Odločitev 2026-11-25: geografski zemljevidNI ima smisla, dokler
// snapshot nima koordinat in resničnih podjetij (zdaj 0/0). Namesto
// tega uporabniku ponudimo iskalni pregled 14 resničnih kategorij
// iz MARKETPLACE_CATEGORIES — en vir, ki ga že uporabljajo noge,
// /kategorije/[slug] in seznami.
//
// Click → kanonična pot /kategorije/<slug> (ne ?q=), zato je
// rezultat pošten in SEO-viden. Dialog ima lastno ograjo fokusa
// in Escape iz radix primitive; 44 px cilji; filter brez serverja.
// ============================================================

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { LayoutGrid, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories"

export function ActivityExplorer() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("sl")
    if (!normalized) return MARKETPLACE_CATEGORIES
    return MARKETPLACE_CATEGORIES.filter((category) =>
      `${category.label} ${category.description}`
        .toLocaleLowerCase("sl")
        .includes(normalized)
    )
  }, [query])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-2"
        onClick={() => setOpen(true)}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        Vse dejavnosti
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zemljevid dejavnosti</DialogTitle>
            <DialogDescription>
              Izberite dejavnost in si oglejte podjetja, ki jo res izvajajo.
            </DialogDescription>
          </DialogHeader>

          <label className="border-border focus-within:ring-ring flex min-h-11 items-center gap-2 rounded-lg border px-3 focus-within:ring-2">
            <Search
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Iščite dejavnost ..."
              aria-label="Iščite dejavnost"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          {filtered.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((category) => (
                <Link
                  key={category.slug}
                  href={`/kategorije/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="hover:border-primary hover:bg-primary/5 flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors"
                >
                  <span className="text-xl" aria-hidden="true">
                    {category.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {category.label}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {category.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Ni dejavnosti za »{query}«.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
