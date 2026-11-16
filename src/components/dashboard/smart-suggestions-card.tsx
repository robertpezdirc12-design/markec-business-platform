"use client"

// ============================================================
// PAMETNI PREDLOGI KARTICA (2D-1M) — non-blocking, org-scoped,
// data-driven next-actions card for the workspace dashboard.
//
// Renders a small greeting + up to N useful suggestions derived from
// the tenant's REAL data (computed server-side and passed in). Clicking
// a suggestion navigates to the relevant function (direct CTA). The card
// can be dismissed (client-side preference, no schema change); it never
// blocks anything — the surrounding workspace is always usable.
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Suggestion } from "@/lib/profiles/smart-suggestions"

const DISMISS_KEY = "markec.suggestions.dismissed"

interface Props {
  verticalLabel: string
  suggestions: Suggestion[]
}

export function SmartSuggestionsCard({ verticalLabel, suggestions }: Props) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      return false
    }
  })
  const [loaded] = useState(true)

  if (!loaded || dismissed || suggestions.length === 0) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Dobrodošli v svoj prostor · {verticalLabel}
          </h2>
          <p className="text-muted-foreground text-xs">
            Pametni predlogi — naslednji naravni koraki glede na stanje vaših podatkov. Nič obvezno, tu ste, ko jih imate čas.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Skrij predloge"
          onClick={dismiss}
          className="h-7 w-7"
        >
          <X size={15} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s) => (
          <Link
            key={s.key}
            href={s.newRecordHref ?? s.href}
            className="group flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-muted-foreground text-xs">{s.description}</div>
            </div>
            <span className="text-primary mt-0.5 shrink-0 text-sm font-medium group-hover:underline">
              Naprej →
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}