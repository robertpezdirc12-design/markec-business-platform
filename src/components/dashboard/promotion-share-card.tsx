"use client"

// ============================================================
// F5.1 — SHAREABLE LINK + QR ZA PROMOCIJO (Shopify vzorec)
//
// Povezava vodi obiskovalca na javno stran podjetja z domačo vključitvijo
// promocijske kode (?code=) — CartContent jo prebere in takoj preveri.
// Skrbnik povezavo kopira ali deli QR v e-pošti/letaku/družbenih omrežjih.
// ============================================================

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Link2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

interface PromotionShareCardProps {
  /** Tenant slug — za sestavo javne povezave. */
  orgSlug: string | null
  /** Promocijska koda (če promocija nima kode, deljenje ni smiselno). */
  code: string | null
  name: string
}

export function PromotionShareCard({ orgSlug, code, name }: PromotionShareCardProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  if (!code) {
    return null // Samodejna promocija brez kode ni deljiva s povezavo.
  }

  // Relativna javna pot → absolutni URL na zahtevo stranke v trgovini.
  const relativePath = orgSlug
    ? `/s/${orgSlug}/shop?code=${encodeURIComponent(code)}`
    : `/shop?code=${encodeURIComponent(code)}`
  const href =
    typeof window !== "undefined"
      ? `${window.location.origin}${relativePath}`
      : relativePath

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      toast.success(t.promotions.linkCopied)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — show the link as a toast so it can be copied manually.
      toast.info(href)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 size={18} aria-hidden="true" />
          {t.promotions.shareTitle}
        </CardTitle>
        <CardDescription>{t.promotions.shareDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-md border bg-white p-2">
          <QRCodeSVG value={href} size={112} title={`${name} — ${code}`} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Tag size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{code}</code>
          </div>
          <p className="text-muted-foreground break-all rounded-md border bg-muted/30 p-2 text-xs">
            {href}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? (
                <Check size={14} className="mr-1" aria-hidden="true" />
              ) : (
                <Copy size={14} className="mr-1" aria-hidden="true" />
              )}
              {copied ? t.promotions.linkCopiedShort : t.promotions.copyLink}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}