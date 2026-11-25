// ============================================================
// MOBILE MARKETPLACE SEARCH
// Desktop GET obrazec živi v (marketplace)/layout.tsx (hidden md:flex).
// Na <768px ga nadomesti ta gumb + panel: uporabnik, ki je globoko v
// rezultatih /podjetja, lahko ponovno išče, ne da bi se moral vrniti
// na vrh strani do hero iskalnika.
//
// Enak vzorec kot marketing header: Escape + vrnitev fokusa, klik
// zunaj, samodejno zaprtje ob prehodu na namizno širino, inert ko
// je zaprt, 44x44 px cilji, motion-reduce.
// ============================================================

"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CloseIcon, MapPinIcon, SearchIcon } from "@/components/icons"

export function MobileSearch() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const mq = window.matchMedia("(min-width: 768px)")
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    mq.addEventListener("change", onChange)
    firstInputRef.current?.focus()

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
      mq.removeEventListener("change", onChange)
    }
  }, [open])

  return (
    <div ref={rootRef} className="md:hidden">
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={open ? "Zapri iskanje" : "Odpri iskanje"}
        aria-expanded={open}
        aria-controls="marketplace-mobile-search"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon size={20} /> : <SearchIcon size={20} />}
      </Button>

      <form
        id="marketplace-mobile-search"
        action="/podjetja"
        method="get"
        inert={!open}
        className={
          "absolute inset-x-0 top-full z-40 bg-background px-4 py-4 shadow-lg transition-all duration-200 ease-out motion-reduce:transition-none " +
          (open
            ? "max-h-80 border-b border-border opacity-100"
            : "pointer-events-none max-h-0 overflow-hidden border-b border-transparent opacity-0")
        }
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 py-2">
            <SearchIcon size={18} className="text-muted-foreground shrink-0" />
            <input
              ref={firstInputRef}
              type="text"
              name="q"
              aria-label="Storitev ali podjetje"
              placeholder="Kaj iščete? (storitev, salon...)"
              className="min-w-0 flex-1 rounded-md bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 py-2">
            <MapPinIcon size={18} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              name="location"
              aria-label="Kraj"
              placeholder="Lokacija"
              className="min-w-0 flex-1 rounded-md bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" className="min-h-11 w-full">
            Išči
          </Button>
        </div>
      </form>
    </div>
  )
}
