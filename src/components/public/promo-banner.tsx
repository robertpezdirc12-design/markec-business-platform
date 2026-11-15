"use client"

// ============================================================
// F5.1 — REKLAMNA PASICA AKTIVNE AKCIJE na javni spletni strani.
// Server izračuna, katere promocije so trenutno veljavne (public.ts),
// ta komponenta eno ali več prikaže kot zgornjo pasico nad menijem.
// Dismiss ni shranjen (majhen, enkrat — ne moti nakupa).
// ============================================================

import { useState } from "react"
import { X, Tag } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import type { PublicActivePromotion } from "@/lib/promotions/public"

export function PromoBanner({ promos }: { promos: PublicActivePromotion[] }) {
  const { locale } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  if (promos.length === 0 || dismissed) return null

  const codeLabel =
    locale === "en" ? "with code" : "s kodo"
  const autoLabel =
    locale === "en" ? "automatic at checkout" : "samodejno pri zaključku"

  return (
    <div
      role="region"
      aria-label={locale === "en" ? "Active promotions" : "Aktivne akcije"}
      className="bg-primary text-primary-foreground w-full"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm font-medium">
        {promos.map((p) => (
          <span key={p.id} className="flex flex-wrap items-center gap-1.5">
            <Tag size={13} aria-hidden="true" className="opacity-80" />
            <span>
              {p.name} · <strong className="font-semibold">{p.discountLabel}</strong>
              {p.code ? (
                <span className="ml-1.5">
                  {codeLabel} <code className="rounded bg-background/15 px-1 py-0.5 font-semibold">{p.code}</code>
                </span>
              ) : (
                <span className="opacity-80"> · {autoLabel}</span>
              )}
            </span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={locale === "en" ? "Dismiss promotions" : "Skrij akcije"}
          className="ml-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}