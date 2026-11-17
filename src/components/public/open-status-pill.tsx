"use client"

// ============================================================
// ZNAČKA »ODPRTO DO 19:00« na javni strani podjetja.
//
// Delovni čas pride iz vsebine strani (content.openingHours), zato je
// prikaz vedno v skladu s tem, kar lastnik vidi v urejevalniku. Stanje
// se preračuna vsako minuto — ob 19:00 značka sama preklopi v »Zaprto ·
// odpre se jutri ob 9:00« (brez osvežitve strani).
// ============================================================

import { useEffect, useState } from "react"
import { ClockIcon } from "@/components/icons"
import { openStateFor, type OpeningHour } from "@/lib/hours/open-state"
import { cn } from "@/lib/utils"

export function OpenStatusPill({
  hours,
  className,
}: {
  hours: OpeningHour[] | undefined | null
  className?: string
}) {
  const [state, setState] = useState(() => openStateFor(hours))

  useEffect(() => {
    setState(openStateFor(hours))
    const timer = window.setInterval(() => setState(openStateFor(hours)), 60_000)
    return () => window.clearInterval(timer)
  }, [hours])

  if (state.state === "unknown") return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        state.state === "open"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-foreground/10 text-foreground/80",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-1.5 rounded-full",
          state.state === "open" ? "bg-emerald-500" : "bg-foreground/40"
        )}
      />
      <ClockIcon size={13} />
      {state.state === "open" ? `Odprto do ${state.until}` : state.label}
    </span>
  )
}
