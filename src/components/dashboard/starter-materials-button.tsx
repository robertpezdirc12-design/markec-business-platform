"use client"

// Audit 2026-11-18: nov atelje je na strani zaloge zagledal prazen seznam
// brez poti naprej — »Materiali / zaloga« je vodil v prazno tabelo, kupec
// pa ni vedel, kaj sploh vpisati. Ta gumb v eni potezi doda standardne
// materiale za šivanje (blago, zadrga, gumbi …).

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SparkleIcon } from "@/components/icons"
import { addStarterMaterials } from "@/app/actions/seamstress"

export function StarterMaterialsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  async function add() {
    setBusy(true)
    try {
      const res = await addStarterMaterials()
      if (!res.ok) {
        toast.error(res.error ?? "Materialov ni bilo mogoče dodati.")
        return
      }
      toast.success(
        res.created > 0
          ? `Dodanih materialov: ${res.created}.`
          : "Materiali so že v zalogi."
      )
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={add} disabled={busy} className="min-h-11">
      <SparkleIcon size={16} className="mr-2" aria-hidden="true" />
      {busy ? "Dodajam …" : "Dodaj pripravljene materiale"}
    </Button>
  )
}
