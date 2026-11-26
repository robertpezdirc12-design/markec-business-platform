"use client"

// ============================================================
// Točka 6 — ZGODOVINA OBJAV (append-only) + vrnitev različice
// Odpre se iz vizualnega urejevalnika. Prikaže prejšnje objave;
// "Vrni to različico" prekopira izbrano vsebino nazaj v OSENUTEK
// (ne objavi samodejno — uporabnik po preverbi OBJAVI). Zgodovina
// se nikoli ne briše.
// ============================================================

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SpinnerGapIcon } from "@/components/icons"
import { toast } from "sonner"
import {
  listPublicationHistory,
  revertToPublication,
  type PublicationHistoryEntry,
} from "@/app/actions/publication"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PublicationHistoryDialog({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<PublicationHistoryEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listPublicationHistory())
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Osveži seznam ob vsakem odprtju — klic gre skozi `await`, zato ni
  // setState v telesu efekta; zastavica prepreči zapis po zaprtju.
  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      await Promise.resolve()
      if (alive) await load()
    })()
    return () => {
      alive = false
    }
  }, [open, load])

  async function handleRevert(id: string) {
    if (revertingId) return
    setRevertingId(id)
    const res = await revertToPublication(id)
    setRevertingId(null)
    if (!res.success) {
      toast.error(res.error ?? "Povratek ni uspel.")
      return
    }
    toast.success("Prejšnja različica je prestavljena v osnutek. Preverite in objavite.")
    onOpenChange(false)
    router.refresh()
    // Ponovno naloži urejevalnik, da osnutek odraža vrnjeno vsebino.
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Zgodovina objav</DialogTitle>
          <DialogDescription>
            Vsaka objava je shranjena. Prejšnjo različico lahko vrnete v osnutek z enim klikom.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {loading && !rows && (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <SpinnerGapIcon size={16} className="animate-spin" /> Nalaganje …
            </div>
          )}

          {!loading && rows && rows.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Še ni nobene objave.
            </p>
          )}

          {rows?.map((r, idx) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  Objava · verzija {r.contentVersion}
                  {idx === 0 ? " (trenutna)" : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {format(new Date(r.publishedAt), "d. MMM yyyy HH:mm")}
                </p>
              </div>
              <Button
                size="sm"
                variant={idx === 0 ? "outline" : "secondary"}
                disabled={idx === 0 || revertingId === r.id}
                onClick={() => handleRevert(r.id)}
              >
                {revertingId === r.id
                  ? "Vračam…"
                  : idx === 0
                    ? "Trenutna"
                    : "Vrni to različico"}
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zapri
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}