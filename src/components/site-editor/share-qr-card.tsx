"use client"

// ============================================================
// Točka 6 — QR koda + povezava za deljenje (po objavi)
// Prikaže javni URL podjetja (lastna domena, če je primarna in
// preverjena, sicer /s/{slug}) ter njegov QR. Omogoča kopiranje
// povezave in prenos QRja kot PNG.
// ============================================================

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { SpinnerGapIcon } from "@/components/icons"
import { toast } from "sonner"
import { getShareInfo, type ShareInfo } from "@/app/actions/publication"

export function ShareQrCard() {
  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Naloži ob priklopu. Stanje se nastavi šele po `await` (nikoli sinhrono
  // v telesu efekta) in zastavica prepreči zapis po odklopu komponente.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const next = await getShareInfo()
        if (alive) setInfo(next)
      } catch {
        if (alive) setInfo(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function copyUrl() {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.url)
      toast.success("Povezava kopirana.")
    } catch {
      toast.error("Kopiranje ni uspelo.")
    }
  }

  function downloadQr() {
    if (!info) return
    const svg = document.getElementById("tenant-qr")
    const text = svg ? new XMLSerializer().serializeToString(svg) : null
    if (!text) return
    const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${info.slug}-qr.svg`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Deli svojo stran</p>
        {info?.customDomain ? (
          <span className="text-muted-foreground text-xs">lastna domena · {info.customDomain}</span>
        ) : (
          <span className="text-muted-foreground text-xs">{info?.slug}</span>
        )}
      </div>

      {loading && (
        <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
          <SpinnerGapIcon size={16} className="animate-spin" /> Nalaganje povezave …
        </div>
      )}

      {!loading && info && (
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-md border bg-white p-2">
            <QRCodeSVG
              id="tenant-qr"
              value={info.url}
              size={96}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-xs text-muted-foreground" title={info.url}>
              {info.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyUrl}>
                Kopiraj povezavo
              </Button>
              <Button size="sm" variant="outline" onClick={downloadQr}>
                Prenesi QR
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && !info && (
        <p className="text-muted-foreground py-2 text-sm">Povezave ni mogoče prikazati.</p>
      )}
    </div>
  )
}